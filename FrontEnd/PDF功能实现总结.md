# PDF 功能实现总结

## 1. 概述

PDFPreview.tsx 组件实现了药品标签的 PDF 预览、编辑和导出功能。该组件支持多种标签分类、灵活的布局方式、智能混合字体处理，以及自动/自定义序号系统。

---

## 2. 核心架构

### 2.1 技术栈

- **React PDF 库** (`@react-pdf/renderer`): PDF 文档生成和预览
- **Next.js 动态导入**: 禁用 SSR，确保客户端渲染
- **React Context**: 标签数据状态管理
- **TypeScript**: 类型安全

### 2.2 组件状态管理

```typescript
// 核心状态
const [isClient, setIsClient] = useState(false);              // 客户端渲染标识
const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); // PDF生成状态
const [pdfSaveRequest, setPdfSaveRequest] = useState<...>();   // PDF保存请求

// Context数据
const { labelData, updateLabelData } = useLabelContext();      // 标签数据
const { theme } = useContext(ThemeContext);                     // 主题配置
```

---

## 3. PDF 生成核心逻辑

### 3.1 字体系统

#### 3.1.1 字体注册

```typescript
// 西文字体（支持粗体、斜体变体）
Font.register({
  family: "Arial",
  src: "/fonts/Arial.ttf",
  fonts: [
    { src: "/fonts/Arial.ttf" },
    { src: "/fonts/Arial Bold.ttf", fontWeight: "bold" },
    { src: "/fonts/Arial Italic.ttf", fontStyle: "italic" },
    {
      src: "/fonts/Arial Bold Italic.ttf",
      fontWeight: "bold",
      fontStyle: "italic",
    },
  ],
});

// 中文字体
Font.register({
  family: "STHeiti",
  src: "/fonts/STHeiti.ttf",
});

// Unicode字体（支持特殊符号）
Font.register({
  family: "Arial Unicode",
  src: "/fonts/Arial Unicode.ttf",
});
```

#### 3.1.2 智能混合字体

使用`SmartMixedFontText`组件自动处理中英文混排：

- 主字体（primaryFont）：用于中文、日文、韩文等
- 次字体（secondaryFont）：用于英文、数字、标点符号

### 3.2 页面尺寸与边距计算

```typescript
// 动态计算页面宽度（根据标签宽度和序号）
const currentWidth = calculatePageWidth(labelWidth, Number(selectedNumber));

// 动态计算页面边距
const margins = calculatePageMargins(Number(selectedNumber));

// 单位转换：毫米到点
const MM_TO_PT = 2.83465;
const mmToPt = (mm: number) => mm * MM_TO_PT;
```

### 3.3 内容处理流程

#### 3.3.1 六字段数据结构

```typescript
interface FieldData {
  fieldName: string;  // 字段名称
  lines: string[];    // 文本行数组
}

// 六个字段类型
- basicInfo: 基本信息
- numberField: 编号栏
- drugName: 药品名称
- numberOfSheets: 片数
- drugDescription: 药品说明
- companyName: 公司名称
```

#### 3.3.2 字段处理函数

```typescript
const processSixFields = (
  basicInfo: string,
  numberField: string,
  drugName: string,
  numberOfSheets: string,
  drugDescription: string,
  companyName: string
): FieldData[] => {
  // 1. 按顺序处理6个字段
  // 2. 按换行符分割，过滤空行
  // 3. 只保留有内容的字段
  // 4. 返回字段数据数组
};
```

#### 3.3.3 字段渲染（阶梯标布局）

```typescript
const renderSixFields = () => {
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
```

---

## 4. 序号系统

### 4.1 序号功能特性

- ✅ 显示/隐藏序号
- ✅ 自定义序号内容
- ✅ 自动圆圈数字（①-⑳）
- ✅ 三种对齐方式（左对齐、居中、右对齐）
- ✅ 字体大小调整
- ✅ 位置偏移（水平、垂直）

