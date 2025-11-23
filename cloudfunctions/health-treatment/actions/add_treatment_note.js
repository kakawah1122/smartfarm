/**
 * add_treatment_note 处理函数
 * 添加治疗笔记（从health-management迁移）
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
 * 主处理函数 - 添加治疗笔记
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { treatmentId, note } = event
    const openid = wxContext.OPENID
    
    // 参数验证（保持原有验证逻辑）
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
    
    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      message: '治疗笔记保存成功'
    }
  } catch (error) {
    console.error('[add_treatment_note] 添加治疗笔记失败:', error)
    return {
      success: false,
      error: error.message,
      message: '添加治疗笔记失败'
    }
  }
}
