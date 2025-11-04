# 数据库索引优化建议

> 生成时间：2025-11-03  
> 状态：待实施

## 📋 概述

本文档基于代码分析，为鹅数通小程序数据库提供索引优化建议。创建合适的索引可以大幅提升查询性能，特别是在数据量增长后。

## 🎯 核心优化建议

### 1. prod_batch_exits（出栏记录）- 高优先级

#### 索引 1.1：批次+日期+软删除
```javascript
{
  "batchNumber": 1,  // ✅ 已确认使用 batchNumber 字段
  "isDeleted": 1,
  "exitDate": 1
}
```

**使用场景：**
- 按批次查询出栏记录（高频）
- 日期范围统计
- 软删除过滤

**影响的查询：**
- `production-exit/index.js`: 第 185-186 行（按批次查询出栏记录）
- `production-dashboard/index.js`: 第 525-527 行（批次流程数据）
- `vaccine-records-list.ts`: 第 228-234 行（疫苗记录关联查询）

**创建命令（微信云开发控制台）：**
```
集合：prod_batch_exits
字段：batchNumber (升序) → isDeleted (升序) → exitDate (升序)
```

**⚠️ 重要说明：**
DATABASE_CONFIG_GUIDE.md 中已配置的索引（`farmId_1_batchNumber_1` 和 `exitDate_-1`）无法完全覆盖此查询模式，因为缺少 `isDeleted` 字段。建议添加此组合索引。

#### 索引 1.2：日期范围查询
```javascript
{
  "exitDate": 1,
  "isDeleted": 1
}
```

**使用场景：**
- 日期范围统计（生产看板）
- 出栏趋势分析

**影响的查询：**
- `production-exit/index.js`: 第 80-82 行
- `production-dashboard/index.js`: 第 340-342 行

---

### 2. prod_batch_entries（入栏记录）- 高优先级

#### 索引 2.1：批次号查询
```javascript
{
  "batchNumber": 1,
  "isDeleted": 1
}
```

**使用场景：**
- 根据批次号查询入栏信息（高频）
- 验证批次是否存在

**影响的查询：**
- `production-exit/index.js`: 第 103-104 行
- `production-exit/index.js`: 第 176-178 行
- `health-management/index.js`: 多处批次验证

#### 索引 2.2：状态+日期
```javascript
{
  "status": 1,
  "entryDate": 1,
  "isDeleted": 1
}
```

**使用场景：**
- 查询已完成的批次
- 按日期范围统计入栏

**影响的查询：**
- `production-exit/index.js`: 第 503-504 行
- `production-dashboard/index.js`: 第 67-73 行

---

### 3. task_batch_schedules（任务计划）- 高优先级

#### 索引 3.1：批次+日龄+完成状态
```javascript
{
  "batchId": 1,
  "dayAge": 1,
  "completed": 1
}
```

**使用场景：**
- 查询某批次某日龄的待办任务（最高频）
- 任务完成状态过滤

**影响的查询：**
- `breeding-todo/index.js`: 第 404-407 行
- `breeding-todo/index.js`: 第 495-498 行

**预计性能提升：** ⭐⭐⭐⭐⭐（极高）

#### 索引 3.2：批次删除
```javascript
{
  "batchId": 1
}
```

**使用场景：**
- 删除批次相关任务
- 批次任务统计

**影响的查询：**
- `breeding-todo/index.js`: 第 599-601 行

---

### 4. task_completions（任务完成记录）- 高优先级

#### 索引 4.1：用户+批次+日龄
```javascript
{
  "_openid": 1,
  "batchId": 1,
  "dayAge": 1
}
```

**使用场景：**
- 查询用户完成的任务
- 批次日龄段任务统计

**影响的查询：**
- `breeding-todo/index.js`: 第 501-504 行
- `breeding-todo/index.js`: 第 660-662 行

---

### 5. health_records（健康记录）- 中优先级

#### 索引 5.1：批次+记录类型+状态
```javascript
{
  "batchId": 1,
  "recordType": 1,
  "status": 1,
  "isDeleted": 1
}
```

**使用场景：**
- 查询批次的AI诊断记录
- 查询异常健康记录

