"use client"

import { LabelProvider } from "../lib/context/LabelContext"
import ProjectInfo from "./components/ProjectInfo"
import LabelEditor from "./components/LabelEditor"
import PDFPreview from "./components/PDFPreview"
import Layout from "./components/Layout"

export default function Home() {
  return (
    <Layout>
      <LabelProvider>
        <div className="flex h-[calc(100vh-theme(spacing.16))]">
          {/* 左侧项目列表 */}
          <div className="w-1/4 p-4 bg-white bg-opacity-75 rounded-lg shadow mr-4">
            <h2 className="text-xl font-bold mb-4">项目管理</h2>
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="搜索项目..."
                className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2"
              />
            </div>
            <div className="space-y-2">
              {/* 项目列表项 */}
              <div className="p-3 rounded-lg bg-white shadow hover:shadow-md transition-shadow cursor-pointer">
                <div className="font-medium">阿司匹林</div>
                <div className="text-sm text-gray-500">中文, English, Español</div>
              </div>
              <div className="p-3 rounded-lg bg-white shadow hover:shadow-md transition-shadow cursor-pointer">
                <div className="font-medium">布洛芬</div>
                <div className="text-sm text-gray-500">中文, English, Français</div>
              </div>
              <div className="p-3 rounded-lg bg-white shadow hover:shadow-md transition-shadow cursor-pointer">
                <div className="font-medium">对乙酰氨基酚</div>
                <div className="text-sm text-gray-500">中文, English, Deutsch</div>
              </div>
            </div>
            <button className="w-full mt-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
              + 新建项目
            </button>
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

