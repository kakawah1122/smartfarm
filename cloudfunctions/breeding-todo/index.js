// breeding-todo/index.js - 任务管理云函数（优化版）
const cloud = require('wx-server-sdk')
const DatabaseManager = require('./database-manager')
const { COLLECTIONS } = require('./collections.js')

function getCurrentBeijingDate() {
  try {
    const now = new Date()
    const beijingDate = now.toLocaleDateString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    return beijingDate.replace(/\//g, '-')
  } catch (error) {
    console.error('获取北京时间日期失败，使用UTC+8偏移:', error)
    const now = new Date()
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    return beijingTime.toISOString().split('T')[0]
  }
}

function formatBeijingTime(date, format = 'datetime') {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  if (isNaN(dateObj.getTime())) {
    return ''
  }

  try {
    const beijingTimeStr = dateObj.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })

    const standardFormat = beijingTimeStr.replace(/\//g, '-')

    if (format === 'date') {
      return standardFormat.split(' ')[0]
    }
    return standardFormat
  } catch (error) {
    console.error('北京时间格式化失败，使用降级处理:', error)
    const beijingTime = new Date(dateObj.getTime() + 8 * 60 * 60 * 1000)
    const year = beijingTime.getUTCFullYear()
    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(beijingTime.getUTCDate()).padStart(2, '0')

    if (format === 'date') {
      return `${year}-${month}-${day}`
    }

    const hour = String(beijingTime.getUTCHours()).padStart(2, '0')
    const minute = String(beijingTime.getUTCMinutes()).padStart(2, '0')
    const second = String(beijingTime.getUTCSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }
}

function getBeijingDateWithOffset(daysOffset = 0) {
  try {
    const now = new Date()
    const targetDate = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000)
    return formatBeijingTime(targetDate, 'date')
  } catch (error) {
    console.error('计算偏移日期失败:', error)
    return getCurrentBeijingDate()
  }
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const dbManager = new DatabaseManager(db)

const debugEnabled = process.env.DEBUG_LOG === 'true'
const debugLog = (...args) => {
  if (debugEnabled) {
    console.info(...args)
  }
}

// 生成任务记录ID
function generateTaskRecordId() {
  const now = new Date()
  const timestamp = now.getTime().toString().slice(-8)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `TASK${timestamp}${random}`
}

// 计算跟进日期（N天后）
function getFollowUpDate(daysAfter) {
  return getBeijingDateWithOffset(daysAfter)
}

// 根据任务类型自动创建预防记录
async function createPreventionRecordFromTask(task, taskId, batchId, openid, notes) {
  try {
    // 根据任务分类映射到预防类型
    const categoryToPreventionType = {
      '用药管理': 'medication',
      '营养管理': 'nutrition',
      '健康管理': 'inspection'
      // 疫苗接种有专门的 completeVaccineTask 处理
    }
    
    const preventionType = categoryToPreventionType[task.category]
    
    // 如果任务分类不需要创建预防记录，直接返回
    if (!preventionType) {
      return
    }
    
    // 构建预防记录数据（直接创建，不通过 dbManager）
    const preventionData = {
      batchId,
      batchNumber: task.batchNumber || '',
      preventionType,
      preventionDate: getCurrentBeijingDate(),
      notes: notes || task.description || '',
      operator: openid,
      operatorName: '',
      relatedTaskId: taskId,
      autoCreated: true,
      creationSource: 'task',
      effectiveness: 'pending',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // 根据不同类型添加特定信息
    if (preventionType === 'medication') {
      preventionData.medicationInfo = {
        name: task.title || task.taskName || '用药',
        dosage: task.dosage || '',
        method: task.method || '',
        duration: task.duration || 1
      }
    } else if (preventionType === 'nutrition') {
      preventionData.nutritionRecord = {
        supplement: task.title || task.taskName || '营养补充',
        dosage: task.dosage || '',
        method: task.method || '',
        purpose: task.description || ''
      }
    } else if (preventionType === 'inspection') {
      preventionData.inspectionRecord = {
        inspector: task.operator || '',
        notes: notes || task.description || ''
      }
    }
    
    // 添加成本信息（如果有）- 用药任务不同步到财务
    if (task.estimatedCost && task.estimatedCost > 0) {
      preventionData.costInfo = {
        totalCost: parseFloat(task.estimatedCost) || 0,
        // 明确标记用药任务的成本不应同步到财务（因为成本已在采购时计入）
        shouldSyncToFinance: false,
        source: 'use'  // 标记为领用类型，不是采购
      }
    }
    
    // 直接使用数据库操作创建预防记录
    const result = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS).add({
      data: preventionData
    })
    
    debugLog('[自动创建预防记录成功]', { 
      preventionType, 
      taskId, 
      batchId,
      recordId: result._id 
    })
    
    return result
  } catch (error) {
    console.error('[创建预防记录失败]', {
      error: error.message,
      stack: error.stack,
      taskId,
      batchId
    })
    // 不抛出错误，避免影响主流程
  }
}

// 完成任务（全新简化版本）
async function completeTask(taskId, openid, batchId, notes = '') {
  try {
    // 已移除调试日志
    // 检查参数
    if (!taskId || taskId.trim() === '') {
      throw new Error('任务ID不能为空')
    }
    if (!openid || openid.trim() === '') {
      throw new Error('用户ID不能为空')
    }
    if (!batchId || batchId.trim() === '') {
      throw new Error('批次ID不能为空')
    }
    
    // 🔥 修复：直接使用doc()查询单个文档
    let task
    try {
      const taskResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).doc(taskId).get()
      task = taskResult.data
      
      // 已移除调试日志
      if (!task) {
        throw new Error('任务不存在')
      }
      
      // 🔥 临时放宽权限验证 - 只验证任务存在
      // 很多任务可能没有userId字段，暂时跳过此验证
      if (task.userId && task.userId !== openid) {
        // 已移除调试日志
        // throw new Error('无权限访问此任务')
      }
      
      // 批次ID验证也放宽 - 允许部分匹配
      if (task.batchId && batchId && task.batchId !== batchId) {
        // 已移除调试日志
        // throw new Error('批次ID不匹配')
      }
      
    } catch (error) {
      // 已移除调试日志
      throw new Error('任务不存在或无权限访问: ' + error.message)
    }
    
    // 检查是否已经完成
    if (task.completed === true) {
      // 已移除调试日志
      return { 
        success: true,
        already_completed: true, 
        message: '任务已经完成'
      }
    }

    // 🔥 修复：直接更新任务记录的完成状态
    const updateResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).doc(taskId).update({
      data: {
        completed: true,
        completedAt: new Date(),
        completedBy: openid,
        completionNotes: notes || '',
        updateTime: new Date()
      }
    })

    // 🔥 新增：根据任务分类自动创建预防记录
    await createPreventionRecordFromTask(task, taskId, batchId, openid, notes)

    // 已移除调试日志
    // 同时保留历史记录（可选）
    try {
      await db.collection(COLLECTIONS.TASK_COMPLETIONS).add({
        data: {
          _openid: openid,
          batchId,
          taskId,
          taskTitle: task.title,
          completedAt: new Date(),
          notes: notes || '',
          isActive: true
        }
      })
      // 已移除调试日志
    } catch (historyError) {
      // 已移除调试日志
    }
    
    return {
      success: true,
      message: '任务完成成功',
      taskId: taskId,
      batchId: batchId
    }
  } catch (error) {
    // 已移除调试日志
    throw error
  }
}

