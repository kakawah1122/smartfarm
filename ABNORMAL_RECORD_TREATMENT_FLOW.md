# 异常记录 → 治疗方案流程说明

## 业务流程修正

### 之前的错误流程
```
异常记录详情页 
  → 点击"制定治疗方案"
  → 创建治疗记录 + 状态变为 treating  ❌ 
  → 跳转到治疗表单
```

**问题：** 还没填写治疗信息，状态就已经变成"治疗中"了

### 正确的流程
```
异常记录详情页 (status: abnormal)
  → 点击"制定治疗方案"
  → 创建草稿治疗记录 (isDraft: true, outcome.status: pending)
  → 异常记录状态保持 abnormal ✅
  → 跳转到治疗表单页面
  
治疗表单页面
  → 用户填写完整的治疗信息（用药、隔离等）
  → 点击"提交" 
  → 调用 submit_treatment_plan
  → 根据治疗类型更新状态：
     - 药物治疗 → status: treating
     - 隔离观察 → status: isolated
  → 异常记录从列表中移除 ✅
```

---

## 核心修改点

### 1. 创建治疗记录时（createTreatmentFromAbnormal）

**修改内容：**
```javascript
// ✅ 新逻辑：创建草稿状态的治疗记录
const treatmentData = {
  // ...
  outcome: {
    status: 'pending',  // 待提交（而不是 ongoing）
    // ...
  },
  isDraft: true,  // 标记为草稿
  // ...
}

// ✅ 只关联治疗记录ID，不改变异常记录状态
await db.collection(COLLECTIONS.HEALTH_RECORDS)
  .doc(abnormalRecordId)
  .update({
    data: {
      treatmentRecordId: treatmentResult._id,  // 关联ID
      updatedAt: new Date()
      // 不修改 status 字段！
    }
  })
```

### 2. 新增提交治疗计划接口（submitTreatmentPlan）

**云函数调用：**
```javascript
wx.cloud.callFunction({
  name: 'health-management',
  data: {
    action: 'submit_treatment_plan',
    treatmentId: 'xxx',          // 治疗记录ID
    abnormalRecordId: 'xxx',     // 异常记录ID
    treatmentType: 'medication'  // 'medication' | 'isolation'
  }
})
```

**功能：**
1. 将治疗记录从草稿状态变为正式状态
   - `isDraft: false`
   - `outcome.status: 'ongoing'`

2. 根据治疗类型更新异常记录状态：
   - 药物治疗 → `status: 'treating'`
   - 隔离观察 → `status: 'isolated'`

### 3. 查询逻辑恢复

```javascript
// ✅ 只查询待处理的异常记录
let whereCondition = {
  recordType: 'ai_diagnosis',
  status: 'abnormal',  // 只显示待处理的
  isDeleted: _.neq(true)
}
```

**结果：** 一旦提交了治疗计划，记录就会从异常记录列表中移除，进入治疗记录/隔离记录管理。

---

## 前端改造需求

### 治疗记录表单页面需要改造

**需要做的事情：**

1. **判断是否为草稿状态**
```typescript
onLoad(options: any) {
  const treatmentId = options.id
  this.loadTreatmentDetail(treatmentId)
}

loadTreatmentDetail(treatmentId: string) {
  // 加载治疗记录
  const record = await ...
  
  this.setData({
    record,
    isDraft: record.isDraft,  // 判断是否为草稿
    abnormalRecordId: record.abnormalRecordId  // 保存关联的异常记录ID
  })
}
```

2. **提交按钮逻辑**
```typescript
// 如果是草稿，点击"提交"按钮时：
async submitTreatmentPlan() {
  // 1. 保存治疗记录的详细信息（medications, notes等）
  await this.saveTreatmentDetails()
  
  // 2. 调用 submit_treatment_plan 接口
  const result = await wx.cloud.callFunction({
    name: 'health-management',
    data: {
      action: 'submit_treatment_plan',
      treatmentId: this.data.record._id,
      abnormalRecordId: this.data.abnormalRecordId,
      treatmentType: this.data.record.treatmentType  // 'medication' | 'isolation'
    }
  })
  
  if (result.result.success) {
    wx.showToast({ title: '提交成功', icon: 'success' })
    // 跳转回异常记录列表或健康管理页面
    wx.navigateBack()
  }
}

// 如果不是草稿，正常保存即可
async saveTreatmentDetails() {
  // 更新治疗记录的详细信息
  await wx.cloud.callFunction({
    name: 'health-management',
    data: {
      action: 'update_treatment_record',  // 需要实现这个方法
      treatmentId: this.data.record._id,
      updateData: {
        medications: this.data.medications,
        notes: this.data.notes,
        // ...
      }
    }
  })
}
```

3. **UI显示调整**
```xml
<!-- 如果是草稿，显示"提交治疗方案"按钮 -->
<button wx:if="{{isDraft}}" bind:tap="submitTreatmentPlan">
  提交治疗方案
</button>

<!-- 如果不是草稿，显示普通的"保存"按钮 -->
<button wx:else bind:tap="saveTreatmentDetails">
  保存
</button>
```

---

## 状态流转图

```
[异常记录]
   |
   | status: abnormal
   | ↓
   | 点击"制定治疗方案"
   | ↓
   | 创建草稿治疗记录
   | (status 保持 abnormal)
   | ↓
[填写治疗表单]
   |
   | 填写完整信息
   | ↓
   | 点击"提交"
   | ↓
   | 调用 submit_treatment_plan
   | ↓
   ├─→ 药物治疗 → status: treating → [治疗记录管理]
   └─→ 隔离观察 → status: isolated → [隔离记录管理]
```

---

## 数据库字段说明

### health_treatment_records 集合

新增字段：
- `isDraft`: Boolean - 是否为草稿状态
  - `true`: 草稿，用户还未提交完整的治疗方案
  - `false`: 正式记录，已提交并开始执行

- `outcome.status`: String - 执行状态
  - `'pending'`: 待提交（草稿阶段）
  - `'ongoing'`: 治疗中（已提交后）
  - `'completed'`: 已完成
  - `'terminated'`: 已中止

### health_records 集合（异常记录）

`status` 字段的含义：
- `'abnormal'`: 待处理 - 显示在异常记录列表中
- `'treating'`: 治疗中 - 已提交药物治疗方案
- `'isolated'`: 已隔离 - 已提交隔离观察方案

---

## 部署步骤

1. 重新上传 `health-management` 云函数
2. 前端改造治疗记录表单页面
3. 测试完整流程

---

## 测试checklist

- [ ] 点击"制定治疗方案"后，异常记录状态仍为 `abnormal`
- [ ] 跳转到治疗表单页面，显示"提交治疗方案"按钮
- [ ] 填写治疗信息后点击"提交"，异常记录状态变为 `treating` 或 `isolated`
- [ ] 异常记录从列表中消失
- [ ] 治疗记录出现在对应的管理列表中（治疗记录/隔离记录）

