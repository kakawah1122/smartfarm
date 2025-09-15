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
  // 首先排除用药管理任务
  if (task.type === 'medication' || task.type === 'medicine') {
    return false
  }
  
  // 直接根据类型判断
  if (task.type === 'vaccine') {
    return true
  }
  
  // 通过类型名称判断
  const typeName = TYPE_NAMES[task.type as keyof typeof TYPE_NAMES]
  return typeName === '疫苗管理'
}

/**
 * 检查任务是否为用药管理任务
 * @param task 任务对象
 * @returns 是否为用药管理任务
 */
export function isMedicationTask(task: any): boolean {
  // 直接根据任务类型判断，不需要根据标题内容判断
  if (task.type === 'medication' || task.type === 'medicine') {
    return true
  }
  
  // 如果type字段不匹配，通过类型名称反向判断
  const typeName = TYPE_NAMES[task.type as keyof typeof TYPE_NAMES]
  return typeName === '用药管理'
}

/**
 * 检查任务是否为营养管理任务
 * @param task 任务对象
 * @returns 是否为营养管理任务
 */
export function isNutritionTask(task: any): boolean {
  // 直接根据任务类型判断
  if (task.type === 'nutrition') {
    return true
  }
  
  // 如果type字段不匹配，通过类型名称反向判断
  const typeName = TYPE_NAMES[task.type as keyof typeof TYPE_NAMES]
  return typeName === '营养管理'
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
  TASK_CATEGORIES,
  getTodayTasks,
  calculateDayAge,
  formatTaskDescription,
  isVaccineTask,
  isMedicationTask,
  isNutritionTask,
  getTaskTypeName
}
