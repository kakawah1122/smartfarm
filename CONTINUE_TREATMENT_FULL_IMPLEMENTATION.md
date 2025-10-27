# 继续治疗完整功能实现文档

## 📋 需求分析

用户需求："**进一步治疗**，进一步就有可能还要用药"，需要：
1. **添加治疗笔记** - 记录治疗观察、病情变化
2. **追加用药** - 在治疗过程中继续添加药品，关联库存
3. **调整治疗方案** - 修改治疗方案和更换药品

## 🎯 功能设计

### 用户交互流程

```
治疗中列表 → 点击条目 → 治疗详情页（查看模式）
                           ↓
                    ┌──────┴──────┐
                    │  治疗进展   │
                    │  - 用药记录 │
                    │  - 统计数据 │
                    └──────┬──────┘
                           ↓
              ┌────────────┼────────────┐
              │            │            │
        【继续治疗】  【记录治愈】 【记录死亡】
              ↓
     ┌────────┴────────┐
     │  选择操作类型   │
     ├─────────────────┤
     │ 📝 添加治疗笔记  │
     │ 💊 追加用药     │
     │ 📋 调整治疗方案  │
     └─────────────────┘
```

### 三大核心功能

#### 1. 添加治疗笔记 📝

**功能描述**：
- 记录治疗观察、病情变化、食欲情况等
- 不改变统计数字，纯文字记录
- 所有笔记存储在`treatmentHistory`数组中

**字段设计**：
```javascript
{
  type: 'note',
  content: '笔记内容（最多500字）',
  createdAt: '2025-10-27T10:30:00.000Z',
  createdBy: 'openid'
}
```

**表单验证**：
- 必填：笔记内容（不能为空）
- 长度：最多500字

#### 2. 追加用药 💊

**功能描述**：
- 从库存中选择药品/营养品
- 根据治疗类型动态过滤：
  - 药物治疗：药品 + 营养品
  - 隔离观察：仅营养品
- 实时显示库存，验证库存充足
- 自动扣减库存，创建库存日志
- 事务处理确保数据一致性

**字段设计**：
```javascript
// medications 数组新增项
{
  materialId: '药品ID',
  name: '药品名称',
  quantity: 2,
  unit: '件',
  dosage: '10mg/kg 每日2次（可选）',
  category: '药品' | '营养品'
}

// treatmentHistory 数组新增项
{
  type: 'medication_added',
  medication: { ...药品信息 },
  createdAt: '2025-10-27T10:30:00.000Z',
  createdBy: 'openid'
}

// prod_inventory_logs 新增记录
{
  operationType: '治疗领用',
  quantity: -2,
  relatedModule: 'health_treatment',
  notes: '追加用药：浆膜清，用法：10mg/kg 每日2次'
}
```

**表单验证**：
- 必填：药品、数量
- 选填：用法用量
- 验证：数量 > 0 && 数量 <= 库存

**后端事务**：
```javascript
transaction:
  1. 扣减库存 (prod_materials.currentStock -= quantity)
  2. 创建库存日志 (prod_inventory_logs)
  3. 更新治疗记录 (medications + treatmentHistory)
```

#### 3. 调整治疗方案 📋

**功能描述**：
- 显示当前治疗方案，支持编辑
- 填写调整原因（可选）
- 保存新旧方案对比记录

**字段设计**：
```javascript
// treatmentPlan 更新
{
  primary: '新的治疗方案'
}

// treatmentHistory 数组新增项
{
  type: 'plan_adjusted',
  oldPlan: '原治疗方案',
  newPlan: '新治疗方案',
  reason: '调整原因（可选）',
  createdAt: '2025-10-27T10:30:00.000Z',
  createdBy: 'openid'
}
```

**表单验证**：
- 必填：治疗方案
- 选填：调整原因

## 💻 技术实现

### 前端实现

#### 数据结构 (treatment-record.ts)

```typescript
data: {
  // 继续治疗对话框
  showContinueTreatmentDialog: false,
  
  // 治疗笔记
  showNoteDialog: false,
  noteForm: {
    content: ''
  },
  
  // 追加用药
  showAddMedicationFormDialog: false,
  addMedicationForm: {
    materialIndex: -1,
    materialId: '',
    materialName: '',
    materialCode: '',
    category: '',
    unit: '',
    currentStock: 0,
    quantity: '',
    dosage: ''
  },
  
  // 调整方案
  showAdjustPlanFormDialog: false,
  adjustPlanForm: {
    treatmentPlan: '',
    reason: ''
  }
}
```

#### 关键方法

1. **继续治疗选项**：
   ```typescript
   showContinueTreatmentOptions() {
     this.setData({ showContinueTreatmentDialog: true })
   }
   ```

2. **添加笔记**：
   ```typescript
   submitTreatmentNote() {
     await wx.cloud.callFunction({
       name: 'health-management',
       data: {
         action: 'add_treatment_note',
         treatmentId, note
       }
     })
   }
   ```

