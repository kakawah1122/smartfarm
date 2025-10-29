// health-data-loader.ts - 健康数据加载模块（优化版，包含缓存机制）

import CloudApi from '../../../utils/cloud-api'
import { calculatePreventionStats, formatPreventionRecord } from './health-stats-calculator'

// 数据缓存层
const batchDataCache = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

interface CachedData {
  data: any
  timestamp: number
}

/**
 * 检查缓存是否有效
 */
function isCacheValid(cacheKey: string): boolean {
  const cached = batchDataCache.get(cacheKey) as CachedData
  if (!cached) return false
  
  const now = Date.now()
  return (now - cached.timestamp) < CACHE_DURATION
}

/**
 * 获取缓存数据
 */
function getCachedData(cacheKey: string): any {
  const cached = batchDataCache.get(cacheKey) as CachedData
  return cached ? cached.data : null
}

/**
 * 设置缓存数据
 */
function setCachedData(cacheKey: string, data: any) {
  batchDataCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  })
}

/**
 * 加载所有批次的汇总数据（优化版）
 */
export async function loadAllBatchesData(context: any) {
  const cacheKey = 'all_batches_health'
  
  // 检查缓存
  if (isCacheValid(cacheKey)) {
    const cachedData = getCachedData(cacheKey)
    context.setData(cachedData)
    return
  }
  
  try {
    // 1. 查询批次健康汇总
    const healthResult = await wx.cloud.callFunction({
      name: 'health-management',
      data: { action: 'get_all_batches_health_summary' }
    })

    // 处理健康统计数据
    if (healthResult.result && healthResult.result.success) {
      const data = healthResult.result.data
      const batches = data.batches || []
      
      // 为每个批次并行查询预防记录
      const batchPreventionPromises = batches.map(async (batch: any) => {
        try {
          const result = await CloudApi.listPreventionRecords({
            batchId: batch._id || batch.batchId,
            pageSize: 100
          })
          
          if (result.success && result.data) {
            const records = result.data.records || []
            const stats = calculatePreventionStats(records)
            const formattedRecords = records.slice(0, 3).map((r: any) => formatPreventionRecord(r))
            
            return {
              ...batch,
              preventionStats: stats,
              vaccinationRate: batch.totalCount > 0 
                ? ((stats.vaccineCoverage / batch.totalCount) * 100).toFixed(1)
                : '0',
              recentRecords: formattedRecords
            }
          }
          return { 
            ...batch, 
            preventionStats: { 
              totalPreventions: 0, 
              vaccineCount: 0, 
              vaccineCoverage: 0,
              vaccineStats: {},
              disinfectionCount: 0, 
              totalCost: 0 
            }, 
            vaccinationRate: '0',
            recentRecords: []
          }
        } catch (error) {
          return { 
            ...batch, 
            preventionStats: { 
              totalPreventions: 0, 
              vaccineCount: 0, 
              vaccineCoverage: 0,
              vaccineStats: {},
              disinfectionCount: 0, 
              totalCost: 0 
            }, 
            vaccinationRate: '0',
            recentRecords: []
          }
        }
      })
      
      const batchesWithPrevention = await Promise.all(batchPreventionPromises)
      
      // 计算汇总统计
      const totalAnimals = batches.reduce((sum: number, b: any) => sum + (b.totalCount || 0), 0)
      const healthyCount = batches.reduce((sum: number, b: any) => sum + (b.healthyCount || 0), 0)
      const sickCount = batches.reduce((sum: number, b: any) => sum + (b.sickCount || 0), 0)
      const deadCount = batches.reduce((sum: number, b: any) => sum + (b.deadCount || 0), 0)
      
      // 汇总所有批次的预防统计
      const totalVaccineCoverage = batchesWithPrevention.reduce((sum: number, b: any) => 
        sum + (b.preventionStats?.vaccineCoverage || 0), 0)
      const totalVaccineCount = batchesWithPrevention.reduce((sum: number, b: any) => 
        sum + (b.preventionStats?.vaccineCount || 0), 0)
      const totalPreventions = batchesWithPrevention.reduce((sum: number, b: any) => 
        sum + (b.preventionStats?.totalPreventions || 0), 0)
      const totalCost = batchesWithPrevention.reduce((sum: number, b: any) => 
        sum + (b.preventionStats?.totalCost || 0), 0)
      
      // 合并所有批次的疫苗统计
      const allVaccineStats: { [key: string]: number } = {}
      batchesWithPrevention.forEach((b: any) => {
        if (b.preventionStats?.vaccineStats) {
          Object.entries(b.preventionStats.vaccineStats).forEach(([name, count]) => {
            if (!allVaccineStats[name]) {
              allVaccineStats[name] = 0
            }
            allVaccineStats[name] += count as number
          })
        }
      })
      
      // 获取最近的预防记录
      const allRecentRecords = batchesWithPrevention.flatMap((b: any) => b.recentRecords || [])
      const recentPreventionRecords = allRecentRecords.slice(0, 10)
      
      // 计算总体疫苗接种率
      const vaccinationRate = totalAnimals > 0 
        ? ((totalVaccineCoverage / totalAnimals) * 100).toFixed(1)
        : 0
      
      const preventionStats = {
        totalPreventions,
        vaccineCount: totalVaccineCount,
        vaccineCoverage: totalVaccineCoverage,
        vaccineStats: allVaccineStats,
        disinfectionCount: 0,
        totalCost
      }
      
      // 处理治疗统计数据 - 汇总所有批次
      let totalOngoing = 0
      let totalOngoingRecords = 0
      let totalTreatmentCost = 0
      let totalTreated = 0
      let totalCured = 0
      let totalDied = 0
      
      // 并行查询所有批次的治疗统计
      const treatmentPromises = batches.map(async (batch: any) => {
        try {
          const result = await wx.cloud.callFunction({
            name: 'health-management',
            data: {
              action: 'calculate_treatment_cost',
              batchId: batch._id
            }
          })
          
          if (result.result?.success) {
            const data = result.result.data
            return {
              ongoingCount: data.ongoingCount || 0,
              ongoingAnimalsCount: data.ongoingAnimalsCount || 0,
              totalCost: parseFloat(data.totalCost || '0'),
              totalTreated: data.totalTreated || 0,
              totalCuredAnimals: data.totalCuredAnimals || 0,
              totalDied: data.diedCount || 0
            }
          }
        } catch (error) {
          // 错误处理
        }
        return { ongoingCount: 0, ongoingAnimalsCount: 0, totalCost: 0, totalTreated: 0, totalCuredAnimals: 0, totalDied: 0 }
      })
      
      const treatmentResults = await Promise.all(treatmentPromises)
      
      // 汇总所有批次的治疗数据
      treatmentResults.forEach(result => {
        totalOngoing += result.ongoingAnimalsCount
        totalOngoingRecords += result.ongoingCount
        totalTreatmentCost += result.totalCost
        totalTreated += result.totalTreated
        totalCured += result.totalCuredAnimals
        totalDied += result.totalDied
      })
      
      // 计算总体治愈率和死亡率（都基于治疗总数）
      const cureRate = totalTreated > 0 
        ? ((totalCured / totalTreated) * 100).toFixed(1)
        : '0'
      
      // ✅ 死亡率也基于治疗总数计算
      const mortalityRate = totalTreated > 0 
        ? ((totalDied / totalTreated) * 100).toFixed(1)
        : '0'
      
      const treatmentStats = {
        totalTreatments: totalTreated,
        totalCost: totalTreatmentCost,
        recoveredCount: totalCured,
        ongoingCount: totalOngoingRecords,
        recoveryRate: cureRate + '%'
      }
      
      // 查询所有批次的待处理记录
      const abnormalResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_health_records_by_status',
          batchId: 'all',
          status: 'abnormal'
        }
      })
      
      const abnormalCount = abnormalResult.result?.success 
        ? (abnormalResult.result.data?.totalCount || 0)
        : 0
      const abnormalRecordCount = abnormalResult.result?.success 
        ? (abnormalResult.result.data?.recordCount || 0)
        : 0
      
      // 查询所有批次的隔离记录
      const isolatedResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_health_records_by_status',
          batchId: 'all',
          status: 'isolated'
        }
      })
      
      const isolatedCount = isolatedResult.result?.success 
        ? (isolatedResult.result.data?.totalCount || 0)
        : 0
      const isolatedRecordCount = isolatedResult.result?.success 
        ? (isolatedResult.result.data?.recordCount || 0)
        : 0
      
      // 重新计算健康率（健康率仍基于批次总数）
      const actualHealthyCount = totalAnimals - deadCount - totalOngoing - abnormalCount - isolatedCount
      const healthyRate = totalAnimals > 0 ? ((actualHealthyCount / totalAnimals) * 100).toFixed(1) : '100'
      // 死亡率已在上面计算（基于治疗总数）
      
      // 设置监控数据
      const monitoringData = {
        realTimeStatus: {
          healthyCount: actualHealthyCount,
          abnormalCount: abnormalCount,
          isolatedCount: isolatedCount
        },
        abnormalList: [],
        diseaseDistribution: []
      }
      
      const resultData = {
        healthStats: {
          totalChecks: totalAnimals,
          healthyCount: actualHealthyCount,
          sickCount: sickCount,
          deadCount: deadCount,
          healthyRate: healthyRate + '%',
          mortalityRate: mortalityRate + '%',
          abnormalCount: abnormalRecordCount,
          treatingCount: totalOngoingRecords,
          isolatedCount: isolatedRecordCount
        },
        preventionStats,
        'preventionData.stats': {
          vaccinationRate,
          preventionCost: preventionStats.totalCost
        },
        'preventionData.recentRecords': recentPreventionRecords,
        treatmentStats,
        'treatmentData.stats': {
          pendingDiagnosis: 0,
          ongoingTreatment: totalOngoingRecords,
          totalTreatmentCost: totalTreatmentCost,
          cureRate: parseFloat(cureRate)
        },
        recentPreventionRecords,
        batchPreventionList: batchesWithPrevention,
        activeHealthAlerts: [],
        monitoringData: monitoringData
      }
      
      // 缓存结果
      setCachedData(cacheKey, resultData)
      
      context.setData(resultData)
    }
  } catch (error: any) {
    console.error('loadAllBatchesData 错误:', error)
  }
}

