"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 在Projects表添加4个标签设置字段
    await queryInterface.addColumn("Projects", "label_width", {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 100.0,
      comment: "标签宽度(mm)",
      after: "user_id",
    });

    await queryInterface.addColumn("Projects", "label_height", {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 60.0,
      comment: "标签高度(mm)",
      after: "label_width",
    });

    await queryInterface.addColumn("Projects", "label_category", {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: "阶梯标",
      comment: "标签分类：阶梯标/单页左右1/单页左右2/单页上下1/单页上下2",
      after: "label_height",
    });

    await queryInterface.addColumn("Projects", "is_wrapped", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "是否缠绕标",
      after: "label_category",
    });

    console.log("✅ 成功在Projects表添加4个标签设置字段");
  },

  down: async (queryInterface, Sequelize) => {
    // 回滚操作：删除添加的字段
    await queryInterface.removeColumn("Projects", "is_wrapped");
    await queryInterface.removeColumn("Projects", "label_category");
    await queryInterface.removeColumn("Projects", "label_height");
    await queryInterface.removeColumn("Projects", "label_width");

    console.log("✅ 成功从Projects表删除4个标签设置字段");
  },
};