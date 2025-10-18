'use client'

import { useState, useEffect } from 'react'
import { FileText, Globe, DollarSign, ExternalLink, Copy, Check } from 'lucide-react'

interface ParseResultsDisplayProps {
  results: any[]
  onClose: () => void
}

interface ParsedOutput {
  countryCode: string
  original: string[]
  translation: string[]
}

export default function ParseResultsDisplay({ results, onClose }: ParseResultsDisplayProps) {
  const [activeCountryIndex, setActiveCountryIndex] = useState<number>(0) // 当前选中的国家/地区索引
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

  const parseResults = (result: any): ParsedOutput[] => {
    try {
      let parsedData = result
      
      // 如果 result.data 是字符串，先解析它
      if (result.data && typeof result.data === 'string') {
        parsedData = JSON.parse(result.data)
      }
      
      // 提取 output 对象
      const output = parsedData.output || result.output || {}
      
      // 将 output 对象转换为数组格式
      const outputArray = Object.entries(output).map(([countryCode, countryData]: [string, any]) => {
        // 新格式：{ original: [...], translation: [...] }
        if (countryData && typeof countryData === 'object' && !Array.isArray(countryData)) {
          return {
            countryCode: countryCode,
            original: Array.isArray(countryData.original) ? countryData.original : [],
            translation: Array.isArray(countryData.translation) ? countryData.translation : []
          }
        }
        // 兼容旧格式：直接是数组
        else if (Array.isArray(countryData)) {
          return {
            countryCode: countryCode,
            original: countryData,
            translation: countryData
          }
        }
        // 其他情况
        return {
          countryCode: countryCode,
          original: [],
          translation: []
        }
      })
      
      console.log('解析后的输出数组:', outputArray)
      return outputArray
    } catch (error) {
      console.error('解析结果失败:', error)
      return []
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
            const outputArray = parseResults(result)

            return (
              <div key={resultIndex} className="flex-1 flex flex-col">
                {/* 总览信息 */}
                <div className="bg-blue-50 p-4 border-b border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        解析完成 - 共处理 {outputArray.length} 个国家/地区
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
                {outputArray.length > 0 && (
                  <div className="border-b border-gray-200 bg-white">
                    <div className="flex overflow-x-auto">
                      {outputArray.map((item: ParsedOutput, countryIndex: number) => (
                        <button
                          key={countryIndex}
                          onClick={() => setActiveCountryIndex(countryIndex)}
                          className={`group flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                            activeCountryIndex === countryIndex
                              ? 'border-blue-500 text-blue-600 bg-white'
                              : 'border-transparent text-gray-500 hover:text-gray-600 hover:border-gray-200 bg-gray-50 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Globe className={`h-4 w-4 transition-colors duration-200 ${
                              activeCountryIndex === countryIndex ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-600'
                            }`} />
                            <span className="font-semibold">{item.countryCode}</span>
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {item.original.length} 条
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 当前选中国家/地区的内容 */}
                <div 
                  className="flex-1 overflow-y-auto p-4"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#CBD5E0 #F7FAFC',
                    maxHeight: 'calc(90vh - 300px)'
                  }}
                >
                  {outputArray.length > 0 && outputArray[activeCountryIndex] ? (
                    <div className="space-y-1">
                      {/* 标题栏 */}
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg sticky top-0 z-10">
                        <div className="col-span-1 flex justify-center">
                          <span className="text-xs font-medium text-gray-600">序号</span>
                        </div>
                        <div className="col-span-5 border-r border-gray-300 pr-3">
                          <div className="text-xs font-medium text-gray-600 flex items-center">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5"></span>
                            原文
                          </div>
                        </div>
                        <div className="col-span-6 pl-3">
                          <div className="text-xs font-medium text-gray-600 flex items-center">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
                            翻译
                          </div>
                        </div>
                      </div>
                      
                      {/* 内容行 */}
                      {outputArray[activeCountryIndex].original.map((originalText: string, textIndex: number) => {
                        const translatedText = outputArray[activeCountryIndex].translation[textIndex] || originalText
                        return (
                          <div
                            key={textIndex}
                            className="border-l border-r border-b hover:shadow-sm transition-shadow bg-white group last:rounded-b-lg"
                          >
                            <div className="grid grid-cols-12 gap-2 p-3 items-start">
                              {/* 第一列：序号 */}
                              <div className="col-span-1 flex justify-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-medium">
                                  {textIndex + 1}
                                </span>
                              </div>
                              
                              {/* 第二列：原文 + 复制按钮 */}
                              <div className="col-span-5 border-r border-gray-200 pr-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm text-gray-700 leading-relaxed break-words flex-1">
                                    {originalText || '(空内容)'}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      copyToClipboard(originalText, `${activeCountryIndex}-${textIndex}-original`)
                                    }}
                                    className={`flex-shrink-0 p-1 rounded-md transition-all duration-200 ${
                                      copiedIndex === `${activeCountryIndex}-${textIndex}-original` 
                                        ? 'bg-green-100 text-green-600' 
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 opacity-0 group-hover:opacity-100'
                                    }`}
                                    title={copiedIndex === `${activeCountryIndex}-${textIndex}-original` ? "已复制原文" : "复制原文"}
                                  >
                                    {copiedIndex === `${activeCountryIndex}-${textIndex}-original` ? (
                                      <Check className="h-3 w-3" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              
                              {/* 第三列：翻译 + 复制按钮 */}
                              <div className="col-span-6 pl-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm text-gray-900 leading-relaxed break-words flex-1">
                                    {translatedText || '(空内容)'}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      copyToClipboard(translatedText, `${activeCountryIndex}-${textIndex}-translation`)
                                    }}
                                    className={`flex-shrink-0 p-1 rounded-md transition-all duration-200 ${
                                      copiedIndex === `${activeCountryIndex}-${textIndex}-translation` 
                                        ? 'bg-green-100 text-green-600' 
                                        : 'bg-blue-100 text-blue-500 hover:bg-blue-200 opacity-0 group-hover:opacity-100'
                                    }`}
                                    title={copiedIndex === `${activeCountryIndex}-${textIndex}-translation` ? "已复制翻译" : "复制翻译"}
                                  >
                                    {copiedIndex === `${activeCountryIndex}-${textIndex}-translation` ? (
                                      <Check className="h-3 w-3" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      
                      {/* 滚动提示 */}
                      {outputArray[activeCountryIndex].original.length > 5 && (
                        <div className="text-center py-4 text-xs text-gray-400 border-t border-gray-100 mt-4">
                          <span className="bg-gray-100 px-3 py-1 rounded-full">
                            ↑ 向上滚动查看更多内容 ↑
                          </span>
                        </div>
                      )}
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
              💡 点击标签页切换国家/地区，点击复制按钮复制内容
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