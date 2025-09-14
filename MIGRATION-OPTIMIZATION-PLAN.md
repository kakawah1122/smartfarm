# 🔄 数据库重构与优化实施方案

基于微信云开发最佳实践的系统重构计划。

## 📊 **现有 vs 标准化对比**

### **需要重命名的集合**

| 现有集合名 | 标准化集合名 | 模块 | 操作 |
|-----------|-------------|------|------|
| `users` | `wx_users` | 用户管理 | 🔄 重命名 |
| `employee_invites` | `wx_user_invites` | 用户管理 | 🔄 重命名 |
| `entry_records` | `prod_batch_entries` | 生产管理 | 🔄 重命名 |
| `exit_records` | `prod_batch_exits` | 生产管理 | 🔄 重命名 |
| `materials` | `prod_materials` | 生产管理 | 🔄 重命名 |
| `material_records` | `prod_material_records` | 生产管理 | 🔄 重命名 |
| `health_records` | `health_records` | 健康管理 | ✅ 保持 |
| `prevention_records` | `health_prevention_records` | 健康管理 | 🔄 重命名 |
| `treatment_records` | `health_treatment_records` | 健康管理 | 🔄 重命名 |
| `ai_diagnosis_records` | `health_ai_diagnosis` | 健康管理 | 🔄 重命名 |
| `cost_records` | `finance_cost_records` | 财务管理 | 🔄 重命名 |
| `financial_reports` | `finance_reports` | 财务管理 | 🔄 重命名 |
| `financial_summaries` | `finance_summaries` | 财务管理 | 🔄 重命名 |
| `batch_todos` | `task_batch_schedules` | 任务管理 | 🔄 重命名 |
| `task_completions` | `task_completions` | 任务管理 | ✅ 保持 |
| `admin_logs` | `sys_audit_logs` | 系统管理 | 🔄 重命名 |

### **需要新增的集合**

| 新增集合名 | 用途 | 优先级 | 数据来源 |
|-----------|------|-------|----------|
| `wx_user_sessions` | 用户会话管理 | 🟡 中等 | 新功能 |
| `task_templates` | 任务模板 | 🟢 高 | 从现有任务中提取 |
| `finance_revenue_records` | 收入记录 | 🟢 高 | 从出栏记录生成 |
| `sys_overview_stats` | 概览统计 | 🔴 必需 | 现有功能需要 |
| `sys_configurations` | 系统配置 | 🟡 中等 | 新功能 |

## 🛠️ **云函数重构方案**

### **1. breeding-todo 云函数优化**

#### **重构前代码结构问题**
```javascript
// 问题1：硬编码集合名
await db.collection('prevention_records').add({...})
await db.collection('financial_reports').add({...})

// 问题2：逻辑混乱
// 疫苗费用直接写入 financial_reports（应该写入 cost_records）

// 问题3：缺少配置管理
const collections = {
  prevention: 'prevention_records',
  finance: 'financial_reports'
}
```

