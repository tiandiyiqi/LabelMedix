const { LabelSettings, Project } = require("../models");

// 获取标签设置
const getLabelSettings = async (req, res) => {
  try {
    const { projectId, countryCode, sequenceNumber } = req.params;

    // 首先获取项目信息，以获取项目级别的标签设置
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "项目不存在",
      });
    }

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
      // 如果没有找到设置，返回默认值（优先使用项目级别的配置）
      const defaultSettings = {
        project_id: parseInt(projectId),
        country_code: countryCode || null,
        sequence_number: sequenceNumber ? parseInt(sequenceNumber) : null,
        label_width: project.label_width || 100.0,
        label_height: project.label_height || 60.0,
        label_category: project.label_category || "阶梯标",
        is_wrapped: project.is_wrapped || false,
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
        sequence_position: "",
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

    // 如果找到了LabelSettings记录，但项目级别的配置更优先，则合并配置
    const mergedSettings = {
      ...settings.toJSON(),
      // 项目级别的配置优先（这4个参数在所有国别中保持一致）
      label_width: project.label_width || settings.label_width,
      label_height: project.label_height || settings.label_height,
      label_category: project.label_category || settings.label_category,
      is_wrapped: project.is_wrapped || settings.is_wrapped,
    };

    res.json({
      success: true,
      data: mergedSettings,
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

    // 首先获取项目信息
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "项目不存在",
      });
    }

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

    // 如果是项目级别的设置（没有国别和序号），或者修改了项目级别的4个参数，则同步更新Projects表
    const isProjectLevel = !countryCode && !sequenceNumber;
    const hasProjectLevelChanges = 
      settingsData.label_width !== undefined ||
      settingsData.label_height !== undefined ||
      settingsData.label_category !== undefined ||
      settingsData.is_wrapped !== undefined;

    if (isProjectLevel || hasProjectLevelChanges) {
      const projectUpdateData = {};
      
      // 只更新有变化的项目级别参数
      if (settingsData.label_width !== undefined) {
        projectUpdateData.label_width = settingsData.label_width;
      }
      if (settingsData.label_height !== undefined) {
        projectUpdateData.label_height = settingsData.label_height;
      }
      if (settingsData.label_category !== undefined) {
        projectUpdateData.label_category = settingsData.label_category;
      }
      if (settingsData.is_wrapped !== undefined) {
        projectUpdateData.is_wrapped = settingsData.is_wrapped;
      }

      // 如果有需要更新的项目级别参数，则更新Projects表
      if (Object.keys(projectUpdateData).length > 0) {
        await project.update(projectUpdateData);
      }
    }

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
