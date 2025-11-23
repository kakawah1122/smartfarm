# 云函数缓存优化方案设计

## 一、现状分析

### 1.1 当前缓存机制
- **RequestOptimizer**: 提供基础的内存缓存功能（5分钟）
- **CloudFunctionManager**: 特殊处理批次信息缓存（10分钟）
- **SafeCloudCall**: 提供安全的云函数调用包装

### 1.2 存在的问题
1. **缓存策略单一**：所有接口统一5分钟缓存，不符合业务特性
2. **缓存命中率低**：未根据数据更新频率制定缓存策略
3. **缓存管理困难**：缺少统一的缓存清理机制
4. **内存占用过大**：缺少缓存容量限制和LRU淘汰策略

## 二、优化方案

### 2.1 分级缓存策略

#### Level 1: 静态数据（24小时）
适用于几乎不变的数据：
- 用户权限信息
- 系统配置
- 养殖周期模板

#### Level 2: 低频更新数据（2小时）
适用于每天更新几次的数据：
- 批次列表
- 用户信息
- 物料分类

#### Level 3: 中频更新数据（30分钟）
适用于频繁查看但不常修改的数据：
- 健康统计
- 生产概况
- 财务汇总

#### Level 4: 高频更新数据（5分钟）
适用于实时性要求较高的数据：
- 任务列表
- 库存数量
- 价格信息

#### Level 5: 实时数据（不缓存）
适用于必须实时的数据：
- 交易记录创建
- 状态更新操作
- 删除操作

### 2.2 智能缓存管理

```typescript
interface CacheConfig {
  // 缓存级别
  level: 1 | 2 | 3 | 4 | 5
  // 自定义缓存时间（可选，优先级高于level）
  customTime?: number
  // 缓存键生成策略
  keyStrategy?: 'default' | 'user' | 'batch' | 'date'
  // 是否启用预加载
  preload?: boolean
  // 缓存更新策略
  updateStrategy?: 'lazy' | 'eager' | 'scheduled'
}
```

### 2.3 云函数缓存配置表

| 云函数 | Action | 缓存级别 | 缓存时间 | 键策略 | 说明 |
|--------|--------|----------|----------|--------|------|
| production-entry | getActiveBatches | 2 | 2小时 | user | 批次列表 |
| production-entry | getBatchDetail | 3 | 30分钟 | batch | 批次详情 |
| production-dashboard | getProductionOverview | 3 | 30分钟 | date | 生产概况 |
| health-management | get_health_overview | 3 | 30分钟 | batch | 健康概况 |
| health-management | get_prevention_tasks | 4 | 5分钟 | batch | 预防任务 |
| breeding-todo | getTodos | 4 | 5分钟 | batch+day | 每日任务 |
| finance-management | getCostBreakdown | 3 | 30分钟 | date | 成本分析 |
| finance-management | getFinanceOverview | 3 | 30分钟 | date | 财务概览 |
| material-management | getMaterialList | 2 | 2小时 | user | 物料列表 |
| material-management | getMaterialStock | 4 | 5分钟 | batch | 库存数量 |
| price-management | getLatestPrices | 4 | 5分钟 | - | 最新价格 |
| user-management | getUserInfo | 2 | 2小时 | user | 用户信息 |
| system-config | getConfig | 1 | 24小时 | - | 系统配置 |

### 2.4 缓存失效策略

#### 2.4.1 主动失效
```typescript
// 数据变更时主动清理相关缓存
class CacheInvalidator {
  // 入栏操作后清理
  static afterEntry() {
    this.clear(['production-entry', 'production-dashboard'])
  }
  
  // 出栏操作后清理
  static afterExit() {
    this.clear(['production-entry', 'production-dashboard', 'finance-management'])
  }
  
  // 健康记录变更后清理
  static afterHealthChange() {
    this.clear(['health-management'])
  }
}
```

