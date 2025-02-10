"use client"

import { useState } from "react"
import { Settings, X, Check } from "lucide-react"
import { themes, type ThemeName } from "../styles/themes"

interface SettingsMenuProps {
  currentTheme: ThemeName
  onThemeChange: (theme: ThemeName) => void
}

export default function SettingsMenu({ currentTheme, onThemeChange }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

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
            className="bg-white w-[500px] rounded-xl shadow-2xl p-6" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">设置</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">选择主题</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(themes).map(([themeName, theme]) => (
                    <button
                      key={themeName}
                      onClick={() => {
                        onThemeChange(themeName as ThemeName)
                        setIsOpen(false)
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}

