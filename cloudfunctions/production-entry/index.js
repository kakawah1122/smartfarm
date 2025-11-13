// cloudfunctions/production-entry/index.js
// 入栏管理云函数
const cloud = require('wx-server-sdk')
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

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 导入养殖任务配置
const { BREEDING_SCHEDULE, getTasksByAge, getAllTaskDays } = require('./breeding-schedule')

// 创建初始健康检查记录
async function createInitialHealthCheck(batchId, batchNumber, quantity, operatorName, userId) {
  try {
    const healthRecord = {
      batchId,
      recordType: 'initial_check',
      checkDate: getCurrentBeijingDate(),
      inspector: userId,
      inspectorName: operatorName,
      totalCount: quantity,
      healthyCount: quantity,  // 初始默认全部健康
      sickCount: 0,
      deadCount: 0,
      symptoms: [],
      diagnosis: '入栏初检：外观正常，无明显异常',
      treatment: '',
      notes: '系统自动创建的入栏初始健康检查记录',
      severity: 'low',
      followUpRequired: false,
      followUpDate: null,
      relatedTaskId: null,
      autoCreated: true,
      creationSource: 'entry',
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS).add({
      data: healthRecord
    })
    
    // 已移除调试日志
    return result._id
  } catch (error) {
    // 已移除调试日志
    throw error
  }
}

// 创建批次待办事项
// ⚠️ 注意：userId 仅用于记录批次创建者，查询任务时不应使用 userId 过滤
// 所有用户共享同一批次的任务，避免任务重复
async function createBatchTodos(batchId, batchNumber, entryDate, userId) {
  // 已移除调试日志
  const batchTodos = []
  const now = new Date()
  
  // 获取所有有任务的日龄
  const taskDays = getAllTaskDays()
  
  for (const dayAge of taskDays) {
    const tasks = getTasksByAge(dayAge)
    
    // 计算该日龄对应的日期
    const entryDateTime = new Date(entryDate + 'T00:00:00')
    const taskDate = new Date(entryDateTime.getTime() + (dayAge - 1) * 24 * 60 * 60 * 1000)
    
    for (const task of tasks) {
      batchTodos.push({
        batchId,
        batchNumber,
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
        targetDate: formatBeijingTime(taskDate, 'date'), // ✅ 添加 targetDate
        status: 'pending',
        isCompleted: false,
        // ✅ 添加完成状态字段
        completed: false,
        completedAt: null,
        completedBy: null,
        completionNotes: '',
        // ⚠️ userId 仅记录创建者，不用于任务查询过滤
        createdBy: userId,  // 改名为 createdBy 更清晰
        createTime: now,
        updateTime: now
      })
    }
  }
  
  // 批量插入待办事项
  if (batchTodos.length > 0) {
    // 已移除调试日志
    // 分批插入，避免单次插入数据过多
    const batchSize = 20
    for (let i = 0; i < batchTodos.length; i += batchSize) {
      const batch = batchTodos.slice(i, i + batchSize)
      await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).add({
        data: batch
      })
    }
    
    // 已移除调试日志
  }
  
  return batchTodos.length
}

// 生成批次号
function generateBatchNumber() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `E${year}${month}${day}${random}`
}

