"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("CountryTranslationGroups", "text_align", {
      type: Sequelize.STRING(10),
      allowNull: true,
      defaultValue: "left",
      comment: "文本对齐方式：left（左对齐）、right（右对齐）、center（居中）",
      after: "secondary_font_family",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("CountryTranslationGroups", "text_align");
  },
};
