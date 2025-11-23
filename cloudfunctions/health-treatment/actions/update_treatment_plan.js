/**
 * update_treatment_plan 处理函数
 * 调整治疗方案（从health-management迁移）
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 主处理函数 - 调整治疗方案
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
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
    
    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      message: '治疗方案调整成功'
    }
  } catch (error) {
    console.error('[update_treatment_plan] 调整治疗方案失败:', error)
    return {
      success: false,
      error: error.message,
      message: '调整治疗方案失败'
    }
  }
}
