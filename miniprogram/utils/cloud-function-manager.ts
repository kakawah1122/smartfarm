/**
 * 云函数管理器
 * 统一管理所有云函数调用，提供缓存、重试、并发控制等功能
 */

/// <reference path="../../typings/index.d.ts" />

import { RequestOptimizer } from './request-optimizer'
import { logger } from './logger'

interface CloudFunctionConfig {
  name: string
  data: Record<string, unknown>
  cache?: boolean // 是否缓存
  cacheTime?: number // 缓存时间（毫秒）
  priority?: number // 优先级
  retry?: number // 重试次数
  timeout?: number // 超时时间（兼容RequestConfig）
}

/**
 * 云函数管理器
 * 统一处理所有云函数调用
 */
export class CloudFunctionManager {
  private static instance: CloudFunctionManager
  private optimizer: RequestOptimizer
  private batchCache = new Map<string, { data: unknown; timestamp: number }>()
  private batchCacheTime = 10 * 60 * 1000 // 批次信息缓存10分钟
  
  private constructor() {
    this.optimizer = RequestOptimizer.getInstance()
  }
  
  /**
   * 获取单例实例
   */
  static getInstance(): CloudFunctionManager {
    if (!CloudFunctionManager.instance) {
      CloudFunctionManager.instance = new CloudFunctionManager()
    }
    return CloudFunctionManager.instance
  }
  
  /**
   * 调用云函数
   */
  async call(config: CloudFunctionConfig): Promise<unknown> {
    // 特殊处理：批次信息缓存
    if (config.name === 'production-entry' && config.data.action === 'getActiveBatches') {
      return this.getActiveBatchesCached()
    }
    
    // 生成缓存键
    const cacheKey = this.generateCacheKey(config)
    
    // 检查缓存
    if (config.cache !== false) {
      const cached = this.optimizer.getCachedResult(cacheKey)
      if (cached) {
        logger.log('[CloudFunctionManager] 使用缓存:', cacheKey)
        return cached
      }
    }
    
    // 通过优化器执行请求
    return this.optimizer.request({
      name: config.name,
      data: config.data,
      priority: config.priority || 5,
      retry: config.retry || 1
    })
  }
  
  /**
   * 批量调用云函数（并行）
   */
  async batchCall(configs: CloudFunctionConfig[]): Promise<any[]> {
    return Promise.all(configs.map(config => this.call(config)))
  }
  
  /**
   * 获取活跃批次（带缓存）
   */
  private async getActiveBatchesCached(): Promise<unknown> {
    const cacheKey = 'active_batches'
    const now = Date.now()
    
    // 检查缓存
    const cached = this.batchCache.get(cacheKey)
    if (cached && now - cached.timestamp < this.batchCacheTime) {
      logger.log('[CloudFunctionManager] 使用批次缓存')
      return cached.data
    }
    
    // 调用云函数
    const result = await wx.cloud.callFunction({
      name: 'production-entry',
      data: { action: 'getActiveBatches' }
    })
    
    // 更新缓存
    this.batchCache.set(cacheKey, {
      data: result,
      timestamp: now
    })
    
    return result
  }
  
  /**
   * 生成缓存键
   */
  private generateCacheKey(config: CloudFunctionConfig): string {
    return `${config.name}:${JSON.stringify(config.data)}`
  }
  
  /**
   * 清除缓存
   */
  clearCache(pattern?: string) {
    if (pattern === 'batch') {
      this.batchCache.clear()
    } else {
      this.optimizer.clearCache(pattern)
    }
  }
  
  /**
   * 预热常用数据
   */
  async warmup() {
    logger.log('[CloudFunctionManager] 开始预热数据...')
    
    // 预加载批次信息
    await this.getActiveBatchesCached()
    
    // 预加载用户信息
    await this.call({
      name: 'user-management',
      data: { action: 'get_current_user' },
      cache: true
    })
    
    logger.log('[CloudFunctionManager] 数据预热完成')
  }
}

// 导出全局实例
export const cloudManager = CloudFunctionManager.getInstance()
