// finance-management/index.js - 财务管理云函数
const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')
const reimbursementHandler = require('./reimbursement-handler.js')

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
    const user = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: openid }).get()
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
async function calculateCostStats(dateRange, batchId, batchNumber) {
  try {
    let query = db.collection(COLLECTIONS.FINANCE_COST_RECORDS).where({ isDeleted: false })
    
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

    const debugInfo = {
      requestedBatchId: batchId ?? null,
      requestedBatchNumber: batchNumber ?? null,
      appliedFilter: 'none',
      appliedFilterValue: null,
      feedRecordsCount: 0,
      feedRecordsTotalCost: 0
    }

    records.data.forEach(record => {
      const amount = record.amount || 0
      switch (record.costType) {
        case 'feed':
          // 跳过财务记录中的饲料成本，使用投喂记录代替
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
      // 不计算饲料成本到总成本，因为饲料成本从投喂记录获取
      if (record.costType !== 'feed') {
        stats.totalCost += amount
      }
    })
    
    // 只从投喂记录中统计饲料成本
    try {
      let feedQuery = db.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS)

      if (dateRange && dateRange.start && dateRange.end) {
        // 统一生成 YYYY-MM-DD 边界字符串，避免与 Date 类型比较导致命中失败
        const normalizeToDateStr = (v) => {
          if (!v) return ''
          if (typeof v === 'string') {
            // 可能是 'YYYY-MM-DD' 或 ISO 字符串，取日期部分
            return v.includes('T') ? v.split('T')[0] : v
          }
          // Date 实例
          try {
            const y = v.getFullYear()
            const m = String(v.getMonth() + 1).padStart(2, '0')
            const d = String(v.getDate()).padStart(2, '0')
            return `${y}-${m}-${d}`
          } catch (_) {
            return ''
          }
        }

        const startStr = normalizeToDateStr(dateRange.start)
        const endStr = normalizeToDateStr(dateRange.end)

        if (startStr && endStr) {
          // 使用 recordDate（YYYY-MM-DD 字符串）进行范围查询，类型一致更可靠
          feedQuery = feedQuery.where({
            recordDate: _.gte(startStr).and(_.lte(endStr))
          })
        }
      }

      // 批次筛选：优先 batchNumber 精确匹配，其次 24hex batchId
      if ((batchId && batchId !== 'all') || batchNumber) {
        const norm = (v) => (typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim()))
        const bn = norm(batchNumber)
        const bi = norm(batchId)
        const is24Hex = (val) => typeof val === 'string' && /^[a-fA-F0-9]{24}$/.test(val)
        if (bn) {
          feedQuery = feedQuery.where({ batchNumber: bn })
          debugInfo.appliedFilter = 'batchNumber'
          debugInfo.appliedFilterValue = bn
        } else if (bi && bi !== 'all' && is24Hex(bi)) {
          feedQuery = feedQuery.where({ batchId: bi })
          debugInfo.appliedFilter = 'batchId'
          debugInfo.appliedFilterValue = bi
        } else if (bi && bi !== 'all') {
          feedQuery = feedQuery.where({ batchNumber: bi })
          debugInfo.appliedFilter = 'batchNumber_from_batchId'
          debugInfo.appliedFilterValue = bi
        }
      }

      const feedRecords = await feedQuery.get()
      debugInfo.feedRecordsCount = feedRecords.data.length
      feedRecords.data.forEach(record => {
        let totalCost = Number(record.totalCost || 0)
        if (!totalCost || totalCost === 0) {
          const q = Number(record.quantity || 0)
          const up = Number(record.unitPrice || 0)
          totalCost = q * up
        }
        if (!Number.isFinite(totalCost)) totalCost = 0
        stats.feedCost += totalCost
        stats.totalCost += totalCost
      })
      debugInfo.feedRecordsTotalCost = stats.feedCost
    } catch (e) {
      // 如果投喂记录集合不存在或查询失败，饲料成本为0
      console.warn('查询投喂记录失败:', e.message)
    }
    
    return { stats, debugInfo }
  } catch (error) {
    // 已移除调试日志
    return {
      stats: {
        feedCost: 0, healthCost: 0, laborCost: 0, 
        facilityCost: 0, otherCost: 0, totalCost: 0
      },
      debugInfo: {
        requestedBatchId: batchId ?? null,
        requestedBatchNumber: batchNumber ?? null,
        appliedFilter: 'error',
        appliedFilterValue: error?.message || null,
        feedRecordsCount: 0,
        feedRecordsTotalCost: 0
      }
    }
  }
}

