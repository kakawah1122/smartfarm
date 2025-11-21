/**
 * 全局分页工具类
 * 提供通用的分页功能，可被所有页面复用
 */

/// <reference path="../../typings/index.d.ts" />

export interface PaginationConfig {
  pageSize: number
  currentPage: number
  total: number
  hasMore: boolean
  loading: boolean
}

export interface PaginationOptions {
  pageSize?: number
  cacheKey?: string
  cacheTime?: number
}

/**
 * 通用分页管理器
 */
export class PaginationManager<T> {
  private config: PaginationConfig
  private allData: T[] = []
  private displayedData: T[] = []
  private cacheKey?: string
  private cacheTime: number
  
  constructor(options: PaginationOptions = {}) {
    this.config = {
      pageSize: options.pageSize || 20,
      currentPage: 1,
      total: 0,
      hasMore: false,
      loading: false
    }
    this.cacheKey = options.cacheKey
    this.cacheTime = options.cacheTime || 5 * 60 * 1000 // 默认5分钟缓存
  }
  
  /**
   * 设置全部数据
   */
  setData(data: T[]): void {
    this.allData = data
    this.config.total = data.length
    this.config.currentPage = 1
    this.config.hasMore = data.length > this.config.pageSize
    this.displayedData = this.getPageData(1)
    
    // 缓存数据
    if (this.cacheKey) {
      this.cacheData()
    }
  }
  
  /**
   * 获取指定页的数据
   */
  private getPageData(page: number): T[] {
    const start = (page - 1) * this.config.pageSize
    const end = start + this.config.pageSize
    return this.allData.slice(start, end)
  }
  
  /**
   * 加载更多数据
   */
  loadMore(): T[] {
    if (!this.config.hasMore || this.config.loading) {
      return []
    }
    
    this.config.loading = true
    this.config.currentPage++
    
    const newData = this.getPageData(this.config.currentPage)
    this.displayedData = [...this.displayedData, ...newData]
    
    // 检查是否还有更多
    const totalPages = Math.ceil(this.config.total / this.config.pageSize)
    this.config.hasMore = this.config.currentPage < totalPages
    this.config.loading = false
    
    return newData
  }
  
  /**
   * 重置分页
   */
  reset(): void {
    this.config.currentPage = 1
    this.config.hasMore = this.allData.length > this.config.pageSize
    this.displayedData = this.getPageData(1)
  }
  
  /**
   * 获取配置
   */
  getConfig(): PaginationConfig {
    return { ...this.config }
  }
  
  /**
   * 获取显示数据
   */
  getDisplayedData(): T[] {
    return [...this.displayedData]
  }
  
  /**
   * 从缓存加载数据
   */
  loadFromCache(): boolean {
    if (!this.cacheKey) return false
    
    try {
      const cached = wx.getStorageSync(this.cacheKey)
      if (cached && cached.timestamp && cached.data) {
        const now = Date.now()
        if (now - cached.timestamp < this.cacheTime) {
          this.setData(cached.data)
          return true
        }
      }
    } catch (e) {
      console.error('Load cache failed:', e)
    }
    
    return false
  }
  
  /**
   * 缓存数据
   */
  private cacheData(): void {
    if (!this.cacheKey) return
    
    try {
      wx.setStorageSync(this.cacheKey, {
        data: this.allData,
        timestamp: Date.now()
      })
    } catch (e) {
      console.error('Cache data failed:', e)
    }
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    if (!this.cacheKey) return
    
    try {
      wx.removeStorageSync(this.cacheKey)
    } catch (e) {
      console.error('Clear cache failed:', e)
    }
  }
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => any>(
  func: T,
  delay: number = 300
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastExecTime = 0
  
  return function(this: unknown, ...args: Parameters<T>) {
    const currentTime = Date.now()
    
    if (currentTime - lastExecTime > delay) {
      lastExecTime = currentTime
      return func.apply(this, args)
    } else {
      if (timeoutId) clearTimeout(timeoutId)
      
      timeoutId = setTimeout(() => {
        lastExecTime = Date.now()
        func.apply(this, args)
      }, delay)
    }
  } as T
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => any>(
  func: T,
  delay: number = 300
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  
  return function(this: unknown, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId)
    
    timeoutId = setTimeout(() => {
      func.apply(this, args)
    }, delay)
  } as T
}
