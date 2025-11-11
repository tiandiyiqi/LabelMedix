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
      // 标签基本设置 - 项目级别配置
      label_width: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 100.0,
        comment: "标签宽度(mm)",
      },
      label_height: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 60.0,
        comment: "标签高度(mm)",
      },
      label_category: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "阶梯标",
        comment: "标签分类：阶梯标/单页左右1/单页左右2/单页上下1/单页上下2",
      },
      is_wrapped: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "是否缠绕标",
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
