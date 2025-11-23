/**
 * create_health_record 处理函数
 * 从 health-management 迁移，保持数据格式兼容
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
 * 计算严重程度
 */
function calculateSeverity(sickCount, deadCount, totalCount) {
  if (totalCount === 0) return 'low'
  
  const sickRate = (sickCount / totalCount) * 100
  const deathRate = (deadCount / totalCount) * 100
  
  if (deathRate > 5 || sickRate > 20) return 'critical'
  if (deathRate > 2 || sickRate > 10) return 'high'
  if (deathRate > 0.5 || sickRate > 5) return 'medium'
  return 'low'
}

/**
 * 主处理函数 - 创建健康记录
 */
exports.main = async (event, wxContext) => {
  try {
    const {
      batchId,
      recordType,
      totalCount,
      healthyCount,
      sickCount,
      deadCount,
      symptoms,
      diagnosis,
      treatment,
      notes
    } = event
    const openid = wxContext.OPENID

    // 构建记录数据
    const recordData = {
      batchId,
      recordType: recordType || 'routine_check',
      checkDate: new Date().toISOString().split('T')[0],
      inspector: openid,
      totalCount: totalCount || 0,
      healthyCount: healthyCount || 0,
      sickCount: sickCount || 0,
      deadCount: deadCount || 0,
      symptoms: symptoms || [],
      diagnosis: diagnosis || '',
      treatment: treatment || '',
      notes: notes || '',
      followUpRequired: sickCount > 0,
      followUpDate: sickCount > 0 ? 
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
      severity: calculateSeverity(sickCount, deadCount, totalCount)
    }

    // 创建健康记录
    const result = await dbManager.createHealthRecord(recordData)

    // 如果有死亡情况，需要创建死亡记录（通过调用death云函数）
    if (deadCount > 0) {
      // TODO: 调用 health-death 云函数创建死亡记录
      // 暂时记录日志，等health-death云函数完成后再实现
      console.log('[create_health_record] 需要创建死亡记录:', {
        batchId,
        healthRecordId: result._id,
        deadCount
      })
    }

    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'create_health_record',
      COLLECTIONS.HEALTH_RECORDS,
      result._id,
      {
        batchId,
        recordType,
        sickCount,
        deadCount,
        severity: recordData.severity,
        result: 'success'
      }
    )

    // 返回成功结果（保持与原函数兼容）
    return {
      success: true,
      data: { recordId: result._id },
      message: '健康记录创建成功'
    }

  } catch (error) {
    console.error('[create_health_record] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '创建健康记录失败'
    }
  }
}
