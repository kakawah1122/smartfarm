// cloudfunctions/production-material/index.js
// 物料管理云函数
const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')

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

// 生成单据号（根据物料分类）
function generateRecordNumber(type, category) {
  // 根据物料分类生成前缀（英文缩写）
  let categoryPrefix = 'MAT' // 默认物料
  if (category) {
    const categoryMap = {
      '饲料': 'FEED',
      '药品': 'MED',
      '设备': 'EQP',
      '营养品': 'NUT',
      '疫苗': 'VAC',
      '消毒剂': 'DIS',
      '耗材': 'SUP',      // 耗材 Supplies
      '其他': 'OTH'
    }
    categoryPrefix = categoryMap[category] || 'MAT'
  }
  
  // 生成6位随机数
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  
  // 格式：物资类型英文缩写 + 6位随机代码（如：MED123456、FEED789012）
  return `${categoryPrefix}${random}`
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
      
      // 饲料投喂管理
      case 'record_feed_usage':
        return await recordFeedUsage(event, wxContext)
      case 'list_feed_usage':
        return await listFeedUsage(event, wxContext)
      case 'get_batch_feed_cost':
        return await getBatchFeedCost(event, wxContext)
      case 'get_feed_cost_analysis':
        return await getFeedCostAnalysis(event, wxContext)
      case 'update_feed_usage':
        return await updateFeedUsage(event, wxContext)
      case 'delete_feed_usage':
        return await deleteFeedUsage(event, wxContext)
      case 'get_current_stock_count':
        return await getCurrentStockCountWrapper(event, wxContext)
      
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
  
  let query = db.collection(COLLECTIONS.PROD_MATERIALS)
  
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
  const existingMaterial = await db.collection(COLLECTIONS.PROD_MATERIALS)
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
  
  const result = await db.collection(COLLECTIONS.PROD_MATERIALS).add({
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
  const existingMaterial = await db.collection(COLLECTIONS.PROD_MATERIALS).doc(materialId).get()
  
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
  
  await db.collection(COLLECTIONS.PROD_MATERIALS).doc(materialId).update({
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
  const material = await db.collection(COLLECTIONS.PROD_MATERIALS).doc(materialId).get()
  
  if (!material.data.length) {
    throw new Error('物料不存在')
  }
  
  if (material.data[0].currentStock > 0) {
    throw new Error('该物料仍有库存，无法删除')
  }
  
  // 软删除
  await db.collection(COLLECTIONS.PROD_MATERIALS).doc(materialId).update({
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
    status = null,
    includeFeedRecords = true // 是否包含饲料投喂记录
  } = event
  
  try {
    // 1. 查询物料记录（采购和领用）
    let materialQuery = db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
    const materialWhere = {}
    
    if (type) {
      materialWhere.type = type
    }
    if (materialId) {
      materialWhere.materialId = materialId
    }
    if (status) {
      materialWhere.status = status
    }
    if (dateRange && dateRange.start && dateRange.end) {
      materialWhere.recordDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
    }
    
    if (Object.keys(materialWhere).length > 0) {
      materialQuery = materialQuery.where(materialWhere)
    }
    
    const materialRecords = await materialQuery
      .orderBy('createTime', 'desc')
      .limit(100) // 先获取更多数据用于合并
      .get()
    
    // 2. 查询饲料投喂记录
    let feedRecords = { data: [] }
    if (includeFeedRecords) {
      // TODO: 已修复 - feed_usage_records 已添加到标准集合列表
      let feedQuery = db.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS)
      const feedWhere = {}
      
      if (materialId) {
        feedWhere.materialId = materialId
      }
      if (dateRange && dateRange.start && dateRange.end) {
        feedWhere.recordDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
      }
      
      if (Object.keys(feedWhere).length > 0) {
        feedQuery = feedQuery.where(feedWhere)
      }
      
      feedRecords = await feedQuery
        .orderBy('createTime', 'desc')
        .limit(100)
        .get()
    }
    
    // 3. 获取所有物料信息
    const allMaterialIds = [
      ...new Set([
        ...materialRecords.data.map(r => r.materialId),
        ...feedRecords.data.map(r => r.materialId)
      ])
    ]
    const materials = {}
    
    if (allMaterialIds.length > 0) {
      const materialQuery = await db.collection(COLLECTIONS.PROD_MATERIALS)
        .where({ _id: _.in(allMaterialIds) })
        .get()
      
      materialQuery.data.forEach(material => {
        materials[material._id] = material
      })
    }
    
    // 4. 获取批次信息（用于饲料投喂记录）
    const batchIds = [...new Set(feedRecords.data.map(r => r.batchId).filter(Boolean))]
    const batches = {}
    
    if (batchIds.length > 0) {
      const batchQuery = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({ _id: _.in(batchIds) })
        .get()
      
      batchQuery.data.forEach(batch => {
        batches[batch._id] = batch
      })
    }
    
    // 5. 转换物料记录格式
    const formattedMaterialRecords = await Promise.all(materialRecords.data.map(async record => {
      let operatorName = record.operator
      
      // 如果操作员是openid或未知，则查询用户信息
      const isOpenId = operatorName && operatorName.startsWith('o') && operatorName.length > 20
      if (!operatorName || operatorName === '未知' || operatorName === '系统用户' || isOpenId) {
        try {
          // 尝试多个可能的字段来查找用户openid
          const operatorOpenid = record._openid || record.userId || record.operator || record.createdBy
          
          if (operatorOpenid) {
            const user = await db.collection(COLLECTIONS.WX_USERS)
              .where({ _openid: operatorOpenid })
              .limit(1)
              .get()
            
            if (user.data && user.data.length > 0) {
              const u = user.data[0]
              operatorName = u.name || u.nickName || u.userName || '未命名用户'
            } else {
              operatorName = '未知用户'
            }
          }
        } catch (e) {
          console.error('[物料记录] 查询用户信息失败:', e)
          operatorName = operatorName || '查询失败'
        }
      }
      
      return {
        ...record,
        operator: operatorName,
        material: materials[record.materialId] || null,
        recordType: 'material', // 标记为物料记录
        displayType: record.type // purchase 或 usage
      }
    }))
    
    // 6. 转换饲料投喂记录格式（统一为物料记录格式）
    const formattedFeedRecords = await Promise.all(feedRecords.data.map(async record => {
      const batch = batches[record.batchId]
      
      // 关联操作员信息
      let operatorName = record.operator
      const isOpenId = operatorName && operatorName.startsWith('o') && operatorName.length > 20
      if (!operatorName || operatorName === '未知' || operatorName === '系统用户' || isOpenId) {
        try {
          const operatorOpenid = record._openid || record.userId || record.operator || record.createdBy
          
          if (operatorOpenid) {
            const user = await db.collection(COLLECTIONS.WX_USERS)
              .where({ _openid: operatorOpenid })
              .limit(1)
              .get()
            
            if (user.data && user.data.length > 0) {
              const u = user.data[0]
              operatorName = u.name || u.nickName || u.userName || '未命名用户'
            } else {
              operatorName = '未知用户'
            }
          }
        } catch (e) {
          console.error('[饲料投喂] 查询用户信息失败:', e)
          operatorName = operatorName || '查询失败'
        }
      }
      
      return {
        _id: record._id,
        recordNumber: record.recordNumber || `FEED-${record._id.slice(-7)}`, // 优先使用数据库中的单据号，旧数据回退到生成编号
        userId: record.userId,
        materialId: record.materialId,
        type: 'feed', // 标记为投喂类型
        quantity: record.quantity,
        unitPrice: record.unitPrice,
        totalAmount: record.totalCost,
        supplier: '',
        operator: operatorName,
        status: '已完成',
        notes: record.notes || '',
        relatedBatch: record.batchId,
        recordDate: record.recordDate,
        createTime: record.createTime,
        updateTime: record.updateTime || record.createTime,
        // 额外信息
        material: materials[record.materialId] || null,
        batchNumber: record.batchNumber || (batch ? batch.batchNumber : ''),
        batchInfo: batch || null,
        currentStock: record.currentStock,
        costPerBird: record.costPerBird,
        dayAge: record.dayAge,
        recordType: 'feed', // 标记为饲料投喂记录
        displayType: 'feed' // 显示类型
      }
    }))
    
    // 7. 合并并排序所有记录
    const allRecords = [...formattedMaterialRecords, ...formattedFeedRecords]
    allRecords.sort((a, b) => {
      const timeA = new Date(a.createTime).getTime()
      const timeB = new Date(b.createTime).getTime()
      return timeB - timeA // 降序
    })
    
    // 8. 分页
    const total = allRecords.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedRecords = allRecords.slice(startIndex, endIndex)
    
    return {
      success: true,
      data: {
        records: paginatedRecords,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        },
        summary: {
          materialRecords: formattedMaterialRecords.length,
          feedRecords: formattedFeedRecords.length,
          total: allRecords.length
        }
      }
    }
  } catch (error) {
    throw new Error('查询物料记录失败: ' + error.message)
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
    material = await db.collection(COLLECTIONS.PROD_MATERIALS).doc(recordData.materialId).get()
    
    if (material.data) {
      materialInfo = material.data
    }
  } catch (error) {
    // ID查找失败时忽略错误
  }
  
  // 如果通过ID查找失败，尝试通过遍历查找
  if (!materialInfo) {
    const allMaterials = await db.collection(COLLECTIONS.PROD_MATERIALS).where({ isActive: true }).get()
    
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
    // 生成单据号（传入物料分类）
    const recordNumber = generateRecordNumber(recordData.type, materialInfo.category)
    
    const now = new Date()
    // 解析当前用户姓名
    let operatorName = '未知'
    try {
      const res = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: wxContext.OPENID }).get()
      if (res.data && res.data.length > 0) {
        const u = res.data[0]
        operatorName = u.name || u.nickname || u.nickName || '未知'
      }
    } catch (e) {}
    
    // 确保 notes 字段是字符串类型
    let notesValue = recordData.notes || ''
    if (typeof notesValue === 'object') {
      console.warn('[创建物料记录] notes 字段是对象类型，尝试转换:', notesValue)
      notesValue = String(notesValue.value || notesValue.text || JSON.stringify(notesValue))
    }
    notesValue = String(notesValue)
    
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
      operator: operatorName,
      status: recordData.status || '已完成',
      notes: notesValue,
      relatedBatch: recordData.relatedBatch || '',
      recordDate: recordData.recordDate || now.toISOString().split('T')[0],
      createTime: now,
      updateTime: now
    }
    
    // 添加记录
    const recordResult = await transaction.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).add({
      data: newRecord
    })
    
    // 更新库存
    const stockChange = recordData.type === 'purchase' ? recordData.quantity : -recordData.quantity
    const newStock = materialInfo.currentStock + stockChange
    
    await transaction.collection(COLLECTIONS.PROD_MATERIALS).doc(recordData.materialId).update({
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
      operator: operatorName,
      operationTime: now
    }
    
    await transaction.collection(COLLECTIONS.PROD_INVENTORY_LOGS).add({
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
  const existingRecord = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).doc(recordId).get()
  
  if (!existingRecord.data.length) {
    throw new Error('记录不存在')
  }
  
  const record = existingRecord.data[0]
  
  // 若更新operator，强制替换为当前用户名
  if (updateData.operator !== undefined) {
    try {
      const res = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: wxContext.OPENID }).get()
      if (res.data && res.data.length > 0) {
        const u = res.data[0]
        updateData.operator = u.name || u.nickname || u.nickName || '未知'
      }
    } catch (e) {}
  }
  
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
  
  await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).doc(recordId).update({
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
  const record = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).doc(recordId).get()
  
  if (!record.data.length) {
    throw new Error('记录不存在')
  }
  
  const recordData = record.data[0]
  
  // 获取物料信息
  const material = await db.collection(COLLECTIONS.PROD_MATERIALS).doc(recordData.materialId).get()
  
  if (!material.data.length) {
    throw new Error('关联物料不存在')
  }
  
  // 开始事务处理
  return await db.runTransaction(async transaction => {
    // 删除记录
    await transaction.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).doc(recordId).remove()
    
    // 恢复库存
    const materialInfo = material.data[0]
    const stockChange = recordData.type === 'purchase' ? -recordData.quantity : recordData.quantity
    const newStock = materialInfo.currentStock + stockChange
    
    await transaction.collection(COLLECTIONS.PROD_MATERIALS).doc(recordData.materialId).update({
      data: {
        currentStock: Math.max(0, newStock),  // 确保库存不为负
        updateTime: new Date()
      }
    })
    
    // 删除相关库存流水
    const logs = await transaction.collection(COLLECTIONS.PROD_INVENTORY_LOGS)
      .where({ recordId })
      .get()
    
    for (const log of logs.data) {
      await transaction.collection(COLLECTIONS.PROD_INVENTORY_LOGS).doc(log._id).remove()
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
  const materials = await db.collection(COLLECTIONS.PROD_MATERIALS)
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
  
  let query = db.collection(COLLECTIONS.PROD_INVENTORY_LOGS)
  
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
  const materials = await db.collection(COLLECTIONS.PROD_MATERIALS)
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
  
  let query = db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).where({ type: 'use' })
  
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
  
  let recordQuery = db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
  
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
      const existingMaterials = await transaction.collection(COLLECTIONS.PROD_MATERIALS)
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
        
        const materialResult = await transaction.collection(COLLECTIONS.PROD_MATERIALS).add({
          data: newMaterial
        })
        
        materialId = materialResult._id
        material = { _id: materialId, ...newMaterial }
      }
      
      // 3. 创建采购记录（传入物料分类）
      const recordNumber = generateRecordNumber('purchase', materialData.category || material.category)
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
      
      const recordResult = await transaction.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).add({
        data: newRecord
      })
      
      // 4. 更新库存
      const newStock = material.currentStock + quantity
      await transaction.collection(COLLECTIONS.PROD_MATERIALS).doc(materialId).update({
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
      
      await transaction.collection(COLLECTIONS.PROD_INVENTORY_LOGS).add({
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
      db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).count(),
      // 获取最新的几条记录用于预览
      db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
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
      const typeStats = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
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
    // 已移除调试日志
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
    
    let query = db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
    
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
    // 已移除调试日志
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

// ===================
// 饲料投喂管理功能
// ===================

// 获取当前存栏数（核心计算函数）
async function getCurrentStockCount(batchId, recordDate) {
  try {
    // 1. 查询批次入栏数量
    const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
    
    if (!batchEntry.data) {
      throw new Error('批次不存在')
    }
    
    const initialQuantity = batchEntry.data.quantity || 0
    
    // 2. 查询截至recordDate的累计死亡数
    const deathRecords = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({
        batchId: batchId,
        deathDate: _.lte(recordDate),
        isDeleted: false  // ✅ 使用 false 替代 neq(true)，索引性能最优
      })
      .get()
    
    // 兼容多种字段名：deathCount（新）、deadCount（旧）、totalDeathCount（兼容）
    const totalDeathCount = deathRecords.data.reduce((sum, r) => {
      return sum + (r.deathCount || r.deadCount || r.totalDeathCount || 0)
    }, 0)
    
    // 3. 查询截至recordDate的出栏数（如果有）
    const exitRecords = await db.collection(COLLECTIONS.PROD_BATCH_EXITS)
      .where({
        batchId: batchId,
        exitDate: _.lte(recordDate),
        isDeleted: false  // ✅ 使用 false 替代 neq(true)，索引性能最优
      })
      .get()
    
    const totalExitCount = exitRecords.data.reduce((sum, r) => sum + (r.quantity || r.exitQuantity || 0), 0)
    
    // 4. 当前存栏 = 入栏 - 死亡 - 出栏
    const currentStock = initialQuantity - totalDeathCount - totalExitCount
    
    return {
      currentStock: Math.max(0, currentStock),
      initialQuantity,
      totalDeathCount,
      totalExitCount
    }
  } catch (error) {
    throw new Error('计算存栏数失败: ' + error.message)
  }
}

// 计算日龄
function calculateDayAge(entryDate, recordDate) {
  const entry = new Date(entryDate)
  const record = new Date(recordDate)
  const diffTime = record.getTime() - entry.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays) // 至少为1天
}

// 获取当前存栏数接口（供前端调用）
async function getCurrentStockCountWrapper(event, wxContext) {
  const { batchId, recordDate } = event
  
  if (!batchId) {
    throw new Error('缺少批次ID')
  }
  
  const date = recordDate || new Date().toISOString().split('T')[0]
  const stockInfo = await getCurrentStockCount(batchId, date)
  
  return {
    success: true,
    data: stockInfo
  }
}

// 记录饲料投喂
async function recordFeedUsage(event, wxContext) {
  const { feedData } = event
  
  // 数据验证
  if (!feedData.batchId || !feedData.materialId || !feedData.quantity) {
    throw new Error('缺少必填字段：批次ID、饲料ID、数量')
  }
  
  if (feedData.quantity <= 0) {
    throw new Error('投喂数量必须大于0')
  }
  
  try {
    return await db.runTransaction(async transaction => {
      const now = new Date()
      const recordDate = feedData.recordDate || now.toISOString().split('T')[0]
      
      // 1. 获取批次信息
      const batchEntry = await transaction.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(feedData.batchId).get()
      if (!batchEntry.data) {
        throw new Error('批次不存在')
      }
      const batchInfo = batchEntry.data
      
      // 2. 获取当前存栏数
      const stockInfo = await getCurrentStockCount(feedData.batchId, recordDate)
      
      if (stockInfo.currentStock <= 0) {
        throw new Error('当前批次存栏数为0，无法记录投喂')
      }
      
      // 3. 获取饲料信息
      const material = await transaction.collection(COLLECTIONS.PROD_MATERIALS).doc(feedData.materialId).get()
      if (!material.data) {
        throw new Error('饲料不存在')
      }
      const materialInfo = material.data
      
      // 检查是否是饲料类
      if (materialInfo.category !== '饲料') {
        throw new Error('只能记录饲料类物料的投喂')
      }
      
      // 4. 计算成本
      const quantity = Number(feedData.quantity)
      const unitPrice = Number(feedData.unitPrice) || materialInfo.unitPrice || 0
      const totalCost = quantity * unitPrice
      const costPerBird = stockInfo.currentStock > 0 ? totalCost / stockInfo.currentStock : 0
      
      // 5. 计算日龄
      const dayAge = calculateDayAge(batchInfo.entryDate, recordDate)
      
      // 6. 获取操作员信息
      let operatorName = feedData.operator || '未知'
      try {
        const user = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: wxContext.OPENID }).get()
        if (user.data && user.data.length > 0) {
          const u = user.data[0]
          operatorName = u.name || u.nickname || u.nickName || operatorName
        }
      } catch (e) {}
      
      // 7. 检查库存是否充足
      if (materialInfo.currentStock < quantity) {
        throw new Error(`饲料库存不足！当前库存: ${materialInfo.currentStock}${materialInfo.unit}，需要: ${quantity}${materialInfo.unit}`)
      }
      
      // 8. 扣减饲料库存
      const newStock = materialInfo.currentStock - quantity
      await transaction.collection(COLLECTIONS.PROD_MATERIALS).doc(feedData.materialId).update({
        data: {
          currentStock: newStock,
          updateTime: now
        }
      })
      
      // 9. 记录库存变动日志
      await transaction.collection(COLLECTIONS.PROD_INVENTORY_LOGS).add({
        data: {
          materialId: feedData.materialId,
          materialName: materialInfo.name,
          changeType: 'use',
          changeReason: 'feed_usage',
          relatedRecordId: null, // 先创建记录再更新
          quantity: -quantity,
          unit: materialInfo.unit,
          beforeStock: materialInfo.currentStock,
          afterStock: newStock,
          batchId: feedData.batchId,
          batchNumber: batchInfo.batchNumber,
          operator: operatorName,
          userId: wxContext.OPENID,
          createTime: now
        }
      })
      
      // 10. 创建投喂记录
      // 生成饲料投喂单据号（使用饲料类型）
      const recordNumber = generateRecordNumber('use', '饲料')
      
      const feedRecord = {
        batchId: feedData.batchId,
        batchNumber: batchInfo.batchNumber,
        materialId: feedData.materialId,
        materialName: materialInfo.name,
        recordNumber: recordNumber, // 添加单据号
        recordDate: recordDate,
        quantity: quantity,
        unit: materialInfo.unit,
        unitPrice: unitPrice,
        totalCost: totalCost,
        dayAge: dayAge,
        stockAtTime: stockInfo.currentStock,
        costPerBird: Number(costPerBird.toFixed(4)),
        operator: operatorName,
        userId: wxContext.OPENID,
        notes: feedData.notes || '',
        recordType: feedData.recordType || 'manual',
        createTime: now,
        updateTime: now
      }
      
      // TODO: 已修复 - feed_usage_records 已添加到标准集合列表
      const result = await transaction.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS).add({
        data: feedRecord
      })
      
      return {
        success: true,
        data: {
          _id: result._id,
          ...feedRecord,
          stockInfo: stockInfo,
          materialStock: {
            before: materialInfo.currentStock,
            after: newStock,
            used: quantity
          }
        },
        message: `饲料投喂记录创建成功，已扣减库存${quantity}${materialInfo.unit}`
      }
    })
  } catch (error) {
    throw new Error('记录投喂失败: ' + error.message)
  }
}

