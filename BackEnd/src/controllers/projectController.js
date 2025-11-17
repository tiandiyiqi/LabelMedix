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
    const {
      job_name,
      job_description,
      user_id,
      coze_result,
      is_wrapped,
      label_width,
      label_height,
      label_category,
    } = req.body;

    // 添加调试日志
    console.log("📥 创建项目请求数据:");
    console.log("  job_name:", job_name);
    console.log("  job_description:", job_description);
    console.log("  is_wrapped:", is_wrapped);
    console.log("  label_width:", label_width);
    console.log("  label_height:", label_height);
    console.log("  label_category:", label_category);
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
          is_wrapped:
            is_wrapped !== undefined ? is_wrapped : project.is_wrapped,
          label_width:
            label_width !== undefined ? label_width : project.label_width,
          label_height:
            label_height !== undefined ? label_height : project.label_height,
          label_category: label_category || project.label_category,
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
          is_wrapped: is_wrapped !== undefined ? is_wrapped : false,
          label_width: label_width !== undefined ? label_width : 100.0,
          label_height: label_height !== undefined ? label_height : 60.0,
          label_category: label_category || "阶梯标",
        },
        { transaction }
      );
    }

    // 如果有 Coze 解析结果，则处理翻译数据
    if (coze_result && (coze_result.output || coze_result.data)) {
      // 解析数据字段（可能是字符串）
      let output;
      try {
        // 优先使用 output 字段（新格式），如果没有则使用 data 字段（旧格式）
        const sourceData = coze_result.output || coze_result.data;
        output =
          typeof sourceData === "string" ? JSON.parse(sourceData) : sourceData;
        output = output.output || output; // 如果解析后还有 output 字段，取 output

        console.log("🔍 解析后的output对象键:", Object.keys(output));
      } catch (error) {
        console.error("解析 coze_result 失败:", error);
        output = coze_result.output || coze_result.data;
      }

      const countryEntries = Object.entries(output);
      console.log(`📊 共有 ${countryEntries.length} 个国别需要处理`);

      // 处理每个国别的翻译数据
      for (let i = 0; i < countryEntries.length; i++) {
        const [rawCountryKey, countryData] = countryEntries[i];

        // 新数据结构：countryData 包含 original 和 translation 数组
        let originalTexts = [];
        let translatedTexts = [];

        // 判断数据结构类型
        if (
          countryData &&
          typeof countryData === "object" &&
          !Array.isArray(countryData)
        ) {
          // 新格式：{ original: [...], translation: [...] }
          originalTexts = countryData.original || [];
          translatedTexts = countryData.translation || [];

          console.log(
            `🔍 处理国别: "${rawCountryKey}"，原文条目数: ${originalTexts.length}，翻译条目数: ${translatedTexts.length}`
          );

          if (originalTexts.length !== translatedTexts.length) {
            console.warn(
              `⚠️ 国别 "${rawCountryKey}" 的原文和翻译条目数不匹配，原文: ${originalTexts.length}，翻译: ${translatedTexts.length}`
            );
          }
        } else if (Array.isArray(countryData)) {
          // 兼容旧格式：直接是数组
          originalTexts = countryData;
          translatedTexts = countryData;

          console.log(
            `🔍 处理国别（旧格式）: "${rawCountryKey}"，翻译条目数: ${countryData.length}`
          );
        } else {
          console.warn(`⚠️ 国别 "${rawCountryKey}" 的数据格式不正确，跳过处理`);
          continue;
        }

        if (originalTexts.length === 0) {
          console.warn(`⚠️ 国别 "${rawCountryKey}" 没有翻译内容，跳过处理`);
          continue;
        }

        // 直接使用原始键作为国别码
        const countryCode = rawCountryKey;

        console.log(`📝 准备保存国别: "${countryCode}"`);

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
              total_items: originalTexts.length,
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
          for (let j = 0; j < originalTexts.length; j++) {
            const originalText = originalTexts[j];
            const translatedText = translatedTexts[j] || originalText;

            if (existingTexts.has(originalText)) {
              // 如果已存在，可以选择更新（这里暂时跳过，保持原有数据）
              console.log(
                `  ⏭️  跳过已存在的翻译: ${originalText.substring(0, 30)}...`
              );
            } else {
              // 如果不存在，添加新的翻译条目
              console.log(
                `  ➕ 添加新的翻译: ${originalText.substring(0, 30)}...`
              );

              // 检查是否有字段分类结果
              let fieldType = null;
              if (countryData.field_types && countryData.field_types[j]) {
                fieldType = countryData.field_types[j];
                console.log(
                  `  🏷️ 应用字段分类: "${originalText.substring(
                    0,
                    30
                  )}..." -> ${fieldType}`
                );
              }

              await TranslationItem.create(
                {
                  group_id: group.id,
                  original_text: originalText,
                  translated_text: translatedText,
                  item_order: existingItems.length + j + 1,
                  field_type: fieldType,
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
              total_items: originalTexts.length,
            },
            { transaction }
          );

          // 批量创建翻译条目
          const itemsData = originalTexts.map((originalText, index) => {
            // 检查是否有字段分类结果
            let fieldType = null;
            if (countryData.field_types && countryData.field_types[index]) {
              fieldType = countryData.field_types[index];
              console.log(
                `  🏷️ 应用字段分类: "${originalText.substring(
                  0,
                  30
                )}..." -> ${fieldType}`
              );
            }

            return {
              group_id: group.id,
              original_text: originalText,
              translated_text: translatedTexts[index] || originalText,
              item_order: index + 1,
              field_type: fieldType,
              is_edited: false,
            };
          });

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
    const {
      job_name,
      job_description,
      status,
      label_width,
      label_height,
      label_category,
      is_wrapped,
    } = req.body;

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
      label_width:
        label_width !== undefined ? label_width : project.label_width,
      label_height:
        label_height !== undefined ? label_height : project.label_height,
      label_category:
        label_category !== undefined ? label_category : project.label_category,
      is_wrapped: is_wrapped !== undefined ? is_wrapped : project.is_wrapped,
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

    // 过滤掉 country_code = "all" 的记录（序号固定为 0，不应该被更新）
    const validGroups = groups.filter(
      (group) => group.country_code.toLowerCase() !== "all"
    );
    const validSequenceUpdates = sequenceUpdates.filter((update) => {
      const group = groups.find((g) => g.id === update.group_id);
      return group && group.country_code.toLowerCase() !== "all";
    });

    if (validSequenceUpdates.length === 0) {
      // 如果没有有效的更新（只有 "all" 记录），直接返回成功
      await transaction.commit();
      return res.json({
        success: true,
        message: "国别顺序更新成功（无有效记录需要更新）",
      });
    }

    // 使用过滤后的更新列表
    const finalSequenceUpdates = validSequenceUpdates;

    // 使用更安全的批量更新方式
    // 先获取当前最大序号，然后使用负数作为临时值
    const maxSequence =
      (await CountryTranslationGroup.max("sequence_number", {
        where: { project_id: projectId },
        transaction,
      })) || 0;

    console.log("📊 当前最大序号:", maxSequence);

    // 第一步：将所有需要更新的序号设置为负数临时值
    for (let i = 0; i < finalSequenceUpdates.length; i++) {
      const { group_id } = finalSequenceUpdates[i];
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
    for (const update of finalSequenceUpdates) {
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
      original_summary,
      font_family,
      secondary_font_family,
      font_size,
      spacing,
      line_height,
    } = req.body;

    // 如果既没有formatted_summary也没有original_summary，则返回错误
    if (!formatted_summary && !original_summary) {
      return res.status(400).json({
        success: false,
        message: "格式化翻译汇总和原始状态汇总不能同时为空",
      });
    }

    let group = await CountryTranslationGroup.findOne({
      where: {
        project_id: projectId,
        country_code: countryCode,
      },
    });

    // 如果记录不存在，自动创建（特别是为 "all" 国别码）
    if (!group) {
      // 先验证项目是否存在
      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: "项目不存在",
        });
      }

      // 为 "all" 或其他特殊国别码自动创建记录
      // sequence_number 使用 0 表示这是合并数据或特殊记录
      const sequenceNumber = countryCode === "all" ? 0 : 999;

      try {
        group = await CountryTranslationGroup.create({
          project_id: projectId,
          country_code: countryCode,
          sequence_number: sequenceNumber,
          total_items: 0,
        });

        console.log(
          `✅ 自动创建国别翻译组: project_id=${projectId}, country_code=${countryCode}, sequence_number=${sequenceNumber}`
        );
      } catch (createError) {
        console.error("创建国别翻译组失败:", createError);
        return res.status(500).json({
          success: false,
          message: "创建国别翻译组失败",
          error: createError.message,
        });
      }
    }

    // 准备更新数据
    const updateData = {};

    // 如果提供了格式化汇总，则更新
    if (formatted_summary !== undefined)
      updateData.formatted_summary = formatted_summary;

    // 如果提供了原始状态汇总，则一并更新
    if (original_summary !== undefined)
      updateData.original_summary = original_summary;

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
        original_summary: group.original_summary,
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
        original_summary: group.original_summary,
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
