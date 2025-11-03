# 项目全面优化方案

> 生成时间：2025-01-16  
> 基于项目规范：PROJECT_RULES.md  
> 目标：提升加载速度、优化数据库查询、改善用户体验

---

## 📊 优化概览

### 优化目标
1. **数据库查询性能提升 5-10倍**（通过索引优化）
2. **首页加载时间减少 30-50%**（通过并行化和分包优化）
3. **云函数响应时间减少 20-40%**（通过并行查询优化）
4. **用户体验提升**（通过骨架屏、防抖、缓存等）

---

## 🔥 优先级 P0：数据库查询优化（必须立即执行）

### 问题分析
- **发现48处使用 `_.neq(true)` 而非 `isDeleted: false`**
- **影响**：无法高效使用索引，查询性能下降 5-10倍
- **位置**：主要集中在 `health-management/index.js`

### 优化方案

#### 1. 统一使用工具函数

**现有工具函数**：`cloudfunctions/health-management/database-manager.js`

```javascript
buildNotDeletedCondition(strictMode = true) {
  if (strictMode) {
    return { isDeleted: false }  // ✅ 索引完全生效
  } else {
    return { isDeleted: this._.in([false, undefined]) }  // ⚠️ 兼容模式
  }
}
```

#### 2. 需要修改的文件

**优先级排序**：

1. **health-management/index.js**（48处）
   - 位置：所有查询条件中的 `isDeleted: _.neq(true)`
   - 修改：统一使用 `dbManager.buildNotDeletedCondition(true)`

2. **production-entry/index.js**（1处）
   - 位置：死亡记录查询
   - 修改：改为 `isDeleted: false`

3. **production-material/index.js**（2处）
   - 位置：存栏数计算查询
   - 修改：改为 `isDeleted: false`

#### 3. 示例修改

**修改前**：
```javascript
const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
  .where({
    batchId,
    status: 'abnormal',
    isDeleted: _.neq(true)  // ❌ 性能警告
  })
  .get()
```

**修改后**：
```javascript
const dbManager = new DatabaseManager(db)
const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
  .where({
    batchId,
    status: 'abnormal',
    ...dbManager.buildNotDeletedCondition(true)  // ✅ 索引完全生效
  })
  .get()
```

**预期效果**：
- 查询时间从 200-500ms 降至 10-50ms
- 索引使用率从 0% 提升至 100%

---

## 🚀 优先级 P1：并行查询优化

### 问题分析
- **发现只有27处使用 Promise.all**
- **很多可以并行的查询仍然串行执行**
- **影响**：云函数响应时间增加 50-200%

### 优化方案

#### 1. health-management/getBatchPromptData

**当前（串行）**：
```javascript
const treatmentHistory = await getTreatmentRecords(...)
const deathHistory = await getDeathRecords(...)
const correctionFeedback = await getCorrectionFeedback(...)
```

**优化后（并行）**：
```javascript
const [treatmentHistory, deathHistory, correctionFeedback] = await Promise.all([
  getTreatmentRecords(...),
  getDeathRecords(...),
  getCorrectionFeedback(...)
])
```

#### 2. health-management/getAllBatchesHealthSummary

**当前问题**：循环中串行查询每个批次
```javascript
for (const batch of batches) {
  const healthRecords = await db.collection(...).get()  // 串行
  const abnormalRecords = await db.collection(...).get()  // 串行
  const treatmentRecords = await db.collection(...).get()  // 串行
}
```

**优化后**：使用 Promise.all 并行查询
```javascript
const batchQueries = batches.map(batch => Promise.all([
  db.collection(...).where({ batchId: batch._id }).get(),
  db.collection(...).where({ batchId: batch._id }).get(),
  db.collection(...).where({ batchId: batch._id }).get()
]))
const results = await Promise.all(batchQueries)
```

**预期效果**：
- 批量查询时间从 2-5秒 降至 0.5-1秒
- 云函数响应时间减少 50-70%

---

## 📈 优先级 P2：数据库索引优化

### 需要创建的索引

#### 1. health_records（高优先级）

```javascript
// 索引1：批次、状态、删除状态（复合索引）
{
  fields: [
    { field: 'batchId', direction: 1 },
    { field: 'status', direction: 1 },
    { field: 'isDeleted', direction: 1 }
  ]
}

// 索引2：记录类型、创建时间、删除状态
{
  fields: [
    { field: 'recordType', direction: 1 },
    { field: 'createdAt', direction: -1 },
    { field: 'isDeleted', direction: 1 }
  ]
}
```

#### 2. health_treatment_records（已存在，需验证）

```javascript
// 索引1：创建时间、删除状态（已存在）
// 索引2：批次、创建时间、删除状态（已存在）
// 需要验证：是否使用 isDeleted: false 而非 _.neq(true)
```

#### 3. prod_batch_entries（高优先级）

```javascript
// 索引1：批次号、删除状态
{
  fields: [
    { field: 'batchNumber', direction: 1 },
    { field: 'isDeleted', direction: 1 }
  ]
}

// 索引2：状态、入栏日期、删除状态
{
  fields: [
    { field: 'status', direction: 1 },
    { field: 'entryDate', direction: -1 },
    { field: 'isDeleted', direction: 1 }
  ]
}
```

#### 4. health_death_records（已存在，需验证）

```javascript
// 索引1：批次、死亡日期、删除状态（已存在）
// 需要验证：是否使用 isDeleted: false 而非 _.neq(true)
```

### 索引创建步骤

