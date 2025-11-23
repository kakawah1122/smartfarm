/**
 * 获取治愈记录列表（包含用户昵称）
 * 从health-management迁移
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 引入共享的集合配置
const { COLLECTIONS } = require('../collections.js')

exports.main = async (event, wxContext) => {
  try {
    const openid = wxContext.OPENID
    
    // 查询最近1年的治疗记录（不限制用户，查询所有记录）
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    
    const result = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        createdAt: _.gte(oneYearAgo)
        // ⚠️ 不添加 _openid 限制，查询所有用户的记录
      })
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get()
    
    // 过滤出有治愈数的记录（同时排除已删除的记录）
    const curedRecords = result.data.filter(record => {
      // 排除已删除的记录
      if (record.isDeleted === true) return false
      // 只保留有治愈数的记录
      return (record.outcome?.curedCount || 0) > 0
    })
    
    // 提取所有唯一的批次ID和用户ID
    const batchIds = [...new Set(curedRecords.map(r => r.batchId).filter(Boolean))]
    const userIds = [...new Set(curedRecords.map(r => r._openid || r.createdBy).filter(Boolean))]
    
    // 批量查询批次信息
    const batchMap = new Map()
    for (let i = 0; i < batchIds.length; i += 20) {
      const batch = batchIds.slice(i, i + 20)
      const batchResult = await db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
        .where({
          _id: _.in(batch)
        })
        .field({ _id: true, batchNumber: true })
        .get()
      
      batchResult.data.forEach(b => {
        batchMap.set(b._id, b.batchNumber)
      })
    }
    
    // 批量查询用户信息
    const userMap = new Map()
    for (let i = 0; i < userIds.length; i += 20) {
      const batch = userIds.slice(i, i + 20)
      const userResult = await db.collection(COLLECTIONS.WX_USERS)
        .where({
          _openid: _.in(batch)
        })
        .field({ _openid: true, nickName: true })
        .get()
      
      userResult.data.forEach(u => {
        userMap.set(u._openid, u.nickName || '未知用户')
      })
    }
    
    // 组装数据
    const records = curedRecords.map(record => ({
      ...record,
      batchNumber: batchMap.get(record.batchId) || record.batchId,
      operatorName: userMap.get(record._openid || record.createdBy) || '未知用户'
    }))
    
    return {
      success: true,
      data: {
        records,
        total: records.length
      },
      message: '获取治愈记录列表成功'
    }
    
  } catch (error) {
    console.error('❌ 获取治愈记录列表失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取治愈记录列表失败'
    }
  }
}
