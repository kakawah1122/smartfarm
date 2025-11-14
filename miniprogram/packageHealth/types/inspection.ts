/**
 * 健康管理模块 - 巡检相关类型定义
 */

import type { BatchInfo } from './prevention'

/** 巡检结果选项 */
export type InspectionResult = 'normal' | 'abnormal' | 'not_checked'

/** 异常严重程度 */
export type AbnormalSeverity = 'mild' | 'moderate' | 'severe'

/** 巡检项目类别 */
export interface InspectionCategory {
  id: string
  name: string
  icon: string
  color: string
}

/** 巡检项目标的 */
export interface InspectionItem {
  id: string
  name: string
  category: string
  checked: boolean
  result: InspectionResult
  notes?: string
}

/** 异常记录 */
export interface AbnormalFinding {
  id: string
  itemId: string
  itemName: string
  description: string
  affectedCount: number
  severity: AbnormalSeverity
}

/** 巡检表单数据 */
export interface HealthInspectionFormData {
  batchId: string
  locationId: string
  inspector: string
  inspectionDate: string
  inspectionTime: string
  totalInspected: number
  abnormalCount: number
  notes: string
}

/** 巡检统计信息 */
export interface InspectionStats {
  abnormalDiscoveryRate: string
  normalCount: number
  completionRate: string
}

/** 异常记录表单数据 */
export interface AbnormalFormData {
  description: string
  affectedCount: number
  severity: AbnormalSeverity
}

/** 巡检页面数据结构 */
export interface HealthInspectionData {
  formData: HealthInspectionFormData
  inspectionItems: InspectionItem[]
  inspectionCategories: InspectionCategory[]
  abnormalFindings: AbnormalFinding[]
  activeBatches: BatchInfo[]
  activeCategory: string
  calculatedStats: InspectionStats
  formErrors: Record<string, string>
  submitting: boolean
  showAbnormalDialog: boolean
  currentAbnormalItem: InspectionItem | null
  abnormalForm: AbnormalFormData
  loadingBatches: boolean
  batchesCacheTime: number | null
}