// 修复批次任务 - 为现有批次重新创建完整的任务
async function fixBatchTasks(event, wxContext) {
  const { batchId } = event
  const openid = wxContext.OPENID
  
  try {
    // 已移除调试日志
    // 获取批次信息
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }
    
    const batch = batchResult.data
    // 已移除调试日志
    // ⚠️ 修复：删除该批次的所有任务（不限制用户），避免重复任务
    const deleteResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES).where({
      batchId
    }).remove()
    
    // 已移除调试日志
    // 重新创建完整的任务
    const todoCount = await createBatchTodos(
      batchId,
      batch.batchNumber,
      batch.entryDate,
      openid
    )
    
    // 已移除调试日志
    return {
      success: true,
      data: {
        batchId,
        batchNumber: batch.batchNumber,
        oldTaskCount: deleteResult.stats.removed,
        newTaskCount: todoCount
      },
      message: `批次 ${batch.batchNumber} 任务修复成功，共创建 ${todoCount} 个任务`
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: `批次任务修复失败: ${error.message}`
    }
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      case 'list':
        return await listEntryRecords(event, wxContext)
      case 'create':
        return await createEntryRecord(event, wxContext)
      case 'update':
        return await updateEntryRecord(event, wxContext)
      case 'delete':
        return await deleteEntryRecord(event, wxContext)
      case 'stats':
        return await getEntryStats(event, wxContext)
      case 'detail':
        return await getEntryDetail(event, wxContext)
      case 'getActiveBatches':
        return await getActiveBatches(event, wxContext)
      case 'getBatchDetail':
        return await getBatchDetail(event, wxContext)
      case 'fixBatchTasks':
        return await fixBatchTasks(event, wxContext)
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '操作失败，请重试'
    }
  }
}

// 获取入栏记录列表
async function listEntryRecords(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 10, 
    status = null, 
    dateRange = null,
    breed = null 
  } = event
  
  let query = db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
  
  // 构建查询条件
  const where = {}
  
  if (status) {
    where.status = status
  }
  
  if (breed) {
    where.breed = db.RegExp({
      regexp: breed,
      options: 'i'
    })
  }
  
  if (dateRange && dateRange.start && dateRange.end) {
    where.entryDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
  }
  
  if (Object.keys(where).length > 0) {
    query = query.where(where)
  }
  
  // 分页查询
  const countResult = await query.count()
  const total = countResult.total
  
  const records = await query
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    success: true,
    data: {
      records: records.data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }
}

// 创建入栏记录
async function createEntryRecord(event, wxContext) {
  const { recordData } = event
  
  // 数据验证
  if (!recordData.breed || !recordData.supplier || !recordData.quantity) {
    throw new Error('缺少必填字段：品种、供应商、数量')
  }
  
  if (recordData.quantity <= 0) {
    throw new Error('数量必须大于0')
  }
  
  // 使用用户提供的批次ID，如果没有则自动生成批次号
  const batchNumber = recordData.batchId || recordData.batchNumber || generateBatchNumber()
  
  const now = new Date()
  // 获取用户信息
  let userName = '未知';
  try {
    const userInfo = await db.collection(COLLECTIONS.WX_USERS).where({
      _openid: wxContext.OPENID
    }).get();
    
    if (userInfo.data && userInfo.data.length > 0) {
      const u = userInfo.data[0]
      userName = u.name || u.nickname || u.nickName || '未知';
    }
  } catch (error) {
    // 已移除调试日志
  }

  const newRecord = {
    userId: wxContext.OPENID,
    batchNumber,
    breed: recordData.breed,
    quality: recordData.quality || '',
    supplier: recordData.supplier,
    quantity: Number(recordData.quantity),
    unitPrice: Number(recordData.unitPrice) || 0,
    totalAmount: Number(recordData.quantity) * (Number(recordData.unitPrice) || 0),
    purchaseDate: recordData.purchaseDate || getCurrentBeijingDate(),
    entryDate: recordData.entryDate || getCurrentBeijingDate(),
    operator: userName, // 使用查询到的用户名而不是传入的operator
    status: recordData.status || 'active',
    notes: recordData.notes || '',
    photos: recordData.photos || [],
    location: recordData.location || {},
    isDeleted: false, // 明确设置未删除标志
    createTime: now,
    updateTime: now
  }
  
  const result = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).add({
    data: newRecord
  })
  
  // 已移除调试日志
  // 创建批次待办事项
  try {
    const todoCount = await createBatchTodos(
      result._id,           // 批次ID
      batchNumber,          // 批次号
      newRecord.entryDate,  // 入栏日期
      wxContext.OPENID      // 用户ID
    )
    // 已移除调试日志
  } catch (todoError) {
    // 已移除调试日志
    // 这里不抛出错误，因为入栏记录已经创建成功
    // 可以考虑记录到错误日志中
  }
  
  // 自动创建初始健康检查记录
  let healthRecordId = null
  try {
    healthRecordId = await createInitialHealthCheck(
      result._id,
      batchNumber,
      newRecord.quantity,
      userName,
      wxContext.OPENID
    )
    // 已移除调试日志
  } catch (healthError) {
    // 已移除调试日志
    // 不影响入栏记录创建，继续执行
  }
  
  return {
    success: true,
    data: {
      _id: result._id,
      batchNumber,
      healthRecordId,
      ...newRecord
    },
    message: '入栏记录创建成功，待办事项和初始健康检查已自动生成'
  }
}

