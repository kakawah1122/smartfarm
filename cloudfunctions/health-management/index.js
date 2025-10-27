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

// 创建异常记录（从AI诊断保存）
async function createAbnormalRecord(event, wxContext) {
  try {
    const {
      diagnosisId,
      batchId,
      batchNumber,
      affectedCount,
      symptoms,
      diagnosis,
      diagnosisConfidence,
      diagnosisDetails,  // 新增：完整的诊断详情
      severity,
      urgency,
      aiRecommendation,
      images
    } = event
    const openid = wxContext.OPENID

    console.log('📥 创建异常记录:', diagnosis, '- 批次:', batchNumber)

    const db = cloud.database()

    // 获取用户信息
    let userName = 'KAKA'
    try {
      const userResult = await db.collection(COLLECTIONS.WX_USERS)
        .where({ _openid: openid })
        .limit(1)
        .get()
      
      if (userResult.data && userResult.data.length > 0) {
        const user = userResult.data[0]
        userName = user.nickName || user.nickname || user.farmName || user.position || 'KAKA'
      }
    } catch (userError) {
      console.error('获取用户信息失败:', userError)
    }

    const recordData = {
      batchId,
      batchNumber,
      diagnosisId,  // 关联AI诊断记录
      recordType: 'ai_diagnosis',
      checkDate: new Date().toISOString().split('T')[0],
      reporter: openid,
      reporterName: userName,  // 添加记录者名称
      status: 'abnormal',  // 异常状态，等待制定治疗方案
      affectedCount: affectedCount || 0,
      symptoms: symptoms || '',
      diagnosis: diagnosis || '',
      diagnosisConfidence: diagnosisConfidence || 0,
      diagnosisDetails: diagnosisDetails || null,  // 保存完整的诊断详情
      severity: severity || 'unknown',
      urgency: urgency || 'unknown',
      aiRecommendation: aiRecommendation || null,
      images: images || [],
      isDeleted: false,  // 添加isDeleted字段
      createdAt: new Date(),
      updatedAt: new Date()
    }

    console.log('💾 准备保存到数据库的数据:', recordData)

    // 使用health_records collection，但状态为abnormal
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS).add({
      data: recordData
    })
    
    console.log('✅ 异常记录已保存, ID:', result._id)

    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_abnormal_record',
      COLLECTIONS.HEALTH_RECORDS,
      result._id,
      {
        batchId,
        diagnosisId,
        affectedCount,
        diagnosis,
        severity,
        result: 'success'
      }
    )

    return {
      success: true,
      data: { recordId: result._id },
      message: '异常记录创建成功'
    }

  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '创建异常记录失败'
    }
  }
}

// 获取异常记录详情
async function getAbnormalRecordDetail(event, wxContext) {
  try {
    const { recordId } = event
    const db = cloud.database()
    
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!result.data) {
      throw new Error('记录不存在')
    }
    
    const record = result.data
    
    // 格式化修正时间（与死亡记录保持一致）
    if (record.correctedAt) {
      const date = new Date(record.correctedAt)
      record.correctedAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
    
    return {
      success: true,
      data: record,
      message: '获取成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '获取异常记录详情失败'
    }
  }
}

