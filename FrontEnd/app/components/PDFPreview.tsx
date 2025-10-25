"use client"

import { useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import dynamic from 'next/dynamic'
import { SmartMixedFontText } from './SmartMixedFontText'

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
import { savePdfFile } from '../../lib/projectApi'

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

// ============================================
// 新的6字段独立处理函数（简单排列方式）
// ============================================

// 处理单个字段的文本内容，返回行数组
const processFieldContent = (fieldContent: string): string[] => {
  if (!fieldContent || fieldContent.trim() === '') {
    return [];
  }
  
  // 按换行符分割，过滤空行
  return fieldContent
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => line.trim());
};

// 处理6个字段，返回字段数据结构
interface FieldData {
  fieldName: string;
  lines: string[];
}

const processSixFields = (
  basicInfo: string,
  numberField: string,
  drugName: string,
  numberOfSheets: string,
  drugDescription: string,
  companyName: string
): FieldData[] => {
  const fields: FieldData[] = [];
  
  // 按顺序处理6个字段
  const fieldContents = [
    { fieldName: 'basicInfo', content: basicInfo },
    { fieldName: 'numberField', content: numberField },
    { fieldName: 'drugName', content: drugName },
    { fieldName: 'numberOfSheets', content: numberOfSheets },
    { fieldName: 'drugDescription', content: drugDescription },
    { fieldName: 'companyName', content: companyName }
  ];
  
  // 处理每个字段，只保留有内容的字段
  fieldContents.forEach(({ fieldName, content }) => {
    const lines = processFieldContent(content);
    if (lines.length > 0) {
      fields.push({ fieldName, lines });
    }
  });
  
  return fields;
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
  // ===== 所有状态声明必须在最前面 =====
  const [isClient, setIsClient] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSaveRequest, setPdfSaveRequest] = useState<{projectId: number; countryCode: string; sequenceNumber: string} | null>(null);

  // ===== Context hooks =====
  const { labelData, updateLabelData } = useLabelContext()
  const { labelWidth, labelHeight, drugInfo, selectedLanguage, fontSize, fontFamily, secondaryFontFamily, spacing, lineHeight, selectedNumber, labelCategory, baseSheet, adhesiveArea, wasteArea, codingArea, selectedProject, basicInfo, numberField, drugName, numberOfSheets, drugDescription, companyName, textAlign } = labelData

  const themeContext = useContext(ThemeContext)
  if (!themeContext) throw new Error("Theme context must be used within ThemeContext.Provider")
  const { theme } = themeContext
  
  // ===== 所有useEffect必须在条件判断之前 =====
  // 初始化客户端渲染
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 监听保存标签事件，自动生成并保存PDF
  useEffect(() => {
    if (!isClient) return;
    
    const handleGenerateAndSavePdf = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { projectId, countryCode, sequenceNumber } = customEvent.detail;
      setPdfSaveRequest({ projectId, countryCode, sequenceNumber });
    };

    window.addEventListener('generate-and-save-pdf', handleGenerateAndSavePdf);
    return () => {
      window.removeEventListener('generate-and-save-pdf', handleGenerateAndSavePdf);
    };
  }, [isClient]);

  // 使用ref来存储PDF生成函数，避免在useEffect中访问未定义的变量
  const pdfGeneratorRef = useRef<((projectId: number, countryCode: string, sequenceNumber: string) => Promise<void>) | null>(null);

  // 当有PDF保存请求时，执行实际的PDF生成
  useEffect(() => {
    if (!pdfSaveRequest || !isClient || !pdfGeneratorRef.current) return;

    const { projectId, countryCode, sequenceNumber } = pdfSaveRequest;
    
    const executePdfSave = async () => {
      try {
        setIsGeneratingPdf(true);
        await pdfGeneratorRef.current!(projectId, countryCode, sequenceNumber);
      } catch (error) {
      } finally {
        setIsGeneratingPdf(false);
        setPdfSaveRequest(null);
      }
    };

    executePdfSave();
  }, [pdfSaveRequest, isClient]);

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

  // 检查是否为从右到左的语言
  const isRTL = () => {
    if (!selectedLanguage) return false;
    const rtlKeywords = ['Arabic', 'Hebrew', 'Persian', 'Farsi', 'Urdu', 'Punjabi', 'Somali'];
    return rtlKeywords.some(keyword => selectedLanguage.includes(keyword));
  };

  // 创建动态内容样式
  const contentStyle = {
    ...styles.content,
    fontSize: mmToPt(fontSize),
    fontFamily: fontFamily,
    lineHeight: lineHeight,
    textAlign: (textAlign as 'left' | 'right' | 'center' | 'justify') || 'left',  // 使用用户设置的对齐方式
    direction: textAlign === 'right' ? 'rtl' : 'ltr',  // 右对齐时使用rtl方向
  };

  // // ============================================
  // // 旧的处理方式：合成为三段落处理（保留作为参考）
  // // ============================================
  // const combinedContent = [
  //   basicInfo,
  //   numberField,
  //   drugName,
  //   numberOfSheets,
  //   drugDescription,
  //   companyName
  // ].filter(content => content && content.trim() !== '').join('\n\n\n');
  
  // // 处理文本（旧方式）
  // const paragraphs = splitIntoParagraphs(combinedContent);
  // const processedFirstParagraph = paragraphs.length > 0 ? processFirstParagraph(paragraphs[0]) : [];
  // const processedSecondParagraph = paragraphs.length > 1 ? processOtherParagraph(paragraphs[1]) : [];
  // const processedRemainingParagraphs = paragraphs.slice(2).map(para => processRemainingParagraphs(para));

  // ============================================
  // 新的处理方式：6个字段独立处理，简单排列
  // ============================================
  const processedFields = processSixFields(
    basicInfo,
    numberField,
    drugName,
    numberOfSheets,
    drugDescription,
    companyName
  );

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
  // 新的简单样式：用于6个字段独立显示
  fieldContainer: {
    marginBottom: mmToPt(spacing),
    width: '100%',
    paddingHorizontal: mmToPt(2), // 添加左右内边距，形成文本域效果
  },
  lineContainer: {
    marginBottom: mmToPt(spacing * 0.5),
    flexDirection: 'row',
    flexWrap: 'wrap',
    direction: textAlign === 'right' ? 'rtl' : 'ltr',
    justifyContent: textAlign === 'right' ? 'flex-end' : 'flex-start',
  },
  fieldLine: {
    fontSize: fontSize, // fontSize已经是pt单位，不需要再转换
    lineHeight: lineHeight,
    textAlign: (textAlign as 'left' | 'right' | 'center' | 'justify') || 'left',
  },
    firstParagraphRow: {
      ...styles.firstParagraphRow,
      marginBottom: mmToPt(spacing),
      direction: textAlign === 'right' ? 'rtl' : 'ltr',
      justifyContent: textAlign === 'right' ? 'flex-end' : 'flex-start',
    },
    firstParagraphItem: {
      ...styles.firstParagraphItem,
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      textAlign: (textAlign as 'left' | 'right' | 'center' | 'justify') || 'left',
      direction: textAlign === 'right' ? 'rtl' : 'ltr',
    },
    secondParagraphRow: {
      ...styles.secondParagraphRow,
      marginBottom: mmToPt(spacing),
      direction: textAlign === 'right' ? 'rtl' : 'ltr',
      justifyContent: textAlign === 'right' ? 'flex-end' : 'flex-start',
    },
    secondParagraphItem: {
      ...styles.secondParagraphItem,
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      textAlign: (textAlign as 'left' | 'right' | 'center' | 'justify') || 'left',
      direction: textAlign === 'right' ? 'rtl' : 'ltr',
    },
    underline: {
      ...styles.underline,
      // 计算下划线位置：先将字体大小转换为点，再计算行间距
      bottom: mmToPt(fontSize) * (lineHeight - 1)/2-1,
    },
    remainingContentRow: {
      ...styles.remainingContentRow,
      marginBottom: mmToPt(spacing),  // 在动态样式中使用 spacing 参数
      direction: textAlign === 'right' ? 'rtl' : 'ltr',
      justifyContent: textAlign === 'right' ? 'flex-end' : 'flex-start',
    },
    remainingContentItem: {
      ...styles.remainingContentItem,
      fontFamily: fontFamily,
      fontSize: fontSize,
      lineHeight: lineHeight,
      marginBottom: 0,
      textAlign: (textAlign as 'left' | 'right' | 'center' | 'justify') || 'left',
      direction: textAlign === 'right' ? 'rtl' : 'ltr',
    },
  });

  // 处理文本，分离中文和非中文字符
  const processText = (text: string) => {
    // 如果是阿拉伯语或其他RTL语言，不进行混合字体处理
    if (selectedLanguage === 'AE') {
      return <Text>{text}</Text>;
    }
    
    // 使用SmartMixedFontText自动处理混合字体
    return (
      <SmartMixedFontText
        primaryFont={fontFamily}
        secondaryFont={secondaryFontFamily}
      >
        {text}
      </SmartMixedFontText>
    );
  };

  // ============================================
  // 布局渲染函数系统
  // ============================================
  
  // 1. 阶梯标布局（原有逻辑）
  const renderStepLayout = () => {
    return (
      <>
        {processedFields.map((field, fieldIndex) => (
          <View key={`field-${fieldIndex}`} style={dynamicStyles.fieldContainer}>
            {field.lines.map((line, lineIndex) => (
              <View key={`line-${lineIndex}`} style={dynamicStyles.lineContainer}>
                <SmartMixedFontText
                  primaryFont={fontFamily}
                  secondaryFont={labelData.secondaryFontFamily}
                  style={dynamicStyles.fieldLine}
                >
                  {line}
                </SmartMixedFontText>
              </View>
            ))}
          </View>
        ))}
      </>
    );
  };

  // 2. 单页左右1布局
  const renderLeftRight1Layout = () => {
    return (
      <View style={{
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: mmToPt(fontSize * 2),
          fontFamily: fontFamily,
          color: '#30B8D6',
          fontWeight: 'bold',
        }}>
          单页左右1
        </Text>
      </View>
    );
  };

  // 3. 单页左右2布局
  const renderLeftRight2Layout = () => {
    return (
      <View style={{
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: mmToPt(fontSize * 2),
          fontFamily: fontFamily,
          color: '#10B981',
          fontWeight: 'bold',
        }}>
          单页左右2
        </Text>
      </View>
    );
  };

  // 4. 单页上下1布局
  const renderTopBottom1Layout = () => {
    return (
      <View style={{
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: mmToPt(fontSize * 2),
          fontFamily: fontFamily,
          color: '#F59E0B',
          fontWeight: 'bold',
        }}>
          单页上下1
        </Text>
      </View>
    );
  };

  // 5. 单页上下2布局
  const renderTopBottom2Layout = () => {
    return (
      <View style={{
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: mmToPt(fontSize * 2),
          fontFamily: fontFamily,
          color: '#EF4444',
          fontWeight: 'bold',
        }}>
          单页上下2
        </Text>
      </View>
    );
  };

  // 根据标签分类选择布局渲染函数
  const renderContentByCategory = () => {
    switch (labelCategory) {
      case '阶梯标':
        return renderStepLayout();
      case '单页左右1':
        return renderLeftRight1Layout();
      case '单页左右2':
        return renderLeftRight2Layout();
      case '单页上下1':
        return renderTopBottom1Layout();
      case '单页上下2':
        return renderTopBottom2Layout();
      default:
        return renderStepLayout();
    }
  };

  // 兼容旧代码：保留renderSixFields函数名
  const renderSixFields = renderContentByCategory;

  // 渲染序号
  const renderSequenceNumber = () => {
    if (!labelData.showSequenceNumber) return null;

    let sequenceText;
    
    // 判断是否使用自定义序号内容
    if (labelData.customSequenceText) {
      // 使用自定义序号内容
      sequenceText = labelData.customSequenceText;
    } else {
      // 使用自动序号（原有逻辑）
      const sequenceNum = selectedNumber || '1';
      
      // 将数字转换为带圆圈的数字（使用 Unicode 字符）
      // ① = U+2460 (1), ② = U+2461 (2), ... ⑳ = U+2473 (20)
      const getCircledNumber = (num: string) => {
        const n = parseInt(num);
        if (n >= 1 && n <= 20) {
          // Unicode 字符：①-⑳ (U+2460 到 U+2473)
          return String.fromCharCode(0x245F + n);
        }
        // 如果超过20，返回原数字加括号
        return `(${num})`;
      };
      
      sequenceText = getCircledNumber(sequenceNum);
    }
    
    // 计算序号位置
    let left = mmToPt(margins.left);
    const bottom = mmToPt(margins.bottom + labelData.sequenceOffsetY);
    const width = mmToPt(currentWidth - margins.left - margins.right);
    
    // 根据对齐方式调整位置
    let textAlign: 'left' | 'center' | 'right' = 'left';
    if (labelData.sequencePosition === 'center') {
      textAlign = 'center';
    } else if (labelData.sequencePosition === 'right') {
      textAlign = 'right';
    }

    return (
      <View style={{
        position: 'absolute',
        bottom: bottom,
        left: left + mmToPt(labelData.sequenceOffsetX),
        width: width,
        flexDirection: 'row',
        justifyContent: labelData.sequencePosition === 'center' ? 'center' : (labelData.sequencePosition === 'right' ? 'flex-end' : 'flex-start'),
      }}>
        <Text style={{
          fontSize: labelData.sequenceFontSize,  // 使用用户设置的字体大小
          fontFamily: 'Arial Unicode',  // 使用 Arial Unicode MS 以支持圆圈数字
          textAlign: textAlign,
          transform: `rotate(${labelData.sequenceRotation || 0}deg)`,  // 将旋转应用到Text组件本身
          transformOrigin: 'center',  // 以文本中心为旋转中心
        }}>
          {sequenceText}
        </Text>
      </View>
    );
  };

  // 导出PDF功能
  // 生成并保存PDF到服务器
  const generateAndSavePdfToServer = async (projectId: number, countryCode: string, sequenceNumber: string) => {
    const blob = await pdf(
      <Document>
        <Page size={[mmToPt(currentWidth), mmToPt(labelHeight)]} style={pageStyle}>
          {/* 边距矩形框 */}
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
            justifyContent: 'center',  // 垂直居中
          }}>
            <View style={{ width: '100%' }}>
              {/* 使用新的简单排列方式渲染6个字段 */}
              {renderSixFields()}
            </View>
          </View>
          
          {/* 渲染序号 */}
          {renderSequenceNumber()}
        </Page>
      </Document>
    ).toBlob();

    // 生成文件名（清理非法字符）
    const jobName = selectedProject?.job_name || 'label';
    const sanitizedJobName = jobName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]/g, '_');
    const sanitizedCountryCode = countryCode.replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]/g, '_');
    const fileName = `${sanitizedJobName}-${sanitizedCountryCode}-${sequenceNumber}.pdf`;

    // 保存到服务器
    await savePdfFile(projectId, countryCode, blob, fileName);
  };

  // 将PDF生成函数保存到ref中，供useEffect使用
  pdfGeneratorRef.current = generateAndSavePdfToServer;

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
            justifyContent: 'center',  // 垂直居中
          }}>
            <View style={{ width: '100%' }}>
              {/* 使用新的简单排列方式渲染6个字段 */}
              {renderSixFields()}
            </View>
          </View>
          
          {/* 渲染序号 */}
          {renderSequenceNumber()}
        </Page>
      </Document>
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // 使用当前项目名称作为文件前缀；若无项目则回退为 label
    const jobName = selectedProject?.job_name || 'label';
    link.download = `${jobName}-${selectedLanguage}-${selectedNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col card rounded-lg shadow w-full" style={{ borderColor: theme.border }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold flex items-center" style={{ color: theme.primary }}>
          <Eye className="mr-2" size={24} />
          标签预览
        </h2>
        <button
          className="px-3 py-1 rounded-md text-sm flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: '#10B981',
            color: 'white',
          }}
          onClick={handleExportPDF}
        >
          <FileDown className="mr-1" size={14} />
          导出PDF
        </button>
      </div>
      <div className="mb-4 space-y-1">
        {/* 标签分类 */}
        <div className="flex">
          <div className="flex-1">
            <div className="flex items-center rounded-md">
              <label className="text-sm font-medium px-2 py-0.5 min-w-[100px]" style={{ color: theme.text }}>
                标签分类：
              </label>
              <div className="flex-1">
                <select
                  value={labelCategory}
                  onChange={(e) => updateLabelData({ labelCategory: e.target.value })}
                  className="w-full px-2 py-0.5 text-sm focus:outline-none appearance-none bg-white border-b border-gray-300"
                  style={{ color: theme.text }}
                >
                  <option value="阶梯标">阶梯标</option>
                  <option value="单页左右1">单页左右1</option>
                  <option value="单页左右2">单页左右2</option>
                  <option value="单页上下1">单页上下1</option>
                  <option value="单页上下2">单页上下2</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        {/* 宽度和高度（外观与其它区域一致：无蓝色外框） */}
        <div className="flex space-x-3">
          <div className="flex-1">
            <div className="flex items-center">
              <label className="text-sm font-medium px-2 py-0.5 min-w-[100px]" style={{ color: theme.text }}>
                标签宽度：
              </label>
              <div className="flex-1">
                <input
                  type="number"
                  value={labelWidth}
                  placeholder="最小值: 40mm"
                  onChange={(e) => updateLabelData({ labelWidth: Number(e.target.value) || 100 })}
                  onKeyDown={(e) => handleDimensionInput(e, 'width')}
                  className="w-full px-2 py-0.5 text-sm focus:outline-none border-b border-gray-300"
                  style={{
                    color: theme.text,
                    backgroundColor: "white",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center">
              <label className="text-sm font-medium px-2 py-0.5 min-w-[100px]" style={{ color: theme.text }}>
                标签高度：
              </label>
              <div className="flex-1">
                <input
                  type="number"
                  value={labelHeight}
                  placeholder="最小值: 40mm"
                  onChange={(e) => updateLabelData({ labelHeight: Number(e.target.value) || 60 })}
                  onKeyDown={(e) => handleDimensionInput(e, 'height')}
                  className="w-full px-2 py-0.5 text-sm focus:outline-none border-b border-gray-300"
                  style={{
                    color: theme.text,
                    backgroundColor: "white",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        {/* 页面尺寸 */}
        <div className="flex space-x-3">
          <div className="flex-1">
            <div className="flex items-center">
              <label className="text-sm font-medium px-2 py-0.5 min-w-[100px]" style={{ color: theme.text }}>
                页面尺寸：
              </label>
              <div className="flex items-center gap-2 px-2 py-0.5">
                <input
                  type="text"
                  value={currentWidth.toFixed(1)}
                  readOnly
                  className="w-16 px-1.5 py-0.5 focus:outline-none text-sm text-center border-b border-gray-300"
                  style={{ color: theme.text }}
                />
                <span className="text-sm" style={{ color: theme.text }}>×</span>
                <input
                  type="text"
                  value={labelHeight}
                  readOnly
                  className="w-16 px-1.5 py-0.5 focus:outline-none text-sm text-center border-b border-gray-300"
                  style={{ color: theme.text }}
                />
              </div>
            </div>
          </div>
        </div>
        {/* 底页/粘胶区/排废区/打码区（四等分，紧凑单行） */}
        <div className="flex space-x-3">
          <div className="flex-1">
            <div className="flex items-center">
              <div className="flex items-center px-2 py-0.5 whitespace-nowrap w-full justify-between">
                <div className="flex items-center whitespace-nowrap">
                  <span className="text-sm font-medium" style={{ color: theme.text }}>底页：</span>
                  <input
                    type="number"
                    value={baseSheet}
                    onChange={(e) => updateLabelData({ baseSheet: Number(e.target.value) })}
                    className="w-12 px-1 py-0.5 focus:outline-none text-sm text-center border-b border-gray-300 ml-1"
                    style={{
                      color: theme.text,
                      backgroundColor: "white",
                    }}
                  />
                </div>
                <div className="flex items-center whitespace-nowrap">
                  <span className="text-sm font-medium" style={{ color: theme.text }}>粘胶区：</span>
                  <input
                    type="number"
                    value={adhesiveArea}
                    onChange={(e) => updateLabelData({ adhesiveArea: Number(e.target.value) })}
                    className="w-12 px-1 py-0.5 focus:outline-none text-sm text-center border-b border-gray-300 ml-1"
                    style={{
                      color: theme.text,
                      backgroundColor: "white",
                    }}
                  />
                </div>
                <div className="flex items-center whitespace-nowrap">
                  <span className="text-sm font-medium" style={{ color: theme.text }}>排废区：</span>
                  <input
                    type="number"
                    value={wasteArea}
                    onChange={(e) => updateLabelData({ wasteArea: Number(e.target.value) })}
                    className="w-12 px-1 py-0.5 focus:outline-none text-sm text-center border-b border-gray-300 ml-1"
                    style={{
                      color: theme.text,
                      backgroundColor: "white",
                    }}
                  />
                </div>
                <div className="flex items-center whitespace-nowrap">
                  <span className="text-sm font-medium" style={{ color: theme.text }}>打码区：</span>
                  <input
                    type="number"
                    value={codingArea}
                    onChange={(e) => updateLabelData({ codingArea: Number(e.target.value) })}
                    className="w-12 px-1 py-0.5 focus:outline-none text-sm text-center border-b border-gray-300 ml-1"
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
        {/* 页面边距 */}
        <div className="flex space-x-3">
          <div className="flex-1">
            <div className="flex items-center">
              <label className="text-sm font-medium px-2 py-0.5 min-w-[100px]" style={{ color: theme.text }}>
                页面边距：
              </label>
              <div className="flex items-center gap-2 px-2 py-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-sm" style={{ color: theme.text }}>上</span>
                  <input type="text" value={margins.top} readOnly className="w-14 px-1.5 py-0.5 focus:outline-none text-sm text-center border-b border-gray-300" style={{ color: theme.text }} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm" style={{ color: theme.text }}>下</span>
                  <input type="text" value={margins.bottom} readOnly className="w-14 px-1.5 py-0.5 focus:outline-none text-sm text-center border-b border-gray-300" style={{ color: theme.text }} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm" style={{ color: theme.text }}>左</span>
                  <input type="text" value={margins.left} readOnly className="w-14 px-1.5 py-0.5 focus:outline-none text-sm text-center border-b border-gray-300" style={{ color: theme.text }} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm" style={{ color: theme.text }}>右</span>
                  <input type="text" value={margins.right} readOnly className="w-14 px-1.5 py-0.5 focus:outline-none text-sm text-center border-b border-gray-300" style={{ color: theme.text }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 序号设置 */}
        <div className="flex space-x-3">
          <div className="flex-1">
            <div className="flex items-center">
              <div className="flex items-center gap-2 px-2 py-0.5">
                {/* 是否显示序号 */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={labelData.showSequenceNumber}
                    onChange={(e) => updateLabelData({ showSequenceNumber: e.target.checked })}
                    className="w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-sm whitespace-nowrap" style={{ color: theme.text }}>序号</span>
                </div>
                
                {/* 自定义序号内容 */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={labelData.customSequenceText || ''}
                    onChange={(e) => updateLabelData({ customSequenceText: e.target.value })}
                    disabled={!labelData.showSequenceNumber}
                    placeholder="自定义"
                    className="w-16 px-1.5 py-0.5 focus:outline-none text-sm border-b border-gray-300"
                    style={{ color: theme.text }}
                  />
                </div>

                {/* 序号位置 */}
                <div className="flex items-center gap-0.5 border rounded px-1 py-0.5" style={{ borderColor: theme.border }}>
                  {/* 左对齐 */}
                  <div className="relative group">
                    <button
                      onClick={() => updateLabelData({ sequencePosition: 'left' })}
                      className={`flex items-center justify-center p-0.5 rounded transition-colors ${
                        labelData.sequencePosition === 'left' 
                          ? 'bg-[#30B8D6]' 
                          : 'bg-gray-200'
                      }`}
                      disabled={!labelData.showSequenceNumber}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: labelData.sequencePosition === 'left' ? 'white' : 'rgba(0, 0, 0, 0.7)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8M4 18h16" />
                      </svg>
                    </button>
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      左对齐
                    </div>
                  </div>

                  {/* 居中对齐 */}
                  <div className="relative group">
                    <button
                      onClick={() => updateLabelData({ sequencePosition: 'center' })}
                      className={`flex items-center justify-center p-0.5 rounded transition-colors ${
                        labelData.sequencePosition === 'center' 
                          ? 'bg-[#30B8D6]' 
                          : 'bg-gray-200'
                      }`}
                      disabled={!labelData.showSequenceNumber}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: labelData.sequencePosition === 'center' ? 'white' : 'rgba(0, 0, 0, 0.7)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M8 12h8M4 18h16" />
                      </svg>
                    </button>
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      居中对齐
                    </div>
                  </div>

                  {/* 右对齐 */}
                  <div className="relative group">
                    <button
                      onClick={() => updateLabelData({ sequencePosition: 'right' })}
                      className={`flex items-center justify-center p-0.5 rounded transition-colors ${
                        labelData.sequencePosition === 'right' 
                          ? 'bg-[#30B8D6]' 
                          : 'bg-gray-200'
                      }`}
                      disabled={!labelData.showSequenceNumber}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: labelData.sequencePosition === 'right' ? 'white' : 'rgba(0, 0, 0, 0.7)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M12 12h8M4 18h16" />
                      </svg>
                    </button>
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      右对齐
                    </div>
                  </div>
                </div>

                {/* 旋转控制 */}
                <div className="flex items-center gap-0.5 border rounded px-1 py-0.5" style={{ borderColor: theme.border }}>
                  {/* 逆时针旋转 */}
                  <div className="relative group">
                    <button
                      onClick={() => updateLabelData({ sequenceRotation: (labelData.sequenceRotation - 90) % 360 })}
                      className={`flex items-center justify-center p-0.5 rounded transition-colors ${
                        labelData.showSequenceNumber ? 'bg-gray-200 hover:bg-[#30B8D6]' : 'bg-gray-200'
                      }`}
                      disabled={!labelData.showSequenceNumber}
                    >
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 512 512" style={{ color: labelData.showSequenceNumber ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)' }}>
                        <path d="M125.7 160H176c17.7 0 32 14.3 32 32s-14.3 32-32 32H48c-17.7 0-32-14.3-32-32V64c0-17.7 14.3-32 32-32s32 14.3 32 32v51.2L97.6 97.6c87.5-87.5 229.3-87.5 316.8 0s87.5 229.3 0 316.8s-229.3 87.5-316.8 0c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0c62.5 62.5 163.8 62.5 226.3 0s62.5-163.8 0-226.3s-163.8-62.5-226.3 0L125.7 160z"/>
                      </svg>
                    </button>
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      逆时针旋转90°
                    </div>
                  </div>
                  
                  {/* 旋转角度输入 */}
                  <input
                    type="text"
                    value={labelData.sequenceRotation || 0}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9-]/g, '');
                      updateLabelData({ sequenceRotation: value === '' ? 0 : Number(value) });
                    }}
                    disabled={!labelData.showSequenceNumber}
                    className="w-14 px-1.5 py-0 focus:outline-none text-xs text-center border-none"
                    style={{ 
                      color: theme.text,
                      backgroundColor: 'transparent'
                    }}
                  />
                  
                  {/* 顺时针旋转 */}
                  <div className="relative group">
                    <button
                      onClick={() => updateLabelData({ sequenceRotation: (labelData.sequenceRotation + 90) % 360 })}
                      className={`flex items-center justify-center p-0.5 rounded transition-colors ${
                        labelData.showSequenceNumber ? 'bg-gray-200 hover:bg-[#30B8D6]' : 'bg-gray-200'
                      }`}
                      disabled={!labelData.showSequenceNumber}
                    >
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 512 512" style={{ color: labelData.showSequenceNumber ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)' }}>
                        <path d="M386.3 160H336c-17.7 0-32 14.3-32 32s14.3 32 32 32H464c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32s-32 14.3-32 32v51.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0s-87.5 229.3 0 316.8s229.3 87.5 316.8 0c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0c-62.5 62.5-163.8 62.5-226.3 0s-62.5-163.8 0-226.3s163.8-62.5 226.3 0L386.3 160z"/>
                      </svg>
                    </button>
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      顺时针旋转90°
                    </div>
                  </div>
                </div>

                {/* 字符大小和位置偏移 */}
                <div className="flex items-center gap-1">
                  {/* 字符大小 - T 图标 */}
                  <div className="relative group flex items-center gap-0.5">
                    <span className="text-xs" style={{ fontSize: '12px', color: theme.text }}>T</span>
                    <input
                      type="number"
                      value={labelData.sequenceFontSize}
                      onChange={(e) => updateLabelData({ sequenceFontSize: Number(e.target.value) })}
                      disabled={!labelData.showSequenceNumber}
                      className="w-10 px-1 py-0.5 focus:outline-none text-xs text-center border-b border-gray-300"
                      style={{ color: theme.text }}
                      step="0.5"
                      min="1"
                      max="20"
                    />
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      字符大小
                    </div>
                  </div>
                  
                  {/* 水平位移 - x 图标 */}
                  <div className="relative group flex items-center gap-0.5">
                    <span className="text-xs" style={{ fontSize: '12px', color: theme.text }}>x</span>
                    <input
                      type="number"
                      value={labelData.sequenceOffsetX}
                      onChange={(e) => updateLabelData({ sequenceOffsetX: Number(e.target.value) })}
                      disabled={!labelData.showSequenceNumber}
                      className="w-10 px-1 py-0.5 focus:outline-none text-xs text-center border-b border-gray-300"
                      style={{ color: theme.text }}
                      step="0.5"
                    />
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      水平位移
                    </div>
                  </div>
                  
                  {/* 垂直位移 - y 图标 */}
                  <div className="relative group flex items-center gap-0.5">
                    <span className="text-xs" style={{ fontSize: '12px', color: theme.text }}>y</span>
                    <input
                      type="number"
                      value={labelData.sequenceOffsetY}
                      onChange={(e) => updateLabelData({ sequenceOffsetY: Number(e.target.value) })}
                      disabled={!labelData.showSequenceNumber}
                      className="w-10 px-1 py-0.5 focus:outline-none text-xs text-center border-b border-gray-300"
                      style={{ color: theme.text }}
                      step="0.5"
                    />
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      垂直位移
                    </div>
                  </div>
                </div>
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
                justifyContent: 'center',  // 垂直居中
              }}>
                <View style={{ width: '100%' }}>
                  {/* 使用新的简单排列方式渲染6个字段 */}
                  {renderSixFields()}
                </View>
              </View>
              
              {/* 渲染序号 */}
              {renderSequenceNumber()}
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

      {/* 操作按钮容器已上移到预览区域右侧 */}
    </div>
  );
} 