"use client"

import { useContext, useState, useEffect } from "react"
import { ChevronDown, Edit3, Download, Sparkles, RotateCcw, Save } from "lucide-react"
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { calculatePageWidth, calculatePageMargins } from '../utils/calculatePageWidth'
import { getProjectById, getCountryDetails, getTranslationsByCountry, updateFormattedSummary } from '@/lib/projectApi'

export default function LabelEditor() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const { labelData, updateLabelData, setSelectedProject } = useLabelContext()
  const { selectedLanguage, selectedNumber, drugInfo, fontFamily, fontSize, spacing, lineHeight, labelWidth, labelHeight, selectedProject } = labelData

  const [selectedNumberState, setSelectedNumberState] = useState<number>(Number(selectedNumber))
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
        // 没有选中项目时，使用默认选项
        setAvailableSequences(Array.from({ length: 30 }, (_, i) => i + 1))
        setAvailableCountries(languages.map(lang => lang.code))
      }
    }

    loadAvailableOptions()
  }, [selectedProject])

  const languages = [
    { name: "AE-阿联酋-阿拉伯语", code: "AE" },
    { name: "BG-保加利亚-保加利亚语", code: "BG" },
    { name: "CN-中国-汉语", code: "CN" },
    { name: "CZ-捷克-捷克语", code: "CZ" },
    { name: "DE-德国-德语", code: "DE" },
    { name: "DK-丹麦-丹麦语", code: "DK" },
    { name: "GB-英国-英语", code: "GB" },
    { name: "GR-希腊-希腊语", code: "GR" },
    { name: "ID-印度尼西亚-印尼语", code: "ID" },
    { name: "IL-以色列-希伯来语", code: "IL" },
    { name: "IN-印度-印地语", code: "IN" },
    { name: "IT-意大利-意大利语", code: "IT" },
    { name: "JP-日本-日语", code: "JP" },
    { name: "KR-韩国-韩语", code: "KR" },
    { name: "MY-马来西亚-马来语", code: "MY" },
    { name: "NL-荷兰-荷兰语", code: "NL" },
    { name: "NO-挪威-挪威语", code: "NO" },
    { name: "PL-波兰-波兰语", code: "PL" },
    { name: "PT-葡萄牙-葡萄牙语", code: "PT" },
    { name: "RO-罗马尼亚-罗马尼亚语", code: "RO" },
    { name: "RS-塞尔维亚-塞尔维亚语", code: "RS" },
    { name: "RU-俄罗斯-俄语", code: "RU" },
    { name: "SE-瑞典-瑞典语", code: "SE" },
    { name: "TH-泰国-泰语", code: "TH" },
    { name: "TR-土耳其-土耳其语", code: "TR" },
    { name: "VN-越南-越南语", code: "VN" }
  ]


  const fonts = [
    { name: "STHeiti", value: "STHeiti" },
    { name: "Arial", value: "Arial" },
    { name: "Arial Bold", value: "Arial Bold" },
    { name: "Arial Italic", value: "Arial Italic" },
    { name: "Arial Unicode", value: "Arial Unicode" },
    { name: "Arial Bold Italic", value: "Arial Bold Italic" }
  ]

  const handleInputChange = (value: string) => {
    updateLabelData({ drugInfo: value })
  }

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
      updateLabelData({ drugInfo: resetText })
      
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

      // 按 item_order 排序并拼接成文本
      const sortedItems = translationGroup.items.sort((a, b) => a.item_order - b.item_order)
      const importedText = sortedItems
        .map(item => item.translated_text || item.original_text)
        .join('\n')
      
      // 更新到药品信息
      updateLabelData({ drugInfo: importedText })
      
    } catch (error) {
      console.error('导入失败:', error)
      showToast('导入失败，请重试', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  // 格式化
  const handleFormat = async () => {
    if (!drugInfo || drugInfo === '未格式化') { showToast('药品信息为空，无法格式化', 'info'); return }

    try {
      setIsFormatting(true)
      
      // 使用临时测试格式化函数
      const formattedText = format_test(drugInfo)
      
      // 更新到药品信息
      updateLabelData({ drugInfo: formattedText })
      
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

    if (!drugInfo || drugInfo.trim() === '') { showToast('药品信息为空，无法保存', 'info'); return }

    try {
      setIsSaving(true)
      
      // 调用API保存格式化翻译汇总
      await updateFormattedSummary(selectedProject.id, selectedLanguage, drugInfo)
      showToast('标签保存成功', 'success')
      
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
    let newFontFamily = 'Arial Unicode'  // 默认字体
    
    // 根据语言设置对应的字体
    if (newLanguage === 'CN') {
      newFontFamily = 'STHeiti'
    } else if (newLanguage === 'TH' || newLanguage === 'AE') {
      newFontFamily = 'Arial Unicode'
    } else {
      newFontFamily = 'Arial'
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
        } else {
          // 如果该国别码不存在于当前项目，只更新语言和字体
          updateLabelData({
            selectedLanguage: newLanguage,
            fontFamily: newFontFamily,
            drugInfo: '该国别在当前项目中不存在'
          })
        }
      } catch (error) {
        console.error('加载国别数据失败:', error)
        updateLabelData({
          selectedLanguage: newLanguage,
          fontFamily: newFontFamily
        })
      }
    } else {
      // 没有选中项目时，只更新语言和字体
      updateLabelData({
        selectedLanguage: newLanguage,
        fontFamily: newFontFamily
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
        } else {
          // 如果该序号不存在于当前项目，只更新序号和宽度
          updateLabelData({
            selectedNumber: e.target.value,
            currentWidth,
            drugInfo: '该序号在当前项目中不存在'
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
                availableCountries.map((countryCode) => {
                  const lang = languages.find(l => l.code === countryCode)
                  return (
                    <option key={countryCode} value={countryCode}>
                      {lang ? lang.name : countryCode}
                    </option>
                  )
                })
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
              <ChevronDown className="h-4 w-4" style={{ color: theme.text }} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-grow space-y-6 overflow-y-auto">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium" style={{ color: theme.text }}>
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
                disabled={!drugInfo || drugInfo === '未格式化' || isFormatting}
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
                disabled={!selectedProject || !drugInfo || drugInfo.trim() === '' || isSaving}
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
          <textarea
            value={drugInfo}
            onChange={(e) => handleInputChange(e.target.value)}
            className="w-full h-full rounded-md shadow-md px-3 py-2 hover:shadow-lg transition-shadow border"
            style={{
              borderColor: theme.border,
              borderWidth: "1px",
              color: theme.text,
              backgroundColor: "white",
              minHeight: "400px",
              resize: "none"
            }}
          />
        </div>

        {/* 字体相关参数 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center border border-[#30B8D6] rounded-md">
            <label className="text-base font-medium px-3 py-2 min-w-[120px]" style={{ color: theme.text }}>
              字体名称：
            </label>
            <div className="flex-1">
              <select
                value={fontFamily}
                onChange={(e) => updateLabelData({ fontFamily: e.target.value })}
                className="w-full px-3 py-2 focus:outline-none appearance-none"
                style={{
                  color: theme.text,
                  backgroundColor: "white",
                }}
              >
                {fonts.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="pointer-events-none absolute right-3 flex items-center">
              <ChevronDown className="h-4 w-4" style={{ color: theme.text }} />
            </div>
          </div>
          <div className="flex items-center border border-[#30B8D6] rounded-md">
            <label className="text-base font-medium px-3 py-2 min-w-[120px]" style={{ color: theme.text }}>
              字体大小：
            </label>
            <div className="flex-1">
              <input
                type="number"
                value={fontSize}
                step={0.5}
                onChange={(e) => updateLabelData({ fontSize: Number(e.target.value) })}
                className="w-full px-3 py-2 focus:outline-none"
                style={{
                  color: theme.text,
                  backgroundColor: "white",
                }}
              />
            </div>
          </div>
          <div className="flex items-center border border-[#30B8D6] rounded-md">
            <label className="text-base font-medium px-3 py-2 min-w-[120px]" style={{ color: theme.text }}>
              间距：
            </label>
            <div className="flex-1">
              <input
                type="number"
                value={spacing}
                step={0.1}
                onChange={(e) => updateLabelData({ spacing: Number(e.target.value) })}
                className="w-full px-3 py-2 focus:outline-none"
                style={{
                  color: theme.text,
                  backgroundColor: "white",
                }}
              />
            </div>
          </div>
          <div className="flex items-center border border-[#30B8D6] rounded-md">
            <label className="text-base font-medium px-3 py-2 min-w-[120px]" style={{ color: theme.text }}>
              行高：
            </label>
            <div className="flex-1">
              <input
                type="number"
                value={lineHeight}
                step={0.1}
                onChange={(e) => updateLabelData({ lineHeight: Number(e.target.value) })}
                className="w-full px-3 py-2 focus:outline-none"
                style={{
                  color: theme.text,
                  backgroundColor: "white",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}