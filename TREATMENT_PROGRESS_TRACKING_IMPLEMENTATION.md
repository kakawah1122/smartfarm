# 治疗进展跟进功能实现文档

## 📋 需求分析

**用户需求**：
> "从治疗中点开记录条目不应能修改已制定的方案内容，而是跟进治疗。无非是三个结果：一个是需要进一步治疗，一个是已治愈，一个是死亡，请正确流转及设计这个逻辑。"

**核心诉求**：
1. ❌ **不允许**修改已制定的治疗方案
2. ✅ **只能**跟进治疗进展
3. 📊 **三种结果**：继续治疗 / 治愈 / 死亡
4. 🔄 **正确流转**治疗状态

## 🎯 设计方案

### 核心概念

**两个阶段分离**：
1. **制定方案阶段**：从异常记录创建治疗记录，填写治疗方案
2. **跟进进展阶段**：从"治疗中"列表查看记录，记录治疗结果

**查看模式（mode=view）**：
- 所有信息**只读展示**
- 底部显示**治疗进展跟进**模块
- 提供两个操作：**记录治愈** / **记录死亡**

## 🏗️ 技术实现

### 1. 云函数（health-management/index.js）

#### 新增接口：getTreatmentDetail

**功能**：获取治疗记录详情和进展统计

**参数**：
```javascript
{
  action: 'get_treatment_detail',
  treatmentId: 'xxx'
}
```

**返回数据**：
```javascript
{
  success: true,
  data: {
    treatment: {
      // 治疗记录完整信息
      batchId, treatmentDate, treatmentType,
      diagnosis, treatmentPlan, medications, notes
    },
    progress: {
      treatmentDays: 3,           // 治疗天数
      totalTreated: 5,            // 治疗总数
      curedCount: 2,              // 已治愈数
      improvedCount: 0,           // 好转数
      deathCount: 1,              // 死亡数
      remainingCount: 2,          // 剩余数
      cureRate: '40.0',           // 治愈率
      mortalityRate: '20.0'       // 死亡率
    }
  }
}
```

#### 新增接口：updateTreatmentProgress

**功能**：更新治疗进展（记录治愈/死亡）

**参数**：
```javascript
{
  action: 'update_treatment_progress',
  treatmentId: 'xxx',
  progressType: 'cured' | 'died',
  count: 2,
  notes: '治疗效果良好',
  deathCause: '治疗无效'  // progressType=died时必填
}
```

**逻辑**：
1. 验证治疗记录状态（必须为 ongoing）
2. 验证数量（不能超过 remainingCount）
3. 更新 outcome.curedCount 或 outcome.deathCount
4. 自动计算新的治疗状态：
   - `curedCount + deathCount < totalTreated` → **ongoing**（继续治疗）
   - `curedCount = totalTreated, deathCount = 0` → **cured**（全部治愈）
   - `deathCount = totalTreated, curedCount = 0` → **died**（全部死亡）
   - `curedCount + deathCount = totalTreated, 两者都>0` → **completed**（部分治愈+部分死亡）
5. 如果是记录死亡，自动创建死亡记录
6. 如果治疗完成且关联异常记录，更新异常记录状态

**返回数据**：
```javascript
{
  success: true,
  data: {
    remainingCount: 2,
    newStatus: 'ongoing',
    curedCount: 2,
    deathCount: 1
  },
  message: '治愈记录成功'
}
```

### 2. 前端页面（treatment-record）

#### 页面模式判断

```typescript
onLoad(options: any) {
  const { treatmentId, mode } = options
  const isViewMode = mode === 'view'
  
  this.setData({ viewMode: isViewMode })
  
  if (isViewMode && treatmentId) {
    // 查看模式：加载治疗详情
    this.loadTreatmentDetail(treatmentId)
  } else {
    // 编辑/创建模式：原有逻辑
    // ...
  }
}
```

#### 新增数据字段

