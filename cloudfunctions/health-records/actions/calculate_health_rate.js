/**
 * calculate_health_rate 处理函数
 * 计算批次健康率
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
 * 计算健康率（新算法）
 * @param {string} batchId - 批次ID或批次号
 */
async function calculateHealthRate(batchId) {
  try {
    // 1. 获取批次当前存栏数（已扣除死亡）（容错处理：batchId可能是文档ID或批次号）
    let batch = null
    
    try {
      const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
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
      return '0'
    }
    
    const currentStock = batch.currentCount || 0
    
    if (currentStock === 0) {
      return '0'
    }
    
    // 2. 获取最新健康记录中的健康数
    const healthRecords = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({ batchId, isDeleted: false })
      .orderBy('recordDate', 'desc')
      .limit(1)
      .get()
    
    let healthyCount = currentStock // 默认全部健康
    
    if (healthRecords.data.length > 0) {
      healthyCount = healthRecords.data[0].healthyCount || 0
    }
    
    // 3. 获取治愈记录总数
    const curedRecords = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        batchId,
        treatmentStatus: 'cured',
        isDeleted: false
      })
      .get()
    
    const totalCured = curedRecords.data.reduce((sum, r) => sum + (r.curedCount || 0), 0)
    
    // 4. 计算健康率 = (健康数 + 治愈数) / 存栏数 × 100%
    const healthRate = ((healthyCount + totalCured) / currentStock * 100).toFixed(1)
    
    return healthRate
    
  } catch (error) {
    console.error('计算健康率失败:', error)
    return '0'
  }
}

/**
 * 主处理函数 - 计算批次健康率
 */
exports.main = async (event, wxContext) => {
  try {
    const { batchId } = event
    
    if (!batchId) {
      throw new Error('批次ID不能为空')
    }
    
    const healthRate = await calculateHealthRate(batchId)
    
    // 返回结果（保持与原函数兼容）
    return {
      success: true,
      data: {
        healthRate: healthRate
      }
    }
  } catch (error) {
    console.error('[calculate_health_rate] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '计算健康率失败'
    }
  }
}
