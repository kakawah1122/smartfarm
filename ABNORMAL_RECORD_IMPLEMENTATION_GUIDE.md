# 异常记录和隔离功能实现指南

## 📋 总体流程

```
AI诊断 → 保存为异常记录(abnormal) → 查看异常详情 → 制定治疗方案
                                                    ↓
                                        药物治疗 | 隔离观察
                                            ↓         ↓
                                        treating  isolated
                                        异常-1    异常-1
```

## ✅ 已完成部分

### 1. 数据库Collections
- ✅ 添加 `HEALTH_ISOLATION_RECORDS` collection
- 位置: `cloudfunctions/health-management/collections.js`

### 2. AI诊断保存功能
- ✅ 修改 `saveRecord()` 函数，创建异常记录
- 位置: `miniprogram/packageAI/ai-diagnosis/ai-diagnosis.ts`
- 调用云函数: `create_abnormal_record`

### 3. 云函数 - 创建异常记录
- ✅ 实现 `createAbnormalRecord()` 函数
- 位置: `cloudfunctions/health-management/index.js`
- 数据结构:
```javascript
{
  batchId, batchNumber, diagnosisId,
  recordType: 'ai_diagnosis',
  status: 'abnormal',  // 关键字段
  affectedCount, symptoms, diagnosis,
  diagnosisConfidence, severity, urgency,
  aiRecommendation, images
}
```

## 📝 待实现部分

### 1. 异常记录详情页面
**文件**: `miniprogram/packageHealth/abnormal-record-detail/`

#### abnormal-record-detail.wxml
```xml
<view class="page abnormal-record-detail">
  <navigation-bar title="异常记录详情" show-back="true" />
  
  <view class="page-content">
    <!-- 基本信息卡片 -->
    <view class="info-card">
      <view class="card-header">
        <text class="header-title">基本信息</text>
        <t-tag theme="warning">异常</t-tag>
      </view>
      
      <t-cell-group>
        <t-cell title="批次号" note="{{record.batchNumber}}" />
        <t-cell title="受影响数量" note="{{record.affectedCount}}只" />
        <t-cell title="记录日期" note="{{record.checkDate}}" />
      </t-cell-group>
    </view>
    
    <!-- 诊断信息卡片 -->
    <view class="info-card">
      <view class="card-header">
        <text class="header-title">诊断信息</text>
        <t-tag theme="{{record.diagnosisConfidence >= 80 ? 'success' : 'warning'}}">
          置信度 {{record.diagnosisConfidence}}%
        </t-tag>
      </view>
      
      <view class="diagnosis-content">
        <view class="diagnosis-name">{{record.diagnosis}}</view>
        <view class="symptoms-text">症状：{{record.symptoms}}</view>
      </view>
      
      <!-- 严重程度和紧急程度 -->
      <view class="status-row">
        <view class="status-item">
          <text class="status-label">严重程度</text>
          <t-tag theme="{{record.severity === 'severe' ? 'danger' : 'warning'}}">
            {{record.severity === 'severe' ? '严重' : '中度'}}
          </t-tag>
        </view>
        <view class="status-item">
          <text class="status-label">紧急程度</text>
          <t-tag theme="{{record.urgency === 'high' ? 'danger' : 'primary'}}">
            {{record.urgency === 'high' ? '紧急' : '一般'}}
          </t-tag>
        </view>
      </view>
    </view>
    
    <!-- AI建议卡片 -->
    <view class="info-card" wx:if="{{record.aiRecommendation}}">
      <view class="card-header">
        <t-icon name="lightbulb" size="20" color="#0052d9" />
        <text class="header-title">AI治疗建议</text>
      </view>
      
      <view class="recommendation-content">
        <view class="recommendation-text">
          {{record.aiRecommendation.primary}}
        </view>
      </view>
    </view>
    
    <!-- 图片展示 -->
    <view class="info-card" wx:if="{{record.images && record.images.length > 0}}">
      <view class="card-header">
        <text class="header-title">相关图片</text>
      </view>
      
      <view class="images-grid">
        <t-image
          wx:for="{{record.images}}"
          wx:key="index"
          src="{{item}}"
          mode="aspectFill"
          class="image-item"
          bind:tap="previewImage"
          data-url="{{item}}"
        />
      </view>
    </view>
    
    <!-- 操作按钮 -->
    <view class="action-buttons">
      <t-button
        theme="primary"
        size="large"
        block
        bind:tap="showTreatmentPlanDialog"
      >
        制定治疗方案
      </t-button>
    </view>
  </view>
  
  <!-- 治疗方案选择对话框 -->
  <t-dialog
    visible="{{showTreatmentDialog}}"
    title="选择治疗方式"
    confirm-btn="确定"
    cancel-btn="取消"
    bind:confirm="confirmTreatmentPlan"
    bind:cancel="cancelTreatmentPlan"
  >
    <view class="treatment-options">
      <view
        class="treatment-option {{selectedTreatmentType === 'medication' ? 'active' : ''}}"
        bind:tap="selectTreatmentType"
        data-type="medication"
      >
        <t-icon name="service" size="32" />
        <text class="option-name">药物治疗</text>
        <text class="option-desc">创建治疗记录，跟踪用药进展</text>
      </view>
      
      <view
        class="treatment-option {{selectedTreatmentType === 'isolation' ? 'active' : ''}}"
        bind:tap="selectTreatmentType"
        data-type="isolation"
      >
        <t-icon name="location" size="32" />
        <text class="option-name">隔离观察</text>
        <text class="option-desc">隔离患病个体，密切观察</text>
      </view>
    </view>
  </t-dialog>
</view>
```

