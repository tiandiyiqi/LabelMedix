"use client"

import { useContext, useState, useEffect, useRef } from "react"
import { ChevronDown, Edit3, Download, Sparkles, RotateCcw, Save, Type, Languages, Maximize2, Space, AlignJustify, BookmarkPlus, BookmarkCheck, Zap, Settings, AlignLeft, AlignRight, RefreshCw } from "lucide-react"
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { calculatePageWidth, calculatePageMargins } from '../utils/calculatePageWidth'
import { getProjectById, getCountryDetails, getTranslationsByCountry, updateFormattedSummary, savePdfFile } from '@/lib/projectApi'
import { getLabelSettings, saveLabelSettings, convertSettingsToLabelData, convertLabelDataToSettings, getProjectLabelConfig } from '@/lib/labelSettingsApi'
import { pdf } from '@react-pdf/renderer'

export default function LabelEditor() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const { labelData, updateLabelData, setSelectedProject } = useLabelContext()
  const { selectedLanguage, selectedNumber, drugInfo, fontFamily, secondaryFontFamily, fontSize, spacing, lineHeight, labelWidth, labelHeight, selectedProject, basicInfo, numberField, drugName, numberOfSheets, drugDescription, companyName, labelCategory } = labelData

  const [selectedNumberState, setSelectedNumberState] = useState<number>(Number(selectedNumber))
  
  // 使用 ref 存储 originalSummary，避免闭包问题
  const originalSummaryRef = useRef<string | undefined>(labelData.originalSummary)
  
  // 字体默认值管理
  const FONT_DEFAULTS_KEY = 'labelmedix_font_defaults'
  const PROJECT_FONT_SYNC_KEY = 'labelmedix_project_font_sync'
  const PROJECT_APPLIED_KEY = 'labelmedix_project_applied' // 记录已应用的语言
  
  // 保存字体参数为默认值
  const saveFontDefaults = () => {
    const defaults = {
      fontSize: labelData.fontSize,
      spacing: labelData.spacing,
      lineHeight: labelData.lineHeight,
      sequenceFontSize: labelData.fontSize // 序号字符大小根据主字体大小同步
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
          fontSize: defaults.fontSize,
          spacing: defaults.spacing,
          lineHeight: defaults.lineHeight,
          sequenceFontSize: defaults.fontSize // 序号字符大小根据主字体大小同步
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
  
  // 使用 ref 存储 formatStates，避免闭包问题
  const formatStatesRef = useRef<{[key: string]: number}>(formatStates)
  
  // 使用 ref 存储格式化后的字段内容，避免闭包问题
  const formattedFieldsRef = useRef<{
    basicInfo?: string
    numberField?: string
    drugName?: string
    numberOfSheets?: string
    drugDescription?: string
    companyName?: string
  }>({})
  
  // 当 labelData.originalSummary 更新时，同步更新 ref
  useEffect(() => {
    originalSummaryRef.current = labelData.originalSummary
  }, [labelData.originalSummary])
  
  // 当 formatStates 更新时，同步更新 ref
  useEffect(() => {
    formatStatesRef.current = formatStates
  }, [formatStates])
  
  // 监控 fontFamily 变化（调试用）
  useEffect(() => {
    console.log('🎨 [Context更新] fontFamily变化:', {
      newFontFamily: fontFamily,
      newSecondaryFont: secondaryFontFamily,
      selectedLanguage: selectedLanguage
    })
  }, [fontFamily, secondaryFontFamily, selectedLanguage])
  // 轻量提示（非阻断式）
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>(
    { visible: false, message: '', type: 'info' }
  )
  const [availableSequences, setAvailableSequences] = useState<number[]>([])
  const [availableCountries, setAvailableCountries] = useState<string[]>([])
  const [dataLoadCompleted, setDataLoadCompleted] = useState<boolean>(false)
  
  // 跟踪用户是否手动修改了序号设置
  const [userModifiedSequencePosition, setUserModifiedSequencePosition] = useState<boolean>(false)
  
  // 跟踪后端数据是否存在
  const [backendDataExists, setBackendDataExists] = useState<boolean>(false)
  
  // 监听用户手动修改序号位置的事件
  useEffect(() => {
    const handleUserModifiedSequencePosition = () => {
      if (!userModifiedSequencePosition) {
        setUserModifiedSequencePosition(true);
      }
    };
    
    window.addEventListener('userModifiedSequencePosition', handleUserModifiedSequencePosition);
    
    return () => {
      window.removeEventListener('userModifiedSequencePosition', handleUserModifiedSequencePosition);
    };
  }, [userModifiedSequencePosition]);

  // 包装的updateLabelData函数，专门处理sequencePosition的优先级逻辑
  const wrappedUpdateLabelData = (data: Partial<typeof labelData>) => {
    // 如果更新中包含sequencePosition，并且用户还没有手动修改过，则标记为用户手动修改
    if (data.sequencePosition !== undefined && !userModifiedSequencePosition) {
      setUserModifiedSequencePosition(true)
    }
    
    // 调用原始的updateLabelData函数
    updateLabelData(data)
  }
  

  // 显示自动消失的提示
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 2000) => {
    setToast({ visible: true, message, type })
    window.setTimeout(() => setToast({ visible: false, message: '', type }), duration)
  }

  // 创建原始状态JSON（可以接受参数以避免状态更新延迟问题）
  const createOriginalSummary = (data?: {
    basicInfo?: string
    numberField?: string
    drugName?: string
    numberOfSheets?: string
    drugDescription?: string
    companyName?: string
  }) => {
    return JSON.stringify({
      basicInfo: data?.basicInfo ?? '',
      numberField: data?.numberField ?? '',
      drugName: data?.drugName ?? '',
      numberOfSheets: data?.numberOfSheets ?? '',
      drugDescription: data?.drugDescription ?? '',
      companyName: data?.companyName ?? ''
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
    
    // 大写英文字母（罗马数字相关字符）
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
    
    // 空格（调整为更准确的值）
    ' ': 0.35,  // 从0.25调整为0.35，更接近实际空格宽度
    
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
        
        // 罗马数字序号字体识别逻辑
        // 检查是否为罗马数字序号（I, II, III, IV, V, VI, VII, VIII, IX, X等）
        const isRomanNumeral = /^[IVXLCDM]+$/.test(char) && text.trim().match(/^[IVXLCDM]+\./);
        
        if (isRomanNumeral) {
          // 罗马数字序号使用英文字体计算宽度
          const englishFont = 'Arial, sans-serif';
          context.font = `${fontSize}pt ${englishFont}`;
          charWidth = context.measureText(char).width;
          // 恢复原始字体
          context.font = `${fontSize}pt ${fontFamily}`;
        } else if (/[\u4E00-\u9FA5]/.test(char)) {
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

  // 通用的列对齐函数（使用空格对齐）
  const alignColumnsToFirstLine = (firstLineSentences: string[], otherLineSentences: string[], containerWidth: number, fontSize: number, fontFamily: string): string => {
    if (otherLineSentences.length === 0) return ''
    
    // 计算第一行每个元素的宽度
    const firstLineElementWidths = firstLineSentences.map(text => measureTextWidth(text, fontSize, fontFamily))
    const firstLineTotalWidth = firstLineElementWidths.reduce((sum, width) => sum + width, 0)
    const firstLineAvailableSpace = containerWidth - firstLineTotalWidth
    const firstLineNumberOfGaps = firstLineSentences.length - 1
    const firstLineSpacing = firstLineNumberOfGaps > 0 ? Math.max(firstLineAvailableSpace / firstLineNumberOfGaps, mmToPt(1)) : 0
    
    // 计算第一行实际使用的空格数量（基于间距计算）
    const spaceWidth = fontSize * 0.35 // 空格宽度估算
    const firstLineActualSpaces = spacingToSpaces(firstLineSpacing, fontSize, fontFamily)
    const firstLineActualSpacing = firstLineActualSpaces * spaceWidth
    
    // 计算第一行每列的起始位置和结束位置
    const firstLineStartPositions: number[] = []
    const firstLineEndPositions: number[] = []
    let currentX = 0
    
    for (let i = 0; i < firstLineSentences.length; i++) {
      // 起始位置
      firstLineStartPositions.push(currentX)
      
      // 结束位置：如果是最后一列，结束位置就是文本结束位置；否则是文本结束位置+间距
      const textEndPosition = currentX + firstLineElementWidths[i]
      const columnEndPosition = i < firstLineSentences.length - 1 ? textEndPosition + firstLineActualSpacing : textEndPosition
      firstLineEndPositions.push(columnEndPosition)
      
      currentX = columnEndPosition
    }
    
    // 确保其他行有足够的元素，不足时用空字符串填充
    const alignedLine = []
    for (let i = 0; i < firstLineSentences.length; i++) {
      if (i < otherLineSentences.length) {
        alignedLine.push(otherLineSentences[i])
      } else {
        alignedLine.push('') // 用空字符串填充
      }
    }
    
    // 计算其他行每个元素的宽度
    const otherLineElementWidths = alignedLine.map(text => measureTextWidth(text, fontSize, fontFamily))
    
    // 使用第一行的列位置对齐其他行（使用空格对齐）
    const resultColumns: string[] = []
    
    for (let i = 0; i < alignedLine.length; i++) {
      const currentText = alignedLine[i]
      const currentWidth = otherLineElementWidths[i]
      
      // 计算前导空格（用于列对齐）- 简化逻辑，与下划线对齐函数保持一致
      let leadingSpaces = 0
      if (i > 0) {
        // 计算前面所有列的总宽度（使用已经计算好的列内容）
        let previousTotalWidth = 0
        for (let j = 0; j < i; j++) {
          previousTotalWidth += measureTextWidth(resultColumns[j], fontSize, fontFamily)
        }
        
        // 计算需要的前导空格数
        const requiredLeadingSpacing = firstLineStartPositions[i] - previousTotalWidth
        if (requiredLeadingSpacing > 0) {
          leadingSpaces = Math.max(0, Math.floor(requiredLeadingSpacing / spaceWidth))
          
          // 误差检查
          const actualSpacing = leadingSpaces * spaceWidth
          const spacingDiff = requiredLeadingSpacing - actualSpacing
          if (spacingDiff > spaceWidth / 2) {
            leadingSpaces += 1
          }
        }
      }
      
      // 计算尾随空格（用于填充列宽）- 动态调整基于第一行对应列
      let trailingSpaces = 0
      
      // 关键改进：使用第一行对应列的宽度作为基准，而不是当前列的宽度
      const firstLineColumnWidth = firstLineEndPositions[i] - firstLineStartPositions[i]
      
      // 计算当前列应该占用的总宽度（基于第一行对应列的宽度比例）
      const targetColumnWidth = firstLineColumnWidth
      
      // 计算剩余空间（考虑前导空格和当前文本宽度）
      const remainingSpace = targetColumnWidth - currentWidth - (leadingSpaces * spaceWidth)
      
      if (remainingSpace > 0) {
        trailingSpaces = Math.max(0, Math.floor(remainingSpace / spaceWidth))
        
        // 误差检查
        const actualSpacing = trailingSpaces * spaceWidth
        const spacingDiff = remainingSpace - actualSpacing
        if (spacingDiff > spaceWidth / 2) {
          trailingSpaces += 1
        }
      }
      
      // 构建当前列的内容：前导空格 + 文本 + 尾随空格
      const columnContent = safeRepeat(' ', leadingSpaces) + currentText + safeRepeat(' ', trailingSpaces)
      resultColumns.push(columnContent)
    }
    
    return resultColumns.join('')
  };

  // 使用下划线对齐的列对齐函数（专门用于numberField字段）
  const alignColumnsToFirstLineWithUnderscores = (firstLineSentences: string[], otherLineSentences: string[], containerWidth: number, fontSize: number, fontFamily: string, firstLineUnderscores: number = 0): string => {
    if (otherLineSentences.length === 0) return ''
    
    // 计算第一行每个元素的宽度
    const firstLineElementWidths = firstLineSentences.map(text => measureTextWidth(text, fontSize, fontFamily))
    const firstLineTotalWidth = firstLineElementWidths.reduce((sum, width) => sum + width, 0)
    const firstLineAvailableSpace = containerWidth - firstLineTotalWidth
    const firstLineNumberOfGaps = firstLineSentences.length - 1
    
    // 修复：如果只有一个元素，使用剩余空间；多个元素时使用缝隙间距
    let firstLineSpacing: number
    if (firstLineNumberOfGaps > 0) {
      firstLineSpacing = Math.max(firstLineAvailableSpace / firstLineNumberOfGaps, mmToPt(1))
    } else {
      // 只有一个元素时，使用到行尾的剩余空间
      firstLineSpacing = firstLineAvailableSpace > 0 ? firstLineAvailableSpace : 0
    }
    
    // 计算第一行实际使用的下划线数量（基于间距计算）
    const underscoreWidth = fontSize * 0.5 // 下划线宽度估算
    const firstLineActualUnderscores = spacingToUnderscores(firstLineSpacing, fontSize, fontFamily, firstLineSentences.length)
    const firstLineActualSpacing = firstLineActualUnderscores * underscoreWidth
    
    // 计算第一行每列的起始位置和结束位置
    const firstLineStartPositions: number[] = []
    const firstLineEndPositions: number[] = []
    let currentX = 0
    
    for (let i = 0; i < firstLineSentences.length; i++) {
      // 起始位置
      firstLineStartPositions.push(currentX)
      
      // 结束位置（文本结束位置 + 下划线区域结束位置）
      const textEndPosition = currentX + firstLineElementWidths[i]
      let columnEndPosition: number
      
      // 关键修复：当只有一个元素时，列结束位置就是容器宽度
      if (firstLineSentences.length === 1) {
        columnEndPosition = containerWidth
      } else {
        columnEndPosition = textEndPosition + firstLineActualSpacing
      }
      
      firstLineEndPositions.push(columnEndPosition)
      currentX = columnEndPosition
    }
    
    // 确保其他行有足够的元素，不足时用空字符串填充
    const alignedLine = []
    for (let i = 0; i < firstLineSentences.length; i++) {
      if (i < otherLineSentences.length) {
        alignedLine.push(otherLineSentences[i])
      } else {
        alignedLine.push('') // 用空字符串填充
      }
    }
    
    // 计算其他行每个元素的宽度
    const otherLineElementWidths = alignedLine.map(text => measureTextWidth(text, fontSize, fontFamily))
    
    // 使用第一行的列位置对齐其他行（使用下划线对齐）
    const resultColumns: string[] = []
    
    for (let i = 0; i < alignedLine.length; i++) {
      const currentText = alignedLine[i]
      const currentWidth = otherLineElementWidths[i]
      
      // 计算前导下划线（用于列对齐）
      let leadingUnderscores = 0
      if (i > 0) {
        // 计算前面所有列的总宽度
        let previousTotalWidth = 0
        for (let j = 0; j < i; j++) {
          previousTotalWidth += measureTextWidth(resultColumns[j], fontSize, fontFamily)
        }
        
        // 计算需要的前导下划线数
        const requiredLeadingSpacing = firstLineStartPositions[i] - previousTotalWidth
        if (requiredLeadingSpacing > 0) {
          leadingUnderscores = Math.max(0, Math.floor(requiredLeadingSpacing / underscoreWidth))
          
          // 误差检查
          const actualSpacing = leadingUnderscores * underscoreWidth
          const spacingDiff = requiredLeadingSpacing - actualSpacing
          if (spacingDiff > underscoreWidth / 2) {
            leadingUnderscores += 1
          }
        }
      }
      
      // 计算尾随下划线（用于填充列宽）- 动态调整基于第一行对应列
      let trailingUnderscores = 0
      
      // 关键改进：当只有一个元素时，所有行都应该填充到容器宽度（行尾对齐）
      let targetColumnWidth: number
      if (firstLineSentences.length === 1) {
        // 只有一个元素：目标是填充到容器宽度
        targetColumnWidth = containerWidth
      } else {
        // 多个元素：使用第一行对应列的宽度
        targetColumnWidth = firstLineEndPositions[i] - firstLineStartPositions[i]
      }
      
      // 计算剩余空间
      const remainingSpace = targetColumnWidth - currentWidth - (leadingUnderscores * underscoreWidth)
      
      // 先按正常逻辑计算下划线数量
      if (remainingSpace > 0) {
        trailingUnderscores = Math.max(0, Math.floor(remainingSpace / underscoreWidth))
        
        // 误差检查
        const actualSpacing = trailingUnderscores * underscoreWidth
        const spacingDiff = remainingSpace - actualSpacing
        if (spacingDiff > underscoreWidth / 2) {
          trailingUnderscores += 1
        }
      }
      
      // 关键改进：应用相同的调整规则（无论有几个元素）
      if (firstLineUnderscores > 0) {
        // 根据第一行的下划线数量计算调整量
        const adjustment = Math.floor(firstLineUnderscores / 8) + 1
        const originalTrailingUnderscores = trailingUnderscores
        // 从当前计算出的下划线数中减去调整量
        trailingUnderscores = Math.max(0, trailingUnderscores - adjustment)
        
        // 详细调试（可选）
        if (firstLineSentences.length === 1) {
          console.log(`📝 第${i+1}列 [${currentText.substring(0, 25)}]:`, {
            当前文本宽度: currentWidth.toFixed(2),
            目标总宽度: targetColumnWidth.toFixed(2),
            前导下划线: leadingUnderscores,
            剩余空间: remainingSpace.toFixed(2),
            计算的原始下划线数: originalTrailingUnderscores,
            调整量: adjustment,
            最终下划线数: trailingUnderscores,
            第1行下划线数: firstLineUnderscores
          })
        }
      }
      
      // 构建当前列的内容：前导下划线 + 文本 + 尾随下划线
      const columnContent = safeRepeat('_', leadingUnderscores) + currentText + safeRepeat('_', trailingUnderscores)
      resultColumns.push(columnContent)
    }
    
    return resultColumns.join('')
  };

  // 计算每列的x坐标
  const calculateColumnPositions = (containerWidth: number, elements: string[], fontSize: number, fontFamily: string): number[] => {
    // 安全检查：确保输入参数有效
    if (!elements || elements.length === 0 || containerWidth <= 0 || fontSize <= 0) {
      return []; // 返回空数组
    }

    // 计算每个元素的宽度
    const elementWidths = elements.map(text => measureTextWidth(text, fontSize, fontFamily));
    const totalContentWidth = elementWidths.reduce((sum, width) => sum + width, 0);
    
    // 计算可用空间和间距
    const availableSpace = containerWidth - totalContentWidth;
    const numberOfGaps = elements.length - 1;
    const spacing = numberOfGaps > 0 ? Math.max(availableSpace / numberOfGaps, mmToPt(1)) : 0;
    
    // 计算每列的x坐标
    const positions: number[] = [];
    let currentX = 0;
    
    for (let i = 0; i < elements.length; i++) {
      positions.push(currentX);
      currentX += elementWidths[i] + spacing;
    }
    
    return positions;
  };

  // 间距计算函数
  const calculateSpacing = (containerWidth: number, elements: string[], fontSize: number, fontFamily: string): number => {
    // 安全检查：确保输入参数有效
    if (!elements || elements.length === 0 || containerWidth <= 0 || fontSize <= 0) {
      return 0; // 返回0间距
    }

    // 1. 计算所有元素的总宽度
    const elementsWidth = elements.map(text => {
      const width = measureTextWidth(text, fontSize, fontFamily);
      return { text, width };
    });

    const totalContentWidth = elementsWidth.reduce((sum, item) => sum + item.width, 0);
    
    // 2. 从容器宽度中减去总宽度得到可用空间
    const availableSpace = containerWidth - totalContentWidth;
    
    // 3. 如果只有一个元素，返回到行尾的剩余空间（用于添加尾随下划线）
    if (elements.length === 1) {
      return availableSpace > 0 ? availableSpace : 0;
    }
    
    // 4. 计算需要分配间距的"缝隙"数量（N个元素有N-1个缝隙）
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
    // 增加限制以支持宽容器的下划线填充
    const safeCount = Math.max(0, Math.min(Math.floor(count), 200));
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
  // 注意：调整规则不在这里应用，而是在各个格式化函数中应用
  return Math.max(0, Math.min(underscoresPerSentence, 200)); // 最少0个下划线，最多200个下划线
};

// 应用下划线调整规则（基于第一行的下划线数量）
const applyUnderscoreAdjustment = (originalCount: number, firstLineUnderscores: number): number => {
  // 根据第一行的下划线数量计算调整量
  // 如果 < 8，调整量 = 1
  // 如果 8-15，调整量 = 2
  // 如果 16-23，调整量 = 3
  // 公式：调整量 = floor(firstLineUnderscores / 8) + 1
  const adjustment = Math.floor(firstLineUnderscores / 8) + 1;
  return Math.max(0, originalCount - adjustment);
};

  // ===== 数据库状态检查辅助函数 =====
  
  // 检查数据库状态：是否已初始化
  const checkIfInitialized = async (projectId: number, countryCode: string): Promise<boolean> => {
    try {
      const countryDetail = await getCountryDetails(projectId, countryCode)
      return !!countryDetail.original_summary && countryDetail.original_summary.trim() !== ''
    } catch (error) {
      return false
    }
  }

  // 检查数据库状态：是否已格式化
  const checkIfFormatted = async (projectId: number, countryCode: string): Promise<boolean> => {
    try {
      const countryDetail = await getCountryDetails(projectId, countryCode)
      if (!countryDetail.formatted_summary) return false
      
      // 检查 formatted_summary 是否包含 formatStates
      const formattedData = parseFormattedSummary(countryDetail.formatted_summary)
      return !!(formattedData && formattedData.formatStates)
    } catch (error) {
      return false
    }
  }

  // 检查数据库状态：是否已保存PDF
  const checkIfPdfSaved = async (projectId: number, countryCode: string): Promise<boolean> => {
    try {
      const countryDetail = await getCountryDetails(projectId, countryCode)
      return !!countryDetail.pdf_file_path && countryDetail.pdf_file_path.trim() !== ''
    } catch (error) {
      return false
    }
  }

  // ===== 链式自动工作流函数 =====
  
  // 链式初始化函数（在导入后自动调用，接受导入的数据以避免状态更新延迟）
  const handleInitializeWithChain = async (importedData?: {
    basicInfo?: string
    numberField?: string
    drugName?: string
    numberOfSheets?: string
    drugDescription?: string
    companyName?: string
  }) => {
    if (!selectedProject || !selectedLanguage) return
    
    try {
      await handleInitializeInternal(importedData) // 传递导入的数据
      
      // 等待状态更新完成
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 初始化完成后，执行格式化（格式化函数会检查并加载 originalSummary）
      handleFormatWithChain() // 调用链式格式化函数
    } catch (error) {
      console.error('链式初始化失败:', error)
    }
  }

  // 链式格式化函数（在初始化后自动调用）
  const handleFormatWithChain = async () => {
    if (!selectedProject || !selectedLanguage) return
    
    try {
      // 从数据库加载 originalSummary（确保获取最新值）
      const countryDetail = await getCountryDetails(selectedProject.id, selectedLanguage)
      if (!countryDetail.original_summary) {
        console.error('无法从数据库获取原始状态，格式化失败')
        showToast('无法获取原始状态，请先初始化', 'error')
        return
      }
      
      // 直接传递 originalSummary 给 handleFormat，避免状态更新延迟问题
      await handleFormat(countryDetail.original_summary)
      
      // 格式化完成后，等待状态更新完成，然后保存
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 调用保存函数
      await handleSave()
    } catch (error) {
      console.error('链式格式化失败:', error)
    }
  }


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

  // ========== 非阶梯标变量规则系统 ==========
  
  // 变量规则配置（按优先级排序，优先级高的在前）
  const VARIABLE_RULES = [
    { keywords: ['Expiry', 'Date', 'Year', 'Month', 'Day'], variable: 'YYYY/MM/DD', priority: 1 },
    { keywords: ['Expiry', 'Date', 'Month', 'Year'], variable: 'MM/YYYY', priority: 2 },
    { keywords: ['Expiry'], variable: 'YYYY/MM/DD', priority: 3 },
    { keywords: ['Protocol', 'No.'], variable: 'PPPPP-PPPPP-PPPPP', priority: 4 },
    { keywords: ['Packaging', 'Lot'], variable: 'BBBBBBBBBBBB', priority: 5 },
    { keywords: ['Batch', 'No.'], variable: 'BBBBBBBBBBBB', priority: 6 },
    { keywords: ['Manufacturing', 'Lot'], variable: 'LLLLLLLLLLLL', priority: 7 },
    { keywords: ['Kit', 'No.'], variable: 'XXXXXXXXXXXX', priority: 8 },
    { keywords: ['Med', 'ID'], variable: 'XXXXXXXXXXXX', priority: 9 },
    { keywords: ['Number', 'tablets', 'Bottle'], variable: 'TTT', priority: 10 },
    { keywords: ['Strength'], variable: 'DDD', priority: 11 }
  ]

  // 从翻译文本中提取第一个语言的翻译（" / " 之前）
  const getFirstTranslation = (translatedText: string): string => {
    return translatedText.split(' / ')[0].trim()
  }

  // 根据 original_text 匹配变量规则
  const matchVariableRule = (originalText: string): string | null => {
    if (!originalText) return null
    
    // 遍历规则，检查是否所有关键词都存在于 originalText 中
    for (const rule of VARIABLE_RULES) {
      const allKeywordsMatch = rule.keywords.every(keyword => 
        originalText.includes(keyword)
      )
      
      if (allKeywordsMatch) {
        console.log(`✅ 匹配到变量规则: ${originalText} -> ${rule.variable}`)
        return rule.variable
      }
    }
    
    return null
  }

  // 获取原文（从 originalTextMap 中查找）
  const getOriginalText = (translatedText: string): string | null => {
    if (!labelData.originalTextMap) return null
    
    const firstTranslation = getFirstTranslation(translatedText)
    const originalText = labelData.originalTextMap[firstTranslation]
    
    return originalText || null
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
      // 替换文本中的"XX"或"XXX"为带括号的罗马数字序号
      processedText = text.replace(/XXX?/g, () => {
        const romanNumber = getRomanNumber(currentIndex)
        currentIndex++
        return `(${romanNumber})`
      })
    }

    return { processedText, nextIndex: currentIndex }
  }

  // 计算当前罗马数字序号的起始位置
  const calculateRomanStartIndex = (fieldType: 'basicInfo' | 'drugName' | 'numberOfSheets'): number => {
    let startIndex = 1

    // 获取原始数据以计算行数/占位符
    const originalData = parseOriginalSummary(originalSummaryRef.current || labelData.originalSummary)
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

  // 初始化 - 保存当前状态为原始状态到数据库（内部实现，可以接受数据参数）
  const handleInitializeInternal = async (importedData?: {
    basicInfo?: string
    numberField?: string
    drugName?: string
    numberOfSheets?: string
    drugDescription?: string
    companyName?: string
  }) => {
    // 判断是否为阶梯标模式
    const isLadderMode = labelData.labelCategory === "阶梯标"
    
    // 前置检查：阶梯标模式需要检查项目和国别，非阶梯标模式只需要项目
    if (!selectedProject) {
      showToast('请先选择项目', 'info')
      return
    }
    
    if (isLadderMode && !selectedLanguage) {
      showToast('请先选择国别', 'info')
      return
    }

    try {
      setIsInitializing(true)
      
      // 检查是否有内容（如果有传入数据则使用传入数据，否则使用 labelData 中的值）
      const dataToCheck = importedData ? [
        importedData.basicInfo,
        importedData.numberField,
        importedData.drugName,
        importedData.numberOfSheets,
        importedData.drugDescription,
        importedData.companyName
      ] : [
        labelData.basicInfo,
        labelData.numberField,
        labelData.drugName,
        labelData.numberOfSheets,
        labelData.drugDescription,
        labelData.companyName
      ]
      
      const hasContent = dataToCheck.some(content => content && content.trim() !== '')
      
      if (!hasContent) {
        showToast('当前内容为空，无法初始化', 'info')
        return
      }
      
      // 创建包含6个字段的JSON格式原始状态
      // 如果有导入数据则使用导入数据，否则使用 labelData 中的当前值
      const dataToSave = importedData || {
        basicInfo: labelData.basicInfo ?? '',
        numberField: labelData.numberField ?? '',
        drugName: labelData.drugName ?? '',
        numberOfSheets: labelData.numberOfSheets ?? '',
        drugDescription: labelData.drugDescription ?? '',
        companyName: labelData.companyName ?? ''
      }
      
      const originalSummaryJson = createOriginalSummary(dataToSave)
      
      // 根据标签分类决定保存到哪个国别码
      // 阶梯标模式：保存到当前选中的国别码
      // 非阶梯标模式：保存到特殊国别码 "all"
      const targetCountryCode = isLadderMode ? selectedLanguage : "all"
      
      console.log('🔍 初始化数据检查:', {
        hasImportedData: !!importedData,
        dataToSave,
        isLadderMode,
        targetCountryCode,
        originalSummaryJson
      })
      
      // 保存原始状态到数据库
      await updateFormattedSummary(
        selectedProject.id,
        targetCountryCode,
        undefined, // 不更新formatted_summary
        undefined, // 不更新字体设置
        originalSummaryJson // 保存JSON格式的原始状态
      )
      
      console.log('✅ 初始化保存成功，originalSummaryJson:', originalSummaryJson)
      
      // 立即更新 ref 和状态，确保格式化功能可以访问到原始状态
      originalSummaryRef.current = originalSummaryJson
      updateLabelData({
        originalSummary: originalSummaryJson
      })
      
      if (isLadderMode) {
        showToast('6个字段的原始状态已初始化保存', 'success')
      } else {
        showToast(`6个字段的原始状态已初始化保存到国别码"all"`, 'success')
      }
      
    } catch (error) {
      console.error('初始化失败:', error)
      showToast('初始化失败，请重试', 'error')
    } finally {
      setIsInitializing(false)
    }
  }

  // 初始化按钮处理器（供UI按钮使用）
  const handleInitialize = async () => {
    await handleInitializeInternal()
  }

  // ========== 闪电图标格式化路由函数（根据标签类型调用对应函数）==========
  
  // 基本信息字段格式化路由函数
  const handleFormatBasicInfoButton = async () => {
    const isLadderMode = labelData.labelCategory === '阶梯标'
    if (isLadderMode) {
      handleFormatBasicInfo()
    } else {
      const prepared = await prepareNonLadderDataWithTextMap()
      if (!prepared) return
      
      const { originalData, originalTextMap } = prepared
      const variableMarkers: Array<{fieldName: string; lineIndex: number; startPos: number; endPos: number; isVariable: boolean}> = []
      const totalVariableCount = { value: 0 }
      
      const formattedText = handleFormatBasicInfoNonLadder(
        originalData.basicInfo || '',
        originalTextMap,
        variableMarkers,
        totalVariableCount
      )
      
      formattedFieldsRef.current.basicInfo = formattedText
      const existingMarkers = (labelData.variableMarkers || []).filter(m => m.fieldName !== 'basicInfo')
      updateLabelData({ 
        basicInfo: formattedText,
        variableMarkers: [...existingMarkers, ...variableMarkers]
      })
      
      const newStates = {
        ...formatStatesRef.current,
        basicInfo: 1
      }
      formatStatesRef.current = newStates
      setFormatStates(newStates)
      
      showToast(`基本信息格式化完成（变量：${totalVariableCount.value}）`, 'success')
    }
  }

  // 编号栏字段格式化路由函数
  const handleFormatNumberFieldButton = async () => {
    const isLadderMode = labelData.labelCategory === '阶梯标'
    if (isLadderMode) {
      handleFormatNumberField()
    } else {
      const originalData = await prepareNonLadderDataForRouting()
      if (!originalData) return
      
      const result = handleFormatNumberFieldNonLadder(originalData.numberField || '')
      
      formattedFieldsRef.current.numberField = result.formattedText
      updateLabelData({ numberField: result.formattedText })
      
      const newStates = {
        ...formatStatesRef.current,
        numberField: result.nextState
      }
      formatStatesRef.current = newStates
      setFormatStates(newStates)
      
      const stateNames = ['一行', '两行', '三行', '四行', '五行']
      showToast(`编号栏格式化完成（${stateNames[result.nextState]}）`, 'success')
    }
  }

  // 药品名称字段格式化路由函数
  const handleFormatDrugNameButton = async () => {
    const isLadderMode = labelData.labelCategory === '阶梯标'
    if (isLadderMode) {
      handleFormatDrugName()
    } else {
      const prepared = await prepareNonLadderDataWithTextMap()
      if (!prepared) return
      
      const { originalData, originalTextMap } = prepared
      const variableMarkers: Array<{fieldName: string; lineIndex: number; startPos: number; endPos: number; isVariable: boolean}> = []
      const totalVariableCount = { value: 0 }
      
      const formattedText = handleFormatDrugNameNonLadder(
        originalData.drugName || '',
        originalTextMap,
        variableMarkers,
        totalVariableCount
      )
      
      formattedFieldsRef.current.drugName = formattedText
      const existingMarkers = (labelData.variableMarkers || []).filter(m => m.fieldName !== 'drugName')
      updateLabelData({ 
        drugName: formattedText,
        variableMarkers: [...existingMarkers, ...variableMarkers]
      })
      
      const newStates = {
        ...formatStatesRef.current,
        drugName: 1
      }
      formatStatesRef.current = newStates
      setFormatStates(newStates)
      
      showToast(`药品名称格式化完成（变量：${totalVariableCount.value}）`, 'success')
    }
  }

  // 片数字段格式化路由函数
  const handleFormatNumberOfSheetsButton = async () => {
    const isLadderMode = labelData.labelCategory === '阶梯标'
    if (isLadderMode) {
      handleFormatNumberOfSheets()
    } else {
      const prepared = await prepareNonLadderDataWithTextMap()
      if (!prepared) return
      
      const { originalData, originalTextMap } = prepared
      const variableMarkers: Array<{fieldName: string; lineIndex: number; startPos: number; endPos: number; isVariable: boolean}> = []
      const totalVariableCount = { value: 0 }
      
      const formattedText = handleFormatNumberOfSheetsNonLadder(
        originalData.numberOfSheets || '',
        originalTextMap,
        variableMarkers,
        totalVariableCount
      )
      
      formattedFieldsRef.current.numberOfSheets = formattedText
      const existingMarkers = (labelData.variableMarkers || []).filter(m => m.fieldName !== 'numberOfSheets')
      updateLabelData({ 
        numberOfSheets: formattedText,
        variableMarkers: [...existingMarkers, ...variableMarkers]
      })
      
      const newStates = {
        ...formatStatesRef.current,
        numberOfSheets: 1
      }
      formatStatesRef.current = newStates
      setFormatStates(newStates)
      
      showToast(`片数格式化完成（变量：${totalVariableCount.value}）`, 'success')
    }
  }

  // 药品说明字段格式化路由函数
  const handleFormatDrugDescriptionButton = async () => {
    const isLadderMode = labelData.labelCategory === '阶梯标'
    if (isLadderMode) {
      handleFormatDrugDescription()
    } else {
      const originalData = await prepareNonLadderDataForRouting()
      if (!originalData) return
      
      const existingVariableCount = (labelData.variableMarkers || []).filter(m => m.isVariable).length
      const totalVariableCount = { value: existingVariableCount }
      
      const formattedText = handleFormatDrugDescriptionNonLadder(
        originalData.drugDescription || '',
        totalVariableCount
      )
      
      formattedFieldsRef.current.drugDescription = formattedText
      updateLabelData({ drugDescription: formattedText })
      
      const newStates = {
        ...formatStatesRef.current,
        drugDescription: 1
      }
      formatStatesRef.current = newStates
      setFormatStates(newStates)
      
      showToast('药品说明格式化完成', 'success')
    }
  }

  // 公司名称字段格式化路由函数
  const handleFormatCompanyNameButton = async () => {
    const isLadderMode = labelData.labelCategory === '阶梯标'
    if (isLadderMode) {
      handleFormatCompanyName()
    } else {
      const originalData = await prepareNonLadderDataForRouting()
      if (!originalData) return
      
      const currentFormatState = formatStatesRef.current.companyName || 0
      const { formattedText, nextState, toastMessage } = handleFormatCompanyNameNonLadder(
        originalData.companyName || '',
        currentFormatState
      )
      
      formattedFieldsRef.current.companyName = formattedText
      updateLabelData({ companyName: formattedText })
      
      const newStates = {
        ...formatStatesRef.current,
        companyName: nextState
      }
      formatStatesRef.current = newStates
      setFormatStates(newStates)
      
      showToast(toastMessage, 'success')
    }
  }

  // ========== 阶梯标格式化函数（保持不变）==========
  
  // 基于原始状态的格式化功能 - 基本信息
  const handleFormatBasicInfo = () => {
    // 解析原始状态JSON（优先使用 ref，避免闭包问题）
    const originalData: any = parseOriginalSummary(originalSummaryRef.current || labelData.originalSummary)
    
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
    const nextFormatState = (currentFormatState + 1) % 5

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
      
      // 第一行使用与alignColumnsToFirstLine函数完全一致的计算方式
      const firstLineElementWidths = firstLineSentences.map(text => measureTextWidth(text, labelData.fontSize, labelData.fontFamily))
      const firstLineTotalWidth = firstLineElementWidths.reduce((sum, width) => sum + width, 0)
      const firstLineAvailableSpace = containerWidth - firstLineTotalWidth
      const firstLineNumberOfGaps = firstLineSentences.length - 1
      const firstLineSpacing = firstLineNumberOfGaps > 0 ? Math.max(firstLineAvailableSpace / firstLineNumberOfGaps, mmToPt(1)) : 0
      
      // 使用与alignColumnsToFirstLineWithUnderscores函数相同的下划线计算逻辑
      const underscoreWidth = labelData.fontSize * 0.5 // 下划线宽度估算
      const firstLineActualUnderscores = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      const firstLineActualSpacing = firstLineActualUnderscores * underscoreWidth
      
      // 计算第一行每列的起始位置和结束位置（与对齐函数保持一致）
      const firstLineStartPositions: number[] = []
      const firstLineEndPositions: number[] = []
      let currentX = 0
      
      for (let i = 0; i < firstLineSentences.length; i++) {
        // 起始位置
        firstLineStartPositions.push(currentX)
        
        // 结束位置（文本结束位置 + 空格区域结束位置）
        const textEndPosition = currentX + firstLineElementWidths[i]
        const columnEndPosition = textEndPosition + firstLineActualSpacing
        firstLineEndPositions.push(columnEndPosition)
        
        currentX = columnEndPosition
      }
      
      // 构建第一行，使用与对齐函数相同的逻辑（添加前导空格计算）
      const firstLineColumns: string[] = []
      for (let i = 0; i < firstLineSentences.length; i++) {
        const currentText = firstLineSentences[i]
        const currentWidth = firstLineElementWidths[i]
        
        // 计算前导下划线（用于列对齐）- 与对齐函数保持一致
        let leadingUnderscores = 0
        if (i > 0) {
          // 计算前面所有列的总宽度
          let previousTotalWidth = 0
          for (let j = 0; j < i; j++) {
            const prevText = firstLineSentences[j]
            const prevWidth = firstLineElementWidths[j]
            
            // 计算前导下划线
            let prevLeadingUnderscores = 0
            if (j > 0) {
              const requiredPrevLeadingSpacing = firstLineStartPositions[j] - previousTotalWidth
              if (requiredPrevLeadingSpacing > 0) {
                prevLeadingUnderscores = Math.max(0, Math.floor(requiredPrevLeadingSpacing / underscoreWidth))
                
                // 误差检查
                const actualPrevSpacing = prevLeadingUnderscores * underscoreWidth
                const prevSpacingDiff = requiredPrevLeadingSpacing - actualPrevSpacing
                if (prevSpacingDiff > underscoreWidth / 2) {
                  prevLeadingUnderscores += 1
                }
              }
            }
            
            // 计算尾随下划线
            let prevTrailingUnderscores = 0
            const prevFirstLineColumnWidth = firstLineEndPositions[j] - firstLineStartPositions[j]
            const prevTargetColumnWidth = prevFirstLineColumnWidth
            const prevRemainingSpace = prevTargetColumnWidth - prevWidth - (prevLeadingUnderscores * underscoreWidth)
            
            if (prevRemainingSpace > 0) {
              prevTrailingUnderscores = Math.max(0, Math.floor(prevRemainingSpace / underscoreWidth))
              
              // 误差检查
              const actualPrevSpacing = prevTrailingUnderscores * underscoreWidth
              const prevSpacingDiff = prevRemainingSpace - actualPrevSpacing
              if (prevSpacingDiff > underscoreWidth / 2) {
                prevTrailingUnderscores += 1
              }
            }
            
            // 计算当前列的总宽度：前导下划线 + 文本 + 尾随下划线
            const prevColumnWidth = (prevLeadingUnderscores * underscoreWidth) + prevWidth + (prevTrailingUnderscores * underscoreWidth)
            previousTotalWidth += prevColumnWidth
          }
          
          // 计算需要的前导下划线数
          const requiredLeadingSpacing = firstLineStartPositions[i] - previousTotalWidth
          if (requiredLeadingSpacing > 0) {
            leadingUnderscores = Math.max(0, Math.floor(requiredLeadingSpacing / underscoreWidth))
            
            // 误差检查
            const actualSpacing = leadingUnderscores * underscoreWidth
            const spacingDiff = requiredLeadingSpacing - actualSpacing
            if (spacingDiff > underscoreWidth / 2) {
              leadingUnderscores += 1
            }
          }
        }
        
        // 计算尾随下划线（用于填充列宽）- 动态调整基于第一行对应列
        let trailingUnderscores = 0
        const firstLineColumnWidth = firstLineEndPositions[i] - firstLineStartPositions[i]
        const targetColumnWidth = firstLineColumnWidth
        const remainingSpace = targetColumnWidth - currentWidth - (leadingUnderscores * underscoreWidth)
        
        if (remainingSpace > 0) {
          trailingUnderscores = Math.max(0, Math.floor(remainingSpace / underscoreWidth))
          
          // 误差检查
          const actualSpacing = trailingUnderscores * underscoreWidth
          const spacingDiff = remainingSpace - actualSpacing
          if (spacingDiff > underscoreWidth / 2) {
            trailingUnderscores += 1
          }
        }
        
        // 构建当前列的内容：前导下划线 + 文本 + 尾随下划线
        const columnContent = safeRepeat('_', leadingUnderscores) + currentText + safeRepeat('_', trailingUnderscores)
        firstLineColumns.push(columnContent)
      }
      
      const firstLine = firstLineColumns.join('')
      
      // 第二行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `基本信息分为两行（第一行${firstLineSpacing}空格，第二行与第一行列对齐）`
    } else if (nextFormatState === 2) {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2)
      
      // 第一行使用与alignColumnsToFirstLine函数完全一致的计算方式
      const firstLineElementWidths = firstLineSentences.map(text => measureTextWidth(text, labelData.fontSize, labelData.fontFamily))
      const firstLineTotalWidth = firstLineElementWidths.reduce((sum, width) => sum + width, 0)
      const firstLineAvailableSpace = containerWidth - firstLineTotalWidth
      const firstLineNumberOfGaps = firstLineSentences.length - 1
      const firstLineSpacing = firstLineNumberOfGaps > 0 ? Math.max(firstLineAvailableSpace / firstLineNumberOfGaps, mmToPt(1)) : 0
      
      // 使用与alignColumnsToFirstLineWithUnderscores函数相同的下划线计算逻辑
      const underscoreWidth = labelData.fontSize * 0.5 // 下划线宽度估算
      const firstLineActualUnderscores = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      const firstLineActualSpacing = firstLineActualUnderscores * underscoreWidth
      
      // 计算第一行每列的起始位置和结束位置（与对齐函数保持一致）
      const firstLineStartPositions: number[] = []
      const firstLineEndPositions: number[] = []
      let currentX = 0
      
      for (let i = 0; i < firstLineSentences.length; i++) {
        // 起始位置
        firstLineStartPositions.push(currentX)
        
        // 结束位置（文本结束位置 + 空格区域结束位置）
        const textEndPosition = currentX + firstLineElementWidths[i]
        const columnEndPosition = textEndPosition + firstLineActualSpacing
        firstLineEndPositions.push(columnEndPosition)
        
        currentX = columnEndPosition
      }
      
      // 构建第一行，使用与对齐函数相同的逻辑
      const firstLineColumns: string[] = []
      for (let i = 0; i < firstLineSentences.length; i++) {
        const currentText = firstLineSentences[i]
        const currentWidth = firstLineElementWidths[i]
        
        // 计算尾随下划线（用于填充列宽）- 动态调整基于第一行对应列
        let trailingUnderscores = 0
        const firstLineColumnWidth = firstLineEndPositions[i] - firstLineStartPositions[i]
        const targetColumnWidth = firstLineColumnWidth
        const remainingSpace = targetColumnWidth - currentWidth
        
        if (remainingSpace > 0) {
          trailingUnderscores = Math.max(0, Math.floor(remainingSpace / underscoreWidth))
          
          // 误差检查
          const actualSpacing = trailingUnderscores * underscoreWidth
          const spacingDiff = remainingSpace - actualSpacing
          if (spacingDiff > underscoreWidth / 2) {
            trailingUnderscores += 1
          }
        }
        
        // 构建当前列的内容：文本 + 尾随下划线
        const columnContent = currentText + safeRepeat('_', trailingUnderscores)
        firstLineColumns.push(columnContent)
      }
      
      const firstLine = firstLineColumns.join('')
      
      // 第二行和第三行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `基本信息分为三行（第一行${firstLineSpacing}空格，其他行与第一行列对齐）`
    } else if (nextFormatState === 3) {
      // 分为四行
      const sentencesPerLine = Math.ceil(sentenceCount / 4)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3)
      const fourthLineSentences = sentences.slice(sentencesPerLine * 3)
      
      // 第一行使用与alignColumnsToFirstLine函数完全一致的计算方式
      const firstLineElementWidths = firstLineSentences.map(text => measureTextWidth(text, labelData.fontSize, labelData.fontFamily))
      const firstLineTotalWidth = firstLineElementWidths.reduce((sum, width) => sum + width, 0)
      const firstLineAvailableSpace = containerWidth - firstLineTotalWidth
      const firstLineNumberOfGaps = firstLineSentences.length - 1
      const firstLineSpacing = firstLineNumberOfGaps > 0 ? Math.max(firstLineAvailableSpace / firstLineNumberOfGaps, mmToPt(1)) : 0
      
      // 使用与alignColumnsToFirstLineWithUnderscores函数相同的下划线计算逻辑
      const underscoreWidth = labelData.fontSize * 0.5 // 下划线宽度估算
      const firstLineActualUnderscores = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      const firstLineActualSpacing = firstLineActualUnderscores * underscoreWidth
      
      // 计算第一行每列的起始位置和结束位置（与对齐函数保持一致）
      const firstLineStartPositions: number[] = []
      const firstLineEndPositions: number[] = []
      let currentX = 0
      
      for (let i = 0; i < firstLineSentences.length; i++) {
        // 起始位置
        firstLineStartPositions.push(currentX)
        
        // 结束位置（文本结束位置 + 空格区域结束位置）
        const textEndPosition = currentX + firstLineElementWidths[i]
        const columnEndPosition = textEndPosition + firstLineActualSpacing
        firstLineEndPositions.push(columnEndPosition)
        
        currentX = columnEndPosition
      }
      
      // 构建第一行，使用与对齐函数相同的逻辑
      const firstLineColumns: string[] = []
      for (let i = 0; i < firstLineSentences.length; i++) {
        const currentText = firstLineSentences[i]
        const currentWidth = firstLineElementWidths[i]
        
        // 计算尾随下划线（用于填充列宽）- 动态调整基于第一行对应列
        let trailingUnderscores = 0
        const firstLineColumnWidth = firstLineEndPositions[i] - firstLineStartPositions[i]
        const targetColumnWidth = firstLineColumnWidth
        const remainingSpace = targetColumnWidth - currentWidth
        
        if (remainingSpace > 0) {
          trailingUnderscores = Math.max(0, Math.floor(remainingSpace / underscoreWidth))
          
          // 误差检查
          const actualSpacing = trailingUnderscores * underscoreWidth
          const spacingDiff = remainingSpace - actualSpacing
          if (spacingDiff > underscoreWidth / 2) {
            trailingUnderscores += 1
          }
        }
        
        // 构建当前列的内容：文本 + 尾随下划线
        const columnContent = currentText + safeRepeat('_', trailingUnderscores)
        firstLineColumns.push(columnContent)
      }
      
      const firstLine = firstLineColumns.join('')
      
      // 其他行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const fourthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fourthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      
      formattedText = [firstLine, secondLine, thirdLine, fourthLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `基本信息分为四行（第一行${firstLineSpacing}空格，其他行与第一行列对齐）`
    } else if (nextFormatState === 4) {
      // 分为五行
      const sentencesPerLine = Math.ceil(sentenceCount / 5)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3)
      const fourthLineSentences = sentences.slice(sentencesPerLine * 3, sentencesPerLine * 4)
      const fifthLineSentences = sentences.slice(sentencesPerLine * 4)
      
      // 第一行使用与alignColumnsToFirstLine函数完全一致的计算方式
      const firstLineElementWidths = firstLineSentences.map(text => measureTextWidth(text, labelData.fontSize, labelData.fontFamily))
      const firstLineTotalWidth = firstLineElementWidths.reduce((sum, width) => sum + width, 0)
      const firstLineAvailableSpace = containerWidth - firstLineTotalWidth
      const firstLineNumberOfGaps = firstLineSentences.length - 1
      const firstLineSpacing = firstLineNumberOfGaps > 0 ? Math.max(firstLineAvailableSpace / firstLineNumberOfGaps, mmToPt(1)) : 0
      
      // 使用与alignColumnsToFirstLineWithUnderscores函数相同的下划线计算逻辑
      const underscoreWidth = labelData.fontSize * 0.5 // 下划线宽度估算
      const firstLineActualUnderscores = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      const firstLineActualSpacing = firstLineActualUnderscores * underscoreWidth
      
      // 计算第一行每列的起始位置和结束位置（与对齐函数保持一致）
      const firstLineStartPositions: number[] = []
      const firstLineEndPositions: number[] = []
      let currentX = 0
      
      for (let i = 0; i < firstLineSentences.length; i++) {
        // 起始位置
        firstLineStartPositions.push(currentX)
        
        // 结束位置（文本结束位置 + 空格区域结束位置）
        const textEndPosition = currentX + firstLineElementWidths[i]
        const columnEndPosition = textEndPosition + firstLineActualSpacing
        firstLineEndPositions.push(columnEndPosition)
        
        currentX = columnEndPosition
      }
      
      // 构建第一行，使用与对齐函数相同的逻辑
      const firstLineColumns: string[] = []
      for (let i = 0; i < firstLineSentences.length; i++) {
        const currentText = firstLineSentences[i]
        const currentWidth = firstLineElementWidths[i]
        
        // 计算尾随下划线（用于填充列宽）- 动态调整基于第一行对应列
        let trailingUnderscores = 0
        const firstLineColumnWidth = firstLineEndPositions[i] - firstLineStartPositions[i]
        const targetColumnWidth = firstLineColumnWidth
        const remainingSpace = targetColumnWidth - currentWidth
        
        if (remainingSpace > 0) {
          trailingUnderscores = Math.max(0, Math.floor(remainingSpace / underscoreWidth))
          
          // 误差检查
          const actualSpacing = trailingUnderscores * underscoreWidth
          const spacingDiff = remainingSpace - actualSpacing
          if (spacingDiff > underscoreWidth / 2) {
            trailingUnderscores += 1
          }
        }
        
        // 构建当前列的内容：文本 + 尾随下划线
        const columnContent = currentText + safeRepeat('_', trailingUnderscores)
        firstLineColumns.push(columnContent)
      }
      
      const firstLine = firstLineColumns.join('')
      
      // 其他行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const fourthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fourthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const fifthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fifthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      
      formattedText = [firstLine, secondLine, thirdLine, fourthLine, fifthLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `基本信息分为五行（第一行${firstLineActualUnderscores}下划线，其他行与第一行列对齐）`
    } else {
      // 分为一行
      // 计算整行的间距
      const lineSpacing = calculateSpacing(containerWidth, sentences, labelData.fontSize, labelData.fontFamily)
      const lineUnderscores = spacingToUnderscores(lineSpacing, labelData.fontSize, labelData.fontFamily, sentences.length)
      
      
      // 为每个元素后面添加下划线
      formattedText = sentences.map((text: string) => text + safeRepeat('_', lineUnderscores)).join('')
      toastMessage = `基本信息分为一行（已添加罗马数字序号和间距：${lineUnderscores}下划线）`
    }

    // 在处理完对齐计算后，将结果中的下划线替换为两个空格（保持相同视觉宽度）
    formattedText = formattedText.replace(/_/g, '  ')

    // 更新对应字段的内容（同时更新 ref 和 state）
    formattedFieldsRef.current.basicInfo = formattedText // 立即更新 ref
    updateLabelData({ basicInfo: formattedText })
    
    // 更新格式化状态（先直接更新 ref，然后更新 state）
    const newStates = {
      ...formatStatesRef.current, // 使用 ref 中的最新值，而不是闭包中的 formatStates
      basicInfo: nextFormatState
    }
    formatStatesRef.current = newStates // 立即更新 ref
    setFormatStates(newStates) // 更新 state

    showToast(toastMessage, 'success')
  }

  // 基于原始状态的格式化功能 - 编号栏
  const handleFormatNumberField = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(originalSummaryRef.current || labelData.originalSummary)
    
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
    const nextFormatState = (currentFormatState + 1) % 5

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
      
      // 第一行使用正常的间距计算
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineUnderscoresRaw = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      
      // 应用调整规则
      const firstLineUnderscores = applyUnderscoreAdjustment(firstLineUnderscoresRaw, firstLineUnderscoresRaw)
      
      // 为第一行每个元素后面添加下划线
      const firstLine = firstLineSentences.map((text: string) => text + safeRepeat('_', firstLineUnderscores)).join('')
      
      // 第二行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `编号栏分为两行（第一行每个字段后添加${firstLineUnderscores}下划线，第二行与第一行列对齐）`
    } else if (nextFormatState === 2) {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2)
      
      // 第一行使用正常的间距计算
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineUnderscoresRaw = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      
      // 应用调整规则
      const firstLineUnderscores = applyUnderscoreAdjustment(firstLineUnderscoresRaw, firstLineUnderscoresRaw)
      
      // 为第一行每个元素后面添加下划线
      const firstLine = firstLineSentences.map((text: string) => text + safeRepeat('_', firstLineUnderscores)).join('')
      
      // 第二行和第三行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `编号栏分为三行（第一行每个字段后添加${firstLineUnderscores}下划线，其他行与第一行列对齐）`
    } else if (nextFormatState === 3) {
      // 分为四行
      const sentencesPerLine = Math.ceil(sentenceCount / 4)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3)
      const fourthLineSentences = sentences.slice(sentencesPerLine * 3)
      
      // 第一行使用正常的间距计算
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineUnderscoresRaw = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      
      // 应用调整规则
      const firstLineUnderscores = applyUnderscoreAdjustment(firstLineUnderscoresRaw, firstLineUnderscoresRaw)
      
      // 为第一行每个元素后面添加下划线
      const firstLine = firstLineSentences.map((text: string) => text + safeRepeat('_', firstLineUnderscores)).join('')
      
      // 其他行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const fourthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fourthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      
      formattedText = [firstLine, secondLine, thirdLine, fourthLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `编号栏分为四行（第一行每个字段后添加${firstLineUnderscores}下划线，其他行与第一行列对齐）`
    } else if (nextFormatState === 4) {
      // 分为五行
      const sentencesPerLine = Math.ceil(sentenceCount / 5)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3)
      const fourthLineSentences = sentences.slice(sentencesPerLine * 3, sentencesPerLine * 4)
      const fifthLineSentences = sentences.slice(sentencesPerLine * 4)
      
      // 第一行使用正常的间距计算
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineUnderscoresRaw = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      
      // 应用调整规则
      const firstLineUnderscores = applyUnderscoreAdjustment(firstLineUnderscoresRaw, firstLineUnderscoresRaw)
      
      // 为第一行每个元素后面添加下划线
      const firstLine = firstLineSentences.map((text: string) => text + safeRepeat('_', firstLineUnderscores)).join('')
      
      // 其他行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const fourthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fourthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const fifthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fifthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      
      formattedText = [firstLine, secondLine, thirdLine, fourthLine, fifthLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = `编号栏分为五行（第一行每个字段后添加${firstLineUnderscores}下划线，其他行与第一行列对齐）`
    } else {
      // 分为一行
      const lineSpacing = calculateSpacing(containerWidth, sentences, labelData.fontSize, labelData.fontFamily)
      const lineUnderscoresRaw = spacingToUnderscores(lineSpacing, labelData.fontSize, labelData.fontFamily, sentences.length)
      
      // 应用调整规则
      const lineUnderscores = applyUnderscoreAdjustment(lineUnderscoresRaw, lineUnderscoresRaw)
      
      // 为每个元素后面添加下划线
      formattedText = sentences.map((text: string) => text + safeRepeat('_', lineUnderscores)).join('')
      toastMessage = `编号栏分为一行（每个字段后添加${lineUnderscores}下划线）`
    }

    // 更新对应字段的内容（同时更新 ref 和 state）
    formattedFieldsRef.current.numberField = formattedText // 立即更新 ref
    updateLabelData({ numberField: formattedText })
    
    // 更新格式化状态（先直接更新 ref，然后更新 state）
    const newStates = {
      ...formatStatesRef.current, // 使用 ref 中的最新值
      numberField: nextFormatState
    }
    formatStatesRef.current = newStates // 立即更新 ref
    setFormatStates(newStates) // 更新 state

    showToast(toastMessage, 'success')
  }

  // 基于原始状态的格式化功能 - 药品名称
  const handleFormatDrugName = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(originalSummaryRef.current || labelData.originalSummary)
    
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
    const nextFormatState = (currentFormatState + 1) % 5

    let formattedText = ''
    let toastMessage = ''

    if (nextFormatState === 1) {
      // 分为两行
      const sentencesPerLine = Math.ceil(sentenceCount / 2)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine).join(' ')
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '药品名称分为两行（已替换XX为罗马数字）'
    } else if (nextFormatState === 2) {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2).join(' ')
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '药品名称分为三行（已替换XX为罗马数字）'
    } else if (nextFormatState === 3) {
      // 分为四行
      const sentencesPerLine = Math.ceil(sentenceCount / 4)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3).join(' ')
      const fourthLine = sentences.slice(sentencesPerLine * 3).join(' ')
      formattedText = [firstLine, secondLine, thirdLine, fourthLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '药品名称分为四行（已替换XX为罗马数字）'
    } else if (nextFormatState === 4) {
      // 分为五行
      const sentencesPerLine = Math.ceil(sentenceCount / 5)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3).join(' ')
      const fourthLine = sentences.slice(sentencesPerLine * 3, sentencesPerLine * 4).join(' ')
      const fifthLine = sentences.slice(sentencesPerLine * 4).join(' ')
      formattedText = [firstLine, secondLine, thirdLine, fourthLine, fifthLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '药品名称分为五行（已替换XX为罗马数字）'
    } else {
      // 状态0：原始状态（不格式化）
      formattedText = variableControlledText
      toastMessage = '药品名称已恢复为原始状态（已替换XX为罗马数字）'
    }

    // 更新对应字段的内容（同时更新 ref 和 state）
    formattedFieldsRef.current.drugName = formattedText // 立即更新 ref
    updateLabelData({ drugName: formattedText })
    
    // 更新格式化状态（先直接更新 ref，然后更新 state）
    const newStates = {
      ...formatStatesRef.current, // 使用 ref 中的最新值
      drugName: nextFormatState
    }
    formatStatesRef.current = newStates // 立即更新 ref
    setFormatStates(newStates) // 更新 state

    showToast(toastMessage, 'success')
  }

  // 基于原始状态的格式化功能 - 片数
  const handleFormatNumberOfSheets = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(originalSummaryRef.current || labelData.originalSummary)
    
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
    const nextFormatState = (currentFormatState + 1) % 5

    let formattedText = ''
    let toastMessage = ''

    if (nextFormatState === 1) {
      // 分为两行
      const sentencesPerLine = Math.ceil(sentenceCount / 2)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine).join(' ')
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '片数分为两行（已替换XX为罗马数字）'
    } else if (nextFormatState === 2) {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2).join(' ')
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '片数分为三行（已替换XX为罗马数字）'
    } else if (nextFormatState === 3) {
      // 分为四行
      const sentencesPerLine = Math.ceil(sentenceCount / 4)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3).join(' ')
      const fourthLine = sentences.slice(sentencesPerLine * 3).join(' ')
      formattedText = [firstLine, secondLine, thirdLine, fourthLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '片数分为四行（已替换XX为罗马数字）'
    } else if (nextFormatState === 4) {
      // 分为五行
      const sentencesPerLine = Math.ceil(sentenceCount / 5)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3).join(' ')
      const fourthLine = sentences.slice(sentencesPerLine * 3, sentencesPerLine * 4).join(' ')
      const fifthLine = sentences.slice(sentencesPerLine * 4).join(' ')
      formattedText = [firstLine, secondLine, thirdLine, fourthLine, fifthLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '片数分为五行（已替换XX为罗马数字）'
    } else {
      // 状态0：原始状态（不格式化）
      formattedText = variableControlledText
      toastMessage = '片数已恢复为原始状态（已替换XX为罗马数字）'
    }

    // 更新对应字段的内容（同时更新 ref 和 state）
    formattedFieldsRef.current.numberOfSheets = formattedText // 立即更新 ref
    updateLabelData({ numberOfSheets: formattedText })
    
    // 更新格式化状态（先直接更新 ref，然后更新 state）
    const newStates = {
      ...formatStatesRef.current, // 使用 ref 中的最新值
      numberOfSheets: nextFormatState
    }
    formatStatesRef.current = newStates // 立即更新 ref
    setFormatStates(newStates) // 更新 state

    showToast(toastMessage, 'success')
  }

  // 基于原始状态的格式化功能 - 药品说明
  const handleFormatDrugDescription = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(originalSummaryRef.current || labelData.originalSummary)
    
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
    
    // 更新对应字段的内容（同时更新 ref 和 state）
    formattedFieldsRef.current.drugDescription = formattedText // 立即更新 ref
    updateLabelData({ drugDescription: formattedText })
    
    // 更新格式化状态（先直接更新 ref，然后更新 state）
    const newStates = {
      ...formatStatesRef.current, // 使用 ref 中的最新值
      drugDescription: 1
    }
    formatStatesRef.current = newStates // 立即更新 ref
    setFormatStates(newStates) // 更新 state

    showToast(`药品说明已智能优化为${optimizedLines.length}行（最大化利用率）`, 'success')
  }

  // 基于原始状态的格式化功能 - 公司名称
  const handleFormatCompanyName = () => {
    // 解析原始状态JSON
    const originalData: any = parseOriginalSummary(originalSummaryRef.current || labelData.originalSummary)
    
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
    const nextFormatState = (currentFormatState + 1) % 5

    let formattedText = ''
    let toastMessage = ''

    if (nextFormatState === 1) {
      // 分为两行
      const sentencesPerLine = Math.ceil(sentenceCount / 2)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine).join(' ')
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '公司名称分为两行'
    } else if (nextFormatState === 2) {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2).join(' ')
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '公司名称分为三行'
    } else if (nextFormatState === 3) {
      // 分为四行
      const sentencesPerLine = Math.ceil(sentenceCount / 4)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3).join(' ')
      const fourthLine = sentences.slice(sentencesPerLine * 3).join(' ')
      formattedText = [firstLine, secondLine, thirdLine, fourthLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '公司名称分为四行'
    } else if (nextFormatState === 4) {
      // 分为五行
      const sentencesPerLine = Math.ceil(sentenceCount / 5)
      const firstLine = sentences.slice(0, sentencesPerLine).join(' ')
      const secondLine = sentences.slice(sentencesPerLine, sentencesPerLine * 2).join(' ')
      const thirdLine = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3).join(' ')
      const fourthLine = sentences.slice(sentencesPerLine * 3, sentencesPerLine * 4).join(' ')
      const fifthLine = sentences.slice(sentencesPerLine * 4).join(' ')
      formattedText = [firstLine, secondLine, thirdLine, fourthLine, fifthLine].filter(line => line.trim() !== '').join('\n')
      toastMessage = '公司名称分为五行'
    } else {
      // 状态0：原始状态（不格式化）
      formattedText = originalText
      toastMessage = '公司名称已恢复为原始状态'
    }

    // 更新对应字段的内容（同时更新 ref 和 state）
    formattedFieldsRef.current.companyName = formattedText // 立即更新 ref
    updateLabelData({ companyName: formattedText })
    
    // 更新格式化状态（先直接更新 ref，然后更新 state）
    const newStates = {
      ...formatStatesRef.current, // 使用 ref 中的最新值
      companyName: nextFormatState
    }
    formatStatesRef.current = newStates // 立即更新 ref
    setFormatStates(newStates) // 更新 state

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
  }, [labelData.basicInfo, labelData.numberField, labelData.drugName, labelData.numberOfSheets, labelData.drugDescription, labelData.companyName])

  // 加载当前项目的可用序号和国别码
  useEffect(() => {
    const loadAvailableOptions = async () => {
      if (selectedProject) {
        try {
          const projectDetail = await getProjectById(selectedProject.id)
          if (projectDetail.translationGroups) {
            // 过滤掉 country_code = "all" 的记录（非阶梯标模式使用的特殊记录）
            const validGroups = projectDetail.translationGroups.filter(
              group => group.country_code.toLowerCase() !== 'all'
            )
            
            // 提取所有序号并排序（只包含有效国别）
            const sequences = validGroups
              .map(group => group.sequence_number)
              .sort((a, b) => a - b)
            setAvailableSequences(sequences)

            // 提取所有国别码并按序号排序（只包含有效国别）
            const countries = validGroups
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
      // 判断是否为阶梯标模式
      const isLadderMode = labelData.labelCategory === "阶梯标"
      
      // 条件检查：阶梯标模式需要 selectedLanguage，非阶梯标模式只需要 selectedProject
      if (!selectedProject) return
      if (isLadderMode && !selectedLanguage) return
      
      try {
        // 根据标签类型决定目标国别码
        // 阶梯标模式：使用 selectedLanguage
        // 非阶梯标模式：使用 'all'
        const targetCountryCode = isLadderMode ? selectedLanguage : "all"
        
        // 先加载标签预览区参数设置（不依赖国别详情）
        let labelDataFromSettings = null
        let backendSettingsExist = false
        
        // 标签设置加载：阶梯标模式需要加载特定国别的设置，非阶梯标模式可以跳过或使用默认值
        if (isLadderMode && selectedLanguage) {
          try {
            const shortCountryCode = extractShortCountryCode(selectedLanguage)
            const sequence = selectedProject.currentSequence || 1
            
            // 先获取项目级别的标签配置
            let projectLabelConfig = null
            try {
              projectLabelConfig = await getProjectLabelConfig(selectedProject.id)
            } catch (projectConfigError) {
              console.warn('⚠️ [useEffect-AutoLoad] 获取项目级别配置失败:', projectConfigError)
            }
            
            // 获取标签设置（后端已处理项目级别配置优先级）
            const labelSettings = await getLabelSettings(
              selectedProject.id,
              shortCountryCode,
              sequence
            )
            
            // 判断后端数据是否存在（非默认值）
            backendSettingsExist = !!(labelSettings && labelSettings.sequence_position !== '')
            setBackendDataExists(backendSettingsExist)
            
            labelDataFromSettings = convertSettingsToLabelData(labelSettings)
            
            // 如果项目级别配置存在，优先使用项目级别的标签配置
            // ⚠️ 注意：从数据库来的DECIMAL类型是字符串，需要转换为数字
            if (projectLabelConfig) {
              labelDataFromSettings = {
                ...labelDataFromSettings,
                labelWidth: parseFloat(String(projectLabelConfig.label_width)) || labelDataFromSettings.labelWidth,
                labelHeight: parseFloat(String(projectLabelConfig.label_height)) || labelDataFromSettings.labelHeight,
                // 不覆盖 labelCategory，保留用户当前的选择
                // labelCategory: projectLabelConfig.label_category || labelDataFromSettings.labelCategory,
                isWrapped: projectLabelConfig.is_wrapped !== undefined ? projectLabelConfig.is_wrapped : labelDataFromSettings.isWrapped
              }
            }
          } catch (labelError) {
            // console.warn('⚠️ [useEffect-AutoLoad] 加载标签设置失败，使用默认设置:', labelError)
            setBackendDataExists(false)
          }
        } else {
          // 非阶梯标模式：尝试获取项目级别的标签配置
          try {
            const projectLabelConfig = await getProjectLabelConfig(selectedProject.id)
            if (projectLabelConfig) {
              labelDataFromSettings = {
                labelWidth: parseFloat(String(projectLabelConfig.label_width)) || labelData.labelWidth,
                labelHeight: parseFloat(String(projectLabelConfig.label_height)) || labelData.labelHeight,
                // 不覆盖 labelCategory，保留用户当前的选择
                // labelCategory: projectLabelConfig.label_category || labelData.labelCategory,
                isWrapped: projectLabelConfig.is_wrapped !== undefined ? projectLabelConfig.is_wrapped : labelData.isWrapped
              }
            }
          } catch (projectConfigError) {
            console.warn('⚠️ [useEffect-AutoLoad] 获取项目级别配置失败:', projectConfigError)
          }
        }
        
        // 获取目标国别的详细信息
        let countryDetail = null
        try {
          countryDetail = await getCountryDetails(selectedProject.id, targetCountryCode)
        } catch (error: any) {
          // 非阶梯标模式：如果记录不存在（404），这是正常的（用户还没有初始化），静默处理
          // 阶梯标模式：如果记录不存在，也应该静默处理，避免报错
          if (error.message && error.message.includes('404')) {
            console.log(`ℹ️ [useEffect-AutoLoad] 国别 ${targetCountryCode} 的记录不存在，跳过数据加载`)
            // 清空字段，但保留标签设置（如果有）
            if (labelDataFromSettings) {
              const mergedData = {
                ...labelDataFromSettings,
                labelCategory: labelData.labelCategory,  // 保留当前的 labelCategory，不被数据库值覆盖
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
            }
            setFormatStates({
              basicInfo: 0,
              numberField: 0,
              drugName: 0,
              numberOfSheets: 0,
              drugDescription: 0,
              companyName: 0
            })
            setDataLoadCompleted(true)
            return
          }
          // 其他错误继续抛出
          throw error
        }
        
        // 如果记录不存在，直接返回
        if (!countryDetail) {
          return
        }
        
        // 尝试解析JSON格式的格式化状态
        const formattedData = parseFormattedSummary(countryDetail.formatted_summary)
        
        if (formattedData && formattedData.formatStates) {
          // 如果有JSON格式的格式化状态，加载6个字段和格式化状态
          const mergedData = {
            ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
            labelCategory: labelData.labelCategory,  // 保留当前的 labelCategory，不被数据库值覆盖
            basicInfo: formattedData.basicInfo ?? '',
            numberField: formattedData.numberField ?? '',
            drugName: formattedData.drugName ?? '',
            numberOfSheets: formattedData.numberOfSheets ?? '',
            drugDescription: formattedData.drugDescription ?? '',
            companyName: formattedData.companyName ?? '',
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
              labelCategory: labelData.labelCategory,  // 保留当前的 labelCategory，不被数据库值覆盖
              basicInfo: originalData.basicInfo ?? '',
              numberField: originalData.numberField ?? '',
              drugName: originalData.drugName ?? '',
              numberOfSheets: originalData.numberOfSheets ?? '',
              drugDescription: originalData.drugDescription ?? '',
              companyName: originalData.companyName ?? '',
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
              labelCategory: labelData.labelCategory,  // 保留当前的 labelCategory，不被数据库值覆盖
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
            
            // 检查字段是否为空，如果为空则自动触发导入
            // 延迟执行，确保数据加载完成
            setTimeout(async () => {
              const allFieldsEmpty = [
                labelData.basicInfo,
                labelData.numberField,
                labelData.drugName,
                labelData.numberOfSheets,
                labelData.drugDescription,
                labelData.companyName
              ].every(content => !content || content.trim() === '')
              
              // 检查数据库是否已初始化（双重检查）
              // 使用正确的目标国别码
              const isInitialized = await checkIfInitialized(selectedProject.id, targetCountryCode)
              const isFormatted = await checkIfFormatted(selectedProject.id, targetCountryCode)
              
              // 如果字段为空且数据库也没有初始化和格式化数据，则自动导入
              if (allFieldsEmpty && !isInitialized && !isFormatted) {
                showToast('检测到空白内容，开始自动导入...', 'info')
                await handleImport() // 这会自动触发后续的链式调用
              }
            }, 500)
            
          }
        }
      } catch (error) {
        // 出错时也清空字段，避免显示错误的旧数据
        updateLabelData({ 
          labelCategory: labelData.labelCategory,  // 保留当前的 labelCategory，不被覆盖
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

    loadFormattedContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, selectedLanguage, labelCategory])


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

    return text
  }

  // 重置到格式化状态
  const handleResetToFormatted = async () => {
    if (!selectedProject) { showToast('请先选择一个项目', 'info'); return }

    // 判断是否为阶梯标模式
    const isLadderMode = labelData.labelCategory === "阶梯标"
    
    // 前置检查：阶梯标模式需要国别，非阶梯标模式不需要
    if (isLadderMode && !selectedLanguage) {
      showToast('请先选择国别', 'info')
      return
    }

    try {
      setIsResetting(true)
      
      // 根据标签分类决定从哪个国别码获取数据
      // 阶梯标模式：从当前选中的国别码获取
      // 非阶梯标模式：从特殊国别码 "all" 获取
      const targetCountryCode = isLadderMode ? selectedLanguage : "all"
      
      // 获取该国别的详细信息
      const countryDetail = await getCountryDetails(selectedProject.id, targetCountryCode)
      
      // 尝试解析JSON格式的格式化状态
      const formattedData = parseFormattedSummary(countryDetail.formatted_summary)
      
      if (formattedData && formattedData.formatStates) {
        // 如果有JSON格式的格式化状态，恢复6个字段和格式化状态
        updateLabelData({ 
          basicInfo: formattedData.basicInfo ?? '',
          numberField: formattedData.numberField ?? '',
          drugName: formattedData.drugName ?? '',
          numberOfSheets: formattedData.numberOfSheets ?? '',
          drugDescription: formattedData.drugDescription ?? '',
          companyName: formattedData.companyName ?? '',
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
      console.error('重置失败:', error)
      showToast('重置失败，请重试', 'error')
    } finally {
      setIsResetting(false)
    }
  }

  // 重置到原始状态
  const handleResetToOriginal = async () => {
    if (!selectedProject) { showToast('请先选择一个项目', 'info'); return }

    // 判断是否为阶梯标模式
    const isLadderMode = labelData.labelCategory === "阶梯标"
    
    // 前置检查：阶梯标模式需要国别，非阶梯标模式不需要
    if (isLadderMode && !selectedLanguage) {
      showToast('请先选择国别', 'info')
      return
    }

    try {
      setIsResetting(true)
      
      // 根据标签分类决定从哪个国别码获取数据
      // 阶梯标模式：从当前选中的国别码获取
      // 非阶梯标模式：从特殊国别码 "all" 获取
      const targetCountryCode = isLadderMode ? selectedLanguage : "all"
      
      // 获取该国别的详细信息
      const countryDetail = await getCountryDetails(selectedProject.id, targetCountryCode)
      
      // 尝试解析JSON格式的原始状态
      const originalData = parseOriginalSummary(countryDetail.original_summary)
      
      console.log('🔍 恢复初始化数据检查:', {
        hasOriginalSummary: !!countryDetail.original_summary,
        originalSummary: countryDetail.original_summary,
        parsedData: originalData,
        isLadderMode,
        targetCountryCode
      })
      
      if (originalData) {
        // 如果有JSON格式的原始状态，恢复6个字段
        updateLabelData({ 
          basicInfo: originalData.basicInfo ?? '',
          numberField: originalData.numberField ?? '',
          drugName: originalData.drugName ?? '',
          numberOfSheets: originalData.numberOfSheets ?? '',
          drugDescription: originalData.drugDescription ?? '',
          companyName: originalData.companyName ?? '',
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
      console.error('重置失败:', error)
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
      
      // 判断是"阶梯标"还是其他类型
      if (labelData.labelCategory === "阶梯标") {
        // ========== 阶梯标模式：导入当前国别的翻译内容 ==========
        
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
        
        // 准备导入的数据（直接使用，不依赖状态更新）
        const importedData = {
          basicInfo: fieldTypeGroups.basic_info.join('\n'),
          numberField: fieldTypeGroups.number_field.join('\n'),
          drugName: fieldTypeGroups.drug_name.join('\n'),
          numberOfSheets: fieldTypeGroups.number_of_sheets.join('\n'),
          drugDescription: fieldTypeGroups.drug_description.join('\n'),
          companyName: fieldTypeGroups.company_name.join('\n')
        }
        
        // 更新到对应的字段类型区域，同时更新字体
        console.log('📥 [导入] 设置字体:', {
          selectedLanguage,
          autoFontFamily: autoFonts.fontFamily,
          autoSecondaryFont: autoFonts.secondaryFontFamily
        })
        updateLabelData({
          ...importedData,
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
        
        // 导入完成后，检查是否需要初始化
        if (selectedProject && selectedLanguage) {
          // 检查数据库是否已初始化
          const isInitialized = await checkIfInitialized(selectedProject.id, selectedLanguage)
          
          if (!isInitialized) {
            // 直接传递导入的数据，不依赖状态更新
            setTimeout(() => {
              handleInitializeWithChain(importedData) // 传递导入的实际数据
            }, 300)
          }
        }
        
      } else {
        // ========== 非阶梯标模式：导入所有国别（除"all"）的翻译内容并合并 ==========
        
        // 获取项目完整信息（包含所有国别翻译组）
        const projectDetail = await getProjectById(selectedProject.id)
        
        if (!projectDetail.translationGroups || projectDetail.translationGroups.length === 0) {
          showToast('该项目暂无翻译内容', 'info')
          return
        }
        
        // 过滤掉国别码为"all"的翻译组，并按序号排序
        const validGroups = projectDetail.translationGroups
          .filter(group => group.country_code.toLowerCase() !== 'all')
          .sort((a, b) => a.sequence_number - b.sequence_number)
        
        if (validGroups.length === 0) {
          showToast('没有可用的国别翻译内容', 'info')
          return
        }
        
        // 存储所有翻译内容，按 original_text 分组
        // key: original_text, value: 按序号排序的翻译文本数组
        const translationsByOriginal = new Map<string, { sequence: number; text: string; fieldType: string | null }[]>()
        
        // 获取每个国别的翻译详情并合并
        for (const group of validGroups) {
          try {
            const translationGroup = await getTranslationsByCountry(selectedProject.id, group.country_code)
            
            if (translationGroup.items && translationGroup.items.length > 0) {
              // 按 item_order 排序
              const sortedItems = translationGroup.items.sort((a, b) => a.item_order - b.item_order)
              
              sortedItems.forEach(item => {
                const originalText = item.original_text
                const translatedText = item.translated_text || item.original_text
                const fieldType = item.field_type || null
                
                if (!translationsByOriginal.has(originalText)) {
                  translationsByOriginal.set(originalText, [])
                }
                
                translationsByOriginal.get(originalText)!.push({
                  sequence: group.sequence_number,
                  text: translatedText,
                  fieldType: fieldType
                })
              })
            }
          } catch (error) {
            console.error(`获取国别 ${group.country_code} 的翻译失败:`, error)
          }
        }
        
        // 将合并后的翻译按字段类型分类
        const fieldTypeGroups = {
          basic_info: [] as string[],
          number_field: [] as string[],
          drug_name: [] as string[],
          number_of_sheets: [] as string[],
          drug_description: [] as string[],
          company_name: [] as string[]
        }
        
        // 创建 originalTextMap（翻译文本 -> 原文的映射）
        const originalTextMap: Record<string, string> = {}
        
        // 用于 company_name 字段的特殊处理：按 sequence 分组存储
        // key: sequence, value: Map<originalText, translations[]>
        const companyNameBySequence = new Map<number, Map<string, string[]>>()
        
        // 遍历每个原文，合并其翻译
        translationsByOriginal.forEach((translations, originalText) => {
          // 按序号排序
          translations.sort((a, b) => a.sequence - b.sequence)
          
          // 获取字段类型（使用第一个翻译的字段类型）
          const fieldType = translations[0].fieldType
          
          // 保存映射关系：第一个翻译 -> 原文（所有字段都处理）
          const firstTranslation = translations[0].text
          originalTextMap[firstTranslation] = originalText
          
          // 对于 company_name 字段，使用特殊处理逻辑
          if (fieldType === 'company_name') {
            // 按 sequence 分组
            translations.forEach(translation => {
              const sequence = translation.sequence
              
              if (!companyNameBySequence.has(sequence)) {
                companyNameBySequence.set(sequence, new Map())
              }
              
              const sequenceMap = companyNameBySequence.get(sequence)!
              if (!sequenceMap.has(originalText)) {
                sequenceMap.set(originalText, [])
              }
              
              sequenceMap.get(originalText)!.push(translation.text)
            })
          } else {
            // 其他字段：用 " / " 连接所有翻译
            // 先trim每个翻译文本，去除前后空格，再用 " / " 连接
            const mergedText = translations.map(t => t.text.trim()).join(' / ')
            
            // 分类到对应字段组
            if (fieldType && fieldTypeGroups[fieldType as keyof typeof fieldTypeGroups]) {
              fieldTypeGroups[fieldType as keyof typeof fieldTypeGroups].push(mergedText)
            } else {
              // 未分类的内容放入药品说明
              fieldTypeGroups.drug_description.push(mergedText)
            }
          }
        })
        
        // 处理 company_name 字段：按语言组分组，组内换行，组间空行
        if (companyNameBySequence.size > 0) {
          // 收集所有 company_name 的 original_text，保持顺序（使用 translationsByOriginal 的遍历顺序）
          const companyNameOriginalTexts: string[] = []
          translationsByOriginal.forEach((translations, originalText) => {
            if (translations[0].fieldType === 'company_name') {
              companyNameOriginalTexts.push(originalText)
            }
          })
          
          // 按 sequence 排序
          const sortedSequences = Array.from(companyNameBySequence.keys()).sort((a, b) => a - b)
          
          const companyNameGroups: string[] = []
          
          sortedSequences.forEach((sequence) => {
            const sequenceMap = companyNameBySequence.get(sequence)!
            
            // 每个语言组内的内容（按照统一的 original_text 顺序）
            const groupLines: string[] = []
            
            // 按照统一的 original_text 顺序遍历
            companyNameOriginalTexts.forEach(originalText => {
              if (sequenceMap.has(originalText)) {
                const texts = sequenceMap.get(originalText)!
                // 相同 original_text 的翻译添加到组内（通常只有一个，但保留扩展性）
                groupLines.push(...texts)
              }
            })
            
            // 添加该语言组的内容
            if (groupLines.length > 0) {
              companyNameGroups.push(groupLines.join('\n'))
            }
          })
          
          // 不同语言组之间用空行分隔
          fieldTypeGroups.company_name = companyNameGroups
        }
        
        console.log('📝 已创建 originalTextMap，共', Object.keys(originalTextMap).length, '条映射')
        
        // 使用默认字体（多语言混合，使用 Arial Unicode）
        const autoFonts = {
          fontFamily: 'Arial Unicode',
          secondaryFontFamily: 'Arial'
        }
        
        // 准备导入的数据
        // company_name 字段：不同语言组之间用空行分隔
        const importedData = {
          basicInfo: fieldTypeGroups.basic_info.join('\n'),
          numberField: fieldTypeGroups.number_field.join('\n'),
          drugName: fieldTypeGroups.drug_name.join('\n'),
          numberOfSheets: fieldTypeGroups.number_of_sheets.join('\n'),
          drugDescription: fieldTypeGroups.drug_description.join('\n'),
          companyName: fieldTypeGroups.company_name.join('\n\n') // 语言组之间用空行分隔
        }
        
        // 更新到对应的字段类型区域，同时更新字体和 originalTextMap
        updateLabelData({
          ...importedData,
          fontFamily: autoFonts.fontFamily,
          secondaryFontFamily: autoFonts.secondaryFontFamily,
          originalTextMap: originalTextMap,
          variableMarkers: [] // 初始时清空变量标记
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
        
        showToast(`已导入 ${validGroups.length} 个国别的翻译内容`, 'success')
        
        // 导入完成后，检查是否需要初始化（非阶梯标模式也需要）
        if (selectedProject) {
          // 检查数据库是否已初始化（使用"all"国别码）
          const isInitialized = await checkIfInitialized(selectedProject.id, 'all')
          
          console.log('🔍 非阶梯标导入后检查初始化状态:', {
            isInitialized,
            projectId: selectedProject.id,
            importedData
          })
          
          if (!isInitialized) {
            // 直接传递导入的数据，不依赖状态更新
            setTimeout(async () => {
              try {
                console.log('🚀 开始非阶梯标自动初始化...')
                await handleInitializeInternal(importedData) // 传递导入的实际数据
              } catch (error) {
                console.error('❌ 非阶梯标自动初始化失败:', error)
              }
            }, 300)
          }
        }
      }
      
    } catch (error) {
      console.error('导入失败:', error)
      showToast('导入失败，请重试', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  // ========== 非阶梯标格式化辅助函数 ==========
  
  // 从数据库加载 'all' 国别码的原始状态数据
  const loadAllCountryDataForNonLadder = async (projectId: number): Promise<string | undefined> => {
    try {
      const countryDetail = await getCountryDetails(projectId, 'all')
      if (countryDetail.original_summary) {
        // 更新状态和 ref
        originalSummaryRef.current = countryDetail.original_summary
        updateLabelData({
          originalSummary: countryDetail.original_summary
        })
        return countryDetail.original_summary
      }
    } catch (error) {
      console.error('从数据库加载原始状态失败:', error)
    }
    return undefined
  }

  // 构建 originalTextMap（用于变量规则匹配）
  const buildOriginalTextMapForNonLadder = async (projectId: number): Promise<Record<string, string>> => {
    // 获取项目完整信息（包含所有国别翻译组）
    const projectDetail = await getProjectById(projectId)
    
    if (!projectDetail.translationGroups || projectDetail.translationGroups.length === 0) {
      throw new Error('该项目暂无翻译内容，无法构建变量映射')
    }
    
    // 过滤掉国别码为"all"的翻译组，并按序号排序
    const validGroups = projectDetail.translationGroups
      .filter(group => group.country_code.toLowerCase() !== 'all')
      .sort((a, b) => a.sequence_number - b.sequence_number)
    
    if (validGroups.length === 0) {
      throw new Error('没有可用的国别翻译内容，无法构建变量映射')
    }
    
    // 构建 originalTextMap
    const originalTextMap: Record<string, string> = {}
    
    // 获取每个国别的翻译详情
    for (const group of validGroups) {
      try {
        const translationGroup = await getTranslationsByCountry(projectId, group.country_code)
        
        if (translationGroup.items && translationGroup.items.length > 0) {
          // 按 item_order 排序
          const sortedItems = translationGroup.items.sort((a, b) => a.item_order - b.item_order)
          
          sortedItems.forEach(item => {
            const originalText = item.original_text
            const translatedText = item.translated_text || item.original_text
            
            // 只保存第一个翻译的映射关系（用于变量规则匹配）
            if (!originalTextMap[translatedText]) {
              originalTextMap[translatedText] = originalText
            }
          })
        }
      } catch (error) {
        console.error(`获取国别 ${group.country_code} 的翻译失败:`, error)
      }
    }
    
    console.log(`  ✅ 已构建 originalTextMap，共 ${Object.keys(originalTextMap).length} 条映射`)
    return originalTextMap
  }

  // 从 originalTextMap 中获取原文
  const getOriginalTextFromMap = (translatedText: string, originalTextMap: Record<string, string>): string | null => {
    if (!originalTextMap) return null
    const firstTranslation = getFirstTranslation(translatedText)
    return originalTextMap[firstTranslation] || null
  }

  // 智能组合算法：最大化每行利用率
  const optimizeCombinationForNonLadder = (
    items: Array<{text: string, width: number}>,
    containerWidth: number,
    spaceWidth: number
  ): string[] => {
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
      const targetMultiplier = startRequiredMultiplier
      const maxTargetWidth = containerWidth * targetMultiplier
      
      // 从起始句子开始，尝试添加其他句子
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
        // 如果没有找到合适的组合，直接使用当前句子
        result.push(items[startIndex].text)
        used[startIndex] = true
      }
    }

    return result
  }

  // ========== 非阶梯标公共辅助函数 ==========
  
  // 为路由函数准备非阶梯标数据（不含变量映射）
  const prepareNonLadderDataForRouting = async () => {
    if (!selectedProject) {
      showToast('请先选择项目', 'info')
      return null
    }
    
    const originalSummaryToUse = await loadAllCountryDataForNonLadder(selectedProject.id)
    if (!originalSummaryToUse) {
      showToast('未找到原始状态，请先点击初始化', 'info')
      return null
    }
    
    const originalData: any = parseOriginalSummary(originalSummaryToUse)
    if (!originalData) {
      showToast('无法解析原始状态数据', 'error')
      return null
    }
    
    return originalData
  }

  // 为路由函数准备非阶梯标数据（含变量映射）
  const prepareNonLadderDataWithTextMap = async () => {
    const originalData = await prepareNonLadderDataForRouting()
    if (!originalData) return null
    
    if (!selectedProject) return null  // 额外检查以满足TypeScript
    
    let originalTextMapToUse = labelData.originalTextMap
    if (!originalTextMapToUse || Object.keys(originalTextMapToUse).length === 0) {
      try {
        originalTextMapToUse = await buildOriginalTextMapForNonLadder(selectedProject.id)
        updateLabelData({ originalTextMap: originalTextMapToUse })
      } catch (error: any) {
        showToast(error.message || '无法构建变量映射，请先导入翻译内容', 'error')
        return null
      }
    }
    
    return { originalData, originalTextMap: originalTextMapToUse }
  }

  // ========== 非阶梯标字段格式化函数 ==========
  
  // 处理 basicInfo 字段的非阶梯标格式化（包含变量添加、行数控制和对齐功能）
  const handleFormatBasicInfoNonLadder = (
    originalText: string,
    originalTextMap: Record<string, string>,
    variableMarkers: Array<{fieldName: string; lineIndex: number; startPos: number; endPos: number; isVariable: boolean}>,
    totalVariableCount: { value: number }
  ): string => {
    if (!originalText || !originalText.trim()) {
      return originalText
    }

    // 步骤1：先执行变量添加逻辑（保持现有功能）
    const lines = originalText.split('\n')
    const processedLines: string[] = []
    
    lines.forEach((line: string, lineIndex: number) => {
      if (!line.trim()) {
        processedLines.push(line)
        return
      }
      
      const originalTextFromMap = getOriginalTextFromMap(line, originalTextMap)
      if (originalTextFromMap) {
        const variable = matchVariableRule(originalTextFromMap)
        if (variable) {
          const newLine = `${line} ${variable}`
          processedLines.push(newLine)
          
          // 记录变量位置（注意：这里的 lineIndex 是原始行索引，后续行数控制后需要调整）
          variableMarkers.push({
            fieldName: 'basicInfo',
            lineIndex,
            startPos: line.length + 1,
            endPos: newLine.length,
            isVariable: true
          })
          
          totalVariableCount.value++
          console.log(`  ✅ basicInfo[${lineIndex}]: 添加变量 ${variable}`)
        } else {
          processedLines.push(line)
        }
      } else {
        processedLines.push(line)
      }
    })
    
    // 步骤2：应用行数控制和对齐功能（参考 handleFormatBasicInfo）
    // 【已禁用】行数控制和对齐功能已禁用，仅保留变量添加功能
    // 如需启用，请删除下面的 return 语句
    return processedLines.join('\n')
    
    /* ========== 以下代码已禁用，但保留供将来使用 ==========
    const textWithVariables = processedLines.join('\n')
    const sentences = textWithVariables.split('\n').filter((line: string) => line.trim() !== '')
    const sentenceCount = sentences.length

    if (sentenceCount === 0) {
      return textWithVariables
    }

    // 获取当前格式化状态并计算下一个状态
    const currentFormatState = formatStates.basicInfo || 0
    const nextFormatState = (currentFormatState + 1) % 5

    let formattedText = ''

    // 计算容器宽度（使用基础标签宽度，减去边距）
    const baseWidth = labelData.labelWidth
    const margins = calculatePageMargins(Number(labelData.selectedNumber))
    const effectiveWidth = baseWidth - margins.left - margins.right
    const safetyMargin = 2
    const containerWidth = mmToPt(Math.max(effectiveWidth - safetyMargin, effectiveWidth * 0.95))

    if (nextFormatState === 1) {
      // 分为两行
      const sentencesPerLine = Math.ceil(sentenceCount / 2)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine)
      
      // 第一行使用与alignColumnsToFirstLine函数完全一致的计算方式
      const firstLineElementWidths = firstLineSentences.map(text => measureTextWidth(text, labelData.fontSize, labelData.fontFamily))
      const firstLineTotalWidth = firstLineElementWidths.reduce((sum, width) => sum + width, 0)
      const firstLineAvailableSpace = containerWidth - firstLineTotalWidth
      const firstLineNumberOfGaps = firstLineSentences.length - 1
      const firstLineSpacing = firstLineNumberOfGaps > 0 ? Math.max(firstLineAvailableSpace / firstLineNumberOfGaps, mmToPt(1)) : 0
      
      // 使用与alignColumnsToFirstLineWithUnderscores函数相同的下划线计算逻辑
      const underscoreWidth = labelData.fontSize * 0.5
      const firstLineActualUnderscores = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      const firstLineActualSpacing = firstLineActualUnderscores * underscoreWidth
      
      // 计算第一行每列的起始位置和结束位置
      const firstLineStartPositions: number[] = []
      const firstLineEndPositions: number[] = []
      let currentX = 0
      
      for (let i = 0; i < firstLineSentences.length; i++) {
        firstLineStartPositions.push(currentX)
        const textEndPosition = currentX + firstLineElementWidths[i]
        const columnEndPosition = textEndPosition + firstLineActualSpacing
        firstLineEndPositions.push(columnEndPosition)
        currentX = columnEndPosition
      }
      
      // 构建第一行
      const firstLineColumns: string[] = []
      for (let i = 0; i < firstLineSentences.length; i++) {
        const currentText = firstLineSentences[i]
        const currentWidth = firstLineElementWidths[i]
        
        // 计算前导下划线
        let leadingUnderscores = 0
        if (i > 0) {
          let previousTotalWidth = 0
          for (let j = 0; j < i; j++) {
            const prevText = firstLineSentences[j]
            const prevWidth = firstLineElementWidths[j]
            
            let prevLeadingUnderscores = 0
            if (j > 0) {
              const requiredPrevLeadingSpacing = firstLineStartPositions[j] - previousTotalWidth
              if (requiredPrevLeadingSpacing > 0) {
                prevLeadingUnderscores = Math.max(0, Math.floor(requiredPrevLeadingSpacing / underscoreWidth))
                const actualPrevSpacing = prevLeadingUnderscores * underscoreWidth
                const prevSpacingDiff = requiredPrevLeadingSpacing - actualPrevSpacing
                if (prevSpacingDiff > underscoreWidth / 2) {
                  prevLeadingUnderscores += 1
                }
              }
            }
            
            let prevTrailingUnderscores = 0
            const prevFirstLineColumnWidth = firstLineEndPositions[j] - firstLineStartPositions[j]
            const prevRemainingSpace = prevFirstLineColumnWidth - prevWidth - (prevLeadingUnderscores * underscoreWidth)
            
            if (prevRemainingSpace > 0) {
              prevTrailingUnderscores = Math.max(0, Math.floor(prevRemainingSpace / underscoreWidth))
              const actualPrevSpacing = prevTrailingUnderscores * underscoreWidth
              const prevSpacingDiff = prevRemainingSpace - actualPrevSpacing
              if (prevSpacingDiff > underscoreWidth / 2) {
                prevTrailingUnderscores += 1
              }
            }
            
            const prevColumnWidth = (prevLeadingUnderscores * underscoreWidth) + prevWidth + (prevTrailingUnderscores * underscoreWidth)
            previousTotalWidth += prevColumnWidth
          }
          
          const requiredLeadingSpacing = firstLineStartPositions[i] - previousTotalWidth
          if (requiredLeadingSpacing > 0) {
            leadingUnderscores = Math.max(0, Math.floor(requiredLeadingSpacing / underscoreWidth))
            const actualSpacing = leadingUnderscores * underscoreWidth
            const spacingDiff = requiredLeadingSpacing - actualSpacing
            if (spacingDiff > underscoreWidth / 2) {
              leadingUnderscores += 1
            }
          }
        }
        
        // 计算尾随下划线
        let trailingUnderscores = 0
        const firstLineColumnWidth = firstLineEndPositions[i] - firstLineStartPositions[i]
        const remainingSpace = firstLineColumnWidth - currentWidth - (leadingUnderscores * underscoreWidth)
        
        if (remainingSpace > 0) {
          trailingUnderscores = Math.max(0, Math.floor(remainingSpace / underscoreWidth))
          const actualSpacing = trailingUnderscores * underscoreWidth
          const spacingDiff = remainingSpace - actualSpacing
          if (spacingDiff > underscoreWidth / 2) {
            trailingUnderscores += 1
          }
        }
        
        const columnContent = safeRepeat('_', leadingUnderscores) + currentText + safeRepeat('_', trailingUnderscores)
        firstLineColumns.push(columnContent)
      }
      
      const firstLine = firstLineColumns.join('')
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
    } else if (nextFormatState === 2) {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2)
      
      const firstLineElementWidths = firstLineSentences.map(text => measureTextWidth(text, labelData.fontSize, labelData.fontFamily))
      const firstLineTotalWidth = firstLineElementWidths.reduce((sum, width) => sum + width, 0)
      const firstLineAvailableSpace = containerWidth - firstLineTotalWidth
      const firstLineNumberOfGaps = firstLineSentences.length - 1
      const firstLineSpacing = firstLineNumberOfGaps > 0 ? Math.max(firstLineAvailableSpace / firstLineNumberOfGaps, mmToPt(1)) : 0
      
      const underscoreWidth = labelData.fontSize * 0.5
      const firstLineActualUnderscores = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      const firstLineActualSpacing = firstLineActualUnderscores * underscoreWidth
      
      const firstLineStartPositions: number[] = []
      const firstLineEndPositions: number[] = []
      let currentX = 0
      
      for (let i = 0; i < firstLineSentences.length; i++) {
        firstLineStartPositions.push(currentX)
        const textEndPosition = currentX + firstLineElementWidths[i]
        const columnEndPosition = textEndPosition + firstLineActualSpacing
        firstLineEndPositions.push(columnEndPosition)
        currentX = columnEndPosition
      }
      
      const firstLineColumns: string[] = []
      for (let i = 0; i < firstLineSentences.length; i++) {
        const currentText = firstLineSentences[i]
        const currentWidth = firstLineElementWidths[i]
        
        let trailingUnderscores = 0
        const firstLineColumnWidth = firstLineEndPositions[i] - firstLineStartPositions[i]
        const remainingSpace = firstLineColumnWidth - currentWidth
        
        if (remainingSpace > 0) {
          trailingUnderscores = Math.max(0, Math.floor(remainingSpace / underscoreWidth))
          const actualSpacing = trailingUnderscores * underscoreWidth
          const spacingDiff = remainingSpace - actualSpacing
          if (spacingDiff > underscoreWidth / 2) {
            trailingUnderscores += 1
          }
        }
        
        const columnContent = currentText + safeRepeat('_', trailingUnderscores)
        firstLineColumns.push(columnContent)
      }
      
      const firstLine = firstLineColumns.join('')
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
    } else if (nextFormatState === 3) {
      // 分为四行
      const sentencesPerLine = Math.ceil(sentenceCount / 4)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3)
      const fourthLineSentences = sentences.slice(sentencesPerLine * 3)
      
      const firstLineElementWidths = firstLineSentences.map(text => measureTextWidth(text, labelData.fontSize, labelData.fontFamily))
      const firstLineTotalWidth = firstLineElementWidths.reduce((sum, width) => sum + width, 0)
      const firstLineAvailableSpace = containerWidth - firstLineTotalWidth
      const firstLineNumberOfGaps = firstLineSentences.length - 1
      const firstLineSpacing = firstLineNumberOfGaps > 0 ? Math.max(firstLineAvailableSpace / firstLineNumberOfGaps, mmToPt(1)) : 0
      
      const underscoreWidth = labelData.fontSize * 0.5
      const firstLineActualUnderscores = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      const firstLineActualSpacing = firstLineActualUnderscores * underscoreWidth
      
      const firstLineStartPositions: number[] = []
      const firstLineEndPositions: number[] = []
      let currentX = 0
      
      for (let i = 0; i < firstLineSentences.length; i++) {
        firstLineStartPositions.push(currentX)
        const textEndPosition = currentX + firstLineElementWidths[i]
        const columnEndPosition = textEndPosition + firstLineActualSpacing
        firstLineEndPositions.push(columnEndPosition)
        currentX = columnEndPosition
      }
      
      const firstLineColumns: string[] = []
      for (let i = 0; i < firstLineSentences.length; i++) {
        const currentText = firstLineSentences[i]
        const currentWidth = firstLineElementWidths[i]
        
        let trailingUnderscores = 0
        const firstLineColumnWidth = firstLineEndPositions[i] - firstLineStartPositions[i]
        const remainingSpace = firstLineColumnWidth - currentWidth
        
        if (remainingSpace > 0) {
          trailingUnderscores = Math.max(0, Math.floor(remainingSpace / underscoreWidth))
          const actualSpacing = trailingUnderscores * underscoreWidth
          const spacingDiff = remainingSpace - actualSpacing
          if (spacingDiff > underscoreWidth / 2) {
            trailingUnderscores += 1
          }
        }
        
        const columnContent = currentText + safeRepeat('_', trailingUnderscores)
        firstLineColumns.push(columnContent)
      }
      
      const firstLine = firstLineColumns.join('')
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const fourthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fourthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      
      formattedText = [firstLine, secondLine, thirdLine, fourthLine].filter(line => line.trim() !== '').join('\n')
    } else if (nextFormatState === 4) {
      // 分为五行
      const sentencesPerLine = Math.ceil(sentenceCount / 5)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3)
      const fourthLineSentences = sentences.slice(sentencesPerLine * 3, sentencesPerLine * 4)
      const fifthLineSentences = sentences.slice(sentencesPerLine * 4)
      
      const firstLineElementWidths = firstLineSentences.map(text => measureTextWidth(text, labelData.fontSize, labelData.fontFamily))
      const firstLineTotalWidth = firstLineElementWidths.reduce((sum, width) => sum + width, 0)
      const firstLineAvailableSpace = containerWidth - firstLineTotalWidth
      const firstLineNumberOfGaps = firstLineSentences.length - 1
      const firstLineSpacing = firstLineNumberOfGaps > 0 ? Math.max(firstLineAvailableSpace / firstLineNumberOfGaps, mmToPt(1)) : 0
      
      const underscoreWidth = labelData.fontSize * 0.5
      const firstLineActualUnderscores = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      const firstLineActualSpacing = firstLineActualUnderscores * underscoreWidth
      
      const firstLineStartPositions: number[] = []
      const firstLineEndPositions: number[] = []
      let currentX = 0
      
      for (let i = 0; i < firstLineSentences.length; i++) {
        firstLineStartPositions.push(currentX)
        const textEndPosition = currentX + firstLineElementWidths[i]
        const columnEndPosition = textEndPosition + firstLineActualSpacing
        firstLineEndPositions.push(columnEndPosition)
        currentX = columnEndPosition
      }
      
      const firstLineColumns: string[] = []
      for (let i = 0; i < firstLineSentences.length; i++) {
        const currentText = firstLineSentences[i]
        const currentWidth = firstLineElementWidths[i]
        
        let trailingUnderscores = 0
        const firstLineColumnWidth = firstLineEndPositions[i] - firstLineStartPositions[i]
        const remainingSpace = firstLineColumnWidth - currentWidth
        
        if (remainingSpace > 0) {
          trailingUnderscores = Math.max(0, Math.floor(remainingSpace / underscoreWidth))
          const actualSpacing = trailingUnderscores * underscoreWidth
          const spacingDiff = remainingSpace - actualSpacing
          if (spacingDiff > underscoreWidth / 2) {
            trailingUnderscores += 1
          }
        }
        
        const columnContent = currentText + safeRepeat('_', trailingUnderscores)
        firstLineColumns.push(columnContent)
      }
      
      const firstLine = firstLineColumns.join('')
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const fourthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fourthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      const fifthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fifthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily)
      
      formattedText = [firstLine, secondLine, thirdLine, fourthLine, fifthLine].filter(line => line.trim() !== '').join('\n')
    } else {
      // 分为一行
      const lineSpacing = calculateSpacing(containerWidth, sentences, labelData.fontSize, labelData.fontFamily)
      const lineUnderscores = spacingToUnderscores(lineSpacing, labelData.fontSize, labelData.fontFamily, sentences.length)
      formattedText = sentences.map((text: string) => text + safeRepeat('_', lineUnderscores)).join('')
    }

    // 将下划线替换为两个空格（保持相同视觉宽度）
    formattedText = formattedText.replace(/_/g, '  ')
    
    return formattedText
    ========== 行数控制和对齐功能代码结束 ========== */
  }

  // 处理 drugName 字段的非阶梯标格式化（包含 XXX mg 特殊规则）
  const handleFormatDrugNameNonLadder = (
    originalText: string,
    originalTextMap: Record<string, string>,
    variableMarkers: Array<{fieldName: string; lineIndex: number; startPos: number; endPos: number; isVariable: boolean}>,
    totalVariableCount: { value: number }
  ): string => {
    if (!originalText || !originalText.trim()) {
      return originalText
    }

    const lines = originalText.split('\n')
    const processedLines: string[] = []
    
    lines.forEach((line: string, lineIndex: number) => {
      if (!line.trim()) {
        processedLines.push(line)
        return
      }
      
      const originalTextFromMap = getOriginalTextFromMap(line, originalTextMap)
      if (originalTextFromMap) {
        const variable = matchVariableRule(originalTextFromMap)
        if (variable) {
          // 匹配现有规则：行末追加变量
          const newLine = `${line} ${variable}`
          processedLines.push(newLine)
          
          // 记录变量位置
          variableMarkers.push({
            fieldName: 'drugName',
            lineIndex,
            startPos: line.length + 1,
            endPos: newLine.length,
            isVariable: true
          })
          
          totalVariableCount.value++
          console.log(`  ✅ drugName[${lineIndex}]: 添加变量 ${variable}`)
        } else if (originalTextFromMap.includes('XXX') && originalTextFromMap.includes('mg')) {
          // 特殊规则：如果原文包含 "XXX mg"，在翻译文本中替换所有 XXX 为 DDD
          let newLine = line
          
          // 查找所有 XXX 的位置并记录
          const xxxRegex = /XXX/g
          let match
          const matches: Array<{ index: number }> = []
          
          // 先找到所有匹配位置（在替换前记录位置）
          while ((match = xxxRegex.exec(line)) !== null) {
            matches.push({ index: match.index })
          }
          
          // 替换所有 XXX 为 DDD（因为长度相同，位置不会改变）
          newLine = line.replace(/XXX/g, 'DDD')
          
          // 记录每个替换位置的变量标记
          matches.forEach(({ index }) => {
            variableMarkers.push({
              fieldName: 'drugName',
              lineIndex,
              startPos: index,
              endPos: index + 3, // DDD 也是3个字符
              isVariable: true
            })
            
            totalVariableCount.value++
            console.log(`  ✅ drugName[${lineIndex}]: 替换 XXX 为 DDD (位置: ${index})`)
          })
          
          processedLines.push(newLine)
        } else {
          processedLines.push(line)
        }
      } else {
        processedLines.push(line)
      }
    })
    
    return processedLines.join('\n')
  }

  // 处理 numberOfSheets 字段的非阶梯标格式化
  const handleFormatNumberOfSheetsNonLadder = (
    originalText: string,
    originalTextMap: Record<string, string>,
    variableMarkers: Array<{fieldName: string; lineIndex: number; startPos: number; endPos: number; isVariable: boolean}>,
    totalVariableCount: { value: number }
  ): string => {
    if (!originalText || !originalText.trim()) {
      return originalText
    }

    const lines = originalText.split('\n')
    const processedLines: string[] = []
    
    lines.forEach((line: string, lineIndex: number) => {
      if (!line.trim()) {
        processedLines.push(line)
        return
      }
      
      const originalTextFromMap = getOriginalTextFromMap(line, originalTextMap)
      if (originalTextFromMap) {
        const variable = matchVariableRule(originalTextFromMap)
        if (variable) {
          const newLine = `${line} ${variable}`
          processedLines.push(newLine)
          
          // 记录变量位置
          variableMarkers.push({
            fieldName: 'numberOfSheets',
            lineIndex,
            startPos: line.length + 1,
            endPos: newLine.length,
            isVariable: true
          })
          
          totalVariableCount.value++
          console.log(`  ✅ numberOfSheets[${lineIndex}]: 添加变量 ${variable}`)
        } else {
          processedLines.push(line)
        }
      } else {
        processedLines.push(line)
      }
    })
    
    return processedLines.join('\n')
  }

  // 处理 drugDescription 字段的非阶梯标格式化（包含多语言分组、智能组合、罗马数字替换、分隔线）
  const handleFormatDrugDescriptionNonLadder = (
    originalText: string,
    totalVariableCount: { value: number }
  ): string => {
    if (!originalText || !originalText.trim()) {
      return originalText
    }

    // 步骤1：按语言分类收集内容
    const lines = originalText.split('\n').filter((line: string) => line.trim() !== '')
    const languageGroups: Map<number, string[]> = new Map() // key: 语言索引, value: 该语言的句子数组
    
    lines.forEach((line: string) => {
      // 按 " / " 分隔不同语言的翻译
      const translations = line.split(' / ').map((t: string) => t.trim()).filter((t: string) => t !== '')
      
      translations.forEach((translation: string, langIndex: number) => {
        if (!languageGroups.has(langIndex)) {
          languageGroups.set(langIndex, [])
        }
        languageGroups.get(langIndex)!.push(translation)
      })
    })
    
    console.log(`  📝 drugDescription: 检测到 ${languageGroups.size} 种语言`)
    
    // 步骤2：对每个语言组执行智能组合算法
    // 计算容器宽度（用于智能组合算法）
    const baseWidth = labelData.labelWidth
    const margins = calculatePageMargins(Number(labelData.selectedNumber))
    const effectiveWidth = baseWidth - margins.left - margins.right
    const safetyMargin = 2
    const containerWidth = mmToPt(Math.max(effectiveWidth - safetyMargin, effectiveWidth * 0.95))
    
    // 空格宽度
    const spaceWidth = measureTextWidth(' ', labelData.fontSize, labelData.fontFamily)
    
    // 用分隔线连接各个语言组
    // 根据页面宽度和"—"字符宽度动态计算分隔符长度
    const dashChar = '—'
    const dashWidth = measureTextWidth(dashChar, labelData.fontSize, labelData.fontFamily)
    // 计算需要多少个"—"字符才能填满容器宽度（使用95%的容器宽度）
    const separatorWidth = containerWidth * 0.95
    const dashCount = Math.max(1, Math.floor(separatorWidth / dashWidth))
    const separator = dashChar.repeat(dashCount)
    const result: string[] = []
    
    // 按语言索引排序处理
    const sortedLangIndices = Array.from(languageGroups.keys()).sort((a, b) => a - b)
    
    // 计算罗马序号起始索引（从累计变量数+1开始）
    const romanStartIndex = totalVariableCount.value + 1
    
    sortedLangIndices.forEach((langIndex, groupIndex) => {
      const sentences = languageGroups.get(langIndex)!
      const sentencesWithWidth = sentences.map((sentence: string) => ({
        text: sentence,
        width: measureTextWidth(sentence, labelData.fontSize, labelData.fontFamily)
      }))
      
      // 执行智能组合算法
      let optimizedLines = optimizeCombinationForNonLadder(sentencesWithWidth, containerWidth, spaceWidth)
      
      // 步骤3：对智能组合后的结果替换 XX/XXX 为罗马序号
      // 每个语言组独立计算罗马序号（都从 totalVariableCount + 1 开始）
      let currentRomanIndex = romanStartIndex
      optimizedLines = optimizedLines.map(line => {
        // 使用正则表达式匹配严格的 XX 或 XXX（前后有边界）
        return line.replace(/\bXX+\b/g, (match) => {
          const roman = getRomanNumber(currentRomanIndex)
          console.log(`  ✅ drugDescription[语言${langIndex + 1}]: 替换 ${match} 为罗马数字 ${roman} (序号: ${currentRomanIndex})`)
          currentRomanIndex++
          return roman
        })
      })
      
      // 添加该语言组的格式化结果
      result.push(...optimizedLines)
      
      // 如果不是最后一个语言组，添加分隔线
      if (groupIndex < sortedLangIndices.length - 1) {
        result.push(separator)
      }
    })
    
    console.log(`  ✅ drugDescription: 格式化完成，共 ${result.length} 行（包含分隔线），罗马序号从 ${romanStartIndex} 开始`)
    return result.join('\n')
  }

  // 处理 numberField 字段的非阶梯标格式化（包含行数控制和对齐功能）
  const handleFormatNumberFieldNonLadder = (originalText: string): { formattedText: string; nextState: number } => {
    if (!originalText || !originalText.trim()) {
      return { formattedText: originalText || '', nextState: 0 }
    }

    // 【已禁用】行数控制和对齐功能已禁用，仅返回原文本
    // 如需启用，请删除下面的 return 语句，并取消注释下面的代码块
    // return { formattedText: originalText, nextState: 0 }
    
    
    // 将原始状态按行分割为数组
    const sentences = originalText.split('\n').filter((line: string) => line.trim() !== '')
    const sentenceCount = sentences.length

    if (sentenceCount === 0) {
      return { formattedText: originalText, nextState: 0 }
    }

    // 获取当前格式化状态并计算下一个状态
    const currentFormatState = formatStates.numberField || 0
    const nextFormatState = (currentFormatState + 1) % 5

    let formattedText = ''

    // 计算容器宽度（使用基础标签宽度，减去边距）
    const baseWidth = labelData.labelWidth
    const margins = calculatePageMargins(Number(labelData.selectedNumber))
    const effectiveWidth = baseWidth - margins.left - margins.right
    const safetyMargin = 2
    const containerWidth = mmToPt(Math.max(effectiveWidth - safetyMargin, effectiveWidth * 0.95))

    if (nextFormatState === 1) {
      // 分为两行
      const sentencesPerLine = Math.ceil(sentenceCount / 2)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine)
      
      // 第一行使用正常的间距计算
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineUnderscoresRaw = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      
      // 应用调整规则
      const firstLineUnderscores = applyUnderscoreAdjustment(firstLineUnderscoresRaw, firstLineUnderscoresRaw)
      
      // 为第一行每个元素后面添加下划线
      const firstLine = firstLineSentences.map((text: string) => text + safeRepeat('_', firstLineUnderscores)).join('')
      
      // 第二行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      
      formattedText = [firstLine, secondLine].filter(line => line.trim() !== '').join('\n')
    } else if (nextFormatState === 2) {
      // 分为三行
      const sentencesPerLine = Math.ceil(sentenceCount / 3)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2)
      
      // 第一行使用正常的间距计算
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineUnderscoresRaw = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      
      // 应用调整规则
      const firstLineUnderscores = applyUnderscoreAdjustment(firstLineUnderscoresRaw, firstLineUnderscoresRaw)
      
      // 为第一行每个元素后面添加下划线
      const firstLine = firstLineSentences.map((text: string) => text + safeRepeat('_', firstLineUnderscores)).join('')
      
      // 第二行和第三行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      
      formattedText = [firstLine, secondLine, thirdLine].filter(line => line.trim() !== '').join('\n')
    } else if (nextFormatState === 3) {
      // 分为四行
      const sentencesPerLine = Math.ceil(sentenceCount / 4)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3)
      const fourthLineSentences = sentences.slice(sentencesPerLine * 3)
      
      // 第一行使用正常的间距计算
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineUnderscoresRaw = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      
      // 应用调整规则
      const firstLineUnderscores = applyUnderscoreAdjustment(firstLineUnderscoresRaw, firstLineUnderscoresRaw)
      
      // 详细调试第1行计算
      const firstLineText = firstLineSentences[0]
      const firstLineTextWidth = measureTextWidth(firstLineText, labelData.fontSize, labelData.fontFamily)
      const adjustment = Math.floor(firstLineUnderscoresRaw / 8) + 1
      console.log(`🎯 4行格式 - 第1行:`, {
        容器宽度: containerWidth.toFixed(2),
        字段数: firstLineSentences.length,
        字段内容: firstLineText.substring(0, 30),
        字段文本宽度: firstLineTextWidth.toFixed(2),
        计算得到的间距: firstLineSpacing.toFixed(2),
        原始下划线数: firstLineUnderscoresRaw,
        调整量: adjustment,
        最终下划线数: firstLineUnderscores
      })
      
      // 为第一行每个元素后面添加下划线
      const firstLine = firstLineSentences.map((text: string) => text + safeRepeat('_', firstLineUnderscores)).join('')
      
      console.log(`🔄 调用对齐函数 - 第2-4行，使用第1行下划线数: ${firstLineUnderscores}`)
      
      // 其他行使用第一行的列坐标对齐（使用下划线对齐），并直接使用第一行的下划线数量
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const fourthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fourthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      
      formattedText = [firstLine, secondLine, thirdLine, fourthLine].filter(line => line.trim() !== '').join('\n')
    } else if (nextFormatState === 4) {
      // 分为五行
      const sentencesPerLine = Math.ceil(sentenceCount / 5)
      const firstLineSentences = sentences.slice(0, sentencesPerLine)
      const secondLineSentences = sentences.slice(sentencesPerLine, sentencesPerLine * 2)
      const thirdLineSentences = sentences.slice(sentencesPerLine * 2, sentencesPerLine * 3)
      const fourthLineSentences = sentences.slice(sentencesPerLine * 3, sentencesPerLine * 4)
      const fifthLineSentences = sentences.slice(sentencesPerLine * 4)
      
      // 第一行使用正常的间距计算
      const firstLineSpacing = calculateSpacing(containerWidth, firstLineSentences, labelData.fontSize, labelData.fontFamily)
      const firstLineUnderscoresRaw = spacingToUnderscores(firstLineSpacing, labelData.fontSize, labelData.fontFamily, firstLineSentences.length)
      
      // 应用调整规则
      const firstLineUnderscores = applyUnderscoreAdjustment(firstLineUnderscoresRaw, firstLineUnderscoresRaw)
      
      // 为第一行每个元素后面添加下划线
      const firstLine = firstLineSentences.map((text: string) => text + safeRepeat('_', firstLineUnderscores)).join('')
      
      // 其他行使用第一行的列坐标对齐（使用下划线对齐）
      const secondLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, secondLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const thirdLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, thirdLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const fourthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fourthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      const fifthLine = alignColumnsToFirstLineWithUnderscores(firstLineSentences, fifthLineSentences, containerWidth, labelData.fontSize, labelData.fontFamily, firstLineUnderscores)
      
      formattedText = [firstLine, secondLine, thirdLine, fourthLine, fifthLine].filter(line => line.trim() !== '').join('\n')
    } else {
      // 分为一行
      const lineSpacing = calculateSpacing(containerWidth, sentences, labelData.fontSize, labelData.fontFamily)
      const lineUnderscoresRaw = spacingToUnderscores(lineSpacing, labelData.fontSize, labelData.fontFamily, sentences.length)
      
      // 应用调整规则
      const lineUnderscores = applyUnderscoreAdjustment(lineUnderscoresRaw, lineUnderscoresRaw)
      
      // 为每个元素后面添加下划线
      formattedText = sentences.map((text: string) => text + safeRepeat('_', lineUnderscores)).join('')
    }
    
    return { formattedText, nextState: nextFormatState }

  }

  // 检测文本行的主要语言类型（中文或英文）
  const detectLineLanguage = (line: string): 'chinese' | 'english' | 'mixed' => {
    if (!line || !line.trim()) return 'mixed'
    
    let chineseCount = 0
    let englishCount = 0
    let totalChars = 0
    
    for (const char of line) {
      const code = char.charCodeAt(0)
      // 检测中文字符（CJK统一汉字）
      if (code >= 0x4E00 && code <= 0x9FFF) {
        chineseCount++
        totalChars++
      }
      // 检测英文字母
      else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        englishCount++
        totalChars++
      }
      // 其他字符（标点、数字等）不计入统计
    }
    
    if (totalChars === 0) return 'mixed'
    
    // 如果中文字符占比超过30%，认为是中文
    if (chineseCount / totalChars > 0.3) return 'chinese'
    // 如果英文字符占比超过30%，认为是英文
    if (englishCount / totalChars > 0.3) return 'english'
    // 否则认为是混合
    return 'mixed'
  }

  // 处理 companyName 字段的非阶梯标格式化
  const handleFormatCompanyNameNonLadder = (
    originalText: string,
    currentFormatState: number
  ): { formattedText: string; nextState: number; toastMessage: string } => {
    if (!originalText || !originalText.trim()) {
      return {
        formattedText: originalText || '',
        nextState: 0,
        toastMessage: '公司名称字段为空'
      }
    }

    // 计算下一个状态（循环：0 -> 1 -> 2 -> 0）
    const nextFormatState = (currentFormatState + 1) % 3
    let formattedText = ''
    let toastMessage = ''

    if (nextFormatState === 0) {
      // 状态0：恢复为原始状态
      formattedText = originalText
      toastMessage = '公司名称已恢复为原始状态'
    } else if (nextFormatState === 1) {
      // 状态1：第一次格式化 - 将以冒号结尾的行与下一行合并
      const lines = originalText.split('\n')
      const result: string[] = []
      let i = 0
      
      while (i < lines.length) {
        const currentLine = lines[i].trim()
        
        // 如果当前行以冒号结尾，尝试与下一行合并
        if (currentLine && (currentLine.endsWith(':') || currentLine.endsWith('：'))) {
          // 检查下一行是否存在且非空
          if (i + 1 < lines.length && lines[i + 1].trim()) {
            // 合并当前行和下一行，中间用一个空格连接
            result.push(currentLine + ' ' + lines[i + 1].trim())
            i += 2 // 跳过下一行，因为已经合并了
          } else {
            // 下一行不存在或为空，保留当前行
            result.push(currentLine)
            i++
          }
        } else if (currentLine) {
          // 当前行不以冒号结尾，直接保留
          result.push(currentLine)
          i++
        } else {
          // 空行，保留
          result.push('')
          i++
        }
      }
      
      formattedText = result.join('\n')
      toastMessage = '公司名称已格式化（冒号行合并）'
    } else if (nextFormatState === 2) {
      // 状态2：第二次格式化 - 将同一种语言的行合并为一行
      // 首先需要从原始状态进行第一次格式化，然后再进行第二次格式化
      // 为了简化，我们假设输入已经是第一次格式化后的结果
      // 如果输入是原始状态，先进行第一次格式化
      let inputText = originalText
      
      // 检查是否需要进行第一次格式化（如果还有冒号行未合并）
      const lines = originalText.split('\n')
      let needsFirstFormat = false
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim()
        if (line && (line.endsWith(':') || line.endsWith('：')) && lines[i + 1].trim()) {
          needsFirstFormat = true
          break
        }
      }
      
      // 如果需要，先进行第一次格式化
      if (needsFirstFormat) {
        const firstFormatLines = originalText.split('\n')
        const firstFormatResult: string[] = []
        let j = 0
        while (j < firstFormatLines.length) {
          const currentLine = firstFormatLines[j].trim()
          if (currentLine && (currentLine.endsWith(':') || currentLine.endsWith('：'))) {
            if (j + 1 < firstFormatLines.length && firstFormatLines[j + 1].trim()) {
              firstFormatResult.push(currentLine + ' ' + firstFormatLines[j + 1].trim())
              j += 2
            } else {
              firstFormatResult.push(currentLine)
              j++
            }
          } else if (currentLine) {
            firstFormatResult.push(currentLine)
            j++
          } else {
            firstFormatResult.push('')
            j++
          }
        }
        inputText = firstFormatResult.join('\n')
      }
      
      // 进行第二次格式化：按语言分组并合并
      const linesToProcess = inputText.split('\n')
      const result: string[] = []
      let currentGroup: string[] = []
      let currentLanguage: 'chinese' | 'english' | 'mixed' | null = null as 'chinese' | 'english' | 'mixed' | null
      
      for (let i = 0; i < linesToProcess.length; i++) {
        const line = linesToProcess[i].trim()
        
        if (!line) {
          // 遇到空行，先处理当前组，然后添加空行
          if (currentGroup.length > 0) {
            result.push(currentGroup.join(' '))
            currentGroup = []
            currentLanguage = null
          }
          result.push('')
          continue
        }
        
        const lineLanguage = detectLineLanguage(line)
        
        // 如果语言类型匹配，加入当前组
        if (currentLanguage === null) {
          // 当前组为空，直接加入
          currentGroup.push(line)
          if (lineLanguage !== 'mixed') {
            currentLanguage = lineLanguage
          }
        } else if (lineLanguage === 'mixed') {
          // 混合语言行，可以加入任何组
          currentGroup.push(line)
        } else if (currentLanguage === 'mixed' as const) {
          // 当前组是混合语言，可以加入任何行
          currentGroup.push(line)
          currentLanguage = lineLanguage
        } else if (lineLanguage === currentLanguage) {
          // 语言类型匹配
          currentGroup.push(line)
        } else {
          // 语言类型不匹配，先处理当前组，然后开始新组
          if (currentGroup.length > 0) {
            result.push(currentGroup.join(' '))
          }
          currentGroup = [line]
          currentLanguage = lineLanguage
        }
      }
      
      // 处理最后一组
      if (currentGroup.length > 0) {
        result.push(currentGroup.join(' '))
      }
      
      formattedText = result.join('\n')
      toastMessage = '公司名称已格式化（同语言行合并）'
    }

    return {
      formattedText,
      nextState: nextFormatState,
      toastMessage
    }
  }

  // ========== 非阶梯标格式化函数 ==========
  const handleFormatNonLadder = async () => {
    try {
      // 步骤1：检查是否已初始化
      // 非阶梯标模式：必须从 country_code = 'all' 加载数据，而不是使用内存中的 originalSummary
      if (!selectedProject) {
        showToast('请先选择项目', 'info')
        return
      }
      
      // 使用辅助函数加载 'all' 数据
      const originalSummaryToUse = await loadAllCountryDataForNonLadder(selectedProject.id)
      
      if (!originalSummaryToUse) {
        showToast('未找到原始状态，请先点击初始化', 'info')
        return
      }
      
      // 步骤2：检查或构建 originalTextMap（用于变量规则匹配）
      let originalTextMapToUse = labelData.originalTextMap
      
      // 如果没有 originalTextMap，从数据库重新获取并构建
      if (!originalTextMapToUse || Object.keys(originalTextMapToUse).length === 0) {
        console.log('  📝 未找到 originalTextMap，从数据库重新获取...')
        
        try {
          originalTextMapToUse = await buildOriginalTextMapForNonLadder(selectedProject.id)
          
          // 保存到 labelData
          updateLabelData({
            originalTextMap: originalTextMapToUse
          })
        } catch (error: any) {
          console.error('构建 originalTextMap 失败:', error)
          showToast(error.message || '无法构建变量映射，请先导入翻译内容', 'error')
          return
        }
      }

      console.log('🎨 开始非阶梯标格式化...')
      
      // 步骤3：解析原始状态（使用 originalSummary，而不是 labelData 中的当前值）
      const originalData: any = parseOriginalSummary(originalSummaryToUse)
      if (!originalData) {
        showToast('无法解析原始状态数据', 'error')
        return
      }
      
      // 变量标记数组
      const variableMarkers: Array<{
        fieldName: string
        lineIndex: number
        startPos: number
        endPos: number
        isVariable: boolean
      }> = []
      
      // 累计变量数量（使用对象包装以便在函数内部修改）
      const totalVariableCount = { value: 0 }
      
      // 依次执行6个字段的非阶梯标格式化功能
      const formattedBasicInfo = handleFormatBasicInfoNonLadder(
        originalData.basicInfo || '',
        originalTextMapToUse,
        variableMarkers,
        totalVariableCount
      )
      
      const formattedDrugName = handleFormatDrugNameNonLadder(
        originalData.drugName || '',
        originalTextMapToUse,
        variableMarkers,
        totalVariableCount
      )
      
      const formattedNumberOfSheets = handleFormatNumberOfSheetsNonLadder(
        originalData.numberOfSheets || '',
        originalTextMapToUse,
        variableMarkers,
        totalVariableCount
      )
      
      const formattedDrugDescription = handleFormatDrugDescriptionNonLadder(
        originalData.drugDescription || '',
        totalVariableCount
      )
      
      const { formattedText: formattedNumberField } = handleFormatNumberFieldNonLadder(
        originalData.numberField || ''
      )
      
      // 批量格式化时，公司名称保持原始状态（状态0）
      const { formattedText: formattedCompanyName } = handleFormatCompanyNameNonLadder(
        originalData.companyName || '',
        0
      )
      
      console.log(`🎨 格式化完成：累计变量 ${totalVariableCount.value} 个`)
      
      // 更新数据
      updateLabelData({
        basicInfo: formattedBasicInfo,
        numberField: formattedNumberField,
        drugName: formattedDrugName,
        numberOfSheets: formattedNumberOfSheets,
        drugDescription: formattedDrugDescription,
        companyName: formattedCompanyName,
        variableMarkers: variableMarkers
      })
      
      // 设置格式化状态（非阶梯标模式：所有字段设置为 1，表示已格式化）
      const newFormatStates = {
        basicInfo: 1,
        numberField: 1,
        drugName: 1,
        numberOfSheets: 1,
        drugDescription: 1,
        companyName: 0 // companyName 初始状态为0，需要点击闪电图标才能格式化
      }
      formatStatesRef.current = newFormatStates
      setFormatStates(newFormatStates)
      
      showToast(`非阶梯标格式化完成（变量：${totalVariableCount.value}）`, 'success')
      
    } catch (error) {
      console.error('非阶梯标格式化失败:', error)
      showToast('格式化失败，请重试', 'error')
    }
  }

  // 格式化（可以接受 originalSummary 参数以避免状态更新延迟问题）
  const handleFormat = async (originalSummaryOverride?: string) => {
    try {
      setIsFormatting(true)
      
      // 判断是否为非阶梯标模式
      const isNonLadderMode = labelData.labelCategory !== '阶梯标'
      
      if (isNonLadderMode) {
        // 非阶梯标模式：使用新的格式化函数
        await handleFormatNonLadder()
        return
      }
      
      // ========== 以下是阶梯标模式的原有逻辑 ==========
      
      // 如果提供了 originalSummary 参数，临时设置到 labelData
      let originalSummaryToUse = originalSummaryOverride || labelData.originalSummary
      
      // 如果仍然没有，从数据库加载
      if (!originalSummaryToUse && selectedProject && selectedLanguage) {
        const countryDetail = await getCountryDetails(selectedProject.id, selectedLanguage)
        if (countryDetail.original_summary) {
          originalSummaryToUse = countryDetail.original_summary
          // 更新状态
          updateLabelData({
            originalSummary: originalSummaryToUse
          })
        }
      }
      
      // 如果最终还是没有，无法格式化
      if (!originalSummaryToUse) {
        showToast('未找到原始状态，请先初始化', 'error')
        return
      }
      
      // 直接更新 ref，这样格式化函数可以立即使用（不依赖状态更新）
      originalSummaryRef.current = originalSummaryToUse
      
      // 同时更新状态（用于其他地方）
      if (!labelData.originalSummary || originalSummaryToUse !== labelData.originalSummary) {
        updateLabelData({
          originalSummary: originalSummaryToUse
        })
      }
      
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
      
      // 格式化函数已经直接更新了 ref，所以不需要等待
      showToast('所有字段已完成格式化', 'success')
      
    } catch (error) {
      // console.error('格式化失败:', error)
      showToast('格式化失败，请重试', 'error')
    } finally {
      setIsFormatting(false)
    }
  }

  // 格式化按钮处理器（供UI按钮使用，不接受参数）
  const handleFormatButton = async () => {
    // 调用格式化函数（内部会根据 labelCategory 判断使用哪种格式化方式）
    await handleFormat()
  }

  // 创建格式化状态JSON（使用 ref 中的最新值，避免闭包问题）
  const createFormattedSummary = () => {
    // 优先使用 ref 中的值（格式化函数已更新），如果没有则使用 labelData
    const summary = {
      basicInfo: (formattedFieldsRef.current.basicInfo ?? labelData.basicInfo) ?? '',
      numberField: (formattedFieldsRef.current.numberField ?? labelData.numberField) ?? '',
      drugName: (formattedFieldsRef.current.drugName ?? labelData.drugName) ?? '',
      numberOfSheets: (formattedFieldsRef.current.numberOfSheets ?? labelData.numberOfSheets) ?? '',
      drugDescription: (formattedFieldsRef.current.drugDescription ?? labelData.drugDescription) ?? '',
      companyName: (formattedFieldsRef.current.companyName ?? labelData.companyName) ?? '',
      formatStates: formatStatesRef.current // 使用 ref 中的最新值，避免状态更新延迟问题
    }
    return JSON.stringify(summary)
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
    if (!selectedProject) { 
      showToast('请先选择一个项目', 'info'); 
      return 
    }

    const isNonLadderMode = labelData.labelCategory !== "阶梯标"

    try {
      setIsSaving(true)
      
      // 注意：不要用旧的 formatStates (state) 覆盖 formatStatesRef.current！
      // formatStatesRef.current 已经在格式化函数中更新了，直接使用即可
      
      // 创建包含6个字段和格式化状态的JSON
      let formattedSummaryJson: string
      
      // 检查格式化状态是否为空（两种模式都需要）
      if (!formatStatesRef.current || Object.keys(formatStatesRef.current).length === 0) {
        showToast('格式化状态为空，请先格式化', 'error')
        return
      }
      
      if (isNonLadderMode) {
        // 非阶梯标模式：保存字段内容、变量标记和格式化状态
        formattedSummaryJson = JSON.stringify({
          basicInfo: labelData.basicInfo,
          numberField: labelData.numberField,
          drugName: labelData.drugName,
          numberOfSheets: labelData.numberOfSheets,
          drugDescription: labelData.drugDescription,
          companyName: labelData.companyName,
          variableMarkers: labelData.variableMarkers || [],
          formatStates: formatStatesRef.current
        })
      } else {
        // 阶梯标模式：使用原有逻辑
        formattedSummaryJson = createFormattedSummary()
      }
      
      // 同时保存合并的文本内容（用于PDF生成）和JSON格式的详细状态（使用 labelData 中的最新值）
      const combinedContent = [
        labelData.basicInfo,
        labelData.numberField,
        labelData.drugName,
        labelData.numberOfSheets,
        labelData.drugDescription,
        labelData.companyName
      ].filter(content => content && content.trim() !== '').join('\n')
      
      // 确定保存时使用的国别码
      const targetCountryCode = isNonLadderMode ? 'all' : selectedLanguage
      
      // 获取当前语言自动选择的字体
      const autoFonts = getAutoFontsByLanguage(selectedLanguage)
      
      // 🔧 修复：如果当前字体与当前语言不匹配（可能是旧值），强制使用自动选择的字体
      let effectiveFontFamily = labelData.fontFamily
      let effectiveSecondaryFont = labelData.secondaryFontFamily
      
      // 检测是否为旧默认值且与当前语言不匹配
      const isOldDefaultFont = (font: string, autoFont: string) => {
        return (font === 'STHeiti' || font === 'Arial') && font !== autoFont
      }
      
      if (isOldDefaultFont(effectiveFontFamily, autoFonts.fontFamily)) {
        console.log('💾 [保存前] 检测到旧默认字体，强制使用自动选择:', {
          oldFont: effectiveFontFamily,
          newFont: autoFonts.fontFamily
        })
        effectiveFontFamily = autoFonts.fontFamily
      }
      
      if (isOldDefaultFont(effectiveSecondaryFont, autoFonts.secondaryFontFamily)) {
        console.log('💾 [保存前] 检测到旧默认次字体，强制使用自动选择:', {
          oldFont: effectiveSecondaryFont,
          newFont: autoFonts.secondaryFontFamily
        })
        effectiveSecondaryFont = autoFonts.secondaryFontFamily
      }
      
      console.log('💾 [保存前] 当前状态:', {
        selectedLanguage,
        originalFontFamily: labelData.fontFamily,
        originalSecondaryFont: labelData.secondaryFontFamily,
        effectiveFontFamily,
        effectiveSecondaryFont,
        autoFontFamily: autoFonts.fontFamily,
        autoSecondaryFont: autoFonts.secondaryFontFamily,
        targetCountryCode
      })
      
      // 智能保存字体：如果字体与自动选择的字体一致，则不保存（保存为null）
      // 这样可以避免保存默认值，切换时会自动使用正确的字体
      const fontSettingsToSave: {
        fontFamily?: string | null;
        secondaryFontFamily?: string | null;
        textAlign?: string;
        fontSize?: number;
        spacing?: number;
        lineHeight?: number;
      } = {
        textAlign: labelData.textAlign,
        fontSize: labelData.fontSize,
        spacing: labelData.spacing,
        lineHeight: labelData.lineHeight
      }
      
      // 如果字体与自动选择的字体不一致，且不为空，说明用户手动修改过，需要保存
      // 空字符串或与自动选择一致，都保存为 null
      console.log('💾 [保存] 字体判断:', {
        effectiveFontFamily,
        autoFontFamily: autoFonts.fontFamily,
        isMatch: effectiveFontFamily === autoFonts.fontFamily,
        isEmpty: !effectiveFontFamily || effectiveFontFamily === '',
        willSaveFontFamily: (effectiveFontFamily && effectiveFontFamily !== '' && effectiveFontFamily !== autoFonts.fontFamily) ? effectiveFontFamily : 'NULL',
        effectiveSecondaryFont,
        autoSecondaryFont: autoFonts.secondaryFontFamily,
        isSecondaryMatch: effectiveSecondaryFont === autoFonts.secondaryFontFamily,
        willSaveSecondaryFont: (effectiveSecondaryFont && effectiveSecondaryFont !== '' && effectiveSecondaryFont !== autoFonts.secondaryFontFamily) ? effectiveSecondaryFont : 'NULL'
      })
      
      if (effectiveFontFamily && effectiveFontFamily !== '' && effectiveFontFamily !== autoFonts.fontFamily) {
        fontSettingsToSave.fontFamily = effectiveFontFamily
        console.log('💾 [保存] fontFamily: 保存用户值 =', effectiveFontFamily)
      } else {
        fontSettingsToSave.fontFamily = null // 保存为null，表示使用自动选择
        console.log('💾 [保存] fontFamily: 保存NULL')
      }
      
      if (effectiveSecondaryFont && effectiveSecondaryFont !== '' && effectiveSecondaryFont !== autoFonts.secondaryFontFamily) {
        fontSettingsToSave.secondaryFontFamily = effectiveSecondaryFont
        console.log('💾 [保存] secondaryFontFamily: 保存用户值 =', effectiveSecondaryFont)
      } else {
        fontSettingsToSave.secondaryFontFamily = null // 保存为null，表示使用自动选择
        console.log('💾 [保存] secondaryFontFamily: 保存NULL')
      }
      
      // 1. 保存格式化翻译汇总和字体设置
      await updateFormattedSummary(selectedProject.id, targetCountryCode, formattedSummaryJson, fontSettingsToSave)

      // 立即更新本地状态，确保后续操作可以访问到最新的格式化状态
      updateLabelData({
        formatted_summary: formattedSummaryJson
      })
      
      if (isNonLadderMode) {
        // 非阶梯标模式：跳过标签预览区参数保存和PDF生成
        showToast('标签设置和格式化状态已保存', 'success')
      } else {
        // 阶梯标模式：保存标签预览区参数设置到数据库
        await saveLabelSettingsToDatabase(
          selectedProject.id,
          selectedLanguage,
          parseInt(selectedNumber)
        )
        
        // 触发PDF生成和保存（使用合并的文本内容）
        window.dispatchEvent(new CustomEvent('generate-and-save-pdf', {
          detail: {
            projectId: selectedProject.id,
            countryCode: selectedLanguage,
            sequenceNumber: selectedNumber,
            content: combinedContent // 传递合并的文本内容用于PDF生成
          }
        }));
        
        showToast('标签设置和格式化状态已保存，PDF正在生成中...', 'success')
      }
      
    } catch (error) {
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
    
    // 检查是否为意大利语
    const isItalian = () => {
      if (!language) return false;
      return language.includes('IT') || language.includes('Italy') || language.includes('Italian');
    };
    
    // 根据语言设置对应的字体
    if (language === 'CN' || language.includes('Chinese')) {
      return {
        fontFamily: 'STHeiti',
        secondaryFontFamily: 'Arial'
      };
    } else if (language === 'JP' || language.includes('Japanese')) {
      return {
        fontFamily: 'Arial Unicode MS',  // 日文使用Arial Unicode MS
        secondaryFontFamily: 'Arial Unicode MS'
      };
    } else if (isRTL() || needsUnicodeFont()) {
      return {
        fontFamily: 'Arial Unicode MS',
        secondaryFontFamily: 'Arial Unicode MS'
      };
    } else if (isItalian()) {
      return {
        fontFamily: 'Arial',
        secondaryFontFamily: 'Arial'
      };
    } else {
      return {
        fontFamily: 'Arial',
        secondaryFontFamily: 'Arial'
      };
    }
  };
  
  // 智能选择字体：处理各种情况，自动选择最合适的字体
  // 优先级：用户手动设置 > 自动选择
  const getSmartFont = (
    dbFont: string | null | undefined,
    autoFont: string,
    language?: string
  ): string => {
    // 如果数据库值为null、undefined或空字符串，使用自动选择的字体
    if (!dbFont || dbFont === '') return autoFont;
    
    // 如果数据库值与自动选择的字体一致，使用自动选择的字体
    // 这样可以处理旧数据中可能存在的默认值（STHeiti/Arial）
    if (dbFont === autoFont) return autoFont;
    
    // 特殊处理：如果数据库值是STHeiti或Arial，且当前语言不是中文，则使用自动选择的字体
    // 这样可以处理旧数据中的默认值
    if (language) {
      const autoFonts = getAutoFontsByLanguage(language);
      if ((dbFont === 'STHeiti' || dbFont === 'Arial') && 
          (dbFont !== autoFonts.fontFamily && dbFont !== autoFonts.secondaryFontFamily)) {
        return autoFont;
      }
    }
    
    // 否则使用数据库中的字体（用户手动修改过的）
    return dbFont;
  };
  
  // 处理语言选择变化
  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value
    
    console.log('🔄 [切换国别] 开始:', {
      oldLanguage: selectedLanguage,
      newLanguage: newLanguage,
      currentFontFamily: fontFamily,
      currentSecondaryFont: labelData.secondaryFontFamily
    })
    
    // 使用统一的字体选择函数
    const autoFonts = getAutoFontsByLanguage(newLanguage)
    
    console.log('🔄 [切换国别] 自动字体:', {
      newLanguage,
      autoFontFamily: autoFonts.fontFamily,
      autoSecondaryFont: autoFonts.secondaryFontFamily
    })
    
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
          let backendSettingsExist = false
          try {
            const shortCountryCode = extractShortCountryCode(newLanguage)
            
            const labelSettings = await getLabelSettings(
              selectedProject.id,
              shortCountryCode,
              sequence
            )

            
            // 判断后端数据是否存在（非默认值）
            backendSettingsExist = !!(labelSettings && labelSettings.sequence_position !== '')
            setBackendDataExists(backendSettingsExist)
            
            labelDataFromSettings = convertSettingsToLabelData(labelSettings)
            
            console.log('🔧 [切换国别-handleLanguageChange] labelDataFromSettings字体:', {
              fontFamily: labelDataFromSettings?.fontFamily,
              secondaryFontFamily: labelDataFromSettings?.secondaryFontFamily,
              rawSettingsFontFamily: labelSettings.font_family,
              rawSettingsSecondaryFont: labelSettings.secondary_font_family
            })

          } catch (labelError) {
            // console.warn('⚠️ 加载标签设置失败，使用默认设置:', labelError)
            setBackendDataExists(false)
          }
          
          // 优先尝试解析JSON格式的格式化状态
          const formattedData = parseFormattedSummary(countryDetail.formatted_summary)
          
          if (formattedData && formattedData.formatStates) {
            // 如果有JSON格式的格式化状态，恢复6个字段和格式化状态
            const smartFont = getSmartFont(countryDetail.font_family, autoFonts.fontFamily, newLanguage);
            const smartSecondaryFont = getSmartFont(countryDetail.secondary_font_family, autoFonts.secondaryFontFamily, newLanguage);
            
            console.log('🔄 [切换国别] 有格式化状态，字体选择:', {
              dbFontFamily: countryDetail.font_family,
              dbSecondaryFont: countryDetail.secondary_font_family,
              smartFont,
              smartSecondaryFont
            })
            console.log('🔄 [切换国别] 调用updateLabelData前 - 当前Context字体:', {
              currentContextFontFamily: fontFamily,
              currentContextSecondaryFont: secondaryFontFamily,
              willUpdateToFont: smartFont,
              willUpdateToSecondaryFont: smartSecondaryFont
            })
            
            const mergedData = {
              ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
              selectedLanguage: newLanguage,
              fontFamily: smartFont,
              secondaryFontFamily: smartSecondaryFont,
              textAlign: countryDetail.text_align || 'left',
              fontSize: countryDetail.font_size || labelData.fontSize,
              spacing: countryDetail.spacing || labelData.spacing,
              lineHeight: countryDetail.line_height || labelData.lineHeight,
              selectedNumber: sequence.toString(),
              basicInfo: formattedData.basicInfo ?? '',
              numberField: formattedData.numberField ?? '',
              drugName: formattedData.drugName ?? '',
              numberOfSheets: formattedData.numberOfSheets ?? '',
              drugDescription: formattedData.drugDescription ?? '',
              companyName: formattedData.companyName ?? '',
              originalSummary: countryDetail.original_summary,
              formatted_summary: countryDetail.formatted_summary
            }

            updateLabelData(mergedData)
            
            console.log('🔄 [切换国别] updateLabelData已调用，传递的字体:', {
              mergedDataFontFamily: mergedData.fontFamily,
              mergedDataSecondaryFont: mergedData.secondaryFontFamily
            })
            
            // 恢复格式化状态
            setFormatStates(formattedData.formatStates)
          } else {
            // 如果没有格式化状态，尝试恢复原始状态
            const originalData = parseOriginalSummary(countryDetail.original_summary)
            
            if (originalData) {
              // 如果有JSON格式的原始状态，恢复6个字段
              const smartFont = getSmartFont(countryDetail.font_family, autoFonts.fontFamily, newLanguage);
              const smartSecondaryFont = getSmartFont(countryDetail.secondary_font_family, autoFonts.secondaryFontFamily, newLanguage);
              
              console.log('🔄 [切换国别] 有原始状态，字体选择:', {
                dbFontFamily: countryDetail.font_family,
                dbSecondaryFont: countryDetail.secondary_font_family,
                smartFont,
                smartSecondaryFont
              })
              
              const mergedDataOriginal = {
                ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
                selectedLanguage: newLanguage,
                fontFamily: smartFont,
                secondaryFontFamily: smartSecondaryFont,
                textAlign: countryDetail.text_align || 'left',
                fontSize: countryDetail.font_size || labelData.fontSize,
                spacing: countryDetail.spacing || labelData.spacing,
                lineHeight: countryDetail.line_height || labelData.lineHeight,
                selectedNumber: sequence.toString(),
                basicInfo: originalData.basicInfo ?? '',
                numberField: originalData.numberField ?? '',
                drugName: originalData.drugName ?? '',
                numberOfSheets: originalData.numberOfSheets ?? '',
                drugDescription: originalData.drugDescription ?? '',
                companyName: originalData.companyName ?? '',
                originalSummary: countryDetail.original_summary,
                formatted_summary: countryDetail.formatted_summary
              }

              updateLabelData(mergedDataOriginal)
            } else {
              // 如果没有JSON格式数据，使用旧逻辑
              const smartFont = getSmartFont(countryDetail.font_family, autoFonts.fontFamily, newLanguage);
              const smartSecondaryFont = getSmartFont(countryDetail.secondary_font_family, autoFonts.secondaryFontFamily, newLanguage);
              
              console.log('🔄 [切换国别] 无JSON数据，字体选择:', {
                dbFontFamily: countryDetail.font_family,
                dbSecondaryFont: countryDetail.secondary_font_family,
                smartFont,
                smartSecondaryFont
              })
              
              const mergedDataOld = {
                ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
                selectedLanguage: newLanguage,
                fontFamily: smartFont,
                secondaryFontFamily: smartSecondaryFont,
                textAlign: countryDetail.text_align || 'left',
                fontSize: countryDetail.font_size || labelData.fontSize,
                spacing: countryDetail.spacing || labelData.spacing,
                lineHeight: countryDetail.line_height || labelData.lineHeight,
                selectedNumber: sequence.toString(),
                basicInfo: countryDetail.formatted_summary || '未格式化',
                originalSummary: countryDetail.original_summary,
                formatted_summary: countryDetail.formatted_summary
              }

              updateLabelData(mergedDataOld)
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
          let backendSettingsExist = false
          try {
            const shortCountryCode = extractShortCountryCode(countryCode)
            
            const labelSettings = await getLabelSettings(
              selectedProject.id,
              shortCountryCode,
              newNumber
            )

            
            // 判断后端数据是否存在（非默认值）
            backendSettingsExist = !!(labelSettings && labelSettings.sequence_position !== '')
            setBackendDataExists(backendSettingsExist)
            
            labelDataFromSettings = convertSettingsToLabelData(labelSettings)

          } catch (labelError) {
            // console.warn('⚠️ 加载标签设置失败，使用默认设置:', labelError)
            setBackendDataExists(false)
          }
          
          // 优先尝试解析JSON格式的格式化状态
          const formattedData = parseFormattedSummary(countryDetail.formatted_summary)
          
          if (formattedData && formattedData.formatStates) {
            // 如果有JSON格式的格式化状态，恢复6个字段和格式化状态
            // 切换序号时也需要根据国别码自动选择字体
            const autoFontsForSequence = getAutoFontsByLanguage(countryCode)
            
            const mergedDataFormatStates = {
              ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
              selectedNumber: e.target.value,
              selectedLanguage: countryCode,
              currentWidth,
              fontFamily: getSmartFont(countryDetail.font_family, autoFontsForSequence.fontFamily, countryCode),
              secondaryFontFamily: getSmartFont(countryDetail.secondary_font_family, autoFontsForSequence.secondaryFontFamily, countryCode),
              fontSize: countryDetail.font_size || labelData.fontSize,
              spacing: countryDetail.spacing || labelData.spacing,
              lineHeight: countryDetail.line_height || labelData.lineHeight,
              basicInfo: formattedData.basicInfo ?? '',
              numberField: formattedData.numberField ?? '',
              drugName: formattedData.drugName ?? '',
              numberOfSheets: formattedData.numberOfSheets ?? '',
              drugDescription: formattedData.drugDescription ?? '',
              companyName: formattedData.companyName ?? '',
              originalSummary: countryDetail.original_summary,
              formatted_summary: countryDetail.formatted_summary
            }

            updateLabelData(mergedDataFormatStates)
            
            // 恢复格式化状态
            setFormatStates(formattedData.formatStates)
          } else {
            // 如果没有格式化状态，尝试恢复原始状态
            const originalData = parseOriginalSummary(countryDetail.original_summary)
            
            if (originalData) {
              // 如果有JSON格式的原始状态，恢复6个字段
              // 切换序号时也需要根据国别码自动选择字体
              const autoFontsForSequence = getAutoFontsByLanguage(countryCode)
              
              const mergedData = {
                ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
                selectedNumber: e.target.value,
                selectedLanguage: countryCode,
                currentWidth,
                fontFamily: getSmartFont(countryDetail.font_family, autoFontsForSequence.fontFamily, countryCode),
                secondaryFontFamily: getSmartFont(countryDetail.secondary_font_family, autoFontsForSequence.secondaryFontFamily, countryCode),
                fontSize: countryDetail.font_size || labelData.fontSize,
                spacing: countryDetail.spacing || labelData.spacing,
                lineHeight: countryDetail.line_height || labelData.lineHeight,
                basicInfo: originalData.basicInfo ?? '',
                numberField: originalData.numberField ?? '',
                drugName: originalData.drugName ?? '',
                numberOfSheets: originalData.numberOfSheets ?? '',
                drugDescription: originalData.drugDescription ?? '',
                companyName: originalData.companyName ?? '',
                originalSummary: countryDetail.original_summary,
                formatted_summary: countryDetail.formatted_summary
              }
              updateLabelData(mergedData)
            } else {
              // 如果没有JSON格式数据，使用旧逻辑
              // 切换序号时也需要根据国别码自动选择字体
              const autoFontsForSequence = getAutoFontsByLanguage(countryCode)
              
              const mergedData = {
                ...(labelDataFromSettings || {}),  // 先合并标签预览区参数
                selectedNumber: e.target.value,
                selectedLanguage: countryCode,
                currentWidth,
                fontFamily: getSmartFont(countryDetail.font_family, autoFontsForSequence.fontFamily, countryCode),
                secondaryFontFamily: getSmartFont(countryDetail.secondary_font_family, autoFontsForSequence.secondaryFontFamily, countryCode),
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
      <div className="mb-4" key={`category-controls-${labelData.labelCategory}`}>
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
                  color: labelData.labelCategory === "阶梯标" ? theme.text : "#999",
                  backgroundColor: labelData.labelCategory === "阶梯标" ? "white" : "#f5f5f5",
                }}
                disabled={labelData.labelCategory !== "阶梯标"}
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
                borderColor: labelData.labelCategory === "阶梯标" ? theme.border : "#ccc",
                color: labelData.labelCategory === "阶梯标" ? theme.text : "#999",
                backgroundColor: labelData.labelCategory === "阶梯标" ? "white" : "#f5f5f5",
              }}
              disabled={labelData.labelCategory !== "阶梯标"}
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
                      onClick={handleFormatButton}
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
                onClick={handleFormatBasicInfoButton}
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
                onClick={handleFormatNumberFieldButton}
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
                onClick={handleFormatDrugNameButton}
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
                onClick={handleFormatNumberOfSheetsButton}
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
                onClick={handleFormatDrugDescriptionButton}
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
                onClick={handleFormatCompanyNameButton}
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