/**
 * 加载单个批次的健康数据（优化版）
 */
export async function loadSingleBatchData(context: any, batchId: string) {
  const cacheKey = `batch_health_${batchId}`
  
  // 检查缓存
  if (isCacheValid(cacheKey)) {
    const cachedData = getCachedData(cacheKey)
    context.setData(cachedData)
    return
  }
  
  try {
    // 并行加载三个主要数据
    await Promise.all([
      loadHealthOverview(context, batchId),
      loadPreventionData(context, batchId),
      loadTreatmentData(context, batchId)
    ])
  } catch (error: any) {
    wx.showToast({
      title: '加载数据失败',
      icon: 'error'
    })
  }
}

/**
 * 加载健康概览数据
 */
async function loadHealthOverview(context: any, batchId: string) {
  try {
    const result = await CloudApi.getHealthOverview(batchId, context.data.dateRange)

    if (result.success && result.data) {
      const { healthStats, recentPrevention, activeAlerts, treatmentStats } = result.data
      
      context.setData({
        healthStats: {
          ...healthStats,
          healthyRate: healthStats.healthyRate + '%',
          mortalityRate: healthStats.mortalityRate + '%',
          abnormalCount: healthStats.abnormalCount || 0,
          treatingCount: healthStats.treatingCount || 0,
          isolatedCount: healthStats.isolatedCount || 0
        },
        recentPreventionRecords: recentPrevention || [],
        activeHealthAlerts: activeAlerts || [],
        treatmentStats: {
          ...treatmentStats,
          recoveryRate: treatmentStats.recoveryRate + '%'
        }
      })
    }
  } catch (error: any) {
    // 错误处理
  }
}

