"use client"

import { useState, useContext, useEffect } from "react"
import { Search, Plus, Edit, Trash2, Save, GripVertical, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { ThemeContext } from "./Layout"
import { useLabelContext } from "@/lib/context/LabelContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { batchProcessFiles } from '@/lib/cozeApi'
import { getProjects, createProject, deleteProject as deleteProjectApi, getProjectById, updateProject, updateCountrySequence, getTranslationsByCountry, updateTranslation, getCountryDetails } from '@/lib/projectApi'
import type { Project } from '@/lib/projectApi'
import ParseResultsDisplay from './ParseResultsDisplay'
import { classifyFieldTypes, getFieldTypeStats, getFieldTypeName } from '@/lib/fieldClassification'
import { getFormattedKeywordList } from '@/lib/fieldTypeKeywordApi'

export default function ProjectList() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const { setSelectedProject, updateLabelData } = useLabelContext()

  const [projects, setProjects] = useState<Project[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editProjectName, setEditProjectName] = useState("")
  const [countryGroups, setCountryGroups] = useState<Array<{ id: number; country_code: string; sequence_number: number; total_items: number }>>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null)
  const [countryTranslations, setCountryTranslations] = useState<Array<{ id: number; original_text: string; translated_text: string; item_order: number; field_type: string | null }>>([])
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(false)
  const [editingTranslationId, setEditingTranslationId] = useState<number | null>(null)
  const [editingTranslationText, setEditingTranslationText] = useState("")
  const [editingFieldTypeId, setEditingFieldTypeId] = useState<number | null>(null)
  const [editingFieldType, setEditingFieldType] = useState<string>("")
  const [sortBy, setSortBy] = useState<'order' | 'field_type'>('order')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [projectName, setProjectName] = useState('')
  const [projectType, setProjectType] = useState('')
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

  // 点击项目时选中
  const handleProjectClick = async (project: Project) => {
    try {
      // 获取项目完整信息
      const projectDetail = await getProjectById(project.id)
      
      // 如果有国别翻译组，选择序号为1的国别
      if (projectDetail.translationGroups && projectDetail.translationGroups.length > 0) {
        // 按序号排序
        const sortedGroups = projectDetail.translationGroups.sort((a, b) => 
          a.sequence_number - b.sequence_number
        )
        
        // 找到序号为1的国别（可能不存在，则选择第一个）
        const firstGroup = sortedGroups.find(g => g.sequence_number === 1) || sortedGroups[0]
        
        // 获取该国别的详细信息，包括 formatted_summary 和字体设置
        const countryDetail = await getCountryDetails(project.id, firstGroup.country_code)
        
        setSelectedProject({
          id: project.id,
          job_name: project.job_name,
          currentSequence: firstGroup.sequence_number,
          countryCode: firstGroup.country_code,
          formattedSummary: countryDetail.formatted_summary || undefined
        })
        
        // 同步字体设置到LabelContext
        updateLabelData({
          fontFamily: countryDetail.font_family || 'Arial',
          secondaryFontFamily: countryDetail.secondary_font_family || 'Arial',
          textAlign: countryDetail.text_align || 'left',
          fontSize: countryDetail.font_size || 10,
          spacing: countryDetail.spacing || 1,
          lineHeight: countryDetail.line_height || 1.2
        })
      }
    } catch (error) {
      console.error('加载项目详情失败:', error)
    }
  }

  // 打开编辑对话框
  const handleEdit = async (project: Project) => {
    try {
      // 获取项目完整信息，包括国别翻译组
      const projectDetail = await getProjectById(project.id)
      setEditingProject(projectDetail)
      setEditProjectName(projectDetail.job_name)
      
      // 按序号排序国别翻译组
      const sortedGroups = (projectDetail.translationGroups || [])
        .map(group => ({
          id: group.id,
          country_code: group.country_code,
          sequence_number: group.sequence_number,
          total_items: group.total_items
        }))
        .sort((a, b) => a.sequence_number - b.sequence_number)
      
      setCountryGroups(sortedGroups)
      
      // 如果有国别，默认选中第一个
      if (sortedGroups.length > 0) {
        await handleSelectCountry(project.id, sortedGroups[0].country_code)
      }
      
      setIsEditDialogOpen(true)
    } catch (error) {
      console.error('加载项目详情失败:', error)
      alert('加载项目详情失败，请重试')
    }
  }

  // 选择国别并加载翻译内容
  const handleSelectCountry = async (projectId: number, countryCode: string) => {
    try {
      setIsLoadingTranslations(true)
      setSelectedCountryCode(countryCode)
      
      const translationGroup = await getTranslationsByCountry(projectId, countryCode)
      
      // 按 item_order 排序
      const sortedItems = (translationGroup.items || [])
        .map(item => ({
          id: item.id,
          original_text: item.original_text,
          translated_text: item.translated_text || item.original_text,
          item_order: item.item_order,
          field_type: item.field_type || null
        }))
        .sort((a, b) => a.item_order - b.item_order)
      
      setCountryTranslations(sortedItems)
    } catch (error) {
      console.error('加载翻译内容失败:', error)
      alert('加载翻译内容失败，请重试')
      setCountryTranslations([])
    } finally {
      setIsLoadingTranslations(false)
    }
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingProject) return
    
    try {
      // 1. 更新项目名称
      await updateProject(editingProject.id, {
        job_name: editProjectName,
      })
      
      // 2. 更新国别顺序
      const sequenceUpdates = countryGroups.map((group, index) => ({
        group_id: group.id,
        sequence_number: index + 1,
      }))
      
      await updateCountrySequence(editingProject.id, sequenceUpdates)
      
      // 3. 刷新项目列表
      await loadProjects()
      
      // 4. 关闭对话框
      setIsEditDialogOpen(false)
      setEditingProject(null)
      setCountryGroups([])
    } catch (error) {
      console.error('保存项目失败:', error)
      alert('保存项目失败，请重试')
    }
  }

  //新增版本
  const handleAddVersion = async () => {
    try {
      alert('新增版本测试，请开发')
      // await addVersion(editingProject.id)
    } catch (error) {
      console.error('新增版本失败:', error)
      alert('新增版本失败，请重试')
    }
  }

  // 拖放开始
  const handleCountryDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  // 拖放经过
  const handleCountryDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    
    const newGroups = [...countryGroups]
    const [draggedItem] = newGroups.splice(draggedIndex, 1)
    newGroups.splice(index, 0, draggedItem)
    
    setCountryGroups(newGroups)
    setDraggedIndex(index)
  }

  // 拖放结束
  const handleCountryDragEnd = () => {
    setDraggedIndex(null)
  }

  // 开始编辑翻译
  const handleEditTranslation = (translationId: number, currentText: string) => {
    setEditingTranslationId(translationId)
    setEditingTranslationText(currentText)
  }

  // 保存翻译编辑
  const handleSaveTranslation = async (translationId: number) => {
    if (!editingProject) return
    
    try {
      await updateTranslation(translationId, {
        translated_text: editingTranslationText,
      })
      
      // 更新本地状态
      setCountryTranslations(countryTranslations.map(item => 
        item.id === translationId 
          ? { ...item, translated_text: editingTranslationText }
          : item
      ))
      
      setEditingTranslationId(null)
      setEditingTranslationText("")
    } catch (error) {
      console.error('保存翻译失败:', error)
      alert('保存翻译失败，请重试')
    }
  }

  // 取消编辑翻译
  const handleCancelEditTranslation = () => {
    setEditingTranslationId(null)
    setEditingTranslationText("")
  }

  // 开始编辑字段类型
  const handleEditFieldType = (translationId: number, currentFieldType: string | null) => {
    setEditingFieldTypeId(translationId)
    setEditingFieldType(currentFieldType || "")
  }

  // 保存字段类型编辑
  const handleSaveFieldType = async (translationId: number) => {
    if (!editingProject) return
    
    try {
      await updateTranslation(translationId, {
        field_type: editingFieldType || null,
      })
      
      // 更新本地状态
      setCountryTranslations(countryTranslations.map(item => 
        item.id === translationId 
          ? { ...item, field_type: editingFieldType || null }
          : item
      ))
      
      setEditingFieldTypeId(null)
      setEditingFieldType("")
    } catch (error) {
      console.error('保存字段类型失败:', error)
      alert('保存字段类型失败，请重试')
    }
  }

  // 取消编辑字段类型
  const handleCancelEditFieldType = () => {
    setEditingFieldTypeId(null)
    setEditingFieldType("")
  }

  // 排序处理函数
  const handleSort = (column: 'order' | 'field_type') => {
    if (sortBy === column) {
      // 如果点击的是当前排序列，则切换排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // 如果点击的是新列，则设置为升序
      setSortBy(column)
      setSortDirection('asc')
    }
  }

  // 字段类型排序优先级
  const getFieldTypePriority = (fieldType: string | null): number => {
    const priorities = {
      'basic_info': 1,
      'number_field': 2,
      'drug_name': 3,
      'number_of_sheets': 4,
      'company_name': 5,
      'drug_description': 6,
      null: 7 // 未分类排在最后
    }
    return priorities[fieldType as keyof typeof priorities] || 7
  }

  // 获取排序后的翻译数据
  const getSortedTranslations = () => {
    const sorted = [...countryTranslations].sort((a, b) => {
      if (sortBy === 'order') {
        // 按原始顺序排序
        return sortDirection === 'asc' 
          ? a.item_order - b.item_order
          : b.item_order - a.item_order
      } else {
        // 按字段类型排序
        const priorityA = getFieldTypePriority(a.field_type)
        const priorityB = getFieldTypePriority(b.field_type)
        
        if (priorityA === priorityB) {
          // 如果字段类型相同，按原始顺序排序
          return a.item_order - b.item_order
        }
        
        return sortDirection === 'asc' 
          ? priorityA - priorityB
          : priorityB - priorityA
      }
    })
    
    return sorted
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
    
    if (!projectType.trim()) {
      setHasError(true)
      setWorkStatus('error')
      setStatusMessage('❌ 请选择工单类型')
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
      
      // 3. 解析完成后进行字段分类
      setWorkStatus('parsed')
      setStatusMessage('🏷️ 正在进行字段类型分类...')
      
      // 获取关键词清单
      const keywordList = await getFormattedKeywordList()
      console.log('📋 获取到的关键词清单:', keywordList)
      
      // 对解析结果进行字段分类
      const classifiedResult = await classifyCozeResult(result, keywordList)
      console.log('🏷️ 字段分类结果:', classifiedResult)
      
      // 4. 创建项目
      setStatusMessage('💾 正在保存项目到数据库...')
      
      // 调用后端API创建项目
      const createdProject = await createProject({
        job_name: projectName,
        job_description: `包含 ${uploadedFiles.length} 个文件`,
        coze_result: classifiedResult as any,
      })
      
      console.log('✅ 项目创建响应:', createdProject)
      
      // 保存解析结果
      setParseResults([classifiedResult] as any[])
      
      // 更新项目列表
      await loadProjects()
      
      setWorkStatus('success')
      setStatusMessage(`🎉 解析并创建项目成功！已处理 ${uploadedFiles.length} 个文件，完成字段分类`)
      
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

  /**
   * 对Coze解析结果进行字段分类
   * @param cozeResult Coze API返回的结果
   * @param keywordList 关键词清单
   * @returns 包含字段分类的结果
   */
  const classifyCozeResult = async (cozeResult: any, keywordList: any) => {
    try {
      console.log('🔍 开始字段分类，输入数据:', {
        cozeResult: cozeResult,
        keywordList: keywordList,
        hasOutput: !!cozeResult.output,
        hasData: !!cozeResult.data
      })
      
      // 解析Coze数据结构 - 数据在data字段中
      let output
      if (cozeResult.data && typeof cozeResult.data === 'string') {
        try {
          const parsedData = JSON.parse(cozeResult.data)
          output = parsedData.output
          console.log('🔧 从data字段解析出output:', output)
        } catch (error) {
          console.error('❌ 解析Coze data字段失败:', error)
          return cozeResult
        }
      } else if (cozeResult.output) {
        output = cozeResult.output
        console.log('🔧 直接使用output字段:', output)
      } else {
        console.warn('⚠️ Coze结果中没有output或data数据，跳过字段分类')
        return cozeResult
      }

      const classifiedOutput: any = {}
      
      console.log('🔍 Output数据:', output)
      console.log('🔍 Output键:', Object.keys(output))

      // 遍历每个国家/地区的翻译数据
      for (const [countryKey, countryData] of Object.entries(output)) {
        console.log(`🔍 处理国家: "${countryKey}"`, countryData)
        
        // 处理空国别码的情况
        let processedCountryKey = countryKey
        if (!countryKey || countryKey.trim() === '') {
          processedCountryKey = 'CN China/Chinese' // 默认使用中文
          console.log(`⚠️ 国别码为空，使用默认值: ${processedCountryKey}`)
        }
        
        if (countryData && typeof countryData === 'object' && !Array.isArray(countryData)) {
          const data = countryData as any
          
          console.log(`🔍 ${countryKey} 数据结构:`, {
            hasOriginal: !!data.original,
            originalLength: data.original?.length,
            originalSample: data.original?.slice(0, 2)
          })
          
          // 确保有original数组
          if (data.original && Array.isArray(data.original)) {
            console.log(`🏷️ 开始对 ${countryKey} 进行字段分类，文本数量: ${data.original.length}`)
            
            // 对original文本进行字段分类
            const fieldTypes = classifyFieldTypes(data.original, keywordList)
            
            console.log(`🏷️ ${countryKey} 分类结果:`, fieldTypes)
            
            // 统计字段类型分布
            const stats = getFieldTypeStats(fieldTypes)
            console.log(`📊 ${countryKey} 字段分类统计:`, stats)
            
            // 将分类结果添加到数据中
            classifiedOutput[processedCountryKey] = {
              ...data,
              field_types: fieldTypes, // 添加字段类型数组
              field_type_stats: stats  // 添加统计信息
            }
            
            console.log(`✅ ${processedCountryKey} 分类完成，包含字段类型:`, classifiedOutput[processedCountryKey].field_types)
          } else {
            console.warn(`⚠️ ${processedCountryKey} 没有original数组，保持原数据`)
            // 如果没有original数组，保持原数据
            classifiedOutput[processedCountryKey] = data
          }
        } else {
          console.warn(`⚠️ ${processedCountryKey} 不是对象格式，保持原数据`)
          // 如果不是对象格式，保持原数据
          classifiedOutput[processedCountryKey] = countryData
        }
      }

      // 构建包含字段分类的结果，保持原有数据结构
      const result = {
        ...cozeResult,
        // 如果原来有data字段，更新data字段；如果有output字段，更新output字段
        ...(cozeResult.data ? {
          data: JSON.stringify({
            output: classifiedOutput
          })
        } : {
          output: classifiedOutput
        }),
        classification_applied: true, // 标记已应用分类
        classification_timestamp: new Date().toISOString()
      }
      
      console.log('🎉 字段分类完成，最终结果:', result)
      
      // 返回包含字段分类的结果
      return result
    } catch (error) {
      console.error('❌ 字段分类失败:', error)
      console.error('❌ 错误堆栈:', error instanceof Error ? error.stack : error)
      // 如果分类失败，返回原始结果
      return cozeResult
    }
  }

  const resetForm = () => {
    setProjectName('')
    setProjectType('')
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
    
    if (!projectType.trim()) {
      setHasError(true)
      setWorkStatus('error')
      setStatusMessage('❌ 请选择工单类型')
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
      
      // 检查是否有解析结果，如果有则进行字段分类
      let cozeResult = parseResults.length > 0 ? parseResults[0] : undefined
      
      if (cozeResult) {
        setStatusMessage('🏷️ 正在进行字段类型分类...')
        
        // 获取关键词清单
        const keywordList = await getFormattedKeywordList()
        console.log('📋 获取到的关键词清单:', keywordList)
        
        // 对解析结果进行字段分类
        cozeResult = await classifyCozeResult(cozeResult, keywordList)
        console.log('🏷️ 字段分类结果:', cozeResult)
      }
      
      const createdProject = await createProject({
        job_name: projectName,
        job_description: `包含 ${uploadedFiles.length} 个文件`,
        coze_result: cozeResult as any,
      })
      
      // 更新项目列表
      await loadProjects()
      
      setWorkStatus('success')
      const resultMessage = cozeResult 
        ? '✅ 项目创建成功！已保存AI解析结果和字段分类' 
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
              className="p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              style={{ 
                backgroundColor: "white",
                borderColor: theme.border,
                borderWidth: "1px",
              }}
              onClick={() => handleProjectClick(project)}
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
                      {project.creator?.username || '未知用户'} · 更新于 {new Date(project.updatedAt).toLocaleString('zh-CN', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(project)
                      }}
                      className="p-1 rounded hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: theme.secondary, color: theme.buttonText }}
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(project.id)
                      }}
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
                  <div className="flex items-center space-x-3">
                    <Label htmlFor="project-name" className="text-base font-semibold text-gray-800 whitespace-nowrap">工单名称 *</Label>
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
                      className={`placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all border-[1px] ${
                        hasError && !projectName.trim() ? 'border-red-500 bg-red-50' : 'border-gray-200'
                      }`}
                    />
                  </div>
                </div>

                {/* 工单类型选择 */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <Label htmlFor="project-type" className="text-base font-semibold text-gray-800 whitespace-nowrap">标签分类 *</Label>
                    <Select value={projectType} onValueChange={(value) => {
                      setProjectType(value)
                      // 清除错误状态
                      if (hasError && value.trim()) {
                        setHasError(false)
                        setWorkStatus('idle')
                        setStatusMessage('')
                      }
                    }}>
                      <SelectTrigger className={`flex-1 bg-white focus:ring-2 focus:ring-blue-500 transition-all rounded-md px-3 py-2 !border-[1px] !border-solid ${
                        hasError && !projectType.trim() ? '!border-red-500 bg-red-50' : '!border-gray-200'
                      } ${projectType ? 'text-gray-900' : 'text-gray-400'}`}>
                        <SelectValue placeholder="请选择标签类型" />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-white border border-gray-200 shadow-lg rounded-md">
                        <SelectItem value="阶梯型" className="cursor-pointer text-gray-900 hover:bg-gray-100 focus:bg-gray-100">阶梯型</SelectItem>
                        <SelectItem value="单页左右1" className="cursor-pointer text-gray-900 hover:bg-gray-100 focus:bg-gray-100">单页左右1</SelectItem>
                        <SelectItem value="单页左右2" className="cursor-pointer text-gray-900 hover:bg-gray-100 focus:bg-gray-100">单页左右2</SelectItem>
                        <SelectItem value="单页上下1" className="cursor-pointer text-gray-900 hover:bg-gray-100 focus:bg-gray-100">单页上下1</SelectItem>
                        <SelectItem value="单页上下2" className="cursor-pointer text-gray-900 hover:bg-gray-100 focus:bg-gray-100">单页上下2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                      disabled={!projectName.trim() || !projectType.trim() || uploadedFiles.length === 0 || workStatus === 'parsing'}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    >
                      创建项目
                    </Button>
                  </div>
                  
                  {/* 第二行：解析并创建项目按钮 */}
                  <div className="flex">
                    <Button
                      onClick={handleParseAndCreate}
                      disabled={!projectName.trim() || !projectType.trim() || uploadedFiles.length === 0 || workStatus === 'parsing'}
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

        {/* 编辑项目对话框 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-[1200px] h-[90vh] bg-white p-0 flex flex-col">
            <DialogHeader className="px-4 pt-4 pb-3 border-b flex-shrink-0">
              <DialogTitle>编辑项目</DialogTitle>
            </DialogHeader>
            
            {/* 项目名称输入 */}
            <div className="px-4 py-2 border-b flex-shrink-0">
              <Label htmlFor="edit-project-name" className="text-sm font-semibold text-gray-800">
                项目名称 *
              </Label>
              <Input
                id="edit-project-name"
                placeholder="请输入项目名称"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                className="mt-1 h-8 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* 左右分栏布局 */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* 左侧：国别/地区列表 */}
              <div className="w-1/3 border-r flex flex-col">
                <div className="px-3 py-2 border-b bg-gray-50 flex-shrink-0">
                  <Label className="text-sm font-semibold text-gray-800">
                    国别/地区顺序
                  </Label>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {countryGroups.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      此项目暂无翻译数据
                    </div>
                  ) : (
                    <div>
                      {countryGroups.map((group, index) => (
                        <div
                          key={group.id}
                          draggable
                          onDragStart={() => handleCountryDragStart(index)}
                          onDragOver={(e) => handleCountryDragOver(e, index)}
                          onDragEnd={handleCountryDragEnd}
                          onClick={() => editingProject && handleSelectCountry(editingProject.id, group.country_code)}
                          className={`flex items-center p-2 cursor-pointer hover:bg-gray-50 transition-colors border-b ${
                            draggedIndex === index ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                          } ${selectedCountryCode === group.country_code ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`}
                          style={{
                            opacity: draggedIndex === index ? 0.5 : 1,
                          }}
                        >
                          <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0 mr-2" />
                          <span className="text-sm text-black font-medium flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="ml-2 flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900">{group.country_code}</div>
                            <div className="text-xs text-gray-500">
                              {group.total_items} 条
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-3 py-1.5 border-t bg-gray-50 flex-shrink-0">
                  <p className="text-xs text-gray-500">
                    💡 拖动调整顺序，点击查看
                  </p>
                </div>
              </div>

              {/* 右侧：翻译内容 */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-4 py-2 border-b bg-gray-50 flex-shrink-0">
                  <Label className="text-sm font-semibold text-gray-800">
                    {selectedCountryCode ? `${selectedCountryCode} - 翻译内容` : '翻译内容'}
                  </Label>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {isLoadingTranslations ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                  ) : !selectedCountryCode ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                      请选择一个国别/地区查看翻译内容
                    </div>
                  ) : countryTranslations.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                      该国别暂无翻译内容
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* 标题栏 */}
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
                        <div className="col-span-1 flex justify-center">
                          <div className="flex items-center">
                            <span className="text-xs font-medium text-gray-600">序号</span>
                            <button
                              onClick={() => handleSort('order')}
                              className="ml-1 p-0 bg-transparent border-0 text-gray-600 hover:text-gray-800 flex items-center transition-colors"
                              title="按序号排序"
                            >
                              {sortBy === 'order' ? (
                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 inline" /> : <ArrowDown className="h-3 w-3 inline" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-50 inline" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="col-span-4 border-r border-gray-300 pr-3">
                          <div className="text-xs font-medium text-gray-600 flex items-center">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5"></span>
                            原文
                          </div>
                        </div>
                        <div className="col-span-2 border-r border-gray-300 pr-3">
                          <div className="flex items-center">
                            <span className="text-xs font-medium text-gray-600">字段类型</span>
                            <button
                              onClick={() => handleSort('field_type')}
                              className="ml-1 p-0 bg-transparent border-0 text-gray-600 hover:text-gray-800 flex items-center transition-colors"
                              title="按字段类型排序"
                            >
                              {sortBy === 'field_type' ? (
                                sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 inline" /> : <ArrowDown className="h-3 w-3 inline" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-50 inline" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="col-span-4 pl-3">
                          <div className="text-xs font-medium text-gray-600 flex items-center">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
                            翻译
                          </div>
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <span className="text-xs font-medium text-gray-600">操作</span>
                        </div>
                      </div>
                      
                      {/* 内容行 */}
                      {getSortedTranslations().map((item, index) => (
                        <div
                          key={item.id}
                          className="border-l border-r border-b hover:shadow-sm transition-shadow bg-white group last:rounded-b-lg"
                        >
                          {editingTranslationId === item.id ? (
                            <div className="p-3">
                              <div className="grid grid-cols-12 gap-2 items-start">
                                  {/* 序号 */}
                                  <div className="col-span-1 flex justify-center">
                                    <span className="text-sm text-black font-medium">
                                      {index + 1}
                                    </span>
                                  </div>
                                
                                {/* 原文（只读） */}
                                <div className="col-span-4 border-r border-gray-200 pr-3">
                                  <div className="text-sm text-gray-700 leading-relaxed break-words">
                                    {item.original_text || '(空内容)'}
                                  </div>
                                </div>
                                
                                {/* 字段类型（只读） */}
                                <div className="col-span-2 border-r border-gray-200 pr-3">
                                  <div className="text-sm text-black">
                                    {item.field_type ? getFieldTypeName(item.field_type as any) : '未分类'}
                                  </div>
                                </div>
                                
                                {/* 翻译编辑 */}
                                <div className="col-span-4 pl-3">
                                  <textarea
                                    value={editingTranslationText}
                                    onChange={(e) => setEditingTranslationText(e.target.value)}
                                    className="w-full text-sm text-gray-900 border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    rows={2}
                                    autoFocus
                                  />
                                </div>
                                
                                {/* 操作按钮 */}
                                <div className="col-span-1 flex justify-center">
                                  <div className="flex flex-col space-y-1">
                                    <Button
                                      onClick={() => handleSaveTranslation(item.id)}
                                      size="sm"
                                      className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-3 shadow-sm"
                                    >
                                      ✓ 保存
                                    </Button>
                                    <Button
                                      onClick={handleCancelEditTranslation}
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs  bg-red-400 text-white hover:bg-gray-500 px-3"
                                    >
                                      ✕ 取消
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-12 gap-2 p-3 items-start">
                                {/* 第一列：序号 */}
                                <div className="col-span-1 flex justify-center">
                                  <span className="text-sm text-black font-medium">
                                    {index + 1}
                                  </span>
                                </div>
                              
                              {/* 第二列：原文 */}
                              <div className="col-span-4 border-r border-gray-200 pr-3">
                                <div className="text-sm text-gray-700 leading-relaxed break-words">
                                  {item.original_text || '(空内容)'}
                                </div>
                              </div>
                              
                              {/* 第三列：字段类型 */}
                              <div className="col-span-2 border-r border-gray-200 pr-3">
                                {editingFieldTypeId === item.id ? (
                                  <div className="space-y-1">
                                    <select
                                      value={editingFieldType}
                                      onChange={(e) => setEditingFieldType(e.target.value)}
                                      className="w-full text-xs border rounded p-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      autoFocus
                                    >
                                      <option value="">未分类</option>
                                      <option value="basic_info">基本信息</option>
                                      <option value="number_field">编号栏</option>
                                      <option value="drug_name">药品名称</option>
                                      <option value="number_of_sheets">片数</option>
                                      <option value="company_name">公司名称</option>
                                      <option value="drug_description">药品说明</option>
                                    </select>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleSaveFieldType(item.id)}
                                        className="px-2 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                      >
                                        保存
                                      </button>
                                      <button
                                        onClick={handleCancelEditFieldType}
                                        className="px-2 py-0.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                                      >
                                        取消
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm text-black">
                                      {item.field_type ? getFieldTypeName(item.field_type as any) : '未分类'}
                                    </div>
                                    <button
                                      onClick={() => handleEditFieldType(item.id, item.field_type)}
                                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                                      title="编辑字段类型"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              
                              {/* 第四列：翻译 */}
                              <div className="col-span-4 pl-3">
                                <div className="text-sm text-gray-900 leading-relaxed break-words">
                                  {item.translated_text || '(空内容)'}
                                </div>
                              </div>
                              
                              {/* 第五列：编辑按钮 */}
                              <div className="col-span-1 flex justify-center">
                                <Button
                                  onClick={() => handleEditTranslation(item.id, item.translated_text)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="px-4 py-3 border-t flex justify-end space-x-2 flex-shrink-0">
              <Button
                onClick={() => {
                  setIsEditDialogOpen(false)
                  setSelectedCountryCode(null)
                  setCountryTranslations([])
                  setEditingTranslationId(null)
                  setEditingTranslationText("")
                  setEditingFieldTypeId(null)
                  setEditingFieldType("")
                  setSortBy('order')
                  setSortDirection('asc')
                }}
                variant="outline"
                className="h-8 text-sm bg-gray-600 hover:bg-gray-700 text-white"
              >
                取消
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={!editProjectName.trim()}
                className="h-8 text-sm bg-blue-600 hover:bg-blue-700 text-white"
              >
                保存项目
              </Button>
              <Button
                onClick={handleAddVersion}
                disabled={!editProjectName.trim()}
                className="h-8 text-sm bg-green-600 hover:bg-green-700 text-white"
              >
                新增版本
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
