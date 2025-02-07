"use client"

import React, { useState } from "react"
import { Beaker, Pill, Microscope, Stethoscope } from "lucide-react"
import { themes, type ThemeName } from "../styles/themes"
import SettingsMenu from "./SettingsMenu"
import "../globals.css"

export default function Layout({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>("mathemagiker")
  const theme = themes[currentTheme]

  // 创建一个包含当前主题和设置主题函数的对象
  const themeContext = { theme, setCurrentTheme }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: theme.background }}>
      {/* 背景图标 */}
      <div className="absolute inset-0 z-0 opacity-5">
        <div className="absolute top-10 left-10" style={{ color: theme.primary }}>
          <Pill size={100} />
        </div>
        <div className="absolute top-1/3 right-20" style={{ color: theme.secondary }}>
          <Beaker size={80} />
        </div>
        <div className="absolute bottom-20 left-1/4" style={{ color: theme.accent }}>
          <Microscope size={120} />
        </div>
        <div className="absolute top-2/3 right-1/4" style={{ color: theme.primary }}>
          <Stethoscope size={90} />
        </div>
      </div>
      <div className="relative z-10">
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
        <main className="container mx-auto py-8">
          {React.Children.map(children, (child) =>
            React.isValidElement(child) ? React.cloneElement(child, { themeContext }) : child,
          )}
        </main>
        <footer className="p-4 mt-8" style={{ backgroundColor: theme.primary, color: theme.buttonText }}>
          <div className="container mx-auto text-center">
            <p>&copy; 2025 专业药品标签生成器. 保留所有权利。</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

