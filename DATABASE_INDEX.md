# 数据库索引配置指引

## 概述

数据库索引可以显著提升查询性能，特别是对于高频查询字段。本文档提供鹅数通小程序数据库的索引配置建议。

## 索引配置原则

1. **为高频查询字段创建索引**
2. **避免为低频查询字段创建过多索引**（影响写入性能）
3. **复合索引优于多个单字段索引**（针对多字段查询）
4. **考虑查询的选择性**（字段值差异性大的优先）

## 推荐索引配置

### 一、用户管理模块

#### 1. wx_users
```javascript
// 索引1：openid（自动创建）
{ _openid: 1 }

// 索引2：养殖场ID
{ farmId: 1 }

// 索引3：手机号（唯一索引）
{ phone: 1 }

// 索引4：角色和激活状态
{ role: 1, isActive: 1 }
```

**理由**：
- `_openid`：微信自动创建，用于用户身份验证
- `farmId`：养殖场员工查询
- `phone`：手机号登录和唯一性校验
- `role + isActive`：用户列表筛选

#### 2. wx_user_invites
```javascript
// 索引1：邀请码（唯一索引）
{ inviteCode: 1 }

// 索引2：创建者
{ creatorOpenid: 1, status: 1 }

// 索引3：过期时间
{ expiresAt: 1 }
```

**理由**：
- `inviteCode`：邀请码验证（高频）
- `creatorOpenid + status`：管理员查看邀请码列表
- `expiresAt`：定时清理过期邀请码

---

### 二、生产管理模块

#### 3. prod_batch_entries
```javascript
// 索引1：养殖场和批次号
{ farmId: 1, batchNumber: 1 }

// 索引2：入栏日期
{ entryDate: -1 }

// 索引3：批次号（唯一索引）
{ batchNumber: 1 }
```

**理由**：
- `farmId + batchNumber`：养殖场内批次查询
- `entryDate`：按时间排序查询
- `batchNumber`：批次唯一性和快速查找

#### 4. prod_batch_exits
```javascript
// 索引1：养殖场和批次号
{ farmId: 1, batchNumber: 1 }

// 索引2：出栏日期
{ exitDate: -1 }

// 索引3：出栏编号
{ exitNumber: 1 }
```

#### 5. prod_materials
```javascript
// 索引1：养殖场和物料名称
{ farmId: 1, materialName: 1 }

// 索引2：物料类别
{ category: 1, farmId: 1 }

// 索引3：低库存预警
{ farmId: 1, currentStock: 1 }
```

**理由**：
- `farmId + materialName`：物料查询
- `category + farmId`：按类别筛选
- `currentStock`：库存预警查询

#### 6. prod_material_records
```javascript
// 索引1：养殖场和操作日期
{ farmId: 1, operateDate: -1 }

// 索引2：物料ID和时间
{ materialId: 1, operateDate: -1 }
```

---

### 三、健康管理模块

#### 7. health_records
```javascript
// 索引1：批次和日期
{ batchId: 1, checkDate: -1 }

// 索引2：养殖场和日期
{ farmId: 1, checkDate: -1 }

// 索引3：异常记录查询
{ farmId: 1, abnormalCount: 1 }
```

**理由**：
- `batchId + checkDate`：批次健康历史
- `farmId + checkDate`：养殖场健康趋势
- `abnormalCount`：异常情况筛选

#### 8. health_prevention_records
```javascript
// 索引1：批次和类型
{ batchId: 1, type: 1 }

// 索引2：养殖场和日期
{ farmId: 1, preventionDate: -1 }
```

#### 9. health_treatment_records
```javascript
// 索引1：批次和日期
{ batchId: 1, treatmentDate: -1 }

// 索引2：养殖场和日期
{ farmId: 1, treatmentDate: -1 }
```

#### 10. health_ai_diagnosis
```javascript
// 索引1：养殖场和创建时间
{ farmId: 1, createTime: -1 }

// 索引2：批次和创建时间
{ batchId: 1, createTime: -1 }

// 索引3：AI模型使用统计
{ model: 1, createTime: -1 }
```

