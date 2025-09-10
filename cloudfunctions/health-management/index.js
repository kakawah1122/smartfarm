// cloudfunctions/health-management/index.js
// 健康管理云函数 - 完整的健康管理系统
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const MAX_LIMIT = 100

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

// 生成预防记录ID
function generatePreventionRecordId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `P${year}${month}${day}${random}`
}

// 生成治疗记录ID
function generateTreatmentRecordId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `T${year}${month}${day}${random}`
}

// 生成预警ID
function generateAlertId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `A${year}${month}${day}${random}`
}

// 工具函数：验证用户权限
async function validateUserRole(openid, requiredRoles = []) {
  try {
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get()
    
    if (userResult.data.length === 0) {
      throw new Error('用户不存在')
    }
    
    const user = userResult.data[0]
    if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      throw new Error('权限不足')
    }
    
    return user
  } catch (error) {
    console.error('验证用户权限失败:', error)
    throw error
  }
}

// 工具函数：计算健康统计数据
async function calculateHealthStats(batchIds = null, locationIds = null) {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // 构建查询条件
    let healthQuery = { isDeleted: _.neq(true) }
    let entryQuery = {}
    
    if (batchIds && batchIds.length > 0) {
      healthQuery.batchId = _.in(batchIds)
      entryQuery.batchNumber = _.in(batchIds)
    }
    
    if (locationIds && locationIds.length > 0) {
      healthQuery.locationId = _.in(locationIds)
      entryQuery.location = _.in(locationIds)
    }
    
    // 获取健康记录统计
    const healthRecords = await db.collection('health_records')
      .where(healthQuery)
      .get()
    
    // 获取入栏记录统计
    const entryRecords = await db.collection('entry_records')
      .where(entryQuery)
      .get()
    
    // 计算基础统计
    const totalEntryCount = entryRecords.data.reduce((sum, record) => sum + (record.quantity || 0), 0)
    const abnormalCount = healthRecords.data.filter(r => r.status === 'ongoing').length
    const deathCount = healthRecords.data.filter(r => r.result === 'death').reduce((sum, r) => sum + (r.affectedCount || 1), 0)
    const curedCount = healthRecords.data.filter(r => r.result === 'cured').reduce((sum, r) => sum + (r.affectedCount || 1), 0)
    
    const currentCount = Math.max(0, totalEntryCount - deathCount)
    const survivalRate = totalEntryCount > 0 ? ((currentCount / totalEntryCount) * 100).toFixed(1) : 0
    
    return {
      totalEntryCount,
      currentCount,
      abnormalCount,
      deathCount,
      curedCount,
      survivalRate: parseFloat(survivalRate),
      totalRecords: healthRecords.data.length,
      todayRecords: healthRecords.data.filter(r => new Date(r.recordDate) >= today).length
    }
  } catch (error) {
    console.error('计算健康统计失败:', error)
    throw error
  }
}

// 工具函数：生成健康预警
async function generateHealthAlert(triggerData, openid) {
  try {
    const { alertType, severity, batchId, locationId, actualValue, threshold, message } = triggerData
    
    const alertId = generateAlertId()
    
    const alertRecord = {
      _id: alertId,
      _openid: openid || 'system',
      alertType,
      severity,
      status: 'active',
      trigger: {
        condition: message,
        threshold,
        actualValue,
        batchId,
        locationId
      },
      title: `${locationId || ''}健康异常`,
      message,
      recommendations: getAlertRecommendations(alertType, severity),
      relatedRecords: {
        batchIds: batchId ? [batchId] : [],
        locationIds: locationId ? [locationId] : []
      },
      handling: {
        acknowledgedBy: null,
        acknowledgedTime: null,
        actions: [],
        resolvedTime: null,
        resolvedBy: null,
        resolution: null
      },
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      isDeleted: false
    }
    
    await db.collection('health_alerts').add({
      data: alertRecord
    })
    
    return alertRecord
  } catch (error) {
    console.error('生成健康预警失败:', error)
    throw error
  }
}

