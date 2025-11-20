# 前端云函数调用迁移指南

## 需要修改的文件清单

### 1. health-data-manager.ts（4处）
- `getDashboardSnapshot` - 使用 health-overview
- `getPreventionDashboard` - 使用 health-prevention  
- `getTreatmentCost` - 使用 health-cost
- `getAbnormalRecords` - 保持 health-management

### 2. health-data-service.ts（2处）
- `get_dashboard_snapshot` - 使用 health-overview
- `get_batch_complete_data` - 保持 health-management

### 3. treatment-data-service.ts（所有保持 health-management）
- 治疗记录相关功能暂未拆分

### 4. treatment-record.ts（大量调用）
- 大部分保持 health-management
- 只有异常记录相关的需要修改

## 修改方法

### 方法1：使用新的路由工具（推荐）

```typescript
// 旧代码
import { safeCloudCall } from '../../utils/safe-cloud-call'

const result = await safeCloudCall({
  name: 'health-management',
  data: {
    action: 'calculate_health_rate'
  }
})

// 新代码
import { callHealthFunction } from '../../utils/health-cloud-router'

const result = await callHealthFunction({
  action: 'calculate_health_rate'
})
```

### 方法2：直接指定云函数名

```typescript
// 如果知道具体的云函数名
const result = await safeCloudCall({
  name: 'health-cost',  // 直接调用新云函数
  data: {
    action: 'calculate_health_rate'
  }
})
```

## 优先修改的文件（高频调用）

1. **health-data-manager.ts** - 数据管理核心
2. **health-data-service.ts** - 数据服务层

这两个文件修改后，大部分功能就能使用新云函数了。

## 测试验证

修改后运行测试脚本：
```javascript
testAllModules()
```

确保所有功能正常工作。
