"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("CountryTranslationGroups", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Projects",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        comment: "关联项目ID",
      },
      country_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: "国别代码",
      },
      sequence_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "序号（项目内唯一）",
      },
      total_items: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: "该组翻译条目总数",
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

    // 添加唯一约束：每个项目下每个国别代码只能有一条记录
    await queryInterface.addConstraint("CountryTranslationGroups", {
      fields: ["project_id", "country_code"],
      type: "unique",
      name: "uk_project_country",
    });

    // 添加唯一约束：每个项目下序号不能重复
    await queryInterface.addConstraint("CountryTranslationGroups", {
      fields: ["project_id", "sequence_number"],
      type: "unique",
      name: "uk_project_sequence",
    });

    // 添加索引
    await queryInterface.addIndex(
      "CountryTranslationGroups",
      ["project_id", "country_code"],
      {
        name: "idx_project_country",
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("CountryTranslationGroups");
  },
};
