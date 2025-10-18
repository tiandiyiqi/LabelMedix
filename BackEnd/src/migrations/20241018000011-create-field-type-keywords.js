"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("FieldTypeKeywords", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      keyword: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: "关键词文本",
      },
      field_type: {
        type: Sequelize.ENUM(
          "basic_info",
          "number_field",
          "drug_name",
          "number_of_sheets",
          "company_name"
        ),
        allowNull: false,
        comment: "字段类型：基本信息、编号栏、药品名称、片数、公司名称",
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: "是否启用",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // 添加索引
    await queryInterface.addIndex("FieldTypeKeywords", ["field_type"], {
      name: "idx_field_type",
    });

    await queryInterface.addIndex(
      "FieldTypeKeywords",
      ["keyword", "field_type"],
      {
        name: "idx_keyword_field_type",
        unique: true,
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("FieldTypeKeywords");
  },
};
