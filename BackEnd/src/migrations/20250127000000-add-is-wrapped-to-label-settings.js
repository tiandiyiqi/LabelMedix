"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("LabelSettings", "is_wrapped", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "是否缠绕标",
      after: "label_category",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("LabelSettings", "is_wrapped");
  },
};
