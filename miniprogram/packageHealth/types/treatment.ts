/**
 * 健康模块 - 治疗/治愈记录类型定义
 */

export interface TreatmentOutcome {
  totalTreated: number
  curedCount: number
  deathCount: number
  status: string
  curedCost?: number
  curedMedicationCost?: number
}

export interface TreatmentCostSummary {
  total: number
  medication: number
}

export interface TreatmentPlanInfo {
  primary?: string
}

export interface DiagnosisSummary {
  confirmed?: string
  preliminary?: string
}

export interface CuredRecord {
  _id: string
  batchId: string
  batchNumber: string
  diagnosis: DiagnosisSummary
  treatmentType: string
  treatmentDate: string
  outcome: TreatmentOutcome
  cost: TreatmentCostSummary
  medications: unknown[]
  treatmentPlan: TreatmentPlanInfo
  completedAt?: string
  createdAt?: string | Date
  isDeleted?: boolean
  operatorName?: string
  formattedCuredCost?: string
  formattedMedicationCost?: string
  formattedCostPerAnimal?: string
}
