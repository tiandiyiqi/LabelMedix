"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Users", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: Sequelize.STRING(50),
        unique: true,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(100),
        unique: true,
        allowNull: false,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      full_name: {
        type: Sequelize.STRING(100),
      },
      role: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "user",
      },
      department: {
        type: Sequelize.STRING(100),
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      reset_password_token: {
        type: Sequelize.STRING(255),
      },
      reset_password_expires: {
        type: Sequelize.DATE,
      },
      last_login: {
        type: Sequelize.DATE,
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Users");
  },
};
