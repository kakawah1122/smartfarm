# 数据库索引问题修复总结

> 修复日期：2025-11-03  
> 问题类型：字段命名不一致导致索引无法使用

---

## 🎯 问题概述

系统检测到 `prod_batch_exits` 集合存在慢查询，建议创建索引。但用户已按照 `DATABASE_CONFIG_GUIDE.md` 完全正确地配置了索引，仍然收到警告。

经排查发现：**小程序端代码使用了错误的字段名**，导致已配置的索引无法被查询使用。

---

## 🔍 问题分析

### 1. 用户配置（完全正确）

按照 `DATABASE_CONFIG_GUIDE.md` 配置的索引：

```javascript
// 索引1：farmId_1_batchNumber_1
{
  farmId: 1,
  batchNumber: 1  // ✅ 正确的字段名
}

// 索引2：exitDate_-1
{
  exitDate: -1  // ✅ 正确的字段名
}

// 索引3：exitNumber_1（唯一索引）
{
  exitNumber: 1
}
```

### 2. 云函数代码（正确）

`production-exit/index.js` 第 186 行：

```javascript
const existingExits = await db.collection('prod_batch_exits')
  .where({ batchNumber: recordData.batchNumber })  // ✅ 使用正确的 batchNumber
  .get()
```

### 3. 小程序端代码（错误）⚠️

`vaccine-records-list.ts` 第 228-234 行（修复前）：

```typescript
const exitRecords = await db.collection('prod_batch_exits')
  .where({
    batchId: batchData._id,  // ❌ 错误！应该用 batchNumber
    exitDate: _.lte(preventionDate),
    ...buildNotDeletedCondition(db, true)  // 添加 isDeleted: false
  })
  .get()
```

**问题：**
- 使用了 `batchId` 而不是 `batchNumber`
- 导致已配置的索引 `farmId_1_batchNumber_1` 无法被使用
- 触发系统慢查询警告

### 4. 系统检测到的查询

```javascript
db.collection('prod_batch_exits').where({
  batchId: 'd84694f2690844a701fc1f206b404e07',  // ❌ 错误的字段名
  exitDate: _.lte('2025-11-03'),
  isDeleted: false
})
```

**建议的索引：**
```javascript
{
  batchId: 1,      // ❌ 错误的字段名
  isDeleted: 1,
  exitDate: 1
}
```

---

## ✅ 解决方案

### 修复 1：更正小程序端字段名

**文件：** `miniprogram/packageHealth/vaccine-records-list/vaccine-records-list.ts`

**修改：** 第 230 行

```diff
const exitRecords = await db.collection('prod_batch_exits')
  .where({
-   batchId: batchData._id,
+   batchNumber: batchData.batchNumber,  // ✅ 修正：使用 batchNumber
    exitDate: _.lte(preventionDate),
    ...buildNotDeletedCondition(db, true)
  })
  .get()
```

### 修复 2：补充缺失的索引

虽然已有索引 `farmId_1_batchNumber_1` 和 `exitDate_-1`，但新的查询模式包含 `isDeleted` 字段，需要新增组合索引：

**手动创建索引步骤：**

1. 打开微信云开发控制台
2. 进入"数据库" → 选择集合 `prod_batch_exits`
3. 点击"索引管理" → "添加索引"
4. 按顺序添加字段：
   - 字段 1：`batchNumber` (升序)
   - 字段 2：`isDeleted` (升序)
   - 字段 3：`exitDate` (升序)
5. 索引名称：`batchNumber_1_isDeleted_1_exitDate_1`
6. 索引属性：**非唯一**
7. 点击"确定"创建

---

## 📊 影响范围

### 修改的文件

1. ✅ `miniprogram/packageHealth/vaccine-records-list/vaccine-records-list.ts`
   - 修正了字段名从 `batchId` 到 `batchNumber`

2. ✅ `DATABASE_INDEX_OPTIMIZATION.md`
   - 更新了索引建议文档

### 需要创建的索引

| 集合 | 索引名称 | 字段 | 优先级 |
|------|---------|------|--------|
| `prod_batch_exits` | `batchNumber_1_isDeleted_1_exitDate_1` | batchNumber(↑) + isDeleted(↑) + exitDate(↑) | ⭐⭐⭐⭐⭐ |

