/**
 * 报销管理模块
 * 
 * 功能：
 * - 创建报销申请
 * - 查询报销记录
 * - 审批报销
 * - 统计报销数据
 */

const { COLLECTIONS } = require('./collections.js')

// 报销类型配置（养殖场景）
const REIMBURSEMENT_TYPES = {
  FEED: {
    code: 'feed',
    name: '饲料采购',
    description: '购买饲料产生的费用'
  },
  MEDICINE: {
    code: 'medicine',
    name: '兽药采购',
    description: '购买兽药、消毒剂等药品费用'
  },
  VACCINE: {
    code: 'vaccine',
    name: '防疫费用',
    description: '疫苗接种、防疫检查等费用'
  },
  EQUIPMENT: {
    code: 'equipment',
    name: '设备维修',
    description: '养殖设备维修、保养费用'
  },
  TRANSPORT: {
    code: 'transport',
    name: '运输费用',
    description: '运输饲料、禽类等产生的费用'
  },
  UTILITIES: {
    code: 'utilities',
    name: '水电费',
    description: '养殖场水电费用'
  },
  LABOR: {
    code: 'labor',
    name: '劳务费用',
    description: '临时工、外包服务等劳务费用'
  },
  OTHER: {
    code: 'other',
    name: '其他费用',
    description: '其他类型的报销'
  }
}

// 审批状态
const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
}

// 根据角色获取报销金额限制
function getAmountLimitByRole(role) {
  const limits = {
    'employee': 1000,
    'veterinarian': 1000,
    'manager': 5000,
    'super_admin': Infinity
  }
  return limits[role] || 1000
}

// 获取报销类型显示名称
function getReimbursementTypeName(type) {
  const typeConfig = Object.values(REIMBURSEMENT_TYPES).find(t => t.code === type)
  return typeConfig ? typeConfig.name : '其他'
}

// 获取用户信息
async function getUserInfo(db, openid) {
  const result = await db.collection(COLLECTIONS.WX_USERS)
    .where({ _openid: openid })
    .get()
  
  return result.data[0] || null
}

// 检查是否是管理员
function isAdmin(role) {
  return ['manager', 'super_admin'].includes(role)
}

/**
 * 创建报销申请
 */
async function createReimbursement(db, _, event, wxContext) {
  const { data } = event
  const { amount, description, date, reimbursementType, detail, remark, vouchers } = data
  
  // 1. 参数验证
  if (!amount || amount <= 0) {
    throw new Error('报销金额必须大于0')
  }
  if (!description || !description.trim()) {
    throw new Error('请填写报销描述')
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('日期格式不正确')
  }
  if (!reimbursementType) {
    throw new Error('请选择报销类型')
  }
  
  // 2. 获取当前用户信息
  const userInfo = await getUserInfo(db, wxContext.OPENID)
  if (!userInfo) {
    throw new Error('用户信息获取失败')
  }
  
  // 3. 检查金额限制
  const amountLimit = getAmountLimitByRole(userInfo.role)
  if (amount > amountLimit) {
    throw new Error(`单笔报销金额不能超过 ¥${amountLimit}`)
  }
  
  // 4. 构造报销记录
  const now = new Date().toISOString()
  const reimbursementId = `RMB${Date.now()}`
  
  const record = {
    _id: reimbursementId,
    _openid: wxContext.OPENID,
    
    // 基础财务信息
    costType: 'other',
    amount: parseFloat(amount),
    description: description,
    date: date,
    operator: userInfo.nickname || userInfo.nickName || '未知',
    
    // 记录类型
    recordType: 'reimbursement',
    isReimbursement: true,
    
    // 报销详细信息
    reimbursement: {
      type: reimbursementType,
      typeName: getReimbursementTypeName(reimbursementType),
      
      applicant: {
        openid: wxContext.OPENID,
        name: userInfo.nickname || userInfo.nickName || '未知',
        role: userInfo.role || 'employee',
        phone: userInfo.phone || ''
      },
      
      status: APPROVAL_STATUS.PENDING,
      approver: null,
      approvalTime: null,
      rejectionReason: null,
      
      vouchers: (vouchers || []).map(v => ({
        ...v,
        uploadTime: now
      })),
      
      detail: detail || '',
      remark: remark || ''
    },
    
    createTime: now,
    updateTime: now,
    isDeleted: false
  }
  
  // 5. 保存到数据库
  await db.collection(COLLECTIONS.FINANCE_COST_RECORDS).add({
    data: record
  })
  
  // 6. 发送通知给管理员
  await notifyAdminsNewReimbursement(db, record)
  
  return {
    success: true,
    message: '报销申请已提交',
    data: {
      reimbursementId: reimbursementId,
      status: APPROVAL_STATUS.PENDING,
      createTime: now
    }
  }
}