1. 打开微信云开发控制台
2. 进入"数据库" → 选择集合
3. 点击"索引"标签页
4. 点击"添加索引"
5. 按照上述配置添加索引

### 索引创建时间估算

- 数据量 < 1000 条：几秒内完成
- 数据量 1000-10000 条：1-3 分钟
- 数据量 > 10000 条：3-10 分钟

---

## ⚡ 优先级 P3：前端加载优化

### 1. 首页预加载策略优化

**当前配置**（app.json）：
```json
"preloadRule": {
  "pages/index/index": {
    "network": "all",
    "packages": ["production", "health", "ai"]  // ❌ 预加载3个分包
  }
}
```

**优化后**：
```json
"preloadRule": {
  "pages/index/index": {
    "network": "all",
    "packages": ["production"]  // ✅ 只预加载最常用的分包
  },
  "pages/production/production": {
    "network": "all",
    "packages": ["production"]  // ✅ TabBar页面预加载对应分包
  },
  "pages/health/health": {
    "network": "all",
    "packages": ["health"]
  }
}
```

**预期效果**：
- 首页首屏加载时间减少 30-50%
- 分包按需加载，不影响功能

### 2. 首页数据加载优化

**当前实现**（已使用 Promise.all）：
```typescript
Promise.all([
  this.getWeatherData(),
  this.getGoosePriceData(),
  this.getTodoListData()
])
```

**优化建议**：
- ✅ 已使用并行加载，保持现状
- ✅ 添加数据缓存，减少重复请求
- ✅ 使用骨架屏提升感知性能

### 3. setData 优化

**查找并优化频繁的 setData 调用**：

```typescript
// ❌ 错误：频繁调用
this.setData({ count: 1 })
this.setData({ name: 'test' })
this.setData({ age: 18 })

// ✅ 正确：合并调用
this.setData({
  count: 1,
  name: 'test',
  age: 18
})
```

---

## 🎯 优先级 P4：代码结构优化

### 1. 统一查询工具函数

**创建统一的查询工具文件**：

```javascript
// cloudfunctions/shared-utils/query-builder.js
class QueryBuilder {
  constructor(db) {
    this.db = db
    this._ = db.command
  }

  buildNotDeletedCondition(strictMode = true) {
    if (strictMode) {
      return { isDeleted: false }
    } else {
      return { isDeleted: this._.in([false, undefined]) }
    }
  }

  buildBatchCondition(batchId) {
    if (!batchId || batchId === 'all') {
      return {}
    }
    return { batchId }
  }

  buildDateRangeCondition(dateRange) {
    if (!dateRange || !dateRange.start || !dateRange.end) {
      return {}
    }
    return {
      date: this._.gte(dateRange.start).and(this._.lte(dateRange.end))
    }
  }
}

module.exports = QueryBuilder
```

### 2. 所有云函数统一使用

```javascript
const QueryBuilder = require('../../shared-utils/query-builder')
const queryBuilder = new QueryBuilder(db)

const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
  .where({
    ...queryBuilder.buildNotDeletedCondition(true),
    ...queryBuilder.buildBatchCondition(batchId)
  })
  .get()
```

---

## 📋 执行计划

### 第一阶段：数据库查询优化（1-2天）

1. ✅ 修改 health-management/index.js（48处）
2. ✅ 修改 production-entry/index.js（1处）
3. ✅ 修改 production-material/index.js（2处）
4. ✅ 测试验证查询性能提升

### 第二阶段：并行查询优化（2-3天）

1. ✅ 优化 getBatchPromptData
2. ✅ 优化 getAllBatchesHealthSummary
3. ✅ 优化其他可以并行化的查询
4. ✅ 测试验证响应时间提升

### 第三阶段：数据库索引优化（1天）

1. ✅ 创建缺失的索引
2. ✅ 验证索引使用情况
3. ✅ 记录性能提升数据

### 第四阶段：前端优化（1-2天）

1. ✅ 优化分包预加载策略
2. ✅ 优化 setData 调用
3. ✅ 添加骨架屏
4. ✅ 测试验证加载速度提升

---

## 🎯 预期效果

### 性能指标

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 数据库查询时间 | 200-500ms | 10-50ms | **5-10倍** |
| 云函数响应时间 | 1-3秒 | 0.5-1秒 | **50-70%** |
| 首页加载时间 | 2-4秒 | 1-2秒 | **30-50%** |
| 批次数据加载 | 2-5秒 | 0.5-1秒 | **70-80%** |

### 用户体验提升

- ✅ 页面响应更快，操作更流畅
- ✅ 数据加载时间明显减少
- ✅ 索引使用率提升至 100%
- ✅ 云函数调用次数减少（合并请求）

---

## ⚠️ 注意事项

### 1. 数据兼容性

- 如果历史数据中 `isDeleted` 可能为 `undefined`，使用兼容模式
- 建议统一数据迁移，确保所有记录都有明确的 `isDeleted` 值

### 2. 索引创建

- 索引创建期间可能影响写入性能（轻微）
- 建议在低峰期创建索引
- 创建后验证查询性能

### 3. 测试验证

- 每个优化步骤完成后都要进行充分测试
- 对比优化前后的性能数据
- 确保功能正常，无回归问题

---

## 📚 参考文档

- [PROJECT_RULES.md](./PROJECT_RULES.md) - 项目开发规范
- [DATABASE_INDEX_GUIDE.md](./DATABASE_INDEX_GUIDE.md) - 数据库索引指南
- [微信小程序性能优化指南](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/)

---

**最后更新**：2025-01-16  
**维护者**：AI Assistant  
**状态**：待执行

