"use client"

import { useState } from "react"
import { Settings, X, Check, List } from "lucide-react"
import { themes, type ThemeName } from "../styles/themes"
import KeywordListManager from "./KeywordListManager"

interface SettingsMenuProps {
  currentTheme: ThemeName
  onThemeChange: (theme: ThemeName) => void
}

type SettingsTab = 'theme' | 'keywords'

export default function SettingsMenu({ currentTheme, onThemeChange }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTab>('theme')

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-full hover:bg-opacity-80 transition-colors"
        style={{ backgroundColor: themes[currentTheme].primary, color: "white" }}
      >
        <Settings size={24} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-white w-[900px] rounded-xl shadow-2xl flex flex-col" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '85vh', height: '85vh' }}
          >
            {/* 头部 */}
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold" style={{ color: themes[currentTheme].primary }}>设置</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* 标签页导航 */}
            <div className="flex gap-2 px-6 pt-4 pb-2">
              <button
                onClick={() => setActiveTab('theme')}
                className={`px-6 py-3 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'theme'
                    ? 'shadow-md'
                    : 'text-black hover:bg-gray-100'
                }`}
                style={activeTab === 'theme' ? {
                  backgroundColor: themes[currentTheme].primary,
                  color: themes[currentTheme].buttonText
                } : {}}
              >
                主题设置
              </button>
              <button
                onClick={() => setActiveTab('keywords')}
                className={`px-6 py-3 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                  activeTab === 'keywords'
                    ? 'shadow-md'
                    : 'text-black hover:bg-gray-100'
                }`}
                style={activeTab === 'keywords' ? {
                  backgroundColor: themes[currentTheme].primary,
                  color: themes[currentTheme].buttonText
                } : {}}
              >
                <List className="h-4 w-4" />
                5类清单管理
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'theme' && (
                <div className="p-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">选择主题</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(themes).map(([themeName, theme]) => (
                      <button
                        key={themeName}
                        onClick={() => {
                          onThemeChange(themeName as ThemeName)
                        }}
                        className="relative flex items-center p-3 rounded-lg transition-shadow hover:shadow-md"
                        style={{
                          backgroundColor: theme.background,
                          border: `2px solid ${themeName === currentTheme ? theme.primary : theme.border}`,
                        }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: theme.primary }}
                            />
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: theme.secondary }}
                            />
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: theme.accent }}
                            />
                          </div>
                          <div
                            className="mt-2 font-medium"
                            style={{ color: theme.text }}
                          >
                            {theme.name}
                          </div>
                        </div>
                        {themeName === currentTheme && (
                          <div
                            className="absolute right-2 top-2 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: theme.primary, color: "white" }}
                          >
                            <Check size={14} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'keywords' && (
                <KeywordListManager theme={themes[currentTheme]} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

