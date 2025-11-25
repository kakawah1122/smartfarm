/**
 * 完成预防任务（从health-management迁移）
 * 处理预防任务的完成，包括权限验证、记录创建、财务同步等
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 引入共享的集合配置
const { COLLECTIONS } = require('./collections.js')

// 辅助函数：调试日志（生产环境自动关闭）
function debugLog(message, data) {
  // 生产环境不输出调试日志
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, data)
  }
}

// 权限验证函数（与原函数完全一致）
async function checkPermission(openid, module, action, resourceId = null) {
  try {
    // 1. 获取用户信息（从wx_users获取角色）
    const userResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: openid })
      .limit(1)
      .get()
    
    if (!userResult.data || userResult.data.length === 0) {
      debugLog('[权限验证] 用户不存在', { openid, module, action })
      return false
    }
    
    const user = userResult.data[0]
    const userRole = user.role || 'employee'
    debugLog('[权限验证] 用户角色:', { openid: openid.substring(0, 8) + '...', userRole, module, action })
    
    // 2. 直接从wx_users获取角色（简化权限检查）
    // 超级管理员拥有所有权限
    if (userRole === 'super_admin') {
      return true
    }
    
    // 3. 获取角色权限定义（从sys_roles）
    const roleResult = await db.collection(COLLECTIONS.SYS_ROLES)
      .where({
        roleCode: userRole,
        isActive: true
      })
      .limit(1)
      .get()
    
    if (!roleResult.data || roleResult.data.length === 0) {
      // 如果角色定义不存在，默认允许所有操作（向后兼容）
      debugLog('[权限验证] 角色定义不存在，默认允许', { userRole, module, action })
      return true  // 改为 true
    }
    
    const role = roleResult.data[0]
    const permissions = role.permissions || []
    
    // 4. 检查模块权限
    const modulePermission = permissions.find(p => 
      p.module === module || p.module === '*'
    )
    
    if (!modulePermission) {
      debugLog('[权限验证] 无模块权限', { userRole, module, action, availableModules: permissions.map(p => p.module) })
      return false
    }
    
    // 5. 检查操作权限
    if (modulePermission.actions.includes(action) || modulePermission.actions.includes('*')) {
      debugLog('[权限验证] 验证通过', { userRole, module, action })
      return true
    }
    
    debugLog('[权限验证] 无操作权限', { userRole, module, action, availableActions: modulePermission.actions })
    return false
    
  } catch (error) {
    console.error('[权限验证] 验证失败', { openid, module, action, error: error.message })
    // 权限验证失败时，默认拒绝访问
    return false
  }
}

// 数据库管理器（简化版）
const dbManager = {
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
      // 审计日志失败不影响主流程
    }
  }
}

/**
 * 完成预防任务主函数
 */