// 查询饲料投喂记录列表
async function listFeedUsage(event, wxContext) {
  const {
    page = 1,
    pageSize = 20,
    batchId = null,
    materialId = null,
    dateRange = null
  } = event
  
  let query = db.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS)
  
  // 构建查询条件
  const where = {}
  
  if (batchId) {
    where.batchId = batchId
  }
  
  if (materialId) {
    where.materialId = materialId
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
    .orderBy('recordDate', 'desc')
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

// 获取批次饲料成本统计
async function getBatchFeedCost(event, wxContext) {
  const { batchId } = event
  
  if (!batchId) {
    throw new Error('缺少批次ID')
  }
  
  try {
    // 1. 获取批次信息
    const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
    if (!batchEntry.data) {
      throw new Error('批次不存在')
    }
    const batchInfo = batchEntry.data
    
    // 2. 获取当前存栏数
    const today = new Date().toISOString().split('T')[0]
    const stockInfo = await getCurrentStockCount(batchId, today)
    
    // 3. 获取所有投喂记录
    const feedRecords = await db.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS)
      .where({ batchId: batchId })
      .orderBy('recordDate', 'asc')
      .get()
    
    // 4. 统计分析
    const costSummary = {
      totalFeedCost: 0,
      totalFeedQuantity: 0,
      avgCostPerBird: 0,
      feedingCount: feedRecords.data.length,
      avgCostPerFeeding: 0
    }
    
    const costByMaterial = {}
    
    feedRecords.data.forEach(record => {
      costSummary.totalFeedCost += record.totalCost || 0
      costSummary.totalFeedQuantity += record.quantity || 0
      
      // 按饲料类型统计
      const materialName = record.materialName
      if (!costByMaterial[materialName]) {
        costByMaterial[materialName] = {
          materialName: materialName,
          materialId: record.materialId,
          totalQuantity: 0,
          totalCost: 0,
          usageCount: 0,
          unit: record.unit
        }
      }
      
      costByMaterial[materialName].totalQuantity += record.quantity || 0
      costByMaterial[materialName].totalCost += record.totalCost || 0
      costByMaterial[materialName].usageCount++
    })
    
    // 计算平均值
    if (stockInfo.currentStock > 0) {
      costSummary.avgCostPerBird = costSummary.totalFeedCost / stockInfo.currentStock
    }
    
    if (costSummary.feedingCount > 0) {
      costSummary.avgCostPerFeeding = costSummary.totalFeedCost / costSummary.feedingCount
    }
    
    // 计算百分比
    const costByMaterialArray = Object.values(costByMaterial).map(item => ({
      ...item,
      percentage: costSummary.totalFeedCost > 0 
        ? ((item.totalCost / costSummary.totalFeedCost) * 100).toFixed(2)
        : 0
    }))
    
    // 计算日龄
    const dayAge = calculateDayAge(batchInfo.entryDate, today)
    
    return {
      success: true,
      data: {
        batchInfo: {
          batchId: batchId,
          batchNumber: batchInfo.batchNumber,
          breed: batchInfo.breed,
          entryDate: batchInfo.entryDate,
          currentStock: stockInfo.currentStock,
          initialQuantity: stockInfo.initialQuantity,
          dayAge: dayAge
        },
        costSummary: costSummary,
        costByMaterial: costByMaterialArray,
        feedRecords: feedRecords.data
      }
    }
  } catch (error) {
    throw new Error('获取批次成本失败: ' + error.message)
  }
}

