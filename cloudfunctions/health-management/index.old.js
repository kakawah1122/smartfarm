/**
 * health-management 云函数（精简版）
 * 仅保留未迁移到新架构的功能
 * 
 * 已迁移功能：
 * - 健康记录 → health-records
 * - 治疗管理 → health-treatment
 * - 死亡记录 → health-death
 * - 异常诊断 → health-abnormal
 * - 预防管理 → health-prevention
 * - 健康概览 → health-overview
 * - AI诊断 → ai-diagnosis
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
  traceUser: true
})

const db = cloud.database()
const _ = db.command

// 引入共享的集合配置
const { COLLECTIONS } = require('./shared-config/collections.js')

// 数据库管理器（保留必要的辅助功能）
const dbManager = {
  // 保留必要的辅助方法
  buildNotDeletedCondition: function(includeDeleted = false) {
    if (!includeDeleted) {
      return { isDeleted: _.neq(true) }
    }
    return {}
  },
  
  createAuditLog: async function(openid, action, collection, docId, details) {
    try {
      await db.collection(COLLECTIONS.SYS_AUDIT_LOGS).add({
        data: {
          userId: openid,
          action,
          collection,
          documentId: docId,
          details,
          timestamp: new Date(),
          createdAt: new Date()
        }
      })
    } catch (error) {
      console.error('创建审计日志失败:', error)
    }
  }
}

// 调试日志函数
function debugLog(message, data) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, data)
  }
}

// 权限验证函数（保留）
async function checkPermission(openid, module, action, resourceId = null) {
  try {
    const userResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: openid })
      .limit(1)
      .get()
    
    if (!userResult.data || userResult.data.length === 0) {
      return false
    }
    
    const user = userResult.data[0]
    
    if (user.role === 'admin' || user.role === 'operator') {
      return true
    }
    
    if (user.role === 'viewer' && action === 'read') {
      return true
    }
    
    return false
  } catch (error) {
    console.error('权限验证失败:', error)
    return false
  }
}

// 获取批次提示数据（未迁移，保留）
async function getBatchPromptData(event, wxContext) {
  try {
    const { batchId, includeHistory = false } = event
    const openid = wxContext.OPENID
    
    // 获取批次信息
    const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
      .doc(batchId)
      .get()
    
    if (!batchResult.data) {
      return {
        success: false,
        error: '批次不存在'
      }
    }
    
    const batch = batchResult.data
    
    // 构建提示数据
    const promptData = {
      batchInfo: {
        batchNumber: batch.batchNumber,
        entryDate: batch.entryDate,
        dayAge: batch.dayAge || 0,
        currentCount: batch.currentCount || 0,
        deadCount: batch.deadCount || 0
      }
    }
    
    // 如果需要历史数据
    if (includeHistory) {
      // 获取最近的健康记录
      const healthRecords = await db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({
          batchId,
          isDeleted: _.neq(true)
        })
        .orderBy('checkDate', 'desc')
        .limit(5)
        .get()
      
      promptData.recentHealthRecords = healthRecords.data
    }
    
    return {
      success: true,
      data: promptData
    }
  } catch (error) {
    console.error('获取批次提示数据失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 修复诊断治疗状态（系统维护功能，保留）
async function fixDiagnosisTreatmentStatus(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    
    // 只有管理员可以执行
    const hasPermission = await checkPermission(openid, 'system', 'admin')
    if (!hasPermission) {
      return {
        success: false,
        error: '权限不足'
      }
    }
    
    // 执行修复逻辑
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
    
    for (const diagnosis of diagnosisRecords.data) {
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
              updatedAt: new Date()
            }
          })
        fixedCount++
      }
    }
    
    return {
      success: true,
      data: {
        fixedCount,
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

// 修复治疗记录openid（数据修复功能，保留）
async function fixTreatmentRecordsOpenId(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    
    // 权限验证
    const hasPermission = await checkPermission(openid, 'system', 'admin')
    if (!hasPermission) {
      return {
        success: false,
        error: '权限不足'
      }
    }
    
    console.log('开始修复治疗记录openid...')
    
    // 查找缺少_openid的记录
    const records = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        _openid: _.exists(false)
      })
      .limit(100)
      .get()
    
    let fixedCount = 0
    
    for (const record of records.data) {
      if (record.userId || record.createdBy) {
        await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
          .doc(record._id)
          .update({
            data: {
              _openid: record.userId || record.createdBy,
              updatedAt: new Date()
            }
          })
        fixedCount++
      }
    }
    
    return {
      success: true,
      data: {
        fixedCount,
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

// 云函数主入口
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  console.log('[health-management] 收到请求:', { action, openid: wxContext.OPENID })
  
  try {
    switch (action) {
      // 保留未迁移的功能
      case 'get_batch_prompt_data':
        return await getBatchPromptData(event, wxContext)
      
      // 系统维护功能
      case 'fix_diagnosis_treatment_status':
        return await fixDiagnosisTreatmentStatus(event, wxContext)
      
      case 'fix_treatment_records_openid':
        return await fixTreatmentRecordsOpenId(event, wxContext)
      
      // 已迁移的功能返回迁移提示
      case 'create_health_record':
      case 'list_health_records':
        return {
          success: false,
          error: '该功能已迁移到 health-records 云函数',
          redirect: 'health-records'
        }
      
      case 'create_treatment_record':
      case 'list_treatment_records':
      case 'get_cured_records_list':
        return {
          success: false,
          error: '该功能已迁移到 health-treatment 云函数',
          redirect: 'health-treatment'
        }
      
      case 'create_death_record':
      case 'list_death_records':
        return {
          success: false,
          error: '该功能已迁移到 health-death 云函数',
          redirect: 'health-death'
        }
      
      case 'create_abnormal_record':
      case 'list_abnormal_records':
        return {
          success: false,
          error: '该功能已迁移到 health-abnormal 云函数',
          redirect: 'health-abnormal'
        }
      
      case 'create_prevention_record':
      case 'list_prevention_records':
      case 'complete_prevention_task':
        return {
          success: false,
          error: '该功能已迁移到 health-prevention 云函数',
          redirect: 'health-prevention'
        }
      
      case 'get_health_overview':
      case 'get_batch_complete_data':
        return {
          success: false,
          error: '该功能已迁移到 health-overview 云函数',
          redirect: 'health-overview'
        }
      
      case 'get_diagnosis_history':
        return {
          success: false,
          error: '该功能已迁移到 ai-diagnosis 云函数',
          redirect: 'ai-diagnosis'
        }
      
      default:
        return {
          success: false,
          error: `未知的 action: ${action}`
        }
    }
  } catch (error) {
    console.error('[health-management] 执行失败:', error)
    return {
      success: false,
      error: error.message,
      stack: error.stack
    }
  }
}
