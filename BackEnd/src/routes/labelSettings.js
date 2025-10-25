const express = require("express");
const router = express.Router();
const {
  getLabelSettings,
  saveLabelSettings,
  getProjectLabelSettings,
  deleteLabelSettings,
} = require("../controllers/labelSettingsController");

// 获取项目的所有标签设置
router.get("/project/:projectId", getProjectLabelSettings);

// 获取特定的标签设置（项目级别或特定国别序号）
router.get(
  "/project/:projectId/:countryCode?/:sequenceNumber?",
  getLabelSettings
);

// 保存或更新标签设置
router.post(
  "/project/:projectId/:countryCode?/:sequenceNumber?",
  saveLabelSettings
);
router.put(
  "/project/:projectId/:countryCode?/:sequenceNumber?",
  saveLabelSettings
);

// 删除标签设置
router.delete(
  "/project/:projectId/:countryCode?/:sequenceNumber?",
  deleteLabelSettings
);

module.exports = router;
