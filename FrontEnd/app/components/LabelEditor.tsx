"use client"

import { useContext, useState, useEffect } from "react"
import { ChevronDown, Edit3, Download, Sparkles, RotateCcw, Save, Type, Languages, Maximize2, Space, AlignJustify, BookmarkPlus, BookmarkCheck, Zap, Settings, AlignLeft, AlignRight, RefreshCw } from "lucide-react"
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { calculatePageWidth, calculatePageMargins } from '../utils/calculatePageWidth'
import { getProjectById, getCountryDetails, getTranslationsByCountry, updateFormattedSummary, savePdfFile } from '@/lib/projectApi'
import { getLabelSettings, saveLabelSettings, convertSettingsToLabelData, convertLabelDataToSettings } from '@/lib/labelSettingsApi'
import { pdf } from '@react-pdf/renderer'

export default function LabelEditor() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const { labelData, updateLabelData, setSelectedProject } = useLabelContext()
  const { selectedLanguage, selectedNumber, drugInfo, fontFamily, fontSize, spacing, lineHeight, labelWidth, labelHeight, selectedProject, basicInfo, numberField, drugName, numberOfSheets, drugDescription, companyName } = labelData

  const [selectedNumberState, setSelectedNumberState] = useState<number>(Number(selectedNumber))
  
  // 字体默认值管理
  const FONT_DEFAULTS_KEY = 'labelmedix_font_defaults'
  const PROJECT_FONT_SYNC_KEY = 'labelmedix_project_font_sync'
  const PROJECT_APPLIED_KEY = 'labelmedix_project_applied' // 记录已应用的语言
  
  // 保存字体参数为默认值
  const saveFontDefaults = () => {
    const defaults = {
      fontFamily: labelData.fontFamily,
      secondaryFontFamily: labelData.secondaryFontFamily,
      fontSize: labelData.fontSize,
      spacing: labelData.spacing,
      lineHeight: labelData.lineHeight
    }
    localStorage.setItem(FONT_DEFAULTS_KEY, JSON.stringify(defaults))
    showToast('字体默认值已保存', 'success')
  }
  
  // 应用字体默认值
  const applyFontDefaults = () => {
    const savedDefaults = localStorage.getItem(FONT_DEFAULTS_KEY)
    if (savedDefaults) {
      try {
        const defaults = JSON.parse(savedDefaults)
        updateLabelData({
          fontFamily: defaults.fontFamily,
          secondaryFontFamily: defaults.secondaryFontFamily,
          fontSize: defaults.fontSize,
          spacing: defaults.spacing,
          lineHeight: defaults.lineHeight
        })
        showToast('已应用字体默认值', 'success')
      } catch (error) {
        showToast('默认值格式错误', 'error')
      }
    } else {
      showToast('未找到保存的默认值', 'error')
    }
  }

  // 设置并应用：将当前字体设置应用到整个工单的所有语言
  const setAndApplyFontSettings = () => {
    if (!selectedProject?.id) {
      showToast('请先选择一个工单', 'error')
      return
    }

    // 只同步字体大小、间距、行高，不包括字体类型
    const currentSettings = {
      fontSize: labelData.fontSize,
      spacing: labelData.spacing,
      lineHeight: labelData.lineHeight,
      sequenceFontSize: labelData.fontSize // 序号字符大小根据主字体大小同步
    }

    // 保存到项目级别的同步设置中
    const projectKey = `${PROJECT_FONT_SYNC_KEY}_${selectedProject.id}`
    localStorage.setItem(projectKey, JSON.stringify(currentSettings))
    
    // 清除所有语言的已应用标记，让新设置能够应用到所有语言
    const appliedKeyPrefix = `${PROJECT_APPLIED_KEY}_${selectedProject.id}_`
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(appliedKeyPrefix)) {
        localStorage.removeItem(key)
      }
    })
    
    // 立即更新当前语言的序号字体大小
    updateLabelData({
      sequenceFontSize: labelData.fontSize
    })
    
    showToast('字体大小、间距、行高已应用到当前工单的所有语言', 'success')
  }
  const [isImporting, setIsImporting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isFormatting, setIsFormatting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [formatStates, setFormatStates] = useState<{[key: string]: number}>({
    basicInfo: 0,
    numberField: 0,
    drugName: 0,
    numberOfSheets: 0,
    drugDescription: 0,
    companyName: 0
  })
  // 轻量提示（非阻断式）
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>(
    { visible: false, message: '', type: 'info' }
  )
  const [availableSequences, setAvailableSequences] = useState<number[]>([])
  const [availableCountries, setAvailableCountries] = useState<string[]>([])
  const [dataLoadCompleted, setDataLoadCompleted] = useState<boolean>(false)
  

  // 显示自动消失的提示
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 2000) => {
    setToast({ visible: true, message, type })
    window.setTimeout(() => setToast({ visible: false, message: '', type }), duration)
  }

  // 创建原始状态JSON
  const createOriginalSummary = () => {
    return JSON.stringify({
      basicInfo: basicInfo || '',
      numberField: numberField || '',
      drugName: drugName || '',
      numberOfSheets: numberOfSheets || '',
      drugDescription: drugDescription || '',
      companyName: companyName || ''
    })
  }

  // 解析原始状态JSON
  const parseOriginalSummary = (originalSummary: string | undefined): any => {
    if (!originalSummary) return null
    
    try {
      return JSON.parse(originalSummary)
    } catch (error) {
      // console.warn('解析原始状态失败，可能是旧格式数据:', error)
      return null
    }
  }

  // 解析格式化状态JSON
  const parseFormattedSummary = (formattedSummary: string | undefined) => {
    if (!formattedSummary) return null
    
    try {
      return JSON.parse(formattedSummary)
    } catch (error) {
      // console.warn('解析格式化状态失败，可能是旧格式数据:', error)
      return null
    }
  }

  // 单位转换常量
  const MM_TO_PT = 2.83465;
  const mmToPt = (mm: number) => mm * MM_TO_PT;

  // 字符宽度映射表类型
  interface CharWidthMap {
    chinese: number;
    [key: string]: number;
  }

  // 字符宽度映射表（相对于字体大小的比例）
  const charWidthMap: CharWidthMap = {
    // 中文字符
    chinese: 1.0,  // 中文字符固定为字体大小
    
    // 大写英文字母
    'A': 0.722, 'B': 0.667, 'C': 0.722, 'D': 0.722, 'E': 0.611,
    'F': 0.556, 'G': 0.722, 'H': 0.722, 'I': 0.278, 'J': 0.5,
    'K': 0.667, 'L': 0.556, 'M': 0.833, 'N': 0.722, 'O': 0.778,
    'P': 0.667, 'Q': 0.778, 'R': 0.722, 'S': 0.667, 'T': 0.611,
    'U': 0.722, 'V': 0.667, 'W': 0.944, 'X': 0.667, 'Y': 0.667,
    'Z': 0.611,
    
    // 小写英文字母
    'a': 0.556, 'b': 0.556, 'c': 0.5, 'd': 0.556, 'e': 0.556,
    'f': 0.278, 'g': 0.556, 'h': 0.556, 'i': 0.222, 'j': 0.222,
    'k': 0.5, 'l': 0.222, 'm': 0.833, 'n': 0.556, 'o': 0.556,
    'p': 0.556, 'q': 0.556, 'r': 0.333, 's': 0.5, 't': 0.278,
    'u': 0.556, 'v': 0.5, 'w': 0.722, 'x': 0.5, 'y': 0.5,
    'z': 0.5,
    
    // 数字
    '0': 0.556, '1': 0.556, '2': 0.556, '3': 0.556, '4': 0.556,
    '5': 0.556, '6': 0.556, '7': 0.556, '8': 0.556, '9': 0.556,
    
    // 标点符号
    '.': 0.527, ',': 0.25, ':': 0.277, ';': 0.277, '!': 0.333,
    '?': 0.556, '"': 0.556, "'": 0.222, '`': 0.222, '(': 0.333,
    ')': 0.333, '[': 0.333, ']': 0.333, '{': 0.333, '}': 0.333,
    '/': 0.278, '\\': 0.278, '|': 0.222, '-': 0.333, '_': 0.556,
    '+': 0.584, '=': 0.584, '*': 0.389, '&': 0.722, '#': 0.556,
    '%': 0.889, '$': 0.556, '@': 1.015,
    
    // 中文标点符号（全角字符，宽度等于中文字符）
    '\uff1a': 1.0, '\uff1b': 1.0, '\uff0c': 1.0, '\u3002': 1.0, '\uff1f': 1.0, '\uff01': 1.0,
    '\u201c': 1.0, '\u201d': 1.0, '\u2018': 1.0, '\u2019': 1.0, '\uff08': 1.0, '\uff09': 1.0,
    '\u3010': 1.0, '\u3011': 1.0, '\u300a': 1.0, '\u300b': 1.0, '\u3008': 1.0, '\u3009': 1.0,
    
    // 空格
    ' ': 0.25,
    
    // 其他特殊字符
    '·': 0.333, '—': 1.0, '…': 1.0, '™': 1.0, '©': 1.0, '®': 1.0,
    '°': 0.4, '′': 0.333, '″': 0.556, '§': 0.556, '¶': 0.556,
    '†': 0.556, '‡': 0.556, '•': 0.35
  };

  // 文本宽度测量函数
  const measureTextWidth = (text: string, fontSize: number, fontFamily: string): number => {
    // 检查是否在客户端环境
    if (typeof window === 'undefined') {
      // 服务器端渲染时返回一个估算值
      return text.length * fontSize;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      // 设置字体
      context.font = `${fontSize}pt ${fontFamily}`;
      
      // 将文本分成字符
      const chars = Array.from(text);
      let totalWidth = 0;
      
      chars.forEach(char => {
        let charWidth = 0;
        
        if (/[\u4E00-\u9FA5]/.test(char)) {
          // 中文字符
          charWidth = fontSize * charWidthMap.chinese;
        } else if (char in charWidthMap) {
          // 使用映射表中的宽度
          charWidth = fontSize * charWidthMap[char];
        } else {
          // 未知字符使用canvas测量
          charWidth = context.measureText(char).width;
          // 缓存测量结果
          charWidthMap[char] = charWidth / fontSize;
        }
        
        totalWidth += charWidth;
      });
      
      return totalWidth;
    }
    return 0;
  };

  // 间距计算函数
  const calculateSpacing = (containerWidth: number, elements: string[], fontSize: number, fontFamily: string): number => {
    // 安全检查：确保输入参数有效
    if (!elements || elements.length === 0 || containerWidth <= 0 || fontSize <= 0) {
      return 0; // 返回0间距
    }

    // 如果只有一个元素，不需要内部间距
    if (elements.length === 1) {
      return 0;
    }

    // 1. 计算所有元素的总宽度
    const elementsWidth = elements.map(text => {
      const width = measureTextWidth(text, fontSize, fontFamily);
      return { text, width };
    });

    const totalContentWidth = elementsWidth.reduce((sum, item) => sum + item.width, 0);
    
    // 2. 从容器宽度中减去总宽度得到可用空间
    const availableSpace = containerWidth - totalContentWidth;
    
    // 3. 计算需要分配间距的"缝隙"数量（N个元素有N-1个缝隙）
    const numberOfGaps = elements.length - 1;

    if (numberOfGaps <= 0) {
      return 0;
    }

    // 4. 将可用空间除以缝隙数量得到每个缝隙的间距
    const calculatedSpacing = availableSpace / numberOfGaps;
    
    // 5. 添加最小间距保护（但允许0间距）
    const minSpacing = mmToPt(1); // 降低最小间距到1mm
    const spacing = Math.max(calculatedSpacing, minSpacing);
    
    // 确保返回值是有限数且非负
    return isFinite(spacing) && spacing >= 0 ? spacing : 0;
  };

  // 安全的字符串重复函数
  const safeRepeat = (str: string, count: number): string => {
    // 确保count是有限的非负整数
    const safeCount = Math.max(0, Math.min(Math.floor(count), 20));
    return str.repeat(safeCount);
  };

  // 将间距转换为空格数量
  const spacingToSpaces = (spacing: number, fontSize: number, fontFamily: string): number => {
    // 如果不需要间距，直接返回0个空格
    if (spacing <= 0) {
      return 0;
    }

    // 使用更保守的空格宽度估算
    // 根据实际测试调整空格宽度系数
    let spaceWidthRatio = 0.35; // 增加默认空格宽度比例
    
    if (fontFamily.includes('STHeiti') || fontFamily.includes('Chinese')) {
      spaceWidthRatio = 0.4; // 中文字体的空格更宽
    } else if (fontFamily.includes('Arial')) {
      spaceWidthRatio = 0.38; // Arial字体的空格宽度
    }
    
    const conservativeSpaceWidth = fontSize * spaceWidthRatio;
    
    // 安全检查：避免除零和无效值
    if (conservativeSpaceWidth <= 0 || !isFinite(spacing)) {
      return 0; // 返回0个空格作为回退
    }
    
    // 使用更保守的计算，向下取整以避免溢出
    const spaces = Math.floor(spacing / conservativeSpaceWidth);
    
  // 限制空格数量在合理范围内（允许0个空格）
  return Math.max(0, Math.min(spaces, 15)); // 最少0个空格，最多15个空格
};

