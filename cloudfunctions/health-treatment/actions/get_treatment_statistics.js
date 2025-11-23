/**
 * get_treatment_statistics 处理函数
 * 获取治疗统计数据（从health-management迁移）
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
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
 * 主处理函数 - 获取治疗统计
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { batchId, dateRange } = event
    
    // 构建查询条件
    let query = db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({ batchId, ...dbManager.buildNotDeletedCondition(true) })

    // 如果指定了日期范围，添加日期过滤
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        treatmentDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    // 执行查询
    const records = await query.get()
    
    // 统计数据
    const totalTreatments = records.data.length
    const totalCost = records.data.reduce((sum, r) => sum + (r.treatmentCost || 0), 0)
    const recoveredCount = records.data.filter(r => r.outcome === 'recovered').length
    const ongoingCount = records.data.filter(r => r.outcome === 'ongoing').length

    // 返回统计结果（保持与原函数完全一致的返回格式）
    return {
      totalTreatments,
      totalCost,
      recoveredCount,
      ongoingCount,
      recoveryRate: totalTreatments > 0 ? ((recoveredCount / totalTreatments) * 100).toFixed(1) : 0
    }

  } catch (error) {
    console.error('[get_treatment_statistics] 获取治疗统计失败:', error)
    // 保持与原函数一致，出错时返回空对象
    return {}
  }
}
