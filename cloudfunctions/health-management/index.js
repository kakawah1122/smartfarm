/**
 * health-management 云函数【已废弃】
 * 
 * ⚠️ 此云函数已废弃，所有功能已迁移到模块化云函数
 * ⚠️ 前端已使用 smartCloudCall 直接调用新云函数
 * ⚠️ 此文件仅为兼容性保留，不再维护
 * 
 * 已迁移的模块：
 * - health-records: 健康记录管理
 * - health-treatment: 治疗管理
 * - health-death: 死亡记录管理
 * - health-abnormal: 异常诊断管理
 * - health-prevention: 预防保健管理
 * - health-overview: 健康概览
 * - health-cost: 成本计算
 * - ai-diagnosis: AI诊断
 * 
 * 迁移日期：2024-11-24
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 功能迁移映射表
const MIGRATION_MAP = {
  // 健康记录模块
  'create_health_record': 'health-records',
  'list_health_records': 'health-records',
  'update_health_record': 'health-records',
  'delete_health_record': 'health-records',
  'get_health_record_detail': 'health-records',
  'get_health_records_by_status': 'health-records',
  'get_batch_health_summary': 'health-records',
  'calculate_health_rate': 'health-records',
  
  // 治疗管理模块
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
  'update_treatment_plan': 'health-treatment',
  'calculate_treatment_cost': 'health-treatment',
  'calculate_batch_treatment_costs': 'health-treatment',
  'get_treatment_history': 'health-treatment',
  'get_treatment_detail': 'health-treatment',
  'create_treatment_from_diagnosis': 'health-treatment',
  'create_treatment_from_abnormal': 'health-treatment',
  'create_treatment_from_vaccine': 'health-treatment',
  'get_cured_records_list': 'health-treatment',
  'get_treatment_statistics': 'health-treatment',
  'record_treatment_death': 'health-treatment',
  'fix_diagnosis_treatment_status': 'health-treatment',
  'fix_treatment_records_openid': 'health-treatment',
  'batch_fix_data_consistency': 'health-treatment',
  
  // 死亡记录模块
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
  'recalculate_death_cost': 'health-death',
  'recalculate_all_death_costs': 'health-death',
  
  // 异常诊断模块
  'create_abnormal_record': 'health-abnormal',
  'list_abnormal_records': 'health-abnormal',
  'get_abnormal_record_detail': 'health-abnormal',
  'get_abnormal_records': 'health-abnormal',
  'correct_abnormal_diagnosis': 'health-abnormal',
  'update_abnormal_status': 'health-abnormal',
  'get_abnormal_stats': 'health-abnormal',
  'delete_abnormal_records': 'health-abnormal',
  
  // 预防保健模块
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
  'complete_prevention_task': 'health-prevention',
  'completePreventionTask': 'health-prevention',
  'update_prevention_effectiveness': 'health-prevention',
  'updatePreventionEffectiveness': 'health-prevention',
  
  // 健康概览模块
  'get_health_overview': 'health-overview',
  'get_dashboard_snapshot': 'health-overview',
  'get_all_batches_health_summary': 'health-overview',
  'get_health_dashboard_complete': 'health-overview',
  'get_homepage_health_overview': 'health-overview',
  'get_health_statistics': 'health-overview',
  'getHealthStatistics': 'health-overview',
  'get_health_statistics_optimized': 'health-overview',
  'getHealthStatisticsOptimized': 'health-overview',
  'get_batch_complete_data': 'health-overview',
  'get_batch_prompt_data': 'health-overview',
  'calculate_batch_cost': 'health-overview',
  'calculateBatchCost': 'health-overview',
  
  // 成本计算模块
  'calculate_cost_stats': 'health-cost',
  'get_batch_cost_analysis': 'health-cost',
  'get_prevention_cost': 'health-cost',
  
  // AI诊断模块
  'get_diagnosis_history': 'ai-diagnosis',
  'create_ai_diagnosis': 'ai-diagnosis'
}

// 云函数主入口 - 自动转发到新的模块化云函数
exports.main = async (event, context) => {
  const { action } = event
  const targetFunction = MIGRATION_MAP[action]
  
  if (!targetFunction) {
    console.error(`[health-management] 未找到 action "${action}" 的路由映射`)
    return {
      success: false,
      error: `未知的操作类型: ${action}`,
      message: '请检查 action 参数是否正确'
    }
  }
  
  // 自动转发到新云函数
  console.log(`[health-management] 转发请求: ${action} → ${targetFunction}`)
  
  try {
    const result = await cloud.callFunction({
      name: targetFunction,
      data: event  // 直接传递完整的 event（包含 action）
    })
    
    // 返回新云函数的结果
    return result.result
  } catch (error) {
    console.error(`[health-management] 转发失败:`, error)
    return {
      success: false,
      error: error.message || '云函数调用失败',
      message: `转发到 ${targetFunction} 失败`
    }
  }
}
