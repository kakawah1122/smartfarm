// cloudfunctions/health-management/index.js
// 健康管理云函数 - 处理健康记录、死亡记录和存栏数量更新
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 生成健康记录ID
function generateHealthRecordId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `H${year}${month}${day}${random}`
}

// 生成死亡记录ID
function generateDeathRecordId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `D${year}${month}${day}${random}`
}

// 生成跟进记录ID
function generateFollowupRecordId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `F${year}${month}${day}${random}`
}

// 生成治愈记录ID
function generateCureRecordId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `C${year}${month}${day}${random}`
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      case 'get_active_batches':
        return await getActiveBatches(event, wxContext)
      case 'create_health_record':
        return await createHealthRecord(event, wxContext)
      case 'list_health_records':
        return await listHealthRecords(event, wxContext)
      case 'update_health_record':
        return await updateHealthRecord(event, wxContext)
      case 'get_health_stats':
        return await getHealthStats(event, wxContext)
      case 'list_death_records':
        return await listDeathRecords(event, wxContext)
      case 'get_health_detail':
        return await getHealthDetail(event, wxContext)
      case 'get_health_record':
        return await getHealthRecord(event, wxContext)
      case 'get_health_record_detail':  // 添加客户端使用的action名称
        return await getHealthDetail(event, wxContext)
      case 'create_followup_record':
        return await createFollowupRecord(event, wxContext)
      case 'list_followup_records':
        return await listFollowupRecords(event, wxContext)
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: error.message || '操作失败，请重试',
      errorCode: error.code,
      errorStack: error.stack
    }
  }
}

// 获取活跃批次（有存栏的批次）
async function getActiveBatches(event, wxContext) {
  try {
    // 获取所有入栏记录
    const entryRecords = await db.collection('entry_records')
      .where({ status: '已完成' })
      .orderBy('entryDate', 'desc')
      .get()
    
    const activeBatches = []
    
    // 对每个批次计算存栏数量
    for (const entry of entryRecords.data) {
      // 获取出栏数量
      const exitRecords = await db.collection('exit_records')
        .where({ batchNumber: entry.batchNumber })
        .get()
      
      const exitQuantity = exitRecords.data.reduce((sum, record) => sum + (record.quantity || 0), 0)
      
      // 获取死亡数量
      const deathRecords = await db.collection('death_records')
        .where({ batchNumber: entry.batchNumber })
        .get()
      
      const deathQuantity = deathRecords.data.reduce((sum, record) => sum + (record.deathCount || 0), 0)
      
      // 计算存栏数量
      const stockQuantity = entry.quantity - exitQuantity - deathQuantity
      
      if (stockQuantity > 0) {
        activeBatches.push({
          batchNumber: entry.batchNumber,
          breed: entry.breed,
          entryDate: entry.entryDate,
          originalQuantity: entry.quantity,
          currentStock: stockQuantity,
          location: entry.location,
          displayName: `${entry.batchNumber} (${entry.breed}, 存栏${stockQuantity}羽)`
        })
      }
    }
    
    return {
      success: true,
      data: {
        batches: activeBatches
      }
    }
  } catch (error) {
    throw error
  }
}

// 创建健康记录
async function createHealthRecord(event, wxContext) {
  const { recordData } = event
  
  try {
    // 数据验证
    if (!recordData.batchNumber || !recordData.affectedCount || !recordData.symptoms) {
      throw new Error('缺少必填字段')
    }
    
    const now = new Date()
    const healthRecordId = generateHealthRecordId()
    
    // 创建健康记录
    const healthRecord = {
      _id: healthRecordId,
      userId: wxContext.OPENID,
      batchNumber: recordData.batchNumber,
      recordDate: recordData.recordDate,
      location: recordData.location,
      affectedCount: Number(recordData.affectedCount),
      symptoms: recordData.symptoms,
      diagnosisDisease: recordData.diagnosisDisease || '待确诊', // 添加诊断病种字段
      severity: recordData.severity || 'mild',
      treatment: recordData.treatment || '',
      treatmentDate: recordData.treatmentDate,
      result: recordData.result || 'ongoing',
      notes: recordData.notes || '',
      createTime: now,
      updateTime: now
    }
    
    // 使用事务确保数据一致性
    const transaction = await db.runTransaction(async transaction => {
      // 创建健康记录
      await transaction.collection('health_records').add({
        data: healthRecord
      })
      
      // 如果是死亡结果，创建死亡记录
      if (recordData.result === 'death' && recordData.deathCount > 0) {
        const deathRecordId = generateDeathRecordId()
        
        const deathRecord = {
          _id: deathRecordId,
          userId: wxContext.OPENID,
          healthRecordId: healthRecordId,
          batchNumber: recordData.batchNumber,
          deathDate: recordData.treatmentDate || recordData.recordDate,
          deathCount: Number(recordData.deathCount),
          deathReason: recordData.symptoms,
          treatment: recordData.treatment,
          location: recordData.location,
          notes: recordData.notes || '',
          createTime: now,
          updateTime: now
        }
        
        await transaction.collection('death_records').add({
          data: deathRecord
        })
        
        // 更新健康记录关联死亡记录ID
        await transaction.collection('health_records').doc(healthRecordId).update({
          data: {
            deathRecordId: deathRecordId,
            deathCount: Number(recordData.deathCount),
            updateTime: now
          }
        })
      }
    })
    
    return {
      success: true,
      data: {
        healthRecordId,
        ...healthRecord
      },
      message: '健康记录创建成功'
    }
    
  } catch (error) {
    throw error
  }
}

