/**
 * 缓存管理器
 * 提供分级缓存、LRU淘汰、容量控制等功能
 */

/// <reference path="../../typings/index.d.ts" />

import { logger } from './logger'

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  // 缓存级别：1-静态(24h) 2-低频(2h) 3-中频(30m) 4-高频(5m) 5-实时(不缓存)
  level?: 1 | 2 | 3 | 4 | 5
  // 自定义缓存时间（毫秒）
  customTime?: number
  // 缓存键生成策略
  keyStrategy?: 'default' | 'user' | 'batch' | 'date' | 'batch+day'
  // 是否启用预加载
  preload?: boolean
  // 缓存更新策略
  updateStrategy?: 'lazy' | 'eager' | 'scheduled'
}

/**
 * 缓存项接口
 */
interface CacheItem {
  key: string
  data: unknown
  timestamp: number
  expireTime: number
  accessCount: number
  lastAccessTime: number
  size: number
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  totalItems: number
  totalSize: number
  hitCount: number
  missCount: number
  hitRate: number
  avgAccessTime: number
}

/**
 * 缓存级别对应的过期时间（毫秒）
 */
const CACHE_LEVEL_TIME: Record<number, number> = {
  1: 24 * 60 * 60 * 1000,  // 24小时
  2: 2 * 60 * 60 * 1000,    // 2小时
  3: 30 * 60 * 1000,        // 30分钟
  4: 5 * 60 * 1000,         // 5分钟
  5: 0                      // 不缓存
}

/**
 * 云函数缓存配置表
 */
const FUNCTION_CACHE_CONFIG: Record<string, CacheConfig> = {
  'production-entry:getActiveBatches': { level: 2, keyStrategy: 'user' },
  'production-entry:getBatchDetail': { level: 3, keyStrategy: 'batch' },
  'production-dashboard:getProductionOverview': { level: 3, keyStrategy: 'date' },
  'health-management:get_health_overview': { level: 3, keyStrategy: 'batch' },
  'health-management:get_prevention_tasks': { level: 4, keyStrategy: 'batch' },
  'breeding-todo:getTodos': { level: 4, keyStrategy: 'batch+day' },
  'finance-management:getCostBreakdown': { level: 3, keyStrategy: 'date' },
  'finance-management:getFinanceOverview': { level: 3, keyStrategy: 'date' },
  'material-management:getMaterialList': { level: 2, keyStrategy: 'user' },
  'material-management:getMaterialStock': { level: 4, keyStrategy: 'batch' },
  'price-management:getLatestPrices': { level: 4 },
  'user-management:getUserInfo': { level: 2, keyStrategy: 'user' },
  'system-config:getConfig': { level: 1 }
}

/**
 * 缓存管理器类
 */
export class CacheManager {
  private static instance: CacheManager
  
  // 内存缓存
  private memoryCache: Map<string, CacheItem> = new Map()
  
  // 缓存统计
  private stats: CacheStats = {
    totalItems: 0,
    totalSize: 0,
    hitCount: 0,
    missCount: 0,
    hitRate: 0,
    avgAccessTime: 0
  }
  
  // 配置
  private readonly maxItems = 100
  private readonly maxSize = 10 * 1024 * 1024 // 10MB
  
  private constructor() {
    // 定时清理过期缓存
    setInterval(() => this.cleanExpired(), 60 * 1000) // 每分钟清理一次
  }
  
