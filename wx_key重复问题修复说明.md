# wx:key 重复问题修复说明

## 问题描述

在财务记录列表中出现 wx:key 重复警告：
```
Do not set same key "cc84495d690b5ec4024f8dee5c6e8a51" in wx:key.
```

## 原因分析

财务记录来自多个数据源（采购记录、治疗领用记录、出栏记录等），这些记录的 `_id` 可能重复，导致在前端显示时出现 wx:key 重复警告。

具体原因：
- 药品采购记录使用 `PROD_MATERIAL_RECORDS` 集合的 `_id`
- 治疗用药记录也使用 `PROD_MATERIAL_RECORDS` 集合的 `_id`
- 如果同一条物料记录既是采购又被查询为治疗领用，会导致 id 重复

## 修复方案

为不同来源的财务记录添加唯一前缀，确保 id 唯一：

### 1. 采购记录
```javascript
records.push({
  id: `purchase_${record._id}`,  // 添加前缀避免重复
  type: 'expense',
  source: 'purchase',
  // ...
})
```

### 2. 治疗用药记录
```javascript
records.push({
  id: `treatment_${record._id}`,  // 添加前缀避免重复
  type: 'expense',
  source: 'treatment',
  // ...
})
```

### 3. 其他记录的id前缀

| 记录类型 | id前缀 | 示例 |
|---------|-------|------|
| 财务收入记录 | 无（直接使用record._id） | `record._id` |
| 财务成本记录 | 无（直接使用record._id） | `record._id` |
| 出栏记录（销售收入） | `exit_` | `exit_${record._id}` |
| 入栏记录（采购成本） | `entry_` | `entry_${record._id}` |
| 投喂记录（饲料成本） | `feed_` | `feed_${record._id}` |
| 采购记录（物料采购） | `purchase_` | `purchase_${record._id}` |
| 治疗领用记录 | `treatment_` | `treatment_${record._id}` |

## 修复位置

`cloudfunctions/finance-management/index.js` - `getAllFinanceRecords` 函数

## 验证方法

1. 清空小程序缓存
2. 重新加载财务记录列表
3. 检查控制台是否还有 wx:key 重复警告

## 注意事项

- 修复后，前端获取的记录 id 会包含前缀
- 如果需要获取原始 id，可以使用 `record.relatedRecordId` 或 `record.rawRecord._id`
- 前端不需要修改，因为 wx:key 只用于列表渲染，不影响业务逻辑

## 相关文件

- `cloudfunctions/finance-management/index.js` - 修复了采购记录和治疗领用记录的id生成逻辑

