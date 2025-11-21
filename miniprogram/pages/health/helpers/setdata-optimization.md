# SetData优化方案

## 📊 当前状态分析
- **health.ts文件**: 100个setData调用
- **其他页面**: 1269个setData调用
- **总计**: 1369个setData调用

## 🔍 问题识别

### 1. 频繁调用模式
```javascript
// ❌ 问题代码
this.setData({ loading: true })
// ... 执行操作
this.setData({ data: result })
this.setData({ loading: false })
```

### 2. 分散更新模式
```javascript
// ❌ 问题代码  
this.setData({ 'healthStats.totalChecks': value1 })
this.setData({ 'healthStats.healthyCount': value2 })
this.setData({ 'healthStats.sickCount': value3 })
```

### 3. 循环调用模式
```javascript
// ❌ 问题代码
array.forEach(item => {
  this.setData({ [`list[${index}]`]: item })
})
```

## ✅ 优化方案

### 1. 批量合并
```javascript
// ✅ 优化后
this.setData({
  loading: true,
  data: result,
  'healthStats.totalChecks': value1,
  'healthStats.healthyCount': value2,
  'healthStats.sickCount': value3,
  loading: false
})
```

### 2. 使用批量更新器
```javascript
// ✅ 优化后
if (this.setDataBatcher) {
  this.setDataBatcher.addBatch({
    'healthStats.totalChecks': value1,
    'healthStats.healthyCount': value2,
    'healthStats.sickCount': value3
  })
}
```

### 3. 收集后更新
```javascript
// ✅ 优化后
const updates = {}
array.forEach((item, index) => {
  updates[`list[${index}]`] = item
})
this.setData(updates)
```

## 🎯 优化目标
- 减少setData调用次数50%以上
- 提升页面响应速度30%
- 保持功能和UI完全不变

## 📋 待优化列表

### health.ts (100次调用)
1. **loadHealthData方法** - 4次调用可合并为1次
2. **loadPreventionData方法** - 3次调用可合并为1次  
3. **loadTreatmentData方法** - 5次调用可合并为2次
4. **批次切换逻辑** - 6次调用可合并为2次
5. **表单提交流程** - 8次调用可合并为3次

### 预期效果
- health.ts: 100次 → 40次（减少60%）
- 整体项目: 1369次 → 600次（减少56%）
