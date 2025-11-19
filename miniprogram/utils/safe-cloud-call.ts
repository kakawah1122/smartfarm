/**
 * 安全的云函数调用包装器
 * 提供向后兼容的优化调用方式
 * 如果优化调用失败，自动回退到原始调用
 */

/// <reference path="../../typings/index.d.ts" />

import { CloudFunctionManager } from './cloud-function-manager'
import { logger } from './logger'

// 创建管理器实例
let cloudManager: CloudFunctionManager | null = null

// 初始化管理器（延迟初始化，避免启动时错误）
function initManager() {
  if (!cloudManager) {
    try {
      cloudManager = CloudFunctionManager.getInstance()
    } catch (error) {
      logger.warn('[SafeCloudCall] 初始化CloudFunctionManager失败，使用原始方式', error)
    }
  }
}

/**
 * 安全的云函数调用
 * 自动处理缓存和优化，失败时回退到原始调用
 * @param config 调用配置
 * @returns Promise<any> 返回云函数的result字段内容
 */
export async function safeCloudCall(config: {
  name: string
  data: any
  useCache?: boolean // 是否使用缓存
  cacheTime?: number // 缓存时间（毫秒）
}): Promise<any> {
  // 尝试初始化管理器
  initManager()
  
  // 特殊处理：批次信息默认缓存
  const shouldCache = config.useCache !== false && 
    (config.name === 'production-entry' && config.data.action === 'getActiveBatches')
  
  try {
    // 如果管理器可用且需要缓存，使用优化调用
    if (cloudManager && (config.useCache || shouldCache)) {
      logger.log('[SafeCloudCall] 使用优化调用:', config.name, config.data.action)
      
      const result = await cloudManager.call({
        name: config.name,
        data: config.data,
        cache: true,
        cacheTime: config.cacheTime || (shouldCache ? 10 * 60 * 1000 : 5 * 60 * 1000),
        priority: 5,
        retry: 1
      })
      
      // 返回格式保持一致
      return result
    }
  } catch (error) {
    logger.warn('[SafeCloudCall] 优化调用失败，回退到原始方式:', error)
  }
  
  // 回退到原始调用方式
  logger.log('[SafeCloudCall] 使用原始调用:', config.name, config.data.action)
  const res = await wx.cloud.callFunction({
    name: config.name,
    data: config.data
  })
  return res.result
}

/**
 * 批量安全调用
 * @param configs 调用配置数组
 * @returns Promise<any[]>
 */
export async function safeBatchCall(configs: Array<{
  name: string
  data: any
  useCache?: boolean
  cacheTime?: number
}>): Promise<any[]> {
  // 尝试初始化管理器
  initManager()
  
  try {
    // 如果管理器可用，使用批量优化
    if (cloudManager) {
      logger.log('[SafeBatchCall] 使用批量优化调用')
      return cloudManager.batchCall(configs.map(config => ({
        name: config.name,
        data: config.data,
        cache: config.useCache !== false,
        cacheTime: config.cacheTime,
        priority: 5,
        retry: 1
      })))
    }
  } catch (error) {
    logger.warn('[SafeBatchCall] 批量优化失败，回退到并行原始调用:', error)
  }
  
  // 回退到并行原始调用
  logger.log('[SafeBatchCall] 使用并行原始调用')
  const results = await Promise.all(configs.map(config => 
    wx.cloud.callFunction({
      name: config.name,
      data: config.data
    })
  ))
  return results.map(res => res.result)
}

/**
 * 清除缓存
 * @param pattern 缓存模式
 */
export function clearCloudCache(pattern?: string) {
  if (cloudManager) {
    cloudManager.clearCache(pattern)
    logger.log('[SafeCloudCall] 缓存已清除:', pattern || 'all')
  }
}

/**
 * 预热数据
 */
export async function warmupCloudData() {
  initManager()
  if (cloudManager) {
    try {
      await cloudManager.warmup()
      logger.log('[SafeCloudCall] 数据预热完成')
    } catch (error) {
      logger.warn('[SafeCloudCall] 数据预热失败:', error)
    }
  }
}