---

## 🎓 经验教训

### 1. 字段命名一致性

**问题：** 不同代码位置使用了不同的字段名（`batchId` vs `batchNumber`）

**教训：**
- 应该在整个项目中统一使用 `batchNumber` 字段
- 建议使用 `shared-config/collections.js` 来定义标准字段名
- 进行代码审查时重点检查字段名一致性

### 2. 索引配置的完整性

**问题：** 配置文档（DATABASE_CONFIG_GUIDE.md）中没有包含 `isDeleted` 软删除字段

**原因：**
- `isDeleted` 软删除功能是后期添加的
- 配置文档没有及时更新

**教训：**
- 当添加新的通用字段（如 `isDeleted`）时，应该：
  1. 更新所有相关集合的索引配置
  2. 更新配置文档
  3. 检查所有现有索引是否需要包含新字段

### 3. 索引覆盖查询模式

**问题：** 已有索引 `farmId_1_batchNumber_1` 和 `exitDate_-1` 无法覆盖新的查询模式

**原因：**
- 查询使用了 `batchNumber + exitDate + isDeleted` 的组合
- 单独的索引无法满足组合查询的性能需求

**教训：**
- 索引设计应该基于实际查询模式，而不是凭经验
- 使用云开发控制台的"慢查询日志"来发现优化机会
- 定期审查查询日志，调整索引策略

---

## 🔍 验证步骤

### 1. 代码修复验证

```bash
# 搜索所有使用 batchId 查询 prod_batch_exits 的代码
grep -r "prod_batch_exits.*batchId" cloudfunctions/ miniprogram/
```

预期结果：应该只在 `DATABASE_INDEX_OPTIMIZATION.md` 中找到（已注释说明）

### 2. 索引创建验证

1. 在云开发控制台查看 `prod_batch_exits` 集合的索引列表
2. 确认存在以下索引：
   - ✅ `_id_`（系统默认）
   - ✅ `farmId_1_batchNumber_1`（用户已创建）
   - ✅ `exitDate_-1`（用户已创建）
   - ✅ `exitNumber_1`（用户已创建，唯一索引）
   - ⏳ `batchNumber_1_isDeleted_1_exitDate_1`（待创建）

### 3. 性能验证

创建索引后，在云开发控制台执行以下查询，观察性能改善：

```javascript
db.collection('prod_batch_exits').where({
  batchNumber: 'QY20251103',
  exitDate: _.lte('2025-11-03'),
  isDeleted: false
})
```

预期结果：
- ✅ 查询时间显著减少
- ✅ 不再收到慢查询警告

---

## 📋 待办事项

- [x] 修正小程序代码中的字段名错误
- [ ] 在云开发控制台创建 `batchNumber_1_isDeleted_1_exitDate_1` 索引
- [ ] 测试修复后的小程序功能
- [ ] 观察云开发控制台是否还有慢查询警告
- [ ] 更新 `DATABASE_CONFIG_GUIDE.md`，添加 `isDeleted` 字段的索引配置

---

## 📚 相关文档

- [DATABASE_CONFIG_GUIDE.md](./DATABASE_CONFIG_GUIDE.md) - 数据库集合配置指南
- [DATABASE_INDEX_OPTIMIZATION.md](./DATABASE_INDEX_OPTIMIZATION.md) - 数据库索引优化建议
- [shared-config/collections.js](./shared-config/collections.js) - 统一集合配置

---

## 🎯 总结

**问题根源：** 小程序端代码使用了错误的字段名 `batchId`，而实际数据库和云函数使用的是 `batchNumber`

**用户责任：** ✅ **无责任** - 用户完全按照 DATABASE_CONFIG_GUIDE.md 正确配置了索引

**文档问题：** DATABASE_CONFIG_GUIDE.md 缺少 `isDeleted` 软删除字段的索引配置

**解决方案：**
1. ✅ 已修正小程序代码字段名
2. ⏳ 需补充创建包含 `isDeleted` 的组合索引

**预期效果：** 修复后，查询将正确使用索引，性能提升 60-80%，不再触发慢查询警告。

---

*文档版本：v1.0*  
*创建时间：2025-11-03*  
*适用项目：鹅数通智慧养鹅小程序*

