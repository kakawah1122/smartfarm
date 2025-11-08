# AI财务分析组件使用指南

## 组件简介

AI财务分析组件用于对狮头鹅养殖的财务数据进行智能分析，提供专业的财务建议和生产指导。

## 性能优化说明

为了减少云函数调用次数、提升性能和用户体验，组件采用了以下优化策略：

### 1. **Props优先策略**
组件优先使用父组件传入的数据，避免重复调用云函数。

### 2. **本地缓存**
- 天气数据：缓存30分钟
- 鹅价数据：优先从全局状态获取

### 3. **按需加载**
只有当Props和缓存都没有数据时，才会调用云函数（降级方案）。

## 组件属性

| 属性名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| financeData | Object | 是 | null | 财务数据 |
| dateRange | Object | 否 | null | 时间范围 |
| productionData | Object | 否 | null | 生产数据（可选，传入可避免云函数调用） |
| healthData | Object | 否 | null | 健康数据（可选） |
| weatherData | Object | 否 | null | 天气数据（可选） |
| goosePriceData | Object | 否 | null | 鹅价数据（可选） |

## 基础用法

### 最简用法（仅传入财务数据）

```xml
<ai-finance-analysis
  finance-data="{{rawFinanceData}}"
  date-range="{{rawFinanceData.dateRange}}"
  bind:analysisComplete="onAnalysisComplete"
  bind:analysisError="onAnalysisError"
/>
```

**说明**：组件会自动从云函数获取其他数据（生产、健康、天气、鹅价）。

### 推荐用法（传入已有数据，性能最优）

如果父组件已经加载了相关数据，**强烈建议**通过Props传入，避免重复调用：

```xml
<ai-finance-analysis
  finance-data="{{rawFinanceData}}"
  date-range="{{rawFinanceData.dateRange}}"
  production-data="{{productionData}}"
  health-data="{{healthData}}"
  weather-data="{{weatherData}}"
  goose-price-data="{{goosePriceData}}"
  bind:analysisComplete="onAnalysisComplete"
  bind:analysisError="onAnalysisError"
/>
```

## 父组件示例

### 场景1：从其他页面传递数据

```typescript
// finance.ts
Page({
  data: {
    rawFinanceData: null,
    productionData: null,
    healthData: null,
    // ...
  },
  
  onLoad(options) {
    // 如果从生产管理页面跳转来，可能带有生产数据
    if (options.productionData) {
      try {
        this.setData({
          productionData: JSON.parse(options.productionData)
        })
      } catch (e) {
        console.error('解析生产数据失败', e)
      }
    }
    
    // 加载财务数据
    this.loadFinanceData()
  },
  
  async loadFinanceData() {
    // 加载财务数据...
  }
})
```

### 场景2：按需加载并传递

```typescript
// finance.ts
Page({
  data: {
    rawFinanceData: null,
    productionData: null,
  },
  
  async onLoad() {
    // 并行加载财务和生产数据
    const [financeData, productionData] = await Promise.all([
      this.loadFinanceData(),
      this.loadProductionData()
    ])
    
    this.setData({
      rawFinanceData: financeData,
      productionData: productionData
    })
  },
  
  async loadProductionData() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'production-dashboard',
        data: { action: 'overview' }
      })
      if (res.result && res.result.success) {
        return res.result.data
      }
    } catch (error) {
      console.error('加载生产数据失败', error)
    }
    return null
  }
})
```

### 场景3：使用全局状态（推荐）

```typescript
// app.ts
App<IAppOption>({
  globalData: {
    goosePrice: null,  // 鹅价数据（首页加载后共享）
    weatherData: null, // 天气数据（可共享）
  },
  
  onLaunch() {
    // 首页加载时获取鹅价
    this.loadGoosePrice()
  },
  
  async loadGoosePrice() {
    // 从云函数或API获取鹅价
    const price = await this.fetchGoosePrice()
    this.globalData.goosePrice = price
    
    // 同时缓存到storage
    wx.setStorageSync('goose_price_cache', {
      data: price,
      timestamp: Date.now()
    })
  }
})
```

```typescript
// finance.ts
Page({
  data: {
    goosePriceData: null,
  },
  
  onShow() {
    // 从全局状态获取鹅价
    const app = getApp<IAppOption>()
    if (app.globalData.goosePrice) {
      this.setData({
        goosePriceData: app.globalData.goosePrice
      })
    }
  }
})
```

## 性能对比

### 优化前（每次都调用云函数）
```
数据收集时间：5-10秒
云函数调用：4次（生产、健康、天气、鹅价）
总分析时间：25-35秒
```

### 优化后（传入Props）
```
数据收集时间：<100ms（直接使用Props）
云函数调用：0次
总分析时间：15-20秒（仅AI模型处理时间）
性能提升：40-60%
云函数费用节省：100%（该组件不调用）
```

### 优化后（使用缓存）
```
数据收集时间：<1秒（缓存命中）
云函数调用：0-2次（仅首次或缓存过期）
总分析时间：16-22秒
性能提升：30-50%
云函数费用节省：50-100%
```

## 数据格式

### productionData 格式
```typescript
{
  entry: {
    total: number,          // 累计入栏
    stockQuantity: number   // 当前存栏
  },
  exit: {
    total: number,          // 累计出栏
    batches: number,        // 出栏批次
    avgWeight: number,      // 平均重量
    totalRevenue: number    // 出栏收入
  }
}
```

### healthData 格式
```typescript
{
  recentDeaths: Array<{
    deathCount: number,
    deathReason: string,
    deathDate: string
  }>,
  totalDeaths: number
}
```

### weatherData 格式
```typescript
{
  current: {
    temperature: number,
    feelsLike: number,
    humidity: number,
    windDirection: string,
    windScale: string
  },
  condition: {
    text: string
  }
}
```

### goosePriceData 格式
```typescript
{
  adult: number,      // 成鹅价格（元/斤）
  gosling: number,    // 鹅苗价格（元/只）
  egg: number,        // 鹅蛋价格（元/个）
  trend: string,      // 趋势描述
  adultTrend: number  // 成鹅价格涨跌（元）
}
```

## 最佳实践

### ✅ 推荐做法

1. **在页面级加载数据**，通过Props传递给组件
2. **使用全局状态共享**鹅价等通用数据
3. **利用本地缓存**减少重复请求
4. **页面间传递数据**，避免重复加载

### ❌ 避免做法

1. 不传入任何Props，完全依赖组件内部加载（性能最差）
2. 在多个组件中重复调用相同的云函数
3. 不使用缓存，每次都实时请求
4. 忽略全局状态，每个页面独立加载

## 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| analysisComplete | { detail: { result } } | 分析完成 |
| analysisError | { detail: { error } } | 分析失败 |

## 示例代码库

完整示例代码请参考：
- `miniprogram/packageFinance/finance/finance.ts`
- `miniprogram/packageFinance/finance/finance.wxml`

