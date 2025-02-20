"use client"

import { useContext } from 'react'
import { Document, Page, Text, View, StyleSheet, PDFViewer, Font } from '@react-pdf/renderer'
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { Eye } from "lucide-react"

// 单位转换：毫米到点
const MM_TO_PT = 2.83465;
const mmToPt = (mm: number) => mm * MM_TO_PT;

// 注册字体
Font.register({
  family: 'STHeiti',
  src: '/fonts/STHeiti.ttf'
});

Font.register({
  family: 'Arial',
  src: '/fonts/Arial.ttf',
  fonts: [
    { src: '/fonts/Arial.ttf' },
    { src: '/fonts/Arial Bold.ttf', fontWeight: 'bold' },
    { src: '/fonts/Arial Italic.ttf', fontStyle: 'italic' },
    { src: '/fonts/Arial Bold Italic.ttf', fontWeight: 'bold', fontStyle: 'italic' }
  ]
});

Font.register({
  family: 'Arial Unicode',
  src: '/fonts/Arial Unicode.ttf'
});

// 创建样式
const styles = StyleSheet.create({
  page: {
    paddingTop: mmToPt(5),
    paddingBottom: mmToPt(5),
    paddingLeft: mmToPt(5),
    paddingRight: mmToPt(5),
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    fontFamily: 'STHeiti',
    fontSize: 12,
    lineHeight: 1.1,
  },
  contentTH: {
    fontFamily: 'Arial Unicode',
    fontSize: 12,
    lineHeight: 0.5,
  },
  contentAE: {
    fontFamily: 'Arial Unicode',
    fontSize: 12,
    lineHeight: 0.5,
  },
  contentDefault: {
    fontFamily: 'Arial',
    fontSize: 12,
    lineHeight: 0.5,
  }
});

export default function PDFPreview() {
  const { labelData, updateLabelData } = useLabelContext()
  const { labelWidth, labelHeight, drugInfo, selectedLanguage, fontSize } = labelData

  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  // 根据语言选择字体样式
  const getContentStyle = () => {
    switch (selectedLanguage) {
      case 'CN':
        return styles.content;
      case 'TH':
        return styles.contentTH;
      case 'AE':
        return styles.contentAE;
      default:
        return styles.contentDefault;
    }
  };

  // 创建动态页面样式
  const pageStyle = {
    ...styles.page,
  };

  // 创建动态内容样式
  const contentStyle = {
    ...getContentStyle(),
    fontSize: mmToPt(fontSize / 2.835), // 将pt转换为mm
  };

  return (
    <div className="h-full flex flex-col card p-6 rounded-lg shadow w-full" style={{ borderColor: theme.border }}>
      <h2 className="text-xl font-bold mb-6 flex items-center" style={{ color: theme.primary }}>
        <Eye className="mr-2" size={24} />
        标签预览
      </h2>
      <div className="mb-6 flex space-x-4">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
            标签宽度 (mm)
          </label>
          <input
            type="number"
            value={labelWidth}
            onChange={(e) => updateLabelData({ labelWidth: Number(e.target.value) })}
            className="w-full rounded-md shadow-md px-3 py-2 border"
            style={{
              borderColor: theme.border,
              color: theme.text,
              backgroundColor: "white",
            }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
            标签高度 (mm)
          </label>
          <input
            type="number"
            value={labelHeight}
            onChange={(e) => updateLabelData({ labelHeight: Number(e.target.value) })}
            className="w-full rounded-md shadow-md px-3 py-2 border"
            style={{
              borderColor: theme.border,
              color: theme.text,
              backgroundColor: "white",
            }}
          />
        </div>
      </div>
      <div className="flex-grow">
        <PDFViewer width="100%" height="600px" showToolbar={true}>
          <Document>
            <Page size={[mmToPt(labelWidth), mmToPt(labelHeight)]} style={pageStyle}>
              <View style={{ margin: mmToPt(5) }}>
                <Text style={contentStyle}>{drugInfo}</Text>
              </View>
            </Page>
          </Document>
        </PDFViewer>
      </div>
    </div>
  );
} 