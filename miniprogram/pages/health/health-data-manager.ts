/**
 * 健康管理数据管理模块
 * 负责健康管理页面的数据加载和处理
 */

/// <reference path="../../../typings/index.d.ts" />
import { safeCloudCall } from '../../utils/safe-cloud-call'

interface CloudCallResult<T = any> {
  success: boolean
  data?: T
  error?: string
  total?: number
  hasMore?: boolean
}

/**
 * 健康数据管理器
 */
export class HealthDataManager {
  /**
   * 获取仪表盘快照数据
   */
  static async getDashboardSnapshot(batchId: string = 'all') {
    try {
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'get_dashboard_snapshot',
          batchId,
          dateRange: 'all'
        }
      }) as CloudCallResult
      
      if (result?.success) {
        return result.data
      }
      
      throw new Error(result?.error || '获取仪表盘数据失败')
    } catch (error) {
      console.error('获取仪表盘快照失败:', error)
      throw error
    }
  }
  
  /**
   * 获取预防管理数据
   */
  static async getPreventionDashboard(batchId: string = 'all') {
    try {
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'getPreventionDashboard',
          batchId
        }
      }) as CloudCallResult
      
      if (result?.success) {
        return result.data
      }
      
      throw new Error(result?.error || '获取预防数据失败')
    } catch (error) {
      console.error('获取预防数据失败:', error)
      throw error
    }
  }
  
  /**
   * 获取批次完整数据
   */
  static async getBatchCompleteData(batchId: string, dateRange: any) {
    try {
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'get_batch_complete_data',
          batchId,
          dateRange
        }
      }) as CloudCallResult
      
      if (result?.success) {
        return result.data
      }
      
      throw new Error(result?.error || '获取批次数据失败')
    } catch (error) {
      console.error('获取批次完整数据失败:', error)
      throw error
    }
  }
  
  /**
   * 获取治疗成本
   */
  static async getTreatmentCost(batchId: string | null, dateRange: any) {
    try {
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'calculate_treatment_cost',
          dateRange,
          batchId
        }
      }) as CloudCallResult<{ totalCost?: number }>
      
      if (result?.success) {
        return result.data?.totalCost || 0
      }
      
      return 0
    } catch (error) {
      console.error('获取治疗成本失败:', error)
      return 0
    }
  }
  
  /**
   * 获取异常记录列表
   */
  static async getAbnormalRecords(batchId: string | null, page: number = 1, pageSize: number = 20) {
    try {
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'get_abnormal_list',
          batchId,
          page,
          pageSize
        }
      }) as CloudCallResult<any[]>
      
      if (result?.success) {
        return {
          list: result.data || [],
          total: result.total || 0,
          hasMore: result.hasMore || false
        }
      }
      
      return { list: [], total: 0, hasMore: false }
    } catch (error) {
      console.error('获取异常记录失败:', error)
      return { list: [], total: 0, hasMore: false }
    }
  }
  
  /**
   * 获取诊断记录列表  
   */
  static async getDiagnosisRecords(batchId: string | null, page: number = 1, pageSize: number = 20) {
    try {
      const result = await safeCloudCall({
        name: 'ai-diagnosis',
        data: {
          action: 'get_diagnosis_history',
          batchId,
          page,
          pageSize
        }
      }) as CloudCallResult<any[]>
      
      if (result?.success) {
        return {
          list: result.data || [],
          total: result.total || 0,
          hasMore: result.hasMore || false
        }
      }
      
      return { list: [], total: 0, hasMore: false }
    } catch (error) {
      console.error('获取诊断记录失败:', error)
      return { list: [], total: 0, hasMore: false }
    }
  }
  
  /**
   * 批量加载数据（优化性能）
   */
  static async batchLoadData(tasks: Array<() => Promise<any>>): Promise<any[]> {
    try {
      // 分批执行，避免并发过多
      const batchSize = 3
      const results: any[] = []
      
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch.map(task => 
          task().catch(error => {
            console.error('批量加载任务失败:', error)
            return null
          })
        ))
        results.push(...batchResults)
      }
      
      return results
    } catch (error) {
      console.error('批量加载数据失败:', error)
      return []
    }
  }
  
  /**
   * 缓存数据到本地
   */
  static cacheData(key: string, data: any, expireMinutes: number = 5): void {
    try {
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        expire: expireMinutes * 60 * 1000
      }
      wx.setStorageSync(`health_${key}`, cacheData)
    } catch (error) {
      console.error('缓存数据失败:', error)
    }
  }
  
  /**
   * 从缓存读取数据
   */
  static getCachedData(key: string): any | null {
    try {
      const cacheData = wx.getStorageSync(`health_${key}`)
      if (cacheData && cacheData.timestamp && cacheData.data) {
        const now = Date.now()
        if (now - cacheData.timestamp < cacheData.expire) {
          return cacheData.data
        }
      }
    } catch (error) {
      console.error('读取缓存失败:', error)
    }
    return null
  }
  
  /**
   * 清除缓存
   */
  static clearCache(key?: string): void {
    try {
      if (key) {
        wx.removeStorageSync(`health_${key}`)
      } else {
        // 清除所有健康管理缓存
        const storageInfo = wx.getStorageInfoSync()
        storageInfo.keys.forEach((storageKey: string) => {
          if (storageKey.startsWith('health_')) {
            wx.removeStorageSync(storageKey)
          }
        })
      }
    } catch (error) {
      console.error('清除缓存失败:', error)
    }
  }
}