// 获取饲料成本分析
async function getFeedCostAnalysis(event, wxContext) {
  const {
    batchIds = null,
    dateRange = null,
    analysisType = 'batch' // 'batch', 'time', 'material', 'stage'
  } = event
  
  try {
    let query = db.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS)
    const where = {}
    
    // 构建查询条件
    if (batchIds && batchIds.length > 0) {
      where.batchId = _.in(batchIds)
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      where.recordDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
    }
    
    if (Object.keys(where).length > 0) {
      query = query.where(where)
    }
    
    const records = await query.get()
    
    // 根据分析类型返回不同的数据
    const analysisData = {}
    
    if (analysisType === 'batch') {
      // 批次维度分析
      analysisData.batchComparison = await analyzeBatchComparison(records.data)
    } else if (analysisType === 'time') {
      // 时间维度分析
      analysisData.timeTrend = analyzeTimeTrend(records.data)
    } else if (analysisType === 'material') {
      // 饲料类型分析
      analysisData.materialAnalysis = analyzeMaterialUsage(records.data)
    } else if (analysisType === 'stage') {
      // 阶段分析
      analysisData.stageAnalysis = analyzeByStage(records.data)
    }
    
    return {
      success: true,
      data: {
        analysisType: analysisType,
        totalRecords: records.data.length,
        totalCost: records.data.reduce((sum, r) => sum + (r.totalCost || 0), 0),
        ...analysisData
      }
    }
  } catch (error) {
    throw new Error('成本分析失败: ' + error.message)
  }
}