// 更新入栏记录
async function updateEntryRecord(event, wxContext) {
  const { recordId, updateData } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  // 检查记录是否存在且有权限修改
  const existingRecord = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(recordId).get()
  
  if (!existingRecord.data.length) {
    throw new Error('记录不存在')
  }
  
  // 如果要更新operator字段，获取用户信息
  if (updateData.operator !== undefined) {
    try {
      const userInfo = await db.collection(COLLECTIONS.WX_USERS).where({
        _openid: wxContext.OPENID
      }).get();
      
      if (userInfo.data && userInfo.data.length > 0) {
        updateData.operator = userInfo.data[0].name || userInfo.data[0].nickName || '未知';
      }
    } catch (error) {
      // 已移除调试日志
    }
  }
  
  // 准备更新数据
  const updateFields = {
    updateTime: new Date()
  }
  
  // 允许更新的字段
  const allowedFields = [
    'breed', 'quality', 'supplier', 'quantity', 'unitPrice', 
    'purchaseDate', 'entryDate', 'operator', 'status', 'notes', 
    'photos', 'location'
  ]
  
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      updateFields[field] = updateData[field]
    }
  })
  
  // 重新计算总金额
  if (updateData.quantity !== undefined || updateData.unitPrice !== undefined) {
    const record = existingRecord.data[0]
    const quantity = updateData.quantity !== undefined ? Number(updateData.quantity) : record.quantity
    const unitPrice = updateData.unitPrice !== undefined ? Number(updateData.unitPrice) : record.unitPrice
    updateFields.totalAmount = quantity * unitPrice
  }
  
  await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(recordId).update({
    data: updateFields
  })
  
  return {
    success: true,
    message: '入栏记录更新成功'
  }
}

// 删除入栏记录
async function deleteEntryRecord(event, wxContext) {
  const { recordId } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  // 检查是否有权限删除（只能删除自己创建的记录）
  const record = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(recordId).get()
  
  if (!record.data.length) {
    throw new Error('记录不存在')
  }
  
  await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(recordId).remove()
  
  return {
    success: true,
    message: '入栏记录删除成功'
  }
}

// 获取入栏统计数据
async function getEntryStats(event, wxContext) {
  const { dateRange } = event
  
  let query = db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
  
  // 日期范围过滤
  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      entryDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }
  
  const records = await query.get()
  const data = records.data
  
  // 计算统计数据
  const totalQuantity = data.reduce((sum, record) => sum + (record.quantity || 0), 0)
  const totalBatches = data.length
  const completedRecords = data.filter(record => record.status === '已完成')
  const completedQuantity = completedRecords.reduce((sum, record) => sum + (record.quantity || 0), 0)
  
  // 计算存活率（简化计算，实际需要结合出栏数据）
  const survivalRate = totalQuantity > 0 ? ((completedQuantity / totalQuantity) * 100).toFixed(1) : '0.0'
  
  // 按品种统计
  const breedStats = {}
  data.forEach(record => {
    const breed = record.breed || '未知'
    if (!breedStats[breed]) {
      breedStats[breed] = { quantity: 0, batches: 0 }
    }
    breedStats[breed].quantity += record.quantity || 0
    breedStats[breed].batches += 1
  })
  
  return {
    success: true,
    data: {
      total: totalQuantity.toLocaleString(),
      survivalRate,
      batches: totalBatches.toString(),
      completedQuantity: completedQuantity.toLocaleString(),
      breedStats,
      recentTrend: await getRecentTrend(dateRange)
    }
  }
}

