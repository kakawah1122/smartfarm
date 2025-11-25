/**
 * 安全的云函数调用包装器
 * 提供向后兼容的优化调用方式
 * ⚠️ 自动路由：调用 health-management 时自动转发到新的模块化云函数
 */

/// <reference path="../../typings/index.d.ts" />

import { CloudFunctionManager } from './cloud-function-manager'
import { logger } from './logger'

// 创建管理器实例
let cloudManager: CloudFunctionManager | null = null

// health-management 已废弃，自动路由到新云函数的映射表
// ⚠️ 这是核心路由表，所有 health-management 调用都通过此表路由
const HEALTH_MANAGEMENT_ROUTE_MAP: Record<string, string> = {
  // 治疗模块 → health-treatment
  'get_cured_records_list': 'health-treatment',
  'create_treatment_record': 'health-treatment',
  'update_treatment_record': 'health-treatment',
  'list_treatment_records': 'health-treatment',
  'get_treatment_record_detail': 'health-treatment',
  'submit_treatment_plan': 'health-treatment',
  'update_treatment_progress': 'health-treatment',
  'complete_treatment_as_cured': 'health-treatment',
  'complete_treatment_as_died': 'health-treatment',
  'get_ongoing_treatments': 'health-treatment',
  'add_treatment_note': 'health-treatment',
  'add_treatment_medication': 'health-treatment',
  'calculate_treatment_cost': 'health-treatment',
  'record_treatment_death': 'health-treatment',
  'get_treatment_statistics': 'health-treatment',
  'get_treatment_history': 'health-treatment',
  'get_treatment_detail': 'health-treatment',
  'create_treatment_from_diagnosis': 'health-treatment',
  'create_treatment_from_abnormal': 'health-treatment',
  'create_treatment_from_vaccine': 'health-treatment',
  
  // 死亡记录模块 → health-death
  'get_death_records_list': 'health-death',
  'create_death_record': 'health-death',
  'createDeathRecord': 'health-death',
  'list_death_records': 'health-death',
  'listDeathRecords': 'health-death',
  'get_death_stats': 'health-death',
  'getDeathStats': 'health-death',
  'get_death_record_detail': 'health-death',
  'create_death_record_with_finance': 'health-death',
  'correct_death_diagnosis': 'health-death',
  'create_death_from_vaccine': 'health-death',
  
  // 异常记录模块 → health-abnormal
  'get_abnormal_records': 'health-abnormal',
  'create_abnormal_record': 'health-abnormal',
  'list_abnormal_records': 'health-abnormal',
  'get_abnormal_record_detail': 'health-abnormal',
  'correct_abnormal_diagnosis': 'health-abnormal',
  'update_abnormal_status': 'health-abnormal',
  'get_abnormal_stats': 'health-abnormal',
  'delete_abnormal_records': 'health-abnormal',
  
  // 健康记录模块 → health-records
  'create_health_record': 'health-records',
  'list_health_records': 'health-records',
  'update_health_record': 'health-records',
  'delete_health_record': 'health-records',
  'get_health_record_detail': 'health-records',
  'get_health_records_by_status': 'health-records',
  'get_batch_health_summary': 'health-records',
  'calculate_health_rate': 'health-records',
  
  // 预防保健模块 → health-prevention
  'create_prevention_record': 'health-prevention',
  'list_prevention_records': 'health-prevention',
  'get_prevention_dashboard': 'health-prevention',
  'getPreventionDashboard': 'health-prevention',
  'complete_prevention_task': 'health-prevention',
  'completePreventionTask': 'health-prevention',
  'get_today_prevention_tasks': 'health-prevention',
  'getTodayPreventionTasks': 'health-prevention',
  'get_prevention_tasks_by_batch': 'health-prevention',
  'getPreventionTasksByBatch': 'health-prevention',
  'get_batch_prevention_comparison': 'health-prevention',
  'getBatchPreventionComparison': 'health-prevention',
  'update_prevention_effectiveness': 'health-prevention',
  'updatePreventionEffectiveness': 'health-prevention',
  
  // 健康概览模块 → health-overview
  'get_health_overview': 'health-overview',
  'get_dashboard_snapshot': 'health-overview',
  'get_all_batches_health_summary': 'health-overview',
  'get_all_batches_health_data': 'health-overview',
  'get_homepage_health_overview': 'health-overview',
  'get_health_statistics': 'health-overview',
  'getHealthStatistics': 'health-overview',
  'get_health_statistics_optimized': 'health-overview',
  'getHealthStatisticsOptimized': 'health-overview',
  'get_health_dashboard_complete': 'health-overview',
  'get_batch_complete_data': 'health-overview',
  'get_batch_prompt_data': 'health-overview',
  'calculate_batch_cost': 'health-overview',
  'calculateBatchCost': 'health-overview',
  
  // 成本计算模块 → health-cost
  'calculate_cost_stats': 'health-cost',
  'get_batch_cost_analysis': 'health-cost',
  'get_prevention_cost': 'health-cost',
  'get_cost_analysis': 'health-cost',
  'export_cost_report': 'health-cost',
  
  // AI诊断模块 → ai-diagnosis
  'create_ai_diagnosis': 'ai-diagnosis',
  'ai_diagnosis': 'ai-diagnosis',
  'get_diagnosis_history': 'ai-diagnosis',
  'get_diagnosis_result': 'ai-diagnosis',
  'update_diagnosis_review': 'ai-diagnosis',
  'adopt_diagnosis': 'ai-diagnosis',
  'feedback_diagnosis': 'ai-diagnosis',
  'update_diagnosis_status': 'ai-diagnosis',
  'get_diagnosis_stats': 'ai-diagnosis',
  'get_pending_diagnosis_count': 'ai-diagnosis'
}

