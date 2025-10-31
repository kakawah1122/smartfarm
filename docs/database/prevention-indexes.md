# 预防管理模块数据库索引配置

## 📊 集合：task_batch_schedules

### 索引配置

#### 索引1：预防任务查询索引（必需）
**用途：** 快速查询健康类别的未完成任务，按目标日期排序

- **索引名称**：`category_1_completed_1_targetDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段：`category`，排序：**升序**
  - 字段：`completed`，排序：**升序**
  - 字段：`targetDate`，排序：**升序**

**使用场景：**
```javascript
db.collection('task_batch_schedules')
  .where({
    category: 'health',
    completed: false
  })
  .orderBy('targetDate', 'asc')
  .get()
```

#### 索引2：批次任务查询索引
**用途：** 查询特定批次的任务

- **索引名称**：`batchId_1_category_1_completed_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段：`batchId`，排序：**升序**
  - 字段：`category`，排序：**升序**
  - 字段：`completed`，排序：**升序**

#### 索引3：任务类型查询索引
**用途：** 按任务类型筛选

- **索引名称**：`taskType_1_completed_1_targetDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段：`taskType`，排序：**升序**
  - 字段：`completed`，排序：**升序**
  - 字段：`targetDate`，排序：**升序**

---

## 📊 集合：health_prevention_records

### 索引配置

#### 索引1：预防记录查询索引（必需）
**用途：** 快速查询未删除的预防记录，按日期倒序

- **索引名称**：`isDeleted_1_preventionDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段：`isDeleted`，排序：**升序**
  - 字段：`preventionDate`，排序：**降序**

#### 索引2：批次预防记录索引
**用途：** 查询特定批次的预防记录

- **索引名称**：`batchId_1_isDeleted_1_preventionDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段：`batchId`，排序：**升序**
  - 字段：`isDeleted`，排序：**升序**
  - 字段：`preventionDate`，排序：**降序**

#### 索引3：预防类型统计索引
**用途：** 按类型统计预防记录（疫苗/消毒/用药）

- **索引名称**：`preventionType_1_isDeleted_1_batchId_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段：`preventionType`，排序：**升序**
  - 字段：`isDeleted`，排序：**升序**
  - 字段：`batchId`，排序：**升序**

#### 索引4：任务关联索引
**用途：** 查询由待办任务创建的预防记录

- **索引名称**：`taskId_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段：`taskId`，排序：**升序**

---

## 🔧 创建方法

### 通过微信云开发控制台

1. 登录 [微信云开发控制台](https://console.cloud.tencent.com/)
2. 选择对应的环境 → 进入"数据库"模块
3. 找到对应集合 → 点击"索引"标签
4. 点击"添加索引"按钮
5. 按照上方配置依次添加索引

### 验证索引效果

添加索引后，在云函数日志中观察查询耗时：

```javascript
const startTime = Date.now()
const result = await db.collection('task_batch_schedules')
  .where({ category: 'health', completed: false })
  .orderBy('targetDate', 'asc')
  .get()
const endTime = Date.now()

console.log(`查询耗时: ${endTime - startTime}ms`)
// 预期结果：
// 无索引：300-1000ms
// 有索引：10-50ms
```

---

## ⚠️ 注意事项

1. **索引创建顺序**：建议按优先级创建，先创建最常用的查询索引
2. **索引数量**：每个集合建议3-5个索引，不超过8个
3. **复合索引顺序**：字段顺序很重要，要与查询条件顺序一致
4. **存储占用**：索引会占用额外10-20%存储空间
5. **写入性能**：索引会轻微影响写入速度（< 5%），但查询性能提升远大于此

---

## 📈 性能提升预期

| 场景 | 数据量 | 无索引耗时 | 有索引耗时 | 提升 |
|------|--------|-----------|-----------|------|
| 查询今日待办 | 100条 | 200ms | 15ms | 93% ↑ |
| 查询今日待办 | 1000条 | 800ms | 25ms | 97% ↑ |
| 批次预防记录 | 500条 | 300ms | 20ms | 93% ↑ |
| 统计预防成本 | 2000条 | 1200ms | 50ms | 96% ↑ |

---

**更新时间**：2025-10-30  
**适用版本**：预防管理模块 v2.0

