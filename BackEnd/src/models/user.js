const { Model, DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
  class User extends Model {
    static associate(models) {
      // 定义模型关联
    }

    // 验证密码
    async validatePassword(password) {
      return bcrypt.compare(password, this.password_hash);
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [3, 50],
        },
      },
      email: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      full_name: {
        type: DataTypes.STRING(100),
      },
      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "user",
        validate: {
          isIn: [["admin", "user", "reviewer"]],
        },
      },
      department: {
        type: DataTypes.STRING(100),
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      reset_password_token: {
        type: DataTypes.STRING(255),
      },
      reset_password_expires: {
        type: DataTypes.DATE,
      },
      last_login: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: "User",
      timestamps: true,
      hooks: {
        beforeCreate: async (user) => {
          if (user.password_hash) {
            user.password_hash = await bcrypt.hash(user.password_hash, 10);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed("password_hash")) {
            user.password_hash = await bcrypt.hash(user.password_hash, 10);
          }
        },
      },
    }
  );

  return User;
};
