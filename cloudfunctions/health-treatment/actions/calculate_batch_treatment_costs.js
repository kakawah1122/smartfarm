/**
 * calculate_batch_treatment_costs 处理函数
 * 批量计算多个批次的治疗成本（从health-management迁移）
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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
 * 主处理函数 - 批量计算多个批次的治疗成本
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { batchIds, dateRange } = event
    const openid = wxContext.OPENID
    
    if (!batchIds || !Array.isArray(batchIds) || batchIds.length === 0) {
      return {
        success: false,
        error: '批次ID数组不能为空',
        message: '批量计算失败：缺少批次ID'
      }
    }
    
    // ✅ 添加用户权限过滤：只查询用户有权限的批次记录
    const baseWhere = {
      isDeleted: false,
      batchId: _.in(batchIds),
      _openid: openid  // 关键修复：添加用户权限过滤
    }
    
    // 添加日期范围过滤
    if (dateRange && dateRange.start && dateRange.end) {
      baseWhere.treatmentDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
    }
    
    // 一次性查询所有批次的治疗记录（仅限用户有权限的记录）
    const result = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where(baseWhere)
      .get()
    
    // 按批次ID分组
    const recordsByBatch = {}
    batchIds.forEach(id => {
      recordsByBatch[id] = []
    })
    
    result.data.forEach(record => {
      if (recordsByBatch[record.batchId]) {
        recordsByBatch[record.batchId].push(record)
      }
    })
    
    // 批量计算每个批次的统计数据
    const batchStats = {}
    batchIds.forEach(batchId => {
      const records = recordsByBatch[batchId] || []
      batchStats[batchId] = calculateBatchTreatmentStats(records)
    })
    
    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      data: batchStats,
      message: `成功批量计算${batchIds.length}个批次的治疗成本`
    }
    
  } catch (error) {
    console.error('[calculate_batch_treatment_costs] 批量计算失败:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })
    return {
      success: false,
      error: error.message,
      message: '批量计算治疗成本失败'
    }
  }
}
