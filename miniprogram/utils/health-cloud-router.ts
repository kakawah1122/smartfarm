/**
 * 健康管理云函数路由工具
 * 使用 safeCloudCall 统一路由，自动路由到正确的云函数
 */

import { safeCloudCall } from './safe-cloud-call'

/**
 * 智能调用健康管理云函数
 * 自动根据 action 路由到正确的云函数（通过 safeCloudCall 统一处理）
 */
export async function callHealthFunction(data: {
  action: string;
  [key: string]: unknown;
}): Promise<unknown> {
  // 使用 safeCloudCall 统一路由，传入 health-management 会自动路由到正确的云函数
  const result = await safeCloudCall({
    name: 'health-management',
    data
  })
  return result
}

/**
 * 批量调用健康管理云函数
 */
export async function batchCallHealthFunction(
  requests: Array<{ action: string; [key: string]: unknown}>
): Promise<unknown[]> {
  const promises = requests.map(data => callHealthFunction(data))
  return Promise.all(promises)
}
