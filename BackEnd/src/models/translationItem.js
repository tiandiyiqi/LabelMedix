const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class TranslationItem extends Model {
    static associate(models) {
      // 一个翻译条目属于一个翻译组
      TranslationItem.belongsTo(models.CountryTranslationGroup, {
        foreignKey: "group_id",
        as: "group",
      });
    }

    // 标记为已编辑
    async markAsEdited() {
      if (!this.is_edited) {
        await this.update({ is_edited: true });
      }
    }
  }

  TranslationItem.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      field_type: {
        type: DataTypes.ENUM("basic_info", "number_field", "drug_description"),
        allowNull: true,
      },
      original_text: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      translated_text: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      item_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      is_edited: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "TranslationItem",
      timestamps: true,
      indexes: [{ fields: ["group_id", "item_order"] }],
      hooks: {
        // 更新翻译文本时自动标记为已编辑
        beforeUpdate: async (item) => {
          if (item.changed("translated_text")) {
            item.is_edited = true;
          }
        },
      },
    }
  );

  return TranslationItem;
};
