// breeding-schedule.ts - 养殖计划工具函数和常量定义

// 任务类型定义
export const TASK_TYPES = {
  inspection: '检查',
  nutrition: '营养',
  care: '护理',
  vaccine: '疫苗',
  medication: '用药',
  feeding: '饲喂',
  health: '健康',
  environment: '环境',
  observation: '观察'
} as const

// 优先级定义
export const PRIORITY_LEVELS = {
  critical: {
    name: '紧急',
    theme: 'danger',
    priority: 1
  },
  high: {
    name: '重要', 
    theme: 'warning',
    priority: 2
  },
  medium: {
    name: '普通',
    theme: 'primary', 
    priority: 3
  },
  low: {
    name: '较低',
    theme: 'default',
    priority: 4
  }
} as const

// 任务分类定义
export const TASK_CATEGORIES = {
  '健康管理': 'health',
  '营养管理': 'nutrition', 
  '保健管理': 'care',
  '疫苗管理': 'vaccine',
  '用药管理': 'medication',
  '饲养管理': 'feeding',
  '环境管理': 'environment',
  '成熟期管理': 'mature'
} as const

// 反向映射：从type获取中文名称
export const TYPE_NAMES = {
  // breeding-schedule.js中实际使用的类型
  'inspection': '健康管理',
  'nutrition': '营养管理',
  'care': '保健管理',
  'vaccine': '疫苗管理',
  'medication': '用药管理',
  
  // 其他可能的类型
  'health': '健康管理',
  'feed': '饲养管理',
  'feeding': '饲养管理',
  'environment': '环境管理',
  'medicine': '用药管理',
  'cleaning': '清洁消毒',
  'observation': '观察记录',
  'vaccination': '疫苗管理',
  'treatment': '保健管理',
  'disinfection': '消毒管理',
  'weighing': '称重管理',
  'record': '记录管理',
  'emergency': '应急处理'
} as const

/**
 * 获取今日任务（模拟函数，实际应该从云函数获取）
 * @param batchId 批次ID
 * @param dayAge 日龄
 * @returns 今日任务列表
 */
export function getTodayTasks(batchId: string, dayAge: number) {
  // 这个函数在实际使用中会被CloudApi.getTodos替代
  // 这里只是为了兼容现有代码而提供的空实现
  return Promise.resolve([])
}

/**
 * 根据任务类型获取优先级
 * @param type 任务类型
 * @returns 优先级字符串
 */
export function getTaskPriority(type: string): keyof typeof PRIORITY_LEVELS {
  const priorityMap: Record<string, keyof typeof PRIORITY_LEVELS> = {
    'vaccine': 'critical',
    'medication': 'high',
    'inspection': 'high',
    'nutrition': 'medium',
    'care': 'medium',
    'feeding': 'medium',
    'observation': 'low'
  }
  
  return priorityMap[type] || 'medium'
}

/**
 * 计算日龄
 * @param entryDate 入栏日期
 * @returns 当前日龄
 */
export function calculateDayAge(entryDate: string): number {
  const today = new Date()
  const todayDateStr = today.toISOString().split('T')[0]
  const entryDateStr = entryDate.split('T')[0]
  
  const todayDate = new Date(todayDateStr + 'T00:00:00')
  const startDate = new Date(entryDateStr + 'T00:00:00')
  
  const diffTime = todayDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays + 1
}

/**
 * 格式化任务描述
 * @param task 任务对象
 * @returns 格式化后的描述
 */
export function formatTaskDescription(task: any): string {
  let description = task.description || task.title || ''
  
  if (task.dosage) {
    description += ` (用量: ${task.dosage})`
  }
  
  if (task.duration && task.dayInSeries) {
    description += ` [第${task.dayInSeries}/${task.duration}天]`
  }
  
  return description
}

/**
 * 检查任务是否为疫苗任务
 * @param task 任务对象
 * @returns 是否为疫苗任务
 */
export function isVaccineTask(task: any): boolean {
  return task.type === 'vaccine' ||
         task.title?.includes('疫苗') || 
         task.title?.includes('接种') ||
         task.title?.includes('免疫') ||
         task.title?.includes('注射') ||
         task.title?.includes('血清') ||
         task.title?.includes('抗体')
}

/**
 * 获取任务显示名称
 * @param type 任务类型
 * @returns 显示名称
 */
export function getTaskTypeName(type: string): string {
  return TYPE_NAMES[type as keyof typeof TYPE_NAMES] || TASK_TYPES[type as keyof typeof TASK_TYPES] || '其他'
}

export default {
  TASK_TYPES,
  PRIORITY_LEVELS, 
  TASK_CATEGORIES,
  getTodayTasks,
  getTaskPriority,
  calculateDayAge,
  formatTaskDescription,
  isVaccineTask,
  getTaskTypeName
}
