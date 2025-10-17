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
        const [rawCountryKey, translations] = countryEntries[i];

        if (!Array.isArray(translations) || translations.length === 0) {
          continue;
        }

        // 直接使用原始键作为国别码
        const countryCode = rawCountryKey;

        console.log(
          `🔍 处理国别: "${countryCode}"，翻译条目数: ${translations.length}`
        );

        // 验证国别码不为空
        if (!countryCode || countryCode.trim() === "") {
          console.warn(`⚠️ 国别码为空，跳过处理`);
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
    const { projectId } = req.params;
    const countryCode = decodeURIComponent(req.params.countryCode);

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

// 更新国别翻译组的顺序
exports.updateCountrySequence = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id: projectId } = req.params;
    const { sequenceUpdates } = req.body;

    console.log("🔄 开始更新序列:", { projectId, sequenceUpdates });

    // 验证必需字段
    if (!sequenceUpdates || !Array.isArray(sequenceUpdates)) {
      return res.status(400).json({
        success: false,
        message: "sequenceUpdates 必须是一个数组",
      });
    }

    // 验证项目是否存在
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "项目不存在",
      });
    }

    // 验证所有group_id都属于该项目
    const groupIds = sequenceUpdates.map((update) => update.group_id);
    const groups = await CountryTranslationGroup.findAll({
      where: {
        id: groupIds,
        project_id: projectId,
      },
      transaction,
    });

    if (groups.length !== groupIds.length) {
      return res.status(400).json({
        success: false,
        message: "存在不属于该项目的翻译组",
      });
    }

    // 使用更安全的批量更新方式
    // 先获取当前最大序号，然后使用负数作为临时值
    const maxSequence =
      (await CountryTranslationGroup.max("sequence_number", {
        where: { project_id: projectId },
        transaction,
      })) || 0;

    console.log("📊 当前最大序号:", maxSequence);

    // 第一步：将所有需要更新的序号设置为负数临时值
    for (let i = 0; i < sequenceUpdates.length; i++) {
      const { group_id } = sequenceUpdates[i];
      const tempSequence = -(i + 1); // 使用负数作为临时值

      await CountryTranslationGroup.update(
        { sequence_number: tempSequence },
        {
          where: {
            id: group_id,
            project_id: projectId,
          },
          transaction,
          validate: false,
        }
      );

      console.log(`🔄 临时更新 Group ${group_id} -> ${tempSequence}`);
    }

    // 第二步：将序号更新为目标值
    for (const update of sequenceUpdates) {
      const { group_id, sequence_number } = update;

      await CountryTranslationGroup.update(
        { sequence_number },
        {
          where: {
            id: group_id,
            project_id: projectId,
          },
          transaction,
        }
      );

      console.log(`✅ 最终更新 Group ${group_id} -> ${sequence_number}`);
    }

    await transaction.commit();
    console.log("✅ 序列更新成功");

    res.json({
      success: true,
      message: "国别顺序更新成功",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("❌ 更新国别顺序失败:", error);
    res.status(500).json({
      success: false,
      message: "更新国别顺序失败",
      error: error.message,
    });
  }
};

// 生成国别翻译汇总
exports.generateCountrySummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const countryCode = decodeURIComponent(req.params.countryCode);

    const group = await CountryTranslationGroup.findOne({
      where: {
        project_id: projectId,
        country_code: countryCode,
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "国别翻译组不存在",
      });
    }

    const summary = await group.generateFormattedSummary();

    res.json({
      success: true,
      message: "翻译汇总生成成功",
      data: {
        country_code: countryCode,
        formatted_summary: summary,
      },
    });
  } catch (error) {
    console.error("生成翻译汇总失败:", error);
    res.status(500).json({
      success: false,
      message: "生成翻译汇总失败",
      error: error.message,
    });
  }
};

// 更新PDF文件路径
exports.updatePdfFilePath = async (req, res) => {
  try {
    const { projectId } = req.params;
    const countryCode = decodeURIComponent(req.params.countryCode);
    const { pdf_file_path } = req.body;

    const group = await CountryTranslationGroup.findOne({
      where: {
        project_id: projectId,
        country_code: countryCode,
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "国别翻译组不存在",
      });
    }

    await group.update({ pdf_file_path });

    res.json({
      success: true,
      message: "PDF文件路径更新成功",
      data: {
        country_code: countryCode,
        pdf_file_path,
      },
    });
  } catch (error) {
    console.error("更新PDF文件路径失败:", error);
    res.status(500).json({
      success: false,
      message: "更新PDF文件路径失败",
      error: error.message,
    });
  }
};

