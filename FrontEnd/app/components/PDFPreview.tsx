"use client"

import { useContext } from 'react'
import { Document, Page, Text, View, StyleSheet, PDFViewer, Font, pdf } from '@react-pdf/renderer'
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
  charset: '[\u4E00-\u9FA5]' // 只用于中文字符范围
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
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    // 设置字体
    context.font = `${fontSize}pt ${fontFamily}`;
    
    // 将文本分成字符
    const chars = Array.from(text);
    let totalWidth = 0;
    
    console.group('文本宽度计算详情');
    console.log('文本:', text);
    console.log('字体大小:', fontSize, 'pt');
    
    chars.forEach(char => {
      let charWidth = 0;
      
      if (/[\u4E00-\u9FA5]/.test(char)) {
        // 中文字符
        charWidth = fontSize * charWidthMap.chinese;
        console.log(`中文字符 "${char}": ${charWidth.toFixed(2)}pt`);
      } else if (char in charWidthMap) {
        // 使用映射表中的宽度
        charWidth = fontSize * charWidthMap[char];
        console.log(`已知字符 "${char}": ${charWidth.toFixed(2)}pt`);
      } else {
        // 未知字符使用canvas测量
        charWidth = context.measureText(char).width;
        console.log(`未知字符 "${char}": ${charWidth.toFixed(2)}pt (通过canvas测量)`);
        // 缓存测量结果
        charWidthMap[char] = charWidth / fontSize;
      }
      
      totalWidth += charWidth;
    });
    
    console.log('总宽度:', totalWidth.toFixed(2), 'pt');
    console.groupEnd();
    
    return totalWidth;
  }
  return 0;
};

// 修改间距计算函数，添加最小间距保护
const calculateSpacing = (containerWidth: number, elements: string[], fontSize: number, fontFamily: string): number => {
  console.group('间距计算过程');
  console.log('容器宽度(pt):', containerWidth);
  console.log('容器宽度(mm):', containerWidth / MM_TO_PT);
  console.log('字体大小:', fontSize, 'pt');
  console.log('字体:', fontFamily);
  console.log('元素数量:', elements.length);
  console.log('元素内容:', elements);

  // 1. 计算所有元素的总宽度
  const elementsWidth = elements.map(text => {
    const width = measureTextWidth(text, fontSize, fontFamily);
    return { text, width };
  });

  console.log('各元素宽度(pt):', elementsWidth);

  const totalContentWidth = elementsWidth.reduce((sum, item) => sum + item.width, 0);
  console.log('内容总宽度(pt):', totalContentWidth);
  console.log('内容总宽度(mm):', totalContentWidth / MM_TO_PT);
  
  // 2. 从容器宽度中减去总宽度得到可用空间
  const availableSpace = containerWidth - totalContentWidth;
  console.log('可用空间(pt):', availableSpace);
  console.log('可用空间(mm):', availableSpace / MM_TO_PT);
  
  // 3. 将可用空间除以元素数量得到基础间距（每个元素后面都需要一个间隔）
  // 添加最小间距保护
  const minSpacing = mmToPt(2); // 最小2mm的间距
  const calculatedSpacing = availableSpace / elements.length;
  const spacing = Math.max(calculatedSpacing, minSpacing);
  
  console.log('计算得到的间距(pt):', spacing);
  console.log('计算得到的间距(mm):', spacing / MM_TO_PT);
  
  console.groupEnd();
  return spacing;
};

// 创建样式
const styles = StyleSheet.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    backgroundColor: 'white',
    justifyContent: 'center',
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
    position: 'relative',
    zIndex: 2,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    fontSize: 10,
    lineHeight: 1.1,
    marginBottom: mmToPt(1),
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
  const { labelData, updateLabelData } = useLabelContext()
  const { labelWidth, labelHeight, drugInfo, selectedLanguage, fontSize, fontFamily, spacing, lineHeight, selectedNumber } = labelData

  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext

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
            }
          ]}>
            <View style={{ width: '100%' }}>
              {processedFirstParagraph.map((groupLines, groupIndex) => {
                const lineSpacing = calculateSpacing(
                  mmToPt(currentWidth - margins.left - margins.right),
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
                      mmToPt(currentWidth - margins.left - margins.right),
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
        {/* 显示当前页面尺寸 */}
        <div className="text-sm text-gray-500">
          当前页面尺寸：{currentWidth.toFixed(1)}mm × {labelHeight}mm
          <br />
          页边距：上{margins.top}mm 下{margins.bottom}mm 左{margins.left}mm 右{margins.right}mm
        </div>
      </div>

      <div className="flex-grow">
        <PDFViewer width="100%" height="400px" showToolbar={true} style={{ backgroundColor: theme.background }}>
          <Document>
            <Page size={[mmToPt(currentWidth), mmToPt(labelHeight)]} style={pageStyle}>
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
                }
              ]}>
                {/* 内容容器 */}
                <View style={{ width: '100%' }}>
                  {/* 渲染第一段（带罗马序号） */}
                  {processedFirstParagraph.map((groupLines, groupIndex) => {
                    const lineSpacing = calculateSpacing(
                      mmToPt(currentWidth - margins.left - margins.right),
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
                  
                  {/* 渲染第二段（分组但不带序号，带下划线） */}
                  {processedSecondParagraph.length > 0 && (
                    <View style={{ marginTop: mmToPt(spacing * 2) }}>
                      {processedSecondParagraph.map((lines, groupIndex) => {
                        const lineSpacing = calculateSpacing(
                          mmToPt(currentWidth - margins.left - margins.right),
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
                  
                  {/* 渲染第三段及之后的段落 */}
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
      </div>

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