  /**
   * 获取单例实例
   */
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }
  
  /**
   * 获取缓存配置
   */
  getCacheConfig(functionName: string, action: string): CacheConfig {
    const key = `${functionName}:${action}`
    return FUNCTION_CACHE_CONFIG[key] || { level: 5 }
  }
  
  /**
   * 生成缓存键
   */
  generateCacheKey(
    functionName: string,
    data: Record<string, unknown>,
    strategy?: string
  ): string {
    const base = `${functionName}:${data.action || ''}`
    
    switch (strategy) {
      case 'user':
        return `${base}:${this.getUserId()}`
      case 'batch':
        return `${base}:${data.batchId || ''}`
      case 'date':
        return `${base}:${this.getCurrentDate()}`
      case 'batch+day':
        return `${base}:${data.batchId || ''}:${data.dayAge || ''}`
      default:
        return `${base}:${JSON.stringify(data)}`
    }
  }
  
  /**
   * 设置缓存
   */
  set(key: string, data: unknown, config?: CacheConfig): void {
    // 检查缓存级别
    if (config?.level === 5) {
      return // 不缓存
    }
    
    // 计算过期时间
    const expireTime = config?.customTime || 
                       CACHE_LEVEL_TIME[config?.level || 4] || 
                       CACHE_LEVEL_TIME[4]
    
    // 计算数据大小
    const size = this.calculateSize(data)
    
    // LRU淘汰
    if (this.memoryCache.size >= this.maxItems || this.stats.totalSize + size > this.maxSize) {
      this.evictLRU()
    }
    
    // 创建缓存项
    const item: CacheItem = {
      key,
      data,
      timestamp: Date.now(),
      expireTime: Date.now() + expireTime,
      accessCount: 0,
      lastAccessTime: Date.now(),
      size
    }
    
    // 存储到内存
    this.memoryCache.set(key, item)
    
    // 更新统计
    this.stats.totalItems = this.memoryCache.size
    this.stats.totalSize += size
    
    // 异步存储到Storage（可选）
    if (config?.level && config.level <= 3) {
      this.saveToStorage(key, item).catch(err => {
        logger.warn('[CacheManager] 存储到Storage失败:', err)
      })
    }
    
    logger.log('[CacheManager] 缓存已设置:', key, `过期时间: ${expireTime / 1000}s`)
  }
  
  /**
   * 获取缓存
   */
  get(key: string): unknown | null {
    // 从内存获取
    let item = this.memoryCache.get(key)
    
    // 如果内存没有，尝试从Storage获取
    if (!item) {
      item = this.getFromStorage(key)
      if (item) {
        this.memoryCache.set(key, item)
      }
    }
    
    if (!item) {
      this.stats.missCount++
      this.updateHitRate()
      return null
    }
    
    // 检查是否过期
    if (Date.now() > item.expireTime) {
      this.delete(key)
      this.stats.missCount++
      this.updateHitRate()
      return null
    }
    
    // 更新访问信息
    item.accessCount++
    item.lastAccessTime = Date.now()
    
    // 更新统计
    this.stats.hitCount++
    this.updateHitRate()
    
    logger.log('[CacheManager] 缓存命中:', key)
    return item.data
  }
  
  /**
   * 删除缓存
   */
  delete(key: string): void {
    const item = this.memoryCache.get(key)
    if (item) {
      this.stats.totalSize -= item.size
      this.memoryCache.delete(key)
      this.stats.totalItems = this.memoryCache.size
      
      // 从Storage删除
      this.removeFromStorage(key).catch(err => {
        logger.warn('[CacheManager] 从Storage删除失败:', err)
      })
    }
  }
  
  /**
   * 清空缓存
   */
  clear(pattern?: string): void {
    if (!pattern) {
      // 清空所有
      this.memoryCache.clear()
      this.stats.totalItems = 0
      this.stats.totalSize = 0
      wx.clearStorageSync()
      logger.log('[CacheManager] 所有缓存已清空')
    } else {
      // 清空匹配的缓存
      const keysToDelete: string[] = []
      this.memoryCache.forEach((_, key) => {
        if (key.includes(pattern)) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach(key => this.delete(key))
      logger.log('[CacheManager] 清空缓存模式:', pattern, `删除${keysToDelete.length}项`)
    }
  }
  
  /**
   * 清理过期缓存
   */
  private cleanExpired(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    this.memoryCache.forEach((item, key) => {
      if (now > item.expireTime) {
        expiredKeys.push(key)
      }
    })
    
    if (expiredKeys.length > 0) {
      expiredKeys.forEach(key => this.delete(key))
      logger.log('[CacheManager] 清理过期缓存:', expiredKeys.length, '项')
    }
  }
  
  /**
   * LRU淘汰
   */
  private evictLRU(): void {
    let oldestKey = ''
    let oldestTime = Date.now()
    
    this.memoryCache.forEach((item, key) => {
      if (item.lastAccessTime < oldestTime) {
        oldestTime = item.lastAccessTime
        oldestKey = key
      }
    })
    
    if (oldestKey) {
      this.delete(oldestKey)
      logger.log('[CacheManager] LRU淘汰:', oldestKey)
    }
  }
  
  /**
   * 计算数据大小（粗略估算）
   */
  private calculateSize(data: unknown): number {
    const str = JSON.stringify(data)
    return str.length * 2 // 假设每个字符2字节
  }
  
  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0
  }
  
  /**
   * 获取用户ID
   */
  private getUserId(): string {
    const userInfo = wx.getStorageSync('userInfo')
    return userInfo?._id || userInfo?.openid || 'default'
  }
  
  /**
   * 获取当前日期
   */
  private getCurrentDate(): string {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
  }
  
  /**
   * 保存到Storage
   */
  private async saveToStorage(key: string, item: CacheItem): Promise<void> {
    try {
      const storageKey = `cache_${key}`
      wx.setStorageSync(storageKey, {
        data: item.data,
        expireTime: item.expireTime
      })
    } catch (error) {
      logger.warn('[CacheManager] Storage写入失败:', error)
    }
  }
  
  /**
   * 从Storage获取
   */
  private getFromStorage(key: string): CacheItem | undefined {
    try {
      const storageKey = `cache_${key}`
      const stored = wx.getStorageSync(storageKey)
      
      if (stored && stored.expireTime > Date.now()) {
        return {
          key,
          data: stored.data,
          timestamp: 0,
          expireTime: stored.expireTime,
          accessCount: 0,
          lastAccessTime: Date.now(),
          size: this.calculateSize(stored.data)
        }
      }
    } catch (error) {
      logger.warn('[CacheManager] Storage读取失败:', error)
    }
    return undefined
  }
  
  /**
   * 从Storage删除
   */
  private async removeFromStorage(key: string): Promise<void> {
    try {
      const storageKey = `cache_${key}`
      wx.removeStorageSync(storageKey)
    } catch (error) {
      logger.warn('[CacheManager] Storage删除失败:', error)
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }
  
  /**
   * 缓存失效器 - 入栏操作后
   */
  static invalidateAfterEntry(): void {
    const instance = CacheManager.getInstance()
    instance.clear('production-entry')
    instance.clear('production-dashboard')
    logger.log('[CacheManager] 入栏操作后缓存已失效')
  }
  
  /**
   * 缓存失效器 - 出栏操作后
   */
  static invalidateAfterExit(): void {
    const instance = CacheManager.getInstance()
    instance.clear('production-entry')
    instance.clear('production-dashboard')
    instance.clear('finance-management')
    logger.log('[CacheManager] 出栏操作后缓存已失效')
  }
  
  /**
   * 缓存失效器 - 健康记录变更后
   */
  static invalidateAfterHealthChange(): void {
    const instance = CacheManager.getInstance()
    instance.clear('health-management')
    logger.log('[CacheManager] 健康记录变更后缓存已失效')
  }
}
