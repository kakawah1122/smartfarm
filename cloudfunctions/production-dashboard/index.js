// cloudfunctions/production-dashboard/index.js
// 生产管理仪表盘云函数 - 提供统一的统计数据
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      case 'overview':
        return await getOverviewStats(event, wxContext)
      case 'daily_stats':
        return await getDailyStats(event, wxContext)
      case 'monthly_report':
        return await getMonthlyReport(event, wxContext)
      case 'production_flow':
        return await getProductionFlow(event, wxContext)
      case 'alerts':
        return await getSystemAlerts(event, wxContext)
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    console.error('生产仪表盘操作失败:', error)
    return {
      success: false,
      error: error.message,
      message: '操作失败，请重试'
    }
  }
}

// 获取总体概览统计
async function getOverviewStats(event, wxContext) {
  const { dateRange } = event
  
  // 并行获取各项统计数据
  const [entryStats, exitStats, materialStats, recentTrends] = await Promise.all([
    getEntryOverview(dateRange),
    getExitOverview(dateRange),
    getMaterialOverview(),
    getRecentTrends()
  ])
  
  // 添加调试日志
  console.log('📊 Dashboard统计结果:')
  console.log('  - Entry:', entryStats)
  console.log('  - Exit:', exitStats)
  console.log('  - Material:', materialStats)
  
  return {
    success: true,
    data: {
      entry: entryStats,
      exit: exitStats,
      material: materialStats,
      trends: recentTrends,
      updateTime: new Date().toISOString()
    }
  }
}

// 获取入栏概览
async function getEntryOverview(dateRange) {
  let query = db.collection('entry_records')
  
  // 只有在明确提供日期范围时才过滤
  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      entryDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }
  // 不提供日期范围时，获取所有数据
  
  const records = await query.get()
  const data = records.data
  
  const totalQuantity = data.reduce((sum, record) => sum + (record.quantity || 0), 0)
  const completedRecords = data.filter(record => record.status === '已完成')
  const completedQuantity = completedRecords.reduce((sum, record) => sum + (record.quantity || 0), 0)
  const totalBatches = data.length
  
  // 计算存活率
  const survivalRate = totalQuantity > 0 ? ((completedQuantity / totalQuantity) * 100).toFixed(1) : '0.0'
  
  // 按品种统计
  const breedStats = {}
  data.forEach(record => {
    const breed = record.breed || '未知'
    if (!breedStats[breed]) {
      breedStats[breed] = { quantity: 0, batches: 0 }
    }
    breedStats[breed].quantity += record.quantity || 0
    breedStats[breed].batches += 1
  })
  
  return {
    total: totalQuantity.toLocaleString(),
    survivalRate,
    batches: totalBatches.toString(),
    completedQuantity: completedQuantity.toLocaleString(),
    breedStats
  }
}

// 获取出栏概览
async function getExitOverview(dateRange) {
  let query = db.collection('exit_records')
  
  // 只有在明确提供日期范围时才过滤
  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      exitDate: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }
  // 不提供日期范围时，获取所有数据
  
  const records = await query.get()
  const data = records.data
  
  const totalQuantity = data.reduce((sum, record) => sum + (record.quantity || 0), 0)
  const totalRevenue = data.reduce((sum, record) => sum + (record.totalRevenue || 0), 0)
  const totalBatches = new Set(data.map(record => record.batchNumber)).size
  
  // 计算平均重量
  const totalWeight = data.reduce((sum, record) => 
    sum + ((record.quantity || 0) * (record.avgWeight || 0)), 0)
  const avgWeight = totalQuantity > 0 ? (totalWeight / totalQuantity).toFixed(1) : '0.0'
  
  // 按状态统计
  const statusStats = {}
  data.forEach(record => {
    const status = record.status || '未知'
    if (!statusStats[status]) {
      statusStats[status] = { quantity: 0, revenue: 0 }
    }
    statusStats[status].quantity += record.quantity || 0
    statusStats[status].revenue += record.totalRevenue || 0
  })
  
  return {
    total: totalQuantity.toLocaleString(),
    batches: totalBatches.toString(),
    avgWeight,
    totalRevenue: totalRevenue.toLocaleString(),
    statusStats
  }
}

