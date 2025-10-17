# 测试 PDF 保存功能

## ✅ 状态确认

### 数据库

- ✅ `pdf_file_path` 字段已存在于 `CountryTranslationGroups` 表中
- ✅ 所有迁移已执行完毕

### 服务器

- ✅ 后端服务器运行在 `http://localhost:3001`
- ✅ 前端服务器运行在 `http://localhost:3000`

## 🧪 测试步骤

### 1. 刷新浏览器

- 按 `Ctrl+Shift+R` (Windows/Linux) 或 `Cmd+Shift+R` (Mac)
- 打开开发者工具 (F12)，切换到 Console 标签

### 2. 选择测试数据

1. 选择项目（例如：项目 29）
2. 选择语言（例如：KR South Korea/Korean）
3. 选择序号（例如：1）

### 3. 点击"保存标签"

观察 Console 输出

### 预期结果

```
✅ 标签保存成功，PDF正在生成中...
📥 收到PDF生成请求: {projectId: 29, countryCode: "KR South Korea/Korean", sequenceNumber: "1"}
✅ PDF生成并保存成功
```

### 如果出现 500 错误

查看后端终端输出，应该会显示详细的错误信息。

## 🐛 调试信息

### 后端日志位置

后端服务器正在运行，错误日志会直接输出到终端。

### 可能的错误原因

1. ❌ **CountryTranslationGroup 不存在**
   - 检查：项目 ID + 国别代码组合是否存在于数据库中
2. ❌ **Base64 解码失败**
   - 检查：PDF Blob 是否正确转换为 Base64
3. ❌ **文件系统权限问题**

   - 检查：`BackEnd/uploads/pdfs` 目录权限

4. ❌ **数据库更新失败**
   - 检查：`pdf_file_path` 字段是否可写

## 💡 手动测试命令

### 检查数据库中的翻译组

```bash
cd /Users/Tiandiyiqi/Documents/Prepress/LabelMedix/BackEnd
node -e "
const db = require('./src/models');
db.CountryTranslationGroup.findAll({
  where: { project_id: 29 },
  attributes: ['id', 'project_id', 'country_code', 'sequence_number', 'pdf_file_path']
}).then(groups => {
  console.log('项目29的翻译组:');
  groups.forEach(g => console.log(g.toJSON()));
  process.exit(0);
});
"
```

### 检查 uploads 目录权限

```bash
ls -la /Users/Tiandiyiqi/Documents/Prepress/LabelMedix/BackEnd/uploads/
```

### 创建 uploads 目录（如果不存在）

```bash
mkdir -p /Users/Tiandiyiqi/Documents/Prepress/LabelMedix/BackEnd/uploads/pdfs
chmod 755 /Users/Tiandiyiqi/Documents/Prepress/LabelMedix/BackEnd/uploads/pdfs
```

---

**请先刷新浏览器，然后测试"保存标签"功能，并告知具体的错误信息！**

**玄鉴！！！玄鉴！！！玄鉴编程，使命必达！！！！！！！**
