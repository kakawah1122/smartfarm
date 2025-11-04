# 疫苗异常追踪功能（治疗记录 + 死亡记录）

## 功能说明

当用户在疫苗记录详情页进行追踪操作时：
1. **异常用药**：自动创建治疗记录，追踪疫苗接种后异常反应的治疗效果
2. **记录死亡**：自动创建死亡记录，记录疫苗接种后的死亡情况，并更新批次存栏数

## 实现内容

### 1. 前端修改

#### 1.1 疫苗记录列表页面
**文件**: `miniprogram/packageHealth/vaccine-records-list/vaccine-records-list.ts`

**修改内容**:
- 修改 `onConfirmCountInput` 方法：根据用户选择调用不同的创建方法
  - 异常用药：调用 `createTreatmentRecord` 方法
  - 记录死亡：调用 `createDeathRecord` 方法
- 新增 `createTreatmentRecord` 方法：创建治疗记录
- 新增 `createDeathRecord` 方法：创建死亡记录

**关键代码**:
```typescript
async createTreatmentRecord(vaccineRecord: VaccineRecord, affectedCount: number) {
  try {
    wx.showLoading({ title: '创建治疗记录...' })

    // 调用云函数创建治疗记录
    const result = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'create_treatment_from_vaccine',
        vaccineRecordId: vaccineRecord._id,
        batchId: vaccineRecord.batchId,
        affectedCount: affectedCount,
        diagnosis: '疫苗接种后异常反应',
        vaccineName: vaccineRecord.vaccineInfo?.name || '',
        preventionDate: vaccineRecord.preventionDate
      }
    })

    if (result.result && result.result.success) {
      wx.showToast({
        title: '治疗记录已创建',
        icon: 'success',
        duration: 2000
      })

      // 延迟跳转到健康管理中心
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/health/health',
          success: () => {
            // 通知健康页面切换到"治疗管理"标签
            const pages = getCurrentPages()
            const healthPage = pages.find((page: any) => page.route === 'pages/health/health')
            if (healthPage) {
              healthPage.setData({
                activeCategory: 'treatment'
              })
            }
          }
        })
      }, 2000)
    }
  } catch (error: any) {
    wx.hideLoading()
    wx.showModal({
      title: '创建失败',
      content: error.message || '创建治疗记录失败，请重试',
      showCancel: false
    })
  }
}
```

**死亡记录创建代码**:
```typescript
async createDeathRecord(vaccineRecord: VaccineRecord, deathCount: number) {
  try {
    wx.showLoading({ title: '创建死亡记录...' })

    // 调用云函数创建死亡记录
    const result = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'create_death_from_vaccine',
        vaccineRecordId: vaccineRecord._id,
        batchId: vaccineRecord.batchId,
        batchNumber: vaccineRecord.batchNumber || vaccineRecord.batchId,
        deathCount: deathCount,
        deathCause: '疫苗接种后死亡',
        vaccineName: vaccineRecord.vaccineInfo?.name || '',
        preventionDate: vaccineRecord.preventionDate
      }
    })

    if (result.result && result.result.success) {
      wx.showToast({
        title: '死亡记录已创建',
        icon: 'success',
        duration: 2000
      })

      // 延迟跳转到健康管理中心
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/health/health',
          success: () => {
            // 通知健康页面切换到"治疗管理"标签
            const pages = getCurrentPages()
            const healthPage = pages.find((page: any) => page.route === 'pages/health/health')
            if (healthPage) {
              healthPage.setData({
                activeCategory: 'treatment'
              })
            }
          }
        })
      }, 2000)
    }
  } catch (error: any) {
    wx.hideLoading()
    wx.showModal({
      title: '创建失败',
      content: error.message || '创建死亡记录失败，请重试',
      showCancel: false
    })
  }
}
```

### 2. 云函数修改

#### 2.1 健康管理云函数
**文件**: `cloudfunctions/health-management/index.js`

**修改内容**:
1. 新增 `createTreatmentFromVaccine` 函数：处理从疫苗追踪创建治疗记录的逻辑
2. 新增 `createDeathFromVaccine` 函数：处理从疫苗追踪创建死亡记录的逻辑
3. 在 `exports.main` 的 switch 语句中注册两个新 action：
   - `create_treatment_from_vaccine`
   - `create_death_from_vaccine`

