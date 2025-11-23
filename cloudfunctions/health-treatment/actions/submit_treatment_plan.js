/**
 * submit_treatment_plan 处理函数
 * 提交治疗计划（用户填写完治疗表单后调用）（从health-management迁移）
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
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
 * 主处理函数 - 提交治疗计划
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const {
      treatmentId,
      abnormalRecordId
    } = event
    const openid = wxContext.OPENID
    
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
    
    // 3. ✅ 同步更新 AI 诊断记录的 hasTreatment 字段
    try {
      // 先获取异常记录，获取关联的 diagnosisId
      const abnormalRecord = await db.collection(COLLECTIONS.HEALTH_RECORDS)
        .doc(abnormalRecordId)
        .field({ diagnosisId: true, relatedDiagnosisId: true })
        .get()
      
      if (abnormalRecord.data) {
        const diagnosisId = abnormalRecord.data.diagnosisId || abnormalRecord.data.relatedDiagnosisId
        
        if (diagnosisId) {
          // 更新 AI 诊断记录
          await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
            .doc(diagnosisId)
            .update({
              data: {
                hasTreatment: true,
                latestTreatmentId: treatmentId,
                updatedAt: new Date()
              }
            })
          console.log(`✅ 已同步更新 AI 诊断记录 (${diagnosisId}) 的 hasTreatment 为 true`)
        } else {
          console.log('⚠️ 异常记录缺少关联的诊断ID，无法同步更新 AI 诊断记录')
        }
      }
    } catch (syncError) {
      console.error('❌ 同步更新 AI 诊断记录失败:', syncError.message)
      // 不影响主流程，继续执行
    }
    
    // 4. 记录审计日志
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
    
    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      message: '治疗计划提交成功'
    }
  } catch (error) {
    console.error('[submit_treatment_plan] 提交治疗计划失败:', error)
    return {
      success: false,
      error: error.message,
      message: '提交治疗计划失败'
    }
  }
}
