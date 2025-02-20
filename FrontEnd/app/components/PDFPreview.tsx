"use client"

import { useContext } from 'react'
import { Document, Page, Text, View, StyleSheet, PDFViewer, Font } from '@react-pdf/renderer'
import { ThemeContext } from "./Layout"
import { useLabelContext } from "../../lib/context/LabelContext"
import { Eye } from "lucide-react"

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
    fontFamily: 'STHeiti',
    fontSize: 10,
    lineHeight: 1.1,
  },
  contentRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between', // 平均分配空间
    width: '100%',
    marginBottom: mmToPt(1),
  },
  contentItem: {
    fontFamily: 'STHeiti',
    fontSize: 12,
    flexGrow: 1, // 允许伸展以平均分配空间
    flexBasis: 0, // 所有列从相同的基础开始
    textAlign: 'left',
    paddingRight: mmToPt(2),
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
  },
  contentItemWithUnderline: {
    fontFamily: 'STHeiti',
    fontSize: 12,
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
    marginLeft: mmToPt(2),  // 文字和下划线之间的间距
    marginRight: mmToPt(2), // 下划线和下一个文字之间的间距
  },
  remainingContentRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: mmToPt(1),
  },
  remainingContentItem: {
    fontFamily: 'STHeiti',
    fontSize: 12,
    marginRight: mmToPt(4),
  },
});

export default function PDFPreview() {
  const { labelData, updateLabelData } = useLabelContext()
  const { labelWidth, labelHeight, drugInfo, selectedLanguage, fontSize, fontFamily, spacing, lineHeight } = labelData

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

  // 处理文本
  const paragraphs = splitIntoParagraphs(drugInfo);
  const processedFirstParagraph = paragraphs.length > 0 ? processFirstParagraph(paragraphs[0]) : [];
  const processedSecondParagraph = paragraphs.length > 1 ? processOtherParagraph(paragraphs[1]) : [];
  const processedRemainingParagraphs = paragraphs.slice(2).map(para => processRemainingParagraphs(para));

  return (
    <div className="h-full flex flex-col card p-6 rounded-lg shadow w-full" style={{ borderColor: theme.border }}>
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
                  value={labelWidth}
                  onChange={(e) => updateLabelData({ labelWidth: Number(e.target.value) })}
                  className="w-full px-3 py-2 focus:outline-none"
                  style={{
                    color: theme.text,
                    backgroundColor: "white",
                  }}
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                  mm
                </span>
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
                  value={labelHeight}
                  onChange={(e) => updateLabelData({ labelHeight: Number(e.target.value) })}
                  className="w-full px-3 py-2 focus:outline-none"
                  style={{
                    color: theme.text,
                    backgroundColor: "white",
                  }}
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                  mm
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-grow">
        <PDFViewer width="100%" height="600px" showToolbar={true}>
          <Document>
            <Page size={[mmToPt(labelWidth), mmToPt(labelHeight)]} style={pageStyle}>
              <View style={{ margin: mmToPt(5) }}>
                {/* 渲染第一段（带罗马序号） */}
                {processedFirstParagraph.map((groupLines, groupIndex) => (
                  <View key={`first-${groupIndex}`} style={styles.contentRow}>
                    {groupLines.map((line, lineIndex) => (
                      <Text key={`first-line-${lineIndex}`} style={styles.contentItem}>
                        {line}
                      </Text>
                    ))}
                  </View>
                ))}
                
                {/* 渲染第二段（分组但不带序号，带下划线） */}
                {processedSecondParagraph.length > 0 && (
                  <View style={{ marginTop: mmToPt(2) }}>
                    {processedSecondParagraph.map((lines, groupIndex) => (
                      <View key={`second-${groupIndex}`} style={styles.contentRow}>
                        {lines.map((line, lineIndex) => (
                          <Text key={`line-${lineIndex}`} style={styles.contentItem}>
                            {line}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
                
                {/* 渲染第三段及之后的段落 */}
                {processedRemainingParagraphs.map((paragraph, paraIndex) => (
                  <View key={`para-${paraIndex}`} style={{ marginTop: mmToPt(2) }}>
                    {paragraph.map((group, groupIndex) => (
                      <View key={`group-${groupIndex}`} style={styles.remainingContentRow}>
                        {group.map((line, lineIndex) => (
                          <Text key={`line-${lineIndex}`} style={styles.remainingContentItem}>
                            {line}
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
    </div>
  );
} 