"use client"

import { useState, useContext } from "react"
import { ChevronDown } from "lucide-react"
import { ThemeContext } from "./Layout"

interface LabelData {
  aInfo: string
  bInfo: string
  cInfo1: string
  cInfo2: string
  cInfo3: string
}

export default function LabelEditor() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const languages = [
    { name: "阿拉伯语", code: "AR" },
    { name: "保加利亚语", code: "BG" },
    { name: "丹麦语", code: "DK" },
    { name: "德语", code: "DE" },
    { name: "俄语", code: "RU" },
    { name: "法语", code: "FR" },
    { name: "芬兰语", code: "FI" },
    { name: "荷兰语", code: "NL" },
    { name: "韩语", code: "KO" },
    { name: "汉语", code: "ZH" },
    { name: "克罗地亚语", code: "HR" },
    { name: "捷克语", code: "CS" },
    { name: "罗马尼亚语", code: "RO" },
    { name: "马来语", code: "MS" },
    { name: "挪威语", code: "NO" },
    { name: "葡萄牙语", code: "PT" },
    { name: "日语", code: "JP" },
    { name: "瑞典语", code: "SV" },
    { name: "塞尔维亚语", code: "SR" },
    { name: "西班牙语", code: "ES" },
    { name: "希腊语", code: "EL" },
    { name: "匈牙利语", code: "HU" },
    { name: "意大利语", code: "IT" },
    { name: "印地语", code: "HI" },
    { name: "印尼语", code: "ID" },
    { name: "英语", code: "EN" },
    { name: "越南语", code: "VI" },
    { name: "希伯来语", code: "HE" },
    { name: "土耳其语", code: "TR" },
    { name: "泰语", code: "TH" },
    { name: "波兰语", code: "PL" },
  ]

  const [selectedLanguage, setSelectedLanguage] = useState("ZH")
  const [selectedNumber, setSelectedNumber] = useState("1")

  const numbers = Array.from({ length: 30 }, (_, i) => (i + 1).toString())

  const [labelData, setLabelData] = useState<Record<string, LabelData>>(
    Object.fromEntries(
      languages.map((lang) => [
        lang.code,
        {
          aInfo: "",
          bInfo: "",
          cInfo1: "",
          cInfo2: "",
          cInfo3: "",
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
    <div className="h-full flex flex-col card p-4 rounded-lg shadow" style={{ borderColor: theme.border }}>
      <h2 className="text-xl font-bold mb-4" style={{ color: theme.primary }}>
        标签编辑器
      </h2>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1" style={{ color: theme.text }}>
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
                  {lang.name} ({lang.code})
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
        {" "}
        {/* Updated space-y-6 here */}
        {["A类信息", "B类信息"].map((label, index) => (
          <div key={index}>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text }}>
              {label}
            </label>
            <textarea
              value={labelData[selectedLanguage][`${label.charAt(0).toLowerCase()}Info`]}
              onChange={(e) => handleInputChange(`${label.charAt(0).toLowerCase()}Info`, e.target.value)}
              className="w-full rounded-md shadow-md px-3 py-2 hover:shadow-lg transition-shadow border"
              style={{
                borderColor: theme.border,
                borderWidth: "1px",
                color: theme.text,
                backgroundColor: "white",
              }}
              rows={3}
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: theme.text }}>
            C类信息
          </label>
          <div className="space-y-2">
            {[1, 2, 3].map((num) => (
              <textarea
                key={num}
                value={labelData[selectedLanguage][`cInfo${num}`]}
                onChange={(e) => handleInputChange(`cInfo${num}`, e.target.value)}
                className="w-full rounded-md shadow-md px-3 py-2 hover:shadow-lg transition-shadow border"
                style={{
                  borderColor: theme.border,
                  borderWidth: "1px",
                  color: theme.text,
                  backgroundColor: "white",
                }}
                rows={num === 2 ? 5 : 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