```typescript
data: {
  viewMode: false,  // 是否为查看模式
  
  treatmentProgress: {  // 治疗进展数据
    treatmentDays: 0,
    totalTreated: 0,
    curedCount: 0,
    improvedCount: 0,
    deathCount: 0,
    remainingCount: 0,
    cureRate: '0',
    mortalityRate: '0'
  },
  
  showProgressDialog: false,  // 进展对话框
  progressDialogType: '',     // 'cured' | 'died'
  progressForm: {
    count: '',
    notes: '',
    deathCause: ''
  }
}
```

#### 核心方法

**loadTreatmentDetail**：加载治疗详情
```typescript
async loadTreatmentDetail(treatmentId: string) {
  const result = await wx.cloud.callFunction({
    name: 'health-management',
    data: {
      action: 'get_treatment_detail',
      treatmentId
    }
  })
  
  if (result.result.success) {
    this.setData({
      'formData...': result.result.data.treatment,
      treatmentProgress: result.result.data.progress
    })
  }
}
```

**showProgressDialog**：显示进展对话框
```typescript
showProgressDialog(e: any) {
  const { type } = e.currentTarget.dataset  // 'cured' | 'died'
  
  if (this.data.treatmentProgress.remainingCount <= 0) {
    wx.showToast({ title: '治疗已完成，无需继续记录' })
    return
  }
  
  this.setData({
    showProgressDialog: true,
    progressDialogType: type
  })
}
```

**submitProgress**：提交治疗进展
```typescript
async submitProgress() {
  // 1. 验证数量
  const count = parseInt(this.data.progressForm.count)
  if (count > this.data.treatmentProgress.remainingCount) {
    wx.showToast({ title: '数量超出范围' })
    return
  }
  
  // 2. 死亡必须填写原因
  if (this.data.progressDialogType === 'died' && !this.data.progressForm.deathCause) {
    wx.showToast({ title: '请填写死亡原因' })
    return
  }
  
  // 3. 调用云函数
  const result = await wx.cloud.callFunction({
    name: 'health-management',
    data: {
      action: 'update_treatment_progress',
      treatmentId: this.data.treatmentId,
      progressType: this.data.progressDialogType,
      count,
      notes: this.data.progressForm.notes,
      deathCause: this.data.progressForm.deathCause
    }
  })
  
  // 4. 刷新页面
  if (result.result.success) {
    this.closeProgressDialog()
    this.loadTreatmentDetail(this.data.treatmentId)
  }
}
```

### 3. WXML结构

```xml
<view class="page-content">
  <!-- ========== 查看模式 ========== -->
  <block wx:if="{{viewMode}}">
    <!-- 基本信息（只读） -->
    <view class="view-section">
      <view class="info-card">
        <view class="info-row">
          <text>治疗批次</text>
          <text>{{formData.batchId}}</text>
        </view>
        <!-- ... 其他信息 -->
      </view>
    </view>
    
    <!-- 治疗方案（只读） -->
    <view class="view-section">
      <view class="plan-card">
        <text>{{treatmentPlan.primary}}</text>
      </view>
    </view>
    
    <!-- 治疗进展跟进 -->
    <view class="view-section progress-section">
      <view class="progress-card">
        <!-- 治疗天数 -->
        <view class="progress-header">
          <text>已治疗 {{treatmentProgress.treatmentDays}} 天</text>
          <t-tag theme="primary">进行中</t-tag>
        </view>
        
        <!-- 统计数据 -->
        <view class="progress-stats">
          <view class="stat-item">
            <text>治疗总数</text>
            <text class="total">{{treatmentProgress.totalTreated}} 只</text>
          </view>
          <view class="stat-item">
            <text>已治愈</text>
            <text class="cured">{{treatmentProgress.curedCount}} 只</text>
          </view>
          <view class="stat-item">
            <text>死亡</text>
            <text class="died">{{treatmentProgress.deathCount}} 只</text>
          </view>
          <view class="stat-item">
            <text>继续治疗</text>
            <text class="remaining">{{treatmentProgress.remainingCount}} 只</text>
          </view>
        </view>
        
        <!-- 进度条 -->
        <view class="progress-bar">
          <view class="bar-cured" style="width: {{treatmentProgress.cureRate}}%"></view>
          <view class="bar-died" style="width: {{treatmentProgress.mortalityRate}}%"></view>
        </view>
        
        <!-- 操作按钮 -->
        <view class="progress-actions">
          <t-button theme="success" bind:tap="showProgressDialog" data-type="cured">
            记录治愈
          </t-button>
          <t-button theme="danger" bind:tap="showProgressDialog" data-type="died">
            记录死亡
          </t-button>
        </view>
      </view>
    </view>
  </block>
  
  <!-- ========== 编辑/创建模式 ========== -->
  <block wx:else>
    <!-- 原有表单内容 -->
  </block>
</view>

<!-- 进展对话框 -->
<t-dialog visible="{{showProgressDialog}}" bind:confirm="submitProgress">
  <view class="progress-dialog-content">
    <!-- 剩余数量提示 -->
    <view class="dialog-hint">
      <text>当前剩余治疗数：</text>
      <text>{{treatmentProgress.remainingCount}} 只</text>
    </view>
    
    <!-- 数量输入 -->
    <view class="dialog-field">
      <view class="field-label required">
        {{progressDialogType === 'cured' ? '治愈数量' : '死亡数量'}}
      </view>
      <t-input
        value="{{progressForm.count}}"
        type="digit"
        data-field="count"
        bind:change="onProgressFormInput"
      />
    </view>
    
    <!-- 死亡原因（仅死亡时） -->
    <view class="dialog-field" wx:if="{{progressDialogType === 'died'}}">
      <view class="field-label required">死亡原因</view>
      <t-textarea
        value="{{progressForm.deathCause}}"
        data-field="deathCause"
        bind:change="onProgressFormInput"
      />
    </view>
    
    <!-- 备注 -->
    <view class="dialog-field">
      <view class="field-label">备注</view>
      <t-textarea
        value="{{progressForm.notes}}"
        data-field="notes"
        bind:change="onProgressFormInput"
      />
    </view>
  </view>
</t-dialog>
```

