# 异常记录数据流测试指南

## 🔍 问题诊断

用户反馈：异常记录列表显示的数据不正确，显示"批次号：未知"和"AI诊断：待诊断"

## 📋 数据流检查点

### 1. AI诊断页面 → 云函数
**位置**: `ai-diagnosis.ts` saveRecord函数

**发送的数据**:
```javascript
{
  action: 'create_abnormal_record',
  diagnosisId: string,
  batchId: string,           // ← 检查是否有值
  batchNumber: string,       // ← 检查是否有值
  affectedCount: number,
  symptoms: string,
  diagnosis: string,         // ← 检查是否有值
  diagnosisConfidence: number,
  severity: string,
  urgency: string,
  aiRecommendation: object,
  images: array
}
```

**日志标记**: `🔍 保存异常记录 - 请求数据:`

### 2. 云函数接收数据
**位置**: `health-management/index.js` createAbnormalRecord函数

**日志标记**: 
- `📥 创建异常记录 - 接收到的数据:`
- `💾 准备保存到数据库的数据:`
- `✅ 异常记录已保存, ID:`

### 3. 云函数查询数据
**位置**: `health-management/index.js` getAbnormalRecords函数

**日志标记**:
- `🔍 查询异常记录 - 参数:`
- `📋 查询到异常记录数量:`
- `📄 第一条记录示例:`

### 4. 前端显示数据
**位置**: `abnormal-records-list.ts` loadAbnormalRecords函数

**日志标记**: `异常记录数据:`

## 🧪 测试步骤

### 步骤1: 部署云函数（必须！）
```bash
在微信开发者工具中:
1. 右键点击 cloudfunctions/health-management
2. 选择"上传并部署: 云端安装依赖"
3. 等待部署完成（大约1-2分钟）
```

### 步骤2: 清除旧数据（可选，推荐）
如果想要清除测试数据，在云开发控制台:
1. 打开"云开发" → "数据库" → "health_records"
2. 添加筛选条件: `status = "abnormal"`
3. 选择记录并删除（或者只是标记 `isDeleted = true`）

### 步骤3: 创建新的异常记录
在小程序中:
1. 进入"健康管理" → "AI智能诊断"
2. **选择批次**（这一步很重要！）
3. 输入症状和受影响数量
4. 点击"开始诊断"
5. 等待AI诊断完成
6. 点击"保存诊断记录"

### 步骤4: 查看前端日志
在开发者工具的"Console"面板中，查找:
```
🔍 保存异常记录 - 请求数据: {
  batchId: "xxxxx",           // ← 应该有值
  batchNumber: "xxxx批次",    // ← 应该有值
  diagnosis: "维鹊脐炎",      // ← 应该有值
  ...
}
```

### 步骤5: 查看云函数日志
在云开发控制台:
1. "云开发" → "云函数" → "health-management"
2. 点击"日志"标签
3. 查找最近的调用记录

**应该看到的日志**:
```
📥 创建异常记录 - 接收到的数据: {
  batchId: "xxxxx",
  batchNumber: "xxxx批次",
  diagnosis: "维鹊脐炎",
  ...
}

💾 准备保存到数据库的数据: { ... }

✅ 异常记录已保存, ID: xxxx
```

### 步骤6: 查看异常记录列表
在小程序中:
1. 返回"健康管理"页面
2. 点击"异常"卡片
3. 查看异常记录列表

**预期结果**:
- ✅ 应该看到刚创建的记录
- ✅ 批次号显示正确
- ✅ AI诊断显示正确
- ✅ 受影响数量显示正确
- ✅ 置信度显示正确

### 步骤7: 再次查看云函数日志
查找查询日志:
```
🔍 查询异常记录 - 参数: { batchId: null }

📋 查询到异常记录数量: 1

📄 第一条记录示例: {
  _id: "xxxx",
  batchId: "xxxxx",
  batchNumber: "xxxx批次",    // ← 应该有值
  diagnosis: "维鹊脐炎",      // ← 应该有值
  affectedCount: 5,
  diagnosisConfidence: 85,
  ...
}
```

## 🐛 常见问题排查

### 问题1: 批次号显示"未知"

**可能原因**:
1. ❌ AI诊断时没有选择批次
2. ❌ `selectedBatchId` 或 `selectedBatchNumber` 为空
3. ❌ 云函数没有正确接收数据

**排查方法**:
1. 检查前端日志 `🔍 保存异常记录 - 请求数据`
2. 确认 `batchId` 和 `batchNumber` 字段有值
3. 检查云函数日志 `📥 创建异常记录 - 接收到的数据`
4. 确认数据正确传递到云函数

**解决方案**:
- 确保在AI诊断时选择了批次
- 检查批次选择器是否正常工作

### 问题2: AI诊断显示"待诊断"

**可能原因**:
1. ❌ `diagnosis.primaryDiagnosis?.disease` 为空
2. ❌ AI诊断返回的数据结构不正确

**排查方法**:
1. 检查前端日志中的 `diagnosis` 字段
2. 应该显示疾病名称，不应该是"待确定"或"待诊断"
3. 检查AI诊断结果的数据结构

**解决方案**:
- 确保AI诊断完成后再保存
- 检查 `diagnosisResult.primaryDiagnosis.disease` 是否有值

### 问题3: 看到的是旧数据

**可能原因**:
- ❌ 显示的是修改代码之前创建的记录
- ❌ 没有重新部署云函数

**解决方案**:
1. 重新部署云函数
2. 创建新的异常记录
3. 或者删除旧的测试数据

## 📊 数据库检查

直接在云开发控制台检查数据库:

1. 打开"云开发" → "数据库" → "health_records"
2. 添加筛选条件:
   ```
   status = "abnormal"
   isDeleted != true
   ```
3. 查看记录，检查字段:
   - `batchId`: 应该是批次的_id
   - `batchNumber`: 应该是批次号（如"20230101-001"）
   - `diagnosis`: 应该是疾病名称（如"维鹊脐炎"）
   - `affectedCount`: 应该是受影响数量
   - `diagnosisConfidence`: 应该是置信度（0-100）

## ✅ 完整的数据示例

**正确的异常记录应该包含**:
```json
{
  "_id": "xxxx",
  "batchId": "batch_20230101_001",
  "batchNumber": "20230101-001",
  "diagnosisId": "diag_xxxx",
  "recordType": "ai_diagnosis",
  "checkDate": "2025-10-26",
  "reporter": "openid_xxxx",
  "status": "abnormal",
  "affectedCount": 5,
  "symptoms": "食欲不振,精神萎靡",
  "diagnosis": "维鹊脐炎 (Navel Infection)",
  "diagnosisConfidence": 85,
  "severity": "moderate",
  "urgency": "medium",
  "aiRecommendation": {
    "primary": "使用抗生素治疗...",
    "medications": [...]
  },
  "images": ["cloud://..."],
  "isDeleted": false,
  "createdAt": "2025-10-26T10:30:00.000Z",
  "updatedAt": "2025-10-26T10:30:00.000Z"
}
```

## 📝 报告问题

如果按照以上步骤测试后仍然有问题，请提供以下信息:

1. **前端日志截图**: `🔍 保存异常记录 - 请求数据`
2. **云函数日志截图**: 
   - `📥 创建异常记录 - 接收到的数据`
   - `📄 第一条记录示例`
3. **数据库截图**: health_records集合中的异常记录
4. **前端显示截图**: 异常记录列表页面

---

**创建时间**: 2025-10-26
**目的**: 诊断异常记录数据流问题