// 获取物料概览
async function getMaterialOverview() {
  const materials = await db.collection('materials')
    .where({ isActive: true })
    .get()
  
  let totalMaterials = materials.data.length
  let lowStockCount = 0
  let totalValue = 0
  const categoryStats = {}
  
  materials.data.forEach(material => {
    // 检查低库存
    if (material.currentStock <= material.safetyStock) {
      lowStockCount++
    }
    
    // 按分类统计
    const category = material.category || '其他'
    if (!categoryStats[category]) {
      categoryStats[category] = { count: 0, lowStock: 0, totalValue: 0 }
    }
    
    categoryStats[category].count++
    if (material.currentStock <= material.safetyStock) {
      categoryStats[category].lowStock++
    }
    
    const value = material.currentStock * (material.unitPrice || 0)
    categoryStats[category].totalValue += value
    totalValue += value
  })
  
  // 获取今日物料动态
  const today = new Date().toISOString().split('T')[0]
  const todayRecords = await db.collection('material_records')
    .where({ recordDate: today })
    .get()
  
  const todayPurchase = todayRecords.data
    .filter(r => r.type === 'purchase')
    .reduce((sum, r) => sum + r.quantity, 0)
  
  const todayUse = todayRecords.data
    .filter(r => r.type === 'use')
    .reduce((sum, r) => sum + r.quantity, 0)
  
  // 添加详细调试日志
  console.log('🔍 物料数据调试:')
  console.log('总物料数量:', materials.data.length)
  materials.data.forEach((material, index) => {
    console.log(`物料${index + 1}:`, {
      name: material.name,
      category: material.category,
      currentStock: material.currentStock,
      stockType: typeof material.currentStock,
      safetyStock: material.safetyStock,
      isActive: material.isActive
    })
  })
  
  // 计算饲料库存总量
  const feedMaterials = materials.data.filter(m => m.category === 'feed')
  console.log('🥬 饲料类物料:', feedMaterials.length, '个')
  
  const feedStock = feedMaterials.reduce((sum, m) => {
    const stock = Number(m.currentStock) || 0
    console.log(`  - ${m.name}: ${stock} ${m.unit}`)
    return sum + stock
  }, 0)
  
  console.log('🥬 饲料总库存:', feedStock)
  
  // 计算药品库存状态
  const medicineMaterials = materials.data.filter(m => m.category === 'medicine')
  console.log('💊 药品类物料:', medicineMaterials.length, '个')
  
  const medicineStock = medicineMaterials.reduce((sum, m) => {
    const stock = Number(m.currentStock) || 0
    console.log(`  - ${m.name}: ${stock} ${m.unit}`)
    return sum + stock
  }, 0)
  
  const medicineLowStock = medicineMaterials.some(m => {
    const current = Number(m.currentStock) || 0
    const safety = Number(m.safetyStock) || 0
    return current <= safety
  })
  
  console.log('💊 药品总库存:', medicineStock)
  console.log('💊 药品是否低库存:', medicineLowStock)

  const result = {
    totalMaterials: totalMaterials.toString(),
    lowStockCount: lowStockCount.toString(),
    totalValue: totalValue.toLocaleString(),
    feedStock: feedStock.toString(),           // 饲料库存数量
    medicineStatus: medicineLowStock ? '库存不足' : '充足',  // 药品状态
    categoryStats,
    todayActivity: {
      purchase: todayPurchase,
      use: todayUse
    }
  }
  
  console.log('📊 最终返回的material数据:', JSON.stringify(result, null, 2))
  
  return result
}

// 获取最近趋势
async function getRecentTrends() {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]
  
  // 获取最近7天的数据
  const [entryRecords, exitRecords, materialRecords] = await Promise.all([
    db.collection('entry_records')
      .where({ entryDate: _.gte(startDateStr).and(_.lte(endDateStr)) })
      .get(),
    db.collection('exit_records')
      .where({ exitDate: _.gte(startDateStr).and(_.lte(endDateStr)) })
      .get(),
    db.collection('material_records')
      .where({ recordDate: _.gte(startDateStr).and(_.lte(endDateStr)) })
      .get()
  ])
  
  // 按日期分组统计
  const entryTrend = groupByDate(entryRecords.data, 'entryDate', 'quantity')
  const exitTrend = groupByDate(exitRecords.data, 'exitDate', 'quantity')
  const materialTrend = groupByDate(materialRecords.data, 'recordDate', 'quantity')
  
  return {
    entry: entryTrend,
    exit: exitTrend,
    material: materialTrend
  }
}

