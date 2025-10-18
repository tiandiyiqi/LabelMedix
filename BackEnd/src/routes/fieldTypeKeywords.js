const express = require("express");
const router = express.Router();
const fieldTypeKeywordController = require("../controllers/fieldTypeKeywordController");

// 获取所有关键词（可按类型筛选）
router.get("/", fieldTypeKeywordController.getAllKeywords);

// 创建新关键词
router.post("/", fieldTypeKeywordController.createKeyword);

// 更新关键词
router.put("/:id", fieldTypeKeywordController.updateKeyword);

// 删除关键词
router.delete("/:id", fieldTypeKeywordController.deleteKeyword);

// 批量导入关键词
router.post("/batch-import", fieldTypeKeywordController.batchImport);

module.exports = router;
