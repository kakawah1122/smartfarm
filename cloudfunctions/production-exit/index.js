// cloudfunctions/production-exit/index.js
// 出栏管理云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 生成出栏单号
function generateExitNumber() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `X${year}${month}${day}${random}`
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      case 'list':
        return await listExitRecords(event, wxContext)
      case 'create':
        return await createExitRecord(event, wxContext)
      case 'update':
        return await updateExitRecord(event, wxContext)
      case 'delete':
        return await deleteExitRecord(event, wxContext)
      case 'stats':
        return await getExitStats(event, wxContext)
      case 'detail':
        return await getExitDetail(event, wxContext)
      case 'available_batches':
        return await getAvailableBatches(event, wxContext)
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

// 获取出栏记录列表
async function listExitRecords(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 10, 
    status = null, 
    dateRange = null,
    customer = null 
  } = event
  
  let query = db.collection('prod_batch_exits')
  
  // 构建查询条件
  const where = {}
  
  if (status) {
    where.status = status
  }
  
  if (customer) {
    where.customer = db.RegExp({
      regexp: customer,
      options: 'i'
    })
  }
  
  if (dateRange && dateRange.start && dateRange.end) {
    where.exitDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
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
  
  // 为每个出栏记录关联获取入栏记录的品种信息，并兜底操作员
  const enrichedRecords = await Promise.all(
    records.data.map(async (record) => {
      try {
        // 通过批次号获取对应的入栏记录信息
        const entryRecord = await db.collection('prod_batch_entries')
          .where({ batchNumber: record.batchNumber })
          .limit(1)
          .get()
        
        if (entryRecord.data.length > 0) {
          const entry = entryRecord.data[0]
          // 兜底operator为创建者用户名
          let operator = record.operator
          if (!operator || operator === '未知') {
            try {
              const user = await db.collection('wx_users').where({ _openid: record.userId }).get()
              if (user.data && user.data.length > 0) {
                const u = user.data[0]
                operator = u.name || u.nickname || u.nickName || operator || '未知'
              }
            } catch (e) {}
          }
          return {
            ...record,
            breed: entry.breed || '未知品种',
            supplier: entry.supplier || '',
            entryDate: entry.entryDate,
            operator
          }
        } else {
          return {
            ...record,
            breed: '未知品种',
            supplier: '',
            entryDate: ''
          }
        }
      } catch (error) {
        // 已移除调试日志
        return {
          ...record,
          breed: '未知品种',
          supplier: '',
          entryDate: ''
        }
      }
    })
  )
  
  return {
    success: true,
    data: {
      records: enrichedRecords,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }
}

// 创建出栏记录
async function createExitRecord(event, wxContext) {
  const { recordData } = event
  
  // 数据验证
  if (!recordData.batchNumber || !recordData.customer || !recordData.quantity) {
    throw new Error('缺少必填字段：批次号、客户、数量')
  }
  
  if (recordData.quantity <= 0) {
    throw new Error('数量必须大于0')
  }
  
  // 验证批次号是否存在且有足够数量
  const entryRecord = await db.collection('prod_batch_entries')
    .where({ batchNumber: recordData.batchNumber })
    .get()
  
  if (!entryRecord.data.length) {
    throw new Error('批次号不存在')
  }
  
  // 检查已出栏数量
  const existingExits = await db.collection('prod_batch_exits')
    .where({ batchNumber: recordData.batchNumber })
    .get()
  
  const totalExited = existingExits.data.reduce((sum, record) => sum + record.quantity, 0)
  const availableQuantity = entryRecord.data[0].quantity - totalExited
  
  if (recordData.quantity > availableQuantity) {
    throw new Error(`数量超出可用范围，最多可出栏 ${availableQuantity} 羽`)
  }
  
  // 生成出栏单号
  const exitNumber = generateExitNumber()
  
  // 获取入栏记录的品种信息
  const entryInfo = entryRecord.data[0]
  
  const now = new Date()
  // 获取当前用户姓名作为操作员
  let operatorName = '未知'
  try {
    const userInfo = await db.collection('wx_users').where({ _openid: wxContext.OPENID }).get()
    if (userInfo.data && userInfo.data.length > 0) {
      const u = userInfo.data[0]
      operatorName = u.name || u.nickname || u.nickName || '未知'
    }
  } catch (e) {
    // 已移除调试日志
  }
  // 计算总收入：总重量×单价（正确的计算方式）
  let totalRevenue = 0
  const totalWeightNum = Number(recordData.totalWeight) || 0
  const unitPriceNum = Number(recordData.unitPrice) || 0
  const quantityNum = Number(recordData.quantity) || 0
  const avgWeightNum = Number(recordData.avgWeight) || 0
  
  // 1. 如果前端传递了totalRevenue且大于0，优先使用（前端已经按总重量×单价计算好了）
  const totalRevenueNum = Number(recordData.totalRevenue) || 0
  if (totalRevenueNum > 0) {
    totalRevenue = totalRevenueNum
  }
  // 2. 如果有总重量，按总重量×单价计算（推荐方式）
  else if (totalWeightNum > 0 && unitPriceNum > 0) {
    totalRevenue = totalWeightNum * unitPriceNum
  }
  // 3. 如果有数量和平均重量，计算总重量后再乘以单价
  else if (quantityNum > 0 && avgWeightNum > 0 && unitPriceNum > 0) {
    const calculatedTotalWeight = quantityNum * avgWeightNum
    totalRevenue = calculatedTotalWeight * unitPriceNum
  }
  // 4. 最后才按数量×单价计算（不准确，仅作为后备方案）
  else if (quantityNum > 0 && unitPriceNum > 0) {
    totalRevenue = quantityNum * unitPriceNum
  }
  
  // 如果totalWeight没有传递但可以计算出来，保存计算结果
  const finalTotalWeight = totalWeightNum > 0 ? totalWeightNum : (quantityNum * avgWeightNum || 0)
  
  const newRecord = {
    userId: wxContext.OPENID,
    exitNumber,
    batchNumber: recordData.batchNumber,
    breed: entryInfo.breed || '未知品种', // 从入栏记录获取品种
    supplier: entryInfo.supplier || '',   // 从入栏记录获取供应商信息
    customer: recordData.customer,
    customerContact: recordData.customerContact || '',
    quantity: quantityNum,
    avgWeight: avgWeightNum,
    totalWeight: finalTotalWeight, // 保存计算后的总重量
    unitPrice: unitPriceNum,
    totalRevenue: totalRevenue,
    exitDate: recordData.exitDate || now.toISOString().split('T')[0],
    deliveryDate: recordData.deliveryDate || '',
    operator: operatorName,
    status: recordData.status || '待出栏',
    notes: recordData.notes || '',
    qualityCheck: recordData.qualityCheck || {},
    isDeleted: false,  // ✅ 添加软删除标记
    createTime: now,
    updateTime: now
  }
  
  const result = await db.collection('prod_batch_exits').add({
    data: newRecord
  })
  
  return {
    success: true,
    data: {
      _id: result._id,
      exitNumber,
      ...newRecord
    },
    message: '出栏记录创建成功'
  }
}

// 更新出栏记录
async function updateExitRecord(event, wxContext) {
  const { recordId, updateData } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  // 检查记录是否存在
  const existingRecord = await db.collection('prod_batch_exits').doc(recordId).get()
  
  if (!existingRecord.data.length) {
    throw new Error('记录不存在')
  }
  
  // 若更新operator，自动替换为当前用户名
  if (updateData.operator !== undefined) {
    try {
      const userInfo = await db.collection('wx_users').where({ _openid: wxContext.OPENID }).get()
      if (userInfo.data && userInfo.data.length > 0) {
        const u = userInfo.data[0]
        updateData.operator = u.name || u.nickname || u.nickName || '未知'
      }
    } catch (e) {
      // 已移除调试日志
    }
  }

  // 准备更新数据
  const updateFields = {
    updateTime: new Date()
  }
  
  // 允许更新的字段
  const allowedFields = [
    'customer', 'customerContact', 'quantity', 'avgWeight', 'unitPrice',
    'exitDate', 'deliveryDate', 'operator', 'status', 'notes', 'qualityCheck'
  ]
  
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      updateFields[field] = updateData[field]
    }
  })
  
  // 如果更新数量或单价，需要验证数量和重新计算收入
  if (updateData.quantity !== undefined) {
    const record = existingRecord.data[0]
    
    // 验证批次可用数量
    const entryRecord = await db.collection('prod_batch_entries')
      .where({ batchNumber: record.batchNumber })
      .get()
    
    const existingExits = await db.collection('prod_batch_exits')
      .where({ 
        batchNumber: record.batchNumber,
        _id: _.neq(recordId)  // 排除当前记录
      })
      .get()
    
    const totalExited = existingExits.data.reduce((sum, r) => sum + r.quantity, 0)
    const availableQuantity = entryRecord.data[0].quantity - totalExited
    
    if (updateData.quantity > availableQuantity) {
      throw new Error(`数量超出可用范围，最多可出栏 ${availableQuantity} 羽`)
    }
  }
  
  // 重新计算总收入：使用与创建记录相同的逻辑
  if (updateData.totalRevenue !== undefined || updateData.totalWeight !== undefined || updateData.unitPrice !== undefined || updateData.quantity !== undefined || updateData.avgWeight !== undefined) {
    const record = existingRecord.data[0]
    
    // 获取最新的值（优先使用更新的值，否则使用原记录的值）
    const totalWeightNum = updateData.totalWeight !== undefined ? Number(updateData.totalWeight) : (Number(record.totalWeight) || 0)
    const unitPriceNum = updateData.unitPrice !== undefined ? Number(updateData.unitPrice) : (Number(record.unitPrice) || 0)
    const quantityNum = updateData.quantity !== undefined ? Number(updateData.quantity) : (Number(record.quantity) || 0)
    const avgWeightNum = updateData.avgWeight !== undefined ? Number(updateData.avgWeight) : (Number(record.avgWeight) || 0)
    const totalRevenueNum = updateData.totalRevenue !== undefined ? Number(updateData.totalRevenue) : 0
    
    let totalRevenue = 0
    
    // 1. 如果前端传递了totalRevenue且大于0，优先使用
    if (totalRevenueNum > 0) {
      totalRevenue = totalRevenueNum
    }
    // 2. 如果有总重量，按总重量×单价计算（推荐方式）
    else if (totalWeightNum > 0 && unitPriceNum > 0) {
      totalRevenue = totalWeightNum * unitPriceNum
    }
    // 3. 如果有数量和平均重量，计算总重量后再乘以单价
    else if (quantityNum > 0 && avgWeightNum > 0 && unitPriceNum > 0) {
      const calculatedTotalWeight = quantityNum * avgWeightNum
      totalRevenue = calculatedTotalWeight * unitPriceNum
      // 同时更新总重量
      if (updateData.totalWeight === undefined) {
        updateFields.totalWeight = calculatedTotalWeight
      }
    }
    // 4. 最后才按数量×单价计算（不准确，仅作为后备方案）
    else if (quantityNum > 0 && unitPriceNum > 0) {
      totalRevenue = quantityNum * unitPriceNum
    }
    
    updateFields.totalRevenue = totalRevenue
  }
  
  await db.collection('prod_batch_exits').doc(recordId).update({
    data: updateFields
  })
  
  return {
    success: true,
    message: '出栏记录更新成功'
  }
}

