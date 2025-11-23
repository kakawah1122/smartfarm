/**
 * get_treatment_detail 处理函数
 * 获取治疗记录详情（用于治疗进展跟进）（从health-management迁移）
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
 * 主处理函数 - 获取治疗详情（用于进展跟进）
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { treatmentId } = event
    
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
    
    // 返回结果（保持与原函数完全一致的返回格式）
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
    console.error('[get_treatment_detail] 获取治疗详情失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取治疗详情失败'
    }
  }
}
