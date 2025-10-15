const db = require("../models");
const { Project, CountryTranslationGroup, TranslationItem, User } = db;

// 获取项目列表（分页、搜索、筛选）
exports.getProjects = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search; // 新增搜索参数

    const where = {};
    if (status) {
      where.status = status;
    }

    // 搜索功能：支持工单名称和描述模糊搜索
    if (search) {
      const { Op } = require("sequelize");
      where[Op.or] = [
        { job_name: { [Op.like]: `%${search}%` } },
        { job_description: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: projects } = await Project.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "full_name"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // 获取每个项目的统计信息
    const projectsWithStats = await Promise.all(
      projects.map(async (project) => {
        const countryCount = await CountryTranslationGroup.count({
          where: { project_id: project.id },
        });

        const translationCount = await TranslationItem.count({
          include: [
            {
              model: CountryTranslationGroup,
              as: "group",
              where: { project_id: project.id },
              attributes: [],
            },
          ],
        });

        return {
          ...project.toJSON(),
          statistics: {
            countryCount,
            translationCount,
          },
        };
      })
    );

    res.json({
      success: true,
      data: {
        projects: projectsWithStats,
        pagination: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("获取项目列表失败:", error);
    res.status(500).json({
      success: false,
      message: "获取项目列表失败",
      error: error.message,
    });
  }
};

// 获取项目详情
exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "full_name"],
        },
        {
          model: CountryTranslationGroup,
          as: "translationGroups",
          include: [
            {
              model: TranslationItem,
              as: "items",
              order: [["item_order", "ASC"]],
            },
          ],
          order: [["sequence_number", "ASC"]],
        },
      ],
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "项目不存在",
      });
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("获取项目详情失败:", error);
    res.status(500).json({
      success: false,
      message: "获取项目详情失败",
      error: error.message,
    });
  }
};

