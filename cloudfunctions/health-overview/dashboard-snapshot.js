/**
 * 获取仪表盘快照数据
 * 从 health-management 完整复制实现
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const { COLLECTIONS } = require('./collections.js')

/**
 * 获取指定批次的仪表盘快照数据
 */
async function getDashboardSnapshotForBatches(batchIds, includeDiagnosis, diagnosisLimit, includeAbnormalRecords, abnormalLimit, wxContext) {
  // 获取批次汇总数据
  let summaryResult
  
  if (batchIds.length === 1) {
    summaryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchIds[0]).get()
  } else {
    // 直接查询所有批次，不调用getAllBatchesHealthSummary避免循环依赖
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .where(_.or([
        { userId: wxContext.OPENID },
        { _openid: wxContext.OPENID }
      ]))
      .orderBy('createTime', 'desc')
      .get()
    
    summaryResult = {
      success: true,
      data: {
        batches: batchResult.data.map(batch => ({
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          totalCount: batch.currentCount || batch.currentQuantity || 0,
          deadCount: batch.deadCount || 0,
          sickCount: batch.sickCount || 0
        }))
      }
    }
  }

  let batches = []
  if (batchIds.length === 1) {
    const batchData = summaryResult.data
    if (batchData) {
      batches = [{
        batchId: batchData._id,
        batchNumber: batchData.batchNumber,
        totalCount: batchData.currentCount || batchData.currentQuantity || batchData.quantity || 0,
        deadCount: batchData.deadCount || 0,
        sickCount: batchData.sickCount || 0
      }]
    }
  } else {
    batches = summaryResult?.data?.batches || []
  }

  // 获取原始入栏数
  let originalTotalQuantity = 0
  if (batchIds.length > 0) {
    const batchEntriesResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .where(_.or([
        { _id: _.in(batchIds) },
        { batchNumber: _.in(batchIds) }
      ]))
      .field({ quantity: true })
      .get()
    
    originalTotalQuantity = batchEntriesResult.data.reduce((sum, batch) => {
      return sum + (Number(batch.quantity) || 0)
    }, 0)
  }

  const totalAnimals = batches.reduce((sum, batch) => sum + (batch.totalCount || 0), 0)
  const deadCount = batches.reduce((sum, batch) => sum + (batch.deadCount || 0), 0)
  const sickCount = batches.reduce((sum, batch) => sum + (batch.sickCount || 0), 0)

  // 汇总治疗数据 - 直接使用数据库聚合查询，避免云函数嵌套调用
  let totalOngoing = 0, totalOngoingRecords = 0, totalTreatmentCost = 0
  let totalTreated = 0, totalCured = 0, totalDied = 0, totalDiedAnimals = 0

  if (batchIds.length > 0) {
    try {
      // 使用聚合管道直接计算治疗统计
      const $ = db.command.aggregate
      const treatmentStats = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .aggregate()
        .match({
          batchId: _.in(batchIds),
          isDeleted: _.neq(true)
        })
        .group({
          _id: null,
          ongoingCount: $.sum($.cond({
            if: $.or([
              $.eq(['$status', 'ongoing']),
              $.eq(['$status', 'treating'])
            ]),
            then: 1,
            else: 0
          })),
          ongoingAnimals: $.sum($.cond({
            if: $.or([
              $.eq(['$status', 'ongoing']),
              $.eq(['$status', 'treating'])
            ]),
            then: '$affectedCount',
            else: 0
          })),
          curedCount: $.sum($.cond({
            if: $.or([
              $.eq(['$status', 'cured']),
              $.eq(['$status', 'recovered'])
            ]),
            then: 1,
            else: 0
          })),
          curedAnimals: $.sum($.cond({
            if: $.or([
              $.eq(['$status', 'cured']),
              $.eq(['$status', 'recovered'])
            ]),
            then: '$affectedCount',
            else: 0
          })),
          diedCount: $.sum($.cond({
            if: $.or([
              $.eq(['$status', 'died']),
              $.eq(['$status', 'death'])
            ]),
            then: 1,
            else: 0
          })),
          diedAnimals: $.sum($.cond({
            if: $.or([
              $.eq(['$status', 'died']),
              $.eq(['$status', 'death'])
            ]),
            then: '$affectedCount',
            else: 0
          })),
          totalCost: $.sum('$costInfo.totalCost')
        })
        .end()
      
      if (treatmentStats.list && treatmentStats.list.length > 0) {
        const stats = treatmentStats.list[0]
        totalOngoing = Number(stats.ongoingAnimals || 0)
        totalOngoingRecords = Number(stats.ongoingCount || 0)
        totalCured = Number(stats.curedAnimals || 0)
        totalDied = Number(stats.diedCount || 0)
        totalDiedAnimals = Number(stats.diedAnimals || 0)
        totalTreatmentCost = parseFloat(stats.totalCost || 0)
        totalTreated = totalOngoingRecords + Number(stats.curedCount || 0) + totalDied
      }
    } catch (error) {
      console.error('[getDashboardSnapshot] 获取治疗统计失败:', error)
    }
  }

  // 获取待处理诊断、异常记录、诊断历史 - 直接数据库查询，避免云函数嵌套
  const promises = []
  
  // 异常记录 - 直接查询数据库
  if (includeAbnormalRecords) {
    const abnormalConditions = {
      _openid: wxContext.OPENID,
      status: _.in(['abnormal', 'treating', 'pending'])
    }
    if (batchIds.length === 1) {
      abnormalConditions.batchId = batchIds[0]
    }
    
    promises.push(
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where(abnormalConditions)
        .orderBy('createTime', 'desc')
        .limit(abnormalLimit)
        .get()
        .then(res => ({
          totalCount: res.data.reduce((sum, r) => sum + (r.affectedCount || 1), 0),
          recordCount: res.data.length,
          records: res.data
        }))
        .catch(() => ({ totalCount: 0, recordCount: 0, records: [] }))
    )
  } else {
    promises.push(Promise.resolve({ totalCount: 0, recordCount: 0, records: [] }))
  }
  
  // 诊断历史 - 直接查询数据库
  if (includeDiagnosis) {
    const diagnosisConditions = {
      _openid: wxContext.OPENID,
      isDeleted: false
    }
    if (batchIds.length === 1) {
      diagnosisConditions.batchId = batchIds[0]
    }
    
    promises.push(
      db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
        .where(diagnosisConditions)
        .orderBy('diagnosisTime', 'desc')
        .limit(diagnosisLimit)
        .get()
        .then(res => res.data)
        .catch(() => [])
    )
  } else {
    promises.push(Promise.resolve([]))
  }
  
  // 待处理诊断数
  promises.push(
    db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .where({
        _openid: wxContext.OPENID,
        isDeleted: false,
        hasTreatment: false,
        ...(batchIds.length === 1 ? { batchId: batchIds[0] } : {})
      })
      .count()
  )
  
  const [abnormalData, latestDiagnosisRecords, pendingCountResult] = await Promise.all(promises)

  const pendingDiagnosis = pendingCountResult?.total || 0
  const abnormalCount = abnormalData.totalCount || 0
  const abnormalRecordCount = abnormalData.recordCount || 0
  const abnormalRecords = abnormalData.records || []

  const actualHealthyCount = Math.max(0, totalAnimals - totalOngoing - abnormalCount)
  const healthyRate = totalAnimals > 0 ? ((actualHealthyCount / totalAnimals) * 100).toFixed(1) : '100'
  const mortalityRate = originalTotalQuantity > 0 ? ((deadCount / originalTotalQuantity) * 100).toFixed(1) : '0'
  const cureRate = totalTreated > 0 ? ((totalCured / totalTreated) * 100).toFixed(1) : '0'

  return {
    success: true,
    data: {
      batches,
      totalBatches: batches.length,
      originalTotalQuantity,
      totalAnimals,
      deadCount,
      sickCount,
      actualHealthyCount,
      healthyRate,
      mortalityRate,
      abnormalCount,
      abnormalRecordCount,
      abnormalRecords,
      totalOngoing,
      totalOngoingRecords,
      totalTreatmentCost,
      totalTreated,
      totalCured,
      totalDiedAnimals,
      totalDied,
      cureRate,
      pendingDiagnosis,
      latestDiagnosisRecords
    }
  }
}

