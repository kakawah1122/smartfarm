/**
 * health-overview 云函数
 * 负责健康管理综合数据和仪表盘
 * 从 health-management 拆分出来的独立模块
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

// 引入共享的集合配置
const { COLLECTIONS } = require('./collections.js')

// 引入扩展函数
const {
  getHealthDashboardComplete,
  getHealthStatistics,
  getHealthStatisticsOptimized,
  getBatchCompleteData
} = require('./extended-functions.js')

// 引入批次提示数据功能
const { getBatchPromptData } = require('./batch-prompt-data.js')

/**
 * 获取健康概览数据
 * 用于首页展示
 */
async function getHealthOverview(event, wxContext) {
  try {
    const { batchId } = event
    const openid = wxContext.OPENID
    
    let conditions = {
      _openid: openid
    }
    
    if (batchId && batchId !== 'all') {
      conditions.batchId = batchId
    }
    
    // 并行查询各项数据
    const [
      abnormalResult,
      treatmentResult,
      deathResult,
      batchResult
    ] = await Promise.all([
      // 异常记录统计（从HEALTH_RECORDS中筛选AI诊断记录）
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          ...conditions,
          recordType: 'ai_diagnosis',
          status: _.in(['abnormal', 'treating'])
        })
        .count(),
      
      // 治疗记录统计
      db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({
          ...conditions,
          isDeleted: false
        })
        .count(),
      
      // 死亡记录统计
      db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
        .where(conditions)
        .count(),
      
      // 批次信息
      batchId && batchId !== 'all' 
        ? db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
        : null
    ])
    
    const currentQuantity = batchResult?.data?.currentQuantity || 0
    const entryQuantity = batchResult?.data?.quantity || 0
    
    // 计算健康率和死亡率
    const healthRate = entryQuantity > 0 
      ? ((currentQuantity / entryQuantity) * 100).toFixed(2)
      : '0.00'
    
    const mortalityRate = entryQuantity > 0
      ? (((entryQuantity - currentQuantity) / entryQuantity) * 100).toFixed(2)
      : '0.00'
    
    return {
      success: true,
      data: {
        abnormalCount: abnormalResult.total,
        treatmentCount: treatmentResult.total,
        deathCount: deathResult.total,
        currentQuantity,
        entryQuantity,
        healthRate,
        mortalityRate,
        lastUpdateTime: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('[getHealthOverview] 错误:', error)
    return {
      success: false,
      error: error.message || '获取健康概览失败'
    }
  }
}

/**
 * 获取所有批次健康汇总
 * 用于健康管理主页的全部批次模式
 */
async function getAllBatchesHealthSummary(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    
    // 获取用户的所有活跃批次
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .where(_.or([
        { userId: openid },
        { _openid: openid }
      ]))
      .orderBy('createTime', 'desc')
      .get()
    
    if (batchResult.data.length === 0) {
      return {
        success: true,
        data: {
          totalBatches: 0,
          totalQuantity: 0,
          totalAbnormal: 0,
          totalTreatment: 0,
          totalDeath: 0,
          averageHealthRate: '100.00',
          batches: []
        }
      }
    }
    
    // 统计所有批次的数据
    let totalQuantity = 0
    let totalEntryQuantity = 0
    let totalAbnormal = 0
    let totalTreatment = 0
    let totalDeath = 0
    
    const batchIds = batchResult.data.map(b => b._id)
    
    // 并行查询所有统计数据
    const [abnormalStats, treatmentStats, deathStats] = await Promise.all([
      // 异常统计（从HEALTH_RECORDS中筛选）
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          batchId: _.in(batchIds),
          recordType: 'ai_diagnosis',
          status: _.in(['abnormal', 'treating']),
          isDeleted: _.neq(true)
        })
        .count(),
      
      // 治疗统计
      db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({
          batchId: _.in(batchIds),
          _openid: openid,
          isDeleted: false
        })
        .count(),
      
      // 死亡统计
      db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
        .where({
          batchId: _.in(batchIds),
          _openid: openid
        })
        .count()
    ])
    
    // 计算总量
    batchResult.data.forEach(batch => {
      totalQuantity += (batch.currentQuantity || 0)
      totalEntryQuantity += (batch.quantity || 0)
    })
    
    totalAbnormal = abnormalStats.total
    totalTreatment = treatmentStats.total
    totalDeath = deathStats.total
    
    // 计算平均健康率
    const averageHealthRate = totalEntryQuantity > 0
      ? ((totalQuantity / totalEntryQuantity) * 100).toFixed(2)
      : '100.00'
    
    return {
      success: true,
      data: {
        totalBatches: batchResult.data.length,
        totalQuantity,
        totalEntryQuantity,
        totalAbnormal,
        totalTreatment,
        totalDeath,
        averageHealthRate,
        batches: batchResult.data.map(batch => ({
          id: batch._id,
          batchNumber: batch.batchNumber,
          currentQuantity: batch.currentQuantity || 0,
          entryQuantity: batch.quantity || 0,
          createTime: batch.createTime
        }))
      }
    }
  } catch (error) {
    console.error('[getAllBatchesHealthSummary] 错误:', error)
    return {
      success: false,
      error: error.message || '获取批次健康汇总失败'
    }
  }
}