// 批次对比分析
async function analyzeBatchComparison(records) {
  const batchStats = {}
  
  records.forEach(record => {
    const batchId = record.batchId
    if (!batchStats[batchId]) {
      batchStats[batchId] = {
        batchId: batchId,
        batchNumber: record.batchNumber,
        totalCost: 0,
        totalQuantity: 0,
        feedingCount: 0,
        avgStockAtTime: 0,
        stockSamples: []
      }
    }
    
    const batch = batchStats[batchId]
    batch.totalCost += record.totalCost || 0
    batch.totalQuantity += record.quantity || 0
    batch.feedingCount++
    batch.stockSamples.push(record.stockAtTime || 0)
  })
  
  // 计算平均存栏数和单只成本
  Object.values(batchStats).forEach(batch => {
    if (batch.stockSamples.length > 0) {
      batch.avgStockAtTime = batch.stockSamples.reduce((a, b) => a + b, 0) / batch.stockSamples.length
      batch.avgCostPerBird = batch.avgStockAtTime > 0 ? batch.totalCost / batch.avgStockAtTime : 0
    }
    delete batch.stockSamples // 清理临时数据
  })
  
  return Object.values(batchStats).sort((a, b) => b.totalCost - a.totalCost)
}

// 时间趋势分析
function analyzeTimeTrend(records) {
  const timeSeries = {}
  
  records.forEach(record => {
    const date = record.recordDate
    if (!timeSeries[date]) {
      timeSeries[date] = {
        date: date,
        totalCost: 0,
        totalQuantity: 0,
        recordCount: 0
      }
    }
    
    timeSeries[date].totalCost += record.totalCost || 0
    timeSeries[date].totalQuantity += record.quantity || 0
    timeSeries[date].recordCount++
  })
  
  return Object.values(timeSeries).sort((a, b) => a.date.localeCompare(b.date))
}

