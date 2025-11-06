# 报销系统数据库索引配置指南

## 概述

本文档说明如何为报销系统配置数据库索引，以优化查询性能。

---

## 一、索引配置

### 在微信云开发控制台创建索引

**路径**：云开发控制台 → 数据库 → `finance_cost_records` → 索引管理

### 索引1：用户报销记录查询

**名称**：`idx_user_reimbursement`

**用途**：员工查看自己的报销记录

**索引字段**：
```json
{
  "_openid": 1,
  "isReimbursement": 1,
  "createTime": -1
}
```

**查询示例**：
```javascript
db.collection('finance_cost_records')
  .where({
    _openid: currentUser.openid,
    isReimbursement: true
  })
  .orderBy('createTime', 'desc')
  .get()
```

---

### 索引2：待审批报销查询

**名称**：`idx_pending_reimbursement`

**用途**：管理员查看待审批的报销列表

**索引字段**：
```json
{
  "isReimbursement": 1,
  "reimbursement.status": 1,
  "createTime": -1
}
```

**查询示例**：
```javascript
db.collection('finance_cost_records')
  .where({
    isReimbursement: true,
    'reimbursement.status': 'pending'
  })
  .orderBy('createTime', 'asc')
  .get()
```

---

### 索引3：日期范围查询

**名称**：`idx_date_type`

**用途**：按日期范围统计财务数据

**索引字段**：
```json
{
  "date": 1,
  "recordType": 1,
  "isDeleted": 1
}
```

**查询示例**：
```javascript
db.collection('finance_cost_records')
  .where({
    date: _.gte('2024-03-01').and(_.lte('2024-03-31')),
    recordType: 'reimbursement',
    isDeleted: _.neq(true)
  })
  .get()
```

---

### 索引4：用户特定状态报销

**名称**：`idx_user_status`

**用途**：查询用户特定状态的报销（待审批/已通过/已拒绝）

**索引字段**：
```json
{
  "_openid": 1,
  "reimbursement.status": 1,
  "createTime": -1
}
```

**查询示例**：
```javascript
db.collection('finance_cost_records')
  .where({
    _openid: currentUser.openid,
    'reimbursement.status': 'approved'
  })
  .orderBy('createTime', 'desc')
  .get()
```

---

## 二、索引创建步骤

### 步骤1：登录云开发控制台

1. 打开微信开发者工具
2. 点击"云开发"按钮
3. 进入云开发控制台

### 步骤2：进入索引管理

1. 点击左侧菜单"数据库"
2. 选择 `finance_cost_records` 集合
3. 点击"索引管理"标签页

### 步骤3：创建索引

点击"新建索引"按钮，按照上述配置逐个创建4个索引。

每个索引配置时：
1. 输入索引名称
2. 添加索引字段
3. 选择排序方向（1=升序，-1=降序）
4. 点击"创建"

### 步骤4：验证索引

创建完成后，在"索引管理"中可以看到所有索引：

```
索引名称                    索引字段                                      状态
idx_user_reimbursement     _openid:1, isReimbursement:1, createTime:-1   正常
idx_pending_reimbursement  isReimbursement:1, reimbursement.status:1...  正常
idx_date_type              date:1, recordType:1, isDeleted:1             正常
idx_user_status            _openid:1, reimbursement.status:1...          正常
```

---

## 三、数据迁移

### 运行迁移脚本

**文件**：`scripts/setup-reimbursement-database.js`

**方法1：使用云函数**

1. 将脚本上传为临时云函数
2. 在云开发控制台调用
3. 查看执行日志

**方法2：在本地运行**

```bash
cd scripts
node setup-reimbursement-database.js
```

### 迁移内容

脚本会自动：
1. 为所有旧数据添加 `recordType` 和 `isReimbursement` 字段
2. 设置默认值：`recordType: 'other'`, `isReimbursement: false`
3. 验证数据完整性

---

## 四、性能测试

### 测试查询性能

创建索引后，测试以下查询的性能：

#### 测试1：查询用户报销记录

```javascript
console.time('查询用户报销')
const result = await db.collection('finance_cost_records')
  .where({
    _openid: 'test_openid',
    isReimbursement: true
  })
  .orderBy('createTime', 'desc')
  .limit(20)
  .get()
console.timeEnd('查询用户报销')
```

**期望结果**：< 200ms

#### 测试2：查询待审批报销

```javascript
console.time('查询待审批')
const result = await db.collection('finance_cost_records')
  .where({
    isReimbursement: true,
    'reimbursement.status': 'pending'
  })
  .orderBy('createTime', 'asc')
  .limit(20)
  .get()
console.timeEnd('查询待审批')
```

**期望结果**：< 200ms

#### 测试3：月度财务统计

```javascript
console.time('月度统计')
const result = await db.collection('finance_cost_records')
  .aggregate()
  .match({
    date: _.gte('2024-03-01').and(_.lte('2024-03-31')),
    isReimbursement: true,
    'reimbursement.status': 'approved'
  })
  .group({
    _id: null,
    totalAmount: _.sum('$amount')
  })
  .end()
console.timeEnd('月度统计')
```

**期望结果**：< 500ms

---

## 五、监控和维护

### 定期检查索引使用情况

在云开发控制台查看：
- 索引大小
- 索引命中率
- 慢查询日志

### 索引优化建议

1. **数据量 < 1000条**：索引可选
2. **数据量 1000-10000条**：建议创建索引1、2
3. **数据量 > 10000条**：建议创建所有索引

### 定期维护

- 每月检查索引性能
- 根据实际查询需求调整索引
- 删除未使用的索引

---

## 六、故障排查

### 问题1：索引创建失败

**原因**：集合中数据量过大

**解决**：
1. 在云开发控制台创建索引（后台异步创建）
2. 等待索引创建完成（可能需要几分钟）

### 问题2：查询仍然很慢

**原因**：索引未生效或查询未使用索引

**解决**：
1. 检查查询条件是否与索引字段匹配
2. 确保排序字段在索引中
3. 查看云开发控制台的"慢查询"日志

### 问题3：索引占用空间过大

**原因**：索引字段过多或数据量大

**解决**：
1. 删除不常用的索引
2. 定期清理软删除的数据
3. 考虑数据归档策略

---

## 七、最佳实践

### 1. 查询优化

- 总是在 `where` 条件中包含索引字段
- 避免使用 `$or` 等复杂查询
- 使用分页查询，限制返回数量

### 2. 索引设计

- 高频查询优先创建索引
- 组合索引字段顺序：过滤 → 排序
- 避免过多索引（影响写入性能）

### 3. 数据管理

- 使用软删除（`isDeleted: true`）
- 定期归档历史数据
- 监控数据库容量

---

## 附录：完整SQL参考

### 创建索引（伪代码）

```sql
-- 索引1
CREATE INDEX idx_user_reimbursement 
ON finance_cost_records(_openid, isReimbursement, createTime DESC)

-- 索引2
CREATE INDEX idx_pending_reimbursement 
ON finance_cost_records(isReimbursement, reimbursement.status, createTime DESC)

-- 索引3
CREATE INDEX idx_date_type 
ON finance_cost_records(date, recordType, isDeleted)

-- 索引4
CREATE INDEX idx_user_status 
ON finance_cost_records(_openid, reimbursement.status, createTime DESC)
```

### 数据迁移（伪代码）

```sql
-- 为旧数据添加新字段
UPDATE finance_cost_records 
SET 
  recordType = 'other',
  isReimbursement = false,
  updateTime = NOW()
WHERE recordType IS NULL
```

---

**最后更新**：2024-03-15  
**维护人员**：数据库管理员


