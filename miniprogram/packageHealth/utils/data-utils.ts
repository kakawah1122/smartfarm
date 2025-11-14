/**
 * 健康模块通用数据工具方法
 */

import { logger } from '../../utils/logger'
import type { CuredRecord as BaseCuredRecord } from '../types/treatment'

/**
 * 将单值安全地转换为数组
 */
export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) {
    return value
  }

  if (value === undefined || value === null) {
    return []
  }

  return [value]
}

/**
 * 根据文件 ID 列表获取临时访问 URL
 * 若转换失败，则返回过滤后的原始列表
 */
export async function resolveTempFileURLs(fileIds: string[]): Promise<string[]> {
  const validIds = ensureArray(fileIds).filter(item => typeof item === 'string' && !!item)

  if (validIds.length === 0) {
    return []
  }

  try {
    const result = await wx.cloud.getTempFileURL({
      fileList: validIds
    })

    if (result?.fileList?.length) {
      return result.fileList
        .map((item: { tempFileURL?: string; fileID?: string }) => item.tempFileURL || item.fileID)
        .filter((url: string | undefined): url is string => typeof url === 'string' && !!url)
    }
  } catch (error) {
    logger.warn('获取临时文件 URL 失败，使用原始文件ID:', error)
  }

  return validIds
}

export function formatCurrency(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') {
    return '0.00'
  }

  const numeric = typeof value === 'number' ? value : parseFloat(String(value))

  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
    return '0.00'
  }

  return numeric.toFixed(2)
}

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
