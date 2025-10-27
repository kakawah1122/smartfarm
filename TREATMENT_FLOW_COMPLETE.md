# 异常记录→治疗方案流程改造完成 ✅

## 📋 改造总结

已完成异常记录到治疗方案的完整流程改造，现在逻辑正确、清晰明确。

---

## ✅ 已完成的改造

### 1. 云函数改造（cloudfunctions/health-management/index.js）

#### 1.1 修改 `createTreatmentFromAbnormal` 函数
**位置：** 第309-401行

**改动：**
- 创建治疗记录时标记为草稿：`isDraft: true`
- 治疗状态设为待提交：`outcome.status: 'pending'`
- **不再更新异常记录状态**，保持为 `abnormal`
- 只关联治疗记录ID：`treatmentRecordId`

```javascript
// ✅ 关键改动
const treatmentData = {
  // ...
  outcome: {
    status: 'pending',  // 待提交（不是 ongoing）
    // ...
  },
  isDraft: true,  // 标记为草稿
  // ...
}

// ✅ 不更新异常记录状态
await db.collection(COLLECTIONS.HEALTH_RECORDS)
  .doc(abnormalRecordId)
  .update({
    data: {
      treatmentRecordId: treatmentResult._id,  // 只关联ID
      updatedAt: new Date()
      // ❌ 不修改 status 字段！
    }
  })
```

#### 1.2 新增 `submitTreatmentPlan` 函数
**位置：** 第480-539行

**功能：** 提交治疗计划时调用，将草稿变为正式记录

```javascript
async function submitTreatmentPlan(event, wxContext) {
  // 1. 更新治疗记录状态
  await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
    .doc(treatmentId)
    .update({
      data: {
        isDraft: false,
        'outcome.status': 'ongoing',
        updatedAt: new Date()
      }
    })
  
  // 2. 根据治疗类型更新异常记录状态
  const newStatus = treatmentType === 'isolation' ? 'isolated' : 'treating'
  
  await db.collection(COLLECTIONS.HEALTH_RECORDS)
    .doc(abnormalRecordId)
    .update({
      data: {
        status: newStatus,  // treating 或 isolated
        updatedAt: new Date()
      }
    })
}
```

#### 1.3 新增 `getTreatmentRecordDetail` 函数
**位置：** 第1011-1042行

**功能：** 获取治疗记录详情，用于编辑草稿

```javascript
async function getTreatmentRecordDetail(event, wxContext) {
  const result = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
    .doc(treatmentId)
    .get()
  
  return {
    success: true,
    data: result.data
  }
}
```

#### 1.4 新增 `updateTreatmentRecord` 函数
**位置：** 第1044-1092行

**功能：** 更新治疗记录的详细信息

```javascript
async function updateTreatmentRecord(event, wxContext) {
  const { treatmentId, updateData } = event
  
  updateData.updatedAt = new Date()
  
  await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
    .doc(treatmentId)
    .update({ data: updateData })
  
  return {
    success: true,
    message: '更新成功'
  }
}
```

#### 1.5 恢复查询逻辑
**位置：** 第480-522行（getAbnormalRecords）、第524-570行（listAbnormalRecords）

**改动：** 查询条件改回只查询 `status: 'abnormal'` 的记录

```javascript
let whereCondition = {
  recordType: 'ai_diagnosis',
  status: 'abnormal',  // ✅ 只显示待处理的记录
  isDeleted: _.neq(true)
}
```

#### 1.6 添加新的 case 分支
**位置：** 第1640-1650行

```javascript
case 'submit_treatment_plan':
  return await submitTreatmentPlan(event, wxContext)

case 'get_treatment_record_detail':
  return await getTreatmentRecordDetail(event, wxContext)

case 'update_treatment_record':
  return await updateTreatmentRecord(event, wxContext)
```

---

### 2. 前端改造（miniprogram/packageHealth/treatment-record/）

#### 2.1 TypeScript 文件改造（treatment-record.ts）

**新增数据字段：**
```typescript
data: {
  treatmentId: '',         // 治疗记录ID
  abnormalRecordId: '',    // 关联的异常记录ID
  isDraft: false,          // 是否为草稿状态
  isEditMode: false        // 是否为编辑模式
}
```

