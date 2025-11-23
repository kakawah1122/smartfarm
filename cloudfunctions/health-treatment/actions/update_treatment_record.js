/**
 * update_treatment_record 处理函数
 * 更新治疗记录（从health-management迁移）
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
 * 主处理函数 - 更新治疗记录
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { treatmentId, updateData } = event
    const openid = wxContext.OPENID
    
    // 参数验证（保持原有验证逻辑）
    if (!treatmentId) {
      throw new Error('治疗记录ID不能为空')
    }
    
    if (!updateData) {
      throw new Error('更新数据不能为空')
    }
    
    // 添加更新时间
    updateData.updatedAt = new Date()
    
    // 执行更新
    await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .update({
        data: updateData
      })
    
    // ✅ 保留原有逻辑：如果更新了治疗方案或用药记录，同步到关联的AI诊断记录
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
          console.log('✅ 已同步治疗更新到AI诊断记录:', treatmentRecord.data.diagnosisId)
        }
      } catch (syncError) {
        console.log('⚠️ 同步治疗更新到AI诊断记录失败:', syncError.message)
        // 不影响主流程
      }
    }
    
    // 记录审计日志（保持原有审计逻辑）
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
    
    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      message: '更新成功'
    }
  } catch (error) {
    console.error('[update_treatment_record] 更新治疗记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '更新治疗记录失败'
    }
  }
}
