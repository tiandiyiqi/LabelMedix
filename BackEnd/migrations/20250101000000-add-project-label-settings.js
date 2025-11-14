"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 添加项目级标签配置字段到Projects表
    await queryInterface.addColumn("Projects", "label_width", {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 100.0,
      comment: "标签宽度(mm)",
    });

    await queryInterface.addColumn("Projects", "label_height", {
      type: Sequelize.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 60.0,
      comment: "标签高度(mm)",
    });

    await queryInterface.addColumn("Projects", "label_category", {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: "阶梯标",
      comment: "标签分类：阶梯标/单页左右1/单页左右2/单页上下1/单页上下2",
    });

    await queryInterface.addColumn("Projects", "is_wrapped", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "是否缠绕标",
    });

    // 为现有项目设置默认值（如果字段已存在则跳过）
    await queryInterface.sequelize.query(`
      UPDATE Projects 
      SET label_width = 100.0, 
          label_height = 60.0, 
          label_category = '阶梯标', 
          is_wrapped = false
      WHERE label_width IS NULL 
         OR label_height IS NULL 
         OR label_category IS NULL 
         OR is_wrapped IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    // 回滚操作：删除新增的字段
    await queryInterface.removeColumn("Projects", "label_width");
    await queryInterface.removeColumn("Projects", "label_height");
    await queryInterface.removeColumn("Projects", "label_category");
    await queryInterface.removeColumn("Projects", "is_wrapped");
  },
};
