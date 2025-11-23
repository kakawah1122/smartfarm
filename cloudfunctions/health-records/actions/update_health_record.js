/**
 * update_health_record 处理函数
 * 更新健康记录
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
 * 主处理函数 - 更新健康记录
 */
exports.main = async (event, wxContext) => {
  try {
    const {
      recordId,
      updates
    } = event
    const openid = wxContext.OPENID
    
    // 验证参数
    if (!recordId) {
      throw new Error('记录ID不能为空')
    }
    
    if (!updates || typeof updates !== 'object') {
      throw new Error('更新内容不能为空')
    }
    
    // 获取原记录
    const recordResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!recordResult.data) {
      throw new Error('记录不存在')
    }
    
    const originalRecord = recordResult.data
    
    // 验证权限（只有创建者或管理员可以更新）
    // TODO: 添加管理员权限检查
    if (originalRecord._openid !== openid) {
      const hasPermission = false // 这里应该检查管理员权限
      if (!hasPermission) {
        throw new Error('无权限更新此记录')
      }
    }
    
    // 准备更新数据
    const updateData = {
      ...updates,
      updatedAt: db.serverDate(),
      updatedBy: openid
    }
    
    // 移除不允许更新的字段
    delete updateData._id
    delete updateData._openid
    delete updateData.createTime
    delete updateData.createdAt
    
    // 如果更新了患病或死亡数，重新计算严重程度
    if (updates.sickCount !== undefined || updates.deadCount !== undefined || updates.totalCount !== undefined) {
      const totalCount = updates.totalCount || originalRecord.totalCount || 0
      const sickCount = updates.sickCount !== undefined ? updates.sickCount : originalRecord.sickCount || 0
      const deadCount = updates.deadCount !== undefined ? updates.deadCount : originalRecord.deadCount || 0
      
      updateData.severity = calculateSeverity(sickCount, deadCount, totalCount)
      updateData.followUpRequired = sickCount > 0
      
      if (sickCount > 0) {
        updateData.followUpDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      } else {
        updateData.followUpDate = null
      }
    }
    
    // 执行更新
    await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .update({
        data: updateData
      })
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'update_health_record',
      COLLECTIONS.HEALTH_RECORDS,
      recordId,
      {
        originalData: originalRecord,
        updates: updateData,
        result: 'success'
      }
    )
    
    // 返回成功结果
    return {
      success: true,
      data: {
        recordId: recordId,
        updated: true
      },
      message: '健康记录更新成功'
    }
  } catch (error) {
    console.error('[update_health_record] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '更新健康记录失败'
    }
  }
}

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
