const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const db = require("../models");
const FieldTypeKeyword = db.FieldTypeKeyword;
const sequelize = db.sequelize;

async function importKeywords() {
  try {
    console.log("🔄 开始导入5类清单数据...");

    // 测试数据库连接
    await sequelize.authenticate();
    console.log("✅ 数据库连接成功");

    // 同步模型（如果表不存在则创建）
    await FieldTypeKeyword.sync();
    console.log("✅ 数据表准备完成");

    // CSV 文件路径
    const csvFilePath = path.join(__dirname, "../../../5类清单.csv");

    if (!fs.existsSync(csvFilePath)) {
      console.error("❌ CSV文件不存在:", csvFilePath);
      process.exit(1);
    }

    // 读取 CSV 文件（简单解析）
    const csvContent = fs.readFileSync(csvFilePath, "utf-8");
    const lines = csvContent.split("\n");
    const keywords = [];

    // 跳过标题行，从第二行开始
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 简单的 CSV 解析（假设没有逗号在字段内）
      const [original_text, field_type] = line.split(",").map((s) => s.trim());

      if (original_text && field_type) {
        keywords.push({
          keyword: original_text,
          field_type: field_type,
          is_active: true,
        });
      }
    }

    console.log(`📊 从CSV读取了 ${keywords.length} 条数据`);

    // 批量插入数据
    let successCount = 0;
    let skipCount = 0;

    for (const kw of keywords) {
      try {
        // 检查是否已存在
        const existing = await FieldTypeKeyword.findOne({
          where: {
            keyword: kw.keyword,
            field_type: kw.field_type,
          },
        });

        if (!existing) {
          await FieldTypeKeyword.create(kw);
          successCount++;
          console.log(`✅ 导入: ${kw.keyword} [${kw.field_type}]`);
        } else {
          skipCount++;
          console.log(`⏭️  跳过（已存在）: ${kw.keyword} [${kw.field_type}]`);
        }
      } catch (error) {
        console.error(`❌ 导入失败: ${kw.keyword}`, error.message);
      }
    }

    console.log("\n📈 导入统计:");
    console.log(`   ✅ 成功: ${successCount}`);
    console.log(`   ⏭️  跳过: ${skipCount}`);
    console.log(`   📊 总计: ${keywords.length}`);

    // 显示各类型数量
    const counts = await FieldTypeKeyword.findAll({
      attributes: [
        "field_type",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["field_type"],
    });

    console.log("\n📊 各类型关键词数量:");
    counts.forEach((item) => {
      const typeNames = {
        basic_info: "基本信息",
        number_field: "编号栏",
        drug_name: "药品名称",
        number_of_sheets: "片数",
        company_name: "公司名称",
      };
      console.log(`   ${typeNames[item.field_type]}: ${item.get("count")}`);
    });

    console.log("\n✅ 数据导入完成！");
    process.exit(0);
  } catch (error) {
    console.error("❌ 导入过程出错:", error);
    process.exit(1);
  }
}

// 执行导入
importKeywords();