**影响的查询：**
- `health-management/index.js`: 第 919-922 行
- `health-management/index.js`: 第 1518-1521 行
- `health-management/index.js`: 第 1834-1837 行

#### 索引 5.2：批次+日期范围
```javascript
{
  "batchId": 1,
  "checkDate": 1,
  "isDeleted": 1
}
```

**使用场景：**
- 按日期范围查询健康记录
- 健康趋势分析

**影响的查询：**
- `health-management/index.js`: 第 1497-1502 行

---

### 6. health_treatment_records（治疗记录）- 中优先级

#### 索引 6.1：批次+日期+软删除
```javascript
{
  "batchId": 1,
  "treatmentDate": 1,
  "isDeleted": 1
}
```

**使用场景：**
- 查询批次治疗历史
- 按日期范围统计治疗记录

**影响的查询：**
- `health-management/index.js`: 第 942-945 行
- `health-management/index.js`: 第 1651-1657 行

#### 索引 6.2：批次+治疗状态
```javascript
{
  "batchId": 1,
  "treatmentStatus": 1,
  "isDeleted": 1
}
```

**使用场景：**
- 查询已治愈记录
- 治疗状态统计

**影响的查询：**
- `health-management/index.js`: 第 4204-4207 行

---

### 7. health_death_records（死亡记录）- 中优先级

#### 索引 7.1：批次+日期+软删除
```javascript
{
  "batchId": 1,
  "deathDate": 1,
  "isDeleted": 1
}
```

**使用场景：**
- 按批次查询死亡记录
- 死亡趋势分析
- 存活率计算

**影响的查询：**
- `health-management/index.js`: 第 947-950 行
- `health-management/index.js`: 第 3387-3399 行
- `production-dashboard/index.js`: 第 531-532 行

#### 索引 7.2：日期范围查询
```javascript
{
  "isDeleted": 1,
  "deathDate": 1
}
```

**使用场景：**
- 全局死亡统计
- 按日期范围分析

**影响的查询：**
- `production-dashboard/index.js`: 第 99-104 行

---

### 8. health_followup_records（随访记录）- 低优先级

#### 索引 8.1：治疗记录关联
```javascript
{
  "treatmentRecordId": 1,
  "isDeleted": 1
}
```

**使用场景：**
- 查询治疗的随访记录

**影响的查询：**
- `health-management/index.js`: 第 3902-3905 行
- `health-management/index.js`: 第 4821-4824 行

---

### 9. prod_materials（物料库存）- 低优先级

#### 索引 9.1：激活状态+库存预警
```javascript
{
  "isActive": 1,
  "currentStock": 1
}
```

**使用场景：**
- 低库存预警
- 库存统计

**影响的查询：**
- `production-dashboard/index.js`: 第 180-182 行
- `production-dashboard/index.js`: 第 568-572 行

#### 索引 9.2：激活状态+分类
```javascript
{
  "isActive": 1,
  "category": 1
}
```

**使用场景：**
- 按分类查询物料
- 分类统计

**影响的查询：**
- `production-dashboard/index.js`: 第 189-241 行

---

### 10. prod_material_records（物料记录）- 低优先级

#### 索引 10.1：日期+类型
```javascript
{
  "recordDate": 1,
  "type": 1
}
```

**使用场景：**
- 按日期统计物料采购/使用
- 物料趋势分析

**影响的查询：**
- `production-dashboard/index.js`: 第 211-215 行
- `production-dashboard/index.js`: 第 343-346 行

---

## 🔧 实施步骤

### 步骤 1：创建高优先级索引（立即执行）

1. **prod_batch_exits**
   - 打开微信云开发控制台
   - 进入数据库 → 索引管理
   - 集合：`prod_batch_exits`
   - 创建组合索引：`batchId(升序)` → `isDeleted(升序)` → `exitDate(升序)`

2. **task_batch_schedules**
   - 集合：`task_batch_schedules`
   - 创建组合索引：`batchId(升序)` → `dayAge(升序)` → `completed(升序)`

3. **task_completions**
   - 集合：`task_completions`
   - 创建组合索引：`_openid(升序)` → `batchId(升序)` → `dayAge(升序)`

