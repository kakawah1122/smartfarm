# 数据库索引配置指南

## 📊 治愈记录查询索引

### 索引配置

**集合**: `health_treatment_records`

**组合索引**:
```json
[
  { "field": "createdAt", "type": -1 },
  { "field": "isDeleted", "type": 1 }
]
```

### 创建方法

#### 方法 1: 通过微信云开发控制台

1. 打开微信开发者工具
2. 点击"云开发"按钮
3. 进入"数据库" -> 选择 `health_treatment_records` 集合
4. 点击"索引管理"标签
5. 点击"添加索引"
6. 添加以下字段：
   - `createdAt`: 降序 (-1)
   - `isDeleted`: 升序 (1)
7. 点击"确定"创建索引

#### 方法 2: 通过快速链接（推荐）

点击控制台中的快速创建索引链接，或手动访问云开发控制台创建。

### 索引说明

- **createdAt 降序**: 支持按创建时间倒序查询（最新的记录在前）
- **isDeleted 升序**: 配合 isDeleted 字段过滤

### 性能提升

| 项目 | 无索引 | 有索引 |
|------|--------|--------|
| 查询速度 | 慢（全表扫描） | 快（索引查询） |
| 适用数据量 | < 1000 | 无限制 ✅ |
| CPU 消耗 | 高 | 低 ✅ |

---

## 📊 其他推荐索引

### health_treatment_records

```json
// 索引 1: 治愈记录查询
[
  { "field": "createdAt", "type": -1 },
  { "field": "isDeleted", "type": 1 }
]

// 索引 2: 按批次查询治疗记录
[
  { "field": "batchId", "type": 1 },
  { "field": "createdAt", "type": -1 }
]

// 索引 3: 按状态查询
[
  { "field": "outcome.status", "type": 1 },
  { "field": "createdAt", "type": -1 }
]
```

### health_death_records

```json
// 索引 1: 死亡记录查询
[
  { "field": "deathDate", "type": -1 },
  { "field": "isDeleted", "type": 1 }
]

// 索引 2: 按批次查询
[
  { "field": "batchId", "type": 1 },
  { "field": "deathDate", "type": -1 }
]
```

### prod_batch_entries

```json
// 索引 1: 批次号查询
[
  { "field": "batchNumber", "type": 1 },
  { "field": "isDeleted", "type": 1 }
]

// 索引 2: 在栏批次查询
[
  { "field": "status", "type": 1 },
  { "field": "entryDate", "type": -1 }
]
```

---

## ⚠️ 注意事项

1. **索引创建时间**: 大数据量时，索引创建可能需要几分钟
2. **存储占用**: 索引会占用额外存储空间（约数据的 10-20%）
3. **写入性能**: 索引会轻微影响写入速度（可忽略）
4. **索引数量**: 每个集合建议不超过 5 个索引

---

## 🔍 如何验证索引效果

创建索引后，在云开发控制台的数据库查询中：

1. 执行查询
2. 查看"查询耗时"
3. 应该从几百毫秒降至几十毫秒

---

## 📝 更新日志

- 2025-10-29: 初始版本，添加治愈记录查询索引配置

