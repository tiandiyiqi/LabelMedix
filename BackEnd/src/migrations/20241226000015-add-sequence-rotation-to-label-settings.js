"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("LabelSettings", "sequence_rotation", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "序号旋转角度（度）",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("LabelSettings", "sequence_rotation");
  },
};
