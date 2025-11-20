# 单批次数据不一致问题 - 最终修复方案

## 🎯 问题现象

**用户截图对比**：
- **全部批次**：待处理0，治疗中7，治愈数1，死亡数0 ✅
- **单批次QY-20251118**：待处理1，治疗中0，治愈数1，死亡数1 ❌

**控制台日志显示**：
```javascript
// loadTreatmentData 返回的数据是正确的：
{pendingDiagnosis: 0, ongoingTreatment: 7, recoveredCount: 1, deadCount: 0}
```

**矛盾**：云函数返回正确数据，但页面显示错误数据！

## 🔍 深度分析

### 问题根源：双重数据加载

#### 执行流程
```
loadHealthData()
  ├─> loadSingleBatchDataOptimized()  // 调用 get_batch_complete_data
  │     └─> setData({ treatmentData.stats: 旧数据 })  ❌ 错误数据
  │
  └─> loadTreatmentData()  // 调用 getDashboardSnapshot
        └─> setData({ treatmentData.stats: 新数据 })  ✅ 正确数据
```

**问题**：`loadSingleBatchDataOptimized` 先执行，设置了错误的数据，然后被 `loadTreatmentData` 的正确数据覆盖。但是由于某些原因（可能是异步时序问题），最终显示的是错误数据。

### 为什么数据不同？

#### 1. getDashboardSnapshot（新逻辑，正确）
```javascript
// cloudfunctions/health-management/index.js 第2721-2840行
async function getDashboardSnapshotForBatches(batchIds, ...) {
  // 1. 调用 calculateBatchTreatmentCosts 汇总治疗数据
  const treatmentResult = await calculateBatchTreatmentCosts({ batchIds }, wxContext)
  
  // 2. 汇总所有批次的 ongoingAnimalsCount
  Object.values(treatmentResult.data).forEach((stats) => {
    totalOngoing += Number(stats.ongoingAnimalsCount || 0)
    totalCured += Number(stats.totalCuredAnimals || 0)
    // ...
  })
  
  // 3. 查询待处理诊断
  const pendingCountResult = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
    .where({
      _openid: wxContext.OPENID,
      isDeleted: false,
      hasTreatment: false,
      ...(batchIds.length === 1 ? { batchId: batchIds[0] } : {})
    })
    .count()
  
  return {
    pendingDiagnosis: pendingCountResult?.total || 0,
    totalOngoing: totalOngoing,
    totalCured: totalCured,
    deadCount: deadCount
  }
}
```

#### 2. get_batch_complete_data（旧逻辑，不准确）
```javascript
// cloudfunctions/health-management/index.js 第3656-3727行
async function getBatchCompleteData(event, wxContext) {
  // ❌ 直接聚合 health_treatment_records，不使用 calculateBatchTreatmentCosts
  const treatmentStatsResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
    .aggregate()
    .match({ batchId, isDeleted: false })
    .group({
      ongoingCount: $.sum($.cond({
        if: $.or([$.eq(['$status', 'ongoing']), $.eq(['$status', 'pending'])]),
        then: 1,
        else: 0
      })),
      totalCuredAnimals: $.sum('$curedCount'),
      // ...
    })
    .end()
  
  // ❌ 没有正确计算 ongoingAnimalsCount，直接设为0
  result.treatmentStats = {
    ongoingCount: statsData.ongoingCount || 0,
    ongoingAnimalsCount: 0,  // ❌ 硬编码为0！
    totalCuredAnimals: statsData.totalCuredAnimals || 0,
    deadCount: statsData.totalDiedAnimals || 0
  }
}
```

**关键差异**：
1. `getDashboardSnapshot` 使用 `calculateBatchTreatmentCosts`（会计算 `ongoingAnimalsCount`）
2. `get_batch_complete_data` 直接聚合，`ongoingAnimalsCount` 硬编码为0
3. 待处理诊断的查询逻辑也可能不同

### 为什么会出现"待处理1，治疗中0"？

从记忆库检索到的信息：
> **云函数创建的记录缺少 `_openid` 字段**！
> - 客户端 `add()` 会自动添加 `_openid`
> - 云函数 `add()` 不会自动添加 `_openid`（需要手动设置）

**可能的原因**：
1. 某些治疗记录是云函数创建的，缺少 `_openid` 字段
2. `get_batch_complete_data` 查询时使用 `batchId` 作为条件（能查到）
3. `getDashboardSnapshot` 查询时使用 `_openid` 作为条件（查不到缺少_openid的记录）

**验证方法**：
```javascript
// 在云函数控制台执行
db.collection('health_treatment_records')
  .where({ batchId: 'QY-20251118' })
  .get()
  .then(res => {
    console.log('总记录数:', res.data.length)
    console.log('有_openid的记录:', res.data.filter(r => r._openid).length)
    console.log('缺少_openid的记录:', res.data.filter(r => !r._openid).length)
  })
```

