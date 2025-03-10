"use client"

import { useContext, useState } from "react"
import { ChevronDown, Edit3 } from "lucide-react"
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { calculatePageWidth, calculatePageMargins } from '../utils/calculatePageWidth'; // 导入函数

export default function LabelEditor() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const { labelData, updateLabelData } = useLabelContext()
  const { selectedLanguage, selectedNumber, drugInfo, fontFamily, fontSize, spacing, lineHeight, labelWidth, labelHeight } = labelData

  const [selectedNumberState, setSelectedNumberState] = useState<number>(Number(selectedNumber))

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

  const numbers = Array.from({ length: 30 }, (_, i) => (i + 1).toString())

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

  // 处理语言选择变化
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    let newFontFamily = 'Arial Unicode';  // 默认字体
    
    // 根据语言设置对应的字体
    if (newLanguage === 'CN') {
      newFontFamily = 'STHeiti';
    } else if (newLanguage === 'TH' || newLanguage === 'AE') {
      newFontFamily = 'Arial Unicode';
    } else {
      newFontFamily = 'Arial';
    }
    
    // 更新语言和字体
    updateLabelData({
      selectedLanguage: newLanguage,
      fontFamily: newFontFamily
    });
  };

  // 处理序号选择变化
  const handleNumberChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newNumber = Number(e.target.value);
    setSelectedNumberState(newNumber);
    
    // 计算当前页面宽度和边距
    const currentWidth = calculatePageWidth(labelWidth, newNumber);
    const margins = calculatePageMargins(newNumber);
    
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
    });
    
    // 更新上下文中的序号和当前宽度
    updateLabelData({ 
      selectedNumber: e.target.value,
      currentWidth
    });
  };

  return (
    <div className="h-full w-full flex flex-col card rounded-lg shadow" style={{ borderColor: theme.border }}>
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
              >
                {numbers.map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
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
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
              <ChevronDown className="h-4 w-4" style={{ color: theme.text }} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-grow space-y-6 overflow-y-auto">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: theme.text }}>
            药品信息
          </label>
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

