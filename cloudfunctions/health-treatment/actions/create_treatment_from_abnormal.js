/**
 * create_treatment_from_abnormal 处理函数
 * 从异常记录创建治疗记录（从health-management迁移）
 * 这是最复杂的函数，涉及库存管理、事务处理、成本计算等
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')
const DatabaseManager = require('../database-manager')
const { generateRecordNumber, generateTreatmentNumber } = require('../helpers/generateRecordNumber')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const dbManager = new DatabaseManager(db)

/**
 * 主处理函数 - 从异常记录创建治疗记录
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
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

    // ✅ 所有治疗记录都创建为正式记录（不使用草稿）
    const hasMedicationsPayload = Array.isArray(medications) && medications.length > 0
    const hasMedicationsEvent = !!event.hasMedications
    const hasMedications = hasMedicationsPayload || hasMedicationsEvent
    
    // 生成治疗记录编号
    const treatmentNumber = await generateTreatmentNumber(db, COLLECTIONS)
    
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
      _openid: openid,  // ✅ 关键修复：添加 _openid 字段以支持查询
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
          // 生成单据号
          const recordNumber = generateRecordNumber(material.category || med.category || '药品')
          
          const materialRecordResult = await transaction.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).add({
            data: {
              type: 'use',
              recordNumber: recordNumber,  // 添加单据号
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
      
      // ✅ 同步更新 AI 诊断记录的 hasTreatment 字段
      try {
        const abnormalRecord = await db.collection(COLLECTIONS.HEALTH_RECORDS)
          .doc(abnormalRecordId)
          .field({ diagnosisId: true, relatedDiagnosisId: true })
          .get()
        
        if (abnormalRecord.data) {
          const diagnosisId = abnormalRecord.data.diagnosisId || abnormalRecord.data.relatedDiagnosisId
          
          if (diagnosisId) {
            await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
              .doc(diagnosisId)
              .update({
                data: {
                  hasTreatment: true,
                  latestTreatmentId: treatmentResult._id,
                  updatedAt: new Date()
                }
              })
            // 直接提交：已同步更新 AI 诊断记录
          }
        }
      } catch (syncError) {
        console.error('❌ 同步更新 AI 诊断记录失败:', syncError.message)
        // 不影响主流程
      }
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
    
    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      data: { 
        treatmentId: treatmentResult._id,
        treatmentNumber: treatmentNumber  // ✅ 返回治疗记录编号
      },
      message: '治疗记录创建成功'
    }
  } catch (error) {
    console.error('[create_treatment_from_abnormal] 创建治疗记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '创建治疗记录失败'
    }
  }
}
