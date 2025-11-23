/**
 * fix_batch_death_count 处理函数
 * 修复批次死亡数据不一致问题（从health-management迁移）
 * 确保死亡记录集合和批次集合的数据同步
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
 * 主处理函数 - 修复批次死亡数据不一致问题
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const openid = wxContext.OPENID
    
    // 1. 获取用户的所有批次
    const batchesResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .where(_.or([
        { userId: openid },
        { _openid: openid }
      ]))
      .get()
    
    const batches = batchesResult.data || []
    let fixedCount = 0
    
    for (const batch of batches) {
      // 2. 统计该批次的实际死亡记录数
      const deathRecordsResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
        .where({
          batchId: batch._id,
          isDeleted: false
        })
        .get()
      
      // 3. 计算实际死亡总数
      let actualDeadCount = 0
      deathRecordsResult.data.forEach(record => {
        actualDeadCount += (record.deathCount || record.totalDeathCount || 0)
      })
      
      // 4. 更新批次的死亡数和当前数量
      const originalQuantity = batch.quantity || 0
      const currentCount = originalQuantity - actualDeadCount
      
      await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batch._id).update({
        data: {
          deadCount: actualDeadCount,
          currentCount: currentCount,
          currentQuantity: currentCount,  // 同时更新多个字段名，确保兼容性
          updatedAt: new Date()
        }
      })
      
      fixedCount++
    }
    
    return {
      success: true,
      message: `成功修复${fixedCount}个批次的死亡数据`,
      data: { fixedCount }
    }
  } catch (error) {
    console.error('[fix_batch_death_count] 修复批次死亡数失败:', error)
    return {
      success: false,
      error: error.message,
      message: '修复批次死亡数失败'
    }
  }
}
