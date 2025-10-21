// health-management/index.js - 健康管理云函数（优化版）
const cloud = require('wx-server-sdk')
const DatabaseManager = require('./database-manager')
const { COLLECTIONS } = require('./collections')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const dbManager = new DatabaseManager(db)

// 生成记录ID
function generateRecordId(prefix) {
  const now = new Date()
  const timestamp = now.getTime().toString().slice(-8)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}${timestamp}${random}`
}

// 创建预防记录（优化版）
async function createPreventionRecord(event, wxContext) {
  try {
    const {
      preventionType,
      batchId,
      vaccineInfo,
      veterinarianInfo,
      costInfo,
      notes
    } = event
    const openid = wxContext.OPENID

    const recordData = {
      batchId,
      preventionType,
      preventionDate: new Date().toISOString().split('T')[0],
      vaccineInfo: vaccineInfo || null,
      veterinarianInfo: veterinarianInfo || null,
      costInfo: costInfo || null,
      effectiveness: 'pending',
      notes: notes || '',
      operator: openid
    }

    const result = await dbManager.createPreventionRecord(recordData)

    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_prevention_record',
      COLLECTIONS.HEALTH_PREVENTION_RECORDS,
      result._id,
      {
        batchId,
        preventionType,
        cost: costInfo?.totalCost || 0,
        result: 'success'
      }
    )

    return {
      success: true,
      data: { recordId: result._id },
      message: '预防记录创建成功'
    }

  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: '创建预防记录失败'
    }
  }
}

// 查询预防记录列表（优化版）
async function listPreventionRecords(event, wxContext) {
  try {
    const params = {
      page: event.page || 1,
      pageSize: event.pageSize || 20,
      preventionType: event.preventionType,
      batchId: event.batchId,
      dateRange: event.dateRange
    }

    const result = await dbManager.listPreventionRecords(params)

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

// 创建健康记录（优化版）
async function createHealthRecord(event, wxContext) {
  try {
    const {
      batchId,
      recordType,
      totalCount,
      healthyCount,
      sickCount,
      deadCount,
      symptoms,
      diagnosis,
      treatment,
      notes
    } = event
    const openid = wxContext.OPENID

    const recordData = {
      batchId,
      recordType: recordType || 'routine_check',
      checkDate: new Date().toISOString().split('T')[0],
      inspector: openid,
      totalCount: totalCount || 0,
      healthyCount: healthyCount || 0,
      sickCount: sickCount || 0,
      deadCount: deadCount || 0,
      symptoms: symptoms || [],
      diagnosis: diagnosis || '',
      treatment: treatment || '',
      notes: notes || '',
      followUpRequired: sickCount > 0,
      followUpDate: sickCount > 0 ? 
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
      severity: calculateSeverity(sickCount, deadCount, totalCount)
    }

    const result = await dbManager.createHealthRecord(recordData)

    // 如果有死亡情况，创建死亡记录
    if (deadCount > 0) {
      await createDeathRecord({
        batchId,
        healthRecordId: result._id,
        deadCount,
        symptoms,
        diagnosis,
        notes
      }, wxContext)
    }

    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_health_record',
      COLLECTIONS.HEALTH_RECORDS,
      result._id,
      {
        batchId,
        recordType,
        sickCount,
        deadCount,
        severity: recordData.severity,
        result: 'success'
      }
    )

    return {
      success: true,
      data: { recordId: result._id },
      message: '健康记录创建成功'
    }

  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: '创建健康记录失败'
    }
  }
}

// 创建死亡记录
async function createDeathRecord(data, wxContext) {
  try {
    const recordData = {
      batchId: data.batchId,
      healthRecordId: data.healthRecordId,
      deathDate: new Date().toISOString().split('T')[0],
      deadCount: data.deadCount,
      cause: data.diagnosis || '待确定',
      symptoms: data.symptoms || [],
      notes: data.notes || '',
      reportedBy: wxContext.OPENID,
      isDeleted: false
    }

    return await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
      data: recordData
    })

  } catch (error) {
    // 已移除调试日志
    throw error
  }
}

// 创建治疗记录（优化版）
async function createTreatmentRecord(event, wxContext) {
  try {
    const {
      batchId,
      healthRecordId,
      treatmentType,
      diagnosis,
      medications,
      treatmentPlan,
      veterinarian,
      affectedCount,
      treatmentCost,
      notes
    } = event
    const openid = wxContext.OPENID

    const recordData = {
      batchId,
      healthRecordId,
      treatmentType: treatmentType || 'medication',
      treatmentDate: new Date().toISOString().split('T')[0],
      diagnosis: diagnosis || '',
      medications: medications || [],
      treatmentPlan: treatmentPlan || '',
      veterinarian: veterinarian || '',
      affectedCount: affectedCount || 0,
      treatmentCost: treatmentCost || 0,
      outcome: 'ongoing',
      notes: notes || '',
      createdBy: openid
    }

    const result = await dbManager.createTreatmentRecord(recordData)

    // 如果有治疗费用，创建成本记录
    if (treatmentCost > 0) {
      await dbManager.createCostRecord({
        costType: 'medical',
        subCategory: 'treatment',
        title: `治疗费用 - ${diagnosis}`,
        description: `批次：${batchId}，治疗数量：${affectedCount}只`,
        amount: treatmentCost,
        batchId,
        relatedRecords: [{
          type: 'treatment',
          recordId: result._id
        }],
        costDate: new Date().toISOString().split('T')[0],
        createdBy: openid
      })
    }

    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_treatment_record',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      result._id,
      {
        batchId,
        treatmentType,
        affectedCount,
        cost: treatmentCost,
        result: 'success'
      }
    )

    return {
      success: true,
      data: { recordId: result._id },
      message: '治疗记录创建成功'
    }

  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: '创建治疗记录失败'
    }
  }
}

// 创建AI诊断记录（优化版）
async function createAiDiagnosisRecord(event, wxContext) {
  try {
    const {
      batchId,
      healthRecordId,
      symptoms,
      images,
      aiDiagnosis,
      humanVerification
    } = event
    const openid = wxContext.OPENID

    const recordData = {
      batchId,
      healthRecordId,
      symptoms: symptoms || [],
      images: images || [],
      aiModel: 'poultry_health_v2.1',
      diagnosis: aiDiagnosis,
      humanVerification: humanVerification || null,
      createdBy: openid
    }

    const result = await dbManager.createAiDiagnosisRecord(recordData)

    // 记录AI使用统计
    await updateAiUsageStats('diagnosis', openid)

    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_ai_diagnosis',
      COLLECTIONS.HEALTH_AI_DIAGNOSIS,
      result._id,
      {
        batchId,
        symptomsCount: symptoms?.length || 0,
        imagesCount: images?.length || 0,
        confidence: aiDiagnosis?.confidence || 0,
        result: 'success'
      }
    )

    return {
      success: true,
      data: { recordId: result._id },
      message: 'AI诊断记录创建成功'
    }

  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: '创建AI诊断记录失败'
    }
  }
}

// 获取健康概览（优化版）
async function getHealthOverview(event, wxContext) {
  try {
    const { batchId, dateRange } = event
    
    // 获取健康记录统计
    const healthStats = await getHealthStatistics(batchId, dateRange)
    
    // 获取最近的预防记录
    const recentPrevention = await dbManager.listPreventionRecords({
      batchId,
      pageSize: 5
    })
    
    // 获取活跃的健康警报
    const activeAlerts = await getActiveHealthAlerts(batchId)
    
    // 获取治疗统计
    const treatmentStats = await getTreatmentStatistics(batchId, dateRange)

    return {
      success: true,
      data: {
        healthStats,
        recentPrevention: recentPrevention.records,
        activeAlerts,
        treatmentStats
      }
    }

  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取健康统计数据
async function getHealthStatistics(batchId, dateRange) {
  try {
    let query = db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({ batchId, isDeleted: _.neq(true) })

    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        checkDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const records = await query.get()
    
    const totalChecks = records.data.length
    const totalHealthy = records.data.reduce((sum, r) => sum + (r.healthyCount || 0), 0)
    const totalSick = records.data.reduce((sum, r) => sum + (r.sickCount || 0), 0)
    const totalDead = records.data.reduce((sum, r) => sum + (r.deadCount || 0), 0)
    const totalAnimals = totalHealthy + totalSick

    return {
      totalChecks,
      totalAnimals,
      healthyCount: totalHealthy,
      sickCount: totalSick,
      deadCount: totalDead,
      healthyRate: totalAnimals > 0 ? ((totalHealthy / totalAnimals) * 100).toFixed(1) : 0,
      mortalityRate: totalAnimals > 0 ? ((totalDead / totalAnimals) * 100).toFixed(2) : 0
    }

  } catch (error) {
    // 已移除调试日志
    return {}
  }
}

// 获取活跃的健康警报
async function getActiveHealthAlerts(batchId) {
  try {
    const result = await db.collection(COLLECTIONS.HEALTH_ALERTS)
      .where({
        batchId,
        status: 'active',
        isDeleted: _.neq(true)
      })
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()

    return result.data

  } catch (error) {
    // 已移除调试日志
    return []
  }
}

// 获取治疗统计
async function getTreatmentStatistics(batchId, dateRange) {
  try {
    let query = db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({ batchId, isDeleted: _.neq(true) })

    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        treatmentDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const records = await query.get()
    
    const totalTreatments = records.data.length
    const totalCost = records.data.reduce((sum, r) => sum + (r.treatmentCost || 0), 0)
    const recoveredCount = records.data.filter(r => r.outcome === 'recovered').length
    const ongoingCount = records.data.filter(r => r.outcome === 'ongoing').length

    return {
      totalTreatments,
      totalCost,
      recoveredCount,
      ongoingCount,
      recoveryRate: totalTreatments > 0 ? ((recoveredCount / totalTreatments) * 100).toFixed(1) : 0
    }

  } catch (error) {
    // 已移除调试日志
    return {}
  }
}

// 更新AI使用统计
async function updateAiUsageStats(usageType, userId) {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // 查找今日的使用记录
    const existingResult = await db.collection(COLLECTIONS.SYS_AI_USAGE)
      .where({
        userId,
        usageType,
        date: today
      })
      .limit(1)
      .get()

    if (existingResult.data.length > 0) {
      // 更新现有记录
      await db.collection(COLLECTIONS.SYS_AI_USAGE)
        .doc(existingResult.data[0]._id)
        .update({
          data: {
            count: _.inc(1),
            lastUsed: new Date()
          }
        })
    } else {
      // 创建新记录
      await db.collection(COLLECTIONS.SYS_AI_USAGE).add({
        data: {
          userId,
          usageType,
          date: today,
          count: 1,
          lastUsed: new Date(),
          createdAt: new Date()
        }
      })
    }

  } catch (error) {
    // 已移除调试日志
  }
}

// 计算严重程度
function calculateSeverity(sickCount, deadCount, totalCount) {
  if (totalCount === 0) return 'low'
  
  const sickRate = (sickCount / totalCount) * 100
  const deathRate = (deadCount / totalCount) * 100
  
  if (deathRate > 5 || sickRate > 20) return 'critical'
  if (deathRate > 2 || sickRate > 10) return 'high'
  if (deathRate > 0.5 || sickRate > 5) return 'medium'
  return 'low'
}

// 获取所有批次健康汇总
async function getAllBatchesHealthSummary(event, wxContext) {
  try {
    // 获取该用户的所有入栏批次
    const allBatchesResult = await db.collection('prod_batch_entries')
      .where({
        userId: wxContext.OPENID
      })
      .orderBy('createTime', 'desc')
      .get()
    
    // 获取所有出栏记录
    const exitRecordsResult = await db.collection('prod_batch_exits')
      .where({
        userId: wxContext.OPENID
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
    
    // 已移除调试日志
    
    // 筛选存栏批次（排除完全出栏和已删除的）
    const batches = allBatchesResult.data.filter(record => {
      const isNotDeleted = record.isDeleted !== true
      const totalExited = exitQuantityMap[record.batchNumber] || 0
      const isNotFullyExited = totalExited < (record.quantity || 0)
      
      // 已移除调试日志
      
      return isNotDeleted && isNotFullyExited
    })
    
    if (batches.length === 0) {
      return {
        success: true,
        data: {
          batches: [],
          totalBatches: 0
        }
      }
    }
    
    // 为每个批次获取健康汇总
    const batchHealthSummaries = []
    
    for (const batch of batches) {
      try {
        // 计算日龄
        const entryDate = new Date(batch.entryDate)
        const today = new Date()
        const dayAge = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        
        // 获取该批次最近的健康记录
        const recentHealthResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
          .where({
            batchId: batch._id,
            isDeleted: _.neq(true)
          })
          .orderBy('checkDate', 'desc')
          .limit(5)
          .get()
        
        const healthRecords = recentHealthResult.data
        
        // 计算健康指标
        let totalCount = batch.quantity || 0
        let healthyCount = 0
        let sickCount = 0
        let healthyRate = 100
        let lastCheckDate = null
        let recentIssues = []
        
        if (healthRecords.length > 0) {
          const latestRecord = healthRecords[0]
          healthyCount = latestRecord.healthyCount || 0
          sickCount = latestRecord.sickCount || 0
          totalCount = latestRecord.totalCount || totalCount
          healthyRate = totalCount > 0 ? ((healthyCount / totalCount) * 100) : 100
          lastCheckDate = latestRecord.checkDate
          
          // 收集近期问题
          healthRecords.forEach(record => {
            if (record.symptoms && record.symptoms.length > 0) {
              recentIssues.push(...record.symptoms)
            }
            if (record.diagnosis && record.diagnosis.includes('异常')) {
              recentIssues.push(record.diagnosis)
            }
          })
          recentIssues = [...new Set(recentIssues)].slice(0, 3)
        }
        
        // 确定预警级别
        let alertLevel = 'normal'
        if (healthyRate < 80 || sickCount > totalCount * 0.2) {
          alertLevel = 'danger'
        } else if (healthyRate < 90 || sickCount > totalCount * 0.1) {
          alertLevel = 'warning'
        }
        
        batchHealthSummaries.push({
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          breed: batch.breed || '未知品种',
          dayAge,
          healthyRate: parseFloat(healthyRate.toFixed(1)),
          totalCount,
          healthyCount,
          sickCount,
          recentIssues,
          alertLevel,
          lastCheckDate: lastCheckDate || '未检查',
          entryDate: batch.entryDate
        })
      } catch (batchError) {
        // 已移除调试日志
      }
    }
    
    // 按预警级别和健康率排序
    batchHealthSummaries.sort((a, b) => {
      const alertPriority = { danger: 0, warning: 1, normal: 2 }
      const priorityDiff = alertPriority[a.alertLevel] - alertPriority[b.alertLevel]
      if (priorityDiff !== 0) return priorityDiff
      return a.healthyRate - b.healthyRate
    })
    
    return {
      success: true,
      data: {
        batches: batchHealthSummaries,
        totalBatches: batchHealthSummaries.length
      }
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: '获取批次健康汇总失败'
    }
  }
}

// 获取首页健康概览
async function getHomepageHealthOverview(event, wxContext) {
  try {
    // 获取所有批次健康汇总
    const summaryResult = await getAllBatchesHealthSummary(event, wxContext)
    
    if (!summaryResult.success) {
      throw new Error(summaryResult.error)
    }
    
    const batches = summaryResult.data.batches
    
    if (batches.length === 0) {
      return {
        success: true,
        data: {
          overallHealthRate: 100,
          totalBatches: 0,
          alertBatches: 0,
          pendingHealthTasks: 0,
          criticalIssues: []
        }
      }
    }
    
    // 计算整体健康率
    const totalAnimals = batches.reduce((sum, b) => sum + b.totalCount, 0)
    const totalHealthy = batches.reduce((sum, b) => sum + b.healthyCount, 0)
    const overallHealthRate = totalAnimals > 0 ? ((totalHealthy / totalAnimals) * 100) : 100
    
    // 统计预警批次
    const alertBatches = batches.filter(b => b.alertLevel === 'danger' || b.alertLevel === 'warning').length
    
    // 获取待办健康任务数（疫苗、用药、检查等类型）
    const healthTaskTypes = ['vaccine', 'medication', 'health_check', 'inspection', 'disinfection']
    const taskResult = await db.collection('task_batch_schedules')
      .where({
        userId: wxContext.OPENID,
        type: _.in(healthTaskTypes),
        status: 'pending',
        isCompleted: false
      })
      .count()
    
    const pendingHealthTasks = taskResult.total || 0
    
    // 收集紧急问题
    const criticalIssues = []
    batches.forEach(batch => {
      if (batch.alertLevel === 'danger') {
        criticalIssues.push(`${batch.batchNumber}: 健康率${batch.healthyRate}%`)
      }
      if (batch.recentIssues.length > 0 && batch.alertLevel !== 'normal') {
        batch.recentIssues.forEach(issue => {
          if (!criticalIssues.includes(issue)) {
            criticalIssues.push(issue)
          }
        })
      }
    })
    
    return {
      success: true,
      data: {
        overallHealthRate: parseFloat(overallHealthRate.toFixed(1)),
        totalBatches: batches.length,
        alertBatches,
        pendingHealthTasks,
        criticalIssues: criticalIssues.slice(0, 5),
        batchSummaries: batches.slice(0, 3) // 返回前3个需要关注的批次
      }
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: '获取首页健康概览失败'
    }
  }
}

// 主函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'create_prevention_record':
        return await createPreventionRecord(event, wxContext)
      
      case 'list_prevention_records':
        return await listPreventionRecords(event, wxContext)
      
      case 'create_health_record':
        return await createHealthRecord(event, wxContext)
      
      case 'create_treatment_record':
        return await createTreatmentRecord(event, wxContext)
      
      case 'create_ai_diagnosis':
        return await createAiDiagnosisRecord(event, wxContext)
      
      case 'get_health_overview':
        return await getHealthOverview(event, wxContext)
      
      case 'get_all_batches_health_summary':
        return await getAllBatchesHealthSummary(event, wxContext)
      
      case 'get_homepage_health_overview':
        return await getHomepageHealthOverview(event, wxContext)
      
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