#### abnormal-record-detail.ts
```typescript
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    recordId: '',
    record: null as any,
    loading: true,
    showTreatmentDialog: false,
    selectedTreatmentType: 'medication' // 'medication' | 'isolation'
  },

  onLoad(options: any) {
    const { recordId } = options || {}
    if (recordId) {
      this.setData({ recordId })
      this.loadRecordDetail(recordId)
    }
  },

  async loadRecordDetail(recordId: string) {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_abnormal_record_detail',
          recordId: recordId
        }
      })
      
      wx.hideLoading()
      
      if (result.result && result.result.success) {
        this.setData({
          record: result.result.data,
          loading: false
        })
      } else {
        throw new Error('加载失败')
      }
    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    }
  },

  showTreatmentPlanDialog() {
    this.setData({ showTreatmentDialog: true })
  },

  cancelTreatmentPlan() {
    this.setData({ showTreatmentDialog: false })
  },

  selectTreatmentType(e: any) {
    const { type } = e.currentTarget.dataset
    this.setData({ selectedTreatmentType: type })
  },

  async confirmTreatmentPlan() {
    const { selectedTreatmentType, record, recordId } = this.data
    
    this.setData({ showTreatmentDialog: false })
    
    try {
      wx.showLoading({ title: '创建中...' })
      
      if (selectedTreatmentType === 'medication') {
        // 创建治疗记录
        const result = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'create_treatment_from_abnormal',
            abnormalRecordId: recordId,
            batchId: record.batchId,
            affectedCount: record.affectedCount,
            diagnosis: record.diagnosis,
            aiRecommendation: record.aiRecommendation
          }
        })
        
        wx.hideLoading()
        
        if (result.result && result.result.success) {
          wx.showToast({
            title: '治疗记录已创建',
            icon: 'success'
          })
          
          // 跳转到治疗记录页面
          setTimeout(() => {
            wx.navigateTo({
              url: `/packageHealth/treatment-record/treatment-record?treatmentId=${result.result.data.treatmentId}`
            })
          }, 1500)
        }
      } else if (selectedTreatmentType === 'isolation') {
        // 创建隔离记录
        const result = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'create_isolation_from_abnormal',
            abnormalRecordId: recordId,
            batchId: record.batchId,
            affectedCount: record.affectedCount,
            diagnosis: record.diagnosis
          }
        })
        
        wx.hideLoading()
        
        if (result.result && result.result.success) {
          wx.showToast({
            title: '隔离记录已创建',
            icon: 'success'
          })
          
          // 返回健康管理页面
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      }
    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none'
      })
    }
  },

  previewImage(e: any) {
    const { url } = e.currentTarget.dataset
    wx.previewImage({
      current: url,
      urls: this.data.record.images
    })
  },

  goBack() {
    wx.navigateBack()
  }
}

Page(createPageWithNavbar(pageConfig))
```

### 2. 云函数 - 获取异常记录详情
**位置**: `cloudfunctions/health-management/index.js`

```javascript
// 在switch中添加
case 'get_abnormal_record_detail':
  return await getAbnormalRecordDetail(event, wxContext)

// 函数实现
async function getAbnormalRecordDetail(event, wxContext) {
  try {
    const { recordId } = event
    const db = cloud.database()
    
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!result.data) {
      throw new Error('记录不存在')
    }
    
    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}
```

