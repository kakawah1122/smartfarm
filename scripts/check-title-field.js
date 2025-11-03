/**
 * 检查任务的title字段
 * 对比"进行中"和"即将到来"查到的数据差异
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const BATCH_NUMBER = 'QY-20251103'
  const DAY_AGE_TODAY = 1
  const DAY_AGE_UPCOMING = 2
  
  console.log('========== 对比任务数据 ==========')
  
  try {
    // 1. 查找批次
    const batchResult = await db.collection('production_batch_entries')
      .where({ batchNumber: BATCH_NUMBER })
      .get()
    
    if (batchResult.data.length === 0) {
      return { success: false, message: '未找到批次' }
    }
    
    const batch = batchResult.data[0]
    const batchId = batch._id
    
    console.log('批次ID:', batchId)
    console.log('批次号:', batch.batchNumber)
    
    // 2. 查询"进行中"的任务（第1日龄，未完成）
    console.log('\n========== "进行中"任务查询 ==========')
    const todayTasks = await db.collection('task_batch_schedules')
      .where({
        batchId,
        dayAge: DAY_AGE_TODAY,
        completed: _.neq(true)
      })
      .get()
    
    console.log('查到任务数:', todayTasks.data.length)
    todayTasks.data.forEach((task, index) => {
      console.log(`\n任务 ${index + 1}:`)
      console.log('  _id:', task._id)
      console.log('  taskId:', task.taskId)
      console.log('  title:', task.title)
      console.log('  title存在:', !!task.title)
      console.log('  description:', task.description?.substring(0, 50) + '...')
      console.log('  completed:', task.completed)
      console.log('  所有字段:', Object.keys(task).join(', '))
    })
    
    // 3. 查询"即将到来"的任务（第2日龄，所有状态）
    console.log('\n========== "即将到来"任务查询 ==========')
    const upcomingTasks = await db.collection('task_batch_schedules')
      .where({
        batchId,
        dayAge: DAY_AGE_UPCOMING
      })
      .get()
    
    console.log('查到任务数:', upcomingTasks.data.length)
    upcomingTasks.data.forEach((task, index) => {
      console.log(`\n任务 ${index + 1}:`)
      console.log('  _id:', task._id)
      console.log('  taskId:', task.taskId)
      console.log('  title:', task.title)
      console.log('  title存在:', !!task.title)
      console.log('  description:', task.description?.substring(0, 50) + '...')
      console.log('  completed:', task.completed)
      console.log('  所有字段:', Object.keys(task).join(', '))
    })
    
    // 4. 对比字段差异
    console.log('\n========== 字段对比 ==========')
    if (todayTasks.data.length > 0 && upcomingTasks.data.length > 0) {
      const todayFields = Object.keys(todayTasks.data[0])
      const upcomingFields = Object.keys(upcomingTasks.data[0])
      
      const onlyInToday = todayFields.filter(f => !upcomingFields.includes(f))
      const onlyInUpcoming = upcomingFields.filter(f => !todayFields.includes(f))
      
      console.log('"进行中"独有字段:', onlyInToday.join(', ') || '无')
      console.log('"即将到来"独有字段:', onlyInUpcoming.join(', ') || '无')
      
      // 检查title字段
      const todayHasTitle = todayTasks.data.every(t => !!t.title)
      const upcomingHasTitle = upcomingTasks.data.every(t => !!t.title)
      
      console.log('\n"进行中"所有任务都有title:', todayHasTitle)
      console.log('"即将到来"所有任务都有title:', upcomingHasTitle)
    }
    
    return {
      success: true,
      batchId,
      todayTasksCount: todayTasks.data.length,
      upcomingTasksCount: upcomingTasks.data.length,
      todayTasksTitles: todayTasks.data.map(t => ({ id: t._id, title: t.title, hasTitle: !!t.title })),
      upcomingTasksTitles: upcomingTasks.data.map(t => ({ id: t._id, title: t.title, hasTitle: !!t.title }))
    }
    
  } catch (error) {
    console.error('检查失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

