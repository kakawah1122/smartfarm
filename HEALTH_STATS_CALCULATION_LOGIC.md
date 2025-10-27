# 健康管理中心统计数据计算逻辑梳理

## 📊 当前数据结构

### 顶部概览卡片（3个）
1. **健康率** - `healthStats.healthyRate`
2. **治愈率** - `treatmentData.stats.cureRate`
3. **死亡率** - `healthStats.mortalityRate`

### 诊疗管理Tab卡片（4个）
1. **异常** - `monitoringData.realTimeStatus.abnormalCount`
2. **治疗中** - `treatmentData.stats.ongoingTreatment`
3. **隔离** - `monitoringData.realTimeStatus.isolatedCount`
4. **死亡数** - `healthStats.deadCount`

---

## 🔄 数据加载流程

### 批次切换机制
```javascript
// 用户可以选择：
1. "全部批次" (currentBatchId === 'all')
2. 单个批次 (currentBatchId === batchId)

// 切换方法：
- selectAllBatches() - 选择全部批次
- selectBatchFromDropdown(e) - 选择单个批次
```

### 数据加载主入口
```javascript
async loadHealthData() {
  if (this.data.currentBatchId === 'all') {
    await this.loadAllBatchesData()  // 全部批次模式
  } else {
    await Promise.all([
      this.loadHealthOverview(),     // 健康概览
      this.loadPreventionData(),     // 预防数据
      this.loadTreatmentData()       // 治疗数据
    ])
  }
}
```

---

## 📈 计算逻辑详解

### 1. 全部批次模式 (currentBatchId === 'all')

#### 前端计算（health.ts - loadAllBatchesData）
```javascript
// 汇总所有批次的数据
const totalAnimals = batches.reduce((sum, b) => sum + (b.totalCount || 0), 0)
const healthyCount = batches.reduce((sum, b) => sum + (b.healthyCount || 0), 0)
const sickCount = batches.reduce((sum, b) => sum + (b.sickCount || 0), 0)
const deadCount = batches.reduce((sum, b) => sum + (b.deadCount || 0), 0)

// 健康率 = 健康数量 / 总动物数
const healthyRate = totalAnimals > 0 
  ? ((healthyCount / totalAnimals) * 100).toFixed(1) 
  : '100'

// 死亡率 = 死亡数量 / 总动物数
const mortalityRate = totalAnimals > 0 
  ? ((deadCount / totalAnimals) * 100).toFixed(1) 
  : '0'

// ❌ 问题：治愈率在全部批次模式下为 0
treatmentStats: {
  cureRate: 0  // 未实现全部批次的治愈率计算
}
```

#### 数据来源
- 后端云函数：`get_all_batches_health_summary`
- 返回所有批次的健康汇总统计

---

### 2. 单批次模式 (currentBatchId !== 'all')

#### 后端计算（cloudfunctions/health-management/index.js）

**健康率和死亡率**
```javascript
// 获取批次的最新健康记录
const latestRecord = await db.collection('health_records')
  .where({ batchId, isDeleted: false })
  .orderBy('createTime', 'desc')
  .limit(1)
  .get()

if (latestRecord.data.length > 0) {
  const record = latestRecord.data[0]
  healthyCount = record.healthyCount || 0
  sickCount = record.sickCount || 0
  deadCount = record.deadCount || 0
  totalAnimals = record.totalCount || originalQuantity
  
  // 健康率 = 健康数 / 当前总数
  healthyRate = totalAnimals > 0 
    ? ((healthyCount / totalAnimals) * 100).toFixed(1) 
    : 0
  
  // 死亡率 = 死亡数 / 原始入栏数
  mortalityRate = originalQuantity > 0 
    ? ((deadCount / originalQuantity) * 100).toFixed(2) 
    : 0
}
```

**治愈率计算**
```javascript
// 方法1：基于治疗记录数量（云函数暂未完全实现）
recoveryRate = totalTreatments > 0 
  ? ((recoveredCount / totalTreatments) * 100).toFixed(1) 
  : 0

// 方法2：基于治疗动物数量（calculate_treatment_cost）
const totalTreated = records.data.reduce((sum, r) => 
  sum + (r.initialCount || 0), 0)
const totalCuredAnimals = records.data.reduce((sum, r) => 
  sum + (r.curedCount || 0), 0)

cureRate = totalTreated > 0 
  ? ((totalCuredAnimals / totalTreated) * 100).toFixed(1) 
  : 0
```

#### 前端处理（health.ts）
```javascript
// ❌ 问题：loadTreatmentData 方法未完全启用
async loadTreatmentData() {
  // 当前只设置默认值 0
  this.setData({
    'treatmentData.stats': {
      pendingDiagnosis: 0,
      ongoingTreatment: 0,
      totalTreatmentCost: 0,
      cureRate: 0  // 始终为 0
    }
  })
  
  // 实际的云函数调用代码被注释掉了
  // TODO: 待云函数完善后启用
}
```

---

## ⚠️ 当前存在的问题

### 1. 治愈率始终显示 0%
**原因**：
- 单批次模式：`loadTreatmentData()` 方法未启用，直接返回 0
- 全部批次模式：未实现治愈率的汇总计算

**影响**：
- 顶部"治愈率"卡片始终显示 0%，无法反映真实治疗效果

---

### 2. 单批次和全部批次的数据源不一致

| 数据项 | 全部批次 | 单批次 | 一致性 |
|--------|----------|--------|--------|
| 健康率 | 前端汇总计算 | 后端查询 health_records | ❌ 不一致 |
| 死亡率 | 前端汇总 / 总数 | 后端死亡数 / 原始入栏数 | ❌ 计算基数不同 |
| 治愈率 | 未实现（0） | 未启用（0） | ⚠️ 都是 0 |
| 异常数 | sickCount（生病数） | abnormalCount（异常记录数） | ❌ 含义不同 |

