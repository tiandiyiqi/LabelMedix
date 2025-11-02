import { CozeAPI } from '@coze/api';

// 初始化Coze API客户端
const apiClient = new CozeAPI({
  token: process.env.NEXT_PUBLIC_COZE_API_TOKEN!,
  baseURL: process.env.NEXT_PUBLIC_COZE_BASE_URL!,
  allowPersonalAccessTokenInBrowser: true // 允许在浏览器环境中使用Personal Access Token
});

// 文件上传接口返回类型
interface CozeFileUploadResponse {
  bytes: number;
  created_at: number;
  file_name: string;
  id: string;
  file_id: string;
  url?: string; // 添加可能的URL字段
}

// 工作流执行结果类型
interface CozeWorkflowResponse {
  [key: string]: any; // 使用灵活的类型定义，因为实际返回的是RunWorkflowData类型
}

/**
 * 上传文件到Coze
 * @param file 要上传的文件
 * @returns 文件上传结果
 */
export const uploadFileToCoze = async (file: File): Promise<CozeFileUploadResponse> => {
  // 验证环境变量
  if (!process.env.NEXT_PUBLIC_COZE_BASE_URL) {
    throw new Error('Coze API 基础URL未配置，请设置 NEXT_PUBLIC_COZE_BASE_URL 环境变量');
  }
  
  if (!process.env.NEXT_PUBLIC_COZE_API_TOKEN) {
    throw new Error('Coze API Token未配置，请设置 NEXT_PUBLIC_COZE_API_TOKEN 环境变量');
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  const uploadUrl = `${process.env.NEXT_PUBLIC_COZE_BASE_URL}/v1/files/upload`;
  
  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_COZE_API_TOKEN}`,
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`文件上传失败: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // 处理Coze API的返回格式：{code: 0, data: {...}, msg: ""}
    if (result.code === 0 && result.data) {
      const fileData = {
        ...result.data,
        file_id: result.data.id // 添加file_id字段，值等于id
      };
      console.log(`✅ 文件上传成功: ${fileData.file_name}`);
      return fileData;
    } else {
      throw new Error(`文件上传失败: ${result.msg || '未知错误'}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('无法连接到 Coze API 服务器，请检查网络连接和 API 配置');
    }
    throw error;
  }
};

/**
 * 获取文件信息JSON字符串
 * @param fileData 文件数据
 * @returns 文件信息的JSON字符串
 */
export const getFileInfoString = (fileData: CozeFileUploadResponse): string => {
  // 根据Coze官方文档，需要返回完整的文件信息JSON字符串
  const fileInfo = {
    bytes: fileData.bytes,
    created_at: fileData.created_at,
    file_name: fileData.file_name,
    id: fileData.id,
    file_id: fileData.file_id
  };
  
  return JSON.stringify(fileInfo);
};

/**
 * 格式化并显示AI解析结果
 * @param result 工作流执行结果
 */
export const displayParseResult = (result: CozeWorkflowResponse): void => {
  try {
    console.log('🎉 AI解析完成');
    console.log(`💰 处理费用: ${result.cost || '0'}`);
    console.log(`🔗 调试链接: ${result.debug_url || '无'}`);
  } catch (error) {
    console.error('❌ 解析结果显示失败:', error);
  }
};

/**
 * 调用Coze工作流进行批量AI解析
 * @param fileInfoStrings 文件信息JSON字符串数组
 * @param jobName 工单名称
 * @returns 工作流执行结果
 */
export const callCozeWorkflow = async (
  fileInfoStrings: string[], 
  jobName: string
): Promise<CozeWorkflowResponse> => {
  // 验证必需参数
  if (!process.env.NEXT_PUBLIC_COZE_WORKFLOW_ID) {
    throw new Error('工作流ID未设置');
  }
  if (!jobName || jobName.trim() === '') {
    throw new Error('工单名称不能为空');
  }
  if (!fileInfoStrings || fileInfoStrings.length === 0) {
    throw new Error('文件信息数组不能为空');
  }
  
  try {
    console.log(`🚀 开始AI解析 ${fileInfoStrings.length} 个文件...`);
    
    const params = {
      workflow_id: process.env.NEXT_PUBLIC_COZE_WORKFLOW_ID!,
      parameters: {
        "input": fileInfoStrings, // 传递文件信息JSON字符串数组
        "job_name": jobName
      }
    };
    
    const res = await apiClient.workflows.runs.create(params);
    
    // 使用新的格式化显示函数
    displayParseResult(res as CozeWorkflowResponse);
    
    return res as CozeWorkflowResponse;
  } catch (error) {
    console.error('❌ AI解析失败:', error);
    throw new Error(`AI解析失败: ${(error as Error).message}`);
  }
};

/**
 * 批量处理多个文件的AI解析（新的批量模式）
 * @param files 文件列表
 * @param jobName 工单名称
 * @param onStatusUpdate 状态更新回调函数
 * @returns 工作流执行结果
 */
export const batchProcessFiles = async (
  files: File[], 
  jobName: string,
  onStatusUpdate?: (status: string, message: string) => void
): Promise<CozeWorkflowResponse> => {
  try {
    // 1. 并行上传所有文件
    console.log(`📤 开始上传 ${files.length} 个文件...`);
    onStatusUpdate?.('uploading', `📤 开始上传 ${files.length} 个文件...`);
    
    const uploadPromises = files.map(file => uploadFileToCoze(file));
    const uploadResults = await Promise.all(uploadPromises);
    
    // 2. 将所有文件数据转换为JSON字符串
    const fileInfoStrings = uploadResults.map(fileData => getFileInfoString(fileData));
    
    // 3. 一次性调用工作流处理所有文件
    console.log(`🚀 开始AI解析 ${files.length} 个文件...`);
    onStatusUpdate?.('parsing', `🚀 开始AI解析 ${files.length} 个文件...`);
    
    const result = await callCozeWorkflow(fileInfoStrings, jobName);
    
    console.log('🎉 批量处理完成');
    console.log('🔍 返回的 result 对象:', result);
    console.log('🔍 result.data:', result.data);
    console.log('🔍 result.output:', result.output);
    console.log('🔍 result 的所有键:', Object.keys(result));
    return result;
  } catch (error) {
    console.error('❌ 批量处理失败:', error);
    throw error;
  }
}; 