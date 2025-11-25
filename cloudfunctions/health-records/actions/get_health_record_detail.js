/**
 * get_health_record_detail 处理函数
 * 获取健康记录详情
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
 * 主处理函数 - 获取健康记录详情
 */
exports.main = async (event, wxContext) => {
  try {
    const { recordId } = event
    const openid = wxContext.OPENID
    
    // 验证参数
    if (!recordId) {
      throw new Error('记录ID不能为空')
    }
    
    // 获取记录详情
    const recordResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!recordResult.data) {
      throw new Error('记录不存在')
    }
    
    const record = recordResult.data
    
    // 检查是否已删除
    if (record.isDeleted) {
      return {
        success: false,
        error: '记录已删除',
        message: '该记录已被删除'
      }
    }
    
    // 获取批次信息（如果有）
    let batchInfo = null
    if (record.batchId) {
      try {
        const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
          .doc(record.batchId)
          .get()
        
        if (batchResult.data) {
          batchInfo = {
            _id: batchResult.data._id,
            batchNumber: batchResult.data.batchNumber,
            entryDate: batchResult.data.entryDate,
            quantity: batchResult.data.quantity,
            currentCount: batchResult.data.currentCount,
            breed: batchResult.data.breed
          }
        }
      } catch (err) {
        // 如果批次不存在，继续返回记录信息
        // 批次信息获取失败
      }
    }
    
    // 获取创建者信息
    let creatorInfo = null
    if (record._openid) {
      try {
        const userResult = await db.collection(COLLECTIONS.WX_USERS)
          .where({ _openid: record._openid })
          .limit(1)
          .get()
        
        if (userResult.data && userResult.data.length > 0) {
          const user = userResult.data[0]
          creatorInfo = {
            openid: user._openid,
            nickName: user.nickName || user.nickname,
            farmName: user.farmName,
            position: user.position
          }
        }
      } catch (err) {
        // 用户信息获取失败
      }
    }
    
    // 获取相关记录（如果是AI诊断类型）
    let relatedRecords = null
    if (record.recordType === 'ai_diagnosis' && record.status === 'abnormal') {
      try {
        // 获取相关的治疗记录
        const treatmentResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
          .where({
            abnormalRecordId: recordId,
            ...dbManager.buildNotDeletedCondition(true)
          })
          .limit(5)
          .get()
        
        relatedRecords = {
          treatments: treatmentResult.data
        }
      } catch (err) {
        // 相关记录获取失败
      }
    }
    
    // 构建详情数据
    const detailData = {
      record: {
        ...record,
        batchInfo: batchInfo,
        creatorInfo: creatorInfo
      },
      relatedRecords: relatedRecords,
      canEdit: record._openid === openid, // 是否可编辑
      canDelete: record._openid === openid // 是否可删除
    }
    
    // 记录访问日志（可选）
    await dbManager.createAuditLog(
      openid,
      'view_health_record_detail',
      COLLECTIONS.HEALTH_RECORDS,
      recordId,
      {
        viewTime: new Date().toISOString()
      }
    )
    
    // 返回详情数据
    return {
      success: true,
      data: detailData,
      message: '获取成功'
    }
  } catch (error) {
    console.error('[get_health_record_detail] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '获取健康记录详情失败'
    }
  }
}
