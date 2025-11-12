/**
 * SmartMixedFontText - React PDF智能混合字体文本组件
 * 
 * 功能：自动检测文本中的字符类型，并应用相应的字体
 * - 主语言字体：用于中文、日文、韩文等CJK字符
 * - 次语言字体：用于英文、数字等拉丁字符
 * 
 * 优势：
 * 1. 自动化：无需手动分段，自动识别字符类型
 * 2. 减少对象：尽可能合并相同类型的连续字符
 * 3. 灵活性：支持任意语言组合
 */

import React from 'react';
import { Text, StyleSheet } from '@react-pdf/renderer';

/**
 * 字符类型枚举
 */
type CharacterType = 'primary' | 'secondary' | 'punctuation';

/**
 * 文本片段接口
 */
interface TextSegment {
  text: string;
  type: CharacterType;
}

/**
 * 检测字符类型
 */
const detectCharacterType = (char: string): CharacterType => {
  const code = char.charCodeAt(0);
  
  // CJK字符（中文、日文、韩文）- 使用主语言字体
  if (
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK统一汉字
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK扩展A
    (code >= 0x20000 && code <= 0x2A6DF) || // CJK扩展B
    (code >= 0x2A700 && code <= 0x2B73F) || // CJK扩展C
    (code >= 0x2B740 && code <= 0x2B81F) || // CJK扩展D
    (code >= 0x2B820 && code <= 0x2CEAF) || // CJK扩展E
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK兼容汉字
    (code >= 0x2F800 && code <= 0x2FA1F) || // CJK兼容补充
    // 日文平假名和片假名
    (code >= 0x3040 && code <= 0x309F) ||   // 平假名
    (code >= 0x30A0 && code <= 0x30FF) ||   // 片假名
    (code >= 0x31F0 && code <= 0x31FF) ||   // 片假名扩展
    // 韩文
    (code >= 0xAC00 && code <= 0xD7AF) ||   // 韩文音节
    (code >= 0x1100 && code <= 0x11FF) ||   // 韩文字母
    (code >= 0x3130 && code <= 0x318F) ||   // 韩文兼容字母
    (code >= 0xA960 && code <= 0xA97F) ||   // 韩文字母扩展A
    (code >= 0xD7B0 && code <= 0xD7FF)      // 韩文字母扩展B
  ) {
    return 'primary';
  }
  
  // 泰文字符 - 使用主语言字体
  if (
    (code >= 0x0E00 && code <= 0x0E7F) ||   // 泰文字符
    (code >= 0x0E80 && code <= 0x0EFF)      // 泰文扩展
  ) {
    //console.log('🔤 检测到泰文字符:', char, 'Unicode:', code.toString(16));
    return 'primary';
  }
  
  // 越南文字符 - 使用主语言字体
  if (
    (code >= 0x1EA0 && code <= 0x1EF9) ||   // 越南文扩展
    (code >= 0x0102 && code <= 0x0103) ||   // Ă, ă
    (code >= 0x00C0 && code <= 0x00C3) ||   // À, Á, Â, Ã
    (code >= 0x00E0 && code <= 0x00E3) ||   // à, á, â, ã
    (code >= 0x00C8 && code <= 0x00CB) ||   // È, É, Ê, Ë
    (code >= 0x00E8 && code <= 0x00EB) ||   // è, é, ê, ë
    (code >= 0x00CC && code <= 0x00CF) ||   // Ì, Í, Î, Ï
    (code >= 0x00EC && code <= 0x00EF) ||   // ì, í, î, ï
    (code >= 0x00D2 && code <= 0x00D5) ||   // Ò, Ó, Ô, Õ
    (code >= 0x00F2 && code <= 0x00F5) ||   // ò, ó, ô, õ
    (code >= 0x00D9 && code <= 0x00DC) ||   // Ù, Ú, Û, Ü
    (code >= 0x00F9 && code <= 0x00FC) ||   // ù, ú, û, ü
    (code >= 0x00DD && code <= 0x00DD) ||   // Ý
    (code >= 0x00FD && code <= 0x00FD)       // ý
  ) {
    //console.log('🔤 检测到越南文字符:', char, 'Unicode:', code.toString(16));
    return 'primary';
  }
  
  // 印地语字符 - 使用主语言字体
  if (
    (code >= 0x0900 && code <= 0x097F) ||   // 梵文字符
    (code >= 0x0980 && code <= 0x09FF) ||   // 孟加拉文字符
    (code >= 0x0A00 && code <= 0x0A7F) ||   // 古木基文字符
    (code >= 0x0A80 && code <= 0x0AFF) ||   // 古吉拉特文字符
    (code >= 0x0B00 && code <= 0x0B7F) ||   // 奥里亚文字符
    (code >= 0x0B80 && code <= 0x0BFF) ||   // 泰米尔文字符
    (code >= 0x0C00 && code <= 0x0C7F) ||   // 泰卢固文字符
    (code >= 0x0C80 && code <= 0x0CFF) ||   // 卡纳达文字符
    (code >= 0x0D00 && code <= 0x0D7F) ||   // 马拉雅拉姆文字符
    (code >= 0x0D80 && code <= 0x0DFF)      // 僧伽罗文字符
  ) {
    //console.log('🔤 检测到印度语系字符:', char, 'Unicode:', code.toString(16));
    return 'primary';
  }
  
  // 阿拉伯语字符 - 使用主语言字体
  if (
    (code >= 0x0600 && code <= 0x06FF) ||   // 阿拉伯文字符
    (code >= 0x0750 && code <= 0x077F) ||   // 阿拉伯文补充
    (code >= 0x08A0 && code <= 0x08FF) ||   // 阿拉伯文扩展A
    (code >= 0xFB50 && code <= 0xFDFF) ||   // 阿拉伯文表现形式A
    (code >= 0xFE70 && code <= 0xFEFF)      // 阿拉伯文表现形式B
  ) {
    //console.log('🔤 检测到阿拉伯文字符:', char, 'Unicode:', code.toString(16));
    return 'primary';
  }
  
  // 希伯来语字符 - 使用主语言字体
  if (
    (code >= 0x0590 && code <= 0x05FF) ||   // 希伯来文字符
    (code >= 0xFB1D && code <= 0xFB4F)      // 希伯来文字母表现形式
  ) {
    //console.log('🔤 检测到希伯来文字符:', char, 'Unicode:', code.toString(16));
    return 'primary';
  }
  
  // 格鲁吉亚语字符 - 使用主语言字体
  if (
    (code >= 0x10A0 && code <= 0x10FF) ||   // 格鲁吉亚文字符
    (code >= 0x2D00 && code <= 0x2D2F)      // 格鲁吉亚文补充
  ) {
    //console.log('🔤 检测到格鲁吉亚文字符:', char, 'Unicode:', code.toString(16));
    return 'primary';
  }
  
  // 乌尔都语字符 - 使用主语言字体
  if (
    (code >= 0x0600 && code <= 0x06FF) ||   // 阿拉伯文字符（乌尔都语使用阿拉伯文）
    (code >= 0x0750 && code <= 0x077F) ||   // 阿拉伯文补充
    (code >= 0x08A0 && code <= 0x08FF) ||   // 阿拉伯文扩展A
    (code >= 0xFB50 && code <= 0xFDFF) ||   // 阿拉伯文表现形式A
    (code >= 0xFE70 && code <= 0xFEFF)      // 阿拉伯文表现形式B
  ) {
    //console.log('🔤 检测到乌尔都文字符:', char, 'Unicode:', code.toString(16));
    return 'primary';
  }
  
  // 旁遮普语字符 - 使用主语言字体
  if (
    (code >= 0x0A00 && code <= 0x0A7F) ||   // 古木基文字符（旁遮普语使用古木基文）
    (code >= 0x0A80 && code <= 0x0AFF)      // 古吉拉特文字符
  ) {
    //console.log('🔤 检测到旁遮普文字符:', char, 'Unicode:', code.toString(16));
    return 'primary';
  }
  
  // 拉丁字符（英文、数字）- 使用次语言字体
  if (
    (code >= 65 && code <= 90) ||           // A-Z
    (code >= 97 && code <= 122) ||          // a-z
    (code >= 48 && code <= 57) ||           // 0-9
    (code >= 0x00C0 && code <= 0x00FF) ||   // 拉丁扩展A
    (code >= 0x0100 && code <= 0x017F) ||   // 拉丁扩展B
    (code >= 0x0180 && code <= 0x024F)      // 拉丁扩展C
  ) {
    return 'secondary';
  }
  
  // 标点符号和其他字符 - 使用主语言字体
  return 'punctuation';
};

