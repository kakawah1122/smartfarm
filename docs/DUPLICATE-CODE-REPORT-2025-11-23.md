# 重复代码检测报告

生成时间: 11/23/2025, 12:00:01 PM

## 📊 扫描统计

- 扫描文件数: 178个
- 检测函数数: 950个
- 发现重复组: 92组

## 🔍 重复代码列表


### 1. 重复代码组 (1271字符)

**位置1**: `miniprogram/pages/health/helpers/cloud-helper.ts`
- 函数名: `normalizeHealthData`
- 类型: function

**位置2**: `miniprogram/pages/health/helpers/cloud-helper.ts`
- 函数名: `normalizeHealthData`
- 类型: method

**代码片段**:
```javascript

  return {
    batches: rawData.batches || [],
    totalBatches: rawData.totalBatches ?? ((rawData.batches || []).length),
    totalAnimals: Number(rawData.totalAnimals ?? 0) || 0,
    deadCount: Num...
```

### 2. 重复代码组 (407字符)

**位置1**: `miniprogram/pages/health/modules/health-batch-module.ts`
- 函数名: `setupBatchManagement`
- 类型: function

**位置2**: `miniprogram/pages/health/modules/health-batch-module.ts`
- 函数名: `setupBatchManagement`
- 类型: method

**代码片段**:
```javascript

  // 绑定批次管理方法到页面实例
  pageInstance.getBatchList = () => HealthBatchManager.getBatchList()
  pageInstance.getBatchDetail = (batchId: string) => HealthBatchManager.getBatchDetail(batchId)
  pageInstance...
```

### 3. 重复代码组 (374字符)

**位置1**: `miniprogram/pages/health/modules/health-analysis-module.ts`
- 函数名: `setupAnalysisModule`
- 类型: function

**位置2**: `miniprogram/pages/health/modules/health-analysis-module.ts`
- 函数名: `setupAnalysisModule`
- 类型: method

**代码片段**:
```javascript

  // 绑定分析方法到页面实例
  pageInstance.calculateHealthRate = (stats: Partial<HealthStats>) => 
    HealthAnalysisManager.calculateHealthRate(stats)
    
  pageInstance.calculateSurvivalRate = (stats: Partia...
```

### 4. 重复代码组 (277字符)

**位置1**: `miniprogram/packageHealth/breeding-todo/breeding-todo.ts`
- 函数名: `onTaskConfirm`
- 类型: method

**位置2**: `miniprogram/pages/health/health.ts`
- 函数名: `onTaskConfirm`
- 类型: method

**代码片段**:
```javascript

    const task = this.data.selectedTask
    if (!task) return

    if (task.isVaccineTask) {
      this.openVaccineForm(task)
    } else if (task.isMedicationTask) {
      this.openMedicationForm(tas...
```

### 5. 重复代码组 (275字符)

**位置1**: `miniprogram/packageHealth/disinfection-record/disinfection-record.ts`
- 函数名: `initializeForm`
- 类型: method

**位置2**: `miniprogram/packageHealth/health-care/health-care.ts`
- 函数名: `initializeForm`
- 类型: method

**代码片段**:
```javascript

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const timeNow = now.toTimeString().split(' ')[0].substring(0, 5)
    
    this.setData({
      'formData.executionDate...
```

### 6. 重复代码组 (275字符)

**位置1**: `miniprogram/packageHealth/disinfection-record/disinfection-record.ts`
- 函数名: `initializeForm`
- 类型: method

**位置2**: `miniprogram/packageHealth/vaccine-record/vaccine-record.ts`
- 函数名: `initializeForm`
- 类型: method

**代码片段**:
```javascript

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const timeNow = now.toTimeString().split(' ')[0].substring(0, 5)
    
    this.setData({
      'formData.executionDate...
```

### 7. 重复代码组 (275字符)

**位置1**: `miniprogram/pages/production/production.backup.ts`
- 函数名: `viewMaterialRecordDetail`
- 类型: method

**位置2**: `miniprogram/pages/production/production.ts`
- 函数名: `viewMaterialRecordDetail`
- 类型: method

