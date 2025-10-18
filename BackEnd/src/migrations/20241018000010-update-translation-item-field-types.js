"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 先删除旧的 ENUM 类型
    await queryInterface.sequelize.query(
      "ALTER TABLE TranslationItems MODIFY COLUMN field_type VARCHAR(50) NULL"
    );

    // 创建新的 ENUM 类型
    await queryInterface.sequelize.query(`
      ALTER TABLE TranslationItems 
      MODIFY COLUMN field_type ENUM(
        'basic_info', 
        'number_field', 
        'drug_description', 
        'company_name', 
        'drug_name', 
        'number_of_sheets'
      ) NULL COMMENT '字段类型：基本信息、编号栏、药品说明、公司名称、药品名称、片数'
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // 回滚到旧的 ENUM 类型
    await queryInterface.sequelize.query(
      "ALTER TABLE TranslationItems MODIFY COLUMN field_type VARCHAR(50) NULL"
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE TranslationItems 
      MODIFY COLUMN field_type ENUM(
        'basic_info', 
        'number_field', 
        'drug_description'
      ) NULL COMMENT '字段类型：基本信息、编号栏、药品说明'
    `);
  },
};
