/**
 * 云函数调用辅助工具
 * 统一处理云函数调用，减少重复代码
 * 保持原有功能完整
 */

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
import CloudApi from '../../../utils/cloud-api'
import { logger } from '../../../utils/logger'

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
    
    const result = await safeCloudCall({
      name: 'health-management',
      data: {
        action: 'get_dashboard_snapshot',
        batchId: batchId,
        includeDiagnosis,
        includeAbnormalRecords,
        diagnosisLimit,
        abnormalLimit
      }
    })
    
    if (!result?.success) {
      throw new Error('获取健康面板数据失败')
    }
    
    return result.data
  }
  
  /**
   * 获取预防管理仪表盘
   */
  static async getPreventionDashboard(batchId: string, today?: string) {
    const result = await safeCloudCall({
      name: 'health-management',
      data: {
        action: 'getPreventionDashboard',
        batchId: batchId,
        today: today
      }
    })
    
    return result
  }
  
  /**
   * 获取批次完整数据
   */
  static async getBatchCompleteData(batchId: string, includes: string[] = []) {
    const result = await safeCloudCall({
      name: 'health-management',
      data: {
        action: 'get_batch_complete_data',
        batchId: batchId,
        includes: includes
      }
    })
    
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
        action: 'getTodos',
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
        action: 'getWeeklyTodos',
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
    })
    
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
    const result = await safeCloudCall({
      name: 'ai-diagnosis',
      data: params
    })
    
    return result
  }
}

/**
 * 标准化健康数据（完整版，保留所有字段）
 */
export function normalizeHealthData(rawData: unknown) {
  return {
    batches: rawData.batches || [],
    totalBatches: rawData.totalBatches ?? ((rawData.batches || []).length),
    totalAnimals: Number(rawData.totalAnimals ?? 0) || 0,
    deadCount: Number(rawData.deadCount ?? 0) || 0,
    sickCount: Number(rawData.sickCount ?? 0) || 0,
    actualHealthyCount: Number(rawData.actualHealthyCount ?? 0) || 0,
    healthyRate: rawData.healthyRate || '0',
    mortalityRate: rawData.mortalityRate || '0',
    abnormalCount: Number(rawData.abnormalCount ?? 0) || 0,
    abnormalRecordCount: Number(rawData.abnormalRecordCount ?? 0) || 0,
    abnormalRecords: rawData.abnormalRecords || [],
    totalOngoing: Number(rawData.totalOngoing ?? 0) || 0,
    totalOngoingRecords: Number(rawData.totalOngoingRecords ?? 0) || 0,
    totalTreatmentCost: Number(rawData.totalTreatmentCost ?? 0) || 0,
    totalTreated: Number(rawData.totalTreated ?? 0) || 0,
    totalCured: Number(rawData.totalCured ?? 0) || 0,
    totalDiedAnimals: Number(rawData.totalDiedAnimals ?? 0) || 0,
    totalDied: Number(rawData.totalDied ?? rawData.totalDiedAnimals ?? 0) || 0,
    cureRate: rawData.cureRate || '0',
    pendingDiagnosis: Number(rawData.pendingDiagnosis ?? 0) || 0,
    latestDiagnosisRecords: rawData.latestDiagnosisRecords || [],
    originalTotalQuantity: Number(rawData.originalTotalQuantity ?? 0) || 0,
    fetchedAt: Date.now()
  }
}
