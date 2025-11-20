/// <reference path="./wx/index.d.ts" />

declare namespace HealthSchema {
  interface DiagnosisRecord {
    _id?: string
    batchId?: string
    diagnosisDate?: string
    createTime?: string
    [key: string]: any
  }

  interface HealthDashboardBatch {
    batchId?: string
    batchNumber?: string
    totalAnimals?: number
    healthyCount?: number
    sickCount?: number
    deadCount?: number
    [key: string]: any
  }

  interface HealthDashboardSnapshot {
    batches: HealthDashboardBatch[]
    totalBatches: number
    totalAnimals: number
    deadCount: number
    sickCount: number
    actualHealthyCount: number
    healthyRate: string
    mortalityRate: string
    abnormalCount: number
    abnormalRecordCount: number
    abnormalRecords: any[]
    totalOngoing: number
    totalOngoingRecords: number
    totalTreatmentCost: number
    totalTreated: number
    totalCured: number
    totalDiedAnimals: number
    totalDied: number
    cureRate: string
    pendingDiagnosis: number
    latestDiagnosisRecords: DiagnosisRecord[]
    originalTotalQuantity: number
    fetchedAt: number
  }

  interface PreventionStats {
    totalPreventions: number
    vaccineCount: number
    vaccineCoverage: number
    medicationCount: number
    vaccineStats: Record<string, number>
    disinfectionCount: number
    totalCost: number
  }

  interface TreatmentStats {
    ongoingCount: number
    ongoingAnimalsCount: number
    totalCost: number
    totalTreated: number
    totalCuredAnimals: number
    cureRate: string
  }

  interface BatchInfo {
    _id?: string
    batchNumber?: string
    quantity?: number
    [key: string]: any
  }

  interface BatchCompleteData {
    healthStats: Record<string, any>
    preventionStats: PreventionStats
    preventionRecords: any[]
    diagnosisHistory: DiagnosisRecord[]
    abnormalRecords: any[]
    abnormalCount: number
    pendingDiagnosisCount: number
    treatmentStats: TreatmentStats
    batchInfo?: BatchInfo
    [key: string]: any
  }
}
