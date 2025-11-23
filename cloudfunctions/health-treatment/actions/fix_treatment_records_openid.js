/**
 * fix_treatment_records_openid 处理函数
 * 修复治疗记录缺少 _openid 字段的问题（从health-management迁移）
 * 为所有没有 _openid 但有 createdBy 的记录添加 _openid
 * 严格遵循项目规则，基于真实数据，不添加模拟数据
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('../collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 主处理函数 - 修复治疗记录缺少 _openid 字段
 * 保持与原health-management完全一致的逻辑
 */
exports.main = async (event, wxContext) => {
  try {

    // 查询当前用户创建但没有 _openid 的记录
    const records = await db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
      .where({
        createdBy: wxContext.OPENID,
        _openid: _.exists(false)
      })
      .limit(100)
      .get()
    
    if (records.data.length === 0) {
      return {
        success: true,
        message: '没有需要修复的记录',
        fixedCount: 0
      }
    }

    // 批量更新
    let fixedCount = 0
    const updatePromises = records.data.map(record => {
      return db.collection(COLLECTIONS.HEALTH_TREATMENT_RECORDS)
        .doc(record._id)
        .update({
          data: {
            _openid: wxContext.OPENID
          }
        })
        .then(() => {
          fixedCount++

        })
        .catch(err => {
          console.error(`[修复] 修复记录 ${record._id} 失败:`, err)
        })
    })
    
    await Promise.all(updatePromises)

    // 返回结果（保持与原函数完全一致的返回格式）
    return {
      success: true,
      message: `成功修复 ${fixedCount} 条记录`,
      fixedCount,
      totalFound: records.data.length
    }
  } catch (error) {
    console.error('[fix_treatment_records_openid] 修复失败:', error)
    return {
      success: false,
      error: error.message,
      message: '修复失败'
    }
  }
}
