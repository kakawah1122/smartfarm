/**
 * 云函数统一调用封装 - 新架构
 * 直接调用模块化云函数，无需映射表
 * 
 * 使用方式：
 * import { HealthCloud } from './cloud-functions'
 * await HealthCloud.prevention.create(data)
 */

/// <reference path="../../typings/index.d.ts" />

import { logger } from './logger'

/**
 * 云函数返回结果接口
 */
export interface CloudCallResult<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  errorCode?: string
  recordId?: string
  costRecordId?: string
  _performance?: {
    totalTime: number
    timestamp: string
  }
}

/**
 * 基础云函数调用
 */
async function callCloudFunction<T = any>(
  name: string,
  action: string,
  data: Record<string, any> = {}
): Promise<CloudCallResult<T>> {
  try {
    logger.log(`[CloudFunction] 调用: ${name}.${action}`)
    
    const res = await wx.cloud.callFunction({
      name,
      data: { action, ...data }
    })
    
    const result = res.result as CloudCallResult<T>
    
    if (!result) {
      logger.error(`[CloudFunction] ${name}.${action} 返回空值`)
      return {
        success: false,
        error: '云函数返回空值，请检查云函数是否正确部署'
      }
    }
    
    if (!result.success) {
      logger.error(`[CloudFunction] ${name}.${action} 执行失败:`, result.error || result.message)
    } else {
      logger.log(`[CloudFunction] ${name}.${action} 执行成功`)
    }
    
    return result
  } catch (error: any) {
    logger.error(`[CloudFunction] ${name}.${action} 调用失败:`, error)
    return {
      success: false,
      error: error.message || '云函数调用失败',
      errorCode: 'CALL_FAILED'
    }
  }
}

/**
 * 健康管理云函数模块
 */