### 3. 云函数 - 从异常记录创建治疗记录
```javascript
// 在switch中添加
case 'create_treatment_from_abnormal':
  return await createTreatmentFromAbnormal(event, wxContext)

// 函数实现
async function createTreatmentFromAbnormal(event, wxContext) {
  try {
    const {
      abnormalRecordId,
      batchId,
      affectedCount,
      diagnosis,
      aiRecommendation
    } = event
    const openid = wxContext.OPENID
    const db = cloud.database()
    
    // 创建治疗记录
    const treatmentData = {
      batchId,
      abnormalRecordId,  // 关联异常记录
      treatmentDate: new Date().toISOString().split('T')[0],
      treatmentType: 'medication',
      diagnosis: {
        preliminary: diagnosis,
        confirmed: diagnosis,
        diagnosisMethod: 'ai'
      },
      treatmentPlan: {
        primary: aiRecommendation?.primary || '',
        followUpSchedule: []
      },
      medications: [],
      progress: [],
      outcome: {
        status: 'ongoing',
        curedCount: 0,
        improvedCount: 0,
        deathCount: 0,
        totalTreated: affectedCount
      },
      cost: {
        medication: 0,
        veterinary: 0,
        supportive: 0,
        total: 0
      },
      notes: '',
      createdBy: openid,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).add({
      data: treatmentData
    })
    
    // 更新异常记录状态为treating，减少异常计数
    await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(abnormalRecordId)
      .update({
        data: {
          status: 'treating',
          treatmentRecordId: treatmentResult._id,
          updatedAt: new Date()
        }
      })
    
    return {
      success: true,
      data: { treatmentId: treatmentResult._id },
      message: '治疗记录创建成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '创建治疗记录失败'
    }
  }
}
```

### 4. 云函数 - 从异常记录创建隔离记录
```javascript
// 在switch中添加
case 'create_isolation_from_abnormal':
  return await createIsolationFromAbnormal(event, wxContext)

// 函数实现
async function createIsolationFromAbnormal(event, wxContext) {
  try {
    const {
      abnormalRecordId,
      batchId,
      affectedCount,
      diagnosis
    } = event
    const openid = wxContext.OPENID
    const db = cloud.database()
    
    // 创建隔离记录
    const isolationData = {
      batchId,
      abnormalRecordId,  // 关联异常记录
      isolationDate: new Date().toISOString().split('T')[0],
      isolatedCount: affectedCount,
      diagnosis: diagnosis,
      isolationLocation: '',  // 隔离位置
      isolationReason: diagnosis,
      status: 'ongoing',  // ongoing | completed
      dailyRecords: [],  // 每日观察记录
      outcome: {
        recoveredCount: 0,
        diedCount: 0,
        stillIsolatedCount: affectedCount
      },
      notes: '',
      createdBy: openid,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const isolationResult = await db.collection(COLLECTIONS.HEALTH_ISOLATION_RECORDS).add({
      data: isolationData
    })
    
    // 更新异常记录状态为isolated，减少异常计数
    await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(abnormalRecordId)
      .update({
        data: {
          status: 'isolated',
          isolationRecordId: isolationResult._id,
          updatedAt: new Date()
        }
      })
    
    return {
      success: true,
      data: { isolationId: isolationResult._id },
      message: '隔离记录创建成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '创建隔离记录失败'
    }
  }
}
```

### 5. 更新健康管理页面统计
**位置**: `miniprogram/pages/health/health.ts`

需要修改统计查询，按status分类统计：
- `status: 'abnormal'` → 异常数
- `status: 'treating'` → 治疗中（或查询HEALTH_TREATMENT_RECORDS）
- `status: 'isolated'` → 隔离数（或查询HEALTH_ISOLATION_RECORDS）

### 6. 在app.json中注册新页面
```json
{
  "subpackages": [
    {
      "root": "packageHealth",
      "pages": [
        ...
        "abnormal-record-detail/abnormal-record-detail"
      ]
    }
  ]
}
```

## 🎯 数据流程图

```
AI诊断
  ↓ (保存记录)
health_records (status='abnormal')
  ↓ (查看详情)
abnormal-record-detail页面
  ↓ (制定治疗方案)
  ├─ 药物治疗
  │   ├─ health_treatment_records (新增记录)
  │   └─ health_records (status='abnormal' → 'treating')
  └─ 隔离观察
      ├─ health_isolation_records (新增记录)
      └─ health_records (status='abnormal' → 'isolated')
```

## 📊 状态管理

### health_records.status
- `abnormal` - 异常（待处理）
- `treating` - 治疗中（已制定治疗方案）
- `isolated` - 隔离中（已隔离）
- `resolved` - 已解决

### 统计逻辑
- **异常数** = `status='abnormal'` 的记录数
- **治疗中** = `status='treating'` 的记录数 或 `health_treatment_records` 中 `outcome.status='ongoing'` 的记录数
- **隔离** = `status='isolated'` 的记录数 或 `health_isolation_records` 中 `status='ongoing'` 的记录数

## 🔧 后续优化

1. **异常记录列表页** - 展示所有异常记录
2. **隔离记录详情页** - 查看和更新隔离进展
3. **每日观察记录** - 隔离期间的每日健康记录
4. **批量操作** - 批量制定治疗方案

---

**注意事项**:
1. 所有时间使用 ISO格式字符串
2. 记得添加审计日志
3. 统计数据需要实时更新
4. 图片使用云存储路径

