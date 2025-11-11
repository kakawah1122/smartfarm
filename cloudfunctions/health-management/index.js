// health-management/index.js - 健康管理云函数（优化版）
const cloud = require('wx-server-sdk')
const DatabaseManager = require('./database-manager')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const dbManager = new DatabaseManager(db)

const debugEnabled = process.env.DEBUG_LOG === 'true'
const debugLog = (...args) => {
  if (debugEnabled) {
    console.info(...args)
  }
}

// 生成记录ID
function generateRecordId(prefix) {
  const now = new Date()
  const timestamp = now.getTime().toString().slice(-8)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}${timestamp}${random}`
}

// 生成治疗记录编号 ZL-YYYYMMDD-001
async function generateTreatmentNumber() {
  try {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const dateStr = `${year}${month}${day}`
    const prefix = `ZL-${dateStr}-`
    
    // 查询今天已有的治疗记录数量
    const todayStart = `${year}-${month}-${day}T00:00:00.000Z`
    const todayEnd = `${year}-${month}-${day}T23:59:59.999Z`
    
    const countResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        createdAt: _.gte(new Date(todayStart)).and(_.lte(new Date(todayEnd)))
      })
      .count()
    
    const todayCount = countResult.total || 0
    const sequenceNumber = String(todayCount + 1).padStart(3, '0')
    
    return `${prefix}${sequenceNumber}`
  } catch (error) {
    console.error('生成治疗记录编号失败:', error)
    // 如果生成失败，使用时间戳作为备选方案
    const timestamp = Date.now().toString().slice(-6)
    return `ZL-${timestamp}`
  }
}

// 计算批次当前日龄
function calculateDayAge(entryDate) {
  if (!entryDate) return 1
  
  // 使用本地时区的日期，避免时区问题
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDay = today.getDate()
  
  // 解析入栏日期
  const entryDateStr = entryDate.split('T')[0] // YYYY-MM-DD
  const [entryYear, entryMonth, entryDay] = entryDateStr.split('-').map(Number)
  
  // 创建本地时区的日期对象（忽略时间部分）
  const todayDate = new Date(todayYear, todayMonth, todayDay)
  const startDate = new Date(entryYear, entryMonth - 1, entryDay) // 月份从0开始
  
  // 计算日期差异
  const diffTime = todayDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const dayAge = diffDays + 1 // 入栏当天为第1日龄
  
  return Math.max(1, dayAge) // 至少为1
}

// 权限验证辅助函数
async function checkPermission(openid, module, action, resourceId = null) {
  try {
    // 1. 获取用户信息（从wx_users获取角色）
    const userResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: openid })
      .limit(1)
      .get()
    
    if (!userResult.data || userResult.data.length === 0) {
      console.warn('[权限验证] 用户不存在', { openid, module, action })
      return false
    }
    
    const user = userResult.data[0]
    const userRole = user.role || 'employee'
    debugLog('[权限验证] 用户角色:', { openid: openid.substring(0, 8) + '...', userRole, module, action })
    
    // 2. 直接从wx_users获取角色（简化权限检查）
    // 超级管理员拥有所有权限
    if (userRole === 'super_admin') {
      return true
    }
    
    // 3. 获取角色权限定义（从sys_roles）
    const roleResult = await db.collection(COLLECTIONS.SYS_ROLES)
        .where({
        roleCode: userRole,
          isActive: true
        })
        .limit(1)
        .get()
      
      if (!roleResult.data || roleResult.data.length === 0) {
      // 如果角色定义不存在，使用默认权限
      console.warn('[权限验证] 角色定义不存在', { userRole, module, action })
      return false
      }
      
      const role = roleResult.data[0]
      const permissions = role.permissions || []
      
    // 4. 检查模块权限
      const modulePermission = permissions.find(p => 
        p.module === module || p.module === '*'
      )
      
      if (!modulePermission) {
      console.warn('[权限验证] 无模块权限', { userRole, module, action, availableModules: permissions.map(p => p.module) })
      return false
      }
      
    // 5. 检查操作权限
      if (modulePermission.actions.includes(action) || modulePermission.actions.includes('*')) {
        debugLog('[权限验证] 验证通过', { userRole, module, action })
        return true
    }
    
    console.warn('[权限验证] 无操作权限', { userRole, module, action, availableActions: modulePermission.actions })
    return false
    
  } catch (error) {
    console.error('[权限验证] 验证失败', { openid, module, action, error: error.message })
    // 权限验证失败时，默认拒绝访问
    return false
  }
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
    
    // 生成治疗记录编号
    const treatmentNumber = await generateTreatmentNumber()
    
    // 创建治疗记录
    const treatmentData = {
      treatmentNumber,  // ✅ 新增：治疗记录编号
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
          const materialResult = await transaction.collection(COLLECTIONS.PROD_MATERIALS)
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
          await transaction.collection(COLLECTIONS.PROD_MATERIALS)
            .doc(med.materialId)
            .update({
              data: {
                currentStock: _.inc(-quantity),
                updateTime: db.serverDate()
              }
            })
          
          // 3. 创建物资领用记录（主记录）
          const materialRecordResult = await transaction.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).add({
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
          await transaction.collection(COLLECTIONS.PROD_INVENTORY_LOGS).add({
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
      data: { 
        treatmentId: treatmentResult._id,
        treatmentNumber: treatmentNumber  // ✅ 返回治疗记录编号
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

// 从疫苗追踪创建治疗记录
async function createTreatmentFromVaccine(event, wxContext) {
  try {
    const {
      vaccineRecordId,
      batchId,
      batchNumber,
      affectedCount,
      diagnosis,
      vaccineName,
      preventionDate
    } = event
    const openid = wxContext.OPENID
    const db = cloud.database()
    
    // 创建治疗记录
    const treatmentData = {
      batchId,
      batchNumber: batchNumber || batchId,  // ✅ 保存批次编号用于显示
      vaccineRecordId,  // 关联疫苗记录
      animalIds: [],
      treatmentDate: new Date().toISOString().split('T')[0],
      treatmentType: 'medication',
      diagnosis: {
        preliminary: diagnosis || '疫苗接种后异常反应',
        confirmed: diagnosis || '疫苗接种后异常反应',
        confidence: 0,
        diagnosisMethod: 'manual'
      },
      treatmentPlan: {
        primary: `疫苗名称：${vaccineName}，接种日期：${preventionDate}，需观察并制定治疗方案`,
        followUpSchedule: []
      },
      medications: [],
      progress: [{
        date: new Date().toISOString().split('T')[0],
        type: 'record_created',
        content: `疫苗接种后异常反应记录已创建，异常数量：${affectedCount}只`,
        operator: openid,
        createdAt: new Date()
      }],
      outcome: {
        status: 'ongoing',
        curedCount: 0,
        improvedCount: 0,
        deathCount: 0,
        totalTreated: affectedCount || 1
      },
      cost: {
        medication: 0,
        veterinary: 0,
        supportive: 0,
        total: 0
      },
      notes: `疫苗：${vaccineName}，接种日期：${preventionDate}`,
      isDraft: false,
      isDeleted: false,
      createdBy: openid,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).add({
      data: treatmentData
    })
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_treatment_from_vaccine',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentResult._id,
      {
        vaccineRecordId,
        batchId,
        affectedCount,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: { treatmentId: treatmentResult._id },
      message: '治疗记录创建成功'
    }
  } catch (error) {
    console.error('创建疫苗追踪治疗记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '创建治疗记录失败'
    }
  }
}

// 从疫苗追踪创建死亡记录
async function createDeathFromVaccine(event, wxContext) {
  try {
    const {
      vaccineRecordId,
      batchId,
      batchNumber,
      deathCount,
      deathCause,
      vaccineName,
      preventionDate
    } = event
    const openid = wxContext.OPENID
    
    // 1. 验证必填项
    if (!batchId) throw new Error('批次ID不能为空')
    if (!deathCount || deathCount <= 0) throw new Error('死亡数量必须大于0')
    
    // 2. 获取批次信息
    let batch = null
    let batchDocId = batchId
    
    try {
      const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId).get()
      batch = batchEntry.data
      batchDocId = batchId
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          batchNumber: batchId,
          ...dbManager.buildNotDeletedCondition(true)
        })
        .limit(1)
        .get()
      
      if (batchQueryResult.data && batchQueryResult.data.length > 0) {
        batch = batchQueryResult.data[0]
        batchDocId = batch._id
      }
    }
    
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`)
    }
    
    // 3. 计算死亡损失 = 入栏单价 × 死亡数量（不分摊饲养成本）
    const entryUnitPrice = parseFloat(batch.unitPrice) || 0
    const totalLoss = (entryUnitPrice * deathCount).toFixed(2)
    
    debugLog('[疫苗死亡] 财务计算:', {
      deathCount: deathCount,
      entryUnitPrice: entryUnitPrice,
      totalLoss: totalLoss,
      batchInfo: {
        batchNumber: batch.batchNumber,
        initialQuantity: batch.quantity,
        currentCount: batch.currentCount
      }
    })
    
    // 4. 获取用户信息
    let operatorName = '未知'
    try {
      const userInfo = await db.collection(COLLECTIONS.WX_USERS)
        .where({ _openid: openid })
        .limit(1)
        .get()
      
      debugLog('[疫苗死亡] 用户查询结果:', {
        openid: openid.substring(0, 8) + '...',
        found: userInfo.data.length > 0,
        userName: userInfo.data[0]?.name
      })
      
      if (userInfo.data.length > 0) {
        operatorName = userInfo.data[0].name || userInfo.data[0].nickName || '未知'
      } else {
        console.warn('[疫苗死亡] 未找到用户信息, openid:', openid.substring(0, 8) + '...')
      }
    } catch (userError) {
      console.error('[疫苗死亡] 获取用户信息失败:', userError)
    }
    
    // 5. 创建死亡记录
    const deathRecord = {
      _openid: openid,  // ✅ 添加_openid字段用于查询
      batchId,
      batchNumber: batchNumber || batch.batchNumber,
      vaccineRecordId,  // 关联疫苗记录
      deathDate: new Date().toISOString().split('T')[0],
      deathList: [],
      deathCause: deathCause || '疫苗接种后死亡',
      deathCauseCategory: 'vaccine_reaction',
      customCauseTags: ['疫苗反应'],
      description: `疫苗名称：${vaccineName}，接种日期：${preventionDate}，接种后出现死亡情况`,
      symptoms: '',
      photos: [],
      environmentFactors: {},
      financialLoss: {
        unitCost: entryUnitPrice.toFixed(2),
        totalLoss: totalLoss,
        calculationMethod: 'entry_unit_price',
        financeRecordId: ''
      },
      disposalMethod: '待处理',
      preventiveMeasures: '',
      totalDeathCount: deathCount,
      deathCount: deathCount,  // ✅ 添加deathCount字段（与totalDeathCount保持一致）
      operator: openid,
      operatorName,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
      data: deathRecord
    })
    
    const deathRecordId = deathResult._id
    
    // 6. 调用财务云函数创建损失记录
    try {
      debugLog('[疫苗死亡] 准备创建财务记录:', {
        deathRecordId,
        deathCount,
        entryUnitPrice: entryUnitPrice.toFixed(2),
        totalLoss
      })
      
      const financeResult = await cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'createDeathLoss',
          batchId,
          batchNumber: batchNumber || batch.batchNumber,
          deathRecordId,
          deathCount,
          unitCost: entryUnitPrice.toFixed(2),
          totalLoss,
          deathCause: deathCause || '疫苗接种后死亡',
          recordDate: new Date().toISOString().split('T')[0],
          operator: openid
        }
      })
      
      debugLog('[疫苗死亡] 财务记录创建结果:', financeResult.result)
      
      // ✅ 如果财务记录创建成功，更新死亡记录中的财务记录ID
      if (financeResult.result && financeResult.result.success && financeResult.result.data?.financeRecordId) {
        await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
          .doc(deathRecordId)
          .update({
            data: {
              'financialLoss.financeRecordId': financeResult.result.data.financeRecordId
            }
          })
        debugLog('[疫苗死亡] 已更新财务记录ID到死亡记录')
      }
    } catch (financeError) {
      console.error('[疫苗死亡] 创建财务记录失败:', financeError)
      // 不影响主流程
    }
    
    // 7. 更新批次数量
    await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchDocId).update({
      data: {
        currentCount: _.inc(-deathCount),
        deadCount: _.inc(deathCount),
        updatedAt: new Date()
      }
    })
    
    // 8. 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_death_from_vaccine',
      COLLECTIONS.HEALTH_DEATH_RECORDS,
      deathRecordId,
      {
        vaccineRecordId,
        batchId,
        deathCount,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: { deathRecordId },
      message: '死亡记录创建成功'
    }
  } catch (error) {
    console.error('创建疫苗追踪死亡记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '创建死亡记录失败'
    }
  }
}

