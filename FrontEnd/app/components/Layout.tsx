"use client"

import React, { useState, createContext } from "react"
import { Beaker } from "lucide-react"
import { themes, type ThemeName } from "../styles/themes"
import SettingsMenu from "./SettingsMenu"
import "../globals.css"
import Image from "next/image"

interface Theme {
  primary: string    // 主要颜色，用于主按钮、重要操作
  secondary: string  // 次要颜色，用于背景、卡片
  accent: string     // 强调色，用于特殊操作按钮
  neutral: string    // 中性色，用于边框、分割线
  highlight: string  // 高亮色，用于重要信息、提示
  text: string       // 主要文本颜色
  subtext: string    // 次要文本颜色
  buttonText: string // 按钮文本颜色
  border: string     // 边框颜色
  background: string // 页面背景色
}

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

// 默认主题
const defaultTheme: Theme = {
  primary: "#2563eb",    // 蓝色
  secondary: "#22c55e",  // 绿色
  accent: "#f97316",     // 橙色
  neutral: "#6b7280",    // 灰色
  highlight: "#8b5cf6",  // 紫色
  text: "#1f2937",       // 深灰色
  subtext: "#6b7280",    // 中灰色
  buttonText: "#ffffff", // 白色
  border: "#e5e7eb",     // 浅灰色
  background: "#f3f4f6"  // 最浅灰色
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export default function Layout({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>("mathemagiker")
  const theme = themes[currentTheme]

  return (
    <ThemeContext.Provider value={{ theme, setTheme: () => {} }}>
      <div className="min-h-screen w-full relative">
        <div className="fixed inset-0 -z-10">
          <Image
            src="/bg.png"
            alt="背景"
            fill
            style={{ objectFit: "cover" }}
            priority
          />
          <div className="absolute inset-0 bg-white/65" />
        </div>
        <div className="content-wrapper">
          <header className="shadow-md p-4" style={{ backgroundColor: theme.primary }}>
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center">
                <Beaker className="mr-2 text-white" size={24} />
                <h1 className="text-2xl font-bold text-white">专业药品标签生成器</h1>
              </div>
              <div className="flex items-center space-x-4">
                <SettingsMenu currentTheme={currentTheme} onThemeChange={setCurrentTheme} />
              </div>
            </div>
          </header>
          <main className="px-4 md:px-8 py-8 flex-1">
            {children}
          </main>
          <footer className="p-4" style={{ backgroundColor: theme.primary, color: theme.buttonText }}>
            <div className="container mx-auto text-center">
              <p>&copy; 2025 专业药品标签生成器. 保留所有权利。</p>
            </div>
          </footer>
        </div>
      </div>
    </ThemeContext.Provider>
  )
}

