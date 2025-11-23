/**
 * get_treatment_history 处理函数
 * 获取治疗历史记录（从health-management迁移）
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
 * 主处理函数 - 获取治疗历史记录
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const { batchId, limit = 5 } = event
    const openid = wxContext.OPENID
    
    // 构建查询条件
    const where = {
      _openid: openid,
      ...dbManager.buildNotDeletedCondition(true)
    }
    
    // 如果指定了批次ID，添加批次条件
    if (batchId && batchId !== 'all') {
      where.batchId = batchId
    }
    
    // 查询治疗记录
    const treatmentRecordsResult = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where(where)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    
    // 处理治疗记录
    const allRecords = treatmentRecordsResult.data.map(r => ({
        ...r,
        treatmentType: 'medication',
        diagnosis: r.diagnosisDisease || r.diagnosis || '未知疾病'
      }))
    
    // 按创建时间排序
    allRecords.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      return timeB - timeA
    })
    
    // 只返回指定数量
    const records = allRecords.slice(0, limit)
    
    // 为每条记录添加批次号（如果有的话）
    for (const record of records) {
      if (record.batchId) {
        try {
          const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
            .where({
              _id: record.batchId,
              ...dbManager.buildNotDeletedCondition(true)
            })
            .limit(1)
            .get()
          
          if (batchResult.data && batchResult.data.length > 0) {
            record.batchNumber = batchResult.data[0].batchNumber
          } else {
            // 尝试用批次号查询
            const batchByNumberResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
              .where({
                batchNumber: record.batchId,
                ...dbManager.buildNotDeletedCondition(true)
              })
              .limit(1)
              .get()
            
            if (batchByNumberResult.data && batchByNumberResult.data.length > 0) {
              record.batchNumber = batchByNumberResult.data[0].batchNumber
            } else {
              record.batchNumber = record.batchId
            }
          }
        } catch (err) {
          record.batchNumber = record.batchId
        }
      }
    }

    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      data: {
        records,
        total: records.length
      },
      message: '获取治疗历史记录成功'
    }
    
  } catch (error) {
    console.error('[get_treatment_history] 获取治疗历史记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取治疗历史记录失败'
    }
  }
}