#### **重构后标准化代码**
```javascript
// config/collections.js - 集合名称配置
const COLLECTIONS = {
  // 健康管理
  HEALTH_PREVENTION: 'health_prevention_records',
  
  // 财务管理  
  FINANCE_COSTS: 'finance_cost_records',
  FINANCE_SUMMARIES: 'finance_summaries',
  
  // 任务管理
  TASK_COMPLETIONS: 'task_completions',
  
  // 系统管理
  SYS_OVERVIEW: 'sys_overview_stats'
}

// utils/database.js - 数据库操作封装
class DatabaseManager {
  constructor(db) {
    this.db = db
    this.collections = COLLECTIONS
  }
  
  async createPreventionRecord(data) {
    return await this.db.collection(this.collections.HEALTH_PREVENTION).add({
      data: this.formatPreventionRecord(data)
    })
  }
  
  async createCostRecord(data) {
    return await this.db.collection(this.collections.FINANCE_COSTS).add({
      data: this.formatCostRecord(data)
    })
  }
  
  formatPreventionRecord(data) {
    return {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    }
  }
  
  formatCostRecord(data) {
    return {
      ...data,
      currency: 'CNY',
      createdAt: new Date(),
      isDeleted: false
    }
  }
}

// 重构后的疫苗接种处理函数
async function completeVaccineTask(event, wxContext) {
  const dbManager = new DatabaseManager(db)
  const { taskId, batchId, vaccineRecord } = event
  const openid = wxContext.OPENID

  try {
    // 1. 完成任务
    await completeTask(taskId, openid, batchId)

    // 2. 创建预防记录（标准化格式）
    const preventionData = {
      batchId,
      preventionType: 'vaccine',
      preventionDate: new Date().toISOString().split('T')[0],
      vaccineInfo: {
        name: vaccineRecord.vaccine.name,
        manufacturer: vaccineRecord.vaccine.manufacturer,
        batchNumber: vaccineRecord.vaccine.batchNumber,
        dosage: vaccineRecord.vaccine.dosage,
        route: vaccineRecord.vaccination.route,
        count: vaccineRecord.vaccination.count
      },
      veterinarianInfo: {
        name: vaccineRecord.veterinarian.name,
        contact: vaccineRecord.veterinarian.contact
      },
      costInfo: {
        vaccineCost: vaccineRecord.cost.vaccine,
        laborCost: vaccineRecord.cost.veterinary,
        otherCost: vaccineRecord.cost.other,
        totalCost: vaccineRecord.cost.total
      },
      effectiveness: 'pending',
      notes: vaccineRecord.notes,
      operator: openid
    }
    
    const preventionResult = await dbManager.createPreventionRecord(preventionData)

    // 3. 创建成本记录（正确的财务流向）
    if (vaccineRecord.cost && vaccineRecord.cost.total > 0) {
      const costData = {
        costType: 'medical',
        subCategory: 'vaccine',
        title: `疫苗接种费用 - ${vaccineRecord.vaccine.name}`,
        description: `批次：${batchId}，接种数量：${vaccineRecord.vaccination.count}只`,
        amount: vaccineRecord.cost.total,
        batchId,
        relatedRecords: [{
          type: 'prevention',
          recordId: preventionResult._id
        }],
        costBreakdown: {
          vaccine: vaccineRecord.cost.vaccine,
          labor: vaccineRecord.cost.veterinary,
          other: vaccineRecord.cost.other
        },
        costDate: new Date().toISOString().split('T')[0],
        createdBy: openid
      }

      await dbManager.createCostRecord(costData)
    }

    // 4. 更新概览统计
    await updateOverviewStats(batchId, 'prevention')

    return {
      success: true,
      message: '疫苗接种任务完成成功',
      data: {
        taskCompleted: true,
        preventionRecordId: preventionResult._id,
        hasAdverseReactions: false
      }
    }

  } catch (error) {
    console.error('完成疫苗接种任务失败:', error)
    return {
      success: false,
      error: error.message,
      data: null
    }
  }
}

module.exports = {
  DatabaseManager,
  COLLECTIONS,
  completeVaccineTask
}
```

### **2. health-management 云函数优化**

#### **重构后的预防记录查询**
```javascript
// 使用标准化集合名和字段
async function listPreventionRecords(event, wxContext) {
  const { page = 1, pageSize = 20, preventionType, batchId } = event
  
  let query = db.collection(COLLECTIONS.HEALTH_PREVENTION)
    .where({ isDeleted: false })
  
  if (preventionType) {
    query = query.where({ preventionType })
  }
  
  if (batchId) {
    query = query.where({ batchId })
  }
  
  const result = await query
    .orderBy('preventionDate', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    success: true,
    data: {
      records: result.data,
      total: result.data.length,
      page,
      pageSize
    }
  }
}
```

### **3. finance-management 云函数优化**

#### **统一的财务数据流处理**
```javascript
// 成本记录标准化处理
async function createCostRecord(event, wxContext) {
  const costData = {
    ...event,
    currency: 'CNY',
    createdBy: wxContext.OPENID,
    createdAt: new Date(),
    isDeleted: false
  }
  
  // 验证必需字段
  const requiredFields = ['costType', 'amount', 'costDate']
  for (const field of requiredFields) {
    if (!costData[field]) {
      throw new Error(`缺少必需字段: ${field}`)
    }
  }
  
  const result = await db.collection(COLLECTIONS.FINANCE_COSTS).add({
    data: costData
  })
  
  // 触发财务汇总更新
  await updateFinanceSummary(costData.costDate)
  
  return {
    success: true,
    data: { recordId: result._id }
  }
}

// 自动财务汇总
async function updateFinanceSummary(date) {
  const month = date.substring(0, 7) // YYYY-MM
  
  // 计算月度成本和收入
  const [costStats, revenueStats] = await Promise.all([
    calculateMonthlyCosts(month),
    calculateMonthlyRevenue(month)
  ])
  
  const summaryData = {
    period: month,
    periodType: 'month',
    totalRevenue: revenueStats.total,
    totalCost: costStats.total,
    netProfit: revenueStats.total - costStats.total,
    profitMargin: ((revenueStats.total - costStats.total) / revenueStats.total * 100).toFixed(2),
    costBreakdown: costStats.breakdown,
    revenueBreakdown: revenueStats.breakdown,
    generatedAt: new Date(),
    generatedBy: 'system'
  }
  
  // 更新或创建汇总记录
  await db.collection(COLLECTIONS.FINANCE_SUMMARIES)
    .where({ period: month })
    .limit(1)
    .get()
    .then(async (result) => {
      if (result.data.length > 0) {
        await db.collection(COLLECTIONS.FINANCE_SUMMARIES)
          .doc(result.data[0]._id)
          .update({ data: summaryData })
      } else {
        await db.collection(COLLECTIONS.FINANCE_SUMMARIES)
          .add({ data: summaryData })
      }
    })
}
```