/**
 * 获取我的报销记录
 */
async function getMyReimbursements(db, _, event, wxContext) {
  const { status, page = 1, pageSize = 10 } = event
  const skip = (page - 1) * pageSize
  
  // 构建查询条件
  const whereConditions = {
    _openid: wxContext.OPENID,
    isReimbursement: true,
    isDeleted: _.neq(true)
  }
  
  // 如果指定了状态，添加状态过滤
  if (status && status !== 'all') {
    whereConditions['reimbursement.status'] = status
  }
  
  // 查询总数
  const countResult = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .where(whereConditions)
    .count()
  
  // 查询记录
  const result = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .where(whereConditions)
    .orderBy('createTime', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()
  
  return {
    success: true,
    data: {
      records: result.data,
      total: countResult.total,
      page: page,
      pageSize: pageSize,
      hasMore: skip + result.data.length < countResult.total
    }
  }
}

/**
 * 获取报销详情
 */
async function getReimbursementDetail(db, _, event, wxContext) {
  const { reimbursementId } = event
  
  if (!reimbursementId) {
    throw new Error('报销记录ID不能为空')
  }
  
  const result = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .doc(reimbursementId)
    .get()
  
  if (!result.data) {
    throw new Error('报销记录不存在')
  }
  
  // 权限检查：只能查看自己的报销或者管理员可以查看所有
  const userInfo = await getUserInfo(db, wxContext.OPENID)
  const isOwner = result.data._openid === wxContext.OPENID
  const isManager = isAdmin(userInfo.role)
  
  if (!isOwner && !isManager) {
    throw new Error('无权限查看此报销记录')
  }
  
  return {
    success: true,
    data: result.data
  }
}

/**
 * 获取待审批报销（管理员）
 */
async function getPendingReimbursements(db, _, event, wxContext) {
  const { page = 1, pageSize = 20 } = event
  const skip = (page - 1) * pageSize
  
  // 权限检查
  const userInfo = await getUserInfo(db, wxContext.OPENID)
  if (!isAdmin(userInfo.role)) {
    throw new Error('无权限查看待审批报销')
  }
  
  // 查询待审批报销
  const result = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .where({
      isReimbursement: true,
      'reimbursement.status': APPROVAL_STATUS.PENDING,
      isDeleted: _.neq(true)
    })
    .orderBy('createTime', 'asc')
    .skip(skip)
    .limit(pageSize)
    .get()
  
  // 获取总数
  const countResult = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .where({
      isReimbursement: true,
      'reimbursement.status': APPROVAL_STATUS.PENDING,
      isDeleted: _.neq(true)
    })
    .count()
  
  return {
    success: true,
    data: {
      records: result.data,
      total: countResult.total,
      page: page,
      pageSize: pageSize
    }
  }
}

/**
 * 审批报销（通过）
 */
async function approveReimbursement(db, _, event, wxContext) {
  const { reimbursementId, remark } = event
  
  if (!reimbursementId) {
    throw new Error('报销记录ID不能为空')
  }
  
  // 权限检查
  const userInfo = await getUserInfo(db, wxContext.OPENID)
  if (!isAdmin(userInfo.role)) {
    throw new Error('无权限审批报销')
  }
  
  // 获取报销记录
  const record = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .doc(reimbursementId)
    .get()
  
  if (!record.data) {
    throw new Error('报销记录不存在')
  }
  
  if (record.data.reimbursement.status !== APPROVAL_STATUS.PENDING) {
    throw new Error('该报销已审批，无法重复操作')
  }
  
  // 更新审批状态
  const now = new Date().toISOString()
  const approverInfo = {
    openid: wxContext.OPENID,
    name: userInfo.nickname || userInfo.nickName || '管理员',
    role: userInfo.role
  }
  
  // 当 approver 字段为 null 时，需要先删除再设置
  // 使用传入的 _ 参数（db.command），避免重复声明
  // 如果 approver 为 null，先删除该字段
  if (record.data.reimbursement.approver === null || record.data.reimbursement.approver === undefined) {
    await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
      .doc(reimbursementId)
      .update({
        data: {
          'reimbursement.approver': _.remove()
        }
      })
  }
  
  // 然后设置新的 approver 值和其他字段
  await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .doc(reimbursementId)
    .update({
      data: {
        'reimbursement.status': APPROVAL_STATUS.APPROVED,
        'reimbursement.approver': approverInfo,
        'reimbursement.approvalTime': now,
        'reimbursement.remark': remark || '',
        updateTime: now
      }
    })
  
  // 发送通知给申请人
  await notifyApplicant(db, record.data, 'approved', userInfo)
  
  return {
    success: true,
    message: '已通过报销申请',
    data: {
      reimbursementId: reimbursementId,
      status: APPROVAL_STATUS.APPROVED,
      approvalTime: now
    }
  }
}

/**
 * 拒绝报销
 */
async function rejectReimbursement(db, _, event, wxContext) {
  const { reimbursementId, reason } = event
  
  if (!reimbursementId) {
    throw new Error('报销记录ID不能为空')
  }
  
  if (!reason || !reason.trim()) {
    throw new Error('请填写拒绝原因')
  }
  
  // 权限检查
  const userInfo = await getUserInfo(db, wxContext.OPENID)
  if (!isAdmin(userInfo.role)) {
    throw new Error('无权限审批报销')
  }
  
  // 获取报销记录
  const record = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .doc(reimbursementId)
    .get()
  
  if (!record.data) {
    throw new Error('报销记录不存在')
  }
  
  if (record.data.reimbursement.status !== APPROVAL_STATUS.PENDING) {
    throw new Error('该报销已审批，无法重复操作')
  }
  
  // 更新审批状态
  const now = new Date().toISOString()
  const approverInfo = {
    openid: wxContext.OPENID,
    name: userInfo.nickname || userInfo.nickName || '管理员',
    role: userInfo.role
  }
  
  // 当 approver 字段为 null 时，需要先删除再设置
  // 使用传入的 _ 参数（db.command），避免重复声明
  // 如果 approver 为 null，先删除该字段
  if (record.data.reimbursement.approver === null || record.data.reimbursement.approver === undefined) {
    await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
      .doc(reimbursementId)
      .update({
        data: {
          'reimbursement.approver': _.remove()
        }
      })
  }
  
  // 然后设置新的 approver 值和其他字段
  await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .doc(reimbursementId)
    .update({
      data: {
        'reimbursement.status': APPROVAL_STATUS.REJECTED,
        'reimbursement.approver': approverInfo,
        'reimbursement.approvalTime': now,
        'reimbursement.rejectionReason': reason,
        updateTime: now
      }
    })
  
  // 发送通知给申请人
  await notifyApplicant(db, record.data, 'rejected', userInfo, reason)
  
  return {
    success: true,
    message: '已拒绝报销申请',
    data: {
      reimbursementId: reimbursementId,
      status: APPROVAL_STATUS.REJECTED,
      approvalTime: now
    }
  }
}

/**
 * 获取财务总览（管理员）
 */
async function getFinanceOverview(db, _, event, wxContext) {
  const { month, batchId, dateRange } = event
  
  // 权限检查
  const userInfo = await getUserInfo(db, wxContext.OPENID)
  if (!isAdmin(userInfo.role)) {
    throw new Error('无权限查看财务总览')
  }
  
  // 获取时间范围
  let startDate, endDate, lastStartDate, lastEndDate
  
  if (dateRange && dateRange.start && dateRange.end) {
    // 使用自定义时间范围
    startDate = dateRange.start
    endDate = dateRange.end
    
    // 计算上一个同等时间段（用于对比）
    const start = new Date(startDate)
    const end = new Date(endDate)
    const duration = end.getTime() - start.getTime()
    lastEndDate = new Date(start.getTime() - 1).toISOString() // 前一天
    lastStartDate = new Date(start.getTime() - duration - 1).toISOString()
  } else if (!dateRange) {
    // 如果 dateRange 为 undefined，查询所有数据（不设置时间范围）
    startDate = null
    endDate = null
    lastStartDate = null
    lastEndDate = null
  } else {
    // 使用月份范围（兼容旧版本）
    const monthRange = getMonthRange(month)
    startDate = monthRange.startDate
    endDate = monthRange.endDate
    const lastMonthRange = getLastMonthRange(month)
    lastStartDate = lastMonthRange.startDate
    lastEndDate = lastMonthRange.endDate
  }
  
  // 并行查询本月和上月数据
  const [
    currentIncome,
    currentExpense,
    lastIncome,
    lastExpense,
    reimbursementStats,
    costBreakdown
  ] = await Promise.all([
    getRevenueSumByDateRange(db, _, startDate, endDate, batchId),
    getCostSumByDateRange(db, _, startDate, endDate, batchId),
    getRevenueSumByDateRange(db, _, lastStartDate, lastEndDate, batchId),
    getCostSumByDateRange(db, _, lastStartDate, lastEndDate, batchId),
    getReimbursementStatsByMonth(db, _, month),
    getCostBreakdownByDateRange(db, _, startDate, endDate, batchId)
  ])
  
  // 计算增长率
  const incomeGrowth = calculateGrowthRate(currentIncome, lastIncome)
  const expenseGrowth = calculateGrowthRate(currentExpense, lastExpense)
  const currentProfit = currentIncome - currentExpense
  const lastProfit = lastIncome - lastExpense
  const profitGrowth = calculateGrowthRate(currentProfit, lastProfit)
  
  return {
    success: true,
    data: {
      income: {
        total: currentIncome,
        growth: incomeGrowth,
        compareLastMonth: currentIncome - lastIncome
      },
      expense: {
        total: currentExpense,
        growth: expenseGrowth,
        compareLastMonth: currentExpense - lastExpense
      },
      profit: {
        total: currentProfit,
        growth: profitGrowth,
        compareLastMonth: currentProfit - lastProfit
      },
      reimbursement: reimbursementStats,
      costBreakdown: costBreakdown
    }
  }
}

/**
 * 获取个人报销统计
 */
async function getMyReimbursementStats(db, _, event, wxContext) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const { startDate, endDate } = getMonthRange(currentMonth)
  
  // 查询本月已通过的报销（只统计已审批通过的）
  const monthlyResult = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .where({
      _openid: wxContext.OPENID,
      isReimbursement: true,
      'reimbursement.status': APPROVAL_STATUS.APPROVED,
      date: _.gte(startDate).and(_.lte(endDate)),
      isDeleted: _.neq(true)
    })
    .get()
  
  const monthlyAmount = monthlyResult.data.reduce((sum, r) => sum + (r.amount || 0), 0)
  
  // 查询累计已通过的报销（只统计已审批通过的）
  const totalResult = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .where({
      _openid: wxContext.OPENID,
      isReimbursement: true,
      'reimbursement.status': APPROVAL_STATUS.APPROVED,
      isDeleted: _.neq(true)
    })
    .get()
  
  const totalAmount = totalResult.data.reduce((sum, r) => sum + (r.amount || 0), 0)
  
  return {
    success: true,
    data: {
      monthlyAmount: monthlyAmount,
      totalAmount: totalAmount,
      monthlyCount: monthlyResult.data.length,
      totalCount: totalResult.data.length
    }
  }
}

