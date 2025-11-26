/**
 * create_treatment_from_diagnosis 处理函数
 * 从AI诊断创建治疗记录（从health-management迁移）
 * 涉及库存管理、成本计算、健康记录创建等复杂逻辑
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')
const DatabaseManager = require('../database-manager')
const { generateRecordNumber } = require('../helpers/generateRecordNumber')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const dbManager = new DatabaseManager(db)

/**
 * 主处理函数 - 从AI诊断创建治疗记录
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
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
    const finalAffectedCount = affectedCount || diagnosisRecord.data.affectedCount || 0
    const treatmentData = {
      batchId,
      diagnosisId,
      // ✅ 根级别字段（用于聚合统计）
      status: 'ongoing',
      affectedCount: finalAffectedCount,
      curedCount: 0,
      diedCount: 0,
      // 其他字段
      treatmentStatus: 'ongoing',
      treatmentDate: new Date().toISOString().split('T')[0],
      diagnosis: diagnosis || diagnosisRecord.data.primaryDiagnosis?.disease || '待确定',
      diagnosisConfidence: diagnosisRecord.data.primaryDiagnosis?.confidence || 0,
      initialCount: finalAffectedCount,
      totalCost: 0,
      medications: recommendations?.medication || [],
      treatmentPlan: {
        primary: recommendations?.immediate?.join('; ') || '',
        supportive: recommendations?.supportive || []
      },
      operator: openid,
      _openid: openid,  // ✅ 关键修复：添加 _openid 字段以支持查询
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
          // 生成单据号
          const recordNumber = generateRecordNumber(material.category || '药品')
          
          const materialRecordResult = await transaction.collection(COLLECTIONS.PROD_MATERIAL_RECORDS).add({
            data: {
              type: 'use',
              recordNumber: recordNumber,  // 添加单据号
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
    
    // 更新AI诊断记录的治疗状态
    try {
      await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
        .doc(diagnosisId)
        .update({
          data: {
            hasTreatment: true,
            treatmentId: result._id,
            updatedAt: new Date()
          }
        })
    } catch (updateError) {
      console.error('更新诊断记录失败（不影响治疗记录）:', updateError)
      // 不影响主流程
    }
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_treatment_from_diagnosis',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      result._id,
      {
        diagnosisId,
        batchId,
        affectedCount,
        result: 'success'
      }
    )
    
    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      data: {
        treatmentId: result._id,
        affectedCount,
        medications: medications.length,
        totalCost: totalMedicationCost
      },
      message: '治疗记录创建成功'
    }
  } catch (error) {
    console.error('[create_treatment_from_diagnosis] 创建治疗记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '创建治疗记录失败'
    }
  }
}