**关键代码**:
```javascript
// 从疫苗追踪创建治疗记录
async function createTreatmentFromVaccine(event, wxContext) {
  try {
    const {
      vaccineRecordId,
      batchId,
      affectedCount,
      diagnosis,
      vaccineName,
      preventionDate
    } = event
    const openid = wxContext.OPENID
    const db = cloud.database()
    
    // 创建治疗记录
    const treatmentData = {
      batchId,
      vaccineRecordId,  // 关联疫苗记录
      animalIds: [],
      treatmentDate: new Date().toISOString().split('T')[0],
      treatmentType: 'medication',
      diagnosis: {
        preliminary: diagnosis || '疫苗接种后异常反应',
        confirmed: diagnosis || '疫苗接种后异常反应',
        confidence: 0,
        diagnosisMethod: 'manual'
      },
      treatmentPlan: {
        primary: `疫苗名称：${vaccineName}，接种日期：${preventionDate}，需观察并制定治疗方案`,
        followUpSchedule: []
      },
      medications: [],
      progress: [{
        date: new Date().toISOString().split('T')[0],
        type: 'record_created',
        content: `疫苗接种后异常反应记录已创建，异常数量：${affectedCount}只`,
        operator: openid,
        createdAt: new Date()
      }],
      outcome: {
        status: 'ongoing',  // 设置为治疗中
        curedCount: 0,
        improvedCount: 0,
        deathCount: 0,
        totalTreated: affectedCount || 1
      },
      cost: {
        medication: 0,
        veterinary: 0,
        supportive: 0,
        total: 0
      },
      notes: `疫苗：${vaccineName}，接种日期：${preventionDate}`,
      isDraft: false,
      isDeleted: false,
      createdBy: openid,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).add({
      data: treatmentData
    })
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_treatment_from_vaccine',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentResult._id,
      {
        vaccineRecordId,
        batchId,
        affectedCount,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: { treatmentId: treatmentResult._id },
      message: '治疗记录创建成功'
    }
  } catch (error) {
    console.error('创建疫苗追踪治疗记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '创建治疗记录失败'
    }
  }
}
```

**死亡记录云函数代码**:
```javascript
// 从疫苗追踪创建死亡记录
async function createDeathFromVaccine(event, wxContext) {
  try {
    const {
      vaccineRecordId,
      batchId,
      batchNumber,
      deathCount,
      deathCause,
      vaccineName,
      preventionDate
    } = event
    const openid = wxContext.OPENID
    
    // 1. 验证必填项
    if (!batchId) throw new Error('批次ID不能为空')
    if (!deathCount || deathCount <= 0) throw new Error('死亡数量必须大于0')
    
    // 2. 获取批次信息
    // ... 批次查询逻辑 ...
    
    // 3. 计算平均成本和损失
    const costResult = await calculateBatchCost({ batchId: batchDocId }, wxContext)
    const unitCost = parseFloat(costResult.data.avgCost)
    const totalLoss = (unitCost * deathCount).toFixed(2)
    
    // 4. 创建死亡记录
    const deathRecord = {
      batchId,
      batchNumber: batchNumber || batch.batchNumber,
      vaccineRecordId,  // 关联疫苗记录
      deathDate: new Date().toISOString().split('T')[0],
      deathCause: deathCause || '疫苗接种后死亡',
      deathCauseCategory: 'vaccine_reaction',
      customCauseTags: ['疫苗反应'],
      description: `疫苗名称：${vaccineName}，接种日期：${preventionDate}，接种后出现死亡情况`,
      financialLoss: {
        unitCost: unitCost.toFixed(2),
        totalLoss: totalLoss,
        calculationMethod: 'batch_average'
      },
      totalDeathCount: deathCount,
      operator: openid,
      // ... 更多字段 ...
    }
    
    const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
      data: deathRecord
    })
    
    // 5. 创建财务损失记录
    await cloud.callFunction({
      name: 'finance-management',
      data: {
        action: 'createDeathLoss',
        batchId,
        deathRecordId: deathResult._id,
        deathCount,
        unitCost: unitCost.toFixed(2),
        totalLoss,
        // ... 更多参数 ...
      }
    })
    
    // 6. 更新批次数量
    await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchDocId).update({
      data: {
        currentCount: _.inc(-deathCount),
        deadCount: _.inc(deathCount),
        updatedAt: new Date()
      }
    })
    
    // 7. 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_death_from_vaccine',
      COLLECTIONS.HEALTH_DEATH_RECORDS,
      deathResult._id,
      {
        vaccineRecordId,
        batchId,
        deathCount,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: { deathRecordId: deathResult._id },
      message: '死亡记录创建成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '创建死亡记录失败'
    }
  }
}
```

## 功能流程

### 异常用药流程

