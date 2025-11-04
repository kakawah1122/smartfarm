# 为 prod_batch_exits 补充 isDeleted 字段

## 问题说明

旧的出栏记录没有 `isDeleted` 字段，导致：
1. 查询 `isDeleted: false` 时查不到旧记录
2. 索引优化建议持续出现

## 解决方案

### 方法一：云开发控制台直接执行（推荐，最快）

1. 打开 **微信云开发控制台**
2. 进入 "**数据库**" → 选择集合 `**prod_batch_exits**`
3. 点击 "**高级操作**" 标签页
4. 粘贴以下代码并执行：

```javascript
// 步骤 1：先查看有多少条记录需要更新
db.collection('prod_batch_exits')
  .where({
    isDeleted: _.exists(false)
  })
  .count()
  .then(res => {
    console.log('需要更新的记录数：', res.total)
  })
```

**然后执行批量更新：**

```javascript
// 步骤 2：批量添加 isDeleted 字段（每次最多20条）
// 如果记录很多，需要多次执行直到全部更新完成

db.collection('prod_batch_exits')
  .where({
    isDeleted: _.exists(false)
  })
  .limit(20)
  .update({
    data: {
      isDeleted: false
    }
  })
  .then(res => {
    console.log('本次更新成功：', res.stats.updated, '条记录')
    console.log('如果还有未更新的记录，请再次执行此代码')
  })
  .catch(err => {
    console.error('更新失败：', err)
  })
```

**重复执行步骤2，直到返回 "本次更新成功：0 条记录"**

---

### 方法二：使用临时云函数（适合记录数超过1000条）

1. 在云开发控制台 → **云函数** → **新建云函数**
2. 函数名称：`fix-isdeleted-field`
3. 运行环境：Node.js 16
4. 粘贴 `cloudfunctions/fix-isdeleted-field.js` 的代码
5. 点击 "**部署**"
6. 部署完成后，点击 "**云端测试**"
7. 测试参数留空 `{}`，点击 "**测试**"
8. 等待执行完成，查看日志
9. 完成后删除此云函数

---

### 验证更新结果

在云开发控制台执行：

```javascript
// 验证：检查还有多少记录没有 isDeleted 字段
db.collection('prod_batch_exits')
  .where({
    isDeleted: _.exists(false)
  })
  .count()
  .then(res => {
    if (res.total === 0) {
      console.log('✅ 所有记录都已有 isDeleted 字段')
    } else {
      console.log('⚠️ 还有', res.total, '条记录需要更新')
    }
  })

// 验证：查看一条记录是否已有 isDeleted 字段
db.collection('prod_batch_exits')
  .limit(1)
  .get()
  .then(res => {
    console.log('示例记录：', res.data[0])
    if (res.data[0].isDeleted !== undefined) {
      console.log('✅ isDeleted 字段存在，值为：', res.data[0].isDeleted)
    } else {
      console.log('❌ isDeleted 字段不存在')
    }
  })
```

---

## 完成后的后续步骤

### 1. 创建索引

补充完 `isDeleted` 字段后，创建以下索引：

**索引名称：** `batchNumber_1_isDeleted_1_exitDate_1`

**字段配置：**
- 字段1：`batchNumber` (升序)
- 字段2：`isDeleted` (升序)  
- 字段3：`exitDate` (升序)

**索引属性：** 非唯一

### 2. 清理小程序缓存

1. 打开微信开发者工具
2. 工具 → 清除缓存
3. 重新编译小程序

### 3. 测试查询

在小程序控制台测试：

```javascript
const db = wx.cloud.database()
const _ = db.command

db.collection('prod_batch_exits')
  .where({
    batchNumber: 'QY-20251015',  // 使用您截图中的批次号
    exitDate: _.lte('2025-11-03'),
    isDeleted: false
  })
  .get()
  .then(res => {
    console.log('查询成功，返回记录数：', res.data.length)
    console.log('记录详情：', res.data)
  })
```

预期结果：应该能查到记录（不再返回空）

---

## 为什么会出现这个问题？

1. **软删除功能是后期添加的**
   - 旧记录创建时还没有 `isDeleted` 字段
   - 新功能要求所有记录都有此字段

2. **数据迁移没有及时进行**
   - 添加新字段时，应该批量更新所有旧记录
   - 本次手动补充即可解决

3. **未来避免此问题**
   - 添加新的必需字段时，记得更新历史数据
   - 或者在查询时兼容处理：`isDeleted: _.in([false, null, undefined])`

---

## 预计时间

- 记录少于100条：1-2分钟（方法一）
- 记录100-1000条：3-5分钟（方法一，多次执行）
- 记录超过1000条：5-10分钟（方法二，使用云函数）

---

**执行完成后，请告知结果，我们继续下一步！** 🚀