3. **追加用药**：
   ```typescript
   submitAddMedication() {
     // 验证表单
     // 调用云函数
     await wx.cloud.callFunction({
       name: 'health-management',
       data: {
         action: 'add_treatment_medication',
         treatmentId, medication
       }
     })
   }
   ```

4. **调整方案**：
   ```typescript
   submitAdjustPlan() {
     await wx.cloud.callFunction({
       name: 'health-management',
       data: {
         action: 'update_treatment_plan',
         treatmentId, treatmentPlan, adjustReason
       }
     })
   }
   ```

### 后端实现 (cloudfunctions/health-management/index.js)

#### 新增 Actions

```javascript
case 'add_treatment_note':
  return await addTreatmentNote(event, wxContext)

case 'add_treatment_medication':
  return await addTreatmentMedication(event, wxContext)

case 'update_treatment_plan':
  return await updateTreatmentPlan(event, wxContext)
```

#### 核心函数

1. **添加治疗笔记**：
   ```javascript
   async function addTreatmentNote(event, wxContext) {
     // 1. 验证参数和权限
     // 2. 创建笔记记录
     // 3. 更新治疗记录（push to treatmentHistory）
   }
   ```

2. **追加用药（事务）**：
   ```javascript
   async function addTreatmentMedication(event, wxContext) {
     // 1. 验证参数、权限、库存
     // 2. 开始事务
     const transaction = await db.startTransaction()
     try {
       // 2.1 扣减库存
       await transaction.collection('prod_materials').update(...)
       
       // 2.2 创建库存日志
       await transaction.collection('prod_inventory_logs').add(...)
       
       // 2.3 更新治疗记录
       await transaction.collection('health_treatment_records').update(...)
       
       // 2.4 提交事务
       await transaction.commit()
     } catch (error) {
       // 回滚事务
       await transaction.rollback()
       throw error
     }
   }
   ```

3. **调整治疗方案**：
   ```javascript
   async function updateTreatmentPlan(event, wxContext) {
     // 1. 验证参数和权限
     // 2. 记录方案调整历史
     // 3. 更新治疗方案
   }
   ```

## 🎨 UI 设计

### 继续治疗选项弹窗

```
┌─────────────────────────┐
│      继续治疗           │
├─────────────────────────┤
│ 📝 添加治疗笔记         │
│    记录治疗观察、病情   │  →
├─────────────────────────┤
│ 💊 追加用药            │
│    添加新的药品或营养品 │  →
├─────────────────────────┤
│ 📋 调整治疗方案         │
│    修改治疗方案或更换   │  →
└─────────────────────────┘
```

### 用药记录卡片

```
┌─────────────────────────┐
│ 用药记录                │
├─────────────────────────┤
│ 💊 浆膜清               │
│    2件                  │
│    10mg/kg 每日2次      │
├─────────────────────────┤
│ 💊 3%葡萄糖             │
│    1件                  │
│    (无用法用量)         │
└─────────────────────────┘
```

### 样式特点

1. **卡片式设计**：圆角、阴影、灰色背景
2. **图标标识**：📝笔记、💊药品、📋方案
3. **交互反馈**：点击缩放、loading提示
4. **信息层次**：标题-描述-详情
5. **响应式**：自适应屏幕宽度

## 📊 数据库设计

### health_treatment_records 集合

```javascript
{
  _id: '治疗记录ID',
  treatmentId: 'TR20251027001',
  batchId: 'QY-20251022',
  diagnosis: '浆膜炎',
  treatmentType: 'medication',
  treatmentPlan: {
    primary: '喂增强素还有酵素。温度的话，可以稍微再给它加一度'
  },
  
  // ✅ 用药列表（包含初始+追加）
  medications: [
    {
      materialId: 'xxx',
      name: '浆膜清',
      quantity: 2,
      unit: '件',
      dosage: '10mg/kg 每日2次',
      category: '药品'
    },
    // ... 更多用药记录
  ],
  
  // ✅ 治疗历史（完整追溯）
  treatmentHistory: [
    {
      type: 'note',
      content: '今日观察：精神状态好转，食欲增加',
      createdAt: '2025-10-27T10:30:00.000Z',
      createdBy: 'openid1'
    },
    {
      type: 'medication_added',
      medication: { ... },
      createdAt: '2025-10-27T14:20:00.000Z',
      createdBy: 'openid1'
    },
    {
      type: 'plan_adjusted',
      oldPlan: '原方案',
      newPlan: '新方案',
      reason: '效果不理想，需要调整',
      createdAt: '2025-10-27T16:45:00.000Z',
      createdBy: 'openid1'
    }
  ],
  
  outcome: {
    status: 'ongoing',
    curedCount: 0,
    deathCount: 0
  },
  
  isDraft: false,
  isDeleted: false,
  createTime: '2025-10-27T08:00:00.000Z',
  updateTime: '2025-10-27T16:45:00.000Z'
}
```

### prod_inventory_logs 集合（追加用药时创建）