// 创建项目
exports.createProject = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { job_name, job_description, user_id, coze_result } = req.body;

    // 添加调试日志
    console.log("📥 创建项目请求数据:");
    console.log("  job_name:", job_name);
    console.log("  job_description:", job_description);
    console.log("  coze_result:", JSON.stringify(coze_result, null, 2));

    // 验证必需字段
    if (!job_name) {
      return res.status(400).json({
        success: false,
        message: "工单名称不能为空",
      });
    }

    // 检查工单名称是否已存在
    const existingProject = await Project.findOne({
      where: { job_name },
      include: [
        {
          model: CountryTranslationGroup,
          as: "translationGroups",
          include: [
            {
              model: TranslationItem,
              as: "items",
            },
          ],
        },
      ],
    });

    let project;

    if (existingProject) {
      console.log(`📝 发现已存在项目: ${job_name}，将进行更新操作`);
      project = existingProject;

      // 更新项目基本信息
      await project.update(
        {
          job_description: job_description || project.job_description,
          status:
            coze_result && coze_result.data ? "processing" : project.status,
        },
        { transaction }
      );
    } else {
      // 创建新项目
      project = await Project.create(
        {
          job_name,
          job_description,
          user_id,
          status: coze_result && coze_result.data ? "processing" : "draft",
          total_files: 0,
        },
        { transaction }
      );
    }

    // 如果有 Coze 解析结果，则处理翻译数据
    if (coze_result && coze_result.data) {
      // 解析 data 字段（可能是字符串）
      let output;
      try {
        output =
          typeof coze_result.data === "string"
            ? JSON.parse(coze_result.data)
            : coze_result.data;
        output = output.output || output; // 如果解析后还有 output 字段，取 output
      } catch (error) {
        console.error("解析 coze_result.data 失败:", error);
        output = coze_result.data;
      }
      const countryEntries = Object.entries(output);

      // 处理每个国别的翻译数据
      for (let i = 0; i < countryEntries.length; i++) {
        const [countryCode, translations] = countryEntries[i];

        if (!Array.isArray(translations) || translations.length === 0) {
          continue;
        }

        // 查找是否已存在该国别的翻译组
        let existingGroup = null;
        if (existingProject) {
          existingGroup = existingProject.translationGroups?.find(
            (group) => group.country_code === countryCode
          );
        }

        let group;
        if (existingGroup) {
          console.log(`🔄 更新已存在的国别: ${countryCode}`);

          // 更新现有翻译组
          await existingGroup.update(
            {
              total_items: translations.length,
            },
            { transaction }
          );

          group = existingGroup;

          // 获取现有的翻译条目
          const existingItems = existingGroup.items || [];
          const existingTexts = new Set(
            existingItems.map((item) => item.original_text)
          );

          // 处理新的翻译条目
          for (let j = 0; j < translations.length; j++) {
            const text = translations[j];

            if (existingTexts.has(text)) {
              // 如果已存在，可以选择更新（这里暂时跳过，保持原有数据）
              console.log(
                `  ⏭️  跳过已存在的翻译: ${text.substring(0, 30)}...`
              );
            } else {
              // 如果不存在，添加新的翻译条目
              console.log(`  ➕ 添加新的翻译: ${text.substring(0, 30)}...`);
              await TranslationItem.create(
                {
                  group_id: group.id,
                  original_text: text,
                  translated_text: text,
                  item_order: existingItems.length + j + 1,
                  field_type: null,
                  is_edited: false,
                },
                { transaction }
              );
            }
          }
        } else {
          console.log(`➕ 添加新的国别: ${countryCode}`);

          // 计算新的序号（在现有翻译组基础上递增）
          const maxSequence = existingProject?.translationGroups?.length || 0;
          const sequenceNumber = maxSequence + i + 1;

          // 创建新的翻译组
          group = await CountryTranslationGroup.create(
            {
              project_id: project.id,
              country_code: countryCode,
              sequence_number: sequenceNumber,
              total_items: translations.length,
            },
            { transaction }
          );

          // 批量创建翻译条目
          const itemsData = translations.map((text, index) => ({
            group_id: group.id,
            original_text: text,
            translated_text: text,
            item_order: index + 1,
            field_type: null,
            is_edited: false,
          }));

          await TranslationItem.bulkCreate(itemsData, { transaction });
        }
      }

      // 更新项目状态为完成
      await project.update({ status: "completed" }, { transaction });
    }

    await transaction.commit();

    // 重新获取完整的项目数据
    const createdProject = await Project.findByPk(project.id, {
      include: [
        {
          model: CountryTranslationGroup,
          as: "translationGroups",
          include: [
            {
              model: TranslationItem,
              as: "items",
            },
          ],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "项目创建成功",
      data: createdProject,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("创建项目失败:", error);
    res.status(500).json({
      success: false,
      message: "创建项目失败",
      error: error.message,
    });
  }
};

// 更新项目
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { job_name, job_description, status } = req.body;

    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "项目不存在",
      });
    }

    await project.update({
      job_name: job_name || project.job_name,
      job_description:
        job_description !== undefined
          ? job_description
          : project.job_description,
      status: status || project.status,
    });

    res.json({
      success: true,
      message: "项目更新成功",
      data: project,
    });
  } catch (error) {
    console.error("更新项目失败:", error);
    res.status(500).json({
      success: false,
      message: "更新项目失败",
      error: error.message,
    });
  }
};

// 删除项目
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "项目不存在",
      });
    }

    await project.destroy();

    res.json({
      success: true,
      message: "项目删除成功",
    });
  } catch (error) {
    console.error("删除项目失败:", error);
    res.status(500).json({
      success: false,
      message: "删除项目失败",
      error: error.message,
    });
  }
};

// 更新翻译内容
exports.updateTranslation = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { translated_text, field_type } = req.body;

    const item = await TranslationItem.findByPk(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "翻译条目不存在",
      });
    }

    await item.update({
      translated_text:
        translated_text !== undefined ? translated_text : item.translated_text,
      field_type: field_type !== undefined ? field_type : item.field_type,
    });

    res.json({
      success: true,
      message: "翻译更新成功",
      data: item,
    });
  } catch (error) {
    console.error("更新翻译失败:", error);
    res.status(500).json({
      success: false,
      message: "更新翻译失败",
      error: error.message,
    });
  }
};

// 获取特定国别的翻译
exports.getTranslationsByCountry = async (req, res) => {
  try {
    const { projectId, countryCode } = req.params;

    const group = await CountryTranslationGroup.findOne({
      where: {
        project_id: projectId,
        country_code: countryCode,
      },
      include: [
        {
          model: TranslationItem,
          as: "items",
        },
      ],
      order: [[{ model: TranslationItem, as: "items" }, "item_order", "ASC"]],
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "未找到该国别的翻译",
      });
    }

    res.json({
      success: true,
      data: group,
    });
  } catch (error) {
    console.error("获取翻译失败:", error);
    res.status(500).json({
      success: false,
      message: "获取翻译失败",
      error: error.message,
    });
  }
};
