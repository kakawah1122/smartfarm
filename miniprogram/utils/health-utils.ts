/**
 * 健康管理工具函数
 * 提取健康页面中的公共逻辑，提升代码复用性和可维护性
 */

/**
 * 判断是否为疫苗任务
 */
export function isVaccineTask(task: any): boolean {
  if (!task) return false
  
  if (task.type === 'vaccine') return true
  
  const vaccineKeywords = [
    '疫苗', '接种', '免疫', '注射', '血清', '抗体',
    '一针', '二针', '三针', '新城疫', '禽流感',
    'vaccine', 'vaccination', 'immunization'
  ]
  
  const title = task.title || ''
  const description = task.description || ''
  const taskName = task.taskName || ''
  
  return vaccineKeywords.some(keyword => 
    title.includes(keyword) || 
    description.includes(keyword) || 
    taskName.includes(keyword)
  )
}

/**
 * 判断是否为用药管理任务
 */
export function isMedicationTask(task: any): boolean {
  if (!task) return false
  
  if (task.type === 'medication' || task.type === 'medicine') {
    return true
  }
  
  const medicationKeywords = [
    '用药', '药品', '投药', '喂药', '给药', '抗生素',
    '消炎', '治疗', '药物', '中药', '西药',
    'medication', 'medicine', 'drug'
  ]
  
  const title = task.title || ''
  const description = task.description || ''
  
  return medicationKeywords.some(keyword => 
    title.includes(keyword) || description.includes(keyword)
  )
}

/**
 * 判断是否为营养管理任务
 */
export function isNutritionTask(task: any): boolean {
  if (!task) return false
  
  if (task.type === 'nutrition') {
    return true
  }
  
  const nutritionKeywords = [
    '营养', '营养品', '葡萄糖', '维生素', '电解质', '营养液',
    '营养水', '糖水', '红糖', '多维',
    'nutrition', 'vitamin', 'glucose'
  ]
  
  const title = task.title || ''
  const description = task.description || ''
  
  return nutritionKeywords.some(keyword => 
    title.includes(keyword) || description.includes(keyword)
  )
}

/**
 * 获取任务类型的显示名称
 */
export function getTaskTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    'vaccine': '疫苗',
    'medication': '用药',
    'medicine': '用药',
    'nutrition': '营养',
    'inspection': '巡检',
    'disinfection': '消毒',
    'cleaning': '清洁',
    'feeding': '喂养',
    'care': '护理',
    'health': '检查',
    'other': '其他'
  }
  return typeMap[type] || '其他'
}

/**
 * 按批次分组任务
 */
export function groupTasksByBatch(tasks: any[] = []) {
  const batchesMap: Record<string, {
    batchId: string
    batchNumber: string
    dayAge: number
    tasks: any[]
  }> = {}

  tasks.forEach((task: any) => {
    if (!task) return

    const batchId = task.batchId || 'unknown'
    const batchNumber = task.batchNumber || batchId
    const dayAge = typeof task.dayAge === 'number' 
      ? task.dayAge 
      : Number(task.dayAge) || 0

    if (!batchesMap[batchId]) {
      batchesMap[batchId] = {
        batchId,
        batchNumber,
        dayAge,
        tasks: []
      }
    }

    batchesMap[batchId].tasks.push({
      ...task,
      batchId,
      batchNumber,
      dayAge
    })
  })

  const groups = Object.values(batchesMap)

  // 对每个批次的任务排序
  groups.forEach(group => {
    group.tasks.sort((a: any, b: any) => {
      // 优先级排序
      const priorityDiff = (a.priority || 0) - (b.priority || 0)
      if (priorityDiff !== 0) return priorityDiff

      // 目标日期排序
      const timeA = a.targetDate ? new Date(a.targetDate).getTime() : 0
      const timeB = b.targetDate ? new Date(b.targetDate).getTime() : 0
      return timeA - timeB
    })
  })

  // 批次按日龄和编号排序
  groups.sort((a, b) => {
    if (a.dayAge !== b.dayAge) return a.dayAge - b.dayAge
    return (a.batchNumber || '').localeCompare(b.batchNumber || '')
  })

  return groups
}

/**
 * 计算当前日龄
 * 入栏当天为第1日龄
 */
export function calculateCurrentAge(entryDate: string): number {
  if (!entryDate) return 0
  
  // 使用本地时区的日期，避免时区问题
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDay = today.getDate()
  
  // 解析入栏日期
  const entryDateStr = entryDate.split('T')[0] // YYYY-MM-DD
  const [entryYear, entryMonth, entryDay] = entryDateStr.split('-').map(Number)
  
  // 创建本地时区的日期对象（忽略时间部分）
  const todayDate = new Date(todayYear, todayMonth, todayDay)
  const startDate = new Date(entryYear, entryMonth - 1, entryDay) // 月份从0开始
  
  // 计算日期差异
  const diffTime = todayDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const dayAge = diffDays + 1 // 入栏当天为第1日龄
  
  return Math.max(1, dayAge) // 至少为1
}

/**
 * 格式化日期
 */
export function formatDate(date: string | Date, format: string = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(d.getTime())) return ''
  
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
}

/**
 * 格式化货币
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '¥0.00'
  
  return '¥' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 计算百分比
 */
export function calculatePercentage(value: number, total: number, decimals: number = 1): number {
  if (total === 0) return 0
  return parseFloat(((value / total) * 100).toFixed(decimals))
}

/**
 * 安全解析数字
 */
export function safeParseNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const num = parseFloat(value)
    return isNaN(num) ? defaultValue : num
  }
  return defaultValue
}

/**
 * 批量更新数据（优化setData调用）
 */
export function batchSetData(page: any, updates: Record<string, any>) {
  const data: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(updates)) {
    data[key] = value
  }
  
  page.setData(data)
}

