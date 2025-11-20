import { safeCloudCall } from '../../../utils/safe-cloud-call'
import { callHealthFunction } from '../../../utils/health-cloud-router'

const ALL_BATCHES_CACHE_KEY = 'health_cache_all_batches_snapshot_v1'
const CACHE_DURATION = 5 * 60 * 1000

let pendingAllBatchesPromise: Promise<any> | null = null
let latestAllBatchesSnapshot: any = null
let latestAllBatchesFetchedAt = 0

function getCachedAllBatchesData() {
  try {
    const cached = wx.getStorageSync(ALL_BATCHES_CACHE_KEY) as { timestamp: number; data: any }
    if (!cached) return null
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      return null
    }
    return cached.data
  } catch (error) {
    return null
  }
}

function setCachedAllBatchesData(data: any) {
  try {
    wx.setStorageSync(ALL_BATCHES_CACHE_KEY, {
      timestamp: Date.now(),
      data
    })
  } catch (error) {
    // 缓存失败不影响主流程
  }
}

export function invalidateAllBatchesCache() {
  pendingAllBatchesPromise = null
  latestAllBatchesSnapshot = null
  latestAllBatchesFetchedAt = 0
  try {
    wx.removeStorageSync(ALL_BATCHES_CACHE_KEY)
  } catch (error) {
    // 清理失败静默处理
  }
}

export async function getAllBatchesSnapshot(options: { useCache?: boolean; forceRefresh?: boolean } = {}) {
  const { useCache = true, forceRefresh = false } = options
  const now = Date.now()

  if (!forceRefresh && pendingAllBatchesPromise) {
    return pendingAllBatchesPromise
  }

  if (!forceRefresh && useCache) {
    const isMemoryValid = latestAllBatchesSnapshot && (now - latestAllBatchesFetchedAt) < CACHE_DURATION
    if (isMemoryValid) {
      return latestAllBatchesSnapshot
    }

    const cached = getCachedAllBatchesData()
    if (cached) {
      latestAllBatchesSnapshot = cached
      latestAllBatchesFetchedAt = now
      return cached
    }
  }

  const fetchPromise = (async () => {
    const snapshotResult = await callHealthFunction({
      action: 'get_dashboard_snapshot',
      batchId: 'all',
      dateRange: 'all',
      includeDiagnosis: true,
      diagnosisLimit: 10,
      includeAbnormalRecords: true,
      abnormalLimit: 50
    })

    if (!snapshotResult || !snapshotResult.success) {
      throw new Error(snapshotResult?.error || '获取健康面板数据失败')
    }

    const rawData = snapshotResult.data || {}
    const normalized = {
      batches: rawData.batches || [],
      totalBatches: rawData.totalBatches ?? ((rawData.batches || []).length),
      totalAnimals: Number(rawData.totalAnimals ?? 0) || 0,
      deadCount: Number(rawData.deadCount ?? 0) || 0,
      sickCount: Number(rawData.sickCount ?? 0) || 0,
      actualHealthyCount: Number(rawData.actualHealthyCount ?? 0) || 0,
      healthyRate: rawData.healthyRate || '0',
      mortalityRate: rawData.mortalityRate || '0',
      abnormalCount: Number(rawData.abnormalCount ?? 0) || 0,
      abnormalRecordCount: Number(rawData.abnormalRecordCount ?? 0) || 0,
      abnormalRecords: rawData.abnormalRecords || [],
      totalOngoing: Number(rawData.totalOngoing ?? 0) || 0,
      totalOngoingRecords: Number(rawData.totalOngoingRecords ?? 0) || 0,
      totalTreatmentCost: Number(rawData.totalTreatmentCost ?? 0) || 0,
      totalTreated: Number(rawData.totalTreated ?? 0) || 0,
      totalCured: Number(rawData.totalCured ?? 0) || 0,
      totalDiedAnimals: Number(rawData.totalDiedAnimals ?? 0) || 0,
      totalDied: Number(rawData.totalDied ?? rawData.totalDiedAnimals ?? 0) || 0,
      cureRate: rawData.cureRate || '0',
      pendingDiagnosis: Number(rawData.pendingDiagnosis ?? 0) || 0,
      latestDiagnosisRecords: rawData.latestDiagnosisRecords || [],
      originalTotalQuantity: Number(rawData.originalTotalQuantity ?? 0) || 0,
      fetchedAt: Date.now()
    }

    setCachedAllBatchesData(normalized)
    latestAllBatchesSnapshot = normalized
    latestAllBatchesFetchedAt = normalized.fetchedAt

    return normalized
  })()

  if (!forceRefresh) {
    pendingAllBatchesPromise = fetchPromise
  }

  try {
    return await fetchPromise
  } finally {
    if (!forceRefresh) {
      pendingAllBatchesPromise = null
    }
  }
}

