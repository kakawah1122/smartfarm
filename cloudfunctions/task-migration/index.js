// task-migration/index.js - 任务数据迁移云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 为现有任务添加completed字段
exports.main = async (event, context) => {
  const { action } = event
  
  try {
    if (action === 'addCompletedField') {
      console.log('🔄 开始为现有任务添加completed字段...')
      
      // 查询所有没有completed字段的任务
      const tasksResult = await db.collection('task_batch_schedules')
        .where({
          completed: db.command.exists(false)
        })
        .get()
      
      console.log(`📋 找到需要迁移的任务数量: ${tasksResult.data.length}`)
      
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
          db.collection('task_batch_schedules').doc(task._id).update({
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
        
        console.log(`✅ 已迁移 ${migratedCount}/${tasksResult.data.length} 个任务`)
      }
      
      console.log(`🎉 任务迁移完成，共迁移 ${migratedCount} 个任务`)
      
      return {
        success: true,
        message: `任务迁移完成，共迁移 ${migratedCount} 个任务`,
        data: { migratedCount }
      }
    }
    
    else if (action === 'migrateCompletedTasks') {
      console.log('🔄 开始从task_completions迁移已完成状态...')
      
      // 获取所有完成记录
      const completionsResult = await db.collection('task_completions').get()
      console.log(`📝 找到完成记录数量: ${completionsResult.data.length}`)
      
      let syncedCount = 0
      
      for (const completion of completionsResult.data) {
        try {
          // 更新对应的任务记录
          const updateResult = await db.collection('task_batch_schedules')
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
            console.log(`✅ 同步任务完成状态: ${completion.taskId}`)
          }
          
        } catch (error) {
          console.warn(`⚠️ 同步任务失败 ${completion.taskId}:`, error.message)
        }
      }
      
      console.log(`🎉 完成状态同步完成，共同步 ${syncedCount} 个任务`)
      
      return {
        success: true,
        message: `完成状态同步完成，共同步 ${syncedCount} 个任务`,
        data: { syncedCount }
      }
    }
    
    else if (action === 'checkMigrationStatus') {
      // 检查迁移状态
      const totalTasks = await db.collection('task_batch_schedules').count()
      const tasksWithCompleted = await db.collection('task_batch_schedules')
        .where({
          completed: db.command.exists(true)
        })
        .count()
      
      const completedTasks = await db.collection('task_batch_schedules')
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
    console.error('❌ 迁移失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
