/**
 * 字段类型关键词API
 * 用于获取和管理字段类型判断的关键词清单
 */

import { API_BASE_URL } from './apiConfig';

export interface FieldTypeKeyword {
  id: number
  keyword: string
  field_type: 'basic_info' | 'number_field' | 'drug_name' | 'number_of_sheets' | 'company_name'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface KeywordListResponse {
  success: boolean
  data: {
    all: FieldTypeKeyword[]
    grouped: {
      basic_info: FieldTypeKeyword[]
      number_field: FieldTypeKeyword[]
      drug_name: FieldTypeKeyword[]
      number_of_sheets: FieldTypeKeyword[]
      company_name: FieldTypeKeyword[]
    }
  }
}

/**
 * 获取所有关键词（按类型分组）
 * @param field_type 可选的字段类型筛选
 * @returns 关键词列表
 */
export async function getFieldTypeKeywords(field_type?: string): Promise<KeywordListResponse> {
  const url = field_type 
    ? `${API_BASE_URL}/api/field-type-keywords?field_type=${encodeURIComponent(field_type)}`
    : `${API_BASE_URL}/api/field-type-keywords`
    
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`获取关键词失败: ${response.status} ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * 获取格式化的关键词清单（用于字段分类）
 * @returns 按字段类型分组的关键词数组
 */
export async function getFormattedKeywordList(): Promise<{
  basic_info: string[]
  number_field: string[]
  drug_name: string[]
  number_of_sheets: string[]
  company_name: string[]
}> {
  try {
    const result = await getFieldTypeKeywords()
    
    if (!result.success) {
      throw new Error('获取关键词失败')
    }
    
    // 提取关键词文本，只包含激活的关键词
    const grouped = result.data.grouped
    
    return {
      basic_info: grouped.basic_info.filter(kw => kw.is_active).map(kw => kw.keyword),
      number_field: grouped.number_field.filter(kw => kw.is_active).map(kw => kw.keyword),
      drug_name: grouped.drug_name.filter(kw => kw.is_active).map(kw => kw.keyword),
      number_of_sheets: grouped.number_of_sheets.filter(kw => kw.is_active).map(kw => kw.keyword),
      company_name: grouped.company_name.filter(kw => kw.is_active).map(kw => kw.keyword)
    }
  } catch (error) {
    console.error('获取关键词清单失败:', error)
    
    // 返回空的关键词清单作为降级方案
    return {
      basic_info: [],
      number_field: [],
      drug_name: [],
      number_of_sheets: [],
      company_name: []
    }
  }
}

/**
 * 添加新关键词
 * @param keyword 关键词
 * @param field_type 字段类型
 * @param is_active 是否启用
 * @returns 创建结果
 */
export async function addFieldTypeKeyword(
  keyword: string, 
  field_type: string, 
  is_active: boolean = true
): Promise<{ success: boolean; data?: FieldTypeKeyword; message?: string }> {
  const response = await fetch('/api/field-type-keywords', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keyword,
      field_type,
      is_active
    })
  })
  
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.message || '添加关键词失败')
  }
  
  return result
}

/**
 * 更新关键词
 * @param id 关键词ID
 * @param updates 更新数据
 * @returns 更新结果
 */
export async function updateFieldTypeKeyword(
  id: number, 
  updates: Partial<Pick<FieldTypeKeyword, 'keyword' | 'field_type' | 'is_active'>>
): Promise<{ success: boolean; data?: FieldTypeKeyword; message?: string }> {
  const response = await fetch(`/api/field-type-keywords/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates)
  })
  
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.message || '更新关键词失败')
  }
  
  return result
}

/**
 * 删除关键词
 * @param id 关键词ID
 * @returns 删除结果
 */
export async function deleteFieldTypeKeyword(id: number): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`/api/field-type-keywords/${id}`, {
    method: 'DELETE'
  })
  
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.message || '删除关键词失败')
  }
  
  return result
}

/**
 * 批量导入关键词
 * @param keywords 关键词数组
 * @returns 导入结果
 */
export async function batchImportKeywords(
  keywords: Array<{ keyword: string; field_type: string }>
): Promise<{ success: boolean; data?: any; message?: string }> {
  const response = await fetch('/api/field-type-keywords/batch-import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ keywords })
  })
  
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.message || '批量导入关键词失败')
  }
  
  return result
}
