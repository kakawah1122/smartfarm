// treatment-record-types.ts - 治疗记录类型定义

// 通用对象类型
export type AnyObject = Record<string, unknown>

// 自定义事件类型
export type CustomEvent<T = Record<string, unknown>> = WechatMiniprogram.CustomEvent<T>

// 错误类型
export interface ErrorWithMessage {
  message?: string
  errMsg?: string
}

// 药物类型
export interface Medication {
  medicationId?: string
  materialId?: string
  name: string
  dosage: string
  route: string
  frequency: string
  startDate: string
  endDate: string
  status: 'ongoing' | 'completed' | 'discontinued'
  quantity?: number
  unit?: string
  specification?: string
}

// 批次信息类型
export interface BatchInfo {
  _id: string
  batchNumber: string
  entryDate?: string
  currentStock?: number
  currentQuantity?: number
  currentCount?: number
  dayAge?: number
  status?: string
}

// 物料类型
export interface MaterialItem {
  _id: string
  name: string
  unit: string
  currentStock: number
  category?: string
  specification?: string
  description?: string
  unitPrice?: number
  avgCost?: number
}

// 表单数据类型
export interface TreatmentFormData {
  treatmentNumber: string
  batchId: string
  batchNumber: string
  animalIds: string[]
  treatmentDate: string
  treatmentType: string
  diagnosis: string
  diagnosisConfidence: number
  affectedCount: number
  notes: string
}

// 治疗方案类型
export interface TreatmentPlan {
  primary: string
  followUpSchedule: string[]
}

// AI诊断结果类型
export interface AIDiagnosisResult {
  primaryDiagnosis?: string
  confidence?: number
  affectedCount?: number
  batchId?: string
  treatmentRecommendation?: {
    immediate?: string[]
    medication?: MedicationSuggestion[]
  }
}

// 用药建议类型
export interface MedicationSuggestion {
  name: string
  dosage?: string
  route?: string
  frequency?: string
  duration?: string
  notes?: string
}

// 治疗记录详情类型
export interface TreatmentRecordDetail {
  _id: string
  batchId: string
  batchNumber?: string
  treatmentDate: string
  treatmentType: string
  diagnosis?: {
    confirmed?: string
    preliminary?: string
    confidence?: number
  }
  affectedCount?: number
  notes?: string
  treatmentPlan?: TreatmentPlan
  medications?: Medication[]
  isDraft?: boolean
  abnormalRecordId?: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

// 进展记录类型
export interface ProgressRecord {
  _id?: string
  treatmentId: string
  recordDate: string
  overallStatus: string
  recoveredCount: number
  stillTreatingCount: number
  deadCount: number
  symptoms?: string
  notes?: string
  createdAt?: string
}

// 云函数返回类型
export interface CloudResult<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// 页面选项类型
export interface PageOptions {
  sourceType?: string
  sourceId?: string
  diagnosisId?: string
  batchId?: string
  batchNumber?: string
  treatmentId?: string
  id?: string
  abnormalRecordId?: string
  diagnosis?: string
  mode?: string
  affectedCount?: string
}

// 给药途径选项
export const ROUTE_OPTIONS = [
  { label: '口服', value: 'oral' },
  { label: '肌肉注射', value: 'intramuscular' },
  { label: '皮下注射', value: 'subcutaneous' },
  { label: '静脉注射', value: 'intravenous' },
  { label: '外用', value: 'topical' },
  { label: '饮水给药', value: 'drinking' },
  { label: '拌料给药', value: 'feed' }
]

// 用药频率选项
export const FREQUENCY_OPTIONS = [
  { label: '每日1次', value: 'qd' },
  { label: '每日2次', value: 'bid' },
  { label: '每日3次', value: 'tid' },
  { label: '隔日1次', value: 'qod' },
  { label: '必要时', value: 'prn' }
]

// 治疗类型选项
export const TREATMENT_TYPE_OPTIONS = [
  { label: '药物治疗', value: 'medication', icon: 'service', desc: '使用药物进行治疗' }
]
