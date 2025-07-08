'use client'

import { useState, useEffect } from 'react'
import { FileText, Globe, DollarSign, ExternalLink, Copy, Check } from 'lucide-react'

interface ParseResultsDisplayProps {
  results: any[]
  onClose: () => void
}

interface ParsedOutput {
  language: string
  translation: string
}

export default function ParseResultsDisplay({ results, onClose }: ParseResultsDisplayProps) {
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0) // 当前选中的文件索引
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
    console.log('原始翻译数据:', translation)
    
    try {
      // 尝试解析JSON
      const parsed = JSON.parse(translation)
      console.log('解析后的数据:', parsed)
      
      if (Array.isArray(parsed)) {
        console.log('数组长度:', parsed.length)
        return parsed.filter(item => item && item.trim() !== '')
      }
      
      // 如果不是数组，但是解析成功，返回单个元素
      return [String(parsed)]
    } catch {
      // JSON解析失败，尝试其他方式
      console.log('JSON解析失败，尝试其他方式')
      
      // 尝试按行分割
      const lines = translation.split('\n').filter(line => line.trim() !== '')
      if (lines.length > 1) {
        console.log('按行分割结果:', lines.length, '行')
        return lines
      }
      
      // 尝试按数字序号分割（如 "1. xxx 2. xxx"）
      const numberedItems = translation.split(/\d+\.\s+/).filter(item => item.trim() !== '')
      if (numberedItems.length > 1) {
        console.log('按序号分割结果:', numberedItems.length, '项')
        return numberedItems
      }
      
      // 默认返回原始字符串
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
        <div className="flex-1 overflow-hidden flex flex-col">
          {results.map((result, resultIndex) => {
            const parsedResult = parseResults(result)
            const output = parsedResult.output || []

            return (
              <div key={resultIndex} className="flex-1 flex flex-col">
                {/* 总览信息 */}
                <div className="bg-blue-50 p-4 border-b border-blue-200">
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

                {/* 标签页导航 */}
                {Array.isArray(output) && output.length > 0 && (
                  <div className="border-b border-gray-200 bg-white">
                    <div className="flex overflow-x-auto">
                      {output.map((item: ParsedOutput, fileIndex: number) => (
                        <button
                          key={fileIndex}
                          onClick={() => setActiveFileIndex(fileIndex)}
                          className={`group flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                            activeFileIndex === fileIndex
                              ? 'border-blue-500 text-blue-600 bg-white'
                              : 'border-transparent text-gray-500 hover:text-gray-600 hover:border-gray-200 bg-gray-50 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <FileText className={`h-4 w-4 transition-colors duration-200 ${
                              activeFileIndex === fileIndex ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-600'
                            }`} />
                            <span>文件 {fileIndex + 1}</span>
                            <div className="flex items-center space-x-1">
                              <Globe className={`h-3 w-3 transition-colors duration-200 ${
                                activeFileIndex === fileIndex ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-600'
                              }`} />
                              <span className="text-xs">
                                {item.language || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 当前选中文件的内容 */}
                <div 
                  className="flex-1 overflow-y-auto p-4"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#CBD5E0 #F7FAFC',
                    maxHeight: 'calc(90vh - 300px)'
                  }}
                >
                  {Array.isArray(output) && output.length > 0 && output[activeFileIndex] ? (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-800 mb-3 flex items-center sticky top-0 bg-white py-2 -mx-4 px-4 border-b border-gray-100 z-10">
                          <Globe className="h-4 w-4 mr-2" />
                          翻译内容
                          <span className="ml-2 text-xs text-gray-500">
                            (文件 {activeFileIndex + 1} - {output[activeFileIndex].language || '未识别'})
                          </span>
                          <span className="ml-auto text-xs text-blue-600">
                            共 {getTranslationArray(output[activeFileIndex].translation).length} 条
                          </span>
                        </h4>
                        <div className="space-y-2 mt-4">
                          {getTranslationArray(output[activeFileIndex].translation).map((text: string, textIndex: number) => (
                            <div
                              key={textIndex}
                              className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors duration-200 border border-gray-200 hover:border-gray-300"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 flex items-start">
                                  <span className="text-xs font-medium text-blue-600 mr-3 mt-0.5 flex-shrink-0 bg-blue-50 px-2 py-1 rounded">
                                    {textIndex + 1}
                                  </span>
                                  <div className="text-sm text-gray-900 leading-relaxed min-h-[1.5rem]">
                                    {text || '(空内容)'}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copyToClipboard(text, `${activeFileIndex}-${textIndex}`)
                                  }}
                                  className={`ml-2 p-1.5 rounded-md transition-all duration-200 flex-shrink-0 ${
                                    copiedIndex === `${activeFileIndex}-${textIndex}` 
                                      ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                                  }`}
                                  title={copiedIndex === `${activeFileIndex}-${textIndex}` ? "已复制" : "复制内容"}
                                >
                                  {copiedIndex === `${activeFileIndex}-${textIndex}` ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* 滚动提示 */}
                        {getTranslationArray(output[activeFileIndex].translation).length > 5 && (
                          <div className="text-center py-4 text-xs text-gray-400 border-t border-gray-100 mt-4">
                            <span className="bg-gray-100 px-3 py-1 rounded-full">
                              ↑ 向上滚动查看更多内容 ↑
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm">暂无解析结果</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 底部操作栏 */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              💡 点击标签页切换文件，点击复制按钮复制内容
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