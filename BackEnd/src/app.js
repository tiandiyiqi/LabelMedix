require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 导入路由
const projectRoutes = require("./routes/projects");

// 基本路由
app.get("/", (req, res) => {
  res.json({
    message: "LabelMedix Backend API",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// 健康检查路由
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// API 路由
app.use("/api/projects", projectRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  });
});

// 404 处理
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 LabelMedix Backend server is running on port ${PORT}`);
  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
