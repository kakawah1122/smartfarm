// cloudfunctions/production-material/index.js
// 物料管理云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 生成物料编码
function generateMaterialCode(category) {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const prefix = {
    '饲料': 'F',        // 饲料
    '营养品': 'N',      // 营养品
    '药品': 'M',        // 药品
    '设备': 'E',        // 设备
    '耗材': 'S',        // 耗材
    '其他': 'O'         // 其他
  }[category] || 'O'    // 默认其他
  
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `${prefix}${year}${random}`
}

// 生成单据号
function generateRecordNumber(type) {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const prefix = type === 'purchase' ? 'P' : 'U'  // P=采购, U=领用
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}${year}${month}${day}${random}`
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      // 物料基础数据管理
      case 'list_materials':
        return await listMaterials(event, wxContext)
      case 'create_material':
        return await createMaterial(event, wxContext)
      case 'update_material':
        return await updateMaterial(event, wxContext)
      case 'delete_material':
        return await deleteMaterial(event, wxContext)
      
      // 物料记录管理
      case 'list_records':
        return await listMaterialRecords(event, wxContext)
      case 'create_record':
        return await createMaterialRecord(event, wxContext)
      case 'update_record':
        return await updateMaterialRecord(event, wxContext)
      case 'delete_record':
        return await deleteMaterialRecord(event, wxContext)
      
      // 库存管理
      case 'inventory_stats':
        return await getInventoryStats(event, wxContext)
      case 'inventory_logs':
        return await getInventoryLogs(event, wxContext)
      case 'low_stock_alert':
        return await getLowStockAlert(event, wxContext)
      
      // 统计报表
      case 'material_stats':
        return await getMaterialStats(event, wxContext)
      case 'usage_analysis':
        return await getUsageAnalysis(event, wxContext)
      
      // 快速统计接口
      case 'quick_stats':
        return await getQuickStats(event, wxContext)
      
      // 财务统计接口（供财务管理模块使用）
      case 'financial_stats':
        return await getFinancialStats(event, wxContext)
      
      // 采购入库专用接口
      case 'purchase_inbound':
        return await purchaseInbound(event, wxContext)
      
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

// ===================
// 物料基础数据管理
// ===================

// 获取物料列表
async function listMaterials(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 20, 
    category = null, 
    keyword = null,
    isActive = true 
  } = event
  
  let query = db.collection('materials')
  
  // 构建查询条件
  const where = { isActive }
  
  if (category) {
    where.category = category
  }
  
  if (keyword) {
    where.name = db.RegExp({
      regexp: keyword,
      options: 'i'
    })
  }
  
  query = query.where(where)
  
  // 分页查询
  const countResult = await query.count()
  const total = countResult.total
  
  const materials = await query
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    success: true,
    data: {
      materials: materials.data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }
}

// 创建物料
async function createMaterial(event, wxContext) {
  const { materialData } = event
  
  // 数据验证
  if (!materialData.name || !materialData.category || !materialData.unit) {
    throw new Error('缺少必填字段：物料名称、分类、单位')
  }
  
  // 检查物料名称是否重复
  const existingMaterial = await db.collection('materials')
    .where({ 
      name: materialData.name,
      category: materialData.category,
      isActive: true 
    })
    .get()
  
  if (existingMaterial.data.length > 0) {
    throw new Error('相同分类下已存在同名物料')
  }
  
  // 生成物料编码
  const materialCode = generateMaterialCode(materialData.category)
  
  const now = new Date()
  const newMaterial = {
    materialCode,
    name: materialData.name,
    category: materialData.category,
    specification: materialData.specification || '',
    unit: materialData.unit,
    safetyStock: Number(materialData.safetyStock) || 0,
    currentStock: Number(materialData.currentStock) || 0,  // 使用传入的库存值
    unitPrice: Number(materialData.unitPrice) || 0,
    supplier: materialData.supplier || '',
    isActive: true,
    createTime: now,
    updateTime: now
  }
  
  const result = await db.collection('materials').add({
    data: newMaterial
  })
  
  return {
    success: true,
    data: {
      _id: result._id,
      materialCode,
      ...newMaterial
    },
    message: '物料创建成功'
  }
}

// 更新物料
async function updateMaterial(event, wxContext) {
  const { materialId, updateData } = event
  
  if (!materialId) {
    throw new Error('缺少物料ID')
  }
  
  // 检查物料是否存在
  const existingMaterial = await db.collection('materials').doc(materialId).get()
  
  if (!existingMaterial.data.length) {
    throw new Error('物料不存在')
  }
  
  // 准备更新数据
  const updateFields = {
    updateTime: new Date()
  }
  
  // 允许更新的字段
  const allowedFields = [
    'name', 'specification', 'unit', 'safetyStock', 
    'unitPrice', 'supplier'
  ]
  
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      updateFields[field] = updateData[field]
    }
  })
  
  await db.collection('materials').doc(materialId).update({
    data: updateFields
  })
  
  return {
    success: true,
    message: '物料更新成功'
  }
}

// 删除物料（软删除）
async function deleteMaterial(event, wxContext) {
  const { materialId } = event
  
  if (!materialId) {
    throw new Error('缺少物料ID')
  }
  
  // 检查是否有库存
  const material = await db.collection('materials').doc(materialId).get()
  
  if (!material.data.length) {
    throw new Error('物料不存在')
  }
  
  if (material.data[0].currentStock > 0) {
    throw new Error('该物料仍有库存，无法删除')
  }
  
  // 软删除
  await db.collection('materials').doc(materialId).update({
    data: {
      isActive: false,
      updateTime: new Date()
    }
  })
  
  return {
    success: true,
    message: '物料删除成功'
  }
}

// ===================
// 物料记录管理
// ===================

// 获取物料记录列表
async function listMaterialRecords(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 10, 
    type = null,
    materialId = null,
    dateRange = null,
    status = null 
  } = event
  
  let query = db.collection('material_records')
  
  // 构建查询条件
  const where = {}
  
  if (type) {
    where.type = type
  }
  
  if (materialId) {
    where.materialId = materialId
  }
  
  if (status) {
    where.status = status
  }
  
  if (dateRange && dateRange.start && dateRange.end) {
    where.recordDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
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
  
  // 获取关联的物料信息
  const materialIds = [...new Set(records.data.map(r => r.materialId))]
  const materials = {}
  
  if (materialIds.length > 0) {
    const materialQuery = await db.collection('materials')
      .where({ _id: _.in(materialIds) })
      .get()
    
    materialQuery.data.forEach(material => {
      materials[material._id] = material
    })
  }
  
  // 组合数据
  const recordsWithMaterial = records.data.map(record => ({
    ...record,
    material: materials[record.materialId] || null
  }))
  
  return {
    success: true,
    data: {
      records: recordsWithMaterial,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }
}

// 创建物料记录（采购或领用）
async function createMaterialRecord(event, wxContext) {
  const { recordData } = event
  
  // 数据验证
  if (!recordData.materialId || !recordData.type || !recordData.quantity) {
    throw new Error('缺少必填字段：物料ID、类型、数量')
  }
  
  if (!['purchase', 'use'].includes(recordData.type)) {
    throw new Error('无效的记录类型')
  }
  
  if (recordData.quantity <= 0) {
    throw new Error('数量必须大于0')
  }
  
  let material = null
  let materialInfo = null
  
  try {
    // 首先尝试通过ID直接查找
    material = await db.collection('materials').doc(recordData.materialId).get()
    
    if (material.data && material.data.length > 0) {
      materialInfo = material.data[0]
    }
  } catch (error) {
    // ID查找失败时忽略错误
  }
  
  // 如果通过ID查找失败，尝试通过遍历查找
  if (!materialInfo) {
    const allMaterials = await db.collection('materials').where({ isActive: true }).get()
    
    // 尝试通过ID匹配找到正确的物料
    const foundMaterial = allMaterials.data.find(m => m._id === recordData.materialId)
    if (foundMaterial) {
      materialInfo = foundMaterial
    } else {
      throw new Error(`物料不存在，ID: ${recordData.materialId}`)
    }
  }
  
  // 如果是领用，检查库存是否充足
  if (recordData.type === 'use' && materialInfo.currentStock < recordData.quantity) {
    throw new Error(`库存不足，当前库存：${materialInfo.currentStock} ${materialInfo.unit}`)
  }
  
  // 开始事务处理
  return await db.runTransaction(async transaction => {
    // 生成单据号
    const recordNumber = generateRecordNumber(recordData.type)
    
    const now = new Date()
    const newRecord = {
      userId: wxContext.OPENID,
      materialId: recordData.materialId,
      type: recordData.type,
      recordNumber,
      quantity: Number(recordData.quantity),
      unitPrice: Number(recordData.unitPrice) || materialInfo.unitPrice || 0,
      totalAmount: Number(recordData.quantity) * (Number(recordData.unitPrice) || materialInfo.unitPrice || 0),
      supplier: recordData.supplier || '',
      targetLocation: recordData.targetLocation || '',
      operator: recordData.operator || '未知',
      status: recordData.status || '已完成',
      notes: recordData.notes || '',
      relatedBatch: recordData.relatedBatch || '',
      recordDate: recordData.recordDate || now.toISOString().split('T')[0],
      createTime: now,
      updateTime: now
    }
    
    // 添加记录
    const recordResult = await transaction.collection('material_records').add({
      data: newRecord
    })
    
    // 更新库存
    const stockChange = recordData.type === 'purchase' ? recordData.quantity : -recordData.quantity
    const newStock = materialInfo.currentStock + stockChange
    
    await transaction.collection('materials').doc(recordData.materialId).update({
      data: {
        currentStock: newStock,
        updateTime: now
      }
    })
    
    // 添加库存流水
    const inventoryLog = {
      materialId: recordData.materialId,
      recordId: recordResult._id,
      operation: recordData.type === 'purchase' ? '入库' : '出库',
      quantity: Number(recordData.quantity),
      beforeStock: materialInfo.currentStock,
      afterStock: newStock,
      operator: recordData.operator || '未知',
      operationTime: now
    }
    
    await transaction.collection('inventory_logs').add({
      data: inventoryLog
    })
    
    return {
      success: true,
      data: {
        _id: recordResult._id,
        recordNumber,
        ...newRecord,
        newStock
      },
      message: `${recordData.type === 'purchase' ? '采购入库' : '物料领用'}记录创建成功`
    }
  })
}

// 更新物料记录
async function updateMaterialRecord(event, wxContext) {
  const { recordId, updateData } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  // 检查记录是否存在
  const existingRecord = await db.collection('material_records').doc(recordId).get()
  
  if (!existingRecord.data.length) {
    throw new Error('记录不存在')
  }
  
  const record = existingRecord.data[0]
  
  // 只允许更新状态和备注
  const updateFields = {
    updateTime: new Date()
  }
  
  if (updateData.status !== undefined) {
    updateFields.status = updateData.status
  }
  
  if (updateData.notes !== undefined) {
    updateFields.notes = updateData.notes
  }
  
  await db.collection('material_records').doc(recordId).update({
    data: updateFields
  })
  
  return {
    success: true,
    message: '记录更新成功'
  }
}

// 删除物料记录（需要同时恢复库存）
async function deleteMaterialRecord(event, wxContext) {
  const { recordId } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  // 检查记录是否存在
  const record = await db.collection('material_records').doc(recordId).get()
  
  if (!record.data.length) {
    throw new Error('记录不存在')
  }
  
  const recordData = record.data[0]
  
  // 获取物料信息
  const material = await db.collection('materials').doc(recordData.materialId).get()
  
  if (!material.data.length) {
    throw new Error('关联物料不存在')
  }
  
  // 开始事务处理
  return await db.runTransaction(async transaction => {
    // 删除记录
    await transaction.collection('material_records').doc(recordId).remove()
    
    // 恢复库存
    const materialInfo = material.data[0]
    const stockChange = recordData.type === 'purchase' ? -recordData.quantity : recordData.quantity
    const newStock = materialInfo.currentStock + stockChange
    
    await transaction.collection('materials').doc(recordData.materialId).update({
      data: {
        currentStock: Math.max(0, newStock),  // 确保库存不为负
        updateTime: new Date()
      }
    })
    
    // 删除相关库存流水
    const logs = await transaction.collection('inventory_logs')
      .where({ recordId })
      .get()
    
    for (const log of logs.data) {
      await transaction.collection('inventory_logs').doc(log._id).remove()
    }
    
    return {
      success: true,
      message: '记录删除成功'
    }
  })
}

// ===================
// 统计分析
// ===================

// 获取库存统计
async function getInventoryStats(event, wxContext) {
  const materials = await db.collection('materials')
    .where({ isActive: true })
    .get()
  
  const stats = {
    totalCategories: 0,
    totalMaterials: materials.data.length,
    lowStockCount: 0,
    categories: {},
    totalValue: 0
  }
  
  const categories = new Set()
  
  materials.data.forEach(material => {
    categories.add(material.category)
    
    // 统计低库存
    if (material.currentStock <= material.safetyStock) {
      stats.lowStockCount++
    }
    
    // 按分类统计
    if (!stats.categories[material.category]) {
      stats.categories[material.category] = {
        count: 0,
        totalStock: 0,
        totalValue: 0,
        lowStockCount: 0
      }
    }
    
    const category = stats.categories[material.category]
    category.count++
    category.totalStock += material.currentStock
    category.totalValue += material.currentStock * (material.unitPrice || 0)
    
    if (material.currentStock <= material.safetyStock) {
      category.lowStockCount++
    }
    
    // 总价值
    stats.totalValue += material.currentStock * (material.unitPrice || 0)
  })
  
  stats.totalCategories = categories.size
  
  return {
    success: true,
    data: stats
  }
}

// 获取库存流水
async function getInventoryLogs(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 20, 
    materialId = null,
    dateRange = null 
  } = event
  
  let query = db.collection('inventory_logs')
  
  // 构建查询条件
  const where = {}
  
  if (materialId) {
    where.materialId = materialId
  }
  
  if (dateRange && dateRange.start && dateRange.end) {
    where.operationTime = _.gte(new Date(dateRange.start)).and(_.lte(new Date(dateRange.end)))
  }
  
  if (Object.keys(where).length > 0) {
    query = query.where(where)
  }
  
  // 分页查询
  const countResult = await query.count()
  const total = countResult.total
  
  const logs = await query
    .orderBy('operationTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    success: true,
    data: {
      logs: logs.data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }
}

// 获取低库存预警
async function getLowStockAlert(event, wxContext) {
  const materials = await db.collection('materials')
    .where({ 
      isActive: true,
      currentStock: _.lte(db.command.field('safetyStock'))
    })
    .get()
  
  const alerts = materials.data.map(material => ({
    ...material,
    stockStatus: material.currentStock === 0 ? 'out_of_stock' : 'low_stock',
    shortage: Math.max(0, material.safetyStock - material.currentStock)
  }))
  
  return {
    success: true,
    data: alerts
  }
}

// 获取物料使用分析
async function getUsageAnalysis(event, wxContext) {
  const { dateRange, materialId } = event
  
  let query = db.collection('material_records').where({ type: 'use' })
  
  if (materialId) {
    query = query.where({ materialId })
  }
  
  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      recordDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }
  
  const records = await query.get()
  
  // 按物料统计使用量
  const usageByMaterial = {}
  const usageByDate = {}
  
  records.data.forEach(record => {
    // 按物料统计
    if (!usageByMaterial[record.materialId]) {
      usageByMaterial[record.materialId] = {
        totalQuantity: 0,
        totalAmount: 0,
        usageCount: 0
      }
    }
    
    usageByMaterial[record.materialId].totalQuantity += record.quantity
    usageByMaterial[record.materialId].totalAmount += record.totalAmount
    usageByMaterial[record.materialId].usageCount++
    
    // 按日期统计
    const date = record.recordDate
    if (!usageByDate[date]) {
      usageByDate[date] = {
        totalQuantity: 0,
        totalAmount: 0,
        recordCount: 0
      }
    }
    
    usageByDate[date].totalQuantity += record.quantity
    usageByDate[date].totalAmount += record.totalAmount
    usageByDate[date].recordCount++
  })
  
  return {
    success: true,
    data: {
      usageByMaterial,
      usageByDate,
      totalRecords: records.data.length,
      totalQuantity: records.data.reduce((sum, r) => sum + r.quantity, 0),
      totalAmount: records.data.reduce((sum, r) => sum + r.totalAmount, 0)
    }
  }
}

// 获取物料统计
async function getMaterialStats(event, wxContext) {
  const { dateRange } = event
  
  let recordQuery = db.collection('material_records')
  
  if (dateRange && dateRange.start && dateRange.end) {
    recordQuery = recordQuery.where({
      recordDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }
  
  const records = await recordQuery.get()
  
  // 统计采购和领用
  const purchaseStats = {
    count: 0,
    totalQuantity: 0,
    totalAmount: 0
  }
  
  const useStats = {
    count: 0,
    totalQuantity: 0,
    totalAmount: 0
  }
  
  records.data.forEach(record => {
    if (record.type === 'purchase') {
      purchaseStats.count++
      purchaseStats.totalQuantity += record.quantity
      purchaseStats.totalAmount += record.totalAmount
    } else if (record.type === 'use') {
      useStats.count++
      useStats.totalQuantity += record.quantity
      useStats.totalAmount += record.totalAmount
    }
  })
  
  return {
    success: true,
    data: {
      purchase: purchaseStats,
      use: useStats,
      totalRecords: records.data.length
    }
  }
}

// ===================
// 采购入库专用接口
// ===================

// 采购入库（自动匹配/创建物料 + 创建记录）
async function purchaseInbound(event, wxContext) {
  const { materialData } = event
  
  // 验证必填字段
  if (!materialData.name || !materialData.category || !materialData.quantity || !materialData.unitPrice) {
    throw new Error('缺少必填字段：物料名称、分类、数量、单价')
  }
  
  if (materialData.quantity <= 0) {
    throw new Error('采购数量必须大于0')
  }
  
  if (materialData.unitPrice < 0) {
    throw new Error('单价不能为负数')
  }
  
  try {
    return await db.runTransaction(async transaction => {
      let materialId = null
      let material = null
      
      // 1. 查找现有物料
      const existingMaterials = await transaction.collection('materials')
        .where({ 
          name: materialData.name,
          category: materialData.category,
          isActive: true 
        })
        .get()
      
      if (existingMaterials.data.length > 0) {
        // 物料已存在
        material = existingMaterials.data[0]
        materialId = material._id
      } else {
        // 2. 创建新物料
        const materialCode = generateMaterialCode(materialData.category)
        const now = new Date()
        
        const newMaterial = {
          materialCode,
          name: materialData.name,
          category: materialData.category,
          specification: materialData.specification || '',
          unit: materialData.unit || '件',
          safetyStock: 5, // 默认安全库存
          currentStock: 0, // 初始库存为0，通过采购记录增加
          unitPrice: Number(materialData.unitPrice),
          supplier: materialData.supplier || '',
          isActive: true,
          createTime: now,
          updateTime: now
        }
        
        const materialResult = await transaction.collection('materials').add({
          data: newMaterial
        })
        
        materialId = materialResult._id
        material = { _id: materialId, ...newMaterial }
      }
      
      // 3. 创建采购记录
      const recordNumber = generateRecordNumber('purchase')
      const now = new Date()
      const quantity = Number(materialData.quantity)
      const unitPrice = Number(materialData.unitPrice)
      const totalAmount = quantity * unitPrice
      
      const newRecord = {
        userId: wxContext.OPENID,
        materialId: materialId,
        type: 'purchase',
        recordNumber,
        quantity: quantity,
        unitPrice: unitPrice,
        totalAmount: totalAmount,
        supplier: materialData.supplier || '',
        operator: materialData.operator || '系统用户',
        status: '已完成',
        notes: materialData.notes || '',
        relatedBatch: materialData.batchId || '',
        recordDate: materialData.recordDate || now.toISOString().split('T')[0],
        createTime: now,
        updateTime: now
      }
      
      const recordResult = await transaction.collection('material_records').add({
        data: newRecord
      })
      
      // 4. 更新库存
      const newStock = material.currentStock + quantity
      await transaction.collection('materials').doc(materialId).update({
        data: {
          currentStock: newStock,
          unitPrice: unitPrice, // 更新最新单价
          supplier: materialData.supplier || material.supplier, // 更新供应商
          updateTime: now
        }
      })
      
      // 5. 添加库存流水
      const inventoryLog = {
        materialId: materialId,
        recordId: recordResult._id,
        operation: '采购入库',
        quantity: quantity,
        beforeStock: material.currentStock,
        afterStock: newStock,
        operator: materialData.operator || '系统用户',
        operationTime: now
      }
      
      await transaction.collection('inventory_logs').add({
        data: inventoryLog
      })
      
      return {
        success: true,
        data: {
          materialId: materialId,
          recordId: recordResult._id,
          recordNumber: recordNumber,
          materialName: materialData.name,
          category: materialData.category,
          quantity: quantity,
          unitPrice: unitPrice,
          totalAmount: totalAmount,
          newStock: newStock,
          beforeStock: material.currentStock
        },
        message: '采购入库成功'
      }
    })
  } catch (error) {
    throw new Error('采购入库失败: ' + error.message)
  }
}

// ===================
// 快速统计接口
// ===================

// 获取快速统计信息（用于查看全部功能的优化）
async function getQuickStats(event, wxContext) {
  try {
    // 并行查询以提高性能
    const [recordsCount, recentRecords] = await Promise.all([
      // 获取总记录数
      db.collection('material_records').count(),
      // 获取最新的几条记录用于预览
      db.collection('material_records')
        .orderBy('createTime', 'desc')
        .limit(3)
        .get()
    ])
    
    const stats = {
      totalRecords: recordsCount.total,
      hasRecords: recordsCount.total > 0,
      recentRecordsPreview: recentRecords.data.map(record => ({
        id: record._id,
        type: record.type,
        date: record.recordDate,
        createTime: record.createTime
      }))
    }
    
    // 按类型统计（可选）
    if (recordsCount.total > 0) {
      const typeStats = await db.collection('material_records')
        .aggregate()
        .group({
          _id: '$type',
          count: db.command.aggregate.sum(1)
        })
        .end()
      
      stats.typeBreakdown = {}
      typeStats.list.forEach(item => {
        stats.typeBreakdown[item._id] = item.count
      })
    }
    
    return {
      success: true,
      data: stats
    }
  } catch (error) {
    console.error('获取快速统计失败:', error)
    return {
      success: false,
      error: error.message,
      data: {
        totalRecords: 0,
        hasRecords: false,
        recentRecordsPreview: []
      }
    }
  }
}

// ===================
// 财务统计接口（供财务管理模块使用）
// ===================

// 获取物料记录的财务统计信息
async function getFinancialStats(event, wxContext) {
  try {
    const { 
      dateRange = null,
      groupBy = 'month' // 'month', 'week', 'day'
    } = event
    
    let query = db.collection('material_records')
    
    // 构建查询条件
    const where = {}
    
    if (dateRange && dateRange.start && dateRange.end) {
      where.recordDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
    }
    
    if (Object.keys(where).length > 0) {
      query = query.where(where)
    }
    
    // 获取所有记录用于统计
    const records = await query.get()
    
    // 按类型分类统计
    const purchaseStats = {
      totalAmount: 0,
      totalQuantity: 0,
      recordCount: 0,
      avgAmount: 0,
      categoryBreakdown: {}
    }
    
    const useStats = {
      totalAmount: 0,
      totalQuantity: 0,
      recordCount: 0,
      avgAmount: 0,
      categoryBreakdown: {}
    }
    
    // 时间分组统计
    const timeSeriesData = {}
    
    records.data.forEach(record => {
      const amount = record.totalAmount || 0
      const quantity = record.quantity || 0
      const category = record.material?.category || '未分类'
      
      // 分类统计
      if (record.type === 'purchase') {
        purchaseStats.totalAmount += amount
        purchaseStats.totalQuantity += quantity
        purchaseStats.recordCount++
        
        if (!purchaseStats.categoryBreakdown[category]) {
          purchaseStats.categoryBreakdown[category] = {
            amount: 0,
            quantity: 0,
            count: 0
          }
        }
        purchaseStats.categoryBreakdown[category].amount += amount
        purchaseStats.categoryBreakdown[category].quantity += quantity
        purchaseStats.categoryBreakdown[category].count++
        
      } else if (record.type === 'use') {
        useStats.totalAmount += amount
        useStats.totalQuantity += quantity
        useStats.recordCount++
        
        if (!useStats.categoryBreakdown[category]) {
          useStats.categoryBreakdown[category] = {
            amount: 0,
            quantity: 0,
            count: 0
          }
        }
        useStats.categoryBreakdown[category].amount += amount
        useStats.categoryBreakdown[category].quantity += quantity
        useStats.categoryBreakdown[category].count++
      }
      
      // 时间序列统计
      const recordDate = record.recordDate || record.createTime?.split('T')[0]
      if (recordDate) {
        let timeKey = recordDate
        
        // 根据groupBy参数调整时间分组
        if (groupBy === 'month') {
          timeKey = recordDate.substring(0, 7) // YYYY-MM
        } else if (groupBy === 'week') {
          // 简化处理，按天统计
          timeKey = recordDate
        }
        
        if (!timeSeriesData[timeKey]) {
          timeSeriesData[timeKey] = {
            purchase: { amount: 0, count: 0 },
            use: { amount: 0, count: 0 }
          }
        }
        
        if (record.type === 'purchase') {
          timeSeriesData[timeKey].purchase.amount += amount
          timeSeriesData[timeKey].purchase.count++
        } else if (record.type === 'use') {
          timeSeriesData[timeKey].use.amount += amount
          timeSeriesData[timeKey].use.count++
        }
      }
    })
    
    // 计算平均值
    purchaseStats.avgAmount = purchaseStats.recordCount > 0 
      ? (purchaseStats.totalAmount / purchaseStats.recordCount).toFixed(2)
      : 0
    
    useStats.avgAmount = useStats.recordCount > 0 
      ? (useStats.totalAmount / useStats.recordCount).toFixed(2)
      : 0
    
    // 整体统计
    const totalStats = {
      totalRecords: records.data.length,
      totalTransactionAmount: purchaseStats.totalAmount + useStats.totalAmount,
      netCostImpact: purchaseStats.totalAmount - useStats.totalAmount, // 净成本影响
      mostActiveCategory: getMostActiveCategory(purchaseStats, useStats),
      averageTransactionSize: records.data.length > 0 
        ? ((purchaseStats.totalAmount + useStats.totalAmount) / records.data.length).toFixed(2)
        : 0
    }
    
    return {
      success: true,
      data: {
        summary: totalStats,
        purchase: purchaseStats,
        usage: useStats,
        timeSeries: timeSeriesData,
        dateRange: dateRange,
        generatedAt: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('获取财务统计失败:', error)
    return {
      success: false,
      error: error.message,
      data: {
        summary: { totalRecords: 0, totalTransactionAmount: 0 },
        purchase: { totalAmount: 0, recordCount: 0 },
        usage: { totalAmount: 0, recordCount: 0 },
        timeSeries: {}
      }
    }
  }
}

// 辅助函数：获取最活跃的物料分类
function getMostActiveCategory(purchaseStats, useStats) {
  const allCategories = {}
  
  // 合并采购和使用的分类数据
  Object.keys(purchaseStats.categoryBreakdown).forEach(category => {
    allCategories[category] = (allCategories[category] || 0) + purchaseStats.categoryBreakdown[category].amount
  })
  
  Object.keys(useStats.categoryBreakdown).forEach(category => {
    allCategories[category] = (allCategories[category] || 0) + useStats.categoryBreakdown[category].amount
  })
  
  // 找出金额最大的分类
  let maxCategory = '未知'
  let maxAmount = 0
  
  Object.entries(allCategories).forEach(([category, amount]) => {
    if (amount > maxAmount) {
      maxAmount = amount
      maxCategory = category
    }
  })
  
  return {
    category: maxCategory,
    totalAmount: maxAmount
  }
}
