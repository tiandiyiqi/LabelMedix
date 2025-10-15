"use client"

import { useState, useContext, useEffect } from "react"
import { Search, Plus, Edit, Trash2, Save } from "lucide-react"
import { ThemeContext } from "./Layout"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { batchProcessFiles } from '@/lib/cozeApi'
import { getProjects, createProject, deleteProject as deleteProjectApi } from '@/lib/projectApi'
import type { Project } from '@/lib/projectApi'
import ParseResultsDisplay from './ParseResultsDisplay'

export default function ProjectList() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const [projects, setProjects] = useState<Project[]>([])
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
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')

  // 加载项目列表
  const loadProjects = async (search?: string) => {
    try {
      setIsLoading(true)
      const { projects: projectList } = await getProjects(1, 100, undefined, search)
      setProjects(projectList)
    } catch (error) {
      console.error('加载项目列表失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value)
    loadProjects(value)
  }

  // 组件挂载时加载项目列表
  useEffect(() => {
    loadProjects()
  }, [])

  const handleEdit = (project: Project) => {
    setEditingId(project.id)
    setEditingName(project.job_name)
  }

  const handleSave = async (id: number) => {
    try {
      // TODO: 调用更新项目API
      setProjects(projects.map((p) => (p.id === id ? { ...p, job_name: editingName } : p)))
      setEditingId(null)
    } catch (error) {
      console.error('更新项目失败:', error)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteProjectApi(id)
      setProjects(projects.filter((p) => p.id !== id))
    } catch (error) {
      console.error('删除项目失败:', error)
    }
  }

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles = fileArray.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
      return validTypes.includes(file.type)
    })
    
    if (validFiles.length !== fileArray.length) {
      setHasError(true)
      setWorkStatus('error')
      setStatusMessage('❌ 部分文件格式不支持，仅支持 PDF、JPG、PNG 格式')
      return
    }
    
    setUploadedFiles(prev => {
      const newFiles = [...prev, ...validFiles]
      // 清除错误状态
      if (hasError && newFiles.length > 0) {
        setHasError(false)
        setWorkStatus('idle')
        setStatusMessage('')
      }
      return newFiles
    })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      processFiles(files)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    
    const files = event.dataTransfer.files
    if (files) {
      processFiles(files)
    }
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

  const handleParseAndCreate = async () => {
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
      
      // 添加调试日志
      console.log('🔍 Coze API 返回结果:', result)
      console.log('🔍 result.data:', result.data)
      console.log('🔍 result.output:', result.output)
      
      // 3. 解析完成后直接创建项目
      setWorkStatus('parsed')
      setStatusMessage('💾 正在保存项目到数据库...')
      
      // 调用后端API创建项目
      const createdProject = await createProject({
        job_name: projectName,
        job_description: `包含 ${uploadedFiles.length} 个文件`,
        coze_result: result as any,
      })
      
      console.log('✅ 项目创建响应:', createdProject)
      
      // 保存解析结果
      setParseResults([result] as any[])
      
      // 更新项目列表
      await loadProjects()
      
      setWorkStatus('success')
      setStatusMessage(`🎉 解析并创建项目成功！已处理 ${uploadedFiles.length} 个文件`)
      
      // 延迟关闭窗口
      setTimeout(() => {
        setIsNewProjectOpen(false)
        resetForm()
      }, 2000)
    } catch (error) {
      console.error('解析并创建项目错误:', error)
      setWorkStatus('error')
      setStatusMessage(`❌ 解析并创建项目失败: ${error instanceof Error ? error.message : '未知错误'}`)
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

  const handleSubmit = async () => {
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
      setWorkStatus('preparing')
      setStatusMessage('📝 正在创建项目...')
      
      // 检查是否有解析结果，如果有则使用解析结果创建项目
      const cozeResult = parseResults.length > 0 ? parseResults[0] : undefined
      
      const createdProject = await createProject({
        job_name: projectName,
        job_description: `包含 ${uploadedFiles.length} 个文件`,
        coze_result: cozeResult as any,
      })
      
      // 更新项目列表
      await loadProjects()
      
      setWorkStatus('success')
      const resultMessage = cozeResult 
        ? '✅ 项目创建成功！已保存AI解析结果' 
        : '✅ 项目创建成功！'
      setStatusMessage(resultMessage)
      
      setTimeout(() => {
        setIsNewProjectOpen(false)
        resetForm()
      }, 2000)
    } catch (error) {
      console.error('创建项目失败:', error)
      setWorkStatus('error')
      setStatusMessage(`❌ 创建项目失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
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
            placeholder="搜索项目（工单名称或描述）..."
            value={searchKeyword}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-shadow"
            style={{ 
              borderColor: theme.border,
              backgroundColor: "white",
              color: theme.text,
            }}
          />
          <Search className="absolute left-3 top-2.5" style={{ color: theme.subtext }} size={20} />
        </div>
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: theme.primary }} />
            <p className="mt-2" style={{ color: theme.subtext }}>加载中...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg" style={{ color: theme.subtext }}>
              {searchKeyword ? '未找到匹配的项目' : '暂无项目，请创建新项目'}
            </p>
            {searchKeyword && (
              <button
                onClick={() => {
                  setSearchKeyword('')
                  loadProjects()
                }}
                className="mt-4 px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: theme.primary }}
              >
                清除搜索
              </button>
            )}
          </div>
        ) : (
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
                    <div className="font-medium" style={{ color: theme.text }}>{project.job_name}</div>
                    <div className="text-sm" style={{ color: theme.subtext }}>
                      {project.statistics ? `${project.statistics.countryCount} 个国家/地区 · ${project.statistics.translationCount} 条翻译` : '加载中...'}
                    </div>
                    <div className="text-xs mt-1" style={{ color: theme.subtext }}>
                      状态: {project.status === 'draft' ? '草稿' : project.status === 'processing' ? '处理中' : project.status === 'completed' ? '已完成' : '失败'}
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
        )}
        
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
                    <div 
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                        isDragOver 
                          ? 'border-blue-400 bg-blue-50 scale-105' 
                          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <Upload className={`mx-auto h-12 w-12 transition-colors ${
                        isDragOver ? 'text-blue-500' : 'text-gray-400'
                      }`} />
                      <div className="mt-4">
                        <span className={`mt-2 block text-sm font-medium transition-colors ${
                          isDragOver ? 'text-blue-700' : 'text-gray-900'
                        }`}>
                          {isDragOver ? '释放文件以上传' : '点击上传文件或拖拽文件到此处'}
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
                <div className="space-y-3">
                  {/* 第一行：AI解析和创建项目按钮 */}
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
                  
                  {/* 第二行：解析并创建项目按钮 */}
                  <div className="flex">
                    <Button
                      onClick={handleParseAndCreate}
                      disabled={!projectName.trim() || uploadedFiles.length === 0 || workStatus === 'parsing'}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium"
                    >
                      {workStatus === 'parsing' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          处理中...
                        </>
                      ) : (
                        '解析并创建项目'
                      )}
                    </Button>
                  </div>
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