/**
 * 加载预防数据
 */
async function loadPreventionData(context: any, batchId: string) {
  try {
    const result = await CloudApi.listPreventionRecords({
      batchId: batchId,
      pageSize: 20,
      dateRange: context.data.dateRange
    })

    if (result.success && result.data) {
      const records = result.data.records || []
      
      // 格式化记录
      const formattedRecords = records.map((record: any) => formatPreventionRecord(record))
      
      // 计算预防统计
      const preventionStats = calculatePreventionStats(records)
      
      // 获取批次总动物数
      let totalAnimals = 1
      if (batchId && batchId !== 'all') {
        const currentBatch = context.data.availableBatches.find((b: any) => 
          b._id === batchId || b.batchId === batchId
        )
        totalAnimals = currentBatch?.totalCount || currentBatch?.currentCount || context.data.healthStats.totalChecks || 1
      } else {
        totalAnimals = context.data.healthStats.totalChecks || 1
      }
      
      // 计算接种率
      let vaccinationRate = totalAnimals > 0 
        ? ((preventionStats.vaccineCoverage / totalAnimals) * 100)
        : 0
      
      // 限制在100%以内
      if (vaccinationRate > 100) {
        vaccinationRate = 100
      }
      
      context.setData({
        preventionStats,
        recentPreventionRecords: formattedRecords.slice(0, 10),
        'preventionData.stats': {
          vaccinationRate: vaccinationRate.toFixed(1),
          preventionCost: preventionStats.totalCost
        },
        'preventionData.recentRecords': formattedRecords.slice(0, 10)
      })
    }
  } catch (error: any) {
    console.error('loadPreventionData 错误:', error)
  }
}

