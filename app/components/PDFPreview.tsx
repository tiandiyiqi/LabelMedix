"use client"

import { useContext, useEffect, useRef, useCallback, useState } from 'react'
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { Eye, Save, FileDown } from "lucide-react"
import { calculatePageWidth, calculatePageMargins } from '../utils/calculatePageWidth'
import PDFExport from "./PDFExport"
import dynamic from 'next/dynamic'

// 动态导入 PDFViewer，禁用 SSR
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFViewer),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[400px] flex items-center justify-center text-gray-500 bg-gray-100 rounded-lg">
        正在加载PDF预览...
      </div>
    )
  }
);

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
  
  return result; // 返回大写罗马数字
};

// 单位转换：毫米到点
const MM_TO_PT = 2.83465;
const mmToPt = (mm: number) => mm * MM_TO_PT;

// 字体选择函数 - 根据文本内容选择合适的字体
const getFontFamily = (text: string, language?: string): string => {
  // 根据语言选择字体
  if (language === 'TH' || language === 'AE') {
    return 'Arial Unicode'; // 泰语和阿拉伯语使用Arial Unicode MS字体
  }
  
  // 检查是否包含中文字符 (CJK范围)
  // 实现之前charset: '[\u4E00-\u9FA5]'的功能，使其按照文本内容动态选择字体
  if (/[\u4E00-\u9FA5\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF]/.test(text)) {
    return 'STHeiti'; // 中文字符使用中文字体
  }
  return 'Arial'; // 非中文字符使用英文字体
};

// 注册字体
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
  family: 'STHeiti',
  src: '/fonts/STHeiti.ttf'
  // 原始属性: charset: '[\u4E00-\u9FA5]' - 现在通过getFontFamily函数实现相同功能
});

Font.register({
  family: 'Arial Unicode',
  src: '/fonts/Arial Unicode.ttf'
});

// 创建字体回退配置
Font.registerHyphenationCallback((word: string) => {
  // 可以根据不同字符类型返回不同的断字结果
  return [word];
});

// 创建复合字体 - 用于混合内容
Font.register({
  family: 'Composite',
  fonts: [
    { src: '/fonts/STHeiti.ttf' },
    { src: '/fonts/Arial.ttf' }
  ]
});

// 文本分段处理函数
const splitIntoParagraphs = (text: string): string[] => {
  // 使用三个或更多换行符作为分隔符（即连续两个空白行）
  return text.split(/\n\s*\n\s*\n+/).filter(para => para.trim() !== '');
};

// 处理第一段文本，添加罗马序号 

// 字符宽度映射表（相对于字体大小的比例）
const charWidthMap: {
  chinese: number;
  [key: string]: number;
} = {
  // 中文字符
  chinese: 1.0,  // 中文字符固定为字体大小
  
  // 大写英文字母
  'A': 0.722, 'B': 0.667, 'C': 0.722, 'D': 0.722, 'E': 0.611,
  'F': 0.556, 'G': 0.722, 'H': 0.722, 'I': 0.278, 'J': 0.5,
  'K': 0.667, 'L': 0.556, 'M': 0.833, 'N': 0.722, 'O': 0.778,
  'P': 0.667, 'Q': 0.778, 'R': 0.722, 'S': 0.667, 'T': 0.611,
  'U': 0.722, 'V': 0.667, 'W': 0.944, 'X': 0.667, 'Y': 0.667,
  'Z': 0.611,
  
  // 小写英文字母
  'a': 0.556, 'b': 0.556, 'c': 0.5, 'd': 0.556, 'e': 0.556,
  'f': 0.278, 'g': 0.556, 'h': 0.556, 'i': 0.222, 'j': 0.222,
  'k': 0.5, 'l': 0.222, 'm': 0.833, 'n': 0.556, 'o': 0.556,
  'p': 0.556, 'q': 0.556, 'r': 0.333, 's': 0.5, 't': 0.278,
  'u': 0.556, 'v': 0.5, 'w': 0.722, 'x': 0.5, 'y': 0.5,
  'z': 0.5,
  
  // 数字
  '0': 0.556, '1': 0.556, '2': 0.556, '3': 0.556, '4': 0.556,
  '5': 0.556, '6': 0.556, '7': 0.556, '8': 0.556, '9': 0.556,
  
  // 标点符号
  '.': 0.527, ',': 0.25, ':': 0.277, ';': 0.277, '!': 0.333,
  '?': 0.556, '"': 0.556, "'": 0.222, '`': 0.222, '(': 0.333,
  ')': 0.333, '[': 0.333, ']': 0.333, '{': 0.333, '}': 0.333,
  '/': 0.278, '\\': 0.278, '|': 0.222, '-': 0.333, '_': 0.556,
  '+': 0.584, '=': 0.584, '*': 0.389, '&': 0.722, '#': 0.556,
  '%': 0.889, '$': 0.556, '@': 1.015,
  
  // 空格
  ' ': 0.25,
  
  // 其他特殊字符
  '·': 0.333, '—': 1.0, '…': 1.0, '™': 1.0, '©': 1.0, '®': 1.0,
  '°': 0.4, '′': 0.333, '″': 0.556, '§': 0.556, '¶': 0.556,
  '†': 0.556, '‡': 0.556, '•': 0.35
};

