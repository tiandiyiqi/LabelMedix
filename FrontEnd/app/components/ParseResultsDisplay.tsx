'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, FileText, Globe, DollarSign, ExternalLink, Copy, Check } from 'lucide-react'

interface ParseResultsDisplayProps {
  results: any[]
  onClose: () => void
}

interface ParsedOutput {
  language: string
  translation: string
}

export default function ParseResultsDisplay({ results, onClose }: ParseResultsDisplayProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set([0])) // 默认展开第一个文件
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)

  // 添加键盘事件监听和防止背景滚动
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    // 防止背景滚动
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const toggleFileExpansion = (index: number) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedFiles(newExpanded)
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(id)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  const parseResults = (result: any) => {
    try {
      if (result.data && typeof result.data === 'string') {
        const parsedData = JSON.parse(result.data)
        return parsedData
      }
      return result
    } catch (error) {
      console.error('解析结果失败:', error)
      return result
    }
  }

  const getTranslationArray = (translation: string): string[] => {
    try {
      const parsed = JSON.parse(translation)
      return Array.isArray(parsed) ? parsed : [translation]
    } catch {
      return [translation]
    }
  }

  // 处理背景点击关闭
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // 阻止内容区域的点击事件冒泡
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center"
      onClick={handleBackgroundClick}
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={handleContentClick}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">AI解析结果</h2>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="text-blue-100 hover:text-red-500 text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition-all duration-200"
            title="关闭"
          >
            ×
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          {results.map((result, resultIndex) => {
            const parsedResult = parseResults(result)
            const output = parsedResult.output || []

            return (
              <div key={resultIndex} className="space-y-4">
                {/* 总览信息 */}
                <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        解析完成 - 共处理 {Array.isArray(output) ? output.length : 0} 个文件
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-blue-700">
                      {result.cost && (
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span>费用: {result.cost}</span>
                        </div>
                      )}
                      {result.debug_url && (
                        <a
                          href={result.debug_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 hover:text-blue-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>调试链接</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* 文件列表 */}
                {Array.isArray(output) && output.map((item: ParsedOutput, fileIndex: number) => (
                  <div key={fileIndex} className="border rounded-lg overflow-hidden">
                    {/* 文件头部 */}
                    <div
                      className="bg-gray-50 p-3 cursor-pointer hover:bg-blue-50 transition-all duration-200 border-b border-gray-200"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFileExpansion(fileIndex)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {expandedFiles.has(fileIndex) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                          <FileText className="h-4 w-4 text-gray-600" />
                          <div className="flex items-center space-x-4">
                            <span className="text-sm font-medium text-gray-900">
                              文件 {fileIndex + 1}
                            </span>
                            <div className="flex items-center space-x-1">
                              <Globe className="h-3 w-3 text-gray-500" />
                              <span className="text-xs text-gray-600">
                                语言: {item.language || '未识别'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {expandedFiles.has(fileIndex) ? '点击收起' : '点击展开详情'}
                        </div>
                      </div>
                    </div>

                    {/* 文件内容 */}
                    {expandedFiles.has(fileIndex) && (
                      <div className="p-3 bg-white">
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
                              <Globe className="h-3 w-3 mr-1" />
                              翻译内容
                            </h4>
                            <div className="space-y-1">
                              {getTranslationArray(item.translation).map((text: string, textIndex: number) => (
                                <div
                                  key={textIndex}
                                  className="bg-gray-50 rounded-lg p-2.5 hover:bg-gray-100 transition-colors duration-200"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 flex items-start">
                                      <span className="text-xs font-medium text-blue-600 mr-3 mt-0.5 flex-shrink-0">
                                        {textIndex + 1}.
                                      </span>
                                      <div className="text-sm text-gray-900 leading-relaxed">
                                        {text}
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copyToClipboard(text, `${fileIndex}-${textIndex}`)
                                      }}
                                      className={`ml-2 p-1.5 rounded-md transition-all duration-200 flex-shrink-0 ${
                                        copiedIndex === `${fileIndex}-${textIndex}` 
                                          ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                                      }`}
                                      title={copiedIndex === `${fileIndex}-${textIndex}` ? "已复制" : "复制内容"}
                                    >
                                      {copiedIndex === `${fileIndex}-${textIndex}` ? (
                                        <Check className="h-3 w-3" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* 如果没有输出数据 */}
                {(!Array.isArray(output) || output.length === 0) && (
                  <div className="text-center py-6 text-gray-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">暂无解析结果</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 底部操作栏 */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              💡 点击文件标题展开/收起，点击复制按钮复制内容
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 