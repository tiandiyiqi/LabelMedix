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
  formatted_summary?: string;
  pdf_file_path?: string;
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
  coze_result?: any;
}

/**
 * 获取项目列表
 * @param page 页码
 * @param pageSize 每页数量
 * @param status 状态筛选
 * @param search 搜索关键词
 */
export const getProjects = async (
  page: number = 1,
  pageSize: number = 10,
  status?: string,
  search?: string
): Promise<{ projects: Project[]; total: number; page: number; pageSize: number }> => {
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (status) params.append('status', status);
    if (search) params.append('search', search);

    const response = await fetch(`${API_BASE_URL}/api/projects?${params.toString()}`, {
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
 * 获取单个项目详情
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
export const createProject = async (projectData: CreateProjectData): Promise<Project> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `创建项目失败: ${response.status} ${response.statusText}`);
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
 * @param updates 更新数据
 */
export const updateProject = async (
  projectId: number,
  updates: Partial<Project>
): Promise<Project> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
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
 * 更新国别顺序
 * @param projectId 项目ID
 * @param sequenceUpdates 顺序更新数据
 */
export const updateCountrySequence = async (
  projectId: number,
  sequenceUpdates: Array<{ group_id: number; sequence_number: number }>
): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/sequence`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sequence_updates: sequenceUpdates }),
    });

    if (!response.ok) {
      throw new Error(`更新顺序失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '更新顺序失败');
    }
  } catch (error) {
    console.error('更新顺序失败:', error);
    throw error;
  }
};

/**
 * 获取特定国别的翻译列表
 * @param projectId 项目ID
 * @param countryCode 国别代码
 */
export const getTranslationsByCountry = async (
  projectId: number,
  countryCode: string
): Promise<CountryTranslationGroup> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/countries/${countryCode}/translations`,
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
 * 更新翻译项
 * @param translationId 翻译项ID
 * @param updates 更新数据
 */
export const updateTranslation = async (
  translationId: number,
  updates: { translated_text: string }
): Promise<TranslationItem> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/translations/${translationId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

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

/**
 * 生成国别翻译汇总
 * @param projectId 项目ID
 * @param countryCode 国别代码
 */
export const generateCountrySummary = async (
  projectId: number,
  countryCode: string
): Promise<{ country_code: string; formatted_summary: string }> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/countries/${countryCode}/summary`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`生成翻译汇总失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '生成翻译汇总失败');
    }

    return result.data;
  } catch (error) {
    console.error('生成翻译汇总失败:', error);
    throw error;
  }
};

/**
 * 更新格式化翻译汇总
 * @param projectId 项目ID
 * @param countryCode 国别代码
 * @param formattedSummary 格式化后的翻译汇总
 */
export const updateFormattedSummary = async (
  projectId: number,
  countryCode: string,
  formattedSummary: string
): Promise<{ country_code: string; formatted_summary: string }> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/countries/${countryCode}/formatted-summary`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formatted_summary: formattedSummary }),
      }
    );

    if (!response.ok) {
      throw new Error(`更新翻译汇总失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '更新翻译汇总失败');
    }

    return result.data;
  } catch (error) {
    console.error('更新翻译汇总失败:', error);
    throw error;
  }
};

/**
 * 更新PDF文件路径
 * @param projectId 项目ID
 * @param countryCode 国别代码
 * @param pdfFilePath PDF文件路径
 */
export const updatePdfFilePath = async (
  projectId: number,
  countryCode: string,
  pdfFilePath: string
): Promise<{ country_code: string; pdf_file_path: string }> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/countries/${countryCode}/pdf`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pdf_file_path: pdfFilePath }),
      }
    );

    if (!response.ok) {
      throw new Error(`更新PDF文件路径失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '更新PDF文件路径失败');
    }

    return result.data;
  } catch (error) {
    console.error('更新PDF文件路径失败:', error);
    throw error;
  }
};

/**
 * 获取国别详细信息（包括汇总和PDF）
 * @param projectId 项目ID
 * @param countryCode 国别代码
 */
export const getCountryDetails = async (
  projectId: number,
  countryCode: string
): Promise<CountryTranslationGroup> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/projects/${projectId}/countries/${countryCode}/details`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`获取国别详情失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '获取国别详情失败');
    }

    return result.data;
  } catch (error) {
    console.error('获取国别详情失败:', error);
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