// ========== 辅助函数 ==========

/**
 * 获取当前月份
 */
function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 获取月份日期范围
 */
function getMonthRange(month) {
  const monthStr = month || getCurrentMonth()
  const [year, mon] = monthStr.split('-').map(Number)
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
  const endDate = new Date(year, mon, 0).toISOString().split('T')[0]
  return { startDate, endDate }
}

/**
 * 获取上月日期范围
 */
function getLastMonthRange(month) {
  const monthStr = month || getCurrentMonth()
  const [year, mon] = monthStr.split('-').map(Number)
  const lastMonth = mon === 1 ? 12 : mon - 1
  const lastYear = mon === 1 ? year - 1 : year
  const startDate = `${lastYear}-${String(lastMonth).padStart(2, '0')}-01`
  const endDate = new Date(lastYear, lastMonth, 0).toISOString().split('T')[0]
  return { startDate, endDate }
}

/**
 * 按日期范围统计收入
 */
async function getRevenueSumByDateRange(db, _, startDate, endDate, batchId = null) {
  let totalRevenue = 0
  
  // 1. 从财务收入记录汇总
  let financeQuery = db.collection(COLLECTIONS.FINANCE_REVENUE_RECORDS)
    .where({
      isDeleted: _.neq(true)
    })
  
  // 日期筛选：仅在提供了日期范围时才添加（兼容 date 和 createTime 字段）
  if (startDate && endDate) {
    financeQuery = financeQuery.where(
      _.or([
        { date: _.gte(startDate).and(_.lte(endDate)) },
        { createTime: _.gte(startDate).and(_.lte(endDate)) }
      ])
    )
  }
  
  if (batchId) {
    financeQuery = financeQuery.where({
      batchId: batchId
    })
  }
  
  const financeResult = await financeQuery.get()
  totalRevenue += financeResult.data.reduce((sum, r) => sum + (r.amount || 0), 0)
  
  // 2. 从出栏记录汇总销售收入
  // 注意：出栏记录可能没有 exitReason 字段，只要 totalRevenue > 0 就认为是销售
  let exitQuery = db.collection(COLLECTIONS.PROD_BATCH_EXITS)
    .where({
      isDeleted: _.neq(true)
    })
  
  // 日期筛选：仅在提供了日期范围时才添加（兼容 exitDate 和 createTime 字段）
  if (startDate && endDate) {
    exitQuery = exitQuery.where(
      _.or([
        { exitDate: _.gte(startDate.split('T')[0]).and(_.lte(endDate.split('T')[0])) },
        { createTime: _.gte(startDate).and(_.lte(endDate)) }
      ])
    )
  }
  
  if (batchId) {
    // 批次筛选：兼容 batchId 和 batchNumber
    exitQuery = exitQuery.where(
      _.or([
        { batchId: batchId },
        { batchNumber: batchId }
      ])
    )
  }
  
  const exitResult = await exitQuery.get()
  // 只统计有收入的出栏记录
  totalRevenue += exitResult.data.reduce((sum, r) => {
    const revenue = r.totalRevenue || 0
    return revenue > 0 ? sum + revenue : sum
  }, 0)
  
  return totalRevenue
}

