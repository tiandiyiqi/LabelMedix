"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("TranslationItems", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      group_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "CountryTranslationGroups",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "关联翻译组ID",
      },
      field_type: {
        type: Sequelize.ENUM("basic_info", "number_field", "drug_description"),
        allowNull: true,
        comment: "字段类型：基本信息、编号栏、药品说明",
      },
      original_text: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "原文",
      },
      translated_text: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "翻译文本",
      },
      item_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "组内排序",
      },
      is_edited: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: "是否被用户编辑过",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // 添加索引
    await queryInterface.addIndex(
      "TranslationItems",
      ["group_id", "item_order"],
      {
        name: "idx_group_order",
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("TranslationItems");
  },
};