// 饲料类型分析
function analyzeMaterialUsage(records) {
  const materialStats = {}
  
  records.forEach(record => {
    const materialName = record.materialName
    if (!materialStats[materialName]) {
      materialStats[materialName] = {
        materialName: materialName,
        materialId: record.materialId,
        totalCost: 0,
        totalQuantity: 0,
        usageCount: 0,
        avgUnitPrice: 0,
        unit: record.unit
      }
    }
    
    const material = materialStats[materialName]
    material.totalCost += record.totalCost || 0
    material.totalQuantity += record.quantity || 0
    material.usageCount++
  })
  
  // 计算平均单价
  Object.values(materialStats).forEach(material => {
    if (material.totalQuantity > 0) {
      material.avgUnitPrice = material.totalCost / material.totalQuantity
    }
  })
  
  return Object.values(materialStats).sort((a, b) => b.totalCost - a.totalCost)
}

// 阶段分析（按日龄分组）
function analyzeByStage(records) {
  const stages = {
    '0-7天': { minAge: 0, maxAge: 7, records: [], totalCost: 0, avgCostPerBird: 0 },
    '8-14天': { minAge: 8, maxAge: 14, records: [], totalCost: 0, avgCostPerBird: 0 },
    '15-28天': { minAge: 15, maxAge: 28, records: [], totalCost: 0, avgCostPerBird: 0 },
    '29-56天': { minAge: 29, maxAge: 56, records: [], totalCost: 0, avgCostPerBird: 0 },
    '56天以上': { minAge: 57, maxAge: 9999, records: [], totalCost: 0, avgCostPerBird: 0 }
  }
  
  records.forEach(record => {
    const dayAge = record.dayAge || 0
    
    for (const [stageName, stage] of Object.entries(stages)) {
      if (dayAge >= stage.minAge && dayAge <= stage.maxAge) {
        stage.records.push(record)
        stage.totalCost += record.totalCost || 0
        break
      }
    }
  })
  
  // 计算每个阶段的平均单只成本
  Object.values(stages).forEach(stage => {
    const totalStock = stage.records.reduce((sum, r) => sum + (r.stockAtTime || 0), 0)
    if (stage.records.length > 0 && totalStock > 0) {
      stage.avgCostPerBird = stage.totalCost / (totalStock / stage.records.length)
    }
    stage.recordCount = stage.records.length
    delete stage.records // 清理详细记录
  })
  
  return stages
}

