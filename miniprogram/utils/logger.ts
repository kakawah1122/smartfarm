// 统一的日志工具
// 生产环境禁止直接输出 console.log，调试日志需通过 DEBUG_LOG 控制

// 错误上报配置
const ERROR_REPORT_CONFIG = {
  enabled: true,           // 是否启用错误上报
  throttleMs: 5000,        // 节流时间（毫秒），相同错误在此时间内不重复上报
  maxBatchSize: 10,        // 批量上报的最大错误数
  reportInterval: 30000    // 批量上报间隔（毫秒）
}

// 错误上报队列和节流缓存
let errorQueue: ErrorInfo[] = []
const reportedErrors = new Map<string, number>()

interface ErrorInfo {
  message: string
  stack?: string
  timestamp: number
  page?: string
  extra?: Record<string, unknown>
}

/**
 * 上报错误到云端
 * 使用节流和批量策略避免频繁请求
 */
const reportError = (args: unknown[]) => {
  if (!ERROR_REPORT_CONFIG.enabled) return
  
  try {
    // 构建错误信息
    const errorMessage = args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}`
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')
    
    // 生成错误指纹用于节流
    const errorFingerprint = errorMessage.substring(0, 100)
    const now = Date.now()
    const lastReported = reportedErrors.get(errorFingerprint)
    
    // 节流：相同错误在指定时间内不重复上报
    if (lastReported && now - lastReported < ERROR_REPORT_CONFIG.throttleMs) {
      return
    }
    reportedErrors.set(errorFingerprint, now)
    
    // 获取当前页面路径
    let currentPage = ''
    try {
      const pages = getCurrentPages()
      if (pages.length > 0) {
        currentPage = pages[pages.length - 1].route || ''
      }
    } catch {
      // 获取页面路径失败，忽略
    }
    
    // 添加到队列
    const errorInfo: ErrorInfo = {
      message: errorMessage,
      stack: args.find(arg => arg instanceof Error)?.stack,
      timestamp: now,
      page: currentPage
    }
    
    errorQueue.push(errorInfo)
    
    // 队列满时立即上报
    if (errorQueue.length >= ERROR_REPORT_CONFIG.maxBatchSize) {
      flushErrorQueue()
    }
  } catch {
    // 错误上报失败，静默处理避免影响主流程
  }
}

/**
 * 批量上报错误队列
 */
const flushErrorQueue = () => {
  if (errorQueue.length === 0) return
  
  const errorsToReport = [...errorQueue]
  errorQueue = []
  
  // 异步上报，不阻塞主流程
  wx.cloud?.callFunction({
    name: 'user-core',
    data: {
      action: 'report_client_errors',
      errors: errorsToReport
    }
  }).catch(() => {
    // 上报失败静默处理
  })
}

// 定时批量上报
setInterval(flushErrorQueue, ERROR_REPORT_CONFIG.reportInterval)

/**
 * 是否启用调试日志
 * 在开发环境可以通过设置全局变量或本地存储控制
 * 生产环境默认关闭
 */
// App全局数据类型
interface AppGlobalData {
  globalData?: {
    DEBUG_LOG?: boolean
    [key: string]: unknown
  }
}

const getDebugEnabled = (): boolean => {
  try {
    // 方式1: 通过全局变量控制（开发时可在app.ts中设置）
    const app = getApp() as AppGlobalData
    if (app?.globalData?.DEBUG_LOG !== undefined) {
      return app.globalData.DEBUG_LOG === true
    }
    
    // 方式2: 通过本地存储控制（开发时可在控制台设置）
    const debugLog = wx.getStorageSync('DEBUG_LOG')
    if (debugLog !== '') {
      return debugLog === 'true'
    }
    
    // 生产环境默认关闭
    return false
  } catch (error) {
    // 出错时默认关闭，避免影响生产环境
    return false
  }
}

/**
 * 统一的日志工具类
 */
export const logger = {
  /**
   * 调试日志（仅在DEBUG_LOG开启时输出）
   * 用于开发调试，生产环境不会输出
   */
  log: (...args: unknown[]) => {
    if (getDebugEnabled()) {
      console.log('[DEBUG]', ...args)
    }
  },

  /**
   * 警告日志（仅在DEBUG_LOG开启时输出）
   * 用于开发调试，生产环境不会输出
   */
  warn: (...args: unknown[]) => {
    if (getDebugEnabled()) {
      console.warn('[WARN]', ...args)
    }
  },

  /**
   * 错误日志（始终输出）
   * 用于错误追踪，生产环境也会输出
   * 自动上报错误到云端
   */
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args)
    
    // 错误上报：异步上报到云端，不阻塞主流程
    reportError(args)
  },

  /**
   * 信息日志（仅在DEBUG_LOG开启时输出）
   * 用于开发调试，生产环境不会输出
   */
  info: (...args: unknown[]) => {
    if (getDebugEnabled()) {
      console.info('[INFO]', ...args)
    }
  }
}

/**
 * 设置调试日志开关
 * 开发时可以在控制台调用：logger.setDebugEnabled(true)
 */
export const setDebugEnabled = (enabled: boolean) => {
  try {
    const app = getApp() as AppGlobalData
    if (app && app.globalData) {
      app.globalData.DEBUG_LOG = enabled
    }
    wx.setStorageSync('DEBUG_LOG', enabled ? 'true' : 'false')
    logger.log('调试日志已', enabled ? '开启' : '关闭')
  } catch (error) {
    console.error('设置调试日志失败:', error)
  }
}

