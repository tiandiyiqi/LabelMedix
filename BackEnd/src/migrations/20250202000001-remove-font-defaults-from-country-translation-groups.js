"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 去除 font_family 的默认值
    await queryInterface.changeColumn("CountryTranslationGroups", "font_family", {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: null, // 去除默认值
      comment: "主语言字体（用于中文、日文、韩文等CJK字符）",
    });

    // 去除 secondary_font_family 的默认值
    await queryInterface.changeColumn(
      "CountryTranslationGroups",
      "secondary_font_family",
      {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: null, // 去除默认值
        comment: "次语言字体（用于英文、数字等拉丁字符）",
      }
    );

    // 将现有默认值记录更新为 null（如果值是默认值）
    await queryInterface.sequelize.query(`
      UPDATE CountryTranslationGroups 
      SET font_family = NULL 
      WHERE font_family = 'STHeiti'
    `);

    await queryInterface.sequelize.query(`
      UPDATE CountryTranslationGroups 
      SET secondary_font_family = NULL 
      WHERE secondary_font_family = 'Arial'
    `);
  },

  async down(queryInterface, Sequelize) {
    // 恢复默认值
    await queryInterface.changeColumn("CountryTranslationGroups", "font_family", {
      type: Sequelize.STRING(100),
      allowNull: true,
      defaultValue: "STHeiti",
      comment: "主语言字体（用于中文、日文、韩文等CJK字符）",
    });

    await queryInterface.changeColumn(
      "CountryTranslationGroups",
      "secondary_font_family",
      {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: "Arial",
        comment: "次语言字体（用于英文、数字等拉丁字符）",
      }
    );
  },
};