// 获取预警建议
function getAlertRecommendations(alertType, severity) {
  const recommendations = {
    mortality: {
      high: ['立即隔离异常个体', '联系专业兽医', '全面消毒环境', '调查死亡原因'],
      medium: ['加强健康监控', '检查环境条件', '预防性治疗'],
      low: ['记录观察', '定期检查']
    },
    abnormal: {
      high: ['立即隔离', '紧急治疗', '扩大监控范围'],
      medium: ['加强观察', '准备治疗方案'],
      low: ['日常监控', '记录症状']
    },
    survival_rate: {
      high: ['紧急干预', '全面检查', '专业诊断'],
      medium: ['分析原因', '调整管理'],
      low: ['持续监控']
    }
  }
  
  return recommendations[alertType]?.[severity] || ['加强监控', '及时处理']
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
      case 'get_abnormal_statistics':
        return await getAbnormalStatistics(event, wxContext)
      case 'ai_diagnosis':
        return await aiDiagnosis(event, wxContext)
      case 'get_diagnosis_history':
        return await getDiagnosisHistory(event, wxContext)
      case 'get_overall_health_stats':
        return await getOverallHealthStats(event, wxContext)
      case 'get_current_abnormal_animals':
        return await getCurrentAbnormalAnimals(event, wxContext)
      case 'get_treatment_records':
        return await getTreatmentRecords(event, wxContext)
      
      // === 新增的健康管理功能 ===
      case 'create_prevention_record':
        return await createPreventionRecord(event, wxContext)
      case 'list_prevention_records':
        return await listPreventionRecords(event, wxContext)
      case 'create_treatment_record':
        return await createTreatmentRecord(event, wxContext)
      case 'list_treatment_records':
        return await listTreatmentRecords(event, wxContext)
      case 'update_treatment_record':
        return await updateTreatmentRecord(event, wxContext)
      case 'create_vaccine_plan':
        return await createVaccinePlan(event, wxContext)
      case 'list_vaccine_plans':
        return await listVaccinePlans(event, wxContext)
      case 'update_vaccine_plan':
        return await updateVaccinePlan(event, wxContext)
      case 'list_health_alerts':
        return await listHealthAlerts(event, wxContext)
      case 'update_health_alert':
        return await updateHealthAlert(event, wxContext)
      case 'get_health_overview':
        return await getHealthOverview(event, wxContext)
      case 'get_prevention_stats':
        return await getPreventionStats(event, wxContext)
      case 'get_treatment_stats':
        return await getTreatmentStats(event, wxContext)
      case 'check_health_alerts':
        return await checkHealthAlerts(event, wxContext)
        
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
// 获取异常个体统计数据
async function getAbnormalStatistics(event, wxContext) {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // 获取所有健康记录进行统计
    const allRecords = await db.collection('health_records')
      .orderBy('createTime', 'desc')
      .get()
    
    // 获取死亡记录
    const deathRecords = await db.collection('death_records')
      .orderBy('createTime', 'desc')
      .get()
    
    // 获取跟进记录（治愈记录）
    const followupRecords = await db.collection('followup_records')
      .where({
        followupType: 'cure'
      })
      .orderBy('createTime', 'desc')
      .get()
    
    // 统计各种疾病
    const diseaseStats = {}
    let totalAbnormal = 0
    
    // 处理健康记录
    allRecords.data.forEach(record => {
      const disease = record.diagnosisDisease || '未确诊'
      const abnormalCount = record.abnormalCount || 0
      
      if (abnormalCount > 0) {
        totalAbnormal += abnormalCount
        
        if (!diseaseStats[disease]) {
          diseaseStats[disease] = {
            name: disease,
            count: 0,
            mortality: 0,
            recovery: 0
          }
        }
        
        diseaseStats[disease].count += abnormalCount
      }
    })
    
    // 处理死亡记录
    deathRecords.data.forEach(record => {
      const disease = record.diagnosisDisease || '未确诊'
      const deathCount = record.deathCount || 0
      
      if (diseaseStats[disease]) {
        diseaseStats[disease].mortality += deathCount
      }
    })
    
    // 处理治愈记录
    followupRecords.data.forEach(record => {
      const disease = record.diagnosisDisease || '未确诊'
      const cureCount = record.cureCount || 0
      
      if (diseaseStats[disease]) {
        diseaseStats[disease].recovery += cureCount
      }
    })
    
    // 转换为数组格式
    const diseases = Object.values(diseaseStats).sort((a, b) => b.count - a.count)
    
    // 计算时间范围统计
    const timeRangeData = [
      {
        label: '今日',
        abnormal: allRecords.data.filter(r => 
          new Date(r.createTime) >= today && (r.abnormalCount || 0) > 0
        ).reduce((sum, r) => sum + (r.abnormalCount || 0), 0),
        mortality: deathRecords.data.filter(r => 
          new Date(r.createTime) >= today
        ).reduce((sum, r) => sum + (r.deathCount || 0), 0),
        recovery: followupRecords.data.filter(r => 
          new Date(r.createTime) >= today && r.followupType === 'cure'
        ).reduce((sum, r) => sum + (r.cureCount || 0), 0)
      },
      {
        label: '本周',
        abnormal: allRecords.data.filter(r => 
          new Date(r.createTime) >= weekAgo && (r.abnormalCount || 0) > 0
        ).reduce((sum, r) => sum + (r.abnormalCount || 0), 0),
        mortality: deathRecords.data.filter(r => 
          new Date(r.createTime) >= weekAgo
        ).reduce((sum, r) => sum + (r.deathCount || 0), 0),
        recovery: followupRecords.data.filter(r => 
          new Date(r.createTime) >= weekAgo && r.followupType === 'cure'
        ).reduce((sum, r) => sum + (r.cureCount || 0), 0)
      },
      {
        label: '本月',
        abnormal: allRecords.data.filter(r => 
          new Date(r.createTime) >= monthStart && (r.abnormalCount || 0) > 0
        ).reduce((sum, r) => sum + (r.abnormalCount || 0), 0),
        mortality: deathRecords.data.filter(r => 
          new Date(r.createTime) >= monthStart
        ).reduce((sum, r) => sum + (r.deathCount || 0), 0),
        recovery: followupRecords.data.filter(r => 
          new Date(r.createTime) >= monthStart && r.followupType === 'cure'
        ).reduce((sum, r) => sum + (r.cureCount || 0), 0)
      }
    ]
    
    return {
      success: true,
      data: {
        diseases,
        totalAbnormal,
        timeRangeData,
        trendData: [] // 趋势数据可以后续扩展
      }
    }
    
  } catch (error) {
    throw error
  }
}

