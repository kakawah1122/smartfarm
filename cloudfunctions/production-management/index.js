// production-management/index.js - 生产管理核心云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 生成批次号
function generateBatchNumber() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const hour = now.getHours().toString().padStart(2, '0')
  const minute = now.getMinutes().toString().padStart(2, '0')
  return `B${year}${month}${day}${hour}${minute}`
}

// 生成记录ID
function generateRecordId(prefix) {
  const now = new Date()
  const timestamp = now.getTime().toString().slice(-8)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}${timestamp}${random}`
}

// 验证用户权限
async function validateUserPermission(openid, action) {
  try {
    const user = await db.collection('users').where({ _openid: openid }).get()
    if (user.data.length === 0) return false
    
    const userRole = user.data[0].role || 'employee'
    const permissions = {
      'super_admin': ['create', 'read', 'update', 'delete'],
      'manager': ['create', 'read', 'update', 'delete'],
      'technician': ['create', 'read', 'update'],
      'finance': ['read'],
      'employee': ['create', 'read'],
      'observer': ['read']
    }
    
    return permissions[userRole]?.includes(action) || false
  } catch (error) {
    console.error('权限验证失败:', error)
    return false
  }
}

// 计算库存统计
async function calculateInventoryStats() {
  try {
    // 获取入栏总数
    const entryResult = await db.collection('entry_records')
      .where({ isDeleted: false })
      .get()
    
    const totalEntry = entryResult.data.reduce((sum, record) => sum + (record.quantity || 0), 0)
    
    // 获取出栏总数
    const exitResult = await db.collection('exit_records')
      .where({ isDeleted: false })
      .get()
    
    const totalExit = exitResult.data.reduce((sum, record) => sum + (record.quantity || 0), 0)
    
    // 获取死亡总数
    const deathResult = await db.collection('death_records')
      .where({ isDeleted: false })
      .get()
    
    const totalDeath = deathResult.data.reduce((sum, record) => sum + (record.deathCount || 0), 0)
    
    // 计算当前存栏
    const currentStock = totalEntry - totalExit - totalDeath
    
    // 计算存活率
    const survivalRate = totalEntry > 0 ? ((totalEntry - totalDeath) / totalEntry * 100).toFixed(2) : 0
    
    return {
      totalEntry,
      totalExit,
      totalDeath,
      currentStock,
      survivalRate: parseFloat(survivalRate)
    }
  } catch (error) {
    console.error('库存统计计算失败:', error)
    return {
      totalEntry: 0,
      totalExit: 0,
      totalDeath: 0,
      currentStock: 0,
      survivalRate: 0
    }
  }
}

// 生成库存预警
async function generateInventoryAlerts() {
  try {
    const stats = await calculateInventoryStats()
    const alerts = []
    
    // 存活率预警
    if (stats.survivalRate < 95) {
      alerts.push({
        type: 'survival_rate_low',
        severity: stats.survivalRate < 90 ? 'high' : 'medium',
        message: `存活率偏低：${stats.survivalRate}%，建议加强健康管理`,
        data: { survivalRate: stats.survivalRate },
        createTime: new Date().toISOString()
      })
    }
    
    // 库存不足预警
    if (stats.currentStock < 100) {
      alerts.push({
        type: 'stock_low',
        severity: stats.currentStock < 50 ? 'high' : 'medium',
        message: `当前存栏不足：${stats.currentStock}只，建议及时补栏`,
        data: { currentStock: stats.currentStock },
        createTime: new Date().toISOString()
      })
    }
    
    return alerts
  } catch (error) {
    console.error('库存预警生成失败:', error)
    return []
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      // 入栏管理
      case 'create_entry_record':
        return await createEntryRecord(event, wxContext)
      case 'list_entry_records':
        return await listEntryRecords(event, wxContext)
      case 'update_entry_record':
        return await updateEntryRecord(event, wxContext)
      case 'delete_entry_record':
        return await deleteEntryRecord(event, wxContext)
      
      // 出栏管理
      case 'create_exit_record':
        return await createExitRecord(event, wxContext)
      case 'list_exit_records':
        return await listExitRecords(event, wxContext)
      case 'update_exit_record':
        return await updateExitRecord(event, wxContext)
      case 'delete_exit_record':
        return await deleteExitRecord(event, wxContext)
      
      // 库存管理
      case 'get_inventory_stats':
        return await getInventoryStats(event, wxContext)
      case 'get_inventory_alerts':
        return await getInventoryAlerts(event, wxContext)
      
      // 批次管理
      case 'create_production_batch':
        return await createProductionBatch(event, wxContext)
      case 'list_production_batches':
        return await listProductionBatches(event, wxContext)
      case 'update_batch_status':
        return await updateBatchStatus(event, wxContext)
      
      // 物料管理
      case 'create_material_record':
        return await createMaterialRecord(event, wxContext)
      case 'list_material_records':
        return await listMaterialRecords(event, wxContext)
      case 'get_material_consumption':
        return await getMaterialConsumption(event, wxContext)
      
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    console.error('生产管理操作失败:', error)
    return {
      success: false,
      error: error.message,
      message: error.message || '生产管理操作失败，请重试'
    }
  }
}

// 创建入栏记录
async function createEntryRecord(event, wxContext) {
  const { quantity, source, batchNumber, unitPrice, notes, photos } = event
  const openid = wxContext.OPENID

  // 权限验证
  if (!await validateUserPermission(openid, 'create')) {
    throw new Error('无权限执行此操作')
  }

  if (!quantity || quantity <= 0) {
    throw new Error('入栏数量必须大于0')
  }

  const recordId = generateRecordId('ENT')
  const finalBatchNumber = batchNumber || generateBatchNumber()

  const record = {
    _id: recordId,
    _openid: openid,
    quantity: parseInt(quantity),
    source: source || '',
    batchNumber: finalBatchNumber,
    unitPrice: parseFloat(unitPrice) || 0,
    totalCost: parseInt(quantity) * (parseFloat(unitPrice) || 0),
    notes: notes || '',
    photos: photos || [],
    status: 'active',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    isDeleted: false
  }

  await db.collection('entry_records').add({ data: record })

  // 更新库存日志
  await db.collection('inventory_logs').add({
    data: {
      recordId,
      type: 'entry',
      quantity: parseInt(quantity),
      batchNumber: finalBatchNumber,
      createTime: new Date().toISOString(),
      _openid: openid
    }
  })

  return {
    success: true,
    data: record,
    message: '入栏记录创建成功'
  }
}

// 获取入栏记录列表
async function listEntryRecords(event, wxContext) {
  const { page = 1, pageSize = 10, batchNumber, dateRange } = event

  let query = db.collection('entry_records').where({ isDeleted: false })

  if (batchNumber) {
    query = query.where({ batchNumber })
  }

  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }

  const total = await query.count()
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
        total: total.total,
        totalPages: Math.ceil(total.total / pageSize)
      }
    }
  }
}

// 创建出栏记录
async function createExitRecord(event, wxContext) {
  const { quantity, destination, batchNumber, unitPrice, notes, exitReason } = event
  const openid = wxContext.OPENID

  if (!await validateUserPermission(openid, 'create')) {
    throw new Error('无权限执行此操作')
  }

  if (!quantity || quantity <= 0) {
    throw new Error('出栏数量必须大于0')
  }

  // 检查库存是否充足
  const stats = await calculateInventoryStats()
  if (quantity > stats.currentStock) {
    throw new Error(`出栏数量不能超过当前存栏数量(${stats.currentStock}只)`)
  }

  const recordId = generateRecordId('EXT')

  const record = {
    _id: recordId,
    _openid: openid,
    quantity: parseInt(quantity),
    destination: destination || '',
    batchNumber: batchNumber || '',
    unitPrice: parseFloat(unitPrice) || 0,
    totalRevenue: parseInt(quantity) * (parseFloat(unitPrice) || 0),
    exitReason: exitReason || 'sale',
    notes: notes || '',
    status: 'completed',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    isDeleted: false
  }

  await db.collection('exit_records').add({ data: record })

  // 更新库存日志
  await db.collection('inventory_logs').add({
    data: {
      recordId,
      type: 'exit',
      quantity: parseInt(quantity),
      batchNumber: batchNumber || '',
      createTime: new Date().toISOString(),
      _openid: openid
    }
  })

  return {
    success: true,
    data: record,
    message: '出栏记录创建成功'
  }
}

// 获取库存统计
async function getInventoryStats(event, wxContext) {
  const stats = await calculateInventoryStats()
  const alerts = await generateInventoryAlerts()

  return {
    success: true,
    data: {
      ...stats,
      alerts
    }
  }
}

// 获取库存预警
async function getInventoryAlerts(event, wxContext) {
  const alerts = await generateInventoryAlerts()

  return {
    success: true,
    data: { alerts }
  }
}

// 创建生产批次
async function createProductionBatch(event, wxContext) {
  const { name, plannedQuantity, expectedStartDate, expectedEndDate, notes } = event
  const openid = wxContext.OPENID

  if (!await validateUserPermission(openid, 'create')) {
    throw new Error('无权限执行此操作')
  }

  const batchNumber = generateBatchNumber()
  const batchId = generateRecordId('BATCH')

  const batch = {
    _id: batchId,
    _openid: openid,
    name: name || `生产批次-${batchNumber}`,
    batchNumber,
    plannedQuantity: parseInt(plannedQuantity) || 0,
    actualQuantity: 0,
    expectedStartDate: expectedStartDate || new Date().toISOString(),
    expectedEndDate: expectedEndDate || '',
    actualStartDate: '',
    actualEndDate: '',
    status: 'planned', // planned, active, completed, cancelled
    notes: notes || '',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    isDeleted: false
  }

  await db.collection('production_batches').add({ data: batch })

  return {
    success: true,
    data: batch,
    message: '生产批次创建成功'
  }
}

// 获取物料消耗统计
async function getMaterialConsumption(event, wxContext) {
  const { dateRange, materialType } = event

  let query = db.collection('material_records').where({ isDeleted: false })

  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }

  if (materialType) {
    query = query.where({ materialType })
  }

  const records = await query.get()
  
  // 统计消耗量
  const consumption = records.data.reduce((acc, record) => {
    const type = record.materialType || 'unknown'
    if (!acc[type]) {
      acc[type] = {
        totalQuantity: 0,
        totalCost: 0,
        records: 0
      }
    }
    acc[type].totalQuantity += record.quantity || 0
    acc[type].totalCost += record.totalCost || 0
    acc[type].records += 1
    return acc
  }, {})

  return {
    success: true,
    data: { consumption, totalRecords: records.data.length }
  }
}

// 其他CRUD操作的简化实现
async function listExitRecords(event, wxContext) {
  const { page = 1, pageSize = 10 } = event
  const total = await db.collection('exit_records').where({ isDeleted: false }).count()
  const records = await db.collection('exit_records')
    .where({ isDeleted: false })
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    data: {
      records: records.data,
      pagination: { page, pageSize, total: total.total, totalPages: Math.ceil(total.total / pageSize) }
    }
  }
}

async function listProductionBatches(event, wxContext) {
  const { page = 1, pageSize = 10, status } = event
  let query = db.collection('production_batches').where({ isDeleted: false })
  if (status) query = query.where({ status })

  const total = await query.count()
  const batches = await query
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    data: {
      batches: batches.data,
      pagination: { page, pageSize, total: total.total, totalPages: Math.ceil(total.total / pageSize) }
    }
  }
}

async function updateBatchStatus(event, wxContext) {
  const { batchId, status, actualQuantity } = event
  const openid = wxContext.OPENID

  if (!await validateUserPermission(openid, 'update')) {
    throw new Error('无权限执行此操作')
  }

  const updateData = {
    status,
    updateTime: new Date().toISOString()
  }

  if (actualQuantity !== undefined) {
    updateData.actualQuantity = parseInt(actualQuantity)
  }

  if (status === 'active' && !updateData.actualStartDate) {
    updateData.actualStartDate = new Date().toISOString()
  }

  if (status === 'completed' && !updateData.actualEndDate) {
    updateData.actualEndDate = new Date().toISOString()
  }

  await db.collection('production_batches').doc(batchId).update({ data: updateData })

  return {
    success: true,
    message: '批次状态更新成功'
  }
}
