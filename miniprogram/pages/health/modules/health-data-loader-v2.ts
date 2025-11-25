/**
 * 健康管理数据加载模块 V2 (重新设计版)
 * 负责所有健康数据的加载、缓存和管理
 * 确保返回的数据结构与页面需求完全匹配
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
import { HealthCloudHelper, normalizeHealthData } from '../helpers/cloud-helper'
import { logger } from '../../../utils/logger'
import { formatTime } from '../../../utils/util'

import { smartCloudCall } from '../../../utils/cloud-adapter'
// 缓存配置
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存
const CACHE_PREFIX = 'health_cache_'

interface CachedData {
  data: unknown
  timestamp: number
}

/**
 * 缓存管理器
 */
export class CacheManager {
  /**
   * 检查缓存是否有效
   */
  static isCacheValid(cacheKey: string): boolean {
    try {
      const cached = wx.getStorageSync(CACHE_PREFIX + cacheKey) as CachedData
      if (!cached) return false
      
      const now = Date.now()
      return (now - cached.timestamp) < CACHE_DURATION
    } catch {
      return false
    }
  }

  /**
   * 获取缓存数据
   */
  static getCachedData(cacheKey: string): unknown {
    try {
      const cached = wx.getStorageSync(CACHE_PREFIX + cacheKey) as CachedData
      return cached ? cached.data : null
    } catch {
      return null
    }
  }

  /**
   * 设置缓存数据
   */
  static setCachedData(cacheKey: string, data: unknown) {
    try {
      wx.setStorageSync(CACHE_PREFIX + cacheKey, {
        data,
        timestamp: Date.now()
      })
    } catch {
      // 静默处理
    }
  }

  /**
   * 清除指定缓存
   */
  static clearCache(cacheKey: string) {
    try {
      wx.removeStorageSync(CACHE_PREFIX + cacheKey)
    } catch {
      // 静默处理
    }
  }

  /**
   * 清除所有健康数据缓存
   */
  static clearAllHealthCache() {
    try {
      const info = wx.getStorageInfoSync()
      const healthCacheKeys = info.keys.filter((key: string) => key.startsWith(CACHE_PREFIX))
      healthCacheKeys.forEach((key: string) => {
        wx.removeStorageSync(key)
      })
    } catch {
      // 静默处理
    }
  }

  /**
   * 清除批次缓存
   */
  static clearBatchCache(batchId: string) {
    try {
      if (batchId === 'all') {
        this.clearCache('all_batches_health')
      } else {
        this.clearCache(`batch_health_${batchId}`)
      }
    } catch {
      // 静默处理
    }
  }
}

/**
 * 数据加载器接口
 */
export interface DataLoaderOptions {
  batchId?: string
  silent?: boolean
  useCache?: boolean
  forceRefresh?: boolean
  dateRange?: unknown
}

/**
 * 健康数据加载器
 */
export class HealthDataLoader {
  private pendingRequests: Map<string, Promise<unknown>> = new Map()
  
  /**
   * 加载健康概览数据（使用现有的 HealthCloudHelper）
   */
  async loadHealthOverview(options: DataLoaderOptions = {}): Promise<BaseResponse> {
    const { batchId = 'all', useCache = true, forceRefresh = false } = options
    const cacheKey = `health_overview_${batchId}`
    
    // 检查是否有进行中的请求
    if (!forceRefresh && this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)
    }
    
    // 检查缓存
    if (!forceRefresh && useCache) {
      if (CacheManager.isCacheValid(cacheKey)) {
        return CacheManager.getCachedData(cacheKey)
      }
    }
    
    // 创建请求
    const request = this.fetchHealthOverview(batchId)
    this.pendingRequests.set(cacheKey, request)
    
