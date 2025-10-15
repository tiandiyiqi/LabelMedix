"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "CountryTranslationGroups",
      "formatted_summary",
      {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "格式化后的翻译汇总，对翻译详情表内容的汇总和重新整理",
      }
    );

    await queryInterface.addColumn(
      "CountryTranslationGroups",
      "pdf_file_path",
      {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: "生成的PDF文件存储路径",
      }
    );

    // 添加索引以提高查询性能
    await queryInterface.addIndex(
      "CountryTranslationGroups",
      ["pdf_file_path"],
      {
        name: "idx_pdf_file_path",
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // 删除索引
    await queryInterface.removeIndex(
      "CountryTranslationGroups",
      "idx_pdf_file_path"
    );

    // 删除字段
    await queryInterface.removeColumn(
      "CountryTranslationGroups",
      "pdf_file_path"
    );
    await queryInterface.removeColumn(
      "CountryTranslationGroups",
      "formatted_summary"
    );
  },
};