// 添加文本宽度测量函数
const measureTextWidth = (text: string, fontSize: number, fontFamily: string): number => {
  // 检查是否在客户端环境
  if (typeof window === 'undefined') {
    // 服务器端渲染时返回一个更精确的估算值
    const chars = Array.from(text);
    let totalWidth = 0;
    
    chars.forEach(char => {
      let charWidth = 0;
      
      if (/[\u4E00-\u9FA5]/.test(char)) {
        // 中文字符
        charWidth = fontSize * 1.0; // 中文字符宽度
      } else if (char in charWidthMap) {
        // 使用映射表中的宽度
        charWidth = fontSize * charWidthMap[char];
      } else {
        // 未知字符使用平均值
        charWidth = fontSize * 0.6; // 平均字符宽度
      }
      
      totalWidth += charWidth;
    });
    
    return totalWidth;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    // 设置字体
    context.font = `${fontSize}pt ${fontFamily}`;
    
    // 将文本分成字符
    const chars = Array.from(text);
    let totalWidth = 0;
    
    chars.forEach(char => {
      let charWidth = 0;
      
      if (/[\u4E00-\u9FA5]/.test(char)) {
        // 中文字符
        charWidth = fontSize * charWidthMap.chinese;
      } else if (char in charWidthMap) {
        // 使用映射表中的宽度
        charWidth = fontSize * charWidthMap[char];
      } else {
        // 未知字符使用canvas测量
        charWidth = context.measureText(char).width;
        // 缓存测量结果
        charWidthMap[char] = charWidth / fontSize;
      }
      
      totalWidth += charWidth;
    });
    
    return totalWidth;
  }
  return 0;
};

// 创建样式
const styles = StyleSheet.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
  },
  content: {
    fontSize: 10,
    lineHeight: 1.1,
    marginBottom: mmToPt(1),
  },
  marginBox: {
    position: 'absolute',
    borderStyle: 'dashed',
    borderColor: 'rgb(48, 184, 214)',
    borderWidth: 0.5,
    pointerEvents: 'none',
    zIndex: 1,
  },
  contentWrapper: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  chineseText: {
    fontFamily: 'STHeiti'
  }
});