async function completePreventionTask(event, wxContext) {
  const startTime = Date.now()
  const logContext = { action: 'completePreventionTask', openid: wxContext.OPENID }
  
  try {
    const { taskId, batchId, preventionData } = event
    const openid = wxContext.OPENID
    
    // ========== 1. 参数验证 ==========
    if (!taskId) {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '任务ID不能为空'
      }
    }
    if (!batchId) {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '批次ID不能为空'
      }
    }
    if (!preventionData) {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '预防数据不能为空'
      }
    }
    
    // ========== 2. 权限验证 ==========
    debugLog('[预防任务] 开始权限验证', { ...logContext, taskId, batchId })
    const hasPermission = await checkPermission(openid, 'health', 'create', batchId)
    if (!hasPermission) {
      debugLog('[预防任务] 权限不足', logContext)
      return {
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: '您没有完成预防任务的权限'
      }
    }
    
    // ========== 3. 验证任务存在且未完成 ==========
    debugLog('[预防任务] 验证任务状态', { ...logContext, taskId })
    const taskResult = await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .doc(taskId)
      .field({
        _id: true,
        taskName: true,
        taskType: true,
        completed: true,
        batchId: true,
        dayAge: true,
        farmId: true
      })
      .get()
    
    if (!taskResult.data) {
      debugLog('[预防任务] 任务不存在', { ...logContext, taskId })
      return {
        success: false,
        errorCode: 'TASK_NOT_FOUND',
        message: '任务不存在'
      }
    }
    
    const task = taskResult.data
    if (task.completed) {
      debugLog('[预防任务] 任务已完成', { ...logContext, taskId })
      return {
        success: false,
        errorCode: 'TASK_COMPLETED',
        message: '任务已完成，请勿重复提交'
      }
    }
    
    // ========== 4. 获取用户信息 ==========
    let userName = '未知用户'
    try {
      const userResult = await db.collection(COLLECTIONS.WX_USERS)
        .where({ _openid: openid })
        .field({ nickName: true, nickname: true, farmName: true, position: true })
        .limit(1)
        .get()
      
      if (userResult.data && userResult.data.length > 0) {
        const user = userResult.data[0]
        userName = user.nickName || user.nickname || user.farmName || user.position || '未知用户'
      }
    } catch (userError) {
      console.error('[预防任务] 获取用户信息失败', { ...logContext, error: userError.message })
    }
    
    // ========== 5. 创建预防记录 ==========
    debugLog('[预防任务] 创建预防记录', { ...logContext, taskId, batchId })
    
    // 🔍 调试：打印接收到的preventionData
    console.log('[调试] 接收到的preventionData:', JSON.stringify(preventionData))
    console.log('[调试] costInfo是否存在:', !!preventionData?.costInfo)
    console.log('[调试] costInfo内容:', preventionData?.costInfo)
    
    const recordData = {
      ...preventionData,
      taskId,
      batchId,
      taskSource: 'breeding_schedule',
      batchAge: task.dayAge,
      actualDate: preventionData.preventionDate,
      deviation: 0, // TODO: 计算实际日期与计划日期的偏差
      operator: openid,
      operatorName: userName,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // 🔍 调试：打印最终的recordData
    console.log('[调试] 最终recordData的costInfo:', recordData.costInfo)
    
    const recordResult = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .add({
        data: recordData
      })
    
    if (!recordResult._id) {
      console.error('[预防任务] 创建预防记录失败', logContext)
      return {
        success: false,
        errorCode: 'CREATE_RECORD_FAILED',
        message: '创建预防记录失败，请重试'
      }
    }
    
    debugLog('[预防任务] 预防记录创建成功', { ...logContext, recordId: recordResult._id })
    
    // ========== 6. 标记任务完成 ==========
    debugLog('[预防任务] 更新任务状态', { ...logContext, taskId })
    await db.collection(COLLECTIONS.TASK_BATCH_SCHEDULES)
      .doc(taskId)
      .update({
        data: {
          completed: true,
          completedAt: new Date(),
          completedBy: openid,
          recordId: recordResult._id,
          updateTime: new Date()
        }
      })
    
    // ========== 7. 创建财务成本记录（仅在开启财务入账时） ==========
    let costRecordId = null
    // 优化：疫苗接种费用默认同步到财务系统
    let shouldSyncToFinance = false
    if (preventionData?.costInfo?.totalCost > 0) {
      if (preventionData?.costInfo?.shouldSyncToFinance !== undefined) {
        // 明确设置了同步标记
        shouldSyncToFinance = Boolean(preventionData.costInfo.shouldSyncToFinance)
      } else if (preventionData?.costInfo?.source === 'purchase') {
        // 采购类型，需要同步
        shouldSyncToFinance = true
      } else if (preventionData?.preventionType === 'vaccine') {
        // 疫苗接种默认同步到财务
        shouldSyncToFinance = true
        debugLog('[预防任务] 疫苗接种费用默认同步到财务系统', logContext)
      }
    }

    if (shouldSyncToFinance) {
      debugLog('[预防任务] 创建成本记录', {
        ...logContext,
        amount: preventionData.costInfo.totalCost,
        source: preventionData.costInfo.source || 'manual'
      })

      try {
        const costResult = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
          .add({
            data: {
              farmId: task.farmId || '',
              batchId,
              costType: 'health',  // 疫苗属于健康成本
              category: preventionData.preventionType === 'vaccine' ? 'vaccine' :
                       preventionData.preventionType === 'disinfection' ? 'disinfection' : 'medicine',
              amount: preventionData.costInfo.totalCost,
              date: preventionData.preventionDate,
              costDate: preventionData.preventionDate,  // 保留兼容
              description: preventionData.preventionType === 'vaccine' 
                ? `疫苗接种 - ${preventionData.vaccineInfo?.name || '疫苗'}`
                : preventionData.preventionType === 'disinfection' 
                ? `消毒管理 - ${preventionData.disinfectantInfo?.name || '消毒'}`
                : `医疗费用 - ${preventionData.medicineInfo?.name || task.taskName || '健康管理'}`,
              relatedRecordId: recordResult._id,
              userId: openid,
              isDeleted: false,
              createTime: new Date().toISOString(),
              createdAt: new Date(),
              syncSource: preventionData.costInfo.source || 'manual',
              syncTriggeredAt: new Date(),
              _openid: openid
            }
          })

        costRecordId = costResult._id
        debugLog('[预防任务] 成本记录创建成功', { ...logContext, costRecordId })
      } catch (costError) {
        // 成本记录创建失败不影响主流程
        console.error('[预防任务] 创建成本记录失败', {
          ...logContext,
          error: costError.message
        })
      }
    } else if (preventionData?.costInfo?.totalCost > 0) {
      debugLog('[预防任务] 跳过财务入账，仅保留健康记录成本', {
        ...logContext,
        amount: preventionData.costInfo.totalCost,
        source: preventionData.costInfo?.source || 'use'
      })
    }
    
    // ========== 8. 记录审计日志 ==========
    try {
      await dbManager.createAuditLog(
        openid,
        'complete_prevention_task',
        COLLECTIONS.HEALTH_PREVENTION_RECORDS,
        recordResult._id,
        {
          taskId,
          batchId,
          preventionType: preventionData.preventionType,
          cost: preventionData.costInfo?.totalCost || 0,
          costRecordId,
          result: 'success'
        }
      )
    } catch (auditError) {
      // 审计日志失败不影响主流程
      console.error('[预防任务] 创建审计日志失败', { 
        ...logContext, 
        error: auditError.message 
      })
    }
    
    // ========== 9. 返回成功结果 ==========
    const totalTime = Date.now() - startTime
    debugLog('[预防任务] 任务完成成功', {
      ...logContext,
      recordId: recordResult._id,
      costRecordId,
      totalTime
    })
    
    return {
      success: true,
      recordId: recordResult._id,
      costRecordId,
      message: '任务完成成功',
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error('[预防任务] 完成任务失败', {
      ...logContext,
      error: error.message,
      stack: error.stack,
      totalTime
    })
    
    // 根据错误类型返回不同的错误码
    let errorCode = 'UNKNOWN_ERROR'
    let message = '完成预防任务失败，请稍后重试'
    
    if (error.message.includes('权限')) {
      errorCode = 'PERMISSION_DENIED'
      message = '权限不足，无法完成任务'
    } else if (error.message.includes('网络')) {
      errorCode = 'NETWORK_ERROR'
      message = '网络连接失败，请检查网络后重试'
    } else if (error.message.includes('数据库')) {
      errorCode = 'DATABASE_ERROR'
      message = '数据库操作失败，请稍后重试'
    }
    
    return {
      success: false,
      errorCode,
      error: error.message,
      message,
      _performance: {
        totalTime,
        timestamp: new Date().toISOString()
      }
    }
  }
}

module.exports = {
  completePreventionTask
}
