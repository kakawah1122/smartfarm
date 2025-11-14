/**
 * 健康模块 - 异常记录类型定义
 */

export type AbnormalDiagnosisType = 'live_diagnosis' | 'autopsy_analysis'

export interface AbnormalDiagnosisDetails {
  disease: string
  confidence: number
  reasoning?: string
  pathogen?: string
  transmission?: string
  symptoms?: string[]
}

export interface AbnormalRecord {
  _id: string
  batchId: string
  batchNumber: string
  checkDate: string
  affectedCount: number
  symptoms: string
  diagnosis: string
  diagnosisConfidence: number
  diagnosisDetails?: AbnormalDiagnosisDetails
  severity: string
  urgency: string
  status: string
  aiRecommendation: unknown
  images: string[]
  diagnosisId: string
  diagnosisType?: AbnormalDiagnosisType
  autopsyDescription?: string
  deathCount?: number
  totalDeathCount?: number
  createdAt: string
  isCorrected?: boolean
  correctedDiagnosis?: string
  correctionReason?: string
  aiAccuracyRating?: number
  correctedBy?: string
  correctedByName?: string
  correctedAt?: string
}
