# 序号功能 UI 调整说明

## 修改内容

### 1. 去掉 X、Y 后面的 "mm" 单位显示

**目的**：减少空间占用，使 UI 更紧凑

**修改前**：

```tsx
X: [   0   ] mm  Y: [   0   ] mm
```

**修改后**：

```tsx
X: [   0   ]  Y: [   0   ]
```

**具体修改**：

- 删除 X 后面的 `<span className="text-xs text-gray-500">mm</span>`
- 删除 Y 后面的 `<span className="text-xs text-gray-500">mm</span>`
- 调整输入框宽度从 `w-16` 改为 `w-14`

---

### 2. 添加字符大小设置项

**目的**：让用户可以自定义序号的字体大小，不再固定为 5pt

**位置**：在 X、Y 位置偏移之前

**UI 布局**：

```
☑ 显示序号  [左][中][右]  字符: [5] pt  X: [0]  Y: [0]
```

#### 数据结构

**FrontEnd/lib/context/LabelContext.tsx**

```typescript
interface LabelData {
  // ... 其他字段 ...

  // 序号设置
  showSequenceNumber: boolean; // 是否显示序号
  sequencePosition: string; // 序号位置：left（左对齐）、center（居中）、right（右对齐）
  sequenceFontSize: number; // 序号字体大小（pt） ✨ 新增
  sequenceOffsetX: number; // 序号水平位移（mm）
  sequenceOffsetY: number; // 序号垂直位移（mm）
}

const defaultLabelData: LabelData = {
  // ... 其他字段 ...

  showSequenceNumber: true,
  sequencePosition: "left",
  sequenceFontSize: 5, // ✨ 默认 5pt
  sequenceOffsetX: 0,
  sequenceOffsetY: 0,
};
```

#### UI 实现

**FrontEnd/app/components/PDFPreview.tsx**

```tsx
{
  /* 字符大小和位置偏移 */
}
<div className="flex items-center gap-2">
  {/* 字符大小 */}
  <div className="flex items-center gap-1">
    <span className="text-base">字符:</span>
    <input
      type="number"
      value={labelData.sequenceFontSize}
      onChange={(e) =>
        updateLabelData({ sequenceFontSize: Number(e.target.value) })
      }
      disabled={!labelData.showSequenceNumber}
      className="w-12 px-2 py-1 focus:outline-none text-base text-center border-b border-gray-300"
      step="0.5"
      min="1"
      max="20"
    />
    <span className="text-xs text-gray-500">pt</span>
  </div>

  {/* X 位置偏移 */}
  <div className="flex items-center gap-1">
    <span className="text-base">X:</span>
    <input
      type="number"
      value={labelData.sequenceOffsetX}
      onChange={(e) =>
        updateLabelData({ sequenceOffsetX: Number(e.target.value) })
      }
      disabled={!labelData.showSequenceNumber}
      className="w-14 px-2 py-1 focus:outline-none text-base text-center border-b border-gray-300"
      step="0.5"
    />
  </div>

  {/* Y 位置偏移 */}
  <div className="flex items-center gap-1">
    <span className="text-base">Y:</span>
    <input
      type="number"
      value={labelData.sequenceOffsetY}
      onChange={(e) =>
        updateLabelData({ sequenceOffsetY: Number(e.target.value) })
      }
      disabled={!labelData.showSequenceNumber}
      className="w-14 px-2 py-1 focus:outline-none text-base text-center border-b border-gray-300"
      step="0.5"
    />
  </div>
</div>;
```

**字段说明**：

| 字段 | 说明         | 宽度   | 范围   | 步长 | 单位 |
| ---- | ------------ | ------ | ------ | ---- | ---- |
| 字符 | 序号字体大小 | `w-12` | 1-20   | 0.5  | pt   |
| X    | 水平位移     | `w-14` | 无限制 | 0.5  | -    |
| Y    | 垂直位移     | `w-14` | 无限制 | 0.5  | -    |

**禁用逻辑**：

- 当 `showSequenceNumber` 为 `false` 时，所有输入框都禁用

---

#### PDF 渲染逻辑

**FrontEnd/app/components/PDFPreview.tsx - renderSequenceNumber()**

```typescript
const renderSequenceNumber = () => {
  if (!labelData.showSequenceNumber) return null;

  const sequenceNum = selectedNumber || "1";

  // 转换为圆圈数字
  const getCircledNumber = (num: string) => {
    const n = parseInt(num);
    if (n >= 1 && n <= 20) {
      return String.fromCharCode(0x245f + n); // ①-⑳
    }
    return `(${num})`; // 超过20用括号
  };

  const sequenceText = getCircledNumber(sequenceNum);

  let left = mmToPt(margins.left);
  const bottom = mmToPt(margins.bottom + labelData.sequenceOffsetY);
  const width = mmToPt(currentWidth - margins.left - margins.right);

  let textAlign: "left" | "center" | "right" = "left";
  if (labelData.sequencePosition === "center") {
    textAlign = "center";
  } else if (labelData.sequencePosition === "right") {
    textAlign = "right";
  }

  return (
    <View
      style={{
        position: "absolute",
        bottom: bottom,
        left: left + mmToPt(labelData.sequenceOffsetX),
        width: width,
        flexDirection: "row",
        justifyContent:
          labelData.sequencePosition === "center"
            ? "center"
            : labelData.sequencePosition === "right"
            ? "flex-end"
            : "flex-start",
      }}
    >
      <Text
        style={{
          fontSize: labelData.sequenceFontSize, // ✨ 使用用户设置的字体大小
          fontFamily: "Arial Unicode",
          textAlign: textAlign,
        }}
      >
        {sequenceText}
      </Text>
    </View>
  );
};
```

