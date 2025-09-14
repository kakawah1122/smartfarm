// breeding-todo/index.js - 任务管理云函数（优化版）
const cloud = require('wx-server-sdk')
const DatabaseManager = require('./database-manager')
const { COLLECTIONS } = require('./collections')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const dbManager = new DatabaseManager(db)

// 生成任务记录ID
function generateTaskRecordId() {
  const now = new Date()
  const timestamp = now.getTime().toString().slice(-8)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `TASK${timestamp}${random}`
}

// 完成任务（通用方法）
async function completeTask(taskId, openid, batchId, notes = '') {
  try {
    // 检查是否已经完成
    const existing = await db.collection(COLLECTIONS.TASK_COMPLETIONS).where({
      _openid: openid,
      batchId,
      taskId
    }).get()

    if (existing.data.length > 0) {
      throw new Error('任务已经完成')
    }

    // 创建完成记录
    const result = await db.collection(COLLECTIONS.TASK_COMPLETIONS).add({
      data: {
        _openid: openid,
        batchId,
        taskId,
        completedAt: new Date(),
        notes: notes || '',
        isActive: true
      }
    })

    return result
  } catch (error) {
    console.error('完成任务失败:', error)
    throw error
  }
}

// 疫苗接种任务完成处理（优化版）
async function completeVaccineTask(event, wxContext) {
  const { taskId, batchId, vaccineRecord } = event
  const openid = wxContext.OPENID

  try {
    console.log('开始处理疫苗接种任务:', { taskId, batchId })

    // 1. 完成任务
    await completeTask(taskId, openid, batchId, vaccineRecord.notes)

    // 2. 创建预防记录（使用标准化集合）
    const preventionData = {
      batchId,
      preventionType: 'vaccine',
      preventionDate: new Date().toISOString().split('T')[0],
      vaccineInfo: {
        name: vaccineRecord.vaccine.name,
        manufacturer: vaccineRecord.vaccine.manufacturer || '',
        batchNumber: vaccineRecord.vaccine.batchNumber || '',
        dosage: vaccineRecord.vaccine.dosage || '',
        route: vaccineRecord.vaccination.route,
        count: vaccineRecord.vaccination.count
      },
      veterinarianInfo: {
        name: vaccineRecord.veterinarian.name,
        contact: vaccineRecord.veterinarian.contact || ''
      },
      costInfo: {
        vaccineCost: vaccineRecord.cost.vaccine || 0,
        laborCost: vaccineRecord.cost.veterinary || 0,
        otherCost: vaccineRecord.cost.other || 0,
        totalCost: vaccineRecord.cost.total || 0
      },
      effectiveness: 'pending',
      notes: vaccineRecord.notes || '',
      operator: openid
    }

    const preventionResult = await dbManager.createPreventionRecord(preventionData)
    console.log('预防记录创建成功:', preventionResult._id)

    // 3. 创建成本记录（正确的财务流向）
    if (vaccineRecord.cost && vaccineRecord.cost.total > 0) {
      const costData = {
        costType: 'medical',
        subCategory: 'vaccine',
        title: `疫苗接种费用 - ${vaccineRecord.vaccine.name}`,
        description: `批次：${batchId}，接种数量：${vaccineRecord.vaccination.count}只`,
        amount: vaccineRecord.cost.total,
        batchId,
        relatedRecords: [{
          type: 'prevention',
          recordId: preventionResult._id
        }],
        costBreakdown: {
          vaccine: vaccineRecord.cost.vaccine || 0,
          labor: vaccineRecord.cost.veterinary || 0,
          other: vaccineRecord.cost.other || 0
        },
        costDate: new Date().toISOString().split('T')[0],
        createdBy: openid
      }

      await dbManager.createCostRecord(costData)
      console.log('成本记录创建成功')
    }

    // 4. 更新概览统计
    try {
      await dbManager.updateOverviewStats(batchId, 'prevention')
      console.log('概览统计更新成功')
    } catch (error) {
      console.error('更新概览统计失败:', error)
      // 不影响主流程，继续执行
    }

    // 5. 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'complete_vaccine_task',
      'health_prevention_records',
      preventionResult._id,
      {
        batchId,
        taskId,
        vaccineName: vaccineRecord.vaccine.name,
        cost: vaccineRecord.cost.total,
        result: 'success'
      }
    )

    return {
      success: true,
      message: '疫苗接种任务完成成功',
      data: {
        taskCompleted: true,
        preventionRecordId: preventionResult._id,
        hasAdverseReactions: false
      }
    }

  } catch (error) {
    console.error('完成疫苗接种任务失败:', error)
    
    // 记录错误日志
    await dbManager.createAuditLog(
      openid,
      'complete_vaccine_task',
      'health_prevention_records',
      null,
      {
        batchId,
        taskId,
        error: error.message,
        result: 'failure'
      }
    )

    return {
      success: false,
      error: error.message || '疫苗接种任务完成失败',
      data: null
    }
  }
}

