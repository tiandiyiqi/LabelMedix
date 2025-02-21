"use client"

import { useContext } from 'react'
import { Document, Page, Text, View, StyleSheet, PDFViewer, Font, pdf } from '@react-pdf/renderer'
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { Eye, Save, FileDown } from "lucide-react"

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
    fontSize: 10,
    lineHeight: 1.1,
  },
  contentRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: mmToPt(1),
  },
  contentItem: {
    fontSize: 10,
    flexGrow: 1,
    flexBasis: 0,
    textAlign: 'left',
    paddingRight: mmToPt(2),
  },
  contentItemWithUnderline: {
    fontSize: 10,
    flexGrow: 1,
    textAlign: 'left',
    position: 'relative',
  },
  underline: {
    borderBottom: '1pt solid black',
    position: 'absolute',
    bottom: 0,
    left: '100%',
    right: 0,
    marginLeft: mmToPt(2),
    marginRight: mmToPt(2),
  },
  remainingContentRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: mmToPt(1),
  },
  remainingContentItem: {
    fontSize: 10,
    marginRight: mmToPt(4),
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
    contentItem: {
      ...styles.contentItem,
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      textAlign: selectedLanguage === 'AE' ? 'right' : 'left',  // 阿拉伯语右对齐
      direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',     // 阿拉伯语从右到左
    },
    remainingContentItem: {
      ...styles.remainingContentItem,
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      marginRight: mmToPt(spacing),
      textAlign: selectedLanguage === 'AE' ? 'right' : 'left',  // 阿拉伯语右对齐
      direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',     // 阿拉伯语从右到左
    },
    contentRow: {
      ...styles.contentRow,
      direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',     // 阿拉伯语从右到左
    },
    remainingContentRow: {
      ...styles.remainingContentRow,
      direction: selectedLanguage === 'AE' ? 'rtl' : 'ltr',     // 阿拉伯语从右到左
      justifyContent: selectedLanguage === 'AE' ? 'flex-end' : 'flex-start',  // 阿拉伯语靠右对齐
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
        <Page size={[mmToPt(labelWidth), mmToPt(labelHeight)]} style={pageStyle}>
          <View style={{ margin: mmToPt(5) }}>
            {/* 渲染第一段（带罗马序号） */}
            {processedFirstParagraph.map((groupLines, groupIndex) => (
              <View key={`first-${groupIndex}`} style={dynamicStyles.contentRow}>
                {groupLines.map((line, lineIndex) => (
                  <Text key={`first-line-${lineIndex}`} style={dynamicStyles.contentItem}>
                    {processText(line)}
                  </Text>
                ))}
              </View>
            ))}
            
            {/* 渲染第二段（分组但不带序号，带下划线） */}
            {processedSecondParagraph.length > 0 && (
              <View style={{ marginTop: mmToPt(spacing) }}>
                {processedSecondParagraph.map((lines, groupIndex) => (
                  <View key={`second-${groupIndex}`} style={dynamicStyles.contentRow}>
                    {lines.map((line, lineIndex) => (
                      <Text key={`line-${lineIndex}`} style={dynamicStyles.contentItem}>
                        {processText(line)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            )}
            
            {/* 渲染第三段及之后的段落 */}
            {processedRemainingParagraphs.map((paragraph, paraIndex) => (
              <View key={`para-${paraIndex}`} style={{ marginTop: mmToPt(spacing) }}>
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
      </div>

      <div className="flex-grow">
        <PDFViewer width="100%" height="400px" showToolbar={true} style={{ backgroundColor: theme.background }}>
          <Document>
            <Page size={[mmToPt(labelWidth), mmToPt(labelHeight)]} style={pageStyle}>
              <View style={{ margin: mmToPt(5) }}>
                {/* 渲染第一段（带罗马序号） */}
                {processedFirstParagraph.map((groupLines, groupIndex) => (
                  <View key={`first-${groupIndex}`} style={dynamicStyles.contentRow}>
                    {groupLines.map((line, lineIndex) => (
                      <Text key={`first-line-${lineIndex}`} style={dynamicStyles.contentItem}>
                        {processText(line)}
                      </Text>
                    ))}
                  </View>
                ))}
                
                {/* 渲染第二段（分组但不带序号，带下划线） */}
                {processedSecondParagraph.length > 0 && (
                  <View style={{ marginTop: mmToPt(spacing) }}>
                    {processedSecondParagraph.map((lines, groupIndex) => (
                      <View key={`second-${groupIndex}`} style={dynamicStyles.contentRow}>
                        {lines.map((line, lineIndex) => (
                          <Text key={`line-${lineIndex}`} style={dynamicStyles.contentItem}>
                            {processText(line)}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
                
                {/* 渲染第三段及之后的段落 */}
                {processedRemainingParagraphs.map((paragraph, paraIndex) => (
                  <View key={`para-${paraIndex}`} style={{ marginTop: mmToPt(spacing) }}>
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