// 获取健康记录列表（包含原始记录、治愈记录、死亡记录）
async function listHealthRecords(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 10, 
    batchNumber = null,
    result = null,
    dateRange = null
  } = event
  
  try {
    // 构建查询条件
    const where = {}
    
    if (batchNumber) {
      where.batchNumber = batchNumber
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      where.recordDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
    }
    
    // 获取所有类型的记录
    const [healthRecords, cureRecords, deathRecords] = await Promise.all([
      // 原始健康记录
      db.collection('health_records')
        .where(Object.keys(where).length > 0 ? where : {})
        .orderBy('createTime', 'desc')
        .get(),
      
      // 治愈记录  
      db.collection('cure_records')
        .where(batchNumber ? { batchNumber } : {})
        .orderBy('createTime', 'desc')
        .get(),
      
      // 死亡记录
      db.collection('death_records')
        .where(batchNumber ? { batchNumber } : {})
        .orderBy('createTime', 'desc')
        .get()
    ])
    
    // 合并所有记录并格式化
    const allRecords = []
    
    // 处理原始健康记录
    for (const record of healthRecords.data) {
      allRecords.push({
        ...record,
        recordType: 'health',
        displayDate: record.recordDate,
        sortTime: new Date(record.createTime).getTime()
      })
    }
    
    // 处理治愈记录
    for (const record of cureRecords.data) {
      allRecords.push({
        ...record,
        recordType: 'cure',
        displayDate: record.cureDate,
        sortTime: new Date(record.createTime).getTime(),
        // 格式化为健康记录格式
        symptoms: `治愈跟进：${record.cureCount}只已康复`,
        treatment: record.treatment,
        severity: 'success',
        result: 'cured',
        // 确保诊断病种字段正确传递
        diagnosisDisease: record.diagnosisDisease || '未确诊'
      })
    }
    
    // 处理死亡记录  
    for (const record of deathRecords.data) {
      allRecords.push({
        ...record,
        recordType: 'death',
        displayDate: record.deathDate,
        sortTime: new Date(record.createTime).getTime(),
        // 格式化为健康记录格式
        symptoms: `死亡记录：${record.deathCount}只死亡，原因：${record.deathReason}`,
        treatment: record.treatment,
        severity: 'danger', 
        result: 'death',
        // 确保诊断病种字段正确传递
        diagnosisDisease: record.diagnosisDisease || '未确诊'
      })
    }
    
    // 按时间降序排序
    allRecords.sort((a, b) => b.sortTime - a.sortTime)
    
    // 应用结果过滤
    let filteredRecords = allRecords
    if (result) {
      filteredRecords = allRecords.filter(record => record.result === result)
    }
    
    // 分页处理
    const total = filteredRecords.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedRecords = filteredRecords.slice(startIndex, endIndex)
    
    // 为每个记录补充批次信息
    const enrichedRecords = []
    for (const record of paginatedRecords) {
      // 获取批次信息
      const batchInfo = await db.collection('entry_records')
        .where({ batchNumber: record.batchNumber })
        .limit(1)
        .get()
      
      enrichedRecords.push({
        ...record,
        batchInfo: batchInfo.data[0] || null
      })
    }
    
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
  } catch (error) {
    throw error
  }
}

