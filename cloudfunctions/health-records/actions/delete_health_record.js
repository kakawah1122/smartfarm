/**
 * delete_health_record 处理函数
 * 删除健康记录（软删除）
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
 * 主处理函数 - 删除健康记录（软删除）
 */
exports.main = async (event, wxContext) => {
  try {
    const { 
      recordId,
      reason 
    } = event
    const openid = wxContext.OPENID
    
    // 验证参数
    if (!recordId) {
      throw new Error('记录ID不能为空')
    }
    
    // 获取原记录
    const recordResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!recordResult.data) {
      throw new Error('记录不存在')
    }
    
    const originalRecord = recordResult.data
    
    // 检查是否已删除
    if (originalRecord.isDeleted) {
      return {
        success: false,
        error: '记录已删除',
        message: '该记录已被删除'
      }
    }
    
    // 验证权限（只有创建者或管理员可以删除）
    // TODO: 添加管理员权限检查
    if (originalRecord._openid !== openid) {
      const hasPermission = false // 这里应该检查管理员权限
      if (!hasPermission) {
        throw new Error('无权限删除此记录')
      }
    }
    
    // 执行软删除
    const deleteData = {
      isDeleted: true,
      deletedAt: db.serverDate(),
      deletedBy: openid,
      deleteReason: reason || '用户主动删除'
    }
    
    await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .update({
        data: deleteData
      })
    
    // 记录审计日志
    await dbManager.createAuditLog(
      openid,
      'delete_health_record',
      COLLECTIONS.HEALTH_RECORDS,
      recordId,
      {
        originalData: originalRecord,
        deleteReason: reason,
        result: 'success'
      }
    )
    
    // 返回成功结果
    return {
      success: true,
      data: {
        recordId: recordId,
        deleted: true
      },
      message: '健康记录删除成功'
    }
  } catch (error) {
    console.error('[delete_health_record] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '删除健康记录失败'
    }
  }
}