// 将间距转换为下划线数量（每个句子后面的下划线数量）
const spacingToUnderscores = (spacing: number, fontSize: number, fontFamily: string, sentenceCount: number): number => {
  // 如果不需要间距或没有句子，直接返回0个下划线
  if (spacing <= 0 || sentenceCount <= 0) {
    return 0;
  }

  // 下划线的宽度约等于正常字符宽度的0.5倍
  let underscoreWidthRatio = 0.5; // 基础下划线宽度比例
  
  if (fontFamily.includes('STHeiti') || fontFamily.includes('Chinese')) {
    underscoreWidthRatio = 0.5; // 中文字体的下划线宽度
  } else if (fontFamily.includes('Arial')) {
    underscoreWidthRatio = 0.5; // Arial字体的下划线宽度
  }
  
  const underscoreWidth = fontSize * underscoreWidthRatio;
  
  // 安全检查：避免除零和无效值
  if (underscoreWidth <= 0 || !isFinite(spacing)) {
    return 0; // 返回0个下划线作为回退
  }
  
  // 计算整行的总下划线数量
  const totalUnderscores = Math.floor(spacing / underscoreWidth);
  
  // 将总下划线数量平均分配给每个句子
  const underscoresPerSentence = Math.floor(totalUnderscores / sentenceCount);
  
  // 限制每个句子的下划线数量在合理范围内（允许0个下划线）
  return Math.max(0, Math.min(underscoresPerSentence, 20)); // 最少0个下划线，最多20个下划线
};


  // 罗马数字序号映射
  const getRomanNumber = (num: number): string => {
    const romanNumerals = [
      { value: 1000, symbol: 'M' },
      { value: 900, symbol: 'CM' },
      { value: 500, symbol: 'D' },
      { value: 400, symbol: 'CD' },
      { value: 100, symbol: 'C' },
      { value: 90, symbol: 'XC' },
      { value: 50, symbol: 'L' },
      { value: 40, symbol: 'XL' },
      { value: 10, symbol: 'X' },
      { value: 9, symbol: 'IX' },
      { value: 5, symbol: 'V' },
      { value: 4, symbol: 'IV' },
      { value: 1, symbol: 'I' }
    ]
    
    let result = ''
    let remaining = num
    
    for (let i = 0; i < romanNumerals.length; i++) {
      while (remaining >= romanNumerals[i].value) {
        result += romanNumerals[i].symbol
        remaining -= romanNumerals[i].value
      }
    }
    
    return result
  }

  // 变量控制函数
  const applyVariableControl = (text: string, fieldType: 'basicInfo' | 'drugName' | 'numberOfSheets', startIndex: number = 1): { processedText: string, nextIndex: number } => {
    if (!text || text.trim() === '') {
      return { processedText: text, nextIndex: startIndex }
    }

    let processedText = text
    let currentIndex = startIndex

    if (fieldType === 'basicInfo') {
      // 对basicInfo的每一行行首添加罗马数字序号
      const lines = text.split('\n').filter(line => line.trim() !== '')
      const processedLines = lines.map(line => {
        const romanNumber = getRomanNumber(currentIndex)
        currentIndex++
        return `${romanNumber}. ${line.trim()}`
      })
      processedText = processedLines.join('\n')
    } else if (fieldType === 'drugName' || fieldType === 'numberOfSheets') {
      // 替换文本中的"XX"或"XXX"为罗马数字序号
      processedText = text.replace(/XXX?/g, () => {
        const romanNumber = getRomanNumber(currentIndex)
        currentIndex++
        return romanNumber
      })
    }

    return { processedText, nextIndex: currentIndex }
  }

  // 计算当前罗马数字序号的起始位置
  const calculateRomanStartIndex = (fieldType: 'basicInfo' | 'drugName' | 'numberOfSheets'): number => {
    let startIndex = 1

    // 获取原始数据以计算行数/占位符
    const originalData = parseOriginalSummary(labelData.originalSummary)
    if (!originalData) {
      // 如果没有原始数据（例如未初始化），则从1开始
      return 1
    }

    // 如果是drugName或numberOfSheets，需要计算basicInfo使用了多少个序号
    if (fieldType === 'drugName' || fieldType === 'numberOfSheets') {
      const basicInfoOriginalText = originalData.basicInfo || ''
      const basicInfoLines = basicInfoOriginalText.split('\n').filter((line: string) => line.trim() !== '')
      startIndex += basicInfoLines.length
    }

    // 如果是numberOfSheets，还需要计算drugName使用了多少个序号
    if (fieldType === 'numberOfSheets') {
      const drugNameOriginalText = originalData.drugName || ''
      const drugNameXXCount = (drugNameOriginalText).match(/XXX?/g)?.length || 0
      startIndex += drugNameXXCount
    }

    return startIndex
  }

  // 初始化 - 保存当前状态为原始状态到数据库
  const handleInitialize = async () => {
    if (!selectedProject || !selectedLanguage) { 
      showToast('请先选择项目和国别', 'info')
      return 
    }

    try {
      setIsInitializing(true)
      
      // 检查是否有内容
      const hasContent = [basicInfo, numberField, drugName, numberOfSheets, drugDescription, companyName]
        .some(content => content && content.trim() !== '')
      
      if (!hasContent) {
        showToast('当前内容为空，无法初始化', 'info')
        return
      }
      
      // 创建包含6个字段的JSON格式原始状态
      const originalSummaryJson = createOriginalSummary()
      
      // 保存原始状态到数据库
      await updateFormattedSummary(
        selectedProject.id,
        selectedLanguage,
        undefined, // 不更新formatted_summary
        undefined, // 不更新字体设置
        originalSummaryJson // 保存JSON格式的原始状态
      )
      
      // 立即更新本地状态，确保格式化功能可以访问到原始状态
      updateLabelData({
        originalSummary: originalSummaryJson
      })
      
      showToast('6个字段的原始状态已初始化保存', 'success')
      
    } catch (error) {
      // console.error('初始化失败:', error)
      showToast('初始化失败，请重试', 'error')
    } finally {
      setIsInitializing(false)
    }
  }

  // 基于原始状态的格式化功能 - 基本信息
  const handleFormatBasicInfo = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(labelData.originalSummary)
    
    if (!originalData) {
      showToast('未找到原始状态，请先点击初始化', 'info')
      return
    }

    // 获取对应字段的原始内容
    const originalText = originalData.basicInfo
    if (!originalText || !originalText.trim()) {
      showToast('基本信息字段的原始状态为空', 'info')
      return
    }

    // 应用变量控制（在分行之前）
    const startIndex = calculateRomanStartIndex('basicInfo')
    const { processedText: variableControlledText } = applyVariableControl(originalText, 'basicInfo', startIndex)

    // 将处理后的文本按行分割为数组
    const sentences = variableControlledText.split('\n').filter((line: string) => line.trim() !== '')
    const sentenceCount = sentences.length

    if (sentenceCount === 0) {
      showToast('基本信息字段的原始状态为空', 'info')
      return
    }

    // 获取当前格式化状态并计算下一个状态
    const currentFormatState = formatStates.basicInfo || 0
    const nextFormatState = (currentFormatState + 1) % 3

    let formattedText = ''
    let toastMessage = ''

    // 计算容器宽度（使用基础标签宽度，减去边距）
    const baseWidth = labelData.labelWidth // 使用基础宽度，不是计算后的currentWidth
    const margins = calculatePageMargins(Number(labelData.selectedNumber))
    const effectiveWidth = baseWidth - margins.left - margins.right // 减去左右边距
    const safetyMargin = 2 // 预留2mm的安全边距
    const containerWidth = mmToPt(Math.max(effectiveWidth - safetyMargin, effectiveWidth * 0.95)) // 使用95%的有效宽度

    if (nextFormatState === 1) {
      // 分为两行
      const sentencesPerLine = Math.ceil(sentenceCount / 2)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine)
      
      // 计算第一行的间距
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineSpaces = spacingToSpaces(firstLineSpacing, labelData.fontSize, labelData.fontFamily)
      
      // 计算第二行的间距
      const secondLineSpacing = calculateSpacing(containerWidth, secondLineSentences, labelData.fontSize, labelData.fontFamily)
      const secondLineSpaces = spacingToSpaces(secondLineSpacing, labelData.fontSize, labelData.fontFamily)
      
      
      // 添加计算出的空格
      const firstLine = firstLineSentences.join(safeRepeat(' ', firstLineSpaces))
      const secondLine = secondLineSentences.join(safeRepeat(' ', secondLineSpaces))
      
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `基本信息分为两行（已添加罗马数字序号和间距：${firstLineSpaces}/${secondLineSpaces}空格）`
    } else if (nextFormatState === 2) {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2)
      
      // 计算各行的间距
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineSpaces = spacingToSpaces(firstLineSpacing, labelData.fontSize, labelData.fontFamily)
      
      const secondLineSpacing = calculateSpacing(containerWidth, secondLineSentences, labelData.fontSize, labelData.fontFamily)
      const secondLineSpaces = spacingToSpaces(secondLineSpacing, labelData.fontSize, labelData.fontFamily)
      
      const thirdLineSpacing = calculateSpacing(containerWidth, thirdLineSentences, labelData.fontSize, labelData.fontFamily)
      const thirdLineSpaces = spacingToSpaces(thirdLineSpacing, labelData.fontSize, labelData.fontFamily)
      
      // 添加计算出的空格
      const firstLine = firstLineSentences.join(safeRepeat(' ', firstLineSpaces))
      const secondLine = secondLineSentences.join(safeRepeat(' ', secondLineSpaces))
      const thirdLine = thirdLineSentences.join(safeRepeat(' ', thirdLineSpaces))
      
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `基本信息分为三行（已添加罗马数字序号和间距：${firstLineSpaces}/${secondLineSpaces}/${thirdLineSpaces}空格）`
    } else {
      // 分为一行
      // 计算整行的间距
      const lineSpacing = calculateSpacing(containerWidth, sentences, labelData.fontSize, labelData.fontFamily)
      const lineSpaces = spacingToSpaces(lineSpacing, labelData.fontSize, labelData.fontFamily)
      
      
      // 添加计算出的空格
      formattedText = sentences.join(safeRepeat(' ', lineSpaces))
      toastMessage = `基本信息分为一行（已添加罗马数字序号和间距：${lineSpaces}空格）`
    }

    // 更新对应字段的内容
    updateLabelData({ basicInfo: formattedText })
    
    // 更新格式化状态
    setFormatStates(prev => ({
      ...prev,
      basicInfo: nextFormatState
    }))

    showToast(toastMessage, 'success')
  }

  // 基于原始状态的格式化功能 - 编号栏
  const handleFormatNumberField = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(labelData.originalSummary)
    
    if (!originalData) {
      showToast('未找到原始状态，请先点击初始化', 'info')
      return
    }

    // 获取对应字段的原始内容
    const originalText = originalData.numberField
    if (!originalText || !originalText.trim()) {
      showToast('编号栏字段的原始状态为空', 'info')
      return
    }

    // 将原始状态按行分割为数组
    const sentences = originalText.split('\n').filter((line: string) => line.trim() !== '')
    const sentenceCount = sentences.length

    if (sentenceCount === 0) {
      showToast('编号栏字段的原始状态为空', 'info')
      return
    }

    // 获取当前格式化状态并计算下一个状态
    const currentFormatState = formatStates.numberField || 0
    const nextFormatState = (currentFormatState + 1) % 3

    let formattedText = ''
    let toastMessage = ''

    // 计算容器宽度（使用基础标签宽度，减去边距）
    const baseWidth = labelData.labelWidth // 使用基础宽度，不是计算后的currentWidth
    const margins = calculatePageMargins(Number(labelData.selectedNumber))
    const effectiveWidth = baseWidth - margins.left - margins.right // 减去左右边距
    const safetyMargin = 2 // 预留2mm的安全边距
    const containerWidth = mmToPt(Math.max(effectiveWidth - safetyMargin, effectiveWidth * 0.95)) // 使用95%的有效宽度

    if (nextFormatState === 1) {
      // 分为两行
      const sentencesPerLine = Math.ceil(sentenceCount / 2)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine)
      
      // 计算第一行的间距和下划线数量
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineUnderscores = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      
      // 计算第二行的间距和下划线数量
      const secondLineSpacing = calculateSpacing(containerWidth, secondLineSentences, labelData.fontSize, labelData.fontFamily)
      const secondLineUnderscores = spacingToUnderscores(secondLineSpacing, labelData.fontSize, labelData.fontFamily, secondLineSentences.length)
      
      // 为每个元素后面添加下划线
      const firstLine = firstLineSentences.map((text: string) => text + safeRepeat('_', firstLineUnderscores)).join('')
      const secondLine = secondLineSentences.map((text: string) => text + safeRepeat('_', secondLineUnderscores)).join('')
      
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `编号栏分为两行（每个字段后添加${firstLineUnderscores}/${secondLineUnderscores}下划线）`
    } else if (nextFormatState === 2) {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2)
      
      // 计算各行的间距和下划线数量
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineUnderscores = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      
      const secondLineSpacing = calculateSpacing(containerWidth, secondLineSentences, labelData.fontSize, labelData.fontFamily)
      const secondLineUnderscores = spacingToUnderscores(secondLineSpacing, labelData.fontSize, labelData.fontFamily, secondLineSentences.length)
      
      const thirdLineSpacing = calculateSpacing(containerWidth, thirdLineSentences, labelData.fontSize, labelData.fontFamily)
      const thirdLineUnderscores = spacingToUnderscores(thirdLineSpacing, labelData.fontSize, labelData.fontFamily, thirdLineSentences.length)
      
      // 为每个元素后面添加下划线
      const firstLine = firstLineSentences.map((text: string) => text + safeRepeat('_', firstLineUnderscores)).join('')
      const secondLine = secondLineSentences.map((text: string) => text + safeRepeat('_', secondLineUnderscores)).join('')
      const thirdLine = thirdLineSentences.map((text: string) => text + safeRepeat('_', thirdLineUnderscores)).join('')
      
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `编号栏分为三行（每个字段后添加${firstLineUnderscores}/${secondLineUnderscores}/${thirdLineUnderscores}下划线）`
    } else {
      // 分为一行
      const lineSpacing = calculateSpacing(containerWidth, sentences, labelData.fontSize, labelData.fontFamily)
      const lineUnderscores = spacingToUnderscores(lineSpacing, labelData.fontSize, labelData.fontFamily, sentences.length)
      
      // 为每个元素后面添加下划线
      formattedText = sentences.map((text: string) => text + safeRepeat('_', lineUnderscores)).join('')
      toastMessage = `编号栏分为一行（每个字段后添加${lineUnderscores}下划线）`
    }

    // 更新对应字段的内容
    updateLabelData({ numberField: formattedText })
    
    // 更新格式化状态
    setFormatStates(prev => ({
      ...prev,
      numberField: nextFormatState
    }))

    showToast(toastMessage, 'success')
  }

  // 基于原始状态的格式化功能 - 药品名称
  const handleFormatDrugName = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(labelData.originalSummary)
    
    if (!originalData) {
      showToast('未找到原始状态，请先点击初始化', 'info')
      return
    }

    // 获取对应字段的原始内容
    const originalText = originalData.drugName
    if (!originalText || !originalText.trim()) {
      showToast('药品名称字段的原始状态为空', 'info')
      return
    }

    // 应用变量控制（在分行之前）
    const startIndex = calculateRomanStartIndex('drugName')
    const { processedText: variableControlledText } = applyVariableControl(originalText, 'drugName', startIndex)

    // 将处理后的文本按行分割为数组
    const sentences = variableControlledText.split('\n').filter((line: string) => line.trim() !== '')
    const sentenceCount = sentences.length

    if (sentenceCount === 0) {
      showToast('药品名称字段的原始状态为空', 'info')
      return
    }

    // 获取当前格式化状态并计算下一个状态
    const currentFormatState = formatStates.drugName || 0
    const nextFormatState = (currentFormatState + 1) % 3

    let formattedText = ''
    let toastMessage = ''

    if (nextFormatState === 1) {
      // 分为一行
      formattedText = sentences.join(' ')
      toastMessage = '药品名称分为一行（已替换XX为罗马数字）'
    } else if (nextFormatState === 2) {
      // 分为两行
      const sentencesPerLine = Math.ceil(sentenceCount / 2)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine).join(' ')
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '药品名称分为两行（已替换XX为罗马数字）'
    } else {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2).join(' ')
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '药品名称分为三行（已替换XX为罗马数字）'
    }

    // 更新对应字段的内容
    updateLabelData({ drugName: formattedText })
    
    // 更新格式化状态
    setFormatStates(prev => ({
      ...prev,
      drugName: nextFormatState
    }))

    showToast(toastMessage, 'success')
  }

  // 基于原始状态的格式化功能 - 片数
  const handleFormatNumberOfSheets = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(labelData.originalSummary)
    
    if (!originalData) {
      showToast('未找到原始状态，请先点击初始化', 'info')
      return
    }

    // 获取对应字段的原始内容
    const originalText = originalData.numberOfSheets
    if (!originalText || !originalText.trim()) {
      showToast('片数字段的原始状态为空', 'info')
      return
    }

    // 应用变量控制（在分行之前）
    const startIndex = calculateRomanStartIndex('numberOfSheets')
    const { processedText: variableControlledText } = applyVariableControl(originalText, 'numberOfSheets', startIndex)

    // 将处理后的文本按行分割为数组
    const sentences = variableControlledText.split('\n').filter((line: string) => line.trim() !== '')
    const sentenceCount = sentences.length

    if (sentenceCount === 0) {
      showToast('片数字段的原始状态为空', 'info')
      return
    }

    // 获取当前格式化状态并计算下一个状态
    const currentFormatState = formatStates.numberOfSheets || 0
    const nextFormatState = (currentFormatState + 1) % 3

    let formattedText = ''
    let toastMessage = ''

    if (nextFormatState === 1) {
      // 分为一行
      formattedText = sentences.join(' ')
      toastMessage = '片数分为一行（已替换XX为罗马数字）'
    } else if (nextFormatState === 2) {
      // 分为两行
      const sentencesPerLine = Math.ceil(sentenceCount / 2)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine).join(' ')
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '片数分为两行（已替换XX为罗马数字）'
    } else {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2).join(' ')
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '片数分为三行（已替换XX为罗马数字）'
    }

    // 更新对应字段的内容
    updateLabelData({ numberOfSheets: formattedText })
    
    // 更新格式化状态
    setFormatStates(prev => ({
      ...prev,
      numberOfSheets: nextFormatState
    }))

    showToast(toastMessage, 'success')
  }

  // 基于原始状态的格式化功能 - 药品说明
  const handleFormatDrugDescription = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(labelData.originalSummary)
    
    if (!originalData) {
      showToast('未找到原始状态，请先点击初始化', 'info')
      return
    }

    // 获取对应字段的原始内容
    const originalText = originalData.drugDescription
    if (!originalText || !originalText.trim()) {
      showToast('药品说明字段的原始状态为空', 'info')
      return
    }

    // 将原始状态按行分割为数组
    const sentences = originalText.split('\n').filter((line: string) => line.trim() !== '')
    const sentenceCount = sentences.length

    if (sentenceCount === 0) {
      showToast('药品说明字段的原始状态为空', 'info')
      return
    }

    // 计算容器宽度
    const baseWidth = labelData.labelWidth
    const margins = calculatePageMargins(Number(labelData.selectedNumber))
    const effectiveWidth = baseWidth - margins.left - margins.right
    const safetyMargin = 2
    const containerWidth = mmToPt(Math.max(effectiveWidth - safetyMargin, effectiveWidth * 0.95))

    // 计算每句话的宽度
    const sentencesWithWidth = sentences.map((sentence: string) => ({
      text: sentence,
      width: measureTextWidth(sentence, labelData.fontSize, labelData.fontFamily)
    }))

    // 空格宽度
    const spaceWidth = measureTextWidth(' ', labelData.fontSize, labelData.fontFamily)

    // 智能组合算法：最大化每行利用率
    const optimizeCombination = (items: Array<{text: string, width: number}>): string[] => {
      const result: string[] = []
      const used = new Array(items.length).fill(false)

      while (used.some(u => !u)) {
        let bestCombination: number[] = []
        let bestUtilization = 0

        // 找到第一个未使用的句子作为起点
        const startIndex = used.findIndex(u => !u)
        if (startIndex === -1) break

        const startWidth = items[startIndex].width
        const startRequiredMultiplier = Math.ceil(startWidth / containerWidth)
        
        // 根据起始句子的长度确定该行的目标宽度
        // 如果起始句子超过100%，目标宽度是它所需的倍数
        // 如果起始句子不超过100%，目标宽度就是100%（1倍容器宽度）
        const targetMultiplier = startRequiredMultiplier
        const maxTargetWidth = containerWidth * targetMultiplier
        
        // 从起始句子开始，尝试添加其他句子，但总宽度不能超过目标宽度
        let currentCombination = [startIndex]
        let currentWidth = startWidth
        let currentUtilization = currentWidth / maxTargetWidth
        
        // 尝试添加其他未使用的句子
        for (let i = 0; i < items.length; i++) {
          if (!used[i] && i !== startIndex) {
            const newWidth = currentWidth + spaceWidth + items[i].width
            
            // 检查：添加后不能超过目标宽度
            if (newWidth <= maxTargetWidth) {
              const newUtilization = newWidth / maxTargetWidth
              
              // 如果利用率提高，则添加这个句子
              if (newUtilization > currentUtilization) {
                currentCombination.push(i)
                currentWidth = newWidth
                currentUtilization = newUtilization
              }
            }
          }
        }
        
        // 使用找到的组合
        bestCombination = currentCombination

        // 标记为已使用并添加到结果
        if (bestCombination.length > 0) {
          const combinedText = bestCombination.map(idx => items[idx].text).join(' ')
          result.push(combinedText)
          bestCombination.forEach(idx => {
            used[idx] = true
          })
        } else {
          // 如果没有找到合适的组合（理论上不应该发生），直接使用当前句子
          result.push(items[startIndex].text)
          used[startIndex] = true
        }
      }

      return result
    }

    // 执行智能组合
    const optimizedLines = optimizeCombination(sentencesWithWidth)
    
    // 生成格式化文本
    const formattedText = optimizedLines.join('\n')
    
    // 更新对应字段的内容
    updateLabelData({ drugDescription: formattedText })
    
    // 更新格式化状态（始终设为1，因为这是智能优化的结果）
    setFormatStates(prev => ({
      ...prev,
      drugDescription: 1
    }))

    showToast(`药品说明已智能优化为${optimizedLines.length}行（最大化利用率）`, 'success')
  }

  // 基于原始状态的格式化功能 - 公司名称
  const handleFormatCompanyName = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(labelData.originalSummary)
    
    if (!originalData) {
      showToast('未找到原始状态，请先点击初始化', 'info')
      return
    }

    // 获取对应字段的原始内容
    const originalText = originalData.companyName
    if (!originalText || !originalText.trim()) {
      showToast('公司名称字段的原始状态为空', 'info')
      return
    }

    // 将原始状态按行分割为数组
    const sentences = originalText.split('\n').filter((line: string) => line.trim() !== '')
    const sentenceCount = sentences.length

    if (sentenceCount === 0) {
      showToast('公司名称字段的原始状态为空', 'info')
      return
    }

    // 获取当前格式化状态并计算下一个状态
    const currentFormatState = formatStates.companyName || 0
    const nextFormatState = (currentFormatState + 1) % 3

    let formattedText = ''
    let toastMessage = ''

    if (nextFormatState === 1) {
      // 分为一行
      formattedText = sentences.join(' ')
      toastMessage = '公司名称分为一行'
    } else if (nextFormatState === 2) {
      // 分为两行
      const sentencesPerLine = Math.ceil(sentenceCount / 2)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine).join(' ')
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '公司名称分为两行'
    } else {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2).join(' ')
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '公司名称分为三行'
    }

    // 更新对应字段的内容
    updateLabelData({ companyName: formattedText })
    
    // 更新格式化状态
    setFormatStates(prev => ({
      ...prev,
      companyName: nextFormatState
    }))

    showToast(toastMessage, 'success')
  }

  // 同步 selectedNumber 的变化
  useEffect(() => {
    setSelectedNumberState(Number(selectedNumber))
  }, [selectedNumber])

  // 检查并应用项目级别的字体同步设置（在数据加载完成后执行）
  useEffect(() => {
    if (selectedProject?.id && selectedLanguage && dataLoadCompleted) {
      const projectKey = `${PROJECT_FONT_SYNC_KEY}_${selectedProject.id}`
      const appliedKey = `${PROJECT_APPLIED_KEY}_${selectedProject.id}_${selectedLanguage}`
      const syncedSettings = localStorage.getItem(projectKey)
      const hasApplied = localStorage.getItem(appliedKey)
      
      // 只有存在同步设置且该语言未应用过时才应用
      if (syncedSettings && !hasApplied) {
        try {
          const settings = JSON.parse(syncedSettings)
          
          // 只应用字体大小、间距、行高，不包括字体类型
          updateLabelData({
            fontSize: settings.fontSize,
            spacing: settings.spacing,
            lineHeight: settings.lineHeight,
            sequenceFontSize: settings.sequenceFontSize // 同步序号字符大小
          })
          
          // 标记该语言已应用过同步设置
          localStorage.setItem(appliedKey, 'true')
        } catch (error) {
          console.error('解析项目字体同步设置失败:', error)
        }
      }
      
      // 重置数据加载完成标记，为下次切换做准备
      setDataLoadCompleted(false)
    }
  }, [selectedProject?.id, selectedLanguage, dataLoadCompleted, updateLabelData]) // 监听数据加载完成状态
  


  // 自动调整textarea高度的函数
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement) => {
    // 检查是否为空白
    const isEmpty = !textarea.value || textarea.value.trim() === ''
    
    // 如果为空，使用更高的默认高度
    if (isEmpty) {
      textarea.style.height = '50px' // 空白时显示更高
      return
    }
    
    // 先重置高度到minHeight，让浏览器计算真实的scrollHeight
    textarea.style.height = '32px'
    const scrollHeight = textarea.scrollHeight
    
    const computedStyle = window.getComputedStyle(textarea)
    const fontSize = parseFloat(computedStyle.fontSize)
    const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.2
    
    // 计算padding和border
    const paddingTop = parseFloat(computedStyle.paddingTop)
    const paddingBottom = parseFloat(computedStyle.paddingBottom)
    const totalPadding = paddingTop + paddingBottom
    const borderTop = parseFloat(computedStyle.borderTopWidth)
    const borderBottom = parseFloat(computedStyle.borderBottomWidth)
    const totalBorder = borderTop + borderBottom
    
    // 计算单行文本的理论高度
    // lineHeight * 1行 + padding + border
    const singleLineContentHeight = lineHeight + totalPadding + totalBorder
    
    // 判断是否为单行：无换行符 且 scrollHeight不超过单行高度+容差
    const hasNewline = textarea.value.includes('\n') || textarea.value.includes('\r')
    const isSingleLine = !hasNewline && scrollHeight <= (singleLineContentHeight + 2)
    
    // 调试信息
    
    if (isSingleLine) {
      // 单行时使用最小高度
      textarea.style.height = '32px'
    } else {
      // 多行时使用scrollHeight
      textarea.style.height = scrollHeight + 'px'
    }
  }

  // 当字段内容变化时，自动调整所有textarea的高度
  useEffect(() => {
    const textareas = document.querySelectorAll('textarea[data-auto-height="true"]') as NodeListOf<HTMLTextAreaElement>
    textareas.forEach(adjustTextareaHeight)
  }, [basicInfo, numberField, drugName, numberOfSheets, drugDescription, companyName])

  // 加载当前项目的可用序号和国别码
  useEffect(() => {
    const loadAvailableOptions = async () => {
      if (selectedProject) {
        try {
          const projectDetail = await getProjectById(selectedProject.id)
          if (projectDetail.translationGroups) {
            // 提取所有序号并排序
            const sequences = projectDetail.translationGroups
              .map(group => group.sequence_number)
              .sort((a, b) => a - b)
            setAvailableSequences(sequences)

            // 提取所有国别码并按序号排序
            const countries = projectDetail.translationGroups
              .sort((a, b) => a.sequence_number - b.sequence_number)
              .map(group => group.country_code)
            setAvailableCountries(countries)
          } else {
            setAvailableSequences([])
            setAvailableCountries([])
          }
        } catch (error) {
          // console.error('加载项目选项失败:', error)
          setAvailableSequences([])
          setAvailableCountries([])
        }
      } else {
        // 没有选中项目时，不设置任何默认选项
        setAvailableSequences([])
        setAvailableCountries([])
      }
    }

    loadAvailableOptions()
  }, [selectedProject])

  // 当项目被选中时，自动加载格式化内容到6个字段
  useEffect(() => {
    const loadFormattedContent = async () => {
      if (selectedProject && selectedLanguage) {
        try {
          // 获取该国别的详细信息
          const countryDetail = await getCountryDetails(selectedProject.id, selectedLanguage)
          
          // 加载标签预览区参数设置
          let labelDataFromSettings = null
          try {
            const shortCountryCode = extractShortCountryCode(selectedLanguage)
            const sequence = selectedProject.currentSequence || 1
            
            const labelSettings = await getLabelSettings(
              selectedProject.id,
              shortCountryCode,
              sequence
            )
            
            labelDataFromSettings = convertSettingsToLabelData(labelSettings)
          } catch (labelError) {
            // console.warn('⚠️ [useEffect-AutoLoad] 加载标签设置失败，使用默认设置:', labelError)
          }
          
          // 尝试解析JSON格式的格式化状态
          const formattedData = parseFormattedSummary(countryDetail.formatted_summary)
          
          if (formattedData && formattedData.formatStates) {
            // 如果有JSON格式的格式化状态，加载6个字段和格式化状态
            const mergedData = {
              ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
              basicInfo: formattedData.basicInfo || '',
              numberField: formattedData.numberField || '',
              drugName: formattedData.drugName || '',
              numberOfSheets: formattedData.numberOfSheets || '',
              drugDescription: formattedData.drugDescription || '',
              companyName: formattedData.companyName || '',
              originalSummary: countryDetail.original_summary,
              formatted_summary: countryDetail.formatted_summary
            }
            
            updateLabelData(mergedData)
            
            // 恢复格式化状态
            setFormatStates(formattedData.formatStates)
            
            // 标记数据加载完成
            setDataLoadCompleted(true)
            
          } else {
            // 如果没有格式化状态，尝试加载原始状态
            const originalData = parseOriginalSummary(countryDetail.original_summary)
            
            if (originalData) {
              const mergedData = {
                ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
                basicInfo: originalData.basicInfo || '',
                numberField: originalData.numberField || '',
                drugName: originalData.drugName || '',
                numberOfSheets: originalData.numberOfSheets || '',
                drugDescription: originalData.drugDescription || '',
                companyName: originalData.companyName || '',
                originalSummary: countryDetail.original_summary,
                formatted_summary: countryDetail.formatted_summary
              }
              updateLabelData(mergedData)
              
              // 重置格式化状态为0
              setFormatStates({
                basicInfo: 0,
                numberField: 0,
                drugName: 0,
                numberOfSheets: 0,
                drugDescription: 0,
                companyName: 0
              })
              
              // 标记数据加载完成
              setDataLoadCompleted(true)
              
            } else {
              // 如果既没有格式化数据也没有原始数据，清空所有字段（但保留标签设置）
              const mergedData = {
                ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
                basicInfo: '',
                numberField: '',
                drugName: '',
                numberOfSheets: '',
                drugDescription: '',
                companyName: '',
                originalSummary: undefined,
                formatted_summary: undefined
              }
              updateLabelData(mergedData)
              
              // 重置格式化状态为0
              setFormatStates({
                basicInfo: 0,
                numberField: 0,
                drugName: 0,
                numberOfSheets: 0,
                drugDescription: 0,
                companyName: 0
              })
              
              // 标记数据加载完成
              setDataLoadCompleted(true)
              
            }
          }
        } catch (error) {
          // 出错时也清空字段，避免显示错误的旧数据
          updateLabelData({ 
            basicInfo: '',
            numberField: '',
            drugName: '',
            numberOfSheets: '',
            drugDescription: '',
            companyName: '',
            originalSummary: undefined,
            formatted_summary: undefined
          })
          setFormatStates({
            basicInfo: 0,
            numberField: 0,
            drugName: 0,
            numberOfSheets: 0,
            drugDescription: 0,
            companyName: 0
          })
        }
      }
    }

    loadFormattedContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, selectedLanguage])


  const fonts = [
    { name: "STHeiti", value: "STHeiti" },
    { name: "Arial", value: "Arial" },
    { name: "Arial Bold", value: "Arial Bold" },
    { name: "Arial Italic", value: "Arial Italic" },
    { name: "Arial Unicode MS", value: "Arial Unicode MS" },
    { name: "Arial Bold Italic", value: "Arial Bold Italic" }
  ]

  // 临时测试格式化函数
  const format_test = (text: string): string => {
    if (!text || text.trim() === '' || text === '未格式化') {
      return text
    }

    // 按行分割文本，过滤空行
    const lines = text.split('\n').filter(line => line.trim() !== '')
    
    if (lines.length === 0) {
      return text
    }

    const formattedLines: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      formattedLines.push(lines[i])
      
      // 每三行后添加空白行
      if ((i + 1) % 3 === 0) {
        const groupNumber = Math.floor(i / 3) + 1
        
        if (groupNumber === 1) {
          // 第一个三行文本后，增加一个空白行
          formattedLines.push('')
        } else if (groupNumber === 2) {
          // 第二个三行文本后，增加两个空白行
          formattedLines.push('', '')
        } else if (groupNumber === 3) {
          // 第三个三行文本后，增加一个空白行
          formattedLines.push('')
        } else if (groupNumber === 4) {
          // 第四个三行文本后，增加两个空白行
          formattedLines.push('', '')
        } else {
          // 后面每三行文本后，增加一个空白行
          formattedLines.push('')
        }
      }
    }
    
    return formattedLines.join('\n')
  }

  // 正式格式化函数（预留）
  const format_official = (text: string): string => {
    // 正式格式化逻辑待实现
    // console.log('正式格式化函数调用，文本长度:', text.length)
    return text
  }

  // 重置到格式化状态
  const handleResetToFormatted = async () => {
    if (!selectedProject) { showToast('请先选择一个项目', 'info'); return }

    try {
      setIsResetting(true)
      
      // 获取该国别的详细信息
      const countryDetail = await getCountryDetails(selectedProject.id, selectedLanguage)
      
      // 尝试解析JSON格式的格式化状态
      const formattedData = parseFormattedSummary(countryDetail.formatted_summary)
      
      if (formattedData && formattedData.formatStates) {
        // 如果有JSON格式的格式化状态，恢复6个字段和格式化状态
        updateLabelData({ 
          basicInfo: formattedData.basicInfo || '',
          numberField: formattedData.numberField || '',
          drugName: formattedData.drugName || '',
          numberOfSheets: formattedData.numberOfSheets || '',
          drugDescription: formattedData.drugDescription || '',
          companyName: formattedData.companyName || '',
          originalSummary: countryDetail.original_summary,
          formatted_summary: countryDetail.formatted_summary
        })
        
        // 恢复格式化状态
        setFormatStates(formattedData.formatStates)
        showToast('已恢复到格式化状态', 'success')
      } else {
        showToast('未找到格式化状态', 'info')
      }
    } catch (error) {
      // console.error('重置失败:', error)
      showToast('重置失败，请重试', 'error')
    } finally {
      setIsResetting(false)
    }
  }

  // 重置到原始状态
  const handleResetToOriginal = async () => {
    if (!selectedProject) { showToast('请先选择一个项目', 'info'); return }

    try {
      setIsResetting(true)
      
      // 获取该国别的详细信息
      const countryDetail = await getCountryDetails(selectedProject.id, selectedLanguage)
      
      // 尝试解析JSON格式的原始状态
      const originalData = parseOriginalSummary(countryDetail.original_summary)
      
      if (originalData) {
        // 如果有JSON格式的原始状态，恢复6个字段
        updateLabelData({ 
          basicInfo: originalData.basicInfo || '',
          numberField: originalData.numberField || '',
          drugName: originalData.drugName || '',
          numberOfSheets: originalData.numberOfSheets || '',
          drugDescription: originalData.drugDescription || '',
          companyName: originalData.companyName || '',
          originalSummary: countryDetail.original_summary,
          formatted_summary: countryDetail.formatted_summary
        })
        
        // 重置格式化状态
        setFormatStates({
          basicInfo: 0,
          numberField: 0,
          drugName: 0,
          numberOfSheets: 0,
          drugDescription: 0,
          companyName: 0
        })
        
        showToast('已恢复到原始状态', 'success')
      } else {
        showToast('未找到原始状态', 'info')
      }
    } catch (error) {
      // console.error('重置失败:', error)
      showToast('重置失败，请重试', 'error')
    } finally {
      setIsResetting(false)
    }
  }


  // 导入翻译内容
  const handleImport = async () => {
    if (!selectedProject) { showToast('请先选择一个项目', 'info'); return }

    try {
      setIsImporting(true)
      
      // 获取当前国别的翻译详情
      const translationGroup = await getTranslationsByCountry(selectedProject.id, selectedLanguage)
      
      if (!translationGroup.items || translationGroup.items.length === 0) {
        showToast('该国别暂无翻译内容', 'info')
        return
      }

      // 按 item_order 排序
      const sortedItems = translationGroup.items.sort((a, b) => a.item_order - b.item_order)
      
      // 根据字段类型分类内容
      const fieldTypeGroups = {
        basic_info: [] as string[],
        number_field: [] as string[],
        drug_name: [] as string[],
        number_of_sheets: [] as string[],
        drug_description: [] as string[],
        company_name: [] as string[]
      }
      
      // 分类翻译内容
      sortedItems.forEach(item => {
        const text = item.translated_text || item.original_text
        const fieldType = item.field_type
        
        if (fieldType && fieldTypeGroups[fieldType as keyof typeof fieldTypeGroups]) {
          fieldTypeGroups[fieldType as keyof typeof fieldTypeGroups].push(text)
        } else {
          // 未分类的内容放入药品说明
          fieldTypeGroups.drug_description.push(text)
        }
      })
      
      // 根据当前语言自动选择字体
      const autoFonts = getAutoFontsByLanguage(selectedLanguage)
      
      // 更新到对应的字段类型区域，同时更新字体
      updateLabelData({
        basicInfo: fieldTypeGroups.basic_info.join('\n'),
        numberField: fieldTypeGroups.number_field.join('\n'),
        drugName: fieldTypeGroups.drug_name.join('\n'),
        numberOfSheets: fieldTypeGroups.number_of_sheets.join('\n'),
        drugDescription: fieldTypeGroups.drug_description.join('\n'),
        companyName: fieldTypeGroups.company_name.join('\n'),
        fontFamily: autoFonts.fontFamily,
        secondaryFontFamily: autoFonts.secondaryFontFamily
      })
      
      // 重置所有格式化状态为0
      setFormatStates({
        basicInfo: 0,
        numberField: 0,
        drugName: 0,
        numberOfSheets: 0,
        drugDescription: 0,
        companyName: 0
      })
      
      showToast('翻译内容已按字段类型分类导入', 'success')
      
    } catch (error) {
      // console.error('导入失败:', error)
      showToast('导入失败，请重试', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  // 格式化
  const handleFormat = async () => {
    try {
      setIsFormatting(true)
      
      // 依次执行6个字段的"闪电"图标格式化功能
      // 1. 基本信息
      handleFormatBasicInfo()
      
      // 2. 编号栏
      handleFormatNumberField()
      
      // 3. 药品名称
      handleFormatDrugName()
      
      // 4. 片数
      handleFormatNumberOfSheets()
      
      // 5. 药品说明
      handleFormatDrugDescription()
      
      // 6. 公司名称
      handleFormatCompanyName()
      
      showToast('所有字段已完成格式化', 'success')
      
    } catch (error) {
      // console.error('格式化失败:', error)
      showToast('格式化失败，请重试', 'error')
    } finally {
      setIsFormatting(false)
    }
  }

  // 创建格式化状态JSON
  const createFormattedSummary = () => {
    return JSON.stringify({
      basicInfo: basicInfo || '',
      numberField: numberField || '',
      drugName: drugName || '',
      numberOfSheets: numberOfSheets || '',
      drugDescription: drugDescription || '',
      companyName: companyName || '',
      formatStates: formatStates // 保存格式化状态
    })
  }

  // 从完整国别码中提取简短国别码（用于API调用）
  const extractShortCountryCode = (fullCountryCode: string): string => {
    // 如果包含空格，取第一部分作为简短国别码
    // 例如: "NZ New Zealand/English" -> "NZ"
    return fullCountryCode.split(' ')[0]
  }

  // 保存标签设置到数据库
  const saveLabelSettingsToDatabase = async (projectId: number, fullCountryCode: string, sequenceNumber: number) => {
    try {
      const shortCountryCode = extractShortCountryCode(fullCountryCode)
      const settingsData = convertLabelDataToSettings(labelData)
      await saveLabelSettings(projectId, settingsData, shortCountryCode, sequenceNumber)
    } catch (error) {
    }
  }

  // 保存标签
  const handleSave = async () => {
    if (!selectedProject) { showToast('请先选择一个项目', 'info'); return }

    try {
      setIsSaving(true)
      
      // 创建包含6个字段和格式化状态的JSON
      const formattedSummaryJson = createFormattedSummary()
      
      // 同时保存合并的文本内容（用于PDF生成）和JSON格式的详细状态
      const combinedContent = [
        basicInfo,
        numberField,
        drugName,
        numberOfSheets,
        drugDescription,
        companyName
      ].filter(content => content && content.trim() !== '').join('\n')
      
      // 1. 保存格式化翻译汇总和字体设置
      await updateFormattedSummary(selectedProject.id, selectedLanguage, formattedSummaryJson, {
        fontFamily: labelData.fontFamily,
        secondaryFontFamily: labelData.secondaryFontFamily,
        textAlign: labelData.textAlign,
        fontSize: labelData.fontSize,
        spacing: labelData.spacing,
        lineHeight: labelData.lineHeight
      })

      // 2. 保存标签预览区参数设置到数据库
      await saveLabelSettingsToDatabase(
        selectedProject.id,
        selectedLanguage,
        parseInt(selectedNumber)
      )
      
      // 立即更新本地状态，确保后续操作可以访问到最新的格式化状态
      updateLabelData({
        formatted_summary: formattedSummaryJson
      })
      
      // 3. 触发PDF生成和保存（使用合并的文本内容）
      window.dispatchEvent(new CustomEvent('generate-and-save-pdf', {
        detail: {
          projectId: selectedProject.id,
          countryCode: selectedLanguage,
          sequenceNumber: selectedNumber,
          content: combinedContent // 传递合并的文本内容用于PDF生成
        }
      }));
      
      showToast('标签设置和格式化状态已保存，PDF正在生成中...', 'success')
      
    } catch (error) {
      // console.error('保存标签失败:', error)
      showToast('保存标签失败，请重试', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // 根据序号查找对应的国别码
  const findCountryBySequence = async (projectId: number, sequence: number): Promise<string | null> => {
    try {
      const projectDetail = await getProjectById(projectId)
      const group = projectDetail.translationGroups?.find(g => g.sequence_number === sequence)
      return group?.country_code || null
    } catch (error) {
      // console.error('查找国别码失败:', error)
      return null
    }
  }

  // 根据国别码查找对应的序号
  const findSequenceByCountry = async (projectId: number, countryCode: string): Promise<number | null> => {
    try {
      const projectDetail = await getProjectById(projectId)
      const group = projectDetail.translationGroups?.find(g => g.country_code === countryCode)
      return group?.sequence_number || null
    } catch (error) {
      // console.error('查找序号失败:', error)
      return null
    }
  }

  // 根据语言自动选择字体（提取为独立函数，供多处使用）
  const getAutoFontsByLanguage = (language: string): { fontFamily: string; secondaryFontFamily: string } => {
    
    // 检查是否为从右到左的语言
    const isRTL = () => {
      if (!language) return false;
      const rtlKeywords = ['Arabic', 'Hebrew', 'Persian', 'Farsi', 'Urdu', 'Punjabi', 'Somali'];
      return rtlKeywords.some(keyword => language.includes(keyword));
    };
    
    // 检查是否为需要特殊字体的语言
    const needsUnicodeFont = () => {
      if (!language) return false;
      const unicodeFontLanguages = ['Georgian','Hebrew','Korean', 'Thai','Thailand', 'Vietnamese', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Urdu'];
      const result = unicodeFontLanguages.some(lang => language.includes(lang)) || 
             language.includes('KR') || language.includes('TH') || language.includes('VN');
      return result;
    };
    
    // 根据语言设置对应的字体
    if (language === 'CN' || language.includes('Chinese')) {
      return {
        fontFamily: 'STHeiti',
        secondaryFontFamily: 'Arial'
      };
    } else if (language === 'JP' || language.includes('Japanese')) {
      return {
        fontFamily: 'Arial Unicode MS',  // 日文也可以使用STHeiti
        secondaryFontFamily: 'Arial Unicode MS'
      };
    } else if (isRTL() || needsUnicodeFont()) {
      return {
        fontFamily: 'Arial Unicode MS',
        secondaryFontFamily: 'Arial Unicode MS'
      };
    } else {
      return {
        fontFamily: 'Arial',
        secondaryFontFamily: 'Arial'
      };
    }
  };

  // 处理语言选择变化
  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value
    
    // 使用统一的字体选择函数
    const autoFonts = getAutoFontsByLanguage(newLanguage)
    
    // 如果有选中的项目，需要查找对应的序号和加载数据
    if (selectedProject) {
      try {
        // 查找该国别码对应的序号
        const sequence = await findSequenceByCountry(selectedProject.id, newLanguage)
        
        if (sequence !== null) {
          // 获取该国别的详细信息
          const countryDetail = await getCountryDetails(selectedProject.id, newLanguage)
          
          // 更新选中项目信息
          setSelectedProject({
            id: selectedProject.id,
            job_name: selectedProject.job_name,
            currentSequence: sequence,
            countryCode: newLanguage,
            formattedSummary: countryDetail.formatted_summary || undefined
          })
          
          // 加载标签预览区参数设置
          let labelDataFromSettings = null
          try {
            const shortCountryCode = extractShortCountryCode(newLanguage)
            
            const labelSettings = await getLabelSettings(
              selectedProject.id,
              shortCountryCode,
              sequence
            )
            
            labelDataFromSettings = convertSettingsToLabelData(labelSettings)
          } catch (labelError) {
            // console.warn('⚠️ 加载标签设置失败，使用默认设置:', labelError)
          }
          
          // 优先尝试解析JSON格式的格式化状态
          const formattedData = parseFormattedSummary(countryDetail.formatted_summary)
          
          if (formattedData && formattedData.formatStates) {
            // 如果有JSON格式的格式化状态，恢复6个字段和格式化状态
            const mergedData = {
              ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
              selectedLanguage: newLanguage,
              fontFamily: countryDetail.font_family || autoFonts.fontFamily,
              secondaryFontFamily: countryDetail.secondary_font_family || autoFonts.secondaryFontFamily,
              textAlign: countryDetail.text_align || 'left',
              fontSize: countryDetail.font_size || labelData.fontSize,
              spacing: countryDetail.spacing || labelData.spacing,
              lineHeight: countryDetail.line_height || labelData.lineHeight,
              selectedNumber: sequence.toString(),
              basicInfo: formattedData.basicInfo || '',
              numberField: formattedData.numberField || '',
              drugName: formattedData.drugName || '',
              numberOfSheets: formattedData.numberOfSheets || '',
              drugDescription: formattedData.drugDescription || '',
              companyName: formattedData.companyName || '',
              originalSummary: countryDetail.original_summary,
              formatted_summary: countryDetail.formatted_summary
            }
            updateLabelData(mergedData)
            
            // 恢复格式化状态
            setFormatStates(formattedData.formatStates)
          } else {
            // 如果没有格式化状态，尝试恢复原始状态
            const originalData = parseOriginalSummary(countryDetail.original_summary)
            
            if (originalData) {
              // 如果有JSON格式的原始状态，恢复6个字段
              updateLabelData({
                ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
                selectedLanguage: newLanguage,
                fontFamily: countryDetail.font_family || autoFonts.fontFamily,
                secondaryFontFamily: countryDetail.secondary_font_family || autoFonts.secondaryFontFamily,
                textAlign: countryDetail.text_align || 'left',
                fontSize: countryDetail.font_size || labelData.fontSize,
                spacing: countryDetail.spacing || labelData.spacing,
                lineHeight: countryDetail.line_height || labelData.lineHeight,
                selectedNumber: sequence.toString(),
                basicInfo: originalData.basicInfo || '',
                numberField: originalData.numberField || '',
                drugName: originalData.drugName || '',
                numberOfSheets: originalData.numberOfSheets || '',
                drugDescription: originalData.drugDescription || '',
                companyName: originalData.companyName || '',
                originalSummary: countryDetail.original_summary,
                formatted_summary: countryDetail.formatted_summary
              })
            } else {
              // 如果没有JSON格式数据，使用旧逻辑
              updateLabelData({
                ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
                selectedLanguage: newLanguage,
                fontFamily: countryDetail.font_family || autoFonts.fontFamily,
                secondaryFontFamily: countryDetail.secondary_font_family || autoFonts.secondaryFontFamily,
                textAlign: countryDetail.text_align || 'left',
                fontSize: countryDetail.font_size || labelData.fontSize,
                spacing: countryDetail.spacing || labelData.spacing,
                lineHeight: countryDetail.line_height || labelData.lineHeight,
                selectedNumber: sequence.toString(),
                basicInfo: countryDetail.formatted_summary || '未格式化',
                originalSummary: countryDetail.original_summary,
                formatted_summary: countryDetail.formatted_summary
              })
            }
            
            // 重置格式化状态
            setFormatStates({
              basicInfo: 0,
              numberField: 0,
              drugName: 0,
              numberOfSheets: 0,
              drugDescription: 0,
              companyName: 0
            })
          }
        } else {
          // 如果该国别码不存在于当前项目，只更新语言和字体
          updateLabelData({
            selectedLanguage: newLanguage,
            fontFamily: autoFonts.fontFamily,
            secondaryFontFamily: autoFonts.secondaryFontFamily,
            basicInfo: '该国别在当前项目中不存在'
          })
        }
      } catch (error) {
        // console.error('加载国别数据失败:', error)
        updateLabelData({
          selectedLanguage: newLanguage,
          fontFamily: autoFonts.fontFamily,
          secondaryFontFamily: autoFonts.secondaryFontFamily
        })
      }
    } else {
      // 没有选中项目时，只更新语言和字体
      updateLabelData({
        selectedLanguage: newLanguage,
        fontFamily: autoFonts.fontFamily,
        secondaryFontFamily: autoFonts.secondaryFontFamily
      })
    }
  }

  // 处理序号选择变化
  const handleNumberChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newNumber = Number(e.target.value)
    setSelectedNumberState(newNumber)
    
    // 确保labelWidth是数字类型
    const safeLabelWidth = typeof labelWidth === 'number' ? labelWidth : Number(labelWidth) || 100
    
    // 计算当前页面宽度和边距
    const currentWidth = calculatePageWidth(safeLabelWidth, newNumber)
    const margins = calculatePageMargins(newNumber)
    
    // 输出页面相关信息
    
    // 如果有选中的项目，需要查找对应的国别码和加载数据
    if (selectedProject) {
      try {
        // 查找该序号对应的国别码
        const countryCode = await findCountryBySequence(selectedProject.id, newNumber)
        
        if (countryCode) {
          // 获取该国别的详细信息
          const countryDetail = await getCountryDetails(selectedProject.id, countryCode)
          
          // 更新选中项目信息
          setSelectedProject({
            id: selectedProject.id,
            job_name: selectedProject.job_name,
            currentSequence: newNumber,
            countryCode: countryCode,
            formattedSummary: countryDetail.formatted_summary || undefined
          })
          
          // 加载标签预览区参数设置
          let labelDataFromSettings = null
          try {
            const shortCountryCode = extractShortCountryCode(countryCode)
            
            const labelSettings = await getLabelSettings(
              selectedProject.id,
              shortCountryCode,
              newNumber
            )
            
            labelDataFromSettings = convertSettingsToLabelData(labelSettings)
          } catch (labelError) {
            // console.warn('⚠️ 加载标签设置失败，使用默认设置:', labelError)
          }
          
          // 优先尝试解析JSON格式的格式化状态
          const formattedData = parseFormattedSummary(countryDetail.formatted_summary)
          
          if (formattedData && formattedData.formatStates) {
            // 如果有JSON格式的格式化状态，恢复6个字段和格式化状态
            updateLabelData({
              ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
              selectedNumber: e.target.value,
              selectedLanguage: countryCode,
              currentWidth,
              fontFamily: countryDetail.font_family || labelData.fontFamily,
              secondaryFontFamily: countryDetail.secondary_font_family || labelData.secondaryFontFamily,
              fontSize: countryDetail.font_size || labelData.fontSize,
              spacing: countryDetail.spacing || labelData.spacing,
              lineHeight: countryDetail.line_height || labelData.lineHeight,
              basicInfo: formattedData.basicInfo || '',
              numberField: formattedData.numberField || '',
              drugName: formattedData.drugName || '',
              numberOfSheets: formattedData.numberOfSheets || '',
              drugDescription: formattedData.drugDescription || '',
              companyName: formattedData.companyName || '',
              originalSummary: countryDetail.original_summary,
              formatted_summary: countryDetail.formatted_summary
            })
            
            // 恢复格式化状态
            setFormatStates(formattedData.formatStates)
          } else {
            // 如果没有格式化状态，尝试恢复原始状态
            const originalData = parseOriginalSummary(countryDetail.original_summary)
            
            if (originalData) {
              // 如果有JSON格式的原始状态，恢复6个字段
              const mergedData = {
                ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
                selectedNumber: e.target.value,
                selectedLanguage: countryCode,
                currentWidth,
                fontFamily: countryDetail.font_family || labelData.fontFamily,
                secondaryFontFamily: countryDetail.secondary_font_family || labelData.secondaryFontFamily,
                fontSize: countryDetail.font_size || labelData.fontSize,
                spacing: countryDetail.spacing || labelData.spacing,
                lineHeight: countryDetail.line_height || labelData.lineHeight,
                basicInfo: originalData.basicInfo || '',
                numberField: originalData.numberField || '',
                drugName: originalData.drugName || '',
                numberOfSheets: originalData.numberOfSheets || '',
                drugDescription: originalData.drugDescription || '',
                companyName: originalData.companyName || '',
                originalSummary: countryDetail.original_summary,
                formatted_summary: countryDetail.formatted_summary
              }
              updateLabelData(mergedData)
            } else {
              // 如果没有JSON格式数据，使用旧逻辑
              const mergedData = {
                ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
                selectedNumber: e.target.value,
                selectedLanguage: countryCode,
                currentWidth,
                fontFamily: countryDetail.font_family || labelData.fontFamily,
                secondaryFontFamily: countryDetail.secondary_font_family || labelData.secondaryFontFamily,
                fontSize: countryDetail.font_size || labelData.fontSize,
                spacing: countryDetail.spacing || labelData.spacing,
                lineHeight: countryDetail.line_height || labelData.lineHeight,
                basicInfo: countryDetail.formatted_summary || '未格式化',
                originalSummary: countryDetail.original_summary,
                formatted_summary: countryDetail.formatted_summary
              }
              updateLabelData(mergedData)
            }
            
            // 重置格式化状态
            setFormatStates({
              basicInfo: 0,
              numberField: 0,
              drugName: 0,
              numberOfSheets: 0,
              drugDescription: 0,
              companyName: 0
            })
          }
        } else {
          // 如果该序号不存在于当前项目，只更新序号和宽度
          updateLabelData({
            selectedNumber: e.target.value,
            currentWidth,
            basicInfo: '该序号在当前项目中不存在'
          })
        }
      } catch (error) {
        // console.error('加载序号数据失败:', error)
        updateLabelData({
          selectedNumber: e.target.value,
          currentWidth
        })
      }
    } else {
      // 没有选中项目时，只更新序号和宽度
      updateLabelData({ 
        selectedNumber: e.target.value,
        currentWidth
      })
    }
  }

  return (
    <div className="h-full w-full flex flex-col card rounded-lg shadow" style={{ borderColor: theme.border }}>
      {/* 顶部轻量提示条 */}
      {toast.visible && (
        <div
          className="fixed bottom-4 left-4 z-50 px-3 py-2 rounded shadow text-sm"
          style={{
            backgroundColor: toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#6B7280',
            color: 'white'
          }}
        >
          {toast.message}
        </div>
      )}
      <h2 className="text-xl font-bold mb-6 flex items-center" style={{ color: theme.primary }}>
        <Edit3 className="mr-2" size={24} />
        标签编辑器
      </h2>
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center border border-[#30B8D6] rounded-md">
            <label className="text-base font-medium px-3 py-2 min-w-[120px]" style={{ color: theme.text }}>
              序号：
            </label>
            <div className="flex-1 relative">
              <select
                value={selectedNumberState}
                onChange={handleNumberChange}
                className="w-full px-3 py-2 focus:outline-none appearance-none"
                style={{
                  color: theme.text,
                  backgroundColor: "white",
                }}
                disabled={availableSequences.length === 0}
              >
                {availableSequences.length === 0 ? (
                  <option value="">无可用序号</option>
                ) : (
                  availableSequences.map((sequence) => (
                    <option key={sequence} value={sequence}>
                      {sequence}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
                <ChevronDown className="h-4 w-4" style={{ color: theme.text }} />
              </div>
            </div>
          </div>
          <div className="relative">
            <select
              value={selectedLanguage}
              onChange={handleLanguageChange}
              className="block w-full pl-3 pr-10 py-2 text-base rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-md border"
              style={{
                borderColor: theme.border,
                color: theme.text,
                backgroundColor: "white",
              }}
              disabled={availableCountries.length === 0}
            >
              {availableCountries.length === 0 ? (
                <option value="">无可用国别</option>
              ) : (
                availableCountries.map((countryCode) => (
                  <option key={countryCode} value={countryCode}>
                    {countryCode}
                  </option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
              <ChevronDown className="h-4 w-4" style={{ color: theme.text }} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto">
        <div className="space-y-6">
          {/* 药品信息标题和按钮区域 */}
          <div>
            <div className="flex items-center justify-center mb-2">
              <div className="flex gap-2 w-full">
                <button
                  onClick={handleImport}
                  disabled={!selectedProject || isImporting}
                  className="flex-1 px-4 py-2 rounded text-sm flex items-center justify-center gap-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{
                    backgroundColor: theme.secondary,
                    color: theme.buttonText,
                  }}
                >
                  <Download size={14} />
                  {isImporting ? '导入中...' : '导入'}
                </button>
                <div className="relative flex-1">
                  <div className="flex w-full">
                    <button
                      onClick={handleInitialize}
                      disabled={!selectedProject || isInitializing}
                      className="flex-1 px-4 py-2 rounded-l text-sm flex items-center justify-center gap-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      style={{
                        backgroundColor: '#8B5CF6',
                        color: 'white',
                      }}
                    >
                      <Settings size={14} />
                      {isInitializing ? '初始化中...' : '初始化'}
                    </button>
                    <button
                      onClick={handleResetToOriginal}
                      disabled={!selectedProject || isResetting}
                      className="px-2 py-2 rounded-r text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed border-l border-white/20"
                      style={{
                        backgroundColor: '#8B5CF6',
                        color: 'white',
                      }}
                      title="重置到初始化"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
                <div className="relative flex-1">
                  <div className="flex w-full">
                    <button
                      onClick={handleFormat}
                      disabled={isFormatting}
                      className="flex-1 px-4 py-2 rounded-l text-sm flex items-center justify-center gap-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      style={{
                        backgroundColor: theme.accent,
                        color: theme.buttonText,
                      }}
                    >
                      <Sparkles size={14} />
                      {isFormatting ? '格式化中...' : '格式化'}
                    </button>
                    <button
                      onClick={handleResetToFormatted}
                      disabled={!selectedProject || isResetting}
                      className="px-2 py-2 rounded-r text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed border-l border-white/20"
                      style={{
                        backgroundColor: theme.accent,
                        color: theme.buttonText,
                      }}
                      title="重置到格式化"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleSave}
                  disabled={!selectedProject || isSaving}
                  className="flex-1 px-4 py-2 rounded text-sm flex items-center justify-center gap-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{
                    backgroundColor: '#10B981', // 绿色表示保存
                    color: 'white',
                  }}
                >
                  <Save size={14} />
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>

          {/* 6个字段类型分类区域 - 紧凑间距 */}
          <div className="space-y-1">
            {/* 1. 基本信息 */}
            <div className="relative">
              <textarea
                value={basicInfo}
                onChange={(e) => {
                  updateLabelData({ basicInfo: e.target.value })
                  // 自动调整高度
                  adjustTextareaHeight(e.target)
                }}
                data-auto-height="true"
                className="w-full rounded-md shadow-md px-3 pr-10 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "auto", // 改为自动高度，由adjustTextareaHeight控制
                  minHeight: "32px", // 最小单行高度：16px字体 + 12px padding + 2px border + 2px缓冲
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 恢复合理的行间距
                  paddingTop: "6px", // 增加上padding，让多行文本更美观
                  paddingBottom: "6px", // 增加下padding
                  resize: "none",
                  overflow: "hidden",
                  maxHeight: "none" // 移除最大高度限制
                }}
                placeholder="基本信息..."
              />
              {/* 闪电图标 */}
              <button
                onClick={handleFormatBasicInfo}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors bg-transparent border-none hover:bg-gray-100"
                style={{ color: theme.accent, backgroundColor: 'transparent' }}
                title="格式化此字段"
              >
                <Zap size={16} />
              </button>
            </div>

            {/* 2. 编号栏 */}
            <div className="relative">
              <textarea
                value={numberField}
                onChange={(e) => {
                  updateLabelData({ numberField: e.target.value })
                  // 自动调整高度
                  const textarea = e.target
                  textarea.style.height = 'auto'
                  textarea.style.height = Math.max(40, textarea.scrollHeight) + 'px'
                }}
                data-auto-height="true"
                className="w-full rounded-md shadow-md px-3 pr-10 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "auto", // 改为自动高度，由adjustTextareaHeight控制
                  minHeight: "32px", // 最小单行高度：16px字体 + 12px padding + 2px border + 2px缓冲
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 恢复合理的行间距
                  paddingTop: "6px", // 增加上padding，让多行文本更美观
                  paddingBottom: "6px", // 增加下padding
                  resize: "none",
                  overflow: "hidden",
                  maxHeight: "none" // 移除最大高度限制
                }}
                placeholder="编号栏..."
              />
              {/* 闪电图标 */}
              <button
                onClick={handleFormatNumberField}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors bg-transparent border-none hover:bg-gray-100"
                style={{ color: theme.accent, backgroundColor: 'transparent' }}
                title="格式化此字段"
              >
                <Zap size={16} />
              </button>
            </div>

            {/* 3. 药品名称 */}
            <div className="relative">
              <textarea
                value={drugName}
                onChange={(e) => {
                  updateLabelData({ drugName: e.target.value })
                  // 自动调整高度
                  const textarea = e.target
                  textarea.style.height = 'auto'
                  textarea.style.height = Math.max(40, textarea.scrollHeight) + 'px'
                }}
                data-auto-height="true"
                className="w-full rounded-md shadow-md px-3 pr-10 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "auto", // 改为自动高度，由adjustTextareaHeight控制
                  minHeight: "32px", // 最小单行高度：16px字体 + 12px padding + 2px border + 2px缓冲
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 恢复合理的行间距
                  paddingTop: "6px", // 增加上padding，让多行文本更美观
                  paddingBottom: "6px", // 增加下padding
                  resize: "none",
                  overflow: "hidden",
                  maxHeight: "none" // 移除最大高度限制
                }}
                placeholder="药品名称..."
              />
              {/* 闪电图标 */}
              <button
                onClick={handleFormatDrugName}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors bg-transparent border-none hover:bg-gray-100"
                style={{ color: theme.accent, backgroundColor: 'transparent' }}
                title="格式化此字段"
              >
                <Zap size={16} />
              </button>
            </div>

            {/* 4. 片数 */}
            <div className="relative">
              <textarea
                value={numberOfSheets}
                onChange={(e) => {
                  updateLabelData({ numberOfSheets: e.target.value })
                  // 自动调整高度
                  const textarea = e.target
                  textarea.style.height = 'auto'
                  textarea.style.height = Math.max(40, textarea.scrollHeight) + 'px'
                }}
                data-auto-height="true"
                className="w-full rounded-md shadow-md px-3 pr-10 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "auto", // 改为自动高度，由adjustTextareaHeight控制
                  minHeight: "32px", // 最小单行高度：16px字体 + 12px padding + 2px border + 2px缓冲
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 恢复合理的行间距
                  paddingTop: "6px", // 增加上padding，让多行文本更美观
                  paddingBottom: "6px", // 增加下padding
                  resize: "none",
                  overflow: "hidden",
                  maxHeight: "none" // 移除最大高度限制
                }}
                placeholder="片数内容..."
              />
              {/* 闪电图标 */}
              <button
                onClick={handleFormatNumberOfSheets}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors bg-transparent border-none hover:bg-gray-100"
                style={{ color: theme.accent, backgroundColor: 'transparent' }}
                title="格式化此字段"
              >
                <Zap size={16} />
              </button>
            </div>

            {/* 5. 药品说明 */}
            <div className="relative">
              <textarea
                value={drugDescription}
                onChange={(e) => {
                  updateLabelData({ drugDescription: e.target.value })
                  // 自动调整高度
                  const textarea = e.target
                  textarea.style.height = 'auto'
                  textarea.style.height = Math.max(40, textarea.scrollHeight) + 'px'
                }}
                data-auto-height="true"
                className="w-full rounded-md shadow-md px-3 pr-10 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "auto", // 改为自动高度，由adjustTextareaHeight控制
                  minHeight: "32px", // 最小单行高度：16px字体 + 12px padding + 2px border + 2px缓冲
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 恢复合理的行间距
                  paddingTop: "6px", // 增加上padding，让多行文本更美观
                  paddingBottom: "6px", // 增加下padding
                  resize: "none",
                  overflow: "hidden",
                  maxHeight: "none" // 移除最大高度限制
                }}
                placeholder="药品说明..."
              />
              {/* 闪电图标 */}
              <button
                onClick={handleFormatDrugDescription}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors bg-transparent border-none hover:bg-gray-100"
                style={{ color: theme.accent, backgroundColor: 'transparent' }}
                title="格式化此字段"
              >
                <Zap size={16} />
              </button>
            </div>

            {/* 6. 公司名称 */}
            <div className="relative">
              <textarea
                value={companyName}
                onChange={(e) => {
                  updateLabelData({ companyName: e.target.value })
                  // 自动调整高度
                  const textarea = e.target
                  textarea.style.height = 'auto'
                  textarea.style.height = Math.max(40, textarea.scrollHeight) + 'px'
                }}
                data-auto-height="true"
                className="w-full rounded-md shadow-md px-3 pr-10 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "auto", // 改为自动高度，由adjustTextareaHeight控制
                  minHeight: "32px", // 最小单行高度：16px字体 + 12px padding + 2px border + 2px缓冲
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 恢复合理的行间距
                  paddingTop: "6px", // 增加上padding，让多行文本更美观
                  paddingBottom: "6px", // 增加下padding
                  resize: "none",
                  overflow: "hidden",
                  maxHeight: "none" // 移除最大高度限制
                }}
                placeholder="公司名称..."
              />
              {/* 闪电图标 */}
              <button
                onClick={handleFormatCompanyName}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors bg-transparent border-none hover:bg-gray-100"
                style={{ color: theme.accent, backgroundColor: 'transparent' }}
                title="格式化此字段"
              >
                <Zap size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 字体相关参数 - 紧凑设计 */}
        <div className="space-y-2 mt-4">
          {/* 第一行：主语言字体、次语言字体、对齐方式 */}
          <div className="grid grid-cols-3 gap-2">
            {/* 主语言字体 */}
            <div className="flex items-center gap-1 border rounded px-2 py-1 transition-opacity relative group" style={{ borderColor: theme.border }}>
              <Type className="h-4 w-4 text-[#30B8D6] flex-shrink-0" />
              <select
                value={fontFamily}
                onChange={(e) => updateLabelData({ fontFamily: e.target.value })}
                className="flex-1 bg-transparent focus:outline-none appearance-none cursor-pointer text-xs"
                style={{ color: theme.text }}
                title="主语言字体：用于中文、日文、韩文等CJK字符"
              >
                {fonts.map((font) => (
                  <option key={font.value} value={font.value}>{font.name}</option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0 pointer-events-none" />
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                主语言字体
              </div>
            </div>

            {/* 次语言字体 */}
            <div className="flex items-center gap-1 border rounded px-2 py-1 transition-opacity relative group" style={{ borderColor: theme.border }}>
              <Languages className="h-4 w-4 text-[#30B8D6] flex-shrink-0" />
              <select
                value={labelData.secondaryFontFamily}
                onChange={(e) => updateLabelData({ secondaryFontFamily: e.target.value })}
                className="flex-1 bg-transparent focus:outline-none appearance-none cursor-pointer text-xs"
                style={{ color: theme.text }}
                title="次语言字体：用于英文、数字等拉丁字符"
              >
                {fonts.map((font) => (
                  <option key={font.value} value={font.value}>{font.name}</option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0 pointer-events-none" />
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                次语言字体
              </div>
            </div>

            {/* 文本对齐方式 */}
            <div className="flex items-center gap-1 border rounded px-2 py-1" style={{ borderColor: theme.border }}>
              <div className="flex items-center gap-1 w-full">
                {/* 左对齐按钮 */}
                <div className="flex-1 relative group">
                  <button
                    onClick={() => updateLabelData({ textAlign: 'left' })}
                    className={`w-full flex items-center justify-center p-1 rounded transition-colors ${
                      labelData.textAlign === 'left' 
                        ? 'bg-[#30B8D6]' 
                        : 'bg-gray-200'
                    }`}
                  >
                    <AlignLeft 
                      className="h-4 w-4" 
                      style={{ 
                        color: labelData.textAlign === 'left' ? 'white' : 'rgba(0, 0, 0, 0.7)' 
                      }} 
                    />
                  </button>
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    左对齐
                  </div>
                </div>
                
                {/* 右对齐按钮 */}
                <div className="flex-1 relative group">
                  <button
                    onClick={() => updateLabelData({ textAlign: 'right' })}
                    className={`w-full flex items-center justify-center p-1 rounded transition-colors ${
                      labelData.textAlign === 'right' 
                        ? 'bg-[#30B8D6]' 
                        : 'bg-gray-200'
                    }`}
                  >
                    <AlignRight 
                      className="h-4 w-4" 
                      style={{ 
                        color: labelData.textAlign === 'right' ? 'white' : 'rgba(0, 0, 0, 0.7)' 
                      }} 
                    />
                  </button>
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    右对齐
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 第二行：字体大小、间距、行高合并为一行 */}
          <div className="flex items-center gap-2 border rounded px-3 py-1 transition-opacity" style={{ borderColor: theme.border }}>
            {/* 字体大小 */}
            <div className="flex items-center gap-1 flex-1 relative group">
              <Maximize2 className="h-3 w-3 text-[#30B8D6] flex-shrink-0" />
              <input
                type="number"
                value={fontSize}
                step={0.5}
                onChange={(e) => updateLabelData({ fontSize: Number(e.target.value) })}
                className="w-full bg-transparent focus:outline-none text-sm px-1"
                style={{ color: theme.text }}
                title="字体大小"
              />
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                字体大小
              </div>
            </div>

            <div className="h-4 w-px bg-gray-300"></div>

            {/* 间距 */}
            <div className="flex items-center gap-1 flex-1 relative group">
              <Space className="h-3 w-3 text-[#30B8D6] flex-shrink-0" />
              <input
                type="number"
                value={spacing}
                step={0.1}
                onChange={(e) => updateLabelData({ spacing: Number(e.target.value) })}
                className="w-full bg-transparent focus:outline-none text-sm px-1"
                style={{ color: theme.text }}
                title="间距"
              />
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                间距
              </div>
            </div>

            <div className="h-4 w-px bg-gray-300"></div>

            {/* 行高 */}
            <div className="flex items-center gap-1 flex-1 relative group">
              <AlignJustify className="h-3 w-3 text-[#30B8D6] flex-shrink-0" />
              <input
                type="number"
                value={lineHeight}
                step={0.1}
                onChange={(e) => updateLabelData({ lineHeight: Number(e.target.value) })}
                className="w-full bg-transparent focus:outline-none text-sm px-1"
                style={{ color: theme.text }}
                title="行高"
              />
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                行高
              </div>
            </div>
          </div>

          {/* 第三行：默认值操作按钮 - 三个按钮平均分布 */}
          <div className="flex items-center gap-2">
            <button
              onClick={saveFontDefaults}
              className="flex-1 px-2 py-1 rounded text-xs flex items-center justify-center gap-1 transition-opacity"
              style={{
                backgroundColor: theme.primary,
                color: theme.buttonText,
              }}
              title="将当前字体参数保存为默认值"
            >
              <BookmarkPlus size={12} />
              设为默认值
            </button>
            
            <button
              onClick={applyFontDefaults}
              className="flex-1 px-2 py-1 rounded text-xs flex items-center justify-center gap-1 transition-opacity"
              style={{
                backgroundColor: theme.secondary,
                color: theme.buttonText,
              }}
              title="应用已保存的字体默认值"
            >
              <BookmarkCheck size={12} />
              应用默认值
            </button>

            <button
              onClick={setAndApplyFontSettings}
              className="flex-1 px-2 py-1 rounded text-xs flex items-center justify-center gap-1 transition-opacity"
              style={{
                backgroundColor: theme.accent,
                color: theme.buttonText,
              }}
              title="将当前字体大小、间距、行高应用到整个工单的所有语言（序号字符大小会根据字体大小同步）"
            >
              <RefreshCw size={12} />
              设置并应用
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}