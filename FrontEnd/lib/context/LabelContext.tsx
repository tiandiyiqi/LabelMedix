"use client"

import React, { createContext, useContext, useState } from 'react'

interface SelectedProject {
  id: number
  job_name: string
  currentSequence: number
  countryCode: string
  formattedSummary?: string
  originalSummary?: string
}

interface LabelData {
  selectedLanguage: string
  selectedNumber: string
  drugInfo: string
  fontSize: number
  labelWidth: number
  labelHeight: number
  fontFamily: string // 主语言字体（如：中文字体）
  secondaryFontFamily: string // 次语言字体（如：英文字体）
  textAlign: string // 文本对齐方式：left（左对齐）、right（右对齐）、center（居中）
  // 序号设置
  showSequenceNumber: boolean // 是否显示序号
  customSequenceText?: string // 自定义序号内容
  sequencePosition: string // 序号位置：left（左对齐）、center（居中）、right（右对齐）
  sequenceFontSize: number // 序号字体大小（pt）
  sequenceOffsetX: number // 序号水平位移（mm）
  sequenceOffsetY: number // 序号垂直位移（mm）
  sequenceRotation: number // 序号旋转角度（度）
  spacing: number
  lineHeight: number
  currentWidth: number // 当前页面宽度
  labelCategory: string // 标签分类：缠绕标/非缠绕标/单页标
  isWrapped: boolean // 是否缠绕标
  baseSheet: number // 底页
  adhesiveArea: number // 粘胶区
  wasteArea: number // 排废区
  codingArea: number // 打码区
  selectedProject?: SelectedProject // 选中的项目信息
  // 新增：6个字段类型的分类内容
  basicInfo: string // 基本信息
  numberField: string // 编号栏
  drugName: string // 药品名称
  numberOfSheets: string // 片数
  drugDescription: string // 药品说明
  companyName: string // 公司名称
  // 原始状态管理
  originalSummary?: string // 从数据库加载的原始状态
  formatted_summary?: string // 格式化后的汇总
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
  fontFamily: 'STHeiti', // 主语言字体（中文/日文/韩文等）
  secondaryFontFamily: 'Arial', // 次语言字体（通常为英文/数字）
  textAlign: 'left', // 文本对齐方式，默认左对齐
  // 序号设置默认值
  showSequenceNumber: true, // 默认显示序号
  customSequenceText: '', // 默认无自定义序号内容
  sequencePosition: '', // 默认不设置，使用自动对齐
  sequenceFontSize: 9, // 默认字体大小 9pt
  sequenceOffsetX: 0, // 默认无水平位移
  sequenceOffsetY: 0, // 默认无垂直位移
  sequenceRotation: 0, // 默认无旋转
  spacing: 1,
  lineHeight: 1.2,
  currentWidth: 120,  // 初始值与labelWidth相同
  labelCategory: '阶梯标',
  isWrapped: false,
  baseSheet: 0,
  adhesiveArea: 0,
  wasteArea: 0,
  codingArea: 0,
  selectedProject: undefined,
  // 新增：6个字段类型的默认值
  basicInfo: '',
  numberField: '',
  drugName: '',
  numberOfSheets: '',
  drugDescription: '',
  companyName: '',
  // 原始状态管理默认值
  originalSummary: undefined,
  formatted_summary: undefined
}

const LabelContext = createContext<LabelContextType | undefined>(undefined)

export function LabelProvider({ children }: { children: React.ReactNode }) {
  const [labelData, setLabelData] = useState<LabelData>(defaultLabelData)

  const updateLabelData = (data: Partial<LabelData>) => {
    // console.log('🔍 [LabelContext.updateLabelData] 更新前状态:', {
    //   prevLabelWidth: labelData.labelWidth,
    //   prevLabelHeight: labelData.labelHeight,
    //   prevCurrentWidth: labelData.currentWidth,
    //   timestamp: new Date().toISOString()
    // });
    // console.log('🔍 [LabelContext.updateLabelData] 接收到的更新数据:', {
    //   labelWidth: data.labelWidth,
    //   labelHeight: data.labelHeight,
    //   currentWidth: data.currentWidth,
    //   timestamp: new Date().toISOString()
    // });
    // 打印调用栈，找出是谁调用的
    // console.log('🔍 [LabelContext.updateLabelData] 调用栈:', new Error().stack);
    setLabelData(prev => {
      const newData = { ...prev, ...data };
      // console.log('🔍 [LabelContext.updateLabelData] 更新后状态:', {
      //   newLabelWidth: newData.labelWidth,
      //   newLabelHeight: newData.labelHeight,
      //   newCurrentWidth: newData.currentWidth,
      //   timestamp: new Date().toISOString()
      // });
      return newData;
    })
  }

  const setSelectedProject = (project: SelectedProject | undefined) => {
    setLabelData(prev => ({
      ...prev,
      selectedProject: project,
      // 当选中项目时，同步更新相关字段
      selectedLanguage: project?.countryCode || prev.selectedLanguage,
      selectedNumber: project?.currentSequence.toString() || prev.selectedNumber,
      // drugInfo 已废弃，不再使用，改用6个独立字段
      drugInfo: project?.formattedSummary || ''
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
