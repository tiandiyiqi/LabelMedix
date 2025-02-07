"use client"

import { useState } from "react"
import { Search, Plus, Edit, Trash2, Save } from "lucide-react"
import { themes } from "../styles/themes"

export default function ProjectList() {
  const theme = themes.mathemagiker
  const [projects, setProjects] = useState([
    { id: 1, name: "阿司匹林", languages: ["中文", "English", "Español"] },
    { id: 2, name: "布洛芬", languages: ["中文", "English", "Français"] },
    { id: 3, name: "对乙酰氨基酚", languages: ["中文", "English", "Deutsch"] },
  ])
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState("")

  const handleEdit = (project) => {
    setEditingId(project.id)
    setEditingName(project.name)
  }

  const handleSave = (id) => {
    setProjects(projects.map((p) => (p.id === id ? { ...p, name: editingName } : p)))
    setEditingId(null)
  }

  const handleDelete = (id) => {
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
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
            style={{ borderColor: theme.secondary }}
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
        </div>
      </div>
      <ul className="space-y-2">
        {projects.map((project) => (
          <li
            key={project.id}
            className="bg-white p-3 rounded-lg shadow-md hover:shadow-lg transition-shadow border"
            style={{
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
              borderColor: theme.border,
            }}
          >
            {editingId === project.id ? (
              <div className="flex items-center">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-grow mr-2 p-1 border rounded"
                  style={{ borderColor: theme.secondary }}
                />
                <button
                  onClick={() => handleSave(project.id)}
                  className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: theme.secondary, color: "white" }}
                >
                  <Save size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{project.name}</span>
                  <div className="text-sm text-gray-500 mt-1">{project.languages.join(", ")}</div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(project)}
                    className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: theme.secondary }}
                  >
                    <Edit size={20} className="text-white" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: theme.secondary }}
                  >
                    <Trash2 size={20} className="text-white" />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        className="mt-4 w-full py-2 px-4 rounded-lg hover:shadow-lg transition-all flex items-center justify-center shadow-md border"
        style={{ backgroundColor: theme.secondary, color: "white", borderColor: theme.border }}
      >
        <Plus size={20} className="mr-2" />
        新建项目
      </button>
    </div>
  )
}