## ✅ 修复方案

### 方案1：统一使用 getDashboardSnapshot（已实施）

**前端修改**：
```typescript
// health.ts 第766-768行
// ✅ 统一使用 loadAllBatchesData，无论全部批次还是单批次
await this.loadAllBatchesData()
```

**优点**：
- ✅ 数据计算逻辑完全一致
- ✅ 无需修改云函数
- ✅ 减少代码冗余

**缺点**：
- 单批次模式下会调用更复杂的API（但性能影响可忽略）

### 方案2：修复 get_batch_complete_data（备选）

修改云函数，让 `get_batch_complete_data` 也调用 `calculateBatchTreatmentCosts`：

```javascript
// ✅ 修改治疗统计部分
if (!includes.length || includes.includes('treatment')) {
  promises.push(
    (async () => {
      try {
        // ✅ 使用统一的 calculateBatchTreatmentCosts
        const treatmentResult = await calculateBatchTreatmentCosts({ batchIds: [batchId] }, wxContext)
        const stats = treatmentResult.data?.[batchId] || {}
        
        result.treatmentStats = {
          totalCost: Number((stats.totalCost || 0).toFixed(2)),
          ongoingCount: stats.ongoingCount || 0,
          ongoingAnimalsCount: stats.ongoingAnimalsCount || 0,  // ✅ 正确值
          totalCuredAnimals: stats.totalCuredAnimals || 0,
          deadCount: stats.totalDiedAnimals || 0,
          cureRate: stats.cureRate || '0'
        }
      } catch (error) {
        console.error('获取治疗统计失败:', error)
        result.treatmentStats = null
      }
    })()
  )
}
```

## 🚀 部署步骤

### 1. 前端修改（已完成）
- ✅ 修改 `health.ts` 统一使用 `loadAllBatchesData`

### 2. 云函数修改（已完成）
- ✅ 创建统一的 `getDashboardSnapshotForBatches` 函数
- ✅ 单批次和全部批次都使用相同逻辑

### 3. 重新部署云函数 ⚠️ **必须执行**
```bash
# 在微信开发者工具中
右键 cloudfunctions/health-management → 上传并部署：云端安装依赖
```

### 4. 清除缓存 ⚠️ **必须执行**
```javascript
// 在小程序控制台执行
wx.clearStorageSync()
```

### 5. 验证数据
- [ ] 切换到"全部批次"，记录4个卡片数字
- [ ] 切换到"QY-20251118"，记录4个卡片数字
- [ ] **应该完全一致！**

## 📊 预期结果

### 修复后两种模式应显示相同数据：

| 模式 | 待处理 | 治疗中 | 治愈数 | 死亡数 |
|-----|-------|-------|-------|-------|
| 全部批次 | 0 | 7 | 1 | 0 |
| 单批次 QY-20251118 | 0 | 7 | 1 | 0 |

## ⚠️ 如果问题仍然存在

### 检查 _openid 字段

执行修复脚本：
```javascript
// 在小程序中调用
wx.cloud.callFunction({
  name: 'health-management',
  data: { action: 'fix_treatment_records_openid' }
})
```

### 检查数据一致性

在云函数控制台执行：
```javascript
const db = cloud.database()
const _ = db.command

// 检查治疗记录的_openid字段
db.collection('health_treatment_records')
  .where({ batchId: 'QY-20251118' })
  .get()
  .then(res => {
    console.log('批次治疗记录：')
    res.data.forEach(record => {
      console.log({
        _id: record._id,
        batchId: record.batchId,
        hasOpenid: !!record._openid,
        status: record.outcome?.status || record.status
      })
    })
  })

// 检查诊断记录的hasTreatment字段
db.collection('health_ai_diagnosis')
  .where({ batchId: 'QY-20251118', isDeleted: false })
  .get()
  .then(res => {
    console.log('批次诊断记录：')
    res.data.forEach(record => {
      console.log({
        _id: record._id,
        diagnosisTime: record.diagnosisTime,
        hasTreatment: record.hasTreatment
      })
    })
  })
```

## 🎉 总结

### 修改的文件
1. ✅ `/miniprogram/pages/health/health.ts` - 第766-768行（统一数据加载）
2. ✅ `/cloudfunctions/health-management/index.js` - 第2717-2869行（统一汇总逻辑）

### 核心原理
**单批次和全部批次必须使用相同的数据计算逻辑！**

### 关键改进
- 删除了 `loadSingleBatchDataOptimized` 的调用
- 统一使用 `getDashboardSnapshot` 获取数据
- 确保数据结构和计算方式完全一致

---

**修复日期**：2024-11-20
**修复者**：AI Assistant
**版本**：v5.0（单批次数据一致性最终修复版）
