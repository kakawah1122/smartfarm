/**
 * get_death_stats 处理函数
 * 获取死亡统计（从health-management迁移）
 * 统计死亡原因分布、损失金额等
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
 * 主处理函数 - 获取死亡统计
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { batchId, dateRange } = event
    
    let query = db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({ isDeleted: false })
    
    if (batchId) {
      query = query.where({ batchId })
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        deathDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    const records = await query.get()
    
    // 统计死亡原因分布
    const causeDistribution = {}
    let totalDeaths = 0
    let totalLoss = 0
    
    records.data.forEach(record => {
      const cause = record.deathCause
      if (!causeDistribution[cause]) {
        causeDistribution[cause] = {
          count: 0,
          loss: 0
        }
      }
      causeDistribution[cause].count += record.totalDeathCount
      causeDistribution[cause].loss += parseFloat(record.financialLoss?.totalLoss || 0)
      
      totalDeaths += record.totalDeathCount
      totalLoss += parseFloat(record.financialLoss?.totalLoss || 0)
    })
    
    // 转换为数组格式
    const causeStats = Object.keys(causeDistribution).map(cause => ({
      cause,
      count: causeDistribution[cause].count,
      loss: causeDistribution[cause].loss.toFixed(2),
      percentage: ((causeDistribution[cause].count / totalDeaths) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count)
    
    return {
      success: true,
      data: {
        totalDeaths,
        totalLoss: totalLoss.toFixed(2),
        recordCount: records.data.length,
        causeDistribution: causeStats
      }
    }
    
  } catch (error) {
    console.error('[get_death_stats] 获取死亡统计失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取死亡统计失败'
    }
  }
}
