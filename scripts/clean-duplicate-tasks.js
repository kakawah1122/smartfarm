/**
 * 清理重复任务脚本
 * 问题：每个用户都有自己的任务副本，导致任务数量激增
 * 解决：保留第一个用户的任务，删除其他重复任务
 * 
 * 使用方法：
 * 在云开发控制台的"云函数"中创建一个临时云函数，粘贴下面的代码并执行
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  console.log('开始清理重复任务...')
  
  try {
    // 1. 查找所有任务
    const allTasks = await db.collection('task_batch_schedules')
      .limit(1000)
      .get()
    
    console.log(`找到任务总数: ${allTasks.data.length}`)
    
    // 2. 按批次和日龄分组
    const batchDayMap = {}
    
    allTasks.data.forEach(task => {
      const key = `${task.batchId}_${task.dayAge}_${task.taskId || task.title}`
      if (!batchDayMap[key]) {
        batchDayMap[key] = []
      }
      batchDayMap[key].push(task)
    })
    
    // 3. 找出重复的任务
    let duplicateCount = 0
    let keptCount = 0
    const tasksToDelete = []
    
    Object.keys(batchDayMap).forEach(key => {
      const tasks = batchDayMap[key]
      if (tasks.length > 1) {
        console.log(`发现重复任务组 [${key}]: ${tasks.length} 个副本`)
        duplicateCount += tasks.length - 1
        
        // 保留第一个任务，删除其他
        const [kept, ...toDelete] = tasks
        keptCount++
        
        console.log(`  保留任务: ${kept._id} (用户: ${kept.userId})`)
        toDelete.forEach(task => {
          console.log(`  删除任务: ${task._id} (用户: ${task.userId})`)
          tasksToDelete.push(task._id)
        })
      }
    })
    
    console.log(`\n统计结果:`)
    console.log(`- 总任务数: ${allTasks.data.length}`)
    console.log(`- 保留任务: ${keptCount} 组`)
    console.log(`- 重复任务: ${duplicateCount} 个`)
    console.log(`- 将删除: ${tasksToDelete.length} 个`)
    
    // 4. 执行删除（可选：取消注释下面的代码来实际执行删除）
    /*
    if (tasksToDelete.length > 0) {
      // 批量删除
      const batchSize = 20
      for (let i = 0; i < tasksToDelete.length; i += batchSize) {
        const batch = tasksToDelete.slice(i, i + batchSize)
        await Promise.all(batch.map(id => 
          db.collection('task_batch_schedules').doc(id).remove()
        ))
        console.log(`已删除 ${Math.min(i + batchSize, tasksToDelete.length)}/${tasksToDelete.length}`)
      }
      console.log('删除完成！')
    }
    */
    
    return {
      success: true,
      message: '分析完成（未执行删除，请取消注释代码后重新运行）',
      data: {
        totalTasks: allTasks.data.length,
        keptTasks: keptCount,
        duplicateTasks: duplicateCount,
        toDelete: tasksToDelete.length,
        deleteIds: tasksToDelete
      }
    }
    
  } catch (error) {
    console.error('清理失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

