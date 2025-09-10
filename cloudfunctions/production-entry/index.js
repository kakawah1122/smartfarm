// cloudfunctions/production-entry/index.js
// 入栏管理云函数
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
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `E${year}${month}${day}${random}`
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
  
  let query = db.collection('entry_records')
  
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
    const userInfo = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get();
    
    if (userInfo.data && userInfo.data.length > 0) {
      const u = userInfo.data[0]
      userName = u.name || u.nickname || u.nickName || '未知';
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
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
    purchaseDate: recordData.purchaseDate || now.toISOString().split('T')[0],
    entryDate: recordData.entryDate || now.toISOString().split('T')[0],
    operator: userName, // 使用查询到的用户名而不是传入的operator
    status: recordData.status || '待验收',
    notes: recordData.notes || '',
    photos: recordData.photos || [],
    location: recordData.location || {},
    createTime: now,
    updateTime: now
  }
  
  const result = await db.collection('entry_records').add({
    data: newRecord
  })
  
  return {
    success: true,
    data: {
      _id: result._id,
      batchNumber,
      ...newRecord
    },
    message: '入栏记录创建成功'
  }
}

// 更新入栏记录
async function updateEntryRecord(event, wxContext) {
  const { recordId, updateData } = event
  
  if (!recordId) {
    throw new Error('缺少记录ID')
  }
  
  // 检查记录是否存在且有权限修改
  const existingRecord = await db.collection('entry_records').doc(recordId).get()
  
  if (!existingRecord.data.length) {
    throw new Error('记录不存在')
  }
  
  // 如果要更新operator字段，获取用户信息
  if (updateData.operator !== undefined) {
    try {
      const userInfo = await db.collection('users').where({
        _openid: wxContext.OPENID
      }).get();
      
      if (userInfo.data && userInfo.data.length > 0) {
        updateData.operator = userInfo.data[0].name || userInfo.data[0].nickName || '未知';
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
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
  
  await db.collection('entry_records').doc(recordId).update({
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
  const record = await db.collection('entry_records').doc(recordId).get()
  
  if (!record.data.length) {
    throw new Error('记录不存在')
  }
  
  await db.collection('entry_records').doc(recordId).remove()
  
  return {
    success: true,
    message: '入栏记录删除成功'
  }
}

// 获取入栏统计数据
async function getEntryStats(event, wxContext) {
  const { dateRange } = event
  
  let query = db.collection('entry_records')
  
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
  
  const records = await db.collection('entry_records')
    .where({
      entryDate: _.gte(startDate.toISOString().split('T')[0])
                 .and(_.lte(endDate.toISOString().split('T')[0]))
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
  
  const record = await db.collection('entry_records').doc(recordId).get()
  
  if (!record.data.length) {
    throw new Error('记录不存在')
  }
  
  const data = record.data[0]
  let resolvedOperator = data.operator
  
  // 如果操作员为空或为“未知”，尝试根据记录创建者补齐
  if (!resolvedOperator || resolvedOperator === '未知') {
    try {
      const userRes = await db.collection('users').where({ _openid: data.userId }).get()
      if (userRes.data && userRes.data.length > 0) {
        const u = userRes.data[0]
        resolvedOperator = u.name || u.nickname || u.nickName || '未知'
      }
      
      // 如果成功解析出有效操作员，回写数据库，避免下次再计算
      if (resolvedOperator && resolvedOperator !== '未知') {
        await db.collection('entry_records').doc(recordId).update({
          data: {
            operator: resolvedOperator,
            updateTime: new Date()
          }
        })
      }
    } catch (err) {
      console.error('补齐操作员失败:', err)
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