export const HealthCloud = {
  /**
   * 预防保健模块
   */
  prevention: {
    /** 创建预防记录 */
    create: (data: any) => callCloudFunction('health-prevention', 'create_prevention_record', data),
    
    /** 查询预防记录列表 */
    list: (data: any) => callCloudFunction('health-prevention', 'list_prevention_records', data),
    
    /** 完成预防任务 */
    completeTask: (data: any) => callCloudFunction('health-prevention', 'complete_prevention_task', data),
    
    /** 更新预防效果评估 */
    updateEffectiveness: (data: any) => callCloudFunction('health-prevention', 'update_prevention_effectiveness', data),
    
    /** 获取预防看板 */
    getDashboard: (data: any) => callCloudFunction('health-prevention', 'get_prevention_dashboard', data),
    
    /** 获取今日预防任务 */
    getTodayTasks: (data: any) => callCloudFunction('health-prevention', 'get_today_prevention_tasks', data),
    
    /** 获取批次预防任务 */
    getTasksByBatch: (data: any) => callCloudFunction('health-prevention', 'get_prevention_tasks_by_batch', data),
    
    /** 获取批次预防对比 */
    getBatchComparison: (data: any) => callCloudFunction('health-prevention', 'get_batch_prevention_comparison', data),
  },

  /**
   * 治疗管理模块
   */
  treatment: {
    /** 创建治疗记录 */
    create: (data: any) => callCloudFunction('health-treatment', 'create_treatment_record', data),
    
    /** 更新治疗记录 */
    update: (data: any) => callCloudFunction('health-treatment', 'update_treatment_record', data),
    
    /** 获取治疗记录详情 */
    getDetail: (data: any) => callCloudFunction('health-treatment', 'get_treatment_record_detail', data),
    
    /** 提交治疗方案 */
    submitPlan: (data: any) => callCloudFunction('health-treatment', 'submit_treatment_plan', data),
    
    /** 更新治疗进度 */
    updateProgress: (data: any) => callCloudFunction('health-treatment', 'update_treatment_progress', data),
    
    /** 完成治疗（治愈） */
    completeCured: (data: any) => callCloudFunction('health-treatment', 'complete_treatment_as_cured', data),
    
    /** 完成治疗（死亡） */
    completeDied: (data: any) => callCloudFunction('health-treatment', 'complete_treatment_as_died', data),
    
    /** 获取进行中的治疗 */
    getOngoing: (data: any) => callCloudFunction('health-treatment', 'get_ongoing_treatments', data),
    
    /** 添加治疗备注 */
    addNote: (data: any) => callCloudFunction('health-treatment', 'add_treatment_note', data),
    
    /** 添加治疗用药 */
    addMedication: (data: any) => callCloudFunction('health-treatment', 'add_treatment_medication', data),
    
    /** 更新治疗方案 */
    updatePlan: (data: any) => callCloudFunction('health-treatment', 'update_treatment_plan', data),
    
    /** 计算治疗成本 */
    calculateCost: (data: any) => callCloudFunction('health-treatment', 'calculate_treatment_cost', data),
    
    /** 计算批次治疗成本 */
    calculateBatchCosts: (data: any) => callCloudFunction('health-treatment', 'calculate_batch_treatment_costs', data),
    
    /** 获取治疗历史 */
    getHistory: (data: any) => callCloudFunction('health-treatment', 'get_treatment_history', data),
    
    /** 从诊断创建治疗 */
    createFromDiagnosis: (data: any) => callCloudFunction('health-treatment', 'create_treatment_from_diagnosis', data),
    
    /** 从异常创建治疗 */
    createFromAbnormal: (data: any) => callCloudFunction('health-treatment', 'create_treatment_from_abnormal', data),
    
    /** 从疫苗创建治疗 */
    createFromVaccine: (data: any) => callCloudFunction('health-treatment', 'create_treatment_from_vaccine', data),
    
    /** 获取治愈记录列表 */
    getCuredList: (data: any) => callCloudFunction('health-treatment', 'get_cured_records_list', data),
    
    /** 修复治疗记录openid */
    fixOpenid: (data: any) => callCloudFunction('health-treatment', 'fix_treatment_records_openid', data),
    
    /** 修复诊断治疗状态 */
    fixDiagnosisStatus: (data: any) => callCloudFunction('health-treatment', 'fix_diagnosis_treatment_status', data),
    
    /** 批量修复数据一致性 */
    batchFixConsistency: (data: any) => callCloudFunction('health-treatment', 'batch_fix_data_consistency', data),
  },

  /**
   * 死亡记录模块
   */
  death: {
    /** 创建死亡记录 */
    create: (data: any) => callCloudFunction('health-death', 'create_death_record', data),
    
    /** 查询死亡记录列表 */
    list: (data: any) => callCloudFunction('health-death', 'list_death_records', data),
    
    /** 获取死亡统计 */
    getStats: (data: any) => callCloudFunction('health-death', 'get_death_stats', data),
    
    /** 获取死亡记录详情 */
    getDetail: (data: any) => callCloudFunction('health-death', 'get_death_record_detail', data),
    
    /** 创建死亡记录（含财务） */
    createWithFinance: (data: any) => callCloudFunction('health-death', 'create_death_record_with_finance', data),
    
    /** 纠正死亡诊断 */
    correctDiagnosis: (data: any) => callCloudFunction('health-death', 'correct_death_diagnosis', data),
    
    /** 从疫苗创建死亡记录 */
    createFromVaccine: (data: any) => callCloudFunction('health-death', 'create_death_from_vaccine', data),
    
    /** 获取死亡记录列表 */
    getRecordsList: (data: any) => callCloudFunction('health-death', 'get_death_records_list', data),
    
    /** 修复批次死亡数量 */
    fixBatchCount: (data: any) => callCloudFunction('health-death', 'fix_batch_death_count', data),
    
    /** 重新计算死亡成本 */
    recalculateCost: (data: any) => callCloudFunction('health-cost', 'recalculate_death_cost', data),
    
    /** 重新计算所有死亡成本 */
    recalculateAllCosts: (data: any) => callCloudFunction('health-cost', 'recalculate_all_death_costs', data),
  },

  /**
   * 异常记录模块
   */
  abnormal: {
    /** 创建异常记录 */
    create: (data: any) => callCloudFunction('health-abnormal', 'create_abnormal_record', data),
    
    /** 获取异常记录详情 */
    getDetail: (data: any) => callCloudFunction('health-abnormal', 'get_abnormal_record_detail', data),
    
    /** 获取异常记录列表 */
    getRecords: (data: any) => callCloudFunction('health-abnormal', 'get_abnormal_records', data),
    
    /** 查询异常记录列表 */
    list: (data: any) => callCloudFunction('health-abnormal', 'list_abnormal_records', data),
    
    /** 纠正异常诊断 */
    correctDiagnosis: (data: any) => callCloudFunction('health-abnormal', 'correct_abnormal_diagnosis', data),
    
    /** 更新异常状态 */
    updateStatus: (data: any) => callCloudFunction('health-abnormal', 'update_abnormal_status', data),
    
    /** 获取异常统计 */
    getStats: (data: any) => callCloudFunction('health-abnormal', 'get_abnormal_stats', data),
    
    /** 删除异常记录 */
    deleteRecords: (data: any) => callCloudFunction('health-abnormal', 'delete_abnormal_records', data),
  },

  /**
   * 健康记录模块
   */
  records: {
    /** 创建健康记录 */
    create: (data: any) => callCloudFunction('health-records', 'create_health_record', data),
    
    /** 查询健康记录列表 */
    list: (data: any) => callCloudFunction('health-records', 'list_health_records', data),
    
    /** 更新健康记录 */
    update: (data: any) => callCloudFunction('health-records', 'update_health_record', data),
    
    /** 删除健康记录 */
    delete: (data: any) => callCloudFunction('health-records', 'delete_health_record', data),
    
    /** 获取健康记录详情 */
    getDetail: (data: any) => callCloudFunction('health-records', 'get_health_record_detail', data),
    
    /** 按状态获取健康记录 */
    getByStatus: (data: any) => callCloudFunction('health-records', 'get_health_records_by_status', data),
    
    /** 获取批次健康汇总 */
    getBatchSummary: (data: any) => callCloudFunction('health-records', 'get_batch_health_summary', data),
    
    /** 计算健康率 */
    calculateRate: (data: any) => callCloudFunction('health-records', 'calculate_health_rate', data),
  },

  /**
   * 健康概览模块
   */
  overview: {
    /** 获取健康概览 */
    get: (data: any) => callCloudFunction('health-overview', 'get_health_overview', data),
    
    /** 获取所有批次健康汇总 */
    getAllBatchesSummary: (data: any) => callCloudFunction('health-overview', 'get_all_batches_health_summary', data),
    
    /** 获取仪表板快照 */
    getDashboardSnapshot: (data: any) => callCloudFunction('health-overview', 'get_dashboard_snapshot', data),
    
    /** 获取完整健康仪表板 */
    getDashboardComplete: (data: any) => callCloudFunction('health-overview', 'get_health_dashboard_complete', data),
    
    /** 获取首页健康概览 */
    getHomepageOverview: (data: any) => callCloudFunction('health-overview', 'get_homepage_health_overview', data),
    
    /** 获取健康统计 */
    getStatistics: (data: any) => callCloudFunction('health-overview', 'get_health_statistics', data),
    
    /** 获取优化的健康统计 */
    getStatisticsOptimized: (data: any) => callCloudFunction('health-overview', 'get_health_statistics_optimized', data),
    
    /** 获取批次完整数据 */
    getBatchCompleteData: (data: any) => callCloudFunction('health-overview', 'get_batch_complete_data', data),
    
    /** 获取批次提示数据 */
    getBatchPromptData: (data: any) => callCloudFunction('health-overview', 'get_batch_prompt_data', data),
    
    /** 获取存活率分析 */
    getSurvivalAnalysis: (data: any) => callCloudFunction('health-overview', 'get_survival_analysis', data),
    
    /** 导出存活率报告 */
    exportSurvivalReport: (data: any) => callCloudFunction('health-overview', 'export_survival_report', data),
  },

  /**
   * 成本计算模块
   */
  cost: {
    /** 计算批次成本 */
    calculateBatch: (data: any) => callCloudFunction('health-cost', 'calculate_batch_cost', data),
    
    /** 计算治疗成本 */
    calculateTreatment: (data: any) => callCloudFunction('health-cost', 'calculate_treatment_cost', data),
    
    /** 计算批次治疗成本 */
    calculateBatchTreatments: (data: any) => callCloudFunction('health-cost', 'calculate_batch_treatment_costs', data),
    
    /** 同步疫苗成本到财务 */
    syncVaccineCosts: (data: any) => callCloudFunction('health-cost', 'sync_vaccine_costs_to_finance', data),
    
    /** 计算健康率 */
    calculateHealthRate: (data: any) => callCloudFunction('health-cost', 'calculate_health_rate', data),
    
    /** 获取成本分析数据 */
    getAnalysis: (data: any) => callCloudFunction('health-cost', 'get_cost_analysis', data),
    
    /** 导出成本报告 */
    exportReport: (data: any) => callCloudFunction('health-cost', 'export_cost_report', data),
  },

  /**
   * AI诊断模块
   */
  ai: {
    /** 创建AI诊断 */
    create: (data: any) => callCloudFunction('ai-diagnosis', 'create_ai_diagnosis', data),
    
    /** 获取诊断历史 */
    getHistory: (data: any) => callCloudFunction('ai-diagnosis', 'get_diagnosis_history', data),
    
    /** 获取诊断详情 */
    getDiagnosis: (data: any) => callCloudFunction('ai-diagnosis', 'get_ai_diagnosis', data),
  },
}

