# 死亡记录创建失败问题修复

## 问题描述

在 AI 死因剖析完成后，点击"记录死亡报告"按钮时显示"创建死亡记录失败"。

## 问题原因

在 `health-management` 云函数的 `createDeathRecordWithFinance` 函数中，使用了错误的数据库集合名称：

1. **第 1810 行**：使用了 `COLLECTIONS.PRODUCTION_BATCHES`（'production_batches'）
   - **应该使用**：`COLLECTIONS.PROD_BATCH_ENTRIES`（'prod_batch_entries'）
   - 实际的入栏批次数据存储在 `prod_batch_entries` 表中

2. **第 1876 行**：更新批次存栏量时也使用了错误的集合名称
   - **应该使用**：`COLLECTIONS.PROD_BATCH_ENTRIES`

3. **成本计算逻辑错误**：
   - 原代码：`const unitCost = currentStock > 0 ? (batch.totalCost || 0) / currentStock : 50`
   - 修复后：`const unitCost = currentStock > 0 ? (batch.unitCost || 0) : 50`
   - 直接使用批次的 `unitCost` 字段（入栏单价）更合理

## 已修复的内容

### 文件：`cloudfunctions/health-management/index.js`

#### 修复 1：获取批次信息（第 1810-1823 行）

```javascript
// 修复前
const batchResult = await db.collection(COLLECTIONS.PRODUCTION_BATCHES)
  .doc(batchId)
  .get()
const currentStock = batch.currentQuantity || batch.initialQuantity || 0
const unitCost = currentStock > 0 ? (batch.totalCost || 0) / currentStock : 50

// 修复后
const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
  .doc(batchId)
  .get()
const currentStock = batch.currentCount || batch.quantity || 0
const unitCost = currentStock > 0 ? (batch.unitCost || 0) : 50
```

#### 修复 2：更新批次存栏量（第 1876-1884 行）

```javascript
// 修复前
await db.collection(COLLECTIONS.PRODUCTION_BATCHES)
  .doc(batchId)
  .update({
    data: {
      currentQuantity: db.command.inc(-deathCount),
      deathCount: db.command.inc(deathCount),
      updateTime: new Date()
    }
  })

// 修复后
await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
  .doc(batchId)
  .update({
    data: {
      currentCount: _.inc(-deathCount),
      deadCount: _.inc(deathCount),
      updatedAt: new Date()
    }
  })
```

## 部署步骤

### 方式一：使用微信开发者工具（推荐）

1. 打开微信开发者工具
2. 选择项目目录
3. 在云开发控制台中找到 `health-management` 云函数
4. 右键点击 → "上传并部署：云端安装依赖"
5. 等待部署完成

### 方式二：使用命令行（如果已配置）

```bash
# 进入项目目录
cd /Users/kaka/Documents/Sync/小程序/鹅数通

# 部署云函数
wx-cloud functions:deploy health-management
```

## 验证修复

1. 重新进入小程序
2. 进入 AI 智能诊断
3. 选择"死因剖析"类型
4. 输入死亡数量和剖检信息
5. 完成 AI 诊断后，点击"记录死亡报告"按钮
6. 应该能成功创建死亡记录并跳转到详情页面

## 预期结果

- ✅ 成功创建死亡记录
- ✅ 正确计算财务损失（使用批次入栏单价）
- ✅ 更新批次的当前存栏数和死亡数
- ✅ 关联 AI 诊断结果
- ✅ 跳转到死亡记录详情页面

## 相关文件

- `cloudfunctions/health-management/index.js`（已修复）
- `cloudfunctions/health-management/collections.js`（集合名称定义）
- `miniprogram/packageAI/ai-diagnosis/ai-diagnosis.ts`（前端调用）

## 修复日期

2025-10-25