/**
 * 按日期范围统计支出
 */
async function getCostSumByDateRange(db, _, startDate, endDate, batchId = null) {
  let totalCost = 0
  
  // 1. 从财务成本记录汇总（只包含非报销记录和已审批通过的报销记录，排除待审批和被拒绝的报销）
  let financeQuery = db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .where(
      _.and([
        { isDeleted: _.neq(true) },
        _.or([
          { isReimbursement: _.neq(true) },  // 非报销记录
          _.and([
            { isReimbursement: true },
            { 'reimbursement.status': 'approved' }  // 只包含已审批通过的报销记录
          ])
        ])
      ])
    )
  
  // 日期筛选：仅在提供了日期范围时才添加（兼容 date 和 createTime 字段）
  if (startDate && endDate) {
    financeQuery = financeQuery.where(
      _.or([
        { date: _.gte(startDate).and(_.lte(endDate)) },
        { createTime: _.gte(startDate).and(_.lte(endDate)) }
      ])
    )
  }
  
  if (batchId) {
    financeQuery = financeQuery.where(
      _.or([
        { batchId: batchId },
        { 'details.batchId': batchId }
      ])
    )
  }
  
  const financeResult = await financeQuery.get()
  // 代码层面再次过滤，确保排除所有未审批和被拒绝的报销记录
  const filteredFinanceRecords = financeResult.data.filter(record => {
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
  
  totalCost += filteredFinanceRecords.reduce((sum, r) => sum + (r.amount || 0), 0)
  
  // 2. 从入栏记录汇总采购成本（鹅苗采购）
  let entryQuery = db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
    .where({
      isDeleted: _.neq(true)
    })
  
  // 日期筛选：仅在提供了日期范围时才添加（兼容 entryDate、purchaseDate 和 createTime 字段）
  if (startDate && endDate) {
    entryQuery = entryQuery.where(
      _.or([
        { entryDate: _.gte(startDate.split('T')[0]).and(_.lte(endDate.split('T')[0])) },
        { purchaseDate: _.gte(startDate.split('T')[0]).and(_.lte(endDate.split('T')[0])) },
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
  totalCost += entryResult.data.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  
  // 3. 从投喂记录汇总饲料成本
  let feedQuery = db.collection(COLLECTIONS.PROD_FEED_USAGE_RECORDS)
    .where({
      isDeleted: _.neq(true)
    })
  
  // 日期筛选：仅在提供了日期范围时才添加（兼容 recordDate 和 createTime 字段）
  if (startDate && endDate) {
    feedQuery = feedQuery.where(
      _.or([
        { recordDate: _.gte(startDate.split('T')[0]).and(_.lte(endDate.split('T')[0])) },
        { createTime: _.gte(startDate).and(_.lte(endDate)) }
      ])
    )
  }
  
  if (batchId) {
    feedQuery = feedQuery.where(
      _.or([
        { batchId: batchId },
        { batchNumber: batchId }
      ])
    )
  }
  
  const feedResult = await feedQuery.get()
  totalCost += feedResult.data.reduce((sum, r) => sum + (r.totalCost || 0), 0)
  
  // 4. 从采购记录汇总物料采购成本
  let purchaseQuery = db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
    .where({
      isDeleted: _.neq(true),
      type: 'purchase'
    })
  
  // 日期筛选：仅在提供了日期范围时才添加（兼容 recordDate 和 createTime 字段）
  if (startDate && endDate) {
    purchaseQuery = purchaseQuery.where(
      _.or([
        { recordDate: _.gte(startDate.split('T')[0]).and(_.lte(endDate.split('T')[0])) },
        { createTime: _.gte(startDate).and(_.lte(endDate)) }
      ])
    )
  }
  
  if (batchId) {
    purchaseQuery = purchaseQuery.where({
      relatedBatch: batchId
    })
  }
  
  const purchaseResult = await purchaseQuery.get()
  totalCost += purchaseResult.data.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  
  return totalCost
}

/**
 * 按日期范围统计成本分解
 */
async function getCostBreakdownByDateRange(db, _, startDate, endDate, batchId = null) {
  const breakdown = {
    feedCost: 0,      // 饲料成本
    goslingCost: 0,   // 鹅苗成本
    medicalCost: 0,   // 医疗费用
    otherCost: 0      // 其他费用
  }
  
  // 1. 从财务成本记录汇总（只包含非报销记录和已审批通过的报销记录，排除待审批和被拒绝的报销）
  let financeQuery = db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .where(
      _.and([
        { isDeleted: _.neq(true) },
        _.or([
          { isReimbursement: _.neq(true) },  // 非报销记录
          _.and([
            { isReimbursement: true },
            { 'reimbursement.status': 'approved' }  // 只包含已审批通过的报销记录
          ])
        ])
      ])
    )
  
  // 日期筛选：仅在提供了日期范围时才添加
  if (startDate && endDate) {
    financeQuery = financeQuery.where(
      _.or([
        { date: _.gte(startDate).and(_.lte(endDate)) },
        { createTime: _.gte(startDate).and(_.lte(endDate)) }
      ])
    )
  }
  
  if (batchId) {
    financeQuery = financeQuery.where(
      _.or([
        { batchId: batchId },
        { 'details.batchId': batchId }
      ])
    )
  }
  
  const financeResult = await financeQuery.get()
  // 代码层面再次过滤，确保排除所有未审批和被拒绝的报销记录
  const filteredFinanceRecords = financeResult.data.filter(record => {
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
  
  filteredFinanceRecords.forEach(record => {
    const amount = record.amount || 0
    
    // 如果是报销记录，根据报销类型分类
    if (record.isReimbursement && record.reimbursement) {
      const reimbursementType = record.reimbursement.type
      
      if (reimbursementType === 'feed') {
        // 饲料采购报销 -> 饲料成本
        breakdown.feedCost += amount
      } else if (reimbursementType === 'medicine' || reimbursementType === 'vaccine') {
        // 兽药采购、防疫费用报销 -> 医疗费用
        breakdown.medicalCost += amount
      } else {
        // 其他报销类型（equipment, transport, utilities, labor, other）-> 其他费用
        breakdown.otherCost += amount
      }
    } else {
      // 非报销记录，根据 costType 分类
      const costType = record.costType || 'other'
      
      if (costType === 'feed') {
        breakdown.feedCost += amount
      } else if (costType === 'labor' || costType === 'facility' || costType === 'other') {
        // 人工、设施、其他成本归入其他费用
        breakdown.otherCost += amount
      } else if (costType === 'health' || costType === 'treatment' || costType === 'loss' || costType === 'death_loss') {
        breakdown.medicalCost += amount
      } else {
        // 其他未分类的也归入其他费用
        breakdown.otherCost += amount
      }
    }
  })
  
  // 2. 投喂记录不在成本统计中（库存流转，不涉及现金流）
  // 说明：饲料成本只统计采购记录，投喂只是库存流转
  
  // 3. 从采购记录汇总（根据物料类型分类）
  // 饲料、药品、营养品、其他物料的采购
  let purchaseQuery = db.collection(COLLECTIONS.PROD_MATERIAL_RECORDS)
    .where({
      isDeleted: _.neq(true),
      type: 'purchase'
    })
  
  // 日期筛选：仅在提供了日期范围时才添加
  if (startDate && endDate) {
    purchaseQuery = purchaseQuery.where(
      _.or([
        { recordDate: _.gte(startDate.split('T')[0]).and(_.lte(endDate.split('T')[0])) },
        { createTime: _.gte(startDate).and(_.lte(endDate)) }
      ])
    )
  }
  
  if (batchId) {
    purchaseQuery = purchaseQuery.where({
      relatedBatch: batchId
    })
  }
  
  const purchaseResult = await purchaseQuery.get()
  // 根据物料类型判断是饲料、药品还是其他
  // 注意：财务概览按采购金额统计（现金流），批次分析按实际使用统计（成本核算）
  for (const record of purchaseResult.data) {
    // 计算金额：优先使用 totalAmount，如果没有则用 quantity * unitPrice
    let amount = record.totalAmount || 0
    if (amount === 0 && record.quantity && record.unitPrice) {
      amount = Number(record.quantity) * Number(record.unitPrice)
    }
    // 如果还是0，尝试从物料信息获取单价
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
    
    // 如果物料ID存在，查询物料类型
    if (record.materialId) {
      try {
        const material = await db.collection(COLLECTIONS.PROD_MATERIALS).doc(record.materialId).get()
        if (material.data) {
          const category = material.data.category || material.data.type || ''
          if (category === '饲料') {
          breakdown.feedCost += amount
          } else if (category === '药品' || category === 'medicine' || category === '营养品') {
            // 药品采购计入医疗费用（现金流）
            breakdown.medicalCost += amount
          } else {
            breakdown.otherCost += amount
          }
        } else {
          breakdown.otherCost += amount
        }
      } catch (e) {
        // 查询失败，默认归类为其他
        breakdown.otherCost += amount
      }
    } else if (record.category) {
      // 如果记录本身有category字段，也进行判断
      const category = record.category
      if (category === '饲料') {
        breakdown.feedCost += amount
      } else if (category === '药品' || category === 'medicine' || category === '营养品') {
        // 药品采购计入医疗费用（现金流）
        breakdown.medicalCost += amount
      } else {
        breakdown.otherCost += amount
      }
    } else {
      breakdown.otherCost += amount
    }
  }
  
  // 4. 治疗领用记录不在财务概览统计中
  // 说明：治疗领用记录只用于批次成本分析，财务概览按采购金额统计
  
  // 5. 从入栏记录汇总（归类为鹅苗成本）
  let entryQuery = db.collection(COLLECTIONS.PROD_BATCH_ENTRIES)
    .where({
      isDeleted: _.neq(true)
    })
  
  // 日期筛选：仅在提供了日期范围时才添加
  if (startDate && endDate) {
    entryQuery = entryQuery.where(
      _.or([
        { entryDate: _.gte(startDate.split('T')[0]).and(_.lte(endDate.split('T')[0])) },
        { purchaseDate: _.gte(startDate.split('T')[0]).and(_.lte(endDate.split('T')[0])) },
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
  breakdown.goslingCost += entryResult.data.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  
  const totalExpense = breakdown.feedCost + breakdown.goslingCost + breakdown.medicalCost + breakdown.otherCost
  
  // 计算百分比
  return {
    feedCost: breakdown.feedCost,
    feedPercent: totalExpense > 0 ? parseFloat((breakdown.feedCost / totalExpense * 100).toFixed(1)) : 0,
    goslingCost: breakdown.goslingCost,
    goslingPercent: totalExpense > 0 ? parseFloat((breakdown.goslingCost / totalExpense * 100).toFixed(1)) : 0,
    medicalCost: breakdown.medicalCost,
    medicalPercent: totalExpense > 0 ? parseFloat((breakdown.medicalCost / totalExpense * 100).toFixed(1)) : 0,
    otherCost: breakdown.otherCost,
    otherPercent: totalExpense > 0 ? parseFloat((breakdown.otherCost / totalExpense * 100).toFixed(1)) : 0
  }
}

/**
 * 统计月度报销数据
 */
async function getReimbursementStatsByMonth(db, _, month) {
  const { startDate, endDate } = getMonthRange(month)
  
  const result = await db.collection(COLLECTIONS.FINANCE_COST_RECORDS)
    .where({
      isReimbursement: true,
      date: _.gte(startDate).and(_.lte(endDate)),
      isDeleted: _.neq(true)
    })
    .get()
  
  const stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmount: 0,
    avgAmount: 0
  }
  
  result.data.forEach(record => {
    const status = record.reimbursement?.status
    if (status === APPROVAL_STATUS.PENDING) stats.pending++
    if (status === APPROVAL_STATUS.APPROVED) {
      stats.approved++
      stats.totalAmount += record.amount || 0
    }
    if (status === APPROVAL_STATUS.REJECTED) stats.rejected++
  })
  
  stats.avgAmount = stats.approved > 0 ? 
    Math.round(stats.totalAmount / stats.approved) : 0
  
  return stats
}

/**
 * 计算增长率
 */
function calculateGrowthRate(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0
  return parseFloat(((current - previous) / previous * 100).toFixed(2))
}

/**
 * 通知管理员有新的报销申请
 */
async function notifyAdminsNewReimbursement(db, record) {
  try {
    // 查询所有管理员
    const admins = await db.collection(COLLECTIONS.WX_USERS)
      .where({
        role: _.in(['manager', 'super_admin']),
        isActive: true
      })
      .get()
    
    // 为每个管理员创建通知
    const promises = admins.data.map(admin => {
      return db.collection(COLLECTIONS.USER_NOTIFICATIONS).add({
        data: {
          _openid: admin._openid,
          type: 'reimbursement',
          title: '新的报销申请',
          content: `${record.reimbursement.applicant.name} 提交了 ¥${record.amount} 的${record.reimbursement.typeName}报销`,
          relatedId: record._id,
          read: false,
          createTime: new Date().toISOString()
        }
      })
    })
    
    await Promise.all(promises)
  } catch (error) {
    // 通知失败不影响主流程，静默处理
  }
}

/**
 * 通知申请人审批结果
 */
async function notifyApplicant(db, record, action, approver, reason) {
  try {
    const isApproved = action === 'approved'
    const title = isApproved ? '报销申请已通过' : '报销申请已拒绝'
    const content = isApproved 
      ? `您的 ¥${record.amount} ${record.reimbursement.typeName}报销申请已由${approver.nickname || approver.nickName}审批通过`
      : `您的 ¥${record.amount} ${record.reimbursement.typeName}报销申请被拒绝。原因：${reason}`
    
    await db.collection(COLLECTIONS.USER_NOTIFICATIONS).add({
      data: {
        _openid: record._openid,
        type: 'reimbursement',
        title: title,
        content: content,
        relatedId: record._id,
        read: false,
        createTime: new Date().toISOString()
      }
    })
  } catch (error) {
    // 通知失败不影响主流程，静默处理
  }
}

// 导出模块
module.exports = {
  createReimbursement,
  getMyReimbursements,
  getReimbursementDetail,
  getPendingReimbursements,
  approveReimbursement,
  rejectReimbursement,
  getFinanceOverview,
  getMyReimbursementStats,
  REIMBURSEMENT_TYPES,
  APPROVAL_STATUS
}


