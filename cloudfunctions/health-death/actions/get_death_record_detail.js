/**
 * get_death_record_detail 处理函数
 * 获取死亡记录详情（从health-management迁移）
 * 包括AI诊断信息、图片映射、时间格式化等
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
 * 主处理函数 - 获取死亡记录详情
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
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
    
    // ✅ 格式化修正时间为北京时间（YYYY-MM-DD HH:mm:ss）
    if (record.correctedAt) {
      const date = new Date(record.correctedAt)
      try {
        // 使用北京时间
        const beijingTimeStr = date.toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
        record.correctedAt = beijingTimeStr.replace(/\//g, '-').replace(/\s/, ' ')
      } catch (error) {
        console.error('北京时间格式化失败，使用降级处理:', error)
        // 降级处理
        record.correctedAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
      }
    }
    
    return {
      success: true,
      data: record,
      message: '获取死亡记录详情成功'
    }
    
  } catch (error) {
    console.error('[get_death_record_detail] 获取死亡记录详情失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取死亡记录详情失败'
    }
  }
}
