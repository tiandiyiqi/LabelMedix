"use client"

import { FileDown, Save } from "lucide-react"
import { jsPDF } from 'jspdf'
import { useLabelContext } from "../../lib/context/LabelContext"
import { useContext } from "react"
import { ThemeContext } from "./Layout"

// 导入中文字体支持
import 'jspdf-font'

interface LanguageMap {
  [key: string]: string
}

export default function PDFExport() {
  const { labelData } = useLabelContext()
  const { labelWidth, labelHeight, drugInfo, selectedLanguage, fontSize } = labelData
  
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const handleSave = () => {
    try {
      // 这里添加保存数据的逻辑
      console.log('保存数据...')
      alert('数据保存成功')
    } catch (error) {
      console.error('保存数据失败:', error)
      alert('保存数据失败')
    }
  }

  const handleExport = () => {
    try {
      console.log('开始导出PDF...')
      console.log('标签数据:', { labelWidth, labelHeight, fontSize, selectedLanguage })
      console.log('药品信息长度:', drugInfo?.length || 0)

      // 获取语言名称
      const languages: LanguageMap = {
        "AE": "阿联酋-阿拉伯语",
        "BG": "保加利亚-保加利亚语",
        "CN": "中国-汉语",
        "CZ": "捷克-捷克语",
        "DE": "德国-德语",
        "DK": "丹麦-丹麦语",
        "GB": "英国-英语",
        "GR": "希腊-希腊语",
        "ID": "印度尼西亚-印尼语",
        "IL": "以色列-希伯来语",
        "IN": "印度-印地语",
        "IT": "意大利-意大利语",
        "JP": "日本-日语",
        "KR": "韩国-韩语",
        "MY": "马来西亚-马来语",
        "NL": "荷兰-荷兰语",
        "NO": "挪威-挪威语",
        "PL": "波兰-波兰语",
        "PT": "葡萄牙-葡萄牙语",
        "RO": "罗马尼亚-罗马尼亚语",
        "RS": "塞尔维亚-塞尔维亚语",
        "RU": "俄罗斯-俄语",
        "SE": "瑞典-瑞典语",
        "TH": "泰国-泰语",
        "TR": "土耳其-土耳其语",
        "VN": "越南-越南语"
      }

      // 创建PDF文档
      console.log('创建PDF文档...')
      const doc = new jsPDF({
        orientation: labelWidth > labelHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [Math.max(labelWidth, 1), Math.max(labelHeight, 1)]
      })
      console.log('PDF文档创建成功')

      // 设置字体大小（将pt转换为mm）
      const adjustedFontSize = fontSize * 0.352778
      doc.setFontSize(adjustedFontSize)
      console.log('字体大小设置为:', adjustedFontSize)

      // 计算边距和可用空间
      const margin = 5 // 5mm边距
      const availableWidth = labelWidth - (margin * 2)
      const availableHeight = labelHeight - (margin * 2)
      console.log('页面布局:', { availableWidth, availableHeight, margin })

      // 添加文本内容
      console.log('处理文本内容...')
      const lines = doc.splitTextToSize(drugInfo || '', availableWidth)
      console.log('文本行数:', lines.length)

      // 检查是否需要多页
      const lineHeight = adjustedFontSize * 0.3528 // 转换为mm
      const linesPerPage = Math.floor(availableHeight / lineHeight)
      console.log('每页行数:', linesPerPage)

      // 分页处理
      console.log('开始分页处理...')
      for (let i = 0; i < lines.length; i += linesPerPage) {
        if (i > 0) {
          console.log(`添加第 ${Math.floor(i/linesPerPage) + 1} 页`)
          doc.addPage([labelWidth, labelHeight])
        }
        const pageLines = lines.slice(i, i + linesPerPage)
        console.log(`写入第 ${Math.floor(i/linesPerPage) + 1} 页, ${pageLines.length} 行`)
        doc.text(pageLines, margin, margin + lineHeight, {
          baseline: 'top',
          maxWidth: availableWidth
        })
      }

      // 生成文件名
      const date = new Date().toISOString().split('T')[0]
      const fileName = `LabelMedix-${selectedLanguage}-${languages[selectedLanguage] || ''}-${date}.pdf`
      console.log('准备保存文件:', fileName)

      // 保存PDF
      console.log('调用save方法...')
      doc.save(fileName)
      console.log('PDF导出完成')

    } catch (error) {
      console.log('错误类型:', typeof error)
      console.log('错误内容:', error)
      if (error instanceof Error) {
        console.log('错误消息:', error.message)
        console.log('错误堆栈:', error.stack)
      }
      alert('PDF导出失败，请查看控制台了解详细信息')
    }
  }

  return (
    <div className="mt-4 flex gap-4">
      <button 
        onClick={handleSave}
        className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center transition-all hover:opacity-90"
        style={{
          backgroundColor: theme.accent,
          color: theme.buttonText,
          border: `1px solid ${theme.neutral}`,
          boxShadow: `0 2px 4px ${theme.neutral}33`
        }}
      >
        <Save className="mr-2" size={20} />
        <span style={{ color: theme.buttonText }}>保存标签数据</span>
      </button>
      <button 
        onClick={handleExport}
        className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center transition-all hover:opacity-90"
        style={{
          backgroundColor: theme.accent,
          color: theme.buttonText,
          border: `1px solid ${theme.neutral}`,
          boxShadow: `0 2px 4px ${theme.neutral}33`
        }}
      >
        <FileDown size={20} className="mr-2" />
        <span style={{ color: theme.buttonText }}>导出PDF</span>
      </button>
    </div>
  )
}

