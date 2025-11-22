"use client"

import { useContext } from "react"
import { ThemeContext } from "./Layout"
import { FileDown, X, Clock } from "lucide-react"

interface FileInfo {
  countryCode: string
  sequenceNumber: number
  pdfFilePath: string | null
  lastModified: string | null
  exists: boolean
}

interface BatchExportDialogProps {
  isOpen: boolean
  files: FileInfo[]
  onClose: () => void
  onExportFromHistory: () => void
  onRegenerate: () => void
}

export default function BatchExportDialog({
  isOpen,
  files,
  onClose,
  onExportFromHistory,
  onRegenerate
}: BatchExportDialogProps) {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  if (!isOpen) return null

  // 统计信息
  const existsCount = files.filter(f => f.exists).length
  const notExistsCount = files.filter(f => !f.exists).length

  // 格式化日期时间
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '未生成'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '未知时间'
    }
  }

  // 检查是否超过24小时
  const isOverdue = (dateString: string | null): boolean => {
    if (!dateString) return false
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
      return diffInHours > 24
    } catch {
      return false
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-[800px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: theme.border }}
      >
        {/* 标题栏 */}
        <div 
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ 
            backgroundColor: theme.secondary,
            borderColor: theme.border 
          }}
        >
          <h2 className="text-xl font-bold text-white">
            批量导出PDF - 选择导出方式
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded p-1 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 统计信息 */}
        <div 
          className="px-6 py-3 border-b" 
          style={{ 
            borderColor: theme.border,
            backgroundColor: `${theme.secondary}15`
          }}
        >
          <div className="flex gap-6 text-sm">
            <span style={{ color: theme.text }}>
              共 <strong>{files.length}</strong> 个文件
            </span>
            <span style={{ color: theme.primary }}>
              已生成: <strong>{existsCount}</strong> 个
            </span>
            <span style={{ color: '#EF4444' }}>
              未生成: <strong>{notExistsCount}</strong> 个
            </span>
          </div>
        </div>

        {/* 文件列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-1">
            {files.map((file, index) => {
              const overdueFile = isOverdue(file.lastModified)
              const timeColor = file.exists 
                ? (overdueFile ? '#EF4444' : theme.primary) 
                : '#EF4444'
              
              return (
                <div
                  key={`${file.countryCode}-${file.sequenceNumber}`}
                  className="flex items-center justify-between px-3 py-2 rounded border"
                  style={{ 
                    borderColor: file.exists ? `${theme.primary}40` : '#FCA5A5',
                    backgroundColor: file.exists ? `${theme.primary}10` : '#FEF2F2'
                  }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span 
                      className="font-mono text-xs px-2 py-0.5 rounded" 
                      style={{ 
                        backgroundColor: theme.secondary,
                        color: 'white'
                      }}
                    >
                      #{index + 1}
                    </span>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium text-sm" style={{ color: theme.text }}>
                        {file.countryCode}
                      </span>
                      <span className="text-xs" style={{ color: theme.neutral }}>
                        • 序号 {file.sequenceNumber}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock 
                      size={14} 
                      style={{ color: timeColor }} 
                    />
                    <span 
                      className="text-xs font-medium"
                      style={{ color: timeColor }}
                    >
                      {formatDate(file.lastModified)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 提示信息 */}
        {notExistsCount > 0 && (
          <div className="px-6 py-3 bg-yellow-50 border-t border-b border-yellow-200">
            <p className="text-sm text-yellow-800">
              ⚠️ 提示：有 {notExistsCount} 个文件未生成，这些文件需要先保存标签才能导出。
            </p>
          </div>
        )}

        {/* 按钮区 */}
        <div className="px-6 py-4 border-t flex gap-4" style={{ borderColor: theme.border }}>
          {/* 小按钮 - 退出 */}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg flex items-center justify-center transition-all hover:opacity-90 border"
            style={{
              backgroundColor: 'white',
              color: theme.primary,
              borderColor: theme.primary,
              fontSize: '14px'
            }}
          >
            退出
          </button>

          {/* 大按钮 - 从历史记录中导出 */}
          <button
            onClick={onExportFromHistory}
            disabled={existsCount === 0}
            className="flex-1 px-6 py-3 rounded-lg flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: theme.accent,
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: `0 4px 6px ${theme.neutral}33`
            }}
          >
            <FileDown className="mr-2" size={20} />
            从历史记录中导出 ({existsCount} 个)
          </button>
        </div>
      </div>
    </div>
  )
}