**代码片段**:
```javascript

    const record = e.currentTarget.dataset.record
    // 格式化数据以匹配组件期望的字段
    const formattedRecord = {
      ...record,
      displayQuantity: record.quantity || '',
      targetLocation: record.targ...
```

### 8. 重复代码组 (233字符)

**位置1**: `miniprogram/packageFinance/finance/finance.backup.ts`
- 函数名: `onQuarterChange`
- 类型: method

**位置2**: `miniprogram/packageFinance/finance/finance.ts`
- 函数名: `onQuarterChange`
- 类型: method

**代码片段**:
```javascript

    const index = e.detail.value
    const selected = this.data.quarterOptions[index]
    this.setData({
      selectedQuarter: selected.value,
      selectedQuarterIndex: index
    })
    this.loadF...
```

### 9. 重复代码组 (227字符)

**位置1**: `miniprogram/packageFinance/finance/finance.backup.ts`
- 函数名: `onMonthChange`
- 类型: method

**位置2**: `miniprogram/packageFinance/finance/finance.ts`
- 函数名: `onMonthChange`
- 类型: method

**代码片段**:
```javascript

    const index = e.detail.value
    const selected = this.data.monthOptions[index]
    this.setData({
      selectedMonth: selected.value,
      selectedMonthIndex: index
    })
    this.loadFinance...
```

### 10. 重复代码组 (227字符)

**位置1**: `miniprogram/packageProduction/entry-form/entry-form.ts`
- 函数名: `calculateTotalAmount`
- 类型: method

**位置2**: `miniprogram/packageProduction/purchase-form/purchase-form.ts`
- 函数名: `calculateTotalAmount`
- 类型: method

**代码片段**:
```javascript

    const { quantity, unitPrice } = this.data.formData
    const quantityNum = parseFloat(quantity) || 0
    const priceNum = parseFloat(unitPrice) || 0
    const total = (quantityNum * priceNum).toF...
```

### 11. 重复代码组 (224字符)

**位置1**: `miniprogram/packageFinance/finance/finance.backup.ts`
- 函数名: `onYearChange`
- 类型: method

**位置2**: `miniprogram/packageFinance/finance/finance.ts`
- 函数名: `onYearChange`
- 类型: method

**代码片段**:
```javascript

    const index = e.detail.value
    const selected = this.data.yearOptions[index]
    this.setData({
      selectedYear: selected.value,
      selectedYearIndex: index
    })
    this.loadFinanceDat...
```

### 12. 重复代码组 (217字符)

**位置1**: `miniprogram/packageUser/employee-permission/employee-permission.ts`
- 函数名: `function`
- 类型: method

**位置2**: `miniprogram/packageUser/employee-permission/employee-permission.ts`
- 函数名: `function`
- 类型: method

**代码片段**:
```javascript

    const roleMap = {
      // 新的4角色体系
      'employee': '员工',
      'veterinarian': '兽医', 
      'manager': '经理',
      'super_admin': '超级管理员',
      
      // 兼容旧角色（向下兼容）
      'admin': '超级管理员',
  ...
```

### 13. 重复代码组 (217字符)

**位置1**: `miniprogram/pages/production/production.backup.ts`
- 函数名: `resetCountData`
- 类型: method

**位置2**: `miniprogram/pages/production/production.ts`
- 函数名: `resetCountData`
- 类型: method

**代码片段**:
```javascript

    this.setData({
      'aiCount.active': false,
      'aiCount.result': null,
      'aiCount.imageUrl': '',
      'aiCount.rounds': [],
      'aiCount.currentRound': 0,
      'aiCount.cumulativeTot...
```

### 14. 重复代码组 (197字符)

**位置1**: `miniprogram/pages/production/production.backup.ts`
- 函数名: `getDateRange`
- 类型: method

**位置2**: `miniprogram/pages/production/production.ts`
- 函数名: `getDateRange`
- 类型: method

**代码片段**:
```javascript

    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.to...
```

### 15. 重复代码组 (163字符)

