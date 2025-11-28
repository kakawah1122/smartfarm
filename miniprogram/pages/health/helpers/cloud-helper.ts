/**
 * 云函数调用辅助工具
 * 统一处理云函数调用，减少重复代码
 * 保持原有功能完整
 */

import { HealthCloud } from '../../../utils/cloud-functions'
import { safeCloudCall } from '../../../utils/safe-cloud-call'
import CloudApi from '../../../utils/cloud-api'
import { logger } from '../../../utils/logger'

/**
 * 云函数返回结果的通用类型
 */
interface CloudFunctionResult<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * 健康管理云函数调用封装
 */
export class HealthCloudHelper {
  /**
   * 获取仪表盘快照
   */
  static async getDashboardSnapshot(batchId: string, options: {
    includeDiagnosis?: boolean
    includeAbnormalRecords?: boolean
    diagnosisLimit?: number
    abnormalLimit?: number
  } = {}) {
    const {
      includeDiagnosis = true,
      includeAbnormalRecords = true,
      diagnosisLimit = 10,
      abnormalLimit = 50
    } = options
    
    const result = await HealthCloud.overview.getDashboardSnapshot({
      batchId,
      includeDiagnosis,
      includeAbnormalRecords,
      diagnosisLimit,
      abnormalLimit
    }) as CloudFunctionResult
    
    if (!result?.success) {
      throw new Error('获取健康面板数据失败')
    }
    
    return result.data
  }
  
  /**
   * 获取预防管理仪表盘
   */
  static async getPreventionDashboard(batchId: string, today?: string) {
    const result = await HealthCloud.prevention.getDashboard({
      batchId,
      today
    }) as CloudFunctionResult
    
    return result
  }
  
  /**
   * 获取批次完整数据
   */
  static async getBatchCompleteData(batchId: string, includes: string[] = []) {
    const result = await HealthCloud.overview.getBatchCompleteData({
      batchId,
      includes
    }) as CloudFunctionResult
    
    return result
  }
  
  /**
   * 获取活跃批次列表
   */
  static async getActiveBatches() {
    const result = await CloudApi.callFunction(
      'production-entry',
      { action: 'getActiveBatches' },
      { showError: false }
    )
    
    if (result?.success && result.data) {
      const batches = Array.isArray(result.data) 
        ? result.data 
        : (result.data.batches || [])
      
      logger.info(`[CloudHelper] 获取到 ${batches.length} 个活跃批次`)
      return batches
    }
    
    return []
  }
  
  /**
   * 获取批次详情
   */
  static async getBatchDetail(batchId: string) {
    const result = await CloudApi.callFunction(
      'production-entry',
      {
        action: 'getBatchDetail',
        batchId: batchId
      },
      { showError: false }
    )
    
    return result.data?.batch || null
  }
  
  /**
   * 获取今日任务
   */
  static async getTodayTasks(batchId: string, dayAge: number) {
    const result = await CloudApi.callFunction(
      'breeding-todo',
      {
        action: 'get_todos',
        batchId: batchId,
        dayAge: dayAge
      },
      { showError: false }
    )
    
    return result.data?.todos || []
  }
  
  /**
   * 获取即将到来的任务
   */
  static async getWeeklyTasks(batchId: string, startDayAge: number, endDayAge: number) {
    const result = await CloudApi.callFunction(
      'breeding-todo',
      {
        action: 'get_weekly_todos',
        batchId: batchId,
        startDayAge: startDayAge,
        endDayAge: endDayAge
      },
      { showError: false }
    )
    
    return result.data || {}
  }
  
  /**
   * 获取成本统计
   */
  static async getCostStats(batchId: string, type: string) {
    const result = await safeCloudCall({
      name: 'finance-management',
      data: {
        action: 'get_cost_stats',
        batchId: batchId,
        type: type
      }
    }) as CloudFunctionResult
    
    return result
  }
  
  /**
   * 获取AI诊断数据
   */
  static async getDiagnosisData(params: {
    action: string
    batchId?: string
    status?: string
    limit?: number
  }) {
    const result = await HealthCloud.ai.create(params) as CloudFunctionResult
    
    return result
  }
}

/**
 * 标准化健康数据（完整版，保留所有字段）
 */
export function normalizeHealthData(rawData: unknown) {
  // 类型断言，将unknown转为any以访问属性
  const data = rawData as any
  
  return {
    batches: data.batches || [],
    totalBatches: data.totalBatches ?? ((data.batches || []).length),
    totalAnimals: Number(data.totalAnimals ?? 0) || 0,
    deadCount: Number(data.deadCount ?? 0) || 0,
    sickCount: Number(data.sickCount ?? 0) || 0,
    actualHealthyCount: Number(data.actualHealthyCount ?? 0) || 0,
    healthyRate: data.healthyRate || '0',
    mortalityRate: data.mortalityRate || '0',
    abnormalCount: Number(data.abnormalCount ?? 0) || 0,
    abnormalRecordCount: Number(data.abnormalRecordCount ?? 0) || 0,
    abnormalRecords: data.abnormalRecords || [],
    totalOngoing: Number(data.totalOngoing ?? 0) || 0,
    totalOngoingRecords: Number(data.totalOngoingRecords ?? 0) || 0,
    totalTreatmentCost: Number(data.totalTreatmentCost ?? 0) || 0,
    totalTreated: Number(data.totalTreated ?? 0) || 0,
    totalCured: Number(data.totalCured ?? 0) || 0,
    totalDiedAnimals: Number(data.totalDiedAnimals ?? 0) || 0,
    totalDied: Number(data.totalDied ?? data.totalDiedAnimals ?? 0) || 0,
    cureRate: data.cureRate || '0',
    pendingDiagnosis: Number(data.pendingDiagnosis ?? 0) || 0,
    latestDiagnosisRecords: data.latestDiagnosisRecords || [],
    originalTotalQuantity: Number(data.originalTotalQuantity ?? 0) || 0,
    fetchedAt: Date.now()
  }
}
