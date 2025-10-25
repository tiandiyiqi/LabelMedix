const { LabelSettings, Project } = require("../models");

// 获取标签设置
const getLabelSettings = async (req, res) => {
  try {
    const { projectId, countryCode, sequenceNumber } = req.params;

    let whereCondition = { project_id: projectId };

    // 如果提供了国别代码和序号，查询特定设置
    if (countryCode && sequenceNumber) {
      whereCondition.country_code = countryCode;
      whereCondition.sequence_number = parseInt(sequenceNumber);
    }

    const settings = await LabelSettings.findOne({
      where: whereCondition,
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "job_name"],
        },
      ],
    });

    if (!settings) {
      // 如果没有找到设置，返回默认值
      const defaultSettings = {
        project_id: parseInt(projectId),
        country_code: countryCode || null,
        sequence_number: sequenceNumber ? parseInt(sequenceNumber) : null,
        label_width: 100.0,
        label_height: 60.0,
        label_category: "阶梯标",
        current_width: 120.0,
        base_sheet: 0,
        adhesive_area: 0,
        waste_area: 0,
        coding_area: 0,
        font_family: "STHeiti",
        secondary_font_family: "Arial",
        font_size: 10.0,
        text_align: "left",
        spacing: 1.0,
        line_height: 1.2,
        show_sequence_number: true,
        custom_sequence_text: "",
        sequence_position: "right",
        sequence_font_size: 9.0,
        sequence_offset_x: 0.0,
        sequence_offset_y: 0.0,
        sequence_rotation: 0.0,
      };

      return res.json({
        success: true,
        data: defaultSettings,
      });
    }

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("获取标签设置失败:", error);
    res.status(500).json({
      success: false,
      message: "获取标签设置失败",
      error: error.message,
    });
  }
};

// 保存或更新标签设置
const saveLabelSettings = async (req, res) => {
  try {
    const { projectId, countryCode, sequenceNumber } = req.params;
    const settingsData = req.body;

    // 构建查询条件
    let whereCondition = { project_id: projectId };
    if (countryCode && sequenceNumber) {
      whereCondition.country_code = countryCode;
      whereCondition.sequence_number = parseInt(sequenceNumber);
    }

    // 准备要保存的数据
    const dataToSave = {
      project_id: parseInt(projectId),
      country_code: countryCode || null,
      sequence_number: sequenceNumber ? parseInt(sequenceNumber) : null,
      ...settingsData,
    };

    // 使用 upsert 方法（如果存在则更新，不存在则创建）
    const [settings, created] = await LabelSettings.upsert(dataToSave, {
      where: whereCondition,
      returning: true,
    });

    res.json({
      success: true,
      data: settings,
      message: created ? "标签设置已创建" : "标签设置已更新",
    });
  } catch (error) {
    console.error("保存标签设置失败:", error);
    res.status(500).json({
      success: false,
      message: "保存标签设置失败",
      error: error.message,
    });
  }
};

// 获取项目的所有标签设置
const getProjectLabelSettings = async (req, res) => {
  try {
    const { projectId } = req.params;

    const settings = await LabelSettings.findAll({
      where: { project_id: projectId },
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "job_name"],
        },
      ],
      order: [
        ["country_code", "ASC"],
        ["sequence_number", "ASC"],
      ],
    });

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("获取项目标签设置失败:", error);
    res.status(500).json({
      success: false,
      message: "获取项目标签设置失败",
      error: error.message,
    });
  }
};

// 删除标签设置
const deleteLabelSettings = async (req, res) => {
  try {
    const { projectId, countryCode, sequenceNumber } = req.params;

    let whereCondition = { project_id: projectId };
    if (countryCode && sequenceNumber) {
      whereCondition.country_code = countryCode;
      whereCondition.sequence_number = parseInt(sequenceNumber);
    }

    const deletedCount = await LabelSettings.destroy({
      where: whereCondition,
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "未找到要删除的标签设置",
      });
    }

    res.json({
      success: true,
      message: "标签设置已删除",
      deletedCount,
    });
  } catch (error) {
    console.error("删除标签设置失败:", error);
    res.status(500).json({
      success: false,
      message: "删除标签设置失败",
      error: error.message,
    });
  }
};

module.exports = {
  getLabelSettings,
  saveLabelSettings,
  getProjectLabelSettings,
  deleteLabelSettings,
};
