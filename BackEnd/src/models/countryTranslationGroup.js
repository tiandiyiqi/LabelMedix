const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class CountryTranslationGroup extends Model {
    static associate(models) {
      // 一个翻译组属于一个项目
      CountryTranslationGroup.belongsTo(models.Project, {
        foreignKey: "project_id",
        as: "project",
      });

      // 一个翻译组有多个翻译条目
      CountryTranslationGroup.hasMany(models.TranslationItem, {
        foreignKey: "group_id",
        as: "items",
        onDelete: "CASCADE",
      });
    }

    // 更新翻译条目总数
    async updateTotalItems() {
      const count = await sequelize.models.TranslationItem.count({
        where: { group_id: this.id },
      });
      await this.update({ total_items: count });
      return count;
    }

    // 生成格式化翻译汇总
    async generateFormattedSummary() {
      const items = await sequelize.models.TranslationItem.findAll({
        where: { group_id: this.id },
        order: [["item_order", "ASC"]],
      });

      if (!items || items.length === 0) {
        return null;
      }

      // 按字段类型分组
      const groupedItems = {
        basic_info: [],
        number_field: [],
        drug_description: [],
        other: [],
      };

      items.forEach((item) => {
        const category = item.field_type || "other";
        groupedItems[category].push({
          order: item.item_order,
          original: item.original_text,
          translated: item.translated_text || item.original_text,
          edited: item.is_edited,
        });
      });

      // 生成格式化文本
      let summary = `=== ${this.country_code} 翻译汇总 ===\n\n`;

      if (groupedItems.basic_info.length > 0) {
        summary += "【基本信息】\n";
        groupedItems.basic_info.forEach((item) => {
          summary += `${item.order}. ${item.translated}${
            item.edited ? " [已编辑]" : ""
          }\n`;
        });
        summary += "\n";
      }

      if (groupedItems.number_field.length > 0) {
        summary += "【编号栏】\n";
        groupedItems.number_field.forEach((item) => {
          summary += `${item.order}. ${item.translated}${
            item.edited ? " [已编辑]" : ""
          }\n`;
        });
        summary += "\n";
      }

      if (groupedItems.drug_description.length > 0) {
        summary += "【药品说明】\n";
        groupedItems.drug_description.forEach((item) => {
          summary += `${item.order}. ${item.translated}${
            item.edited ? " [已编辑]" : ""
          }\n`;
        });
        summary += "\n";
      }

      if (groupedItems.other.length > 0) {
        summary += "【其他】\n";
        groupedItems.other.forEach((item) => {
          summary += `${item.order}. ${item.translated}${
            item.edited ? " [已编辑]" : ""
          }\n`;
        });
        summary += "\n";
      }

      summary += `总计: ${items.length} 条翻译\n`;
      summary += `生成时间: ${new Date().toLocaleString("zh-CN")}\n`;

      // 更新到数据库
      await this.update({ formatted_summary: summary });
      return summary;
    }
  }

  CountryTranslationGroup.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      country_code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 100],
        },
      },
      sequence_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      total_items: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      formatted_summary: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "格式化后的翻译汇总，对翻译详情表内容的汇总和重新整理",
      },
      original_summary: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "原始状态汇总（用于格式化功能的基础数据）",
      },
      pdf_file_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: "生成的PDF文件存储路径",
      },
      font_family: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "STHeiti",
        comment: "主语言字体（用于中文、日文、韩文等CJK字符）",
      },
      secondary_font_family: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "Arial",
        comment: "次语言字体（用于英文、数字等拉丁字符）",
      },
      text_align: {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: "left",
        comment:
          "文本对齐方式：left（左对齐）、right（右对齐）、center（居中）",
      },
      font_size: {
        type: DataTypes.DECIMAL(4, 1),
        allowNull: true,
        defaultValue: 10.0,
        comment: "字体大小（单位：pt）",
      },
      spacing: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: true,
        defaultValue: 1.0,
        comment: "间距",
      },
      line_height: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: true,
        defaultValue: 1.2,
        comment: "行高",
      },
    },
    {
      sequelize,
      modelName: "CountryTranslationGroup",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["project_id", "country_code"],
          name: "uk_project_country",
        },
        {
          unique: true,
          fields: ["project_id", "sequence_number"],
          name: "uk_project_sequence",
        },
        { fields: ["project_id", "country_code"] },
      ],
    }
  );

  return CountryTranslationGroup;
};
