/**
 * 健康管理页面批次管理模块
 * 负责处理批次相关的所有逻辑
 * 保持原有功能不变，只是提取和模块化
 */

/// <reference path="../../../../typings/index.d.ts" />

import { safeCloudCall } from '../../../utils/safe-cloud-call'
import type { 
  BaseResponse, 
  Batch, 
  HealthRecord,
  InputEvent, 
  TapEvent, 
  CustomEvent,
  ScrollEvent,
  PickerEvent 
} from '../../../../../../../../../typings/core';
import { logger } from '../../../utils/logger'

import { smartCloudCall } from '../../../utils/cloud-adapter'
/**
 * 批次信息接口
 */
export interface BatchInfo {
  _id: string
  batchNumber: string
  entryDate: string | Date
  currentQuantity: number
  originalQuantity?: number
  deadCount?: number
  sellCount?: number
  status?: string
  dayAge?: number
  vaccinationRate?: string
  healthStatus?: string
  [key: string]: unknown
}

/**
 * 批次统计接口
 */
export interface BatchStats {
  totalBatches: number
  totalAnimals: number
  avgVaccinationRate: number
  healthyBatches: number
}

/**
 * 批次管理器
 */
export class HealthBatchManager {
  // 批次缓存
  private static batchListCache: Map<string, { data: BatchInfo[], timestamp: number }> = new Map()
  
  // 缓存有效期（5分钟）
  private static readonly CACHE_DURATION = 5 * 60 * 1000
  
  /**
   * 获取批次列表
   * @param forceRefresh 是否强制刷新
   */
  static async getBatchList(forceRefresh = false): Promise<BatchInfo[]> {
    const cacheKey = 'batch_list'
    
    // 检查缓存
    if (!forceRefresh && this.batchListCache.has(cacheKey)) {
      const cached = this.batchListCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        logger.info('[BatchManager] 使用缓存的批次列表')
        return cached.data
      }
    }
    
