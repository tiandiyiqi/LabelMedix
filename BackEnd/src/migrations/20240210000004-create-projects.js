"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Projects", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      job_name: {
        type: Sequelize.STRING(200),
        unique: true,
        allowNull: false,
        comment: "工单名称",
      },
      job_description: {
        type: Sequelize.TEXT,
        comment: "工单描述",
      },
      status: {
        type: Sequelize.ENUM("draft", "processing", "completed", "failed"),
        allowNull: false,
        defaultValue: "draft",
        comment: "工单状态",
      },
      total_files: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: "上传文件总数",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "创建用户ID",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // 添加索引
    await queryInterface.addIndex("Projects", ["job_name"], {
      name: "idx_job_name",
    });
    await queryInterface.addIndex("Projects", ["user_id"], {
      name: "idx_user_id",
    });
    await queryInterface.addIndex("Projects", ["status"], {
      name: "idx_status",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Projects");
  },
};