// 删除出栏记录
async function deleteExitRecord(event, wxContext) {
  const { recordId } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  const record = await db.collection('prod_batch_exits').doc(recordId).get()
  
  if (!record.data.length) {
    throw new Error('记录不存在')
  }
  
  await db.collection('prod_batch_exits').doc(recordId).remove()
  
  return {
    success: true,
    message: '出栏记录删除成功'
  }
}

// 获取出栏统计数据
async function getExitStats(event, wxContext) {
  const { dateRange } = event
  
  let query = db.collection('prod_batch_exits')
  
  // 日期范围过滤
  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      exitDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }
  
  const records = await query.get()
  const data = records.data
  
  // 计算统计数据
  const totalQuantity = data.reduce((sum, record) => sum + (record.quantity || 0), 0)
  const totalRevenue = data.reduce((sum, record) => sum + (record.totalRevenue || 0), 0)
  const totalBatches = new Set(data.map(record => record.batchNumber)).size
  
  // 计算平均重量
  const totalWeight = data.reduce((sum, record) => 
    sum + ((record.quantity || 0) * (record.avgWeight || 0)), 0)
  const avgWeight = totalQuantity > 0 ? (totalWeight / totalQuantity).toFixed(1) : '0.0'
  
  // 按状态统计
  const statusStats = {}
  data.forEach(record => {
    const status = record.status || '未知'
    if (!statusStats[status]) {
      statusStats[status] = { quantity: 0, revenue: 0, count: 0 }
    }
    statusStats[status].quantity += record.quantity || 0
    statusStats[status].revenue += record.totalRevenue || 0
    statusStats[status].count += 1
  })
  
  // 按客户统计
  const customerStats = {}
  data.forEach(record => {
    const customer = record.customer || '未知'
    if (!customerStats[customer]) {
      customerStats[customer] = { quantity: 0, revenue: 0, count: 0 }
    }
    customerStats[customer].quantity += record.quantity || 0
    customerStats[customer].revenue += record.totalRevenue || 0
    customerStats[customer].count += 1
  })
  
  return {
    success: true,
    data: {
      total: totalQuantity.toLocaleString(),
      batches: totalBatches.toString(),
      avgWeight,
      totalRevenue: totalRevenue.toLocaleString(),
      statusStats,
      customerStats,
      recentTrend: await getRecentExitTrend(dateRange)
    }
  }
}

