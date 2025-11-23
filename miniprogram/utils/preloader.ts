// 预加载管理器
import { safeCloudCall } from './safe-cloud-call'
import { CacheManager } from './cache-manager'

interface PreloadTask {
  id: string
  promise: Promise<any>
  timestamp: number
  ttl: number // 预加载数据有效期（毫秒）
}

class Preloader {
  private tasks: Map<string, PreloadTask> = new Map()
  private static instance: Preloader
  
  static getInstance(): Preloader {
    if (!Preloader.instance) {
      Preloader.instance = new Preloader()
    }
    return Preloader.instance
  }
  
  // 预加载健康管理页面数据
  async preloadHealthData(batchId: string = 'all') {
    const taskId = `health_${batchId}`
    
    // 如果已有有效的预加载任务，直接返回
    const existingTask = this.tasks.get(taskId)
    if (existingTask && this.isTaskValid(existingTask)) {
      return existingTask.promise
    }
    
    // 创建新的预加载任务
    const promise = this.doPreloadHealthData(batchId)
    
    this.tasks.set(taskId, {
      id: taskId,
      promise,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000 // 5分钟有效期
    })
    
    return promise
  }
  
  private async doPreloadHealthData(batchId: string) {
    try {
      // 并行预加载多个数据源
      const [healthData, preventionData, treatmentData] = await Promise.all([
        // 健康概览数据
        safeCloudCall({
          name: 'health-management',
          data: {
            action: 'get_batch_complete_data',
            batchId: batchId,
            includes: ['health', 'prevention', 'treatment', 'diagnosis', 'abnormal']
          },
          useCache: true
        }),
        
        // 预防管理数据
        safeCloudCall({
          name: 'health-prevention',
          data: {
            action: 'getPreventionDashboard',
            batchId: batchId
          },
          useCache: true
        }),
        
        // 治疗管理数据（如果是全部批次）
        batchId === 'all' ? safeCloudCall({
          name: 'health-management',
          data: {
            action: 'get_all_batches_health_data'
          },
          useCache: true
        }) : Promise.resolve(null)
      ])
      
      return {
        healthData,
        preventionData,
        treatmentData,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('[Preloader] 预加载健康数据失败:', error)
      // 预加载失败不影响正常功能
      return null
    }
  }
  
  // 预加载生产管理页面数据
  async preloadProductionData() {
    const taskId = 'production'
    
    const existingTask = this.tasks.get(taskId)
    if (existingTask && this.isTaskValid(existingTask)) {
      return existingTask.promise
    }
    
    const promise = safeCloudCall({
      name: 'production-entry',
      data: { action: 'getActiveBatches' },
      useCache: true
    })
    
    this.tasks.set(taskId, {
      id: taskId,
      promise,
      timestamp: Date.now(),
      ttl: 10 * 60 * 1000 // 10分钟有效期
    })
    
    return promise
  }
  
  // 预加载财务管理页面数据
  async preloadFinanceData(dateRange?: { startDate: string, endDate: string }) {
    const taskId = `finance_${dateRange?.startDate || 'recent'}`
    
    const existingTask = this.tasks.get(taskId)
    if (existingTask && this.isTaskValid(existingTask)) {
      return existingTask.promise
    }
    
    const promise = safeCloudCall({
      name: 'finance-management',
      data: {
        action: 'getCostBreakdownByDateRange',
        dateRange: dateRange || {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        }
      },
      useCache: true
    })
    
    this.tasks.set(taskId, {
      id: taskId,
      promise,
      timestamp: Date.now(),
      ttl: 10 * 60 * 1000 // 10分钟有效期
    })
    
    return promise
  }
  
  // 获取预加载的数据（如果有）
  async getPreloadedData(taskId: string): Promise<any> {
    const task = this.tasks.get(taskId)
    if (task && this.isTaskValid(task)) {
      try {
        return await task.promise
      } catch {
        // 预加载失败，返回null
        return null
      }
    }
    return null
  }
  
  // 检查任务是否有效
  private isTaskValid(task: PreloadTask): boolean {
    return Date.now() - task.timestamp < task.ttl
  }
  
  // 清理过期的预加载任务
  cleanupExpiredTasks() {
    const now = Date.now()
    for (const [id, task] of this.tasks) {
      if (!this.isTaskValid(task)) {
        this.tasks.delete(id)
      }
    }
  }
  
  // 清空所有预加载任务
  clearAll() {
    this.tasks.clear()
  }
  
  // 预加载下一个可能访问的页面
  async prefetchNextPage(currentPage: string) {
    // 根据用户当前页面，智能预测下一个可能访问的页面
    const prefetchMap: Record<string, () => Promise<any>> = {
      'pages/index/index': () => this.preloadHealthData(),
      'pages/health/health': () => this.preloadProductionData(),
      'pages/production/production': () => this.preloadFinanceData()
    }
    
    const prefetchFn = prefetchMap[currentPage]
    if (prefetchFn) {
      // 延迟1秒后开始预加载，避免影响当前页面
      setTimeout(() => {
        prefetchFn().catch(console.error)
      }, 1000)
    }
  }
}

export const preloader = Preloader.getInstance()