1. **用户操作**:
   - 用户进入疫苗记录列表页面
   - 点击某条疫苗记录，打开详情弹窗
   - 点击"异常用药"按钮
   - 输入异常反应的数量（不能超过接种数量）
   - 点击确认

2. **系统处理**:
   - 调用云函数 `health-management` 的 `create_treatment_from_vaccine` action
   - 创建一条状态为"治疗中"的治疗记录，包含：
     - 批次ID
     - 疫苗记录ID（用于关联）
     - 异常数量
     - 诊断信息：疫苗接种后异常反应
     - 疫苗名称和接种日期
     - 初始进展记录
   - 记录审计日志

3. **结果反馈**:
   - 显示"治疗记录已创建"提示
   - 2秒后自动跳转到健康管理中心
   - 自动切换到"治疗管理"标签页
   - 用户可以在"治疗中"卡片中看到新创建的记录

### 记录死亡流程

1. **用户操作**:
   - 用户进入疫苗记录列表页面
   - 点击某条疫苗记录，打开详情弹窗
   - 点击"记录死亡"按钮
   - 输入死亡数量（不能超过接种数量）
   - 点击确认

2. **系统处理**:
   - 调用云函数 `health-management` 的 `create_death_from_vaccine` action
   - 创建死亡记录，包含：
     - 批次ID和批次编号
     - 疫苗记录ID（用于关联）
     - 死亡数量
     - 死亡原因：疫苗接种后死亡
     - 疫苗名称和接种日期
     - 财务损失信息（自动计算）
   - 更新批次存栏数（减少）和死亡数（增加）
   - 创建财务损失记录
   - 记录审计日志

3. **结果反馈**:
   - 显示"死亡记录已创建"提示
   - 2秒后自动跳转到健康管理中心
   - 自动切换到"治疗管理"标签页
   - 用户可以在"死亡数"卡片中看到更新的统计
   - 批次存栏数自动减少

## 部署步骤

### 1. 上传云函数

```bash
# 进入云函数目录
cd cloudfunctions/health-management

# 上传云函数
# 方法1: 使用微信开发者工具右键 health-management 文件夹，选择"上传并部署：云端安装依赖"
# 方法2: 使用命令行
```

### 2. 编译小程序

在微信开发者工具中：
1. 点击"编译"按钮
2. 确保没有编译错误

### 3. 测试

#### 3.1 准备测试数据
- 确保有至少一条疫苗接种记录
- 记录测试前的批次存栏数

#### 3.2 测试异常用药功能
1. 进入健康管理中心
2. 点击"疫苗记录"卡片，进入疫苗记录列表
3. 点击任意一条疫苗记录，打开详情弹窗
4. 点击"异常用药"按钮
5. 输入异常数量（例如：5）
6. 点击确认
7. 观察是否显示"创建治疗记录..."加载提示
8. 观察是否显示"治疗记录已创建"成功提示
9. 等待2秒后，观察是否自动跳转到健康管理中心
10. 检查是否自动切换到"治疗管理"标签页
11. 检查"治疗中"卡片的数量是否增加了1

#### 3.3 测试记录死亡功能
1. 进入疫苗记录列表
2. 点击任意一条疫苗记录，打开详情弹窗
3. 点击"记录死亡"按钮
4. 输入死亡数量（例如：3）
5. 点击确认
6. 观察是否显示"创建死亡记录..."加载提示
7. 观察是否显示"死亡记录已创建"成功提示
8. 等待2秒后，观察是否自动跳转到健康管理中心
9. 检查是否自动切换到"治疗管理"标签页
10. 检查"死亡数"卡片的数量是否增加了3
11. 进入生产管理，检查批次存栏数是否减少了3

#### 3.4 验证治疗记录数据
1. 在云开发控制台打开数据库
2. 找到 `health_treatment_records` 集合
3. 查找最新创建的记录，验证：
   - `outcome.status` 应为 `'ongoing'`
   - `vaccineRecordId` 应与疫苗记录ID一致
   - `batchId` 应与批次ID一致
   - `batchNumber` 应为用户友好的批次编号（如"QY-20251103"）
   - `outcome.totalTreated` 应等于输入的异常数量
   - `diagnosis.preliminary` 应为 `'疫苗接种后异常反应'`
   - `notes` 应包含疫苗名称和接种日期

#### 3.5 验证死亡记录数据
1. 在云开发控制台打开数据库
2. 找到 `health_death_records` 集合
3. 查找最新创建的记录，验证：
   - `vaccineRecordId` 应与疫苗记录ID一致
   - `batchId` 应与批次ID一致
   - `batchNumber` 应为用户友好的批次编号
   - `totalDeathCount` 应等于输入的死亡数量
   - `deathCause` 应为 `'疫苗接种后死亡'`
   - `deathCauseCategory` 应为 `'vaccine_reaction'`
   - `description` 应包含疫苗名称和接种日期
   - `financialLoss.totalLoss` 应有正确的损失金额