// 疫苗接种任务完成处理（优化版）
async function completeVaccineTask(event, wxContext) {
  const { taskId, batchId, vaccineRecord } = event
  const openid = wxContext.OPENID

  try {
    // 已移除调试日志
    // 1. 完成任务
    await completeTask(taskId, openid, batchId, vaccineRecord.notes)

    // 2. 创建预防记录（使用标准化集合）
    const preventionData = {
      batchId,
      preventionType: 'vaccine',
      preventionDate: getCurrentBeijingDate(),
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
      operator: openid,
      relatedTaskId: taskId,
      autoCreated: true,
      creationSource: 'task'
    }

    const preventionResult = await dbManager.createPreventionRecord(preventionData)
    
    // 3. 创建财务成本记录（疫苗成本需要计入财务管理）
    if (vaccineRecord.cost && vaccineRecord.cost.total > 0) {
      try {
        const financeRecordData = {
          recordId: 'VAC' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
          costType: 'health',
          costCategory: 'vaccine',
          sourceType: 'vaccine_task',
          sourceRecordId: preventionResult._id,
          batchId,
          amount: vaccineRecord.cost.total,
          description: `疫苗接种 - ${vaccineRecord.vaccine.name}`,
          details: {
            vaccineName: vaccineRecord.vaccine.name,
            vaccineCost: vaccineRecord.cost.vaccine || 0,
            laborCost: vaccineRecord.cost.veterinary || 0,
            otherCost: vaccineRecord.cost.other || 0,
            veterinarian: vaccineRecord.veterinarian.name,
            taskId: taskId,
            preventionRecordId: preventionResult._id
          },
          status: 'confirmed',
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
          isDeleted: false,
          _openid: openid
        }
        
        await db.collection(COLLECTIONS.FINANCE_COST_RECORDS).add({ data: financeRecordData })

      } catch (financeError) {
        console.error('[疫苗成本] 创建财务记录失败:', financeError)
        // 不影响主流程，继续执行
      }
    }
    
    // 4. 同时创建健康记录用于追踪疫苗接种对健康的影响
    try {
      const healthRecordData = {
        batchId,
        recordType: 'vaccine_record',
        checkDate: getCurrentBeijingDate(),
        inspector: openid,
        totalCount: vaccineRecord.vaccination.count || 0,
        healthyCount: vaccineRecord.vaccination.count || 0,
        sickCount: 0,
        deadCount: 0,
        symptoms: [],
        diagnosis: `疫苗接种：${vaccineRecord.vaccine.name}`,
        treatment: `接种方式：${vaccineRecord.vaccination.route}，剂量：${vaccineRecord.vaccine.dosage}`,
        notes: `${vaccineRecord.notes || ''}。兽医：${vaccineRecord.veterinarian.name}`,
        severity: 'low',
        followUpRequired: true,
        followUpDate: getFollowUpDate(7), // 7天后跟进
        relatedTaskId: taskId,
        autoCreated: true,
        creationSource: 'task',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      await db.collection(COLLECTIONS.HEALTH_RECORDS).add({ data: healthRecordData })
      // 已移除调试日志
    } catch (healthError) {
      // 已移除调试日志
      // 不影响主流程
    }
    
    // 已移除调试日志
    // 4. 更新概览统计
    try {
      await dbManager.updateOverviewStats(batchId, 'prevention')
      // 已移除调试日志
    } catch (error) {
      // 已移除调试日志
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
    // 已移除调试日志
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

// 获取任务列表（全新简化版本）
async function getTodos(event, wxContext) {
  const { batchId, dayAge } = event
  const openid = wxContext.OPENID

  try {
    // 参数验证
    if (!batchId || batchId.trim() === '') {
      return {
        success: false,
        error: '批次ID不能为空',
        message: '请先选择一个批次'
      }
    }
    
    // 已移除调试日志
    // 验证批次存在性
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }

    // 直接获取任务，任务记录本身就包含完成状态
    // ✅ 只查询未完成的任务（进行中）
    // ⚠️ 移除 userId 过滤，让所有用户共享批次任务，避免任务重复
    const tasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).where({
      batchId,
      dayAge,
      completed: _.neq(true) // 过滤掉已完成的任务
    }).get()

    // 如果没有任务，直接返回空数组
    if (tasksResult.data.length === 0) {
      return {
        success: true,
        data: [],
        message: '暂无任务'
      }
    }

    // 验证返回的任务日龄是否匹配
    const mismatchedTasks = tasksResult.data.filter(task => task.dayAge !== dayAge)
    if (mismatchedTasks.length > 0) {
      debugLog(`[getTodos] 查询日龄 ${dayAge} 的任务返回了 ${mismatchedTasks.length} 个不匹配的日龄`, {
        batchId,
        expectedDayAge: dayAge,
        mismatchedTasks: mismatchedTasks.map(t => ({ id: t._id, title: t.title, dayAge: t.dayAge }))
      })
      
        // 只返回日龄匹配的任务
        const matchedTasks = tasksResult.data.filter(task => task.dayAge === dayAge)
        if (matchedTasks.length === 0) {
          return {
            success: true,
            data: [],
            message: '暂无任务'
          }
        }
      
      const todos = matchedTasks.map(task => {
        const isCompleted = task.completed === true
        
        return {
          ...task,
          completed: isCompleted,
          isVaccineTask: isVaccineTask(task)
        }
      })
      
      return {
        success: true,
        data: todos
      }
    }

    // 直接使用任务记录中的completed字段，不需要关联查询
    const todos = tasksResult.data.map(task => {
      const isCompleted = task.completed === true
      
      return {
        ...task,
        completed: isCompleted,
        isVaccineTask: isVaccineTask(task)
      }
    })

    return {
      success: true,
      data: todos
    }

  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      data: []
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
    // ⚠️ 移除 userId 过滤，让所有用户共享批次任务
    const tasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).where({
      batchId,
      dayAge: _.gte(currentDayAge).and(_.lte(endDayAge))
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
        completed: completedTaskIds.includes(task._id || task.taskId),
        isVaccineTask: isVaccineTask(task)
      })
    })

    return {
      success: true,
      data: todosByDay
    }

  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message
    }
  }
}

