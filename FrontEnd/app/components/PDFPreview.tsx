"use client"

import { useContext, useState, useEffect } from 'react'
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
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
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { Eye, Save, FileDown } from "lucide-react"
import { calculatePageWidth, calculatePageMargins } from '../utils/calculatePageWidth'

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
  src: '/fonts/STHeiti.ttf',
  // 中文字体限制：字体范围的限制是通过processText函数中的正则表达式[\u4E00-\u9FA5]来实现
  // 该函数会将中文字符与非中文字符分开，并仅对中文字符应用STHeiti字体
});

Font.register({
  family: 'Arial Unicode',
  src: '/fonts/Arial Unicode.ttf'
});

// 创建字体回退配置
Font.registerHyphenationCallback((word: string) => {
  return [word];
});

// 创建复合字体
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
const processFirstParagraph = (paragraph: string): Array<string[]> => {
  // 先获取所有非空行
  const allLines = paragraph
    .split('\n')
    .filter(line => line.trim() !== '');

  // 给所有行添加序号
  const numberedLines = allLines.map((line, index) => ({
    number: index + 1,
    content: `${toRoman(index + 1)}. ${line.trim()}`
  }));

  // 按单个空白行分组
  const groups = paragraph
    .split(/\n\s*\n/)
    .filter(group => group.trim() !== '');

  // 处理每个组，保持原有的序号
  return groups.map(group => {
    return group
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        // 在所有编号行中找到匹配的内容
        const matchedLine = numberedLines.find(numbered => 
          numbered.content.endsWith(line.trim())
        );
        return matchedLine ? matchedLine.content : line.trim();
      });
  });
};

// 处理其他段落文本
const processOtherParagraph = (paragraph: string): Array<Array<string>> => {
  // 按单个空白行分组
  const groups = paragraph
    .split(/\n\s*\n/)
    .filter(group => group.trim() !== '');

  // 处理每组
  const result = groups.map(group => {
    const lines = group
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.trim());

    return lines;
  });

  return result;
};

// 处理第三段及之后的段落文本
const processRemainingParagraphs = (paragraph: string): Array<Array<string>> => {
  // 按单个空白行分组
  const groups = paragraph
    .split(/\n\s*\n/)
    .filter(group => group.trim() !== '');

  // 处理每个组
  return groups.map(group => {
    // 分割并过滤空行
    return group
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.trim());
  });
};

// 字符宽度映射表类型
interface CharWidthMap {
  chinese: number;
  [key: string]: number;
}