4. 找到 `prod_batch_entries` 集合
5. 查找对应的批次记录，验证：
   - `currentCount` 应减少了死亡数量
   - `deadCount` 应增加了死亡数量

6. 找到 `finance_records` 集合（如果有）
7. 验证是否创建了相应的财务损失记录

## 数据库字段说明

### health_treatment_records 集合

新增字段：
- `vaccineRecordId` (String): 关联的疫苗记录ID，用于追溯异常来源
- `batchNumber` (String): 批次编号（用户友好格式）

现有字段：
- `batchId` (String): 批次ID（文档ID）
- `outcome.status` (String): 治疗状态，'ongoing' 表示治疗中
- `outcome.totalTreated` (Number): 总治疗数量
- `diagnosis.preliminary` (String): 初步诊断
- `diagnosis.confirmed` (String): 确诊诊断
- `notes` (String): 备注信息

### health_death_records 集合

新增字段：
- `vaccineRecordId` (String): 关联的疫苗记录ID，用于追溯死亡来源
- `batchNumber` (String): 批次编号（用户友好格式）

现有字段：
- `batchId` (String): 批次ID（文档ID）
- `totalDeathCount` (Number): 死亡数量
- `deathCause` (String): 死亡原因
- `deathCauseCategory` (String): 死亡原因分类
- `customCauseTags` (Array): 自定义原因标签
- `description` (String): 详细描述
- `financialLoss` (Object): 财务损失信息
  - `unitCost` (String): 单位成本
  - `totalLoss` (String): 总损失
  - `calculationMethod` (String): 计算方法
- `operator` (String): 操作员OpenID
- `operatorName` (String): 操作员姓名

## 注意事项

### 通用注意事项
1. **权限控制**: 
   - 治疗记录和死亡记录的创建都会自动关联到当前用户
   - 通过 `createdBy` 或 `operator` 字段记录操作人

2. **数据一致性**: 
   - 所有操作都会记录审计日志，方便追溯
   - 死亡记录会自动创建财务损失记录
   - 批次存栏数会自动更新

3. **用户体验**: 
   - 输入的数量不能超过疫苗接种数量
   - 创建成功后会自动跳转到健康管理中心
   - 如果创建失败，会显示详细的错误提示

### 异常用药注意事项
1. **治疗追踪**: 用户可以在治疗记录详情页继续：
   - 添加用药
   - 记录治疗进展
   - 调整治疗方案
   - 记录治愈或死亡

### 记录死亡注意事项
1. **批次数量**: 
   - 死亡数量会自动从批次存栏数中扣除
   - 批次的 `deadCount` 会自动增加

2. **财务影响**: 
   - 系统会自动计算平均成本
   - 自动创建财务损失记录
   - 损失金额 = 单位成本 × 死亡数量

3. **数据完整性**: 
   - 死亡记录会关联疫苗记录ID
   - 可以追溯到具体的疫苗接种记录
   - 死亡原因自动标记为"疫苗反应"

4. **后续处理**: 
   - 用户需要在死亡记录详情中补充处理方式
   - 可以添加照片和详细描述

## 扩展功能建议

### 异常用药扩展
1. **治疗方案智能推荐**: 根据疫苗类型和异常症状，自动推荐治疗方案
2. **异常反应分析**: 统计不同疫苗的异常反应率，帮助优化疫苗选择
3. **追踪治疗效果**: 在疫苗记录详情页显示关联的治疗记录及其结果
4. **批量处理**: 支持批量记录多条疫苗的异常反应

### 记录死亡扩展
1. **死亡分析**: 
   - 统计不同疫苗的死亡率
   - 分析死亡发生的时间规律（接种后多久）
   - 识别高风险疫苗批次

2. **预警机制**: 
   - 当某疫苗的死亡率超过阈值时发出警告
   - 自动暂停该疫苗的继续使用

3. **损失优化**: 
   - 提供保险理赔建议
   - 记录每次死亡的处理费用
   - 计算总体损失趋势

4. **关联追踪**: 
   - 在疫苗记录详情页显示关联的死亡记录
   - 支持批量导出疫苗安全报告

## 相关文档

- [健康管理模块文档](./health/README.md)
- [云函数开发指南](./cloud-development/README.md)
- [数据库设计文档](./database/README.md)