**理由**：
- `farmId + createTime`：诊断历史列表
- `batchId + createTime`：批次诊断记录
- `model`：AI模型效果分析

#### 11. health_death_records
```javascript
// 索引1：批次和日期
{ batchId: 1, deathDate: -1 }

// 索引2：养殖场和日期
{ farmId: 1, deathDate: -1 }
```

#### 12. health_vaccine_plans
```javascript
// 索引1：批次和计划日期
{ batchId: 1, plannedDate: 1 }

// 索引2：未完成任务
{ farmId: 1, completed: 1, plannedDate: 1 }
```

**理由**：
- `batchId + plannedDate`：批次疫苗计划
- `completed + plannedDate`：待办任务查询

---

### 四、财务管理模块

#### 13. finance_cost_records
```javascript
// 索引1：养殖场和日期
{ farmId: 1, costDate: -1 }

// 索引2：批次和类别
{ batchId: 1, category: 1 }

// 索引3：类别和日期
{ farmId: 1, category: 1, costDate: -1 }
```

**理由**：
- `farmId + costDate`：成本历史查询
- `batchId + category`：批次成本分析
- `category + costDate`：成本类别分析

#### 14. finance_revenue_records
```javascript
// 索引1：养殖场和日期
{ farmId: 1, revenueDate: -1 }

// 索引2：批次和日期
{ batchId: 1, revenueDate: -1 }
```

#### 15. finance_reports
```javascript
// 索引1：养殖场和期间
{ farmId: 1, period: -1 }

// 索引2：报表类型
{ reportType: 1, period: -1 }
```

#### 16. finance_summaries
```javascript
// 索引1：养殖场和月份
{ farmId: 1, month: -1 }
```

---

### 五、任务管理模块

#### 17. task_batch_schedules
```javascript
// 索引1：批次和目标日期
{ batchId: 1, targetDate: 1 }

// 索引2：养殖场和目标日期
{ farmId: 1, targetDate: 1 }

// 索引3：未完成任务
{ farmId: 1, completed: 1, targetDate: 1 }
```

**理由**：
- `batchId + targetDate`：批次任务计划
- `farmId + targetDate`：养殖场任务日历
- `completed + targetDate`：待办任务列表

#### 18. task_completions
```javascript
// 索引1：计划任务ID
{ scheduleId: 1 }

// 索引2：批次和完成日期
{ batchId: 1, completedDate: -1 }
```

#### 19. task_records
```javascript
// 索引1：养殖场和任务日期
{ farmId: 1, taskDate: -1 }

// 索引2：任务类型和状态
{ taskType: 1, status: 1 }
```

---

### 六、系统管理模块

#### 20. sys_audit_logs
```javascript
// 索引1：用户和创建时间
{ userId: 1, createTime: -1 }

// 索引2：模块和创建时间
{ module: 1, createTime: -1 }

// 索引3：操作类型
{ action: 1, createTime: -1 }
```

**理由**：
- `userId + createTime`：用户操作历史
- `module + createTime`：模块操作审计
- `action + createTime`：操作类型统计

#### 21. sys_ai_cache
```javascript
// 索引1：缓存键（唯一索引）
{ cacheKey: 1 }

// 索引2：过期时间
{ expiresAt: 1 }
```

**理由**：
- `cacheKey`：缓存查找
- `expiresAt`：定时清理过期缓存

#### 22. sys_ai_usage
```javascript
// 索引1：用户和创建时间
{ userId: 1, createTime: -1 }

// 索引2：模型和创建时间
{ model: 1, createTime: -1 }
```

#### 23. sys_notifications
```javascript
// 索引1：创建时间
{ createTime: -1 }

// 索引2：通知类型
{ notificationType: 1, createTime: -1 }
```

#### 24. sys_overview_stats
```javascript
// 索引1：养殖场和统计日期
{ farmId: 1, statDate: -1 }
```

---

### 七、文件管理模块