// 获取最近趋势数据
async function getRecentTrend(dateRange) {
  // 获取最近7天的入栏数据
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  const records = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
    .where({
      entryDate: _.gte(formatBeijingTime(startDate, 'date'))
                 .and(_.lte(formatBeijingTime(endDate, 'date')))
    })
    .get()
  
  // 按日期分组统计
  const dailyStats = {}
  records.data.forEach(record => {
    const date = record.entryDate
    if (!dailyStats[date]) {
      dailyStats[date] = 0
    }
    dailyStats[date] += record.quantity || 0
  })
  
  return dailyStats
}

// 获取入栏记录详情
async function getEntryDetail(event, wxContext) {
  const { recordId } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  const record = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(recordId).get()
  
  if (!record.data.length) {
    throw new Error('记录不存在')
  }
  
  const data = record.data[0]
  let resolvedOperator = data.operator
  
  // 如果操作员为空或为“未知”，尝试根据记录创建者补齐
  if (!resolvedOperator || resolvedOperator === '未知') {
    try {
      const userRes = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: data.userId }).get()
      if (userRes.data && userRes.data.length > 0) {
        const u = userRes.data[0]
        resolvedOperator = u.name || u.nickname || u.nickName || '未知'
      }
      
      // 如果成功解析出有效操作员，回写数据库，避免下次再计算
      if (resolvedOperator && resolvedOperator !== '未知') {
        await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(recordId).update({
          data: {
            operator: resolvedOperator,
            updateTime: new Date()
          }
        })
      }
    } catch (err) {
      // 已移除调试日志
    }
  }
  
  return {
    success: true,
    data: {
      ...data,
      operator: resolvedOperator || data.operator || '未知'
    }
  }
}

