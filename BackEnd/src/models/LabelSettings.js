const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const LabelSettings = sequelize.define(
    "LabelSettings",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "主键ID",
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "关联项目ID",
      },
      country_code: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: "国别代码，为空表示项目级别设置",
      },
      sequence_number: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "序号，为空表示项目级别设置",
      },
      // 标签基本设置
      label_width: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 100.0,
        comment: "标签宽度(mm)",
      },
      label_height: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 60.0,
        comment: "标签高度(mm)",
      },
      label_category: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "阶梯标",
        comment: "标签分类：阶梯标/单页左右1/单页左右2/单页上下1/单页上下2",
      },
      is_wrapped: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "是否缠绕标",
      },
      current_width: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 120.0,
        comment: "当前页面宽度(mm)",
      },
      // 页面区域设置
      base_sheet: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "底页",
      },
      adhesive_area: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "粘胶区",
      },
      waste_area: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "排废区",
      },
      coding_area: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: "打码区",
      },
      // 字体设置
      font_family: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "STHeiti",
        comment: "主语言字体",
      },
      secondary_font_family: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "Arial",
        comment: "次语言字体",
      },
      font_size: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: false,
        defaultValue: 10.0,
        comment: "字体大小(pt)",
      },
      text_align: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "left",
        comment: "文本对齐方式：left/center/right",
      },
      spacing: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false,
        defaultValue: 1.0,
        comment: "字符间距",
      },
      line_height: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false,
        defaultValue: 1.2,
        comment: "行高",
      },
      // 序号设置
      show_sequence_number: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "是否显示序号",
      },
      custom_sequence_text: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: "自定义序号内容",
      },
      sequence_position: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "",
        comment: "序号位置：left/center/right，空字符串表示自动对齐",
      },
      sequence_font_size: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: false,
        defaultValue: 9.0,
        comment: "序号字体大小(pt)",
      },
      sequence_offset_x: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0,
        comment: "序号水平位移(mm)",
      },
      sequence_offset_y: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0,
        comment: "序号垂直位移(mm)",
      },
      sequence_rotation: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        comment: "序号旋转角度(度)",
      },
    },
    {
      tableName: "LabelSettings",
      comment: "标签设置表",
      indexes: [
        {
          fields: ["project_id"],
        },
        {
          fields: ["project_id", "country_code"],
        },
        {
          fields: ["project_id", "country_code", "sequence_number"],
          unique: true,
        },
      ],
    }
  );

  // 定义关联关系
  LabelSettings.associate = function (models) {
    // 关联到项目表
    LabelSettings.belongsTo(models.Project, {
      foreignKey: "project_id",
      as: "project",
    });
  };

  return LabelSettings;
};
