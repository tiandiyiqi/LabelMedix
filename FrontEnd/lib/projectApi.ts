// 项目 API 接口
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

interface Project {
  id: number;
  job_name: string;
  job_description?: string;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  total_files: number;
  user_id?: number;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: number;
    username: string;
    full_name: string;
  };
  statistics?: {
    countryCount: number;
    translationCount: number;
  };
}

interface TranslationItem {
  id: number;
  group_id: number;
  field_type?: 'basic_info' | 'number_field' | 'drug_description';
  original_text: string;
  translated_text?: string;
  item_order: number;
  is_edited: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CountryTranslationGroup {
  id: number;
  project_id: number;
  country_code: string;
  sequence_number: number;
  total_items: number;
  items?: TranslationItem[];
  createdAt: string;
  updatedAt: string;
}

interface ProjectDetail extends Project {
  translationGroups?: CountryTranslationGroup[];
}

interface CreateProjectData {
  job_name: string;
  job_description?: string;
  user_id?: number;
  coze_result?: {
    output: {
      [countryCode: string]: string[];
    };
  };
}

/**
 * 获取项目列表
 * @param page 页码
 * @param limit 每页数量
 * @param status 项目状态筛选
 * @param search 搜索关键词（工单名称或描述）
 */
export const getProjects = async (
  page: number = 1,
  limit: number = 10,
  status?: 'draft' | 'processing' | 'completed' | 'failed',
  search?: string
): Promise<{
  projects: Project[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> => {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status) {
      params.append('status', status);
    }

    if (search && search.trim()) {
      params.append('search', search.trim());
    }

    const response = await fetch(`${API_BASE_URL}/api/projects?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`获取项目列表失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '获取项目列表失败');
    }

    return result.data;
  } catch (error) {
    console.error('获取项目列表失败:', error);
    throw error;
  }
};

/**
 * 获取项目详情
 * @param projectId 项目ID
 */
export const getProjectById = async (projectId: number): Promise<ProjectDetail> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`获取项目详情失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '获取项目详情失败');
    }

    return result.data;
  } catch (error) {
    console.error('获取项目详情失败:', error);
    throw error;
  }
};

/**
 * 创建项目
 * @param projectData 项目数据
 */
export const createProject = async (projectData: CreateProjectData): Promise<ProjectDetail> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      throw new Error(`创建项目失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '创建项目失败');
    }

    return result.data;
  } catch (error) {
    console.error('创建项目失败:', error);
    throw error;
  }
};

/**
 * 更新项目
 * @param projectId 项目ID
 * @param updateData 更新数据
 */
export const updateProject = async (
  projectId: number,
  updateData: {
    job_name?: string;
    job_description?: string;
    status?: 'draft' | 'processing' | 'completed' | 'failed';
  }
): Promise<Project> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error(`更新项目失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '更新项目失败');
    }

    return result.data;
  } catch (error) {
    console.error('更新项目失败:', error);
    throw error;
  }
};

/**
 * 删除项目
 * @param projectId 项目ID
 */
export const deleteProject = async (projectId: number): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`删除项目失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '删除项目失败');
    }
  } catch (error) {
    console.error('删除项目失败:', error);
    throw error;
  }
};

/**
 * 获取特定国别的翻译
 * @param projectId 项目ID
 * @param countryCode 国别代码
 */
export const getTranslationsByCountry = async (
  projectId: number,
  countryCode: string
): Promise<CountryTranslationGroup> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/translations/${countryCode}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`获取翻译失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '获取翻译失败');
    }

    return result.data;
  } catch (error) {
    console.error('获取翻译失败:', error);
    throw error;
  }
};

/**
 * 更新翻译内容
 * @param itemId 翻译条目ID
 * @param updateData 更新数据
 */
export const updateTranslation = async (
  itemId: number,
  updateData: {
    translated_text?: string;
    field_type?: 'basic_info' | 'number_field' | 'drug_description';
  }
): Promise<TranslationItem> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/translations/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error(`更新翻译失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '更新翻译失败');
    }

    return result.data;
  } catch (error) {
    console.error('更新翻译失败:', error);
    throw error;
  }
};

// 导出类型
export type {
  Project,
  ProjectDetail,
  TranslationItem,
  CountryTranslationGroup,
  CreateProjectData,
};

