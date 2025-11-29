// lifecycle-types.ts - 生命周期管理类型定义

// 通用对象类型
export type AnyObject = Record<string, unknown>

// 自定义事件类型
export type CustomEvent<T = Record<string, unknown>> = WechatMiniprogram.CustomEvent<T>

// 错误类型
export interface ErrorWithMessage {
  message?: string
  errMsg?: string
}

// 任务类型枚举
export type TaskType = 
  | 'inspection' 
  | 'vaccination' 
  | 'medication' 
  | 'nutrition' 
  | 'feeding' 
  | 'special'

// 优先级枚举
export type Priority = 'low' | 'medium' | 'high'

// 任务分类枚举
export type TaskCategory = 
  | '全部' 
  | '健康管理' 
  | '用药管理' 
  | '营养管理' 
  | '疫苗接种' 
  | '饲养管理' 
  | '特殊护理'

// 任务接口
export interface Task {
  _id?: string
  id?: string
  title?: string
  dayAge?: number
  type?: TaskType
  category?: TaskCategory
  priority?: Priority
  description?: string
  dosage?: string
  duration?: number
  isSequenceTask?: boolean
  isVaccineTask?: boolean
  isMedicationTask?: boolean
  isNutritionTask?: boolean
  materials?: string[]
  notes?: string
  templateId?: string
  [key: string]: unknown
}

// 任务分组接口
export interface TaskGroup {
  dayAge: number
  tasks: Task[]
  isExpanded?: boolean
  [key: string]: unknown
}

// 模板接口
export interface Template {
  _id?: string
  templateId?: string
  templateName?: string
  name?: string
  description?: string
  taskCount?: number
  isDefault?: boolean
  isActive?: boolean
  createTime?: string
  updateTime?: string
  tasks?: Task[]
  userId?: string
  [key: string]: unknown
}

// 编辑任务表单数据
export interface EditingTask {
  id: string
  dayAge: number
  title: string
  type: TaskType
  category: TaskCategory
  priority: Priority
  description: string
  dosage: string
  duration: number
}

// 窗口信息类型
export interface WindowInfo {
  statusBarHeight?: number
  screenWidth?: number
  screenHeight?: number
}

// 云函数返回类型
export interface CloudResult<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// 任务类型选项
export const TASK_TYPE_OPTIONS = [
  { label: '日常巡检', value: 'inspection', icon: 'check-circle' },
  { label: '疫苗接种', value: 'vaccination', icon: 'service' },
  { label: '用药管理', value: 'medication', icon: 'shop' },
  { label: '营养管理', value: 'nutrition', icon: 'cart' },
  { label: '饲养管理', value: 'feeding', icon: 'home' },
  { label: '特殊护理', value: 'special', icon: 'star' }
]

// 优先级选项
export const PRIORITY_OPTIONS = [
  { label: '低', value: 'low', color: '#52c41a' },
  { label: '中', value: 'medium', color: '#faad14' },
  { label: '高', value: 'high', color: '#f5222d' }
]

// 任务分类选项
export const CATEGORY_OPTIONS: TaskCategory[] = [
  '全部',
  '健康管理',
  '用药管理',
  '营养管理',
  '疫苗接种',
  '饲养管理',
  '特殊护理'
]