// 计算收入统计
async function calculateRevenueStats(dateRange) {
  try {
    // 从出栏记录获取销售收入
    // 注意：出栏记录可能没有 exitReason 字段，只要 totalRevenue > 0 就认为是销售
    let exitQuery = db.collection(COLLECTIONS.PROD_BATCH_EXITS)
      .where({ 
        isDeleted: false
      })
    
    if (dateRange && dateRange.start && dateRange.end) {
      exitQuery = exitQuery.where({
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }
    
    const exitRecords = await exitQuery.get()
    
    // 只统计有收入的出栏记录
    const salesRevenue = exitRecords.data.reduce((sum, record) => {
      const revenue = record.totalRevenue || 0
      return revenue > 0 ? sum + revenue : sum
    }, 0)
    
    // 从收入记录获取其他收入
    let revenueQuery = db.collection(COLLECTIONS.FINANCE_REVENUE_RECORDS).where({ isDeleted: false })
    
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
      
      // ========== 报销管理（新增） ==========
      case 'create_reimbursement':
        return await reimbursementHandler.createReimbursement(db, _, event, wxContext)
      case 'get_my_reimbursements':
        return await reimbursementHandler.getMyReimbursements(db, _, event, wxContext)
      case 'get_reimbursement_detail':
        return await reimbursementHandler.getReimbursementDetail(db, _, event, wxContext)
      case 'get_pending_reimbursements':
        return await reimbursementHandler.getPendingReimbursements(db, _, event, wxContext)
      case 'approve_reimbursement':
        return await reimbursementHandler.approveReimbursement(db, _, event, wxContext)
      case 'reject_reimbursement':
        return await reimbursementHandler.rejectReimbursement(db, _, event, wxContext)
      case 'get_finance_overview':
        return await reimbursementHandler.getFinanceOverview(db, _, event, wxContext)
      case 'get_my_reimbursement_stats':
        return await reimbursementHandler.getMyReimbursementStats(db, _, event, wxContext)
      case 'get_approval_history':
        return await reimbursementHandler.getApprovalHistory(db, _, event, wxContext)
      case 'get_all_finance_records':
        return await getAllFinanceRecords(event, wxContext)
      
      // AI财务分析历史管理
      case 'clear_analysis_history':
        return await clearAnalysisHistory(event, wxContext)
      
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

  await db.collection(COLLECTIONS.FINANCE_COST_RECORDS).add({ data: record })

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

  await db.collection(COLLECTIONS.FINANCE_REVENUE_RECORDS).add({ data: record })

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

  // 放宽权限：为了健康页展示统计，不因角色限制而阻塞读取
  // 仅对写操作维持严格校验

  const { stats, debugInfo } = await calculateCostStats(dateRange, event.batchId, event.batchNumber)

  return {
    success: true,
    data: stats,
    debug: debugInfo
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
    db.collection(COLLECTIONS.FINANCE_COST_RECORDS).where({ 
      isDeleted: false,
      ...(dateRange && dateRange.start && dateRange.end ? {
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      } : {})
    }).get(),
    db.collection(COLLECTIONS.FINANCE_REVENUE_RECORDS).where({ 
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
  await db.collection(COLLECTIONS.FINANCE_REPORTS).add({ data: report })

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

  let query = db.collection(COLLECTIONS.FINANCE_COST_RECORDS).where({ isDeleted: false })
  
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

  let query = db.collection(COLLECTIONS.FINANCE_COST_RECORDS).where({ isDeleted: false })
  
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

  let query = db.collection(COLLECTIONS.FINANCE_REVENUE_RECORDS).where({ isDeleted: false })
  
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
    const result = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS).add({
      data: costRecord
    })
    
    // 记录审计日志
    await db.collection(COLLECTIONS.SYS_AUDIT_LOGS).add({
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
    
    const result = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS).add({
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
    
    const result = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS).add({
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

/**
 * 获取所有财务相关记录（包括业务记录）
 */
async function getAllFinanceRecords(event, wxContext) {
  try {
    const { page = 1, pageSize = 100, dateRange, batchId } = event
    const openid = wxContext.OPENID

    if (!await validateFinancePermission(openid, 'read')) {
      throw new Error('无权限查看财务数据')
    }

    const startDate = dateRange?.start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const endDate = dateRange?.end || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()
    const startDateStr = startDate.split('T')[0]
    const endDateStr = endDate.split('T')[0]

    const records = []

    // 1. 获取财务收入记录
    let revenueQuery = db.collection(COLLECTIONS.FINANCE_REVENUE_RECORDS).where({ isDeleted: false })
    if (dateRange) {
      revenueQuery = revenueQuery.where(
        _.or([
          { date: _.gte(startDate).and(_.lte(endDate)) },
          { createTime: _.gte(startDate).and(_.lte(endDate)) }
        ])
      )
    }
    if (batchId) {
      revenueQuery = revenueQuery.where({ batchId: batchId })
    }
    const revenueResult = await revenueQuery.get()
    revenueResult.data.forEach(record => {
      records.push({
        id: record._id || record.recordId,
        type: 'income',
        source: 'finance',
        revenueType: record.revenueType,
        amount: record.amount || 0,
        description: record.description || '收入记录',
        date: record.date || record.createTime,
        createTime: record.createTime,
        status: record.status || 'confirmed',
        relatedRecordId: record.relatedRecordId,
        batchId: record.batchId,
        rawRecord: record
      })
    })

    // 2. 获取财务成本记录（只包含非报销记录和已审批通过的报销记录，排除待审批和被拒绝的报销）
    let costQuery = db.collection(COLLECTIONS.FINANCE_COST_RECORDS).where(
      _.and([
        { isDeleted: false },
        _.or([
          { isReimbursement: _.neq(true) },  // 非报销记录
          _.and([
            { isReimbursement: true },
            { 'reimbursement.status': 'approved' }  // 只包含已审批通过的报销记录
          ])
        ])
      ])
    )
    if (dateRange) {
      costQuery = costQuery.where(
        _.or([
          { date: _.gte(startDate).and(_.lte(endDate)) },
          { createTime: _.gte(startDate).and(_.lte(endDate)) }
        ])
      )
    }
    if (batchId) {
      costQuery = costQuery.where(
        _.or([
          { batchId: batchId },
          { 'details.batchId': batchId }
        ])
      )
    }
    const costResult = await costQuery.get()
    // 代码层面再次过滤，确保排除所有未审批和被拒绝的报销记录
    const filteredCostRecords = costResult.data.filter(record => {
      // 如果不是报销记录，直接包含
      if (!record.isReimbursement) {
        return true
      }
      // 如果是报销记录，只包含已审批通过的
      if (record.isReimbursement && record.reimbursement && record.reimbursement.status === 'approved') {
        return true
      }
      // 其他情况（待审批、已拒绝、状态异常）都排除
      return false
    })
    
    filteredCostRecords.forEach(record => {
      records.push({
        id: record._id || record.recordId,
        type: 'expense',
        source: 'finance',
        costType: record.costType,
        amount: record.amount || 0,
        description: record.description || '支出记录',
        date: record.date || record.createTime,
        createTime: record.createTime,
        status: record.status || 'confirmed',
        relatedRecordId: record.relatedRecordId || record.sourceRecordId,
        batchId: record.batchId || record.details?.batchId,
        isReimbursement: record.isReimbursement,
        reimbursement: record.reimbursement,
        rawRecord: record
      })
    })

    // 3. 获取出栏记录（销售收入）
    // 注意：出栏记录可能没有 exitReason 字段，只要 totalRevenue > 0 就认为是销售
    let exitQuery = db.collection(COLLECTIONS.PROD_BATCH_EXITS).where({
      isDeleted: false
    })
    if (dateRange) {
      exitQuery = exitQuery.where(
        _.or([
          { exitDate: _.gte(startDateStr).and(_.lte(endDateStr)) },
          { createTime: _.gte(startDate).and(_.lte(endDate)) }
        ])
      )
    }
    if (batchId) {
      exitQuery = exitQuery.where(
        _.or([
          { batchId: batchId },
          { batchNumber: batchId }
        ])
      )
    }
    const exitResult = await exitQuery.get()
    exitResult.data.forEach(record => {
      // 只处理有收入的出栏记录（销售）
      const revenue = record.totalRevenue || 0
      if (revenue > 0) {
        records.push({
          id: `exit_${record._id}`,  // 添加前缀避免id重复
          type: 'income',
          source: 'exit',
          revenueType: 'sales',
          amount: revenue,
          description: `成鹅销售收入 - ${record.batchNumber || ''} - ${record.customer || '客户'} - ${record.quantity || 0}羽`,
          date: record.exitDate || record.createTime,
          createTime: record.createTime,
          status: 'confirmed',
          relatedRecordId: record._id,
          batchId: record.batchId || record.batchNumber,
          batchNumber: record.batchNumber,
          rawRecord: record
        })
      }
    })

    // 4. 获取入栏记录（采购成本）
    let entryQuery = db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).where({ isDeleted: false })
    if (dateRange) {
      entryQuery = entryQuery.where(
        _.or([
          { entryDate: _.gte(startDateStr).and(_.lte(endDateStr)) },
          { purchaseDate: _.gte(startDateStr).and(_.lte(endDateStr)) },
          { createTime: _.gte(startDate).and(_.lte(endDate)) }
        ])
      )
    }
    if (batchId) {
      entryQuery = entryQuery.where(
        _.or([
          { _id: batchId },
          { batchNumber: batchId }
        ])
      )
    }
    const entryResult = await entryQuery.get()
    entryResult.data.forEach(record => {
      records.push({
        id: `entry_${record._id}`,  // 添加前缀避免id重复
        type: 'expense',
        source: 'entry',
        costType: 'other',
        amount: record.totalAmount || 0,
        description: `入栏采购 - ${record.breed || '品种'} - ${record.batchNumber || ''} - ${record.supplier || '供应商'}`,
        date: record.entryDate || record.purchaseDate || record.createTime,
        createTime: record.createTime,
        status: 'confirmed',
        relatedRecordId: record._id,
        batchId: record._id,
        batchNumber: record.batchNumber,
        rawRecord: record
      })
    })

    // 5. 投喂记录不在财务记录列表中显示
    // 说明：投喂记录只用于批次成本分析，财务记录列表显示饲料采购记录

    // 6. 获取物料采购记录（饲料、药品、其他物料）
    // 使用 _.and() 合并所有查询条件，确保 type: 'purchase' 条件生效
    // 兼容没有 isDeleted 字段的旧记录
    const purchaseConditions = [
      _.or([
        { isDeleted: false },
        { isDeleted: _.exists(false) }  // 兼容没有 isDeleted 字段的记录
      ]),
      { type: 'purchase' }
    ]
    
    if (dateRange) {
      purchaseConditions.push(
        _.or([
          { recordDate: _.gte(startDateStr).and(_.lte(endDateStr)) },
          { createTime: _.gte(startDate).and(_.lte(endDate)) }
        ])
      )
    }
    
    if (batchId) {
      purchaseConditions.push({ relatedBatch: batchId })
    }
    
    const purchaseResult = await db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
      .where(_.and(purchaseConditions))
      .get()
    
    // 查询物料信息来判断类型和获取物料名称
    for (const record of purchaseResult.data) {
      let costType = 'other'
      let materialName = record.materialName || '物料'
      
      if (record.materialId) {
        try {
          const material = await db.collection(COLLECTIONS.PROD_MATERIALS).doc(record.materialId).get()
          if (material.data) {
            materialName = material.data.name || material.data.materialName || materialName
            const category = material.data.category || material.data.type || ''
            if (category === '饲料') {
              costType = 'feed'
            } else if (category === '药品' || category === 'medicine' || category === '营养品') {
              costType = 'health'
            }
          }
        } catch (e) {
          // 查询失败，使用默认值
        }
      } else if (record.category) {
        const category = record.category
        if (category === '饲料') {
          costType = 'feed'
        } else if (category === '药品' || category === 'medicine' || category === '营养品') {
          costType = 'health'
        }
      }
      
      // 计算总金额
      let amount = record.totalAmount || 0
      if (amount === 0 && record.quantity && record.unitPrice) {
        amount = Number(record.quantity) * Number(record.unitPrice)
      }
      if (amount === 0 && record.quantity && record.materialId) {
        try {
          const material = await db.collection(COLLECTIONS.PROD_MATERIALS).doc(record.materialId).get()
          if (material.data && material.data.unitPrice) {
            amount = Number(record.quantity) * Number(material.data.unitPrice)
          }
        } catch (e) {
          // 查询失败，保持为0
        }
      }
      
      records.push({
        id: `purchase_${record._id}`,
        type: 'expense',
        source: 'purchase',
        costType: costType,
        amount: amount,
        description: `${costType === 'health' ? '药品' : costType === 'feed' ? '饲料' : '物料'}采购 - ${materialName} - ${record.supplier || '供应商'} - ${record.quantity || 0}${record.unit || '件'}`,
        date: record.recordDate || record.createTime,
        createTime: record.createTime,
        status: 'confirmed',
        relatedRecordId: record._id,
        batchId: record.relatedBatch,
        rawRecord: record
      })
    }

    // 7. 投喂记录和治疗领用记录不在财务记录列表中显示
    // 说明：这些记录只用于批次成本分析，财务记录列表显示采购记录

    // 按日期排序（最新的在前）
    records.sort((a, b) => {
      const dateA = new Date(a.createTime || a.date).getTime()
      const dateB = new Date(b.createTime || b.date).getTime()
      return dateB - dateA
    })

    // 分页
    const total = records.length
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedRecords = records.slice(startIndex, endIndex)

    return {
      success: true,
      data: {
        records: paginatedRecords,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '获取财务记录失败'
    }
  }
}

// 清空AI财务分析历史
async function clearAnalysisHistory(event, wxContext) {
  try {
    const openid = wxContext.OPENID
    
    // 批量删除当前用户的所有分析历史记录
    const deleteResult = await db.collection(COLLECTIONS.FINANCE_ANALYSIS_HISTORY)
      .where({
        _openid: openid
      })
      .remove()
    
    return {
      success: true,
      data: {
        removed: deleteResult.stats.removed
      },
      message: `成功清空${deleteResult.stats.removed}条分析历史`
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '清空分析历史失败'
    }
  }
}
