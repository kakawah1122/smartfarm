# Health 模块集成指南

## 🚀 快速集成示例

### 在 health.ts 中集成已完成的模块

```typescript
// 1. 在文件顶部添加导入
import { HealthNavigationManager } from './modules/health-navigation-module'
import { HealthEventManager, setupEventManagement } from './modules/health-event-module'

// 2. 在 Page 对象中初始化
Page({
  // ... 现有数据定义 ...
  
  onLoad(options) {
    // 设置事件管理
    setupEventManagement(this)
    
    // 原有的 onLoad 逻辑...
  },
  
  // 3. 替换原有的导航方法（示例）
  viewDiagnosisHistory() {
    // 使用事件管理器的防重复点击
    if (this.checkDoubleClick()) return
    
    // 使用导航管理器
    HealthNavigationManager.navigateToDiagnosisHistory()
  },
  
  // 4. 使用防抖的数据加载（替换原有方法）
  loadHealthData(silent = false, debounce = true) {
    if (debounce) {
      // 使用事件管理器的防抖
      if (!this.debouncedLoadHealthData) {
        this.debouncedLoadHealthData = HealthEventManager.debounce(
          this._executeLoadHealthData.bind(this),
          { delay: 100 }
        )
      }
      this.debouncedLoadHealthData(silent)
    } else {
      this._executeLoadHealthData(silent)
    }
  },
  
  // 5. 批量替换导航方法（可选）
  setupNavigationHandlers() {
    const handlers = HealthNavigationManager.createNavigationHandlers()
    
    // 选择性绑定需要的方法
    this.openAiDiagnosis = () => {
      if (this.checkDoubleClick()) return
      handlers.openAiDiagnosis(this.data.currentBatchId)
    }
    
    this.createTreatmentRecord = () => {
      if (this.checkDoubleClick()) return
      handlers.createTreatmentRecord(this.data.currentBatchId)
    }
    
    // ... 绑定其他方法
  }
})
```

## 📋 逐步替换清单

### Step 1: 替换导航方法

#### 原代码：
```typescript
viewDiagnosisHistory() {
  const now = Date.now()
  if (now - this.lastClickTime < 500) return
  this.lastClickTime = now
  
  wx.navigateTo({
    url: `/packageAI/diagnosis-history/diagnosis-history`
  })
}
```

#### 新代码：
```typescript
viewDiagnosisHistory() {
  if (this.checkDoubleClick()) return
  HealthNavigationManager.navigateToDiagnosisHistory()
}
```

### Step 2: 替换防抖逻辑

#### 原代码：
```typescript
async loadHealthData(silent: boolean = false, debounce: boolean = true) {
  if (debounce) {
    if (this.loadDataDebounceTimer) {
      clearTimeout(this.loadDataDebounceTimer)
    }
    
    this.loadDataDebounceTimer = setTimeout(async () => {
      await this._executeLoadHealthData(silent)
    }, 100) as any
    return
  }
  
  await this._executeLoadHealthData(silent)
}
```

#### 新代码：
```typescript
async loadHealthData(silent: boolean = false, debounce: boolean = true) {
  if (debounce) {
    if (!this.debouncedLoadHealthData) {
      this.debouncedLoadHealthData = HealthEventManager.debounce(
        this._executeLoadHealthData.bind(this),
        { delay: 100 }
      )
    }
    this.debouncedLoadHealthData(silent)
  } else {
    await this._executeLoadHealthData(silent)
  }
}
```

### Step 3: 批量替换所有导航方法

```typescript
// 在 onLoad 中调用
onLoad() {
  // 初始化事件管理
  setupEventManagement(this)
  
  // 批量替换导航方法
  this.replaceNavigationMethods()
  
  // 原有逻辑...
}

replaceNavigationMethods() {
  const navigationMap = {
    'viewDiagnosisHistory': () => HealthNavigationManager.navigateToDiagnosisHistory(),
    'onPendingDiagnosisClick': () => HealthNavigationManager.navigateToAiDiagnosis(),
    'createTreatmentRecord': () => HealthNavigationManager.createTreatmentRecord(this.data.currentBatchId),
    'createPreventionRecord': () => HealthNavigationManager.createPreventionRecord(this.data.currentBatchId),
    'createHealthRecord': () => HealthNavigationManager.createHealthInspection(this.data.currentBatchId),
    // ... 添加其他方法
  }
  
  // 为每个方法添加防重复点击
  Object.entries(navigationMap).forEach(([name, handler]) => {
    this[name] = () => {
      if (this.checkDoubleClick()) return
      handler()
    }
  })
}
```

## ⚠️ 注意事项

### 1. 保持向后兼容
- 不要删除原有的数据和属性
- 保留原有的方法签名
- 确保事件参数正确传递

### 2. 测试每个改动
```javascript
// 测试防重复点击
console.log('点击按钮快速多次，应该只触发一次')

// 测试防抖
console.log('快速调用多次，应该只执行最后一次')

// 测试导航
console.log('检查页面跳转是否正常，参数是否正确')
```

### 3. 逐步迁移
- 一次只替换几个方法
- 测试通过后再继续
- 发现问题立即回滚

## 📊 集成进度跟踪

| 功能模块 | 原方法数 | 已替换 | 待替换 | 状态 |
|---------|---------|--------|--------|------|
| 页面导航 | 20+ | 0 | 20+ | ⏳ 待集成 |
| 防重复点击 | 15+ | 0 | 15+ | ⏳ 待集成 |
| 防抖处理 | 2 | 0 | 2 | ⏳ 待集成 |
| 节流处理 | 0 | 0 | 0 | - |

## 🔍 验证清单

### 功能验证
- [ ] 诊断历史页面跳转正常
- [ ] 治疗记录页面跳转正常
- [ ] 预防记录页面跳转正常
- [ ] AI诊断页面跳转正常
- [ ] 防重复点击功能正常
- [ ] 数据加载防抖正常
- [ ] 页面参数传递正确
- [ ] 事件监听正常工作

### 性能验证
- [ ] 页面响应速度无下降
- [ ] 内存占用无增加
- [ ] 无新增报错

### UI验证
- [ ] 界面显示无变化
- [ ] 动画效果正常
- [ ] 交互体验一致

## 🚀 下一步计划

1. **完成剩余模块**
   - health-chart-module.ts
   - health-batch-module.ts

2. **开始集成测试**
   - 选择一个简单功能开始
   - 逐步扩展到其他功能

3. **性能优化**
   - 监控模块化后的性能
   - 优化需要改进的地方

## 💡 最佳实践

1. **保持代码整洁**
   ```typescript
   // ✅ 好的做法
   if (this.checkDoubleClick()) return
   HealthNavigationManager.navigateToDiagnosisHistory()
   
   // ❌ 避免的做法
   const now = Date.now()
   if (now - this.lastClickTime < 500) return
   this.lastClickTime = now
   wx.navigateTo({ url: '...' })
   ```

2. **使用类型定义**
   ```typescript
   // 添加类型定义提高代码质量
   interface HealthPageData {
     currentBatchId: string
     lastClickTime: number
     // ... 其他属性
   }
   ```

3. **错误处理**
   ```typescript
   try {
     HealthNavigationManager.navigateToAiDiagnosis(batchId)
   } catch (error) {
     console.error('导航失败:', error)
     wx.showToast({ title: '页面跳转失败', icon: 'none' })
   }
   ```
