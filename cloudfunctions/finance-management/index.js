// finance-management/index.js - 财务管理云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 生成财务记录ID
function generateFinanceId(prefix) {
  const now = new Date()
  const timestamp = now.getTime().toString().slice(-8)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${prefix}${timestamp}${random}`
}

// 验证用户财务权限
async function validateFinancePermission(openid, action) {
  try {
    const user = await db.collection('wx_users').where({ _openid: openid }).get()
    if (user.data.length === 0) return false
    
    const userRole = user.data[0].role || 'employee'
    const financeRoles = ['super_admin', 'manager', 'finance']
    const readOnlyActions = ['read', 'get_stats', 'generate_report']
    
    if (readOnlyActions.includes(action)) {
      return ['super_admin', 'manager', 'finance', 'observer'].includes(userRole)
    }
    
    return financeRoles.includes(userRole)
  } catch (error) {
    // 已移除调试日志
    return false
  }
}

// 计算成本统计
async function calculateCostStats(dateRange) {
  try {
    let query = db.collection('finance_cost_records').where({ isDeleted: false })
    
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    const records = await query.get()
    
    const stats = {
      feedCost: 0,        // 饲料成本
      healthCost: 0,      // 健康管理成本
      laborCost: 0,       // 人工成本
      facilityCost: 0,    // 设施成本
      otherCost: 0,       // 其他成本
      totalCost: 0
    }
    
    records.data.forEach(record => {
      const amount = record.amount || 0
      switch (record.costType) {
        case 'feed':
          stats.feedCost += amount
          break
        case 'health':
          stats.healthCost += amount
          break
        case 'labor':
          stats.laborCost += amount
          break
        case 'facility':
          stats.facilityCost += amount
          break
        default:
          stats.otherCost += amount
      }
      stats.totalCost += amount
    })
    
    return stats
  } catch (error) {
    // 已移除调试日志
    return {
      feedCost: 0, healthCost: 0, laborCost: 0, 
      facilityCost: 0, otherCost: 0, totalCost: 0
    }
  }
}

// 计算收入统计
async function calculateRevenueStats(dateRange) {
  try {
    // 从出栏记录获取销售收入
    let exitQuery = db.collection('prod_batch_exits')
      .where({ 
        isDeleted: false,
        exitReason: 'sale'
      })
    
    if (dateRange && dateRange.start && dateRange.end) {
      exitQuery = exitQuery.where({
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    const exitRecords = await exitQuery.get()
    
    const salesRevenue = exitRecords.data.reduce((sum, record) => {
      return sum + (record.totalRevenue || 0)
    }, 0)
    
    // 从收入记录获取其他收入
    let revenueQuery = db.collection('finance_revenue_records').where({ isDeleted: false })
    
    if (dateRange && dateRange.start && dateRange.end) {
      revenueQuery = revenueQuery.where({
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    const revenueRecords = await revenueQuery.get()
    
    const otherRevenue = revenueRecords.data.reduce((sum, record) => {
      return sum + (record.amount || 0)
    }, 0)
    
    return {
      salesRevenue,
      otherRevenue,
      totalRevenue: salesRevenue + otherRevenue
    }
  } catch (error) {
    // 已移除调试日志
    return {
      salesRevenue: 0,
      otherRevenue: 0,
      totalRevenue: 0
    }
  }
}

// 计算盈亏分析
async function calculateProfitAnalysis(dateRange) {
  const costStats = await calculateCostStats(dateRange)
  const revenueStats = await calculateRevenueStats(dateRange)
  
  const profit = revenueStats.totalRevenue - costStats.totalCost
  const profitMargin = revenueStats.totalRevenue > 0 ? 
    (profit / revenueStats.totalRevenue * 100).toFixed(2) : 0
  
  return {
    revenue: revenueStats,
    cost: costStats,
    profit,
    profitMargin: parseFloat(profitMargin),
    breakEven: profit >= 0
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      // 成本管理
      case 'create_cost_record':
        return await createCostRecord(event, wxContext)
      case 'list_cost_records':
        return await listCostRecords(event, wxContext)
      case 'update_cost_record':
        return await updateCostRecord(event, wxContext)
      case 'delete_cost_record':
        return await deleteCostRecord(event, wxContext)
      
      // 收入管理
      case 'create_revenue_record':
        return await createRevenueRecord(event, wxContext)
      case 'list_revenue_records':
        return await listRevenueRecords(event, wxContext)
      
      // 财务统计
      case 'get_cost_stats':
        return await getCostStats(event, wxContext)
      case 'get_revenue_stats':
        return await getRevenueStats(event, wxContext)
      case 'get_profit_analysis':
        return await getProfitAnalysis(event, wxContext)
      case 'get_financial_summary':
        return await getFinancialSummary(event, wxContext)
      
      // 死亡损失记录
      case 'createDeathLoss':
        return await createDeathLoss(event, wxContext)
      case 'createDeathLossRecord':
        return await createDeathLossRecord(event, wxContext)
      
      // 治疗成本记录
      case 'createTreatmentCostRecord':
        return await createTreatmentCostRecord(event, wxContext)
      
      // 报表生成
      case 'generate_financial_report':
        return await generateFinancialReport(event, wxContext)
      case 'get_cost_breakdown':
        return await getCostBreakdown(event, wxContext)
      
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: error.message || '财务管理操作失败，请重试'
    }
  }
}

// 创建成本记录
async function createCostRecord(event, wxContext) {
  const { 
    costType, // feed, health, labor, facility, other
    amount, 
    description, 
    relatedRecordId, 
    invoiceNumber,
    notes 
  } = event
  const openid = wxContext.OPENID

  if (!await validateFinancePermission(openid, 'create')) {
    throw new Error('无权限执行此操作')
  }

  if (!amount || amount <= 0) {
    throw new Error('成本金额必须大于0')
  }

  if (!costType) {
    throw new Error('成本类型不能为空')
  }

  const recordId = generateFinanceId('COST')

  const record = {
    _id: recordId,
    _openid: openid,
    costType,
    amount: parseFloat(amount),
    description: description || '',
    relatedRecordId: relatedRecordId || '', // 关联的业务记录ID
    invoiceNumber: invoiceNumber || '',
    notes: notes || '',
    status: 'confirmed',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    isDeleted: false
  }

  await db.collection('finance_cost_records').add({ data: record })

  return {
    success: true,
    data: record,
    message: '成本记录创建成功'
  }
}

// 创建收入记录
async function createRevenueRecord(event, wxContext) {
  const { 
    revenueType, // sales, subsidy, other
    amount, 
    description, 
    relatedRecordId,
    invoiceNumber,
    notes 
  } = event
  const openid = wxContext.OPENID

  if (!await validateFinancePermission(openid, 'create')) {
    throw new Error('无权限执行此操作')
  }

  if (!amount || amount <= 0) {
    throw new Error('收入金额必须大于0')
  }

  const recordId = generateFinanceId('REV')

  const record = {
    _id: recordId,
    _openid: openid,
    revenueType: revenueType || 'other',
    amount: parseFloat(amount),
    description: description || '',
    relatedRecordId: relatedRecordId || '',
    invoiceNumber: invoiceNumber || '',
    notes: notes || '',
    status: 'confirmed',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    isDeleted: false
  }

  await db.collection('finance_revenue_records').add({ data: record })

  return {
    success: true,
    data: record,
    message: '收入记录创建成功'
  }
}

// 获取成本统计
async function getCostStats(event, wxContext) {
  const { dateRange } = event
  const openid = wxContext.OPENID

  if (!await validateFinancePermission(openid, 'read')) {
    throw new Error('无权限查看财务数据')
  }

  const stats = await calculateCostStats(dateRange)

  return {
    success: true,
    data: stats
  }
}

// 获取收入统计
async function getRevenueStats(event, wxContext) {
  const { dateRange } = event
  const openid = wxContext.OPENID

  if (!await validateFinancePermission(openid, 'read')) {
    throw new Error('无权限查看财务数据')
  }

  const stats = await calculateRevenueStats(dateRange)

  return {
    success: true,
    data: stats
  }
}

// 获取盈亏分析
async function getProfitAnalysis(event, wxContext) {
  const { dateRange } = event
  const openid = wxContext.OPENID

  if (!await validateFinancePermission(openid, 'read')) {
    throw new Error('无权限查看财务数据')
  }

  const analysis = await calculateProfitAnalysis(dateRange)

  return {
    success: true,
    data: analysis
  }
}

// 获取财务汇总
async function getFinancialSummary(event, wxContext) {
  const { dateRange } = event
  const openid = wxContext.OPENID

  if (!await validateFinancePermission(openid, 'read')) {
    throw new Error('无权限查看财务数据')
  }

  const currentPeriod = await calculateProfitAnalysis(dateRange)
  
  // 计算同比数据（去年同期）
  let previousPeriod = null
  if (dateRange && dateRange.start && dateRange.end) {
    const startDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)
    const previousStart = new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate())
    const previousEnd = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())
    
    previousPeriod = await calculateProfitAnalysis({
      start: previousStart.toISOString(),
      end: previousEnd.toISOString()
    })
  }

  // 计算增长率
  const growth = previousPeriod ? {
    revenueGrowth: previousPeriod.revenue.totalRevenue > 0 ? 
      ((currentPeriod.revenue.totalRevenue - previousPeriod.revenue.totalRevenue) / previousPeriod.revenue.totalRevenue * 100).toFixed(2) : 0,
    costGrowth: previousPeriod.cost.totalCost > 0 ?
      ((currentPeriod.cost.totalCost - previousPeriod.cost.totalCost) / previousPeriod.cost.totalCost * 100).toFixed(2) : 0,
    profitGrowth: previousPeriod.profit !== 0 ?
      ((currentPeriod.profit - previousPeriod.profit) / Math.abs(previousPeriod.profit) * 100).toFixed(2) : 0
  } : null

  return {
    success: true,
    data: {
      currentPeriod,
      previousPeriod,
      growth
    }
  }
}

// 生成财务报表
async function generateFinancialReport(event, wxContext) {
  const { dateRange, reportType = 'comprehensive' } = event
  const openid = wxContext.OPENID

  if (!await validateFinancePermission(openid, 'generate_report')) {
    throw new Error('无权限生成报表')
  }

  const analysis = await calculateProfitAnalysis(dateRange)
  
  // 获取详细的成本和收入记录
  const [costRecords, revenueRecords] = await Promise.all([
    db.collection('finance_cost_records').where({ 
      isDeleted: false,
      ...(dateRange && dateRange.start && dateRange.end ? {
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      } : {})
    }).get(),
    db.collection('finance_revenue_records').where({ 
      isDeleted: false,
      ...(dateRange && dateRange.start && dateRange.end ? {
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      } : {})
    }).get()
  ])

  const report = {
    reportId: generateFinanceId('RPT'),
    reportType,
    dateRange,
    generateTime: new Date().toISOString(),
    summary: analysis,
    details: {
      costRecords: costRecords.data,
      revenueRecords: revenueRecords.data
    },
    generatedBy: openid
  }

  // 保存报表记录
  await db.collection('finance_reports').add({ data: report })

  return {
    success: true,
    data: report,
    message: '财务报表生成成功'
  }
}

// 获取成本分解
async function getCostBreakdown(event, wxContext) {
  const { dateRange } = event
  const openid = wxContext.OPENID

  if (!await validateFinancePermission(openid, 'read')) {
    throw new Error('无权限查看财务数据')
  }

  let query = db.collection('finance_cost_records').where({ isDeleted: false })
  
  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }
  
  const records = await query.get()
  
  // 按成本类型分组统计
  const breakdown = records.data.reduce((acc, record) => {
    const type = record.costType || 'other'
    if (!acc[type]) {
      acc[type] = {
        totalAmount: 0,
        recordCount: 0,
        averageAmount: 0,
        records: []
      }
    }
    acc[type].totalAmount += record.amount || 0
    acc[type].recordCount += 1
    acc[type].records.push(record)
    return acc
  }, {})
  
  // 计算平均值和百分比
  const totalCost = Object.values(breakdown).reduce((sum, item) => sum + item.totalAmount, 0)
  
  Object.keys(breakdown).forEach(type => {
    breakdown[type].averageAmount = breakdown[type].recordCount > 0 ? 
      breakdown[type].totalAmount / breakdown[type].recordCount : 0
    breakdown[type].percentage = totalCost > 0 ? 
      (breakdown[type].totalAmount / totalCost * 100).toFixed(2) : 0
  })

  return {
    success: true,
    data: {
      breakdown,
      totalCost,
      totalRecords: records.data.length
    }
  }
}

// 其他CRUD操作的简化实现
async function listCostRecords(event, wxContext) {
  const { page = 1, pageSize = 10, costType, dateRange } = event
  const openid = wxContext.OPENID

  if (!await validateFinancePermission(openid, 'read')) {
    throw new Error('无权限查看财务数据')
  }

  let query = db.collection('finance_cost_records').where({ isDeleted: false })
  
  if (costType) query = query.where({ costType })
  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }

  const total = await query.count()
  const records = await query
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    data: {
      records: records.data,
      pagination: { page, pageSize, total: total.total, totalPages: Math.ceil(total.total / pageSize) }
    }
  }
}

async function listRevenueRecords(event, wxContext) {
  const { page = 1, pageSize = 10, revenueType, dateRange } = event
  const openid = wxContext.OPENID

  if (!await validateFinancePermission(openid, 'read')) {
    throw new Error('无权限查看财务数据')
  }

  let query = db.collection('finance_revenue_records').where({ isDeleted: false })
  
  if (revenueType) query = query.where({ revenueType })
  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }

  const total = await query.count()
  const records = await query
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    data: {
      records: records.data,
      pagination: { page, pageSize, total: total.total, totalPages: Math.ceil(total.total / pageSize) }
    }
  }
}

// ============ 死亡损失记录管理 ============

/**
 * 创建死亡损失记录
 */
async function createDeathLoss(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    
    // 验证权限（只读权限即可，因为是系统自动创建）
    // 实际应用中可能需要更严格的权限控制
    
    const {
      batchId,
      batchNumber,
      deathRecordId,
      deathCount,
      unitCost,
      totalLoss,
      deathCause,
      recordDate,
      operator
    } = event
    
    // 验证必填项
    if (!batchId) throw new Error('批次ID不能为空')
    if (!deathRecordId) throw new Error('死亡记录ID不能为空')
    if (!deathCount || deathCount <= 0) throw new Error('死亡数量必须大于0')
    if (!totalLoss || totalLoss <= 0) throw new Error('损失金额必须大于0')
    
    // 生成财务记录ID
    const financeId = generateFinanceId('DL')
    
    // 创建成本记录
    const costRecord = {
      recordId: financeId,
      costType: 'death_loss', // 死亡损失类型
      category: 'loss', // 分类为损失
      batchId,
      batchNumber: batchNumber || '',
      amount: parseFloat(totalLoss),
      description: `死亡损失 - ${deathCause} (${deathCount}只)`,
      details: {
        deathRecordId,
        deathCount,
        unitCost: parseFloat(unitCost),
        deathCause,
        causeDescription: `批次${batchNumber || batchId}发生${deathCause}，导致${deathCount}只死亡`
      },
      recordDate: recordDate || new Date().toISOString().split('T')[0],
      operator: operator || openid,
      isDeleted: false,
      createTime: new Date(),
      updateTime: new Date()
    }
    
    // 插入财务记录
    const result = await db.collection('finance_cost_records').add({
      data: costRecord
    })
    
    // 记录审计日志
    await db.collection('sys_audit_logs').add({
      data: {
        userId: operator || openid,
        action: 'create_death_loss',
        collection: 'finance_cost_records',
        recordId: result._id,
        details: {
          batchId,
          deathCount,
          totalLoss,
          deathCause,
          result: 'success'
        },
        timestamp: new Date()
      }
    })
    
    return {
      success: true,
      data: { 
        financeRecordId: result._id,
        recordId: financeId,
        amount: totalLoss
      },
      message: '财务损失记录创建成功'
    }
    
  } catch (error) {
    console.error('创建死亡损失记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '创建财务损失记录失败'
    }
  }
}

/**
 * 创建死亡损失记录（新版，从治疗流程调用）
 */
async function createDeathLossRecord(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    const {
      deathRecordId,
      batchId,
      deathCount,
      totalLoss,
      treatmentCost = 0,
      description
    } = event
    
    // 验证必填项
    if (!deathRecordId) throw new Error('死亡记录ID不能为空')
    if (!batchId) throw new Error('批次ID不能为空')
    if (!deathCount || deathCount <= 0) throw new Error('死亡数量必须大于0')
    if (!totalLoss || totalLoss <= 0) throw new Error('损失金额必须大于0')
    
    const financeId = generateFinanceId('LOSS')
    
    // 创建财务成本记录
    const costRecord = {
      recordId: financeId,
      costType: 'loss',
      costCategory: 'death_loss',
      sourceType: 'death',
      sourceRecordId: deathRecordId,
      batchId,
      amount: parseFloat(totalLoss),
      description: description || `死亡损失 - ${deathCount}只`,
      details: {
        deathRecordId,
        deathCount,
        treatmentCost: parseFloat(treatmentCost),
        animalCost: parseFloat(totalLoss) - parseFloat(treatmentCost)
      },
      status: 'confirmed',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      isDeleted: false,
      _openid: openid
    }
    
    const result = await db.collection('finance_cost_records').add({
      data: costRecord
    })
    
    return {
      success: true,
      data: {
        financeRecordId: result._id,
        recordId: financeId,
        amount: totalLoss
      },
      message: '死亡损失记录创建成功'
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '创建死亡损失记录失败'
    }
  }
}

/**
 * 创建治疗成本记录
 */
async function createTreatmentCostRecord(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    const {
      treatmentId,
      batchId,
      totalCost,
      diagnosis,
      description
    } = event
    
    // 验证必填项
    if (!treatmentId) throw new Error('治疗记录ID不能为空')
    if (!batchId) throw new Error('批次ID不能为空')
    if (!totalCost || totalCost <= 0) throw new Error('治疗成本必须大于0')
    
    const financeId = generateFinanceId('TRT')
    
    // 创建财务成本记录
    const costRecord = {
      recordId: financeId,
      costType: 'health',
      costCategory: 'treatment',
      sourceType: 'treatment',
      sourceRecordId: treatmentId,
      batchId,
      amount: parseFloat(totalCost),
      description: description || `治疗成本 - ${diagnosis}`,
      details: {
        treatmentId,
        diagnosis,
        treatmentType: 'medication_and_care'
      },
      status: 'confirmed',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      isDeleted: false,
      _openid: openid
    }
    
    const result = await db.collection('finance_cost_records').add({
      data: costRecord
    })
    
    return {
      success: true,
      data: {
        financeRecordId: result._id,
        recordId: financeId,
        amount: totalCost
      },
      message: '治疗成本记录创建成功'
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '创建治疗成本记录失败'
    }
  }
}
