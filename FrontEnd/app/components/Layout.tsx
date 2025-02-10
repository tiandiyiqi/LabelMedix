"use client"

import React, { useState, createContext } from "react"
import { Beaker } from "lucide-react"
import { themes, type ThemeName } from "../styles/themes"
import SettingsMenu from "./SettingsMenu"
import "../globals.css"
import Image from "next/image"

// 创建Theme Context
export const ThemeContext = createContext<{
  theme: typeof themes.mathemagiker;
  setCurrentTheme: (theme: ThemeName) => void;
} | null>(null)

export default function Layout({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>("mathemagiker")
  const theme = themes[currentTheme]

  return (
    <ThemeContext.Provider value={{ theme, setCurrentTheme }}>
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
          <main className="container mx-auto py-8 flex-1">
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

