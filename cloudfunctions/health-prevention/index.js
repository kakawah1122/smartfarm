/**
 * health-prevention 云函数
 * 负责健康管理预防相关功能
 * 从 health-management 拆分出来的独立模块
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 引入共享的集合配置
const { COLLECTIONS } = require('./collections.js')

/**
 * 创建预防记录
 */
async function createPreventionRecord(event, wxContext) {
  try {
    const { preventionData } = event
    const openid = wxContext.OPENID
    
    if (!preventionData) {
      return {
        success: false,
        error: '缺少预防数据'
      }
    }
    
    // 构建预防记录数据
    const recordData = {
      ...preventionData,
      _openid: openid,
      createdBy: openid,
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      isDeleted: false
    }
    
    // 创建记录
    const result = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .add({
        data: recordData
      })
    
    return {
      success: true,
      data: {
        recordId: result._id,
        message: '预防记录创建成功'
      }
    }
  } catch (error) {
    console.error('[createPreventionRecord] 错误:', error)
    return {
      success: false,
      error: error.message || '创建预防记录失败'
    }
  }
}

/**
 * 获取预防记录列表
 */
async function listPreventionRecords(event, wxContext) {
  try {
    const { 
      batchId, 
      preventionType,
      page = 1, 
      pageSize = 20
    } = event
    const openid = wxContext.OPENID
    
    // 构建查询条件
    let conditions = {
      _openid: openid,
      isDeleted: false
    }
    
    if (batchId && batchId !== 'all') {
      conditions.batchId = batchId
    }
    
    if (preventionType) {
      conditions.preventionType = preventionType
    }
    
    // 计算跳过的记录数
    const skip = (page - 1) * pageSize
    
    // 查询总数
    const countResult = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .where(conditions)
      .count()
    
    // 查询列表
    const listResult = await db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
      .where(conditions)
      .orderBy('preventionDate', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    return {
      success: true,
      data: {
        total: countResult.total,
        page,
        pageSize,
        list: listResult.data
      }
    }
  } catch (error) {
    console.error('[listPreventionRecords] 错误:', error)
    return {
      success: false,
      error: error.message || '获取预防记录列表失败'
    }
  }
}

/**
 * 获取预防看板数据
 */
async function getPreventionDashboard(event, wxContext) {
  try {
    const { batchId } = event
    const openid = wxContext.OPENID
    
    // 构建查询条件
    let conditions = {
      _openid: openid,
      isDeleted: false
    }
    
    if (batchId && batchId !== 'all') {
      conditions.batchId = batchId
    }
    
    // 并行查询各项数据
    const [
      totalCount,
      vaccineCount,
      disinfectionCount
    ] = await Promise.all([
      // 总预防次数
      db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
        .where(conditions)
        .count(),
      
      // 疫苗接种次数
      db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
        .where({
          ...conditions,
          preventionType: 'vaccine'
        })
        .count(),
      
      // 消毒次数
      db.collection(COLLECTIONS.HEALTH_PREVENTION_RECORDS)
        .where({
          ...conditions,
          preventionType: 'disinfection'
        })
        .count()
    ])
    
    return {
      success: true,
      data: {
        totalCount: totalCount.total,
        vaccineCount: vaccineCount.total,
        disinfectionCount: disinfectionCount.total,
        lastUpdateTime: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('[getPreventionDashboard] 错误:', error)
    return {
      success: false,
      error: error.message || '获取预防看板失败'
    }
  }
}

// 主函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      case 'create_prevention_record':
        return await createPreventionRecord(event, wxContext)
      
      case 'list_prevention_records':
        return await listPreventionRecords(event, wxContext)
      
      case 'get_prevention_dashboard':
      case 'getPreventionDashboard':
        return await getPreventionDashboard(event, wxContext)
      
      default:
        return {
          success: false,
          error: `未知的 action: ${action}`
        }
    }
  } catch (error) {
    console.error('[health-prevention] 云函数错误:', error)
    return {
      success: false,
      error: error.message || '云函数执行失败'
    }
  }
}
