// breeding-todo-types.ts - 待办任务类型定义

// 通用对象类型
export type AnyObject = Record<string, unknown>

// 自定义事件类型
export type CustomEvent<T = Record<string, unknown>> = WechatMiniprogram.CustomEvent<T>

// 错误类型
export interface ErrorWithMessage {
  message?: string
  errMsg?: string
}

// 任务类型
export interface Task {
  _id: string
  id?: string
  taskId?: string
  title: string
  content?: string
  description: string
  type: string
  dayAge: number | string
  batchId: string
  batchNumber?: string
  completed: boolean
  completedDate?: string
  isVaccineTask: boolean
  isMedicationTask: boolean
  isNutritionTask: boolean
  estimatedDuration: number
  estimatedTime?: number
  duration?: number
  dayInSeries?: number
  dosage?: string
  notes?: string
  materials?: string[]
}

// 疫苗表单数据
export interface VaccineFormData {
  // 兽医信息
  veterinarianName: string
  veterinarianContact: string
  
  // 疫苗信息
  vaccineName: string
  manufacturer: string
  batchNumber: string
  dosage: string
  routeIndex: number
  
  // 接种信息
  vaccinationCount: number
  location: string
  
  // 费用信息
  vaccineCost: string
  veterinaryCost: string
  otherCost: string
  totalCost: number
  totalCostFormatted: string
  
  // 备注
  notes: string
}

// 用药表单数据
export interface MedicationFormData {
  medicineName: string
  medicineId: string
  dosage: string
  quantity: number
  unit: string
  notes: string
}

// 营养表单数据
export interface NutritionFormData {
  nutritionName: string
  nutritionId: string
  dosage: string
  quantity: number
  unit: string
  notes: string
}

// 页面参数类型
export interface PageOptions {
  showAllBatches?: string
  batchId?: string
  dayAge?: string
  openVaccineForm?: string
  openMedicationForm?: string
  taskId?: string
}

// 批次类型
export interface BatchInfo {
  _id: string
  batchNumber: string
  entryDate?: string
  dayAge?: number
  tasks?: Task[]
  completed?: boolean
}

// 物料类型
export interface MaterialItem {
  _id: string
  name: string
  unit: string
  currentStock: number
  category?: string
  description?: string
  unitPrice?: number
  avgCost?: number
  price?: number
}

// 完成记录类型
export interface CompletedRecord {
  _id?: string
  title?: string
  completed?: boolean
  completedAt?: string
  completedBy?: string
  completedDate?: string
}

// 云函数返回类型
export interface CloudResult<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// 按批次分组的任务
export interface TasksByBatch {
  batchId: string
  batchNumber: string
  dayAge: number
  tasks: Task[]
}