### 4.2 序号渲染逻辑

```typescript
const renderSequenceNumber = () => {
  if (!labelData.showSequenceNumber) return null;

  let sequenceText;

  // 判断使用自定义内容还是自动序号
  if (labelData.customSequenceText) {
    sequenceText = labelData.customSequenceText;
  } else {
    const sequenceNum = selectedNumber || '1';
    const getCircledNumber = (num: string) => {
      const n = parseInt(num);
      if (n >= 1 && n <= 20) {
        return String.fromCharCode(0x245F + n); // Unicode ①-⑳
      }
      return `(${num})`;
    };
    sequenceText = getCircledNumber(sequenceNum);
  }

  // 根据对齐方式和偏移量计算位置
  return (
    <View style={{...}}>
      <Text style={{
        fontSize: labelData.sequenceFontSize,
        fontFamily: 'Arial Unicode',
        textAlign: textAlign,
      }}>
        {sequenceText}
      </Text>
    </View>
  );
};
```

---

## 5. 动态样式系统

### 5.1 样式配置参数

```typescript
const dynamicStyles = StyleSheet.create({
  content: {
    fontSize: mmToPt(fontSize), // 字体大小
    fontFamily: fontFamily, // 字体族
    lineHeight: lineHeight, // 行高
    textAlign: textAlign, // 对齐方式
    direction: textAlign === "right" ? "rtl" : "ltr", // 文本方向
  },
  fieldContainer: {
    marginBottom: mmToPt(spacing), // 字段间距
    width: "100%",
    paddingHorizontal: mmToPt(2), // 左右内边距
  },
  // ... 其他样式
});
```

### 5.2 RTL 语言支持

- 阿拉伯语、希伯来语等从右到左书写的语言
- 根据`textAlign`设置自动调整`direction`属性

---

## 6. PDF 文档结构

### 6.1 基本结构

```typescript
<Document>
  <Page size={[mmToPt(currentWidth), mmToPt(labelHeight)]} style={pageStyle}>
    {/* 1. 边距参考框（虚线） */}
    <View style={[styles.marginBox, {...}]} />

    {/* 2. 主要内容区域 */}
    <View style={{...}}>
      <View style={{ width: '100%' }}>
        {renderSixFields()}  {/* 渲染六字段内容 */}
      </View>
    </View>

    {/* 3. 序号（绝对定位） */}
    {renderSequenceNumber()}
  </Page>
</Document>
```

### 6.2 布局特点

- **垂直居中**：主内容区域使用`justifyContent: 'center'`
- **绝对定位**：序号使用绝对定位，独立于主内容流
- **响应式**：根据设置动态调整所有尺寸和位置

---

## 7. PDF 导出功能

### 7.1 本地导出

```typescript
const handleExportPDF = async () => {
  const blob = await pdf(<Document>...</Document>).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${jobName}-${selectedLanguage}-${selectedNumber}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};
```

### 7.2 服务器保存

```typescript
const generateAndSavePdfToServer = async (
  projectId: number,
  countryCode: string,
  sequenceNumber: string
) => {
  // 1. 生成PDF Blob
  const blob = await pdf(<Document>...</Document>).toBlob();

  // 2. 生成文件名（清理非法字符）
  const fileName = `${sanitizedJobName}-${sanitizedCountryCode}-${sequenceNumber}.pdf`;

  // 3. 保存到服务器
  await savePdfFile(projectId, countryCode, blob, fileName);
};
```

### 7.3 事件驱动保存

```typescript
// 监听自定义事件
useEffect(() => {
  const handleGenerateAndSavePdf = (event: Event) => {
    const { projectId, countryCode, sequenceNumber } = event.detail;
    setPdfSaveRequest({ projectId, countryCode, sequenceNumber });
  };

  window.addEventListener("generate-and-save-pdf", handleGenerateAndSavePdf);
  return () =>
    window.removeEventListener(
      "generate-and-save-pdf",
      handleGenerateAndSavePdf
    );
}, [isClient]);
```

