/**
 * 批次AI提示数据功能
 * 从 health-management 迁移
 */

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const { COLLECTIONS } = require('./shared-config/collections.js')

/**
 * 获取批次提示数据
 * 用于AI诊断的上下文信息
 */
async function getBatchPromptData(event, openid) {
  try {
    const { batchId, includeHistory = false } = event
    
    // 获取批次信息
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .doc(batchId)
      .get()
    
    if (!batchResult.data) {
      return {
        success: false,
        error: '批次不存在'
      }
    }
    
    const batch = batchResult.data
    
    // 构建提示数据
    const promptData = {
      batchInfo: {
        batchNumber: batch.batchNumber,
        entryDate: batch.entryDate,
        dayAge: batch.dayAge || 0,
        currentCount: batch.currentCount || 0,
        deadCount: batch.deadCount || 0,
        mortalityRate: batch.deadCount && batch.originalTotalQuantity 
          ? ((batch.deadCount / batch.originalTotalQuantity) * 100).toFixed(2) + '%'
          : '0%'
      }
    }
    
    // 如果需要历史数据
    if (includeHistory) {
      // 并行获取相关数据
      const [healthRecords, treatments, abnormals, preventions] = await Promise.all([
        // 最近的健康记录
        db.collection(COLLECTIONS.HEALTH_RECORDS)
          .where({
            batchId,
            isDeleted: _.neq(true)
          })
          .orderBy('checkDate', 'desc')
          .limit(5)
          .get(),
        
        // 最近的治疗记录
        db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
          .where({
            batchId,
            isDeleted: _.neq(true)
          })
          .orderBy('startDate', 'desc')
          .limit(3)
          .get(),
        
        // 最近的异常记录
        db.collection(COLLECTIONS.HEALTH_ABNORMAL_RECORDS)
          .where({
            batchId,
            isDeleted: _.neq(true)
          })
          .orderBy('discoveryTime', 'desc')
          .limit(3)
          .get(),
        
        // 最近的预防记录
        db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
          .where({
            batchId,
            isDeleted: _.neq(true)
          })
          .orderBy('executionDate', 'desc')
          .limit(3)
          .get()
      ])
      
      promptData.recentHealthRecords = healthRecords.data
      promptData.recentTreatments = treatments.data
      promptData.recentAbnormals = abnormals.data
      promptData.recentPreventions = preventions.data
      
      // 添加统计摘要
      promptData.summary = {
        totalHealthRecords: healthRecords.data.length,
        totalTreatments: treatments.data.length,
        totalAbnormals: abnormals.data.length,
        totalPreventions: preventions.data.length
      }
    }
    
    return {
      success: true,
      data: promptData
    }
  } catch (error) {
    console.error('获取批次提示数据失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

module.exports = {
  getBatchPromptData
}
