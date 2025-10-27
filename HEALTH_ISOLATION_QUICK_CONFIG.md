# health_isolation_records - 快速配置卡片 🚀

## 📦 集合创建（1分钟）

**集合名称**：`health_isolation_records`

**权限设置**：选择 **"所有用户可读、创建者可读写"**

---

## 📊 索引配置（3分钟）

### 索引1️⃣：批次和日期索引

```
索引名称：batchId_1_startDate_-1
索引属性：非唯一

字段配置：
  字段1：batchId     排序：升序（1）
  字段2：startDate   排序：降序（-1）
```

### 索引2️⃣：养殖场和日期索引

```
索引名称：farmId_1_startDate_-1
索引属性：非唯一

字段配置：
  字段1：farmId      排序：升序（1）
  字段2：startDate   排序：降序（-1）
```

### 索引3️⃣：状态查询索引

```
索引名称：farmId_1_status_1
索引属性：非唯一

字段配置：
  字段1：farmId      排序：升序（1）
  字段2：status      排序：升序（1）
```

---

## 🔑 核心字段速查

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| batchId | String | ✅ | 批次ID |
| farmId | String | ✅ | 养殖场ID |
| startDate | String | ✅ | 开始日期（YYYY-MM-DD） |
| endDate | String | ❌ | 结束日期 |
| isolationCount | Number | ✅ | 隔离数量 |
| reason | String | ✅ | 隔离原因 |
| status | String | ✅ | 状态（isolating/released/died） |
| notes | String | ❌ | 备注 |

---

## ✅ 配置检查

- [ ] 集合名称正确：`health_isolation_records`
- [ ] 权限：所有用户可读、创建者可读写
- [ ] 索引1：`batchId_1_startDate_-1` ✅
- [ ] 索引2：`farmId_1_startDate_-1` ✅
- [ ] 索引3：`farmId_1_status_1` ✅

---

## 🎯 完成后

1. 重新部署 `health-management` 云函数
2. 测试AI诊断功能
3. 检查不再出现"collection not exists"错误

---

**预计时间**：5分钟  
**紧急程度**：🟡 中等（不影响核心功能，但需要完善）

---

**快速参考日期**：2025-10-26

