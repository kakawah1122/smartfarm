# 治疗记录库存关联修复

## 📋 问题描述

治疗记录中领取药品/营养品后，库存没有相应减少，导致库存数据不准确。

## 🔍 问题根源

1. **前端问题**：用户选择物料和输入数量后，直接点击"提交治疗方案"，但选中的物料信息没有被添加到 `medications` 数组中
2. **后端问题**：云函数 `createTreatmentFromAbnormal` 接收到 `medications` 数据后，没有执行库存扣减逻辑

## ✅ 完整修复方案

### 1. 前端修复 - 提交时自动添加物料

**文件**: `miniprogram/packageHealth/treatment-record/treatment-record.ts`

在 `submitForm` 方法中，提交前先将当前选中的物料添加到 medications 数组：

```typescript
// 提交表单
submitForm: async function() {
  if (!this.validateForm()) {
    wx.showToast({
      title: '请检查表单信息',
      icon: 'none'
    })
    return
  }
  
  // ✅ 在提交前，先将当前选中的物料添加到 medications 数组
  const { selectedMaterial, medicationQuantity, medicationDosage } = this.data
  if (selectedMaterial && medicationQuantity) {
    const quantity = parseFloat(medicationQuantity)
    
    // 验证库存
    if (quantity > selectedMaterial.currentStock) {
      wx.showToast({
        title: `库存不足，当前库存：${selectedMaterial.currentStock}`,
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    // 添加到medications数组
    const newMedication = {
      materialId: selectedMaterial._id,      // ✅ 关键字段
      name: selectedMaterial.name,
      specification: selectedMaterial.specification || '',
      quantity: quantity,                     // ✅ 关键字段
      unit: selectedMaterial.unit || '件',
      dosage: medicationDosage || '',
      startDate: this.data.formData.treatmentDate,
      category: selectedMaterial.category
    }
    
    const medications = [...this.data.medications, newMedication]
    this.setData({ medications })
    
    console.log('✅ 添加药物到medications:', newMedication)
  }
  
  // ... 继续提交流程
}
```

**关键点**：
- 确保 `materialId` 字段正确（对应物料的 `_id`）
- 确保 `quantity` 字段为数字类型
- 提交前验证库存是否充足

### 2. 后端修复 - 自动扣减库存

**文件**: `cloudfunctions/health-management/index.js`

在 `createTreatmentFromAbnormal` 函数中，添加库存扣减逻辑：

```javascript
// 创建治疗记录后
const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).add({
  data: treatmentData
})

// ✅ 如果是直接提交且有药物使用，扣减库存
if (isDirectSubmit && medications && medications.length > 0) {
  for (const med of medications) {
    if (med.materialId && med.quantity > 0) {
      try {
        // 检查库存
        const material = await db.collection('prod_materials').doc(med.materialId).get()
        
        if (material.data) {
          const currentStock = material.data.currentStock || 0
          
          if (currentStock < med.quantity) {
            console.warn(`⚠️ 库存不足: ${material.data.name}，当前库存：${currentStock}，需要：${med.quantity}`)
            continue  // 库存不足时跳过，不阻断治疗记录创建
          }
          
          // 扣减库存
          const newStock = currentStock - med.quantity
          await db.collection('prod_materials').doc(med.materialId).update({
            data: {
              currentStock: newStock,
              updateTime: new Date()
            }
          })
          
          // 创建库存流水记录
          await db.collection('prod_inventory_logs').add({
            data: {
              materialId: med.materialId,
              recordId: treatmentResult._id,
              operation: '治疗领用',
              quantity: med.quantity,
              beforeStock: currentStock,
              afterStock: newStock,
              operator: openid,
              operationTime: new Date(),
              relatedType: 'treatment',
              notes: `治疗领用 - ${diagnosis}`
            }
          })
          
          console.log(`✅ 库存扣减成功: ${material.data.name}，数量：${med.quantity}，剩余：${newStock}`)
        }
      } catch (error) {
        console.error(`❌ 扣减库存失败:`, error)
        // 不阻断治疗记录创建
      }
    }
  }
}
```

**关键点**：
- 只在 `isDirectSubmit = true` 时扣减库存（草稿不扣减）
- 库存不足时记录警告，但不阻断治疗记录创建
- 同时创建库存流水记录，便于追溯
- 使用 try-catch 包裹，避免库存操作失败影响主流程

## 📊 数据流转

```
1. 用户选择药品/营养品
   ↓
2. 输入领取数量
   ↓
3. 点击"提交治疗方案"
   ↓
4. 前端：将选中物料添加到 medications 数组
   ↓
5. 前端：调用云函数 create_treatment_from_abnormal
   ↓
6. 后端：创建治疗记录
   ↓
7. 后端：如果 isDirectSubmit=true，扣减库存
   ↓
8. 后端：创建库存流水记录
   ↓
9. 前端：根据治疗类型跳转到相应页面
```

## 🔢 数据结构

### medications 数组结构

```javascript
[
  {
    materialId: "88ce883568c137840007e3b704f4c8c1",  // ✅ 物料ID
    name: "浆膜清",
    specification: "100ml",
    quantity: 2,                                      // ✅ 领取数量
    unit: "件",
    dosage: "10mg/kg 每日2次 连用7天",
    startDate: "2025-10-27",
    category: "药品"
  }
]
```

### 库存流水记录结构

```javascript
{
  materialId: "88ce883568c137840007e3b704f4c8c1",
  recordId: "治疗记录ID",
  operation: "治疗领用",
  quantity: 2,
  beforeStock: 60,
  afterStock: 58,
  operator: "openid",
  operationTime: "2025-10-27T10:30:00.000Z",
  relatedType: "treatment",
  notes: "治疗领用 - 鸭传染性浆膜炎"
}
```

## 🚀 部署步骤

1. **保存前端文件**：`miniprogram/packageHealth/treatment-record/treatment-record.ts`
2. **上传云函数**：右键 `cloudfunctions/health-management` → 上传并部署：云端安装依赖
3. **测试验证**：
   - 创建治疗记录
   - 选择药品并输入数量
   - 提交后检查库存是否减少
   - 检查 `prod_inventory_logs` 集合中是否有流水记录

## 📝 测试要点

1. ✅ 库存充足时：正常扣减，显示剩余库存
2. ⚠️ 库存不足时：前端拦截，提示库存不足
3. 📊 库存流水：记录操作前后库存数量
4. 🔄 数据一致性：治疗记录 + 库存扣减 + 流水记录三者一致

## 🎯 后续优化建议

1. **事务支持**：考虑使用数据库事务，确保治疗记录创建和库存扣减的原子性
2. **库存预占**：草稿状态时预占库存，避免提交时库存不足
3. **批量操作**：支持一次添加多个药品/营养品
4. **库存警告**：扣减后如果低于安全库存，发送通知提醒
5. **退药流程**：治疗取消或结束时，支持退回未使用的药品

## 📅 更新记录

- **2025-10-27**: 初始实现 - 添加治疗记录库存关联功能
  - 前端：提交时自动添加物料到 medications
  - 后端：自动扣减库存并创建流水记录

