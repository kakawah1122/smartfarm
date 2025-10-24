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
    // 获取批次信息
    const batchResult = await db.collection('prod_batch_entries')
      .doc(batchId)
      .get()
    
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }
    
    const batch = batchResult.data
    const originalQuantity = batch.quantity || 0
    
    // 查询健康记录
    let query = db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({ batchId, isDeleted: _.neq(true) })

    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        checkDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const records = await query.orderBy('checkDate', 'desc').get()
    
    const totalChecks = records.data.length
    let totalAnimals = originalQuantity
    let healthyCount = 0
    let sickCount = 0
    let deadCount = 0
    let healthyRate = 0
    let mortalityRate = 0
    
    if (records.data.length > 0) {
      // 有健康记录，使用最新的记录
      const latestRecord = records.data[0]
      healthyCount = latestRecord.healthyCount || 0
      sickCount = latestRecord.sickCount || 0
      deadCount = latestRecord.deadCount || 0
      totalAnimals = latestRecord.totalCount || originalQuantity
      
      healthyRate = totalAnimals > 0 ? ((healthyCount / totalAnimals) * 100).toFixed(1) : 0
      mortalityRate = originalQuantity > 0 ? ((deadCount / originalQuantity) * 100).toFixed(2) : 0
    } else {
      // 没有健康记录，默认都是健康的
      healthyCount = totalAnimals
      sickCount = 0
      deadCount = 0
      healthyRate = 100
      mortalityRate = 0
    }

    return {
      totalChecks,
      totalAnimals,
      healthyCount,
      sickCount,
      deadCount,
      healthyRate,
      mortalityRate
    }

  } catch (error) {
    // 已移除调试日志
    return {
      totalChecks: 0,
      totalAnimals: 0,
      healthyCount: 0,
      sickCount: 0,
      deadCount: 0,
      healthyRate: 0,
      mortalityRate: 0
    }
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
        let originalQuantity = batch.quantity || 0  // 原始入栏数
        let totalCount = originalQuantity           // 当前存栏数
        let healthyCount = 0
        let sickCount = 0
        let deadCount = 0
        let healthyRate = 100
        let lastCheckDate = null
        let recentIssues = []
        
        if (healthRecords.length > 0) {
          // 有健康记录，使用实际检查数据
          const latestRecord = healthRecords[0]
          healthyCount = latestRecord.healthyCount || 0
          sickCount = latestRecord.sickCount || 0
          deadCount = latestRecord.deadCount || 0
          totalCount = latestRecord.totalCount || totalCount
          
          // 计算健康率（基于存栏数）
          healthyRate = totalCount > 0 ? ((healthyCount / totalCount) * 100) : 0
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
        } else {
          // 没有健康记录，默认都是健康的
          healthyCount = totalCount    // 假设所有存栏都是健康的
          sickCount = 0
          deadCount = 0
          healthyRate = 100            // 健康率100%
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
          deadCount,
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
      
      case 'createDeathRecord':
        return await createDeathRecord(event, wxContext)
      
      case 'listDeathRecords':
        return await listDeathRecords(event, wxContext)
      
      case 'getDeathStats':
        return await getDeathStats(event, wxContext)
      
      case 'calculateBatchCost':
        return await calculateBatchCost(event, wxContext)
      
      case 'create_treatment_from_diagnosis':
        return await createTreatmentFromDiagnosis(event, wxContext)
      
      case 'complete_treatment_as_cured':
        return await completeTreatmentAsCured(event.treatmentId, event.curedCount, wxContext)
      
      case 'complete_treatment_as_died':
        return await completeTreatmentAsDied(event.treatmentId, event.diedCount, event.deathDetails, wxContext)
      
      case 'get_ongoing_treatments':
        return await getOngoingTreatments(event.batchId, wxContext)
      
      case 'calculate_treatment_cost':
        return await calculateTreatmentCost(event, wxContext)
      
      case 'calculate_health_rate':
        return {
          success: true,
          data: {
            healthRate: await calculateHealthRate(event.batchId)
          }
        }
      
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

// ============ 死亡记录管理函数 ============

/**
 * 计算批次平均成本
 */
async function calculateBatchCost(event, wxContext) {
  try {
    const { batchId } = event
    
    if (!batchId) {
      throw new Error('批次ID不能为空')
    }
    
    // 1. 获取批次入栏信息
    const batchEntry = await db.collection('prod_batch_entries')
      .doc(batchId).get()
    
    if (!batchEntry.data) {
      throw new Error('批次不存在')
    }
    
    const batch = batchEntry.data
    const entryUnitCost = batch.unitCost || 0
    const initialQuantity = batch.quantity || 0
    const currentCount = batch.currentCount || 1
    
    // 2. 计算物料成本
    const materialRecords = await db.collection('prod_material_records')
      .where({
        batchId: batchId,
        type: 'use',
        isDeleted: false
      })
      .get()
    
    const materialCost = materialRecords.data.reduce((sum, record) => {
      return sum + (record.totalCost || 0)
    }, 0)
    
    // 3. 计算预防成本
    const preventionRecords = await db.collection('health_prevention_records')
      .where({
        batchId: batchId,
        isDeleted: false
      })
      .get()
    
    const preventionCost = preventionRecords.data.reduce((sum, record) => {
      return sum + (record.costInfo?.totalCost || 0)
    }, 0)
    
    // 4. 计算治疗成本
    const treatmentRecords = await db.collection('health_treatment_records')
      .where({
        batchId: batchId,
        isDeleted: false
      })
      .get()
    
    const treatmentCost = treatmentRecords.data.reduce((sum, record) => {
      return sum + (record.costInfo?.totalCost || 0)
    }, 0)
    
    // 5. 计算总成本和平均成本
    const entryCost = entryUnitCost * initialQuantity
    const totalCost = entryCost + materialCost + preventionCost + treatmentCost
    const avgCost = currentCount > 0 ? (totalCost / currentCount) : 0
    
    return {
      success: true,
      data: {
        avgCost: avgCost.toFixed(2),
        breakdown: {
          entryCost: entryCost.toFixed(2),
          materialCost: materialCost.toFixed(2),
          preventionCost: preventionCost.toFixed(2),
          treatmentCost: treatmentCost.toFixed(2),
          totalCost: totalCost.toFixed(2)
        },
        batchInfo: {
          initialQuantity,
          currentCount,
          entryUnitCost
        }
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '计算成本失败'
    }
  }
}

/**
 * 创建死亡记录
 */
async function createDeathRecord(event, wxContext) {
  try {
    const {
      batchId,
      batchNumber,
      deathCount,
      recordDate,
      deathCause,
      deathCauseCategory,
      customCauseTags,
      description,
      photos,
      deathList,
      environmentFactors,
      disposalMethod,
      preventiveMeasures
    } = event
    
    const openid = wxContext.OPENID
    
    // 1. 验证必填项
    if (!batchId) throw new Error('批次ID不能为空')
    if (!deathCount || deathCount <= 0) throw new Error('死亡数量必须大于0')
    if (!deathCause) throw new Error('请选择死亡原因')
    if (!description) throw new Error('请填写详细描述')
    if (!disposalMethod) throw new Error('请选择处理方式')
    
    // 2. 获取批次信息
    const batchEntry = await db.collection('prod_batch_entries')
      .doc(batchId).get()
    
    if (!batchEntry.data) {
      throw new Error('批次不存在')
    }
    
    const batch = batchEntry.data
    
    // 验证死亡数量不超过当前存栏数
    if (deathCount > batch.currentCount) {
      throw new Error(`死亡数量不能超过当前存栏数(${batch.currentCount})`)
    }
    
    // 3. 计算平均成本
    const costResult = await calculateBatchCost({ batchId }, wxContext)
    if (!costResult.success) {
      throw new Error('计算成本失败')
    }
    
    const unitCost = parseFloat(costResult.data.avgCost)
    const totalLoss = (unitCost * deathCount).toFixed(2)
    
    // 4. 获取用户信息
    const userInfo = await db.collection('wx_users')
      .where({ _openid: openid }).get()
    const operatorName = userInfo.data[0]?.name || '未知'
    
    // 5. 创建死亡记录
    const deathRecord = {
      batchId,
      batchNumber: batchNumber || batch.batchNumber,
      recordDate: recordDate || new Date().toISOString().split('T')[0],
      deathList: deathList || [],
      deathCause,
      deathCauseCategory,
      customCauseTags: customCauseTags || [],
      description,
      symptoms: '',
      photos: photos || [],
      environmentFactors: environmentFactors || {},
      financialLoss: {
        unitCost: unitCost.toFixed(2),
        totalLoss: totalLoss,
        calculationMethod: 'batch_average',
        financeRecordId: ''
      },
      disposalMethod,
      preventiveMeasures: preventiveMeasures || '',
      totalDeathCount: deathCount,
      operator: openid,
      operatorName,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const deathResult = await db.collection('health_death_records').add({
      data: deathRecord
    })
    
    const deathRecordId = deathResult._id
    
    // 6. 调用财务云函数创建损失记录
    try {
      await cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'createDeathLoss',
          batchId,
          batchNumber: batchNumber || batch.batchNumber,
          deathRecordId,
          deathCount,
          unitCost: unitCost.toFixed(2),
          totalLoss,
          deathCause,
          recordDate: recordDate || new Date().toISOString().split('T')[0],
          operator: openid
        }
      })
      
      // 更新死亡记录中的财务记录ID
      // (财务云函数会返回记录ID，这里简化处理)
    } catch (financeError) {
      console.error('创建财务记录失败:', financeError)
      // 不影响主流程，继续执行
    }
    
    // 7. 更新批次数量
    await db.collection('prod_batch_entries').doc(batchId).update({
      data: {
        currentCount: _.inc(-deathCount),
        deadCount: _.inc(deathCount),
        updatedAt: new Date()
      }
    })
    
    // 8. 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_death_record',
      COLLECTIONS.HEALTH_DEATH_RECORDS,
      deathRecordId,
      {
        batchId,
        deathCount,
        totalLoss,
        deathCause,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: { 
        recordId: deathRecordId,
        financialLoss: totalLoss
      },
      message: '死亡记录创建成功'
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '创建死亡记录失败'
    }
  }
}

/**
 * 查询死亡记录列表
 */
async function listDeathRecords(event, wxContext) {
  try {
    const {
      batchId,
      dateRange,
      page = 1,
      pageSize = 20
    } = event
    
    let query = db.collection('health_death_records')
      .where({ isDeleted: false })
    
    // 按批次筛选
    if (batchId) {
      query = query.where({ batchId })
    }
    
    // 按日期范围筛选
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        recordDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    // 分页查询
    const skip = (page - 1) * pageSize
    const result = await query
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 统计总数
    const countResult = await query.count()
    
    return {
      success: true,
      data: {
        records: result.data,
        total: countResult.total,
        page,
        pageSize
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '查询死亡记录失败'
    }
  }
}

/**
 * 获取死亡统计
 */
async function getDeathStats(event, wxContext) {
  try {
    const { batchId, dateRange } = event
    
    let query = db.collection('health_death_records')
      .where({ isDeleted: false })
    
    if (batchId) {
      query = query.where({ batchId })
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        recordDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    const records = await query.get()
    
    // 统计死亡原因分布
    const causeDistribution = {}
    let totalDeaths = 0
    let totalLoss = 0
    
    records.data.forEach(record => {
      const cause = record.deathCause
      if (!causeDistribution[cause]) {
        causeDistribution[cause] = {
          count: 0,
          loss: 0
        }
      }
      causeDistribution[cause].count += record.totalDeathCount
      causeDistribution[cause].loss += parseFloat(record.financialLoss?.totalLoss || 0)
      
      totalDeaths += record.totalDeathCount
      totalLoss += parseFloat(record.financialLoss?.totalLoss || 0)
    })
    
    // 转换为数组格式
    const causeStats = Object.keys(causeDistribution).map(cause => ({
      cause,
      count: causeDistribution[cause].count,
      loss: causeDistribution[cause].loss.toFixed(2),
      percentage: ((causeDistribution[cause].count / totalDeaths) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count)
    
    return {
      success: true,
      data: {
        totalDeaths,
        totalLoss: totalLoss.toFixed(2),
        recordCount: records.data.length,
        causeDistribution: causeStats
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '获取死亡统计失败'
    }
  }
}

// ============ 治疗流转管理函数 ============

/**
 * 从AI诊断创建治疗记录
 */
async function createTreatmentFromDiagnosis(event, wxContext) {
  try {
    const { diagnosisId, batchId, affectedCount, diagnosis, recommendations } = event
    const openid = wxContext.OPENID
    
    // 获取AI诊断记录
    const diagnosisRecord = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .doc(diagnosisId).get()
    
    if (!diagnosisRecord.data) {
      throw new Error('诊断记录不存在')
    }
    
    // 创建治疗记录
    const treatmentData = {
      batchId,
      diagnosisId,
      treatmentStatus: 'ongoing',
      treatmentDate: new Date().toISOString().split('T')[0],
      diagnosis: diagnosis || diagnosisRecord.data.primaryDiagnosis?.disease || '待确定',
      diagnosisConfidence: diagnosisRecord.data.primaryDiagnosis?.confidence || 0,
      initialCount: affectedCount || diagnosisRecord.data.affectedCount || 0,
      curedCount: 0,
      diedCount: 0,
      totalCost: 0,
      medications: recommendations?.medication || [],
      treatmentPlan: {
        primary: recommendations?.immediate?.join('; ') || '',
        supportive: recommendations?.supportive || []
      },
      operator: openid,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    }
    
    const result = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).add({
      data: treatmentData
    })
    
    // 更新AI诊断记录，关联治疗记录
    await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS).doc(diagnosisId).update({
      data: {
        relatedTreatmentId: result._id,
        updatedAt: new Date()
      }
    })
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_treatment_from_diagnosis',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      result._id,
      {
        diagnosisId,
        batchId,
        affectedCount: treatmentData.initialCount,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: {
        treatmentId: result._id,
        initialCount: treatmentData.initialCount
      },
      message: '治疗记录创建成功'
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '创建治疗记录失败'
    }
  }
}

/**
 * 完成治疗（治愈）
 */
async function completeTreatmentAsCured(treatmentId, curedCount, wxContext) {
  try {
    const openid = wxContext.OPENID
    
    // 1. 获取治疗记录
    const treatmentRecord = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId).get()
    
    if (!treatmentRecord.data) {
      throw new Error('治疗记录不存在')
    }
    
    const treatment = treatmentRecord.data
    const actualCuredCount = curedCount || treatment.initialCount
    
    // 2. 更新治疗记录状态
    await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).doc(treatmentId).update({
      data: {
        treatmentStatus: 'cured',
        curedCount: actualCuredCount,
        cureDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date()
      }
    })
    
    // 3. 调用财务云函数记录治疗成本
    if (treatment.totalCost > 0) {
      try {
        await cloud.callFunction({
          name: 'finance-management',
          data: {
            action: 'createTreatmentCostRecord',
            treatmentId: treatmentId,
            batchId: treatment.batchId,
            totalCost: treatment.totalCost,
            diagnosis: treatment.diagnosis,
            description: `治疗成本 - ${treatment.diagnosis} - ${actualCuredCount}只治愈`
          }
        })
      } catch (financeError) {
        console.error('记录治疗成本失败:', financeError)
      }
    }
    
    // 4. 更新批次健康数据和健康率
    await updateBatchHealthStatus(treatment.batchId, {
      curedCount: actualCuredCount,
      type: 'cured'
    })
    
    // 5. 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'complete_treatment_as_cured',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentId,
      {
        batchId: treatment.batchId,
        curedCount: actualCuredCount,
        totalCost: treatment.totalCost,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: {
        treatmentId,
        curedCount: actualCuredCount,
        totalCost: treatment.totalCost
      },
      message: '治疗完成，动物已治愈'
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '标记治愈失败'
    }
  }
}

/**
 * 完成治疗（死亡）
 */
async function completeTreatmentAsDied(treatmentId, diedCount, deathDetails, wxContext) {
  try {
    const openid = wxContext.OPENID
    
    // 1. 获取治疗记录
    const treatmentRecord = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId).get()
    
    if (!treatmentRecord.data) {
      throw new Error('治疗记录不存在')
    }
    
    const treatment = treatmentRecord.data
    const actualDiedCount = diedCount || treatment.initialCount
    
    // 2. 创建死亡记录
    const deathRecordData = {
      batchId: treatment.batchId,
      treatmentId: treatmentId,
      diagnosisId: treatment.diagnosisId || null,
      deathDate: new Date().toISOString().split('T')[0],
      deathCause: treatment.diagnosis || '治疗无效',
      deathCategory: 'disease',
      totalDeathCount: actualDiedCount,
      description: deathDetails?.description || `治疗失败导致死亡 - ${treatment.diagnosis}`,
      disposalMethod: deathDetails?.disposalMethod || 'burial',
      operator: openid,
      operatorName: deathDetails?.operatorName || '系统',
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    }
    
    // 获取批次信息计算损失
    const batchEntry = await db.collection('prod_batch_entries')
      .doc(treatment.batchId).get()
    
    if (batchEntry.data) {
      const avgCost = await calculateBatchCost({ batchId: treatment.batchId }, wxContext)
      const costPerAnimal = avgCost.data?.averageCost || 0
      const totalLoss = (costPerAnimal * actualDiedCount) + treatment.totalCost
      
      deathRecordData.financialLoss = {
        costPerAnimal,
        totalLoss,
        treatmentCost: treatment.totalCost,
        currency: 'CNY'
      }
      deathRecordData.batchNumber = batchEntry.data.batchNumber
    }
    
    const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
      data: deathRecordData
    })
    
    // 3. 更新治疗记录状态
    await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).doc(treatmentId).update({
      data: {
        treatmentStatus: 'died',
        diedCount: actualDiedCount,
        deathRecordId: deathResult._id,
        updatedAt: new Date()
      }
    })
    
    // 4. 调用财务云函数记录损失
    if (deathRecordData.financialLoss) {
      try {
        await cloud.callFunction({
          name: 'finance-management',
          data: {
            action: 'createDeathLossRecord',
            deathRecordId: deathResult._id,
            batchId: treatment.batchId,
            deathCount: actualDiedCount,
            totalLoss: deathRecordData.financialLoss.totalLoss,
            treatmentCost: treatment.totalCost,
            description: `死亡损失 - ${treatment.diagnosis} - ${actualDiedCount}只`
          }
        })
      } catch (financeError) {
        console.error('记录死亡损失失败:', financeError)
      }
    }
    
    // 5. 更新批次存栏数和死亡数
    await db.collection('prod_batch_entries').doc(treatment.batchId).update({
      data: {
        currentCount: _.inc(-actualDiedCount),
        deadCount: _.inc(actualDiedCount),
        updatedAt: new Date()
      }
    })
    
    // 6. 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'complete_treatment_as_died',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentId,
      {
        batchId: treatment.batchId,
        diedCount: actualDiedCount,
        deathRecordId: deathResult._id,
        financialLoss: deathRecordData.financialLoss?.totalLoss || 0,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: {
        treatmentId,
        deathRecordId: deathResult._id,
        diedCount: actualDiedCount,
        financialLoss: deathRecordData.financialLoss?.totalLoss || 0
      },
      message: '治疗记录已标记为死亡'
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '标记死亡失败'
    }
  }
}

