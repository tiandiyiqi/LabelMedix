"use client"

import { LabelProvider } from "../lib/context/LabelContext"
import ProjectInfo from "./components/ProjectInfo"
import LabelEditor from "./components/LabelEditor"
import PDFPreview from "./components/PDFPreview"
import Layout from "./components/Layout"
import ProjectList from "./components/ProjectList"

export default function Home() {
  return (
    <Layout>
      <LabelProvider>
        <div className="flex h-[calc(100vh-theme(spacing.16))]">
          {/* 左侧项目列表 */}
          <div className="w-1/4 rounded-lg shadow mr-4">
            <ProjectList />
          </div>

          {/* 右侧主要内容区域 */}
          <div className="flex-1 flex flex-col bg-white bg-opacity-75 rounded-lg shadow overflow-hidden">
            <ProjectInfo />
            <div className="flex-1 p-8 overflow-auto">
              <div className="grid grid-cols-2 gap-8 h-full">
                <div className="flex flex-col">
                  <LabelEditor />
                </div>
                <div className="flex flex-col">
                  <PDFPreview />
                </div>
              </div>
            </div>
          </div>
        </div>
      </LabelProvider>
    </Layout>
  )
}

