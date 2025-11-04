# 数据库字段确认检查清单

> 创建时间：2025-11-03  
> 目的：确认 prod_batch_exits 集合的实际字段名

---

## ⚠️ 重要提示

系统警告显示查询使用 `batchId` 字段，但代码中已全部改为 `batchNumber`。

**必须确认数据库中实际存储的字段名是什么！**

---

## 🔍 检查步骤

### 1. 打开微信云开发控制台

访问：https://console.cloud.tencent.com/tcb

### 2. 进入数据库

1. 选择环境：`cloud1-3gdruqkn67e1cbe2`
2. 点击左侧菜单"**数据库**"
3. 选择集合：`**prod_batch_exits**`

### 3. 查看记录

点击任意一条记录，查看字段列表。

### 4. 确认字段名

请检查以下字段是否存在：

**情况 A：使用 batchNumber（预期情况）**

```json
{
  "_id": "...",
  "_openid": "...",
  "userId": "...",
  "batchNumber": "QY20251103",  // ✅ 正确的字段名
  "exitNumber": "X251103001",
  "exitDate": "2025-11-03",
  "isDeleted": false,
  "quantity": 100,
  "customer": "客户A",
  ...
}
```

**情况 B：使用 batchId（问题情况）**

```json
{
  "_id": "...",
  "_openid": "...",
  "userId": "...",
  "batchId": "d84694f2690844a701fc1f206b404e07",  // ❌ 错误的字段名
  "exitNumber": "X251103001",
  "exitDate": "2025-11-03",
  "isDeleted": false,
  "quantity": 100,
  "customer": "客户A",
  ...
}
```

**情况 C：两个字段都存在（数据不一致）**

```json
{
  "_id": "...",
  "batchId": "...",      // ⚠️ 旧字段
  "batchNumber": "...",  // ⚠️ 新字段
  ...
}
```

---

## 📋 处理方案

### 如果是情况 A（使用 batchNumber）✅

**说明：** 数据库字段正确，问题在于：
1. 小程序没有重新编译
2. 或者警告是历史查询的缓存

**解决方案：**
1. 清理微信开发者工具缓存
2. 重新编译小程序
3. 测试功能
4. 等待 1-2 小时让警告缓存过期

**索引配置：**
```
索引名称：batchNumber_1_isDeleted_1_exitDate_1
字段1：batchNumber (升序)
字段2：isDeleted (升序)
字段3：exitDate (升序)
```

---

### 如果是情况 B（使用 batchId）⚠️

**说明：** 数据库实际字段是 `batchId`，需要：
1. 修改代码使用 `batchId`
2. 或者修改数据库字段名为 `batchNumber`

**方案 1：修改代码（快速方案）**

恢复代码使用 `batchId`，并创建相应索引：

```
索引名称：batchId_1_isDeleted_1_exitDate_1
字段1：batchId (升序)
字段2：isDeleted (升序)
字段3：exitDate (升序)
```

**方案 2：修改数据库（标准方案，推荐）**

1. 备份数据
2. 使用云函数批量修改字段名：
   ```javascript
   // 重命名字段
   const _ = db.command
   await db.collection('prod_batch_exits')
     .where({})
     .update({
       data: {
         batchNumber: _.set(_.field('batchId')),  // 复制 batchId 到 batchNumber
         batchId: _.remove()  // 删除旧字段
       }
     })
   ```
3. 更新所有云函数和小程序代码使用 `batchNumber`

---

### 如果是情况 C（两个字段都存在）⚠️

**说明：** 数据不一致，可能有旧记录使用 `batchId`，新记录使用 `batchNumber`

**解决方案：**

1. 统计数据分布：
   ```javascript
   // 在云开发控制台执行
   db.collection('prod_batch_exits').count()  // 总记录数
   
   db.collection('prod_batch_exits')
     .where({ batchId: _.exists(true) })
     .count()  // 有 batchId 的记录数
   
   db.collection('prod_batch_exits')
     .where({ batchNumber: _.exists(true) })
     .count()  // 有 batchNumber 的记录数
   ```

2. 数据迁移（使用云函数）：
   ```javascript
   // 将所有记录统一为 batchNumber
   const records = await db.collection('prod_batch_exits')
     .where({ batchId: _.exists(true) })
     .get()
   
   for (const record of records.data) {
     await db.collection('prod_batch_exits')
       .doc(record._id)
       .update({
         data: {
           batchNumber: record.batchId || record.batchNumber,
           batchId: _.remove()
         }
       })
   }
   ```

3. 创建索引（统一后）：
   ```
   索引名称：batchNumber_1_isDeleted_1_exitDate_1
   字段1：batchNumber (升序)
   字段2：isDeleted (升序)
   字段3：exitDate (升序)
   ```

---

## 🎯 检查结果报告

请在下方记录检查结果：

### 数据库实际字段名

- [ ] **情况 A**：只有 `batchNumber` 字段 ✅
- [ ] **情况 B**：只有 `batchId` 字段 ⚠️
- [ ] **情况 C**：两个字段都存在 ⚠️

### 记录数量

- 总记录数：________
- 有 `batchId` 字段的记录数：________
- 有 `batchNumber` 字段的记录数：________

### 示例记录（复制一条完整记录）

```json
{
  // 在此粘贴一条实际记录
}
```

---

## 📞 后续支持

根据检查结果：

1. **情况 A**：只需重新编译小程序，等待警告缓存过期
2. **情况 B 或 C**：需要数据迁移或代码调整

请将检查结果反馈，以便提供针对性的解决方案。

---

*检查清单版本：v1.0*  
*创建时间：2025-11-03*

