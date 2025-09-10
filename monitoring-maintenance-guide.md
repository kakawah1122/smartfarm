# 鹅场管理系统监控和维护指南

## 概述
本文档详细说明了鹅场管理系统的监控策略、维护流程、故障排除方法和性能优化建议，确保系统的稳定运行和持续改进。

## 目录
1. [系统监控策略](#系统监控策略)
2. [性能监控指标](#性能监控指标)
3. [日志管理](#日志管理)
4. [健康检查](#健康检查)
5. [告警配置](#告警配置)
6. [日常维护流程](#日常维护流程)
7. [故障排除指南](#故障排除指南)
8. [性能优化](#性能优化)
9. [安全维护](#安全维护)
10. [数据维护](#数据维护)
11. [监控工具配置](#监控工具配置)
12. [维护计划表](#维护计划表)

## 系统监控策略

### 1. 监控层级架构

#### 应用层监控
```
应用层监控
├── 小程序性能监控
│   ├── 页面加载时间
│   ├── 接口响应时间
│   ├── 用户操作流畅度
│   └── 崩溃率统计
├── 云函数监控
│   ├── 执行时间监控
│   ├── 内存使用监控
│   ├── 错误率统计
│   └── 并发数监控
└── 业务逻辑监控
    ├── 关键业务流程
    ├── 数据一致性检查
    ├── 权限验证监控
    └── 业务异常统计
```

#### 基础设施监控
```
基础设施监控
├── 云数据库监控
│   ├── 连接数监控
│   ├── 查询性能监控
│   ├── 存储使用监控
│   └── 读写操作监控
├── 云存储监控
│   ├── 存储空间使用
│   ├── 文件操作统计
│   ├── 带宽使用监控
│   └── CDN性能监控
└── 云函数资源监控
    ├── CPU使用率
    ├── 内存使用率
    ├── 网络IO监控
    └── 磁盘IO监控
```

### 2. 监控云函数实现

#### cloudfunctions/system-monitoring/index.js
```javascript
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { action, period = '1h', metrics = [] } = event
  
  try {
    switch (action) {
      case 'collect_metrics':
        return await collectSystemMetrics()
      case 'health_check':
        return await performHealthCheck()
      case 'performance_report':
        return await generatePerformanceReport(period)
      case 'alert_check':
        return await checkAlerts()
      case 'cleanup_logs':
        return await cleanupLogs()
      default:
        throw new Error('无效的监控操作')
    }
  } catch (error) {
    console.error('监控操作失败：', error)
    return {
      success: false,
      error: error.message,
      timestamp: new Date()
    }
  }
}

// 收集系统指标
async function collectSystemMetrics() {
  const metrics = {
    timestamp: new Date(),
    database: await collectDatabaseMetrics(),
    storage: await collectStorageMetrics(),
    functions: await collectFunctionMetrics(),
    users: await collectUserMetrics(),
    business: await collectBusinessMetrics()
  }
  
  // 保存指标数据
  await db.collection('system_metrics').add({
    data: metrics
  })
  
  return {
    success: true,
    metrics,
    message: '系统指标收集完成'
  }
}

// 数据库指标收集
async function collectDatabaseMetrics() {
  const collections = [
    'production_batches',
    'health_records',
    'finance_income',
    'users',
    'user_roles'
  ]
  
  const metrics = {
    totalCollections: collections.length,
    collectionStats: {}
  }
  
  for (const collection of collections) {
    try {
      const countResult = await db.collection(collection).count()
      const recentCount = await db.collection(collection)
        .where({
          createTime: db.command.gte(new Date(Date.now() - 24 * 60 * 60 * 1000))
        })
        .count()
      
      metrics.collectionStats[collection] = {
        totalRecords: countResult.total,
        recentRecords: recentCount.total,
        status: 'healthy'
      }
    } catch (error) {
      metrics.collectionStats[collection] = {
        totalRecords: 0,
        recentRecords: 0,
        status: 'error',
        error: error.message
      }
    }
  }
  
  return metrics
}

// 存储指标收集
async function collectStorageMetrics() {
  try {
    // 获取存储使用情况（模拟数据，实际需要调用微信云开发API）
    const storageInfo = {
      totalSpace: 5 * 1024 * 1024 * 1024, // 5GB
      usedSpace: 0, // 需要实际API获取
      fileCount: 0,
      recentUploads: 0
    }
    
    // 统计最近24小时的文件上传
    const recentUploads = await db.collection('file_uploads')
      .where({
        uploadTime: db.command.gte(new Date(Date.now() - 24 * 60 * 60 * 1000))
      })
      .count()
    
    storageInfo.recentUploads = recentUploads.total
    
    // 计算存储使用率
    const usageRate = (storageInfo.usedSpace / storageInfo.totalSpace) * 100
    
    return {
      ...storageInfo,
      usageRate: Math.round(usageRate * 100) / 100,
      status: usageRate > 90 ? 'critical' : usageRate > 80 ? 'warning' : 'healthy'
    }
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    }
  }
}

// 云函数指标收集
async function collectFunctionMetrics() {
  const functions = [
    'health-management',
    'production-management',
    'finance-management',
    'user-management',
    'permission-check'
  ]
  
  const metrics = {
    totalFunctions: functions.length,
    functionStats: {}
  }
  
  // 统计函数调用次数和错误率
  for (const func of functions) {
    try {
      // 统计最近24小时的调用次数（从系统日志中获取）
      const callCount = await db.collection('system_logs')
        .where({
          source: func,
          timestamp: db.command.gte(new Date(Date.now() - 24 * 60 * 60 * 1000))
        })
        .count()
      
      const errorCount = await db.collection('system_logs')
        .where({
          source: func,
          level: 'error',
          timestamp: db.command.gte(new Date(Date.now() - 24 * 60 * 60 * 1000))
        })
        .count()
      
      const errorRate = callCount.total > 0 ? (errorCount.total / callCount.total) * 100 : 0
      
      metrics.functionStats[func] = {
        callCount: callCount.total,
        errorCount: errorCount.total,
        errorRate: Math.round(errorRate * 100) / 100,
        status: errorRate > 10 ? 'critical' : errorRate > 5 ? 'warning' : 'healthy'
      }
    } catch (error) {
      metrics.functionStats[func] = {
        callCount: 0,
        errorCount: 0,
        errorRate: 0,
        status: 'unknown',
        error: error.message
      }
    }
  }
  
  return metrics
}

// 用户指标收集
async function collectUserMetrics() {
  try {
    const totalUsers = await db.collection('users').count()
    
    const activeUsers = await db.collection('user_sessions')
      .where({
        lastActivity: db.command.gte(new Date(Date.now() - 24 * 60 * 60 * 1000))
      })
      .count()
    
    const newUsers = await db.collection('users')
      .where({
        createTime: db.command.gte(new Date(Date.now() - 24 * 60 * 60 * 1000))
      })
      .count()
    
    return {
      totalUsers: totalUsers.total,
      activeUsers: activeUsers.total,
      newUsers: newUsers.total,
      activityRate: totalUsers.total > 0 ? 
        Math.round((activeUsers.total / totalUsers.total) * 100 * 100) / 100 : 0,
      status: 'healthy'
    }
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    }
  }
}

// 业务指标收集
async function collectBusinessMetrics() {
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    
    // 生产指标
    const todayBatches = await db.collection('production_batches')
      .where({
        createTime: db.command.gte(startOfDay)
      })
      .count()
    
    const todayEntries = await db.collection('production_entry_records')
      .where({
        entryDate: db.command.gte(startOfDay)
      })
      .count()
    
    const todayExits = await db.collection('production_exit_records')
      .where({
        exitDate: db.command.gte(startOfDay)
      })
      .count()
    
    // 健康指标
    const todayHealthRecords = await db.collection('health_records')
      .where({
        checkDate: db.command.gte(startOfDay)
      })
      .count()
    
    const todayDiagnosis = await db.collection('ai_diagnosis_records')
      .where({
        diagnosisDate: db.command.gte(startOfDay)
      })
      .count()
    
    // 财务指标
    const todayIncome = await db.collection('finance_income')
      .where({
        date: db.command.gte(startOfDay)
      })
      .count()
    
    const todayExpense = await db.collection('finance_expense')
      .where({
        date: db.command.gte(startOfDay)
      })
      .count()
    
    return {
      production: {
        newBatches: todayBatches.total,
        entryRecords: todayEntries.total,
        exitRecords: todayExits.total
      },
      health: {
        healthRecords: todayHealthRecords.total,
        aiDiagnosis: todayDiagnosis.total
      },
      finance: {
        incomeRecords: todayIncome.total,
        expenseRecords: todayExpense.total
      },
      status: 'healthy'
    }
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    }
  }
}

// 系统健康检查
async function performHealthCheck() {
  const healthCheck = {
    timestamp: new Date(),
    overall: 'healthy',
    services: {}
  }
  
  // 检查数据库连接
  try {
    await db.collection('system_configs').limit(1).get()
    healthCheck.services.database = {
      status: 'healthy',
      responseTime: Date.now() // 实际应该测量响应时间
    }
  } catch (error) {
    healthCheck.services.database = {
      status: 'unhealthy',
      error: error.message
    }
    healthCheck.overall = 'unhealthy'
  }
  
  // 检查权限系统
  try {
    const result = await cloud.callFunction({
      name: 'permission-check',
      data: {
        action: 'read',
        module: 'system_management'
      }
    })
    
    healthCheck.services.permission = {
      status: result.result.success ? 'healthy' : 'unhealthy',
      responseTime: Date.now()
    }
  } catch (error) {
    healthCheck.services.permission = {
      status: 'unhealthy',
      error: error.message
    }
    healthCheck.overall = 'unhealthy'
  }
  
  // 检查AI诊断服务
  try {
    // 简单的AI服务连通性检查
    const testResult = await cloud.callFunction({
      name: 'ai-diagnosis',
      data: {
        action: 'health_check'
      }
    })
    
    healthCheck.services.aiDiagnosis = {
      status: testResult.result.success ? 'healthy' : 'degraded',
      responseTime: Date.now()
    }
  } catch (error) {
    healthCheck.services.aiDiagnosis = {
      status: 'degraded', // AI服务可降级运行
      error: error.message
    }
  }
  
  // 保存健康检查结果
  await db.collection('health_checks').add({
    data: healthCheck
  })
  
  return healthCheck
}

// 告警检查
async function checkAlerts() {
  const alerts = []
  const currentTime = new Date()
  
  // 检查存储空间使用率
  const storageMetrics = await collectStorageMetrics()
  if (storageMetrics.usageRate > 90) {
    alerts.push({
      type: 'storage_critical',
      level: 'critical',
      message: `存储空间使用率已达到 ${storageMetrics.usageRate}%`,
      timestamp: currentTime,
      metrics: storageMetrics
    })
  } else if (storageMetrics.usageRate > 80) {
    alerts.push({
      type: 'storage_warning',
      level: 'warning',
      message: `存储空间使用率已达到 ${storageMetrics.usageRate}%`,
      timestamp: currentTime,
      metrics: storageMetrics
    })
  }
  
  // 检查云函数错误率
  const functionMetrics = await collectFunctionMetrics()
  for (const [funcName, stats] of Object.entries(functionMetrics.functionStats)) {
    if (stats.errorRate > 10) {
      alerts.push({
        type: 'function_error_critical',
        level: 'critical',
        message: `云函数 ${funcName} 错误率过高: ${stats.errorRate}%`,
        timestamp: currentTime,
        functionName: funcName,
        metrics: stats
      })
    } else if (stats.errorRate > 5) {
      alerts.push({
        type: 'function_error_warning',
        level: 'warning',
        message: `云函数 ${funcName} 错误率偏高: ${stats.errorRate}%`,
        timestamp: currentTime,
        functionName: funcName,
        metrics: stats
      })
    }
  }
  
  // 检查数据库异常
  const dbMetrics = await collectDatabaseMetrics()
  for (const [collection, stats] of Object.entries(dbMetrics.collectionStats)) {
    if (stats.status === 'error') {
      alerts.push({
        type: 'database_error',
        level: 'critical',
        message: `数据库集合 ${collection} 访问异常`,
        timestamp: currentTime,
        collection: collection,
        error: stats.error
      })
    }
  }
  
  // 检查用户活跃度异常下降
  const userMetrics = await collectUserMetrics()
  if (userMetrics.activityRate < 10 && userMetrics.totalUsers > 10) {
    alerts.push({
      type: 'user_activity_low',
      level: 'warning',
      message: `用户活跃度过低: ${userMetrics.activityRate}%`,
      timestamp: currentTime,
      metrics: userMetrics
    })
  }
  
  // 保存告警记录
  for (const alert of alerts) {
    await db.collection('system_alerts').add({
      data: {
        ...alert,
        isProcessed: false,
        createTime: currentTime
      }
    })
  }
  
  return {
    alertCount: alerts.length,
    alerts,
    timestamp: currentTime
  }
}

// 清理过期日志
async function cleanupLogs() {
  const retentionDays = 90
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  
  const logCollections = [
    'system_logs',
    'permission_logs',
    'file_operation_logs',
    'system_metrics',
    'health_checks'
  ]
  
  const cleanupResults = {}
  
  for (const collection of logCollections) {
    try {
      const result = await db.collection(collection)
        .where({
          timestamp: db.command.lt(cutoffDate)
        })
        .remove()
      
      cleanupResults[collection] = {
        success: true,
        deletedCount: result.stats.removed
      }
    } catch (error) {
      cleanupResults[collection] = {
        success: false,
        error: error.message
      }
    }
  }
  
  return {
    success: true,
    cleanupResults,
    cutoffDate
  }
}
```

#### 系统监控package.json
```json
{
  "name": "system-monitoring",
  "version": "1.0.0",
  "description": "系统监控云函数",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  },
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [
    "wechat",
    "miniprogram",
    "cloud",
    "monitoring",
    "health-check"
  ],
  "author": "WeChat Cloud Development",
  "license": "ISC"
}
```

## 性能监控指标

### 1. 关键性能指标 (KPI)

#### 系统可用性指标
```javascript
// 可用性指标计算
const availabilityMetrics = {
  // 系统正常运行时间比例
  uptime: {
    target: 99.9, // 目标99.9%
    measurement: 'percentage',
    period: '30d'
  },
  
  // 平均故障恢复时间
  mttr: {
    target: 30, // 目标30分钟
    measurement: 'minutes',
    period: '30d'
  },
  
  // 平均故障间隔时间
  mtbf: {
    target: 720, // 目标720小时
    measurement: 'hours',
    period: '30d'
  }
}
```

#### 性能指标阈值
```javascript
const performanceThresholds = {
  // 响应时间阈值（毫秒）
  responseTime: {
    good: 1000,      // 1秒内为良好
    acceptable: 3000, // 3秒内为可接受
    poor: 5000       // 超过5秒为差
  },
  
  // 云函数执行时间阈值
  functionExecution: {
    good: 2000,      // 2秒内为良好
    acceptable: 5000, // 5秒内为可接受
    poor: 10000      // 超过10秒为差
  },
  
  // 数据库查询时间阈值
  databaseQuery: {
    good: 500,       // 500毫秒内为良好
    acceptable: 1500, // 1.5秒内为可接受
    poor: 3000       // 超过3秒为差
  },
  
  // 文件上传/下载速度阈值（MB/s）
  fileTransfer: {
    good: 2,         // 2MB/s以上为良好
    acceptable: 1,    // 1MB/s以上为可接受
    poor: 0.5        // 低于0.5MB/s为差
  }
}
```

### 2. 业务监控指标

#### 生产业务指标
```javascript
const productionMetrics = {
  // 批次管理效率
  batchEfficiency: {
    // 平均批次周期（天）
    avgBatchCycle: {
      target: 90,
      measurement: 'days'
    },
    
    // 批次完成率
    batchCompletionRate: {
      target: 95,
      measurement: 'percentage'
    },
    
    // 入栏/出栏数据录入及时性
    dataEntryTimeliness: {
      target: 99,
      measurement: 'percentage'
    }
  },
  
  // 物料管理指标
  materialManagement: {
    // 库存周转率
    inventoryTurnover: {
      target: 12,
      measurement: 'times_per_year'
    },
    
    // 物料损耗率
    materialLossRate: {
      target: 2,
      measurement: 'percentage'
    }
  }
}
```

#### 健康管理指标
```javascript
const healthMetrics = {
  // AI诊断准确性
  aiDiagnosisAccuracy: {
    target: 85,
    measurement: 'percentage',
    validation: 'veterinarian_confirmation'
  },
  
  // 健康记录完整性
  healthRecordCompleteness: {
    target: 98,
    measurement: 'percentage'
  },
  
  // 疫苗接种覆盖率
  vaccinationCoverage: {
    target: 100,
    measurement: 'percentage'
  },
  
  // 疾病预警及时性
  diseaseAlertTimeliness: {
    target: 95,
    measurement: 'percentage'
  }
}
```

## 日志管理

### 1. 日志分级策略

#### 日志级别定义
```javascript
const logLevels = {
  DEBUG: {
    level: 0,
    description: '调试信息，开发阶段使用',
    retention: '7d',
    storage: 'local'
  },
  INFO: {
    level: 1,
    description: '一般信息，正常操作记录',
    retention: '30d',
    storage: 'database'
  },
  WARN: {
    level: 2,
    description: '警告信息，需要关注的异常',
    retention: '90d',
    storage: 'database'
  },
  ERROR: {
    level: 3,
    description: '错误信息，影响功能的异常',
    retention: '180d',
    storage: 'database'
  },
  FATAL: {
    level: 4,
    description: '严重错误，系统无法继续运行',
    retention: '365d',
    storage: 'database'
  }
}
```

#### 日志格式标准
```javascript
const logFormat = {
  timestamp: 'ISO 8601 格式时间戳',
  level: '日志级别',
  source: '日志来源（云函数名/页面名）',
  openid: '用户ID（如适用）',
  message: '日志消息',
  context: {
    requestId: '请求ID',
    sessionId: '会话ID',
    userAgent: '用户代理',
    ipAddress: 'IP地址',
    functionName: '云函数名称',
    executionTime: '执行时间（毫秒）'
  },
  data: '相关数据对象',
  stack: '错误堆栈（仅错误日志）'
}
```

### 2. 统一日志记录云函数

#### cloudfunctions/logger/index.js
```javascript
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { level, source, message, data, error } = event
  const { OPENID, REQUEST_ID, SOURCE: IP_ADDRESS } = cloud.getWXContext()
  
  try {
    const logEntry = {
      timestamp: new Date(),
      level: level.toUpperCase(),
      source,
      openid: OPENID,
      message,
      context: {
        requestId: REQUEST_ID,
        ipAddress: IP_ADDRESS,
        userAgent: context.USER_AGENT
      },
      data: data || null,
      stack: error?.stack || null
    }
    
    // 根据日志级别选择存储方式
    if (shouldStoreInDatabase(level)) {
      await db.collection('system_logs').add({
        data: logEntry
      })
    }
    
    // 控制台输出（开发环境）
    if (process.env.DEBUG_MODE === 'true') {
      console[level.toLowerCase()](JSON.stringify(logEntry, null, 2))
    }
    
    // 严重错误立即发送告警
    if (level.toUpperCase() === 'FATAL' || level.toUpperCase() === 'ERROR') {
      await sendErrorAlert(logEntry)
    }
    
    return { success: true }
  } catch (error) {
    console.error('日志记录失败：', error)
    return { success: false, error: error.message }
  }
}

function shouldStoreInDatabase(level) {
  const levelValue = logLevels[level.toUpperCase()]?.level || 0
  return levelValue >= 1 // INFO级别及以上存储到数据库
}

async function sendErrorAlert(logEntry) {
  // 发送错误告警通知
  try {
    await cloud.callFunction({
      name: 'notification-service',
      data: {
        action: 'send_alert',
        type: 'system_error',
        severity: logEntry.level,
        message: logEntry.message,
        details: logEntry
      }
    })
  } catch (error) {
    console.error('发送错误告警失败：', error)
  }
}
```

### 3. 日志轮转和清理策略

#### 自动日志清理脚本
```bash
#!/bin/bash
# log-cleanup.sh

echo "开始清理过期日志..."

ENV_ID="your_env_id_here"

# 调用日志清理云函数
tcb fn:invoke system-monitoring --envId $ENV_ID --data '{
  "action": "cleanup_logs"
}'

echo "日志清理完成"
```

## 健康检查

### 1. 系统健康检查配置

#### 健康检查项目清单
```javascript
const healthCheckItems = {
  // 核心服务健康检查
  coreServices: {
    database: {
      name: '数据库连接',
      check: 'db_connection_test',
      interval: '1m',
      timeout: '5s',
      retries: 3
    },
    storage: {
      name: '云存储服务',
      check: 'storage_access_test',
      interval: '5m',
      timeout: '10s',
      retries: 2
    },
    functions: {
      name: '云函数服务',
      check: 'function_execution_test',
      interval: '2m',
      timeout: '30s',
      retries: 3
    }
  },
  
  // 业务功能健康检查
  businessFunctions: {
    userAuth: {
      name: '用户认证',
      check: 'auth_service_test',
      interval: '5m',
      timeout: '5s',
      retries: 2
    },
    permissionCheck: {
      name: '权限验证',
      check: 'permission_service_test',
      interval: '5m',
      timeout: '5s',
      retries: 2
    },
    aiDiagnosis: {
      name: 'AI诊断服务',
      check: 'ai_service_test',
      interval: '10m',
      timeout: '30s',
      retries: 1
    }
  },
  
  // 外部依赖健康检查
  externalDependencies: {
    aiApi: {
      name: 'AI API服务',
      check: 'external_ai_api_test',
      interval: '15m',
      timeout: '30s',
      retries: 2
    },
    smsService: {
      name: '短信服务',
      check: 'sms_service_test',
      interval: '30m',
      timeout: '10s',
      retries: 1
    }
  }
}
```

### 2. 自动化健康检查部署

#### 定时健康检查触发器
```javascript
// 在微信云开发控制台配置定时触发器
const healthCheckTrigger = {
  name: 'health-check-trigger',
  type: 'timer',
  config: '0 */2 * * * * *', // 每2分钟执行一次
  target: 'system-monitoring',
  data: {
    action: 'health_check'
  }
}
```

## 告警配置

### 1. 告警规则配置

#### 告警级别定义
```javascript
const alertLevels = {
  INFO: {
    level: 1,
    color: '#17a2b8',
    notification: ['console'],
    response: 'none'
  },
  WARNING: {
    level: 2,
    color: '#ffc107',
    notification: ['console', 'system'],
    response: 'monitor'
  },
  ERROR: {
    level: 3,
    color: '#dc3545',
    notification: ['console', 'system', 'admin'],
    response: 'investigate'
  },
  CRITICAL: {
    level: 4,
    color: '#6f42c1',
    notification: ['console', 'system', 'admin', 'sms'],
    response: 'immediate'
  }
}
```

#### 告警规则集
```javascript
const alertRules = {
  // 系统资源告警
  systemResources: {
    storageUsage: {
      metric: 'storage_usage_rate',
      warning: 80,
      critical: 90,
      unit: 'percentage'
    },
    functionErrors: {
      metric: 'function_error_rate',
      warning: 5,
      critical: 10,
      unit: 'percentage',
      period: '1h'
    },
    databaseConnections: {
      metric: 'db_connection_failures',
      warning: 3,
      critical: 5,
      unit: 'count',
      period: '5m'
    }
  },
  
  // 业务异常告警
  businessAnomalies: {
    userActivityDrop: {
      metric: 'user_activity_rate',
      warning: 20,
      critical: 10,
      unit: 'percentage',
      comparison: 'less_than'
    },
    dataEntryGap: {
      metric: 'hours_since_last_entry',
      warning: 12,
      critical: 24,
      unit: 'hours'
    },
    aiDiagnosisFailure: {
      metric: 'ai_diagnosis_failure_rate',
      warning: 15,
      critical: 30,
      unit: 'percentage',
      period: '1h'
    }
  },
  
  // 安全告警
  securityAlerts: {
    unauthorizedAccess: {
      metric: 'unauthorized_access_attempts',
      warning: 5,
      critical: 10,
      unit: 'count',
      period: '1h'
    },
    suspiciousActivity: {
      metric: 'suspicious_user_activity',
      warning: 3,
      critical: 5,
      unit: 'count',
      period: '1h'
    }
  }
}
```

### 2. 告警通知服务

#### cloudfunctions/notification-service/index.js
```javascript
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { action, type, severity, message, details, recipients } = event
  
  try {
    switch (action) {
      case 'send_alert':
        return await sendAlert(type, severity, message, details, recipients)
      case 'send_notification':
        return await sendNotification(type, message, recipients)
      case 'get_notification_history':
        return await getNotificationHistory()
      default:
        throw new Error('无效的通知操作')
    }
  } catch (error) {
    console.error('通知服务操作失败：', error)
    return {
      success: false,
      error: error.message
    }
  }
}

async function sendAlert(alertType, severity, message, details, recipients) {
  const alert = {
    type: alertType,
    severity: severity.toUpperCase(),
    message,
    details,
    timestamp: new Date(),
    status: 'sent',
    recipients: recipients || await getDefaultRecipients(severity)
  }
  
  // 保存告警记录
  const alertRecord = await db.collection('alert_notifications').add({
    data: alert
  })
  
  // 根据严重程度选择通知方式
  const notifications = []
  
  // 系统内通知
  notifications.push(await sendSystemNotification(alert))
  
  // 高级别告警发送额外通知
  if (severity === 'CRITICAL' || severity === 'ERROR') {
    // 管理员小程序推送
    notifications.push(await sendMiniprogramNotification(alert))
    
    // 关键告警发送短信（如果配置）
    if (severity === 'CRITICAL' && process.env.SMS_ENABLED === 'true') {
      notifications.push(await sendSmsAlert(alert))
    }
  }
  
  return {
    success: true,
    alertId: alertRecord._id,
    notifications,
    message: '告警发送成功'
  }
}

async function sendSystemNotification(alert) {
  try {
    // 向系统管理员发送系统内通知
    const adminUsers = await getAdminUsers()
    
    for (const admin of adminUsers) {
      await db.collection('notifications').add({
        data: {
          targetUser: admin.openid,
          type: 'system_alert',
          title: `系统告警 - ${alert.severity}`,
          content: alert.message,
          data: alert.details,
          isRead: false,
          createTime: new Date(),
          priority: alertLevels[alert.severity].level
        }
      })
    }
    
    return { success: true, type: 'system', count: adminUsers.length }
  } catch (error) {
    return { success: false, type: 'system', error: error.message }
  }
}

async function sendMiniprogramNotification(alert) {
  try {
    // 使用微信小程序订阅消息推送
    const adminUsers = await getAdminUsers()
    
    for (const admin of adminUsers) {
      // 这里需要调用微信推送API
      // 实际实现时需要配置模板消息
      await wx.cloud.openapi.subscribeMessage.send({
        touser: admin.openid,
        template_id: 'alert_template_id',
        data: {
          thing1: { value: alert.type },
          thing2: { value: alert.message.substring(0, 20) },
          time3: { value: alert.timestamp.toLocaleString() },
          thing4: { value: alert.severity }
        }
      })
    }
    
    return { success: true, type: 'miniprogram', count: adminUsers.length }
  } catch (error) {
    return { success: false, type: 'miniprogram', error: error.message }
  }
}

async function getAdminUsers() {
  const result = await db.collection('user_roles')
    .where({
      roleCode: db.command.in(['super_admin', 'manager']),
      isActive: true
    })
    .get()
  
  return result.data
}

async function getDefaultRecipients(severity) {
  const recipients = {
    INFO: ['console'],
    WARNING: ['system'],
    ERROR: ['system', 'admin'],
    CRITICAL: ['system', 'admin', 'emergency']
  }
  
  return recipients[severity.toUpperCase()] || ['system']
}
```

## 日常维护流程

### 1. 每日维护检查清单

#### 系统状态检查
```bash
#!/bin/bash
# daily-maintenance-check.sh

echo "=== 每日系统维护检查 ==="
echo "检查时间: $(date)"

ENV_ID="your_env_id_here"

# 1. 系统健康检查
echo "1. 执行系统健康检查..."
tcb fn:invoke system-monitoring --envId $ENV_ID --data '{
  "action": "health_check"
}'

# 2. 收集系统指标
echo "2. 收集系统指标..."
tcb fn:invoke system-monitoring --envId $ENV_ID --data '{
  "action": "collect_metrics"
}'

# 3. 检查告警
echo "3. 检查系统告警..."
tcb fn:invoke system-monitoring --envId $ENV_ID --data '{
  "action": "alert_check"
}'

# 4. 检查存储使用情况
echo "4. 检查存储使用情况..."
tcb storage:usage --envId $ENV_ID

# 5. 检查数据库状态
echo "5. 检查数据库状态..."
collections=("users" "production_batches" "health_records" "finance_income")
for collection in "${collections[@]}"; do
  echo "  检查集合: $collection"
  tcb db:collection:count $collection --envId $ENV_ID
done

# 6. 生成日报
echo "6. 生成维护日报..."
tcb fn:invoke system-monitoring --envId $ENV_ID --data '{
  "action": "generate_daily_report"
}'

echo "=== 每日维护检查完成 ==="
```

#### 数据备份检查
```bash
#!/bin/bash
# backup-check.sh

echo "=== 数据备份检查 ==="

ENV_ID="your_env_id_here"

# 检查备份状态
echo "检查数据备份状态..."
tcb fn:invoke backup-service --envId $ENV_ID --data '{
  "action": "check_backup_status"
}'

# 验证备份完整性
echo "验证备份完整性..."
tcb fn:invoke backup-service --envId $ENV_ID --data '{
  "action": "verify_backup_integrity"
}'

echo "=== 数据备份检查完成 ==="
```

### 2. 每周维护任务

#### 性能分析报告
```bash
#!/bin/bash
# weekly-performance-analysis.sh

echo "=== 每周性能分析 ==="

ENV_ID="your_env_id_here"

# 生成性能报告
tcb fn:invoke system-monitoring --envId $ENV_ID --data '{
  "action": "performance_report",
  "period": "7d"
}'

# 分析用户活跃度
tcb fn:invoke user-analytics --envId $ENV_ID --data '{
  "action": "weekly_activity_analysis"
}'

# 检查系统优化建议
tcb fn:invoke system-optimization --envId $ENV_ID --data '{
  "action": "get_optimization_suggestions"
}'

echo "=== 每周性能分析完成 ==="
```

#### 安全检查
```bash
#!/bin/bash
# weekly-security-check.sh

echo "=== 每周安全检查 ==="

ENV_ID="your_env_id_here"

# 权限审核
tcb fn:invoke security-audit --envId $ENV_ID --data '{
  "action": "permission_audit"
}'

# 用户账户检查
tcb fn:invoke security-audit --envId $ENV_ID --data '{
  "action": "user_account_review"
}'

# 访问日志分析
tcb fn:invoke security-audit --envId $ENV_ID --data '{
  "action": "access_log_analysis"
}'

echo "=== 每周安全检查完成 ==="
```

### 3. 每月维护任务

#### 系统全面检查
```bash
#!/bin/bash
# monthly-comprehensive-check.sh

echo "=== 每月系统全面检查 ==="

ENV_ID="your_env_id_here"

# 1. 数据库优化
echo "1. 执行数据库优化..."
tcb fn:invoke database-optimization --envId $ENV_ID --data '{
  "action": "optimize_indexes"
}'

# 2. 存储清理
echo "2. 执行存储清理..."
tcb fn:invoke file-management --envId $ENV_ID --data '{
  "action": "cleanup",
  "options": {
    "removeOrphaned": true,
    "cleanupTemp": true,
    "archiveOld": true
  }
}'

# 3. 日志归档
echo "3. 执行日志归档..."
tcb fn:invoke system-monitoring --envId $ENV_ID --data '{
  "action": "archive_logs"
}'

# 4. 性能基准测试
echo "4. 执行性能基准测试..."
tcb fn:invoke performance-testing --envId $ENV_ID --data '{
  "action": "run_benchmark_tests"
}'

# 5. 生成月度报告
echo "5. 生成月度报告..."
tcb fn:invoke reporting --envId $ENV_ID --data '{
  "action": "generate_monthly_report"
}'

echo "=== 每月系统全面检查完成 ==="
```

## 故障排除指南

### 1. 常见问题诊断

#### 云函数问题诊断
```javascript
// 云函数问题诊断脚本
const diagnoseFunctionIssues = async (functionName) => {
  const issues = []
  
  // 检查函数配置
  const config = await getFunctionConfig(functionName)
  if (config.timeout < 10000) {
    issues.push({
      type: 'configuration',
      severity: 'warning',
      message: '函数超时时间设置过短，可能导致执行失败',
      suggestion: '建议将超时时间设置为至少10秒'
    })
  }
  
  // 检查内存使用
  const memoryStats = await getFunctionMemoryStats(functionName)
  if (memoryStats.avgUsage > memoryStats.limit * 0.8) {
    issues.push({
      type: 'performance',
      severity: 'warning',
      message: '函数内存使用率过高',
      suggestion: '考虑优化代码或增加内存配置'
    })
  }
  
  // 检查错误率
  const errorRate = await getFunctionErrorRate(functionName, '1h')
  if (errorRate > 5) {
    issues.push({
      type: 'reliability',
      severity: 'error',
      message: `函数错误率过高: ${errorRate}%`,
      suggestion: '检查函数日志，修复常见错误'
    })
  }
  
  return issues
}
```

#### 数据库问题诊断
```javascript
const diagnoseDatabaseIssues = async () => {
  const issues = []
  
  // 检查连接数
  const connectionCount = await getDatabaseConnections()
  if (connectionCount > 100) {
    issues.push({
      type: 'connection',
      severity: 'warning',
      message: '数据库连接数过多',
      suggestion: '检查是否有连接泄漏，优化连接使用'
    })
  }
  
  // 检查慢查询
  const slowQueries = await getSlowQueries('5m')
  if (slowQueries.length > 0) {
    issues.push({
      type: 'performance',
      severity: 'warning',
      message: `发现 ${slowQueries.length} 个慢查询`,
      suggestion: '检查查询是否有适当的索引'
    })
  }
  
  // 检查存储使用
  const storageUsage = await getDatabaseStorageUsage()
  if (storageUsage.rate > 90) {
    issues.push({
      type: 'storage',
      severity: 'critical',
      message: '数据库存储使用率过高',
      suggestion: '立即清理不必要的数据或扩展存储'
    })
  }
  
  return issues
}
```

### 2. 故障处理流程

#### 故障响应等级
```javascript
const incidentResponseLevels = {
  P0: {
    name: '严重故障',
    description: '系统完全不可用，影响所有用户',
    responseTime: '15分钟',
    resolutionTime: '2小时',
    escalation: '立即通知所有相关人员'
  },
  P1: {
    name: '高优先级故障',
    description: '核心功能不可用，影响大部分用户',
    responseTime: '30分钟',
    resolutionTime: '4小时',
    escalation: '通知主要负责人员'
  },
  P2: {
    name: '中等优先级故障',
    description: '部分功能不可用，影响部分用户',
    responseTime: '1小时',
    resolutionTime: '8小时',
    escalation: '通知相关技术人员'
  },
  P3: {
    name: '低优先级故障',
    description: '轻微功能问题，影响较小',
    responseTime: '4小时',
    resolutionTime: '24小时',
    escalation: '正常工作时间处理'
  }
}
```

#### 故障处理检查清单
```markdown
## 故障处理检查清单

### 发现阶段
- [ ] 确认故障现象和影响范围
- [ ] 记录故障发生时间
- [ ] 收集相关日志和错误信息
- [ ] 评估故障优先级

### 响应阶段
- [ ] 根据优先级通知相关人员
- [ ] 开始故障处理时钟计时
- [ ] 建立事件沟通渠道
- [ ] 制定初步应对措施

### 诊断阶段
- [ ] 分析日志和监控数据
- [ ] 执行系统健康检查
- [ ] 识别根本原因
- [ ] 制定修复方案

### 修复阶段
- [ ] 实施修复措施
- [ ] 验证修复效果
- [ ] 监控系统稳定性
- [ ] 通知相关人员修复完成

### 恢复阶段
- [ ] 确认所有功能正常
- [ ] 检查数据完整性
- [ ] 更新监控配置
- [ ] 撤销临时应对措施

### 总结阶段
- [ ] 编写故障报告
- [ ] 分析故障原因
- [ ] 制定预防措施
- [ ] 更新操作手册
```

## 性能优化

### 1. 云函数性能优化

#### 代码优化指南
```javascript
// 云函数性能优化最佳实践

// 1. 连接池优化
const connectionPool = {
  database: null,
  initDB() {
    if (!this.database) {
      this.database = cloud.database()
    }
    return this.database
  }
}

// 2. 缓存机制
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5分钟

const getCachedData = (key) => {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  return null
}

const setCachedData = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  })
}

// 3. 批量操作优化
const batchOperation = async (collection, operations) => {
  const batchSize = 100
  const results = []
  
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize)
    const batchResult = await Promise.all(
      batch.map(op => collection[op.type](op.data))
    )
    results.push(...batchResult)
  }
  
  return results
}

// 4. 异步处理优化
const optimizedFunction = async (event, context) => {
  const startTime = Date.now()
  
  try {
    // 并行处理独立任务
    const [userInfo, permissions, configs] = await Promise.all([
      getUserInfo(event.openid),
      getPermissions(event.openid),
      getSystemConfigs()
    ])
    
    // 记录性能指标
    const executionTime = Date.now() - startTime
    if (executionTime > 5000) {
      await logPerformanceIssue('slow_execution', {
        functionName: context.function_name,
        executionTime,
        event
      })
    }
    
    return {
      success: true,
      data: { userInfo, permissions, configs },
      executionTime
    }
  } catch (error) {
    await logError(error, { event, context })
    throw error
  }
}
```

### 2. 数据库性能优化

#### 索引优化策略
```javascript
// 数据库索引优化建议
const indexOptimization = {
  // 复合索引优化
  compoundIndexes: [
    {
      collection: 'production_entry_records',
      index: { batchNumber: 1, entryDate: -1 },
      reason: '按批次查询最新入栏记录'
    },
    {
      collection: 'health_records',
      index: { batchNumber: 1, healthStatus: 1, checkDate: -1 },
      reason: '按批次和健康状态查询记录'
    },
    {
      collection: 'permission_logs',
      index: { openid: 1, timestamp: -1 },
      reason: '按用户查询权限日志'
    }
  ],
  
  // 稀疏索引优化
  sparseIndexes: [
    {
      collection: 'users',
      index: { phoneNumber: 1 },
      sparse: true,
      reason: '手机号可能为空，使用稀疏索引'
    }
  ],
  
  // 部分索引优化
  partialIndexes: [
    {
      collection: 'notifications',
      index: { targetUser: 1, createTime: -1 },
      partialFilterExpression: { isRead: false },
      reason: '只为未读通知创建索引'
    }
  ]
}
```

#### 查询优化指南
```javascript
// 查询性能优化
const queryOptimization = {
  // 分页查询优化
  optimizedPagination: async (collection, query, page, limit) => {
    // 使用skip + limit的改进版本
    const skip = (page - 1) * limit
    
    // 对于大数据集，使用基于ID的分页
    if (skip > 10000) {
      return await collection
        .where(query)
        .orderBy('_id', 'desc')
        .limit(limit)
        .get()
    } else {
      return await collection
        .where(query)
        .skip(skip)
        .limit(limit)
        .get()
    }
  },
  
  // 聚合查询优化
  optimizedAggregation: async (collection, pipeline) => {
    // 在聚合管道早期阶段添加$match和$limit
    const optimizedPipeline = [
      { $match: pipeline.find(stage => stage.$match)?.$match || {} },
      ...pipeline.filter(stage => !stage.$match),
      { $limit: 1000 } // 限制处理的文档数量
    ]
    
    return await collection.aggregate(optimizedPipeline)
  }
}
```

### 3. 前端性能优化

#### 小程序性能优化配置
```javascript
// miniprogram/utils/performance-optimizer.js
class PerformanceOptimizer {
  constructor() {
    this.imageCache = new Map()
    this.dataCache = new Map()
  }
  
  // 图片懒加载
  lazyLoadImages() {
    const observer = wx.createIntersectionObserver()
    observer.observe('.lazy-image', (res) => {
      if (res.intersectionRatio > 0) {
        const img = res.target
        const src = img.dataset.src
        img.src = src
        observer.disconnect()
      }
    })
  }
  
  // 数据预加载
  async preloadData(keys) {
    const promises = keys.map(key => this.loadData(key))
    await Promise.all(promises)
  }
  
  // 请求去重
  async deduplicateRequest(key, requestFn) {
    if (this.pendingRequests?.has(key)) {
      return this.pendingRequests.get(key)
    }
    
    const promise = requestFn()
    this.pendingRequests = this.pendingRequests || new Map()
    this.pendingRequests.set(key, promise)
    
    try {
      const result = await promise
      this.pendingRequests.delete(key)
      return result
    } catch (error) {
      this.pendingRequests.delete(key)
      throw error
    }
  }
  
  // 节流函数
  throttle(func, delay) {
    let timeoutId
    let lastExecTime = 0
    
    return function (...args) {
      const currentTime = Date.now()
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args)
        lastExecTime = currentTime
      } else {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          func.apply(this, args)
          lastExecTime = Date.now()
        }, delay - (currentTime - lastExecTime))
      }
    }
  }
}

// 使用示例
const optimizer = new PerformanceOptimizer()

Page({
  onLoad() {
    // 启用图片懒加载
    optimizer.lazyLoadImages()
    
    // 预加载关键数据
    optimizer.preloadData(['userInfo', 'systemConfigs'])
  },
  
  onSearch: optimizer.throttle(function(query) {
    // 搜索逻辑
  }, 300)
})
```

## 总结

这个完整的监控和维护指南为鹅场管理系统提供了：

1. **全面的监控体系**：从应用层到基础设施的多层次监控
2. **智能的告警机制**：分级告警和多渠道通知
3. **完善的日志管理**：统一的日志格式和自动清理策略
4. **系统化的健康检查**：自动化的健康检测和问题预警
5. **标准化的维护流程**：日常、每周、每月的维护检查清单
6. **专业的故障处理**：分级响应和标准化处理流程
7. **持续的性能优化**：代码、数据库、前端的全方位优化建议

通过这套监控和维护体系，可以确保鹅场管理系统的稳定运行、及时发现和解决问题，并持续优化系统性能。