/**
 * 加载治疗数据
 */
async function loadTreatmentData(context: any, batchId: string) {
  try {
    // 1. 获取异常记录
    const abnormalResult = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'get_abnormal_records',
        batchId: batchId
      }
    })
    
    // 2. 计算治疗总成本和治愈率
    const costResult = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'calculate_treatment_cost',
        batchId: batchId,
        dateRange: context.data.dateRange
      }
    })
    
    // 处理异常记录数据
    const abnormalRecords = abnormalResult.result?.success 
      ? (abnormalResult.result.data || [])
      : []
    
    const abnormalCount = abnormalRecords.length
    
    // 处理成本和统计数据
    const costData = costResult.result?.success 
      ? costResult.result.data 
      : {}
    
    // 3. 获取历史治疗记录
    const historyResult = await wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'get_treatment_history',
        batchId: batchId,
        limit: 5
      }
    })
    
    // 处理历史治疗记录
    const treatmentHistory = historyResult.result?.success 
      ? (historyResult.result.data?.records || []).map((record: any) => ({
          ...record,
          statusText: getTreatmentStatusText(record.outcome?.status),
          startDate: record.startDate || record.createdAt?.substring(0, 10) || ''
        }))
      : []
    
    // 更新治疗数据和异常数据
    context.setData({
      'treatmentData.stats': {
        pendingDiagnosis: 0,
        ongoingTreatment: costData.ongoingCount || 0,
        totalTreatmentCost: parseFloat(costData.totalCost || '0'),
        cureRate: parseFloat(costData.cureRate || '0')
      },
      'treatmentData.treatmentHistory': treatmentHistory,
      'monitoringData.realTimeStatus.abnormalCount': abnormalCount,
      'monitoringData.abnormalList': abnormalRecords
    })
  } catch (error: any) {
    console.error('加载治疗数据失败:', error)
  }
}

function getTreatmentStatusText(status: string): string {
  const statusMap: { [key: string]: string } = {
    'ongoing': '治疗中',
    'cured': '已治愈',
    'died': '已死亡',
    'completed': '已完成',
    'pending': '待处理'
  }
  return statusMap[status] || '未知'
}

/**
 * 清除所有缓存
 */
export function clearAllCache() {
  batchDataCache.clear()
}

