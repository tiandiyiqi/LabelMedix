const db = require("../models");
const FieldTypeKeyword = db.FieldTypeKeyword;

/**
 * 获取所有关键词（可按类型筛选）
 */
exports.getAllKeywords = async (req, res) => {
  try {
    const { field_type } = req.query;

    const where = {};
    if (field_type) {
      where.field_type = field_type;
    }

    const keywords = await FieldTypeKeyword.findAll({
      where,
      order: [
        ["field_type", "ASC"],
        ["keyword", "ASC"],
      ],
    });

    // 按类型分组
    const grouped = {
      basic_info: [],
      number_field: [],
      drug_name: [],
      number_of_sheets: [],
      company_name: [],
    };

    keywords.forEach((kw) => {
      if (grouped[kw.field_type]) {
        grouped[kw.field_type].push(kw);
      }
    });

    res.json({
      success: true,
      data: {
        all: keywords,
        grouped: grouped,
      },
    });
  } catch (error) {
    console.error("获取关键词列表失败:", error);
    res.status(500).json({
      success: false,
      message: "获取关键词列表失败",
      error: error.message,
    });
  }
};

/**
 * 创建新关键词
 */
exports.createKeyword = async (req, res) => {
  try {
    const { keyword, field_type } = req.body;

    // 验证必填字段
    if (!keyword || !field_type) {
      return res.status(400).json({
        success: false,
        message: "关键词和字段类型不能为空",
      });
    }

    // 验证字段类型
    const validTypes = [
      "basic_info",
      "number_field",
      "drug_name",
      "number_of_sheets",
      "company_name",
    ];
    if (!validTypes.includes(field_type)) {
      return res.status(400).json({
        success: false,
        message: "无效的字段类型",
      });
    }

    // 检查是否已存在
    const existing = await FieldTypeKeyword.findOne({
      where: { keyword, field_type },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "该关键词已存在于此分类中",
      });
    }

    // 创建新关键词
    const newKeyword = await FieldTypeKeyword.create({
      keyword,
      field_type,
      is_active: true,
    });

    res.status(201).json({
      success: true,
      message: "关键词创建成功",
      data: newKeyword,
    });
  } catch (error) {
    console.error("创建关键词失败:", error);
    res.status(500).json({
      success: false,
      message: "创建关键词失败",
      error: error.message,
    });
  }
};

/**
 * 更新关键词
 */
exports.updateKeyword = async (req, res) => {
  try {
    const { id } = req.params;
    const { keyword, field_type, is_active } = req.body;

    const keywordRecord = await FieldTypeKeyword.findByPk(id);
    if (!keywordRecord) {
      return res.status(404).json({
        success: false,
        message: "关键词不存在",
      });
    }

    // 如果修改了关键词或类型，检查是否重复
    if (
      (keyword && keyword !== keywordRecord.keyword) ||
      (field_type && field_type !== keywordRecord.field_type)
    ) {
      const existing = await FieldTypeKeyword.findOne({
        where: {
          keyword: keyword || keywordRecord.keyword,
          field_type: field_type || keywordRecord.field_type,
        },
      });

      if (existing && existing.id !== parseInt(id)) {
        return res.status(409).json({
          success: false,
          message: "该关键词已存在于此分类中",
        });
      }
    }

    // 更新字段
    if (keyword !== undefined) keywordRecord.keyword = keyword;
    if (field_type !== undefined) keywordRecord.field_type = field_type;
    if (is_active !== undefined) keywordRecord.is_active = is_active;

    await keywordRecord.save();

    res.json({
      success: true,
      message: "关键词更新成功",
      data: keywordRecord,
    });
  } catch (error) {
    console.error("更新关键词失败:", error);
    res.status(500).json({
      success: false,
      message: "更新关键词失败",
      error: error.message,
    });
  }
};

/**
 * 删除关键词
 */
exports.deleteKeyword = async (req, res) => {
  try {
    const { id } = req.params;

    const keywordRecord = await FieldTypeKeyword.findByPk(id);
    if (!keywordRecord) {
      return res.status(404).json({
        success: false,
        message: "关键词不存在",
      });
    }

    await keywordRecord.destroy();

    res.json({
      success: true,
      message: "关键词删除成功",
    });
  } catch (error) {
    console.error("删除关键词失败:", error);
    res.status(500).json({
      success: false,
      message: "删除关键词失败",
      error: error.message,
    });
  }
};

/**
 * 批量导入关键词
 */
exports.batchImport = async (req, res) => {
  try {
    const { keywords } = req.body;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: "关键词数据格式错误",
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const item of keywords) {
      try {
        const { keyword, field_type } = item;

        // 检查是否已存在
        const existing = await FieldTypeKeyword.findOne({
          where: { keyword, field_type },
        });

        if (!existing) {
          await FieldTypeKeyword.create({
            keyword,
            field_type,
            is_active: true,
          });
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`${keyword} 已存在于 ${field_type}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${item.keyword}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: "批量导入完成",
      data: results,
    });
  } catch (error) {
    console.error("批量导入失败:", error);
    res.status(500).json({
      success: false,
      message: "批量导入失败",
      error: error.message,
    });
  }
};
