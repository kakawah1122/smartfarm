// 极简测试函数 - 直接查询治疗记录
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  console.log('=== 测试治疗记录查询 ===')
  
  try {
    // 1. 查询所有记录，不加任何条件
    const result1 = await db.collection('health_treatment_records')
      .get()
    
    console.log('查询结果数量:', result1.data.length)
    
    // 2. 计算总成本
    let totalCost = 0
    result1.data.forEach(record => {
      console.log('记录:', JSON.stringify(record))
      // 尝试从不同字段获取成本
      const cost = record.totalCost || record.amount || (record.costInfo && record.costInfo.totalCost) || 0
      totalCost += Number(cost)
    })
    
    return {
      success: true,
      count: result1.data.length,
      totalCost: totalCost,
      records: result1.data
    }
    
  } catch (error) {
    console.error('查询失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
