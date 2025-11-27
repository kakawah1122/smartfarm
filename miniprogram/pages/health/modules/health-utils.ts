// health-utils.ts - 健康管理工具函数模块

import { formatTime } from '../../../utils/util'

/**
 * 获取预防类型显示文本
 */
export function getPreventionTypeText(type: string): string {
  const typeMap: { [key: string]: string } = {
    'vaccine': '疫苗接种',
    'disinfection': '消毒防疫',
    'nutrition': '营养补充',
    'inspection': '健康检查'
  }
  return typeMap[type] || type
}

/**
 * 获取严重程度颜色
 */
export function getSeverityColor(severity: string): string {
  const colorMap: { [key: string]: string } = {
    'low': '#52c41a',
    'medium': '#faad14',
    'high': '#ff4d4f',
    'critical': '#a8071a'
  }
  return colorMap[severity] || '#d9d9d9'
}

/**
 * 获取健康状态图标
 */
export function getHealthStatusIcon(healthyRate: string): string {
  const rate = parseFloat(healthyRate)
  if (rate >= 95) return '🟢'
  if (rate >= 90) return '🟡'
  if (rate >= 80) return '🟠'
  return '🔴'
}

/**
 * 格式化数字显示
 */
export function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

/**
 * 格式化金额显示
 */
export function formatAmount(amount: number): string {
  return '¥' + amount.toFixed(2)
}

/**
 * 获取治疗状态文本
 */
export function getTreatmentStatusText(status: string): string {
  const statusMap: { [key: string]: string } = {
    'ongoing': '治疗中',
    'cured': '已治愈',
    'died': '已死亡',
    'completed': '已完成',
    'pending': '待处理'
  }
  return statusMap[status] || '未知'
}

/**
 * 初始化时间范围（最近N天）
 */
export function initDateRange(days: number = 30): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  return {
    start: formatTime(start, 'date'),
    end: formatTime(end, 'date')
  }
}

