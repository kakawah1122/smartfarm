# 微信小程序云开发最佳实践指南

> **适用于**：鹅数通小程序项目  
> **更新时间**：2025-10-30  
> **版本**：v2.0

---

## 📋 目录

1. [云函数开发规范](#云函数开发规范)
2. [数据库操作最佳实践](#数据库操作最佳实践)
3. [性能优化指南](#性能优化指南)
4. [安全性最佳实践](#安全性最佳实践)
5. [错误处理与日志](#错误处理与日志)
6. [代码示例](#代码示例)

---

## 云函数开发规范

### 1.1 函数结构设计

#### ✅ 推荐做法

```javascript
// 使用 action 参数进行路由分发
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      case 'getData':
        return await getData(event, wxContext)
      case 'updateData':
        return await updateData(event, wxContext)
      default:
        return {
          success: false,
          errorCode: 'INVALID_ACTION',
          message: `未知操作: ${action}`
        }
    }
  } catch (error) {
    console.error('[云函数错误]', { action, error: error.message })
    return {
      success: false,
      errorCode: error.code || 'UNKNOWN_ERROR',
      message: error.message
    }
  }
}
```

#### ❌ 不推荐做法

```javascript
// 不要在 exports.main 中写所有业务逻辑
exports.main = async (event, context) => {
  // 几百行代码堆在一起...
  const result = await db.collection('xxx').get()
  // 更多业务逻辑...
}
```

### 1.2 参数验证

#### ✅ 推荐做法

```javascript
async function getData(event, wxContext) {
  const { userId, batchId } = event
  
  // 1. 参数验证
  if (!userId) {
    return {
      success: false,
      errorCode: 'INVALID_PARAMS',
      message: '用户ID不能为空'
    }
  }
  
  if (!batchId) {
    return {
      success: false,
      errorCode: 'INVALID_PARAMS',
      message: '批次ID不能为空'
    }
  }
  
  // 2. 执行业务逻辑
  // ...
}
```

#### ❌ 不推荐做法

```javascript
// 不验证参数直接使用
async function getData(event, wxContext) {
  const result = await db.collection('users').doc(event.userId).get()
  // 如果 userId 为空，会导致查询错误
}
```

### 1.3 返回值规范

#### ✅ 推荐的统一返回格式

```javascript
// 成功响应
{
  success: true,
  data: {
    // 业务数据
  },
  _performance: {
    totalTime: 150,  // 毫秒
    timestamp: '2025-10-30T12:00:00.000Z'
  }
}

// 失败响应
{
  success: false,
  errorCode: 'PERMISSION_DENIED',  // 错误代码
  message: '权限不足',              // 用户友好的错误消息
  error: 'detailed error message',  // 详细错误（可选）
  _performance: {
    totalTime: 50,
    timestamp: '2025-10-30T12:00:00.000Z'
  }
}
```

#### 常用错误码定义

```javascript
const ERROR_CODES = {
  // 参数错误
  INVALID_PARAMS: 'INVALID_PARAMS',
  
  // 权限错误
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // 资源错误
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // 业务错误
  TASK_COMPLETED: 'TASK_COMPLETED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  
  // 系统错误
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}
```

---

## 数据库操作最佳实践

### 2.1 查询优化

#### ✅ 使用 limit 限制返回数量

```javascript
// 始终添加 limit，避免一次性返回大量数据
const result = await db.collection('health_records')
  .where({ batchId: 'xxx' })
  .orderBy('date', 'desc')
  .limit(50)  // ✅ 限制返回数量
  .get()
```

#### ✅ 使用 field 只返回需要的字段

```javascript
// 只返回必要字段，减少数据传输量
const result = await db.collection('users')
  .where({ _openid: openid })
  .field({
    nickName: true,
    farmName: true,
    position: true
    // 不返回其他不需要的字段
  })
  .limit(1)
  .get()
```

#### ❌ 不推荐做法

```javascript
// 不加 limit，可能返回数千条记录
const result = await db.collection('health_records')
  .where({ batchId: 'xxx' })
  .get()  // ❌ 可能导致性能问题

// 返回所有字段（包括大文本、图片等）
const result = await db.collection('users')
  .where({ _openid: openid })
  .get()  // ❌ 浪费带宽
```

### 2.2 索引使用

#### 必须创建索引的场景

1. **where 查询的字段**
2. **orderBy 排序的字段**
3. **复合查询的字段组合**

#### 索引创建示例

```javascript
// 查询语句
db.collection('task_batch_schedules')
  .where({
    category: 'health',
    completed: false
  })
  .orderBy('targetDate', 'asc')
  .get()

// 需要创建的复合索引：
// category_1_completed_1_targetDate_1
// 字段顺序必须与查询条件一致
```

#### 📊 索引性能对比

| 场景 | 数据量 | 无索引耗时 | 有索引耗时 | 提升 |
|------|--------|-----------|-----------|------|
| 单字段查询 | 1000条 | 200ms | 15ms | 93% ↑ |
| 复合查询 | 5000条 | 800ms | 25ms | 97% ↑ |
| 排序查询 | 2000条 | 500ms | 20ms | 96% ↑ |

> **详细索引配置**：参见 [`docs/database/prevention-indexes.md`](../database/prevention-indexes.md)

### 2.3 聚合查询优化

#### ✅ 使用 aggregate 代替多次查询

```javascript
// ✅ 推荐：使用聚合查询一次性计算统计数据
const statsResult = await db.collection('health_prevention_records')
  .aggregate()
  .match({
    isDeleted: _.neq(true),
    batchId: batchId
  })
  .group({
    _id: null,
    vaccineCount: _.sum(
      _.cond([
        [_.eq(['$preventionType', 'vaccine']), 1],
        [true, 0]
      ])
    ),
    totalCost: _.sum('$costInfo.totalCost'),
    vaccineCoverage: _.sum('$vaccineInfo.count')
  })
  .end()

// 性能：1次查询，约30-50ms
```

#### ❌ 不推荐做法

```javascript
// ❌ 多次查询 + 内存计算
const allRecords = await db.collection('health_prevention_records')
  .where({ isDeleted: _.neq(true) })
  .get()

const vaccineCount = allRecords.data.filter(r => r.preventionType === 'vaccine').length
const totalCost = allRecords.data.reduce((sum, r) => sum + (r.costInfo?.totalCost || 0), 0)

// 性能：1次查询 + 内存遍历，约200-500ms（数据量大时更慢）
```

### 2.4 并发查询

#### ✅ 使用 Promise.all 并发执行独立查询

```javascript
// ✅ 并发执行多个独立查询
const [tasksResult, recordsResult, batchesResult] = await Promise.all([
  db.collection('tasks').where({ completed: false }).limit(50).get(),
  db.collection('records').orderBy('date', 'desc').limit(10).get(),
  db.collection('batches').where({ status: 'active' }).limit(100).get()
])

// 性能：3个查询并发执行，总耗时 ≈ max(query1, query2, query3)
```

#### ❌ 不推荐做法

```javascript
// ❌ 串行执行查询
const tasksResult = await db.collection('tasks').get()
const recordsResult = await db.collection('records').get()  
const batchesResult = await db.collection('batches').get()

// 性能：总耗时 = query1 + query2 + query3（慢3倍）
```

---

## 性能优化指南

### 3.1 云函数性能监控

#### ✅ 添加性能日志

```javascript
async function getPreventionDashboard(event, wxContext) {
  const startTime = Date.now()
  const logContext = { action: 'getPreventionDashboard', openid: wxContext.OPENID }
  
  try {
    console.log('[预防管理] 开始查询', logContext)
    
    // 业务逻辑
    const queryStartTime = Date.now()
    const results = await Promise.all([...])
    console.log(`[预防管理] 查询完成，耗时: ${Date.now() - queryStartTime}ms`, logContext)
    
    // 返回结果
    const totalTime = Date.now() - startTime
    console.log(`[预防管理] 操作成功，总耗时: ${totalTime}ms`, logContext)
    
    return {
      success: true,
      data: { ... },
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error('[预防管理] 操作失败', {
      ...logContext,
      error: error.message,
      totalTime
    })
    // ...
  }
}
```

### 3.2 缓存策略

#### 小程序端缓存

```javascript
// ✅ 使用本地缓存减少云函数调用
async loadPreventionData() {
  try {
    // 1. 尝试从缓存加载
    const cacheKey = `prevention_data_${this.data.currentBatchId}`
    const cachedData = wx.getStorageSync(cacheKey)
    
    if (cachedData && this.isCacheValid(cachedData.timestamp)) {
      console.log('使用缓存数据')
      this.setData({ preventionData: cachedData.data })
      return
    }
    
    // 2. 缓存失效，调用云函数
    const result = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'getPreventionDashboard',
        batchId: this.data.currentBatchId
      }
    })
    
    if (result.result.success) {
      // 3. 更新缓存
      wx.setStorageSync(cacheKey, {
        data: result.result.data,
        timestamp: Date.now()
      })
      
      this.setData({ preventionData: result.result.data })
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  }
},

// 缓存有效期判断（5分钟）
isCacheValid(timestamp) {
  return Date.now() - timestamp < 5 * 60 * 1000
}
```

### 3.3 数据量限制

#### 推荐的 limit 值

| 场景 | 推荐 limit | 说明 |
|------|-----------|------|
| 列表展示 | 20-50 | 用户可见的列表数据 |
| 下拉刷新 | 10-20 | 最新数据 |
| 统计查询 | 100-500 | 用于计算的数据 |
| 批次信息 | 100 | 通常不会超过100个在栏批次 |
| 用户角色 | 10 | 用户角色数量有限 |

---

## 安全性最佳实践

### 4.1 权限验证

#### ✅ 所有云函数都应进行权限验证

```javascript
async function getPreventionDashboard(event, wxContext) {
  const openid = wxContext.OPENID
  
  // ========== 1. 权限验证 ==========
  const hasPermission = await checkPermission(openid, 'health', 'view', event.batchId)
  if (!hasPermission) {
    console.warn('[权限验证] 权限不足', { openid, action: 'view' })
    return {
      success: false,
      errorCode: 'PERMISSION_DENIED',
      message: '您没有查看预防管理数据的权限'
    }
  }
  
  // ========== 2. 业务逻辑 ==========
  // ...
}

// 权限验证辅助函数
async function checkPermission(openid, module, action, resourceId = null) {
  try {
    // 1. 获取用户角色
    const userRolesResult = await db.collection('user_roles')
      .where({
        openid,
        isActive: true,
        $or: [
          { expiryTime: _.eq(null) },
          { expiryTime: _.gt(new Date()) }
        ]
      })
      .limit(10)
      .get()
    
    if (!userRolesResult.data || userRolesResult.data.length === 0) {
      return false
    }
    
    // 2. 检查角色权限
    for (const userRole of userRolesResult.data) {
      const roleResult = await db.collection('sys_roles')
        .where({ roleCode: userRole.roleCode, isActive: true })
        .limit(1)
        .get()
      
      if (!roleResult.data || roleResult.data.length === 0) continue
      
      const role = roleResult.data[0]
      const permissions = role.permissions || []
      
      const modulePermission = permissions.find(p => 
        p.module === module || p.module === '*'
      )
      
      if (modulePermission && 
          (modulePermission.actions.includes(action) || 
           modulePermission.actions.includes('*'))) {
        return true
      }
    }
    
    return false
  } catch (error) {
    console.error('[权限验证] 验证失败', { openid, module, action, error: error.message })
    return false  // 验证失败默认拒绝
  }
}
```

### 4.2 数据验证

#### ✅ 验证所有用户输入

```javascript
async function completePreventionTask(event, wxContext) {
  const { taskId, batchId, preventionData } = event
  
  // 1. 参数完整性验证
  if (!taskId || !batchId || !preventionData) {
    return {
      success: false,
      errorCode: 'INVALID_PARAMS',
      message: '参数不完整'
    }
  }
  
  // 2. 数据格式验证
  if (preventionData.costInfo) {
    if (typeof preventionData.costInfo.totalCost !== 'number' || 
        preventionData.costInfo.totalCost < 0) {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '成本金额格式不正确'
      }
    }
  }
  
  // 3. 业务规则验证
  if (preventionData.preventionType === 'vaccine' && !preventionData.vaccineInfo) {
    return {
      success: false,
      errorCode: 'INVALID_PARAMS',
      message: '疫苗信息不能为空'
    }
  }
  
  // 业务逻辑...
}
```

### 4.3 敏感数据处理

#### ✅ 不要在日志中输出敏感信息

```javascript
// ✅ 推荐
console.log('[用户登录]', { 
  openid: openid.substring(0, 8) + '****',  // 部分隐藏
  action: 'login'
})

// ❌ 不推荐
console.log('[用户登录]', { 
  openid: openid,  // 完整输出敏感信息
  password: password  // ❌ 绝对不要记录密码
})
```

---

## 错误处理与日志

### 5.1 结构化日志

#### ✅ 推荐的日志格式

```javascript
// 使用统一的日志前缀和结构化数据
console.log('[模块名称] 操作描述', {
  action: 'functionName',
  openid: 'xxx',
  param1: 'value1',
  param2: 'value2'
})

// 错误日志包含堆栈信息
console.error('[模块名称] 操作失败', {
  action: 'functionName',
  openid: 'xxx',
  error: error.message,
  stack: error.stack,
  context: { ... }
})
```

### 5.2 错误分类处理

```javascript
async function completePreventionTask(event, wxContext) {
  try {
    // 业务逻辑
  } catch (error) {
    console.error('[预防任务] 完成任务失败', {
      error: error.message,
      stack: error.stack
    })
    
    // 根据错误类型返回不同的错误码和消息
    let errorCode = 'UNKNOWN_ERROR'
    let message = '操作失败，请稍后重试'
    
    if (error.message.includes('权限')) {
      errorCode = 'PERMISSION_DENIED'
      message = '权限不足，无法完成任务'
    } else if (error.message.includes('网络')) {
      errorCode = 'NETWORK_ERROR'
      message = '网络连接失败，请检查网络后重试'
    } else if (error.message.includes('数据库')) {
      errorCode = 'DATABASE_ERROR'
      message = '数据库操作失败，请稍后重试'
    }
    
    return {
      success: false,
      errorCode,
      message,
      error: error.message
    }
  }
}
```

### 5.3 审计日志

#### ✅ 重要操作需要记录审计日志

```javascript
// 完成任务后记录审计日志
try {
  await dbManager.createAuditLog(
    openid,
    'complete_prevention_task',
    COLLECTIONS.HEALTH_PREVENTION_RECORDS,
    recordResult._id,
    {
      taskId,
      batchId,
      preventionType: preventionData.preventionType,
      cost: preventionData.costInfo?.totalCost || 0,
      result: 'success'
    }
  )
} catch (auditError) {
  // 审计日志失败不影响主流程
  console.error('[审计日志] 创建失败', { 
    error: auditError.message 
  })
}
```

---

## 代码示例

### 6.1 完整的云函数示例

参见 `cloudfunctions/health-management/index.js` 中的以下函数：

1. **`getPreventionDashboard`**
   - ✅ 权限验证
   - ✅ 并发查询
   - ✅ 聚合统计
   - ✅ 性能日志
   - ✅ 错误处理

2. **`completePreventionTask`**
   - ✅ 参数验证
   - ✅ 权限验证
   - ✅ 事务处理
   - ✅ 多模块联动
   - ✅ 审计日志

### 6.2 小程序端调用示例

```typescript
// health.ts
async loadPreventionData() {
  try {
    wx.showLoading({ title: '加载中...' })
    
    const result = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'getPreventionDashboard',
        batchId: this.data.currentBatchId || 'all'
      }
    })
    
    const response = result.result as any
    
    if (response.success && response.data) {
      this.setData({
        'preventionData.todayTasks': response.data.todayTasks || [],
        'preventionData.upcomingTasks': response.data.upcomingTasks || [],
        'preventionData.stats': response.data.stats || {},
        'preventionData.recentRecords': response.data.recentRecords || []
      })
      
      // 可选：显示性能信息（开发环境）
      if (response._performance) {
        console.log('数据加载耗时:', response._performance.totalTime, 'ms')
      }
    } else {
      wx.showToast({
        title: response.message || '加载失败',
        icon: 'none'
      })
    }
  } catch (error: any) {
    console.error('加载预防管理数据失败:', error)
    wx.showToast({
      title: '加载失败，请重试',
      icon: 'none'
    })
  } finally {
    wx.hideLoading()
  }
}
```

---

## 📚 相关文档

- [数据库索引配置指南](../database/prevention-indexes.md)
- [数据库配置总指南](../../DATABASE_CONFIG_GUIDE.md)
- [数据库索引总指南](../../DATABASE_INDEX_GUIDE.md)
- [性能优化总结](../../OPTIMIZATION_SUMMARY.md)

---

## ✅ 检查清单

在提交代码前，请确认以下事项：

- [ ] 所有云函数都有权限验证
- [ ] 所有数据库查询都添加了 `limit`
- [ ] 复杂查询使用了聚合管道
- [ ] 独立查询使用了 `Promise.all` 并发执行
- [ ] 添加了性能监控日志
- [ ] 错误处理完善，返回用户友好的错误消息
- [ ] 重要操作记录了审计日志
- [ ] 敏感信息不在日志中输出
- [ ] 创建了必要的数据库索引
- [ ] 代码符合项目规范

---

**维护者**：鹅数通开发团队  
**最后更新**：2025-10-30