**关键修改**：

```typescript
// 修改前
fontSize: 5,  // 固定为 5pt

// 修改后
fontSize: labelData.sequenceFontSize,  // 使用用户设置的字体大小
```

---

## UI 对比

### 修改前

```
☑ 显示序号  [左][中][右]  X: [   0   ] mm  Y: [   0   ] mm
```

**问题**：

- 占用空间较大
- 没有字体大小调整选项

### 修改后

```
☑ 显示序号  [左][中][右]  字符: [5] pt  X: [0]  Y: [0]
```

**改进**：

- ✅ 添加了字符大小设置
- ✅ 去掉了 mm 单位，更紧凑
- ✅ 调整了输入框宽度
- ✅ 保持了良好的视觉平衡

---

## 字体大小设置说明

### 参数范围

| 参数             | 最小值 | 最大值 | 默认值 | 步长 | 单位 |
| ---------------- | ------ | ------ | ------ | ---- | ---- |
| sequenceFontSize | 1      | 20     | 5      | 0.5  | pt   |

### 常用大小对照

| 字体大小 | 显示效果 | 适用场景           |
| -------- | -------- | ------------------ |
| 3-4pt    | ① 很小   | 标签尺寸很小时     |
| 5pt      | ① 默认   | 大多数标签（推荐） |
| 7-8pt    | ① 稍大   | 需要突出显示时     |
| 10pt+    | ① 大     | 大尺寸标签         |

### 动态调整建议

根据标签尺寸自动建议字体大小：

```typescript
// 建议的字体大小计算（可选实现）
const suggestFontSize = (labelWidth: number, labelHeight: number) => {
  const minDimension = Math.min(labelWidth, labelHeight);
  if (minDimension < 40) return 3;
  if (minDimension < 60) return 4;
  if (minDimension < 80) return 5;
  if (minDimension < 100) return 6;
  return 7;
};
```

---

## 测试清单

### UI 测试

- [ ] "字符" 输入框正常显示
- [ ] X、Y 后面没有 "mm" 单位
- [ ] 所有控件在一行内正常显示
- [ ] 禁用状态正常工作

### 功能测试

- [ ] 修改字符大小后，PDF 预览中序号大小随之变化
- [ ] 字符大小范围限制正常（1-20pt）
- [ ] 步长 0.5 正常工作（如 5 → 5.5 → 6）
- [ ] X、Y 位置偏移仍然正常工作

### 不同字体大小测试

| 测试项 | 字体大小 | 预期结果         |
| ------ | -------- | ---------------- |
| 最小值 | 1pt      | ① 非常小，但可见 |
| 默认值 | 5pt      | ① 清晰可见       |
| 中等值 | 8pt      | ① 稍大，清晰     |
| 最大值 | 20pt     | ① 很大           |

### 导出测试

- [ ] 导出 PDF 后，序号字体大小正确
- [ ] 不同字体大小都能正确导出
- [ ] 字体大小在不同查看器中显示一致

---

## 相关文件

- `FrontEnd/lib/context/LabelContext.tsx` - 数据结构定义
- `FrontEnd/app/components/PDFPreview.tsx` - UI 和 PDF 渲染
- `FrontEnd/序号功能实现说明.md` - 完整功能说明
- `FrontEnd/序号功能UI优化说明.md` - UI 优化说明

---

## 技术细节

### 输入框宽度调整

```tsx
// 字符大小输入框 - 最小
className = "w-12"; // 48px，因为值范围较小（1-20）

// X、Y 位置偏移输入框 - 稍大
className = "w-14"; // 56px，因为可能有负数和小数
```

### 数字输入限制

```tsx
<input
  type="number"
  step="0.5" // 允许 0.5 的步长
  min="1" // 最小 1pt
  max="20" // 最大 20pt
/>
```

浏览器会自动：

- 阻止输入小于 1 的值
- 阻止输入大于 20 的值
- 上下箭头按 0.5 递增/递减

### 单位显示优化

```tsx
// 保留单位显示的字段
<span className="text-xs text-gray-500">pt</span>; // 字符大小保留 pt

// 去掉单位显示的字段
X: [0]; // 不显示 mm
Y: [0]; // 不显示 mm
```

**原因**：

- X、Y 的单位（mm）是显而易见的位置偏移
- 字符大小的单位（pt）需要明确标注，避免混淆

---

**修改完成日期**：2024-12-20  
**版本**：v1.3  
**状态**：✅ 已完成，请测试
