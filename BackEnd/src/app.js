require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件 - CORS 配置支持多环境
const corsOptions = {
  origin: function (origin, callback) {
    // 允许无源请求（如移动应用、Postman等）
    if (!origin) return callback(null, true);

    // 允许的来源列表
    const allowedOrigins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      /^http:\/\/192\.168\.\d+\.\d+:3000$/, // 允许局域网访问
      /^http:\/\/10\.\d+\.\d+\.\d+:3000$/, // 允许10.x.x.x网段
    ];

    // 检查是否允许
    const isAllowed = allowedOrigins.some((allowed) => {
      if (typeof allowed === "string") {
        return origin === allowed;
      }
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });

    callback(null, isAllowed);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400, // 预检请求缓存24小时
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" })); // 增加JSON大小限制以支持PDF Base64
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 静态文件服务 - 提供PDF文件访问
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 导入路由
const projectRoutes = require("./routes/projects");
const fieldTypeKeywordsRoutes = require("./routes/fieldTypeKeywords");
const labelSettingsRoutes = require("./routes/labelSettings");

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
app.use("/api/field-type-keywords", fieldTypeKeywordsRoutes);
app.use("/api/label-settings", labelSettingsRoutes);

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

// 启动服务器 - 监听所有网络接口以支持局域网访问
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 LabelMedix Backend server is running on port ${PORT}`);
  console.log(`📍 Local URL: http://localhost:${PORT}`);
  console.log(`🌐 Network access enabled: http://0.0.0.0:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
