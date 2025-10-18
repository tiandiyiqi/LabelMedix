'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit, Check, X, Search } from 'lucide-react'

interface Keyword {
  id: number
  keyword: string
  field_type: string
  is_active: boolean
}

interface GroupedKeywords {
  basic_info: Keyword[]
  number_field: Keyword[]
  drug_name: Keyword[]
  number_of_sheets: Keyword[]
  company_name: Keyword[]
}

interface Theme {
  name: string
  primary: string
  secondary: string
  background: string
  accent: string
  text: string
  lightText: string
  border: string
  buttonText: string
}

interface KeywordListManagerProps {
  theme: Theme
}

const FIELD_TYPE_NAMES = {
  basic_info: '基本信息清单',
  number_field: '编号清单',
  drug_name: '药品名清单',
  number_of_sheets: '药品片数清单',
  company_name: '公司名清单'
}

export default function KeywordListManager({ theme }: KeywordListManagerProps) {
  const [keywords, setKeywords] = useState<GroupedKeywords>({
    basic_info: [],
    number_field: [],
    drug_name: [],
    number_of_sheets: [],
    company_name: []
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<keyof typeof FIELD_TYPE_NAMES>('basic_info')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // 加载关键词数据
  const fetchKeywords = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/field-type-keywords')
      const data = await response.json()
      if (data.success) {
        setKeywords(data.data.grouped)
      }
    } catch (error) {
      console.error('加载关键词失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeywords()
  }, [])

  // 添加新关键词
  const handleAdd = async () => {
    if (!newKeyword.trim()) return

    try {
      const response = await fetch('http://localhost:3001/api/field-type-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          field_type: activeTab
        })
      })

      const data = await response.json()
      if (data.success) {
        setNewKeyword('')
        await fetchKeywords()
      } else {
        alert(data.message || '添加失败')
      }
    } catch (error) {
      console.error('添加关键词失败:', error)
      alert('添加失败')
    }
  }

  // 更新关键词
  const handleSave = async (id: number) => {
    if (!editingText.trim()) return

    try {
      const response = await fetch(`http://localhost:3001/api/field-type-keywords/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: editingText.trim()
        })
      })

      const data = await response.json()
      if (data.success) {
        setEditingId(null)
        setEditingText('')
        await fetchKeywords()
      } else {
        alert(data.message || '更新失败')
      }
    } catch (error) {
      console.error('更新关键词失败:', error)
      alert('更新失败')
    }
  }

  // 删除关键词
  const handleDelete = async (id: number, keyword: string) => {
    if (!confirm(`确定要删除关键词"${keyword}"吗？`)) return

    try {
      const response = await fetch(`http://localhost:3001/api/field-type-keywords/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        await fetchKeywords()
      } else {
        alert(data.message || '删除失败')
      }
    } catch (error) {
      console.error('删除关键词失败:', error)
      alert('删除失败')
    }
  }

  // 开始编辑
  const startEdit = (id: number, keyword: string) => {
    setEditingId(id)
    setEditingText(keyword)
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setEditingText('')
  }

  // 过滤关键词
  const filteredKeywords = keywords[activeTab].filter(kw =>
    kw.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="text-center py-8 text-gray-500">加载中...</div>
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 标签页 */}
      <div className="flex gap-2 overflow-x-auto bg-gray-50 px-4 py-3">
        {Object.entries(FIELD_TYPE_NAMES).map(([key, name]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as keyof typeof FIELD_TYPE_NAMES)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all rounded-lg flex-shrink-0 ${
              activeTab === key
                ? 'shadow-md'
                : 'bg-white text-black hover:bg-gray-100 border border-gray-200'
            }`}
            style={activeTab === key ? {
              backgroundColor: theme.primary,
              color: theme.buttonText,
              border: 'none'
            } : {}}
          >
            <div className="flex items-center gap-2">
              <span>{name}</span>
              <span 
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  activeTab === key ? '' : 'bg-gray-200 text-gray-600'
                }`}
                style={activeTab === key ? {
                  backgroundColor: theme.buttonText,
                  color: theme.primary
                } : {}}
              >
                {keywords[key as keyof typeof FIELD_TYPE_NAMES].length}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* 搜索和添加 */}
      <div className="p-6 space-y-4 bg-white border-b border-gray-200">
        {/* 搜索 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="搜索关键词..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
          />
        </div>

        {/* 添加新关键词 */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder={`添加新的${FIELD_TYPE_NAMES[activeTab]}...`}
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
          />
          <button
            onClick={handleAdd}
            disabled={!newKeyword.trim()}
            className="px-6 py-3 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow transition-all"
            style={!newKeyword.trim() ? {} : {
              backgroundColor: theme.primary,
              color: theme.buttonText
            }}
            onMouseEnter={(e) => {
              if (newKeyword.trim()) {
                e.currentTarget.style.backgroundColor = theme.accent
              }
            }}
            onMouseLeave={(e) => {
              if (newKeyword.trim()) {
                e.currentTarget.style.backgroundColor = theme.primary
              }
            }}
          >
            <Plus className="h-4 w-4" />
            添加
          </button>
        </div>
      </div>

      {/* 关键词列表 */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {filteredKeywords.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            {searchTerm ? '没有找到匹配的关键词' : '暂无关键词，请添加'}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* 表格头 */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="col-span-1 text-xs font-medium text-gray-600 text-center">序号</div>
              <div className="col-span-10 text-xs font-medium text-gray-600">关键词</div>
              <div className="col-span-1 text-xs font-medium text-gray-600 text-center">操作</div>
            </div>
            
            {/* 表格内容 */}
            {filteredKeywords.map((kw, index) => (
              <div
                key={kw.id}
                className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-gray-100 transition-colors group last:border-b-0"
                style={{
                  '--hover-bg': theme.background
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.background
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {editingId === kw.id ? (
                  // 编辑模式
                  <>
                    <div className="col-span-1 flex items-center justify-center">
                      <span className="text-sm text-gray-500">{index + 1}</span>
                    </div>
                    <div className="col-span-10 flex items-center">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSave(kw.id)}
                        className="w-full px-3 py-1.5 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleSave(kw.id)}
                        className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                        title="保存"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="取消"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  // 显示模式
                  <>
                    <div className="col-span-1 flex items-center justify-center">
                      <span className="text-sm text-black font-medium">
                        {index + 1}
                      </span>
                    </div>
                    <div className="col-span-10 flex items-center">
                      <span className="text-sm text-black">{kw.keyword}</span>
                    </div>
                    <div className="col-span-1 flex items-center justify-center gap-1">
                      <button
                        onClick={() => startEdit(kw.id, kw.keyword)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="编辑"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(kw.id, kw.keyword)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="border-t border-gray-200 px-6 py-3 bg-white">
        <div className="text-xs text-gray-600">
          当前分类共 <span className="font-semibold" style={{ color: theme.primary }}>{filteredKeywords.length}</span> 个关键词
          {searchTerm && ` (过滤自 ${keywords[activeTab].length} 个)`}
        </div>
      </div>
    </div>
  )
}

