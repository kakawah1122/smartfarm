# 修复死亡记录财务损失计算问题

## 问题描述

死亡记录创建成功，但财务损失显示为 ¥0.00。

## 根本原因

死亡记录使用的 `avgCost`（饲养成本）只包含物料成本（饲料等），**不包含入栏价**。

对于死亡损失，应该使用 `avgTotalCost`（综合成本 = 入栏价 + 物料成本 + 预防成本 + 治疗成本）。

## 成本计算说明

### calculateBatchCost 返回的成本字段

```javascript
{
  success: true,
  data: {
    avgCost: "5.20",              // ❌ 只包含物料成本（饲养成本）
    avgBreedingCost: "5.20",      // ❌ 只包含物料成本（饲养成本）
    avgTotalCost: "85.20",        // ✅ 综合成本（包含入栏价）
    entryUnitCost: "80.00",       // ✅ 入栏单价
    breakdown: {
      entryCost: "8000.00",       // 入栏成本 = 入栏单价 × 入栏数量
      materialCost: "520.00",     // 物料成本（饲料等）
      preventionCost: "0.00",     // 预防成本（疫苗等）
      treatmentCost: "0.00",      // 治疗成本
      totalCost: "8520.00"        // 总成本 = 上述所有成本之和
    },
    batchInfo: {
      initialQuantity: 100,        // 入栏数量
      currentCount: 100,           // 当前存栏数
      entryUnitCost: 80            // 入栏单价
    }
  }
}
```

### 成本计算公式

```javascript
// 饲养成本（只包含物料成本）
avgBreedingCost = materialCost / currentCount

// 综合成本（包含所有成本）
totalCost = entryCost + materialCost + preventionCost + treatmentCost
avgTotalCost = totalCost / currentCount

// 死亡损失应使用综合成本
deathLoss = avgTotalCost × deathCount
```

## 修复内容

### 1. 疫苗接种后死亡 (`createDeathFromVaccine`)

**修复前**:
```javascript
const unitCost = parseFloat(costResult.data.avgCost)  // ❌ 只包含物料成本
const totalLoss = (unitCost * deathCount).toFixed(2)
```

**修复后**:
```javascript
// ✅ 使用综合成本（包含入栏价）
let unitCost = parseFloat(costResult.data.avgTotalCost) || 0

// 如果综合成本为0，尝试使用入栏单价
if (unitCost === 0) {
  unitCost = parseFloat(costResult.data.entryUnitCost) || 0
}

const totalLoss = (unitCost * deathCount).toFixed(2)
```

### 2. 标准死亡记录创建 (`createDeathRecord`)

修复逻辑同上。

### 3. 治疗完成后死亡 (`completeTreatmentOutcome`)

**修复前**:
```javascript
const avgCost = await calculateBatchCost({ batchId: batchDocId }, wxContext)
costPerAnimal = parseFloat(avgCost.data?.avgCost || 0)  // ❌ 只包含物料成本
```

**修复后**:
```javascript
const avgCost = await calculateBatchCost({ batchId: batchDocId }, wxContext)
// ✅ 使用综合成本（包含入栏价）
costPerAnimal = parseFloat(avgCost.data?.avgTotalCost) || 0

// 如果综合成本为0，尝试使用入栏单价
if (costPerAnimal === 0) {
  costPerAnimal = parseFloat(avgCost.data?.entryUnitCost) || 0
}
```

### 4. AI诊断创建死亡记录 (`createDiagnosisDeathRecord`)

修复逻辑同上。

### 5. 治疗无效记录死亡 (`recordDeathFromTreatment`)

修复逻辑同上。

## 修复后的数据结构

### 死亡记录 (`health_death_records`)

```javascript
{
  _id: "xxx",
  _openid: "oXXXX...",
  batchId: "batch_id",
  batchNumber: "QY-20251015",
  deathDate: "2025-11-04",
  deathCount: 3,
  deathCause: "疫苗接种后死亡",
  
  // ✅ 财务损失信息（新）
  financialLoss: {
    unitCost: "85.20",           // 综合成本（包含入栏价）
    totalLoss: "255.60",         // 总损失 = 85.20 × 3
    calculationMethod: "batch_average",
    financeRecordId: "finance_xxx"
  },
  
  operatorName: "张三",           // ✅ 已修复
  isDeleted: false,
  createdAt: Date,
  updatedAt: Date
}
```

### 财务记录 (`finance_cost_records`)

```javascript
{
  _id: "finance_xxx",
  type: "death_loss",
  category: "batch_cost",
  batchId: "batch_id",
  batchNumber: "QY-20251015",
  amount: 255.60,                // 总损失
  unitCost: 85.20,               // 综合成本
  quantity: 3,                   // 死亡数量
  relatedRecordId: "death_xxx",  // 关联死亡记录ID
  date: "2025-11-04",
  description: "死亡损失",
  createdBy: "oXXXX...",
  createdAt: Date
}
```

## 调试日志

修复后添加了详细的调试日志：