// 按日期分组统计
function groupByDate(records, dateField, valueField) {
  const result = {}
  
  records.forEach(record => {
    const date = record[dateField]
    if (!result[date]) {
      result[date] = 0
    }
    result[date] += record[valueField] || 0
  })
  
  return result
}

// 获取每日统计
async function getDailyStats(event, wxContext) {
  const { date } = event
  const targetDate = date || new Date().toISOString().split('T')[0]
  
  // 获取当日各类数据
  const [entryRecords, exitRecords, materialRecords] = await Promise.all([
    db.collection('entry_records').where({ entryDate: targetDate }).get(),
    db.collection('exit_records').where({ exitDate: targetDate }).get(),
    db.collection('material_records').where({ recordDate: targetDate }).get()
  ])
  
  // 统计入栏
  const entryStats = {
    totalQuantity: entryRecords.data.reduce((sum, r) => sum + (r.quantity || 0), 0),
    totalBatches: entryRecords.data.length,
    totalAmount: entryRecords.data.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  }
  
  // 统计出栏
  const exitStats = {
    totalQuantity: exitRecords.data.reduce((sum, r) => sum + (r.quantity || 0), 0),
    totalRevenue: exitRecords.data.reduce((sum, r) => sum + (r.totalRevenue || 0), 0),
    totalBatches: new Set(exitRecords.data.map(r => r.batchNumber)).size
  }
  
  // 统计物料
  const purchaseRecords = materialRecords.data.filter(r => r.type === 'purchase')
  const useRecords = materialRecords.data.filter(r => r.type === 'use')
  
  const materialStats = {
    purchaseQuantity: purchaseRecords.reduce((sum, r) => sum + (r.quantity || 0), 0),
    purchaseAmount: purchaseRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
    useQuantity: useRecords.reduce((sum, r) => sum + (r.quantity || 0), 0),
    useAmount: useRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  }
  
  return {
    success: true,
    data: {
      date: targetDate,
      entry: entryStats,
      exit: exitStats,
      material: materialStats
    }
  }
}

