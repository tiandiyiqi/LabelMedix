"use client"

import { useState, useContext } from "react"
import { Search, Plus, Edit, Trash2, Save } from "lucide-react"
import { ThemeContext } from "./Layout"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { batchProcessFiles } from '@/lib/cozeApi'
import ParseResultsDisplay from './ParseResultsDisplay'

export default function ProjectList() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const [projects, setProjects] = useState([
    { id: 1, name: "阿司匹林", languages: ["中文", "English", "Español"] },
    { id: 2, name: "布洛芬", languages: ["中文", "English", "Français"] },
    { id: 3, name: "对乙酰氨基酚", languages: ["中文", "English", "Deutsch"] },
  ])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [workStatus, setWorkStatus] = useState<'idle' | 'preparing' | 'uploading' | 'uploaded' | 'parsing' | 'parsed' | 'success' | 'error'>('idle')
  const [parseResults, setParseResults] = useState<any[]>([])
  const [statusMessage, setStatusMessage] = useState('')
  const [showParseResults, setShowParseResults] = useState(false)
  const [hasError, setHasError] = useState(false)

  const handleEdit = (project: { id: number; name: string }) => {
    setEditingId(project.id)
    setEditingName(project.name)
  }

  const handleSave = (id: number) => {
    setProjects(projects.map((p) => (p.id === id ? { ...p, name: editingName } : p)))
    setEditingId(null)
  }

  const handleDelete = (id: number) => {
    setProjects(projects.filter((p) => p.id !== id))
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setUploadedFiles(prev => {
      const newFiles = [...prev, ...files]
      // 清除错误状态
      if (hasError && newFiles.length > 0) {
        setHasError(false)
        setWorkStatus('idle')
        setStatusMessage('')
      }
      return newFiles
    })
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAIParse = async () => {
    // 清除之前的错误状态
    setHasError(false)
    
    if (!projectName.trim()) {
      setHasError(true)
      setWorkStatus('error')
      setStatusMessage('❌ 请输入工单名称')
      return
    }
    
    if (uploadedFiles.length === 0) {
      setHasError(true)
      setWorkStatus('error')
      setStatusMessage('❌ 请上传至少一个文件')
      return
    }

    try {
      // 1. 准备阶段
      setWorkStatus('preparing')
      setStatusMessage('📋 正在准备文件处理...')
      
      // 2. 调用Coze API进行批量文件处理，使用状态回调
      const result = await batchProcessFiles(uploadedFiles, projectName, (status, message) => {
        setWorkStatus(status as any)
        setStatusMessage(message)
      })
      
      // 3. 解析完成
      setWorkStatus('success')
      setStatusMessage(`🎉 解析成功！已处理 ${uploadedFiles.length} 个文件，点击查看解析结果`)
      
      // 保存解析结果
      setParseResults([result] as any[])
    } catch (error) {
      console.error('AI解析错误:', error)
      setWorkStatus('error')
      setStatusMessage(`❌ 解析失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const resetForm = () => {
    setProjectName('')
    setUploadedFiles([])
    setWorkStatus('idle')
    setStatusMessage('')
    setParseResults([])
    setShowParseResults(false)
    setHasError(false)
  }

  const handleSubmit = () => {
    // 清除之前的错误状态
    setHasError(false)
    
    if (!projectName.trim()) {
      setHasError(true)
      setWorkStatus('error')
      setStatusMessage('❌ 请输入工单名称')
      return
    }
    
    if (uploadedFiles.length === 0) {
      setHasError(true)
      setWorkStatus('error')
      setStatusMessage('❌ 请上传至少一个文件')
      return
    }

    // 创建项目逻辑
    setWorkStatus('success')
    setStatusMessage('项目创建成功！')
    
    setTimeout(() => {
      setIsNewProjectOpen(false)
      resetForm()
    }, 2000)
  }

  const getStatusIcon = () => {
    switch (workStatus) {
      case 'preparing':
      case 'uploading':
      case 'uploaded':
      case 'parsing':
      case 'parsed':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full bg-white bg-opacity-75">
      <div 
        className="flex items-center h-[60px] px-6"
        style={{ 
          backgroundColor: theme.secondary,
          borderBottom: `1px solid ${theme.neutral}`
        }}
      >
        <div className="text-xl font-bold text-white">
          项目管理
        </div>
      </div>

      <div className="p-4 flex-1">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="搜索项目..."
            className="w-full pl-10 pr-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-shadow"
            style={{ 
              borderColor: theme.border,
              backgroundColor: "white",
              color: theme.text,
            }}
          />
          <Search className="absolute left-3 top-2.5" style={{ color: theme.subtext }} size={20} />
        </div>
        <ul className="space-y-2">
          {projects.map((project) => (
            <li
              key={project.id}
              className="p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              style={{ 
                backgroundColor: "white",
                borderColor: theme.border,
                borderWidth: "1px",
              }}
            >
              {editingId === project.id ? (
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 px-2 py-1 rounded mr-2"
                    style={{ 
                      borderColor: theme.border,
                      backgroundColor: "white",
                      color: theme.text,
                    }}
                  />
                  <button
                    onClick={() => handleSave(project.id)}
                    className="p-1 rounded hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: theme.primary, color: "white" }}
                  >
                    <Save size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium" style={{ color: theme.text }}>{project.name}</div>
                    <div className="text-sm" style={{ color: theme.subtext }}>
                      {project.languages.join(", ")}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(project)}
                      className="p-1 rounded hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: theme.secondary, color: theme.buttonText }}
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="p-1 rounded hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: theme.accent, color: theme.buttonText }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        
        {/* 新建项目按钮 - 与项目列表保持距离 */}
        <div className="mt-6">
          <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
            <DialogTrigger asChild>
              <button
                className="w-full py-3 px-4 rounded-lg text-white font-medium hover:bg-blue-700 transition-colors"
                style={{ backgroundColor: theme.secondary }}
              >
                + 新建项目
              </button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-[600px] bg-white">
              <DialogHeader>
                <DialogTitle>新建项目</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* 文件上传区域 */}
                <div className="space-y-2">
                  <Label>上传文件</Label>
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 hover:bg-gray-50 transition-colors">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          点击上传文件或拖拽文件到此处
                        </span>
                        <p className="mt-1 text-xs text-gray-500">
                          支持 PDF、JPG、PNG 格式，可选择多个文件
                        </p>
                      </div>
                    </div>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="sr-only"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>

                {/* 工单名输入 */}
                <div className="space-y-2">
                  <Label htmlFor="project-name" className="text-base font-semibold text-gray-800">工单名称 *</Label>
                  <Input
                    id="project-name"
                    placeholder="请输入工单名称"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value)
                      // 清除错误状态
                      if (hasError && e.target.value.trim()) {
                        setHasError(false)
                        setWorkStatus('idle')
                        setStatusMessage('')
                      }
                    }}
                    className={`placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                      hasError && !projectName.trim() ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                </div>

                {/* 上传文件列表 */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <Label>已上传文件</Label>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <FileText className="h-3 w-3 text-gray-500 flex-shrink-0" />
                            <span className="text-xs text-gray-700 truncate">{file.name}</span>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="ml-2 px-2 py-1 text-xs bg-red-100 text-white rounded hover:bg-red-300 transition-colors flex-shrink-0"
                            title="删除文件"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 工作状态显示 */}
                <div className={`p-3 rounded ${hasError || workStatus === 'error' ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon()}
                      <span className="text-sm font-medium">工作状态：</span>
                      <span className={`text-sm ${hasError || workStatus === 'error' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {statusMessage || '等待操作...'}
                      </span>
                    </div>
                    {workStatus === 'success' && parseResults.length > 0 && (
                      <Button
                        onClick={() => {
                          // 先关闭新建项目窗口
                          setIsNewProjectOpen(false)
                          // 然后显示解析结果
                          setShowParseResults(true)
                        }}
                        variant="outline"
                        size="sm"
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        查看解析结果
                      </Button>
                    )}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex space-x-3">
                  <Button
                    onClick={handleAIParse}
                    disabled={uploadedFiles.length === 0 || workStatus === 'parsing'}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {workStatus === 'parsing' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        AI解析中...
                      </>
                    ) : (
                      'AI解析'
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleSubmit}
                    disabled={!projectName.trim() || uploadedFiles.length === 0 || workStatus === 'parsing'}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    创建项目
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 解析结果显示 */}
      {showParseResults && (
        <ParseResultsDisplay
          results={parseResults}
          onClose={() => {
            // 关闭解析结果窗口
            setShowParseResults(false)
            // 重新打开新建项目窗口
            setIsNewProjectOpen(true)
          }}
        />
      )}
    </div>
  )
}

