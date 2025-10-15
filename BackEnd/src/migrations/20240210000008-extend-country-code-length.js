"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 扩展 country_code 字段长度以支持更长的描述性字符串
    await queryInterface.changeColumn(
      "CountryTranslationGroups",
      "country_code",
      {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: "国别代码或描述（如 'Thailand/Thai TH'）",
      }
    );
  },

  async down(queryInterface, Sequelize) {
    // 回滚时恢复原来的长度限制
    await queryInterface.changeColumn(
      "CountryTranslationGroups",
      "country_code",
      {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: "国别代码",
      }
    );
  },
};
