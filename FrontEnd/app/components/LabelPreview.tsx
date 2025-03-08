"use client"

import { useEffect, useRef, useContext, useCallback } from "react"
import { Eye } from "lucide-react"
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { jsPDF } from 'jspdf'
import PDFExport from "./PDFExport"

// 导入字体文件
const STHeitiFont = '/fonts/STHeiti.ttf'

export default function LabelPreview() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const { labelData, updateLabelData } = useLabelContext()
  const { drugInfo, fontSize, selectedLanguage, labelWidth, labelHeight } = labelData
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // 获取当前语言对应的字体
  const getFontFamily = useCallback(() => {
    if (selectedLanguage === "TH" || selectedLanguage === "AE") {
      return "Arial Unicode MS"
    }
    if (selectedLanguage === "CN") {
      return "STHeiti"
    }
    return "Arial"
  }, [selectedLanguage])

  useEffect(() => {
    const generatePreview = async () => {
      if (!previewRef.current || !drugInfo) return;

      try {
        // 创建PDF文档
        const doc = new jsPDF({
          orientation: labelWidth > labelHeight ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [Math.max(labelWidth, 1), Math.max(labelHeight, 1)],
          putOnlyUsedFonts: true,
          compress: true
        });

        // 设置字体大小
        const adjustedFontSize = fontSize * 0.352778;
        doc.setFontSize(adjustedFontSize);

        // 计算边距和可用空间
        const margin = 5;
        const availableWidth = labelWidth - (margin * 2);
        const availableHeight = labelHeight - (margin * 2);
        const lineHeight = adjustedFontSize * 0.3528;

        // 设置字体和编码
        if (selectedLanguage === "CN") {
          try {
            // 加载并转换字体文件
            const fontResponse = await fetch(STHeitiFont);
            if (!fontResponse.ok) {
              throw new Error('字体文件加载失败');
            }
            const fontArrayBuffer = await fontResponse.arrayBuffer();
            const fontData = Array.from(new Uint8Array(fontArrayBuffer))
              .map(byte => byte.toString(16).padStart(2, '0'))
              .join('');
            
            // 添加字体到PDF，使用Identity-H编码
            doc.addFileToVFS('STHeiti-normal.ttf', fontData);
            doc.addFont('STHeiti-normal.ttf', 'STHeiti', 'normal', 'Identity-H');
            doc.setFont('STHeiti', 'normal');
            
            // 设置文本编码
            doc.setLanguage('zh-CN');
            doc.setR2L(false);

            // 添加文本内容
            const lines = doc.splitTextToSize(drugInfo, availableWidth);
            const linesPerPage = Math.floor(availableHeight / lineHeight);
            
            for (let i = 0; i < lines.length; i += linesPerPage) {
              if (i > 0) {
                doc.addPage([labelWidth, labelHeight]);
              }
              const pageLines = lines.slice(i, i + linesPerPage);
              doc.text(pageLines, margin, margin + lineHeight, {
                baseline: 'top',
                maxWidth: availableWidth,
                flags: { noBOM: true, autoencode: true }
              });
            }
            
            console.log('中文字体加载成功');
          } catch (error) {
            console.error('字体加载失败:', error);
            // 降级到默认字体
            doc.setFont('helvetica');
            
            // 使用默认字体处理文本
            const lines = doc.splitTextToSize(drugInfo, availableWidth);
            const linesPerPage = Math.floor(availableHeight / lineHeight);
            
            for (let i = 0; i < lines.length; i += linesPerPage) {
              if (i > 0) {
                doc.addPage([labelWidth, labelHeight]);
              }
              const pageLines = lines.slice(i, i + linesPerPage);
              doc.text(pageLines, margin, margin + lineHeight, {
                baseline: 'top',
                maxWidth: availableWidth
              });
            }
          }
        } else {
          // 非中文语言处理
          if (selectedLanguage === "TH" || selectedLanguage === "AE") {
            doc.setFont("Arial Unicode MS");
          } else {
            doc.setFont("Arial");
          }

          // 添加文本内容
          const lines = doc.splitTextToSize(drugInfo, availableWidth);
          const linesPerPage = Math.floor(availableHeight / lineHeight);
          
          for (let i = 0; i < lines.length; i += linesPerPage) {
            if (i > 0) {
              doc.addPage([labelWidth, labelHeight]);
            }
            const pageLines = lines.slice(i, i + linesPerPage);
            doc.text(pageLines, margin, margin + lineHeight, {
              baseline: 'top',
              maxWidth: availableWidth
            });
          }
        }

        // 获取PDF数据并转换为Blob
        const pdfBytes = doc.output('arraybuffer');
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // 创建预览元素
        const previewContainer = previewRef.current;
        previewContainer.innerHTML = '';
        
        const previewContent = document.createElement('div');
        previewContent.style.fontFamily = getFontFamily();
        previewContent.style.fontSize = `${fontSize}pt`;
        previewContent.style.padding = '10px';
        previewContent.style.width = '100%';
        previewContent.style.height = '100%';
        previewContent.style.overflow = 'auto';
        previewContent.style.whiteSpace = 'pre-wrap';
        previewContent.style.wordBreak = 'break-word';
        previewContent.style.backgroundColor = 'white';
        previewContent.textContent = drugInfo;

        previewContainer.appendChild(previewContent);

        // 清理资源
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('预览生成失败:', error);
      }
    };

    generatePreview();
  }, [drugInfo, fontSize, selectedLanguage, labelWidth, labelHeight, getFontFamily]);

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
      <div
        ref={previewContainerRef}
        className="flex-grow relative overflow-hidden flex items-center justify-center mb-6 min-h-[200px] bg-gray-50 rounded-lg"
      >
        <div
          ref={previewRef}
          style={{
            width: `${labelWidth * 3.78}px`,
            height: `${labelHeight * 3.78}px`,
            border: `2px dashed ${theme.secondary}`,
            borderRadius: '0.5rem',
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            transform: `scale(${previewContainerRef.current ? Math.min(1, previewContainerRef.current.offsetWidth / (labelWidth * 3.78)) : 1})`,
            transformOrigin: "center",
          }}
        />
      </div>
      <PDFExport />
    </div>
  );
}

