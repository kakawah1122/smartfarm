/**
 * correct_death_diagnosis 处理函数
 * 修正死亡诊断（从health-management迁移）
 * 包括AI诊断同步更新、用户信息获取、诊断类型判断等
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 辅助函数：调试日志（生产环境自动关闭）
function debugLog(message, data) {
  // 生产环境不输出调试日志
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, data)
  }
}

/**
 * 主处理函数 - 修正死亡诊断
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const {
      recordId,
      correctedCause,
      correctionReason, // 兽医诊断（前端的veterinarianDiagnosis字段）
      aiAccuracyRating,
      isConfirmed = false
    } = event
    
    const openid = wxContext.OPENID
    
    // 验证必填参数
    if (!recordId) {
      throw new Error('记录ID不能为空')
    }
    if (!correctedCause) {
      throw new Error('修正后的死因不能为空')
    }
    if (!correctionReason) {
      throw new Error('修正依据不能为空')
    }
    if (!aiAccuracyRating || aiAccuracyRating < 1 || aiAccuracyRating > 5) {
      throw new Error('AI准确性评分必须在1-5之间')
    }
    
    // 获取当前记录
    const recordResult = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!recordResult.data) {
      throw new Error('记录不存在')
    }
    
    const record = recordResult.data
    
    // 验证权限（兼容 _openid 和 createdBy 两种字段）
    if (record._openid !== openid && record.createdBy !== openid) {
      throw new Error('无权修改此记录')
    }
    
    // 获取用户信息（用于记录修正人姓名）
    let userName = '未知用户'
    try {
      const userResult = await db.collection(COLLECTIONS.WX_USERS)
        .where({ _openid: openid })
        .limit(1)
        .get()
      
      if (userResult.data && userResult.data.length > 0) {
        // 优先使用用户昵称，其次养殖场名称，最后职位
        const user = userResult.data[0]
        userName = user.nickName || user.nickname || user.farmName || user.position || '未知用户'
      }
    } catch (userError) {
      console.error('获取用户信息失败:', userError)
    }
    
    // 确定修正类型
    let correctionType = 'partial_error'
    if (isConfirmed) {
      correctionType = 'confirmed'
    } else if (correctedCause === record.deathCause) {
      correctionType = 'supplement'
    } else if (aiAccuracyRating <= 2) {
      correctionType = 'complete_error'
    }
    
    // 更新死亡记录
    const updateData = {
      isCorrected: true,
      originalAiCause: record.originalAiCause || record.deathCause, // 保留原始AI诊断
      correctedCause: correctedCause,
      correctionReason: correctionReason, // 兽医诊断内容
      correctionType: correctionType,
      aiAccuracyRating: aiAccuracyRating,
      correctedBy: openid,
      correctedByName: userName,
      correctedAt: new Date(),
      updatedAt: new Date()
    }
    
    await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .doc(recordId)
      .update({
        data: updateData
      })
    
    // ✅ 如果有AI诊断ID，同步更新AI诊断记录（与异常记录保持一致）
    if (record.aiDiagnosisId) {
      try {
        await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
          .doc(record.aiDiagnosisId)
          .update({
            data: {
              isCorrected: true,
              correctedDiagnosis: correctedCause,
              correctionReason: correctionReason,
              veterinarianDiagnosis: correctionReason,  // 兽医诊断内容
              aiAccuracyRating: aiAccuracyRating,
              correctionType: correctionType,
              correctedBy: openid,
              correctedByName: userName,
              correctedAt: new Date().toISOString(),
              // 保留原有的 feedback 字段以兼容旧代码
              feedback: {
                isCorrected: true,
                correctedCause: correctedCause,
                correctionReason: correctionReason,
                aiAccuracyRating: aiAccuracyRating,
                correctedAt: new Date()
              },
              updatedAt: new Date()
            }
          })
        debugLog('✅ 已同步更新 AI 诊断记录:', record.aiDiagnosisId)
      } catch (feedbackError) {
        debugLog('⚠️ 更新 AI 诊断记录失败（可能记录不存在）:', feedbackError.message)
        // 不影响主流程
      }
    }
    
    return {
      success: true,
      data: {
        recordId: recordId,
        correctionType: correctionType
      },
      message: isConfirmed ? '诊断确认成功' : '诊断修正成功'
    }
    
  } catch (error) {
    console.error('[correct_death_diagnosis] 修正诊断失败:', error)
    return {
      success: false,
      error: error.message,
      message: '修正诊断失败'
    }
  }
}