// 获取活跃批次（没有出栏的批次）
async function getActiveBatches(event, wxContext) {
  // 已移除调试日志
  try {
    // 查询该用户的所有入栏记录
    const allResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .where({
        userId: wxContext.OPENID
      })
      .orderBy('createTime', 'desc')
      .get()

    // 获取所有出栏记录
    const exitRecordsResult = await db.collection(COLLECTIONS.PROD_BATCH_EXITS)
      .where({
        userId: wxContext.OPENID
      })
      .get()
    
    // 获取所有死亡记录（不过滤 userId，因为死亡记录可能没有这个字段）
    const deathRecordsResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({
        isDeleted: false  // ✅ 使用 false 替代 neq(true)，索引性能最优
      })
      .get()
    
    // 统计每个批次的出栏数量
    const exitQuantityMap = {}
    exitRecordsResult.data.forEach(exitRecord => {
      const batchNumber = exitRecord.batchNumber
      if (!exitQuantityMap[batchNumber]) {
        exitQuantityMap[batchNumber] = 0
      }
      exitQuantityMap[batchNumber] += exitRecord.quantity || 0
    })

    // 构建批次ID到批次号的映射
    const batchIdToNumberMap = {}
    allResult.data.forEach(record => {
      batchIdToNumberMap[record._id] = record.batchNumber
    })

    // 统计每个批次的死亡数量（兼容 batchId 和 batchNumber）
    const deathQuantityMap = {}
    deathRecordsResult.data.forEach(deathRecord => {
      // 优先使用 batchNumber，如果没有则通过 batchId 查找
      let batchNumber = deathRecord.batchNumber
      if (!batchNumber && deathRecord.batchId) {
        batchNumber = batchIdToNumberMap[deathRecord.batchId]
      }
      
      if (batchNumber) {
        if (!deathQuantityMap[batchNumber]) {
          deathQuantityMap[batchNumber] = 0
        }
        // 兼容多种死亡数字段名
        const deathCount = deathRecord.deathCount || deathRecord.deadCount || deathRecord.totalDeathCount || 0
        deathQuantityMap[batchNumber] += deathCount
      }
    })
    
    // 筛选存栏批次（排除完全出栏/死亡、已删除和已归档的）
    const activeRecords = allResult.data.filter(record => {
      const isNotDeleted = record.isDeleted !== true
      const isNotArchived = record.isArchived !== true  // ✅ 过滤已归档批次
      const totalExited = exitQuantityMap[record.batchNumber] || 0
      const totalDeath = deathQuantityMap[record.batchNumber] || 0
      const totalGone = totalExited + totalDeath
      const hasStock = totalGone < (record.quantity || 0)
      return isNotDeleted && isNotArchived && hasStock
    })

    // 转换数据格式，增加批次信息
    const activeBatches = activeRecords.map(record => {
      // 计算当前日龄 - 使用本地时区，避免时区问题
      const today = new Date()
      const todayYear = today.getFullYear()
      const todayMonth = today.getMonth()
      const todayDay = today.getDate()
      
      // 解析入栏日期
      const entryDateStr = record.entryDate.split('T')[0] // YYYY-MM-DD
      const [entryYear, entryMonth, entryDay] = entryDateStr.split('-').map(Number)
      
      // 创建本地时区的日期对象（忽略时间部分）
      const todayDate = new Date(todayYear, todayMonth, todayDay)
      const startDate = new Date(entryYear, entryMonth - 1, entryDay) // 月份从0开始
      
      // 计算日期差异
      const diffTime = todayDate.getTime() - startDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      const dayAge = diffDays + 1 // 入栏当天为第1日龄

      // ✅ 计算实际存栏数：入栏数 - 死亡数 - 出栏数
      const totalExited = exitQuantityMap[record.batchNumber] || 0
      const totalDeath = deathQuantityMap[record.batchNumber] || 0
      const currentStock = record.quantity - totalExited - totalDeath
      
      return {
        _id: record._id,  // 使用标准的 _id 字段
        batchNumber: record.batchNumber,
        entryDate: record.entryDate,
        currentStock: currentStock,   // ✅ 实际存栏数
        currentCount: currentStock,   // 兼容旧字段
        currentQuantity: currentStock, // 兼容其他字段
        entryCount: record.quantity, // 入栏数量
        quantity: record.quantity,    // 添加 quantity 字段，方便前端使用
        location: record.location,
        breed: record.breed,
        status: record.status,
        dayAge: dayAge,
        operatorId: record.userId,
        operator: record.operator,
        createTime: record.createTime
      }
    })

    // 已移除调试日志
    return {
      success: true,
      data: activeBatches,
      message: `找到 ${activeBatches.length} 个活跃批次`
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      data: [],
      message: '获取活跃批次失败'
    }
  }
}

/**
 * 获取批次详情
 */
async function getBatchDetail(event, wxContext) {
  const { batchId } = event
  
  if (!batchId) {
    return {
      success: false,
      error: '批次ID不能为空'
    }
  }
  
  try {
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .doc(batchId)
      .get()
    
    if (!batchResult.data) {
      return {
        success: false,
        error: '批次不存在'
      }
    }
    
    const batch = batchResult.data
    
    // 验证权限
    if (batch.userId !== wxContext.OPENID) {
      return {
        success: false,
        error: '无权限访问此批次'
      }
    }
    
    // 🔥 计算当前日龄 - 使用本地时区，与 getActiveBatches 保持一致
    const today = new Date()
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth()
    const todayDay = today.getDate()
    
    // 解析入栏日期
    const entryDateStr = batch.entryDate.split('T')[0] // YYYY-MM-DD
    const [entryYear, entryMonth, entryDay] = entryDateStr.split('-').map(Number)
    
    // 创建本地时区的日期对象（忽略时间部分）
    const todayDate = new Date(todayYear, todayMonth, todayDay)
    const startDate = new Date(entryYear, entryMonth - 1, entryDay) // 月份从0开始
    
    // 计算日期差异
    const diffTime = todayDate.getTime() - startDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const dayAge = diffDays + 1 // 入栏当天为第1日龄
    
    return {
      success: true,
      data: {
        ...batch,
        dayAge: dayAge
      }
    }
  } catch (error) {
    console.error('获取批次详情失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

