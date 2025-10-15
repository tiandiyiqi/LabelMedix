"use client"

import React, { createContext, useContext, useState } from 'react'

interface SelectedProject {
  id: number
  job_name: string
  currentSequence: number
  countryCode: string
  formattedSummary?: string
}

interface LabelData {
  selectedLanguage: string
  selectedNumber: string
  drugInfo: string
  fontSize: number
  labelWidth: number
  labelHeight: number
  fontFamily: string
  spacing: number
  lineHeight: number
  currentWidth: number // 当前页面宽度
  labelCategory: string // 标签分类：缠绕标/非缠绕标/单页标
  baseSheet: number // 底页
  adhesiveArea: number // 粘胶区
  wasteArea: number // 排废区
  codingArea: number // 打码区
  selectedProject?: SelectedProject // 选中的项目信息
}

interface LabelContextType {
  labelData: LabelData
  updateLabelData: (data: Partial<LabelData>) => void
  setSelectedProject: (project: SelectedProject | undefined) => void
}

const defaultLabelData: LabelData = {
  selectedLanguage: 'CN',
  selectedNumber: '1',
  drugInfo: 
  `方案编号:
包装批号:

有效期至(月/年):


研究者:
研究中心编号:

受试者编号:
访视编号:


利妥昔单抗 100 mg/10 mL, 稀释成溶液后输注(10 mg/mL)。

1 瓶/盒。
用于静脉 (IV) 输注。
按研究方案使用。

于 2-8°C保存。
于原包装内保存。
避光保存。

警告:细胞毒素剂。
申办者:BeiGene, Ltd.

仅供临床研究使用。
避免儿童接触。

临床试验申请人:
百济神州(苏州)生物科技有限公司`,
  fontSize: 10,
  labelWidth: 100,  // 120mm - PDF实际宽度
  labelHeight: 60,  // 80mm - PDF实际高度
  fontFamily: 'STHeiti',
  spacing: 1,
  lineHeight: 1.2,
  currentWidth: 120,  // 初始值与labelWidth相同
  labelCategory: '非缠绕标'
  ,
  baseSheet: 0,
  adhesiveArea: 0,
  wasteArea: 0,
  codingArea: 0,
  selectedProject: undefined
}

const LabelContext = createContext<LabelContextType | undefined>(undefined)

export function LabelProvider({ children }: { children: React.ReactNode }) {
  const [labelData, setLabelData] = useState<LabelData>(defaultLabelData)

  const updateLabelData = (data: Partial<LabelData>) => {
    setLabelData(prev => ({ ...prev, ...data }))
  }

  const setSelectedProject = (project: SelectedProject | undefined) => {
    setLabelData(prev => ({
      ...prev,
      selectedProject: project,
      // 当选中项目时，同步更新相关字段
      selectedLanguage: project?.countryCode || prev.selectedLanguage,
      selectedNumber: project?.currentSequence.toString() || prev.selectedNumber,
      drugInfo: project?.formattedSummary || '未格式化'
    }))
  }

  return (
    <LabelContext.Provider value={{ labelData, updateLabelData, setSelectedProject }}>
      {children}
    </LabelContext.Provider>
  )
}

export function useLabelContext() {
  const context = useContext(LabelContext)
  if (context === undefined) {
    throw new Error('useLabelContext must be used within a LabelProvider')
  }
  return context
}

// 导出类型供其他组件使用
export type { SelectedProject }
