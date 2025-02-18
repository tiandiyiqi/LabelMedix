const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Permission extends Model {
    static associate(models) {
      Permission.belongsToMany(models.Role, {
        through: "RolePermissions",
        foreignKey: "permission_id",
      });
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