// AI智能诊断功能
async function aiDiagnosis(event, wxContext) {
  const { 
    symptoms = [], 
    environmentData = {}, 
    flockData = {}, 
    images = [], 
    priority = 'balanced' 
  } = event
  
  try {
    // 构建诊断提示词
    const diagnosisPrompt = buildDiagnosisPrompt(symptoms, environmentData, flockData)
    
    // 调用AI多模型服务
    const aiResult = await callAIService({
      action: 'chat_completion',
      messages: [
        {
          role: 'system',
          content: `你是一个专业的鹅类疾病诊断专家，擅长根据症状、环境数据和鹅群信息进行疾病诊断和治疗建议。
          
请按以下JSON格式返回诊断结果：
{
  "diagnosis": {
    "primaryDisease": "主要诊断疾病名称",
    "confidence": 85,
    "differentialDiagnosis": ["鉴别诊断1", "鉴别诊断2"]
  },
  "treatment": {
    "medications": [
      {
        "name": "药物名称",
        "dosage": "用法用量",
        "duration": "使用天数",
        "priority": "high/medium/low"
      }
    ],
    "procedures": ["处理步骤1", "处理步骤2"],
    "monitoring": ["监控要点1", "监控要点2"]
  },
  "prognosis": {
    "expectedRecovery": "预期恢复时间",
    "riskFactors": ["风险因素1", "风险因素2"],
    "preventiveMeasures": ["预防措施1", "预防措施2"]
  }
}`
        },
        {
          role: 'user',
          content: diagnosisPrompt
        }
      ],
      taskType: 'detailed_analysis',
      priority: priority,
      options: {
        temperature: 0.3 // 降低随机性，提高准确性
      }
    })
    
    let diagnosisResult
    
    if (aiResult.success && aiResult.data) {
      try {
        // 解析AI返回的JSON结果
        const aiContent = aiResult.data.content
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
        
        if (jsonMatch) {
          diagnosisResult = JSON.parse(jsonMatch[0])
        } else {
          // 如果无法解析JSON，则使用文本解析
          diagnosisResult = parseTextDiagnosis(aiContent)
        }
        
        // 保存诊断记录
        const diagnosisRecord = {
          _id: generateDiagnosisId(),
          symptoms: symptoms,
          environmentData: environmentData,
          flockData: flockData,
          aiDiagnosis: diagnosisResult,
          aiModel: aiResult.modelId,
          confidence: diagnosisResult.diagnosis?.confidence || 0,
          createTime: new Date(),
          createdBy: wxContext.OPENID || 'anonymous',
          status: 'pending_review' // 待人工审核
        }
        
        await db.collection('ai_diagnosis_records').add({
          data: diagnosisRecord
        })
        
        return {
          success: true,
          data: {
            diagnosis: diagnosisResult,
            recordId: diagnosisRecord._id,
            aiModel: aiResult.modelId,
            timestamp: new Date()
          }
        }
        
      } catch (parseError) {
        console.error('解析AI诊断结果失败:', parseError)
        
        return {
          success: false,
          error: 'AI诊断结果解析失败',
          rawResponse: aiResult.data?.content || '',
          fallback: '建议联系兽医进行人工诊断'
        }
      }
      
    } else {
      // AI服务调用失败，返回静态建议
      return {
        success: false,
        error: aiResult.error || 'AI服务不可用',
        fallback: generateFallbackDiagnosis(symptoms, environmentData)
      }
    }
    
  } catch (error) {
    console.error('AI诊断失败:', error)
    return {
      success: false,
      error: error.message,
      fallback: '系统暂时不可用，请稍后重试或联系兽医'
    }
  }
}

// 构建诊断提示词
function buildDiagnosisPrompt(symptoms, environmentData, flockData) {
  let prompt = '请基于以下信息进行鹅类疾病诊断：\n\n'
  
  // 症状信息
  if (symptoms && symptoms.length > 0) {
    prompt += '**观察到的症状:**\n'
    symptoms.forEach((symptom, index) => {
      prompt += `${index + 1}. ${symptom}\n`
    })
    prompt += '\n'
  }
  
  // 环境信息
  if (environmentData && Object.keys(environmentData).length > 0) {
    prompt += '**环境数据:**\n'
    if (environmentData.temperature) {
      prompt += `- 温度: ${environmentData.temperature}°C\n`
    }
    if (environmentData.humidity) {
      prompt += `- 湿度: ${environmentData.humidity}%\n`
    }
    if (environmentData.ventilation) {
      prompt += `- 通风情况: ${environmentData.ventilation}\n`
    }
    if (environmentData.lighting) {
      prompt += `- 光照条件: ${environmentData.lighting}\n`
    }
    prompt += '\n'
  }
  
  // 鹅群信息
  if (flockData && Object.keys(flockData).length > 0) {
    prompt += '**鹅群基础信息:**\n'
    if (flockData.totalCount) {
      prompt += `- 总数量: ${flockData.totalCount}只\n`
    }
    if (flockData.affectedCount) {
      prompt += `- 患病数量: ${flockData.affectedCount}只\n`
    }
    if (flockData.averageAge) {
      prompt += `- 平均日龄: ${flockData.averageAge}天\n`
    }
    if (flockData.breed) {
      prompt += `- 品种: ${flockData.breed}\n`
    }
    prompt += '\n'
  }
  
  prompt += '请提供详细的诊断分析和治疗建议。'
  
  return prompt
}

