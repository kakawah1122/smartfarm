# 异常记录弹窗数据问题诊断指南

## 🐛 用户反馈的问题

1. ❌ 批次号显示"未知"
2. ❌ 受影响数量显示"0只"
3. ❌ 状态显示"已隔离"（但还没制定治疗方案）
4. ❌ 没有显示AI诊断的详细信息
5. ❌ 没有治疗建议
6. ❌ 没有"制定治疗方案"按钮

## 🔍 诊断步骤

### 步骤1: 查看前端Console日志

已添加详细日志，点击记录时会输出：

```
📄 异常记录详情数据: {...}
  - 批次号: xxx
  - 受影响数量: xxx
  - 状态: xxx
  - AI建议: {...}
  - 诊断: xxx
  - 置信度: xxx
```

**检查点**:
- [ ] `batchNumber` 是否有值？
- [ ] `affectedCount` 是否有值？
- [ ] `status` 的值是什么？（应该是 'abnormal'）
- [ ] `aiRecommendation` 的结构是什么？
- [ ] `diagnosis` 是否有值？
- [ ] `diagnosisConfidence` 是否有值？

### 步骤2: 检查数据库

在云开发控制台：
1. 打开"数据库" → "health_records"
2. 筛选条件：`status = "abnormal"`
3. 查看记录详情

**应该包含的字段**:
```json
{
  "_id": "xxx",
  "batchId": "批次ID",
  "batchNumber": "批次号（如：20231026-001）",
  "diagnosisId": "诊断ID",
  "status": "abnormal",  // ← 应该是 abnormal，不是 isolated
  "affectedCount": 5,    // ← 应该有具体数字
  "symptoms": "症状描述",
  "diagnosis": "疾病名称",
  "diagnosisConfidence": 85,
  "severity": "moderate",
  "urgency": "medium",
  "aiRecommendation": {
    "primary": "治疗建议文本",
    ...
  },
  "images": ["云存储路径"],
  "checkDate": "2025-10-26",
  "isDeleted": false
}
```

### 步骤3: 检查云函数日志

在云开发控制台：
1. "云函数" → "health-management" → "日志"
2. 查找 `get_abnormal_record_detail` 相关日志

**应该看到**:
```
🔍 查询异常记录 - 参数: { batchId: null }
📋 查询到异常记录数量: X
📄 第一条记录示例: { ... }
```

## 🔧 可能的问题和解决方案

### 问题1: 批次号和受影响数量为空

**可能原因**:
1. AI诊断时没有正确保存 `batchNumber` 和 `affectedCount`
2. 使用的是旧数据（修改代码之前创建的）

**解决方案**:
1. 重新部署云函数
2. 创建新的异常记录测试
3. 删除旧的测试数据

### 问题2: 状态显示错误（显示"已隔离"而不是"待处理"）

**可能原因**:
1. 数据库中的记录 `status` 字段不是 'abnormal'
2. 这条记录已经被处理过（之前点击过制定治疗方案）

**检查方法**:
```sql
// 在数据库中检查
status: "abnormal"  // ← 应该是这个
status: "isolated"  // ← 如果是这个，说明已处理
status: "treating"  // ← 如果是这个，说明已处理
```

**解决方案**:
- 创建新的异常记录
- 或者在数据库中手动将 `status` 改回 `abnormal`

### 问题3: 没有显示"制定治疗方案"按钮

**原因**: 按钮显示条件是 `status === 'abnormal'`

```html
<view class="popup-footer" wx:if="{{currentRecord.status === 'abnormal'}}">
  <button class="btn btn-primary">制定治疗方案</button>
</view>
```

**如果不显示，说明**:
- `currentRecord.status` 不是 'abnormal'
- 可能是 'treating' 或 'isolated'

**解决方案**:
- 查看Console日志中的 `status` 值
- 创建新的异常记录测试

### 问题4: AI建议不显示

**显示条件**: `wx:if="{{currentRecord.aiRecommendation}}"`

**可能原因**:
1. `aiRecommendation` 字段为 `null` 或 `undefined`
2. `aiRecommendation` 是空对象 `{}`
3. AI诊断时没有正确保存建议

**检查**:
```javascript
console.log('AI建议:', record.aiRecommendation)
```

**期望结构**:
```json
{
  "primary": "治疗建议文本",
  "medications": [...],
  ...
}
```

或者直接是字符串：
```json
"治疗建议文本"
```

## 📝 完整的测试流程

### 1. 清除旧数据
```
数据库 → health_records → 删除 status='abnormal' 的测试记录
```

### 2. 重新部署云函数
```
右键 health-management → 上传并部署: 云端安装依赖
```

### 3. 创建新的异常记录
```
AI诊断 → 选择批次 → 输入症状 → 诊断 → 保存记录
```

### 4. 查看异常记录列表
```
健康管理 → 点击"异常" → 查看列表
```

### 5. 点击记录，查看详情弹窗
```
点击记录卡片 → 查看Console日志 → 检查数据
```

### 6. 验证所有字段
- [ ] 批次号显示正确
- [ ] 受影响数量显示正确
- [ ] 状态显示"待处理"
- [ ] AI诊断信息完整
- [ ] 症状描述显示
- [ ] AI治疗建议显示
- [ ] 图片显示（如果有）
- [ ] "制定治疗方案"按钮显示

### 7. 测试制定治疗方案
- [ ] 点击"制定治疗方案"
- [ ] 选择"药物治疗"或"隔离观察"
- [ ] 确认创建成功
- [ ] 弹窗关闭
- [ ] 列表刷新
- [ ] 该记录状态变为"治疗中"或"已隔离"
- [ ] 再次打开该记录，不再显示"制定治疗方案"按钮

## 🎯 关键检查点

### 数据创建时
```typescript
// ai-diagnosis.ts - saveRecord()
{
  batchId: this.data.selectedBatchId,           // ← 必须有值
  batchNumber: this.data.selectedBatchNumber,   // ← 必须有值
  affectedCount: parseInt(this.data.affectedCount), // ← 必须有值
  diagnosis: diagnosis.primaryDiagnosis?.disease,   // ← 必须有值
  ...
}
```

### 数据保存时
```javascript
// health-management/index.js - createAbnormalRecord()
{
  batchId,              // ← 检查是否有值
  batchNumber,          // ← 检查是否有值
  affectedCount,        // ← 检查是否有值
  status: 'abnormal',   // ← 固定为 abnormal
  ...
}
```

### 数据查询时
```javascript
// health-management/index.js - getAbnormalRecordDetail()
status: 'abnormal',
isDeleted: false
```

### 数据显示时
```html
<!-- abnormal-records-list.wxml -->
批次号: {{currentRecord.batchNumber || '未知'}}
受影响数量: {{(currentRecord.affectedCount || 0) + '只'}}
状态: {{ status === 'abnormal' ? '待处理' : ... }}
```

## 🚀 快速修复

如果是数据问题：
1. 删除旧的测试数据
2. 重新创建异常记录

如果是代码问题：
1. 确认已部署最新云函数
2. 检查前端日志
3. 检查云函数日志
4. 对比数据库实际数据

## 📞 报告问题

如果按照以上步骤仍有问题，请提供：

1. **Console日志截图**
```
📄 异常记录详情数据: {...}
```

2. **数据库记录截图**
```
health_records 中的实际数据
```

3. **云函数日志截图**
```
create_abnormal_record 和 get_abnormal_record_detail 的日志
```

4. **弹窗显示截图**
```
实际显示的弹窗内容
```

---

**创建时间**: 2025-10-26
**目的**: 诊断异常记录弹窗数据显示问题

