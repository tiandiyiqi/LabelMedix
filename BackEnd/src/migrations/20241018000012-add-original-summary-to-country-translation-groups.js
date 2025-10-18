"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      "CountryTranslationGroups",
      "original_summary",
      {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "原始状态汇总（用于格式化功能的基础数据）",
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      "CountryTranslationGroups",
      "original_summary"
    );
  },
};