// 解析文本格式的诊断结果
function parseTextDiagnosis(content) {
  // 简化的文本解析逻辑
  return {
    diagnosis: {
      primaryDisease: "需要进一步检查",
      confidence: 70,
      differentialDiagnosis: ["请咨询专业兽医"]
    },
    treatment: {
      medications: [],
      procedures: ["隔离观察", "改善环境条件"],
      monitoring: ["密切观察症状变化"]
    },
    prognosis: {
      expectedRecovery: "待确定",
      riskFactors: ["环境因素"],
      preventiveMeasures: ["定期消毒", "保持通风"]
    },
    rawContent: content
  }
}

// 生成静态诊断建议（AI服务不可用时的备用方案）
function generateFallbackDiagnosis(symptoms, environmentData) {
  const commonSuggestions = {
    diagnosis: {
      primaryDisease: "症状分析中",
      confidence: 0,
      differentialDiagnosis: ["建议专业兽医诊断"]
    },
    treatment: {
      medications: [],
      procedures: [
        "立即隔离可疑病鹅",
        "改善饲养环境",
        "加强日常观察"
      ],
      monitoring: [
        "每日观察食欲和精神状态",
        "监测体温变化",
        "记录症状发展情况"
      ]
    },
    prognosis: {
      expectedRecovery: "待专业诊断后确定",
      riskFactors: [
        "环境应激",
        "营养不良",
        "传染性疾病风险"
      ],
      preventiveMeasures: [
        "定期环境消毒",
        "保证饲料质量",
        "维持适宜温湿度",
        "减少应激因素"
      ]
    }
  }
  
  return commonSuggestions
}