---

### 3. 治疗数据未完整加载
**问题**：
- 治疗中、治疗成本等数据显示为 0
- 当前治疗记录列表为空
- AI诊断历史未显示

**原因**：
- `loadTreatmentData()` 方法中的云函数调用代码被注释
- 等待后端云函数完善

---

## 🔧 优化建议

### 方案1：启用单批次治愈率计算（短期方案）

**步骤1：启用前端方法**
```javascript
// health.ts - loadTreatmentData()
async loadTreatmentData() {
  try {
    // 1. 获取治疗成本和统计
    const costResult = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'calculate_treatment_cost',
        batchId: this.data.currentBatchId,
        dateRange: this.data.dateRange
      }
    })
    
    if (costResult.result?.success) {
      const data = costResult.result.data
      this.setData({
        'treatmentData.stats': {
          pendingDiagnosis: 0,
          ongoingTreatment: data.ongoingCount || 0,
          totalTreatmentCost: parseFloat(data.totalCost || '0'),
          cureRate: parseFloat(data.cureRate || '0')  // ✅ 使用后端计算的治愈率
        }
      })
    }
  } catch (error) {
    console.error('加载治疗数据失败:', error)
  }
}
```

**步骤2：验证后端云函数**
- 确认 `calculate_treatment_cost` 方法返回正确的 `cureRate`
- 检查治疗记录的 `curedCount` 和 `initialCount` 字段是否准确

---

### 方案2：实现全部批次治愈率汇总（中期方案）

**步骤1：后端新增方法**
```javascript
// cloudfunctions/health-management/index.js
// 新增：获取所有批次的治疗统计汇总
async function getAllBatchesTreatmentSummary() {
  const batches = await db.collection('production_batches')
    .where({ 
      isDeleted: false,
      status: db.command.in(['in_stock', 'out_stock'])
    })
    .get()
  
  let totalTreated = 0
  let totalCured = 0
  let totalOngoing = 0
  let totalCost = 0
  
  for (const batch of batches.data) {
    const treatmentRecords = await db.collection('health_treatment_records')
      .where({
        batchId: batch._id,
        isDeleted: false
      })
      .get()
    
    for (const record of treatmentRecords.data) {
      totalTreated += record.initialCount || 0
      totalCured += record.curedCount || 0
      if (record.treatmentStatus === 'treating') {
        totalOngoing += record.initialCount || 0
      }
      totalCost += parseFloat(record.totalCost || 0)
    }
  }
  
  const cureRate = totalTreated > 0 
    ? ((totalCured / totalTreated) * 100).toFixed(1) 
    : 0
  
  return {
    totalTreated,
    totalCured,
    totalOngoing,
    totalCost,
    cureRate
  }
}
```

**步骤2：前端调用**
```javascript
// health.ts - loadAllBatchesData()
async loadAllBatchesData() {
  // ... 现有代码 ...
  
  // ✅ 新增：获取全部批次的治疗统计
  const treatmentResult = await wx.cloud.callFunction({
    name: 'health-management',
    data: { action: 'get_all_batches_treatment_summary' }
  })
  
  if (treatmentResult.result?.success) {
    const data = treatmentResult.result.data
    this.setData({
      'treatmentData.stats': {
        ongoingTreatment: data.totalOngoing || 0,
        totalTreatmentCost: data.totalCost || 0,
        cureRate: parseFloat(data.cureRate || '0')  // ✅ 全部批次的治愈率
      }
    })
  }
}
```

---

### 方案3：统一数据源和计算逻辑（长期方案）

**目标**：
1. 统一单批次和全部批次的数据获取方式
2. 统一计算逻辑和基数定义
3. 确保数据实时性和准确性

**架构调整**：
```
前端 (health.ts)
  ↓
  调用云函数统一接口
  ↓
后端 (health-management)
  ├─ get_health_stats(batchId)  // batchId 可以是 'all' 或具体ID
  │   ├─ 健康率计算
  │   ├─ 死亡率计算
  │   └─ 返回统一格式数据
  │
  └─ get_treatment_stats(batchId)
      ├─ 治愈率计算
      ├─ 治疗中统计
      └─ 成本统计
```

---

## 📋 实施优先级

### 🔴 高优先级（立即修复）
1. ✅ **启用单批次治愈率显示**
   - 解注 `loadTreatmentData()` 中的云函数调用
   - 验证后端 `calculate_treatment_cost` 返回数据

### 🟡 中优先级（本周内完成）
2. ✅ **实现全部批次治愈率汇总**
   - 新增后端汇总方法
   - 前端调用并显示

### 🟢 低优先级（后续优化）
3. ✅ **统一数据计算逻辑**
   - 重构统计数据获取架构
   - 确保单批次和全部批次逻辑一致

---

## 🧪 测试验证清单

- [ ] 单批次模式：治愈率正确显示
- [ ] 全部批次模式：治愈率正确汇总
- [ ] 批次切换：数据实时更新
- [ ] 健康率、死亡率：单批次和全部批次计算一致
- [ ] 异常数、治疗中、隔离数：正确统计
- [ ] 边界情况：无治疗记录时显示 0%

---

## 📝 相关文件

**前端**：
- `miniprogram/pages/health/health.ts` - 主要逻辑
- `miniprogram/pages/health/health.wxml` - UI展示

**后端**：
- `cloudfunctions/health-management/index.js` - 统计计算

**数据表**：
- `production_batches` - 批次信息
- `health_records` - 健康记录
- `health_treatment_records` - 治疗记录

