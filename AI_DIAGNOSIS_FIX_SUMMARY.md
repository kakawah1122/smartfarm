# AI诊断问题修复总结

## 📋 发现的问题

### 1. 批次提示词数据获取失败
**错误信息：**
```
获取批次提示词数据失败: document.get:fail document with _id 8f6c3a6368f82fd50028f6036302e3da does not exist
```

**根本原因：**
- `health-management/index.js` 中的 `getBatchPromptData` 函数使用了错误的集合名
- 原代码：`COLLECTIONS.PRODUCTION_BATCHES` → `production_batches`
- 实际集合：`COLLECTIONS.PROD_BATCH_ENTRIES` → `prod_batch_entries`

**修复：**
✅ 已修改 `cloudfunctions/health-management/index.js` 第 582 行：
```javascript
// 修复前
const batchResult = await db.collection(COLLECTIONS.PRODUCTION_BATCHES)

// 修复后
const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
```

---

### 2. AI诊断失败（400错误）
**错误信息：**
```
Request failed with status code 400
堆栈: Error: Request failed with status code 400
    at processTask (/var/user/index.js:229:13)
```

**根本原因：**
- `ai-diagnosis/index.js` 调用 `ai-multi-model` 时，没有传递 `images` 参数
- 导致 `ai-multi-model` 无法正确处理带图片的诊断请求
- 通义千问 API 可能因为请求格式不完整而返回 400 错误

**修复：**
✅ 已修改 `cloudfunctions/ai-diagnosis/index.js` 第 431-446 行：
```javascript
// 修复前
const aiRequest = {
  action: 'chat_completion',
  messages: [...],
  taskType: 'health_diagnosis',
  priority: 'free_only'
}

// 修复后
const aiRequest = {
  action: 'chat_completion',
  messages: [...],
  taskType: 'health_diagnosis',
  priority: 'free_only',
  images: images || []  // ✅ 新增：传递图片文件ID
}
```

---

### 3. 症状标签交互优化（已完成）
**需求：**
- 症状标签点击后能填充到文本框
- 再次点击能取消填充（像死因剖析的异常标签一样）

**修复：**
✅ 已优化 `miniprogram/packageAI/ai-diagnosis/ai-diagnosis.ts`：
1. 给症状标签添加 `checked` 状态
2. 实现切换功能（点击选中/取消）
3. 自动更新文本框内容
4. 添加视觉反馈（选中高亮）

---

## 🚀 部署步骤

### 必须部署的云函数（紧急）

1. **health-management** - 修复批次数据查询
```bash
# 在微信开发者工具中右键 cloudfunctions/health-management
# 选择"上传并部署：云端安装依赖"
```

2. **ai-diagnosis** - 修复图片参数传递
```bash
# 在微信开发者工具中右键 cloudfunctions/ai-diagnosis
# 选择"上传并部署：云端安装依赖"
```

### 前端代码（小程序端）

1. **症状标签交互优化** - 已完成
```bash
# 前端代码已修改，需要重新编译小程序
# 在微信开发者工具中点击"编译"按钮
```

---

## ✅ 验证步骤

### 1. 验证批次数据获取
1. 进入AI诊断页面
2. 选择任意批次
3. 查看控制台，不应再出现 "获取批次提示词数据失败" 错误

### 2. 验证AI诊断（无图片）
1. 选择批次
2. 输入症状（如：发热、咳嗽）
3. 输入受影响数量
4. 点击"开始AI智能诊断"
5. 应该成功获得诊断结果

### 3. 验证AI诊断（有图片）
1. 选择批次
2. 输入症状
3. 上传1-2张图片
4. 点击"开始AI智能诊断"
5. 应该成功获得诊断结果（图片会被AI分析）

### 4. 验证症状标签交互
1. 进入AI诊断页面
2. 点击症状标签（如"发热"）
3. 症状应该被添加到文本框，标签高亮
4. 再次点击同一标签
5. 症状应该从文本框移除，标签取消高亮

---

## 📝 技术说明

### 集合命名规范
```javascript
// 正确的批次集合
PROD_BATCH_ENTRIES: 'prod_batch_entries'  // ✅ 生产批次入栏记录

// 旧的或废弃的
PRODUCTION_BATCHES: 'production_batches'  // ❌ 不再使用
```

### AI多模型图片处理流程
1. 前端上传图片 → 云存储（获得 fileID）
2. 前端调用 `ai-diagnosis` → 传递 fileID
3. `ai-diagnosis` 调用 `ai-multi-model` → 传递 fileID
4. `ai-multi-model` 下载图片 → 转换为 HTTPS URL
5. 调用通义千问 API → 使用 `qwen-vl-max` 或 `qwen-vl-plus` 视觉模型
6. 返回诊断结果

### 错误排查技巧
- **400 错误**：通常是请求参数不完整或格式错误
- **批次不存在**：检查集合名称是否正确
- **图片处理失败**：检查图片大小（限制5MB）和格式

---

## 🔍 后续优化建议

1. **错误提示优化**
   - 当批次数据获取失败时，给用户更友好的提示
   - 区分"批次不存在"和"网络错误"

2. **图片诊断优化**
   - 压缩大图片，减少上传时间
   - 提供图片质量建议（光线、对焦、角度）
   - 支持批量上传（死因剖析支持4张）

3. **诊断历史**
   - 记录每次诊断的批次上下文
   - 支持查看历史诊断的完整信息

---

## ⚠️ 注意事项

1. **必须先部署云函数**，再测试前端功能
2. **清除缓存**：如果问题仍然存在，尝试清除小程序缓存
3. **API Key 检查**：确保通义千问 API Key 已正确配置在云函数环境变量中

---

## 📞 问题反馈

如果部署后仍有问题，请检查：
1. 云函数日志（在云开发控制台查看）
2. 前端控制台错误信息
3. 网络连接状态
4. API Key 配置是否正确

---

**修复时间：** 2025-10-26  
**影响范围：** AI智能诊断功能  
**优先级：** 🔴 高（影响核心功能）