// 从异常记录创建治疗记录
async function createTreatmentFromAbnormal(event, wxContext) {
  try {
    const {
      abnormalRecordId,
      batchId,
      affectedCount,
      diagnosis,
      aiRecommendation,
      treatmentPlan,  // ✅ 接收前端传来的治疗方案
      medications,    // ✅ 接收前端传来的药物
      notes,          // ✅ 接收前端传来的备注
      treatmentType   // ✅ 接收治疗类型
    } = event
    const openid = wxContext.OPENID
    const db = cloud.database()
    
    // ✅ 如果没有 affectedCount，从异常记录中获取
    let finalAffectedCount = affectedCount
    if (!finalAffectedCount) {
      const abnormalRecord = await db.collection(COLLECTIONS.HEALTH_RECORDS)
        .doc(abnormalRecordId)
        .get()
      
      if (abnormalRecord.data) {
        finalAffectedCount = abnormalRecord.data.affectedCount || 1
      }
    }
    
    // ✅ 判断是创建草稿还是直接创建正式记录
    // 如果传入了 treatmentPlan，说明是前端已填写完整表单，直接创建正式记录
    const isDirectSubmit = treatmentPlan && treatmentPlan.primary
    
    // 创建治疗记录
    const treatmentData = {
      batchId,
      abnormalRecordId,  // 关联异常记录
      animalIds: [],
      treatmentDate: new Date().toISOString().split('T')[0],
      treatmentType: treatmentType || 'medication',
      diagnosis: {
        preliminary: diagnosis,
        confirmed: diagnosis,
        confidence: 0,
        diagnosisMethod: 'ai'
      },
      treatmentPlan: {
        primary: treatmentPlan?.primary || aiRecommendation?.primary || '',
        followUpSchedule: treatmentPlan?.followUpSchedule || []
      },
      medications: medications || [],
      progress: [],
      outcome: {
        status: isDirectSubmit ? 'ongoing' : 'pending',  // ✅ 直接提交则为 ongoing
        curedCount: 0,
        improvedCount: 0,
        deathCount: 0,
        totalTreated: finalAffectedCount || 1
      },
      cost: {
        medication: 0,
        veterinary: 0,
        supportive: 0,
        total: 0
      },
      notes: notes || '',
      isDraft: !isDirectSubmit,  // ✅ 直接提交则不是草稿
      isDeleted: false,
      createdBy: openid,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).add({
      data: treatmentData
    })
    
    // ✅ 如果是直接提交且有药物使用，扣减库存
    if (isDirectSubmit && medications && medications.length > 0) {
      for (const med of medications) {
        if (med.materialId && med.quantity > 0) {
          try {
            // 检查库存
            const material = await db.collection('prod_materials').doc(med.materialId).get()
            
            if (material.data) {
              const currentStock = material.data.currentStock || 0
              
              if (currentStock < med.quantity) {
                console.warn(`⚠️ 库存不足: ${material.data.name}，当前库存：${currentStock}，需要：${med.quantity}`)
                continue  // 库存不足时跳过，不阻断治疗记录创建
              }
              
              // 扣减库存
              const newStock = currentStock - med.quantity
              await db.collection('prod_materials').doc(med.materialId).update({
                data: {
                  currentStock: newStock,
                  updateTime: new Date()
                }
              })
              
              // 创建库存流水记录
              await db.collection('prod_inventory_logs').add({
                data: {
                  materialId: med.materialId,
                  recordId: treatmentResult._id,
                  operation: '治疗领用',
                  quantity: med.quantity,
                  beforeStock: currentStock,
                  afterStock: newStock,
                  operator: openid,
                  operationTime: new Date(),
                  relatedType: 'treatment',
                  notes: `治疗领用 - ${diagnosis}`
                }
              })
              
              console.log(`✅ 库存扣减成功: ${material.data.name}，数量：${med.quantity}，剩余：${newStock}`)
            }
          } catch (error) {
            console.error(`❌ 扣减库存失败:`, error)
            // 不阻断治疗记录创建
          }
        }
      }
    }
    
    // ✅ 根据是否直接提交，决定异常记录的状态
    // 直接提交：status = 'treating'（已制定方案并开始治疗）
    // 创建草稿：status 保持 'abnormal'（还在制定方案中）
    if (isDirectSubmit) {
      await db.collection(COLLECTIONS.HEALTH_RECORDS)
        .doc(abnormalRecordId)
        .update({
          data: {
            status: 'treating',  // ✅ 更新状态为治疗中
            treatmentRecordId: treatmentResult._id,
            updatedAt: new Date()
          }
        })
    } else {
      // 草稿状态，只关联治疗记录ID
      await db.collection(COLLECTIONS.HEALTH_RECORDS)
        .doc(abnormalRecordId)
        .update({
          data: {
            treatmentRecordId: treatmentResult._id,
            updatedAt: new Date()
          }
        })
    }
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_treatment_from_abnormal',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentResult._id,
      {
        abnormalRecordId,
        batchId,
        affectedCount: finalAffectedCount,
        isDirectSubmit,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: { treatmentId: treatmentResult._id },
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

// 从异常记录创建隔离记录
async function createIsolationFromAbnormal(event, wxContext) {
  try {
    const {
      abnormalRecordId,
      batchId,
      affectedCount,
      diagnosis
    } = event
    const openid = wxContext.OPENID
    const db = cloud.database()
    
    // 创建隔离记录
    const isolationData = {
      batchId,
      abnormalRecordId,  // 关联异常记录
      isolationDate: new Date().toISOString().split('T')[0],
      isolatedCount: affectedCount || 0,
      diagnosis: diagnosis || '',
      isolationLocation: '',  // 隔离位置
      isolationReason: diagnosis || '',
      status: 'ongoing',  // ongoing | completed
      dailyRecords: [],  // 每日观察记录
      outcome: {
        recoveredCount: 0,
        diedCount: 0,
        stillIsolatedCount: affectedCount || 0
      },
      notes: '',
      isDeleted: false,  // ✅ 添加删除标记字段，确保统计时能查询到
      createdBy: openid,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const isolationResult = await db.collection(COLLECTIONS.HEALTH_ISOLATION_RECORDS).add({
      data: isolationData
    })
    
    // 更新异常记录状态为isolated（隔离中）
    await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(abnormalRecordId)
      .update({
        data: {
          status: 'isolated',
          isolationRecordId: isolationResult._id,
          updatedAt: new Date()
        }
      })
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_isolation_from_abnormal',
      COLLECTIONS.HEALTH_ISOLATION_RECORDS,
      isolationResult._id,
      {
        abnormalRecordId,
        batchId,
        affectedCount,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: { isolationId: isolationResult._id },
      message: '隔离记录创建成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '创建隔离记录失败'
    }
  }
}

// 提交治疗计划（用户填写完治疗表单后调用）
async function submitTreatmentPlan(event, wxContext) {
  try {
    const {
      treatmentId,
      abnormalRecordId,
      treatmentType  // 'medication' | 'isolation'
    } = event
    const openid = wxContext.OPENID
    const db = cloud.database()
    
    // 1. 更新治疗记录状态（从草稿变为正式）
    await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .update({
        data: {
          isDraft: false,
          'outcome.status': 'ongoing',
          updatedAt: new Date()
        }
      })
    
    // 2. 根据治疗类型，更新异常记录的状态
    const newStatus = treatmentType === 'isolation' ? 'isolated' : 'treating'
    
    await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(abnormalRecordId)
      .update({
        data: {
          status: newStatus,  // treating 或 isolated
          updatedAt: new Date()
        }
      })
    
    // 3. 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'submit_treatment_plan',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentId,
      {
        abnormalRecordId,
        treatmentType,
        newStatus,
        result: 'success'
      }
    )
    
    return {
      success: true,
      message: '治疗计划提交成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '提交治疗计划失败'
    }
  }
}

// 获取异常记录列表
async function getAbnormalRecords(event, wxContext) {
  try {
    const { batchId } = event
    const db = cloud.database()
    
    console.log('🔍 查询异常记录 - 参数:', { batchId })
    
    // 查询所有异常记录（包括待处理、治疗中、已隔离）
    let whereCondition = {
      recordType: 'ai_diagnosis',
      status: _.in(['abnormal', 'treating', 'isolated']),  // 显示所有状态的记录
      isDeleted: _.neq(true)
    }
    
    if (batchId && batchId !== 'all') {
      whereCondition.batchId = batchId
    }
    
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where(whereCondition)
      .orderBy('checkDate', 'desc')
      .get()
    
    console.log('📋 查询到异常记录数量:', result.data.length)
    if (result.data.length > 0) {
      console.log('📄 第一条记录示例:', result.data[0])
    }
    
    return {
      success: true,
      data: result.data,
      message: '获取成功'
    }
  } catch (error) {
    console.error('❌ 查询异常记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取异常记录失败'
    }
  }
}

// 列出异常记录（分页）
async function listAbnormalRecords(event, wxContext) {
  try {
    const { batchId, page = 1, pageSize = 20 } = event
    const db = cloud.database()
    
    // 查询所有异常记录（包括待处理、治疗中、已隔离）
    let whereCondition = {
      recordType: 'ai_diagnosis',
      status: _.in(['abnormal', 'treating', 'isolated']),  // 显示所有状态的记录
      isDeleted: _.neq(true)
    }
    
    if (batchId && batchId !== 'all') {
      whereCondition.batchId = batchId
    }
    
    let query = db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where(whereCondition)
    
    const countResult = await query.count()
    const total = countResult.total
    
    const result = await query
      .orderBy('checkDate', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    return {
      success: true,
      data: {
        records: result.data,
        total: total,
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(total / pageSize)
      },
      message: '获取成功'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '获取异常记录列表失败'
    }
  }
}

// 获取批次AI诊断提示词所需数据
async function getBatchPromptData(event, wxContext) {
  try {
    const { batchId } = event

    if (!batchId) {
      throw new Error('批次ID不能为空')
    }

    // 1. 批次基础信息
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .doc(batchId)
      .get()

    if (!batchResult.data) {
      throw new Error('批次不存在或已删除')
    }

    const batch = batchResult.data
    const today = new Date()
    const entryDate = new Date(batch.entryDate || batch.createTime || today)
    const dayAge = Math.max(1, Math.floor((today - entryDate) / (24 * 60 * 60 * 1000)) + 1)

    const batchInfo = {
      batchId,
      batchNumber: batch.batchNumber || '未知批次',
      breed: batch.breed || '狮头鹅',
      entryDate: batch.entryDate || (batch.createTime ? new Date(batch.createTime).toISOString().split('T')[0] : ''),
      dayAge,
      initialQuantity: batch.quantity || 0,
      location: batch.location || '',
      supplier: batch.supplier || '',
      feedType: batch.feedType || '',
      notes: batch.notes || ''
    }

    // 2. 当前群体统计
    const summaryResult = await getHealthStatistics(batchId)

    const currentStats = {
      totalAnimals: summaryResult.totalAnimals,
      healthyCount: summaryResult.healthyCount,
      sickCount: summaryResult.sickCount,
      deadCount: summaryResult.deadCount,
      abnormalCount: summaryResult.abnormalCount,
      treatingCount: summaryResult.treatingCount,
      isolatedCount: summaryResult.isolatedCount,
      mortalityRate: summaryResult.mortalityRate
    }

    // 3. 最近异常/诊断记录
    const recentAbnormalRecords = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({
        batchId,
        recordType: 'ai_diagnosis',
        isDeleted: _.neq(true)
      })
      .orderBy('checkDate', 'desc')
      .limit(5)
      .get()

    const diagnosisTrend = recentAbnormalRecords.data.map(record => ({
      recordId: record._id,
      checkDate: record.checkDate,
      diagnosis: record.diagnosis,
      symptoms: record.symptoms || [],
      sickCount: record.sickCount || 0,
      severity: record.severity || '',
      urgency: record.urgency || '',
      aiRecommendation: record.aiRecommendation
    }))

    // 4. 最近治疗与隔离记录
    const recentTreatmentRecords = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({ batchId, isDeleted: _.neq(true) })
      .orderBy('treatmentDate', 'desc')
      .limit(3)
      .get()

    const treatmentHistory = recentTreatmentRecords.data.map(record => ({
      recordId: record._id,
      treatmentDate: record.treatmentDate,
      diagnosis: record.diagnosis,
      treatmentPlan: record.treatmentPlan,
      medications: record.medications,
      outcome: record.outcome,
      notes: record.notes
    }))

    // 查询隔离记录（如果集合不存在则跳过）
    let isolationHistory = []
    try {
      const recentIsolationRecords = await db.collection(COLLECTIONS.HEALTH_ISOLATION_RECORDS)
        .where({ batchId, isDeleted: _.neq(true) })
        .orderBy('startDate', 'desc')
        .limit(3)
        .get()

      isolationHistory = recentIsolationRecords.data.map(record => ({
        recordId: record._id,
        startDate: record.startDate,
        endDate: record.endDate,
        reason: record.reason,
        status: record.status,
        notes: record.notes
      }))
    } catch (isolationError) {
      // 隔离记录集合可能不存在，跳过
      console.warn('隔离记录查询失败（集合可能不存在）:', isolationError.message)
    }

    // 5. 最近死亡记录
    const recentDeathRecords = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({ batchId, isDeleted: _.neq(true) })
      .orderBy('deathDate', 'desc')
      .limit(5)
      .get()

    const deathHistory = recentDeathRecords.data.map(record => ({
      recordId: record._id,
      deathDate: record.deathDate,
      deathCount: record.deathCount,
      aiDiagnosis: record.deathCause,
      correctedDiagnosis: record.correctedCause,
      correctionReason: record.correctionReason,
      aiAccuracyRating: record.aiAccuracyRating
    }))

    // 6. 最近AI准确率/修正数据
    const recentCorrections = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({
        batchId,
        recordType: 'ai_diagnosis',
        isCorrected: true,
        isDeleted: _.neq(true)
      })
      .orderBy('correctedAt', 'desc')
      .limit(10)
      .get()

    const correctionFeedback = recentCorrections.data.map(record => ({
      recordId: record._id,
      correctedDiagnosis: record.correctedDiagnosis,
      correctionReason: record.correctionReason,
      aiAccuracyRating: record.aiAccuracyRating,
      correctedAt: record.correctedAt
    }))

    // 7. 构建Prompt-ready结构
    return {
      success: true,
      data: {
        batch: batchInfo,
        stats: currentStats,
        diagnosisTrend,
        treatmentHistory,
        isolationHistory,
        deathHistory,
        correctionFeedback
      }
    }

  } catch (error) {
    console.error('获取批次诊断数据失败:', error)
    return {
      success: false,
      error: error.message || '获取批次数据失败'
    }
  }
}

// 修正异常诊断
async function correctAbnormalDiagnosis(event, wxContext) {
  try {
    const {
      recordId,
      correctedDiagnosis,
      veterinarianDiagnosis,
      veterinarianTreatmentPlan,
      aiAccuracyRating
    } = event
    const openid = wxContext.OPENID
    
    // 验证必填参数
    if (!recordId) {
      throw new Error('记录ID不能为空')
    }
    if (!correctedDiagnosis) {
      throw new Error('修正后的诊断不能为空')
    }
    if (!veterinarianDiagnosis) {
      throw new Error('兽医诊断依据不能为空')
    }
    if (!aiAccuracyRating || aiAccuracyRating < 1 || aiAccuracyRating > 5) {
      throw new Error('AI准确性评分必须在1-5之间')
    }
    
    const db = cloud.database()
    
    // 获取当前记录
    const recordResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!recordResult.data) {
      throw new Error('记录不存在')
    }
    
    // 获取用户信息（与死亡记录保持一致）
    let userName = '未知用户'
    try {
      const userResult = await db.collection(COLLECTIONS.WX_USERS)
        .where({ _openid: openid })
        .limit(1)
        .get()
      
      if (userResult.data && userResult.data.length > 0) {
        // 优先使用用户昵称，其次养殖场名称，最后职位
        const user = userResult.data[0]
        userName = user.nickName || user.nickname || user.farmName || user.position || '未知用户'
      }
    } catch (userError) {
      console.error('获取用户信息失败:', userError)
    }
    
    // 更新记录
    await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .update({
        data: {
          isCorrected: true,
          correctedDiagnosis: correctedDiagnosis,
          correctionReason: veterinarianDiagnosis,
          veterinarianTreatmentPlan: veterinarianTreatmentPlan || '',
          aiAccuracyRating: aiAccuracyRating,
          correctedBy: openid,
          correctedByName: userName,
          correctedAt: new Date().toISOString(),
          updatedAt: new Date()
        }
      })
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'correct_abnormal_diagnosis',
      COLLECTIONS.HEALTH_RECORDS,
      recordId,
      {
        originalDiagnosis: recordResult.data.diagnosis,
        correctedDiagnosis,
        aiAccuracyRating,
        result: 'success'
      }
    )
    
    return {
      success: true,
      message: '修正提交成功'
    }
  } catch (error) {
    console.error('修正异常诊断失败:', error)
    return {
      success: false,
      error: error.message,
      message: '修正提交失败'
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

// 获取治疗记录详情
async function getTreatmentRecordDetail(event, wxContext) {
  try {
    const { treatmentId } = event
    const db = cloud.database()
    
    if (!treatmentId) {
      throw new Error('治疗记录ID不能为空')
    }
    
    const result = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .get()
    
    if (!result.data) {
      throw new Error('治疗记录不存在')
    }
    
    return {
      success: true,
      data: result.data,
      message: '获取成功'
    }
  } catch (error) {
    console.error('获取治疗记录详情失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取治疗记录详情失败'
    }
  }
}

// 更新治疗记录
async function updateTreatmentRecord(event, wxContext) {
  try {
    const { treatmentId, updateData } = event
    const db = cloud.database()
    const openid = wxContext.OPENID
    
    if (!treatmentId) {
      throw new Error('治疗记录ID不能为空')
    }
    
    if (!updateData) {
      throw new Error('更新数据不能为空')
    }
    
    // 添加更新时间
    updateData.updatedAt = new Date()
    
    await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .update({
        data: updateData
      })
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'update_treatment_record',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentId,
      {
        updateFields: Object.keys(updateData),
        result: 'success'
      }
    )
    
    return {
      success: true,
      message: '更新成功'
    }
  } catch (error) {
    console.error('更新治疗记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '更新治疗记录失败'
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
    
    // 统计异常记录（只统计从AI诊断创建的异常记录）
    // ✅ 累加 affectedCount，而不是记录条数
    const abnormalRecords = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({
        batchId,
        recordType: 'ai_diagnosis',
        status: 'abnormal',
        isDeleted: _.neq(true)
      })
      .get()
    
    const abnormalCount = abnormalRecords.data.reduce((sum, record) => {
      return sum + (record.affectedCount || 0)
    }, 0)
    
    // 统计治疗中记录（status='treating' 或 treatment_records中status='ongoing'）
    // ✅ 累加 totalTreated 或 animalIds.length
    const treatingRecords = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        batchId,
        'outcome.status': 'ongoing',
        isDeleted: _.neq(true)
      })
      .get()
    
    const treatingCount = treatingRecords.data.reduce((sum, record) => {
      return sum + (record.outcome?.totalTreated || 0)
    }, 0)
    
    // 统计隔离中记录（status='isolated' 或 isolation_records中status='ongoing'）
    // ✅ 累加 isolatedCount
    const isolatedRecords = await db.collection(COLLECTIONS.HEALTH_ISOLATION_RECORDS)
      .where({
        batchId,
        status: 'ongoing',
        isDeleted: _.neq(true)
      })
      .get()
    
    const isolatedCount = isolatedRecords.data.reduce((sum, record) => {
      return sum + (record.isolatedCount || 0)
    }, 0)
    
    // ✅ 获取实时死亡数（从死亡记录表）
    const deathRecordsResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({
        batchId: batchId,
        isDeleted: false
      })
      .get()
    
    deathRecordsResult.data.forEach(record => {
      deadCount += record.deathCount || 0
    })
    
    // ✅ 当前存栏数 = 原始数量 - 死亡数
    totalAnimals = originalQuantity - deadCount
    
    if (records.data.length > 0) {
      // 有健康记录，使用最新的记录
      const latestRecord = records.data[0]
      let recordHealthyCount = latestRecord.healthyCount || 0
      let recordSickCount = latestRecord.sickCount || 0
      
      // ✅ 如果健康记录的健康数和生病数都是0，说明没有填写
      // 应该用 总存栏数 - 异常数 - 治疗中数 - 隔离中数 来计算健康数
      if (recordHealthyCount === 0 && recordSickCount === 0) {
        healthyCount = totalAnimals - abnormalCount - treatingCount - isolatedCount
        sickCount = abnormalCount + treatingCount + isolatedCount
      } else {
        healthyCount = recordHealthyCount
        sickCount = recordSickCount
      }
      
      healthyCount = Math.max(0, healthyCount)  // 确保不为负数
      healthyRate = totalAnimals > 0 ? ((healthyCount / totalAnimals) * 100).toFixed(1) : 0
      mortalityRate = originalQuantity > 0 ? ((deadCount / originalQuantity) * 100).toFixed(2) : 0
    } else {
      // 没有健康记录，根据异常、治疗中、隔离记录计算
      healthyCount = totalAnimals - abnormalCount - treatingCount - isolatedCount
      healthyCount = Math.max(0, healthyCount)  // 确保不为负数
      sickCount = abnormalCount + treatingCount + isolatedCount
      healthyRate = totalAnimals > 0 ? ((healthyCount / totalAnimals) * 100).toFixed(1) : 100
      mortalityRate = originalQuantity > 0 ? ((deadCount / originalQuantity) * 100).toFixed(2) : 0
    }

    return {
      totalChecks,
      totalAnimals,
      healthyCount,
      sickCount,
      deadCount,
      healthyRate,
      mortalityRate,
      abnormalCount,
      treatingCount,
      isolatedCount
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
        
        // ✅ 实时统计死亡数（从死亡记录表查询）
        const deathRecordsResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
          .where({
            batchId: batch._id,
            isDeleted: false
          })
          .get()
        
        let deadCount = 0
        deathRecordsResult.data.forEach(record => {
          deadCount += record.deathCount || 0
        })
        
        console.log(`📊 批次 ${batch.batchNumber} 死亡统计:`, {
          批次ID: batch._id,
          死亡记录数: deathRecordsResult.data.length,
          累计死亡数: deadCount,
          死亡记录详情: deathRecordsResult.data.map(r => ({
            日期: r.deathDate,
            数量: r.deathCount,
            原因: r.deathCause
          }))
        })
        
        // ✅ 当前存栏数 = 原始数量 - 实时死亡数 - 出栏数
        const exitedCount = exitQuantityMap[batch.batchNumber] || 0
        let totalCount = originalQuantity - deadCount - exitedCount
        
        let healthyCount = 0
        let sickCount = 0
        let healthyRate = 100
        let lastCheckDate = null
        let recentIssues = []
        
        // ✅ 查询异常记录（状态为 abnormal, treating, isolated 的记录）
        // ⚠️ 不能只用 .count()，要累加每条记录的 affectedCount
        const abnormalRecordsResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
          .where({
            batchId: batch._id,
            recordType: 'ai_diagnosis',
            status: _.in(['abnormal', 'treating', 'isolated']),
            isDeleted: _.neq(true)
          })
          .get()
        
        // ✅ 累加受影响的动物数量，而不是记录数
        const abnormalCount = abnormalRecordsResult.data.reduce((sum, record) => {
          return sum + (record.affectedCount || 0)
        }, 0)
        
        console.log(`📊 批次 ${batch.batchNumber} 异常统计:`, {
          批次ID: batch._id,
          异常记录条数: abnormalRecordsResult.data.length,
          受影响动物数: abnormalCount,
          总存栏数: totalCount
        })
        
        if (healthRecords.length > 0) {
          // 有健康记录，使用实际检查数据
          const latestRecord = healthRecords[0]
          healthyCount = latestRecord.healthyCount || 0
          sickCount = latestRecord.sickCount || 0
          // ❌ 不再从健康记录获取死亡数，因为那是单次检查的数据
          
          // 如果健康记录的存栏数不同，使用健康记录的
          if (latestRecord.totalCount && latestRecord.totalCount !== totalCount) {
            totalCount = latestRecord.totalCount
          }
          
          // ✅ 修复：如果健康数和生病数都是0，说明健康记录没有填写
          // 应该用 总存栏数 - 异常数 来计算健康数
          if (healthyCount === 0 && sickCount === 0 && totalCount > 0) {
            healthyCount = totalCount - abnormalCount  // ✅ 减去异常数量
            sickCount = abnormalCount  // ✅ 生病数 = 异常数
            healthyRate = totalCount > 0 ? ((healthyCount / totalCount) * 100) : 100
          } else {
            // 计算健康率（基于存栏数）
            healthyRate = totalCount > 0 ? ((healthyCount / totalCount) * 100) : 0
          }
          
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
          // 没有健康记录，根据异常记录计算
          healthyCount = totalCount > 0 ? (totalCount - abnormalCount) : 0
          sickCount = abnormalCount
          healthyRate = totalCount > 0 ? ((healthyCount / totalCount) * 100) : 100
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

/**
 * 添加治疗笔记
 */
async function addTreatmentNote(event, wxContext) {
  try {
    const { treatmentId, note } = event
    const openid = wxContext.OPENID
    
    if (!treatmentId) {
      throw new Error('治疗记录ID不能为空')
    }
    if (!note || note.trim().length === 0) {
      throw new Error('治疗笔记不能为空')
    }
    
    // 获取治疗记录
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .get()
    
    if (!treatmentResult.data) {
      throw new Error('治疗记录不存在')
    }
    
    const treatment = treatmentResult.data
    
    // 权限验证
    if (treatment._openid !== openid) {
      throw new Error('无权操作此治疗记录')
    }
    
    // 创建笔记记录
    const noteRecord = {
      type: 'note',
      content: note,
      createdAt: new Date().toISOString(),
      createdBy: openid
    }
    
    // 更新治疗记录，添加笔记到历史中
    await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .update({
        data: {
          treatmentHistory: _.push(noteRecord),
          updateTime: db.serverDate()
        }
      })
    
    return {
      success: true,
      message: '治疗笔记保存成功'
    }
  } catch (error) {
    console.error('❌ 添加治疗笔记失败:', error)
    return {
      success: false,
      error: error.message,
      message: '添加治疗笔记失败'
    }
  }
}

/**
 * 追加用药（扣减库存）
 */
async function addTreatmentMedication(event, wxContext) {
  try {
    const { treatmentId, medication } = event
    const openid = wxContext.OPENID
    
    if (!treatmentId) {
      throw new Error('治疗记录ID不能为空')
    }
    if (!medication || !medication.materialId) {
      throw new Error('药品信息不完整')
    }
    
    const quantity = parseInt(medication.quantity)
    if (!quantity || quantity <= 0) {
      throw new Error('数量必须大于0')
    }
    
    // 获取治疗记录
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .get()
    
    if (!treatmentResult.data) {
      throw new Error('治疗记录不存在')
    }
    
    const treatment = treatmentResult.data
    
    // 权限验证
    if (treatment._openid !== openid) {
      throw new Error('无权操作此治疗记录')
    }
    
    // 检查库存
    const materialResult = await db.collection('prod_materials')
      .doc(medication.materialId)
      .get()
    
    if (!materialResult.data) {
      throw new Error('药品不存在')
    }
    
    const material = materialResult.data
    if (material.currentStock < quantity) {
      throw new Error(`库存不足，当前库存：${material.currentStock}${material.unit}`)
    }
    
    // 开始事务
    const transaction = await db.startTransaction()
    
    try {
      // 1. 扣减库存
      await transaction.collection('prod_materials')
        .doc(medication.materialId)
        .update({
          data: {
            currentStock: _.inc(-quantity),
            updateTime: db.serverDate()
          }
        })
      
      // 2. 创建库存日志
      await transaction.collection('prod_inventory_logs').add({
        data: {
          materialId: medication.materialId,
          materialCode: medication.materialCode,
          materialName: medication.name,
          category: medication.category,
          operationType: '治疗领用',
          quantity: -quantity,
          unit: medication.unit,
          beforeStock: material.currentStock,
          afterStock: material.currentStock - quantity,
          relatedModule: 'health_treatment',
          relatedId: treatmentId,
          notes: `追加用药：${medication.name}，用法：${medication.dosage || '无'}`,
          operator: openid,
          createTime: db.serverDate()
        }
      })
      
      // 3. 添加用药记录到治疗记录
      const medicationRecord = {
        type: 'medication_added',
        medication: {
          materialId: medication.materialId,
          name: medication.name,
          quantity: quantity,
          unit: medication.unit,
          dosage: medication.dosage || '',
          category: medication.category
        },
        createdAt: new Date().toISOString(),
        createdBy: openid
      }
      
      await transaction.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .doc(treatmentId)
        .update({
          data: {
            medications: _.push({
              materialId: medication.materialId,
              name: medication.name,
              quantity: quantity,
              unit: medication.unit,
              dosage: medication.dosage || '',
              category: medication.category
            }),
            treatmentHistory: _.push(medicationRecord),
            updateTime: db.serverDate()
          }
        })
      
      // 提交事务
      await transaction.commit()
      
      return {
        success: true,
        message: '用药追加成功，库存已扣减'
      }
    } catch (error) {
      // 回滚事务
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error('❌ 追加用药失败:', error)
    return {
      success: false,
      error: error.message,
      message: '追加用药失败'
    }
  }
}

/**
 * 调整治疗方案
 */
async function updateTreatmentPlan(event, wxContext) {
  try {
    const { treatmentId, treatmentPlan, adjustReason } = event
    const openid = wxContext.OPENID
    
    if (!treatmentId) {
      throw new Error('治疗记录ID不能为空')
    }
    if (!treatmentPlan || treatmentPlan.trim().length === 0) {
      throw new Error('治疗方案不能为空')
    }
    
    // 获取治疗记录
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .get()
    
    if (!treatmentResult.data) {
      throw new Error('治疗记录不存在')
    }
    
    const treatment = treatmentResult.data
    
    // 权限验证
    if (treatment._openid !== openid) {
      throw new Error('无权操作此治疗记录')
    }
    
    // 记录方案调整历史
    const adjustmentRecord = {
      type: 'plan_adjusted',
      oldPlan: treatment.treatmentPlan?.primary || '',
      newPlan: treatmentPlan,
      reason: adjustReason || '无',
      createdAt: new Date().toISOString(),
      createdBy: openid
    }
    
    // 更新治疗记录
    await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .update({
        data: {
          'treatmentPlan.primary': treatmentPlan,
          treatmentHistory: _.push(adjustmentRecord),
          updateTime: db.serverDate()
        }
      })
    
    return {
      success: true,
      message: '治疗方案调整成功'
    }
  } catch (error) {
    console.error('❌ 调整治疗方案失败:', error)
    return {
      success: false,
      error: error.message,
      message: '调整治疗方案失败'
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
      
      case 'create_abnormal_record':
        return await createAbnormalRecord(event, wxContext)
      
      case 'get_abnormal_record_detail':
        return await getAbnormalRecordDetail(event, wxContext)
      
      case 'create_treatment_from_abnormal':
        return await createTreatmentFromAbnormal(event, wxContext)
      
      case 'create_isolation_from_abnormal':
        return await createIsolationFromAbnormal(event, wxContext)
      
      case 'submit_treatment_plan':
        return await submitTreatmentPlan(event, wxContext)
      
      case 'create_treatment_record':
        return await createTreatmentRecord(event, wxContext)
      
      case 'get_treatment_record_detail':
        return await getTreatmentRecordDetail(event, wxContext)
      
      case 'update_treatment_record':
        return await updateTreatmentRecord(event, wxContext)
      
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
      
      case 'update_treatment_progress':
        return await updateTreatmentProgress(event, wxContext)
      
      case 'get_treatment_detail':
        return await getTreatmentDetail(event.treatmentId, wxContext)
      
      case 'add_treatment_note':
        return await addTreatmentNote(event, wxContext)
      
      case 'add_treatment_medication':
        return await addTreatmentMedication(event, wxContext)
      
      case 'update_treatment_plan':
        return await updateTreatmentPlan(event, wxContext)
      
      case 'calculate_health_rate':
        return {
          success: true,
          data: {
            healthRate: await calculateHealthRate(event.batchId)
          }
        }
      
      case 'create_death_record_with_finance':
        return await createDeathRecordWithFinance(event, wxContext)
      
      case 'get_death_records_list':
        return await getDeathRecordsList(event, wxContext)
      
      case 'get_death_record_detail':
        return await getDeathRecordDetail(event, wxContext)
      
      case 'correct_death_diagnosis':
        return await correctDeathDiagnosis(event, wxContext)
      
      case 'get_abnormal_records':
        return await getAbnormalRecords(event, wxContext)
      
      case 'list_abnormal_records':
        return await listAbnormalRecords(event, wxContext)
      
      case 'correct_abnormal_diagnosis':
        return await correctAbnormalDiagnosis(event, wxContext)
      
      case 'get_batch_prompt_data':
        return await getBatchPromptData(event, wxContext)
      
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
    
    console.log('======= 创建治疗记录参数 =======')
    console.log('diagnosisId:', diagnosisId)
    console.log('batchId:', batchId)
    console.log('affectedCount:', affectedCount)
    console.log('diagnosis:', diagnosis)
    
    // 验证必填参数
    if (!diagnosisId) {
      throw new Error('诊断ID不能为空')
    }
    if (!batchId) {
      throw new Error('批次ID不能为空')
    }
    if (!affectedCount || affectedCount <= 0) {
      throw new Error('受影响数量必须大于0')
    }
    
    // 获取AI诊断记录
    const diagnosisRecord = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .doc(diagnosisId).get()
    
    console.log('诊断记录查询结果:', diagnosisRecord.data ? '找到记录' : '未找到记录')
    
    if (!diagnosisRecord.data) {
      throw new Error(`诊断记录不存在 (ID: ${diagnosisId})`)
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
    
    // ✨ 创建健康记录，记录病鹅数量到"异常"统计
    try {
      // 获取批次当前存栏数
      const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId)
        .get()
      
      if (batchResult.data) {
        const batch = batchResult.data
        const currentCount = batch.currentCount || batch.quantity || 0
        const healthyCount = Math.max(0, currentCount - affectedCount)
        
        // 创建健康记录
        const healthRecordData = {
          batchId,
          recordType: 'ai_diagnosis',
          checkDate: new Date().toISOString().split('T')[0],
          inspector: openid,
          totalCount: currentCount,
          healthyCount: healthyCount,
          sickCount: affectedCount,
          deadCount: 0,
          symptoms: diagnosisRecord.data.symptoms || [],
          diagnosis: diagnosis || diagnosisRecord.data.primaryDiagnosis?.disease || '待确定',
          treatment: treatmentData.treatmentPlan?.primary || '',
          notes: `AI诊断：${diagnosis}，置信度${diagnosisRecord.data.primaryDiagnosis?.confidence || 0}%`,
          followUpRequired: true,
          followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          severity: diagnosisRecord.data.severity || 'moderate',
          relatedTreatmentId: result._id,
          relatedDiagnosisId: diagnosisId,
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false
        }
        
        await db.collection(COLLECTIONS.HEALTH_RECORDS).add({
          data: healthRecordData
        })
        
        console.log('✅ 健康记录已创建，病鹅数量:', affectedCount)
      }
    } catch (healthRecordError) {
      console.error('创建健康记录失败（不影响治疗记录）:', healthRecordError)
      // 不影响主流程
    }
    
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
        isDeleted: false,
        isDraft: false  // ✅ 只查询非草稿记录
      })
    
    if (batchId && batchId !== 'all') {
      query = query.where({ batchId })
    }
    
    const records = await query.orderBy('treatmentDate', 'desc').get()
    
    // ✅ 在代码中过滤 outcome.status === 'ongoing' 的记录
    const ongoingTreatments = records.data.filter(r => r.outcome?.status === 'ongoing')
    
    console.log(`✅ 进行中的治疗记录: ${ongoingTreatments.length} / 总记录: ${records.data.length}`)
    
    return {
      success: true,
      data: {
        treatments: ongoingTreatments,
        count: ongoingTreatments.length
      }
    }
    
  } catch (error) {
    console.error('❌ 获取治疗记录失败:', error)
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
    
    // ✅ 修复：使用 outcome.status 而不是 treatmentStatus
    const ongoingCount = records.data.filter(r => r.outcome?.status === 'ongoing').length
    const curedCount = records.data.filter(r => r.outcome?.status === 'cured').length
    const diedCount = records.data.filter(r => r.outcome?.status === 'died').length
    
    const totalTreated = records.data.reduce((sum, r) => sum + (r.outcome?.totalTreated || r.initialCount || 0), 0)
    const totalCuredAnimals = records.data.reduce((sum, r) => sum + (r.outcome?.curedCount || r.curedCount || 0), 0)
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

/**
 * 获取治疗记录详情（用于治疗进展跟进）
 */
async function getTreatmentDetail(treatmentId, wxContext) {
  try {
    if (!treatmentId) {
      throw new Error('缺少治疗记录ID')
    }
    
    // 获取治疗记录
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .get()
    
    if (!treatmentResult.data) {
      throw new Error('治疗记录不存在')
    }
    
    const treatment = treatmentResult.data
    
    // 计算治疗天数
    const startDate = new Date(treatment.treatmentDate)
    const today = new Date()
    const treatmentDays = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24))
    
    // 计算剩余未处理数量
    const totalTreated = treatment.outcome?.totalTreated || 0
    const curedCount = treatment.outcome?.curedCount || 0
    const improvedCount = treatment.outcome?.improvedCount || 0
    const deathCount = treatment.outcome?.deathCount || 0
    const remainingCount = totalTreated - curedCount - deathCount
    
    return {
      success: true,
      data: {
        treatment,
        progress: {
          treatmentDays,
          totalTreated,
          curedCount,
          improvedCount,
          deathCount,
          remainingCount,
          cureRate: totalTreated > 0 ? ((curedCount / totalTreated) * 100).toFixed(1) : 0,
          mortalityRate: totalTreated > 0 ? ((deathCount / totalTreated) * 100).toFixed(1) : 0
        }
      }
    }
  } catch (error) {
    console.error('❌ 获取治疗详情失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取治疗详情失败'
    }
  }
}

/**
 * 更新治疗进展（记录治愈/死亡）
 */
async function updateTreatmentProgress(event, wxContext) {
  try {
    const {
      treatmentId,
      progressType,  // 'cured' | 'died'
      count,
      notes,
      deathCause  // 死亡原因（progressType=died时必填）
    } = event
    
    const openid = wxContext.OPENID
    
    // 参数验证
    if (!treatmentId || !progressType || !count || count <= 0) {
      throw new Error('参数错误：治疗记录ID、进展类型、数量不能为空')
    }
    
    if (progressType === 'died' && !deathCause) {
      throw new Error('记录死亡时必须填写死亡原因')
    }
    
    // 获取治疗记录
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .get()
    
    if (!treatmentResult.data) {
      throw new Error('治疗记录不存在')
    }
    
    const treatment = treatmentResult.data
    
    // 检查治疗状态
    if (treatment.outcome?.status !== 'ongoing') {
      throw new Error('该治疗记录已完成，无法继续记录进展')
    }
    
    // 计算剩余数量
    const totalTreated = treatment.outcome?.totalTreated || 0
    const curedCount = treatment.outcome?.curedCount || 0
    const deathCount = treatment.outcome?.deathCount || 0
    const remainingCount = totalTreated - curedCount - deathCount
    
    // 验证数量
    if (count > remainingCount) {
      throw new Error(`数量超出范围，当前剩余治疗数：${remainingCount}`)
    }
    
    // 更新数据
    const updateData = {
      updatedAt: new Date()
    }
    
    if (progressType === 'cured') {
      updateData['outcome.curedCount'] = curedCount + count
    } else if (progressType === 'died') {
      updateData['outcome.deathCount'] = deathCount + count
    }
    
    // 计算新的剩余数量和状态
    const newCuredCount = progressType === 'cured' ? curedCount + count : curedCount
    const newDeathCount = progressType === 'died' ? deathCount + count : deathCount
    const newRemainingCount = totalTreated - newCuredCount - newDeathCount
    
    // 自动判断治疗状态
    if (newRemainingCount === 0) {
      if (newDeathCount === 0) {
        updateData['outcome.status'] = 'cured'  // 全部治愈
      } else if (newCuredCount === 0) {
        updateData['outcome.status'] = 'died'  // 全部死亡
      } else {
        updateData['outcome.status'] = 'completed'  // 部分治愈+部分死亡
      }
    }
    
    // 更新治疗记录
    await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .update({
        data: updateData
      })
    
    // 如果是记录死亡，创建死亡记录
    if (progressType === 'died') {
      const deathRecordData = {
        batchId: treatment.batchId,
        treatmentRecordId: treatmentId,
        deathDate: new Date().toISOString().split('T')[0],
        deathCount: count,
        deathCause: deathCause,
        deathCategory: 'disease',
        costPerAnimal: 0,
        totalCost: 0,
        notes: notes || '',
        isDeleted: false,
        createdBy: openid,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
        data: deathRecordData
      })
    }
    
    // 如果治疗记录关联了异常记录，更新异常记录状态
    if (treatment.abnormalRecordId && newRemainingCount === 0) {
      const newAbnormalStatus = updateData['outcome.status'] === 'cured' ? 'resolved' : 'completed'
      await db.collection(COLLECTIONS.HEALTH_RECORDS)
        .doc(treatment.abnormalRecordId)
        .update({
          data: {
            status: newAbnormalStatus,
            updatedAt: new Date()
          }
        })
    }
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'update_treatment_progress',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentId,
      {
        progressType,
        count,
        newStatus: updateData['outcome.status'],
        result: 'success'
      }
    )
    
    console.log(`✅ 治疗进展更新成功: ${progressType} ${count}只, 剩余${newRemainingCount}只`)
    
    return {
      success: true,
      data: {
        remainingCount: newRemainingCount,
        newStatus: updateData['outcome.status'] || 'ongoing',
        curedCount: newCuredCount,
        deathCount: newDeathCount
      },
      message: progressType === 'cured' ? '治愈记录成功' : '死亡记录成功'
    }
    
  } catch (error) {
    console.error('❌ 更新治疗进展失败:', error)
    return {
      success: false,
      error: error.message,
      message: '更新治疗进展失败'
    }
  }
}

/**
 * 创建死亡记录并关联财务（死因剖析专用）
 */
async function createDeathRecordWithFinance(event, wxContext) {
  try {
    const {
      diagnosisId,
      batchId,
      deathCount,
      deathCause,
      deathCategory = 'disease',
      autopsyFindings,
      diagnosisResult,
      images = []
    } = event
    
    const openid = wxContext.OPENID
    
    // 验证必填参数
    if (!batchId || !deathCount || deathCount <= 0) {
      throw new Error('批次ID和死亡数量不能为空')
    }
    
    // 1. 获取批次信息，计算单位成本
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .doc(batchId)
      .get()
    
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }
    
    const batch = batchResult.data
    
    // 计算单位成本（使用 calculateBatchCost 函数获取综合成本）
    let unitCost = 0
    try {
      const costResult = await calculateBatchCost({ batchId }, wxContext)
      console.log('📊 成本计算结果:', JSON.stringify(costResult))
      if (costResult.success && costResult.data.avgCost) {
        unitCost = parseFloat(costResult.data.avgCost)
        console.log('✅ 使用计算的平均成本:', unitCost)
      }
    } catch (costError) {
      console.error('⚠️ 计算成本失败，将使用入栏单价:', costError.message)
    }
    
    // 如果计算失败或为0，使用入栏单价
    if (unitCost === 0 || isNaN(unitCost)) {
      const batchUnitCost = batch.unitCost || 0
      const defaultCost = 50 // 最低保底成本
      
      // 优先使用批次入栏单价，如果为0则使用默认值
      unitCost = batchUnitCost > 0 ? batchUnitCost : defaultCost
      
      console.log(`📝 批次入栏单价: ${batchUnitCost}元, 最终使用成本: ${unitCost}元`)
    }
    
    const financeLoss = unitCost * deathCount
    console.log(`💰 财务损失计算: ${unitCost}元/只 × ${deathCount}只 = ${financeLoss}元`)
    
    // 获取用户信息
    let userName = 'KAKA'
    try {
      const userResult = await db.collection(COLLECTIONS.WX_USERS)
        .where({ _openid: openid })
        .limit(1)
        .get()
      
      if (userResult.data && userResult.data.length > 0) {
        const user = userResult.data[0]
        userName = user.nickName || user.nickname || user.farmName || user.position || 'KAKA'
      }
    } catch (userError) {
      console.error('获取用户信息失败:', userError)
    }
    
    // 2. 创建死亡记录
    const deathRecordData = {
      _openid: openid,
      openid: openid,
      batchId: batchId,
      batchNumber: batch.batchNumber || '',
      deathDate: new Date().toISOString().split('T')[0],
      deathCount: deathCount,
      deathCause: deathCause || '待确定',
      deathCategory: deathCategory,
      disposalMethod: 'burial', // 默认深埋
      autopsyFindings: autopsyFindings || '',
      photos: images || [], // 保存剖检图片
      aiDiagnosisId: diagnosisId || null,
      diagnosisResult: diagnosisResult || null,
      financeLoss: parseFloat(financeLoss.toFixed(2)),
      unitCost: parseFloat(unitCost.toFixed(2)),
      operator: openid,
      reporterName: userName,  // 添加记录者名称
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false
    }
    
    const deathRecordResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
      data: deathRecordData
    })
    
    const deathRecordId = deathRecordResult._id
    
    // 3. 调用财务管理云函数创建成本记录
    try {
      await cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'createDeathLossRecord',
          batchId: batchId,
          relatedRecordId: deathRecordId,
          relatedDiagnosisId: diagnosisId,
          deathCount: deathCount,
          unitCost: unitCost,
          totalLoss: financeLoss,
          deathCause: deathCause,
          description: `死因剖析：${deathCause}，损失${deathCount}只，单位成本${unitCost.toFixed(2)}元`
        }
      })
    } catch (financeError) {
      console.error('创建财务记录失败:', financeError)
      // 即使财务记录失败，死亡记录也已创建，继续返回成功
    }
    
    // 4. 更新批次存栏量
    try {
      await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId)
        .update({
          data: {
            currentCount: _.inc(-deathCount),
            deadCount: _.inc(deathCount),
            updatedAt: new Date()
          }
        })
    } catch (updateError) {
      console.error('更新批次信息失败:', updateError)
    }
    
    return {
      success: true,
      data: {
        deathRecordId: deathRecordId,
        financeLoss: financeLoss,
        unitCost: unitCost
      },
      message: '死亡记录创建成功，已关联财务损失'
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
 * 获取死亡记录列表
 */
async function getDeathRecordsList(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    
    // 查询用户的所有死亡记录，按日期倒序
    const result = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({
        _openid: openid,
        isDeleted: false
      })
      .orderBy('deathDate', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    
    return {
      success: true,
      data: result.data || [],
      message: '获取死亡记录列表成功'
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '获取死亡记录列表失败'
    }
  }
}

/**
 * 获取死亡记录详情
 */
async function getDeathRecordDetail(event, wxContext) {
  try {
    const { recordId } = event
    const openid = wxContext.OPENID
    
    if (!recordId) {
      throw new Error('记录ID不能为空')
    }
    
    // 查询记录详情
    const result = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!result.data) {
      throw new Error('记录不存在')
    }
    
    const record = result.data
    
    // 验证权限
    if (record._openid !== openid) {
      throw new Error('无权访问此记录')
    }
    
    // 字段映射：photos -> autopsyImages（前端期望的字段名）
    if (record.photos && record.photos.length > 0) {
      record.autopsyImages = record.photos
    }
    
    // 如果有AI诊断ID，获取完整的诊断信息
    if (record.aiDiagnosisId) {
      try {
        const diagnosisResult = await db.collection('health_ai_diagnosis')
          .doc(record.aiDiagnosisId)
          .get()
        
        if (diagnosisResult.data && diagnosisResult.data.result) {
          // 将诊断结果合并到record中
          record.diagnosisResult = diagnosisResult.data.result
        }
      } catch (diagnosisError) {
        console.error('获取AI诊断详情失败:', diagnosisError)
        // 不影响主流程
      }
    }
    
    // 格式化修正时间
    if (record.correctedAt) {
      const date = new Date(record.correctedAt)
      record.correctedAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
    
    return {
      success: true,
      data: record,
      message: '获取死亡记录详情成功'
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '获取死亡记录详情失败'
    }
  }
}

/**
 * 修正死亡诊断
 */
async function correctDeathDiagnosis(event, wxContext) {
  try {
    const {
      recordId,
      correctedCause,
      correctionReason, // 兽医诊断（前端的veterinarianDiagnosis字段）
      aiAccuracyRating,
      isConfirmed = false
    } = event
    
    const openid = wxContext.OPENID
    
    // 验证必填参数
    if (!recordId) {
      throw new Error('记录ID不能为空')
    }
    if (!correctedCause) {
      throw new Error('修正后的死因不能为空')
    }
    if (!correctionReason) {
      throw new Error('修正依据不能为空')
    }
    if (!aiAccuracyRating || aiAccuracyRating < 1 || aiAccuracyRating > 5) {
      throw new Error('AI准确性评分必须在1-5之间')
    }
    
    // 获取当前记录
    const recordResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!recordResult.data) {
      throw new Error('记录不存在')
    }
    
    const record = recordResult.data
    
    // 验证权限
    if (record._openid !== openid) {
      throw new Error('无权修改此记录')
    }
    
    // 获取用户信息（用于记录修正人姓名）
    let userName = '未知用户'
    try {
      const userResult = await db.collection('wx_users')
        .where({ _openid: openid })
        .limit(1)
        .get()
      
      if (userResult.data && userResult.data.length > 0) {
        // 优先使用用户昵称，其次养殖场名称，最后职位
        const user = userResult.data[0]
        userName = user.nickName || user.nickname || user.farmName || user.position || '未知用户'
      }
    } catch (userError) {
      console.error('获取用户信息失败:', userError)
    }
    
    // 确定修正类型
    let correctionType = 'partial_error'
    if (isConfirmed) {
      correctionType = 'confirmed'
    } else if (correctedCause === record.deathCause) {
      correctionType = 'supplement'
    } else if (aiAccuracyRating <= 2) {
      correctionType = 'complete_error'
    }
    
    // 更新死亡记录
    const updateData = {
      isCorrected: true,
      originalAiCause: record.originalAiCause || record.deathCause, // 保留原始AI诊断
      correctedCause: correctedCause,
      correctionReason: correctionReason, // 兽医诊断内容
      correctionType: correctionType,
      aiAccuracyRating: aiAccuracyRating,
      correctedBy: openid,
      correctedByName: userName,
      correctedAt: new Date(),
      updatedAt: new Date()
    }
    
    await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .doc(recordId)
      .update({
        data: updateData
      })
    
    // 如果有AI诊断ID，更新AI诊断记录的反馈信息
    if (record.aiDiagnosisId) {
      try {
        await db.collection('health_ai_diagnosis')
          .doc(record.aiDiagnosisId)
          .update({
            data: {
              feedback: {
                isCorrected: true,
                correctedCause: correctedCause,
                correctionReason: correctionReason,
                aiAccuracyRating: aiAccuracyRating,
                correctedAt: new Date()
              },
              updatedAt: new Date()
            }
          })
      } catch (feedbackError) {
        console.error('更新AI诊断反馈失败:', feedbackError)
        // 不影响主流程
      }
    }
    
    return {
      success: true,
      data: {
        recordId: recordId,
        correctionType: correctionType
      },
      message: isConfirmed ? '诊断确认成功' : '诊断修正成功'
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '修正诊断失败'
    }
  }
}