---

## 8. 标签分类系统

### 8.1 支持的标签类型

1. **阶梯标**：当前实现的默认布局
2. **单页左右 1**：单页左右分栏布局（版本 1）
3. **单页左右 2**：单页左右分栏布局（版本 2）
4. **单页上下 1**：单页上下分栏布局（版本 1）
5. **单页上下 2**：单页上下分栏布局（版本 2）

### 8.2 布局切换逻辑（待实现）

```typescript
// 根据标签分类调用不同的渲染函数
const renderContentByCategory = () => {
  switch (labelCategory) {
    case "阶梯标":
      return renderStepLayout(); // 阶梯布局
    case "单页左右1":
      return renderLeftRight1(); // 左右布局1
    case "单页左右2":
      return renderLeftRight2(); // 左右布局2
    case "单页上下1":
      return renderTopBottom1(); // 上下布局1
    case "单页上下2":
      return renderTopBottom2(); // 上下布局2
    default:
      return renderStepLayout();
  }
};
```

---

## 9. UI 控制面板

### 9.1 标签设置

- **标签分类**：下拉选择 5 种布局类型
- **标签宽度**：输入框，回车确认（最小 40mm）
- **标签高度**：输入框，回车确认（最小 40mm）
- **页面尺寸**：自动计算并显示（只读）

### 9.2 区域设置

- **底页**：数字输入
- **粘胶区**：数字输入
- **排废区**：数字输入
- **打码区**：数字输入
- **页面边距**：自动计算显示（上、下、左、右）

### 9.3 序号设置

- **显示开关**：复选框
- **自定义内容**：文本输入框
- **对齐方式**：三个按钮（左、中、右）
- **字符大小**（T）：数字输入，范围 1-20
- **水平位移**（x）：数字输入
- **垂直位移**（y）：数字输入

---

## 10. 文本宽度测量系统

### 10.1 字符宽度映射表

```typescript
interface CharWidthMap {
  chinese: number;      // 中文字符：1.0
  [key: string]: number; // 其他字符：相对宽度
}

const charWidthMap: CharWidthMap = {
  chinese: 1.0,
  'A': 0.722, 'B': 0.667, ..., // 大写字母
  'a': 0.556, 'b': 0.556, ..., // 小写字母
  '0': 0.556, '1': 0.556, ..., // 数字
  '.': 0.527, ',': 0.25, ...,  // 标点符号
};
```

### 10.2 测量函数

```typescript
const measureTextWidth = (
  text: string,
  fontSize: number,
  fontFamily: string
): number => {
  // 1. 使用Canvas API测量文本
  // 2. 区分中文和非中文字符
  // 3. 使用映射表获取字符宽度
  // 4. 缓存测量结果
};
```

---

## 11. 客户端渲染策略

### 11.1 动态导入

```typescript
const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFViewer),
  {
    ssr: false, // 禁用服务端渲染
    loading: () => <div>正在加载PDF预览...</div>,
  }
);
```

### 11.2 客户端检查

```typescript
useEffect(() => {
  setIsClient(true);
}, []);

if (!isClient) {
  return <div>正在加载PDF预览...</div>;
}
```

---

## 12. 性能优化

### 12.1 最小间距保护

```typescript
const calculateSpacing = (...) => {
  const minSpacing = mmToPt(2); // 最小2mm间距
  const calculatedSpacing = availableSpace / elements.length;
  return Math.max(calculatedSpacing, minSpacing);
};
```

### 12.2 尺寸验证

```typescript
const getValidDimension = (value: number) => {
  const minSize = 20; // 最小安全尺寸
  const maxSize = 1000; // 最大尺寸
  return Math.max(minSize, Math.min(maxSize, value));
};
```

---

## 13. 数据流

### 13.1 数据来源

```
LabelContext → labelData → PDFPreview
```

### 13.2 数据更新

