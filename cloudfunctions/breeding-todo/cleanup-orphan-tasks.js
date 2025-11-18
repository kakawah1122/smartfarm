// cleanup-orphan-tasks.js - 一次性清理孤儿任务脚本
// 在云开发控制台的云函数中手动执行此脚本

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const debugEnabled = process.env.DEBUG_LOG === 'true'
const debugLog = (...args) => {
  if (debugEnabled) {
    console.info(...args)
  }
}

/**
 * 清理所有孤儿任务（批次已删除但任务记录还在的）
 */
async function cleanupAllOrphanTasks() {
  debugLog('===== 开始清理孤儿任务 =====')
  
  try {
    // 1. 获取所有存在的批次ID
    const batchesResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .field({ _id: true })
      .get()
    
    const validBatchIds = batchesResult.data.map(b => b._id)
    debugLog('有效批次数量:', validBatchIds.length)
    debugLog('有效批次ID:', validBatchIds)
    
    if (validBatchIds.length === 0) {
      debugLog('警告：没有找到任何批次，跳过清理')
      return {
        success: true,
        message: '没有找到任何批次',
        deletedCount: 0
      }
    }
    
    // 2. 查询所有任务
    const allTasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .field({ _id: true, batchId: true, batchNumber: true, title: true })
      .get()
    
    debugLog('任务总数:', allTasksResult.data.length)
    
    // 3. 筛选出孤儿任务
    const orphanTasks = allTasksResult.data.filter(task => 
      !validBatchIds.includes(task.batchId)
    )
    
    debugLog('孤儿任务数量:', orphanTasks.length)
    
    if (orphanTasks.length === 0) {
      debugLog('没有孤儿任务需要清理')
      return {
        success: true,
        message: '没有孤儿任务',
        deletedCount: 0
      }
    }
    
    // 按批次号统计
    const batchStats = {}
    orphanTasks.forEach(task => {
      const batchNumber = task.batchNumber || task.batchId || 'unknown'
      batchStats[batchNumber] = (batchStats[batchNumber] || 0) + 1
    })
    
    debugLog('孤儿任务按批次统计:')
    Object.entries(batchStats).forEach(([batchNumber, count]) => {
      debugLog(`  ${batchNumber}: ${count} 个任务`)
    })
    
    // 4. 批量删除孤儿任务
    let deletedCount = 0
    const batchSize = 20 // 每批删除20个
    
    for (let i = 0; i < orphanTasks.length; i += batchSize) {
      const batch = orphanTasks.slice(i, i + batchSize)
      const deletePromises = batch.map(task => 
        db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).doc(task._id).remove()
      )
      
      try {
        await Promise.all(deletePromises)
        deletedCount += batch.length
        debugLog(`已删除 ${deletedCount}/${orphanTasks.length} 个孤儿任务`)
      } catch (error) {
        console.error('删除批次任务失败:', error)
      }
    }
    
    debugLog('===== 清理完成 =====')
    debugLog('总删除数量:', deletedCount)
    
    return {
      success: true,
      message: `成功清理 ${deletedCount} 个孤儿任务`,
      deletedCount,
      batchStats
    }
    
  } catch (error) {
    console.error('清理孤儿任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 导出云函数
exports.main = async (event, context) => {
  return await cleanupAllOrphanTasks()
}

