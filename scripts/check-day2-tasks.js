/**
 * 检查第2日龄任务详情
 * 用于诊断为什么显示24个任务而不是3个
 * 
 * 使用方法：在云开发控制台创建临时云函数并执行
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  console.log('========== 检查 QY-20251103 批次第2日龄任务 ==========')
  
  try {
    // 1. 查找批次
    const batchResult = await db.collection('production_batch_entries')
      .where({
        batchNumber: 'QY-20251103'
      })
      .get()
    
    if (batchResult.data.length === 0) {
      return {
        success: false,
        message: '未找到批次 QY-20251103'
      }
    }
    
    const batch = batchResult.data[0]
    console.log('批次ID:', batch._id)
    console.log('批次号:', batch.batchNumber)
    
    // 2. 查找第2日龄的所有任务
    const tasksResult = await db.collection('task_batch_schedules')
      .where({
        batchId: batch._id,
        dayAge: 2
      })
      .get()
    
    console.log('\n第2日龄任务总数:', tasksResult.data.length)
    console.log('(正确应该是3个)\n')
    
    // 3. 按 taskId 分组统计
    const taskIdMap = {}
    tasksResult.data.forEach(task => {
      const key = task.taskId || task.title
      if (!taskIdMap[key]) {
        taskIdMap[key] = []
      }
      taskIdMap[key].push(task)
    })
    
    console.log('========== 按taskId分组统计 ==========')
    Object.keys(taskIdMap).forEach(taskId => {
      const tasks = taskIdMap[taskId]
      console.log(`\ntaskId: ${taskId}`)
      console.log(`  数量: ${tasks.length} 个`)
      console.log(`  标题: ${tasks[0].title}`)
      
      if (tasks.length > 1) {
        console.log(`  ⚠️ 重复 ${tasks.length} 次!`)
        tasks.forEach((task, index) => {
          console.log(`    副本${index + 1}: ${task._id} (createdBy: ${task.createdBy || task.userId})`)
        })
      }
    })
    
    // 4. 详细输出每个任务
    console.log('\n========== 所有任务详情 ==========')
    tasksResult.data.forEach((task, index) => {
      console.log(`\n--- 任务 ${index + 1}/${tasksResult.data.length} ---`)
      console.log('ID:', task._id)
      console.log('taskId:', task.taskId)
      console.log('标题:', task.title)
      console.log('描述长度:', task.description?.length || 0, '字符')
      console.log('描述内容:', task.description || '无')
      console.log('分类:', task.category)
      console.log('类型:', task.type)
      console.log('创建者:', task.createdBy || task.userId)
      console.log('完成状态:', task.completed ? '已完成' : '未完成')
    })
    
    // 5. 检查是否有description被拆分的情况
    const descriptionAnalysis = {}
    tasksResult.data.forEach(task => {
      const desc = task.description || ''
      const lines = desc.split('。').filter(l => l.trim())
      if (lines.length > 1) {
        descriptionAnalysis[task.title] = {
          totalLines: lines.length,
          lines: lines
        }
      }
    })
    
    if (Object.keys(descriptionAnalysis).length > 0) {
      console.log('\n========== Description 多行分析 ==========')
      Object.keys(descriptionAnalysis).forEach(title => {
        const analysis = descriptionAnalysis[title]
        console.log(`\n任务: ${title}`)
        console.log(`  句子数量: ${analysis.totalLines}`)
        analysis.lines.forEach((line, index) => {
          console.log(`  第${index + 1}句: ${line}`)
        })
      })
    }
    
    return {
      success: true,
      data: {
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        totalTasks: tasksResult.data.length,
        expectedTasks: 3,
        taskGroups: Object.keys(taskIdMap).map(taskId => ({
          taskId,
          title: taskIdMap[taskId][0].title,
          count: taskIdMap[taskId].length,
          isDuplicate: taskIdMap[taskId].length > 1
        })),
        allTasks: tasksResult.data.map(t => ({
          id: t._id,
          taskId: t.taskId,
          title: t.title,
          category: t.category,
          createdBy: t.createdBy || t.userId
        }))
      }
    }
    
  } catch (error) {
    console.error('检查失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

