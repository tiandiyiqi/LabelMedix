"use client"

import { useEffect, useRef, useState, useContext } from "react"
import { Eye, Save } from "lucide-react"
import { ThemeContext } from "./Layout"

export default function LabelPreview() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const [labelWidth, setLabelWidth] = useState(120)
  const [labelHeight, setLabelHeight] = useState(80)
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

  const handleSaveLabel = () => {
    console.log("Saving label...")
    // Add save functionality here
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
            onChange={(e) => setLabelWidth(Number(e.target.value))}
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
            onChange={(e) => setLabelHeight(Number(e.target.value))}
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
          <p style={{ color: theme.lightText }}>标签预览将在这里显示</p>
        </div>
      </div>
      <div className="mt-auto">
        <button
          onClick={handleSaveLabel}
          className="w-full py-3 px-4 rounded-lg flex items-center justify-center transition-all hover:opacity-90 shadow-md"
          style={{
            backgroundColor: theme.primary,
            color: "white",
            border: `1px solid ${theme.border}`,
          }}
        >
          <Save className="mr-2" size={20} />
          保存标签
        </button>
      </div>
    </div>
  )
}

