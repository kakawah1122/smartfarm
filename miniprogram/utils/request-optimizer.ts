/**
 * 请求优化工具类
 * 提供请求队列、并发控制、重试机制等功能
 */

/// <reference path="../../typings/index.d.ts" />

/**
 * 请求配置接口
 */
export interface RequestConfig {
  name: string
  data: Record<string, unknown>
  priority?: number // 优先级，数字越大优先级越高
  retry?: number // 重试次数
  timeout?: number // 超时时间（毫秒）
}

/**
 * 请求结果接口
 */
export interface RequestResult<T = any> {
  success: boolean
  data?: T
  error?: string
  retryCount?: number
}

/**
 * 请求队列项接口
 */
interface QueueItem {
  config: RequestConfig
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  retryCount: number
}

/**
 * 请求优化器类
 */
export class RequestOptimizer {
  private static instance: RequestOptimizer
  private queue: QueueItem[] = []
  private running = 0
  private maxConcurrent = 3 // 最大并发数
  private cache = new Map<string, { data: unknown; timestamp: number }>()
  private cacheTime = 5 * 60 * 1000 // 默认缓存5分钟
  
  /**
   * 获取单例实例
   */
  static getInstance(): RequestOptimizer {
    if (!RequestOptimizer.instance) {
      RequestOptimizer.instance = new RequestOptimizer()
    }
    return RequestOptimizer.instance
  }
  
  /**
   * 获取缓存结果
   */
  getCachedResult(key: string): unknown {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTime) {
      return cached.data
    }
    return null
  }
  
  /**
   * 设置最大并发数
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max
  }
  
  /**
   * 设置缓存时间
   */
  setCacheTime(time: number): void {
    this.cacheTime = time
  }
  
  /**
   * 添加请求到队列
   */
  async request<T = any>(config: RequestConfig): Promise<RequestResult<T>> {
    // 生成缓存键
    const cacheKey = this.generateCacheKey(config)
    
    // 检查缓存
    const cached = this.getCache(cacheKey)
    if (cached) {
      return {
        success: true,
        data: cached as T
      }
    }
    
    // 返回Promise
    return new Promise((resolve, reject) => {
      const queueItem: QueueItem = {
        config,
        resolve,
        reject,
        retryCount: 0
      }
      
      // 根据优先级插入队列
      this.insertQueue(queueItem)
      
      // 尝试处理队列
      this.processQueue()
    })
  }
  
  /**
   * 批量请求（并行）
   */
  async batchRequest<T = any>(
    configs: RequestConfig[],
    options?: {
      continueOnError?: boolean // 出错是否继续
      maxBatchSize?: number // 最大批量大小
    }
  ): Promise<RequestResult<T>[]> {
    const { continueOnError = true, maxBatchSize = 5 } = options || {}
    const results: RequestResult<T>[] = []
    
    // 分批处理
    for (let i = 0; i < configs.length; i += maxBatchSize) {
      const batch = configs.slice(i, i + maxBatchSize)
      const batchPromises = batch.map(config => 
        this.request<T>(config).catch(error => {
          if (continueOnError) {
            return { success: false, error: error.message }
          }
          throw error
        })
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    return results
  }
  
  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    // 检查是否可以处理新请求
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return
    }
    
    // 取出优先级最高的请求
    const item = this.queue.shift()
    if (!item) return
    
    // 增加运行计数
    this.running++
    
    try {
      // 执行请求
      const result = await this.executeRequest(item.config)
      
      // 缓存结果
      const cacheKey = this.generateCacheKey(item.config)
      this.setCache(cacheKey, result.data)
      
      // 解析Promise
      item.resolve(result)
    } catch (error: unknown) {
      // 检查是否需要重试
      if (item.retryCount < (item.config.retry || 0)) {
        item.retryCount++
        // 重新加入队列（延迟重试）
        setTimeout(() => {
          this.insertQueue(item)
          this.processQueue()
        }, 1000 * item.retryCount) // 递增延迟
      } else {
        // 拒绝Promise
        item.reject({
          success: false,
          error: error.message || '请求失败',
          retryCount: item.retryCount
        })
      }
    } finally {
      // 减少运行计数
      this.running--
      // 继续处理队列
      this.processQueue()
    }
  }
  
  /**
   * 执行请求
   */
  private async executeRequest(config: RequestConfig): Promise<RequestResult> {
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = config.timeout || 10000
      let timeoutId: unknown = null
      
      // 超时处理
      timeoutId = setTimeout(() => {
        reject(new Error('请求超时'))
      }, timeout)
      
      // 执行云函数调用
      wx.cloud.callFunction({
        name: config.name,
        data: config.data,
        success: (res: unknown) => {
          clearTimeout(timeoutId)
          
          if (res.result?.success) {
            resolve({
              success: true,
              data: res.result.data
            })
          } else {
            reject(new Error(res.result?.error || '请求失败'))
          }
        },
        fail: (error: unknown) => {
          clearTimeout(timeoutId)
          reject(error)
        }
      })
    })
  }
  
  /**
   * 插入队列（按优先级）
   */
  private insertQueue(item: QueueItem): void {
    const priority = item.config.priority || 0
    
    // 找到插入位置
    let index = this.queue.findIndex(q => (q.config.priority || 0) < priority)
    
    if (index === -1) {
      // 添加到末尾
      this.queue.push(item)
    } else {
      // 插入到指定位置
      this.queue.splice(index, 0, item)
    }
  }
  
  /**
   * 生成缓存键
   */
  private generateCacheKey(config: RequestConfig): string {
    return `${config.name}:${JSON.stringify(config.data)}`
  }
  
  /**
   * 获取缓存
   */
  private getCache(key: string): unknown {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTime) {
      return cached.data
    }
    // 清除过期缓存
    this.cache.delete(key)
    return null
  }
  
  /**
   * 设置缓存
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
    
    // 限制缓存大小（最多100个）
    if (this.cache.size > 100) {
      // 删除最早的缓存
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
  }
  
  /**
   * 清除缓存
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      // 清除匹配的缓存
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key)
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear()
    }
  }
  
  /**
   * 取消所有待处理的请求
   */
  cancelAll(): void {
    this.queue.forEach(item => {
      item.reject(new Error('请求已取消'))
    })
    this.queue = []
  }
  
  /**
   * 获取队列状态
   */
  getStatus(): {
    queueLength: number
    running: number
    cacheSize: number
  } {
    return {
      queueLength: this.queue.length,
      running: this.running,
      cacheSize: this.cache.size
    }
  }
}

/**
 * 导出默认实例
 */
export default RequestOptimizer.getInstance()
