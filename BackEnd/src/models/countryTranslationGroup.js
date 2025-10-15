const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class CountryTranslationGroup extends Model {
    static associate(models) {
      // 一个翻译组属于一个项目
      CountryTranslationGroup.belongsTo(models.Project, {
        foreignKey: "project_id",
        as: "project",
      });

      // 一个翻译组有多个翻译条目
      CountryTranslationGroup.hasMany(models.TranslationItem, {
        foreignKey: "group_id",
        as: "items",
        onDelete: "CASCADE",
      });
    }

    // 更新翻译条目总数
    async updateTotalItems() {
      const count = await sequelize.models.TranslationItem.count({
        where: { group_id: this.id },
      });
      await this.update({ total_items: count });
      return count;
    }
  }

  CountryTranslationGroup.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      country_code: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [2, 10],
        },
      },
      sequence_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      total_items: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
    },
    {
      sequelize,
      modelName: "CountryTranslationGroup",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["project_id", "country_code"],
          name: "uk_project_country",
        },
        {
          unique: true,
          fields: ["project_id", "sequence_number"],
          name: "uk_project_sequence",
        },
        { fields: ["project_id", "country_code"] },
      ],
    }
  );

  return CountryTranslationGroup;
};
