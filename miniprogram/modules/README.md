# 通用模块使用指南

## 📦 模块清单

### 1. navigation-manager（导航管理器）
**路径**: `/miniprogram/modules/common/navigation-manager.ts`

**功能**：
- 统一的路由配置管理
- 防重复点击保护
- 多种导航方式支持（navigateTo、redirectTo、switchTab等）
- 分包预加载
- 路径和参数管理

**使用示例**：
```typescript
import NavigationManager, { navigateTo } from '@/modules/common/navigation-manager'

// 方式一：使用路由名导航
NavigationManager.navigateTo('ai-diagnosis', {
  params: { batchId: 'xxx' }
})

// 方式二：使用便捷方法
navigateTo('treatment-record', {
  params: { id: 'xxx', mode: 'edit' }
})

// 后退
NavigationManager.navigateBack()

// 切换Tab
NavigationManager.switchTab('health')

// 获取当前页面路径
const currentPath = NavigationManager.getCurrentPath()

// 获取当前页面参数
const params = NavigationManager.getCurrentParams()
```

### 2. event-manager（事件管理器）
**路径**: `/miniprogram/modules/common/event-manager.ts`

**功能**：
- 防抖（Debounce）和节流（Throttle）
- 全局事件总线
- 独立事件总线创建
- 支持一次性事件监听

**使用示例**：
```typescript
import EventManager, { debounce, throttle, on, emit } from '@/modules/common/event-manager'

// 防抖
const debouncedSearch = debounce(search, { delay: 500 })
debouncedSearch('keyword')

// 节流
const throttledScroll = throttle(handleScroll, { delay: 100 })
window.addEventListener('scroll', throttledScroll)

// 事件总线
// 订阅事件
const listenerId = on('dataUpdate', (data) => {
  console.log('Data updated:', data)
})

// 发布事件
emit('dataUpdate', { type: 'batch', id: 'xxx' })

// 一次性监听
EventManager.once('login', () => {
  console.log('User logged in')
})

// 取消订阅
EventManager.off('dataUpdate', listenerId)

// 创建独立的事件总线
const pageBus = EventManager.createEventBus()
pageBus.on('change', handler)
pageBus.emit('change', data)
```

---

## 🔄 Health页面专用模块

### 1. health-navigation-module
**路径**: `/miniprogram/pages/health/modules/health-navigation-module.ts`

专门为Health页面定制的导航管理，包含20+个页面跳转方法。

### 2. health-event-module
**路径**: `/miniprogram/pages/health/modules/health-event-module.ts`

Health页面的事件管理，包含页面级的防抖、节流功能。

### 3. health-batch-module
**路径**: `/miniprogram/pages/health/modules/health-batch-module.ts`

批次管理模块，处理批次列表、批次切换、数据过滤等。

### 4. health-analysis-module
**路径**: `/miniprogram/pages/health/modules/health-analysis-module.ts`

数据分析模块，提供各种统计计算、趋势分析、报告生成功能。

---

## 🎯 使用规范

### 导入规范
```typescript
// 通用模块
import NavigationManager from '@/modules/common/navigation-manager'
import EventManager from '@/modules/common/event-manager'

// 页面专用模块
import { HealthBatchManager } from './modules/health-batch-module'
import { HealthAnalysisManager } from './modules/health-analysis-module'
```

### 初始化规范
```typescript
// 在 app.ts 中初始化通用模块
App({
  onLaunch() {
    // 导航管理器已在模块内自动初始化
    // 如需添加自定义路由
    NavigationManager.registerRoute('custom-page', {
      name: 'custom-page',
      path: '/pages/custom/custom'
    })
  }
})

// 在页面中初始化
Page({
  onLoad() {
    // 设置事件管理
    const debouncedLoad = EventManager.debounce(this.loadData.bind(this), {
      delay: 300
    })
    
    // 订阅全局事件
    EventManager.on('userLogin', this.handleUserLogin, this)
  },
  
  onUnload() {
    // 清理事件监听
    EventManager.off('userLogin', this.handleUserLogin)
  }
})
```

### 最佳实践
1. **统一使用通用模块**：新页面优先使用通用模块，避免重复造轮子
2. **模块化拆分**：大型页面参考Health页面的模块化方案进行拆分
3. **事件管理**：使用事件总线解耦页面间通信
4. **性能优化**：合理使用防抖和节流，避免频繁操作

---

## 📊 模块依赖关系

```
通用模块层
├── navigation-manager.ts    # 导航管理
├── event-manager.ts         # 事件管理
└── data-manager.ts         # 数据管理（待创建）

页面模块层
├── health/modules/         # 健康页面模块
│   ├── health-navigation-module.ts
│   ├── health-event-module.ts
│   ├── health-batch-module.ts
│   └── health-analysis-module.ts
├── production/modules/     # 生产页面模块（待创建）
└── finance/modules/        # 财务页面模块（待创建）
```

---

## 🔧 模块扩展

### 添加新路由
```typescript
NavigationManager.registerRoute('new-page', {
  name: 'new-page',
  path: '/packageNew/new-page/new-page',
  package: 'packageNew',
  params: ['id', 'type']
})
```

### 创建页面专用模块
参考Health页面的模块化方案：
1. 分析页面功能，识别可拆分模块
2. 创建独立的模块文件
3. 提取相关逻辑到模块
4. 在页面中集成模块

---

## 📝 更新日志

### v1.0.0 (2024-11-20)
- 初始版本发布
- 创建 navigation-manager 通用导航模块
- 创建 event-manager 通用事件模块
- 完成 Health 页面4个专用模块

---

## 🚀 后续规划

1. **通用数据管理模块**：统一的数据请求、缓存、状态管理
2. **表单验证模块**：通用的表单验证规则和处理
3. **权限管理模块**：统一的权限检查和控制
4. **日志管理模块**：统一的日志记录和上报
