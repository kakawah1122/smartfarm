# 治疗中记录列表页面实现

## 📋 需求说明

用户反馈："治疗中"卡片点击后不应该使用弹窗选择，而应该像"异常数"和"死亡数"一样，直接跳转到列表页面显示所有进行中的治疗记录。

## ✨ 实现方案

### 1. 创建治疗记录列表页面

参照 `abnormal-records-list` 和 `death-records-list` 的设计，创建新页面：
`miniprogram/packageHealth/treatment-records-list/`

### 2. 页面文件结构

```
treatment-records-list/
├── treatment-records-list.ts      // 页面逻辑
├── treatment-records-list.wxml    // 页面结构
├── treatment-records-list.scss    // 页面样式
└── treatment-records-list.json    // 页面配置
```

## 📄 文件详情

### treatment-records-list.ts

**核心功能**：
- 调用 `get_ongoing_treatments` 云函数获取进行中的治疗记录
- 支持下拉刷新
- 点击记录卡片跳转到治疗记录详情页

**数据结构**：
```typescript
interface TreatmentRecord {
  _id: string
  batchId: string
  abnormalRecordId?: string
  treatmentDate: string
  treatmentType: string  // 'medication' | 'isolation'
  diagnosis: {
    preliminary: string
    confirmed: string
    confidence: number
    diagnosisMethod: string
  }
  treatmentPlan: {
    primary: string
    followUpSchedule: any[]
  }
  medications: any[]
  outcome: {
    status: string  // 'ongoing' | 'cured' | 'died' | 'pending'
    curedCount: number
    improvedCount: number
    deathCount: number
    totalTreated: number
  }
  isDraft: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}
```

**关键方法**：
```typescript
// 加载治疗记录列表
async loadTreatmentRecords() {
  const result = await wx.cloud.callFunction({
    name: 'health-management',
    data: {
      action: 'get_ongoing_treatments',
      batchId: null  // null表示获取所有批次
    }
  })
  // ...
}

// 点击记录跳转详情
onRecordTap(e: any) {
  const { id } = e.currentTarget.dataset
  wx.navigateTo({
    url: `/packageHealth/treatment-record/treatment-record?treatmentId=${id}&mode=view`
  })
}
```

### treatment-records-list.wxml

**页面结构**：
1. **自定义导航栏**：显示"治疗中记录"标题
2. **加载状态**：显示 loading 组件
3. **空状态**：无数据时显示"暂无进行中的治疗"
4. **记录列表**：展示治疗记录卡片

**卡片信息展示**：
```
┌────────────────────────────────────────┐
│ 诊断名称                  [药物治疗/隔离]│
├────────────────────────────────────────┤
│ 批次：XXXX       治疗数量：5 只          │
│ 方案：治疗方案描述...                   │
│ 用药：浆膜清2件、3%葡萄糖1件            │
│ 已治愈：2 只  好转：1 只  死亡：0 只     │
│────────────────────────────────────────│
│ 2025-10-27                 [进行中]     │
└────────────────────────────────────────┘
```

### treatment-records-list.scss

