"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface LabelData {
  drugInfo: string
  fontSize: number
  selectedLanguage: string
  selectedNumber: string
}

interface LabelContextType {
  labelData: LabelData
  updateLabelData: (data: Partial<LabelData>) => void
}

const defaultLabelData: LabelData = {
  drugInfo: "",
  fontSize: 12, // 默认字体大小 12pt
  selectedLanguage: "CN",
  selectedNumber: "1"
}

const LabelContext = createContext<LabelContextType | undefined>(undefined)

export function LabelProvider({ children }: { children: ReactNode }) {
  const [labelData, setLabelData] = useState<LabelData>(defaultLabelData)

  const updateLabelData = (newData: Partial<LabelData>) => {
    setLabelData(prev => ({
      ...prev,
      ...newData
    }))
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
    throw new Error("useLabelContext must be used within a LabelProvider")
  }
  return context
} 