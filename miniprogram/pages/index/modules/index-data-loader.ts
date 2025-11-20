/**
 * 首页数据加载模块
 * 管理所有数据加载、缓存、格式化逻辑
 */

import CloudApi from '../../../utils/cloud-api'
import { logger } from '../../../utils/logger'

// 缓存配置
const CACHE_KEY = {
  STATS: 'index_stats_cache',
  KNOWLEDGE: 'index_knowledge_cache',
  TASKS: 'index_tasks_cache'
}

const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

interface CacheData<T> {
  data: T
  timestamp: number
}

class IndexDataLoader {
  /**
   * 检查缓存是否有效
   */
  private static isCacheValid<T>(key: string): boolean {
    try {
      const cached = wx.getStorageSync(key) as CacheData<T>
      if (!cached) return false
      return Date.now() - cached.timestamp < CACHE_DURATION
    } catch {
      return false
    }
  }
  
  /**
   * 获取缓存数据
   */
  private static getCachedData<T>(key: string): T | null {
    try {
      const cached = wx.getStorageSync(key) as CacheData<T>
      return cached ? cached.data : null
    } catch {
      return null
    }
  }
  
  /**
   * 设置缓存
   */
  private static setCacheData<T>(key: string, data: T) {
    try {
      wx.setStorageSync(key, {
        data,
        timestamp: Date.now()
      })
    } catch (error) {
      logger.warn('缓存设置失败:', error)
    }
  }
  
  /**
   * 加载首页统计数据
   */
  static async loadStats(forceRefresh = false) {
    // 检查缓存
    if (!forceRefresh && this.isCacheValid(CACHE_KEY.STATS)) {
      const cached = this.getCachedData(CACHE_KEY.STATS)
      if (cached) return cached
    }
    
    try {
      const result = await CloudApi.callFunction('sys-stats', {
        action: 'getOverview'
      })
      
      if (result.success && result.data) {
        this.setCacheData(CACHE_KEY.STATS, result.data)
        return result.data
      }
      
      return null
    } catch (error) {
      logger.error('加载统计数据失败:', error)
      return null
    }
  }
  
  /**
   * 加载知识推荐
   */
  static async loadKnowledgeRecommends() {
    // 检查缓存
    if (this.isCacheValid(CACHE_KEY.KNOWLEDGE)) {
      const cached = this.getCachedData(CACHE_KEY.KNOWLEDGE)
      if (cached) return cached
    }
    
    try {
      const result = await CloudApi.callFunction('knowledge-management', {
        action: 'list',
        pageSize: 3,
        page: 1
      })
      
      if (result.success && result.data) {
        const articles = result.data.list || []
        this.setCacheData(CACHE_KEY.KNOWLEDGE, articles)
        return articles
      }
      
      return []
    } catch (error) {
      logger.error('加载知识推荐失败:', error)
      return []
    }
  }
  
  /**
   * 加载待办任务
   */
  static async loadPendingTasks(batchId?: string) {
    try {
      const result = await CloudApi.callFunction('breeding-schedule', {
        action: 'getTodayTasks',
        batchId
      })
      
      if (result.success && result.data) {
        return result.data.tasks || []
      }
      
      return []
    } catch (error) {
      logger.error('加载待办任务失败:', error)
      return []
    }
  }
  
  /**
   * 清除所有缓存
   */
  static clearAllCache() {
    Object.values(CACHE_KEY).forEach(key => {
      try {
        wx.removeStorageSync(key)
      } catch {}
    })
  }
  
  /**
   * 获取默认统计数据
   */
  static getDefaultStats() {
    return {
      totalGoose: 0,
      batches: 0,
      healthRate: '--',
      dailyIncome: 0,
      pendingTasks: 0,
      feedStock: 0
    }
  }
}

export { IndexDataLoader }
