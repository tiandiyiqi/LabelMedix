"use client"

import { useState, useContext } from "react"
import { Search, Plus, Edit, Trash2, Save } from "lucide-react"
import { ThemeContext } from "./Layout"

export default function ProjectList() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const [projects, setProjects] = useState([
    { id: 1, name: "阿司匹林", languages: ["中文", "English", "Español"] },
    { id: 2, name: "布洛芬", languages: ["中文", "English", "Français"] },
    { id: 3, name: "对乙酰氨基酚", languages: ["中文", "English", "Deutsch"] },
  ])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")

  const handleEdit = (project: { id: number; name: string }) => {
    setEditingId(project.id)
    setEditingName(project.name)
  }

  const handleSave = (id: number) => {
    setProjects(projects.map((p) => (p.id === id ? { ...p, name: editingName } : p)))
    setEditingId(null)
  }

  const handleDelete = (id: number) => {
    setProjects(projects.filter((p) => p.id !== id))
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{ color: theme.primary }}>
        项目管理
      </h2>
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="搜索项目..."
            className="w-full pl-10 pr-4 py-2 rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-shadow"
            style={{ 
              borderColor: theme.border,
              backgroundColor: "white",
              color: theme.text,
            }}
          />
          <Search className="absolute left-3 top-2.5" style={{ color: theme.lightText }} size={20} />
        </div>
      </div>
      <ul className="space-y-2">
        {projects.map((project) => (
          <li
            key={project.id}
            className="p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            style={{ 
              backgroundColor: "white",
              borderColor: theme.border,
              borderWidth: "1px",
            }}
          >
            {editingId === project.id ? (
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 px-2 py-1 rounded mr-2"
                  style={{ 
                    borderColor: theme.border,
                    backgroundColor: "white",
                    color: theme.text,
                  }}
                />
                <button
                  onClick={() => handleSave(project.id)}
                  className="p-1 rounded hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: theme.primary, color: "white" }}
                >
                  <Save size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium" style={{ color: theme.text }}>{project.name}</div>
                  <div className="text-sm" style={{ color: theme.lightText }}>
                    {project.languages.join(", ")}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(project)}
                    className="p-1 rounded hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: theme.secondary, color: theme.buttonText }}
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-1 rounded hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: theme.accent, color: theme.buttonText }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        className="w-full mt-4 py-2 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity shadow-sm"
        style={{ backgroundColor: theme.primary, color: "white" }}
      >
        <Plus size={20} className="mr-2" />
        新建项目
      </button>
    </div>
  )
}

