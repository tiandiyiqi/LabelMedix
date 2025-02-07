"use client"

import { useState } from "react"
import { Settings, X } from "lucide-react"
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
          <div className="bg-white w-[400px] rounded-xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
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
                <label className="block text-sm font-medium text-gray-700 mb-3">主题</label>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(themes).map(([themeName, theme]) => (
                    <button
                      key={themeName}
                      onClick={() => {
                        onThemeChange(themeName as ThemeName)
                        setIsOpen(false)
                      }}
                      className={`p-4 rounded-lg hover:shadow-md transition-shadow ${
                        currentTheme === themeName ? "ring-2 ring-offset-2" : ""
                      }`}
                      style={{
                        backgroundColor: theme.background,
                        border: `1px solid ${theme.border}`,
                        color: theme.text,
                      }}
                    >
                      <div className="flex flex-col gap-2">
                        <span className="font-medium text-left">{theme.name}</span>
                        <div className="flex gap-2">
                          {[theme.primary, theme.secondary, theme.accent, theme.background].map((color, index) => (
                            <div
                              key={index}
                              className="w-6 h-6 rounded-full shadow-sm"
                              style={{
                                backgroundColor: color,
                                border: `1px solid ${theme.border}`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
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

