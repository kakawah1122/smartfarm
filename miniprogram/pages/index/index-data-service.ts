/**
 * 首页数据服务模块
 * 负责处理首页所有数据的获取和管理
 */

/// <reference path="../../../typings/index.d.ts" />

/**
 * 统计数据接口
 */
export interface OverviewStats {
  totalBatches: number
  totalInventory: number
  totalRevenue: number
  totalCost: number
  profit: number
  profitMargin: number
}

/**
 * 任务统计接口
 */
export interface TaskStats {
  todayTasks: number
  completedTasks: number
  pendingTasks: number
  completionRate: number
}

/**
 * 天气数据接口
 */
export interface WeatherData {
  location: string
  temperature: number
  weather: string
  humidity: number
  windSpeed: number
  airQuality: string
  forecast: any[]
}

/**
 * 首页数据服务类
 */
export class IndexDataService {
  private static cache = new Map<string, any>()
  private static cacheTime = 5 * 60 * 1000 // 5分钟缓存
  
  /**
   * 获取经营概览数据
   */
  static async getOverviewStats(): Promise<OverviewStats> {
    // 检查缓存
    const cacheKey = 'overview_stats'
    const cached = this.getCache(cacheKey)
    if (cached) return cached
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-dashboard',
        data: { action: 'getOverviewStats' }
      })
      
      if (result.result?.success) {
        const data = result.result.data as OverviewStats
        this.setCache(cacheKey, data)
        return data
      }
      
      throw new Error(result.result?.error || '获取概览数据失败')
    } catch (error) {
      console.error('获取经营概览失败:', error)
      // 返回默认值
      return {
        totalBatches: 0,
        totalInventory: 0,
        totalRevenue: 0,
        totalCost: 0,
        profit: 0,
        profitMargin: 0
      }
    }
  }
  
  /**
   * 获取今日任务统计
   */
  static async getTaskStats(batchId?: string): Promise<TaskStats> {
    const cacheKey = `task_stats_${batchId || 'all'}`
    const cached = this.getCache(cacheKey)
    if (cached) return cached
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'getTaskStats',
          batchId: batchId
        }
      })
      
      if (result.result?.success) {
        const data = result.result.data as TaskStats
        this.setCache(cacheKey, data)
        return data
      }
      
      throw new Error(result.result?.error || '获取任务统计失败')
    } catch (error) {
      console.error('获取任务统计失败:', error)
      return {
        todayTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        completionRate: 0
      }
    }
  }
  
  /**
   * 获取天气信息
   */
  static async getWeatherInfo(location?: string): Promise<WeatherData | null> {
    const cacheKey = `weather_${location || 'current'}`
    const cached = this.getCache(cacheKey)
    if (cached) return cached
    
    try {
      // 如果没有提供位置，先获取当前位置
      if (!location) {
        const locationResult = await this.getCurrentLocation()
        if (!locationResult) return null
        location = `${locationResult.latitude},${locationResult.longitude}`
      }
      
      const result = await wx.cloud.callFunction({
        name: 'weather',
        data: {
          action: 'getCurrentWeather',
          location: location
        }
      })
      
      if (result.result?.success) {
        const data = result.result.data as WeatherData
        this.setCache(cacheKey, data, 30 * 60 * 1000) // 天气缓存30分钟
        return data
      }
      
      return null
    } catch (error) {
      console.error('获取天气信息失败:', error)
      return null
    }
  }
  
  /**
   * 获取活跃批次列表
   */
  static async getActiveBatches(): Promise<any[]> {
    const cacheKey = 'active_batches'
    const cached = this.getCache(cacheKey)
    if (cached) return cached
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })
      
      if (result.result?.success) {
        const data = result.result.data || []
        this.setCache(cacheKey, data)
        return data
      }
      
      return []
    } catch (error) {
      console.error('获取活跃批次失败:', error)
      return []
    }
  }
  
  /**
   * 获取快捷操作列表
   */
  static getQuickActions(): any[] {
    return [
      {
        id: 'entry',
        title: '入栏登记',
        icon: 'import',
        color: '#22C55E',
        bgColor: '#DCFCE7',
        url: '/packageProduction/entry-form/entry-form'
      },
      {
        id: 'exit',
        title: '出栏销售',
        icon: 'export',
        color: '#3B82F6',
        bgColor: '#DBEAFE',
        url: '/packageProduction/exit-form/exit-form'
      },
      {
        id: 'health',
        title: '健康检查',
        icon: 'heart',
        color: '#EF4444',
        bgColor: '#FEE2E2',
        url: '/packageHealth/health-inspection/health-inspection'
      },
      {
        id: 'vaccine',
        title: '疫苗接种',
        icon: 'secured',
        color: '#8B5CF6',
        bgColor: '#EDE9FE',
        url: '/pages/health/health?tab=prevention'
      },
      {
        id: 'feed',
        title: '投喂记录',
        icon: 'queue',
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        url: '/packageProduction/feed-usage-form/feed-usage-form'
      },
      {
        id: 'ai',
        title: 'AI诊断',
        icon: 'precise-monitor',
        color: '#06B6D4',
        bgColor: '#CFFAFE',
        url: '/packageAI/ai-diagnosis/ai-diagnosis'
      }
    ]
  }
  
  /**
   * 获取当前位置
   */
  private static async getCurrentLocation(): Promise<any> {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'wgs84',
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude
          })
        },
        fail: () => {
          resolve(null)
        }
      })
    })
  }
  
  /**
   * 设置缓存
   */
  private static setCache(key: string, data: any, expireTime?: number): void {
    const expire = expireTime || this.cacheTime
    this.cache.set(key, {
      data: data,
      timestamp: Date.now(),
      expire: expire
    })
  }
  
  /**
   * 获取缓存
   */
  private static getCache(key: string): any {
    const cached = this.cache.get(key)
    if (cached && cached.timestamp && cached.data) {
      if (Date.now() - cached.timestamp < cached.expire) {
        return cached.data
      }
      // 缓存过期，删除
      this.cache.delete(key)
    }
    return null
  }
  
  /**
   * 清除所有缓存
   */
  static clearCache(): void {
    this.cache.clear()
  }
}
