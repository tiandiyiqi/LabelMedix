const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Permission extends Model {
    static associate(models) {
      // TODO: 当需要实现角色权限系统时，取消注释以下代码并创建 Role 模型
      // Permission.belongsToMany(models.Role, {
      //   through: "RolePermissions",
      //   foreignKey: "permission_id",
      // });
    }
  }

  Permission.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      description: {
        type: DataTypes.TEXT,
      },
    },
    {
      sequelize,
      modelName: "Permission",
      timestamps: true,
    }
  );

  return Permission;
};
