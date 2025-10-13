# Coze API 使用说明

## 📋 概述

本文档详细说明了 LabelMedix 项目中 Coze AI 平台的集成和使用方法。Coze API 主要用于药品标签的智能解析和处理，通过 AI 工作流实现自动化的信息提取。

## 🔧 环境配置

### 环境变量设置

在 `FrontEnd/.env.local` 文件中配置以下环境变量：

```bash
# Coze API 配置 - 服务访问令牌方式
NEXT_PUBLIC_COZE_API_TOKEN=sat_Wh14smJYqkiyjeRzZgy6yogug5wVwRHnWSBCyJsEwuj9TTKVfEC1nynYXGTKoC2b
NEXT_PUBLIC_COZE_WORKFLOW_ID=7524494590444486695
NEXT_PUBLIC_COZE_BASE_URL=https://api.coze.cn

# 认证方式选择 - 使用服务访问令牌
NEXT_PUBLIC_AUTH_METHOD=sat
```

### 环境变量说明

| 变量名                         | 说明                    | 示例值                |
| ------------------------------ | ----------------------- | --------------------- |
| `NEXT_PUBLIC_COZE_API_TOKEN`   | Coze 平台的服务访问令牌 | `sat_xxx...`          |
| `NEXT_PUBLIC_COZE_WORKFLOW_ID` | 工作流的唯一标识符      | `7524494590444486695` |
| `NEXT_PUBLIC_COZE_BASE_URL`    | Coze API 的基础 URL     | `https://api.coze.cn` |
| `NEXT_PUBLIC_AUTH_METHOD`      | 认证方式标识            | `sat`                 |

## 🎯 核心功能

### 1. 文件上传功能

#### 函数签名

```typescript
uploadFileToCoze(file: File): Promise<CozeFileUploadResponse>
```

#### 功能说明

- 将本地文件上传到 Coze 平台
- 支持各种文件格式（主要用于 PDF 文件）
- 自动处理 Coze API 的返回格式

#### 使用示例

```typescript
import { uploadFileToCoze } from "@/lib/cozeApi";

// 上传单个文件
const handleFileUpload = async (file: File) => {
  try {
    const result = await uploadFileToCoze(file);
    console.log("上传成功:", result);
    // result 包含: id, file_id, file_name, bytes, created_at
  } catch (error) {
    console.error("上传失败:", error);
  }
};
```

#### 返回数据结构

```typescript
interface CozeFileUploadResponse {
  bytes: number; // 文件大小（字节）
  created_at: number; // 创建时间戳
  file_name: string; // 文件名
  id: string; // 文件唯一标识
  file_id: string; // 文件ID（用于后续引用）
  url?: string; // 可选的文件URL
}
```

### 2. 工作流调用功能

#### 函数签名

```typescript
callCozeWorkflow(fileInfoStrings: string[], jobName: string): Promise<CozeWorkflowResponse>
```

#### 功能说明

- 调用 Coze 平台的 AI 工作流
- 支持批量文件处理
- 自动处理工作流参数和返回结果

#### 使用示例

```typescript
import { callCozeWorkflow, getFileInfoString } from "@/lib/cozeApi";

// 调用工作流处理文件
const processFiles = async (uploadResults: CozeFileUploadResponse[]) => {
  try {
    // 转换文件信息为工作流所需格式
    const fileInfoStrings = uploadResults.map((result) =>
      getFileInfoString(result)
    );

    // 调用工作流
    const workflowResult = await callCozeWorkflow(
      fileInfoStrings,
      "药品标签解析"
    );
    console.log("AI处理完成:", workflowResult);
  } catch (error) {
    console.error("工作流调用失败:", error);
  }
};
```

### 3. 批量处理功能

#### 函数签名

```typescript
batchProcessFiles(
  files: File[],
  jobName: string,
  onStatusUpdate?: (status: string, message: string) => void
): Promise<CozeWorkflowResponse>
```

#### 功能说明

- 一站式批量文件处理解决方案
- 并行上传多个文件
- 实时状态更新回调
- 自动调用工作流处理

#### 使用示例

```typescript
import { batchProcessFiles } from "@/lib/cozeApi";

// 批量处理多个文件
const handleBatchProcess = async (files: File[]) => {
  try {
    const result = await batchProcessFiles(
      files,
      "批量药品标签解析",
      (status, message) => {
        // 状态更新回调
        console.log(`状态: ${status}, 消息: ${message}`);
        // 可以在这里更新UI状态
        setProcessingStatus(message);
      }
    );

    console.log("批量处理完成:", result);
  } catch (error) {
    console.error("批量处理失败:", error);
  }
};
```

#### 状态回调说明

| 状态值      | 说明         | 示例消息                    |
| ----------- | ------------ | --------------------------- |
| `uploading` | 文件上传阶段 | `📤 开始上传 3 个文件...`   |
| `parsing`   | AI 解析阶段  | `🚀 开始AI解析 3 个文件...` |

## 🔄 完整使用流程

### 方案一：分步处理

```typescript
import {
  uploadFileToCoze,
  getFileInfoString,
  callCozeWorkflow,
} from "@/lib/cozeApi";

const processFileStepByStep = async (file: File) => {
  try {
    // 1. 上传文件
    console.log("步骤1: 上传文件");
    const uploadResult = await uploadFileToCoze(file);

    // 2. 格式化文件信息
    console.log("步骤2: 格式化文件信息");
    const fileInfoString = getFileInfoString(uploadResult);

    // 3. 调用工作流
    console.log("步骤3: 调用AI工作流");
    const workflowResult = await callCozeWorkflow(
      [fileInfoString],
      "单文件解析"
    );

    console.log("处理完成:", workflowResult);
    return workflowResult;
  } catch (error) {
    console.error("处理失败:", error);
    throw error;
  }
};
```

