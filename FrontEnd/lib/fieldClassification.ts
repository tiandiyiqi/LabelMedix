/**
 * 字段类型自动分类功能
 * 根据字段属性判断规则，自动判断翻译条目的字段类型
 */

export type FieldType = 'basic_info' | 'number_field' | 'drug_description' | 'company_name' | 'drug_name' | 'number_of_sheets'

export interface KeywordList {
  basic_info: string[]
  number_field: string[]
  drug_name: string[]
  number_of_sheets: string[]
  company_name: string[]
}

/**
 * 智能关键词匹配函数
 * 支持大小写不敏感、部分匹配、去除特殊字符等
 * @param text 要检查的文本
 * @param keyword 关键词
 * @returns 是否匹配
 */
function smartKeywordMatch(text: string, keyword: string): boolean {
  if (!text || !keyword) return false
  
  // 转换为小写进行比较
  const lowerText = text.toLowerCase().trim()
  const lowerKeyword = keyword.toLowerCase().trim()
  
  // 1. 精确匹配（去除冒号）
  const textWithoutColon = lowerText.replace(/:+$/, '')
  const keywordWithoutColon = lowerKeyword.replace(/:+$/, '')
  
  if (textWithoutColon === keywordWithoutColon) {
    return true
  }
  
  // 2. 直接包含匹配
  if (lowerText.includes(lowerKeyword) || textWithoutColon.includes(keywordWithoutColon)) {
    return true
  }
  
  // 3. 去除常见分隔符后匹配（空格、括号、点、逗号、冒号、连字符等）
  const cleanText = lowerText.replace(/[\s\(\)\.\,\:\-\_\[\]]/g, '')
  const cleanKeyword = lowerKeyword.replace(/[\s\(\)\.\,\:\-\_\[\]]/g, '')
  
  if (cleanText.includes(cleanKeyword)) {
    return true
  }
  
  // 4. 单词边界匹配（避免部分单词匹配）
  try {
    const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const wordBoundaryRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'i')
    if (wordBoundaryRegex.test(text)) {
      return true
    }
    
    // 也尝试去除冒号的版本
    const escapedKeywordNoColon = keywordWithoutColon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const wordBoundaryRegexNoColon = new RegExp(`\\b${escapedKeywordNoColon}\\b`, 'i')
    if (wordBoundaryRegexNoColon.test(textWithoutColon)) {
      return true
    }
  } catch (error) {
    // 如果正则表达式有问题，跳过这个匹配方式
    console.warn('正则表达式匹配失败:', error)
  }
  
  // 5. 分词匹配（处理多单词关键词）
  const textWords = textWithoutColon.split(/[\s\-\_\.\,\(\)]+/).filter(w => w.length > 0)
  const keywordWords = keywordWithoutColon.split(/[\s\-\_\.\,\(\)]+/).filter(w => w.length > 0)
  
  // 检查关键词的所有单词是否都在文本中出现
  if (keywordWords.length > 1) {
    const allWordsMatch = keywordWords.every(kw => 
      textWords.some(tw => tw.includes(kw) || kw.includes(tw))
    )
    if (allWordsMatch) {
      return true
    }
  }
  
  return false
}

/**
 * 检查文本是否匹配关键词列表中的任一项
 * @param text 要检查的文本
 * @param keywords 关键词列表
 * @returns 是否匹配
 */
function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  for (const keyword of keywords) {
    if (smartKeywordMatch(text, keyword)) {
      console.log(`🎯 关键词匹配成功: "${text}" 包含 "${keyword}"`)
      return true
    }
  }
  return false
}

/**
 * 字段类型分类函数
 * @param originalText 原始文本
 * @param keywordList 关键词清单
 * @returns 字段类型
 */
