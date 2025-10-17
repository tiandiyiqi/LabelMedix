"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("CountryTranslationGroups", "font_family", {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: "STHeiti",
      comment: "主语言字体（用于中文、日文、韩文等CJK字符）",
    });

    await queryInterface.addColumn(
      "CountryTranslationGroups",
      "secondary_font_family",
      {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: "Arial",
        comment: "次语言字体（用于英文、数字等拉丁字符）",
      }
    );

    await queryInterface.addColumn("CountryTranslationGroups", "font_size", {
      type: Sequelize.DECIMAL(4, 1),
      allowNull: true,
      defaultValue: 10.0,
      comment: "字体大小（单位：pt）",
    });

    await queryInterface.addColumn("CountryTranslationGroups", "spacing", {
      type: Sequelize.DECIMAL(3, 1),
      allowNull: true,
      defaultValue: 1.0,
      comment: "间距",
    });

    await queryInterface.addColumn("CountryTranslationGroups", "line_height", {
      type: Sequelize.DECIMAL(3, 1),
      allowNull: true,
      defaultValue: 1.2,
      comment: "行高",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      "CountryTranslationGroups",
      "font_family"
    );
    await queryInterface.removeColumn(
      "CountryTranslationGroups",
      "secondary_font_family"
    );
    await queryInterface.removeColumn("CountryTranslationGroups", "font_size");
    await queryInterface.removeColumn("CountryTranslationGroups", "spacing");
    await queryInterface.removeColumn(
      "CountryTranslationGroups",
      "line_height"
    );
  },
};