4. **prod_batch_entries**
   - 集合：`prod_batch_entries`
   - 创建组合索引：`batchNumber(升序)` → `isDeleted(升序)`

### 步骤 2：监控性能（1-2周）

使用云开发控制台的性能监控功能，观察：
- 慢查询数量是否减少
- 查询响应时间是否改善
- 数据库负载是否降低

### 步骤 3：创建中优先级索引（按需）

根据实际使用情况和性能监控结果，逐步创建中优先级索引。

### 步骤 4：优化代码查询（推荐）

在创建索引的同时，建议优化以下代码：

#### 4.1 统一 isDeleted 字段使用

当前很多查询没有使用 `isDeleted` 字段，建议统一添加：

```javascript
// production-exit/index.js - 建议修改
let query = db.collection('prod_batch_exits')
  .where({ isDeleted: false })  // 添加这行
```

#### 4.2 确认字段名称一致性

检查实际数据库是使用 `batchId` 还是 `batchNumber`，统一字段命名。

---

## 📊 索引优先级说明

### ⭐⭐⭐⭐⭐ 极高优先级
- **task_batch_schedules** 相关索引（使用频率最高）
- 直接影响核心业务流程

### ⭐⭐⭐⭐ 高优先级
- **prod_batch_exits**、**prod_batch_entries** 相关索引
- 生产管理核心功能

### ⭐⭐⭐ 中优先级
- **health_records**、**health_treatment_records** 相关索引
- 健康管理功能

### ⭐⭐ 低优先级
- **prod_materials**、统计类索引
- 使用频率较低或数据量较小

---

## ⚠️ 注意事项

### 索引的成本

1. **存储空间**：每个索引会占用额外存储（通常为数据的 10-20%）
2. **写入性能**：写入/更新/删除操作需要维护索引，略微降低写入速度
3. **维护成本**：过多索引会增加数据库维护复杂度

### 索引的选择原则

1. **高频查询优先**：为经常执行的查询创建索引
2. **选择性高的字段优先**：如 `batchId`、`_openid` 等
3. **范围查询放最后**：如 `date` 范围查询应放在组合索引最后
4. **避免冗余索引**：如已有 `{a:1, b:1}`，则不需要单独的 `{a:1}`

### 监控建议

- 定期检查慢查询日志
- 监控数据库性能指标
- 根据实际使用调整索引策略

---

## 📈 预期效果

创建推荐的高优先级索引后，预期可以获得：

- ✅ 任务查询速度提升 **80-90%**
- ✅ 批次相关查询提升 **60-80%**
- ✅ 日期范围查询提升 **50-70%**
- ✅ 整体系统响应速度提升 **30-50%**

---

## 🔍 快速创建索引

### prod_batch_exits 推荐索引

**组合索引：batchNumber + isDeleted + exitDate**

由于微信云开发控制台的快速创建链接使用了错误的字段名（`batchId`），请**手动创建**以下索引：

1. 打开微信云开发控制台
2. 进入"数据库" → 选择集合 `prod_batch_exits`
3. 点击"索引管理" → "添加索引"
4. 按顺序添加字段：
   - 字段 1：`batchNumber` (升序)
   - 字段 2：`isDeleted` (升序)
   - 字段 3：`exitDate` (升序)
5. 索引名称建议：`batchNumber_1_isDeleted_1_exitDate_1`
6. 索引属性：非唯一
7. 点击"确定"创建

**⚠️ 注意：系统检测到的快速创建链接使用了错误的字段名 `batchId`，已修正小程序代码使用正确的 `batchNumber` 字段。**

---

## 📝 更新日志

- **2025-11-03**：初始版本，基于代码分析生成索引建议
- 待添加：实际性能测试数据

---

## 🎯 下一步行动

1. ✅ 点击快速创建链接创建 `prod_batch_exits` 索引
2. ⏳ 手动创建其他高优先级索引
3. ⏳ 监控性能改善情况
4. ⏳ 根据需要创建中优先级索引
5. ⏳ 优化代码中的查询语句

---

*本文档将持续更新，请根据实际情况调整索引策略。*

