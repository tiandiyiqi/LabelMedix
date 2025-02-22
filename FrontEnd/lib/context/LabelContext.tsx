"use client"

import React, { createContext, useContext, useState } from 'react'

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
}

interface LabelContextType {
  labelData: LabelData
  updateLabelData: (data: Partial<LabelData>) => void
}

const defaultLabelData: LabelData = {
  selectedLanguage: 'CN',
  selectedNumber: '1',
  drugInfo: `方案编号:
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
  labelWidth: 120,  // 120mm - PDF实际宽度
  labelHeight: 80,  // 80mm - PDF实际高度
  fontFamily: 'STHeiti',
  spacing: 1,
  lineHeight: 1.2,
  currentWidth: 120  // 初始值与labelWidth相同
}

const LabelContext = createContext<LabelContextType | undefined>(undefined)

export function LabelProvider({ children }: { children: React.ReactNode }) {
  const [labelData, setLabelData] = useState<LabelData>(defaultLabelData)

  const updateLabelData = (data: Partial<LabelData>) => {
    setLabelData(prev => ({ ...prev, ...data }))
  }

  return (
    <LabelContext.Provider value={{ labelData, updateLabelData }}>
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