// 更新投喂记录
async function updateFeedUsage(event, wxContext) {
  const { recordId, updateData } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  // 检查记录是否存在
  const existingRecord = await db.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS).doc(recordId).get()
  
  if (!existingRecord.data) {
    throw new Error('记录不存在')
  }
  
  // 只允许更新备注
  const updateFields = {
    updateTime: new Date()
  }
  
  if (updateData.notes !== undefined) {
    updateFields.notes = updateData.notes
  }
  
  await db.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS).doc(recordId).update({
    data: updateFields
  })
  
  return {
    success: true,
    message: '投喂记录更新成功'
  }
}

// 删除投喂记录（需要回退库存）
async function deleteFeedUsage(event, wxContext) {
  const { recordId } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  try {
    return await db.runTransaction(async transaction => {
      // 1. 检查记录是否存在
      const record = await transaction.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS).doc(recordId).get()
      
      if (!record.data) {
        throw new Error('记录不存在')
      }
      
      const recordData = record.data
      
      // 2. 获取饲料信息
      const material = await transaction.collection(COLLECTIONS.PROD_MATERIALS).doc(recordData.materialId).get()
      
      if (!material.data) {
        throw new Error('关联的饲料不存在')
      }
      
      const materialInfo = material.data
      const now = new Date()
      
      // 3. 回退库存
      const newStock = materialInfo.currentStock + recordData.quantity
      await transaction.collection(COLLECTIONS.PROD_MATERIALS).doc(recordData.materialId).update({
        data: {
          currentStock: newStock,
          updateTime: now
        }
      })
      
      // 4. 记录库存变动日志
      await transaction.collection(COLLECTIONS.PROD_INVENTORY_LOGS).add({
        data: {
          materialId: recordData.materialId,
          materialName: recordData.materialName,
          changeType: 'return',
          changeReason: 'feed_usage_delete',
          relatedRecordId: recordId,
          quantity: recordData.quantity,
          unit: recordData.unit,
          beforeStock: materialInfo.currentStock,
          afterStock: newStock,
          batchId: recordData.batchId,
          batchNumber: recordData.batchNumber,
          operator: recordData.operator,
          userId: wxContext.OPENID,
          createTime: now
        }
      })
      
      // 5. 删除投喂记录
      await transaction.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS).doc(recordId).remove()
      
      return {
        success: true,
        data: {
          returnedQuantity: recordData.quantity,
          unit: recordData.unit,
          materialStock: {
            before: materialInfo.currentStock,
            after: newStock
          }
        },
        message: `投喂记录删除成功，已回退库存${recordData.quantity}${recordData.unit}`
      }
    })
  } catch (error) {
    throw new Error('删除记录失败: ' + error.message)
  }
}
