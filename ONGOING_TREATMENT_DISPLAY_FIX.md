# 治疗中列表显示问题修复

## 📋 问题描述

健康管理中心的"治疗中"卡片显示数字为1，但点击后提示"暂无进行中的治疗"，列表为空。

## 🔍 问题根源

**不一致的查询条件**：

1. **统计数字**（显示为1）：
   - 来源：`calculate_treatment_cost` 云函数
   - 查询条件：`r.outcome?.status === 'ongoing'` ✅ 正确

2. **列表数据**（显示为空）：
   - 来源：`get_ongoing_treatments` 云函数
   - 查询条件：`treatmentStatus: 'ongoing'` ❌ 错误
   - 实际字段：治疗记录使用的是 `outcome.status`，而不是 `treatmentStatus`

## ⚠️ 问题原因

治疗记录的数据结构中：
- ✅ **有** `outcome.status` 字段（值为 'ongoing', 'cured', 'died', 'pending'）
- ❌ **没有** `treatmentStatus` 字段

所以 `getOngoingTreatments` 查询条件不匹配，导致返回空数组。

## ✅ 修复方案

**文件**: `cloudfunctions/health-management/index.js`

### 修复前（错误）

```javascript
async function getOngoingTreatments(batchId, wxContext) {
  try {
    let query = db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        treatmentStatus: 'ongoing',  // ❌ 错误：这个字段不存在
        isDeleted: false
      })
    
    // ... 其他代码
    
    return {
      success: true,
      data: {
        treatments: records.data,  // ❌ 返回所有记录（但实际查询结果为空）
        count: records.data.length
      }
    }
  }
}
```

### 修复后（正确）

```javascript
async function getOngoingTreatments(batchId, wxContext) {
  try {
    let query = db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        isDeleted: false,
        isDraft: false  // ✅ 只查询非草稿记录
      })
    
    if (batchId && batchId !== 'all') {
      query = query.where({ batchId })
    }
    
    const records = await query.orderBy('treatmentDate', 'desc').get()
    
    // ✅ 在代码中过滤 outcome.status === 'ongoing' 的记录
    const ongoingTreatments = records.data.filter(r => r.outcome?.status === 'ongoing')
    
    console.log(\`✅ 进行中的治疗记录: \${ongoingTreatments.length} / 总记录: \${records.data.length}\`)
    
    return {
      success: true,
      data: {
        treatments: ongoingTreatments,  // ✅ 只返回进行中的治疗
        count: ongoingTreatments.length
      }
    }
  } catch (error) {
    console.error('❌ 获取治疗记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取治疗记录失败'
    }
  }
}
```

## 🔑 关键改进

1. **移除错误字段**：删除 `treatmentStatus: 'ongoing'` 查询条件
2. **先查后过滤**：先查询所有非草稿、未删除的记录，然后在代码中过滤
3. **使用正确字段**：过滤条件改为 `r.outcome?.status === 'ongoing'`
4. **添加草稿过滤**：增加 `isDraft: false` 条件，排除草稿记录
5. **添加调试日志**：记录查询到的总记录数和过滤后的记录数

## 📊 治疗记录状态字段说明

### 完整数据结构

```javascript
{
  _id: "治疗记录ID",
  batchId: "批次ID",
  abnormalRecordId: "异常记录ID",
  treatmentDate: "2025-10-27",
  treatmentType: "medication",  // medication | isolation
  diagnosis: {
    preliminary: "鸭传染性浆膜炎",
    confirmed: "鸭传染性浆膜炎",
    diagnosisMethod: "ai"
  },
  outcome: {
    status: "ongoing",      // ✅ 关键字段：pending | ongoing | cured | died
    curedCount: 0,
    improvedCount: 0,
    deathCount: 0,
    totalTreated: 5
  },
  medications: [...],
  isDraft: false,          // ✅ 是否为草稿
  isDeleted: false,        // ✅ 是否已删除
  createdAt: "2025-10-27T10:30:00.000Z",
  updatedAt: "2025-10-27T10:30:00.000Z"
}
```

### 状态值说明

- `pending`: 待开始（刚创建，还未实际开始治疗）
- `ongoing`: 进行中（正在治疗）
- `cured`: 已治愈（治疗完成，动物痊愈）
- `died`: 已死亡（治疗过程中动物死亡）

## 🔄 数据流转

```
1. 用户点击"治疗中"卡片
   ↓
2. 前端调用 onOngoingTreatmentClick()
   ↓
3. 读取 treatmentData.currentTreatments 数组
   ↓
4. 数据来源：loadTreatmentData() 
   → 调用 get_ongoing_treatments 云函数
   ↓
5. 云函数查询条件：
   - isDeleted: false
   - isDraft: false
   - 批次筛选
   ↓
6. 代码过滤：r.outcome?.status === 'ongoing'
   ↓
7. 返回进行中的治疗列表
   ↓
8. 前端显示治疗列表供用户选择
```

## 🚀 部署步骤

1. **上传云函数**：
   ```bash
   右键 cloudfunctions/health-management
   → 上传并部署：云端安装依赖
   ```

2. **刷新页面**：
   - 重新进入健康管理中心
   - 等待数据加载完成

3. **测试验证**：
   - 查看"治疗中"卡片数字
   - 点击卡片，查看是否显示治疗列表
   - 选择治疗记录，进入详情页

## 📝 测试要点

### 测试场景1：有进行中的治疗
- ✅ "治疗中"卡片显示正确数字（如：1）
- ✅ 点击卡片，显示治疗列表
- ✅ 列表中显示治疗记录（诊断 - 受影响数量）
- ✅ 点击列表项，跳转到治疗记录详情页

### 测试场景2：没有进行中的治疗
- ✅ "治疗中"卡片显示 0
- ✅ 点击卡片，提示"暂无进行中的治疗"

### 测试场景3：草稿记录
- ✅ 草稿记录（isDraft: true）不计入"治疗中"
- ✅ 只有正式提交的记录（isDraft: false）才显示

### 测试场景4：已结束的治疗
- ✅ 已治愈（outcome.status: 'cured'）不计入
- ✅ 已死亡（outcome.status: 'died'）不计入
- ✅ 只有进行中（outcome.status: 'ongoing'）才显示

## 🎯 相关云函数对比

### 1. get_ongoing_treatments（现已修复）
- **用途**：获取进行中的治疗列表
- **查询条件**：`isDraft: false` + 代码过滤 `outcome.status === 'ongoing'`
- **返回数据**：完整的治疗记录对象数组

### 2. calculate_treatment_cost（之前已修复）
- **用途**：计算治疗成本和统计数据
- **查询条件**：`isDeleted: false`
- **统计逻辑**：代码过滤 `r.outcome?.status === 'ongoing'`
- **返回数据**：统计数字（ongoingCount, cureRate等）

两者现在使用一致的过滤逻辑，确保统计数字和列表数据匹配！

## 📅 更新记录

- **2025-10-27**: 修复 `getOngoingTreatments` 查询条件
  - 移除错误的 `treatmentStatus` 字段
  - 改用 `outcome.status` 进行过滤
  - 添加 `isDraft: false` 条件
  - 添加调试日志