// 字符宽度映射表（相对于字体大小的比例）
const charWidthMap: CharWidthMap = {
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
    // 服务器端渲染时返回一个估算值
    return text.length * fontSize;
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

// 修改间距计算函数，添加最小间距保护
const calculateSpacing = (containerWidth: number, elements: string[], fontSize: number, fontFamily: string): number => {
  // 1. 计算所有元素的总宽度
  const elementsWidth = elements.map(text => {
    const width = measureTextWidth(text, fontSize, fontFamily);
    return { text, width };
  });

  const totalContentWidth = elementsWidth.reduce((sum, item) => sum + item.width, 0);
  
  // 2. 从容器宽度中减去总宽度得到可用空间
  const availableSpace = containerWidth - totalContentWidth;
  
  // 3. 将可用空间除以元素数量得到基础间距（每个元素后面都需要一个间隔）
  // 添加最小间距保护
  const minSpacing = mmToPt(2); // 最小2mm的间距
  const calculatedSpacing = availableSpace / elements.length;
  const spacing = Math.max(calculatedSpacing, minSpacing);
  
  return spacing;
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
  firstParagraphRow: {  // 第一段的行样式
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',  // 改为左对齐
    width: '100%',
    position: 'relative',
    alignItems: 'flex-start',
  },
  firstParagraphItem: {  // 第一段的项目样式
    position: 'relative',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  secondParagraphRow: {  // 第二段的行样式
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',  // 左对齐
    width: '100%',
    position: 'relative',
    alignItems: 'flex-start',
  },
  secondParagraphItem: {  // 第二段的项目样式
    position: 'relative',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  underline: {
    position: 'absolute',
    bottom: mmToPt(0.4),  // 这个固定值将在动态样式中被覆盖
    left: '100%',
    height: mmToPt(0.2),
    backgroundColor: 'black',
  },
  remainingContentRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: mmToPt(1),  // 设置默认值
  },
  remainingContentItem: {
    fontSize: 10,
    marginBottom: 0,  // 移除项目级的垂直间距
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

  const { labelData, updateLabelData } = useLabelContext()
  const { labelWidth, labelHeight, drugInfo, selectedLanguage, fontSize, fontFamily, spacing, lineHeight, selectedNumber } = labelData

  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

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

  // 计算当前页面宽度和边距
  const currentWidth = calculatePageWidth(labelWidth, Number(selectedNumber));
  const margins = calculatePageMargins(Number(selectedNumber));

  // 创建动态页面样式
  const pageStyle = {
    ...styles.page,
  };

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

  // 处理尺寸微调
  const handleDimensionStep = (e: React.ChangeEvent<HTMLInputElement>, type: 'width' | 'height') => {
    // 移除即时更新，让用户按回车确认
  };

  // 创建动态内容样式
  const contentStyle = {
    ...styles.content,
    fontSize: mmToPt(fontSize),
    fontFamily: fontFamily,
    lineHeight: lineHeight,
    textAlign: selectedLanguage === 'AE' ? 'right' : 'left',  // 阿拉伯语右对齐
    direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',     // 阿拉伯语从右到左
  };

  // 处理文本
  const paragraphs = splitIntoParagraphs(drugInfo);
  const processedFirstParagraph = paragraphs.length > 0 ? processFirstParagraph(paragraphs[0]) : [];
  const processedSecondParagraph = paragraphs.length > 1 ? processOtherParagraph(paragraphs[1]) : [];
  const processedRemainingParagraphs = paragraphs.slice(2).map(para => processRemainingParagraphs(para));

  // 更新样式以使用动态参数
  const dynamicStyles = StyleSheet.create({
    ...styles,
    content: {
      ...styles.content,
      fontSize: mmToPt(fontSize),
      fontFamily: fontFamily,
      lineHeight: lineHeight,
      marginBottom: mmToPt(spacing*5),
    },
    firstParagraphRow: {
      ...styles.firstParagraphRow,
      marginBottom: mmToPt(spacing),
      direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',
      justifyContent: selectedLanguage === 'AE' ? 'flex-end' : 'flex-start',
    },
    firstParagraphItem: {
      ...styles.firstParagraphItem,
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      textAlign: selectedLanguage === 'AE' ? 'right' : 'left',
      direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',
    },
    secondParagraphRow: {
      ...styles.secondParagraphRow,
      marginBottom: mmToPt(spacing),
      direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',
      justifyContent: selectedLanguage === 'AE' ? 'flex-end' : 'flex-start',
    },
    secondParagraphItem: {
      ...styles.secondParagraphItem,
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      textAlign: selectedLanguage === 'AE' ? 'right' : 'left',
      direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',
    },
    underline: {
      ...styles.underline,
      // 计算下划线位置：先将字体大小转换为点，再计算行间距
      bottom: mmToPt(fontSize) * (lineHeight - 1)/2-1,
    },
    remainingContentRow: {
      ...styles.remainingContentRow,
      marginBottom: mmToPt(spacing),  // 在动态样式中使用 spacing 参数
      direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',
      justifyContent: selectedLanguage === 'AE' ? 'flex-end' : 'flex-start',
    },
    remainingContentItem: {
      ...styles.remainingContentItem,
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      marginBottom: 0,
      textAlign: selectedLanguage === 'AE' ? 'right' : 'left',
      direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',
    },
  });

  // 处理文本，分离中文和非中文字符
  const processText = (text: string) => {
    // 如果是阿拉伯语，不需要分离文字
    if (selectedLanguage === 'AE') {
      return <Text>{text}</Text>;
    }
    
    const parts = text.split(/([^\u4E00-\u9FA5]+)/);
    return parts.map((part, index) => {
      if (part.match(/[\u4E00-\u9FA5]/)) {
        // 中文文本
        return <Text key={index} style={styles.chineseText}>{part}</Text>;
      }
      // 非中文文本
      return <Text key={index}>{part}</Text>;
    });
  };

  // 导出PDF功能
  const handleExportPDF = async () => {
    const blob = await pdf(
      <Document>
        <Page size={[mmToPt(currentWidth), mmToPt(labelHeight)]} style={pageStyle}>
          {/* 恢复边距矩形框 */}
          <View style={[
            styles.marginBox,
            {
              top: mmToPt(margins.top),
              left: mmToPt(margins.left),
              width: mmToPt(currentWidth - margins.left - margins.right),
              height: mmToPt(labelHeight - margins.top - margins.bottom),
            }
          ]} />

          <View style={{
            marginTop: mmToPt(margins.top),
            marginBottom: mmToPt(margins.bottom),
            marginLeft: mmToPt(margins.left),
            marginRight: mmToPt(margins.right),
            width: mmToPt(currentWidth - margins.left - margins.right),
            minHeight: mmToPt(labelHeight - margins.top - margins.bottom),
            justifyContent: 'center',
          }}>
            <View style={{ width: '100%' }}>
              {processedFirstParagraph.map((groupLines, groupIndex) => {
                const lineSpacing = calculateSpacing(
                  mmToPt(currentWidth - margins.left - margins.right), // 修正宽度计算
                  groupLines,
                  fontSize,
                  fontFamily
                );
                
                return (
                  <View 
                    key={`first-${groupIndex}`} 
                    style={[
                      dynamicStyles.firstParagraphRow,
                      { gap: lineSpacing }
                    ]}
                  >
                    {groupLines.map((line, lineIndex) => (
                      <Text 
                        key={`first-line-${lineIndex}`} 
                        style={[
                          dynamicStyles.firstParagraphItem,
                          { marginRight: 0 }
                        ]}
                      >
                        {processText(line)}
                      </Text>
                    ))}
                  </View>
                );
              })}
              
              {processedSecondParagraph.length > 0 && (
                <View style={{ marginTop: mmToPt(spacing * 2) }}>
                  {processedSecondParagraph.map((lines, groupIndex) => {
                    const lineSpacing = calculateSpacing(
                      mmToPt(currentWidth - margins.left - margins.right), // 修正宽度计算
                      lines,
                      fontSize,
                      fontFamily
                    );
                    
                    return (
                      <View 
                        key={`second-${groupIndex}`} 
                        style={[
                          dynamicStyles.secondParagraphRow,
                          { gap: lineSpacing }
                        ]}
                      >
                        {lines.map((line, lineIndex) => (
                          <View 
                            key={`line-${lineIndex}`} 
                            style={dynamicStyles.secondParagraphItem}
                          >
                            <Text>{processText(line)}</Text>
                            <View 
                              style={[
                                dynamicStyles.underline,
                                { width: lineSpacing - mmToPt(1.5) }
                              ]} 
                            />
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              )}
              
              {processedRemainingParagraphs.map((paragraph, paraIndex) => (
                <View key={`para-${paraIndex}`} style={{ marginTop: mmToPt(spacing * 2) }}>
                  {paragraph.map((group, groupIndex) => (
                    <View key={`group-${groupIndex}`} style={dynamicStyles.remainingContentRow}>
                      {group.map((line, lineIndex) => (
                        <Text key={`line-${lineIndex}`} style={dynamicStyles.remainingContentItem}>
                          {processText(line)}
                        </Text>
                      ))}
                    </View>
                  ))}
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

        {/* 页面尺寸和边距 */}
        <div className="rounded-lg p-2.5 space-y-1.5" style={{ backgroundColor: '#f3f4f6' }}>
          <div className="flex items-center">
            <label className="text-sm font-medium min-w-[80px]" style={{ color: '#666666' }}>
              页面尺寸：
            </label>
            <div className="flex items-center">
              <div className="flex-1 flex items-center" style={{ width: '280px' }}>
                <input
                  type="text"
                  value={currentWidth.toFixed(1)}
                  className="w-24 px-1 py-0.5 border-b border-t-0 border-l-0 border-r-0 focus:outline-none text-sm text-center bg-transparent"
                  style={{
                    color: '#666666',
                    borderColor: '#9ca3af'
                  }}
                  onChange={(e) => e.target.value}
                />
                <span className="text-sm mx-2" style={{ color: '#666666' }}>×</span>
                <input
                  type="text"
                  value={labelHeight}
                  className="w-24 px-1 py-0.5 border-b border-t-0 border-l-0 border-r-0 focus:outline-none text-sm text-center bg-transparent"
                  style={{
                    color: '#666666',
                    borderColor: '#9ca3af'
                  }}
                  onChange={(e) => e.target.value}
                />
                <span className="text-sm ml-2" style={{ width: '30px', color: '#666666' }}>mm</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center">
            <label className="text-sm font-medium min-w-[80px]" style={{ color: '#666666' }}>
              页面边距：
            </label>
            <div className="flex items-center" style={{ width: '280px' }}>
              <div className="flex items-center flex-1 justify-between">
                <div className="flex items-center">
                  <span className="text-sm mr-1" style={{ color: '#666666' }}>上</span>
                  <input
                    type="text"
                    value={margins.top}
                    className="w-12 px-1 py-0.5 border-b border-t-0 border-l-0 border-r-0 focus:outline-none text-sm text-center bg-transparent"
                    style={{
                      color: '#666666',
                      borderColor: '#9ca3af'
                    }}
                    onChange={(e) => e.target.value}
                  />
                </div>
                <div className="flex items-center">
                  <span className="text-sm mr-1" style={{ color: '#666666' }}>下</span>
                  <input
                    type="text"
                    value={margins.bottom}
                    className="w-12 px-1 py-0.5 border-b border-t-0 border-l-0 border-r-0 focus:outline-none text-sm text-center bg-transparent"
                    style={{
                      color: '#666666',
                      borderColor: '#9ca3af'
                    }}
                    onChange={(e) => e.target.value}
                  />
                </div>
                <div className="flex items-center">
                  <span className="text-sm mr-1" style={{ color: '#666666' }}>左</span>
                  <input
                    type="text"
                    value={margins.left}
                    className="w-12 px-1 py-0.5 border-b border-t-0 border-l-0 border-r-0 focus:outline-none text-sm text-center bg-transparent"
                    style={{
                      color: '#666666',
                      borderColor: '#9ca3af'
                    }}
                    onChange={(e) => e.target.value}
                  />
                </div>
                <div className="flex items-center">
                  <span className="text-sm mr-1" style={{ color: '#666666' }}>右</span>
                  <input
                    type="text"
                    value={margins.right}
                    className="w-12 px-1 py-0.5 border-b border-t-0 border-l-0 border-r-0 focus:outline-none text-sm text-center bg-transparent"
                    style={{
                      color: '#666666',
                      borderColor: '#9ca3af'
                    }}
                    onChange={(e) => e.target.value}
                  />
                </div>
                <span className="text-sm" style={{ width: '30px', color: '#666666' }}>mm</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-grow">
        {typeof window !== 'undefined' && (
          <PDFViewer width="100%" height="400px" showToolbar={true} style={{ backgroundColor: theme.background }}>
          <Document>
            <Page size={[mmToPt(currentWidth), mmToPt(labelHeight)]} style={pageStyle}>
              {/* 恢复边距矩形框 */}
              <View style={[
                styles.marginBox,
                {
                  top: mmToPt(margins.top),
                  left: mmToPt(margins.left),
                  width: mmToPt(currentWidth - margins.left - margins.right),
                  height: mmToPt(labelHeight - margins.top - margins.bottom),
                }
              ]} />

              <View style={{
                marginTop: mmToPt(margins.top),
                marginBottom: mmToPt(margins.bottom),
                marginLeft: mmToPt(margins.left),
                marginRight: mmToPt(margins.right),
                width: mmToPt(currentWidth - margins.left - margins.right),
                minHeight: mmToPt(labelHeight - margins.top - margins.bottom),
                justifyContent: 'center',
              }}>
                <View style={{ width: '100%' }}>
                  {processedFirstParagraph.map((groupLines, groupIndex) => {
                    const lineSpacing = calculateSpacing(
                      mmToPt(currentWidth - margins.left - margins.right), // 修正宽度计算
                      groupLines,
                      fontSize,
                      fontFamily
                    );
                    
                    return (
                      <View 
                        key={`first-${groupIndex}`} 
                        style={[
                          dynamicStyles.firstParagraphRow,
                          { gap: lineSpacing }
                        ]}
                      >
                        {groupLines.map((line, lineIndex) => (
                          <Text 
                            key={`first-line-${lineIndex}`} 
                            style={[
                              dynamicStyles.firstParagraphItem,
                              { marginRight: 0 }
                            ]}
                          >
                            {processText(line)}
                          </Text>
                        ))}
                      </View>
                    );
                  })}
                  
                  {processedSecondParagraph.length > 0 && (
                    <View style={{ marginTop: mmToPt(spacing * 2) }}>
                      {processedSecondParagraph.map((lines, groupIndex) => {
                        const lineSpacing = calculateSpacing(
                          mmToPt(currentWidth - margins.left - margins.right), // 修正宽度计算
                          lines,
                          fontSize,
                          fontFamily
                        );
                        
                        return (
                          <View 
                            key={`second-${groupIndex}`} 
                            style={[
                              dynamicStyles.secondParagraphRow,
                              { gap: lineSpacing }
                            ]}
                          >
                            {lines.map((line, lineIndex) => (
                              <View 
                                key={`line-${lineIndex}`} 
                                style={dynamicStyles.secondParagraphItem}
                              >
                                <Text>{processText(line)}</Text>
                                <View 
                                  style={[
                                    dynamicStyles.underline,
                                    { width: lineSpacing - mmToPt(1.5) }
                                  ]} 
                                />
                              </View>
                            ))}
                          </View>
                        );
                      })}
                    </View>
                  )}
                  
                  {processedRemainingParagraphs.map((paragraph, paraIndex) => (
                    <View key={`para-${paraIndex}`} style={{ marginTop: mmToPt(spacing * 2) }}>
                      {paragraph.map((group, groupIndex) => (
                        <View key={`group-${groupIndex}`} style={dynamicStyles.remainingContentRow}>
                          {group.map((line, lineIndex) => (
                            <Text key={`line-${lineIndex}`} style={dynamicStyles.remainingContentItem}>
                              {processText(line)}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            </Page>
          </Document>
        </PDFViewer>
        )}
      </div>

      {/* 显示当前页面尺寸和页边距信息 */}
      {/* <div className="text-sm text-gray-500 mt-4 mb-4">
        <div>当前页面尺寸：{currentWidth.toFixed(1)}mm × {labelHeight}mm</div>
        <div>页边距：上{margins.top}mm 下{margins.bottom}mm 左{margins.left}mm 右{margins.right}mm</div>
      </div> */}

      {/* 操作按钮 */}
      <div className="grid grid-cols-2 gap-4 mt-6 mb-6 h-full items-center">
        <button
          className="px-4 py-2 rounded-lg flex items-center justify-center transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.accent,
            color: theme.buttonText,
            border: `1px solid ${theme.neutral}`,
            boxShadow: `0 2px 4px ${theme.neutral}33`
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
            backgroundColor: theme.accent,
            color: theme.buttonText,
            border: `1px solid ${theme.neutral}`,
            boxShadow: `0 2px 4px ${theme.neutral}33`
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