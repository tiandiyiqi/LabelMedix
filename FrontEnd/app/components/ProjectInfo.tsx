"use client"

import { useContext } from "react"
import { FileDown, Save } from "lucide-react"
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { jsPDF } from 'jspdf'

interface LanguageMap {
  [key: string]: string
}

export default function ProjectInfo() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const { labelData } = useLabelContext()
  const { labelWidth, labelHeight, drugInfo, selectedLanguage, fontSize } = labelData

  const handleBatchExport = async () => {
    try {
      console.log('开始批量导出PDF...')

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

      // 为每种语言创建PDF
      for (const [langCode, langName] of Object.entries(languages)) {
        console.log(`正在生成 ${langName} 版本...`)
        
        const doc = new jsPDF({
          orientation: labelWidth > labelHeight ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [Math.max(labelWidth, 1), Math.max(labelHeight, 1)]
        })

        // 设置字体大小
        const adjustedFontSize = fontSize * 0.352778
        doc.setFontSize(adjustedFontSize)

        // 计算边距和可用空间
        const margin = 5
        const availableWidth = labelWidth - (margin * 2)
        const availableHeight = labelHeight - (margin * 2)

        // 添加文本内容
        const lines = doc.splitTextToSize(drugInfo || '', availableWidth)
        
        // 分页处理
        const lineHeight = adjustedFontSize * 0.3528
        const linesPerPage = Math.floor(availableHeight / lineHeight)
        
        for (let i = 0; i < lines.length; i += linesPerPage) {
          if (i > 0) {
            doc.addPage([labelWidth, labelHeight])
          }
          const pageLines = lines.slice(i, i + linesPerPage)
          doc.text(pageLines, margin, margin + lineHeight, {
            baseline: 'top',
            maxWidth: availableWidth
          })
        }

        // 生成文件名并保存
        const date = new Date().toISOString().split('T')[0]
        const fileName = `LabelMedix-${langCode}-${langName}-${date}.pdf`
        doc.save(fileName)
        console.log(`${langName} 版本已生成`)
      }

      console.log('批量导出完成')
      alert('批量导出完成')
    } catch (error) {
      console.error('批量导出失败:', error)
      alert('批量导出失败，请查看控制台了解详细信息')
    }
  }

  return (
    <div 
      className="flex items-center justify-between h-[60px] px-6"
      style={{ 
        backgroundColor: theme.secondary,
        borderBottom: `1px solid ${theme.neutral}`
      }}
    >
      <div className="text-xl font-bold text-white">
        示例项目
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => {}}
          className="px-4 py-2 rounded-lg flex items-center justify-center transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.accent,
            color: theme.buttonText,
            border: `1px solid ${theme.neutral}`,
            boxShadow: `0 2px 4px ${theme.neutral}33`
          }}
        >
          <Save className="mr-2" size={20} />
          <span style={{ color: theme.buttonText }}>保存项目数据</span>
        </button>
        <button
          onClick={handleBatchExport}
          className="px-4 py-2 rounded-lg flex items-center justify-center transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.accent,
            color: theme.buttonText,
            border: `1px solid ${theme.neutral}`,
            boxShadow: `0 2px 4px ${theme.neutral}33`
          }}
        >
          <FileDown className="mr-2" size={20} />
          <span style={{ color: theme.buttonText }}>批量导出PDF</span>
        </button>
      </div>
    </div>
  )
}