    try {
      // 获取活跃批次
      const result = await safeCloudCall({
        name: 'production-entry',
        data: {
          action: 'getActiveBatches',
          includeStats: true
        }
      })
      
      if (!result?.success) {
        throw new Error('获取批次列表失败')
      }
      
      // 处理返回数据
      const batches = Array.isArray(result.data) 
        ? result.data 
        : (result.data?.batches || [])
      
      // 计算日龄和健康状态
      const processedBatches = batches.map((batch: unknown) => ({
        ...batch,
        dayAge: this.calculateDayAge(batch.entryDate),
        healthStatus: this.getHealthStatus(batch)
      }))
      
      // 更新缓存
      this.batchListCache.set(cacheKey, {
        data: processedBatches,
        timestamp: Date.now()
      })
      
      return processedBatches
    } catch (error) {
      logger.error('[BatchManager] 获取批次列表失败:', error)
      // 返回缓存数据（如果有）
      const cached = this.batchListCache.get(cacheKey)
      if (cached) {
        return cached.data
      }
      return []
    }
  }
  
  /**
   * 获取批次详情
   * @param batchId 批次ID
   */
  static async getBatchDetail(batchId: string): Promise<BatchInfo | null> {
    if (!batchId || batchId === 'all') {
      return null
    }
    
    try {
      const result = await safeCloudCall({
        name: 'production-entry',
        data: {
          action: 'getBatchDetail',
          batchId: batchId
        }
      })
      
      if (!result?.success || !result.data) {
        throw new Error('获取批次详情失败')
      }
      
      const batch = result.data
      return {
        ...batch,
        dayAge: this.calculateDayAge(batch.entryDate),
        healthStatus: this.getHealthStatus(batch)
      }
    } catch (error) {
      logger.error('[BatchManager] 获取批次详情失败:', error)
      return null
    }
  }
  
  /**
   * 计算批次日龄
   * @param entryDate 入栏日期
   */
  static calculateDayAge(entryDate: string | Date): number {
    if (!entryDate) return 0
    
    const entry = new Date(entryDate)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - entry.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays + 1 // 入栏当天算第1日龄
  }
  
  /**
   * 获取健康状态
   * @param batch 批次信息
   */
  static getHealthStatus(batch: BatchInfo): string {
    if (!batch) return '未知'
    
    const currentQuantity = batch.currentQuantity || 0
    const originalQuantity = batch.originalQuantity || currentQuantity
    const deadCount = batch.deadCount || 0
    
    if (originalQuantity === 0) return '无数据'
    
    const mortalityRate = (deadCount / originalQuantity) * 100
    
    if (mortalityRate < 1) return '优秀'
    if (mortalityRate < 3) return '良好'
    if (mortalityRate < 5) return '一般'
    return '较差'
  }
  
  /**
   * 格式化批次显示名称
   * @param batch 批次信息
   */
  static formatBatchDisplay(batch: BatchInfo): string {
    if (!batch) return '未知批次'
    
    const batchNumber = batch.batchNumber || batch._id.slice(-6)
    const quantity = batch.currentQuantity || 0
    const dayAge = batch.dayAge || 0
    
    return `${batchNumber} · ${dayAge}日龄 · ${quantity}只`
  }
  
  /**
   * 获取批次统计信息
   * @param batches 批次列表
   */
  static getBatchStats(batches: BatchInfo[]): BatchStats {
    if (!batches || batches.length === 0) {
      return {
        totalBatches: 0,
        totalAnimals: 0,
        avgVaccinationRate: 0,
        healthyBatches: 0
      }
    }
    
    const totalAnimals = batches.reduce((sum, batch) => 
      sum + (batch.currentQuantity || 0), 0)
    
    const healthyBatches = batches.filter(batch => 
      this.getHealthStatus(batch) === '优秀' || 
      this.getHealthStatus(batch) === '良好'
    ).length
    
    const avgVaccinationRate = batches.reduce((sum, batch) => {
      const rate = parseFloat(batch.vaccinationRate || '0')
      return sum + rate
    }, 0) / batches.length
    
    return {
      totalBatches: batches.length,
      totalAnimals,
      avgVaccinationRate: Math.round(avgVaccinationRate),
      healthyBatches
    }
  }
  
  /**
   * 按状态过滤批次
   * @param batches 批次列表
   * @param status 状态
   */
  static filterByStatus(batches: BatchInfo[], status: string): BatchInfo[] {
    if (!status || status === 'all') {
      return batches
    }
    
    return batches.filter(batch => batch.status === status)
  }
  
  /**
   * 按健康状态过滤批次
   * @param batches 批次列表
   * @param healthStatus 健康状态
   */
  static filterByHealthStatus(batches: BatchInfo[], healthStatus: string): BatchInfo[] {
    if (!healthStatus || healthStatus === 'all') {
      return batches
    }
    
    return batches.filter(batch => 
      this.getHealthStatus(batch) === healthStatus
    )
  }
  
  /**
   * 排序批次列表
   * @param batches 批次列表
   * @param sortBy 排序字段
   * @param order 排序方向
   */
  static sortBatches(
    batches: BatchInfo[], 
    sortBy: 'entryDate' | 'quantity' | 'dayAge' | 'batchNumber' = 'entryDate',
    order: 'asc' | 'desc' = 'desc'
  ): BatchInfo[] {
    const sorted = [...batches].sort((a, b) => {
      let aValue: unknown, bValue: unknown
      
      switch (sortBy) {
        case 'entryDate':
          aValue = new Date(a.entryDate).getTime()
          bValue = new Date(b.entryDate).getTime()
          break
        case 'quantity':
          aValue = a.currentQuantity || 0
          bValue = b.currentQuantity || 0
          break
        case 'dayAge':
          aValue = a.dayAge || 0
          bValue = b.dayAge || 0
          break
        case 'batchNumber':
          aValue = a.batchNumber || ''
          bValue = b.batchNumber || ''
          break
        default:
          return 0
      }
      
      if (order === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
    
    return sorted
  }
  
  /**
   * 清除批次缓存
   */
  static clearCache() {
    this.batchListCache.clear()
    logger.info('[BatchManager] 批次缓存已清除')
  }
  
  /**
   * 检查批次是否有效
   * @param batchId 批次ID
   */
  static async isBatchValid(batchId: string): Promise<boolean> {
    if (!batchId) return false
    if (batchId === 'all') return true
    
    const batches = await this.getBatchList()
    return batches.some(batch => batch._id === batchId)
  }
  
  /**
   * 获取默认批次
   * @param batches 批次列表
   */
  static getDefaultBatch(batches: BatchInfo[]): string {
    if (!batches || batches.length === 0) {
      return 'all'
    }
    
    // 优先选择最新的批次
    const sorted = this.sortBatches(batches, 'entryDate', 'desc')
    return sorted[0]._id
  }
  
  /**
   * 创建批次选择器数据
   * @param batches 批次列表
   * @param includeAll 是否包含"全部批次"选项
   */
  static createBatchPickerData(batches: BatchInfo[], includeAll = true) {
    const options: Array<{ value: string, label: string }> = []
    
    if (includeAll) {
      options.push({
        value: 'all',
        label: '全部批次'
      })
    }
    
    batches.forEach(batch => {
      options.push({
        value: batch._id,
        label: this.formatBatchDisplay(batch)
      })
    })
    
    return options
  }
  
  /**
   * 批量获取批次健康数据
   * @param batchIds 批次ID列表
   */
  static async getBatchesHealthData(batchIds: string[]): Promise<any[]> {
    if (!batchIds || batchIds.length === 0) {
      return []
    }
    
    try {
      // 并行获取所有批次的健康数据
      const promises = batchIds.map(batchId => 
        smartCloudCall('get_batch_health_summary', { batchId: batchId })
      )
      
      const results = await Promise.all(promises)
      
      return results.map((result, index) => ({
        batchId: batchIds[index],
        ...((result?.success && result.data) || {})
      }))
    } catch (error) {
      logger.error('[BatchManager] 批量获取健康数据失败:', error)
      return []
    }
  }
}

/**
 * 批次数据监听器
 */
export class BatchDataWatcher {
  private static watchers: Map<string, () => void> = new Map()
  
  /**
   * 添加批次数据监听
   * @param batchId 批次ID
   * @param callback 回调函数
   */
  static addWatcher(batchId: string, callback: () => void) {
    const key = `batch_${batchId}`
    this.watchers.set(key, callback)
  }
  
  /**
   * 移除批次数据监听
   * @param batchId 批次ID
   */
  static removeWatcher(batchId: string) {
    const key = `batch_${batchId}`
    this.watchers.delete(key)
  }
  
  /**
   * 触发批次数据更新
   * @param batchId 批次ID
   */
  static triggerUpdate(batchId: string) {
    const key = `batch_${batchId}`
    const callback = this.watchers.get(key)
    if (callback) {
      callback()
    }
    
    // 同时触发全部批次的更新
    const allCallback = this.watchers.get('batch_all')
    if (allCallback && batchId !== 'all') {
      allCallback()
    }
  }
  
  /**
   * 清除所有监听器
   */
  static clearAll() {
    this.watchers.clear()
  }
}

/**
 * 导出便捷方法
 */
export function setupBatchManagement(pageInstance: unknown) {
  // 绑定批次管理方法到页面实例
  pageInstance.getBatchList = () => HealthBatchManager.getBatchList()
  pageInstance.getBatchDetail = (batchId: string) => HealthBatchManager.getBatchDetail(batchId)
  pageInstance.formatBatchDisplay = (batch: BatchInfo) => HealthBatchManager.formatBatchDisplay(batch)
  
  // 添加批次切换监听
  pageInstance.onBatchChange = (callback: (batchId: string) => void) => {
    pageInstance._batchChangeCallback = callback
  }
  
  // 返回批次管理器
  return HealthBatchManager
}
