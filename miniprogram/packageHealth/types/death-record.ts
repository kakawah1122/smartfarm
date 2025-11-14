/**
 * 健康模块 - 死亡记录类型定义
 */

export type AnyObject = Record<string, unknown>

export interface AutopsyFindingsNormalized {
  abnormalities: string[]
  description?: string
}

export interface DiagnosisResult extends AnyObject {
  primaryCause?: string
  primaryDiagnosis?: string
  differentialCauses?: AnyObject[]
  differentialDiagnosis?: AnyObject[]
  preventionAdvice?: string[]
  preventionMeasures?: string[]
}

export interface DeathRecord {
  _id: string
  batchId: string
  batchNumber: string
  deathDate: string
  deathCount: number
  deathCause: string
  treatmentId?: string
  totalDeathCount?: number
  deathCategory?: string
  financialLoss?: {
    totalLoss?: number | string
    costPerAnimal?: number | string
    treatmentCost?: number | string
  }
  financeLoss?: number | string
  unitCost?: number | string
  breedingCost?: number | string
  treatmentCost?: number | string
  source?: string
  aiDiagnosisId?: string
  diagnosisResult?: DiagnosisResult | string | null
  autopsyImages?: string[]
  autopsyFindings?: AutopsyFindingsNormalized | string | null
  isCorrected?: boolean
  correctedCause?: string
  correctionReason?: string
  correctionType?: string
  aiAccuracyRating?: number
  veterinarianNote?: string
  correctedBy?: string
  correctedByName?: string
  correctedAt?: string
  operatorName?: string
  description?: string
  symptomsText?: string
  createdAt?: string | Date
  displayDeathCause?: string
  displayFindings?: string
  unitCostDisplay?: string
  breedingCostDisplay?: string
  treatmentCostDisplay?: string
  financeLossDisplay?: string
}
