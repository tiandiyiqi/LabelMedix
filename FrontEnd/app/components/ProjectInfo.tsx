"use client"

import { useContext } from "react"
import { FileDown, Save } from "lucide-react"
import { ThemeContext } from "./Layout"

interface ProjectInfoProps {
  projectName: string
  onSave: () => void
  onExport: () => void
}

export default function ProjectInfo({ projectName, onSave, onExport }: ProjectInfoProps) {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  return (
    <div
      className="p-4 rounded-lg shadow-lg mb-4 transition-shadow hover:shadow-xl border"
      style={{
        backgroundColor: theme.secondary,
        borderColor: theme.border,
        borderWidth: "1px",
        color: theme.buttonText,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold" style={{ color: theme.buttonText }}>
            项目名称：
          </h2>
          <span className="text-lg" style={{ color: theme.text }}>
            {projectName}
          </span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onSave}
            className="px-3 py-1 text-sm rounded-md flex items-center justify-center transition-opacity hover:opacity-80 border"
            style={{
              backgroundColor: theme.primary,
              color: theme.buttonText,
              borderColor: theme.border,
            }}
          >
            <Save size={16} className="mr-1" />
            保存
          </button>
          <button
            onClick={onExport}
            className="px-3 py-1 text-sm rounded-md flex items-center justify-center transition-opacity hover:opacity-80 border"
            style={{ backgroundColor: theme.accent, color: theme.buttonText, borderColor: theme.border }}
          >
            <FileDown size={16} className="mr-1" />
            导出PDF
          </button>
        </div>
      </div>
    </div>
  )
}