/**
 * 导出简化的调用方式
 */
export const {
  prevention,
  treatment,
  death,
  abnormal,
  records,
  overview,
  cost,
  ai
} = HealthCloud

/**
 * 默认导出
 */
export default HealthCloud

/**
 * 养殖任务云函数封装
 * 统一使用下划线命名（符合项目规则）
 */
export const BreedingCloud = {
  /**
   * 待办任务模块
   */
  todo: {
    /** 获取今日待办任务 */
    getTodos: (data: any) => callCloudFunction('breeding-todo', 'get_todos', data),
    
    /** 获取今日任务（别名） */
    getTodayTasks: (data: any) => callCloudFunction('breeding-todo', 'get_todos', data),
    
    /** 获取一周任务 */
    getWeeklyTodos: (data: any) => callCloudFunction('breeding-todo', 'get_weekly_todos', data),
    
    /** 获取即将到来的任务 */
    getUpcomingTodos: (data: any) => callCloudFunction('breeding-todo', 'get_upcoming_todos', data),
    
    /** 获取已完成任务 */
    getCompletedTodos: (data: any) => callCloudFunction('breeding-todo', 'get_completed_todos', data),
    
    /** 完成任务 */
    completeTask: (data: any) => callCloudFunction('breeding-todo', 'complete_task', data),
    
    /** 完成疫苗任务 */
    completeVaccineTask: (data: any) => callCloudFunction('breeding-todo', 'complete_vaccine_task', data),
    
    /** 清除已完成任务 */
    clearCompletedTasks: (data: any) => callCloudFunction('breeding-todo', 'clear_completed_tasks', data),
    
    /** 修复批次任务 */
    fixBatchTasks: (data: any) => callCloudFunction('breeding-todo', 'fix_batch_tasks', data),
    
    /** 清理孤儿任务 */
    cleanOrphanTasks: (data: any) => callCloudFunction('breeding-todo', 'clean_orphan_tasks', data),
    
    /** 强制清理所有孤儿任务 */
    cleanAllOrphanTasks: (data: any) => callCloudFunction('breeding-todo', 'clean_all_orphan_tasks', data),
    
    /** 强制清理所有孤儿任务（完整版） */
    cleanAllOrphanTasksForce: (data: any) => callCloudFunction('breeding-todo', 'clean_all_orphan_tasks_force', data),
  }
}
