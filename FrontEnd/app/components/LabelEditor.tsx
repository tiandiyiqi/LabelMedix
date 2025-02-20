"use client"

import { useState, useContext } from "react"
import { ChevronDown } from "lucide-react"
import { ThemeContext } from "./Layout"

interface LabelData {
  drugInfo: string
}

export default function LabelEditor() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

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

  const [selectedLanguage, setSelectedLanguage] = useState("CN")
  const [selectedNumber, setSelectedNumber] = useState("1")

  const numbers = Array.from({ length: 30 }, (_, i) => (i + 1).toString())

  const [labelData, setLabelData] = useState<Record<string, LabelData>>(
    Object.fromEntries(
      languages.map((lang) => [
        lang.code,
        {
          drugInfo: "",
        },
      ])
    )
  )

  const handleInputChange = (field: keyof LabelData, value: string) => {
    setLabelData((prev) => ({
      ...prev,
      [selectedLanguage]: {
        ...prev[selectedLanguage],
        [field]: value,
      },
    }))
  }

  return (
    <div className="h-full w-full flex flex-col card p-4 rounded-lg shadow" style={{ borderColor: theme.border }}>
      <h2 className="text-xl font-bold mb-4" style={{ color: theme.primary }}>
        标签编辑器
      </h2>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
          选择语言
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <select
              value={selectedNumber}
              onChange={(e) => setSelectedNumber(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-md border"
              style={{
                borderColor: theme.border,
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
              <ChevronDown className="h-4 w-4" style={{ color: theme.lightText }} />
            </div>
          </div>
          <div className="relative">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
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
              <ChevronDown className="h-4 w-4" style={{ color: theme.lightText }} />
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
            value={labelData[selectedLanguage].drugInfo}
            onChange={(e) => handleInputChange("drugInfo", e.target.value)}
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
      </div>
    </div>
  )
}

