const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class Project extends Model {
    static associate(models) {
      // 一个项目有多个国别翻译组
      Project.hasMany(models.CountryTranslationGroup, {
        foreignKey: "project_id",
        as: "translationGroups",
        onDelete: "CASCADE",
      });

      // 一个项目属于一个用户
      Project.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "creator",
      });
    }

    // 获取项目统计信息
    async getStatistics() {
      const CountryTranslationGroup = sequelize.models.CountryTranslationGroup;
      const TranslationItem = sequelize.models.TranslationItem;

      const groups = await CountryTranslationGroup.count({
        where: { project_id: this.id },
      });

      const items = await TranslationItem.count({
        include: [
          {
            model: CountryTranslationGroup,
            where: { project_id: this.id },
            attributes: [],
          },
        ],
      });

      return {
        countryCount: groups,
        totalTranslations: items,
      };
    }
  }

  Project.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      job_name: {
        type: DataTypes.STRING(200),
        unique: true,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 200],
        },
      },
      job_description: {
        type: DataTypes.TEXT,
      },
      status: {
        type: DataTypes.ENUM("draft", "processing", "completed", "failed"),
        allowNull: false,
        defaultValue: "draft",
      },
      total_files: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Project",
      timestamps: true,
      indexes: [
        { fields: ["job_name"] },
        { fields: ["user_id"] },
        { fields: ["status"] },
      ],
    }
  );

  return Project;
};