## 📱 **前端优化方案**

### **1. 统一的 API 调用封装**

#### **新增 utils/cloudApi.js**
```typescript
// utils/cloudApi.js
interface CloudApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class CloudApi {
  // 健康管理 API
  static async createPreventionRecord(data: any): Promise<CloudApiResponse> {
    return wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'create_prevention_record',
        ...data
      }
    })
  }
  
  static async listPreventionRecords(params: any): Promise<CloudApiResponse> {
    return wx.cloud.callFunction({
      name: 'health-management', 
      data: {
        action: 'list_prevention_records',
        ...params
      }
    })
  }
  
  // 财务管理 API
  static async createCostRecord(data: any): Promise<CloudApiResponse> {
    return wx.cloud.callFunction({
      name: 'finance-management',
      data: {
        action: 'create_cost_record',
        ...data
      }
    })
  }
  
  // 任务管理 API
  static async completeVaccineTask(data: any): Promise<CloudApiResponse> {
    return wx.cloud.callFunction({
      name: 'breeding-todo',
      data: {
        action: 'completeVaccineTask',
        ...data
      }
    })
  }
}

export default CloudApi
```

### **2. breeding-todo 页面重构**

#### **标准化的疫苗接种提交**
```typescript
// pages/breeding-todo/breeding-todo.ts
import CloudApi from '../../utils/cloudApi'

// 重构后的疫苗接种提交
async submitVaccineForm() {
  if (!this.validateVaccineForm()) {
    return
  }

  wx.showLoading({ title: '提交中...' })

  try {
    // 使用标准化的 API 调用
    const result = await CloudApi.completeVaccineTask({
      taskId: this.data.selectedTask._id,
      batchId: this.data.selectedTask.batchId,
      vaccineRecord: {
        vaccine: {
          name: this.data.vaccineFormData.vaccineName,
          manufacturer: this.data.vaccineFormData.manufacturer,
          batchNumber: this.data.vaccineFormData.batchNumber,
          dosage: this.data.vaccineFormData.dosage
        },
        veterinarian: {
          name: this.data.vaccineFormData.veterinarianName,
          contact: this.data.vaccineFormData.veterinarianContact
        },
        vaccination: {
          route: this.data.vaccineRouteOptions[this.data.vaccineFormData.routeIndex],
          count: this.data.vaccineFormData.vaccinationCount,
          location: this.data.vaccineFormData.location
        },
        cost: {
          vaccine: parseFloat(this.data.vaccineFormData.vaccineCost || '0'),
          veterinary: parseFloat(this.data.vaccineFormData.veterinaryCost || '0'),
          other: parseFloat(this.data.vaccineFormData.otherCost || '0'),
          total: this.data.vaccineFormData.totalCost
        },
        notes: this.data.vaccineFormData.notes
      }
    })

    if (result.result.success) {
      wx.showToast({
        title: '疫苗接种记录提交成功',
        icon: 'success'
      })
      
      this.closeVaccineFormPopup()
      this.loadTodos() // 刷新任务列表
      
      // 检查是否有异常反应需要处理
      if (result.result.data.hasAdverseReactions) {
        this.handleVaccineAdverseReaction(result.result.data.preventionRecordId)
      }
    } else {
      throw new Error(result.result.error || '提交失败')
    }

  } catch (error) {
    console.error('提交疫苗接种记录失败:', error)
    wx.showToast({
      title: error.message || '提交失败，请重试',
      icon: 'error'
    })
  } finally {
    wx.hideLoading()
  }
}
```

### **3. health 页面数据源优化**

