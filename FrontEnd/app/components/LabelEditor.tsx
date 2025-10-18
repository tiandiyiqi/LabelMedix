"use client"

import { useContext, useState, useEffect } from "react"
import { ChevronDown, Edit3, Download, Sparkles, RotateCcw, Save, Type, Languages, Maximize2, Space, AlignJustify, BookmarkPlus, BookmarkCheck } from "lucide-react"
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { calculatePageWidth, calculatePageMargins } from '../utils/calculatePageWidth'
import { getProjectById, getCountryDetails, getTranslationsByCountry, updateFormattedSummary, savePdfFile } from '@/lib/projectApi'
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
  const [isImporting, setIsImporting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isFormatting, setIsFormatting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // 轻量提示（非阻断式）
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>(
    { visible: false, message: '', type: 'info' }
  )
  const [availableSequences, setAvailableSequences] = useState<number[]>([])
  const [availableCountries, setAvailableCountries] = useState<string[]>([])

  // 显示自动消失的提示
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 2000) => {
    setToast({ visible: true, message, type })
    window.setTimeout(() => setToast({ visible: false, message: '', type }), duration)
  }

  // 同步 selectedNumber 的变化
  useEffect(() => {
    setSelectedNumberState(Number(selectedNumber))
  }, [selectedNumber])

  // 自动调整textarea高度的函数
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    
    // 计算单行高度（字体大小 + 行间距）
    const computedStyle = window.getComputedStyle(textarea)
    const fontSize = parseFloat(computedStyle.fontSize)
    const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.2
    
    // 计算padding（py-2 = 8px上下padding）
    const paddingTop = parseFloat(computedStyle.paddingTop)
    const paddingBottom = parseFloat(computedStyle.paddingBottom)
    const totalPadding = paddingTop + paddingBottom
    
    // 如果内容只有一行，使用紧凑的单行高度
    if (scrollHeight <= lineHeight + totalPadding) {
      textarea.style.height = (lineHeight + totalPadding) + 'px'
    } else {
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
          console.error('加载项目选项失败:', error)
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



  const fonts = [
    { name: "STHeiti", value: "STHeiti" },
    { name: "Arial", value: "Arial" },
    { name: "Arial Bold", value: "Arial Bold" },
    { name: "Arial Italic", value: "Arial Italic" },
    { name: "Arial Unicode", value: "Arial Unicode" },
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
    console.log('正式格式化函数调用，文本长度:', text.length)
    return text
  }

  // 重置 - 从数据库重新加载格式化后的翻译汇总
  const handleReset = async () => {
    if (!selectedProject) { showToast('请先选择一个项目', 'info'); return }

    try {
      setIsResetting(true)
      
      // 获取该国别的详细信息
      const countryDetail = await getCountryDetails(selectedProject.id, selectedLanguage)
      
      // 如果有格式化汇总，则恢复；否则显示"未格式化"
      const resetText = countryDetail.formatted_summary || '未格式化'
      
      // 将重置的内容分配到各个字段（这里可以根据实际需求调整分配逻辑）
      updateLabelData({ 
        basicInfo: resetText,
        numberField: '',
        drugName: '',
        numberOfSheets: '',
        drugDescription: '',
        companyName: ''
      })
      
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
      
      // 更新到对应的字段类型区域
      updateLabelData({
        basicInfo: fieldTypeGroups.basic_info.join('\n'),
        numberField: fieldTypeGroups.number_field.join('\n'),
        drugName: fieldTypeGroups.drug_name.join('\n'),
        numberOfSheets: fieldTypeGroups.number_of_sheets.join('\n'),
        drugDescription: fieldTypeGroups.drug_description.join('\n'),
        companyName: fieldTypeGroups.company_name.join('\n')
      })
      
      showToast('翻译内容已按字段类型分类导入', 'success')
      
    } catch (error) {
      console.error('导入失败:', error)
      showToast('导入失败，请重试', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  // 格式化
  const handleFormat = async () => {
    try {
      setIsFormatting(true)
      
      // 格式化各个字段的内容
      const formattedBasicInfo = format_test(basicInfo)
      const formattedNumberField = format_test(numberField)
      const formattedDrugName = format_test(drugName)
      const formattedNumberOfSheets = format_test(numberOfSheets)
      const formattedDrugDescription = format_test(drugDescription)
      const formattedCompanyName = format_test(companyName)
      
      // 更新各个字段
      updateLabelData({
        basicInfo: formattedBasicInfo,
        numberField: formattedNumberField,
        drugName: formattedDrugName,
        numberOfSheets: formattedNumberOfSheets,
        drugDescription: formattedDrugDescription,
        companyName: formattedCompanyName
      })
      
    } catch (error) {
      console.error('格式化失败:', error)
      showToast('格式化失败，请重试', 'error')
    } finally {
      setIsFormatting(false)
    }
  }

  // 保存标签
  const handleSave = async () => {
    if (!selectedProject) { showToast('请先选择一个项目', 'info'); return }

    try {
      setIsSaving(true)
      
      // 将所有字段内容合并为drugInfo用于保存
      const combinedContent = [
        basicInfo,
        numberField,
        drugName,
        numberOfSheets,
        drugDescription,
        companyName
      ].filter(content => content && content.trim() !== '').join('\n')
      
      // 1. 保存格式化翻译汇总和字体设置
      await updateFormattedSummary(selectedProject.id, selectedLanguage, combinedContent, {
        fontFamily: labelData.fontFamily,
        secondaryFontFamily: labelData.secondaryFontFamily,
        fontSize: labelData.fontSize,
        spacing: labelData.spacing,
        lineHeight: labelData.lineHeight
      })
      
      // 2. 触发PDF生成和保存（通过事件通知PDFPreview组件）
      window.dispatchEvent(new CustomEvent('generate-and-save-pdf', {
        detail: {
          projectId: selectedProject.id,
          countryCode: selectedLanguage,
          sequenceNumber: selectedNumber
        }
      }));
      
      showToast('标签保存成功，PDF正在生成中...', 'success')
      
    } catch (error) {
      console.error('保存标签失败:', error)
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
      console.error('查找国别码失败:', error)
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
      console.error('查找序号失败:', error)
      return null
    }
  }

  // 处理语言选择变化
  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value
    let newFontFamily = 'Arial'  // 默认主语言字体
    let newSecondaryFontFamily = 'Arial'  // 默认次语言字体
    
    // 检查是否为从右到左的语言
    const isRTL = () => {
      if (!newLanguage) return false;
      const rtlKeywords = ['Arabic', 'Hebrew', 'Persian', 'Farsi', 'Urdu', 'Punjabi', 'Somali'];
      return rtlKeywords.some(keyword => newLanguage.includes(keyword));
    };
    
    // 检查是否为需要特殊字体的语言
    const needsUnicodeFont = () => {
      if (!newLanguage) return false;
      const unicodeFontLanguages = ['Korean', 'Thai', 'Vietnamese', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Urdu'];
      return unicodeFontLanguages.some(lang => newLanguage.includes(lang)) || 
             newLanguage.includes('KR') || newLanguage.includes('TH') || newLanguage.includes('VN');
    };
    
    // 根据语言设置对应的字体
    if (newLanguage === 'CN' || newLanguage.includes('Chinese')) {
      newFontFamily = 'STHeiti'
      newSecondaryFontFamily = 'Arial'
    } else if (newLanguage === 'JP' || newLanguage.includes('Japanese')) {
      newFontFamily = 'STHeiti'  // 日文也可以使用STHeiti
      newSecondaryFontFamily = 'Arial'
    } else if (isRTL() || needsUnicodeFont()) {
      newFontFamily = 'Arial Unicode MS'
      newSecondaryFontFamily = 'Arial Unicode MS'
    } else {
      newFontFamily = 'Arial'
      newSecondaryFontFamily = 'Arial'
    }
    
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
          
          // 同时更新语言和字体，如果数据库有保存的字体设置则使用数据库的
          updateLabelData({
            selectedLanguage: newLanguage,
            fontFamily: countryDetail.font_family || newFontFamily,
            secondaryFontFamily: countryDetail.secondary_font_family || newSecondaryFontFamily,
            fontSize: countryDetail.font_size || labelData.fontSize,
            spacing: countryDetail.spacing || labelData.spacing,
            lineHeight: countryDetail.line_height || labelData.lineHeight,
            selectedNumber: sequence.toString(),
            basicInfo: countryDetail.formatted_summary || '未格式化'
          })
        } else {
          // 如果该国别码不存在于当前项目，只更新语言和字体
          updateLabelData({
            selectedLanguage: newLanguage,
            fontFamily: newFontFamily,
            secondaryFontFamily: newSecondaryFontFamily,
            basicInfo: '该国别在当前项目中不存在'
          })
        }
      } catch (error) {
        console.error('加载国别数据失败:', error)
        updateLabelData({
          selectedLanguage: newLanguage,
          fontFamily: newFontFamily,
          secondaryFontFamily: newSecondaryFontFamily
        })
      }
    } else {
      // 没有选中项目时，只更新语言和字体
      updateLabelData({
        selectedLanguage: newLanguage,
        fontFamily: newFontFamily,
        secondaryFontFamily: newSecondaryFontFamily
      })
    }
  }

  // 处理序号选择变化
  const handleNumberChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newNumber = Number(e.target.value)
    setSelectedNumberState(newNumber)
    
    // 计算当前页面宽度和边距
    const currentWidth = calculatePageWidth(labelWidth, newNumber)
    const margins = calculatePageMargins(newNumber)
    
    // 输出页面相关信息
    console.log('页面参数变化:', {
      序号: newNumber,
      初始宽度: labelWidth,
      当前宽度: currentWidth.toFixed(1),
      高度: labelHeight,
      页边距: {
        上: margins.top,
        下: margins.bottom,
        左: margins.left,
        右: margins.right
      }
    })
    
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
          
          // 同时更新序号、语言、字体和内容
          updateLabelData({
            selectedNumber: e.target.value,
            selectedLanguage: countryCode,
            currentWidth,
            fontFamily: countryDetail.font_family || labelData.fontFamily,
            secondaryFontFamily: countryDetail.secondary_font_family || labelData.secondaryFontFamily,
            fontSize: countryDetail.font_size || labelData.fontSize,
            spacing: countryDetail.spacing || labelData.spacing,
            lineHeight: countryDetail.line_height || labelData.lineHeight,
            basicInfo: countryDetail.formatted_summary || '未格式化'
          })
        } else {
          // 如果该序号不存在于当前项目，只更新序号和宽度
          updateLabelData({
            selectedNumber: e.target.value,
            currentWidth,
            basicInfo: '该序号在当前项目中不存在'
          })
        }
      } catch (error) {
        console.error('加载序号数据失败:', error)
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-base font-medium" style={{ color: theme.text }}>
                药品信息
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={!selectedProject || isResetting}
                  className="px-3 py-1 rounded text-sm flex items-center gap-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: theme.primary,
                    color: theme.buttonText,
                  }}
                >
                  <RotateCcw size={14} />
                  {isResetting ? '重置中...' : '重置'}
                </button>
                <button
                  onClick={handleImport}
                  disabled={!selectedProject || isImporting}
                  className="px-3 py-1 rounded text-sm flex items-center gap-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: theme.secondary,
                    color: theme.buttonText,
                  }}
                >
                  <Download size={14} />
                  {isImporting ? '导入中...' : '导入'}
                </button>
                <button
                  onClick={handleFormat}
                  disabled={isFormatting}
                  className="px-3 py-1 rounded text-sm flex items-center gap-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: theme.accent,
                    color: theme.buttonText,
                  }}
                >
                  <Sparkles size={14} />
                  {isFormatting ? '格式化中...' : '格式化'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!selectedProject || isSaving}
                  className="px-3 py-1 rounded text-sm flex items-center gap-1 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: '#10B981', // 绿色表示保存
                    color: 'white',
                  }}
                >
                  <Save size={14} />
                  {isSaving ? '保存中...' : '保存标签'}
                </button>
              </div>
            </div>
          </div>

          {/* 6个字段类型分类区域 - 紧凑间距 */}
          <div className="space-y-1">
            {/* 1. 基本信息 */}
            <div>
              <textarea
                value={basicInfo}
                onChange={(e) => {
                  updateLabelData({ basicInfo: e.target.value })
                  // 自动调整高度
                  adjustTextareaHeight(e.target)
                }}
                data-auto-height="true"
                className="w-full rounded-md shadow-md px-3 py-2 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "32px", // 更紧凑的单行高度
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 紧凑的行间距
                  resize: "none",
                  overflow: "hidden"
                }}
                placeholder="基本信息..."
              />
            </div>

            {/* 2. 编号栏 */}
            <div>
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
                className="w-full rounded-md shadow-md px-3 py-2 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "32px", // 更紧凑的单行高度
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 紧凑的行间距
                  resize: "none",
                  overflow: "hidden"
                }}
                placeholder="编号栏..."
              />
            </div>

            {/* 3. 药品名称 */}
            <div>
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
                className="w-full rounded-md shadow-md px-3 py-2 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "32px", // 更紧凑的单行高度
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 紧凑的行间距
                  resize: "none",
                  overflow: "hidden"
                }}
                placeholder="药品名称..."
              />
            </div>

            {/* 4. 片数 */}
            <div>
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
                className="w-full rounded-md shadow-md px-3 py-2 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "32px", // 更紧凑的单行高度
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 紧凑的行间距
                  resize: "none",
                  overflow: "hidden"
                }}
                placeholder="片数内容..."
              />
            </div>

            {/* 5. 药品说明 */}
            <div>
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
                className="w-full rounded-md shadow-md px-3 py-2 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "32px", // 更紧凑的单行高度
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 紧凑的行间距
                  resize: "none",
                  overflow: "hidden"
                }}
                placeholder="药品说明..."
              />
            </div>

            {/* 6. 公司名称 */}
            <div>
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
                className="w-full rounded-md shadow-md px-3 py-2 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                  height: "32px", // 更紧凑的单行高度
                  fontSize: "16px", // 与"药品信息"标题字体大小一致
                  lineHeight: "1.2", // 紧凑的行间距
                  resize: "none",
                  overflow: "hidden"
                }}
                placeholder="公司名称..."
              />
            </div>
          </div>
        </div>

        {/* 字体相关参数 - 紧凑设计 */}
        <div className="space-y-2 mt-8">
          {/* 第一行：主语言字体和次语言字体 */}
          <div className="grid grid-cols-2 gap-2">
            {/* 主语言字体 */}
            <div className="flex items-center gap-2 border rounded px-3 py-1 transition-opacity relative group" style={{ borderColor: theme.border }}>
              <Type className="h-4 w-4 text-[#30B8D6] flex-shrink-0" />
              <select
                value={fontFamily}
                onChange={(e) => updateLabelData({ fontFamily: e.target.value })}
                className="flex-1 bg-transparent focus:outline-none appearance-none cursor-pointer text-sm"
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
            <div className="flex items-center gap-2 border rounded px-3 py-1 transition-opacity relative group" style={{ borderColor: theme.border }}>
              <Languages className="h-4 w-4 text-[#30B8D6] flex-shrink-0" />
              <select
                value={labelData.secondaryFontFamily}
                onChange={(e) => updateLabelData({ secondaryFontFamily: e.target.value })}
                className="flex-1 bg-transparent focus:outline-none appearance-none cursor-pointer text-sm"
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

          {/* 第三行：默认值操作按钮 - 参考其他按钮样式 */}
          <div className="flex items-center gap-2">
            <button
              onClick={saveFontDefaults}
              className="flex-1 px-3 py-1 rounded text-sm flex items-center justify-center gap-1 transition-opacity"
              style={{
                backgroundColor: theme.primary,
                color: theme.buttonText,
              }}
              title="将当前字体参数保存为默认值"
            >
              <BookmarkPlus size={14} />
              设为默认值
            </button>
            
            <button
              onClick={applyFontDefaults}
              className="flex-1 px-3 py-1 rounded text-sm flex items-center justify-center gap-1 transition-opacity"
              style={{
                backgroundColor: theme.secondary,
                color: theme.buttonText,
              }}
              title="应用已保存的字体默认值"
            >
              <BookmarkCheck size={14} />
              应用默认值
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}