"use client"

import React, { createContext, useContext, useState } from 'react'

interface LabelData {
  selectedLanguage: string
  selectedNumber: string
  drugInfo: string
  fontSize: number
  labelWidth: number
  labelHeight: number
}

interface LabelContextType {
  labelData: LabelData
  updateLabelData: (data: Partial<LabelData>) => void
}

const defaultLabelData: LabelData = {
  selectedLanguage: 'CN',
  selectedNumber: '1',
  drugInfo: '',
  fontSize: 12,
  labelWidth: 120,
  labelHeight: 80
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