// 调用AI多模型服务
async function callAIService(params) {
  try {
    return await cloud.callFunction({
      name: 'ai-multi-model',
      data: params
    }).then(res => res.result)
  } catch (error) {
    console.error('调用AI服务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 生成诊断记录ID
function generateDiagnosisId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `AI${year}${month}${day}${random}`
}

// 获取诊断历史
async function getDiagnosisHistory(event, wxContext) {
  const { limit = 20, offset = 0, status = 'all' } = event
  
  try {
    let query = db.collection('ai_diagnosis_records')
      .where({
        createdBy: wxContext.OPENID
      })
    
    if (status !== 'all') {
      query = query.where({
        status: status
      })
    }
    
    const result = await query
      .orderBy('createTime', 'desc')
      .limit(limit)
      .skip(offset)
      .get()
    
    return {
      success: true,
      data: {
        records: result.data,
        total: result.data.length,
        hasMore: result.data.length === limit
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取当前异常个体数据
async function getCurrentAbnormalAnimals(event, wxContext) {
  try {
    // 获取当前状态为 ongoing 的健康记录（当前患病的个体）
    const ongoingRecords = await db.collection('health_records')
      .where({ result: 'ongoing' })
      .orderBy('createTime', 'desc')
      .get()
    
    // 构建动物列表
    const animals = []
    const diseaseCount = {}
    const locationCount = {}
    
    // 获取批次信息
    for (const record of ongoingRecords.data) {
      // 获取批次信息
      const batchInfo = await db.collection('entry_records')
        .where({ batchNumber: record.batchNumber })
        .limit(1)
        .get()
      
      const batch = batchInfo.data[0]
      const currentAffected = record.currentAffectedCount || record.affectedCount || 0
      
      // 为每个受影响的个体创建记录
      for (let i = 0; i < currentAffected; i++) {
        const animal = {
          id: `${record._id}_${i}`,
          animalId: `${record.batchNumber}_${i + 1}`,
          disease: record.diagnosisDisease || '未确诊',
          priority: record.severity || 'mild',
          location: record.location || '未知位置',
          discoveredTime: formatTimeAgo(record.createTime),
          symptoms: record.symptoms || '',
          treatmentStatus: record.result === 'ongoing' ? 'treating' : 'pending'
        }
        animals.push(animal)
        
        // 统计疾病分布
        const disease = animal.disease
        diseaseCount[disease] = (diseaseCount[disease] || 0) + 1
        
        // 统计位置分布
        const location = animal.location
        if (!locationCount[location]) {
          locationCount[location] = {
            name: location,
            totalCount: batch ? batch.quantity : 100, // 默认值
            abnormalCount: 0,
            diseases: {}
          }
        }
        locationCount[location].abnormalCount++
        locationCount[location].diseases[disease] = (locationCount[location].diseases[disease] || 0) + 1
      }
    }
    
    // 转换为前端期望的格式
    const diseases = Object.entries(diseaseCount).map(([name, count], index) => ({
      name,
      count,
      color: getDiseaseColor(name, index)
    }))
    
    const locations = Object.values(locationCount).map(location => ({
      name: location.name,
      totalCount: location.totalCount,
      abnormalCount: location.abnormalCount,
      diseases: Object.entries(location.diseases).map(([name, count], index) => ({
        name,
        count,
        color: getDiseaseColor(name, index)
      }))
    }))
    
    return {
      success: true,
      data: {
        animals,
        diseases,
        locations
      }
    }
    
  } catch (error) {
    console.error('获取当前异常个体数据失败:', error)
    throw error
  }
}

// 获取治疗记录数据
async function getTreatmentRecords(event, wxContext) {
  try {
    // 获取跟进记录统计
    const followupRecords = await db.collection('followup_records')
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
    
    // 获取健康记录状态统计
    const healthRecords = await db.collection('health_records').get()
    
    // 计算治疗统计
    const treatingCount = healthRecords.data.filter(record => record.result === 'ongoing').length
    const recoveringCount = followupRecords.data.filter(record => record.curedCount > 0).length
    const completedCount = healthRecords.data.filter(record => record.result === 'cured').length
    
    const treatmentStats = {
      treating: treatingCount,
      recovering: recoveringCount,
      completed: completedCount
    }
    
    // 处理治疗记录
    const treatmentRecords = []
    for (const followup of followupRecords.data.slice(0, 20)) {
      // 获取关联的健康记录
      const healthRecord = await db.collection('health_records')
        .doc(followup.healthRecordId)
        .get()
      
      if (healthRecord.data) {
        treatmentRecords.push({
          id: followup._id,
          animalId: followup.batchNumber,
          disease: healthRecord.data.diagnosisDisease || '未确诊',
          treatment: healthRecord.data.treatment || '治疗中',
          date: followup.followupDate,
          result: followup.curedCount > 0 ? '好转' : (followup.deathCount > 0 ? '死亡' : '治疗中'),
          notes: followup.notes || ''
        })
      }
    }
    
    return {
      success: true,
      data: {
        stats: treatmentStats,
        records: treatmentRecords
      }
    }
    
  } catch (error) {
    console.error('获取治疗记录失败:', error)
    throw error
  }
}

// 获取整体健康统计数据
async function getOverallHealthStats(event, wxContext) {
  try {
    // 获取存栏统计
    const stockStats = await getStockStats()
    
    // 获取健康记录统计
    const healthRecords = await db.collection('health_records').get()
    const deathRecords = await db.collection('death_records').get()
    const followupRecords = await db.collection('followup_records').get()
    
    // 计算总数量（当前存栏 + 已出栏 + 已死亡）
    const totalAnimals = stockStats.totalEntry || 0
    
    // 计算死亡率 = 死亡数量 / 总入栏数量 * 100%
    const totalDeaths = deathRecords.data.reduce((sum, record) => sum + (record.deathCount || 0), 0)
    const mortalityRate = totalAnimals > 0 ? ((totalDeaths / totalAnimals) * 100) : 0
    
    // 计算存活率 = (1 - 死亡率)
    const survivalRate = 100 - mortalityRate
    
    // 计算治愈率 = 治愈数量 / 总患病数量 * 100%
    const totalAffected = healthRecords.data.reduce((sum, record) => sum + (record.affectedCount || 0), 0)
    const totalCured = followupRecords.data
      .filter(record => record.curedCount > 0)
      .reduce((sum, record) => sum + (record.curedCount || 0), 0)
    const recoveryRate = totalAffected > 0 ? ((totalCured / totalAffected) * 100) : 0
    
    return {
      success: true,
      data: {
        totalAnimals: totalAnimals,
        survivalRate: Number(survivalRate.toFixed(1)),
        recoveryRate: Number(recoveryRate.toFixed(1)),
        mortalityRate: Number(mortalityRate.toFixed(1))
      }
    }
    
  } catch (error) {
    console.error('获取整体健康统计失败:', error)
    throw error
  }
}

// 辅助函数：格式化时间为相对时间
function formatTimeAgo(dateTime) {
  const now = new Date()
  const time = new Date(dateTime)
  const diffMs = now.getTime() - time.getTime()
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`
  } else if (diffHours < 24) {
    return `${diffHours}小时前`
  } else {
    return `${diffDays}天前`
  }
}

// 辅助函数：根据疾病名称和索引获取颜色
function getDiseaseColor(diseaseName, index) {
  const colors = ['#e34d59', '#ed7b2f', '#0052d9', '#00a870', '#7356f1', '#f59a23']
  
  // 特定疾病的固定颜色
  const diseaseColors = {
    '禽流感': '#e34d59',
    '肠道感染': '#ed7b2f', 
    '呼吸道感染': '#0052d9',
    '营养不良': '#00a870',
    '未确诊': '#666666'
  }
  
  return diseaseColors[diseaseName] || colors[index % colors.length]
}

// === 新增的健康管理功能实现 ===

// 创建预防记录
async function createPreventionRecord(event, wxContext) {
  try {
    const {
      preventionType,
      batchId,
      locationId,
      vaccineRecord,
      disinfectionRecord,
      nutritionRecord,
      inspectionRecord,
      executionDate,
      executionTime,
      operator,
      cost,
      materialUsed,
      effectiveness,
      nextScheduled,
      notes
    } = event

    const recordId = generatePreventionRecordId()

    const preventionRecord = {
      _id: recordId,
      _openid: wxContext.OPENID,
      batchId,
      locationId,
      preventionType,
      vaccineRecord: vaccineRecord || null,
      disinfectionRecord: disinfectionRecord || null,
      nutritionRecord: nutritionRecord || null,
      inspectionRecord: inspectionRecord || null,
      executionDate: executionDate || new Date().toISOString().split('T')[0],
      executionTime: executionTime || new Date().toTimeString().split(' ')[0],
      operator: operator || '系统用户',
      operatorId: wxContext.OPENID,
      cost: cost || 0,
      materialUsed: materialUsed || [],
      effectiveness: effectiveness || 'good',
      nextScheduled: nextScheduled || null,
      notes: notes || '',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      isDeleted: false
    }

    await db.collection('prevention_records').add({
      data: preventionRecord
    })

    return {
      success: true,
      data: { recordId },
      message: '预防记录创建成功'
    }
  } catch (error) {
    console.error('创建预防记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '创建预防记录失败'
    }
  }
}

// 查询预防记录列表
async function listPreventionRecords(event, wxContext) {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      preventionType, 
      batchId, 
      locationId,
      dateRange 
    } = event

    let query = db.collection('prevention_records')
      .where({ isDeleted: _.neq(true) })

    if (preventionType) {
      query = query.where({ preventionType })
    }
    if (batchId) {
      query = query.where({ batchId })
    }
    if (locationId) {
      query = query.where({ locationId })
    }
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        executionDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const result = await query
      .orderBy('executionDate', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const total = await query.count()

    return {
      success: true,
      data: {
        records: result.data,
        pagination: {
          page,
          pageSize,
          total: total.total,
          totalPages: Math.ceil(total.total / pageSize)
        }
      }
    }
  } catch (error) {
    console.error('查询预防记录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 创建治疗记录
async function createTreatmentRecord(event, wxContext) {
  try {
    const {
      healthRecordId,
      batchId,
      animalIds,
      treatmentDate,
      treatmentType,
      diagnosis,
      veterinarianId,
      veterinarianName,
      treatmentPlan,
      medications,
      progress,
      outcome,
      cost,
      materialsUsed
    } = event

    const recordId = generateTreatmentRecordId()

    const treatmentRecord = {
      _id: recordId,
      _openid: wxContext.OPENID,
      healthRecordId,
      batchId,
      animalIds: animalIds || [],
      treatmentDate: treatmentDate || new Date().toISOString().split('T')[0],
      treatmentType: treatmentType || 'medication',
      diagnosis: {
        preliminary: diagnosis?.preliminary || '',
        confirmed: diagnosis?.confirmed || '',
        confidence: diagnosis?.confidence || 0,
        diagnosisMethod: diagnosis?.diagnosisMethod || 'manual',
        veterinarianId: veterinarianId || null
      },
      veterinarianId: veterinarianId || null,
      veterinarianName: veterinarianName || '未指定',
      treatmentPlan: treatmentPlan || {},
      medications: medications || [],
      progress: progress || [],
      outcome: outcome || {
        status: 'ongoing',
        curedCount: 0,
        improvedCount: 0,
        deathCount: 0,
        totalTreated: animalIds?.length || 0
      },
      cost: cost || {
        medication: 0,
        veterinary: 0,
        supportive: 0,
        total: 0
      },
      materialsUsed: materialsUsed || [],
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      isDeleted: false
    }

    await db.collection('treatment_records').add({
      data: treatmentRecord
    })

    return {
      success: true,
      data: { recordId },
      message: '治疗记录创建成功'
    }
  } catch (error) {
    console.error('创建治疗记录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 更新治疗记录
async function updateTreatmentRecord(event, wxContext) {
  try {
    const { recordId, progress, outcome, cost, updateData } = event

    const updateFields = {
      updateTime: new Date().toISOString()
    }

    if (progress) {
      updateFields.progress = _.push(progress)
    }
    if (outcome) {
      updateFields.outcome = outcome
    }
    if (cost) {
      updateFields.cost = cost
    }
    if (updateData) {
      Object.assign(updateFields, updateData)
    }

    await db.collection('treatment_records')
      .doc(recordId)
      .update({
        data: updateFields
      })

    return {
      success: true,
      message: '治疗记录更新成功'
    }
  } catch (error) {
    console.error('更新治疗记录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 查询治疗记录列表
async function listTreatmentRecords(event, wxContext) {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      status, 
      batchId,
      veterinarianId,
      dateRange 
    } = event

    let query = db.collection('treatment_records')
      .where({ isDeleted: _.neq(true) })

    if (status) {
      query = query.where({ 'outcome.status': status })
    }
    if (batchId) {
      query = query.where({ batchId })
    }
    if (veterinarianId) {
      query = query.where({ veterinarianId })
    }
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        treatmentDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const result = await query
      .orderBy('treatmentDate', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const total = await query.count()

    return {
      success: true,
      data: {
        records: result.data,
        pagination: {
          page,
          pageSize,
          total: total.total,
          totalPages: Math.ceil(total.total / pageSize)
        }
      }
    }
  } catch (error) {
    console.error('查询治疗记录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 创建疫苗计划
async function createVaccinePlan(event, wxContext) {
  try {
    const {
      planName,
      planType,
      vaccine,
      schedule,
      targetBatches,
      materialRequirements,
      reminders
    } = event

    const planId = `VP${Date.now()}`

    const vaccinePlan = {
      _id: planId,
      _openid: wxContext.OPENID,
      planName: planName || '疫苗接种计划',
      planType: planType || 'routine',
      status: 'active',
      vaccine: vaccine || {},
      schedule: schedule || {},
      targetBatches: targetBatches || [],
      materialRequirements: materialRequirements || [],
      execution: [],
      effectiveness: {},
      reminders: reminders || [],
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      createdBy: wxContext.OPENID,
      isDeleted: false
    }

    await db.collection('vaccine_plans').add({
      data: vaccinePlan
    })

    return {
      success: true,
      data: { planId },
      message: '疫苗计划创建成功'
    }
  } catch (error) {
    console.error('创建疫苗计划失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 查询疫苗计划列表
async function listVaccinePlans(event, wxContext) {
  try {
    const { page = 1, pageSize = 20, status, planType } = event

    let query = db.collection('vaccine_plans')
      .where({ isDeleted: _.neq(true) })

    if (status) {
      query = query.where({ status })
    }
    if (planType) {
      query = query.where({ planType })
    }

    const result = await query
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return {
      success: true,
      data: {
        plans: result.data,
        total: result.data.length
      }
    }
  } catch (error) {
    console.error('查询疫苗计划失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 更新疫苗计划
async function updateVaccinePlan(event, wxContext) {
  try {
    const { planId, updateData, executionRecord } = event

    const updateFields = {
      updateTime: new Date().toISOString()
    }

    if (updateData) {
      Object.assign(updateFields, updateData)
    }

    if (executionRecord) {
      updateFields.execution = _.push(executionRecord)
    }

    await db.collection('vaccine_plans')
      .doc(planId)
      .update({
        data: updateFields
      })

    return {
      success: true,
      message: '疫苗计划更新成功'
    }
  } catch (error) {
    console.error('更新疫苗计划失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 查询健康预警列表
async function listHealthAlerts(event, wxContext) {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      status, 
      severity, 
      alertType,
      batchId
    } = event

    let query = db.collection('health_alerts')
      .where({ isDeleted: _.neq(true) })

    if (status) {
      query = query.where({ status })
    }
    if (severity) {
      query = query.where({ severity })
    }
    if (alertType) {
      query = query.where({ alertType })
    }
    if (batchId) {
      query = query.where({ 'relatedRecords.batchIds': _.in([batchId]) })
    }

    const result = await query
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const total = await query.count()

    return {
      success: true,
      data: {
        alerts: result.data,
        pagination: {
          page,
          pageSize,
          total: total.total,
          totalPages: Math.ceil(total.total / pageSize)
        }
      }
    }
  } catch (error) {
    console.error('查询健康预警失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 更新健康预警状态
async function updateHealthAlert(event, wxContext) {
  try {
    const { alertId, action, data } = event

    const updateFields = {
      updateTime: new Date().toISOString()
    }

    switch (action) {
      case 'acknowledge':
        updateFields['handling.acknowledgedBy'] = data.acknowledgedBy || wxContext.OPENID
        updateFields['handling.acknowledgedTime'] = new Date().toISOString()
        if (data.actions) {
          updateFields['handling.actions'] = data.actions
        }
        break
      case 'resolve':
        updateFields.status = 'resolved'
        updateFields['handling.resolvedBy'] = data.resolvedBy || wxContext.OPENID
        updateFields['handling.resolvedTime'] = new Date().toISOString()
        updateFields['handling.resolution'] = data.resolution || ''
        break
      case 'ignore':
        updateFields.status = 'ignored'
        break
      default:
        throw new Error('无效的操作类型')
    }

    await db.collection('health_alerts')
      .doc(alertId)
      .update({
        data: updateFields
      })

    return {
      success: true,
      message: '预警状态更新成功'
    }
  } catch (error) {
    console.error('更新健康预警失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取健康概览数据
async function getHealthOverview(event, wxContext) {
  try {
    const { batchIds, locationIds } = event

    // 计算健康统计
    const healthStats = await calculateHealthStats(batchIds, locationIds)

    // 获取活跃预警
    const activeAlerts = await db.collection('health_alerts')
      .where({
        status: 'active',
        isDeleted: _.neq(true)
      })
      .orderBy('createTime', 'desc')
      .limit(5)
      .get()

    // 获取最近的预防记录
    const recentPrevention = await db.collection('prevention_records')
      .where({ isDeleted: _.neq(true) })
      .orderBy('executionDate', 'desc')
      .limit(5)
      .get()

    // 获取进行中的治疗
    const ongoingTreatments = await db.collection('treatment_records')
      .where({
        'outcome.status': 'ongoing',
        isDeleted: _.neq(true)
      })
      .orderBy('treatmentDate', 'desc')
      .limit(5)
      .get()

    return {
      success: true,
      data: {
        healthStats,
        activeAlerts: activeAlerts.data,
        recentPrevention: recentPrevention.data,
        ongoingTreatments: ongoingTreatments.data,
        summary: {
          totalAlerts: activeAlerts.data.length,
          criticalAlerts: activeAlerts.data.filter(alert => alert.severity === 'critical').length,
          recentPreventionCount: recentPrevention.data.length,
          ongoingTreatmentCount: ongoingTreatments.data.length
        }
      }
    }
  } catch (error) {
    console.error('获取健康概览失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取预防统计数据
async function getPreventionStats(event, wxContext) {
  try {
    const { dateRange, preventionType } = event

    let query = db.collection('prevention_records')
      .where({ isDeleted: _.neq(true) })

    if (preventionType) {
      query = query.where({ preventionType })
    }
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        executionDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const records = await query.get()

    // 统计各类预防措施
    const preventionTypeStats = {}
    const effectivenessStats = {}
    const costStats = {
      total: 0,
      byType: {}
    }

    records.data.forEach(record => {
      const type = record.preventionType
      preventionTypeStats[type] = (preventionTypeStats[type] || 0) + 1

      const effectiveness = record.effectiveness || 'unknown'
      effectivenessStats[effectiveness] = (effectivenessStats[effectiveness] || 0) + 1

      const cost = record.cost || 0
      costStats.total += cost
      costStats.byType[type] = (costStats.byType[type] || 0) + cost
    })

    return {
      success: true,
      data: {
        totalRecords: records.data.length,
        preventionTypeStats,
        effectivenessStats,
        costStats,
        records: records.data.slice(0, 20) // 返回最近20条记录
      }
    }
  } catch (error) {
    console.error('获取预防统计失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取治疗统计数据
async function getTreatmentStats(event, wxContext) {
  try {
    const { dateRange, status } = event

    let query = db.collection('treatment_records')
      .where({ isDeleted: _.neq(true) })

    if (status) {
      query = query.where({ 'outcome.status': status })
    }
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        treatmentDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const records = await query.get()

    // 统计治疗结果
    const outcomeStats = {}
    const treatmentTypeStats = {}
    const costStats = {
      total: 0,
      medication: 0,
      veterinary: 0,
      supportive: 0
    }

    let totalTreated = 0
    let totalCured = 0

    records.data.forEach(record => {
      const status = record.outcome?.status || 'unknown'
      outcomeStats[status] = (outcomeStats[status] || 0) + 1

      const type = record.treatmentType || 'unknown'
      treatmentTypeStats[type] = (treatmentTypeStats[type] || 0) + 1

      if (record.cost) {
        costStats.total += record.cost.total || 0
        costStats.medication += record.cost.medication || 0
        costStats.veterinary += record.cost.veterinary || 0
        costStats.supportive += record.cost.supportive || 0
      }

      totalTreated += record.outcome?.totalTreated || 0
      totalCured += record.outcome?.curedCount || 0
    })

    const cureRate = totalTreated > 0 ? ((totalCured / totalTreated) * 100).toFixed(1) : 0

    return {
      success: true,
      data: {
        totalRecords: records.data.length,
        outcomeStats,
        treatmentTypeStats,
        costStats,
        cureRate: parseFloat(cureRate),
        totalTreated,
        totalCured,
        records: records.data.slice(0, 20)
      }
    }
  } catch (error) {
    console.error('获取治疗统计失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 检查并生成健康预警
async function checkHealthAlerts(event, wxContext) {
  try {
    const alerts = []

    // 获取所有活跃批次的健康数据
    const entryRecords = await db.collection('entry_records').get()
    
    for (const entry of entryRecords.data) {
      const batchId = entry.batchNumber
      const locationId = entry.location

      // 计算该批次的健康统计
      const stats = await calculateHealthStats([batchId], [locationId])

      // 检查死亡率预警
      const mortalityRate = stats.totalEntryCount > 0 ? 
        ((stats.deathCount / stats.totalEntryCount) * 100) : 0

      if (mortalityRate > 3) {
        const alertData = {
          alertType: 'mortality',
          severity: mortalityRate > 10 ? 'critical' : (mortalityRate > 5 ? 'high' : 'medium'),
          batchId,
          locationId,
          actualValue: mortalityRate,
          threshold: 3,
          message: `批次${batchId}死亡率${mortalityRate.toFixed(1)}%，超过预警阈值3%`
        }
        
        const alert = await generateHealthAlert(alertData, wxContext.OPENID)
        alerts.push(alert)
      }

      // 检查存活率预警
      if (stats.survivalRate < 95) {
        const alertData = {
          alertType: 'survival_rate',
          severity: stats.survivalRate < 90 ? 'critical' : (stats.survivalRate < 93 ? 'high' : 'medium'),
          batchId,
          locationId,
          actualValue: stats.survivalRate,
          threshold: 95,
          message: `批次${batchId}存活率${stats.survivalRate}%，低于预警阈值95%`
        }
        
        const alert = await generateHealthAlert(alertData, wxContext.OPENID)
        alerts.push(alert)
      }

      // 检查异常个体数量预警
      if (stats.abnormalCount > 5) {
        const alertData = {
          alertType: 'abnormal',
          severity: stats.abnormalCount > 20 ? 'critical' : (stats.abnormalCount > 10 ? 'high' : 'medium'),
          batchId,
          locationId,
          actualValue: stats.abnormalCount,
          threshold: 5,
          message: `批次${batchId}异常个体${stats.abnormalCount}只，超过预警阈值5只`
        }
        
        const alert = await generateHealthAlert(alertData, wxContext.OPENID)
        alerts.push(alert)
      }
    }

    return {
      success: true,
      data: {
        generatedAlerts: alerts.length,
        alerts: alerts
      },
      message: `检查完成，生成${alerts.length}条预警`
    }
  } catch (error) {
    console.error('检查健康预警失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

module.exports = {
  // 原有导出的函数
  getAbnormalStatistics,
  aiDiagnosis,
  getDiagnosisHistory,
  getOverallHealthStats,
  getCurrentAbnormalAnimals,
  getTreatmentRecords,
  
  // 新增的函数导出
  createPreventionRecord,
  listPreventionRecords,
  createTreatmentRecord,
  listTreatmentRecords,
  updateTreatmentRecord,
  createVaccinePlan,
  listVaccinePlans,
  updateVaccinePlan,
  listHealthAlerts,
  updateHealthAlert,
  getHealthOverview,
  getPreventionStats,
  getTreatmentStats,
  checkHealthAlerts,
  
  // 工具函数导出
  calculateHealthStats,
  generateHealthAlert,
  validateUserRole
}
