const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  class FieldTypeKeyword extends Model {}

  FieldTypeKeyword.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      keyword: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      field_type: {
        type: DataTypes.ENUM(
          "basic_info",
          "number_field",
          "drug_name",
          "number_of_sheets",
          "company_name"
        ),
        allowNull: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "FieldTypeKeyword",
      tableName: "FieldTypeKeywords",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ["field_type"],
          name: "idx_field_type",
        },
        {
          unique: true,
          fields: ["keyword", "field_type"],
          name: "idx_keyword_field_type",
        },
      ],
    }
  );

  return FieldTypeKeyword;
};
