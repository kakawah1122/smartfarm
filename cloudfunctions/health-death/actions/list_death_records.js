/**
 * list_death_records 处理函数
 * 查询死亡记录列表（从health-management迁移）
 * 支持分页、批次筛选、日期范围筛选
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
 * 主处理函数 - 查询死亡记录列表
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const {
      batchId,
      dateRange,
      page = 1,
      pageSize = 20
    } = event
    
    let query = db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({ isDeleted: false })
    
    // 按批次筛选
    if (batchId) {
      query = query.where({ batchId })
    }
    
    // 按日期范围筛选
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        deathDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    // 分页查询
    const skip = (page - 1) * pageSize
    const result = await query
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 统计总数
    const countResult = await query.count()
    
    return {
      success: true,
      data: {
        records: result.data,
        total: countResult.total,
        page,
        pageSize
      }
    }
    
  } catch (error) {
    console.error('[list_death_records] 查询死亡记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '查询死亡记录失败'
    }
  }
}
