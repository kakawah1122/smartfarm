/**
 * 云函数调用适配器
 * 自动路由到新的拆分云函数
 */

import { safeCloudCall } from './safe-cloud-call'

// 开关：是否启用新架构
const USE_NEW_ARCHITECTURE = true

// 云函数action映射表
const ACTION_FUNCTION_MAP: Record<string, string> = {
  'create_health_record': 'health-records',
  'list_health_records': 'health-records',
  'update_health_record': 'health-records',
  'delete_health_record': 'health-records',
  'get_health_record_detail': 'health-records',
  'get_health_records_by_status': 'health-records',
  'get_batch_health_summary': 'health-records',
  'calculate_health_rate': 'health-records',
  'create_treatment_record': 'health-treatment',
  'update_treatment_record': 'health-treatment',
  'get_treatment_record_detail': 'health-treatment',
  'submit_treatment_plan': 'health-treatment',
  'update_treatment_progress': 'health-treatment',
  'complete_treatment_as_cured': 'health-treatment',
  'complete_treatment_as_died': 'health-treatment',
  'get_ongoing_treatments': 'health-treatment',
  'add_treatment_note': 'health-treatment',
  'add_treatment_medication': 'health-treatment',
  'update_treatment_plan': 'health-treatment',
  'calculate_treatment_cost': 'health-treatment',
  'calculate_batch_treatment_costs': 'health-treatment',
  'get_treatment_history': 'health-treatment',
  'get_treatment_detail': 'health-treatment',
  'create_treatment_from_diagnosis': 'health-treatment',
  'create_treatment_from_abnormal': 'health-treatment',
  'create_treatment_from_vaccine': 'health-treatment',
  'fix_treatment_records_openid': 'health-treatment',
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
  'get_death_records_list': 'health-death',
  'fix_batch_death_count': 'health-death',
  'create_user': 'user-core',
  'update_user': 'user-core',
  'get_user_info': 'user-core',
  'delete_user': 'user-core',
  'update_avatar': 'user-core',
  'get_user_profile': 'user-core',
  'update_user_settings': 'user-core',
  'assign_role': 'user-permission',
  'check_permission': 'user-permission',
  'get_user_permissions': 'user-permission',
  'update_permissions': 'user-permission',
  'get_role_list': 'user-permission',
  'create_role': 'user-permission',
  'update_role': 'user-permission',
  
  // 健康概览相关（已迁移到health-overview）
  'get_dashboard_snapshot': 'health-overview',
  'get_health_overview': 'health-overview',
  'get_all_batches_health_summary': 'health-overview',
  'get_health_dashboard_complete': 'health-overview',
  'get_homepage_health_overview': 'health-overview',
  'get_health_statistics': 'health-overview',
  'getHealthStatistics': 'health-overview',
  'get_health_statistics_optimized': 'health-overview',
  'getHealthStatisticsOptimized': 'health-overview',
  
  // 异常记录相关（已迁移到health-abnormal）
  'create_abnormal_record': 'health-abnormal',
  'get_abnormal_record_detail': 'health-abnormal',
  'get_abnormal_records': 'health-abnormal',
  'list_abnormal_records': 'health-abnormal',
  'correct_abnormal_diagnosis': 'health-abnormal',
  'update_abnormal_status': 'health-abnormal',
  'get_abnormal_stats': 'health-abnormal',
  'delete_abnormal_records': 'health-abnormal',
  
  // 预防保健相关（已迁移到health-prevention）
  'create_prevention_record': 'health-prevention',
  'list_prevention_records': 'health-prevention',
  'get_prevention_dashboard': 'health-prevention',
  'getPreventionDashboard': 'health-prevention',
  'get_today_prevention_tasks': 'health-prevention',
  'getTodayPreventionTasks': 'health-prevention',
  'get_prevention_tasks_by_batch': 'health-prevention',
  'getPreventionTasksByBatch': 'health-prevention',
  'get_batch_prevention_comparison': 'health-prevention',
  'getBatchPreventionComparison': 'health-prevention',
  'complete_prevention_task': 'health-prevention',  // 已迁移到health-prevention
  'completePreventionTask': 'health-prevention',     // 已迁移到health-prevention
  'update_prevention_effectiveness': 'health-prevention',
  'updatePreventionEffectiveness': 'health-prevention',
  
  // 其他功能分布
  'get_cured_records_list': 'health-treatment',  // 治愈记录应该属于治疗模块
  'get_diagnosis_history': 'ai-diagnosis',  // AI诊断历史（已在ai-diagnosis实现）
  'get_batch_complete_data': 'health-overview',  // 批次综合数据（已迁移）
  'get_batch_prompt_data': 'health-management',  // AI诊断提示数据（暂留）
  'create_ai_diagnosis': 'process-ai-diagnosis',  // 创建AI诊断（使用原有云函数）
  'get_treatment_statistics': 'health-treatment'  // 这个已经迁移了
};

/**
 * 智能云函数调用
 * 自动路由到正确的云函数
 */
export async function smartCloudCall(action: string, data: any = {}) {
  // 如果未启用新架构，使用旧的调用方式
  if (!USE_NEW_ARCHITECTURE) {
    return await safeCloudCall({
      name: 'health-management',
      data: { action, ...data }
    })
  }
  
  const targetFunction = ACTION_FUNCTION_MAP[action]
  
  if (!targetFunction) {
    // 兼容旧调用方式
    console.warn(`[SmartCloudCall] Action "${action}" 未找到映射，使用默认云函数`)
    return await safeCloudCall({
      name: 'health-management',
      data: { action, ...data }
    })
  }
  
  // 记录路由信息（开发环境调试用）
  // @ts-ignore
  if (typeof __wxConfig !== 'undefined' && __wxConfig.debug) {
    console.log(`[SmartCloudCall] 路由: ${action} → ${targetFunction}`)
  }
  
  // 调用新的拆分云函数
  return await safeCloudCall({
    name: targetFunction,
    data: { action, ...data }
  })
}

// 批量替换工具函数
export function migrateCloudCalls() {
  // 在开发工具中运行，批量替换云函数调用
  console.log('开始迁移云函数调用...')
  console.log('将 safeCloudCall({name: "health-management", ...}) 替换为 smartCloudCall(action, ...)')
}
