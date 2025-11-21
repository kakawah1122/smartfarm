/**
 * 健康管理云函数路由工具
 * 根据 action 自动路由到对应的云函数
 */

// Action 到云函数的映射
const ACTION_TO_FUNCTION_MAP: Record<string, string> = {
  // health-cost 云函数
  'calculate_batch_cost': 'health-cost',
  'calculateBatchCost': 'health-cost',
  'calculate_treatment_cost': 'health-cost',
  'calculate_batch_treatment_costs': 'health-cost',
  'recalculate_death_cost': 'health-cost',
  'recalculate_all_death_costs': 'health-cost',
  'calculate_health_rate': 'health-cost',
  
  // health-overview 云函数
  'get_health_overview': 'health-overview',
  'get_all_batches_health_summary': 'health-overview',
  'get_dashboard_snapshot': 'health-overview',
  'get_homepage_health_overview': 'health-overview',
  
  // health-abnormal 云函数
  'create_abnormal_record': 'health-abnormal',
  'list_abnormal_records': 'health-abnormal',
  'get_abnormal_record_detail': 'health-abnormal',
  'update_abnormal_status': 'health-abnormal',
  'get_abnormal_stats': 'health-abnormal',
  'correct_abnormal_diagnosis': 'health-abnormal',
  'delete_abnormal_records': 'health-abnormal',
  
  // health-prevention 云函数
  'create_prevention_record': 'health-prevention',
  'list_prevention_records': 'health-prevention',
  'get_prevention_dashboard': 'health-prevention',
  'getPreventionDashboard': 'health-prevention'
}

/**
 * 智能调用健康管理云函数
 * 自动根据 action 路由到正确的云函数
 */
export async function callHealthFunction(data: {
  action: string;
  [key: string]: unknown;
}): Promise<unknown> {
  const { action } = data
  
  // 查找对应的云函数
  const functionName = ACTION_TO_FUNCTION_MAP[action]
  
  if (functionName) {
    // 调用新的独立云函数
    try {
      const res = await wx.cloud.callFunction({
        name: functionName,
        data
      })
      return res.result
    } catch (error) {
      console.error(`[callHealthFunction] 调用 ${functionName} 失败:`, error)
      throw error
    }
  } else {
    // 调用原有的 health-management 云函数
    try {
      const res = await wx.cloud.callFunction({
        name: 'health-management',
        data
      })
      return res.result
    } catch (error) {
      console.error(`[callHealthFunction] 调用 health-management 失败:`, error)
      throw error
    }
  }
}

/**
 * 批量调用健康管理云函数
 */
export async function batchCallHealthFunction(
  requests: Array<{ action: string; [key: string]: unknown}>
): Promise<any[]> {
  const promises = requests.map(data => callHealthFunction(data))
  return Promise.all(promises)
}

/**
 * 检查 action 是否已拆分到新云函数
 */
export function isActionMigrated(action: string): boolean {
  return action in ACTION_TO_FUNCTION_MAP
}

/**
 * 获取 action 对应的云函数名称
 */
export function getFunctionName(action: string): string {
  return ACTION_TO_FUNCTION_MAP[action] || 'health-management'
}
