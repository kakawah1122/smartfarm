/**
 * get_health_records_by_status 处理函数
 * 查询各状态的健康记录（待处理/治疗中）
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
 * 主处理函数 - 按状态查询健康记录
 * @param {Object} event - 包含 batchId, status, limit
 * @param {Object} wxContext - 微信上下文
 */
exports.main = async (event, wxContext) => {
  try {
    const { batchId, status, limit = 20 } = event  // status: 'abnormal' | 'treating'

    // 限制查询数量，避免过大查询
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50)

    // 构建查询条件
    let whereCondition = {
      recordType: 'ai_diagnosis',
      status: status || 'abnormal',
      ...dbManager.buildNotDeletedCondition(true)
    }
    
    // 如果指定批次，添加批次条件
    if (batchId && batchId !== 'all') {
      whereCondition.batchId = batchId
    }

    // 执行查询
    let query = db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where(whereCondition)
      .orderBy('checkDate', 'desc')

    const result = await query
      .limit(safeLimit)
      .get()

    // 计算受影响总数
    const totalCount = result.data.reduce((sum, record) => {
      return sum + (record.affectedCount || 0)
    }, 0)

    // 返回结果（保持与原函数兼容）
    return {
      success: true,
      data: {
        records: result.data,
        totalCount: totalCount,
        recordCount: result.data.length
      },
      message: '获取成功'
    }
  } catch (error) {
    console.error('[get_health_records_by_status] 查询健康记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取健康记录失败'
    }
  }
}
