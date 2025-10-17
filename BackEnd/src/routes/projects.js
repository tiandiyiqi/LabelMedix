const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");

// 项目相关路由
router.get("/", projectController.getProjects); // 获取项目列表
router.get("/:id", projectController.getProjectById); // 获取项目详情
router.post("/", projectController.createProject); // 创建项目
router.put("/:id", projectController.updateProject); // 更新项目
router.put("/:id/sequence", projectController.updateCountrySequence); // 更新国别顺序
router.delete("/:id", projectController.deleteProject); // 删除项目

// 翻译相关路由
router.get(
  "/:projectId/translations/:countryCode",
  projectController.getTranslationsByCountry
); // 获取特定国别的翻译
router.put("/translations/:itemId", projectController.updateTranslation); // 更新翻译内容

// 国别翻译组相关路由
router.get(
  "/:projectId/countries/:countryCode/translations",
  projectController.getTranslationsByCountry
); // 获取特定国别的翻译

// 国别翻译组扩展功能路由
router.post(
  "/:projectId/countries/:countryCode/summary",
  projectController.generateCountrySummary
); // 生成国别翻译汇总
router.put(
  "/:projectId/countries/:countryCode/formatted-summary",
  projectController.updateFormattedSummary
); // 更新格式化翻译汇总
router.put(
  "/:projectId/countries/:countryCode/pdf",
  projectController.updatePdfFilePath
); // 更新PDF文件路径
router.post(
  "/:projectId/countries/:countryCode/save-pdf",
  projectController.savePdfFile
); // 保存PDF文件
router.get(
  "/:projectId/countries/:countryCode/details",
  projectController.getCountryDetails
); // 获取国别详细信息（包括汇总和PDF）

module.exports = router;