### 4. 样式设计（treatment-record.scss）

```scss
// 查看模式容器
.view-section {
  margin-bottom: 32rpx;
  
  .section-title {
    font-size: 32rpx;
    font-weight: 600;
    border-left: 6rpx solid #0052d9;
    padding-left: 20rpx;
  }
}

// 治疗进展卡片
.progress-section {
  .progress-card {
    background: white;
    border-radius: 16rpx;
    padding: 32rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  }
  
  .progress-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24rpx;
    
    .stat-item {
      text-align: center;
      padding: 24rpx;
      background: #f8f9fa;
      border-radius: 12rpx;
      
      .stat-value {
        font-size: 36rpx;
        font-weight: 600;
        
        &.total { color: #0052d9; }   // 蓝色
        &.cured { color: #00a870; }   // 绿色
        &.died { color: #e34d59; }    // 红色
        &.remaining { color: #ed7b2f; } // 橙色
      }
    }
  }
  
  .progress-bar {
    height: 12rpx;
    background: #f0f0f0;
    border-radius: 6rpx;
    display: flex;
    overflow: hidden;
    
    .bar-cured {
      background: linear-gradient(90deg, #00a870, #00c48c);
      transition: width 0.3s ease;
    }
    
    .bar-died {
      background: linear-gradient(90deg, #e34d59, #ff6b7a);
      transition: width 0.3s ease;
    }
  }
}
```

## 🔄 完整流程

### 场景1：制定治疗方案

```
1. 健康管理中心 → 异常记录列表 → 异常记录详情
   ↓
2. 点击"制定治疗方案"
   ↓
3. 跳转到 treatment-record（mode=create）
   ↓
4. 填写治疗方案、选择用药
   ↓
5. 提交 → 创建治疗记录（outcome.status = 'ongoing'）
   ↓
6. 返回健康管理中心
```

### 场景2：跟进治疗进展

```
1. 健康管理中心 → 治疗中列表
   ↓
2. 点击某条治疗记录
   ↓
3. 跳转到 treatment-record（mode=view）
   ↓
4. 查看治疗基本信息（只读）
   ↓
5. 查看治疗进展统计
   ↓
6. 点击"记录治愈"或"记录死亡"
   ↓
7. 填写对话框（数量、原因、备注）
   ↓
8. 提交 → 更新治疗进展
   ↓
9. 系统自动计算新状态
   ↓
10. 刷新页面显示最新进展
```

