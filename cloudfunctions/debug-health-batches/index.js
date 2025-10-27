// debug-health-batches/index.js
// 临时调试云函数 - 查看批次和出栏数据

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 获取所有入栏记录
    const entriesResult = await db.collection('prod_batch_entries')
      .where({
        userId: wxContext.OPENID
      })
      .get()
    
    // 获取所有出栏记录
    const exitsResult = await db.collection('prod_batch_exits')
      .where({
        userId: wxContext.OPENID
      })
      .get()
    
    // 统计每个批次的出栏数量
    const exitMap = {}
    exitsResult.data.forEach(exit => {
      const bn = exit.batchNumber
      if (!exitMap[bn]) {
        exitMap[bn] = []
      }
      exitMap[bn].push({
        exitNumber: exit.exitNumber,
        quantity: exit.quantity,
        exitDate: exit.exitDate,
        customer: exit.customer
      })
    })
    
    // 生成诊断报告
    const report = []
    
    entriesResult.data.forEach(entry => {
      const bn = entry.batchNumber
      const entryQty = entry.quantity || 0
      const exits = exitMap[bn] || []
      const totalExited = exits.reduce((sum, e) => sum + (e.quantity || 0), 0)
      const remaining = entryQty - totalExited
      
      report.push({
        batchNumber: bn,
        entryQuantity: entryQty,
        exitRecords: exits,
        totalExited: totalExited,
        remaining: remaining,
        isFullyExited: totalExited >= entryQty,
        shouldDisplay: remaining > 0,
        isDeleted: entry.isDeleted === true,
        status: entry.status
      })
    })
    
    return {
      success: true,
      data: {
        totalEntries: entriesResult.data.length,
        totalExits: exitsResult.data.length,
        report: report,
        summary: {
          fullyExited: report.filter(r => r.isFullyExited).length,
          partiallyExited: report.filter(r => r.totalExited > 0 && !r.isFullyExited).length,
          notExited: report.filter(r => r.totalExited === 0).length
        }
      }
    }
    
  } catch (error) {
    console.error('调试失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