/**
 * 更新批次健康状态
 */
async function updateBatchHealthStatus(batchId, updateData) {
  try {
    // 获取批次当前存栏数
    const batchEntry = await db.collection('prod_batch_entries').doc(batchId).get()
    if (!batchEntry.data) {
      return
    }
    
    const currentStock = batchEntry.data.currentCount || 0
    
    // 根据更新类型处理
    if (updateData.type === 'cured') {
      // 治愈：增加健康数
      const healthRecord = {
        batchId,
        recordType: 'cured',
        totalCount: currentStock,
        healthyCount: _.inc(updateData.curedCount || 0),
        recordDate: new Date().toISOString().split('T')[0],
        createdAt: new Date(),
        isDeleted: false
      }
      
      await db.collection(COLLECTIONS.HEALTH_RECORDS).add({
        data: healthRecord
      })
    }
    
    return true
  } catch (error) {
    console.error('更新批次健康状态失败:', error)
    return false
  }
}

/**
 * 计算健康率（新算法）
 */
async function calculateHealthRate(batchId) {
  try {
    // 1. 获取批次当前存栏数（已扣除死亡）
    const batchEntry = await db.collection('prod_batch_entries').doc(batchId).get()
    if (!batchEntry.data) {
      return '0'
    }
    
    const currentStock = batchEntry.data.currentCount || 0
    
    if (currentStock === 0) {
      return '0'
    }
    
    // 2. 获取最新健康记录中的健康数
    const healthRecords = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({ batchId, isDeleted: false })
      .orderBy('recordDate', 'desc')
      .limit(1)
      .get()
    
    let healthyCount = currentStock // 默认全部健康
    
    if (healthRecords.data.length > 0) {
      healthyCount = healthRecords.data[0].healthyCount || 0
    }
    
    // 3. 获取治愈记录总数
    const curedRecords = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        batchId,
        treatmentStatus: 'cured',
        isDeleted: false
      })
      .get()
    
    const totalCured = curedRecords.data.reduce((sum, r) => sum + (r.curedCount || 0), 0)
    
    // 4. 计算健康率 = (健康数 + 治愈数) / 存栏数 × 100%
    const healthRate = ((healthyCount + totalCured) / currentStock * 100).toFixed(1)
    
    return healthRate
    
  } catch (error) {
    console.error('计算健康率失败:', error)
    return '0'
  }
}