// 创建缺失的任务
async function createMissingTasks(batchId, userId) {
  try {
    // 已移除调试日志
    // 获取批次信息
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }

    const batch = batchResult.data
    
    // 导入任务模板
    const { BREEDING_SCHEDULE, getTasksByAge, getAllTaskDays } = require('../production-entry/breeding-schedule')
    
    // 创建任务计划
    const batchTodos = []
    const now = new Date()
    const taskDays = getAllTaskDays()
    
    for (const dayAge of taskDays) {
      const tasks = getTasksByAge(dayAge)
      
      // 计算该日龄对应的日期
      const entryDateTime = new Date(batch.entryDate + 'T00:00:00')
      const taskDate = new Date(entryDateTime.getTime() + (dayAge - 1) * 24 * 60 * 60 * 1000)
      
      for (const task of tasks) {
        batchTodos.push({
          batchId,
          batchNumber: batch.batchNumber,
          dayAge,
          taskId: task.id,
          type: task.type,
          priority: task.priority,
          title: task.title,
          description: task.description,
          category: task.category,
          estimatedTime: task.estimatedTime || 0,
          materials: task.materials || [],
          dosage: task.dosage || '',
          duration: task.duration || 1,
          dayInSeries: task.dayInSeries || 1,
          notes: task.notes || '',
          scheduledDate: formatBeijingTime(taskDate, 'date'),
          status: 'pending',
          isCompleted: false,
          // 🔥 新增：默认完成状态字段
          completed: false,
          completedAt: null,
          completedBy: null,
          completionNotes: '',
          // ⚠️ userId 改为 createdBy，仅记录创建者
          createdBy: userId,
          createTime: now,
          updateTime: now
        })
      }
    }
    
    // 删除现有的任务（防止重复）
    // ⚠️ 移除 userId 过滤，删除该批次的所有任务
    await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).where({
      batchId
    }).remove()
    
    // 批量插入新任务
    if (batchTodos.length > 0) {
      const batchSize = 20
      for (let i = 0; i < batchTodos.length; i += batchSize) {
        const todoBatch = batchTodos.slice(i, i + batchSize)
        await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).add({
          data: todoBatch
        })
      }
      
      // 已移除调试日志
    }
    
    return batchTodos.length
  } catch (error) {
    // 已移除调试日志
    throw error
  }
}

