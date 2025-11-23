/**
 * 治疗记录页面类型定义
 */

/**
 * 页面参数类型
 */
export interface TreatmentPageOptions {
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
  affectedCount?: string | number
}

/**
 * AI建议类型
 */
export interface AISuggestion {
  treatmentPlanSource?: string
  aiMedicationSuggestions?: Array<{
    name: string
    dosage: string
    route: string
    frequency: string
  }>
  diagnosis?: string
}

/**
 * 错误类型
 */
export interface ErrorWithMessage {
  message: string
  code?: string
}

/**
 * 材料类型
 */
export interface Material {
  _id: string
  materialId?: string
  name: string
  category: string
  displayName?: string
  unit?: string
  currentStock?: number
}

/**
 * 批次信息
 */
export interface BatchInfo {
  _id: string
  batchNumber: string
  currentStock?: number
  currentQuantity?: number
  currentCount?: number
}

/**
 * 事件详情类型
 */
export interface EventDetail {
  value?: unknown
  index?: number
  material?: Material
  medication?: unknown
  field?: string
  height?: number
}

/**
 * 自定义事件类型
 */
export type CustomEvent<T = EventDetail> = WechatMiniprogram.CustomEvent<T>

/**
 * 提交结果
 */
export interface SubmitResult {
  success: boolean
  data?: unknown
  message?: string
  type?: string
}

/**
 * 页面实例
 */
export interface PageInstanceWithNavigation {
  __isNavigatingBack?: boolean
  route?: string
}
