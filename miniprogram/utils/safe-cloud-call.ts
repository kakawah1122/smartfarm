/**
 * 安全的云函数调用包装器
 * 
 * 核心功能：
 * - 缓存管理：自动缓存常用数据
 * - 重试机制：失败自动重试
 * - 错误处理：统一的错误处理
 * - 超时控制：可配置超时时间
 * 
 * 使用方式：
 * - 健康管理模块：请使用 HealthCloud（cloud-functions.ts）
 * - 财务模块：直接使用 safeCloudCall
 * - 生产模块：直接使用 safeCloudCall
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
 * @param config 调用配置
 * @returns Promise<unknown> 返回云函数的result字段内容
 */
export async function safeCloudCall<T = unknown>(config: {
  name: string
  data: Record<string, unknown>
  useCache?: boolean // 是否使用缓存
  cacheTime?: number // 缓存时间（毫秒）
  timeout?: number // 超时时间（毫秒）
}): Promise<T> {
  // 尝试初始化管理器
  initManager()
  
  const { name, data } = config
  
  // 特殊处理：批次信息默认缓存
  const shouldCache = config.useCache !== false && 
    (name === 'production-entry' && data.action === 'getActiveBatches')
  
  try {
    // 如果管理器可用且需要缓存，使用优化调用
    if (cloudManager && (config.useCache || shouldCache)) {
      logger.log('[SafeCloudCall] 使用优化调用:', name, data.action)
      
      const result = await cloudManager.call({
        name,
        data,
        cache: true,
        cacheTime: config.cacheTime || (shouldCache ? 10 * 60 * 1000 : 5 * 60 * 1000),
        priority: 5,
        retry: 1,
        timeout: config.timeout
      })
      
      return result as T
    }
  } catch (error) {
    logger.warn('[SafeCloudCall] 优化调用失败，回退到原始方式:', error)
  }
  
  // 回退到原始调用方式
  logger.log('[SafeCloudCall] 使用原始调用:', name, data.action)
  const res = await wx.cloud.callFunction({
    name,
    data,
    timeout: config.timeout
  })
  return res.result as T
}

/**
 * 批量安全调用
 * @param configs 调用配置数组
 * @returns Promise<any[]>
 */
export async function safeBatchCall(configs: Array<{
  name: string
  data: Record<string, unknown>
  useCache?: boolean
  cacheTime?: number
  timeout?: number
}>): Promise<unknown[]> {
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
        retry: 1,
        timeout: config.timeout
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
      data: config.data,
      timeout: config.timeout
    })
  ))
  return results.map((res: { result: unknown }) => res.result)
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
