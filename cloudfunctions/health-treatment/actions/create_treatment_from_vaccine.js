/**
 * create_treatment_from_vaccine 处理函数
 * 从疫苗追踪创建治疗记录（从health-management迁移）
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
 * 主处理函数 - 从疫苗追踪创建治疗记录
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const {
      vaccineRecordId,
      batchId,
      batchNumber,
      affectedCount,
      diagnosis,
      vaccineName,
      preventionDate
    } = event
    const openid = wxContext.OPENID
    
    // 创建治疗记录
    const finalAffectedCount = affectedCount || 1
    const treatmentData = {
      batchId,
      batchNumber: batchNumber || batchId,  // ✅ 保存批次编号用于显示
      vaccineRecordId,  // 关联疫苗记录
      // ✅ 根级别字段（用于聚合统计）
      status: 'ongoing',
      affectedCount: finalAffectedCount,
      curedCount: 0,
      diedCount: 0,
      // 其他字段
      animalIds: [],
      treatmentDate: new Date().toISOString().split('T')[0],
      treatmentType: 'medication',
      diagnosis: {
        preliminary: diagnosis || '疫苗接种后异常反应',
        confirmed: diagnosis || '疫苗接种后异常反应',
        confidence: 0,
        diagnosisMethod: 'manual'
      },
      treatmentPlan: {
        primary: `疫苗名称：${vaccineName}，接种日期：${preventionDate}，需观察并制定治疗方案`,
        followUpSchedule: []
      },
      medications: [],
      progress: [{
        date: new Date().toISOString().split('T')[0],
        type: 'record_created',
        content: `疫苗接种后异常反应记录已创建，异常数量：${affectedCount}只`,
        operator: openid,
        createdAt: new Date()
      }],
      outcome: {
        status: 'ongoing',
        curedCount: 0,
        improvedCount: 0,
        deathCount: 0,
        totalTreated: affectedCount || 1
      },
      cost: {
        medication: 0,
        veterinary: 0,
        supportive: 0,
        total: 0
      },
      notes: `疫苗：${vaccineName}，接种日期：${preventionDate}`,
      isDraft: false,
      isDeleted: false,
      _openid: openid,  // ✅ 关键修复：添加 _openid 字段以支持查询
      createdBy: openid,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS).add({
      data: treatmentData
    })
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_treatment_from_vaccine',
      COLLECTIONS.HEALTH_TREATMENT_RECORDS,
      treatmentResult._id,
      {
        vaccineRecordId,
        batchId,
        affectedCount,
        result: 'success'
      }
    )
    
    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      data: { treatmentId: treatmentResult._id },
      message: '治疗记录创建成功'
    }
  } catch (error) {
    console.error('[create_treatment_from_vaccine] 创建疫苗追踪治疗记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '创建治疗记录失败'
    }
  }
}
