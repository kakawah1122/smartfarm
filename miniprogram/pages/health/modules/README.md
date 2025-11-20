# Health 页面模块使用指南

## 📁 模块列表

### ✅ 已完成模块

#### 1. health-navigation-module.ts
**功能**：统一管理所有页面导航逻辑

**使用方法**：
```typescript
// 在 health.ts 中引入
import { HealthNavigationManager } from './modules/health-navigation-module'

// 方式一：直接调用静态方法
viewDiagnosisHistory() {
  // 防重复点击
  const now = Date.now()
  if (now - this.lastClickTime < HealthNavigationManager.CLICK_INTERVAL) return
  this.lastClickTime = now
  
  // 调用导航方法
  HealthNavigationManager.navigateToDiagnosisHistory()
}

// 方式二：使用批量绑定（推荐）
onLoad() {
  // 批量绑定导航方法
  const navHandlers = HealthNavigationManager.createNavigationHandlers()
  
  // 选择性绑定需要的方法
  this.navigateToDiagnosisHistory = navHandlers.viewDiagnosisHistory
  this.navigateToTreatmentDetail = navHandlers.viewTreatmentRecord
  // ... 绑定其他需要的方法
}
```

**优点**：
- 集中管理所有导航逻辑
- 便于统一修改和维护
- 支持防重复点击
- 不影响原有功能

---

#### 2. health-data-loader-v2.ts
**功能**：数据加载和缓存管理

**使用方法**：
```typescript
import { HealthDataLoader } from './modules/health-data-loader-v2'

const dataLoader = new HealthDataLoader()

// 加载健康概览
const healthData = await dataLoader.loadHealthOverview({
  batchId: 'all',
  useCache: true
})
```

**状态**：已创建，待完全集成

---

### 🔄 进行中模块

#### 3. health-event-module.ts（计划中）
**功能**：事件管理和防抖处理

**预期功能**：
- 统一的事件处理
- 防抖和节流
- 事件监听管理

---

#### 4. health-chart-module.ts（计划中）
**功能**：图表配置和渲染

**预期功能**：
- 图表数据格式化
- 配置管理
- 更新机制

---

#### 5. health-batch-module.ts（计划中）
**功能**：批次管理

**预期功能**：
- 批次列表管理
- 批次切换
- 数据过滤

---

## 🛡️ 重要原则

1. **不改动UI**
   - 所有 WXML 文件保持不变
   - 所有 SCSS 文件保持不变
   - 只提取逻辑代码

2. **不破坏功能**
   - 每个功能必须正常工作
   - 保持原有的用户体验
   - 维持数据流程不变

3. **渐进式重构**
   - 一次只修改一个模块
   - 每次修改后立即测试
   - 发现问题立即回滚

4. **保持兼容性**
   - 新模块与旧代码并存
   - 逐步替换旧代码
   - 不影响其他页面

## 📝 集成步骤

### Step 1: 备份原文件
```bash
cp health.ts health.ts.backup
```

### Step 2: 引入模块
```typescript
// 在 health.ts 顶部添加
import { HealthNavigationManager } from './modules/health-navigation-module'
```

### Step 3: 替换原有方法
```typescript
// 原有方法
viewDiagnosisHistory() {
  const now = Date.now()
  if (now - this.lastClickTime < 500) return
  this.lastClickTime = now
  
  wx.navigateTo({
    url: `/packageAI/diagnosis-history/diagnosis-history`
  })
}

// 改为调用模块
viewDiagnosisHistory() {
  const now = Date.now()
  if (now - this.lastClickTime < 500) return
  this.lastClickTime = now
  
  HealthNavigationManager.navigateToDiagnosisHistory()
}
```

### Step 4: 测试验证
- 点击各个按钮确认跳转正常
- 检查页面参数传递正确
- 验证事件监听生效

## 📊 进度跟踪

| 模块 | 状态 | 完成度 | 备注 |
|------|------|--------|------|
| health-navigation-module | ✅ 完成 | 100% | 已创建，待集成 |
| health-data-loader-v2 | ✅ 完成 | 100% | 已创建，待优化 |
| health-event-module | 🔄 进行中 | 0% | 下一个任务 |
| health-chart-module | ⏳ 待开始 | 0% | - |
| health-batch-module | ⏳ 待开始 | 0% | - |

## ⚠️ 注意事项

1. **测试优先**
   - 每个改动后必须测试
   - 保留原有测试用例
   - 新增模块测试

2. **文档同步**
   - 修改代码同时更新文档
   - 记录所有改动
   - 说明使用方法

3. **版本控制**
   - 小步提交
   - 清晰的提交信息
   - 方便回滚

## 🚀 下一步

1. 完成 health-event-module.ts
2. 开始集成已完成的模块
3. 逐步测试和优化
