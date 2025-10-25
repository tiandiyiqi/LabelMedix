"use client"

import { useContext, useState } from "react"
import { FileDown, Wand2 } from "lucide-react"
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import { SmartMixedFontText } from './SmartMixedFontText'
import { getProjectById, getTranslationsByCountry } from "../../lib/projectApi"

// 字体文件路径
const ArialFont = '/fonts/Arial.ttf'
const STHeitiFont = '/fonts/STHeiti.ttf'
const ArialUnicodeFont = '/fonts/Arial Unicode.ttf'

// 注册字体
Font.register({
  family: 'Arial',
  src: ArialFont,
});

Font.register({
  family: 'STHeiti',
  src: STHeitiFont,
});

Font.register({
  family: 'Arial Unicode MS',
  src: ArialUnicodeFont,
});

// 单位转换：毫米到点
const MM_TO_PT = 2.83465;

// 罗马数字转换函数
const toRoman = (num: number): string => {
  const romanNumerals = [
    { value: 50, symbol: 'L' },
    { value: 40, symbol: 'XL' },
    { value: 10, symbol: 'X' },
    { value: 9, symbol: 'IX' },
    { value: 5, symbol: 'V' },
    { value: 4, symbol: 'IV' },
    { value: 1, symbol: 'I' }
  ];
  
  let result = '';
  let remaining = num;
  
  for (let i = 0; i < romanNumerals.length; i++) {
    while (remaining >= romanNumerals[i].value) {
      result += romanNumerals[i].symbol;
      remaining -= romanNumerals[i].value;
    }
  }
  
  return result;
};

// 文本处理函数
const splitIntoParagraphs = (text: string): string[] => {
  return text.split(/\n\s*\n/).filter(paragraph => paragraph.trim().length > 0);
};

const processFirstParagraph = (paragraph: string): string => {
  const lines = paragraph.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return '';
  
  const firstLine = lines[0].trim();
  const remainingLines = lines.slice(1);
  
  const processedFirstLine = firstLine.replace(/^(\d+)\.\s*/, (match, number) => {
    const romanNumber = toRoman(parseInt(number));
    return `${romanNumber}. `;
  });
  
  return [processedFirstLine, ...remainingLines].join('\n');
};

const processOtherParagraph = (paragraph: string): string => {
  return paragraph.replace(/^(\d+)\.\s*/gm, (match, number) => {
    const romanNumber = toRoman(parseInt(number));
    return `${romanNumber}. `;
  });
};

const processRemainingParagraphs = (paragraphs: string[]): string[] => {
  return paragraphs.map(processOtherParagraph);
};

interface LanguageMap {
  [key: string]: string
}

export default function ProjectInfo() {
  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

  const { labelData } = useLabelContext()
  const { labelWidth, labelHeight, drugInfo, selectedLanguage, fontSize, selectedProject } = labelData


  // 批量格式化（功能待补充）
  const handleBatchFormat = () => {
    alert('批量格式化功能待补充')
  }


  const [isExporting, setIsExporting] = useState(false);

  const handleBatchExport = async () => {
    if (!selectedProject) {
      alert('请先选择一个项目');
      return;
    }

    try {
      setIsExporting(true);

      // 获取项目完整信息
      const projectDetail = await getProjectById(selectedProject.id);
      
      if (!projectDetail.translationGroups || projectDetail.translationGroups.length === 0) {
        alert('该项目没有翻译数据');
        return;
      }


      let successCount = 0;
      let failCount = 0;
      let notSavedCount = 0;

      // 遍历所有翻译组
      for (const group of projectDetail.translationGroups) {
        try {

          // 检查是否有保存的PDF文件
          if (!group.pdf_file_path) {
            notSavedCount++;
            continue;
          }

          // 从服务器下载PDF文件
          const pdfUrl = `http://localhost:3001${group.pdf_file_path}`;
          const response = await fetch(pdfUrl);
          
          if (!response.ok) {
            throw new Error(`下载PDF失败: ${response.status}`);
          }

          const blob = await response.blob();
          
          // 创建下载链接
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          
          // 生成文件名
          const date = new Date().toISOString().split('T')[0];
          const projectName = selectedProject.job_name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
          const countryName = group.country_code.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
          const fileName = `${projectName}_${countryName}_序号${group.sequence_number}_${date}.pdf`;
          
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          successCount++;

          // 添加短暂延迟，避免浏览器阻止多个下载
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          failCount++;
        }
      }

      
      let message = `批量导出完成！\n成功下载: ${successCount} 个PDF`;
      if (failCount > 0) message += `\n失败: ${failCount} 个PDF`;
      if (notSavedCount > 0) message += `\n未保存: ${notSavedCount} 个PDF（请先保存标签）`;
      
      alert(message);

    } catch (error) {
      alert('批量导出失败，请查看控制台了解详细信息');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div 
      className="flex items-center justify-between h-[60px] px-6"
      style={{ 
        backgroundColor: theme.secondary,
        borderBottom: `1px solid ${theme.neutral}`
      }}
    >
      <div className="text-xl font-bold text-white">
        {selectedProject ? selectedProject.job_name : '示例项目'}
      </div>
      <div className="flex gap-4">
        <button
          onClick={handleBatchFormat}
          className="px-4 py-2 rounded-lg flex items-center justify-center transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.primary,
            color: theme.buttonText,
            border: `1px solid ${theme.neutral}`,
            boxShadow: `0 2px 4px ${theme.neutral}33`
          }}
        >
          <Wand2 className="mr-2" size={20} />
          <span style={{ color: theme.buttonText }}>批量格式化</span>
        </button>
        <button
          onClick={handleBatchExport}
          disabled={isExporting}
          className="px-4 py-2 rounded-lg flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: theme.accent,
            color: theme.buttonText,
            border: `1px solid ${theme.neutral}`,
            boxShadow: `0 2px 4px ${theme.neutral}33`
          }}
        >
          <FileDown className="mr-2" size={20} />
          <span style={{ color: theme.buttonText }}>
            {isExporting ? '正在导出...' : '批量导出PDF'}
          </span>
        </button>
      </div>
    </div>
  )
}