// 获取月度报告
async function getMonthlyReport(event, wxContext) {
  const { year, month } = event
  const currentDate = new Date()
  const targetYear = year || currentDate.getFullYear()
  const targetMonth = month || currentDate.getMonth() + 1
  
  // 计算月份的开始和结束日期
  const startDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`
  const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0]
  
  // 获取月度数据
  const [entryRecords, exitRecords, materialRecords] = await Promise.all([
    db.collection('entry_records')
      .where({ entryDate: _.gte(startDate).and(_.lte(endDate)) })
      .get(),
    db.collection('exit_records')
      .where({ exitDate: _.gte(startDate).and(_.lte(endDate)) })
      .get(),
    db.collection('material_records')
      .where({ recordDate: _.gte(startDate).and(_.lte(endDate)) })
      .get()
  ])
  
  // 生成详细的月度报告
  const report = {
    period: `${targetYear}年${targetMonth}月`,
    entry: {
      totalQuantity: entryRecords.data.reduce((sum, r) => sum + (r.quantity || 0), 0),
      totalBatches: entryRecords.data.length,
      totalCost: entryRecords.data.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
      byBreed: {}
    },
    exit: {
      totalQuantity: exitRecords.data.reduce((sum, r) => sum + (r.quantity || 0), 0),
      totalRevenue: exitRecords.data.reduce((sum, r) => sum + (r.totalRevenue || 0), 0),
      totalBatches: new Set(exitRecords.data.map(r => r.batchNumber)).size,
      byCustomer: {}
    },
    material: {
      purchase: {
        totalAmount: materialRecords.data
          .filter(r => r.type === 'purchase')
          .reduce((sum, r) => sum + (r.totalAmount || 0), 0),
        totalQuantity: materialRecords.data
          .filter(r => r.type === 'purchase')
          .reduce((sum, r) => sum + (r.quantity || 0), 0)
      },
      use: {
        totalAmount: materialRecords.data
          .filter(r => r.type === 'use')
          .reduce((sum, r) => sum + (r.totalAmount || 0), 0),
        totalQuantity: materialRecords.data
          .filter(r => r.type === 'use')
          .reduce((sum, r) => sum + (r.quantity || 0), 0)
      }
    },
    profit: 0  // 简单利润计算
  }
  
  // 计算利润
  report.profit = report.exit.totalRevenue - report.entry.totalCost - report.material.purchase.totalAmount
  
  // 按品种统计入栏
  entryRecords.data.forEach(record => {
    const breed = record.breed || '未知'
    if (!report.entry.byBreed[breed]) {
      report.entry.byBreed[breed] = { quantity: 0, cost: 0 }
    }
    report.entry.byBreed[breed].quantity += record.quantity || 0
    report.entry.byBreed[breed].cost += record.totalAmount || 0
  })
  
  // 按客户统计出栏
  exitRecords.data.forEach(record => {
    const customer = record.customer || '未知'
    if (!report.exit.byCustomer[customer]) {
      report.exit.byCustomer[customer] = { quantity: 0, revenue: 0 }
    }
    report.exit.byCustomer[customer].quantity += record.quantity || 0
    report.exit.byCustomer[customer].revenue += record.totalRevenue || 0
  })
  
  return {
    success: true,
    data: report
  }
}

// 获取生产流程数据
async function getProductionFlow(event, wxContext) {
  // 获取所有入栏批次
  const entryRecords = await db.collection('entry_records')
    .where({ status: '已完成' })
    .orderBy('entryDate', 'desc')
    .limit(20)
    .get()
  
  const flowData = []
  
  for (const entry of entryRecords.data) {
    // 获取对应的出栏记录
    const exitRecords = await db.collection('exit_records')
      .where({ batchNumber: entry.batchNumber })
      .get()
    
    const totalExited = exitRecords.data.reduce((sum, r) => sum + r.quantity, 0)
    const currentStock = entry.quantity - totalExited
    
    flowData.push({
      batchNumber: entry.batchNumber,
      breed: entry.breed,
      entryDate: entry.entryDate,
      entryQuantity: entry.quantity,
      exitedQuantity: totalExited,
      currentStock,
      survivalRate: entry.quantity > 0 ? ((currentStock + totalExited) / entry.quantity * 100).toFixed(1) : '0.0',
      status: currentStock > 0 ? '养殖中' : '已出栏',
      daysInFarm: Math.floor((new Date() - new Date(entry.entryDate)) / (1000 * 60 * 60 * 24))
    })
  }
  
  return {
    success: true,
    data: flowData
  }
}

// 获取系统预警
async function getSystemAlerts(event, wxContext) {
  const alerts = []
  
  // 检查低库存预警
  const lowStockMaterials = await db.collection('materials')
    .where({ 
      isActive: true,
      currentStock: _.lte(db.command.field('safetyStock'))
    })
    .get()
  
  lowStockMaterials.data.forEach(material => {
    alerts.push({
      type: 'low_stock',
      level: material.currentStock === 0 ? 'critical' : 'warning',
      title: `${material.name}库存不足`,
      message: `当前库存：${material.currentStock} ${material.unit}，安全库存：${material.safetyStock} ${material.unit}`,
      target: material._id,
      createTime: new Date()
    })
  })
  
  // 检查长期未出栏的批次
  const longTermBatches = await db.collection('entry_records')
    .where({ 
      status: '已完成',
      entryDate: _.lte(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    })
    .get()
  
  for (const batch of longTermBatches.data) {
    const exitRecords = await db.collection('exit_records')
      .where({ batchNumber: batch.batchNumber })
      .get()
    
    const totalExited = exitRecords.data.reduce((sum, r) => sum + r.quantity, 0)
    const remaining = batch.quantity - totalExited
    
    if (remaining > 0) {
      alerts.push({
        type: 'long_term_stock',
        level: 'info',
        title: `批次${batch.batchNumber}养殖时间较长`,
        message: `入栏日期：${batch.entryDate}，剩余数量：${remaining}羽`,
        target: batch._id,
        createTime: new Date()
      })
    }
  }
  
  return {
    success: true,
    data: alerts.slice(0, 10)  // 只返回前10条预警
  }
}