    try {
      const data = await request
      CacheManager.setCachedData(cacheKey, data)
      return data
    } finally {
      this.pendingRequests.delete(cacheKey)
    }
  }
  
  /**
   * 实际获取健康概览数据
   */
  private async fetchHealthOverview(batchId: string): Promise<BaseResponse> {
    try {
      // 使用 HealthCloudHelper 获取原始数据
      const rawData = await HealthCloudHelper.getDashboardSnapshot(batchId, {
        includeDiagnosis: true,
        includeAbnormalRecords: true,
        diagnosisLimit: 10,
        abnormalLimit: 50
      })
      
      // 使用 normalizeHealthData 标准化数据
      return normalizeHealthData(rawData)
    } catch (error) {
      logger.error('[fetchHealthOverview] 错误:', error)
      throw error
    }
  }
  
  
  /**
   * 加载预防管理数据
   */
  async loadPreventionData(options: DataLoaderOptions = {}): Promise<BaseResponse> {
    const { batchId = 'all' } = options
    const MAX_RETRIES = 2
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await smartCloudCall('getPreventionDashboard', { batchId,
            today: formatTime(new Date(), 'date') })
        
        if (!result?.success) {
          // 非权限错误时重试
          if (attempt < MAX_RETRIES && result?.errorCode !== 'PERMISSION_DENIED') {
            const delay = (attempt + 1) * 1000
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          break
        }
        
        return this.normalizePreventionData(result.data)
      } catch (error) {
        logger.error('[loadPreventionData] 错误:', error)
        
        if (attempt < MAX_RETRIES) {
          const delay = (attempt + 1) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        break
      }
    }
    
    // 返回默认数据
    return this.getDefaultPreventionData()
  }
  
  /**
   * 标准化预防数据
   */
  private normalizePreventionData(data: unknown): unknown {
    return {
      todayTasks: data.todayTasks || [],
      upcomingTasks: data.upcomingTasks || [],
      stats: {
        vaccinationRate: data.stats?.vaccinationRate || 0,
        vaccineCount: data.stats?.vaccineCount || 0,
        preventionCost: data.stats?.preventionCost || 0,
        vaccineCoverage: data.stats?.vaccineCoverage || 0,
        medicationCount: data.stats?.medicationCount || 0
      },
      recentRecords: data.recentRecords || [],
      taskCompletion: {
        total: data.taskCompletion?.total || 0,
        completed: data.taskCompletion?.completed || 0,
        pending: data.taskCompletion?.pending || 0,
        overdue: data.taskCompletion?.overdue || 0
      }
    }
  }
  
  /**
   * 获取默认预防数据
   */
  private getDefaultPreventionData(): unknown {
    return {
      todayTasks: [],
      upcomingTasks: [],
      stats: {
        vaccinationRate: 0,
        vaccineCount: 0,
        preventionCost: 0,
        vaccineCoverage: 0,
        medicationCount: 0
      },
      recentRecords: [],
      taskCompletion: {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0
      }
    }
  }
  
  /**
   * 加载治疗数据（直接返回健康概览中的治疗数据）
   */
  async loadTreatmentData(options: DataLoaderOptions = {}): Promise<BaseResponse> {
    
    try {
      // 获取健康概览数据，其中包含治疗相关数据
      const healthData = await this.loadHealthOverview(options)
      
      // 返回治疗相关的数据
      return {
        totalCost: healthData.totalTreatmentCost || 0,
        totalTreatments: healthData.totalTreated || 0,
        recoveredCount: healthData.totalCured || 0,
        ongoingCount: healthData.totalOngoingRecords || 0,
        recoveryRate: healthData.cureRate || '0.00',
        pendingDiagnosis: healthData.pendingDiagnosis || 0,
        deadCount: healthData.deadCount || 0,
        diagnosisHistory: healthData.latestDiagnosisRecords || []
      }
    } catch (error) {
      logger.error('[loadTreatmentData] 错误:', error)
      return this.getDefaultTreatmentData()
    }
  }
  
  
  /**
   * 获取默认治疗数据
   */
  private getDefaultTreatmentData(): unknown {
    return {
      totalCost: 0,
      totalTreatments: 0,
      recoveredCount: 0,
      ongoingCount: 0,
      recoveryRate: '0.00',
      recentTreatments: [],
      diagnosisHistory: []
    }
  }
  
  /**
   * 加载分析数据（简化版，直接返回基础分析数据）
   */
  async loadAnalysisData(options: DataLoaderOptions = {}): Promise<BaseResponse> {
    try {
      // 获取健康概览数据
      const healthData = await this.loadHealthOverview(options)
      
      // 计算存活率
      const originalQuantity = healthData.originalTotalQuantity || 0
      const deadCount = healthData.deadCount || 0
      const survivalRate = originalQuantity > 0 
        ? ((originalQuantity - deadCount) / originalQuantity * 100).toFixed(1)
        : '-'
      
      return {
        survivalRate: { rate: survivalRate },
        healthTrends: [],
        costAnalysis: {
          preventionCost: 0,
          treatmentCost: healthData.totalTreatmentCost || 0,
          feedingCost: 0
        }
      }
    } catch (error) {
      logger.error('[loadAnalysisData] 错误:', error)
      return this.getDefaultAnalysisData()
    }
  }
  
  
  /**
   * 获取默认分析数据
   */
  private getDefaultAnalysisData(): unknown {
    return {
      survivalRate: { rate: '-' },
      healthTrends: [],
      costAnalysis: {
        preventionCost: 0,
        treatmentCost: 0,
        feedingCost: 0
      }
    }
  }
  
  /**
   * 加载监测数据（从健康概览数据中提取）
   */
  async loadMonitoringData(options: DataLoaderOptions = {}): Promise<BaseResponse> {
    try {
      // 获取健康概览数据
      const healthData = await this.loadHealthOverview(options)
      
      // 返回监测相关的数据
      return {
        realTimeStatus: {
          totalAnimals: healthData.totalAnimals || 0,
          healthyCount: healthData.actualHealthyCount || 0,
          abnormalCount: healthData.abnormalRecordCount || 0,
          criticalCount: 0
        },
        abnormalList: healthData.abnormalRecords || [],
        alerts: [],
        todayCheckCount: 0
      }
    } catch (error) {
      logger.error('[loadMonitoringData] 错误:', error)
      return this.getDefaultMonitoringData()
    }
  }
  
  /**
   * 获取默认监测数据
   */
  private getDefaultMonitoringData(): unknown {
    return {
      realTimeStatus: {
        totalAnimals: 0,
        healthyCount: 0,
        abnormalCount: 0,
        criticalCount: 0
      },
      abnormalList: [],
      alerts: [],
      todayCheckCount: 0
    }
  }
}
