// task-migration/index.js - 任务数据迁移云函数
const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 为现有任务添加completed字段
exports.main = async (event, context) => {
  const { action } = event
  
  try {
    if (action === 'addCompletedField') {
      // 已移除调试日志
      // 查询所有没有completed字段的任务
      const tasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
        .where({
          completed: db.command.exists(false)
        })
        .get()
      
      // 已移除调试日志
      if (tasksResult.data.length === 0) {
        return {
          success: true,
          message: '所有任务都已有completed字段，无需迁移',
          data: { migratedCount: 0 }
        }
      }
      
      // 批量更新任务
      let migratedCount = 0
      const batchSize = 20
      
      for (let i = 0; i < tasksResult.data.length; i += batchSize) {
        const batch = tasksResult.data.slice(i, i + batchSize)
        const promises = batch.map(task => 
          db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).doc(task._id).update({
            data: {
              completed: false,
              completedAt: null,
              completedBy: null,
              completionNotes: '',
              updateTime: new Date()
            }
          })
        )
        
        await Promise.all(promises)
        migratedCount += batch.length
        
        // 已移除调试日志
      }
      
      // 已移除调试日志
      return {
        success: true,
        message: `任务迁移完成，共迁移 ${migratedCount} 个任务`,
        data: { migratedCount }
      }
    }
    
    else if (action === 'migrateCompletedTasks') {
      // 已移除调试日志
      // 获取所有完成记录
      const completionsResult = await db.collection(COLLECTIONS.TASK_COMPLETIONS).get()
      // 已移除调试日志
      let syncedCount = 0
      
      for (const completion of completionsResult.data) {
        try {
          // 更新对应的任务记录
          const updateResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
            .doc(completion.taskId)
            .update({
              data: {
                completed: true,
                completedAt: completion.completedAt,
                completedBy: completion._openid,
                completionNotes: completion.notes || '',
                updateTime: new Date()
              }
            })
          
          if (updateResult.stats.updated > 0) {
            syncedCount++
            // 已移除调试日志
          }
          
        } catch (error) {
          // 已移除调试日志
        }
      }
      
      // 已移除调试日志
      return {
        success: true,
        message: `完成状态同步完成，共同步 ${syncedCount} 个任务`,
        data: { syncedCount }
      }
    }
    
    else if (action === 'checkMigrationStatus') {
      // 检查迁移状态
      const totalTasks = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).count()
      const tasksWithCompleted = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
        .where({
          completed: db.command.exists(true)
        })
        .count()
      
      const completedTasks = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
        .where({
          completed: true
        })
        .count()
      
      return {
        success: true,
        message: '迁移状态检查完成',
        data: {
          totalTasks: totalTasks.total,
          tasksWithCompletedField: tasksWithCompleted.total,
          completedTasks: completedTasks.total,
          needsMigration: totalTasks.total - tasksWithCompleted.total
        }
      }
    }
    
    else {
      throw new Error(`未知操作: ${action}`)
    }
    
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message
    }
  }
}
