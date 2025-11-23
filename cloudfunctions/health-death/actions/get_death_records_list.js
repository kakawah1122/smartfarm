/**
 * get_death_records_list 处理函数
 * 获取死亡记录列表（从health-management迁移）
 * 关联操作员信息，兼容多种字段名
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 辅助函数：调试日志（生产环境自动关闭）
function debugLog(message, data) {
  // 生产环境不输出调试日志
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, data)
  }
}

/**
 * 主处理函数 - 获取死亡记录列表
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {
    const openid = wxContext.OPENID
    
    // ✅ 查询用户的所有死亡记录，兼容 _openid 和 operator 字段
    const result = await db.collection(COLLECTIONS.HEALTH_DEATH_RECORDS)
      .where(_.or([
        { _openid: openid, isDeleted: false },
        { operator: openid, isDeleted: false },
        { createdBy: openid, isDeleted: false },  // ✅ 兼容 createdBy 字段
        { reportedBy: openid, isDeleted: false }  // ✅ 兼容 reportedBy 字段（旧版）
      ]))
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    
    debugLog('[死亡记录列表] 查询到的记录数:', result.data.length)
    if (result.data.length > 0) {
      debugLog('[死亡记录列表] 第一条记录字段:', Object.keys(result.data[0]))
    }
    
    // ✅ 关联操作员信息
    const records = await Promise.all(result.data.map(async (record) => {
      // 如果已经有operatorName，直接使用
      if (record.operatorName && record.operatorName !== '未知') {
        return record
      }
      
      // 否则，根据各种可能的字段查询用户信息
      const operatorOpenid = record._openid || record.operator || record.createdBy || record.reportedBy
      
      if (!operatorOpenid) {
        debugLog('[死亡记录列表] 记录缺少操作员openid:', record._id)
        return {
          ...record,
          operatorName: '系统记录'
        }
      }
      
      try {
        const userInfo = await db.collection(COLLECTIONS.WX_USERS)
          .where({ _openid: operatorOpenid })
          .limit(1)
          .get()
        
        if (userInfo.data.length > 0) {
          const user = userInfo.data[0]
          const operatorName = user.name || user.nickName || user.userName || '未命名用户'
          return {
            ...record,
            operatorName
          }
        } else {
          debugLog('[死亡记录列表] 未找到用户信息', operatorOpenid.substring(0, 8) + '...')
          return {
            ...record,
            operatorName: '未知用户'
          }
        }
      } catch (userError) {
        console.error('[死亡记录列表] 查询用户信息失败:', userError)
        return {
          ...record,
          operatorName: '查询失败'
        }
      }
    }))
    
    return {
      success: true,
      data: records || [],
      message: '获取死亡记录列表成功'
    }
    
  } catch (error) {
    console.error('[死亡记录列表] 查询失败:', error)
    return {
      success: false,
      error: error.message,
      message: '获取死亡记录列表失败'
    }
  }
}