**新增/修改方法：**

1. **`loadTreatmentRecord`** - 加载治疗记录详情（第142-187行）
   - 从云函数加载治疗记录
   - 填充表单数据
   - 设置 `isDraft` 和 `abnormalRecordId`

2. **`submitForm`** - 提交表单（第599-629行）
   - 判断是否为草稿状态
   - 草稿：调用 `submitTreatmentPlan`
   - 非草稿：调用 `createTreatmentRecord`

3. **`submitTreatmentPlan`** - 提交治疗计划（第631-667行）
   - 更新治疗记录详情
   - 调用云函数 `submit_treatment_plan`
   - 更新异常记录状态
   - 返回异常记录列表

4. **`updateTreatmentRecord`** - 更新治疗记录（第669-702行）
   - 保存治疗表单的所有信息
   - 调用云函数 `update_treatment_record`

5. **`createTreatmentRecord`** - 创建新治疗记录（第704-767行）
   - 原有逻辑，创建全新的治疗记录

#### 2.2 WXML 文件改造（treatment-record.wxml）

**按钮文字动态显示：** 第214-232行

```xml
<!-- 操作按钮 -->
<view class="action-buttons">
  <!-- 编辑模式下不显示重置按钮 -->
  <t-button 
    theme="light" 
    size="large" 
    bind:tap="resetForm"
    disabled="{{submitting}}"
    wx:if="{{!isEditMode}}"
  >
    重置
  </t-button>
  
  <!-- 根据状态显示不同的按钮文字 -->
  <t-button 
    theme="primary" 
    size="large" 
    bind:tap="submitForm"
    loading="{{submitting}}"
  >
    {{isDraft ? '提交治疗方案' : (isEditMode ? '保存修改' : '保存记录')}}
  </t-button>
</view>
```

**按钮文字逻辑：**
- `isDraft = true` → 显示"提交治疗方案"
- `isEditMode = true` → 显示"保存修改"
- 否则 → 显示"保存记录"

---

### 3. 其他修改

#### 3.1 异常记录详情页（abnormal-record-detail）

**WXML 改动：** 删除了治疗方式选择对话框

**TS 改动：**
- 删除了 `showTreatmentDialog` 和 `selectedTreatmentType` 状态
- 删除了选择对话框相关的4个方法
- 新增 `createTreatmentPlan` 方法，直接创建治疗记录并跳转

#### 3.2 AI诊断详情页

**状态标签：**
- 移除了 `severity`（病情严重程度）标签
- 移除了 `urgency`（处理紧急程度）标签
- 只保留置信度显示

---

## 🎯 正确的业务流程

```mermaid
graph TD
    A[异常记录详情<br/>status: abnormal] --> B[点击"制定治疗方案"]
    B --> C[创建草稿治疗记录<br/>isDraft: true<br/>outcome.status: pending]
    C --> D[跳转到治疗表单页面]
    D --> E[用户填写治疗信息]
    E --> F{填写完成}
    F -->|点击"提交治疗方案"| G[调用 submit_treatment_plan]
    G --> H{治疗类型}
    H -->|medication| I[status: treating]
    H -->|isolation| J[status: isolated]
    H -->|supportive| K[status: treating]
    I --> L[从异常记录列表移除]
    J --> L
    K --> L
    L --> M[进入治疗记录管理]
```

---

## 📊 状态流转表

| 阶段 | 异常记录状态 | 治疗记录状态 | 说明 |
|------|-------------|-------------|------|
| 1. 创建异常记录 | `abnormal` | - | 显示在异常记录列表 |
| 2. 点击"制定治疗方案" | `abnormal` | `pending` (草稿) | 异常记录状态不变 |
| 3. 跳转到治疗表单 | `abnormal` | `pending` (草稿) | 用户填写治疗信息 |
| 4. 提交治疗方案 | `treating`/`isolated` | `ongoing` | 异常记录从列表移除 |
| 5. 治疗记录管理 | - | `ongoing` → `completed` | 正式的治疗流程 |