#### 2.4.2 定时失效
- 每小时自动清理过期缓存
- 每天凌晨清理所有缓存（可选）

#### 2.4.3 容量控制
- 最大缓存条目：100
- 最大缓存大小：10MB
- 使用LRU算法淘汰

### 2.5 实现架构

```
┌─────────────────────────────────────────────┐
│             Application Layer                │
├─────────────────────────────────────────────┤
│          CloudApi (统一入口)                  │
├─────────────────────────────────────────────┤
│       CacheManager (缓存管理器)               │
│  ┌──────────┬──────────┬──────────┐        │
│  │MemCache  │StorageCache│IndexedDB│        │
│  └──────────┴──────────┴──────────┘        │
├─────────────────────────────────────────────┤
│     SafeCloudCall (安全调用层)                │
├─────────────────────────────────────────────┤
│      wx.cloud.callFunction                   │
└─────────────────────────────────────────────┘
```

## 三、实施计划

### 第一阶段：基础设施（2天）
1. 创建 `CacheManager` 类
2. 实现分级缓存配置
3. 集成到 `CloudApi`

### 第二阶段：核心模块（3天）
1. 生产管理模块缓存优化
2. 健康管理模块缓存优化
3. 财务管理模块缓存优化

### 第三阶段：辅助功能（2天）
1. 缓存监控面板
2. 缓存统计分析
3. 性能测试验证

## 四、预期效果

### 4.1 性能提升
- **云函数调用次数**：减少 60-70%
- **页面加载速度**：提升 40-50%
- **用户等待时间**：减少 30-40%

### 4.2 成本节约
- **云函数调用费用**：减少 60%
- **数据库读取次数**：减少 50%
- **带宽消耗**：减少 40%

### 4.3 用户体验
- 页面切换更流畅
- 数据加载更快速
- 离线使用部分功能

## 五、注意事项

### 5.1 数据一致性
- 关键操作（如金额、库存）不使用缓存
- 提供手动刷新功能
- 实时通知缓存更新

### 5.2 缓存降级
- 缓存异常时自动降级到直接调用
- 保证系统可用性
- 记录降级日志便于分析

### 5.3 监控告警
- 缓存命中率监控
- 缓存容量监控
- 性能指标监控

## 六、技术细节

### 6.1 缓存键生成
```typescript
function generateCacheKey(config: CloudFunctionConfig, strategy: string): string {
  const base = `${config.name}:${config.data.action}`
  
  switch(strategy) {
    case 'user':
      return `${base}:${getUserId()}`
    case 'batch':
      return `${base}:${config.data.batchId}`
    case 'date':
      return `${base}:${getCurrentDate()}`
    case 'batch+day':
      return `${base}:${config.data.batchId}:${config.data.dayAge}`
    default:
      return `${base}:${JSON.stringify(config.data)}`
  }
}
```

### 6.2 缓存存储选择
```typescript
class CacheStorage {
  // 内存缓存：快速，容量小
  private memoryCache = new Map()
  
  // Storage缓存：中速，容量中
  private storageCache = wx.getStorageSync
  
  // IndexedDB：慢速，容量大（可选）
  private indexedDB = null
  
  async get(key: string): Promise<any> {
    // 优先级：内存 > Storage > IndexedDB
    return this.memoryCache.get(key) || 
           this.storageCache(key) || 
           await this.indexedDB?.get(key)
  }
}
```

## 七、测试验证

### 7.1 功能测试
- [ ] 缓存正常存取
- [ ] 缓存过期清理
- [ ] 缓存失效更新
- [ ] 降级机制工作

### 7.2 性能测试
- [ ] 页面加载时间对比
- [ ] 云函数调用次数统计
- [ ] 内存占用监控
- [ ] 缓存命中率分析

### 7.3 兼容性测试
- [ ] iOS设备测试
- [ ] Android设备测试
- [ ] 不同网络环境
- [ ] 离线场景测试
