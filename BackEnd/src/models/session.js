const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Session extends Model {
    static associate(models) {
      Session.belongsTo(models.User, {
        foreignKey: "user_id",
      });
    }
  }

  Session.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
      token: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      ip_address: {
        type: DataTypes.STRING(45),
      },
      user_agent: {
        type: DataTypes.TEXT,
      },
    },
    {
      sequelize,
      modelName: "Session",
      timestamps: true,
    }
  );

  return Session;
};
