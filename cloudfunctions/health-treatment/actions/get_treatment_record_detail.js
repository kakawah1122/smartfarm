/**
 * get_treatment_record_detail 处理函数
 * 获取治疗记录详情（从health-management迁移）
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
 * 主处理函数 - 获取治疗记录详情
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { treatmentId } = event
    
    // 参数验证（保持原有验证逻辑）
    if (!treatmentId) {
      throw new Error('治疗记录ID不能为空')
    }
    
    // 查询治疗记录
    const result = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .doc(treatmentId)
      .get()
    
    if (!result.data) {
      throw new Error('治疗记录不存在')
    }
    
    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      data: result.data,
      message: '获取成功'
    }
  } catch (error) {
    console.error('[get_treatment_record_detail] 获取治疗记录详情失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取治疗记录详情失败'
    }
  }
}