/**
 * 将文本分段，合并相同类型的连续字符
 */
const segmentText = (text: string): TextSegment[] => {
  if (!text) return [];
  
  const segments: TextSegment[] = [];
  let currentSegment = '';
  let currentType: CharacterType | null = null;
  
  for (const char of text) {
    const charType = detectCharacterType(char);
    
    // 如果类型相同，合并到当前段
    if (charType === currentType) {
      currentSegment += char;
    } else {
      // 类型不同，保存当前段，开启新段
      if (currentSegment) {
        segments.push({
          text: currentSegment,
          type: currentType!
        });
      }
      currentSegment = char;
      currentType = charType;
    }
  }
  
  // 保存最后一段
  if (currentSegment) {
    segments.push({
      text: currentSegment,
      type: currentType!
    });
  }
  
  return segments;
};

/**
 * SmartMixedFontText组件属性
 */
interface SmartMixedFontTextProps {
  children: string;
  primaryFont?: string;    // 主语言字体（默认：STHeiti）
  secondaryFont?: string;  // 次语言字体（默认：Arial）
  style?: any;             // 额外样式
  debug?: boolean;         // 调试模式，显示分段信息
}

/**
 * SmartMixedFontText组件
 */
export const SmartMixedFontText: React.FC<SmartMixedFontTextProps> = ({
  children,
  primaryFont = 'STHeiti',
  secondaryFont = 'Arial',
  style,
  debug = false
}) => {
  // 分段处理文本
  const segments = segmentText(children);
  
  if (debug) {
    //console.log('SmartMixedFontText 分段结果:', segments);
  }
  
  // 渲染分段文本
  return (
    <>
      {segments.map((segment, index) => {
        // 根据类型选择字体
        const fontFamily = segment.type === 'secondary' 
          ? secondaryFont 
          : primaryFont;
        
        return (
          <Text
            key={index}
            style={[
              style,
              { fontFamily }
            ]}
          >
            {segment.text}
          </Text>
        );
      })}
    </>
  );
};

/**
 * 便捷包装组件 - 用于替换现有的processText函数
 */
interface ProcessedTextProps {
  text: string;
  primaryFont?: string;
  secondaryFont?: string;
  style?: any;
}

export const ProcessedText: React.FC<ProcessedTextProps> = ({
  text,
  primaryFont,
  secondaryFont,
  style
}) => {
  return (
    <SmartMixedFontText
      primaryFont={primaryFont}
      secondaryFont={secondaryFont}
      style={style}
    >
      {text}
    </SmartMixedFontText>
  );
};

export default SmartMixedFontText;