### 方案二：批量处理（推荐）

```typescript
import { batchProcessFiles } from "@/lib/cozeApi";

const processBatchFiles = async (files: File[]) => {
  try {
    const result = await batchProcessFiles(
      files,
      "批量药品标签解析",
      (status, message) => {
        // 更新UI状态
        updateProcessingUI(status, message);
      }
    );

    return result;
  } catch (error) {
    console.error("批量处理失败:", error);
    throw error;
  }
};
```

## 📊 在 React 组件中的使用

### 基础组件示例

```typescript
import React, { useState } from "react";
import { batchProcessFiles } from "@/lib/cozeApi";

const FileProcessor: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    try {
      const result = await batchProcessFiles(
        files,
        "药品标签批量解析",
        (status, message) => {
          setStatus(message);
        }
      );

      setResult(result);
      setStatus("处理完成！");
    } catch (error) {
      setStatus(`处理失败: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        multiple
        accept=".pdf"
        onChange={handleFileChange}
        disabled={processing}
      />

      <button
        onClick={handleProcess}
        disabled={processing || files.length === 0}
      >
        {processing ? "处理中..." : "开始处理"}
      </button>

      {status && <p>{status}</p>}

      {result && (
        <div>
          <h3>处理结果:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default FileProcessor;
```

## ⚠️ 错误处理

### 常见错误类型

1. **环境变量未设置**

   ```
   错误: 工作流ID未设置
   解决: 检查 NEXT_PUBLIC_COZE_WORKFLOW_ID 是否正确配置
   ```

2. **文件上传失败**

   ```
   错误: 文件上传失败: 401 Unauthorized
   解决: 检查 NEXT_PUBLIC_COZE_API_TOKEN 是否有效
   ```

3. **工作流调用失败**
   ```
   错误: AI解析失败: workflow not found
   解决: 检查工作流ID是否正确，工作流是否已发布
   ```

### 错误处理最佳实践

```typescript
const safeProcessFiles = async (files: File[]) => {
  try {
    // 参数验证
    if (!files || files.length === 0) {
      throw new Error("请选择要处理的文件");
    }

    // 环境变量检查
    if (!process.env.NEXT_PUBLIC_COZE_API_TOKEN) {
      throw new Error("Coze API Token 未配置");
    }

    // 执行处理
    const result = await batchProcessFiles(files, "批量处理");
    return result;
  } catch (error) {
    // 统一错误处理
    console.error("文件处理失败:", error);

    // 根据错误类型提供用户友好的提示
    if (error.message.includes("401")) {
      throw new Error("API认证失败，请检查配置");
    } else if (error.message.includes("网络")) {
      throw new Error("网络连接失败，请稍后重试");
    } else {
      throw new Error(`处理失败: ${error.message}`);
    }
  }
};
```

## 🔍 调试和监控

### 日志输出

API 调用过程中会输出详细的日志信息：

```
📤 开始上传 3 个文件...
✅ 文件上传成功: 药品标签1.pdf
✅ 文件上传成功: 药品标签2.pdf
✅ 文件上传成功: 药品标签3.pdf
🚀 开始AI解析 3 个文件...
🎉 AI解析完成
💰 处理费用: 0.05
🔗 调试链接: https://www.coze.cn/workflow/run/xxx
🎉 批量处理完成
```

### 性能监控

```typescript
const monitoredBatchProcess = async (files: File[]) => {
  const startTime = Date.now();

  try {
    const result = await batchProcessFiles(files, "性能监控测试");

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`处理完成，耗时: ${duration}ms`);
    console.log(`平均每文件: ${duration / files.length}ms`);

    return result;
  } catch (error) {
    console.error("处理失败，耗时:", Date.now() - startTime, "ms");
    throw error;
  }
};
```

## 🚀 高级用法

### 自定义状态管理

```typescript
interface ProcessingState {
  status: "idle" | "uploading" | "parsing" | "completed" | "error";
  message: string;
  progress: number;
  result?: any;
}

const useFileProcessor = () => {
  const [state, setState] = useState<ProcessingState>({
    status: "idle",
    message: "",
    progress: 0,
  });

  const processFiles = async (files: File[]) => {
    setState({ status: "uploading", message: "开始上传...", progress: 0 });

    try {
      const result = await batchProcessFiles(
        files,
        "高级处理",
        (status, message) => {
          setState((prev) => ({
            ...prev,
            status: status as any,
            message,
            progress: status === "uploading" ? 50 : 80,
          }));
        }
      );

      setState({
        status: "completed",
        message: "处理完成",
        progress: 100,
        result,
      });

      return result;
    } catch (error) {
      setState({
        status: "error",
        message: error.message,
        progress: 0,
      });
      throw error;
    }
  };

  return { state, processFiles };
};
```

## 📝 注意事项

1. **文件大小限制**: Coze 平台对上传文件大小有限制，建议单个文件不超过 10MB
2. **并发限制**: 批量处理时注意 API 调用频率限制
3. **费用控制**: AI 处理会产生费用，建议监控使用量
4. **网络超时**: 大文件处理可能需要较长时间，注意设置合适的超时时间
5. **错误重试**: 网络不稳定时建议实现重试机制

## 🔗 相关链接

- [Coze 官方文档](https://www.coze.cn/docs)
- [Coze API 参考](https://www.coze.cn/docs/developer_guides/api_overview)
- [项目 GitHub 仓库](https://github.com/your-repo/LabelMedix)

---

**更新日期**: 2024 年 12 月
**维护者**: 玄鉴 AI 团队
**版本**: v1.0.0

**玄鉴编程，使命必达！**