// 保存PDF文件
exports.savePdfFile = async (req, res) => {
  const fs = require("fs").promises;
  const path = require("path");

  try {
    const { projectId } = req.params;
    const countryCode = decodeURIComponent(req.params.countryCode);
    const { pdfBase64, fileName } = req.body;

    console.log("📥 接收PDF保存请求:", {
      projectId,
      countryCode,
      fileName,
      pdfBase64Length: pdfBase64 ? pdfBase64.length : 0,
      bodyKeys: Object.keys(req.body),
    });

    if (!pdfBase64) {
      return res.status(400).json({
        success: false,
        message: "PDF数据不能为空",
      });
    }

    // 查找翻译组
    const group = await CountryTranslationGroup.findOne({
      where: {
        project_id: projectId,
        country_code: countryCode,
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "国别翻译组不存在",
      });
    }

    // 创建保存目录
    const uploadsDir = path.join(__dirname, "../../uploads/pdfs");
    await fs.mkdir(uploadsDir, { recursive: true });

    // 生成文件名
    const sanitizedFileName =
      fileName ||
      `project_${projectId}_${countryCode.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, sanitizedFileName);
    const relativePath = `/uploads/pdfs/${sanitizedFileName}`;

    // 将Base64转换为Buffer并保存
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    await fs.writeFile(filePath, pdfBuffer);

    console.log("✅ PDF文件保存成功:", filePath);

    // 更新数据库中的文件路径
    await group.update({ pdf_file_path: relativePath });

    res.json({
      success: true,
      message: "PDF文件保存成功",
      data: {
        country_code: countryCode,
        pdf_file_path: relativePath,
        file_size: pdfBuffer.length,
      },
    });
  } catch (error) {
    console.error("❌ 保存PDF文件失败:");
    console.error("错误类型:", error.name);
    console.error("错误信息:", error.message);
    console.error("错误堆栈:", error.stack);
    res.status(500).json({
      success: false,
      message: "保存PDF文件失败",
      error: error.message,
      errorName: error.name,
    });
  }
};

// 更新格式化翻译汇总
exports.updateFormattedSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const countryCode = decodeURIComponent(req.params.countryCode);
    const {
      formatted_summary,
      font_family,
      secondary_font_family,
      font_size,
      spacing,
      line_height,
    } = req.body;

    if (!formatted_summary) {
      return res.status(400).json({
        success: false,
        message: "格式化翻译汇总不能为空",
      });
    }

    const group = await CountryTranslationGroup.findOne({
      where: {
        project_id: projectId,
        country_code: countryCode,
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "国别翻译组不存在",
      });
    }

    // 准备更新数据
    const updateData = { formatted_summary };

    // 如果提供了字体参数，则一并更新
    if (font_family !== undefined) updateData.font_family = font_family;
    if (secondary_font_family !== undefined)
      updateData.secondary_font_family = secondary_font_family;
    if (font_size !== undefined) updateData.font_size = font_size;
    if (spacing !== undefined) updateData.spacing = spacing;
    if (line_height !== undefined) updateData.line_height = line_height;

    await group.update(updateData);

    res.json({
      success: true,
      message: "格式化翻译汇总和字体设置更新成功",
      data: {
        id: group.id,
        country_code: group.country_code,
        formatted_summary: group.formatted_summary,
        font_family: group.font_family,
        secondary_font_family: group.secondary_font_family,
        font_size: group.font_size,
        spacing: group.spacing,
        line_height: group.line_height,
        updatedAt: group.updatedAt,
      },
    });
  } catch (error) {
    console.error("更新格式化翻译汇总失败:", error);
    res.status(500).json({
      success: false,
      message: "更新格式化翻译汇总失败",
      error: error.message,
    });
  }
};
// 获取国别翻译汇总和PDF信息
exports.getCountryDetails = async (req, res) => {
  try {
    const { projectId } = req.params;
    const countryCode = decodeURIComponent(req.params.countryCode);

    const group = await CountryTranslationGroup.findOne({
      where: {
        project_id: projectId,
        country_code: countryCode,
      },
      include: [
        {
          model: TranslationItem,
          as: "items",
          order: [["item_order", "ASC"]],
        },
      ],
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "国别翻译组不存在",
      });
    }

    res.json({
      success: true,
      data: {
        id: group.id,
        country_code: group.country_code,
        sequence_number: group.sequence_number,
        total_items: group.total_items,
        formatted_summary: group.formatted_summary,
        pdf_file_path: group.pdf_file_path,
        font_family: group.font_family,
        secondary_font_family: group.secondary_font_family,
        font_size: group.font_size,
        spacing: group.spacing,
        line_height: group.line_height,
        items: group.items,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });
  } catch (error) {
    console.error("获取国别详情失败:", error);
    res.status(500).json({
      success: false,
      message: "获取国别详情失败",
      error: error.message,
    });
  }
};