---

## 🔧 数据库字段说明

### health_treatment_records 集合

**新增字段：**
- `isDraft`: Boolean - 是否为草稿
  - `true`: 从异常记录创建，还未提交
  - `false`: 已正式提交或直接创建的治疗记录

- `abnormalRecordId`: String - 关联的异常记录ID
  - 从异常记录创建时会填充此字段
  - 用于提交时更新异常记录状态

**`outcome.status` 字段：**
- `'pending'`: 待提交（草稿阶段）
- `'ongoing'`: 治疗中（已提交）
- `'completed'`: 已完成
- `'terminated'`: 已中止

### health_records 集合（异常记录）

**`status` 字段：**
- `'abnormal'`: 待处理 - **显示在异常记录列表中**
- `'treating'`: 治疗中 - 已提交药物治疗方案
- `'isolated'`: 已隔离 - 已提交隔离观察方案

**新增字段：**
- `treatmentRecordId`: String - 关联的治疗记录ID
  - 点击"制定治疗方案"时创建关联
  - 方便查找对应的治疗记录

---

## 🚀 部署步骤

### 1. 重新上传云函数
```bash
右键点击 cloudfunctions/health-management
→ 选择"上传并部署：云端安装依赖"
```

### 2. 前端文件已修改
- ✅ `miniprogram/packageHealth/treatment-record/treatment-record.ts`
- ✅ `miniprogram/packageHealth/treatment-record/treatment-record.wxml`
- ✅ `miniprogram/packageHealth/abnormal-record-detail/abnormal-record-detail.ts`
- ✅ `miniprogram/packageHealth/abnormal-record-detail/abnormal-record-detail.wxml`

### 3. 编译并测试
```bash
在微信开发者工具中：
1. 点击"编译"按钮
2. 测试完整流程
```

---

## ✅ 测试清单

- [ ] 异常记录列表正常显示 `status: 'abnormal'` 的记录
- [ ] 点击"制定治疗方案"后，跳转到治疗表单页面
- [ ] 治疗表单页面显示"提交治疗方案"按钮（而不是"保存记录"）
- [ ] 异常记录状态仍为 `abnormal`（在列表中仍可见）
- [ ] 填写治疗信息（用药、方案等）
- [ ] 点击"提交治疗方案"后，提示成功
- [ ] 异常记录状态变为 `treating`（药物治疗）或 `isolated`（隔离观察）
- [ ] 异常记录从列表中消失
- [ ] 治疗记录出现在治疗记录管理列表中
- [ ] 治疗记录状态为 `ongoing`

---

## 📝 API接口清单

### 新增接口

| Action | 功能 | 参数 |
|--------|------|------|
| `submit_treatment_plan` | 提交治疗计划 | `treatmentId`, `abnormalRecordId`, `treatmentType` |
| `get_treatment_record_detail` | 获取治疗记录详情 | `treatmentId` |
| `update_treatment_record` | 更新治疗记录 | `treatmentId`, `updateData` |

### 修改接口

| Action | 修改内容 |
|--------|---------|
| `create_treatment_from_abnormal` | 不再更新异常记录状态，只创建草稿治疗记录 |
| `get_abnormal_records` | 只查询 `status: 'abnormal'` 的记录 |
| `list_abnormal_records` | 只查询 `status: 'abnormal'` 的记录 |

---

## 📚 相关文档

- [ABNORMAL_RECORD_TREATMENT_FLOW.md](./ABNORMAL_RECORD_TREATMENT_FLOW.md) - 详细的业务流程说明
- [HEALTH_ISOLATION_RECORDS_CONFIG.md](./HEALTH_ISOLATION_RECORDS_CONFIG.md) - 隔离记录配置

---

## 🎉 完成状态

✅ **云函数改造完成** - 5个新增/修改的函数  
✅ **前端改造完成** - 治疗记录表单页面和异常记录详情页  
✅ **流程文档完成** - 详细的业务流程和技术说明  
✅ **测试清单完成** - 完整的功能测试点  

**改造完成时间：** 2025-10-26

**下一步：** 部署到云端并进行完整功能测试

