/**
 * health-prevention 扩展功能
 * 从 health-management 迁移的预防保健相关功能
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 引入共享的集合配置
const { COLLECTIONS } = require('./collections.js')

// 辅助函数：调试日志（生产环境自动关闭）
function debugLog(message, data) {
  // 生产环境不输出调试日志
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, data)
  }
}

/**
 * 获取今日预防待办（首页用）
 * 从health-management迁移
 */
async function getTodayPreventionTasks(event, wxContext) {
  const startTime = Date.now()
  const logContext = { action: 'getTodayPreventionTasks', openid: wxContext.OPENID }
  
  try {
    const { limit = 3, batchId } = event
    const openid = wxContext.OPENID
    const today = new Date().toISOString().split('T')[0]
    
    debugLog('[首页预防待办] 开始查询', logContext)
    
    // 构建查询条件
    const whereCondition = {
      category: _.in(['健康管理', '营养管理', '疫苗接种', '用药管理']),
      completed: false,
      targetDate: _.lte(today)  // 今日及之前（包含逾期）
    }
    
    if (batchId) {
      whereCondition.batchId = batchId
    }
    
    // 查询待办任务
    const result = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .where(whereCondition)
      .orderBy('targetDate', 'asc')
      .orderBy('priority', 'desc')
      .limit(limit)
      .get()
    
    const totalTime = Date.now() - startTime
    debugLog('[首页预防待办] 查询完成', {
      ...logContext,
      count: result.data.length,
      totalTime
    })
    
    return {
      success: true,
      data: {
        tasks: result.data,
        _performance: {
          totalTime,
          timestamp: new Date().toISOString()
        }
      }
    }
    
  } catch (error) {
    console.error('[首页预防待办] 查询失败', {
      ...logContext,
      error: error.message
    })
    
    return {
      success: false,
      errorCode: 'QUERY_FAILED',
      message: '获取预防待办失败'
    }
  }
}

/**
 * 根据批次获取预防任务
 * 从health-management迁移
 */
async function getPreventionTasksByBatch(event, wxContext) {
  try {
    const { batchId, status = 'all', page = 1, pageSize = 20 } = event
    
    if (!batchId) {
      return {
        success: false,
        error: '批次ID不能为空'
      }
    }
    
    // 构建查询条件
    let whereCondition = {
      batchId,
      category: _.in(['健康管理', '营养管理', '疫苗接种', '用药管理'])
    }
    
    // 根据状态筛选
    if (status === 'pending') {
      whereCondition.completed = false
    } else if (status === 'completed') {
      whereCondition.completed = true
    }
    // status === 'all' 时不添加 completed 条件
    
    // 计算分页
    const skip = (page - 1) * pageSize
    
    // 查询总数
    const countResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .where(whereCondition)
      .count()
    
    // 查询任务列表
    const result = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .where(whereCondition)
      .orderBy('targetDate', 'asc')
      .orderBy('dayAge', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    return {
      success: true,
      data: {
        tasks: result.data,
        total: countResult.total,
        page,
        pageSize,
        totalPages: Math.ceil(countResult.total / pageSize)
      }
    }
    
  } catch (error) {
    console.error('[getPreventionTasksByBatch] 查询失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取预防任务失败'
    }
  }
}

/**
 * 获取批次预防对比数据
 * 从health-management迁移
 */
async function getBatchPreventionComparison(event, wxContext) {
  try {
    const { batchIds = [] } = event
    
    if (!batchIds || batchIds.length === 0) {
      return {
        success: false,
        error: '请选择要对比的批次'
      }
    }
    
    // 限制对比批次数量
    if (batchIds.length > 5) {
      return {
        success: false,
        error: '最多只能对比5个批次'
      }
    }
    
    // 并行查询各批次的预防数据
    const comparisons = await Promise.all(
      batchIds.map(async (batchId) => {
        // 获取批次基本信息
        const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
          .doc(batchId)
          .field({
            _id: true,
            batchNumber: true,
            entryDate: true
          })
          .get()
        
        if (!batchResult.data) {
          return null
        }
        
        const batch = batchResult.data
        
        // 统计预防任务完成情况
        const [totalTasks, completedTasks] = await Promise.all([
          db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
            .where({
              batchId,
              category: _.in(['健康管理', '营养管理', '疫苗接种', '用药管理'])
            })
            .count(),
          
          db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
            .where({
              batchId,
              category: _.in(['健康管理', '营养管理', '疫苗接种', '用药管理']),
              completed: true
            })
            .count()
        ])
        
        // 统计预防记录
        const preventionRecords = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
          .where({
            batchId,
            isDeleted: false
          })
          .get()
        
        // 计算各类预防次数
        const preventionStats = {
          vaccine: 0,
          disinfection: 0,
          medicine: 0,
          other: 0
        }
        
        preventionRecords.data.forEach(record => {
          const type = record.preventionType
          if (type === 'vaccine') {
            preventionStats.vaccine++
          } else if (type === 'disinfection') {
            preventionStats.disinfection++
          } else if (type === 'medicine') {
            preventionStats.medicine++
          } else {
            preventionStats.other++
          }
        })
        
        return {
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          entryDate: batch.entryDate,
          totalTasks: totalTasks.total,
          completedTasks: completedTasks.total,
          completionRate: totalTasks.total > 0 
            ? ((completedTasks.total / totalTasks.total) * 100).toFixed(1) 
            : 0,
          preventionStats,
          totalPreventions: preventionRecords.data.length
        }
      })
    )
    
    // 过滤掉null结果
    const validComparisons = comparisons.filter(c => c !== null)
    
    return {
      success: true,
      data: {
        comparisons: validComparisons,
        timestamp: new Date().toISOString()
      }
    }
    
  } catch (error) {
    console.error('[getBatchPreventionComparison] 查询失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取批次对比数据失败'
    }
  }
}

/**
 * 更新预防效果
 * 从health-management迁移
 */
async function updatePreventionEffectiveness(event, wxContext) {
  try {
    const { 
      recordId, 
      effectiveness, 
      notes 
    } = event
    const openid = wxContext.OPENID
    
    if (!recordId) {
      return {
        success: false,
        error: '记录ID不能为空'
      }
    }
    
    if (!effectiveness || !['excellent', 'good', 'average', 'poor'].includes(effectiveness)) {
      return {
        success: false,
        error: '请选择有效的效果评价'
      }
    }
    
    // 更新预防记录
    const updateData = {
      effectiveness,
      effectivenessNotes: notes || '',
      effectivenessUpdatedBy: openid,
      effectivenessUpdatedAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .doc(recordId)
      .update({
        data: updateData
      })
    
    if (result.stats.updated === 0) {
      return {
        success: false,
        error: '记录不存在或更新失败'
      }
    }
    
    return {
      success: true,
      message: '预防效果更新成功'
    }
    
  } catch (error) {
    console.error('[updatePreventionEffectiveness] 更新失败:', error)
    return {
      success: false,
      error: error.message,
      message: '更新预防效果失败'
    }
  }
}

// 导出所有函数
module.exports = {
  getTodayPreventionTasks,
  getPreventionTasksByBatch,
  getBatchPreventionComparison,
  updatePreventionEffectiveness
}