/**
 * 获取进行中的治疗记录
 */
async function getOngoingTreatments(batchId, wxContext) {
  try {
    let query = db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        treatmentStatus: 'ongoing',
        isDeleted: false
      })
    
    if (batchId && batchId !== 'all') {
      query = query.where({ batchId })
    }
    
    const records = await query.orderBy('treatmentDate', 'desc').get()
    
    return {
      success: true,
      data: {
        treatments: records.data,
        count: records.data.length
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '获取治疗记录失败'
    }
  }
}

/**
 * 计算治疗总成本
 */
async function calculateTreatmentCost(event, wxContext) {
  try {
    const { batchId, dateRange } = event
    
    let query = db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({ isDeleted: false })
    
    if (batchId && batchId !== 'all') {
      query = query.where({ batchId })
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        treatmentDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    const records = await query.get()
    
    const totalCost = records.data.reduce((sum, r) => sum + (r.totalCost || 0), 0)
    const ongoingCount = records.data.filter(r => r.treatmentStatus === 'ongoing').length
    const curedCount = records.data.filter(r => r.treatmentStatus === 'cured').length
    const diedCount = records.data.filter(r => r.treatmentStatus === 'died').length
    
    const totalTreated = records.data.reduce((sum, r) => sum + (r.initialCount || 0), 0)
    const totalCuredAnimals = records.data.reduce((sum, r) => sum + (r.curedCount || 0), 0)
    const cureRate = totalTreated > 0 ? ((totalCuredAnimals / totalTreated) * 100).toFixed(1) : 0
    
    return {
      success: true,
      data: {
        totalCost: totalCost.toFixed(2),
        treatmentCount: records.data.length,
        ongoingCount,
        curedCount,
        diedCount,
        totalTreated,
        totalCuredAnimals,
        cureRate
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '计算治疗成本失败'
    }
  }
}
