/**
 * create_treatment_record 处理函数
 * 创建治疗记录（从health-management迁移）
 * 严格遵循项目规则，保持100%数据格式兼容
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')
const DatabaseManager = require('../database-manager')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const dbManager = new DatabaseManager(db)

/**
 * 生成治疗记录编号 ZL-YYYYMMDD-001
 * 保持原有逻辑不变
 */
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

/**
 * 主处理函数 - 创建治疗记录
 * 保持与原health-management完全一致的数据结构和逻辑
 */
exports.main = async (event, wxContext) => {
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

    // 构建记录数据（保持原有字段完全一致）
    const recordData = {
      treatmentNumber,  // ✅ 保留：治疗记录编号
      batchId,
      healthRecordId,
      diagnosisId: diagnosisId || '',  // ✅ 保留：关联AI诊断记录ID
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

    // 创建治疗记录
    const result = await dbManager.createTreatmentRecord(recordData)

    // ✅ 保留原有逻辑：如果有关联的AI诊断记录，同步更新治疗信息
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
        // 已同步治疗信息到AI诊断记录
      } catch (syncError) {
        // 同步治疗信息到AI诊断记录失败
        // 不影响主流程
      }
    }

    // 记录审计日志（保持原有审计逻辑）
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

    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      data: { 
        recordId: result._id,
        treatmentNumber: treatmentNumber  // ✅ 保留返回治疗记录编号
      },
      message: '治疗记录创建成功'
    }

  } catch (error) {
    console.error('[create_treatment_record] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '创建治疗记录失败'
    }
  }
}
