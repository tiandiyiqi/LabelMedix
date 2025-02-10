"use client"

import { useContext } from "react"
import Layout from "./components/Layout"
import ProjectList from "./components/ProjectList"
import ProjectInfo from "./components/ProjectInfo"
import LabelEditor from "./components/LabelEditor"
import LabelPreview from "./components/LabelPreview"
import { ThemeContext } from "./components/Layout"

export default function Home() {
  const projectName = "示例项目"

  const handleSave = () => {
    console.log("Saving project")
  }

  const handleExportPDF = () => {
    console.log("Exporting PDF")
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-[1600px]">
        <div className="flex min-h-[calc(100vh-8rem)]">
          <div className="w-1/4 p-4 bg-white bg-opacity-75 rounded-lg shadow mr-4">
            <ProjectList />
          </div>
          <div className="w-3/4 p-8 h-full bg-white bg-opacity-75 rounded-lg shadow flex flex-col overflow-auto">
            <ProjectInfo projectName={projectName} onSave={handleSave} onExport={handleExportPDF} />
            <div className="flex gap-4 flex-1">
              <div className="w-[45%] flex">
                <LabelEditor />
              </div>
              <div className="w-[55%] flex">
                <LabelPreview />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