export default function PDFPreview() {
  // 添加客户端渲染标记
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const theme = useContext(ThemeContext)?.theme || { primary: '#2563eb', border: '#e5e7eb', background: '#f3f4f6', text: '#1f2937' };
  const { labelData, updateLabelData } = useLabelContext();
  const { labelWidth, labelHeight, drugInfo, selectedLanguage, fontSize, fontFamily, spacing, lineHeight, selectedNumber } = labelData;

  // 处理文本，分离中文和非中文字符
  const processText = (text: string) => {
    // 如果是阿拉伯语，使用Arial Unicode字体并设置右对齐和从右到左方向
    if (selectedLanguage === 'AE') {
      return <Text style={{ 
        fontFamily: 'Arial Unicode',
        textAlign: 'right',
        direction: 'rtl',
        width: '100%' // 确保文本占据整个宽度以便右对齐生效
      }}>{text}</Text>;
    }
    
    // 如果是泰语，使用Arial Unicode字体
    if (selectedLanguage === 'TH') {
      return <Text style={{ 
        fontFamily: 'Arial Unicode',
        textAlign: 'left',
        direction: 'ltr'
      }}>{text}</Text>;
    }
    
    // 处理其他语言，分离中文和非中文字符
    const parts = text.split(/([^\u4E00-\u9FA5]+)/);
    return parts.filter(Boolean).map((part, index) => {
      if (part.match(/[\u4E00-\u9FA5]/)) {
        // 中文文本
        return <Text key={index} style={{ ...styles.chineseText, fontFamily: getFontFamily(part, selectedLanguage) }}>{part}</Text>;
      }
      // 非中文文本
      return <Text key={index} style={{ fontFamily: getFontFamily(part, selectedLanguage) }}>{part}</Text>;
    });
  };

  // 导出PDF功能
  const handleExportPDF = async () => {
    const blob = await pdf(
      <Document>
        <Page size={[mmToPt(currentWidth), mmToPt(labelHeight)]} style={pageStyle}>
          <View style={[
            styles.marginBox,
            {
              top: mmToPt(margins.top),
              left: mmToPt(margins.left),
              width: mmToPt(currentWidth - margins.left - margins.right),
              height: mmToPt(labelHeight - margins.top - margins.bottom),
            }
          ]} />
          
          <View style={[
            styles.contentWrapper,
            {
              marginTop: mmToPt(margins.top),
              marginBottom: mmToPt(margins.bottom),
              marginLeft: mmToPt(margins.left),
              marginRight: mmToPt(margins.right),
              minHeight: mmToPt(labelHeight - margins.top - margins.bottom),
              justifyContent: 'center',
              direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr'
            }
          ]}>
            <View style={{ 
              width: '100%',
              direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr'
            }}>
              {drugInfo && drugInfo.map((item, index) => (
                <View key={index} style={{
                  marginBottom: mmToPt(spacing || 2),
                  textAlign: selectedLanguage === 'AE' ? 'right' : 'left',
                  width: '100%',
                  direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr'
                }}>
                  {processText(item.text)}
                </View>
              ))}
            </View>
          </View>
        </Page>
      </Document>
    ).toBlob();
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `label-${selectedLanguage}-${selectedNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  // 计算当前页面宽度和边距
  const currentWidth = calculatePageWidth(labelWidth, Number(selectedNumber));
  const margins = calculatePageMargins(Number(selectedNumber));
  
  // 创建动态页面样式
  const pageStyle = {
    ...styles.page,
  };
  
  // 如果不是客户端环境，返回加载占位符
  if (!isClient) {
    return (
      <div className="h-full flex flex-col card rounded-lg shadow w-full" style={{ borderColor: theme.border }}>
        <h2 className="text-xl font-bold mb-6 flex items-center" style={{ color: theme.primary }}>
          <Eye className="mr-2" size={24} />
          标签预览
        </h2>
        <div className="h-[400px] flex items-center justify-center text-gray-500 bg-gray-100 rounded-lg">
          正在加载PDF预览...
        </div>
      </div>
    );
  }
  
  // 验证并获取有效的尺寸值
  const getValidDimension = (value: number) => {
    const minSize = 20; // PDF模块要求的最小安全尺寸
    const maxSize = 1000;
    return Math.max(minSize, Math.min(maxSize, value));
  };

  // 处理尺寸输入
  const handleDimensionInput = (e: React.KeyboardEvent<HTMLInputElement>, type: 'width' | 'height') => {
    if (e.key === 'Enter') {
      const value = Number(e.currentTarget.value);
      const validValue = getValidDimension(value);
      
      if (value !== validValue) {
        // 如果值被调整，通知用户
        alert(`输入的值 ${value}mm 已被调整为安全值 ${validValue}mm\n（最小值: 40mm, 最大值: 1000mm）`);
      }
      
      updateLabelData(
        type === 'width' 
          ? { labelWidth: validValue }
          : { labelHeight: validValue }
      );

      // 更新输入框显示的值
      e.currentTarget.value = validValue.toString();
    }
  };
  
  return (
    <div className="h-full flex flex-col card rounded-lg shadow w-full" style={{ borderColor: theme.border }}>
      <h2 className="text-xl font-bold mb-6 flex items-center" style={{ color: theme.primary }}>
        <Eye className="mr-2" size={24} />
        标签预览
      </h2>
      <div className="mb-6 space-y-4">
        {/* 宽度和高度 */}
        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="flex items-center border border-[#30B8D6] rounded-md">
              <label className="text-base font-medium px-3 py-2 min-w-[120px]" style={{ color: theme.text }}>
                标签宽度：
              </label>
              <div className="flex-1">
                <input
                  type="number"
                  defaultValue={labelWidth}
                  placeholder="最小值: 40mm"
                  onKeyDown={(e) => handleDimensionInput(e, 'width')}
                  className="w-full px-3 py-2 focus:outline-none"
                  style={{
                    color: theme.text,
                    backgroundColor: "white",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center border border-[#30B8D6] rounded-md">
              <label className="text-base font-medium px-3 py-2 min-w-[120px]" style={{ color: theme.text }}>
                标签高度：
              </label>
              <div className="flex-1">
                <input
                  type="number"
                  defaultValue={labelHeight}
                  placeholder="最小值: 40mm"
                  onKeyDown={(e) => handleDimensionInput(e, 'height')}
                  className="w-full px-3 py-2 focus:outline-none"
                  style={{
                    color: theme.text,
                    backgroundColor: "white",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-grow">
        {typeof window !== 'undefined' && (
          <PDFViewer width="100%" height="400px" showToolbar={true} style={{ backgroundColor: theme.background }}>
            <Document>
              <Page 
                size={[mmToPt(currentWidth), mmToPt(labelHeight)]} 
                style={pageStyle}
              >
                {/* 添加页边距矩形框 */}
                <View style={[
                  styles.marginBox,
                  {
                    top: mmToPt(margins.top),
                    left: mmToPt(margins.left),
                    width: mmToPt(currentWidth - margins.left - margins.right),
                    height: mmToPt(labelHeight - margins.top - margins.bottom),
                  }
                ]} />
                
                {/* 内容包装器 */}
                <View style={[
                  styles.contentWrapper,
                  {
                    marginTop: mmToPt(margins.top),
                    marginBottom: mmToPt(margins.bottom),
                    marginLeft: mmToPt(margins.left),
                    marginRight: mmToPt(margins.right),
                    minHeight: mmToPt(labelHeight - margins.top - margins.bottom),
                    justifyContent: 'center',
                    // 阿拉伯语的整体容器设置
                    direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr'
                  }
                ]}>
                  {/* 内容渲染 */}
                  <View style={{ 
                    width: '100%',
                    // 确保内容容器也应用RTL方向
                    direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr'
                  }}>
                    {/* 渲染内容... */}
                    {drugInfo && drugInfo.map((item, index) => (
                      <View key={index} style={{
                        marginBottom: mmToPt(spacing || 2),
                        // 确保每个项目容器也应用正确的文本对齐
                        textAlign: selectedLanguage === 'AE' ? 'right' : 'left',
                        width: '100%', // 确保容器占据整个宽度以便对齐生效
                        direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr' // 确保每个项目也应用RTL方向
                      }}>
                        {processText(item.text)}
                      </View>
                    ))}
                  </View>
                </View>
              </Page>
            </Document>
          </PDFViewer>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-4 mt-6 mb-6 h-full items-center">
        <button
          className="px-4 py-2 rounded-lg flex items-center justify-center transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.accent || '#f97316',
            color: theme.buttonText || '#ffffff',
            border: `1px solid ${theme.neutral || '#6b7280'}`,
            boxShadow: `0 2px 4px ${theme.neutral || '#6b7280'}33`
          }}
          onClick={() => {
            // TODO: 实现保存标签数据功能
          }}
        >
          <Save className="mr-2" size={20} />
          保存标签数据
        </button>
        <button
          className="px-4 py-2 rounded-lg flex items-center justify-center transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.accent || '#f97316',
            color: theme.buttonText || '#ffffff',
            border: `1px solid ${theme.neutral || '#6b7280'}`,
            boxShadow: `0 2px 4px ${theme.neutral || '#6b7280'}33`
          }}
          onClick={handleExportPDF}
        >
          <FileDown className="mr-2" size={20} />
          导出PDF
        </button>
      </div>
    </div>
  );
} 