/**
 * 健康模块 - 记录格式化工具
 */

import type { CuredRecord as BaseCuredRecord } from '../types/treatment'

export interface CuredRecordStats {
  totalCured: number
  totalCost: number
  totalMedicationCost: number
  avgCostPerAnimal: number
}

export interface FormattedCuredRecord extends BaseCuredRecord {
  formattedCuredCost: string
  formattedMedicationCost: string
  formattedCostPerAnimal: string
}

export function formatCuredRecords(records: BaseCuredRecord[]): {
  derivedRecords: FormattedCuredRecord[]
  stats: CuredRecordStats
} {
  let totalCured = 0
  let totalCost = 0
  let totalMedicationCost = 0

  const derivedRecords = records.map(record => {
    const curedCount = record.outcome?.curedCount ?? 0
    const curedCost = record.outcome?.curedCost ?? 0
    const medicationCost = record.outcome?.curedMedicationCost ?? 0

    totalCured += curedCount
    totalCost += curedCost
    totalMedicationCost += medicationCost

    return {
      ...record,
      formattedCuredCost: curedCost.toFixed(2),
      formattedMedicationCost: medicationCost.toFixed(2),
      formattedCostPerAnimal: curedCount > 0 ? (curedCost / curedCount).toFixed(2) : '0.00'
    }
  })

  const avgCostPerAnimal = totalCured > 0 ? totalCost / totalCured : 0

  return {
    derivedRecords,
    stats: {
      totalCured,
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalMedicationCost: parseFloat(totalMedicationCost.toFixed(2)),
      avgCostPerAnimal: parseFloat(avgCostPerAnimal.toFixed(2))
    }
  }
}
