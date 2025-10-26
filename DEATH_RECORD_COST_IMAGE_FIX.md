# 死亡记录成本和图片显示问题修复

## 问题描述

AI 死因剖析完成后，创建的死亡记录存在两个问题：
1. ❌ **财务损失和单位成本显示为 ¥0**
2. ❌ **诊断时上传的剖检图片没有显示**

## 问题分析

### 问题1：成本计算错误

**原代码逻辑**：
```javascript
const unitCost = currentStock > 0 ? (batch.unitCost || 0) : 50
```

**问题**：
- 只使用入栏单价（`batch.unitCost`），没有计算累计成本
- 实际成本应该包括：入栏成本 + 饲料成本 + 预防成本 + 治疗成本
- 如果批次刚入栏，`unitCost` 可能确实只是入栏价
- 但如果已经养了一段时间，需要计算平均综合成本

**解决方案**：
调用现有的 `calculateBatchCost` 函数，该函数会：
1. 获取入栏成本
2. 累加所有物料成本（饲料）
3. 累加所有预防成本（疫苗）
4. 累加所有治疗成本
5. 计算平均成本 = 总成本 / 当前存栏数

### 问题2：图片字段不一致

**数据流问题**：

1. **前端未传递图片**：
   - AI 诊断页面有上传图片功能，图片保存在 `this.data.images`
   - 但调用云函数时没有传递 `images` 参数

2. **后端未保存图片**：
   - 云函数 `createDeathRecordWithFinance` 没有接收 `images` 参数
   - 死亡记录数据中没有保存图片字段

3. **字段名不匹配**：
   - 后端保存字段名：`photos`
   - 前端期望字段名：`autopsyImages`

## 修复详情

### 修复1：优化成本计算逻辑

**文件**: `cloudfunctions/health-management/index.js` (第1820-1836行)

```javascript
// 修复前
const currentStock = batch.currentCount || batch.quantity || 0
const unitCost = currentStock > 0 ? (batch.unitCost || 0) : 50
const financeLoss = unitCost * deathCount

// 修复后
// 计算单位成本（使用 calculateBatchCost 函数获取综合成本）
let unitCost = 0
try {
  const costResult = await calculateBatchCost({ batchId }, wxContext)
  if (costResult.success && costResult.data.avgCost) {
    unitCost = parseFloat(costResult.data.avgCost)
  }
} catch (costError) {
  console.error('计算成本失败，使用入栏单价:', costError)
}

// 如果计算失败或为0，使用入栏单价
if (unitCost === 0) {
  unitCost = batch.unitCost || 50 // 默认50元/只
}

const financeLoss = unitCost * deathCount
```

**改进点**：
- ✅ 使用综合成本计算（更准确）
- ✅ 有容错机制（如果计算失败，回退到入栏单价）
- ✅ 最终默认值50元/只（如果都失败）

### 修复2：前端传递图片数据

**文件**: `miniprogram/packageAI/ai-diagnosis/ai-diagnosis.ts` (第815行)

```typescript
// 修复前
const result = await wx.cloud.callFunction({
  name: 'health-management',
  data: {
    action: 'create_death_record_with_finance',
    diagnosisId: this.data.diagnosisId,
    batchId: this.data.selectedBatchId,
    deathCount: deathCount,
    deathCause: deathCause,
    deathCategory: 'disease',
    autopsyFindings: this.data.autopsyDescription,
    diagnosisResult: diagnosis
  }
})

// 修复后
const result = await wx.cloud.callFunction({
  name: 'health-management',
  data: {
    action: 'create_death_record_with_finance',
    diagnosisId: this.data.diagnosisId,
    batchId: this.data.selectedBatchId,
    deathCount: deathCount,
    deathCause: deathCause,
    deathCategory: 'disease',
    autopsyFindings: this.data.autopsyDescription,
    diagnosisResult: diagnosis,
    images: this.data.images || [] // 传递剖检图片
  }
})
```

### 修复3：后端接收并保存图片

**文件**: `cloudfunctions/health-management/index.js` (第1792-1800行，第1851行)

