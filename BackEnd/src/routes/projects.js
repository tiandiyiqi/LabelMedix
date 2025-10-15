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

module.exports = router;