#### **使用标准化的数据获取**
```typescript
// pages/health/health.ts
import CloudApi from '../../utils/cloudApi'

// 加载预防管理数据
async loadPreventionData() {
  try {
    const result = await CloudApi.listPreventionRecords({
      pageSize: 10,
      preventionType: 'vaccine'
    })

    if (result.result.success) {
      const preventionData = {
        recentRecords: result.result.data.records,
        stats: this.calculatePreventionStats(result.result.data.records)
      }
      
      this.setData({ preventionData })
    }
  } catch (error) {
    console.error('加载预防管理数据失败:', error)
    // 显示默认数据
    this.setData({
      preventionData: {
        recentRecords: [],
        stats: { vaccinationRate: 0, preventionCost: 0 }
      }
    })
  }
}

// 计算预防统计数据
calculatePreventionStats(records: any[]) {
  const totalCost = records.reduce((sum, record) => {
    return sum + (record.costInfo?.totalCost || 0)
  }, 0)
  
  const vaccinationCount = records.filter(record => 
    record.preventionType === 'vaccine'
  ).length
  
  return {
    vaccinationRate: (vaccinationCount / records.length * 100).toFixed(1),
    preventionCost: totalCost,
    recordCount: records.length
  }
}
```

## 🗂️ **数据迁移方案**

### **阶段一：准备工作**
```bash
# 1. 备份现有数据
# 在云开发控制台进行数据导出

# 2. 创建新的标准化集合
# 按照 STANDARDIZED-DATABASE-DESIGN.md 创建

# 3. 配置权限和索引
# 按照标准化方案设置
```

### **阶段二：数据迁移**
```javascript
// 数据迁移云函数
exports.main = async (event, context) => {
  const { sourceCollection, targetCollection, batchSize = 100 } = event
  
  const db = cloud.database()
  let total = 0
  let migrated = 0
  
  try {
    // 获取源数据总数
    const countResult = await db.collection(sourceCollection).count()
    total = countResult.total
    
    // 分批迁移
    for (let i = 0; i < total; i += batchSize) {
      const sourceData = await db.collection(sourceCollection)
        .skip(i)
        .limit(batchSize)
        .get()
      
      // 转换数据格式
      const transformedData = sourceData.data.map(item => 
        transformDataFormat(item, sourceCollection, targetCollection)
      )
      
      // 批量插入目标集合
      const promises = transformedData.map(data =>
        db.collection(targetCollection).add({ data })
      )
      
      await Promise.all(promises)
      migrated += transformedData.length
      
      console.log(`迁移进度: ${migrated}/${total}`)
    }
    
    return {
      success: true,
      message: `迁移完成，共迁移 ${migrated} 条记录`
    }
    
  } catch (error) {
    console.error('数据迁移失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 数据格式转换函数
function transformDataFormat(item, sourceCollection, targetCollection) {
  // 根据源集合和目标集合进行相应的数据转换
  const transformed = { ...item }
  
  // 统一添加标准字段
  if (!transformed.createdAt) {
    transformed.createdAt = transformed.createTime || new Date()
  }
  if (!transformed.updatedAt) {
    transformed.updatedAt = transformed.updateTime || transformed.createdAt
  }
  if (transformed.isDeleted === undefined) {
    transformed.isDeleted = false
  }
  
  // 特定转换逻辑
  switch (sourceCollection) {
    case 'prevention_records':
      return transformPreventionRecord(transformed)
    case 'cost_records':
      return transformCostRecord(transformed)
    default:
      return transformed
  }
}
```

### **阶段三：功能验证**
```typescript
// 验证脚本
class MigrationValidator {
  static async validateDataIntegrity() {
    const validations = [
      this.validateUserData(),
      this.validateProductionData(),
      this.validateHealthData(),
      this.validateFinanceData()
    ]
    
    const results = await Promise.all(validations)
    return results.every(result => result.success)
  }
  
  static async validateUserData() {
    // 验证用户数据完整性
    const oldCount = await this.getCollectionCount('users')
    const newCount = await this.getCollectionCount('wx_users')
    
    return {
      success: oldCount === newCount,
      message: `用户数据: ${oldCount} -> ${newCount}`
    }
  }
  
  // ... 其他验证方法
}
```

## 📅 **实施时间表**

### **第1周：准备阶段**
- [ ] 数据备份
- [ ] 创建标准化集合
- [ ] 配置基础权限

### **第2周：云函数重构**
- [ ] breeding-todo 云函数重构
- [ ] health-management 云函数重构
- [ ] finance-management 云函数重构

### **第3周：前端适配**
- [ ] API 封装层开发
- [ ] 前端页面代码更新
- [ ] 数据绑定调整

### **第4周：数据迁移**
- [ ] 开发迁移脚本
- [ ] 执行数据迁移
- [ ] 验证数据完整性

### **第5周：测试上线**
- [ ] 功能回归测试
- [ ] 性能测试
- [ ] 正式上线

---

**这套重构方案将使您的系统更加规范、可维护和可扩展！** 🚀
