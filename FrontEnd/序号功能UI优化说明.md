# 序号功能 UI 优化说明

## 修改内容

### 1. UI 布局优化 ✅

#### 问题

- 原有布局超出边界，内容挤压

#### 修改

1. **移除"序号："标签**

   - 删除 `<label>序号：</label>`
   - 内容向前移动，节省空间

2. **优化"显示"文字**

   - 从"显示"改为"显示序号"
   - 添加 `whitespace-nowrap` 强制单行显示
   - 更明确的功能说明

3. **调整间距**
   - 主容器从 `gap-4` 改为 `gap-3`
   - 减少元素间距，避免超出边界

#### 修改前

```tsx
<label className="text-base font-medium px-3 py-1 min-w-[120px]">
  序号：
</label>
<div className="flex items-center gap-4 px-2 py-1">
  <div className="flex items-center gap-2">
    <input type="checkbox" ... />
    <span className="text-base">显示</span>
  </div>
  ...
</div>
```

#### 修改后

```tsx
<div className="flex items-center gap-3 px-3 py-1">
  <div className="flex items-center gap-2">
    <input type="checkbox" ... />
    <span className="text-base whitespace-nowrap">显示序号</span>
  </div>
  ...
</div>
```

---

### 2. 序号显示样式优化 ✅

#### 问题

- 序号显示为纯数字，不够美观
- 字体大小和样式不合适

#### 修改

**1. 添加圆圈数字**

使用 Unicode 字符将数字转换为带圆圈的样式：

- 1 → ①（U+2460）
- 2 → ②（U+2461）
- ...
- 20 → ⑳（U+2473）
- 超过 20 的数字使用括号：(21), (22), ...

**实现代码**：

```typescript
const getCircledNumber = (num: string) => {
  const n = parseInt(num);
  if (n >= 1 && n <= 20) {
    // Unicode 字符：①-⑳ (U+2460 到 U+2473)
    return String.fromCharCode(0x245f + n);
  }
  // 如果超过20，返回原数字加括号
  return `(${num})`;
};

const sequenceText = getCircledNumber(sequenceNum);
```

**2. 固定字体样式**

- **字体**：Arial（固定，不再跟随主内容字体）
- **字号**：5pt（固定，不再跟随主内容字号）

```typescript
<Text
  style={{
    fontSize: 5, // 固定为 5pt
    fontFamily: "Arial", // 固定为 Arial 字体
    textAlign: textAlign,
  }}
>
  {sequenceText}
</Text>
```

---

## Unicode 圆圈数字对照表

| 数字 | Unicode | 字符 | 十六进制 |
| ---- | ------- | ---- | -------- |
| 1    | U+2460  | ①    | 0x2460   |
| 2    | U+2461  | ②    | 0x2461   |
| 3    | U+2462  | ③    | 0x2462   |
| 4    | U+2463  | ④    | 0x2463   |
| 5    | U+2464  | ⑤    | 0x2464   |
| 6    | U+2465  | ⑥    | 0x2465   |
| 7    | U+2466  | ⑦    | 0x2466   |
| 8    | U+2467  | ⑧    | 0x2467   |
| 9    | U+2468  | ⑨    | 0x2468   |
| 10   | U+2469  | ⑩    | 0x2469   |
| 11   | U+246A  | ⑪    | 0x246A   |
| 12   | U+246B  | ⑫    | 0x246B   |
| 13   | U+246C  | ⑬    | 0x246C   |
| 14   | U+246D  | ⑭    | 0x246D   |
| 15   | U+246E  | ⑮    | 0x246E   |
| 16   | U+246F  | ⑯    | 0x246F   |
| 17   | U+2470  | ⑰    | 0x2470   |
| 18   | U+2471  | ⑱    | 0x2471   |
| 19   | U+2472  | ⑲    | 0x2472   |
| 20   | U+2473  | ⑳    | 0x2473   |
| >20  | -       | (21) | -        |

---

## 转换公式

对于 1-20 的数字：

```typescript
// 公式：U+2460 + (n - 1)
// 或者：0x245F + n
const unicodeChar = String.fromCharCode(0x245f + n);
```

示例：

- n = 1: 0x245F + 1 = 0x2460 → ①
- n = 5: 0x245F + 5 = 0x2464 → ⑤
- n = 10: 0x245F + 10 = 0x2469 → ⑩
- n = 20: 0x245F + 20 = 0x2473 → ⑳

---

## 优化效果对比

### UI 布局

**修改前**：

```
序号：☑ 显示  [左][中][右]  X: 0 mm  Y: 3 mm  ← 超出边界
```

**修改后**：

```
☑ 显示序号  [左][中][右]  X: 0 mm  Y: 3 mm  ← 正常显示
```

### PDF 中的序号显示

**修改前**：

```
1     ← 纯数字，10pt，STHeiti 字体
```

**修改后**：

```
①    ← 圆圈数字，5pt，Arial 字体
```

---

## 技术细节

### 1. whitespace-nowrap

```tsx
<span className="text-base whitespace-nowrap">显示序号</span>
```

作用：

- 防止文字换行
- 确保"显示序号"在一行显示
- 避免在狭窄空间中被截断

### 2. String.fromCharCode()

```typescript
String.fromCharCode(0x245f + n);
```

作用：

- 将 Unicode 码点转换为字符
- `0x245F + 1 = 0x2460` → ①
- 支持所有 Unicode 字符

### 3. 字体回退

如果 Arial 字体不支持圆圈数字（某些系统可能不支持），PDF 渲染器会自动回退到：

1. 系统默认字体
2. 或显示为方框/问号

建议：

- 测试不同系统的显示效果
- 如果有问题，可以考虑使用 "Arial Unicode MS" 字体

---

## 注意事项

### 1. 序号范围限制

- **1-20**：使用 Unicode 圆圈数字（①-⑳）
- **21+**：使用括号格式 (21), (22), ...
- 如果需要更多圆圈数字，可以考虑：
  - ㉑-㊿ (U+3251-U+325F) - 带圆圈的 21-50
  - 但这些字符支持度较低

### 2. 字体兼容性

- **Arial** 字体在大多数系统都支持圆圈数字
- 如果显示异常，可以改用 "Arial Unicode MS"
- PDF 中需要确保字体已正确注册

### 3. 字号考虑

- **5pt** 是相对较小的字号
- 适合作为标注性的序号
- 如果打印时看不清，可以适当调大（建议 6-8pt）

---

## 测试清单

### UI 测试

- [ ] "显示序号"文字完整显示，不换行
- [ ] 所有控件在一行内正常显示
- [ ] 没有超出容器边界
- [ ] 响应式布局正常（不同屏幕宽度）

### 序号显示测试

- [ ] 序号 1 显示为 ①
- [ ] 序号 5 显示为 ⑤
- [ ] 序号 10 显示为 ⑩
- [ ] 序号 20 显示为 ⑳
- [ ] 序号 21 显示为 (21)
- [ ] 字体为 Arial
- [ ] 字号明显小于主内容

### 功能测试

- [ ] 勾选/取消"显示序号"正常工作
- [ ] 左/中/右对齐切换正常
- [ ] X/Y 偏移调整正常
- [ ] PDF 导出包含正确的序号
- [ ] PDF 保存到服务器正确

---

## 相关文件

- `FrontEnd/app/components/PDFPreview.tsx` - UI 和渲染逻辑
- `FrontEnd/lib/context/LabelContext.tsx` - 数据结构
- `FrontEnd/序号功能实现说明.md` - 原功能说明

---

**优化完成日期**：2024-12-20  
**版本**：v1.1  
**状态**：✅ 完成，可以测试
