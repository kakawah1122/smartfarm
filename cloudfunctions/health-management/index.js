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
      diagnosisId,  // 保留原字段名兼容性
      relatedDiagnosisId: diagnosisId,  // ✅ 统一使用 relatedDiagnosisId 字段名
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


    // 使用health_records collection，但状态为abnormal
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS).add({
      data: recordData
    })
    

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
      treatmentType,  // ✅ 接收治疗类型
      isDirectSubmit  // ✅ 接收是否直接提交标记
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
    } else {
    }
    
    
    // ✅ 所有治疗记录都创建为正式记录（不使用草稿）
    const hasMedicationsPayload = Array.isArray(medications) && medications.length > 0
    const hasMedicationsEvent = !!event.hasMedications
    const hasMedications = hasMedicationsPayload || hasMedicationsEvent
    
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
        status: 'ongoing',  // ✅ 始终创建为正式记录
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
      isDraft: false,  // ✅ 始终为正式记录
      isDeleted: false,
      createdBy: openid,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).add({
      data: treatmentData
    })
    
    
    // ✅ 如果是直接提交且有药物使用，扣减库存并创建领用记录
    let totalMedicationCost = 0  // ✅ 累计用药成本
    
    if (isDirectSubmit && medications && medications.length > 0) {
      
      for (const med of medications) {
        if (!med.materialId || !med.quantity || med.quantity <= 0) {
          continue
        }
        
        try {
          // 使用事务确保数据一致性
          const transaction = await db.startTransaction()
          
          // 1. 查询当前库存
          const materialResult = await transaction.collection('prod_materials')
            .doc(med.materialId)
            .get()
          
          if (!materialResult.data) {
            await transaction.rollback()
            continue
          }
          
          const material = materialResult.data
          const currentStock = material.currentStock || 0
          const quantity = parseFloat(med.quantity) || 0
          
          if (currentStock < quantity) {
            await transaction.rollback()
            continue
          }
          
          // ✅ 计算该药品的成本
          const unitPrice = material.unitPrice || material.avgCost || 0
          const medicationCost = unitPrice * quantity
          totalMedicationCost += medicationCost
          
          // 2. 扣减库存
          await transaction.collection('prod_materials')
            .doc(med.materialId)
            .update({
              data: {
                currentStock: _.inc(-quantity),
                updateTime: db.serverDate()
              }
            })
          
          // 3. 创建物资领用记录（主记录）
          const materialRecordResult = await transaction.collection('prod_material_records').add({
            data: {
              type: 'use',
              materialId: med.materialId,
              materialCode: material.code || med.materialCode || '',
              materialName: med.name || material.name,
              category: material.category || med.category || 'medicine',
              quantity: quantity,
              unit: med.unit || material.unit,
              recordDate: new Date().toISOString().split('T')[0],
              relatedModule: 'health_treatment',
              relatedId: treatmentResult._id,
              notes: `制定治疗方案 - ${diagnosis} - 用法：${med.dosage || '无'}`,
              operator: openid,
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          })
          
          // 4. 创建库存流水（追踪记录）
          await transaction.collection('prod_inventory_logs').add({
            data: {
              materialId: med.materialId,
              recordId: materialRecordResult._id,  // ✅ 关联物资记录
              materialCode: material.code || med.materialCode,
              materialName: med.name || material.name,
              category: material.category,
              operation: '治疗领用',
              operationType: '治疗领用',
              quantity: -quantity,  // 负数表示出库
              unit: med.unit || material.unit,
              beforeStock: material.currentStock,
              afterStock: material.currentStock - quantity,
              relatedModule: 'health_treatment',
              relatedId: treatmentResult._id,
              notes: `制定治疗方案领用：${med.name}，用法：${med.dosage || '无'}`,
              operator: openid,
              createTime: db.serverDate()
            }
          })
          
          // 提交事务
          await transaction.commit()
          
        } catch (error) {
          console.error(`❌ 处理药品库存失败: ${med.name}`, error)
          // 继续处理下一个药品，不阻断治疗记录创建
        }
      }
      
      // ✅ 更新治疗记录的用药成本
      if (totalMedicationCost > 0) {
        try {
          await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
            .doc(treatmentResult._id)
            .update({
              data: {
                'cost.medication': parseFloat(totalMedicationCost.toFixed(2)),
                'cost.total': parseFloat(totalMedicationCost.toFixed(2)),
                totalCost: parseFloat(totalMedicationCost.toFixed(2)),  // 兼容字段
                updatedAt: new Date()
              }
            })
        } catch (costError) {
          console.error('❌ 更新治疗成本失败:', costError)
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
    
    
    // ✅ 如果没有 affectedCount，从异常记录中获取
    let finalAffectedCount = affectedCount
    if (!finalAffectedCount) {
      const abnormalRecord = await db.collection(COLLECTIONS.HEALTH_RECORDS)
        .doc(abnormalRecordId)
        .get()
      
      if (abnormalRecord.data) {
        finalAffectedCount = abnormalRecord.data.affectedCount || 1
      }
    } else {
    }
    
    
    // 创建隔离记录
    const isolationData = {
      batchId,
      abnormalRecordId,  // 关联异常记录
      isolationDate: new Date().toISOString().split('T')[0],
      isolatedCount: finalAffectedCount || 0,
      diagnosis: diagnosis || '',
      isolationLocation: '',  // 隔离位置
      isolationReason: diagnosis || '',
      status: 'ongoing',  // ongoing | completed
      dailyRecords: [],  // 每日观察记录
      outcome: {
        recoveredCount: 0,
        diedCount: 0,
        stillIsolatedCount: finalAffectedCount || 0
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
        affectedCount: finalAffectedCount,  // ✅ 使用最终确定的数量
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
    
    
    // ✅ 只查询真正的异常记录（待处理状态），已流转到治疗中或隔离的不计入异常数
    let whereCondition = {
      recordType: 'ai_diagnosis',
      status: 'abnormal',  // ✅ 只查询 abnormal 状态，不包括 treating 和 isolated
      isDeleted: _.neq(true)
    }
    
    if (batchId && batchId !== 'all') {
      whereCondition.batchId = batchId
    }
    
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where(whereCondition)
      .orderBy('checkDate', 'desc')
      .get()
    
    if (result.data.length > 0) {
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

// 查询各状态的健康记录（待处理/治疗中/隔离）
async function getHealthRecordsByStatus(event, wxContext) {
  try {
    const { batchId, status } = event  // status: 'abnormal' | 'treating' | 'isolated'
    const db = cloud.database()
    
    
    let whereCondition = {
      recordType: 'ai_diagnosis',
      status: status || 'abnormal',
      isDeleted: _.neq(true)
    }
    
    if (batchId && batchId !== 'all') {
      whereCondition.batchId = batchId
    }
    
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where(whereCondition)
      .get()
    
    // ✅ 累加受影响的动物数量
    const totalCount = result.data.reduce((sum, record) => {
      return sum + (record.affectedCount || 0)
    }, 0)
    
    return {
      success: true,
      data: {
        records: result.data,
        totalCount: totalCount,
        recordCount: result.data.length
      },
      message: '获取成功'
    }
  } catch (error) {
    console.error('❌ 查询健康记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取健康记录失败'
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
    // ⚠️ 不在查询中过滤 outcome.status，因为微信云数据库嵌套字段查询可能失败
    const treatingRecordsResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        batchId,
        isDeleted: _.neq(true)
      })
      .get()
    
    // ✅ 在代码中过滤进行中的治疗记录（包含 ongoing 和 pending）
    const treatingRecords = treatingRecordsResult.data.filter(r => {
      const status = r.outcome?.status
      return status === 'ongoing' || status === 'pending'
    })
    
    const treatingCount = treatingRecords.reduce((sum, record) => {
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
        // 尝试同时使用批次ID和批次号查询（因为治疗记录可能存储的是批次号）
        const deathRecordsByIdResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
          .where({
            batchId: batch._id,
            isDeleted: false
          })
          .get()
        
        const deathRecordsByNumberResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
          .where({
            batchId: batch.batchNumber,
            isDeleted: false
          })
          .get()
        
        // 合并两次查询结果（去重）
        const allDeathRecords = [...deathRecordsByIdResult.data]
        const existingIds = new Set(allDeathRecords.map(r => r._id))
        deathRecordsByNumberResult.data.forEach(record => {
          if (!existingIds.has(record._id)) {
            allDeathRecords.push(record)
          }
        })
        
        let deadCount = 0
        allDeathRecords.forEach(record => {
          deadCount += record.deathCount || 0
        })
        
        // ✅ 当前存栏数 = 原始数量 - 实时死亡数 - 出栏数
        const exitedCount = exitQuantityMap[batch.batchNumber] || 0
        let totalCount = originalQuantity - deadCount - exitedCount
        
        let healthyCount = 0
        let sickCount = 0
        let healthyRate = 100
        let lastCheckDate = null
        let recentIssues = []
        
        // ✅ 查询待处理记录条数（用于界面显示）
        const abnormalRecordsResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
          .where({
            batchId: batch._id,
            recordType: 'ai_diagnosis',
            status: 'abnormal',
            isDeleted: _.neq(true)
          })
          .count()
        
        const abnormalRecordCount = abnormalRecordsResult.total || 0
        
        // ✅ 查询所有治疗记录（包括药物治疗和隔离）
        // ⚠️ 不在查询中过滤 outcome.status，因为微信云数据库嵌套字段查询可能失败
        const allTreatmentRecordsResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
          .where({
            batchId: batch._id,
            isDeleted: _.neq(true)
          })
          .get()
        
        // ✅ 在代码中过滤进行中的治疗记录（包含 ongoing 和旧的 pending 记录）
        const ongoingTreatmentRecords = allTreatmentRecordsResult.data.filter(r => {
          const status = r.outcome?.status
          return status === 'ongoing' || status === 'pending'
        })
        
        // 分别统计治疗中和隔离中的数量
        let treatingCount = 0
        let isolatedCount = 0
        
        ongoingTreatmentRecords.forEach(record => {
          const count = record.outcome?.totalTreated || 0
          if (record.treatmentType === 'isolation') {
            isolatedCount += count
          } else {
            treatingCount += count
          }
        })
        
        // ✅ 查询待处理的动物数量（从 health_records，累加 affectedCount）
        const abnormalAnimalsResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
          .where({
            batchId: batch._id,
            recordType: 'ai_diagnosis',
            status: 'abnormal',
            isDeleted: _.neq(true)
          })
          .get()
        
        const abnormalCount = abnormalAnimalsResult.data.reduce((sum, record) => {
          return sum + (record.affectedCount || 0)
        }, 0)
        
        // ✅ 计算健康数和异常数
        // 异常数 = 待处理 + 治疗中 + 隔离中
        sickCount = abnormalCount + treatingCount + isolatedCount
        // 健康数 = 总存栏 - 异常数
        healthyCount = totalCount - sickCount
        healthyCount = Math.max(0, healthyCount) // 确保不为负数
        
        // 计算健康率
        healthyRate = totalCount > 0 ? ((healthyCount / totalCount) * 100) : 100
        
        if (healthRecords.length > 0) {
          // 有健康记录，获取最近检查日期
          const latestRecord = healthRecords[0]
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
        
        const batchData = {
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          breed: batch.breed || '未知品种',
          dayAge,
          healthyRate: parseFloat(healthyRate.toFixed(1)),
          totalCount,
          healthyCount,
          sickCount,
          deadCount,
          abnormalCount,      // ✅ 待处理动物数
          treatingCount,      // ✅ 治疗中动物数
          isolatedCount,      // ✅ 隔离中动物数
          abnormalRecordCount, // ✅ 待处理记录数
          recentIssues,
          alertLevel,
          lastCheckDate: lastCheckDate || '未检查',
          entryDate: batch.entryDate
        }
        
        batchHealthSummaries.push(batchData)
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
        totalBatches: batchHealthSummaries.length,
        _version: '2025-10-28-v6'  // ✅ 新记录始终为 ongoing，统计兼容旧 pending 记录
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
    
    // 权限验证（兼容 _openid 和 createdBy 两种字段）
    if (treatment._openid !== openid && treatment.createdBy !== openid) {
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
    
    // 权限验证（兼容 _openid 和 createdBy 两种字段）
    if (treatment._openid !== openid && treatment.createdBy !== openid) {
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
    
    // ✅ 计算该药品的成本
    const unitPrice = material.unitPrice || material.avgCost || 0
    const medicationCost = unitPrice * quantity
    
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
      
      // 2. ✅ 创建物资领用记录（主记录）
      const materialRecordResult = await transaction.collection('prod_material_records').add({
        data: {
          type: 'use',  // 领用类型
          materialId: medication.materialId,
          materialCode: medication.materialCode || '',
          materialName: medication.name,
          category: medication.category || 'medicine',
          quantity: quantity,
          unit: medication.unit,
          recordDate: new Date().toISOString().split('T')[0],
          relatedModule: 'health_treatment',
          relatedId: treatmentId,
          notes: `治疗领用 - ${treatment.diagnosis || '待确定'} - 用法：${medication.dosage || '无'}`,
          operator: openid,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      // 3. 创建库存流水（追踪记录）
      await transaction.collection('prod_inventory_logs').add({
        data: {
          materialId: medication.materialId,
          recordId: materialRecordResult._id,  // ✅ 关联物资记录
          materialCode: medication.materialCode,
          materialName: medication.name,
          category: medication.category,
          operation: '治疗领用',
          operationType: '治疗领用',
          quantity: -quantity,  // 负数表示出库
          unit: medication.unit,
          beforeStock: material.currentStock,
          afterStock: material.currentStock - quantity,
          relatedModule: 'health_treatment',
          relatedId: treatmentId,
          notes: `制定治疗方案领用：${medication.name}，用法：${medication.dosage || '无'}`,
          operator: openid,
          createTime: db.serverDate()
        }
      })
      
      // 4. 添加用药记录到治疗记录
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
      
      // ✅ 更新治疗记录（添加用药并累加成本，按实际用药数分摊）
      const totalTreatedAnimals = treatment.outcome?.totalTreated || 1
      const curedCount = treatment.outcome?.curedCount || 0
      const deathCount = treatment.outcome?.deathCount || 0
      const remainingCount = totalTreatedAnimals - curedCount - deathCount
      
      
      // ✅ 计算追加用药的单只成本（给剩余的鹅用）
      const medicationCostPerAnimal = remainingCount > 0 ? medicationCost / remainingCount : 0
      
      // ✅ 换算到总数（用于统一按总数分摊）
      const normalizedMedicationCost = medicationCostPerAnimal * totalTreatedAnimals
      
      // ✅ 累加到总成本
      const currentMedicationCost = treatment.cost?.medication || treatment.totalCost || 0
      const newTotalCost = currentMedicationCost + normalizedMedicationCost
      
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
            'cost.medication': parseFloat(newTotalCost.toFixed(2)),
            'cost.total': parseFloat(newTotalCost.toFixed(2)),
            totalCost: parseFloat(newTotalCost.toFixed(2)),  // 兼容字段
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
    
    // 权限验证（兼容 _openid 和 createdBy 两种字段）
    if (treatment._openid !== openid && treatment.createdBy !== openid) {
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
      
      case 'get_treatment_history':
        return await getTreatmentHistory(event, wxContext)
      
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
      
      case 'get_health_records_by_status':
        return await getHealthRecordsByStatus(event, wxContext)
      
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
    
    // 获取批次入栏信息（容错处理：batchId可能是文档ID或批次号）
    let batch = null
    
    try {
      // 先尝试作为文档ID查询
      const batchEntry = await db.collection('prod_batch_entries')
        .doc(batchId)
        .get()
      batch = batchEntry.data
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection('prod_batch_entries')
        .where({
          batchNumber: batchId,
          isDeleted: _.neq(true)
        })
        .limit(1)
        .get()
      
      if (batchQueryResult.data && batchQueryResult.data.length > 0) {
        batch = batchQueryResult.data[0]
      }
    }
    
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`)
    }
    const entryUnitCost = batch.unitPrice || 0  // ✅ 修正：数据库字段名是 unitPrice
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
    
    // 5. 计算各项成本
    const entryCost = entryUnitCost * initialQuantity
    
    // ✅ 饲养成本 = 只包含物料成本（不含入栏价）
    const avgBreedingCost = currentCount > 0 ? (materialCost / currentCount) : 0
    
    // 综合成本（包含所有成本）
    const totalCost = entryCost + materialCost + preventionCost + treatmentCost
    const avgTotalCost = currentCount > 0 ? (totalCost / currentCount) : 0
    
    return {
      success: true,
      data: {
        avgCost: avgBreedingCost.toFixed(2),
        avgBreedingCost: avgBreedingCost.toFixed(2),
        avgTotalCost: avgTotalCost.toFixed(2),
        entryUnitCost: entryUnitCost.toFixed(2),
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
    
    // 2. 获取批次信息（容错处理：batchId可能是文档ID或批次号）
    let batch = null
    let batchDocId = batchId  // ✅ 批次文档的真实_id
    
    try {
      const batchEntry = await db.collection('prod_batch_entries')
        .doc(batchId).get()
      batch = batchEntry.data
      batchDocId = batchId  // 文档ID就是传入的batchId
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection('prod_batch_entries')
        .where({
          batchNumber: batchId,
          isDeleted: _.neq(true)
        })
        .limit(1)
        .get()
      
      if (batchQueryResult.data && batchQueryResult.data.length > 0) {
        batch = batchQueryResult.data[0]
        batchDocId = batch._id  // ✅ 使用查询到的批次文档的真实_id
      }
    }
    
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`)
    }
    
    // 验证死亡数量不超过当前存栏数
    if (deathCount > batch.currentCount) {
      throw new Error(`死亡数量不能超过当前存栏数(${batch.currentCount})`)
    }
    
    // 3. 计算平均成本（✅ 使用批次文档的真实_id而不是批次号）
    const costResult = await calculateBatchCost({ batchId: batchDocId }, wxContext)
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
    
    // ✅ 扣减库存并创建领用记录（如果有用药）
    const medications = recommendations?.medication || []
    let totalMedicationCost = 0  // ✅ 累计用药成本
    
    if (medications.length > 0) {
      
      for (const medication of medications) {
        if (!medication.materialId) {
          continue
        }
        
        try {
          // 开启事务
          const transaction = await db.startTransaction()
          
          // 1. 查询当前库存
          const materialResult = await transaction.collection('prod_materials')
            .doc(medication.materialId)
            .get()
          
          if (!materialResult.data) {
            await transaction.rollback()
            continue
          }
          
          const material = materialResult.data
          const quantity = medication.quantity || 1
          
          if (material.currentStock < quantity) {
            await transaction.rollback()
            continue
          }
          
          // ✅ 计算该药品的成本
          const unitPrice = material.unitPrice || material.avgCost || 0
          const medicationCost = unitPrice * quantity
          totalMedicationCost += medicationCost
          
          // 2. 扣减库存
          await transaction.collection('prod_materials')
            .doc(medication.materialId)
            .update({
              data: {
                currentStock: _.inc(-quantity),
                updateTime: db.serverDate()
              }
            })
          
          // 3. 创建物资领用记录（主记录）
          const materialRecordResult = await transaction.collection('prod_material_records').add({
            data: {
              type: 'use',
              materialId: medication.materialId,
              materialCode: material.code || '',
              materialName: medication.name,
              category: material.category || 'medicine',
              quantity: quantity,
              unit: medication.unit || material.unit,
              recordDate: new Date().toISOString().split('T')[0],
              relatedModule: 'health_treatment',
              relatedId: result._id,
              notes: `制定治疗方案 - ${diagnosis || '待确定'} - 用法：${medication.dosage || '无'}`,
              operator: openid,
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          })
          
          // 4. 创建库存流水（追踪记录）
          await transaction.collection('prod_inventory_logs').add({
            data: {
              materialId: medication.materialId,
              recordId: materialRecordResult._id,
              materialCode: material.code,
              materialName: medication.name,
              category: material.category,
              operation: '治疗领用',
              operationType: '治疗领用',
              quantity: -quantity,
              unit: medication.unit || material.unit,
              beforeStock: material.currentStock,
              afterStock: material.currentStock - quantity,
              relatedModule: 'health_treatment',
              relatedId: result._id,
              notes: `制定治疗方案领用：${medication.name}，用法：${medication.dosage || '无'}`,
              operator: openid,
              createTime: db.serverDate()
            }
          })
          
          // 提交事务
          await transaction.commit()
          
        } catch (medicationError) {
          console.error(`❌ 处理药品库存失败: ${medication.name}`, medicationError)
          // 继续处理下一个药品，不影响主流程
        }
      }
      
      // ✅ 更新治疗记录的用药成本
      if (totalMedicationCost > 0) {
        try {
          await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
            .doc(result._id)
            .update({
              data: {
                'cost.medication': parseFloat(totalMedicationCost.toFixed(2)),
                'cost.total': parseFloat(totalMedicationCost.toFixed(2)),
                totalCost: parseFloat(totalMedicationCost.toFixed(2)),  // 兼容字段
                updatedAt: new Date()
              }
            })
        } catch (costError) {
          console.error('❌ 更新治疗成本失败:', costError)
        }
      }
    }
    
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
        
      }
    } catch (healthRecordError) {
      console.error('创建健康记录失败（不影响治疗记录）:', healthRecordError)
      // 不影响主流程
    }
    
    // ✅ 更新原异常记录的状态为 'treating'（治疗中），从异常数中移除
    try {
      const abnormalRecordsResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          recordType: 'ai_diagnosis',
          status: 'abnormal',
          relatedDiagnosisId: diagnosisId,
          isDeleted: _.neq(true)
        })
        .get()
      
      if (abnormalRecordsResult.data && abnormalRecordsResult.data.length > 0) {
        // 批量更新所有相关异常记录的状态
        const updatePromises = abnormalRecordsResult.data.map(record => {
          return db.collection(COLLECTIONS.HEALTH_RECORDS).doc(record._id).update({
            data: {
              status: 'treating',  // ✅ 更新状态为治疗中
              relatedTreatmentId: result._id,  // 关联治疗记录
              updatedAt: new Date()
            }
          })
        })
        
        await Promise.all(updatePromises)
      }
    } catch (updateError) {
      console.error('更新异常记录状态失败（不影响主流程）:', updateError)
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
    
    // 获取批次信息计算损失（容错处理）
    try {
      let batch = null
      let batchDocId = treatment.batchId  // ✅ 批次文档的真实_id
      
      try {
        const batchEntry = await db.collection('prod_batch_entries')
          .doc(treatment.batchId).get()
        batch = batchEntry.data
        batchDocId = treatment.batchId  // 文档ID就是传入的batchId
      } catch (err) {
        // 如果文档不存在，尝试通过批次号查询
        const batchQueryResult = await db.collection('prod_batch_entries')
          .where({
            batchNumber: treatment.batchId,
            isDeleted: _.neq(true)
          })
          .limit(1)
          .get()
        
        if (batchQueryResult.data && batchQueryResult.data.length > 0) {
          batch = batchQueryResult.data[0]
          batchDocId = batch._id  // ✅ 使用查询到的批次文档的真实_id
        }
      }
      
      if (batch) {
        const avgCost = await calculateBatchCost({ batchId: batchDocId }, wxContext)
        const costPerAnimal = avgCost.data?.averageCost || 0
        const totalLoss = (costPerAnimal * actualDiedCount) + treatment.totalCost
        
        deathRecordData.financialLoss = {
          costPerAnimal,
          totalLoss,
          treatmentCost: treatment.totalCost,
          currency: 'CNY'
        }
        deathRecordData.batchNumber = batch.batchNumber
      }
    } catch (costError) {
      console.error('计算财务损失失败:', costError.message)
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
    // 获取批次当前存栏数（容错处理：batchId可能是文档ID或批次号）
    let batch = null
    
    try {
      const batchEntry = await db.collection('prod_batch_entries').doc(batchId).get()
      batch = batchEntry.data
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection('prod_batch_entries')
        .where({
          batchNumber: batchId,
          isDeleted: _.neq(true)
        })
        .limit(1)
        .get()
      
      if (batchQueryResult.data && batchQueryResult.data.length > 0) {
        batch = batchQueryResult.data[0]
      }
    }
    
    if (!batch) {
      return
    }
    
    const currentStock = batch.currentCount || 0
    
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
    // 1. 获取批次当前存栏数（已扣除死亡）（容错处理：batchId可能是文档ID或批次号）
    let batch = null
    
    try {
      const batchEntry = await db.collection('prod_batch_entries').doc(batchId).get()
      batch = batchEntry.data
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection('prod_batch_entries')
        .where({
          batchNumber: batchId,
          isDeleted: _.neq(true)
        })
        .limit(1)
        .get()
      
      if (batchQueryResult.data && batchQueryResult.data.length > 0) {
        batch = batchQueryResult.data[0]
      }
    }
    
    if (!batch) {
      return '0'
    }
    
    const currentStock = batch.currentCount || 0
    
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
    
    // ✅ 在代码中过滤进行中的治疗记录（包含 ongoing 和 pending）
    const ongoingTreatments = records.data.filter(r => {
      const status = r.outcome?.status
      return status === 'ongoing' || status === 'pending'
    })
    
    
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
    
    // ✅ 修复：使用 outcome.status，包含 ongoing 和 pending 状态
    const ongoingRecords = records.data.filter(r => {
      const status = r.outcome?.status
      return status === 'ongoing' || status === 'pending'
    })
    const ongoingCount = ongoingRecords.length  // 记录条数
    
    // ✅ 计算治疗中的动物总数（记录的受影响动物数累加）
    const ongoingAnimalsCount = ongoingRecords.reduce((sum, r) => {
      return sum + (r.outcome?.totalTreated || r.initialCount || 0)
    }, 0)
    
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
        ongoingCount,  // 治疗中记录条数
        ongoingAnimalsCount,  // ✅ 治疗中动物总数
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
 * 获取治疗历史记录
 */
async function getTreatmentHistory(event, wxContext) {
  try {
    const { batchId, limit = 5 } = event
    const openid = wxContext.OPENID
    
    // 构建查询条件
    const where = {
      _openid: openid,
      isDeleted: _.neq(true)
    }
    
    // 如果指定了批次ID，添加批次条件
    if (batchId && batchId !== 'all') {
      where.batchId = batchId
    }
    
    // 查询治疗记录（包括药物治疗和隔离记录）
    const treatmentRecordsResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where(where)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    
    const isolationRecordsResult = await db.collection(COLLECTIONS.HEALTH_ISOLATION_RECORDS)
      .where(where)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    
    // 合并两种记录
    const allRecords = [
      ...treatmentRecordsResult.data.map(r => ({
        ...r,
        treatmentType: 'medication',
        diagnosis: r.diagnosisDisease || r.diagnosis || '未知疾病'
      })),
      ...isolationRecordsResult.data.map(r => ({
        ...r,
        treatmentType: 'isolation',
        diagnosis: r.diagnosisDisease || r.diagnosis || '隔离观察'
      }))
    ]
    
    // 按创建时间排序
    allRecords.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      return timeB - timeA
    })
    
    // 只返回指定数量
    const records = allRecords.slice(0, limit)
    
    // 为每条记录添加批次号（如果有的话）
    for (const record of records) {
      if (record.batchId) {
        try {
          const batchResult = await db.collection('prod_batch_entries')
            .where({
              _id: record.batchId,
              isDeleted: _.neq(true)
            })
            .limit(1)
            .get()
          
          if (batchResult.data && batchResult.data.length > 0) {
            record.batchNumber = batchResult.data[0].batchNumber
          } else {
            // 尝试用批次号查询
            const batchByNumberResult = await db.collection('prod_batch_entries')
              .where({
                batchNumber: record.batchId,
                isDeleted: _.neq(true)
              })
              .limit(1)
              .get()
            
            if (batchByNumberResult.data && batchByNumberResult.data.length > 0) {
              record.batchNumber = batchByNumberResult.data[0].batchNumber
            } else {
              record.batchNumber = record.batchId
            }
          }
        } catch (err) {
          record.batchNumber = record.batchId
        }
      }
    }
    
    
    return {
      success: true,
      data: {
        records,
        total: records.length
      },
      message: '获取治疗历史记录成功'
    }
    
  } catch (error) {
    console.error('❌ 获取治疗历史记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取治疗历史记录失败'
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
      deathCause  // 死亡原因（可选）
    } = event
    
    const openid = wxContext.OPENID
    
    // 参数验证
    if (!treatmentId || !progressType || !count || count <= 0) {
      throw new Error('参数错误：治疗记录ID、进展类型、数量不能为空')
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
    
    // 如果是记录死亡，创建死亡记录并更新批次死亡数
    if (progressType === 'died') {
      
      // 1️⃣ 获取批次信息（容错处理：batchId可能是文档ID或批次号）
      let batch = null
      let batchNumber = treatment.batchId
      let batchDocId = treatment.batchId  // ✅ 批次文档的真实_id
      
      try {
        // 先尝试作为文档ID查询
        const batchResult = await db.collection('prod_batch_entries')
          .doc(treatment.batchId)
          .get()
        batch = batchResult.data
        batchNumber = batch?.batchNumber || treatment.batchId
        batchDocId = treatment.batchId  // 文档ID就是传入的batchId
      } catch (err) {
        // 如果文档不存在，尝试通过批次号查询
        console.log('批次ID查询失败，尝试通过批次号查询:', treatment.batchId)
        try {
          const batchQueryResult = await db.collection('prod_batch_entries')
            .where({
              batchNumber: treatment.batchId,
              isDeleted: _.neq(true)
            })
            .limit(1)
            .get()
          
          if (batchQueryResult.data && batchQueryResult.data.length > 0) {
            batch = batchQueryResult.data[0]
            batchNumber = batch.batchNumber
            batchDocId = batch._id  // ✅ 使用查询到的批次文档的真实_id
            console.log('通过批次号查询成功，批次号:', batchNumber, '文档ID:', batchDocId)
          } else {
            console.warn('未找到批次信息:', treatment.batchId)
            // 批次不存在，使用默认值
            batchNumber = treatment.batchId
          }
        } catch (err2) {
          console.error('批次查询失败:', err2.message)
          batchNumber = treatment.batchId
        }
      }
      
      // 2️⃣ 计算成本数据（✅ 使用批次文档的真实_id而不是批次号）
      let unitCost = 0
      let breedingCostPerAnimal = 0
      
      console.log('========== 批次成本计算开始 ==========')
      console.log('治疗记录中的 batchId:', treatment.batchId)
      console.log('查询到的批次文档ID:', batchDocId)
      console.log('查询到的批次号:', batchNumber)
      console.log('批次数据:', JSON.stringify(batch))
      
      if (batch) {
        try {
          console.log('调用 calculateBatchCost，传入 batchId:', batchDocId)
          const costResult = await calculateBatchCost({ batchId: batchDocId }, wxContext)
          console.log('calculateBatchCost 返回结果:', JSON.stringify(costResult))
          
          if (costResult.success) {
            unitCost = parseFloat(costResult.data.entryUnitCost || 0)
            breedingCostPerAnimal = parseFloat(costResult.data.avgBreedingCost || 0)
            console.log('从成本计算结果获取 - 入栏单价:', unitCost, '饲养成本:', breedingCostPerAnimal)
          }
        } catch (costError) {
          console.error('❌ 计算成本失败:', costError)
          console.error('错误详情:', costError.message, costError.stack)
        }
        
        // 如果成本计算失败，尝试直接使用批次入栏单价
        if ((unitCost === 0 || isNaN(unitCost)) && batch) {
          unitCost = batch.unitPrice || 0  // ✅ 修正：数据库字段名是 unitPrice
          console.log('使用批次文档中的入栏单价:', unitCost)
          console.log('批次对象的 unitPrice 字段:', batch.unitPrice)
        }
      } else {
        console.error('❌ 批次数据为空')
      }
      
      console.log('最终获取的入栏单价:', unitCost)
      console.log('========== 批次成本计算结束 ==========')
      
      if (unitCost === 0) {
        console.warn(`❌ 批次 ${batchNumber} (文档ID: ${batchDocId}) 缺少入栏单价`)
        console.warn('批次完整数据:', JSON.stringify(batch, null, 2))
        throw new Error(`批次 ${batchNumber} 缺少入栏单价，请先补充批次入栏单价`)
      }
      
      // 3️⃣ 提取死因（处理对象或字符串）
      let diagnosisText = '治疗中死亡'
      if (deathCause) {
        diagnosisText = deathCause
      } else if (treatment.diagnosis) {
        // 如果 diagnosis 是对象，提取字符串
        if (typeof treatment.diagnosis === 'object') {
          diagnosisText = treatment.diagnosis.preliminary || 
                         treatment.diagnosis.confirmed || 
                         treatment.diagnosis.disease || 
                         '治疗中死亡'
        } else {
          diagnosisText = treatment.diagnosis
        }
      }
      
      // 4️⃣ 计算治疗成本（按单只分摊）
      const totalTreatedAnimals = treatment.outcome?.totalTreated || 1
      const totalTreatmentCost = treatment.cost?.total || treatment.totalCost || 0
      const totalMedicationCost = treatment.cost?.medication || 0
      
      // ✅ 计算单只分摊成本
      const treatmentCostPerAnimal = totalTreatmentCost / totalTreatedAnimals
      const medicationCostPerAnimal = totalMedicationCost / totalTreatedAnimals
      
      // ✅ 计算死亡数的实际成本
      const deathTreatmentCost = treatmentCostPerAnimal * count
      const deathMedicationCost = medicationCostPerAnimal * count
      
      // 计算财务损失 = 入栏单价 + 物料成本 + 治疗成本
      const entryCostLoss = unitCost * count
      const breedingCostLoss = breedingCostPerAnimal * count
      const financeLoss = entryCostLoss + breedingCostLoss + deathTreatmentCost
      
      // 创建死亡记录
      const deathRecordData = {
        batchId: treatment.batchId,
        batchNumber: batchNumber,
        treatmentRecordId: treatmentId,
        deathDate: new Date().toISOString().split('T')[0],
        deathCount: count,
        deathCause: diagnosisText,
        deathCategory: 'disease',
        source: 'treatment',  // ✅ 标记来源为治疗记录（治疗前已确认诊断，不需要再次修正）
        financeLoss: parseFloat(financeLoss.toFixed(2)),
        unitCost: parseFloat(unitCost.toFixed(2)),
        breedingCost: parseFloat(breedingCostLoss.toFixed(2)),
        costPerAnimal: parseFloat(unitCost.toFixed(2)),
        totalCost: parseFloat(financeLoss.toFixed(2)),
        treatmentCost: parseFloat(deathTreatmentCost.toFixed(2)),
        medicationCost: parseFloat(deathMedicationCost.toFixed(2)),
        treatmentCostPerAnimal: parseFloat(treatmentCostPerAnimal.toFixed(2)),
        medications: treatment.medications || [],
        notes: notes || '',
        isDeleted: false,
        _openid: openid,
        createdBy: openid,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      // 创建死亡记录
      const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
        data: deathRecordData
      })
      
      // ✅ 更新批次的死亡数（容错处理，因为可能 batchId 是批次号而不是文档ID）
      
      try {
        // 尝试查询批次文档
        const batchDoc = await db.collection(COLLECTIONS.PRODUCTION_BATCHES)
          .doc(treatment.batchId)
          .get()
        
        if (batchDoc.data) {
          // 批次文档存在，直接更新
          await db.collection(COLLECTIONS.PRODUCTION_BATCHES)
            .doc(treatment.batchId)
            .update({
              data: {
                deadCount: _.inc(count),
                updatedAt: new Date()
              }
            })
        }
      } catch (err) {
        // 文档不存在或查询失败（可能 batchId 是 batchNumber）
        
        try {
          const entryResult = await db.collection('prod_batch_entries')
            .where({
              batchNumber: treatment.batchId,
              isDeleted: _.neq(true)
            })
            .limit(1)
            .get()
          
          if (entryResult.data && entryResult.data.length > 0) {
            const entry = entryResult.data[0]
          } else {
          }
        } catch (err2) {
        }
      }
      
    }
    
    // ✅ 如果是记录治愈，计算治愈成本并更新批次
    if (progressType === 'cured') {
      
      // 1️⃣ 计算治愈成本（按单只分摊）
      const totalTreatedAnimals = treatment.outcome?.totalTreated || 1
      const totalTreatmentCost = treatment.cost?.total || treatment.totalCost || 0
      const totalMedicationCost = treatment.cost?.medication || 0
      
      // ✅ 计算单只分摊成本
      const treatmentCostPerAnimal = totalTreatmentCost / totalTreatedAnimals
      const medicationCostPerAnimal = totalMedicationCost / totalTreatedAnimals
      
      // ✅ 计算治愈数的实际成本
      const cureTreatmentCost = treatmentCostPerAnimal * count
      const cureMedicationCost = medicationCostPerAnimal * count
      
      
      // 2️⃣ 记录治愈成本（添加到治疗记录的outcome中）
      try {
        await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
          .doc(treatmentId)
          .update({
            data: {
              'outcome.curedCost': _.inc(cureTreatmentCost),
              'outcome.curedMedicationCost': _.inc(cureMedicationCost),
              updatedAt: new Date()
            }
          })
      } catch (costError) {
      }
      
      // 3️⃣ 更新批次的病态数
      // 治愈的动物从sick/treatment状态恢复为健康状态
      try {
        const batchDoc = await db.collection(COLLECTIONS.PRODUCTION_BATCHES)
          .doc(treatment.batchId)
          .get()
        
        if (batchDoc.data) {
          await db.collection(COLLECTIONS.PRODUCTION_BATCHES)
            .doc(treatment.batchId)
            .update({
              data: {
                sickCount: _.inc(-count),
                updatedAt: new Date()
              }
            })
        } else {
        }
      } catch (error) {
      }
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
    
    // 1. 获取批次信息，计算单位成本（容错处理：batchId可能是文档ID或批次号）
    let batch = null
    let batchDocId = batchId  // ✅ 批次文档的真实_id
    
    try {
      // 先尝试作为文档ID查询
      const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId)
        .get()
      batch = batchResult.data
      batchDocId = batchId  // 文档ID就是传入的batchId
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      console.log('批次ID查询失败，尝试通过批次号查询:', batchId)
      const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          batchNumber: batchId,
          isDeleted: _.neq(true)
        })
        .limit(1)
        .get()
      
      if (batchQueryResult.data && batchQueryResult.data.length > 0) {
        batch = batchQueryResult.data[0]
        batchDocId = batch._id  // ✅ 使用查询到的批次文档的真实_id
        console.log('通过批次号查询成功，批次号:', batch.batchNumber, '文档ID:', batchDocId)
      }
    }
    
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`)
    }
    
    // 计算成本数据（✅ 使用批次文档的真实_id而不是批次号）
    let unitCost = 0
    let breedingCostPerAnimal = 0
    
    try {
      const costResult = await calculateBatchCost({ batchId: batchDocId }, wxContext)
      if (costResult.success) {
        unitCost = parseFloat(costResult.data.entryUnitCost || 0)
        breedingCostPerAnimal = parseFloat(costResult.data.avgBreedingCost || 0)
      }
    } catch (costError) {
      console.error('计算成本失败:', costError.message)
    }
    
    if (unitCost === 0 || isNaN(unitCost)) {
      unitCost = batch.unitPrice || 0  // ✅ 修正：数据库字段名是 unitPrice
    }
    
    if (unitCost === 0) {
      throw new Error(`批次 ${batch.batchNumber} 缺少入栏单价，请先在入栏记录中补充单价`)
    }
    
    // 计算财务损失 = 入栏单价 + 物料成本
    const entryCostLoss = unitCost * deathCount
    const breedingCostLoss = breedingCostPerAnimal * deathCount
    const financeLoss = entryCostLoss + breedingCostLoss
    
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
    
    // 创建死亡记录
    const deathRecordData = {
      _openid: openid,
      openid: openid,
      batchId: batchId,
      batchNumber: batch.batchNumber || '',
      deathDate: new Date().toISOString().split('T')[0],
      deathCount: deathCount,
      deathCause: deathCause || '待确定',
      deathCategory: deathCategory,
      source: 'ai_diagnosis',  // ✅ 标记来源为AI死因剖析（需要兽医确认和修正）
      disposalMethod: 'burial',
      autopsyFindings: autopsyFindings || '',
      photos: images || [],
      aiDiagnosisId: diagnosisId || null,
      diagnosisResult: diagnosisResult || null,
      financeLoss: parseFloat(financeLoss.toFixed(2)),
      unitCost: parseFloat(unitCost.toFixed(2)),
      breedingCost: parseFloat(breedingCostLoss.toFixed(2)),
      operator: openid,
      reporterName: userName,
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
    
    // 4. ✅ 更新原异常记录的状态为 'dead'（已死亡），从异常数中移除
    if (diagnosisId) {
      try {
        const abnormalRecordsResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
          .where({
            recordType: 'ai_diagnosis',
            status: 'abnormal',
            relatedDiagnosisId: diagnosisId,
            isDeleted: _.neq(true)
          })
          .get()
        
        if (abnormalRecordsResult.data && abnormalRecordsResult.data.length > 0) {
          // 批量更新所有相关异常记录的状态
          const updatePromises = abnormalRecordsResult.data.map(record => {
            return db.collection(COLLECTIONS.HEALTH_RECORDS).doc(record._id).update({
              data: {
                status: 'dead',  // ✅ 更新状态为已死亡
                relatedDeathRecordId: deathRecordId,  // 关联死亡记录
                updatedAt: new Date()
              }
            })
          })
          
          await Promise.all(updatePromises)
        }
      } catch (updateError) {
        console.error('更新异常记录状态失败（不影响主流程）:', updateError)
      }
    }
    
    // 5. 更新批次存栏量
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
    
    // 验证权限（兼容 _openid 和 createdBy 两种字段）
    if (record._openid !== openid && record.createdBy !== openid) {
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
    
    // 验证权限（兼容 _openid 和 createdBy 两种字段）
    if (record._openid !== openid && record.createdBy !== openid) {
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
