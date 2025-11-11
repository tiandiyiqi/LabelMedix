#!/usr/bin/env node

const { sequelize } = require("../config/database");
const { Project, LabelSettings } = require("../models");

async function migrateProjectLabelSettings() {
  try {
    console.log("🚀 开始迁移项目标签设置数据...");
    
    // 获取所有项目
    const projects = await Project.findAll();
    console.log(`📊 找到 ${projects.length} 个项目`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const project of projects) {
      console.log(`\n🔍 处理项目: ${project.job_name} (ID: ${project.id})`);
      
      // 检查项目是否已经有标签设置数据
      if (project.label_width !== 100.0 || project.label_height !== 60.0 || 
          project.label_category !== "阶梯标" || project.is_wrapped !== false) {
        console.log("  ⏭️  项目已有标签设置，跳过");
        skippedCount++;
        continue;
      }
      
      // 查找该项目的LabelSettings记录
      const labelSettings = await LabelSettings.findAll({
        where: { project_id: project.id },
        order: [['createdAt', 'ASC']] // 按创建时间排序，取最早的记录
      });
      
      if (labelSettings.length === 0) {
        console.log("  ⚠️  项目没有LabelSettings记录，使用默认值");
        skippedCount++;
        continue;
      }
      
      // 使用第一个LabelSettings记录的值作为项目级默认值
      const firstSetting = labelSettings[0];
      
      // 检查是否所有LabelSettings记录的值都一致
      const allSettingsSame = labelSettings.every(setting => 
        setting.label_width === firstSetting.label_width &&
        setting.label_height === firstSetting.label_height &&
        setting.label_category === firstSetting.label_category &&
        setting.is_wrapped === firstSetting.is_wrapped
      );
      
      if (!allSettingsSame) {
        console.log("  ⚠️  项目内不同LabelSettings记录的值不一致，使用第一个记录的值");
      }
      
      // 更新项目记录
      await project.update({
        label_width: firstSetting.label_width,
        label_height: firstSetting.label_height,
        label_category: firstSetting.label_category,
        is_wrapped: firstSetting.is_wrapped
      });
      
      console.log(`  ✅ 迁移成功: 宽度=${firstSetting.label_width}, 高度=${firstSetting.label_height}, 分类=${firstSetting.label_category}, 缠绕=${firstSetting.is_wrapped}`);
      migratedCount++;
    }
    
    console.log(`\n🎉 数据迁移完成！`);
    console.log(`✅ 成功迁移: ${migratedCount} 个项目`);
    console.log(`⏭️  跳过处理: ${skippedCount} 个项目`);
    
  } catch (error) {
    console.error("❌ 数据迁移失败:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateProjectLabelSettings();
}

module.exports = migrateProjectLabelSettings;