// 获取最近出栏趋势
async function getRecentExitTrend(dateRange) {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  const records = await db.collection('prod_batch_exits')
    .where({
      exitDate: _.gte(startDate.toISOString().split('T')[0])
               .and(_.lte(endDate.toISOString().split('T')[0]))
    })
    .get()
  
  const dailyStats = {}
  records.data.forEach(record => {
    const date = record.exitDate
    if (!dailyStats[date]) {
      dailyStats[date] = { quantity: 0, revenue: 0 }
    }
    dailyStats[date].quantity += record.quantity || 0
    dailyStats[date].revenue += record.totalRevenue || 0
  })
  
  return dailyStats
}

// 获取出栏记录详情
async function getExitDetail(event, wxContext) {
  const { recordId } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  const record = await db.collection('prod_batch_exits').doc(recordId).get()
  
  if (!record.data.length) {
    throw new Error('记录不存在')
  }
  
  // 获取关联的入栏信息
  const entryRecord = await db.collection('prod_batch_entries')
    .where({ batchNumber: record.data[0].batchNumber })
    .get()
  
  const data = record.data[0]
  let resolvedOperator = data.operator
  if (!resolvedOperator || resolvedOperator === '未知') {
    try {
      const user = await db.collection('wx_users').where({ _openid: data.userId }).get()
      if (user.data && user.data.length > 0) {
        const u = user.data[0]
        resolvedOperator = u.name || u.nickname || u.nickName || '未知'
      }
      if (resolvedOperator && resolvedOperator !== '未知') {
        await db.collection('prod_batch_exits').doc(data._id).update({
          data: {
            operator: resolvedOperator,
            updateTime: new Date()
          }
        })
      }
    } catch (e) {
      // 已移除调试日志
    }
  }
  
  return {
    success: true,
    data: {
      ...data,
      operator: resolvedOperator || data.operator || '未知',
      entryInfo: entryRecord.data[0] || null
    }
  }
}

// 获取可用的批次列表
async function getAvailableBatches(event, wxContext) {
  // 获取所有入栏记录
  const entryRecords = await db.collection('prod_batch_entries')
    .where({ status: '已完成' })
    .get()
  
  // 获取所有出栏记录
  const exitRecords = await db.collection('prod_batch_exits').get()
  
  // 计算每个批次的可用数量
  const exitByBatch = {}
  exitRecords.data.forEach(record => {
    const batch = record.batchNumber
    if (!exitByBatch[batch]) {
      exitByBatch[batch] = 0
    }
    exitByBatch[batch] += record.quantity
  })
  
  // 筛选有可用数量的批次
  const availableBatches = entryRecords.data
    .map(entry => {
      const exitedQuantity = exitByBatch[entry.batchNumber] || 0
      const availableQuantity = entry.quantity - exitedQuantity
      
      return {
        batchNumber: entry.batchNumber,
        breed: entry.breed,
        quality: entry.quality,
        entryDate: entry.entryDate,
        totalQuantity: entry.quantity,
        exitedQuantity,
        availableQuantity
      }
    })
    .filter(batch => batch.availableQuantity > 0)
    .sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate))
  
  return {
    success: true,
    data: availableBatches
  }
}