**位置1**: `miniprogram/pages/health/modules/health-data-service.ts`
- 函数名: `invalidateAllBatchesCache`
- 类型: function

**位置2**: `miniprogram/pages/health/modules/health-data-service.ts`
- 函数名: `invalidateAllBatchesCache`
- 类型: method

**代码片段**:
```javascript

  pendingAllBatchesPromise = null
  latestAllBatchesSnapshot = null
  latestAllBatchesFetchedAt = 0
  try {
    wx.removeStorageSync(ALL_BATCHES_CACHE_KEY)
  } catch (error) {
    // 清理失败静默处理
  }
...
```

### 16. 重复代码组 (159字符)

**位置1**: `miniprogram/packageFinance/finance/finance.backup.ts`
- 函数名: `onCustomStartDateChange`
- 类型: method

**位置2**: `miniprogram/packageFinance/finance/finance.ts`
- 函数名: `onStartDateChange`
- 类型: method

**代码片段**:
```javascript

    this.setData({
      customStartDate: e.detail.value
    })
    
    // 如果结束日期也已选择，则加载数据
    if (this.data.customEndDate) {
      this.loadFinanceData()
      this.loadFinanceRecords()
      this...
```

### 17. 重复代码组 (159字符)

**位置1**: `miniprogram/packageFinance/finance/finance.backup.ts`
- 函数名: `onCustomEndDateChange`
- 类型: method

**位置2**: `miniprogram/packageFinance/finance/finance.ts`
- 函数名: `onEndDateChange`
- 类型: method

**代码片段**:
```javascript

    this.setData({
      customEndDate: e.detail.value
    })
    
    // 如果开始日期也已选择，则加载数据
    if (this.data.customStartDate) {
      this.loadFinanceData()
      this.loadFinanceRecords()
      this...
```

### 18. 重复代码组 (157字符)

**位置1**: `miniprogram/packageHealth/disinfection-record/disinfection-record.ts`
- 函数名: `onShow`
- 类型: method

**位置2**: `miniprogram/packageHealth/health-care/health-care.ts`
- 函数名: `onShow`
- 类型: method

**代码片段**:
```javascript

    // ✅ 实现数据缓存机制
    const now = Date.now()
    if (this.data.batchesCacheTime && 
        now - this.data.batchesCacheTime < BATCHES_CACHE_DURATION) {
      return
    }
    await this.loadActiveBa...
```

### 19. 重复代码组 (157字符)

**位置1**: `miniprogram/packageHealth/disinfection-record/disinfection-record.ts`
- 函数名: `onShow`
- 类型: method

**位置2**: `miniprogram/packageHealth/vaccine-record/vaccine-record.ts`
- 函数名: `onShow`
- 类型: method

**代码片段**:
```javascript

    // ✅ 实现数据缓存机制
    const now = Date.now()
    if (this.data.batchesCacheTime && 
        now - this.data.batchesCacheTime < BATCHES_CACHE_DURATION) {
      return
    }
    await this.loadActiveBa...
```

### 20. 重复代码组 (151字符)

**位置1**: `miniprogram/pages/production/production.backup.ts`
- 函数名: `calculateAvgConfidence`
- 类型: method

**位置2**: `miniprogram/pages/production/production.ts`
- 函数名: `calculateAvgConfidence`
- 类型: method

**代码片段**:
```javascript

    if (!rounds || rounds.length === 0) return 0
    const sum = rounds.reduce((acc, r) => acc + (r.confidence || 0), 0)
    return Math.round(sum / rounds.length)
  ...
```

... 还有 72 组重复代码未显示

## 💡 优化建议

### 1. 提取公共函数
将重复的代码提取到公共模块中，其他地方引用。

### 2. 创建工具类
相似的功能可以创建工具类统一管理。

### 3. 使用继承或混入
对于类方法的重复，可以考虑使用继承或混入模式。

## ⚠️ 注意事项

1. 并非所有重复都需要消除
2. 有些重复是必要的（如模板代码）
3. 重构时要确保功能不变
4. 充分测试重构后的代码