```
[疫苗死亡] 开始计算批次成本: {
  batchId: "batch_id",
  batchDocId: "xxx",
  batchNumber: "QY-20251015"
}

[疫苗死亡] 成本计算结果: {
  success: true,
  avgCost: "5.20",
  avgTotalCost: "85.20",      // ✅ 综合成本
  entryUnitCost: "80.00",     // ✅ 入栏单价
  hasData: true
}

[疫苗死亡] 财务计算: {
  deathCount: 3,
  unitCost: 85.20,            // ✅ 使用综合成本
  totalLoss: "255.60",
  isZero: false,
  costBreakdown: { ... }
}

[疫苗死亡] 用户查询结果: {
  openid: "oXXXX...",
  found: true,
  userName: "张三"             // ✅ 操作人员正常显示
}

[疫苗死亡] 调用 finance-management 云函数: {
  type: "death_loss",
  amount: 255.60,
  quantity: 3
}

[疫苗死亡] 财务记录创建成功: finance_xxx

[疫苗死亡] 更新死亡记录的 financeRecordId: finance_xxx
```

## 部署步骤

### 1. 上传云函数

```bash
右键 cloudfunctions/health-management → 上传并部署：云端安装依赖
```

### 2. 验证修复

1. **创建新的死亡记录**
   - 进入疫苗记录
   - 点击"记录死亡"
   - 输入数量（如：3只）
   - 确认创建

2. **查看死亡记录详情**
   - 进入死亡记录列表
   - 点击刚创建的记录
   - 检查财务损失字段：
     - ✅ 总损失 > ¥0.00
     - ✅ 单只损失 > ¥0.00
     - ✅ 操作人员显示正确

3. **查看云函数日志**
   - 云开发控制台 → 云函数 → `health-management` → 日志
   - 查找 `[疫苗死亡]` 相关日志
   - 确认：
     - ✅ `avgTotalCost` 不为 0
     - ✅ `unitCost` 不为 0
     - ✅ `totalLoss` 不为 0
     - ✅ `财务记录创建成功`

4. **查看财务记录**
   - 云开发控制台 → 数据库 → `finance_cost_records`
   - 查找最新的 `type: "death_loss"` 记录
   - 检查：
     - ✅ `amount` 字段有值
     - ✅ `unitCost` 字段有值
     - ✅ `relatedRecordId` 关联到死亡记录

## 验证清单

- [ ] 云函数已重新部署
- [ ] 创建新的死亡记录（疫苗接种后死亡）
- [ ] 死亡记录详情显示财务损失 > ¥0.00
- [ ] 操作人员显示正确的姓名（不是"未知"）
- [ ] 云函数日志显示正确的成本计算
- [ ] 财务记录已创建并关联
- [ ] 死亡记录的 `financeRecordId` 已更新

## 常见问题

### Q1: 财务损失还是 ¥0.00？

**A1**: 检查以下几点：

1. **批次是否有入栏单价**
   - 打开云开发控制台 → 数据库 → `prod_batch_entries`
   - 找到对应批次
   - 检查 `unitPrice` 字段是否有值
   - 如果没有，需要在入栏记录中补充单价

2. **查看云函数日志**
   ```
   [疫苗死亡] 成本计算结果: {
     avgTotalCost: "0.00",  // ❌ 综合成本为0
     entryUnitCost: "0.00"  // ❌ 入栏单价也为0
   }
   ```
   
   如果都是 0，说明批次缺少入栏单价。

3. **手动补充入栏单价**
   - 数据库 → `prod_batch_entries` → 找到批次
   - 添加或更新 `unitPrice` 字段（如：80.00）
   - 重新创建死亡记录

### Q2: 如何查看成本明细？

**A2**: 在云函数日志中查找：

```
[疫苗死亡] 财务计算: {
  deathCount: 3,
  unitCost: 85.20,
  totalLoss: "255.60",
  costBreakdown: {
    entryCost: "8000.00",      // 入栏成本
    materialCost: "520.00",    // 物料成本
    preventionCost: "0.00",    // 预防成本
    treatmentCost: "0.00",     // 治疗成本
    totalCost: "8520.00"       // 总成本
  }
}
```

### Q3: 旧的死亡记录如何更新？

**A3**: 旧记录的财务损失不会自动更新，但可以：

1. **重新创建记录**（推荐）
   - 删除旧记录
   - 重新通过"记录死亡"创建

2. **手动更新数据库**（高级）
   - 打开 `health_death_records` 集合
   - 找到旧记录
   - 手动更新 `financialLoss` 字段

3. **批量修复脚本**
   - 参考 `docs/fix-operator-name-issue.md` 中的批量修复方法
   - 创建临时云函数重新计算旧记录的成本

## 相关文档

- `docs/vaccine-tracking-treatment-feature.md` - 疫苗追踪功能文档
- `docs/fix-operator-name-issue.md` - 操作人员显示修复
- `docs/debug-death-finance-link.md` - 财务关联调试指南

## 完成

修复后，所有新创建的死亡记录都会正确计算并显示财务损失。

