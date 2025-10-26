# 健康管理中心死亡数显示问题修复

## 问题描述

用户创建死亡记录后，健康管理中心的"死亡数"仍然显示为 0。

## 问题原因

### 数据流不一致

1. **创建死亡记录时**（第1889-1898行）：
```javascript
// 更新批次表的 deadCount 字段
await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
  .doc(batchId)
  .update({
    data: {
      currentCount: _.inc(-deathCount),  // 减少存栏数
      deadCount: _.inc(deathCount),      // 增加累计死亡数 ✅
      updatedAt: new Date()
    }
  })
```

2. **健康管理中心统计时**（原第663-696行）：
```javascript
// ❌ 错误：从健康检查记录获取死亡数
if (healthRecords.length > 0) {
  deadCount = latestRecord.deadCount || 0  // 健康检查记录的死亡数
} else {
  deadCount = 0  // 没有检查记录，默认0
}
```

### 问题总结

**写入位置** ≠ **读取位置**

- **写入**：批次表的 `deadCount` 字段（累计值）
- **读取**：健康检查记录的 `deadCount` 字段（单次检查值）

导致：
- 如果没有做健康检查，死亡数永远显示0
- 健康检查记录的死亡数是单次检查发现的，不是累计值

## 修复方案

### 修改统计逻辑

**直接从批次表获取累计死亡数**

```javascript
// ✅ 正确：从批次表获取累计死亡数
let deadCount = batch.deadCount || 0

// ✅ 当前存栏数也从批次表获取
let totalCount = batch.currentCount || originalQuantity
```

### 修复后的逻辑（第658-705行）

```javascript
// 计算健康指标
let originalQuantity = batch.quantity || 0  // 原始入栏数

// ✅ 死亡数直接从批次表获取（已扣除的累计死亡数）
let deadCount = batch.deadCount || 0

// ✅ 当前存栏数 = 批次的 currentCount（已扣除死亡）
let totalCount = batch.currentCount || originalQuantity

let healthyCount = 0
let sickCount = 0
let healthyRate = 100
let lastCheckDate = null
let recentIssues = []

if (healthRecords.length > 0) {
  // 有健康记录，使用实际检查数据
  const latestRecord = healthRecords[0]
  healthyCount = latestRecord.healthyCount || 0
  sickCount = latestRecord.sickCount || 0
  // ❌ 不再从健康记录获取死亡数，因为那是单次检查的数据
  
  // 如果健康记录的存栏数不同，使用健康记录的
  if (latestRecord.totalCount && latestRecord.totalCount !== totalCount) {
    totalCount = latestRecord.totalCount
  }
  
  // 计算健康率（基于存栏数）
  healthyRate = totalCount > 0 ? ((healthyCount / totalCount) * 100) : 0
  lastCheckDate = latestRecord.checkDate
  
  // 收集近期问题...
} else {
  // 没有健康记录，默认都是健康的（存栏数 - 死亡数）
  healthyCount = totalCount > 0 ? totalCount : 0
  sickCount = 0
  // deadCount 已经从批次表获取 ✅
  healthyRate = 100
}
```

## 数据关系说明

### 批次表（prod_batch_entries）

**这是主数据源**，包含批次的核心数据：

```javascript
{
  _id: "batch001",
  batchNumber: "QY-20251022",
  quantity: 100,           // 原始入栏数
  currentCount: 94,        // 当前存栏数（扣除死亡、出栏）
  deadCount: 6,            // 累计死亡数 ✅
  // ...
}
```

**更新时机**：
- 入栏：设置 `quantity` 和 `currentCount`
- 死亡：`currentCount -= 死亡数`, `deadCount += 死亡数`
- 出栏：`currentCount -= 出栏数`

### 健康检查记录（health_records）

**这是检查日志**，记录每次健康检查的发现：

```javascript
{
  _id: "check001",
  batchId: "batch001",
  checkDate: "2025-10-25",
  totalCount: 100,         // 本次检查时的存栏数
  healthyCount: 85,        // 本次检查发现健康的
  sickCount: 10,           // 本次检查发现生病的
  deadCount: 5,            // 本次检查发现死亡的 ❌ 不是累计值！
  // ...
}
```

**用途**：
- 记录健康检查日志
- 追踪健康趋势
- **不应该用于累计统计！**

### 死亡记录（health_death_records）

**这是死亡事件日志**：

```javascript
{
  _id: "death001",
  batchId: "batch001",
  deathDate: "2025-10-25",
  deathCount: 1,           // 本次死亡数
  deathCause: "小鹅瘟",
  financeLoss: 52.50,
  // ...
}
```

**用途**：
- 记录每次死亡事件
- 财务损失追踪
- AI诊断记录

## 数据一致性

### 修复前

```
创建死亡记录
  ↓
更新批次表: deadCount += 1 (✅ 正确)
  ↓
健康管理中心统计
  ↓
从健康检查记录读取 (❌ 错误，可能没有记录)
  ↓
显示: 死亡数 = 0
```

### 修复后

```
创建死亡记录
  ↓
更新批次表: deadCount += 1 (✅ 正确)
  ↓
健康管理中心统计
  ↓
从批次表读取 deadCount (✅ 正确)
  ↓
显示: 死亡数 = 1
```

## 测试验证

### 测试场景1：创建死亡记录

1. 进入AI智能诊断
2. 选择死因剖析
3. 完成诊断后点击"记录死亡报告"
4. 返回健康管理中心
5. ✅ 应该看到"死亡数"更新

### 测试场景2：多次死亡记录

1. 批次入栏100只
2. 第一次死亡2只 → 死亡数显示: 2
3. 第二次死亡3只 → 死亡数显示: 5
4. 第三次死亡1只 → 死亡数显示: 6
5. ✅ 累计显示正确

### 测试场景3：没有健康检查记录

1. 批次入栏，从未做健康检查
2. 创建死亡记录（通过AI诊断）
3. 返回健康管理中心
4. ✅ 应该显示死亡数（不再显示0）

## 其他统计指标

### 健康率计算

```
健康率 = (健康数 / 当前存栏数) × 100%
```

**数据来源**：
- 健康数：从最新的健康检查记录获取
- 当前存栏数：从批次表的 `currentCount` 获取 ✅

### 死亡率计算

```
死亡率 = (累计死亡数 / 原始入栏数) × 100%
```

**数据来源**：
- 累计死亡数：从批次表的 `deadCount` 获取 ✅
- 原始入栏数：从批次表的 `quantity` 获取 ✅

## 修复的文件

- `cloudfunctions/health-management/index.js`
  - 函数：`getAllBatchesHealthSummary` (第658-705行)
  - 修改：死亡数统计逻辑

## 部署步骤

1. 使用微信开发者工具
2. 右键 `health-management` 云函数
3. 选择 "上传并部署：云端安装依赖"
4. 等待部署完成
5. 返回小程序，刷新健康管理中心页面

## 预期效果

部署后：
- ✅ 死亡数正确显示累计值
- ✅ 即使没有健康检查记录，也能正确显示
- ✅ 每次创建死亡记录后，立即更新

## 修复日期

2025-10-25

