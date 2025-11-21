import { API_BASE_URL } from './apiConfig';

// 项目信息接口
export interface ProjectInfo {
  id: number;
  job_name: string;
  job_description?: string;
  status: string;
  total_files: number;
  user_id: number;
  label_width: number;
  label_height: number;
  label_category: string;
  is_wrapped: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LabelSettings {
  id?: number;
  project_id: number;
  country_code?: string;
  sequence_number?: number;
  // 标签基本设置
  label_width: number;
  label_height: number;
  label_category: string;
  is_wrapped: boolean;
  current_width: number;
  // 页面区域设置
  base_sheet: number;
  adhesive_area: number;
  waste_area: number;
  coding_area: number;
  // 字体设置
  font_family: string;
  secondary_font_family: string;
  font_size: number;
  text_align: string;
  spacing: number;
  line_height: number;
  // 序号设置
  show_sequence_number: boolean;
  custom_sequence_text?: string;
  sequence_position: string;
  sequence_font_size: number;
  sequence_offset_x: number;
  sequence_offset_y: number;
  sequence_rotation: number;
  // 时间戳
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 获取项目级别的标签配置
export async function getProjectLabelConfig(projectId: number): Promise<{
  label_width: number;
  label_height: number;
  label_category: string;
  is_wrapped: boolean;
}> {
  try {
    // 获取项目信息，其中包含项目级别的标签配置
    const projectInfo = await getProjectInfo(projectId);
    
    return {
      label_width: projectInfo.label_width || 100.0,
      label_height: projectInfo.label_height || 60.0,
      label_category: projectInfo.label_category || "阶梯标",
      is_wrapped: projectInfo.is_wrapped || false,
    };
  } catch (error) {
    console.error('获取项目级别标签配置失败:', error);
    throw error;
  }
}

// 获取项目信息
export async function getProjectInfo(projectId: number): Promise<ProjectInfo> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`);
    const result: ApiResponse<ProjectInfo> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '获取项目信息失败');
    }
    
    return result.data!;
  } catch (error) {
    console.error('获取项目信息失败:', error);
    throw error;
  }
}

// 获取标签设置（支持项目级别配置优先）
export async function getLabelSettings(
  projectId: number, 
  countryCode?: string, 
  sequenceNumber?: number
): Promise<LabelSettings> {
  try {
    let url = `${API_BASE_URL}/api/label-settings/project/${projectId}`;
    if (countryCode && sequenceNumber) {
      url += `/${countryCode}/${sequenceNumber}`;
    }
    
    const response = await fetch(url);
    const result: ApiResponse<LabelSettings> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '获取标签设置失败');
    }
    
    // 后端已经处理了项目级别配置的优先级，直接返回结果
    return result.data!;
  } catch (error) {
    console.error('获取标签设置失败:', error);
    throw error;
  }
}

// 保存标签设置
export async function saveLabelSettings(
  projectId: number,
  settings: Partial<LabelSettings>,
  countryCode?: string,
  sequenceNumber?: number
): Promise<LabelSettings> {
  try {
    let url = `${API_BASE_URL}/api/label-settings/project/${projectId}`;
    if (countryCode && sequenceNumber) {
      url += `/${countryCode}/${sequenceNumber}`;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    
    const result: ApiResponse<LabelSettings> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '保存标签设置失败');
    }
    
    return result.data!;
  } catch (error) {
    console.error('保存标签设置失败:', error);
    throw error;
  }
}

// 获取项目的所有标签设置
export async function getProjectLabelSettings(projectId: number): Promise<LabelSettings[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/label-settings/project/${projectId}`);
    const result: ApiResponse<LabelSettings[]> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '获取项目标签设置失败');
    }
    
    return result.data || [];
  } catch (error) {
    console.error('获取项目标签设置失败:', error);
    throw error;
  }
}

// 删除标签设置
export async function deleteLabelSettings(
  projectId: number,
  countryCode?: string,
  sequenceNumber?: number
): Promise<void> {
  try {
    let url = `${API_BASE_URL}/api/label-settings/project/${projectId}`;
    if (countryCode && sequenceNumber) {
      url += `/${countryCode}/${sequenceNumber}`;
    }
    
    const response = await fetch(url, {
      method: 'DELETE',
    });
    
    const result: ApiResponse<void> = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '删除标签设置失败');
    }
  } catch (error) {
    console.error('删除标签设置失败:', error);
    throw error;
  }
}

// 将前端LabelData转换为后端LabelSettings格式
export function convertLabelDataToSettings(labelData: any): Partial<LabelSettings> {
  return {
    label_width: labelData.labelWidth,
    label_height: labelData.labelHeight,
    label_category: labelData.labelCategory,
    is_wrapped: labelData.isWrapped,
    current_width: labelData.currentWidth,
    base_sheet: labelData.baseSheet,
    adhesive_area: labelData.adhesiveArea,
    waste_area: labelData.wasteArea,
    coding_area: labelData.codingArea,
    font_family: labelData.fontFamily,
    secondary_font_family: labelData.secondaryFontFamily,
    font_size: labelData.fontSize,
    text_align: labelData.textAlign,
    spacing: labelData.spacing,
    line_height: labelData.lineHeight,
    show_sequence_number: labelData.showSequenceNumber,
    custom_sequence_text: labelData.customSequenceText,
    sequence_position: labelData.sequencePosition,
    sequence_font_size: labelData.sequenceFontSize,
    sequence_offset_x: labelData.sequenceOffsetX,
    sequence_offset_y: labelData.sequenceOffsetY,
    sequence_rotation: labelData.sequenceRotation,
  };
}

// 将后端LabelSettings转换为前端LabelData格式
export function convertSettingsToLabelData(settings: LabelSettings): any {
  // Sequelize的DECIMAL类型返回字符串，需要显式转换为数字
  // 使用parseFloat确保字符串格式的数字被正确转换
  // 
  // 🔧 重要：不从 LabelSettings 中读取 fontFamily 和 secondaryFontFamily
  // 字体应该由 CountryTranslationGroup 表和自动字体选择逻辑控制
  return {
    labelWidth: parseFloat(String(settings.label_width)) || 100,
    labelHeight: parseFloat(String(settings.label_height)) || 60,
    labelCategory: settings.label_category || '阶梯标',
    isWrapped: Boolean(settings.is_wrapped),
    currentWidth: parseFloat(String(settings.current_width)) || 120,
    baseSheet: parseInt(String(settings.base_sheet)) || 0,
    adhesiveArea: parseInt(String(settings.adhesive_area)) || 0,
    wasteArea: parseInt(String(settings.waste_area)) || 0,
    codingArea: parseInt(String(settings.coding_area)) || 0,
    // fontFamily: 不再从这里读取，避免覆盖正确的字体选择
    // secondaryFontFamily: 不再从这里读取，避免覆盖正确的字体选择
    fontSize: parseFloat(String(settings.font_size)) || 10,
    textAlign: settings.text_align || 'left',
    spacing: parseFloat(String(settings.spacing)) || 1,
    lineHeight: parseFloat(String(settings.line_height)) || 1.2,
    showSequenceNumber: Boolean(settings.show_sequence_number),
    customSequenceText: settings.custom_sequence_text || '',
    sequencePosition: settings.sequence_position || '',
    sequenceFontSize: parseFloat(String(settings.sequence_font_size)) || 9,
    sequenceOffsetX: parseFloat(String(settings.sequence_offset_x)) || 0,
    sequenceOffsetY: parseFloat(String(settings.sequence_offset_y)) || 0,
    sequenceRotation: parseFloat(String(settings.sequence_rotation)) || 0,
  };
}
