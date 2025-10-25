'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LabelSettings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: '主键ID'
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '关联项目ID',
        references: {
          model: 'Projects',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      country_code: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: '国别代码，为空表示项目级别设置'
      },
      sequence_number: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '序号，为空表示项目级别设置'
      },
      // 标签基本设置
      label_width: {
        type: Sequelize.DECIMAL(6,2),
        allowNull: false,
        defaultValue: 100.00,
        comment: '标签宽度(mm)'
      },
      label_height: {
        type: Sequelize.DECIMAL(6,2),
        allowNull: false,
        defaultValue: 60.00,
        comment: '标签高度(mm)'
      },
      label_category: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: '阶梯标',
        comment: '标签分类：阶梯标/单页左右1/单页左右2/单页上下1/单页上下2'
      },
      current_width: {
        type: Sequelize.DECIMAL(6,2),
        allowNull: false,
        defaultValue: 120.00,
        comment: '当前页面宽度(mm)'
      },
      // 页面区域设置
      base_sheet: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '底页'
      },
      adhesive_area: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '粘胶区'
      },
      waste_area: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '排废区'
      },
      coding_area: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '打码区'
      },
      // 字体设置
      font_family: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'STHeiti',
        comment: '主语言字体'
      },
      secondary_font_family: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'Arial',
        comment: '次语言字体'
      },
      font_size: {
        type: Sequelize.DECIMAL(4,1),
        allowNull: false,
        defaultValue: 10.0,
        comment: '字体大小(pt)'
      },
      text_align: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'left',
        comment: '文本对齐方式：left/center/right'
      },
      spacing: {
        type: Sequelize.DECIMAL(3,1),
        allowNull: false,
        defaultValue: 1.0,
        comment: '字符间距'
      },
      line_height: {
        type: Sequelize.DECIMAL(3,1),
        allowNull: false,
        defaultValue: 1.2,
        comment: '行高'
      },
      // 序号设置
      show_sequence_number: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: '是否显示序号'
      },
      custom_sequence_text: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: '自定义序号内容'
      },
      sequence_position: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'right',
        comment: '序号位置：left/center/right'
      },
      sequence_font_size: {
        type: Sequelize.DECIMAL(4,1),
        allowNull: false,
        defaultValue: 9.0,
        comment: '序号字体大小(pt)'
      },
      sequence_offset_x: {
        type: Sequelize.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0.00,
        comment: '序号水平位移(mm)'
      },
      sequence_offset_y: {
        type: Sequelize.DECIMAL(5,2),
        allowNull: false,
        defaultValue: 0.00,
        comment: '序号垂直位移(mm)'
      },
      // 时间戳
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: '创建时间'
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment: '更新时间'
      }
    }, {
      comment: '标签设置表'
    });

    // 创建索引
    await queryInterface.addIndex('LabelSettings', ['project_id'], {
      name: 'idx_label_settings_project_id'
    });

    await queryInterface.addIndex('LabelSettings', ['project_id', 'country_code'], {
      name: 'idx_label_settings_project_country'
    });

    await queryInterface.addIndex('LabelSettings', ['project_id', 'country_code', 'sequence_number'], {
      name: 'idx_label_settings_project_country_sequence'
    });

    // 创建唯一约束：每个项目的每个国别序号组合只能有一条记录
    await queryInterface.addConstraint('LabelSettings', {
      fields: ['project_id', 'country_code', 'sequence_number'],
      type: 'unique',
      name: 'uk_label_settings_project_country_sequence'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('LabelSettings');
  }
};
