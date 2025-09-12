// breeding-todo/index.js - 养殖待办事项管理云函数

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()

  console.log('breeding-todo云函数调用:', { action, event })

  try {
    switch (action) {
      case 'completeTask':
        return await completeTask(event, wxContext)
      case 'uncompleteTask':
        return await uncompleteTask(event, wxContext)
      case 'getCompletedTaskIds':
        return await getCompletedTaskIds(event, wxContext)
      case 'getCompletedTasks':
        return await getCompletedTasks(event, wxContext)
      case 'addTaskRecord':
        return await addTaskRecord(event, wxContext)
      case 'getTaskStatistics':
        return await getTaskStatistics(event, wxContext)
      case 'getBatchProgress':
        return await getBatchProgress(event, wxContext)
      case 'getBatchTasks':
        return await getBatchTasks(event, wxContext)
      case 'getTodayTasks':
        return await getTodayTasks(event, wxContext)
      case 'getUpcomingTasks':
        return await getUpcomingTasks(event, wxContext)
      default:
        throw new Error(`未知操作: ${action}`)
    }
  } catch (error) {
    console.error('breeding-todo云函数执行失败:', error)
    return {
      success: false,
      error: error.message || '操作失败',
      data: null
    }
  }
}

/**
 * 完成任务
 */
async function completeTask(event, wxContext) {
  const { batchId, dayAge, taskId, completedTime } = event
  const openid = wxContext.OPENID

  // 检查是否已经完成过
  const existing = await db.collection('task_completions').where({
    _openid: openid,
    batchId,
    dayAge,
    taskId
  }).get()

  if (existing.data.length > 0) {
    return {
      success: true,
      message: '任务已完成',
      data: existing.data[0]
    }
  }

  // 创建完成记录
  const result = await db.collection('task_completions').add({
    data: {
      _openid: openid,
      batchId,
      dayAge,
      taskId,
      completedTime: completedTime || new Date().toISOString(),
      createTime: new Date(),
      isDeleted: false
    }
  })

  return {
    success: true,
    message: '任务完成成功',
    data: { _id: result._id }
  }
}

/**
 * 取消完成任务
 */
async function uncompleteTask(event, wxContext) {
  const { batchId, dayAge, taskId } = event
  const openid = wxContext.OPENID

  // 删除完成记录
  await db.collection('task_completions').where({
    _openid: openid,
    batchId,
    dayAge,
    taskId
  }).update({
    data: {
      isDeleted: true,
      updateTime: new Date()
    }
  })

  return {
    success: true,
    message: '已取消任务完成状态'
  }
}

/**
 * 获取已完成任务ID列表
 */
async function getCompletedTaskIds(event, wxContext) {
  const { batchId, dayAge } = event
  const openid = wxContext.OPENID

  const result = await db.collection('task_completions').where({
    _openid: openid,
    batchId,
    dayAge,
    isDeleted: false
  }).field({
    taskId: true
  }).get()

  const taskIds = result.data.map(item => item.taskId)

  return {
    success: true,
    data: taskIds
  }
}

/**
 * 获取已完成任务详细信息
 */
async function getCompletedTasks(event, wxContext) {
  const { batchId, limit = 50 } = event
  const openid = wxContext.OPENID

  const result = await db.collection('task_completions').where({
    _openid: openid,
    batchId,
    isDeleted: false
  }).orderBy('completedTime', 'desc').limit(limit).get()

  // 整合任务信息
  const tasksWithDetails = await Promise.all(result.data.map(async (completion) => {
    // 这里可以从任务配置中获取任务详情
    // 由于任务配置在前端，这里返回基础信息
    return {
      id: completion.taskId,
      taskId: completion.taskId,
      dayAge: completion.dayAge,
      completedDate: formatDate(completion.completedTime),
      completedTime: completion.completedTime
    }
  }))

  return {
    success: true,
    data: tasksWithDetails
  }
}

/**
 * 添加任务记录
 */
async function addTaskRecord(event, wxContext) {
  const { batchId, taskId, dayAge, recordType, recordData } = event
  const openid = wxContext.OPENID

  const record = {
    _openid: openid,
    batchId,
    taskId,
    dayAge,
    recordType, // 记录类型：vaccine, medication, inspection等
    recordData,
    createTime: new Date(),
    isDeleted: false
  }

  const result = await db.collection('task_records').add({
    data: record
  })

  return {
    success: true,
    message: '任务记录添加成功',
    data: { _id: result._id }
  }
}

/**
 * 获取任务统计信息
 */
async function getTaskStatistics(event, wxContext) {
  const { batchId } = event
  const openid = wxContext.OPENID

  // 获取完成统计
  const completedTasks = await db.collection('task_completions').where({
    _openid: openid,
    batchId,
    isDeleted: false
  }).get()

  // 统计每日完成情况
  const dailyStats = {}
  completedTasks.data.forEach(task => {
    const dayAge = task.dayAge
    if (!dailyStats[dayAge]) {
      dailyStats[dayAge] = {
        dayAge,
        completedCount: 0,
        tasks: []
      }
    }
    dailyStats[dayAge].completedCount++
    dailyStats[dayAge].tasks.push(task.taskId)
  })

  // 统计任务类型完成情况
  const typeStats = {}
  const priorityStats = {}

  // 这里需要根据实际任务配置来统计
  // 由于任务配置在前端，这里返回基础统计

  return {
    success: true,
    data: {
      totalCompleted: completedTasks.data.length,
      dailyStats: Object.values(dailyStats),
      typeStats,
      priorityStats,
      lastUpdateTime: new Date().toISOString()
    }
  }
}

