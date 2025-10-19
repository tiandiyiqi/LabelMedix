# PDF 颜色模式和字体嵌入技术总结

## 1. CMYK 颜色模式支持

### 当前状况

- `@react-pdf/renderer` 库主要支持 RGB 颜色模式
- 生成的 PDF 文件默认为 RGB 颜色空间
- 不直接支持 CMYK 颜色模式输出

### 解决方案

#### 方案 A：后端转换（推荐）

```javascript
// 前端继续使用react-pdf生成RGB PDF
const blob = await pdf(<Document>...</Document>);

// 后端使用专业库转换
// Python示例：
// from reportlab.pdfgen import canvas
// from reportlab.lib.colors import CMYKColor
// 或使用Ghostscript进行RGB到CMYK转换
```

#### 方案 B：第三方服务

使用支持 CMYK 的 PDF 生成服务：

- Adobe PDF Services API
- PDFShift
- HTML/CSS to PDF API with CMYK support

#### 方案 C：混合方案

```javascript
// 1. 前端生成RGB PDF
const rgbBlob = await pdf(<Document>...</Document>);

// 2. 发送到后端转换
const formData = new FormData();
formData.append("pdf", rgbBlob);
const cmykResponse = await fetch("/api/convert-to-cmyk", {
  method: "POST",
  body: formData,
});
```

### 实现建议

1. **保持现有 RGB 生成**：继续使用 react-pdf 生成 RGB PDF
2. **后端转换服务**：实现 RGB 到 CMYK 的转换 API
3. **用户选择**：提供 RGB/CMYK 两种输出选项
4. **质量保证**：确保转换后的颜色准确性

## 2. 字体完全嵌入

### 当前字体注册情况

```javascript
// 您当前的字体注册方式
Font.register({
  family: "STHeiti",
  src: "/fonts/STHeiti.ttf",
});

Font.register({
  family: "Arial",
  src: "/fonts/Arial.ttf",
  fonts: [
    { src: "/fonts/Arial.ttf" },
    { src: "/fonts/Arial Bold.ttf", fontWeight: "bold" },
    // ...
  ],
});
```

### 完全嵌入的优化方案

#### 方案 A：增强字体注册

```javascript
Font.register({
  family: "STHeiti",
  src: "/fonts/STHeiti.ttf",
  // 确保字体完全嵌入
  fontStyle: "normal",
  fontWeight: "normal",
});

// 为每个字体变体单独注册
Font.register({
  family: "STHeiti-Bold",
  src: "/fonts/STHeiti-Bold.ttf",
  fontWeight: "bold",
});
```

#### 方案 B：字体子集化控制

```javascript
// 在pdf()函数中添加选项
const blob = await pdf(<Document>...</Document>, {
  // 确保字体完全嵌入
  compress: false, // 禁用压缩以保持字体完整性
});
```

#### 方案 C：字体文件优化

1. **使用完整字体文件**：确保`.ttf`文件包含所有需要的字符
2. **字体文件大小**：检查字体文件是否完整
3. **字符集覆盖**：确保字体支持中英文字符

### 建议的完整实现

```javascript
// 1. 优化字体注册
const registerFonts = () => {
  // 中文字体 - 完全嵌入
  Font.register({
    family: "STHeiti",
    src: "/fonts/STHeiti.ttf",
  });

  // 英文字体 - 完全嵌入
  Font.register({
    family: "Arial",
    src: "/fonts/Arial.ttf",
  });

  // 确保字体在PDF生成前已注册
};

// 2. PDF生成时确保字体嵌入
const generatePDF = async () => {
  registerFonts(); // 确保字体已注册

  const blob = await pdf(
    <Document>
      <Page>
        <Text style={{ fontFamily: "STHeiti" }}>中文文本</Text>
        <Text style={{ fontFamily: "Arial" }}>English Text</Text>
      </Page>
    </Document>,
    {
      // PDF生成选项
      compress: false, // 保持字体完整性
    }
  );

  return blob;
};
```

### 验证字体嵌入

生成 PDF 后，可以用 Adobe Acrobat 打开，查看"文件 > 属性 > 字体"来确认字体是否完全嵌入。

## 3. 混合字体处理

### 当前实现

使用`SmartMixedFontText`组件自动处理中英文字体切换：

```javascript
<SmartMixedFontText
  primaryFont={fontFamily}
  secondaryFont={labelData.secondaryFontFamily}
  style={dynamicStyles.fieldLine}
>
  {line}
</SmartMixedFontText>
```

### 优势

- 自动检测字符类型
- 中文字符使用主语言字体
- 英文字符使用次语言字体
- 无需手动分段

## 4. 技术建议

### 短期方案

1. **保持现有 RGB 生成**：继续使用 react-pdf
2. **优化字体嵌入**：确保字体完全嵌入
3. **测试验证**：验证字体在不同环境下的显示

### 长期方案

1. **后端 CMYK 转换**：实现 RGB 到 CMYK 的转换服务
2. **字体管理**：建立完整的字体管理体系
3. **质量监控**：建立 PDF 质量检查机制

## 5. 注意事项

1. **字体版权**：确保使用的字体有合法使用权
2. **文件大小**：完全嵌入字体会增加 PDF 文件大小
3. **兼容性**：确保 PDF 在不同设备和软件上的兼容性
4. **性能影响**：字体嵌入可能影响 PDF 生成速度

## 6. 总结

- **CMYK 支持**：需要后端转换服务，前端保持 RGB 生成
- **字体嵌入**：通过优化注册和生成选项确保完全嵌入
- **混合字体**：使用 SmartMixedFontText 组件自动处理
- **质量保证**：通过验证和测试确保输出质量

---

_生成时间：2025 年 1 月 19 日_
_项目：LabelMedix 药品标签系统_