/**
 * 获取仪表盘快照
 * 快速获取关键指标
 */
async function getDashboardSnapshot(event, wxContext) {
  try {
    const { batchId } = event
    const openid = wxContext.OPENID
    
    // 构建查询条件
    let batchCondition = {}
    if (batchId && batchId !== 'all') {
      batchCondition = { batchId }
    } else {
      batchCondition = { _openid: openid }
    }
    
    // 获取今日日期范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // 并行查询今日数据
    const [
      todayAbnormal,
      todayTreatment,
      todayDeath,
      pendingTasks
    ] = await Promise.all([
      // 今日新增异常
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          ...batchCondition,
          recordType: 'ai_diagnosis',
          status: _.in(['abnormal', 'treating']),
          createdAt: _.gte(today).and(_.lt(tomorrow))
        })
        .count(),
      
      // 今日新增治疗
      db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({
          ...batchCondition,
          createTime: _.gte(today).and(_.lt(tomorrow)),
          isDeleted: false
        })
        .count(),
      
      // 今日新增死亡
      db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
        .where({
          ...batchCondition,
          recordDate: _.gte(today.toISOString()).and(_.lt(tomorrow.toISOString()))
        })
        .count(),
      
      // 待处理任务数
      db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
        .where({
          ...batchCondition,
          completed: false,
          plannedDate: _.lte(new Date())
        })
        .count()
    ])
    
    return {
      success: true,
      data: {
        today: {
          abnormal: todayAbnormal.total,
          treatment: todayTreatment.total,
          death: todayDeath.total
        },
        pendingTasks: pendingTasks.total,
        snapshotTime: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('[getDashboardSnapshot] 错误:', error)
    return {
      success: false,
      error: error.message || '获取仪表盘快照失败'
    }
  }
}

/**
 * 获取首页健康概览
 * 专门为首页优化的轻量级接口
 */
async function getHomepageHealthOverview(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    
    // 只获取最关键的指标
    const [
      activeBatchCount,
      totalCurrentQuantity,
      recentAbnormal
    ] = await Promise.all([
      // 活跃批次数
      db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where(_.or([
          { userId: openid },
          { _openid: openid }
        ]))
        .count(),
      
      // 总存栏量（聚合查询）
      db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .aggregate()
        .match(_.or([
          { userId: openid },
          { _openid: openid }
        ]))
        .group({
          _id: null,
          total: $.sum('$currentQuantity')
        })
        .end(),
      
      // 最近7天异常数
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          recordType: 'ai_diagnosis',
          status: _.in(['abnormal', 'treating']),
          createdAt: _.gte(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
          isDeleted: _.neq(true)
        })
        .count()
    ])
    
    const totalQuantity = totalCurrentQuantity.list[0]?.total || 0
    
    return {
      success: true,
      data: {
        activeBatches: activeBatchCount.total,
        totalQuantity,
        recentAbnormal: recentAbnormal.total,
        healthStatus: recentAbnormal.total === 0 ? 'good' : 
                     recentAbnormal.total < 5 ? 'warning' : 'danger'
      }
    }
  } catch (error) {
    console.error('[getHomepageHealthOverview] 错误:', error)
    return {
      success: false,
      error: error.message || '获取首页健康概览失败'
    }
  }
}

// 主函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      case 'get_health_overview':
        return await getHealthOverview(event, wxContext)
      
      case 'get_all_batches_health_summary':
        return await getAllBatchesHealthSummary(event, wxContext)
      
      case 'get_dashboard_snapshot':
        return await getDashboardSnapshot(event, wxContext)
      
      case 'get_homepage_health_overview':
        return await getHomepageHealthOverview(event, wxContext)
      
      case 'get_health_dashboard_complete':
        return await getHealthDashboardComplete(event, wxContext)
      
      case 'get_health_statistics':
      case 'getHealthStatistics':
        return await getHealthStatistics(event, wxContext)
      
      case 'get_health_statistics_optimized':
      case 'getHealthStatisticsOptimized':
        return await getHealthStatisticsOptimized(event, wxContext)
      
      case 'get_batch_complete_data':
        return await getBatchCompleteData(event, wxContext)
      
      case 'get_batch_prompt_data':
        return await getBatchPromptData(event, wxContext.OPENID)
      
      default:
        return {
          success: false,
          error: `未知的 action: ${action}`
        }
    }
  } catch (error) {
    console.error('[health-overview] 云函数错误:', error)
    return {
      success: false,
      error: error.message || '云函数执行失败'
    }
  }
}
