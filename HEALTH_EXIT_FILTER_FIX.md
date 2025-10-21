# 健康页面出栏批次过滤修复

## 问题描述

1. **已出栏批次仍然显示** - 健康页面显示了已完全出栏的批次
2. **默认视图不正确** - 打开健康页时默认显示批次汇总，而不是详情视图

## 根本原因

### 问题 1：出栏批次过滤逻辑错误

**出栏记录的数据结构**：
- 入栏记录：`prod_batch_entries`（批次号、数量）
- 出栏记录：`prod_batch_exits`（批次号、出栏数量）
- **关键**：出栏记录是独立的collection，不会修改入栏记录的 `status` 字段

**原错误逻辑**：
```javascript
// ❌ 只检查 status 字段，但出栏不会改变这个字段
const isNotExited = record.status !== '已出栏' && record.status !== '出栏'
```

**正确逻辑**：
需要跨集合查询，对比出栏数量和入栏数量：
```javascript
// ✅ 查询出栏记录，计算累计出栏数量
const totalExited = exitQuantityMap[record.batchNumber] || 0
const isNotFullyExited = totalExited < (record.quantity || 0)
```

### 问题 2：默认视图错误

**原逻辑**：
```javascript
const viewMode = options.viewMode || 'summary'  // ❌ 默认汇总视图
```

**修复后**：
```javascript
// ✅ 仅当明确指定才显示汇总视图，否则默认详情视图
if (viewMode === 'summary') {
  // 显示批次汇总
} else {
  // 默认显示详情视图
}
```

## 解决方案

### 1. 修改 `health-management` 云函数

**文件**: `cloudfunctions/health-management/index.js`

**函数**: `getAllBatchesHealthSummary`

**修改内容**：
```javascript
// 1. 查询所有入栏记录
const allBatchesResult = await db.collection('prod_batch_entries')
  .where({ userId: wxContext.OPENID })
  .get()

// 2. 查询所有出栏记录
const exitRecordsResult = await db.collection('prod_batch_exits')
  .where({ userId: wxContext.OPENID })
  .get()

// 3. 统计每个批次的累计出栏数量
const exitQuantityMap = {}
exitRecordsResult.data.forEach(exitRecord => {
  const batchNumber = exitRecord.batchNumber
  exitQuantityMap[batchNumber] = (exitQuantityMap[batchNumber] || 0) + exitRecord.quantity
})

// 4. 过滤存栏批次
const batches = allBatchesResult.data.filter(record => {
  const isNotDeleted = record.isDeleted !== true
  const totalExited = exitQuantityMap[record.batchNumber] || 0
  const isNotFullyExited = totalExited < record.quantity  // 核心判断
  return isNotDeleted && isNotFullyExited
})
```

### 2. 修改 `production-entry` 云函数

**文件**: `cloudfunctions/production-entry/index.js`

**函数**: `getActiveBatches`

**修改内容**：使用与 `getAllBatchesHealthSummary` 相同的过滤逻辑，确保两个函数返回的存栏批次一致。

### 3. 修改健康页面默认视图

**文件**: `miniprogram/pages/health/health.ts`

**函数**: `onLoad`

**修改前**：
```typescript
const viewMode = options.viewMode || 'summary'  // 默认汇总视图
```

**修改后**：
```typescript
if (viewMode === 'summary') {
  // 明确指定汇总视图
  this.setData({ viewMode: 'summary' })
  this.loadAllBatchesHealthSummary()
} else {
  // 默认详情视图
  this.setData({ viewMode: 'detail' })
  this.loadHealthData()
}
```

**同步修改**: `onShow` 和 `onPullDownRefresh` 也需要根据 `viewMode` 加载对应数据。

## 判断逻辑详解

### 完全出栏的判断

```javascript
// 入栏数量
const entryQuantity = 1000

// 累计出栏数量（可能多次出栏）
const totalExited = 300 + 400 + 300 = 1000

// 判断
if (totalExited >= entryQuantity) {
  // 完全出栏，不显示在健康页
} else {
  // 部分出栏或未出栏，继续显示
}
```

### 部分出栏的处理

如果批次部分出栏（例如入栏1000只，出栏300只），该批次：
- ✅ **仍然显示在健康页**（剩余700只需要管理）
- ✅ **显示当前存栏数**（入栏数 - 累计出栏数）
- ✅ **健康统计基于当前存栏**

## 测试场景

### 场景 1：完全出栏批次

| 批次号 | 入栏数量 | 出栏记录 | 累计出栏 | 是否显示 |
|--------|----------|----------|----------|----------|
| QY-001 | 1000     | 500 + 500 | 1000    | ❌ 不显示 |

### 场景 2：部分出栏批次

| 批次号 | 入栏数量 | 出栏记录 | 累计出栏 | 是否显示 |
|--------|----------|----------|----------|----------|
| QY-002 | 1000     | 300     | 300     | ✅ 显示（700只） |

### 场景 3：未出栏批次

| 批次号 | 入栏数量 | 出栏记录 | 累计出栏 | 是否显示 |
|--------|----------|----------|----------|----------|
| QY-003 | 1000     | 无      | 0       | ✅ 显示（1000只） |

### 场景 4：已删除批次

| 批次号 | 入栏数量 | isDeleted | 累计出栏 | 是否显示 |
|--------|----------|-----------|----------|----------|
| QY-004 | 1000     | true      | 0        | ❌ 不显示 |

## 修改的文件

1. `cloudfunctions/health-management/index.js` - 批次汇总查询优化
2. `cloudfunctions/production-entry/index.js` - 活跃批次查询优化
3. `miniprogram/pages/health/health.ts` - 默认视图调整

## 预期效果

1. ✅ **只显示存栏批次**：完全出栏的批次不再出现在健康页
2. ✅ **支持部分出栏**：部分出栏的批次仍然显示，显示剩余数量
3. ✅ **默认详情视图**：打开健康页直接进入详情视图，可查看具体数据
4. ✅ **汇总视图保留**：需要查看所有批次时，可以点击"返回批次列表"进入汇总视图
5. ✅ **多用户隔离**：每个用户只能看到自己的批次

## 性能考虑

### 当前实现

- 每次查询需要读取两个collection（`prod_batch_entries` + `prod_batch_exits`）
- 在应用层计算累计出栏数量

### 优化建议（后续）

1. **在入栏记录中增加 `remainingQuantity` 字段**：
   ```javascript
   {
     batchNumber: 'QY-001',
     quantity: 1000,          // 入栏数量
     remainingQuantity: 700,  // 当前存栏数量（动态更新）
     totalExited: 300         // 累计出栏数量
   }
   ```

2. **出栏时更新入栏记录**：
   ```javascript
   // 创建出栏记录时
   await db.collection('prod_batch_entries').where({ batchNumber }).update({
     remainingQuantity: _.inc(-exitQuantity),
     totalExited: _.inc(exitQuantity)
   })
   ```

3. **查询优化**：
   ```javascript
   // 只需查询一个collection
   const batches = await db.collection('prod_batch_entries')
     .where({
       userId: wxContext.OPENID,
       remainingQuantity: _.gt(0),  // 剩余数量 > 0
       isDeleted: _.neq(true)
     })
     .get()
   ```

## 数据一致性保证

如果采用优化方案，需要确保：
1. 出栏云函数必须同时更新入栏记录
2. 删除出栏记录时需要回滚入栏记录
3. 可以添加定时任务校验数据一致性

## 修复日期

2025-10-21