export function classifyFieldType(originalText: string, keywordList: KeywordList): FieldType {
  if (!originalText || !originalText.trim()) {
    return 'drug_description'
  }

  const text = originalText.trim()
  console.log(`🔍 开始分类文本: "${text}"`)

  // 重新设计的分类逻辑：按优先级依次检查所有类型，不区分是否以冒号结尾
  
  const lowerText = text.toLowerCase()
  
  // 第一优先级：药品名判断
  // 满足以下任一条件，即判定为药品名：
  // 1. 条文以"BG"或"BGB"开头（大小写不敏感）
  // 2. 条文包含"药品名清单"中的任一值
  const isDrugName = lowerText.startsWith('bg') || 
                     lowerText.startsWith('bgb') || 
                     matchesAnyKeyword(text, keywordList.drug_name)
  
  if (isDrugName) {
    console.log(`📝 文本 "${text}" 分类为: drug_name`)
    return 'drug_name'
  }

  // 第二优先级：药品片数判断
  // 按以下优先级依次检查，满足任一条件即判定为药品片数：
  // 1. 条文包含"药品片数清单"中的任一值
  // 2. 条文包含"XX"或"XXX"
  // 3. 条文包含"tablets"（大小写不敏感）
  const isNumberOfSheets = matchesAnyKeyword(text, keywordList.number_of_sheets) ||
                          text.includes('XX') ||
                          text.includes('XXX') ||
                          lowerText.includes('tablets')
  
  if (isNumberOfSheets) {
    console.log(`📝 文本 "${text}" 分类为: number_of_sheets`)
    return 'number_of_sheets'
  }

  // 第三优先级：公司名判断
  // 将当前条文与"公司名清单"所有值比对（使用智能匹配）
  const isCompanyName = matchesAnyKeyword(text, keywordList.company_name)
  
  if (isCompanyName) {
    console.log(`📝 文本 "${text}" 分类为: company_name`)
    return 'company_name'
  }

  // 第四优先级：编号字段判断（针对以冒号结尾的文本）
  // 只有以冒号结尾的文本才可能是编号字段
  if (text.endsWith(':')) {
    const isNumberField = matchesAnyKeyword(text, keywordList.number_field)
    
    if (isNumberField) {
      console.log(`📝 文本 "${text}" 分类为: number_field (以:结尾且匹配编号清单)`)
      return 'number_field'
    }
    
    // 如果以冒号结尾但不匹配编号清单，则为基本信息
    console.log(`📝 文本 "${text}" 分类为: basic_info (以:结尾但不匹配其他类型)`)
    return 'basic_info'
  }

  // 第六步：剩余条文分类
  // 经过以上5步判断后，仍未被分类的条文：drug_description
  console.log(`📝 文本 "${text}" 分类为: drug_description (默认)`)
  return 'drug_description'
}

/**
 * 批量分类字段类型
 * @param originalTexts 原始文本数组
 * @param keywordList 关键词清单
 * @returns 字段类型数组
 */
export function classifyFieldTypes(originalTexts: string[], keywordList: KeywordList): FieldType[] {
  return originalTexts.map(text => classifyFieldType(text, keywordList))
}

/**
 * 获取字段类型的中文名称
 * @param fieldType 字段类型
 * @returns 中文名称
 */
export function getFieldTypeName(fieldType: FieldType): string {
  const typeNames: Record<FieldType, string> = {
    basic_info: '基本信息',
    number_field: '编号栏',
    drug_description: '药品说明',
    company_name: '公司名称',
    drug_name: '药品名称',
    number_of_sheets: '片数'
  }
  
  return typeNames[fieldType] || '未知类型'
}

/**
 * 统计字段类型分布
 * @param fieldTypes 字段类型数组
 * @returns 统计结果
 */
export function getFieldTypeStats(fieldTypes: FieldType[]): Record<FieldType, number> {
  const stats: Record<FieldType, number> = {
    basic_info: 0,
    number_field: 0,
    drug_description: 0,
    company_name: 0,
    drug_name: 0,
    number_of_sheets: 0
  }
  
  fieldTypes.forEach(type => {
    stats[type]++
  })
  
  return stats
}