// 获取任务列表（优化版）
async function getTodos(event, wxContext) {
  const { batchId, dayAge } = event
  const openid = wxContext.OPENID

  try {
    // 验证批次存在性
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }

    // 获取当前日龄的任务
    const tasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).where({
      batchId,
      dayAge,
      userId: openid
    }).get()

    // 获取已完成的任务
    const completedResult = await db.collection(COLLECTIONS.TASK_COMPLETIONS).where({
      _openid: openid,
      batchId,
      dayAge
    }).get()

    const completedTaskIds = completedResult.data.map(item => item.taskId)

    // 标记任务完成状态
    const todos = tasksResult.data.map(task => ({
      ...task,
      completed: completedTaskIds.includes(task._id),
      isVaccineTask: isVaccineTask(task)
    }))

    return {
      success: true,
      data: todos
    }

  } catch (error) {
    console.error('获取待办任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取一周任务（优化版）
async function getWeeklyTodos(event, wxContext) {
  const { batchId, currentDayAge } = event
  const openid = wxContext.OPENID
  const endDayAge = currentDayAge + 7

  try {
    // 验证批次存在性
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }

    // 获取一周内的任务
    const tasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).where({
      batchId,
      dayAge: _.gte(currentDayAge).and(_.lte(endDayAge)),
      userId: openid
    }).get()

    // 获取已完成的任务
    const completedResult = await db.collection(COLLECTIONS.TASK_COMPLETIONS).where({
      _openid: openid,
      batchId,
      dayAge: _.gte(currentDayAge).and(_.lte(endDayAge))
    }).get()

    const completedTaskIds = completedResult.data.map(item => item.taskId)

    // 按日龄分组任务
    const todosByDay = {}
    tasksResult.data.forEach(task => {
      const day = task.dayAge
      if (!todosByDay[day]) {
        todosByDay[day] = []
      }
      todosByDay[day].push({
        ...task,
        completed: completedTaskIds.includes(task._id),
        isVaccineTask: isVaccineTask(task)
      })
    })

    return {
      success: true,
      data: todosByDay
    }

  } catch (error) {
    console.error('获取周任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 识别疫苗任务（优化版）
function isVaccineTask(task) {
  if (!task) return false
  
  // 检查任务类型
  if (task.type === 'vaccine') return true
  
  // 检查任务标题和描述中的关键词
  const vaccineKeywords = [
    '疫苗', '接种', '免疫', '注射', '血清', '抗体',
    '一针', '二针', '三针', '新城疫', '禽流感',
    'vaccine', 'vaccination', 'immunization'
  ]
  
  const title = task.title || ''
  const description = task.description || ''
  const taskName = task.taskName || ''
  
  return vaccineKeywords.some(keyword => 
    title.includes(keyword) || 
    description.includes(keyword) || 
    taskName.includes(keyword)
  )
}

// 清除已完成任务
async function clearCompletedTasks(event, wxContext) {
  const { batchId } = event
  const openid = wxContext.OPENID

  try {
    const result = await db.collection(COLLECTIONS.TASK_COMPLETIONS).where({
      _openid: openid,
      batchId
    }).remove()

    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('清除已完成任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 创建任务记录
async function createTaskRecord(record) {
  try {
    const result = await db.collection(COLLECTIONS.TASK_RECORDS).add({
      data: record
    })

    return result
  } catch (error) {
    console.error('创建任务记录失败:', error)
    throw error
  }
}

// 主函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'completeVaccineTask':
        return await completeVaccineTask(event, wxContext)
      
      case 'getTodos':
        return await getTodos(event, wxContext)
      
      case 'getTodayTasks':
        return await getTodos(event, wxContext)
      
      case 'getWeeklyTodos':
        return await getWeeklyTodos(event, wxContext)
      
      case 'clearCompletedTasks':
        return await clearCompletedTasks(event, wxContext)
      
      case 'completeTask':
        const { taskId, batchId, notes } = event
        await completeTask(taskId, wxContext.OPENID, batchId, notes)
        return { success: true, message: '任务完成成功' }
      
      default:
        throw new Error(`未知操作: ${action}`)
    }
  } catch (error) {
    console.error('云函数执行失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