/**
 * 获取仪表盘快照（主函数）
 */
async function getDashboardSnapshot(event, wxContext) {
  try {
    const {
      batchId = 'all',
      includeDiagnosis = true,
      diagnosisLimit = 10,
      includeAbnormalRecords = true,
      abnormalLimit = 20
    } = event || {}

    // 单批次模式
    if (batchId && batchId !== 'all') {
      const batchIds = [batchId]
      return await getDashboardSnapshotForBatches(batchIds, includeDiagnosis, diagnosisLimit, includeAbnormalRecords, abnormalLimit, wxContext)
    }

    // 全部批次：直接查询所有批次
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .where(_.or([
        { userId: wxContext.OPENID },
        { _openid: wxContext.OPENID }
      ]))
      .orderBy('createTime', 'desc')
      .get()
    
    const batches = batchResult.data.map(batch => ({
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      totalCount: batch.currentCount || batch.currentQuantity || 0,
      deadCount: batch.deadCount || 0,
      sickCount: batch.sickCount || 0
    }))
    
    const batchIds = batches.map(batch => batch.batchId).filter(Boolean)
    
    // 使用统一的汇总逻辑
    return await getDashboardSnapshotForBatches(batchIds, includeDiagnosis, diagnosisLimit, includeAbnormalRecords, abnormalLimit, wxContext)
  } catch (error) {
    console.error('[getDashboardSnapshot] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '获取健康面板数据失败'
    }
  }
}

module.exports = {
  getDashboardSnapshot,
  getDashboardSnapshotForBatches
}