/**
 * 获取批次进度
 */
async function getBatchProgress(event, wxContext) {
  const { batchId } = event
  const openid = wxContext.OPENID

  try {
    // 获取批次信息
    const batchResult = await db.collection('entry_records').doc(batchId).get()
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }

    const batch = batchResult.data
    const entryDate = new Date(batch.entryDate)
    const currentDate = new Date()
    const dayAge = Math.ceil((currentDate - entryDate) / (1000 * 60 * 60 * 24)) + 1

    // 获取已完成任务
    const completedResult = await db.collection('task_completions').where({
      _openid: openid,
      batchId,
      isDeleted: false
    }).get()

    const completedByDay = {}
    completedResult.data.forEach(task => {
      if (!completedByDay[task.dayAge]) {
        completedByDay[task.dayAge] = []
      }
      completedByDay[task.dayAge].push(task.taskId)
    })

    // 计算进度
    const progress = {
      batchId,
      batchNumber: batch.batchNumber,
      entryDate: batch.entryDate,
      currentDayAge: dayAge,
      totalCompleted: completedResult.data.length,
      dailyProgress: completedByDay,
      lastUpdateTime: new Date().toISOString()
    }

    return {
      success: true,
      data: progress
    }
  } catch (error) {
    console.error('获取批次进度失败:', error)
    throw error
  }
}

/**
 * 获取批次任务列表
 */
async function getBatchTasks(event, wxContext) {
  const { batchId } = event
  const openid = wxContext.OPENID

  try {
    const result = await db.collection('batch_todos').where({
      batchId,
      userId: openid
    }).orderBy('dayAge', 'asc').get()

    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    console.error('获取批次任务失败:', error)
    throw error
  }
}

/**
 * 获取今日任务
 */
async function getTodayTasks(event, wxContext) {
  const { batchId } = event
  const openid = wxContext.OPENID

  try {
    // 获取批次信息
    const batchResult = await db.collection('entry_records').doc(batchId).get()
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }

    const batch = batchResult.data
    const entryDate = new Date(batch.entryDate)
    const currentDate = new Date()
    
    // 计算当前日龄 - 只比较日期部分
    const todayDateStr = currentDate.toISOString().split('T')[0]
    const entryDateStr = batch.entryDate.split('T')[0]
    
    const todayDate = new Date(todayDateStr + 'T00:00:00')
    const entryDateTime = new Date(entryDateStr + 'T00:00:00')
    
    const diffTime = todayDate.getTime() - entryDateTime.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const dayAge = diffDays + 1

    console.log(`今日任务查询: 批次${batch.batchNumber}, 入栏${entryDateStr}, 今日${todayDateStr}, 日龄${dayAge}`)

    // 从batch_todos获取今日任务
    const tasksResult = await db.collection('batch_todos').where({
      batchId,
      dayAge,
      userId: openid
    }).get()

    const todayTasks = tasksResult.data || []

    // 获取已完成状态
    const completedResult = await db.collection('task_completions').where({
      _openid: openid,
      batchId,
      dayAge,
      isDeleted: false
    }).get()

    const completedTaskIds = completedResult.data.map(item => item.taskId)

    // 合并完成状态
    const tasksWithStatus = todayTasks.map(task => ({
      ...task,
      completed: completedTaskIds.includes(task.taskId)
    }))

    return {
      success: true,
      data: {
        dayAge,
        tasks: tasksWithStatus
      }
    }
  } catch (error) {
    console.error('获取今日任务失败:', error)
    throw error
  }
}

/**
 * 获取即将到来的任务
 */
async function getUpcomingTasks(event, wxContext) {
  const { batchId, days = 7 } = event
  const openid = wxContext.OPENID

  try {
    // 获取批次信息
    const batchResult = await db.collection('entry_records').doc(batchId).get()
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }

    const batch = batchResult.data
    
    // 计算日龄范围
    const today = new Date()
    const todayDateStr = today.toISOString().split('T')[0]
    const entryDateStr = batch.entryDate.split('T')[0]
    
    const todayDate = new Date(todayDateStr + 'T00:00:00')
    const entryDateTime = new Date(entryDateStr + 'T00:00:00')
    
    const diffTime = todayDate.getTime() - entryDateTime.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const currentDayAge = diffDays + 1

    const endDayAge = currentDayAge + days - 1

    // 获取即将到来的任务
    const tasksResult = await db.collection('batch_todos').where({
      batchId,
      dayAge: _.gte(currentDayAge).and(_.lte(endDayAge)),
      userId: openid
    }).orderBy('dayAge', 'asc').get()

    // 按日龄分组
    const tasksByDay = {}
    tasksResult.data.forEach(task => {
      if (!tasksByDay[task.dayAge]) {
        tasksByDay[task.dayAge] = []
      }
      tasksByDay[task.dayAge].push(task)
    })

    const upcomingTasks = []
    for (let age = currentDayAge; age <= endDayAge; age++) {
      if (tasksByDay[age]) {
        upcomingTasks.push({
          dayAge: age,
          tasks: tasksByDay[age]
        })
      }
    }

    return {
      success: true,
      data: upcomingTasks
    }
  } catch (error) {
    console.error('获取即将到来的任务失败:', error)
    throw error
  }
}

/**
 * 格式化日期
 */
function formatDate(dateString) {
  const date = new Date(dateString)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  
  return `${month}月${day}日 ${hours}:${minutes.toString().padStart(2, '0')}`
}