// 提交治疗计划（用户填写完治疗表单后调用）
async function submitTreatmentPlan(event, wxContext) {
  try {
    const {
      treatmentId,
      abnormalRecordId
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
    
    // 2. 更新异常记录的状态为治疗中
    await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(abnormalRecordId)
      .update({
        data: {
          status: 'treating',
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
    
    
    // ✅ 只查询真正的异常记录（待处理状态），已流转到治疗中的不计入异常数
    let whereCondition = {
      recordType: 'ai_diagnosis',
      status: 'abnormal',  // ✅ 只查询 abnormal 状态，不包括 treating
      ...dbManager.buildNotDeletedCondition(true)
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

// 查询各状态的健康记录（待处理/治疗中）
async function getHealthRecordsByStatus(event, wxContext) {
  try {
    const { batchId, status, limit = 20 } = event  // status: 'abnormal' | 'treating'
    const db = cloud.database()

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50)

    let whereCondition = {
      recordType: 'ai_diagnosis',
      status: status || 'abnormal',
      ...dbManager.buildNotDeletedCondition(true)
    }
    
    if (batchId && batchId !== 'all') {
      whereCondition.batchId = batchId
    }

    let query = db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where(whereCondition)
      .orderBy('checkDate', 'desc')

    const result = await query
      .limit(safeLimit)
      .get()

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
    
    // 查询所有异常记录（包括待处理、治疗中）
    let whereCondition = {
      recordType: 'ai_diagnosis',
      status: _.in(['abnormal', 'treating']),  // 显示所有状态的记录
      ...dbManager.buildNotDeletedCondition(true)
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
      mortalityRate: summaryResult.mortalityRate
    }

    // 3. 最近异常/诊断记录
    const recentAbnormalRecords = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({
        batchId,
        recordType: 'ai_diagnosis',
        ...dbManager.buildNotDeletedCondition(true)
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

    // ✅ 优化：并行查询所有历史数据（治疗、死亡、修正反馈）
    const [recentTreatmentRecords, recentDeathRecords, recentCorrections] = await Promise.all([
      db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .where({ batchId, ...dbManager.buildNotDeletedCondition(true) })
      .orderBy('treatmentDate', 'desc')
      .limit(3)
        .get(),
      db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
        .where({ batchId, ...dbManager.buildNotDeletedCondition(true) })
        .orderBy('deathDate', 'desc')
        .limit(5)
        .get(),
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          batchId,
          recordType: 'ai_diagnosis',
          isCorrected: true,
          ...dbManager.buildNotDeletedCondition(true)
        })
        .orderBy('correctedAt', 'desc')
        .limit(10)
      .get()
    ])

    const treatmentHistory = recentTreatmentRecords.data.map(record => ({
      recordId: record._id,
      treatmentDate: record.treatmentDate,
      diagnosis: record.diagnosis,
      treatmentPlan: record.treatmentPlan,
      medications: record.medications,
      outcome: record.outcome,
      notes: record.notes
    }))

    const deathHistory = recentDeathRecords.data.map(record => ({
      recordId: record._id,
      deathDate: record.deathDate,
      deathCount: record.deathCount,
      aiDiagnosis: record.deathCause,
      correctedDiagnosis: record.correctedCause,
      correctionReason: record.correctionReason,
      aiAccuracyRating: record.aiAccuracyRating
    }))

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
    
    // 更新异常记录
    await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .update({
        data: {
          isCorrected: true,
          correctedDiagnosis: correctedDiagnosis,
          correctionReason: veterinarianDiagnosis,
          veterinarianDiagnosis: veterinarianDiagnosis,  // ✅ 新增：兼容字段
          veterinarianTreatmentPlan: veterinarianTreatmentPlan || '',
          aiAccuracyRating: aiAccuracyRating,
          correctedBy: openid,
          correctedByName: userName,
          correctedAt: new Date().toISOString(),
          updatedAt: new Date()
        }
      })
    
    // ✅ 同步更新原始的 AI 诊断记录（如果存在）
    if (recordResult.data.diagnosisId) {
      try {
        await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
          .doc(recordResult.data.diagnosisId)
          .update({
            data: {
              isCorrected: true,
              correctedDiagnosis: correctedDiagnosis,
              correctionReason: veterinarianDiagnosis,
              veterinarianDiagnosis: veterinarianDiagnosis,
              veterinarianTreatmentPlan: veterinarianTreatmentPlan || '',
              aiAccuracyRating: aiAccuracyRating,
              correctedBy: openid,
              correctedByName: userName,
              correctedAt: new Date().toISOString(),
              updatedAt: new Date()
            }
          })
        debugLog('✅ 已同步更新 AI 诊断记录:', recordResult.data.diagnosisId)
      } catch (diagnosisError) {
        // 如果 AI 诊断记录不存在或更新失败，不影响主流程
        console.warn('⚠️ 更新 AI 诊断记录失败（可能记录不存在）:', diagnosisError.message)
      }
    }
    
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
        diagnosisId: recordResult.data.diagnosisId,
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

// 创建死亡记录（旧版，保留兼容）
async function createDeathRecord(data, wxContext) {
  try {
    const recordData = {
      _openid: wxContext.OPENID,  // ✅ 添加_openid字段用于查询
      batchId: data.batchId,
      healthRecordId: data.healthRecordId,
      deathDate: new Date().toISOString().split('T')[0],
      deadCount: data.deadCount,
      deathCount: data.deadCount,  // ✅ 添加标准字段
      totalDeathCount: data.deadCount,  // ✅ 添加标准字段
      cause: data.diagnosis || '待确定',
      deathCause: data.diagnosis || '待确定',  // ✅ 添加标准字段
      symptoms: data.symptoms || [],
      notes: data.notes || '',
      reportedBy: wxContext.OPENID,
      operator: wxContext.OPENID,  // ✅ 添加标准字段
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
      diagnosisId,
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

    // 生成治疗记录编号
    const treatmentNumber = await generateTreatmentNumber()

    const recordData = {
      treatmentNumber,  // ✅ 新增：治疗记录编号
      batchId,
      healthRecordId,
      diagnosisId: diagnosisId || '',  // ✅ 新增：关联AI诊断记录ID
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

    // ✅ 如果有关联的AI诊断记录，同步更新治疗信息
    if (diagnosisId) {
      try {
        await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
          .doc(diagnosisId)
          .update({
            data: {
              hasTreatment: true,
              latestTreatmentId: result._id,
              latestTreatmentDate: recordData.treatmentDate,
              updatedAt: new Date()
            }
          })
        debugLog('✅ 已同步治疗信息到AI诊断记录:', diagnosisId)
      } catch (syncError) {
        console.warn('⚠️ 同步治疗信息到AI诊断记录失败:', syncError.message)
        // 不影响主流程
      }
    }

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
      data: { 
        recordId: result._id,
        treatmentNumber: treatmentNumber  // ✅ 返回治疗记录编号
      },
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
    
    // ✅ 如果更新了治疗方案或用药记录，同步到关联的AI诊断记录
    if (updateData.treatmentPlan || updateData.medications || updateData.outcome) {
      try {
        // 先获取治疗记录，确定关联的诊断ID
        const treatmentRecord = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
          .doc(treatmentId)
          .field({ diagnosisId: true })
          .get()
        
        if (treatmentRecord.data && treatmentRecord.data.diagnosisId) {
          await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
            .doc(treatmentRecord.data.diagnosisId)
            .update({
              data: {
                latestTreatmentId: treatmentId,
                latestTreatmentDate: new Date().toISOString().split('T')[0],
                updatedAt: new Date()
              }
            })
          debugLog('✅ 已同步治疗更新到AI诊断记录:', treatmentRecord.data.diagnosisId)
        }
      } catch (syncError) {
        console.warn('⚠️ 同步治疗更新到AI诊断记录失败:', syncError.message)
        // 不影响主流程
      }
    }
    
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
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .doc(batchId)
      .get()
    
    if (!batchResult.data) {
      throw new Error('批次不存在')
    }
    
    const batch = batchResult.data
    const originalQuantity = batch.quantity || 0
    
    // 查询健康记录
    let query = db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({ batchId, ...dbManager.buildNotDeletedCondition(true) })

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
        ...dbManager.buildNotDeletedCondition(true)
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
        ...dbManager.buildNotDeletedCondition(true)
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
    
    // ✅ 统计所有治疗记录的总治疗数（用于计算死亡率和治愈率）
    const totalTreatedAnimals = treatingRecordsResult.data.reduce((sum, record) => {
      return sum + (record.outcome?.totalTreated || 0)
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
      // 应该用 总存栏数 - 异常数 - 治疗中数 来计算健康数
      if (recordHealthyCount === 0 && recordSickCount === 0) {
        healthyCount = totalAnimals - abnormalCount - treatingCount
        sickCount = abnormalCount + treatingCount
      } else {
        healthyCount = recordHealthyCount
        sickCount = recordSickCount
      }
      
      healthyCount = Math.max(0, healthyCount)  // 确保不为负数
      healthyRate = totalAnimals > 0 ? ((healthyCount / totalAnimals) * 100).toFixed(1) : 0
      // ✅ 死亡率基于原始数量计算（而非治疗总数）
      mortalityRate = originalQuantity > 0 ? ((deadCount / originalQuantity) * 100).toFixed(2) : 0
    } else {
      // 没有健康记录，根据异常、治疗中计算
      healthyCount = totalAnimals - abnormalCount - treatingCount
      healthyCount = Math.max(0, healthyCount)  // 确保不为负数
      sickCount = abnormalCount + treatingCount
      healthyRate = totalAnimals > 0 ? ((healthyCount / totalAnimals) * 100).toFixed(1) : 100
      // ✅ 死亡率基于原始数量计算（而非治疗总数）
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
      treatingCount
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
        ...dbManager.buildNotDeletedCondition(true)
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
      .where({ batchId, ...dbManager.buildNotDeletedCondition(true) })

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
        _openid: userId,
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
          _openid: userId,
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
    const allBatchesResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .where({
        userId: wxContext.OPENID
      })
      .orderBy('createTime', 'desc')
      .get()
    
    // 获取所有出栏记录
    const exitRecordsResult = await db.collection(COLLECTIONS.PROD_BATCH_EXITS)
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
    
    // ✅ 优化：并行处理所有批次的健康汇总
    const batchHealthSummaries = await Promise.all(
      batches.map(async (batch) => {
      try {
        // 计算日龄
        const entryDate = new Date(batch.entryDate)
        const today = new Date()
        const dayAge = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        
          const originalQuantity = batch.quantity || 0  // 原始入栏数
          const exitedCount = exitQuantityMap[batch.batchNumber] || 0
          
          // ✅ 优化：并行查询该批次的所有相关数据
          const [
            recentHealthResult,
            deathRecordsByIdResult,
            deathRecordsByNumberResult,
            abnormalRecordsResult,
            allTreatmentRecordsResult,
            abnormalAnimalsResult
          ] = await Promise.all([
            // 最近的健康记录
            db.collection(COLLECTIONS.HEALTH_RECORDS)
          .where({
            batchId: batch._id,
                ...dbManager.buildNotDeletedCondition(true)
          })
          .orderBy('checkDate', 'desc')
          .limit(5)
              .get(),
            // 死亡记录（按批次ID）
            db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
          .where({
            batchId: batch._id,
            isDeleted: false
          })
              .get(),
            // 死亡记录（按批次号）
            db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
          .where({
            batchId: batch.batchNumber,
            isDeleted: false
          })
              .get(),
            // 异常记录数量
            db.collection(COLLECTIONS.HEALTH_RECORDS)
              .where({
                batchId: batch._id,
                recordType: 'ai_diagnosis',
                status: 'abnormal',
                ...dbManager.buildNotDeletedCondition(true)
              })
              .count(),
            // 所有治疗记录
            db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
              .where({
                batchId: batch._id,
                ...dbManager.buildNotDeletedCondition(true)
              })
              .get(),
            // 异常动物记录
            db.collection(COLLECTIONS.HEALTH_RECORDS)
              .where({
                batchId: batch._id,
                recordType: 'ai_diagnosis',
                status: 'abnormal',
                ...dbManager.buildNotDeletedCondition(true)
              })
          .get()
          ])
        
          const healthRecords = recentHealthResult.data
          
          // 合并死亡记录（去重）
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
        let totalCount = originalQuantity - deadCount - exitedCount
        
        const abnormalRecordCount = abnormalRecordsResult.total || 0
        
        // ✅ 在代码中过滤进行中的治疗记录（包含 ongoing 和旧的 pending 记录）
        const ongoingTreatmentRecords = allTreatmentRecordsResult.data.filter(r => {
          const status = r.outcome?.status
          return status === 'ongoing' || status === 'pending'
        })
        
        // 统计进行中的治疗数量
        let treatingCount = 0
        ongoingTreatmentRecords.forEach(record => {
          const count = record.outcome?.totalTreated || 0
          treatingCount += count
        })
        
          // 计算异常动物数量
        const abnormalCount = abnormalAnimalsResult.data.reduce((sum, record) => {
          return sum + (record.affectedCount || 0)
        }, 0)
          
          let healthyCount = 0
          let sickCount = 0
          let healthyRate = 100
          let lastCheckDate = null
          let recentIssues = []
        
        // ✅ 计算健康数和异常数
        // 异常数 = 待处理 + 治疗中
        sickCount = abnormalCount + treatingCount
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
          abnormalRecordCount, // ✅ 待处理记录数
          recentIssues,
          alertLevel,
          lastCheckDate: lastCheckDate || '未检查',
          entryDate: batch.entryDate
        }
        
          return batchData
      } catch (batchError) {
        // 已移除调试日志
          return null  // 返回 null 以便后续过滤
      }
      })
    )
    
    // 过滤掉失败的批次（返回 null 的）
    const validSummaries = batchHealthSummaries.filter(summary => summary !== null)
    
    // 按预警级别和健康率排序
    validSummaries.sort((a, b) => {
      const alertPriority = { danger: 0, warning: 1, normal: 2 }
      const priorityDiff = alertPriority[a.alertLevel] - alertPriority[b.alertLevel]
      if (priorityDiff !== 0) return priorityDiff
      return a.healthyRate - b.healthyRate
    })
    
    return {
      success: true,
      data: {
        batches: validSummaries,
        totalBatches: validSummaries.length,
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

async function getDashboardSnapshot(event, wxContext) {
  try {
    const {
      batchId = 'all',
      includeDiagnosis = true,
      diagnosisLimit = 10,
      includeAbnormalRecords = true,
      abnormalLimit = 20
    } = event || {}

    if (batchId && batchId !== 'all') {
      return await getHealthOverview({ batchId }, wxContext)
    }

    const summaryResult = await getAllBatchesHealthSummary({}, wxContext)

    if (!summaryResult.success) {
      return summaryResult
    }

    const summaryData = summaryResult.data || {}
    const batches = summaryData.batches || []

    // ✅ 需要获取原始入栏数量，用于正确计算死亡率
    const batchIds = batches.map(batch => batch.batchId || batch._id).filter(Boolean)
    let originalTotalQuantity = 0
    
    if (batchIds.length > 0) {
      const batchEntriesResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          _id: _.in(batchIds),
          ...dbManager.buildNotDeletedCondition(true)
        })
        .field({ quantity: true })
        .get()
      
      originalTotalQuantity = batchEntriesResult.data.reduce((sum, batch) => sum + (batch.quantity || 0), 0)
    }

    const totalAnimals = batches.reduce((sum, batch) => sum + (batch.totalCount || 0), 0)
    const deadCount = batches.reduce((sum, batch) => sum + (batch.deadCount || 0), 0)
    const sickCount = batches.reduce((sum, batch) => sum + (batch.sickCount || 0), 0)

    let totalOngoing = 0
    let totalOngoingRecords = 0
    let totalTreatmentCost = 0
    let totalTreated = 0
    let totalCured = 0
    let totalDied = 0
    let totalDiedAnimals = 0

    if (batchIds.length > 0) {
      const treatmentResult = await calculateBatchTreatmentCosts({ batchIds }, wxContext)

      if (treatmentResult?.success && treatmentResult.data) {
        Object.values(treatmentResult.data).forEach((stats) => {
          const item = stats || {}
          totalOngoing += Number(item.ongoingAnimalsCount || 0)
          totalOngoingRecords += Number(item.ongoingCount || 0)
          totalTreatmentCost += parseFloat(item.totalCost || 0)
          totalTreated += Number(item.totalTreated || 0)
          totalCured += Number(item.totalCuredAnimals || 0)
          totalDied += Number(item.diedCount || 0)
          totalDiedAnimals += Number(item.totalDiedAnimals || item.diedCount || 0)
        })
      }
    }

    // ✅ 修复：使用专门的 count 查询获取准确的待处理数量
    const [abnormalResult, diagnosisResult, pendingCountResult] = await Promise.all([
      includeAbnormalRecords
        ? getHealthRecordsByStatus({ batchId: 'all', status: 'abnormal', limit: abnormalLimit }, wxContext)
        : Promise.resolve(null),
      includeDiagnosis
        ? getDiagnosisHistory({ batchId: undefined, limit: diagnosisLimit, page: 1 }, wxContext)
        : Promise.resolve(null),
      // ✅ 新增：直接查询待处理数量（hasTreatment=false）
      db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
        .where({
          _openid: wxContext.OPENID,
          isDeleted: false,
          hasTreatment: false
        })
        .count()
    ])

    const abnormalData = abnormalResult?.success ? abnormalResult.data : { totalCount: 0, recordCount: 0, records: [] }

    let latestDiagnosisRecords = []
    let pendingDiagnosis = 0

    if (diagnosisResult?.success && diagnosisResult.data) {
      latestDiagnosisRecords = diagnosisResult.data.records || []
    }
    
    // ✅ 修复：从专门的 count 查询获取待处理数量，而不是从有限的记录列表中过滤
    pendingDiagnosis = pendingCountResult?.total || 0

    const abnormalCount = abnormalData.totalCount || 0
    const abnormalRecordCount = abnormalData.recordCount || 0
    const abnormalRecords = abnormalData.records || []

    // ✅ 修复：totalAnimals 已经是当前存栏数（原始数量 - 死亡数），不应再减去 deadCount
    // 健康数 = 当前存栏数 - 治疗中数 - 异常数
    const actualHealthyCount = Math.max(0, totalAnimals - totalOngoing - abnormalCount)
    const healthyRate = totalAnimals > 0 ? ((actualHealthyCount / totalAnimals) * 100).toFixed(1) : '100'
    // ✅ 修复：死亡率应该基于原始入栏数量计算，而不是当前存栏数
    const mortalityRate = originalTotalQuantity > 0 ? ((deadCount / originalTotalQuantity) * 100).toFixed(1) : '0'
    const cureRate = totalTreated > 0 ? ((totalCured / totalTreated) * 100).toFixed(1) : '0'

    return {
      success: true,
      data: {
        batches,
        totalBatches: summaryData.totalBatches || batches.length,
        originalTotalQuantity,  // ✅ 原始入栏总数
        totalAnimals,           // 当前存栏总数
        deadCount,
        sickCount,
        actualHealthyCount,
        healthyRate,
        mortalityRate,
        abnormalCount,
        abnormalRecordCount,
        abnormalRecords,
        totalOngoing,
        totalOngoingRecords,
        totalTreatmentCost,
        totalTreated,
        totalCured,
        totalDiedAnimals,
        totalDied,
        cureRate,
        pendingDiagnosis,
        latestDiagnosisRecords
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '获取健康面板数据失败'
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
    const taskResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
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
    const materialResult = await db.collection(COLLECTIONS.PROD_MATERIALS)
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
      await transaction.collection(COLLECTIONS.PROD_MATERIALS)
        .doc(medication.materialId)
        .update({
          data: {
            currentStock: _.inc(-quantity),
            updateTime: db.serverDate()
          }
        })
      
      // 2. ✅ 创建物资领用记录（主记录）
      const materialRecordResult = await transaction.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).add({
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
      await transaction.collection(COLLECTIONS.PROD_INVENTORY_LOGS).add({
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

// 获取诊断历史记录
async function getDiagnosisHistory(event, wxContext) {
  try {
    const {
      batchId,
      limit = 20,
      page = 1,
      dateRange,  // ✅ 支持日期范围筛选
      recentDays  // ✅ 新增：近N天筛选
    } = event
    const openid = wxContext.OPENID

    // 构建查询条件
    let whereCondition = {
      _openid: openid,
      ...dbManager.buildNotDeletedCondition(true)
    }

    // ✅ 诊断记录不受批次筛选影响，始终显示所有批次的记录

    // ✅ 如果指定了日期范围，添加日期过滤；否则若传入 recentDays，则按近N天过滤
    if (dateRange && dateRange.start && dateRange.end) {
      whereCondition.createTime = _.gte(dateRange.start).and(_.lte(dateRange.end + 'T23:59:59'))
    } else if (recentDays && Number(recentDays) > 0) {
      const now = new Date()
      const start = new Date(now.getTime() - Number(recentDays) * 24 * 60 * 60 * 1000)
      whereCondition.createTime = _.gte(start.toISOString()).and(_.lte(now.toISOString()))
    }

    let query = db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS).where(whereCondition)

    // 查询数据
    const skip = (page - 1) * limit
    const result = await query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    // 映射数据库字段到前端期望的格式
    const mappedRecords = result.data.map(record => {
      // ✅ 修复：支持新旧两种数据结构
      // 新结构：record.result (从 process-ai-diagnosis 保存)
      // 旧结构：record.aiResult (从旧版本保存)
      const aiResult = record.result || record.aiResult || {}
      
      // 支持病鹅诊断和死因剖析两种类型
      const primaryDiagnosis = aiResult.primaryDiagnosis || aiResult.primaryCause || {}
      const treatmentRecommendation = aiResult.treatmentRecommendation || {}
      
      // 处理用药建议（支持多种格式）
      const medications = treatmentRecommendation.medication || 
                         treatmentRecommendation.medications || 
                         []
      
      // ✅ 修复：直接从顶层字段读取，而不是从 input.animalInfo
      const symptoms = record.symptomsText || (Array.isArray(record.symptoms) ? record.symptoms.join('、') : '') || ''
      const affectedCount = record.affectedCount || 0
      const dayAge = record.dayAge || 0
      
      return {
        _id: record._id,
        // 诊断结果
        diagnosisResult: primaryDiagnosis.disease || '未知疾病',
        diagnosis: primaryDiagnosis.disease || '未知疾病',
        confidence: primaryDiagnosis.confidence || 0,
        
        // 症状和输入信息
        symptoms: symptoms,
        affectedCount: affectedCount,
        dayAge: dayAge,
        temperature: 0, // 暂不使用
        
        // ✅ 诊断图片（症状图片或剖检图片）
        images: record.images || [],
        diagnosisType: record.diagnosisType || 'live_diagnosis',
        
        // 治疗方案
        // ✅ 修复：治疗周期的获取逻辑
        treatmentDuration: (() => {
          if (aiResult.followUp?.reviewInterval) {
            return aiResult.followUp.reviewInterval
          } else if (treatmentRecommendation.followUp?.timeline) {
            return treatmentRecommendation.followUp.timeline
          } else if (medications.length > 0 && medications[0].duration) {
            return medications[0].duration
          }
          return '未知'
        })(),
        recommendedMedications: medications.map(med => 
          typeof med === 'string' ? med : (med.name || med.medication || '')
        ).filter(m => m),
        
        // 其他可能的疾病
        possibleDiseases: (aiResult.differentialDiagnosis || aiResult.differentialCauses || []).map(dd => ({
          name: dd.disease || '',
          confidence: dd.confidence || 0
        })),
        
        // ✅ 修复：时间格式处理
        createTime: (() => {
          if (record.createdAt) {
            return typeof record.createdAt === 'string' 
              ? record.createdAt 
              : record.createdAt.toISOString()
          } else if (record.createTime) {
            return typeof record.createTime === 'string' 
              ? record.createTime 
              : record.createTime.toISOString()
          }
          return ''
        })(),
        diagnosisDate: (() => {
          const createTimeStr = record.createdAt || record.createTime || ''
          const timeStr = typeof createTimeStr === 'string' 
            ? createTimeStr 
            : (createTimeStr.toISOString ? createTimeStr.toISOString() : '')
          return timeStr ? timeStr.substring(0, 16).replace('T', ' ') : ''
        })(),
        batchId: record.batchId || '',
        batchNumber: record.batchNumber || '未知批次',
        
        // 操作员信息
        operator: record.operatorName || record._openid?.substring(0, 8) || '',
        
        // 状态信息
        status: record.status || 'completed',
        reviewed: record.veterinaryReview?.reviewed || false,
        adopted: record.application?.adopted || false
      }
    })

    return {
      success: true,
      data: {
        records: mappedRecords,
        pagination: {
          page,
          limit,
          total: result.data.length
        }
      }
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: '获取诊断历史失败'
    }
  }
}

/**
 * 获取批次完整数据（批量查询优化版）
 * 一次性返回健康概览、预防、治疗、诊断、异常等所有数据
 * 大幅减少云函数调用次数，提升性能
 */
async function getBatchCompleteData(event, wxContext) {
  try {
    const { batchId, includes = [], diagnosisLimit = 10, preventionLimit = 20 } = event
    const openid = wxContext.OPENID
    
    // 验证批次ID
    if (!batchId || batchId === 'all') {
      throw new Error('此接口不支持全部批次模式，请使用 get_dashboard_snapshot')
    }
    
    // 初始化返回数据
    const result = {
      batchId,
      timestamp: new Date().toISOString()
    }
    
    // 并行查询所有需要的数据
    const promises = []
    
    // 1. 健康统计（基础数据，总是包含）
    promises.push(
      (async () => {
        try {
          const stats = await getHealthStatistics(batchId, null)
          result.healthStats = stats
        } catch (error) {
          console.error('获取健康统计失败:', error)
          result.healthStats = null
        }
      })()
    )
    
    // 2. 预防数据（如果需要）
    if (!includes.length || includes.includes('prevention')) {
      promises.push(
        (async () => {
          try {
            const preventionResult = await dbManager.listPreventionRecords({
              batchId,
              pageSize: preventionLimit
            })
            
            // 计算预防统计
            const records = preventionResult.records || []
            const preventionStats = {
              totalPreventions: records.length,
              vaccineCount: 0,
              vaccineCoverage: 0,
              vaccineStats: {},
              disinfectionCount: 0,
              totalCost: 0,
              medicationCount: 0  // 新增：用药类型的记录数量
            }
            
            // 计算疫苗统计
            const vaccineMap = new Map()
            records.forEach(record => {
              if (record.preventionType === 'vaccination' && record.vaccineInfo) {
                const vaccineName = record.vaccineInfo.vaccineName || '未知疫苗'
                const targetAnimals = record.vaccineInfo.targetAnimals || 0
                const doseNumber = record.vaccineInfo.doseNumber || 1
                
                // 只统计第一针的覆盖数
                if (doseNumber === 1 || doseNumber === '1' || doseNumber === '第一针') {
                  preventionStats.vaccineCoverage += targetAnimals
                }
                
                preventionStats.vaccineCount += targetAnimals
                preventionStats.vaccineStats[vaccineName] = 
                  (preventionStats.vaccineStats[vaccineName] || 0) + targetAnimals
              } else if (record.preventionType === 'disinfection') {
                preventionStats.disinfectionCount += 1
              }
              
              if (record.costInfo && record.costInfo.totalCost) {
                preventionStats.totalCost += parseFloat(record.costInfo.totalCost) || 0
              }
              
              // 统计用药类型的记录（用于防疫用药）
              if (record.preventionType === 'medication') {
                preventionStats.medicationCount++
              }
            })
            
            result.preventionStats = preventionStats
            result.preventionRecords = records.slice(0, 10) // 只返回最近10条
          } catch (error) {
            console.error('获取预防数据失败:', error)
            result.preventionStats = null
            result.preventionRecords = []
          }
        })()
      )
    }
    
    // 3. 治疗统计（如果需要）
    if (!includes.length || includes.includes('treatment')) {
      promises.push(
        (async () => {
          try {
            // 查询治疗记录
            const treatmentRecords = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
              .where({ 
                _openid: openid,
                batchId,
                isDeleted: false 
              })
              .get()
            
            // 计算统计
            const stats = calculateBatchTreatmentStats(treatmentRecords.data)
            result.treatmentStats = stats
          } catch (error) {
            console.error('获取治疗统计失败:', error)
            result.treatmentStats = null
          }
        })()
      )
    }
    
    // 4. 诊断历史（如果需要）
    if (!includes.length || includes.includes('diagnosis')) {
      promises.push(
        (async () => {
          try {
            // 调用ai-diagnosis云函数获取诊断历史
            const diagnosisResult = await cloud.callFunction({
              name: 'ai-diagnosis',
              data: {
                action: 'get_diagnosis_history',
                batchId: batchId,
                page: 1,
                pageSize: diagnosisLimit
              }
            })
            
            if (diagnosisResult.result && diagnosisResult.result.success) {
              const records = diagnosisResult.result.data?.records || []
              // 过滤图片中的null值
              result.diagnosisHistory = records.map(record => ({
                ...record,
                images: (record.images || []).filter(img => img && typeof img === 'string')
              }))
            } else {
              result.diagnosisHistory = []
            }
          } catch (error) {
            console.error('获取诊断历史失败:', error)
            result.diagnosisHistory = []
          }
        })()
      )
    }
    
    // 5. 异常记录（如果需要）
    if (!includes.length || includes.includes('abnormal')) {
      promises.push(
        (async () => {
          try {
            const abnormalResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
              .where({
                batchId,
                recordType: 'ai_diagnosis',
                status: 'abnormal',
                ...dbManager.buildNotDeletedCondition(true)
              })
              .orderBy('checkDate', 'desc')
              .limit(50)
              .get()
            
            result.abnormalRecords = abnormalResult.data
            result.abnormalCount = abnormalResult.data.length
          } catch (error) {
            console.error('获取异常记录失败:', error)
            result.abnormalRecords = []
            result.abnormalCount = 0
          }
        })()
      )
    }
    
    // 6. 待诊断数量（如果需要）
    if (!includes.length || includes.includes('pending_diagnosis')) {
      promises.push(
        (async () => {
          try {
            const pendingResult = await cloud.callFunction({
              name: 'ai-diagnosis',
              data: {
                action: 'get_pending_diagnosis_count',
                batchId: batchId
              }
            })
            
            result.pendingDiagnosisCount = pendingResult.result?.data?.count || 0
          } catch (error) {
            console.error('获取待诊断数量失败:', error)
            result.pendingDiagnosisCount = 0
          }
        })()
      )
    }
    
    // 等待所有查询完成
    await Promise.all(promises)
    
    return {
      success: true,
      data: result,
      message: '批量查询成功'
    }
    
  } catch (error) {
    console.error('❌ 批量查询失败:', error)
    return {
      success: false,
      error: error.message,
      message: '批量查询失败'
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
      
      case 'create_treatment_from_vaccine':
        return await createTreatmentFromVaccine(event, wxContext)
      
      case 'create_death_from_vaccine':
        return await createDeathFromVaccine(event, wxContext)
      
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
      
      case 'get_dashboard_snapshot':
        return await getDashboardSnapshot(event, wxContext)
      
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
      
      case 'calculate_batch_treatment_costs':
        return await calculateBatchTreatmentCosts(event, wxContext)
      
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
      
      case 'get_diagnosis_history':
        return await getDiagnosisHistory(event, wxContext)
      
      case 'get_batch_complete_data':
        return await getBatchCompleteData(event, wxContext)
      
      case 'getPreventionDashboard':
        return await getPreventionDashboard(event, wxContext)
      
      case 'getTodayPreventionTasks':
        return await getTodayPreventionTasks(event, wxContext)
      
      case 'getPreventionTimeline':
        return await getPreventionTimeline(event, wxContext)
      
      case 'getBatchPreventionComparison':
        return await getBatchPreventionComparison(event, wxContext)
      
      case 'completePreventionTask':
      case 'complete_prevention_task':
        return await completePreventionTask(event, wxContext)
      
      case 'update_prevention_effectiveness':
        return await updatePreventionEffectiveness(event, wxContext)

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
      const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId)
        .get()
      batch = batchEntry.data
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          batchNumber: batchId,
          ...dbManager.buildNotDeletedCondition(true)
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
    const materialRecords = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
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
    const preventionRecords = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .where({
        batchId: batchId,
        isDeleted: false
      })
      .get()
    
    const preventionCost = preventionRecords.data.reduce((sum, record) => {
      return sum + (record.costInfo?.totalCost || 0)
    }, 0)
    
    // 4. 计算治疗成本
    const treatmentRecords = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
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
      deathDate,
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
      const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId).get()
      batch = batchEntry.data
      batchDocId = batchId  // 文档ID就是传入的batchId
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          batchNumber: batchId,
          ...dbManager.buildNotDeletedCondition(true)
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
    
    // 3. 计算死亡损失 = 入栏单价 × 死亡数量（不分摊饲养成本）
    const entryUnitPrice = parseFloat(batch.unitPrice) || 0
    const totalLoss = (entryUnitPrice * deathCount).toFixed(2)
    
    debugLog('[标准死亡] 财务计算:', {
      deathCount: deathCount,
      entryUnitPrice: entryUnitPrice,
      totalLoss: totalLoss,
      batchInfo: {
        batchNumber: batch.batchNumber,
        initialQuantity: batch.quantity,
        currentCount: batch.currentCount
      }
    })
    
    // 4. 获取用户信息
    let operatorName = '未知'
    try {
      const userInfo = await db.collection(COLLECTIONS.WX_USERS)
        .where({ _openid: openid })
        .limit(1)
        .get()
      
      debugLog('[标准死亡] 用户查询结果:', {
        openid: openid.substring(0, 8) + '...',
        found: userInfo.data.length > 0,
        userName: userInfo.data[0]?.name
      })
      
      if (userInfo.data.length > 0) {
        operatorName = userInfo.data[0].name || userInfo.data[0].nickName || '未知'
      } else {
        console.warn('[标准死亡] 未找到用户信息, openid:', openid.substring(0, 8) + '...')
      }
    } catch (userError) {
      console.error('[标准死亡] 获取用户信息失败:', userError)
    }
    
    // 5. 创建死亡记录
    const deathRecord = {
      _openid: openid,  // ✅ 添加_openid字段用于查询
      batchId,
      batchNumber: batchNumber || batch.batchNumber,
      deathDate: deathDate || new Date().toISOString().split('T')[0],
      deathList: deathList || [],
      deathCause,
      deathCauseCategory,
      customCauseTags: customCauseTags || [],
      description,
      symptoms: '',
      photos: photos || [],
      environmentFactors: environmentFactors || {},
      financialLoss: {
        unitCost: entryUnitPrice.toFixed(2),
        totalLoss: totalLoss,
        calculationMethod: 'entry_unit_price',
        financeRecordId: ''
      },
      disposalMethod,
      preventiveMeasures: preventiveMeasures || '',
      totalDeathCount: deathCount,
      deathCount: deathCount,  // ✅ 添加deathCount字段（与totalDeathCount保持一致）
      operator: openid,
      operatorName,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
      data: deathRecord
    })
    
    const deathRecordId = deathResult._id
    
    // 6. 调用财务云函数创建损失记录
    try {
      debugLog('[标准死亡] 准备创建财务记录:', {
        deathRecordId,
        deathCount,
        entryUnitPrice: entryUnitPrice.toFixed(2),
        totalLoss
      })
      
      const financeResult = await cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'createDeathLoss',
          batchId,
          batchNumber: batchNumber || batch.batchNumber,
          deathRecordId,
          deathCount,
          unitCost: entryUnitPrice.toFixed(2),
          totalLoss,
          deathCause,
          recordDate: deathDate || new Date().toISOString().split('T')[0],
          operator: openid
        }
      })
      
      debugLog('[标准死亡] 财务记录创建结果:', financeResult.result)
      
      // ✅ 如果财务记录创建成功，更新死亡记录中的财务记录ID
      if (financeResult.result && financeResult.result.success && financeResult.result.data?.financeRecordId) {
        await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
          .doc(deathRecordId)
          .update({
            data: {
              'financialLoss.financeRecordId': financeResult.result.data.financeRecordId
            }
          })
        debugLog('[标准死亡] 已更新财务记录ID到死亡记录')
      }
    } catch (financeError) {
      console.error('[标准死亡] 创建财务记录失败:', financeError)
      // 不影响主流程，继续执行
    }
    
    // 7. 更新批次数量（✅ 修复：使用批次文档ID而不是传入的batchId）
    await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchDocId).update({
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
    
    let query = db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({ isDeleted: false })
    
    // 按批次筛选
    if (batchId) {
      query = query.where({ batchId })
    }
    
    // 按日期范围筛选
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        deathDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
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
    
    let query = db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({ isDeleted: false })
    
    if (batchId) {
      query = query.where({ batchId })
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        deathDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
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
          const materialResult = await transaction.collection(COLLECTIONS.PROD_MATERIALS)
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
          await transaction.collection(COLLECTIONS.PROD_MATERIALS)
            .doc(medication.materialId)
            .update({
              data: {
                currentStock: _.inc(-quantity),
                updateTime: db.serverDate()
              }
            })
          
          // 3. 创建物资领用记录（主记录）
          const materialRecordResult = await transaction.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).add({
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
          await transaction.collection(COLLECTIONS.PROD_INVENTORY_LOGS).add({
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
          ...dbManager.buildNotDeletedCondition(true)
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
    
    // ✅ 修复：计算每只动物的摊销治疗成本（用于财务损失计算）
    const totalTreated = treatment.outcome?.totalTreated || treatment.initialCount || 1
    const treatmentCostPerAnimal = totalTreated > 0 ? (treatment.totalCost || 0) / totalTreated : 0
    const amortizedTreatmentCost = treatmentCostPerAnimal * actualDiedCount
    
    // ✅ 2. 查询是否已存在该治疗记录的死亡记录
    const existingDeathRecords = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where({
        treatmentRecordId: treatmentId,
        ...dbManager.buildNotDeletedCondition(true)
      })
      .limit(1)
      .get()
    
    // 获取批次信息计算损失（容错处理）
    let batch = null
    let batchDocId = treatment.batchId
    let costPerAnimal = 0
    
    try {
      try {
        const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
          .doc(treatment.batchId).get()
        batch = batchEntry.data
        batchDocId = treatment.batchId
      } catch (err) {
        const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
          .where({
            batchNumber: treatment.batchId,
            ...dbManager.buildNotDeletedCondition(true)
          })
          .limit(1)
          .get()
        
        if (batchQueryResult.data && batchQueryResult.data.length > 0) {
          batch = batchQueryResult.data[0]
          batchDocId = batch._id
        }
      }
      
      if (batch) {
        // ✅ 直接使用入栏单价，不分摊饲养成本
        costPerAnimal = parseFloat(batch.unitPrice) || 0
      }
    } catch (costError) {
      console.error('计算财务损失失败:', costError.message)
    }
    
    let deathRecordId = null
    let isUpdate = false
    
    // ✅ 3. 如果已存在死亡记录，则更新；否则创建新记录
    if (existingDeathRecords.data && existingDeathRecords.data.length > 0) {
      // 已存在，累加更新
      const existingRecord = existingDeathRecords.data[0]
      deathRecordId = existingRecord._id
      isUpdate = true
      
      const oldDeathCount = existingRecord.deathCount || existingRecord.totalDeathCount || 0
      const newDeathCount = oldDeathCount + actualDiedCount
      
      const oldTotalLoss = existingRecord.financialLoss?.totalLoss || 0
      const incrementLoss = (costPerAnimal * actualDiedCount) + amortizedTreatmentCost
      const newTotalLoss = oldTotalLoss + incrementLoss
      
      const oldTreatmentCost = existingRecord.financialLoss?.treatmentCost || 0
      const newTreatmentCost = oldTreatmentCost + amortizedTreatmentCost
      
      await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).doc(deathRecordId).update({
        data: {
          deathCount: newDeathCount,
          totalDeathCount: newDeathCount, // 兼容旧字段
          'financialLoss.totalLoss': newTotalLoss,
          'financialLoss.treatmentCost': newTreatmentCost,
          updatedAt: new Date()
        }
      })
      
      debugLog(`✅ 更新死亡记录: ${deathRecordId}, 新增死亡数: ${actualDiedCount}, 累计死亡数: ${newDeathCount}`)
      
    } else {
      // 不存在，创建新记录
      const totalLoss = (costPerAnimal * actualDiedCount) + amortizedTreatmentCost
      
      const deathRecordData = {
        _openid: openid,  // ✅ 添加_openid字段用于查询
        batchId: treatment.batchId,
        batchNumber: batch?.batchNumber || treatment.batchId,
        treatmentRecordId: treatmentId,
        treatmentId: treatmentId,  // 兼容字段
        diagnosisId: treatment.diagnosisId || null,
        deathDate: new Date().toISOString().split('T')[0],
        deathCause: treatment.diagnosis || '治疗无效',
        deathCategory: 'disease',
        deathCount: actualDiedCount,
        totalDeathCount: actualDiedCount, // 兼容旧字段
        description: deathDetails?.description || `治疗失败导致死亡 - ${treatment.diagnosis}`,
        disposalMethod: deathDetails?.disposalMethod || 'burial',
        operator: openid,
        operatorName: deathDetails?.operatorName || '系统',
        financialLoss: {
          costPerAnimal,
          totalLoss,
          treatmentCost: amortizedTreatmentCost,
          currency: 'CNY'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false
      }
      
      const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
        data: deathRecordData
      })
      
      deathRecordId = deathResult._id
      
      debugLog(`✅ 创建死亡记录: ${deathRecordId}, 死亡数: ${actualDiedCount}`)
    }
    
    // 4. 更新治疗记录的 outcome
    const currentOutcome = treatment.outcome || {}
    const oldDiedCount = currentOutcome.deathCount || 0
    const newTotalDiedCount = oldDiedCount + actualDiedCount
    
    await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).doc(treatmentId).update({
      data: {
        'outcome.deathCount': newTotalDiedCount,
        'outcome.status': 'partial_died', // 部分死亡状态
        deathRecordId: deathRecordId,
        updatedAt: new Date()
      }
    })
    
    // 5. 调用财务云函数记录损失（仅新增的损失）
    // ✅ 修复：使用已计算的摊销治疗成本
    const incrementLoss = (costPerAnimal * actualDiedCount) + amortizedTreatmentCost
    if (incrementLoss > 0) {
      try {
        await cloud.callFunction({
          name: 'finance-management',
          data: {
            action: 'createDeathLossRecord',
            deathRecordId: deathRecordId,
            batchId: treatment.batchId,
            deathCount: actualDiedCount,
            totalLoss: incrementLoss,
            treatmentCost: amortizedTreatmentCost,
            description: `死亡损失 - ${treatment.diagnosis} - ${actualDiedCount}只`
          }
        })
      } catch (financeError) {
        console.error('记录死亡损失失败:', financeError)
      }
    }
    
    // 6. 更新批次存栏数和死亡数
    await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchDocId).update({
      data: {
        currentCount: _.inc(-actualDiedCount),
        deadCount: _.inc(actualDiedCount),
        updatedAt: new Date()
      }
    })
    
    // 7. 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'complete_treatment_as_died',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentId,
      {
        batchId: treatment.batchId,
        diedCount: actualDiedCount,
        deathRecordId: deathRecordId,
        isUpdate: isUpdate,
        financialLoss: incrementLoss,
        result: 'success'
      }
    )
    
    return {
      success: true,
      data: {
        treatmentId,
        deathRecordId: deathRecordId,
        diedCount: actualDiedCount,
        isUpdate: isUpdate,
        financialLoss: incrementLoss
      },
      message: isUpdate ? '死亡记录已更新' : '死亡记录已创建'
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
      const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
      batch = batchEntry.data
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          batchNumber: batchId,
          ...dbManager.buildNotDeletedCondition(true)
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
      const batchEntry = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).doc(batchId).get()
      batch = batchEntry.data
    } catch (err) {
      // 如果文档不存在，尝试通过批次号查询
      const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          batchNumber: batchId,
          ...dbManager.buildNotDeletedCondition(true)
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
/**
 * 计算单个批次的治疗成本（内部辅助函数）
 */
function calculateBatchTreatmentStats(records) {
  const normalizeStatus = (record) => {
    if (typeof record.outcome === 'string') {
      return record.outcome
    }
    return record.outcome?.status || record.treatmentStatus || record.status || ''
  }

  const getTotalTreated = (record) => {
    const outcomeTotal = typeof record.outcome === 'object' ? record.outcome?.totalTreated : undefined
    return outcomeTotal ?? record.totalTreated ?? record.affectedCount ?? record.initialCount ?? 0
  }

  const getCuredAnimals = (record) => {
    if (typeof record.outcome === 'object' && record.outcome) {
      const cured = record.outcome.curedCount ?? record.outcome.totalCured ?? record.outcome.recoveredCount ?? 0
      return Number(cured) || 0
    }
    return Number(record.curedCount ?? record.totalCured ?? record.recoveredCount ?? 0) || 0
  }

  const getDiedAnimals = (record) => {
    if (typeof record.outcome === 'object' && record.outcome) {
      const died = record.outcome.deathCount ?? record.outcome.diedCount ?? 0
      return Number(died) || 0
    }
    return Number(record.deathCount ?? record.diedCount ?? 0) || 0
  }

  const totalCost = records.reduce((sum, r) => sum + (r.totalCost || 0), 0)

  const ongoingRecords = records.filter(r => {
    const status = normalizeStatus(r)
    return status === 'ongoing' || status === 'pending'
  })

  const ongoingCount = ongoingRecords.length

  const ongoingAnimalsCount = ongoingRecords.reduce((sum, r) => {
    const totalTreated = getTotalTreated(r)
    const curedAnimals = getCuredAnimals(r)
    const diedAnimals = getDiedAnimals(r)
    const actualOngoing = Math.max(totalTreated - curedAnimals - diedAnimals, 0)
    return sum + actualOngoing
  }, 0)

  const curedCount = records.filter(r => normalizeStatus(r) === 'cured').length
  const diedCount = records.filter(r => normalizeStatus(r) === 'died').length

  const totalTreated = records.reduce((sum, r) => sum + getTotalTreated(r), 0)
  const totalCuredAnimals = records.reduce((sum, r) => sum + getCuredAnimals(r), 0)
  const totalDiedAnimals = records.reduce((sum, r) => sum + getDiedAnimals(r), 0)
  const cureRate = totalTreated > 0 ? ((totalCuredAnimals / totalTreated) * 100).toFixed(1) : 0

  return {
    totalCost: totalCost.toFixed(2),
    treatmentCount: records.length,
    ongoingCount,
    ongoingAnimalsCount,
    curedCount,
    diedCount,
    totalTreated,
    totalCuredAnimals,
    totalDiedAnimals,
    cureRate
  }
}

/**
 * 批量计算多个批次的治疗成本（优化版）
 * @param {Array<string>} batchIds - 批次ID数组
 * @param {Object} dateRange - 可选的日期范围过滤
 * @returns {Object} - 按批次ID索引的成本统计对象
 */
async function calculateBatchTreatmentCosts(event, wxContext) {
  try {
    const { batchIds, dateRange } = event
    const openid = wxContext.OPENID
    
    if (!batchIds || !Array.isArray(batchIds) || batchIds.length === 0) {
      return {
        success: false,
        error: '批次ID数组不能为空',
        message: '批量计算失败：缺少批次ID'
      }
    }
    
    // 构建查询条件
    let query = db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        isDeleted: false,
        batchId: _.in(batchIds)
      })
    
    // 添加日期范围过滤
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        treatmentDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    // 一次性查询所有批次的治疗记录
    const result = await query.get()
    
    // 按批次ID分组
    const recordsByBatch = {}
    batchIds.forEach(id => {
      recordsByBatch[id] = []
    })
    
    result.data.forEach(record => {
      if (recordsByBatch[record.batchId]) {
        recordsByBatch[record.batchId].push(record)
      }
    })
    
    // 批量计算每个批次的统计数据
    const batchStats = {}
    batchIds.forEach(batchId => {
      const records = recordsByBatch[batchId] || []
      batchStats[batchId] = calculateBatchTreatmentStats(records)
    })
    
    return {
      success: true,
      data: batchStats,
      message: `成功批量计算${batchIds.length}个批次的治疗成本`
    }
    
  } catch (error) {
    console.error('[calculateBatchTreatmentCosts] 批量计算失败:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })
    return {
      success: false,
      error: error.message,
      message: '批量计算治疗成本失败'
    }
  }
}

/**
 * 计算单个批次治疗成本（保留向后兼容）
 */
async function calculateTreatmentCost(event, wxContext) {
  try {
    const { batchId, dateRange } = event
    const openid = wxContext.OPENID
    
    // ✅ 添加 openid 过滤，确保只查询当前用户的数据
    let query = db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({ 
        _openid: openid,  // ✅ 添加用户过滤
        isDeleted: false 
      })
    
    if (batchId && batchId !== 'all') {
      query = query.where({ batchId })
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        treatmentDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    const records = await query.get()
    const stats = calculateBatchTreatmentStats(records.data)
    
    return {
      success: true,
      data: stats
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
      ...dbManager.buildNotDeletedCondition(true)
    }
    
    // 如果指定了批次ID，添加批次条件
    if (batchId && batchId !== 'all') {
      where.batchId = batchId
    }
    
    // 查询治疗记录
    const treatmentRecordsResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where(where)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    
    // 处理治疗记录
    const allRecords = treatmentRecordsResult.data.map(r => ({
        ...r,
        treatmentType: 'medication',
        diagnosis: r.diagnosisDisease || r.diagnosis || '未知疾病'
      }))
    
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
          const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
            .where({
              _id: record.batchId,
              ...dbManager.buildNotDeletedCondition(true)
            })
            .limit(1)
            .get()
          
          if (batchResult.data && batchResult.data.length > 0) {
            record.batchNumber = batchResult.data[0].batchNumber
          } else {
            // 尝试用批次号查询
            const batchByNumberResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
              .where({
                batchNumber: record.batchId,
                ...dbManager.buildNotDeletedCondition(true)
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
        const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
          .doc(treatment.batchId)
          .get()
        batch = batchResult.data
        batchNumber = batch?.batchNumber || treatment.batchId
        batchDocId = treatment.batchId  // 文档ID就是传入的batchId
      } catch (err) {
        // 如果文档不存在，尝试通过批次号查询
        debugLog('批次ID查询失败，尝试通过批次号查询:', treatment.batchId)
        try {
          const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
            .where({
              batchNumber: treatment.batchId,
              ...dbManager.buildNotDeletedCondition(true)
            })
            .limit(1)
            .get()
          
          if (batchQueryResult.data && batchQueryResult.data.length > 0) {
            batch = batchQueryResult.data[0]
            batchNumber = batch.batchNumber
            batchDocId = batch._id  // ✅ 使用查询到的批次文档的真实_id
            debugLog('通过批次号查询成功，批次号:', batchNumber, '文档ID:', batchDocId)
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
      
      debugLog('========== 批次成本计算开始 ==========')
      debugLog('治疗记录中的 batchId:', treatment.batchId)
      debugLog('查询到的批次文档ID:', batchDocId)
      debugLog('查询到的批次号:', batchNumber)
      debugLog('批次数据:', JSON.stringify(batch))
      
      if (batch) {
        // ✅ 直接使用入栏单价，不分摊饲养成本
        unitCost = parseFloat(batch.unitPrice) || 0
        debugLog('使用批次入栏单价:', unitCost)
      } else {
        console.error('❌ 批次数据为空')
      }
      
      if (unitCost === 0) {
        console.warn(`❌ 批次 ${batchNumber} (文档ID: ${batchDocId}) 缺少入栏单价`)
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
      
      // ✅ 计算财务损失 = 入栏单价 × 死亡数量 + 治疗成本（不分摊饲养成本）
      const entryCostLoss = unitCost * count
      const financeLoss = entryCostLoss + deathTreatmentCost
      
      // ✅ 先查找是否已存在该治疗记录的死亡记录
      const existingDeathRecords = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
        .where({
          treatmentRecordId: treatmentId,
          ...dbManager.buildNotDeletedCondition(true)
        })
        .limit(1)
        .get()
      
      let deathRecordId = null
      
      if (existingDeathRecords.data && existingDeathRecords.data.length > 0) {
        // ✅ 已存在死亡记录，累加更新
        const existingRecord = existingDeathRecords.data[0]
        deathRecordId = existingRecord._id
        
        const oldDeathCount = existingRecord.deathCount || 0
        const newDeathCount = oldDeathCount + count
        
        // ✅ 兼容新旧数据结构
        const oldFinanceLoss = existingRecord.financialLoss?.totalLoss || existingRecord.financeLoss || existingRecord.totalCost || 0
        const newFinanceLoss = oldFinanceLoss + financeLoss
        
        const oldTreatmentCost = existingRecord.financialLoss?.treatmentCost || existingRecord.treatmentCost || 0
        const newTreatmentCost = oldTreatmentCost + deathTreatmentCost
        
        const oldMedicationCost = existingRecord.financialLoss?.medicationCost || existingRecord.medicationCost || 0
        const newMedicationCost = oldMedicationCost + deathMedicationCost
        
        await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).doc(deathRecordId).update({
          data: {
            deathCount: newDeathCount,
            financeLoss: parseFloat(newFinanceLoss.toFixed(2)),
            totalCost: parseFloat(newFinanceLoss.toFixed(2)),
            treatmentCost: parseFloat(newTreatmentCost.toFixed(2)),
            medicationCost: parseFloat(newMedicationCost.toFixed(2)),
            // ✅ 同时更新结构化的 financialLoss 对象
            'financialLoss.totalLoss': parseFloat(newFinanceLoss.toFixed(2)),
            'financialLoss.treatmentCost': parseFloat(newTreatmentCost.toFixed(2)),
            updatedAt: new Date()
          }
        })
        
        debugLog(`✅ 更新死亡记录: ${deathRecordId}, 新增死亡数: ${count}, 累计死亡数: ${newDeathCount}`)
        
      } else {
        // ✅ 不存在，创建新的死亡记录
        const deathRecordData = {
          batchId: treatment.batchId,
          batchNumber: batchNumber,
          treatmentRecordId: treatmentId,
          treatmentId: treatmentId,  // 兼容字段
          deathDate: new Date().toISOString().split('T')[0],
          deathCount: count,
          deathCause: diagnosisText,
          deathCategory: 'disease',
          source: 'treatment',
          financeLoss: parseFloat(financeLoss.toFixed(2)),
          unitCost: parseFloat(unitCost.toFixed(2)),
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
          updatedAt: new Date(),
          // ✅ 新增结构化财务损失字段，兼容死亡记录列表页面
          financialLoss: {
            totalLoss: parseFloat(financeLoss.toFixed(2)),
            unitCost: parseFloat(unitCost.toFixed(2)),
            treatmentCost: parseFloat(deathTreatmentCost.toFixed(2)),
            calculationMethod: 'entry_unit_price',
            currency: 'CNY'
          }
        }
        
        const deathResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS).add({
          data: deathRecordData
        })
        
        deathRecordId = deathResult._id
        
        debugLog(`✅ 创建死亡记录: ${deathRecordId}, 死亡数: ${count}`)
      }
      
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
          const entryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
            .where({
              batchNumber: treatment.batchId,
              ...dbManager.buildNotDeletedCondition(true)
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
      debugLog('批次ID查询失败，尝试通过批次号查询:', batchId)
      const batchQueryResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          batchNumber: batchId,
          ...dbManager.buildNotDeletedCondition(true)
        })
        .limit(1)
        .get()
      
      if (batchQueryResult.data && batchQueryResult.data.length > 0) {
        batch = batchQueryResult.data[0]
        batchDocId = batch._id  // ✅ 使用查询到的批次文档的真实_id
        debugLog('通过批次号查询成功，批次号:', batch.batchNumber, '文档ID:', batchDocId)
      }
    }
    
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`)
    }
    
    // 计算死亡损失 = 入栏单价 × 死亡数量（不分摊饲养成本）
    const unitCost = parseFloat(batch.unitPrice) || 0
    
    if (unitCost === 0) {
      throw new Error(`批次 ${batch.batchNumber} 缺少入栏单价，请先在入栏记录中补充单价`)
    }
    
    const financeLoss = unitCost * deathCount
    
    debugLog('[AI死因剖析] 成本计算:', {
      deathCount,
      unitCost: unitCost.toFixed(2),
      totalLoss: financeLoss.toFixed(2)
    })
    
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
      totalDeathCount: deathCount,  // ✅ 添加标准字段
      deathCause: deathCause || '待确定',
      deathCategory: deathCategory,
      source: 'ai_diagnosis',  // ✅ 标记来源为AI死因剖析（需要兽医确认和修正）
      disposalMethod: 'burial',
      autopsyFindings: autopsyFindings || '',
      photos: images || [],
      aiDiagnosisId: diagnosisId || null,
      diagnosisResult: diagnosisResult || null,
      // ✅ 修正：使用标准的financialLoss结构（对象格式）
      financialLoss: {
        unitCost: parseFloat(unitCost.toFixed(2)),
        totalLoss: parseFloat(financeLoss.toFixed(2)),
        calculationMethod: 'entry_unit_price',
        treatmentCost: 0
      },
      operator: openid,
      operatorName: userName,  // ✅ 使用标准字段名
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
            ...dbManager.buildNotDeletedCondition(true)
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
    
    // ✅ 查询用户的所有死亡记录，兼容 _openid 和 operator 字段
    const result = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where(_.or([
        { _openid: openid, isDeleted: false },
        { operator: openid, isDeleted: false },
        { createdBy: openid, isDeleted: false },  // ✅ 兼容 createdBy 字段
        { reportedBy: openid, isDeleted: false }  // ✅ 兼容 reportedBy 字段（旧版）
      ]))
      .orderBy('deathDate', 'desc')
      .limit(100)
      .get()
    
    debugLog('[死亡记录列表] 查询到的记录数:', result.data.length)
    if (result.data.length > 0) {
      debugLog('[死亡记录列表] 第一条记录字段:', Object.keys(result.data[0]))
    }
    
    // ✅ 关联操作员信息
    const records = await Promise.all(result.data.map(async (record) => {
      // 如果已经有operatorName，直接使用
      if (record.operatorName && record.operatorName !== '未知') {
        return record
      }
      
      // 否则，根据各种可能的字段查询用户信息
      const operatorOpenid = record._openid || record.operator || record.createdBy || record.reportedBy
      
      if (!operatorOpenid) {
        console.warn('[死亡记录列表] 记录缺少操作员openid:', record._id)
        return {
          ...record,
          operatorName: '系统记录'
        }
      }
      
      try {
        const userInfo = await db.collection(COLLECTIONS.WX_USERS)
          .where({ _openid: operatorOpenid })
          .limit(1)
          .get()
        
        if (userInfo.data.length > 0) {
          const user = userInfo.data[0]
          const operatorName = user.name || user.nickName || user.userName || '未命名用户'
          return {
            ...record,
            operatorName
          }
        } else {
          console.warn('[死亡记录列表] 未找到用户信息, openid:', operatorOpenid.substring(0, 8) + '...')
          return {
            ...record,
            operatorName: '未知用户'
          }
        }
      } catch (userError) {
        console.error('[死亡记录列表] 查询用户信息失败:', userError)
        return {
          ...record,
          operatorName: '查询失败'
        }
      }
    }))
    
    return {
      success: true,
      data: records || [],
      message: '获取死亡记录列表成功'
    }
    
  } catch (error) {
    console.error('[死亡记录列表] 查询失败:', error)
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
        const diagnosisResult = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
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
    
    // ✅ 如果有AI诊断ID，同步更新AI诊断记录（与异常记录保持一致）
    if (record.aiDiagnosisId) {
      try {
        await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
          .doc(record.aiDiagnosisId)
          .update({
            data: {
              isCorrected: true,
              correctedDiagnosis: correctedCause,
              correctionReason: correctionReason,
              veterinarianDiagnosis: correctionReason,  // 兽医诊断内容
              aiAccuracyRating: aiAccuracyRating,
              correctionType: correctionType,
              correctedBy: openid,
              correctedByName: userName,
              correctedAt: new Date().toISOString(),
              // 保留原有的 feedback 字段以兼容旧代码
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
        debugLog('✅ 已同步更新 AI 诊断记录:', record.aiDiagnosisId)
      } catch (feedbackError) {
        console.warn('⚠️ 更新 AI 诊断记录失败（可能记录不存在）:', feedbackError.message)
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

// 获取今日预防待办（首页用）
async function getTodayPreventionTasks(event, wxContext) {
  const startTime = Date.now()
  const logContext = { action: 'getTodayPreventionTasks', openid: wxContext.OPENID }
  
  try {
    const { limit = 3, batchId } = event
    const openid = wxContext.OPENID
    const today = new Date().toISOString().split('T')[0]
    
    // ========== 1. 权限验证 ==========
    debugLog('[首页预防待办] 开始权限验证', logContext)
    const hasPermission = await checkPermission(openid, 'health', 'view', batchId)
    if (!hasPermission) {
      console.warn('[首页预防待办] 权限不足', logContext)
      return {
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: '您没有查看预防任务的权限'
      }
    }
    
    // ========== 2. 构建查询条件 ==========
    // ✅ 修复：使用正确的 category 值（中文）
    const whereCondition = {
      category: _.in(['健康管理', '营养管理', '疫苗接种', '用药管理']),
      completed: false,
      targetDate: _.lte(today)  // 今日及之前（包含逾期）
    }
    
    if (batchId && batchId !== 'all') {
      whereCondition.batchId = batchId
    }
    
    // ========== 3. 查询任务 ==========
    debugLog('[首页预防待办] 开始查询任务', logContext)
    const tasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .where(whereCondition)
      .field({
        _id: true,
        taskName: true,
        title: true,
        taskType: true,
        batchId: true,
        batchNumber: true,
        dayAge: true,
        targetDate: true,
        description: true,
        estimatedCost: true
      })
      .orderBy('targetDate', 'asc')
      .limit(limit)
      .get()
    
    // ========== 3.5. 获取批次信息以计算当前日龄 ==========
    // 🔥 获取所有涉及的批次信息，用于重新计算当前日龄
    const allTaskBatchIds = [...new Set((tasksResult.data || []).map(t => t.batchId).filter(Boolean))]
    
    const batchInfoMap = {}
    if (allTaskBatchIds.length > 0) {
      const batchesInfoResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          _id: _.in(allTaskBatchIds)
        })
        .field({ _id: true, entryDate: true, batchNumber: true })
        .get()
      
      batchesInfoResult.data.forEach(batch => {
        // 计算当前日龄 - 使用本地时区
        const todayDate = new Date()
        const todayYear = todayDate.getFullYear()
        const todayMonth = todayDate.getMonth()
        const todayDay = todayDate.getDate()
        
        const entryDateStr = batch.entryDate.split('T')[0]
        const [entryYear, entryMonth, entryDay] = entryDateStr.split('-').map(Number)
        
        const today = new Date(todayYear, todayMonth, todayDay)
        const startDate = new Date(entryYear, entryMonth - 1, entryDay)
        
        const diffTime = today.getTime() - startDate.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        const currentDayAge = diffDays + 1
        
        batchInfoMap[batch._id] = currentDayAge
      })
    }
    
    // ========== 4. 处理任务数据 ==========
    const tasks = (tasksResult.data || []).map(task => {
      const isOverdue = task.targetDate < today
      const overdueDays = isOverdue ? 
        Math.floor((new Date(today) - new Date(task.targetDate)) / (24 * 60 * 60 * 1000)) : 0
      
      // 🔥 使用批次的当前日龄
      const currentDayAge = batchInfoMap[task.batchId] || task.dayAge
      
      return {
        taskId: task._id,
        taskName: task.taskName || task.title,
        taskType: task.taskType,
        batchId: task.batchId,
        batchNumber: task.batchNumber,
        dayAge: currentDayAge,  // 🔥 使用当前日龄
        targetDate: task.targetDate,
        description: task.description || '',
        isOverdue,
        overdueDays,
        priority: isOverdue ? 'high' : (task.targetDate === today ? 'medium' : 'low'),
        estimatedCost: task.estimatedCost || 0
      }
    })
    
    // ========== 5. 返回结果 ==========
    const totalTime = Date.now() - startTime
    debugLog(`[首页预防待办] 查询成功，总耗时: ${totalTime}ms`, {
      ...logContext,
      tasksCount: tasks.length
    })
    
    return {
      success: true,
      data: {
        tasks,
        totalCount: tasks.length,
        hasMore: tasks.length >= limit
      },
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error('[首页预防待办] 查询失败', {
      ...logContext,
      error: error.message,
      stack: error.stack,
      totalTime
    })
    
    return {
      success: false,
      errorCode: error.code || 'UNKNOWN_ERROR',
      message: '获取今日待办失败，请稍后重试',
      error: error.message,
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// 获取预防管理全周期时间线
async function getPreventionTimeline(event, wxContext) {
  const startTime = Date.now()
  const logContext = { action: 'getPreventionTimeline', openid: wxContext.OPENID }
  
  try {
    const { batchId } = event
    const openid = wxContext.OPENID
    
    // ========== 1. 参数验证 ==========
    if (!batchId || batchId === 'all') {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '请选择具体批次查看时间线'
      }
    }
    
    // ========== 2. 权限验证 ==========
    debugLog('[时间线] 开始权限验证', logContext)
    const hasPermission = await checkPermission(openid, 'health', 'view', batchId)
    if (!hasPermission) {
      console.warn('[时间线] 权限不足', logContext)
      return {
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: '您没有查看该批次预防时间线的权限'
      }
    }
    
    // ========== 3. 获取批次信息 ==========
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .doc(batchId)
      .field({
        batchNumber: true,
        entryDate: true,
        quantity: true,
        status: true
      })
      .get()
    
    if (!batchResult.data) {
      return {
        success: false,
        errorCode: 'BATCH_NOT_FOUND',
        message: '批次不存在'
      }
    }
    
    const batch = batchResult.data
    
    // ========== 4. 查询该批次的所有预防任务 ==========
    // ✅ 修复：使用正确的 category 值（中文）
    const tasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .where({
        batchId: batchId,
        category: _.in(['健康管理', '营养管理', '疫苗接种', '用药管理'])
      })
      .field({
        _id: true,
        taskName: true,
        title: true,
        taskType: true,
        dayAge: true,
        targetDate: true,
        completed: true,
        completedAt: true,
        description: true,
        estimatedCost: true
      })
      .orderBy('dayAge', 'asc')
      .limit(100)
      .get()
    
    // ========== 5. 查询预防记录 ==========
    const recordsResult = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .where({
        batchId: batchId,
        ...dbManager.buildNotDeletedCondition(true)
      })
      .field({
        taskId: true,
        preventionType: true,
        preventionDate: true,
        'costInfo.totalCost': true
      })
      .orderBy('preventionDate', 'asc')
      .limit(100)
      .get()
    
    // ========== 6. 处理时间线数据 ==========
    const tasks = tasksResult.data || []
    const records = recordsResult.data || []
    
    // 创建任务ID到记录的映射
    const taskRecordMap = {}
    records.forEach(record => {
      if (record.taskId) {
        taskRecordMap[record.taskId] = record
      }
    })
    
    // 按日龄分组
    const timelineMap = {}
    tasks.forEach(task => {
      const dayAge = task.dayAge || 0
      const record = taskRecordMap[task._id]
      
      if (!timelineMap[dayAge]) {
        timelineMap[dayAge] = {
          dayAge: dayAge,
          date: task.targetDate,
          tasks: []
        }
      }
      
      timelineMap[dayAge].tasks.push({
        taskId: task._id,
        taskName: task.taskName || task.title,
        taskType: task.taskType,
        targetDate: task.targetDate,
        completed: task.completed || false,
        completedAt: task.completedAt || null,
        description: task.description || '',
        estimatedCost: task.estimatedCost || 0,
        actualCost: record ? (record.costInfo?.totalCost || 0) : 0,
        status: task.completed ? 'completed' : 
                (task.targetDate < new Date().toISOString().split('T')[0] ? 'overdue' : 'pending')
      })
    })
    
    // 转换为数组并排序
    const timeline = Object.values(timelineMap).sort((a, b) => a.dayAge - b.dayAge)
    
    // ========== 7. 计算进度统计 ==========
    const totalTasks = tasks.length
    const completedTasks = tasks.filter(t => t.completed).length
    const today = new Date().toISOString().split('T')[0]
    const overdueTasks = tasks.filter(t => !t.completed && t.targetDate < today).length
    const pendingTasks = totalTasks - completedTasks - overdueTasks
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    
    // ========== 8. 返回数据 ==========
    const totalTime = Date.now() - startTime
    debugLog(`[时间线] 操作成功，总耗时: ${totalTime}ms`, {
      ...logContext,
      batchId,
      timelineCount: timeline.length,
      totalTasks
    })
    
    return {
      success: true,
      data: {
        batch: {
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          entryDate: batch.entryDate,
          quantity: batch.quantity,
          status: batch.status
        },
        timeline,
        progress: {
          total: totalTasks,
          completed: completedTasks,
          pending: pendingTasks,
          overdue: overdueTasks,
          percentage
        }
      },
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error('[时间线] 获取时间线失败', {
      ...logContext,
      error: error.message,
      stack: error.stack,
      totalTime
    })
    
    return {
      success: false,
      errorCode: error.code || 'UNKNOWN_ERROR',
      message: '获取预防时间线失败，请稍后重试',
      error: error.message,
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// 获取批次预防对比数据
async function getBatchPreventionComparison(event, wxContext) {
  const startTime = Date.now()
  const logContext = { action: 'getBatchPreventionComparison', openid: wxContext.OPENID }
  
  try {
    const openid = wxContext.OPENID
    
    // ========== 1. 权限验证 ==========
    debugLog('[批次对比] 开始权限验证', logContext)
    const hasPermission = await checkPermission(openid, 'health', 'view', null)
    if (!hasPermission) {
      console.warn('[批次对比] 权限不足', logContext)
      return {
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: '您没有查看批次对比的权限'
      }
    }
    
    // ========== 2. 获取活跃批次 ==========
    const batchesResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .where({
        status: 'active',
        ...dbManager.buildNotDeletedCondition(true)
      })
      .field({
        _id: true,
        batchNumber: true,
        entryDate: true,
        quantity: true
      })
      .orderBy('entryDate', 'desc')
      .limit(10)
      .get()
    
    const batches = batchesResult.data || []
    
    if (batches.length === 0) {
      return {
        success: true,
        data: {
          batches: [],
          comparison: []
        }
      }
    }
    
    // ========== 3. 并发获取每个批次的预防数据 ==========
    const batchIds = batches.map(b => b._id)
    
    const [tasksResult, recordsResult] = await Promise.all([
      // 获取所有批次的任务
      // ✅ 修复：使用正确的 category 值（中文）
      db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
        .where({
          batchId: _.in(batchIds),
          category: _.in(['健康管理', '营养管理', '疫苗接种', '用药管理'])
        })
        .field({
          batchId: true,
          taskType: true,
          completed: true
        })
        .limit(1000)
        .get(),
      
      // 获取所有批次的预防记录
      db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
        .where({
          batchId: _.in(batchIds),
          ...dbManager.buildNotDeletedCondition(true)
        })
        .field({
          batchId: true,
          preventionType: true,
          'costInfo.totalCost': true
        })
        .limit(1000)
        .get()
    ])
    
    const tasks = tasksResult.data || []
    const records = recordsResult.data || []
    
    // ========== 4. 按批次统计数据 ==========
    const batchStats = {}
    
    batches.forEach(batch => {
      const batchId = batch._id
      const batchTasks = tasks.filter(t => t.batchId === batchId)
      const batchRecords = records.filter(r => r.batchId === batchId)
      
      const totalTasks = batchTasks.length
      const completedTasks = batchTasks.filter(t => t.completed).length
      const vaccineCount = batchRecords.filter(r => r.preventionType === 'vaccine').length
      const totalCost = batchRecords.reduce((sum, r) => sum + (r.costInfo?.totalCost || 0), 0)
      
      // 计算接种率（已完成疫苗任务 / 总疫苗任务）
      const vaccineTasks = batchTasks.filter(t => t.taskType === 'vaccine')
      const completedVaccineTasks = vaccineTasks.filter(t => t.completed).length
      const vaccinationRate = vaccineTasks.length > 0 ? 
        Math.round((completedVaccineTasks / vaccineTasks.length) * 100) : 0
      
      // 计算完成度
      const completionRate = totalTasks > 0 ? 
        Math.round((completedTasks / totalTasks) * 100) : 0
      
      batchStats[batchId] = {
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        entryDate: batch.entryDate,
        quantity: batch.quantity,
        vaccinationRate,
        vaccineCount,
        totalCost: Math.round(totalCost),
        completionRate,
        totalTasks,
        completedTasks
      }
    })
    
    // 转换为数组
    const comparison = Object.values(batchStats)
    
    // ========== 5. 返回数据 ==========
    const totalTime = Date.now() - startTime
    debugLog(`[批次对比] 操作成功，总耗时: ${totalTime}ms`, {
      ...logContext,
      batchCount: batches.length
    })
    
    return {
      success: true,
      data: {
        batches,
        comparison
      },
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error('[批次对比] 获取对比数据失败', {
      ...logContext,
      error: error.message,
      stack: error.stack,
      totalTime
    })
    
    return {
      success: false,
      errorCode: error.code || 'UNKNOWN_ERROR',
      message: '获取批次对比数据失败，请稍后重试',
      error: error.message,
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// 获取预防管理仪表盘数据
async function getPreventionDashboard(event, wxContext) {
  const startTime = Date.now()
  const logContext = { action: 'getPreventionDashboard', openid: wxContext.OPENID }
  
  try {
    const { batchId } = event
    const openid = wxContext.OPENID
    
    // ========== 1. 权限验证 ==========
    debugLog('[预防管理] 开始权限验证', logContext)
    debugLog('[预防管理] 批次ID:', batchId, '类型:', typeof batchId)
    debugLog('[预防管理] OpenID:', openid ? openid.substring(0, 8) + '...' : 'null')
    
    const hasPermission = await checkPermission(openid, 'health', 'view', batchId)
    debugLog('[预防管理] 权限验证结果:', hasPermission)
    
    if (!hasPermission) {
      console.warn('[预防管理] 权限不足', logContext)
      return {
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: '您没有查看预防管理数据的权限'
      }
    }
    debugLog('[预防管理] 权限验证通过')
    
    const today = new Date().toISOString().split('T')[0]
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // ========== 2. 获取批次信息以确定当前日龄 ==========
    let batchInfoMap = {}
    
    if (batchId && batchId !== 'all') {
      // 单个批次：获取该批次信息
      const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .doc(batchId)
        .get()
      
      if (batchResult.data) {
        const batch = batchResult.data
        const currentDayAge = calculateDayAge(batch.entryDate)
        batchInfoMap[batch._id] = {
          batchNumber: batch.batchNumber,
          entryDate: batch.entryDate,
          currentDayAge: currentDayAge
        }
      }
    } else {
      // 全部批次：获取所有活跃批次（不过滤status，因为批次可能有多种状态值）
      const batchesResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          ...dbManager.buildNotDeletedCondition(true)
        })
        .get()
      
      batchesResult.data.forEach(batch => {
        const currentDayAge = calculateDayAge(batch.entryDate)
        batchInfoMap[batch._id] = {
          batchNumber: batch.batchNumber,
          entryDate: batch.entryDate,
          currentDayAge: currentDayAge
        }
      })
    }
    
    // ========== 3. 构建查询条件（带批次权限） ==========
    // 🔥 修复：只查询当前日龄的任务
    const baseTaskWhere = {
      completed: false,
      category: _.in(['健康管理', '营养管理', '疫苗接种', '用药管理'])
    }
    
    // ========== 4. 分批次查询当日任务 ==========
    
    let todayTasksResult = { data: [] }
    let upcomingTasksResult = { data: [] }
    
    if (batchId && batchId !== 'all') {
      // 单个批次：查询该批次当前日龄的任务
      const batchInfo = batchInfoMap[batchId]
      if (batchInfo) {
        todayTasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
          .where({
            ...baseTaskWhere,
            batchId: batchId,
            dayAge: batchInfo.currentDayAge  // 🔥 只查询当前日龄的任务
          })
          .limit(50)
          .get()
        
        // 近期计划：查询未来7天的任务（日龄+1到+7）
        const futureDayAges = []
        for (let i = 1; i <= 7; i++) {
          futureDayAges.push(batchInfo.currentDayAge + i)
        }
        
        upcomingTasksResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
          .where({
            ...baseTaskWhere,
            batchId: batchId,
            dayAge: _.in(futureDayAges)
          })
          .limit(30)
          .get()
      }
    } else {
      // 全部批次：分别查询每个批次的当前日龄任务
      const batchIds = Object.keys(batchInfoMap)
      
      if (batchIds.length > 0) {
        // 并发查询所有批次的当日任务
        const todayTasksPromises = batchIds.map(async (bId) => {
          const batchInfo = batchInfoMap[bId]
          return await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
            .where({
              ...baseTaskWhere,
              batchId: bId,
              dayAge: batchInfo.currentDayAge  // 🔥 只查询当前日龄的任务
            })
            .limit(20)  // 每个批次最多20条
            .get()
        })
        
        const todayTasksResults = await Promise.all(todayTasksPromises)
        todayTasksResult.data = todayTasksResults.flatMap(r => r.data || [])
        
        // 近期计划：查询未来7天的任务
        const upcomingTasksPromises = batchIds.map(async (bId) => {
          const batchInfo = batchInfoMap[bId]
          const futureDayAges = []
          for (let i = 1; i <= 7; i++) {
            futureDayAges.push(batchInfo.currentDayAge + i)
          }
          
          return await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
            .where({
              ...baseTaskWhere,
              batchId: bId,
              dayAge: _.in(futureDayAges)
            })
            .limit(10)  // 每个批次最多10条
            .get()
        })
        
        const upcomingTasksResults = await Promise.all(upcomingTasksPromises)
        upcomingTasksResult.data = upcomingTasksResults.flatMap(r => r.data || [])
      }
    }
    
    // ========== 5. 查询预防记录和统计信息 ==========
    // 预防记录查询条件
    const baseRecordWhere = {
      ...dbManager.buildNotDeletedCondition(true)
    }
    if (batchId && batchId !== 'all') {
      baseRecordWhere.batchId = batchId
    }
    
    // 并发查询预防记录和批次信息
    const [preventionRecordsResult, recentRecordsResult, batchesResult] = await Promise.all([
      // 所有预防记录（用于统计）
      db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
        .where(baseRecordWhere)
        .get(),
      
      // 最近10条预防记录
      db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
        .where(baseRecordWhere)
        .field({
          preventionType: true,
          preventionDate: true,
          batchId: true,
          batchNumber: true,
          taskId: true,
          'costInfo.totalCost': true,
          operator: true,
          operatorName: true
        })
        .orderBy('preventionDate', 'desc')
        .limit(10)
        .get(),
      
      // 批次信息（用于计算接种率，不过滤status）
      db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          ...dbManager.buildNotDeletedCondition(true)
        })
        .field({ _id: true })
        .limit(100)
        .get()
    ])
    
    // ========== 6. 获取任务涉及的批次信息（用于显示日龄） ==========
    // 🔥 获取所有涉及的批次信息，用于在返回时显示正确的当前日龄
    const allTaskBatchIds = [...new Set([
      ...(todayTasksResult.data || []).map(t => t.batchId),
      ...(upcomingTasksResult.data || []).map(t => t.batchId)
    ].filter(Boolean))]
    
    // 为任务涉及的批次计算当前日龄（用于显示）
    const taskBatchInfoMap = {}
    if (allTaskBatchIds.length > 0) {
      const batchesInfoResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          _id: _.in(allTaskBatchIds)
        })
        .field({ _id: true, entryDate: true, batchNumber: true })
        .get()
      
      batchesInfoResult.data.forEach(batch => {
        const currentDayAge = calculateDayAge(batch.entryDate)
        taskBatchInfoMap[batch._id] = {
          batchNumber: batch.batchNumber,
          entryDate: batch.entryDate,
          currentDayAge: currentDayAge
        }
      })
    }
    
    // ========== 7. 处理今日待办 ==========
    // 🔥 使用批次的当前日龄，覆盖任务创建时的固定日龄
    const todayTasks = (todayTasksResult.data || [])
      .map(task => {
        const isOverdue = task.targetDate < today
        const overdueDays = isOverdue ? 
          Math.floor((new Date(today) - new Date(task.targetDate)) / (24 * 60 * 60 * 1000)) : 0
        
        // 🔥 使用批次的当前日龄（用于显示）
        const batchInfo = taskBatchInfoMap[task.batchId]
        const currentDayAge = batchInfo ? batchInfo.currentDayAge : task.dayAge
        
        return {
          ...task,  // ✅ 保留完整任务数据
          _id: task._id,
          taskId: task._id,
          dayAge: currentDayAge,  // 🔥 使用当前日龄用于显示
          isOverdue,
          overdueDays
        }
      })
    
    // ========== 8. 处理近期计划（按日期分组） ==========
    // 🔥 使用批次的当前日龄（用于显示）
    const upcomingTasksGrouped = {}
    const upcomingTasks = upcomingTasksResult.data || []
    
    upcomingTasks.forEach(task => {
      // 🔥 使用批次的当前日龄（用于显示）
      const batchInfo = taskBatchInfoMap[task.batchId]
      const currentDayAge = batchInfo ? batchInfo.currentDayAge : task.dayAge
      
      if (!upcomingTasksGrouped[task.targetDate]) {
        upcomingTasksGrouped[task.targetDate] = {
          date: task.targetDate,
          dayAge: task.dayAge,  // 使用任务自己的日龄（近期任务的日龄是未来的）
          tasks: []
        }
      }
      upcomingTasksGrouped[task.targetDate].tasks.push({
        ...task,  // ✅ 保留完整任务数据
        _id: task._id,
        taskId: task._id,
        dayAge: task.dayAge  // 近期任务保留原始日龄（未来的日龄）
      })
    })
    
    const upcomingTasksList = Object.values(upcomingTasksGrouped).slice(0, 7)
    
    // ========== 9. 计算统计数据（从查询结果手动计算） ==========
    const preventionRecords = preventionRecordsResult.data || []
    
    // 计算疫苗相关统计
    let vaccineCount = 0
    let vaccineCoverage = 0
    let medicationCount = 0  // 新增：统计用药类型的记录数量
    const vaccinatedBatchesSet = new Set()
    let totalCost = 0
    
    preventionRecords.forEach(record => {
      // 计算总成本
      if (record.costInfo && record.costInfo.totalCost) {
        totalCost += record.costInfo.totalCost
      }
      
      // 疫苗相关统计
      if (record.preventionType === 'vaccine') {
        vaccineCount++
        if (record.batchId) {
          vaccinatedBatchesSet.add(record.batchId)
        }
        if (record.vaccineInfo && record.vaccineInfo.count) {
          vaccineCoverage += record.vaccineInfo.count
        }
      }
      
      // 统计用药类型的记录（用于防疫用药）
      if (record.preventionType === 'medication') {
        medicationCount++
      }
    })
    
    const preventionCost = Math.round(totalCost)
    const vaccinatedBatchesCount = vaccinatedBatchesSet.size
    
    // 接种率（已接种批次数 / 在栏批次数）
    const totalBatches = batchesResult.data?.length || 0
    const vaccinationRate = totalBatches > 0 ? 
      parseFloat(((vaccinatedBatchesCount / totalBatches) * 100).toFixed(1)) : 0
    
    // ========== 10. 处理最近记录 ==========
    const recentRecordsFormatted = (recentRecordsResult.data || []).map(record => ({
      recordId: record._id,
      preventionType: record.preventionType,
      preventionDate: record.preventionDate,
      batchNumber: record.batchNumber,
      cost: record.costInfo?.totalCost || 0,
      operator: record.operatorName || '未知',
      taskId: record.taskId || null,
      details: {
        vaccineInfo: record.vaccineInfo,
        medicationInfo: record.medicationInfo,
        disinfectionInfo: record.disinfectionInfo
      }
    }))
    
    // ========== 11. 计算任务完成情况 ==========
    const allTasks = [...todayTasks, ...upcomingTasks]
    const total = allTasks.length
    const completed = allTasks.filter(t => t.completed).length
    const overdue = todayTasks.filter(t => t.isOverdue).length
    const pending = total - completed - overdue
    
    // ========== 12. 返回数据 ==========
    const totalTime = Date.now() - startTime
    debugLog(`[预防管理] 操作成功，总耗时: ${totalTime}ms`, {
      ...logContext,
      todayTasksCount: todayTasks.length,
      upcomingTasksCount: upcomingTasksList.length,
      recordsCount: recentRecordsFormatted.length
    })
    
    return {
      success: true,
      data: {
        todayTasks,
        upcomingTasks: upcomingTasksList,
        stats: {
          vaccinationRate,
          vaccineCount,
          preventionCost,
          vaccineCoverage,
          medicationCount  // 新增：返回所有预防记录数量
        },
        recentRecords: recentRecordsFormatted,
        taskCompletion: {
          total,
          completed,
          pending,
          overdue
        }
      },
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error('[预防管理] 获取仪表盘数据失败', {
      ...logContext,
      error: error.message,
      stack: error.stack,
      totalTime
    })
    
    return {
      success: false,
      errorCode: error.code || 'UNKNOWN_ERROR',
      message: '获取预防管理数据失败，请稍后重试',
      error: error.message,
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// 完成预防任务（优化版）
async function completePreventionTask(event, wxContext) {
  const startTime = Date.now()
  const logContext = { action: 'completePreventionTask', openid: wxContext.OPENID }
  
  try {
    const { taskId, batchId, preventionData } = event
    const openid = wxContext.OPENID
    
    // ========== 1. 参数验证 ==========
    if (!taskId) {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '任务ID不能为空'
      }
    }
    if (!batchId) {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '批次ID不能为空'
      }
    }
    if (!preventionData) {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '预防数据不能为空'
      }
    }
    
    // ========== 2. 权限验证 ==========
    debugLog('[预防任务] 开始权限验证', { ...logContext, taskId, batchId })
    const hasPermission = await checkPermission(openid, 'health', 'create', batchId)
    if (!hasPermission) {
      console.warn('[预防任务] 权限不足', logContext)
      return {
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: '您没有完成预防任务的权限'
      }
    }
    
    // ========== 3. 验证任务存在且未完成 ==========
    debugLog('[预防任务] 验证任务状态', { ...logContext, taskId })
    const taskResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .doc(taskId)
      .field({
        _id: true,
        taskName: true,
        taskType: true,
        completed: true,
        batchId: true,
        dayAge: true,
        farmId: true
      })
      .get()
    
    if (!taskResult.data) {
      console.warn('[预防任务] 任务不存在', { ...logContext, taskId })
      return {
        success: false,
        errorCode: 'TASK_NOT_FOUND',
        message: '任务不存在'
      }
    }
    
    const task = taskResult.data
    if (task.completed) {
      console.warn('[预防任务] 任务已完成', { ...logContext, taskId })
      return {
        success: false,
        errorCode: 'TASK_COMPLETED',
        message: '任务已完成，请勿重复提交'
      }
    }
    
    // ========== 4. 获取用户信息 ==========
    let userName = '未知用户'
    try {
      const userResult = await db.collection(COLLECTIONS.WX_USERS)
        .where({ _openid: openid })
        .field({ nickName: true, nickname: true, farmName: true, position: true })
        .limit(1)
        .get()
      
      if (userResult.data && userResult.data.length > 0) {
        const user = userResult.data[0]
        userName = user.nickName || user.nickname || user.farmName || user.position || '未知用户'
      }
    } catch (userError) {
      console.error('[预防任务] 获取用户信息失败', { ...logContext, error: userError.message })
    }
    
    // ========== 5. 创建预防记录 ==========
    debugLog('[预防任务] 创建预防记录', { ...logContext, taskId, batchId })
    const recordData = {
      ...preventionData,
      taskId,
      batchId,
      taskSource: 'breeding_schedule',
      batchAge: task.dayAge,
      actualDate: preventionData.preventionDate,
      deviation: 0, // TODO: 计算实际日期与计划日期的偏差
      operator: openid,
      operatorName: userName,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const recordResult = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .add({
        data: recordData
      })
    
    if (!recordResult._id) {
      console.error('[预防任务] 创建预防记录失败', logContext)
      return {
        success: false,
        errorCode: 'CREATE_RECORD_FAILED',
        message: '创建预防记录失败，请重试'
      }
    }
    
    debugLog('[预防任务] 预防记录创建成功', { ...logContext, recordId: recordResult._id })
    
    // ========== 6. 标记任务完成 ==========
    debugLog('[预防任务] 更新任务状态', { ...logContext, taskId })
    await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .doc(taskId)
      .update({
        data: {
          completed: true,
          completedAt: new Date(),
          completedBy: openid,
          recordId: recordResult._id,
          updateTime: new Date()
        }
      })
    
    // ========== 7. 创建财务成本记录（如果有成本） ==========
    let costRecordId = null
    if (preventionData.costInfo && preventionData.costInfo.totalCost > 0) {
      debugLog('[预防任务] 创建成本记录', { 
        ...logContext, 
        amount: preventionData.costInfo.totalCost 
      })
      
      try {
        const costResult = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
          .add({
            data: {
              farmId: task.farmId || '',
              batchId,
              category: preventionData.preventionType === 'vaccine' ? 'vaccine' : 
                       preventionData.preventionType === 'disinfection' ? 'disinfection' : 'medicine',
              amount: preventionData.costInfo.totalCost,
              costDate: preventionData.preventionDate,
              description: `预防任务：${task.taskName}`,
              relatedRecordId: recordResult._id,
              userId: openid,
              isDeleted: false,
              createdAt: new Date()
            }
          })
        
        costRecordId = costResult._id
        debugLog('[预防任务] 成本记录创建成功', { ...logContext, costRecordId })
      } catch (costError) {
        // 成本记录创建失败不影响主流程
        console.error('[预防任务] 创建成本记录失败', { 
          ...logContext, 
          error: costError.message 
        })
      }
    }
    
    // ========== 8. 记录审计日志 ==========
    try {
      await dbManager.createAuditLog(
        openid,
        'complete_prevention_task',
        COLLECTIONS.HEALTH_PREVENTION_RECORDS,
        recordResult._id,
        {
          taskId,
          batchId,
          preventionType: preventionData.preventionType,
          cost: preventionData.costInfo?.totalCost || 0,
          costRecordId,
          result: 'success'
        }
      )
    } catch (auditError) {
      // 审计日志失败不影响主流程
      console.error('[预防任务] 创建审计日志失败', { 
        ...logContext, 
        error: auditError.message 
      })
    }
    
    // ========== 9. 返回成功结果 ==========
    const totalTime = Date.now() - startTime
    debugLog('[预防任务] 任务完成成功', {
      ...logContext,
      recordId: recordResult._id,
      costRecordId,
      totalTime
    })
    
    return {
      success: true,
      recordId: recordResult._id,
      costRecordId,
      message: '任务完成成功',
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error('[预防任务] 完成任务失败', {
      ...logContext,
      error: error.message,
      stack: error.stack,
      totalTime
    })
    
    // 根据错误类型返回不同的错误码
    let errorCode = 'UNKNOWN_ERROR'
    let message = '完成预防任务失败，请稍后重试'
    
    if (error.message.includes('权限')) {
      errorCode = 'PERMISSION_DENIED'
      message = '权限不足，无法完成任务'
    } else if (error.message.includes('网络')) {
      errorCode = 'NETWORK_ERROR'
      message = '网络连接失败，请检查网络后重试'
    } else if (error.message.includes('数据库')) {
      errorCode = 'DATABASE_ERROR'
      message = '数据库操作失败，请稍后重试'
    }
    
    return {
      success: false,
      errorCode,
      message,
      error: error.message,
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
  }
}

/**
 * 更新预防记录的效果评估
 */
async function updatePreventionEffectiveness(event, wxContext) {
  try {
    const { recordId, effectiveness, effectivenessNote, evaluationDate } = event
    const openid = wxContext.OPENID

    if (!recordId) {
      return {
        success: false,
        message: '记录ID不能为空'
      }
    }

    if (!effectiveness) {
      return {
        success: false,
        message: '评估结果不能为空'
      }
    }

    // 更新预防记录
    await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .doc(recordId)
      .update({
        data: {
          effectiveness: effectiveness,
          effectivenessNote: effectivenessNote || '',
          evaluationDate: evaluationDate || new Date().toLocaleString('zh-CN'),
          evaluatedBy: openid,
          updatedAt: new Date()
        }
      })

    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'update_prevention_effectiveness',
      COLLECTIONS.HEALTH_PREVENTION_RECORDS,
      recordId,
      {
        effectiveness,
        effectivenessNote,
        result: 'success'
      }
    )

    return {
      success: true,
      message: '效果评估已更新'
    }

  } catch (error) {
    console.error('[updatePreventionEffectiveness] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '更新效果评估失败'
    }
  }
}
