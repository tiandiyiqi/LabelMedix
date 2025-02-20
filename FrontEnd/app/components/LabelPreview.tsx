"use client"

import { useEffect, useRef, useContext } from "react"
import { Eye } from "lucide-react"
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import PDFExport from "./PDFExport"

export default function LabelPreview() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const { labelData, updateLabelData } = useLabelContext()
  const { drugInfo, fontSize, selectedLanguage, labelWidth, labelHeight } = labelData
  const previewContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const resizePreviewContainer = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.offsetWidth
        const scale = Math.min(1, containerWidth / (labelWidth * 3.78))
        previewContainerRef.current.style.height = `${labelHeight * 3.78 * scale}px`
      }
    }

    resizePreviewContainer()
    window.addEventListener("resize", resizePreviewContainer)
    return () => window.removeEventListener("resize", resizePreviewContainer)
  }, [labelWidth, labelHeight])

  // 获取当前语言对应的字体
  const getFontFamily = () => {
    if (selectedLanguage === "TH" || selectedLanguage === "AE") {
      return "Arial Unicode MS"
    }
    if (selectedLanguage === "CN") {
      return "黑体"
    }
    return "Arial"
  }

  return (
    <div className="h-full flex flex-col card p-6 rounded-lg shadow w-full" style={{ borderColor: theme.border }}>
      <h2 className="text-xl font-bold mb-6 flex items-center" style={{ color: theme.primary }}>
        <Eye className="mr-2" size={24} />
        标签预览
      </h2>
      <div className="mb-6 flex space-x-4">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
            标签宽度 (mm)
          </label>
          <input
            type="number"
            value={labelWidth}
            onChange={(e) => updateLabelData({ labelWidth: Number(e.target.value) })}
            className="w-full rounded-md shadow-md px-3 py-2 border"
            style={{
              borderColor: theme.border,
              color: theme.text,
              backgroundColor: "white",
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
            标签高度 (mm)
          </label>
          <input
            type="number"
            value={labelHeight}
            onChange={(e) => updateLabelData({ labelHeight: Number(e.target.value) })}
            className="w-full rounded-md shadow-md px-3 py-2 border"
            style={{
              borderColor: theme.border,
              color: theme.text,
              backgroundColor: "white",
            }}
          />
        </div>
      </div>
      <div
        ref={previewContainerRef}
        className="flex-grow relative overflow-hidden flex items-center justify-center mb-6 min-h-[200px] bg-gray-50 rounded-lg"
      >
        <div
          className="border-2 border-dashed rounded-lg flex items-center justify-center shadow-lg"
          style={{
            borderColor: theme.secondary,
            width: `${labelWidth * 3.78}px`,
            height: `${labelHeight * 3.78}px`,
            transform: `scale(${previewContainerRef.current ? Math.min(1, previewContainerRef.current.offsetWidth / (labelWidth * 3.78)) : 1})`,
            transformOrigin: "center",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          }}
        >
          {drugInfo ? (
            <div
              style={{
                fontFamily: getFontFamily(),
                fontSize: `${fontSize}pt`,
                padding: "10px",
                width: "100%",
                height: "100%",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}
            >
              {drugInfo}
            </div>
          ) : (
            <p style={{ color: theme.lightText }}>标签预览将在这里显示</p>
          )}
        </div>
      </div>
      <PDFExport />
    </div>
  )
}