/**
 * 自动路由 health-management 调用到新云函数
 * @param name 原始云函数名
 * @param data 调用数据
 * @returns 路由后的云函数名和数据
 */
function autoRouteHealthManagement(name: string, data: Record<string, unknown>): { name: string; data: Record<string, unknown> } {
  if (name !== 'health-management') {
    return { name, data }
  }
  
  const action = data.action as string
  const targetFunction = HEALTH_MANAGEMENT_ROUTE_MAP[action]
  
  if (targetFunction) {
    logger.log(`[SafeCloudCall] 自动路由: health-management/${action} → ${targetFunction}`)
    return { name: targetFunction, data }
  }
  
  // 未找到映射，记录警告但继续调用原函数
  logger.warn(`[SafeCloudCall] 未找到 action "${action}" 的路由映射`)
  return { name, data }
}

// 初始化管理器（延迟初始化，避免启动时错误）
function initManager() {
  if (!cloudManager) {
    try {
      cloudManager = CloudFunctionManager.getInstance()
    } catch (error) {
      logger.warn('[SafeCloudCall] 初始化CloudFunctionManager失败，使用原始方式', error)
    }
  }
}

/**
 * 安全的云函数调用
 * ⚠️ 自动路由：调用 health-management 时自动转发到新的模块化云函数
 * @param config 调用配置
 * @returns Promise<unknown> 返回云函数的result字段内容
 */
export async function safeCloudCall<T = unknown>(config: {
  name: string
  data: Record<string, unknown>
  useCache?: boolean // 是否使用缓存
  cacheTime?: number // 缓存时间（毫秒）
  timeout?: number // 超时时间（毫秒）
}): Promise<T> {
  // 尝试初始化管理器
  initManager()
  
  // ⚠️ 核心：自动路由 health-management 到新云函数
  const { name: actualName, data: actualData } = autoRouteHealthManagement(config.name, config.data)
  
  // 特殊处理：批次信息默认缓存
  const shouldCache = config.useCache !== false && 
    (actualName === 'production-entry' && actualData.action === 'getActiveBatches')
  
  try {
    // 如果管理器可用且需要缓存，使用优化调用
    if (cloudManager && (config.useCache || shouldCache)) {
      logger.log('[SafeCloudCall] 使用优化调用:', actualName, actualData.action)
      
      const result = await cloudManager.call({
        name: actualName,
        data: actualData,
        cache: true,
        cacheTime: config.cacheTime || (shouldCache ? 10 * 60 * 1000 : 5 * 60 * 1000),
        priority: 5,
        retry: 1,
        timeout: config.timeout
      })
      
      return result as T
    }
  } catch (error) {
    logger.warn('[SafeCloudCall] 优化调用失败，回退到原始方式:', error)
  }
  
  // 回退到原始调用方式（使用路由后的云函数名）
  logger.log('[SafeCloudCall] 使用原始调用:', actualName, actualData.action)
  const res = await wx.cloud.callFunction({
    name: actualName,
    data: actualData,
    timeout: config.timeout
  })
  return res.result as T
}

/**
 * 批量安全调用
 * ⚠️ 自动路由：调用 health-management 时自动转发到新的模块化云函数
 * @param configs 调用配置数组
 * @returns Promise<any[]>
 */
export async function safeBatchCall(configs: Array<{
  name: string
  data: Record<string, unknown>
  useCache?: boolean
  cacheTime?: number
  timeout?: number
}>): Promise<unknown[]> {
  // 尝试初始化管理器
  initManager()
  
  // ⚠️ 核心：自动路由所有 health-management 调用
  const routedConfigs = configs.map(config => {
    const { name, data } = autoRouteHealthManagement(config.name, config.data)
    return { ...config, name, data }
  })
  
  try {
    // 如果管理器可用，使用批量优化
    if (cloudManager) {
      logger.log('[SafeBatchCall] 使用批量优化调用')
      return cloudManager.batchCall(routedConfigs.map(config => ({
        name: config.name,
        data: config.data,
        cache: config.useCache !== false,
        cacheTime: config.cacheTime,
        priority: 5,
        retry: 1,
        timeout: config.timeout
      })))
    }
  } catch (error) {
    logger.warn('[SafeBatchCall] 批量优化失败，回退到并行原始调用:', error)
  }
  
  // 回退到并行原始调用（使用路由后的云函数名）
  logger.log('[SafeBatchCall] 使用并行原始调用')
  const results = await Promise.all(routedConfigs.map(config => 
    wx.cloud.callFunction({
      name: config.name,
      data: config.data,
      timeout: config.timeout
    })
  ))
  return results.map((res: { result: unknown }) => res.result)
}

/**
 * 清除缓存
 * @param pattern 缓存模式
 */
export function clearCloudCache(pattern?: string) {
  if (cloudManager) {
    cloudManager.clearCache(pattern)
    logger.log('[SafeCloudCall] 缓存已清除:', pattern || 'all')
  }
}

/**
 * 预热数据
 */
export async function warmupCloudData() {
  initManager()
  if (cloudManager) {
    try {
      await cloudManager.warmup()
      logger.log('[SafeCloudCall] 数据预热完成')
    } catch (error) {
      logger.warn('[SafeCloudCall] 数据预热失败:', error)
    }
  }
}
