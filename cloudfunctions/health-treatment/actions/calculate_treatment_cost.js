/**
 * calculate_treatment_cost 处理函数
 * 计算单个批次治疗成本（从health-management迁移）
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')
const DatabaseManager = require('../database-manager')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const dbManager = new DatabaseManager(db)

/**
 * 计算单个批次的治疗成本（内部辅助函数）
 */
function calculateBatchTreatmentStats(records) {
  const normalizeStatus = (record) => {
    if (typeof record.outcome === 'string') {
      return record.outcome
    }
    return record.outcome?.status || record.treatmentStatus || record.status || ''
  }

  const getTreatmentCost = (record) => {
    const rawTotal = record?.cost?.total ?? record?.totalCost ?? 0
    return Number(rawTotal) || 0
  }

  const getTotalTreated = (record) => {
    const outcomeTotal = typeof record.outcome === 'object' ? record.outcome?.totalTreated : undefined
    return outcomeTotal ?? record.totalTreated ?? record.affectedCount ?? record.initialCount ?? 0
  }

  const getCuredAnimals = (record) => {
    if (typeof record.outcome === 'object' && record.outcome) {
      const cured = record.outcome.curedCount ?? record.outcome.totalCured ?? record.outcome.recoveredCount ?? 0
      return Number(cured) || 0
    }
    return Number(record.curedCount ?? record.totalCured ?? record.recoveredCount ?? 0) || 0
  }

  const getDiedAnimals = (record) => {
    if (typeof record.outcome === 'object' && record.outcome) {
      const died = record.outcome.deathCount ?? record.outcome.diedCount ?? 0
      return Number(died) || 0
    }
    return Number(record.deathCount ?? record.diedCount ?? 0) || 0
  }

  const totalCost = records.reduce((sum, r) => sum + getTreatmentCost(r), 0)

  const ongoingRecords = records.filter(r => {
    const status = normalizeStatus(r)
    return status === 'ongoing' || status === 'pending'
  })

  const ongoingCount = ongoingRecords.length

  const ongoingAnimalsCount = ongoingRecords.reduce((sum, r) => {
    const totalTreated = getTotalTreated(r)
    const curedAnimals = getCuredAnimals(r)
    const diedAnimals = getDiedAnimals(r)
    const actualOngoing = Math.max(totalTreated - curedAnimals - diedAnimals, 0)
    return sum + actualOngoing
  }, 0)

  const curedCount = records.filter(r => normalizeStatus(r) === 'cured').length
  const diedCount = records.filter(r => normalizeStatus(r) === 'died').length

  const totalTreated = records.reduce((sum, r) => sum + getTotalTreated(r), 0)
  const totalCuredAnimals = records.reduce((sum, r) => sum + getCuredAnimals(r), 0)
  const totalDiedAnimals = records.reduce((sum, r) => sum + getDiedAnimals(r), 0)
  const cureRate = totalTreated > 0 ? ((totalCuredAnimals / totalTreated) * 100).toFixed(1) : 0

  return {
    totalCost: Number(totalCost.toFixed(2)),
    treatmentCount: records.length,
    ongoingCount,
    ongoingAnimalsCount,
    curedCount,
    diedCount,
    totalTreated,
    totalCuredAnimals,
    totalDiedAnimals,
    deadCount: totalDiedAnimals,  // ✅ 添加 deadCount 字段，与前端保持一致
    cureRate
  }
}

/**
 * 获取所有可访问的治疗记录（辅助函数）
 */
async function getAllAccessibleTreatmentRecords(wxContext, where) {
  try {
    const hasPermissionHelper = typeof dbManager.getAccessibleBatchIds === 'function'
    const accessibleBatchIds = hasPermissionHelper
      ? await dbManager.getAccessibleBatchIds(wxContext.OPENID)
      : null

    if (hasPermissionHelper) {
      if (!accessibleBatchIds || accessibleBatchIds.length === 0) {
        return []
      }
    }

    const filter = { ...where }

    if (hasPermissionHelper) {
      if (!filter.batchId) {
        filter.batchId = _.in(accessibleBatchIds)
      } else if (typeof filter.batchId === 'string' && !accessibleBatchIds.includes(filter.batchId)) {
        return []
      }
    }

    const results = []
    const pageSize = 100
    let fetched = 0
    let hasMore = true

    while (hasMore) {
      const res = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where(filter)
        .skip(fetched)
        .limit(pageSize)
        .get()

      if (!res.data || res.data.length === 0) {
        break
      }

      results.push(...res.data)
      fetched += res.data.length
      hasMore = res.data.length === pageSize
    }

    return results
  } catch (error) {
    console.error('[getAllAccessibleTreatmentRecords] 获取治疗记录失败:', error)
    return []
  }
}

/**
 * 主处理函数 - 计算单个批次治疗成本
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { batchId, dateRange } = event
    const openid = wxContext.OPENID
    
    const baseWhere = {
      isDeleted: false
    }

    if (batchId && batchId !== 'all') {
      baseWhere.batchId = batchId
    }

    if (dateRange && dateRange.start && dateRange.end) {
      baseWhere.treatmentDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
    }

    let records = []

    if (!batchId || batchId === 'all') {
      records = await getAllAccessibleTreatmentRecords(wxContext, baseWhere)
    } else {
      const query = db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({
          ...baseWhere,
          _openid: openid
        })
      const result = await query.get()
      records = result.data
    }

    const stats = calculateBatchTreatmentStats(records)

    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      data: stats
    }
    
  } catch (error) {
    console.error('[calculate_treatment_cost] 计算治疗成本失败:', error)
    return {
      success: false,
      error: error.message,
      message: '计算治疗成本失败'
    }
  }
}