export async function getBatchCompleteData(params: {
  batchId: string
  includes?: string[]
  diagnosisLimit?: number
  preventionLimit?: number
}) {
  const result = await safeCloudCall({
    name: 'health-management',
    data: {
      action: 'get_batch_complete_data',
      ...params
    }
  })

  if (!result || !result.success) {
    throw new Error(result?.error || '获取批次数据失败')
  }

  return result.data || {}
}

export function buildHealthStatsUpdate(healthData: any, preventionStats: any, options: {
  vaccinationRate: number
  batchesWithPrevention: any[]
  diagnosisHistory?: any[]
  abnormalList?: any[]
}) {
  const { vaccinationRate, batchesWithPrevention, diagnosisHistory, abnormalList } = options
  const originalQuantity = healthData.originalTotalQuantity || 0
  return {
    healthStats: {
      totalChecks: healthData.totalAnimals,
      healthyCount: healthData.actualHealthyCount,
      sickCount: healthData.sickCount,
      deadCount: healthData.deadCount,
      healthyRate: originalQuantity > 0 ? (healthData.healthyRate + '%') : '-',
      mortalityRate: originalQuantity > 0 ? (healthData.mortalityRate + '%') : '-',
      abnormalCount: healthData.abnormalRecordCount,
      treatingCount: healthData.totalOngoingRecords,
      originalQuantity
    },
    preventionStats,
    'preventionData.stats': {
      vaccinationRate,
      vaccineCount: preventionStats.vaccineCount,
      medicationCount: preventionStats.medicationCount,
      vaccineCoverage: preventionStats.vaccineCoverage,
      preventionCost: preventionStats.totalCost
    },
    'preventionData.recentRecords': [],
    recentPreventionRecords: [],
    batchPreventionList: batchesWithPrevention,
    activeHealthAlerts: [],
    'treatmentStats.totalTreatments': healthData.totalTreated,
    'treatmentStats.totalCost': healthData.totalTreatmentCost,
    'treatmentStats.recoveredCount': healthData.totalCured,
    'treatmentStats.ongoingCount': healthData.totalOngoingRecords,
    'treatmentStats.recoveryRate': healthData.cureRate + '%',
    'treatmentData.stats.pendingDiagnosis': healthData.pendingDiagnosis,
    'treatmentData.stats.ongoingTreatment': healthData.totalOngoing,
    'treatmentData.stats.totalTreatmentCost': healthData.totalTreatmentCost,
    'treatmentData.stats.cureRate': parseFloat(healthData.cureRate),
    'treatmentData.stats.ongoingAnimalsCount': healthData.totalOngoing,
    'treatmentData.stats.recoveredCount': healthData.totalCured,
    'treatmentData.stats.deadCount': healthData.deadCount || healthData.totalDied || 0,
    'treatmentData.diagnosisHistory': diagnosisHistory ?? (healthData.latestDiagnosisRecords || []),
    'monitoringData.realTimeStatus.abnormalCount': healthData.abnormalRecordCount,
    'monitoringData.abnormalList': abnormalList ?? (healthData.abnormalRecords || [])
  }
}