#### 25. file_dynamic_records
```javascript
// 索引1：关联模块和ID
{ relatedModule: 1, relatedId: 1 }

// 索引2：上传用户和时间
{ userId: 1, uploadTime: -1 }
```

#### 26. file_static_records
```javascript
// 索引1：分类和上传时间
{ category: 1, uploadTime: -1 }

// 索引2：文件ID（唯一索引）
{ fileId: 1 }
```

---

## 在微信云开发控制台创建索引

### 步骤：

1. 登录[微信云开发控制台](https://console.cloud.tencent.com/)
2. 选择对应的环境
3. 进入"数据库"模块
4. 选择要创建索引的集合
5. 点击"索引管理" → "添加索引"
6. 配置索引字段和排序方式
7. 点击"确定"创建

### 索引配置界面：

- **索引名称**：自动生成或自定义（建议使用字段名称）
- **索引字段**：选择字段并设置升序(1)或降序(-1)
- **唯一索引**：勾选表示该字段值唯一
- **TTL索引**：可设置文档自动过期时间

### 复合索引示例：

对于 `{ farmId: 1, batchNumber: 1 }` 复合索引：

1. 添加第一个字段：`farmId`，排序：升序
2. 添加第二个字段：`batchNumber`，排序：升序
3. 确认创建

---

## 性能优化建议

### 1. 查询优化
- 使用索引字段作为查询条件
- 避免使用 `$where` 或 `$regex`（无法使用索引）
- 限制返回字段（使用 `field`）
- 合理使用分页（`skip` + `limit`）

### 2. 索引维护
- 定期检查索引使用情况
- 删除不再使用的索引
- 避免创建过多索引（影响写入性能）

### 3. 监控和分析
- 使用云开发控制台的"慢查询分析"功能
- 关注查询耗时超过100ms的操作
- 根据实际使用情况调整索引策略

---

## 索引使用示例

### 示例1：批次健康记录查询
```javascript
// 使用索引：{ batchId: 1, checkDate: -1 }
const result = await db.collection('health_records')
  .where({
    batchId: 'B2024001'
  })
  .orderBy('checkDate', 'desc')
  .limit(20)
  .get()
```

### 示例2：养殖场成本分析
```javascript
// 使用索引：{ farmId: 1, category: 1, costDate: -1 }
const result = await db.collection('finance_cost_records')
  .where({
    farmId: 'F001',
    category: 'feed'
  })
  .orderBy('costDate', 'desc')
  .get()
```

### 示例3：待办任务查询
```javascript
// 使用索引：{ farmId: 1, completed: 1, targetDate: 1 }
const result = await db.collection('task_batch_schedules')
  .where({
    farmId: 'F001',
    completed: false,
    targetDate: db.command.lte(new Date())
  })
  .orderBy('targetDate', 'asc')
  .get()
```

---

## 常见问题

### Q1: 索引创建后何时生效？
A: 索引创建后立即生效，但对于大数据量集合，建立索引可能需要一些时间。

### Q2: 如何验证索引是否被使用？
A: 在云开发控制台的"慢查询分析"中可以看到查询是否使用了索引。

### Q3: 索引会占用多少存储空间？
A: 索引会占用额外的存储空间，通常为数据量的10-20%。建议只为高频查询字段创建索引。

### Q4: 可以为数组字段创建索引吗？
A: 可以，但数组索引会为数组中的每个元素创建索引项，可能导致索引过大。

### Q5: 唯一索引如何处理null值？
A: 微信云数据库允许多个文档的索引字段为null，但不允许多个文档的索引字段为相同的非null值。

---

## 维护计划

1. **每月检查**：查看慢查询分析，优化高频慢查询
2. **每季度审查**：根据业务变化调整索引策略
3. **年度优化**：全面评估索引效果，清理无用索引

---

## 相关文档

- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - 数据库集合配置指引
- [shared-config/collections.js](./shared-config/collections.js) - 统一集合配置文件
- [微信云开发文档 - 数据库索引](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/database/index.html)