```javascript
{
  materialId: '药品ID',
  materialCode: 'M256784',
  materialName: '浆膜清',
  category: '药品',
  operationType: '治疗领用',
  quantity: -2,
  unit: '件',
  beforeStock: 60,
  afterStock: 58,
  relatedModule: 'health_treatment',
  relatedId: '治疗记录ID',
  notes: '追加用药：浆膜清，用法：10mg/kg 每日2次',
  operator: 'openid',
  createTime: '2025-10-27T14:20:00.000Z'
}
```

## ✅ 测试要点

### 功能测试

1. **治疗笔记**：
   - ✅ 点击"继续治疗" → 选择"添加治疗笔记"
   - ✅ 输入笔记内容（测试空内容、正常内容、超长内容）
   - ✅ 提交后显示成功提示
   - ✅ 自动刷新治疗详情
   - ✅ 笔记记录在历史中

2. **追加用药**：
   - ✅ 点击"继续治疗" → 选择"追加用药"
   - ✅ 选择药品（测试药物治疗=全部，隔离观察=仅营养品）
   - ✅ 显示库存信息
   - ✅ 输入数量（测试0、负数、超过库存、正常值）
   - ✅ 填写用法用量（可选）
   - ✅ 提交后库存正确扣减
   - ✅ 库存日志正确创建
   - ✅ medications数组正确更新
   - ✅ 用药记录显示在页面上

3. **调整方案**：
   - ✅ 点击"继续治疗" → 选择"调整治疗方案"
   - ✅ 显示当前治疗方案
   - ✅ 编辑治疗方案
   - ✅ 填写调整原因（可选）
   - ✅ 提交后方案正确更新
   - ✅ 历史记录保存新旧对比

### 边界情况

1. **权限验证**：
   - ❌ 非记录创建人无法操作
   - ❌ 已删除的记录无法操作

2. **库存验证**：
   - ❌ 库存为0时无法追加用药
   - ❌ 数量超过库存时提示错误

3. **事务完整性**：
   - ✅ 库存扣减失败时回滚
   - ✅ 日志创建失败时回滚
   - ✅ 记录更新失败时回滚

4. **UI交互**：
   - ✅ Loading状态显示
   - ✅ 错误提示友好
   - ✅ 对话框正确关闭
   - ✅ 数据刷新及时

## 🚀 部署步骤

1. **前端代码**：已自动更新（小程序编译）
2. **云函数部署**：
   ```bash
   右键 cloudfunctions/health-management
   → 上传并部署：云端安装依赖
   ```
3. **验证部署**：
   - 查看云函数日志
   - 测试三个新action

## 📝 API 文档

### add_treatment_note

**请求参数**：
```javascript
{
  action: 'add_treatment_note',
  treatmentId: '治疗记录ID',
  note: '治疗笔记内容（最多500字）'
}
```

**响应示例**：
```javascript
{
  success: true,
  message: '治疗笔记保存成功'
}
```

### add_treatment_medication

**请求参数**：
```javascript
{
  action: 'add_treatment_medication',
  treatmentId: '治疗记录ID',
  medication: {
    materialId: '药品ID',
    name: '药品名称',
    materialCode: '药品编码',
    category: '药品' | '营养品',
    unit: '件',
    quantity: 2,
    dosage: '10mg/kg 每日2次'
  }
}
```

**响应示例**：
```javascript
{
  success: true,
  message: '用药追加成功，库存已扣减'
}
```

### update_treatment_plan

**请求参数**：
```javascript
{
  action: 'update_treatment_plan',
  treatmentId: '治疗记录ID',
  treatmentPlan: '新的治疗方案',
  adjustReason: '调整原因（可选）'
}
```

**响应示例**：
```javascript
{
  success: true,
  message: '治疗方案调整成功'
}
```

## 🎯 总结

### 实现的核心价值

1. **完整的治疗流程**：
   - 制定方案 → 治疗中 → 继续治疗（观察/用药/调整）→ 完成治疗

2. **灵活的治疗管理**：
   - 笔记：随时记录观察
   - 用药：根据病情追加
   - 方案：效果不佳及时调整

3. **数据完整性**：
   - 所有操作记录在历史中
   - 库存事务保证一致性
   - 权限验证保证安全性

4. **用户体验优化**：
   - 清晰的操作流程
   - 实时的反馈提示
   - 友好的错误处理

### 下一步优化建议

1. **治疗历史展示**：
   - 在治疗详情页增加"治疗历史"tab
   - 时间线方式展示所有操作
   - 支持查看详细记录

2. **数据统计**：
   - 统计用药总量
   - 统计方案调整次数
   - 分析治疗效果

3. **提醒功能**：
   - 用药提醒
   - 复查提醒
   - 异常提醒

## 📅 更新日志

**2025-10-27**
- ✅ 完整实现继续治疗功能
- ✅ 添加治疗笔记功能
- ✅ 追加用药功能（库存关联）
- ✅ 调整治疗方案功能
- ✅ 用药记录卡片展示
- ✅ 完整的数据库设计
- ✅ 事务处理保证数据一致性
- ✅ 权限验证和错误处理
- ✅ UI优化和交互完善

