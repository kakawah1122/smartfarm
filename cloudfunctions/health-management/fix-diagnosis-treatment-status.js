/**
 * 数据修复脚本：同步 AI 诊断记录的 hasTreatment 状态
 * 
 * 修复场景：
 * 1. 异常记录已流转到治疗中（status = 'treating'）
 * 2. 但关联的 AI 诊断记录的 hasTreatment 仍为 false
 * 
 * 使用方法：
 * 1. 在微信开发者工具中，打开"云开发"控制台
 * 2. 进入"云函数" -> health-management
 * 3. 点击"云函数配置" -> "测试"
 * 4. 输入以下参数：
 *    {
 *      "action": "fix_diagnosis_treatment_status"
 *    }
 * 5. 点击"测试"按钮执行修复
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 修复 AI 诊断记录的治疗状态
 */
async function fixDiagnosisTreatmentStatus(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    console.log(`🔧 开始修复用户 ${openid} 的诊断记录治疗状态...`)
    
    // 1. 查询所有状态为 'treating' 的异常记录
    const treatingRecords = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where({
        _openid: openid,
        status: 'treating',
        isDeleted: false
      })
      .field({
        _id: true,
        diagnosisId: true,
        relatedDiagnosisId: true,
        treatmentRecordId: true,
        batchId: true,
        diagnosis: true
      })
      .get()
    
    console.log(`📊 找到 ${treatingRecords.data.length} 条治疗中的异常记录`)
    
    if (treatingRecords.data.length === 0) {
      return {
        success: true,
        message: '没有需要修复的记录',
        data: {
          totalRecords: 0,
          fixedCount: 0,
          skippedCount: 0,
          errors: []
        }
      }
    }
    
    let fixedCount = 0
    let skippedCount = 0
    const errors = []
    
    // 2. 遍历每条异常记录，更新对应的 AI 诊断记录
    for (const record of treatingRecords.data) {
      const diagnosisId = record.diagnosisId || record.relatedDiagnosisId
      
      if (!diagnosisId) {
        console.warn(`⚠️ 异常记录 ${record._id} 缺少诊断ID，跳过`)
        skippedCount++
        continue
      }
      
      try {
        // 检查 AI 诊断记录是否存在
        const diagnosisRecord = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
          .doc(diagnosisId)
          .field({ hasTreatment: true })
          .get()
        
        if (!diagnosisRecord.data) {
          console.warn(`⚠️ AI 诊断记录 ${diagnosisId} 不存在，跳过`)
          skippedCount++
          continue
        }
        
        // 如果已经是 true，跳过
        if (diagnosisRecord.data.hasTreatment === true) {
          console.log(`✅ AI 诊断记录 ${diagnosisId} 已经标记为有治疗，跳过`)
          skippedCount++
          continue
        }
        
        // 更新 AI 诊断记录
        await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
          .doc(diagnosisId)
          .update({
            data: {
              hasTreatment: true,
              latestTreatmentId: record.treatmentRecordId || '',
              updatedAt: new Date()
            }
          })
        
        console.log(`✅ 已修复 AI 诊断记录 ${diagnosisId}`)
        fixedCount++
      } catch (error) {
        console.error(`❌ 修复失败 - 诊断ID: ${diagnosisId}`, error.message)
        errors.push({
          diagnosisId,
          abnormalRecordId: record._id,
          error: error.message
        })
      }
    }
    
    console.log(`🎉 修复完成！总计：${treatingRecords.data.length}，已修复：${fixedCount}，跳过：${skippedCount}，失败：${errors.length}`)
    
    return {
      success: true,
      message: `修复完成！已修复 ${fixedCount} 条记录`,
      data: {
        totalRecords: treatingRecords.data.length,
        fixedCount,
        skippedCount,
        errorCount: errors.length,
        errors: errors.slice(0, 5)  // 只返回前5个错误
      }
    }
  } catch (error) {
    console.error('❌ 修复失败:', error)
    return {
      success: false,
      error: error.message,
      message: '修复失败'
    }
  }
}

module.exports = {
  fixDiagnosisTreatmentStatus
}