### 场景3：治疗完成

```
当 remainingCount = 0 时：

情况A：全部治愈
- curedCount = 5, deathCount = 0
- status = 'cured'
- 异常记录状态 = 'resolved'

情况B：全部死亡
- curedCount = 0, deathCount = 5
- status = 'died'
- 异常记录状态 = 'completed'

情况C：部分治愈+部分死亡
- curedCount = 3, deathCount = 2
- status = 'completed'
- 异常记录状态 = 'completed'
```

## 📊 数据流转图

```
┌─────────────────┐
│  异常记录详情   │
└────────┬────────┘
         │
         │ 制定治疗方案
         ↓
┌─────────────────┐
│   治疗记录创建  │  outcome.status = 'ongoing'
│  (mode=create)  │  isDraft = false
└────────┬────────┘
         │
         │ 保存
         ↓
┌─────────────────┐
│  健康管理中心   │
│  "治疗中" 显示1 │
└────────┬────────┘
         │
         │ 点击列表
         ↓
┌─────────────────┐
│   治疗记录查看  │
│   (mode=view)   │  ← 只读展示
│                 │
│ [记录治愈]      │  ← 记录2只治愈
│ [记录死亡]      │  ← 记录1只死亡
└────────┬────────┘
         │
         │ 提交进展
         ↓
┌─────────────────┐
│ updateProgress  │
│ curedCount: 0→2 │
│ deathCount: 0→1 │
│ remaining: 5→2  │
│ status: ongoing │
└────────┬────────┘
         │
         │ 创建死亡记录（如需要）
         │ 更新异常记录（如完成）
         ↓
┌─────────────────┐
│   刷新页面显示  │
│ 已治愈: 2 只    │
│ 死亡: 1 只      │
│ 继续治疗: 2 只  │
└─────────────────┘
```

## ✅ 核心优势

### 1. 清晰的阶段分离
- **制定阶段**：专注于制定治疗方案
- **跟进阶段**：专注于记录治疗结果
- 不会混淆，逻辑清晰

### 2. 信息不可篡改
- 查看模式下，所有信息**只读**
- 确保已制定方案的**完整性**
- 避免误操作修改历史数据

### 3. 简化操作流程
- 直接记录结果，不需要复杂表单
- 两个按钮：治愈 / 死亡
- 自动计算状态，无需手动设置

### 4. 实时统计可视化
- 治疗天数自动计算
- 进度统计一目了然
- 进度条直观展示治愈率和死亡率

### 5. 自动状态流转
- 根据治愈和死亡数量自动判定状态
- 无需人工干预
- 逻辑准确，不会出错

## 🧪 测试要点

### 功能测试
- [ ] 从列表点击记录，正确进入查看模式
- [ ] 查看模式下信息只读，不可编辑
- [ ] 治疗进展统计数据正确
- [ ] 记录治愈功能正常
- [ ] 记录死亡功能正常，自动创建死亡记录
- [ ] 剩余数量为0时，禁用操作按钮
- [ ] 治疗完成后，状态正确流转

### 边界测试
- [ ] 输入数量超过剩余数量，正确拦截
- [ ] 死亡未填写原因，正确拦截
- [ ] 治疗已完成（status != ongoing），不允许继续记录
- [ ] 网络异常时，显示错误提示
- [ ] 并发更新冲突，数据一致性

### 状态测试
- [ ] 全部治愈：status = 'cured'
- [ ] 全部死亡：status = 'died'
- [ ] 部分治愈+部分死亡：status = 'completed'
- [ ] 仍有剩余：status = 'ongoing'
- [ ] 异常记录状态同步更新

## 📅 更新记录

- **2025-10-27**: 完整实现治疗进展跟进功能
  - 实现查看+跟进模式（mode=view）
  - 新增云函数接口 getTreatmentDetail 和 updateTreatmentProgress
  - 前端添加治疗进展统计和操作UI
  - 自动状态判定和数据流转
  - 完整的样式设计和交互体验

