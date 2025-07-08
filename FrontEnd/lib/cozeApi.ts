import { CozeAPI } from '@coze/api';

// 初始化Coze API客户端
const apiClient = new CozeAPI({
  token: process.env.NEXT_PUBLIC_COZE_API_TOKEN!,
  baseURL: process.env.NEXT_PUBLIC_COZE_BASE_URL!
});

// 文件上传接口返回类型
interface CozeFileUploadResponse {
  bytes: number;
  created_at: number;
  file_name: string;
  id: string;
  file_id: string;
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
  const formData = new FormData();
  formData.append('file', file);
  
  const uploadUrl = `${process.env.NEXT_PUBLIC_COZE_BASE_URL}/v1/files/upload`;
  console.log('上传文件到:', uploadUrl);
  
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
  console.log('文件上传成功:', result);
  
  // 处理Coze API的返回格式：{code: 0, data: {...}, msg: ""}
  if (result.code === 0 && result.data) {
    const fileData = {
      ...result.data,
      file_id: result.data.id // 添加file_id字段，值等于id
    };
    console.log('处理后的文件数据:', fileData);
    return fileData;
  } else {
    throw new Error(`文件上传失败: ${result.msg || '未知错误'}`);
  }
};

/**
 * 调用Coze工作流进行AI解析
 * @param fileData 文件数据（从上传接口返回）
 * @param jobName 工单名称
 * @returns 工作流执行结果
 */
export const callCozeWorkflow = async (
  fileData: CozeFileUploadResponse, 
  jobName: string
): Promise<CozeWorkflowResponse> => {
  console.log('准备调用工作流，文件数据:', fileData);
  console.log('工单名称:', jobName);
  console.log('工作流ID:', process.env.NEXT_PUBLIC_COZE_WORKFLOW_ID);
  
  // 验证必需参数
  if (!process.env.NEXT_PUBLIC_COZE_WORKFLOW_ID) {
    throw new Error('工作流ID未设置');
  }
  if (!jobName || jobName.trim() === '') {
    throw new Error('工单名称不能为空');
  }
  if (!fileData || !fileData.file_id) {
    throw new Error('文件数据无效');
  }
  
  try {
    console.log('调用工作流进行AI解析...');
    
    const params = {
      workflow_id: process.env.NEXT_PUBLIC_COZE_WORKFLOW_ID!,
      parameters: {
        "input": JSON.stringify(fileData),
        "job_name": jobName
      }
    };
    
    console.log('请求参数:', JSON.stringify(params, null, 2));
    
    const res = await apiClient.workflows.runs.create(params);
    
    console.log('工作流调用成功:', res);
    return res as CozeWorkflowResponse;
  } catch (error) {
    console.error('工作流调用失败:', error);
    throw new Error(`AI解析失败: ${(error as Error).message}`);
  }
};

/**
 * 批量处理多个文件的AI解析
 * @param files 文件列表
 * @param jobName 工单名称
 * @returns 所有文件的解析结果
 */
export const batchProcessFiles = async (
  files: File[], 
  jobName: string
): Promise<CozeWorkflowResponse[]> => {
  try {
    // 1. 并行上传所有文件
    console.log(`开始上传 ${files.length} 个文件...`);
    const uploadPromises = files.map(file => uploadFileToCoze(file));
    const uploadResults = await Promise.all(uploadPromises);
    
    // 2. 对每个文件调用工作流
    console.log('开始AI解析...');
    const parsePromises = uploadResults.map(fileData => 
      callCozeWorkflow(fileData, jobName)
    );
    const parseResults = await Promise.all(parsePromises);
    
    console.log('批量处理完成:', parseResults);
    return parseResults;
  } catch (error) {
    console.error('批量处理失败:', error);
    throw error;
  }
}; 