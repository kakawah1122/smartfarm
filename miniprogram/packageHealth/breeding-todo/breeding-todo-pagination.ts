/**
 * 分页加载工具类
 * 用于优化breeding-todo页面的性能
 */

export interface PaginationConfig {
  pageSize: number
  currentPage: number
  total: number
  hasMore: boolean
  loading: boolean
}

export class PaginationHelper {
  private static readonly DEFAULT_PAGE_SIZE = 20
  
  /**
   * 创建默认分页配置
   */
  static createConfig(pageSize: number = PaginationHelper.DEFAULT_PAGE_SIZE): PaginationConfig {
    return {
      pageSize,
      currentPage: 1,
      total: 0,
      hasMore: true,
      loading: false
    }
  }
  
  /**
   * 计算分页数据
   */
  static paginate<T>(allData: T[], config: PaginationConfig): T[] {
    const startIndex = (config.currentPage - 1) * config.pageSize
    const endIndex = startIndex + config.pageSize
    return allData.slice(startIndex, endIndex)
  }
  
  /**
   * 更新分页状态
   */
  static updateConfig(config: PaginationConfig, totalCount: number): PaginationConfig {
    const totalPages = Math.ceil(totalCount / config.pageSize)
    return {
      ...config,
      total: totalCount,
      hasMore: config.currentPage < totalPages
    }
  }
  
  /**
   * 加载下一页
   */
  static nextPage(config: PaginationConfig): PaginationConfig {
    if (!config.hasMore) return config
    
    return {
      ...config,
      currentPage: config.currentPage + 1
    }
  }
  
  /**
   * 重置分页
   */
  static reset(config: PaginationConfig): PaginationConfig {
    return {
      ...config,
      currentPage: 1,
      total: 0,
      hasMore: true
    }
  }
  
  /**
   * 分批加载数据（避免一次性加载过多）
   */
  static async batchLoad<T>(
    loadFunction: (batch: unknown) => Promise<T[]>,
    batches: unknown[],
    batchSize: number = 5
  ): Promise<T[]> {
    const results: T[] = []
    
    for (let i = 0; i < batches.length; i += batchSize) {
      const batch = batches.slice(i, i + batchSize)
      const batchPromises = batch.map(loadFunction)
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults.flat())
    }
    
    return results
  }
  
  /**
   * 节流函数，避免频繁触发加载
   */
  static throttle(func: Function, delay: number = 300) {
    let timeoutId: number | null = null
    let lastExecTime = 0
    
    return function (this: unknown, ...args: unknown[]) {
      const currentTime = Date.now()
      
      if (currentTime - lastExecTime > delay) {
        lastExecTime = currentTime
        func.apply(this, args)
      } else {
        if (timeoutId) clearTimeout(timeoutId)
        
        timeoutId = setTimeout(() => {
          lastExecTime = Date.now()
          func.apply(this, args)
        }, delay) as unknown as number
      }
    }
  }
}

/**
 * 数据缓存管理
 */
export class DataCache {
  private static cache: Map<string, {
    data: any
    timestamp: number
    expiry: number
  }> = new Map()
  
  /**
   * 设置缓存
   */
  static set(key: string, data: unknown, expiryMinutes: number = 5) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: expiryMinutes * 60 * 1000
    })
  }
  
  /**
   * 获取缓存
   */
  static get(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > cached.expiry) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }
  
  /**
   * 清除缓存
   */
  static clear(key?: string) {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }
  
  /**
   * 清除过期缓存
   */
  static clearExpired() {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.expiry) {
        this.cache.delete(key)
      }
    }
  }
}
