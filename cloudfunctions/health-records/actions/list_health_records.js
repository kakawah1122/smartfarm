/**
 * list_health_records 处理函数
 * 列出健康记录（支持分页）
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
 * 主处理函数 - 获取健康记录列表
 */
exports.main = async (event, wxContext) => {
  try {
    const { 
      batchId, 
      page = 1, 
      pageSize = 20,
      recordType,
      status,
      startDate,
      endDate
    } = event
    
    // 构建查询条件
    let whereCondition = {
      ...dbManager.buildNotDeletedCondition(true)
    }
    
    // 批次过滤
    if (batchId && batchId !== 'all') {
      whereCondition.batchId = batchId
    }
    
    // 记录类型过滤
    if (recordType) {
      whereCondition.recordType = recordType
    }
    
    // 状态过滤
    if (status) {
      if (Array.isArray(status)) {
        whereCondition.status = _.in(status)
      } else {
        whereCondition.status = status
      }
    }
    
    // 日期范围过滤
    if (startDate || endDate) {
      whereCondition.checkDate = {}
      if (startDate) {
        whereCondition.checkDate = _.gte(startDate)
      }
      if (endDate) {
        whereCondition.checkDate = {
          ...whereCondition.checkDate,
          ..._.lte(endDate)
        }
      }
    }
    
    // 创建查询
    let query = db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where(whereCondition)
    
    // 获取总数
    const countResult = await query.count()
    const total = countResult.total
    
    // 分页查询
    const result = await query
      .orderBy('checkDate', 'desc')
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    // 返回结果（保持与原函数兼容）
    return {
      success: true,
      data: {
        records: result.data,
        total: total,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: page < Math.ceil(total / pageSize)
      },
      message: '获取成功'
    }
  } catch (error) {
    console.error('[list_health_records] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '获取健康记录列表失败'
    }
  }
}