```javascript
// 修复前
async function createDeathRecordWithFinance(event, wxContext) {
  try {
    const {
      diagnosisId,
      batchId,
      deathCount,
      deathCause,
      deathCategory = 'disease',
      autopsyFindings,
      diagnosisResult
    } = event
    // ...
    const deathRecordData = {
      // ... 其他字段
      autopsyFindings: autopsyFindings || '',
      // 缺少 photos 字段
    }

// 修复后
async function createDeathRecordWithFinance(event, wxContext) {
  try {
    const {
      diagnosisId,
      batchId,
      deathCount,
      deathCause,
      deathCategory = 'disease',
      autopsyFindings,
      diagnosisResult,
      images = [] // 接收图片参数
    } = event
    // ...
    const deathRecordData = {
      // ... 其他字段
      autopsyFindings: autopsyFindings || '',
      photos: images || [], // 保存剖检图片
    }
```

### 修复4：字段名映射

**文件**: `cloudfunctions/health-management/index.js` (第1984-1987行)

```javascript
// 新增字段映射逻辑
const record = result.data

// 字段映射：photos -> autopsyImages（前端期望的字段名）
if (record.photos && record.photos.length > 0) {
  record.autopsyImages = record.photos
}

// 继续后续处理...
```

**为什么需要映射**：
- 数据库统一使用 `photos` 字段（与其他死亡记录函数保持一致）
- 前端期望 `autopsyImages` 字段（接口设计时定义的）
- 在返回数据时做一次映射，兼容前端

## 部署步骤

### 1. 部署云函数（必须）

使用微信开发者工具：
1. 右键点击 `health-management` 云函数
2. 选择 "上传并部署：云端安装依赖"
3. 等待部署完成

### 2. 前端代码（需要重新编译）

1. 在微信开发者工具中点击"编译"
2. 或重启开发者工具

## 验证修复

### 测试步骤

1. **准备工作**：
   - 确保有存栏批次
   - 批次最好已经产生一些成本（饲料、疫苗等）

2. **进行死因剖析**：
   - 进入"AI智能诊断"
   - 选择"死因剖析"类型
   - 选择批次
   - 输入死亡数量（如：1只）
   - 上传剖检图片（2-4张）
   - 填写剖检所见

3. **查看诊断结果**：
   - 等待AI分析完成
   - 点击"记录死亡报告"按钮

4. **验证死亡记录详情**：
   - 自动跳转到详情页面
   - ✅ 检查"单位成本"是否显示正确金额（不是¥0）
   - ✅ 检查"财务损失"是否显示正确金额（不是¥0）
   - ✅ 检查是否显示剖检图片
   - ✅ 点击图片，验证是否可以预览

### 预期结果

**基本信息卡片**：
```
记录日期: 2025-10-25
批次号: QY-20251022
死亡数量: 1只
财务损失: ¥52.50（示例，实际根据成本计算）
单位成本: ¥52.50/只（示例，实际根据成本计算）
```

**剖检所见卡片**（如果有上传图片）：
```
剖检所见
[图片1] [图片2] [图片3]
（可点击预览大图）

描述内容...
```

## 成本计算说明

### calculateBatchCost 函数计算逻辑

1. **入栏成本** = 入栏单价 × 入栏数量
2. **物料成本** = 所有饲料使用记录的总成本
3. **预防成本** = 所有疫苗接种记录的总成本  
4. **治疗成本** = 所有治疗记录的总成本
5. **总成本** = 入栏成本 + 物料成本 + 预防成本 + 治疗成本
6. **平均成本** = 总成本 / 当前存栏数

### 示例

假设批次 QY-20251022：
- 入栏100只，单价30元，入栏成本 = 3000元
- 饲料成本累计1500元
- 疫苗成本累计200元
- 治疗成本累计300元
- 当前存栏95只

则：
- 总成本 = 3000 + 1500 + 200 + 300 = 5000元
- 平均成本 = 5000 / 95 = 52.63元/只

如果死亡1只：
- 财务损失 = 52.63 × 1 = 52.63元

## 相关文件

### 修改的文件

1. `cloudfunctions/health-management/index.js`
   - 优化成本计算逻辑
   - 接收并保存图片参数
   - 添加字段名映射

2. `miniprogram/packageAI/ai-diagnosis/ai-diagnosis.ts`
   - 传递图片数据到云函数

### 涉及的数据库集合

- `health_death_records` - 死亡记录表（存储死亡报告）
- `prod_batch_entries` - 入栏批次表（获取批次信息）
- `prod_material_records` - 物料使用记录（计算饲料成本）
- `health_prevention_records` - 预防记录（计算疫苗成本）
- `health_treatment_records` - 治疗记录（计算治疗成本）

## 修复日期

2025-10-25