// 获取健康统计数据
async function getHealthStats(event, wxContext) {
  const { dateRange } = event
  
  try {
    // 获取所有健康记录
    let healthQuery = db.collection('health_records')
    if (dateRange && dateRange.start && dateRange.end) {
      healthQuery = healthQuery.where({
        recordDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    const healthRecords = await healthQuery.get()
    const healthData = healthRecords.data
    
    // 获取死亡记录
    let deathQuery = db.collection('death_records')
    if (dateRange && dateRange.start && dateRange.end) {
      deathQuery = deathQuery.where({
        deathDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    const deathRecords = await deathQuery.get()
    const deathData = deathRecords.data
    
    // 获取存栏统计
    const stockStats = await getStockStats()
    
    // 计算统计数据
    const totalAffected = healthData.reduce((sum, record) => sum + (record.affectedCount || 0), 0)
    const totalDeaths = deathData.reduce((sum, record) => sum + (record.deathCount || 0), 0)
    const curedRecords = healthData.filter(record => record.result === 'cured').length
    const ongoingRecords = healthData.filter(record => record.result === 'ongoing').length
    
    // 计算当前患病数量（只统计状态为 ongoing 的记录，使用实际剩余的受影响数量）
    const currentAffected = healthData
      .filter(record => record.result === 'ongoing')
      .reduce((sum, record) => {
        // 优先使用 currentAffectedCount（剩余需要治疗的数量），如果不存在则使用原始的 affectedCount
        const actualAffected = record.currentAffectedCount !== undefined 
          ? record.currentAffectedCount 
          : record.affectedCount || 0
        return sum + actualAffected
      }, 0)
    
    // 计算存活率：(总入栏数量 - 死亡数量) / 总入栏数量 * 100%
    const survivalRate = stockStats.totalEntry > 0 ? 
      (((stockStats.totalEntry - stockStats.totalDeath) / stockStats.totalEntry) * 100).toFixed(1) : '100.0'
    
    // 按严重程度统计
    const severityStats = {
      mild: healthData.filter(r => r.severity === 'mild').length,
      moderate: healthData.filter(r => r.severity === 'moderate').length,
      severe: healthData.filter(r => r.severity === 'severe').length
    }
    
    // 最近趋势
    const recentTrend = await getHealthTrend(dateRange)
    
    return {
      success: true,
      data: {
        survivalRate: survivalRate,
        totalRecords: healthData.length,
        totalAffected: currentAffected,
        totalDeaths: totalDeaths,
        curedCount: curedRecords,
        ongoingCount: ongoingRecords,
        severityStats,
        stockStats,
        recentTrend
      }
    }
  } catch (error) {
    throw error
  }
}

// 获取存栏统计
async function getStockStats() {
  try {
    // 获取所有入栏记录
    const entryRecords = await db.collection('entry_records').get()
    const totalEntry = entryRecords.data.reduce((sum, record) => sum + (record.quantity || 0), 0)
    
    // 获取所有出栏记录
    const exitRecords = await db.collection('exit_records').get()
    const totalExit = exitRecords.data.reduce((sum, record) => sum + (record.quantity || 0), 0)
    
    // 获取所有死亡记录
    const deathRecords = await db.collection('death_records').get()
    const totalDeath = deathRecords.data.reduce((sum, record) => sum + (record.deathCount || 0), 0)
    
    const totalStock = Math.max(0, totalEntry - totalExit - totalDeath)
    
    return {
      totalEntry,
      totalExit,
      totalDeath,
      totalStock
    }
  } catch (error) {
    throw error
  }
}

// 获取健康趋势
async function getHealthTrend(dateRange) {
  try {
    // 获取最近7天的健康记录
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    const records = await db.collection('health_records')
      .where({
        recordDate: _.gte(startDate.toISOString().split('T')[0])
                   .and(_.lte(endDate.toISOString().split('T')[0]))
      })
      .get()
    
    // 按日期分组统计
    const dailyStats = {}
    records.data.forEach(record => {
      const date = record.recordDate
      if (!dailyStats[date]) {
        dailyStats[date] = { affected: 0, cured: 0, death: 0 }
      }
      dailyStats[date].affected += record.affectedCount || 0
      if (record.result === 'cured') {
        dailyStats[date].cured += record.affectedCount || 0
      } else if (record.result === 'death') {
        dailyStats[date].death += record.deathCount || 0
      }
    })
    
    return dailyStats
  } catch (error) {
    return {}
  }
}

// 获取死亡记录列表
async function listDeathRecords(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 10, 
    batchNumber = null,
    dateRange = null
  } = event
  
  try {
    let query = db.collection('death_records')
    
    const where = {}
    
    if (batchNumber) {
      where.batchNumber = batchNumber
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      where.deathDate = _.gte(dateRange.start).and(_.lte(dateRange.end))
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
  } catch (error) {
    throw error
  }
}

// 更新健康记录
async function updateHealthRecord(event, wxContext) {
  const { recordId, updateData } = event
  
  try {
    if (!recordId) {
      throw new Error('缺少记录ID')
    }
    
    // 检查记录是否存在
    const existingRecord = await db.collection('health_records').doc(recordId).get()
    if (!existingRecord.data) {
      throw new Error('记录不存在')
    }
    
    const now = new Date()
    const updateFields = {
      ...updateData,
      updateTime: now
    }
    
    await db.collection('health_records').doc(recordId).update({
      data: updateFields
    })
    
    return {
      success: true,
      message: '健康记录更新成功'
    }
  } catch (error) {
    throw error
  }
}

// 获取健康记录详情
async function getHealthDetail(event, wxContext) {
  const { recordId } = event
  
  try {
    if (!recordId) {
      throw new Error('缺少记录ID')
    }
    
    const record = await db.collection('health_records').doc(recordId).get()
    if (!record.data) {
      throw new Error('记录不存在')
    }
    
    // 获取关联的死亡记录（如果有）
    let deathRecord = null
    if (record.data.deathRecordId) {
      const deathResult = await db.collection('death_records').doc(record.data.deathRecordId).get()
      deathRecord = deathResult.data
    }
    
    // 获取批次信息
    const batchResult = await db.collection('entry_records')
      .where({ batchNumber: record.data.batchNumber })
      .limit(1)
      .get()
    
    return {
      success: true,
      data: {
        healthRecord: record.data,
        deathRecord,
        batchInfo: batchResult.data[0] || null
      }
    }
  } catch (error) {
    throw error
  }
}

// 获取单个健康记录
async function getHealthRecord(event, wxContext) {
  const { recordId } = event
  
  try {
    if (!recordId) {
      throw new Error('缺少记录ID')
    }
    
    const record = await db.collection('health_records').doc(recordId).get()
    if (!record.data) {
      throw new Error('记录不存在')
    }
    
    return {
      success: true,
      data: {
        record: record.data
      }
    }
  } catch (error) {
    throw error
  }
}

// 创建跟进记录
async function createFollowupRecord(event, wxContext) {
  const { followupData } = event
  
  try {
    
    // 数据验证
    if (!followupData.recordId || !followupData.followupDate) {
      const error = `缺少必填字段: recordId=${followupData.recordId}, followupDate=${followupData.followupDate}`
      throw new Error(error)
    }
    
    // 验证至少有一个数量
    const curedCount = Number(followupData.curedCount) || 0
    const deathCount = Number(followupData.deathCount) || 0
    
    if (curedCount === 0 && deathCount === 0) {
      throw new Error('至少需要填写治愈数量或死亡数量')
    }
    
    // 检查原始记录是否存在
    const originalRecord = await db.collection('health_records').doc(followupData.recordId).get()
    
    if (!originalRecord.data) {
      throw new Error('原始健康记录不存在')
    }
    
    const now = new Date()
    const followupRecordId = generateFollowupRecordId()
    
    // 创建跟进记录
    const followupRecord = {
      _id: followupRecordId,
      userId: wxContext.OPENID,
      healthRecordId: followupData.recordId,
      batchNumber: originalRecord.data.batchNumber,
      followupDate: followupData.followupDate,
      curedCount: curedCount,
      deathCount: deathCount,
      notes: followupData.notes || '',
      operator: followupData.operator || '系统用户',
      createTime: now,
      updateTime: now
    }
    
    // 创建跟进记录
    try {
      // 添加跟进记录
      const addResult = await db.collection('followup_records').add({
        data: followupRecord
      })
      
      // 计算已处理的总数量
      const currentCuredCount = Number(originalRecord.data.curedCount || 0)
      const currentDeathCount = Number(originalRecord.data.deathCount || 0)
      const newCuredCount = curedCount
      const newDeathCount = deathCount
      
      const totalCured = currentCuredCount + newCuredCount
      const totalDeaths = currentDeathCount + newDeathCount
      const totalProcessed = totalCured + totalDeaths
      const originalAffectedCount = Number(originalRecord.data.affectedCount || 0)
      
      // 处理数量统计
      console.log('跟进处理统计:', {
        '已治愈': totalCured,
        '已死亡': totalDeaths,
        '已处理总数': totalProcessed
      })
      
      // 根据处理情况决定记录状态
      let finalResult = 'ongoing'  // 默认继续治疗中
      if (totalProcessed >= originalAffectedCount) {
        // 所有个体都已处理完毕
        if (totalDeaths === originalAffectedCount) {
          finalResult = 'death'  // 全部死亡
        } else if (totalCured === originalAffectedCount) {
          finalResult = 'cured'  // 全部治愈
        } else {
          // 部分治愈部分死亡，根据最后一次跟进结果决定主要状态
          finalResult = totalCured > totalDeaths ? 'cured' : 'death'
        }
      }
      
      // 更新原始健康记录
      const updateData = {
        result: finalResult,
        updateTime: now,
        latestFollowupId: followupRecordId,
        latestFollowupDate: followupData.followupDate,
        curedCount: totalCured,
        deathCount: totalDeaths,
        // 更新当前受影响数量（剩余需要治疗的数量）
        currentAffectedCount: Math.max(0, originalAffectedCount - totalProcessed)
      }
      
      // 更新原始健康记录
      await db.collection('health_records').doc(followupData.recordId).update({
        data: updateData
      })
      
      // 如果有治愈数量，创建治愈记录
      if (curedCount > 0) {
        const cureRecordId = generateCureRecordId()
        
        const cureRecord = {
          _id: cureRecordId,
          userId: wxContext.OPENID,
          healthRecordId: followupData.recordId,
          followupRecordId: followupRecordId,
          batchNumber: originalRecord.data.batchNumber,
          cureDate: followupData.followupDate,
          cureCount: curedCount,
          treatment: originalRecord.data.treatment,
          diagnosisDisease: followupData.diagnosisDisease || originalRecord.data.diagnosisDisease || '未确诊',
          symptoms: followupData.symptoms || originalRecord.data.symptoms || '',
          location: originalRecord.data.location,
          notes: followupData.notes || '',
          createTime: now,
          updateTime: now
        }
        
        // 创建治愈记录
        await db.collection('cure_records').add({
          data: cureRecord
        })
        
        // 更新健康记录关联治愈记录ID
        await db.collection('health_records').doc(followupData.recordId).update({
          data: {
            latestCureRecordId: cureRecordId,
            updateTime: now
          }
        })
      }
      
      // 如果有死亡数量，创建死亡记录
      if (deathCount > 0) {
        const deathRecordId = generateDeathRecordId()
        
        const deathRecord = {
          _id: deathRecordId,
          userId: wxContext.OPENID,
          healthRecordId: followupData.recordId,
          followupRecordId: followupRecordId,
          batchNumber: originalRecord.data.batchNumber,
          deathDate: followupData.followupDate,
          deathCount: deathCount,
          deathReason: followupData.symptoms || originalRecord.data.symptoms || '',
          treatment: originalRecord.data.treatment,
          diagnosisDisease: followupData.diagnosisDisease || originalRecord.data.diagnosisDisease || '未确诊',
          symptoms: followupData.symptoms || originalRecord.data.symptoms || '',
          location: originalRecord.data.location,
          notes: followupData.notes || '',
          createTime: now,
          updateTime: now
        }
        
        // 创建死亡记录
        await db.collection('death_records').add({
          data: deathRecord
        })
        
        // 更新健康记录关联死亡记录ID（只更新关联ID，数量已在上面更新过）
        await db.collection('health_records').doc(followupData.recordId).update({
          data: {
            latestDeathRecordId: deathRecordId,
            updateTime: now
          }
        })
      }
      
    } catch (dbError) {
      throw new Error(`数据库操作失败: ${dbError.message}`)
    }
    
    return {
      success: true,
      data: {
        followupRecordId,
        ...followupRecord
      },
      message: '跟进记录创建成功'
    }
    
  } catch (error) {
    throw error
  }
}

// 获取跟进记录列表
async function listFollowupRecords(event, wxContext) {
  const { 
    healthRecordId = null,
    batchNumber = null,
    page = 1,
    pageSize = 10
  } = event
  
  try {
    let query = db.collection('followup_records')
    
    const where = {}
    
    if (healthRecordId) {
      where.healthRecordId = healthRecordId
    }
    
    if (batchNumber) {
      where.batchNumber = batchNumber
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
  } catch (error) {
    throw error
  }
}
