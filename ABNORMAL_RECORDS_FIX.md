# 异常记录显示修复文档

## 📋 问题描述
用户报告："异常"卡片显示为0，但数据库中有异常记录

## 🔍 问题分析

### 根本原因
1. **前端未查询异常记录数据库**
   - `loadTreatmentData` 方法没有调用 `get_abnormal_records` 云函数
   - 数据完全没有从数据库加载

2. **全部批次模式使用错误数据源**
   - `loadAllBatchesData` 使用 `sickCount`（健康检查的生病数）
   - 而不是从 `health_records` 集合查询真实异常记录

### 数据绑定路径
```
WXML: {{monitoringData.realTimeStatus.abnormalCount || healthStats.sickCount}}
      ↓
TS:   monitoringData.realTimeStatus.abnormalCount (未赋值 → 0)
      ↓
后备: healthStats.sickCount (可能也为0)
```

## ✅ 修复方案

### 1. 单批次模式 (`loadTreatmentData`)
```typescript
// ✅ 新增：查询异常记录
const abnormalResult = await wx.cloud.callFunction({
  name: 'health-management',
  data: {
    action: 'get_abnormal_records',
    batchId: this.data.currentBatchId
  }
})

const abnormalRecords = abnormalResult.result?.success 
  ? (abnormalResult.result.data || [])
  : []

// ✅ 更新数据
this.setData({
  'monitoringData.realTimeStatus.abnormalCount': abnormalRecords.length,
  'monitoringData.abnormalList': abnormalRecords
})
```

### 2. 全部批次模式 (`loadAllBatchesData`)
```typescript
// ✅ 查询所有批次的异常记录
const abnormalResult = await wx.cloud.callFunction({
  name: 'health-management',
  data: {
    action: 'get_abnormal_records',
    batchId: 'all'  // 查询所有批次
  }
})

const abnormalRecords = abnormalResult.result?.success 
  ? (abnormalResult.result.data || [])
  : []

// ✅ 使用真实异常记录数量
const monitoringData = {
  realTimeStatus: {
    healthyCount: healthyCount,
    abnormalCount: abnormalRecords.length,  // ✅ 替代 sickCount
    isolatedCount: 0
  },
  abnormalList: abnormalRecords,
  diseaseDistribution: []
}
```

## 📊 数据来源

### 云函数: `get_abnormal_records`
- **集合**: `health_records`
- **查询条件**:
  ```javascript
  {
    recordType: 'ai_diagnosis',
    status: _.in(['abnormal', 'treating', 'isolated']),
    isDeleted: _.neq(true),
    batchId: batchId  // 或 'all' 查询所有批次
  }
  ```
- **排序**: `checkDate` 降序

### 异常记录状态说明
- `abnormal`: 待处理的异常
- `treating`: 治疗中
- `isolated`: 已隔离

## 🎯 修复效果

### 修复前
```
异常卡片: 0 ❌
实际数据库: 有记录 ✓
```

### 修复后
```
异常卡片: 实际记录数量 ✅
数据来源: health_records 集合 ✅
实时更新: 支持 ✅
```

## 🧪 测试验证

### 测试场景
1. **有异常记录时**
   - 卡片显示正确数量
   - 点击跳转到异常记录列表
   
2. **无异常记录时**
   - 卡片显示 0
   - 符合实际状态

3. **切换批次时**
   - 单批次：显示该批次异常数
   - 全部批次：显示所有批次异常总数

4. **实时更新**
   - 创建新异常记录 → 数量自动更新
   - 处理异常 → 数量自动减少

## 📝 相关文件

### 修改文件
- `miniprogram/pages/health/health.ts`
  - `loadTreatmentData()` - 单批次异常查询
  - `loadAllBatchesData()` - 全部批次异常查询

### 云函数
- `cloudfunctions/health-management/index.js`
  - `getAbnormalRecords()` - 已存在，无需修改

### 前端UI
- `miniprogram/pages/health/health.wxml`
  - 异常卡片: `{{monitoringData.realTimeStatus.abnormalCount || healthStats.sickCount}}`
  - 无需修改，数据源已修复

## 🚀 部署说明

### 无需部署云函数
- 云函数已有 `get_abnormal_records` action
- 只需刷新前端小程序即可

### 验证步骤
1. 编译小程序
2. 刷新健康管理页面
3. 查看"异常"卡片是否显示正确数量
4. 查看控制台日志：
   ```
   ✅ 治疗数据加载成功: {
     abnormalCount: X,  // 应显示实际数量
     ongoingTreatment: Y,
     ...
   }
   ```

## 🔄 后续优化建议

1. **实时监听**
   - 添加 `health_records` 的 watcher
   - 异常记录变化时自动更新卡片

2. **隔离数量统计**
   - 当前全部批次模式 `isolatedCount` 固定为0
   - 可从异常记录中筛选 `status='isolated'` 的数量

3. **性能优化**
   - 考虑缓存异常记录查询结果
   - 避免频繁查询数据库

## ✅ 完成标记
- [x] 修复单批次异常数量显示
- [x] 修复全部批次异常数量显示
- [x] 添加调试日志
- [x] 提交代码
- [x] 文档记录