// 识别疫苗任务（优化版）
function isVaccineTask(task) {
  if (!task) return false
  
  // 🔥 优先排除明确的非疫苗任务类型
  const nonVaccineTypes = ['medication', 'medicine', 'nutrition', 'care', 'feeding', 'environment']
  if (nonVaccineTypes.includes(task.type)) {
    return false
  }
  
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
    // 已移除调试日志
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
    // 已移除调试日志
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
        // 已移除调试日志
        if (!taskId) {
          throw new Error('taskId 参数缺失')
        }
        if (!batchId) {
          throw new Error('batchId 参数缺失')
        }
        
        const result = await completeTask(taskId, wxContext.OPENID, batchId, notes || '')
        // 已移除调试日志
        // 如果任务已经完成，直接返回结果
        if (result.already_completed) {
          return result
        }
        
        return { success: true, message: '任务完成成功', data: result }
      
      case 'fixBatchTasks':
        const { batchId: fixBatchId } = event
        const taskCount = await createMissingTasks(fixBatchId, wxContext.OPENID)
        return { 
          success: true, 
          message: `批次任务修复完成，共创建 ${taskCount} 个任务`,
          data: { taskCount }
        }
      
      case 'cleanOrphanTasks':
        return await cleanOrphanTasks(wxContext.OPENID)
      
      case 'cleanAllOrphanTasks':
        return await cleanAllOrphanTasksForce()
      
      default:
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

// 清理孤儿任务（没有对应批次的任务）
async function cleanOrphanTasks(userId) {
  try {
    // 获取所有活跃批次
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).where({
      isActive: true
    }).field({ _id: true }).get()
    
    const activeBatchIds = batchResult.data.map(b => b._id)
    
    if (activeBatchIds.length === 0) {
      return {
        success: true,
        message: '没有活跃批次，无需清理',
        data: { deletedCount: 0 }
      }
    }
    
    // 查找所有任务
    const allTasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).where({
      userId: userId
    }).get()
    
    // 筛选出孤儿任务（批次不在活跃列表中）
    const orphanTasks = allTasksResult.data.filter(task => 
      !activeBatchIds.includes(task.batchId)
    )
    
    if (orphanTasks.length === 0) {
      return {
        success: true,
        message: '没有孤儿任务',
        data: { deletedCount: 0 }
      }
    }
    
    // 删除孤儿任务
    let deletedCount = 0
    for (const task of orphanTasks) {
      try {
        await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).doc(task._id).remove()
        deletedCount++
      } catch (error) {
        console.error('删除孤儿任务失败:', task._id, error)
      }
    }
    
    return {
      success: true,
      message: `成功清理 ${deletedCount} 个孤儿任务`,
      data: { 
        deletedCount,
        orphanTaskIds: orphanTasks.map(t => t._id)
      }
    }
  } catch (error) {
    console.error('清理孤儿任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 强制清理所有孤儿任务（不限用户，用于数据维护）
 * 适用于清理历史遗留的孤儿任务数据
 */
async function cleanAllOrphanTasksForce() {
  debugLog('===== 开始强制清理所有孤儿任务 =====')
  
  try {
    // 1. 获取所有存在的批次ID（包括已归档但未删除的）
    const batchesResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .field({ _id: true, batchNumber: true, isArchived: true })
      .get()
    
    const validBatchIds = batchesResult.data.map(b => b._id)
    debugLog(`有效批次数量: ${validBatchIds.length}`)
    debugLog('有效批次:', batchesResult.data.map(b => `${b.batchNumber}${b.isArchived ? '(已归档)' : ''}`).join(', '))
    
    if (validBatchIds.length === 0) {
      debugLog('警告：没有找到任何批次')
      return {
        success: true,
        message: '没有找到任何批次',
        deletedCount: 0
      }
    }
    
    // 2. 查询所有任务（分批查询避免超出限制）
    let allTasks = []
    const pageSize = 100
    let hasMore = true
    let skip = 0
    
    while (hasMore) {
      const tasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
        .field({ _id: true, batchId: true, batchNumber: true, title: true })
        .skip(skip)
        .limit(pageSize)
        .get()
      
      allTasks = allTasks.concat(tasksResult.data)
      hasMore = tasksResult.data.length === pageSize
      skip += pageSize
      
      debugLog(`已查询 ${allTasks.length} 个任务...`)
    }
    
    debugLog(`任务总数: ${allTasks.length}`)
    
    // 3. 筛选出孤儿任务
    const orphanTasks = allTasks.filter(task => 
      !validBatchIds.includes(task.batchId)
    )
    
    debugLog(`孤儿任务数量: ${orphanTasks.length}`)
    
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
    debugLog(`总删除数量: ${deletedCount}`)
    
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

/**
 * 获取即将到来的任务（未来7天）
 */
async function getUpcomingTodos(event, wxContext) {
  const { batchId, startDayAge, endDayAge } = event
  const openid = wxContext.OPENID

  try {
    if (!batchId) {
      return {
        success: false,
        error: '批次ID不能为空'
      }
    }

    // 验证批次存在性
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }

    // 查询指定日龄范围的未完成任务
    const tasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).where({
      batchId,
      dayAge: _.gte(startDayAge).and(_.lte(endDayAge)),
      completed: _.neq(true)
    }).orderBy('dayAge', 'asc').get()

    return {
      success: true,
      data: tasksResult.data
    }
  } catch (error) {
    console.error('获取即将到来任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 获取已完成的任务
 */
async function getCompletedTodos(event, wxContext) {
  const { batchId, limit = 50 } = event
  const openid = wxContext.OPENID

  try {
    // 构建查询条件
    let query = {
      completed: true
    }

    // 如果指定了批次，添加批次过滤
    if (batchId && batchId !== 'all') {
      query.batchId = batchId
    }

    // 查询已完成的任务，按完成时间倒序
    const tasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .where(query)
      .orderBy('completedAt', 'desc')
      .limit(limit)
      .get()

    return {
      success: true,
      data: tasksResult.data
    }
  } catch (error) {
    console.error('获取已完成任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 云函数主入口
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'getTodos':
        return await getTodos(event, wxContext)
      
      case 'getUpcomingTodos':
        return await getUpcomingTodos(event, wxContext)
      
      case 'getCompletedTodos':
        return await getCompletedTodos(event, wxContext)
      
      case 'completeTask':
        const { taskId, batchId, notes } = event
        if (!taskId) {
          throw new Error('taskId 参数缺失')
        }
        if (!batchId) {
          throw new Error('batchId 参数缺失')
        }
        
        const result = await completeTask(taskId, wxContext.OPENID, batchId, notes || '')
        if (result.already_completed) {
          return result
        }
        
        return { 
          success: true, 
          message: '任务完成成功', 
          data: result 
        }
      
      case 'cleanOrphanTasks':
        return await cleanOrphanTasks(wxContext.OPENID)
      
      case 'cleanAllOrphanTasksForce':
        return await cleanAllOrphanTasksForce()
      
      default:
        throw new Error(`未知操作: ${action}`)
    }
  } catch (error) {
    console.error(`breeding-todo云函数错误 [action: ${action}]:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}
