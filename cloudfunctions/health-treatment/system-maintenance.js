/**
 * 系统维护功能
 * 从 health-management 迁移
 * 包含数据修复和系统维护相关功能
 */

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const { COLLECTIONS } = require('./collections.js')

/**
 * 权限验证函数
 */
async function checkAdminPermission(openid) {
  try {
    const userResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: openid })
      .limit(1)
      .get()
    
    if (!userResult.data || userResult.data.length === 0) {
      return false
    }
    
    const user = userResult.data[0]
    return user.role === 'admin'
  } catch (error) {
    console.error('权限验证失败:', error)
    return false
  }
}

/**
 * 修复诊断治疗状态
 * 扫描诊断记录，标记已有治疗的记录
 */
async function fixDiagnosisTreatmentStatus(event, openid) {
  try {
    // 只有管理员可以执行
    const isAdmin = await checkAdminPermission(openid)
    if (!isAdmin) {
      return {
        success: false,
        error: '权限不足，需要管理员权限'
      }
    }
    
    console.log('开始修复诊断治疗状态...')
    
    // 查找所有未标记hasTreatment的诊断记录
    const diagnosisRecords = await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
      .where({
        hasTreatment: _.neq(true),
        isDeleted: _.neq(true)
      })
      .limit(100)
      .get()
    
    let fixedCount = 0
    let errors = []
    
    // 批量处理
    for (const diagnosis of diagnosisRecords.data) {
      try {
        // 查找是否有关联的治疗记录
        const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
          .where({
            diagnosisId: diagnosis._id,
            isDeleted: _.neq(true)
          })
          .limit(1)
          .get()
        
        if (treatmentResult.data && treatmentResult.data.length > 0) {
          // 更新诊断记录
          await db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS)
            .doc(diagnosis._id)
            .update({
              data: {
                hasTreatment: true,
                treatmentId: treatmentResult.data[0]._id,
                updatedAt: new Date(),
                updatedBy: 'system_maintenance'
              }
            })
          fixedCount++
        }
      } catch (err) {
        errors.push({
          diagnosisId: diagnosis._id,
          error: err.message
        })
      }
    }
    
    // 记录审计日志
    await db.collection(COLLECTIONS.SYS_AUDIT_LOGS).add({
      data: {
        userId: openid,
        action: 'fix_diagnosis_treatment_status',
        module: 'health-treatment',
        details: {
          totalRecords: diagnosisRecords.data.length,
          fixedCount,
          errors: errors.length
        },
        timestamp: new Date(),
        createdAt: new Date()
      }
    })
    
    return {
      success: true,
      data: {
        totalScanned: diagnosisRecords.data.length,
        fixedCount,
        errorCount: errors.length,
        errors: errors.slice(0, 10), // 只返回前10个错误
        message: `成功修复 ${fixedCount} 条诊断记录`
      }
    }
  } catch (error) {
    console.error('修复诊断治疗状态失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 修复治疗记录openid
 * 为缺少_openid的治疗记录补充openid
 */
async function fixTreatmentRecordsOpenId(event, openid) {
  try {
    // 权限验证
    const isAdmin = await checkAdminPermission(openid)
    if (!isAdmin) {
      return {
        success: false,
        error: '权限不足，需要管理员权限'
      }
    }
    
    console.log('开始修复治疗记录openid...')
    
    // 查找缺少_openid的记录
    const records = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        _openid: _.or(_.exists(false), _.eq(''))
      })
      .limit(100)
      .get()
    
    let fixedCount = 0
    let skippedCount = 0
    let errors = []
    
    for (const record of records.data) {
      try {
        // 尝试从多个字段获取openid
        const possibleOpenId = record.userId || record.createdBy || record.operatorId
        
        if (possibleOpenId) {
          await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
            .doc(record._id)
            .update({
              data: {
                _openid: possibleOpenId,
                updatedAt: new Date(),
                updatedBy: 'system_maintenance'
              }
            })
          fixedCount++
        } else {
          skippedCount++
        }
      } catch (err) {
        errors.push({
          recordId: record._id,
          error: err.message
        })
      }
    }
    
    // 记录审计日志
    await db.collection(COLLECTIONS.SYS_AUDIT_LOGS).add({
      data: {
        userId: openid,
        action: 'fix_treatment_records_openid',
        module: 'health-treatment',
        details: {
          totalRecords: records.data.length,
          fixedCount,
          skippedCount,
          errors: errors.length
        },
        timestamp: new Date(),
        createdAt: new Date()
      }
    })
    
    return {
      success: true,
      data: {
        totalScanned: records.data.length,
        fixedCount,
        skippedCount,
        errorCount: errors.length,
        errors: errors.slice(0, 10),
        message: `成功修复 ${fixedCount} 条治疗记录`
      }
    }
  } catch (error) {
    console.error('修复治疗记录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 批量修复数据一致性
 * 综合修复功能
 */
async function batchFixDataConsistency(event, openid) {
  try {
    const isAdmin = await checkAdminPermission(openid)
    if (!isAdmin) {
      return {
        success: false,
        error: '权限不足，需要管理员权限'
      }
    }
    
    console.log('开始批量修复数据一致性...')
    
    // 执行多个修复任务
    const results = {
      diagnosisStatus: await fixDiagnosisTreatmentStatus(event, openid),
      treatmentOpenId: await fixTreatmentRecordsOpenId(event, openid)
    }
    
    return {
      success: true,
      data: {
        message: '批量修复完成',
        results
      }
    }
  } catch (error) {
    console.error('批量修复失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 记录治疗中的死亡
 * TODO: 从health-management迁移完整逻辑
 */
async function recordTreatmentDeath(event, wxContext) {
  console.log('[recordTreatmentDeath] 功能待迁移')
  return {
    success: false,
    error: '该功能正在迁移中，请暂时使用health-management云函数'
  }
}

/**
 * 列出治疗记录
 * TODO: 从health-management迁移完整逻辑
 */
async function listTreatmentRecords(event, wxContext) {
  const { batchId, status, page = 1, pageSize = 20 } = event
  
  try {
    const query = {}
    if (batchId && batchId !== 'all') {
      query.batchId = batchId
    }
    if (status) {
      query.status = status
    }
    
    const countResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where(query)
      .count()
    
    const result = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where(query)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    return {
      success: true,
      data: {
        list: result.data,
        total: countResult.total,
        page,
        pageSize
      }
    }
  } catch (error) {
    console.error('[listTreatmentRecords] 查询失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

module.exports = {
  fixDiagnosisTreatmentStatus,
  fixTreatmentRecordsOpenId,
  batchFixDataConsistency,
  recordTreatmentDeath,
  listTreatmentRecords
}
