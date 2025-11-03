// 诊断任务数据脚本
// 用于查看批次 QY-20251013 的任务数据

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

async function diagnoseTasks() {
  try {
    console.log('========== 开始诊断任务数据 ==========')
    
    // 1. 查找批次号为 QY-20251013 的批次
    const batchResult = await db.collection('production_batch_entries')
      .where({
        batchNumber: 'QY-20251013'
      })
      .get()
    
    console.log('找到的批次数量:', batchResult.data.length)
    
    if (batchResult.data.length === 0) {
      console.log('未找到批次 QY-20251013')
      return
    }
    
    const batch = batchResult.data[0]
    console.log('批次信息:', {
      _id: batch._id,
      batchNumber: batch.batchNumber,
      entryDate: batch.entryDate,
      quantity: batch.quantity
    })
    
    // 2. 查找该批次的所有任务（第1日龄）
    const tasksResult = await db.collection('task_batch_schedules')
      .where({
        batchId: batch._id,
        dayAge: 1
      })
      .get()
    
    console.log('\n========== 第1日龄任务总数:', tasksResult.data.length, '==========')
    
    // 3. 详细输出每个任务
    tasksResult.data.forEach((task, index) => {
      console.log(`\n--- 任务 ${index + 1} ---`)
      console.log('任务ID:', task._id)
      console.log('标题:', task.title)
      console.log('描述:', task.description)
      console.log('类型:', task.type)
      console.log('分类:', task.category)
      console.log('用户ID:', task.userId)
      console.log('是否完成:', task.completed)
      console.log('创建时间:', task.createTime)
    })
    
    // 4. 统计任务类型分布
    const typeCount = {}
    tasksResult.data.forEach(task => {
      const type = task.type || 'unknown'
      typeCount[type] = (typeCount[type] || 0) + 1
    })
    
    console.log('\n========== 任务类型分布 ==========')
    Object.keys(typeCount).forEach(type => {
      console.log(`${type}: ${typeCount[type]} 个`)
    })
    
    // 5. 统计用户ID分布
    const userCount = {}
    tasksResult.data.forEach(task => {
      const userId = task.userId || 'unknown'
      userCount[userId] = (userCount[userId] || 0) + 1
    })
    
    console.log('\n========== 用户ID分布 ==========')
    Object.keys(userCount).forEach(userId => {
      console.log(`${userId}: ${userCount[userId]} 个任务`)
    })
    
    // 6. 检查是否有重复的任务
    const taskKeys = {}
    const duplicates = []
    tasksResult.data.forEach(task => {
      const key = `${task.title}_${task.type}`
      if (taskKeys[key]) {
        duplicates.push({
          key,
          task1: taskKeys[key],
          task2: task._id
        })
      } else {
        taskKeys[key] = task._id
      }
    })
    
    if (duplicates.length > 0) {
      console.log('\n========== 发现重复任务 ==========')
      duplicates.forEach((dup, index) => {
        console.log(`重复 ${index + 1}:`, dup.key)
        console.log('  任务ID 1:', dup.task1)
        console.log('  任务ID 2:', dup.task2)
      })
    } else {
      console.log('\n未发现重复任务')
    }
    
    console.log('\n========== 诊断完成 ==========')
    
  } catch (error) {
    console.error('诊断失败:', error)
  }
}

diagnoseTasks()

