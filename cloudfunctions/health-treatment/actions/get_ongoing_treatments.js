/**
 * get_ongoing_treatments 处理函数
 * 获取进行中的治疗记录（从health-management迁移）
 * 严格遵循项目规则，保持100%数据格式兼容
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
 * 主处理函数 - 获取进行中的治疗记录
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { batchId } = event
    
    // 构建查询条件
    let query = db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        isDeleted: false,
        isDraft: false  // ✅ 保留：只查询非草稿记录
      })
    
    // 批次过滤（保持原有逻辑）
    if (batchId && batchId !== 'all') {
      query = query.where({ batchId })
    }
    
    // 执行查询
    const records = await query.orderBy('createdAt', 'desc').get()
    
    // ✅ 保留原有逻辑：在代码中过滤进行中的治疗记录（包含 ongoing 和 pending）
    const ongoingTreatments = records.data.filter(r => {
      const status = r.outcome?.status
      return status === 'ongoing' || status === 'pending'
    })

    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      data: {
        treatments: ongoingTreatments,
        count: ongoingTreatments.length
      }
    }
    
  } catch (error) {
    console.error('[get_ongoing_treatments] 获取治疗记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取治疗记录失败'
    }
  }
}
