// 统一的日志工具
// 生产环境禁止直接输出 console.log，调试日志需通过 DEBUG_LOG 控制

/**
 * 是否启用调试日志
 * 在开发环境可以通过设置全局变量或本地存储控制
 * 生产环境默认关闭
 */
const getDebugEnabled = (): boolean => {
  try {
    // 方式1: 通过全局变量控制（开发时可在app.ts中设置）
    const app = getApp<unknown>()
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
   * 建议配合错误上报使用
   */
  error: (...args: unknown[]) => {
    console.error('[ERROR]', ...args)
    // TODO: 可以在这里添加错误上报逻辑
    // 例如：上报到云函数或第三方错误追踪服务
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
    const app = getApp<unknown>()
    if (app && app.globalData) {
      app.globalData.DEBUG_LOG = enabled
    }
    wx.setStorageSync('DEBUG_LOG', enabled ? 'true' : 'false')
    logger.log('调试日志已', enabled ? '开启' : '关闭')
  } catch (error) {
    console.error('设置调试日志失败:', error)
  }
}

