/**
 * get_batch_health_summary 处理函数
 * 获取批次健康汇总数据
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
 * 主处理函数 - 获取批次健康汇总
 */
exports.main = async (event, wxContext) => {
  try {
    const { batchId } = event
    const openid = wxContext.OPENID
    
    if (!batchId) {
      throw new Error('批次ID不能为空')
    }
    
    // 获取批次信息
    let batch = null
    try {
      const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId)
        .get()
      batch = batchEntry.data
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          batchNumber: batchId,
          ...dbManager.buildNotDeletedCondition(true)
        })
        .limit(1)
        .get()
      
      if (batchQueryResult.data && batchQueryResult.data.length > 0) {
        batch = batchQueryResult.data[0]
      }
    }
    
    if (!batch) {
      return {
        success: false,
        error: '批次不存在'
      }
    }
    
    // 并行查询健康相关数据
    const [
      healthRecordsResult,
      deathRecordsResult,
      abnormalRecordsResult,
      treatmentRecordsResult
    ] = await Promise.all([
      // 最新健康记录
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          batchId: batch._id,
          ...dbManager.buildNotDeletedCondition(true)
        })
        .orderBy('checkDate', 'desc')
        .limit(1)
        .get(),
      
      // 死亡记录统计
      db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
        .where({
          batchId: batch._id,
          isDeleted: false
        })
        .get(),
      
      // 异常记录统计
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          batchId: batch._id,
          recordType: 'ai_diagnosis',
          status: 'abnormal',
          ...dbManager.buildNotDeletedCondition(true)
        })
        .count(),
      
      // 治疗记录统计
      db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({
          batchId: batch._id,
          ...dbManager.buildNotDeletedCondition(true)
        })
        .get()
    ])
    
    // 计算统计数据
    const latestHealth = healthRecordsResult.data[0] || {}
    const totalDeath = deathRecordsResult.data.reduce((sum, r) => sum + (r.deathCount || 0), 0)
    const abnormalCount = abnormalRecordsResult.total || 0
    
    // 统计治疗情况
    const ongoingTreatments = treatmentRecordsResult.data.filter(r => 
      r.outcome?.status === 'ongoing' || r.outcome?.status === 'pending'
    ).length
    
    const curedCount = treatmentRecordsResult.data
      .filter(r => r.treatmentStatus === 'cured')
      .reduce((sum, r) => sum + (r.curedCount || 0), 0)
    
    // 计算健康率
    const currentStock = batch.currentCount || batch.quantity || 0
    const healthyCount = latestHealth.healthyCount || currentStock
    const healthRate = currentStock > 0 
      ? ((healthyCount + curedCount) / currentStock * 100).toFixed(1)
      : '0'
    
    // 返回汇总数据（保持与原函数兼容）
    return {
      success: true,
      data: {
        batchInfo: {
          _id: batch._id,
          batchNumber: batch.batchNumber,
          currentCount: currentStock,
          entryDate: batch.entryDate
        },
        healthStats: {
          healthRate: healthRate,
          healthyCount: healthyCount,
          sickCount: latestHealth.sickCount || 0,
          deathCount: totalDeath,
          abnormalCount: abnormalCount,
          ongoingTreatments: ongoingTreatments,
          curedCount: curedCount
        },
        lastCheckDate: latestHealth.checkDate || null,
        severity: latestHealth.severity || 'low'
      }
    }
  } catch (error) {
    console.error('[get_batch_health_summary] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '获取批次健康汇总失败'
    }
  }
}