```
UI Input → updateLabelData() → Context → 组件重渲染 → PDF更新
```

### 13.3 持久化

```
UI设置 → labelData → 服务器保存 → 项目数据
```

---

## 14. 文件命名规范

### 14.1 本地导出

```
格式：{jobName}-{selectedLanguage}-{selectedNumber}.pdf
示例：百济项目-CN-1.pdf
```

### 14.2 服务器保存

```
格式：{jobName}-{countryCode}-{sequenceNumber}.pdf
示例：百济项目-CN-001.pdf
```

### 14.3 非法字符处理

```typescript
const sanitizedName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5-]/g, "_");
```

---

## 15. 错误处理

### 15.1 尺寸验证

- 输入值小于最小值时，自动调整并提示用户
- 输入值大于最大值时，自动调整并提示用户

### 15.2 PDF 生成错误

```typescript
try {
  await generateAndSavePdfToServer(...);
  console.log('✅ PDF生成并保存成功');
} catch (error) {
  console.error('❌ PDF生成保存失败:', error);
}
```

---

## 16. 未来扩展方向

### 16.1 多布局支持

- 实现 5 种标签分类的独立布局函数
- 根据标签分类动态切换渲染逻辑

### 16.2 更多字段类型

- 支持图片字段
- 支持条形码/二维码
- 支持表格布局

### 16.3 批量处理

- 批量生成多个标签
- 批量导出 PDF
- 批量打印

### 16.4 模板系统

- 保存自定义模板
- 模板导入/导出
- 模板共享

---

## 17. 关键技术点总结

1. **React PDF 库集成**：完整的 PDF 生成和预览能力
2. **智能混合字体**：自动处理中英文混排
3. **动态样式系统**：响应式调整所有视觉元素
4. **事件驱动架构**：解耦 PDF 生成和 UI 交互
5. **类型安全**：TypeScript 提供完整的类型检查
6. **性能优化**：最小间距保护、尺寸验证等
7. **用户体验**：实时预览、灵活配置、友好提示

---

## 18. 代码组织

```
PDFPreview.tsx
├── 导入和类型定义
├── 工具函数
│   ├── 单位转换（mmToPt）
│   ├── 罗马数字转换（toRoman）
│   ├── 文本宽度测量（measureTextWidth）
│   └── 间距计算（calculateSpacing）
├── 字体注册
├── 文本处理函数
│   ├── 分段处理（splitIntoParagraphs）
│   ├── 字段处理（processSixFields）
│   └── 字段内容处理（processFieldContent）
├── 样式定义
│   ├── 静态样式（styles）
│   └── 动态样式（dynamicStyles）
├── 主组件
│   ├── 状态管理
│   ├── 副作用（useEffect）
│   ├── 渲染函数
│   │   ├── 渲染六字段（renderSixFields）
│   │   └── 渲染序号（renderSequenceNumber）
│   ├── PDF生成函数
│   │   ├── 服务器保存（generateAndSavePdfToServer）
│   │   └── 本地导出（handleExportPDF）
│   └── UI渲染
│       ├── 控制面板
│       └── PDF预览器
```

---

## 19. 依赖关系

```
PDFPreview.tsx
├── @react-pdf/renderer (PDF生成)
├── next/dynamic (动态导入)
├── SmartMixedFontText (混合字体组件)
├── LabelContext (标签数据)
├── ThemeContext (主题配置)
├── calculatePageWidth (宽度计算)
├── calculatePageMargins (边距计算)
└── savePdfFile (API调用)
```

---

## 20. 总结

PDFPreview 组件是一个功能完善、架构清晰的 PDF 生成和预览系统。它通过模块化设计、动态样式系统和智能字体处理，实现了灵活的标签布局和高质量的 PDF 输出。通过事件驱动的架构，组件既可以作为独立的预览工具，也可以集成到批量处理流程中。未来通过扩展多布局支持和模板系统，可以进一步提升系统的灵活性和易用性。
