/**
 * 云函数调用适配器
 * 
 * ⚠️ 已废弃：请使用 HealthCloud（cloud-functions.ts）替代
 * 
 * 迁移指南：
 * - 健康管理模块：使用 HealthCloud.treatment.xxx / HealthCloud.death.xxx 等
 * - 财务模块：直接使用 safeCloudCall
 * - 生产模块：直接使用 safeCloudCall
 */

import { safeCloudCall } from './safe-cloud-call'

/**
 * @deprecated 已废弃，请使用 HealthCloud（cloud-functions.ts）
 * 
 * 示例迁移：
 * - smartCloudCall('create_treatment_record', data) 
 *   → HealthCloud.treatment.create(data)
 * - smartCloudCall('list_death_records', data) 
 *   → HealthCloud.death.list(data)
 */
export async function smartCloudCall(action: string, data: any = {}) {
  console.warn(`[SmartCloudCall] 已废弃，请迁移到 HealthCloud: action=${action}`)
  
  // 回退到 safeCloudCall
  return await safeCloudCall({
    name: 'health-management',
    data: { action, ...data }
  })
}

