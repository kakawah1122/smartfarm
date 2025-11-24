/**
 * health-management 云函数（极简版）
 * 所有功能已迁移到新架构
 * 此文件仅提供迁移提示
 * 
 * 迁移完成情况：
 * ✅ 健康记录 (8个) → health-records
 * ✅ 治疗管理 (21个) → health-treatment  
 * ✅ 死亡记录 (12个) → health-death
 * ✅ 异常诊断 (8个) → health-abnormal
 * ✅ 预防管理 (10个) → health-prevention
 * ✅ 健康概览 (10个) → health-overview
 * ✅ AI诊断历史 → ai-diagnosis
 * ✅ 批次提示数据 → health-overview
 * ✅ 系统维护功能 → health-treatment
 * 
 * 总计：72/72 功能迁移完成 (100%)
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
  
  // AI诊断模块
  'get_diagnosis_history': 'ai-diagnosis'
}

// 云函数主入口
exports.main = async (event, context) => {
  const { action } = event
  
  console.log('[health-management] 收到请求:', action)
  console.log('[health-management] ⚠️ 此云函数已废弃，所有功能已迁移到新架构')
  
  // 查找迁移目标
  const targetFunction = MIGRATION_MAP[action]
  
  if (targetFunction) {
    console.log(`[health-management] 功能 '${action}' 已迁移到 '${targetFunction}'`)
    return {
      success: false,
      error: `功能已迁移`,
      message: `该功能已迁移到 ${targetFunction} 云函数，请更新您的调用代码`,
      redirect: targetFunction,
      action: action,
      migration: {
        from: 'health-management',
        to: targetFunction,
        action: action,
        deprecated: true
      }
    }
  }
  
  // 未知的 action
  return {
    success: false,
    error: '功能不存在',
    message: `未知的 action: ${action}，此云函数已废弃`,
    deprecated: true,
    migrationComplete: true,
    totalMigrated: 72,
    newArchitecture: {
      'health-records': '健康记录管理',
      'health-treatment': '治疗管理 + 系统维护',
      'health-death': '死亡记录管理',
      'health-abnormal': '异常诊断管理',
      'health-prevention': '预防保健管理',
      'health-overview': '健康概览 + 批次数据',
      'ai-diagnosis': 'AI诊断功能'
    }
  }
}