**样式特点**：
- 遵循统一的卡片设计风格
- 响应式布局，适配不同屏幕尺寸
- 点击态动画效果（缩放 + 透明度）
- 信息分层展示，层次清晰
- 颜色语义化：
  - 治愈：绿色 (#00a870)
  - 受影响/警告：橙色 (#ed7b2f)
  - 死亡/危险：红色 (#e34d59)

### treatment-records-list.json

**配置项**：
```json
{
  "usingComponents": {
    "t-loading": "tdesign-miniprogram/loading/loading",
    "t-empty": "tdesign-miniprogram/empty/empty",
    "t-tag": "tdesign-miniprogram/tag/tag",
    "navigation-bar": "/components/navigation-bar/navigation-bar"
  },
  "enablePullDownRefresh": true,
  "navigationStyle": "custom"
}
```

## 🔄 交互流程

### 用户操作流程

```
1. 用户进入健康管理中心
   ↓
2. 点击"治疗中"卡片（显示数字 1）
   ↓
3. 跳转到治疗记录列表页面
   ↓
4. 显示所有进行中的治疗记录
   ↓
5. 点击某条记录
   ↓
6. 进入治疗记录详情页（可查看/编辑）
```

### 数据加载流程

```
1. 页面加载 (onLoad)
   ↓
2. 调用 loadTreatmentRecords()
   ↓
3. 云函数 get_ongoing_treatments
   ↓
4. 查询条件：
   - isDeleted: false
   - isDraft: false
   - 代码过滤：outcome.status === 'ongoing'
   ↓
5. 返回治疗记录数组
   ↓
6. 页面渲染列表
```

## 📝 修改内容

### 1. 新增文件（4个）

```
miniprogram/packageHealth/treatment-records-list/
├── treatment-records-list.ts      ✅ 新建
├── treatment-records-list.wxml    ✅ 新建
├── treatment-records-list.scss    ✅ 新建
└── treatment-records-list.json    ✅ 新建
```

### 2. 修改文件（2个）

#### miniprogram/app.json
```json
{
  "root": "packageHealth",
  "name": "health",
  "pages": [
    // ...
    "treatment-record/treatment-record",
    "treatment-records-list/treatment-records-list",  // ✅ 新增
    // ...
  ]
}
```

#### miniprogram/pages/health/health.ts
```typescript
// ❌ 修改前（使用弹窗选择）
onOngoingTreatmentClick() {
  const treatments = this.data.treatmentData.currentTreatments || []
  
  if (treatments.length === 0) {
    wx.showToast({
      title: '暂无进行中的治疗',
      icon: 'none'
    })
    return
  }
  
  // 显示治疗列表供选择
  const itemList = treatments.map((t: any) => 
    `${t.diagnosis} - ${t.initialCount || 0}只`
  )
  
  wx.showActionSheet({
    itemList,
    success: (res) => {
      const selected = treatments[res.tapIndex]
      wx.navigateTo({
        url: `/packageHealth/treatment-record/treatment-record?treatmentId=${selected._id}`
      })
    }
  })
}

// ✅ 修改后（直接跳转列表页）
/**
 * 治疗中卡片点击 - 跳转到治疗记录列表
 */
onOngoingTreatmentClick() {
  wx.navigateTo({
    url: '/packageHealth/treatment-records-list/treatment-records-list'
  })
}
```

## 🎨 UI/UX 改进

### 修改前（弹窗模式）
```
点击"治疗中" → 底部弹出选项列表 → 显示 "[object Object] - 0只"（BUG）
```

**问题**：
1. 弹窗选项显示异常（[object Object]）
2. 只能单选，无法快速查看所有治疗记录
3. 交互不一致（异常数和死亡数都是列表页）

### 修改后（列表模式）
```
点击"治疗中" → 跳转到列表页 → 显示所有记录卡片
```

**优点**：
1. 信息展示完整（诊断、方案、用药、进展）
2. 支持下拉刷新
3. 交互统一（与异常数、死亡数一致）
4. 视觉层次清晰，易于快速浏览

## 🔑 关键特性

### 1. 数据展示

- **治疗类型标签**：药物治疗（蓝色）/ 隔离观察（绿色）
- **批次信息**：显示治疗批次号
- **治疗数量**：高亮显示（橙色加粗）
- **治疗方案**：支持多行显示，自动换行
- **用药情况**：列出所有药品/营养品及数量
- **治疗进展**：
  - 已治愈：绿色显示
  - 好转：正常显示
  - 死亡：红色显示

### 2. 交互体验

- **点击效果**：卡片缩放 + 透明度变化
- **下拉刷新**：支持手动刷新数据
- **页面切换**：`onShow` 时自动刷新（从详情页返回时更新）
- **加载状态**：显示 loading 动画
- **空状态**：友好的空数据提示

### 3. 性能优化

- **懒加载**：分包加载，按需引入
- **数据缓存**：列表数据缓存在 data 中
- **条件渲染**：使用 `wx:if` 减少不必要的渲染

## 🧪 测试要点

### 功能测试

- [ ] 点击"治疗中"卡片，正确跳转到列表页
- [ ] 列表页正确显示所有进行中的治疗记录
- [ ] 记录卡片展示完整信息（诊断、批次、方案、用药、进展）
- [ ] 点击记录卡片，正确跳转到详情页
- [ ] 下拉刷新功能正常
- [ ] 从详情页返回，列表自动刷新

### 边界测试

- [ ] 无数据时显示空状态
- [ ] 网络异常时显示错误提示
- [ ] 治疗记录字段缺失时正常显示
- [ ] 长文本内容正常换行显示
- [ ] 大量记录时滚动流畅

### 兼容性测试

- [ ] iOS 系统显示正常
- [ ] Android 系统显示正常
- [ ] 不同屏幕尺寸适配良好
- [ ] 安全区域适配正确

## 🎯 与其他页面的一致性

### 列表页面对比

| 特性 | 异常记录列表 | 死亡记录列表 | 治疗记录列表 |
|------|-------------|-------------|-------------|
| 导航栏 | ✅ 自定义 | ✅ 自定义 | ✅ 自定义 |
| 下拉刷新 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| 加载状态 | ✅ loading | ✅ loading | ✅ loading |
| 空状态 | ✅ empty | ✅ empty | ✅ empty |
| 卡片样式 | ✅ 统一 | ✅ 统一 | ✅ 统一 |
| 点击跳转 | ✅ 详情页 | ✅ 详情页 | ✅ 详情页 |

### 交互流程一致性

```
健康管理中心
├── 异常数    → 异常记录列表    → 异常记录详情
├── 治疗中    → 治疗记录列表    → 治疗记录详情  ✅ 新增
└── 死亡数    → 死亡记录列表    → 死亡记录详情
```

## 📅 更新记录

- **2025-10-27**: 初始实现
  - 创建治疗记录列表页面
  - 修改"治疗中"点击事件，从弹窗改为跳转列表
  - 确保与异常数、死亡数的交互体验一致
  - 修复弹窗显示 [object Object] 的问题

