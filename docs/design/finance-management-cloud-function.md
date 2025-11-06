# 财务管理云函数 - 接口设计文档

## 概述

本文档定义 `finance-management` 云函数的接口规范，支持报销申请、审批、查询等完整的财务管理功能。

**云函数名称**：`finance-management`  
**环境要求**：微信云开发环境  
**依赖集合**：`finance_cost_records`, `finance_revenue_records`, `wx_users`

---

## 一、云函数架构

### 1.1 基础结构

```javascript
// cloudfunctions/finance-management/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  
  try {
    switch (action) {
      // 报销申请相关
      case 'create_reimbursement':
        return await createReimbursement(event, wxContext)
      case 'get_my_reimbursements':
        return await getMyReimbursements(event, wxContext)
      case 'get_reimbursement_detail':
        return await getReimbursementDetail(event, wxContext)
      
      // 报销审批相关（管理员）
      case 'get_pending_reimbursements':
        return await getPendingReimbursements(event, wxContext)
      case 'approve_reimbursement':
        return await approveReimbursement(event, wxContext)
      case 'reject_reimbursement':
        return await rejectReimbursement(event, wxContext)
      
      // 财务统计相关（管理员）
      case 'get_finance_overview':
        return await getFinanceOverview(event, wxContext)
      case 'get_monthly_statistics':
        return await getMonthlyStatistics(event, wxContext)
      
      default:
        throw new Error(`未知的操作类型: ${action}`)
    }
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      success: false,
      error: error.message,
      message: '操作失败，请重试'
    }
  }
}
```

---

## 二、接口定义

### 2.1 创建报销申请

**Action**: `create_reimbursement`

**权限**: 所有用户

**请求参数**:

```javascript
{
  action: 'create_reimbursement',
  data: {
    // 基础信息
    amount: 280,                          // 报销金额（必填）
    description: '前往南京出差的费用',     // 描述（必填）
    date: '2024-03-15',                   // 日期（必填，格式：YYYY-MM-DD）
    
    // 报销信息
    reimbursementType: 'travel',          // 报销类型（必填）travel|meal|purchase|entertainment|other
    detail: '交通费180元，住宿费100元',   // 详细说明（可选）
    remark: '已提前获得经理口头同意',      // 备注（可选）
    
    // 凭证
    vouchers: [                           // 凭证数组（可选）
      {
        fileId: 'cloud://xxx.png',
        fileName: '高铁票.png',
        fileType: 'image'
      }
    ]
  }
}
```

**返回结果**:

```javascript
{
  success: true,
  message: '报销申请已提交',
  data: {
    reimbursementId: 'reimbursement_20240315143022',
    status: 'pending',
    createTime: '2024-03-15T14:30:22.000Z'
  }
}
```

**实现代码**:

```javascript
async function createReimbursement(event, wxContext) {
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
  const userInfo = await getUserInfo(wxContext.OPENID)
  if (!userInfo) {
    throw new Error('用户信息获取失败')
  }
  
  // 3. 检查金额限制
  const amountLimit = getAmountLimitByRole(userInfo.role)
  if (amount > amountLimit) {
    throw new Error(`单笔报销金额不能超过 ¥${amountLimit}`)
  }
  
  // 4. 构造报销记录
  const reimbursementId = `reimbursement_${Date.now()}`
  const now = new Date().toISOString()
  
  const record = {
    _id: reimbursementId,
    _openid: wxContext.OPENID,
    
    // 基础财务信息
    costType: 'other',
    amount: amount,
    description: description,
    date: date,
    operator: userInfo.nickname || userInfo.nickName,
    
    // 记录类型
    recordType: 'reimbursement',
    isReimbursement: true,
    
    // 报销详细信息
    reimbursement: {
      type: reimbursementType,
      typeName: getReimbursementTypeName(reimbursementType),
      
      applicant: {
        openid: wxContext.OPENID,
        name: userInfo.nickname || userInfo.nickName,
        role: userInfo.role,
        phone: userInfo.phone
      },
      
      status: 'pending',
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
  await db.collection('finance_cost_records').add({
    data: record
  })
  
  // 6. 发送通知给管理员（可选）
  await notifyAdminsNewReimbursement(record)
  
  return {
    success: true,
    message: '报销申请已提交',
    data: {
      reimbursementId: reimbursementId,
      status: 'pending',
      createTime: now
    }
  }
}
```

---

### 2.2 获取我的报销记录

**Action**: `get_my_reimbursements`

**权限**: 所有用户

**请求参数**:

```javascript
{
  action: 'get_my_reimbursements',
  status: 'pending',      // 可选，筛选状态：pending|approved|rejected|all（默认all）
  page: 1,                // 可选，页码（默认1）
  pageSize: 10            // 可选，每页数量（默认10）
}
```

**返回结果**:

```javascript
{
  success: true,
  data: {
    records: [
      {
        _id: 'reimbursement_xxx',
        amount: 280,
        description: '差旅费报销',
        date: '2024-03-15',
        reimbursement: {
          type: 'travel',
          typeName: '差旅费',
          status: 'pending',
          createTime: '2024-03-15T14:30:22.000Z'
        }
      }
    ],
    total: 25,
    page: 1,
    pageSize: 10,
    hasMore: true
  }
}
```

---

### 2.3 获取报销详情

**Action**: `get_reimbursement_detail`

**权限**: 申请人本人 或 管理员

**请求参数**:

```javascript
{
  action: 'get_reimbursement_detail',
  reimbursementId: 'reimbursement_20240315143022'
}
```

**返回结果**:

```javascript
{
  success: true,
  data: {
    // 完整的报销记录对象
    _id: 'reimbursement_xxx',
    amount: 280,
    description: '差旅费报销',
    // ... 所有字段
  }
}
```

---

### 2.4 获取待审批报销（管理员）

**Action**: `get_pending_reimbursements`

**权限**: 管理员、经理、超级管理员

**请求参数**:

```javascript
{
  action: 'get_pending_reimbursements',
  page: 1,
  pageSize: 20
}
```

**返回结果**:

```javascript
{
  success: true,
  data: {
    records: [
      {
        _id: 'reimbursement_xxx',
        amount: 280,
        description: '李四 - 差旅费报销',
        reimbursement: {
          applicant: {
            name: '李四',
            role: 'employee'
          },
          type: 'travel',
          status: 'pending',
          createTime: '2024-03-15T14:30:22.000Z'
        }
      }
    ],
    total: 3,
    page: 1,
    pageSize: 20
  }
}
```

**实现代码**:

```javascript
async function getPendingReimbursements(event, wxContext) {
  // 1. 权限检查
  const userInfo = await getUserInfo(wxContext.OPENID)
  if (!['manager', 'super_admin'].includes(userInfo.role)) {
    throw new Error('无权限查看待审批报销')
  }
  
  // 2. 查询参数
  const page = event.page || 1
  const pageSize = event.pageSize || 20
  const skip = (page - 1) * pageSize
  
  // 3. 查询待审批报销
  const result = await db.collection('finance_cost_records')
    .where({
      isReimbursement: true,
      'reimbursement.status': 'pending',
      isDeleted: _.neq(true)
    })
    .orderBy('createTime', 'asc')
    .skip(skip)
    .limit(pageSize)
    .get()
  
  // 4. 获取总数
  const countResult = await db.collection('finance_cost_records')
    .where({
      isReimbursement: true,
      'reimbursement.status': 'pending',
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
```

---

### 2.5 通过报销申请

**Action**: `approve_reimbursement`

**权限**: 管理员、经理、超级管理员

**请求参数**:

```javascript
{
  action: 'approve_reimbursement',
  reimbursementId: 'reimbursement_20240315143022',
  remark: '同意报销'  // 可选
}
```

**返回结果**:

```javascript
{
  success: true,
  message: '已通过报销申请',
  data: {
    reimbursementId: 'reimbursement_20240315143022',
    status: 'approved',
    approvalTime: '2024-03-16T09:15:30.000Z'
  }
}
```

**实现代码**:

```javascript
async function approveReimbursement(event, wxContext) {
  const { reimbursementId, remark } = event
  
  // 1. 权限检查
  const userInfo = await getUserInfo(wxContext.OPENID)
  if (!['manager', 'super_admin'].includes(userInfo.role)) {
    throw new Error('无权限审批报销')
  }
  
  // 2. 获取报销记录
  const record = await db.collection('finance_cost_records')
    .doc(reimbursementId)
    .get()
  
  if (!record.data) {
    throw new Error('报销记录不存在')
  }
  
  if (record.data.reimbursement.status !== 'pending') {
    throw new Error('该报销已审批，无法重复操作')
  }
  
  // 3. 更新审批状态
  const now = new Date().toISOString()
  await db.collection('finance_cost_records')
    .doc(reimbursementId)
    .update({
      data: {
        'reimbursement.status': 'approved',
        'reimbursement.approver': {
          openid: wxContext.OPENID,
          name: userInfo.nickname || userInfo.nickName,
          role: userInfo.role
        },
        'reimbursement.approvalTime': now,
        'reimbursement.remark': remark || '',
        updateTime: now
      }
    })
  
  // 4. 发送通知给申请人
  await notifyApplicantApproved(record.data, userInfo)
  
  return {
    success: true,
    message: '已通过报销申请',
    data: {
      reimbursementId: reimbursementId,
      status: 'approved',
      approvalTime: now
    }
  }
}
```

---

### 2.6 拒绝报销申请

**Action**: `reject_reimbursement`

**权限**: 管理员、经理、超级管理员

**请求参数**:

```javascript
{
  action: 'reject_reimbursement',
  reimbursementId: 'reimbursement_20240315143022',
  reason: '该采购未经提前审批，请走正规采购流程'  // 必填
}
```

**返回结果**:

```javascript
{
  success: true,
  message: '已拒绝报销申请',
  data: {
    reimbursementId: 'reimbursement_20240315143022',
    status: 'rejected',
    approvalTime: '2024-03-16T09:15:30.000Z'
  }
}
```

---

### 2.7 获取财务总览（管理员）

**Action**: `get_finance_overview`

**权限**: 管理员、经理、超级管理员

**请求参数**:

```javascript
{
  action: 'get_finance_overview',
  month: '2024-03'  // 可选，默认当前月份
}
```

**返回结果**:

```javascript
{
  success: true,
  data: {
    // 收入统计
    income: {
      total: 212000,           // 总收入（元）
      growth: 15.3,            // 增长率（%）
      compareLastMonth: 28000  // 比上月增长金额
    },
    
    // 支出统计
    expense: {
      total: 168000,           // 总支出（元）
      growth: 8.7,             // 增长率（%）
      compareLastMonth: 13500  // 比上月增长金额
    },
    
    // 利润
    profit: {
      total: 44000,            // 净利润（元）
      growth: 32.1,            // 增长率（%）
      compareLastMonth: 14500  // 比上月增长金额
    },
    
    // 报销统计
    reimbursement: {
      pending: 3,              // 待审批数量
      approved: 15,            // 已通过数量
      rejected: 2,             // 已拒绝数量
      totalAmount: 8560,       // 已通过的报销总额（元）
      avgAmount: 570           // 平均报销金额（元）
    }
  }
}
```

**实现代码**:

```javascript
async function getFinanceOverview(event, wxContext) {
  // 1. 权限检查
  const userInfo = await getUserInfo(wxContext.OPENID)
  if (!['manager', 'super_admin'].includes(userInfo.role)) {
    throw new Error('无权限查看财务总览')
  }
  
  // 2. 获取月份范围
  const month = event.month || getCurrentMonth()
  const { startDate, endDate } = getMonthRange(month)
  const { startDate: lastStartDate, endDate: lastEndDate } = getLastMonthRange(month)
  
  // 3. 并行查询本月和上月数据
  const [
    currentIncome,
    currentExpense,
    lastIncome,
    lastExpense,
    reimbursementStats
  ] = await Promise.all([
    // 本月收入
    getRevenueSumByDateRange(startDate, endDate),
    // 本月支出
    getCostSumByDateRange(startDate, endDate),
    // 上月收入
    getRevenueSumByDateRange(lastStartDate, lastEndDate),
    // 上月支出
    getCostSumByDateRange(lastStartDate, lastEndDate),
    // 报销统计
    getReimbursementStatsByMonth(month)
  ])
  
  // 4. 计算增长率
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
      reimbursement: reimbursementStats
    }
  }
}
```

---

### 2.8 获取月度统计

**Action**: `get_monthly_statistics`

**权限**: 管理员、经理、超级管理员

**请求参数**:

```javascript
{
  action: 'get_monthly_statistics',
  year: 2024,   // 可选，默认当前年份
  month: 3      // 可选，默认当前月份
}
```

**返回结果**:

```javascript
{
  success: true,
  data: {
    // 收入明细
    incomeDetails: [
      { date: '2024-03-01', amount: 12000, description: '成鹅销售' },
      { date: '2024-03-05', amount: 8500, description: '鹅蛋销售' }
    ],
    
    // 支出明细
    expenseDetails: [
      { date: '2024-03-02', amount: 4500, description: '饲料采购' },
      { date: '2024-03-10', amount: 1200, description: '水电费' }
    ],
    
    // 报销明细
    reimbursementDetails: [
      {
        date: '2024-03-15',
        applicant: '张三',
        type: '差旅费',
        amount: 280,
        status: 'approved'
      }
    ],
    
    // 统计汇总
    summary: {
      totalIncome: 212000,
      totalExpense: 168000,
      totalProfit: 44000,
      reimbursementCount: 15,
      reimbursementAmount: 8560
    }
  }
}
```

---

## 三、辅助函数

### 3.1 权限检查

```javascript
// 检查用户是否是管理员
function isAdmin(role) {
  return ['manager', 'super_admin'].includes(role)
}

// 获取用户信息
async function getUserInfo(openid) {
  const result = await db.collection('wx_users')
    .where({ _openid: openid })
    .get()
  
  return result.data[0] || null
}
```

### 3.2 金额限制

```javascript
// 根据角色获取单笔报销上限
function getAmountLimitByRole(role) {
  const limits = {
    'employee': 1000,
    'veterinarian': 1000,
    'manager': 5000,
    'super_admin': Infinity
  }
  return limits[role] || 1000
}
```

### 3.3 类型名称映射

```javascript
// 获取报销类型显示名称
function getReimbursementTypeName(type) {
  const typeNames = {
    'travel': '差旅费',
    'meal': '餐费',
    'purchase': '采购费用',
    'entertainment': '招待费',
    'other': '其他'
  }
  return typeNames[type] || '其他'
}
```

### 3.4 日期处理

```javascript
// 获取当前月份
function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// 获取月份日期范围
function getMonthRange(month) {
  const [year, mon] = month.split('-').map(Number)
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
  const endDate = new Date(year, mon, 0).toISOString().split('T')[0]
  return { startDate, endDate }
}
```

### 3.5 通知发送

```javascript
// 通知管理员有新的报销申请
async function notifyAdminsNewReimbursement(record) {
  // 查询所有管理员
  const admins = await db.collection('wx_users')
    .where({
      role: _.in(['manager', 'super_admin']),
      isActive: true
    })
    .get()
  
  // 发送模板消息或创建通知记录
  for (const admin of admins.data) {
    await db.collection('user_notifications').add({
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
  }
}

// 通知申请人审批结果
async function notifyApplicantApproved(record, approver) {
  await db.collection('user_notifications').add({
    data: {
      _openid: record._openid,
      type: 'reimbursement',
      title: '报销申请已通过',
      content: `您的 ¥${record.amount} ${record.reimbursement.typeName}报销申请已由${approver.nickname}审批通过`,
      relatedId: record._id,
      read: false,
      createTime: new Date().toISOString()
    }
  })
}
```

---

## 四、错误处理

### 4.1 错误码定义

```javascript
const ERROR_CODES = {
  // 参数错误
  INVALID_PARAMS: { code: 1001, message: '参数错误' },
  MISSING_REQUIRED: { code: 1002, message: '缺少必填参数' },
  
  // 权限错误
  NO_PERMISSION: { code: 2001, message: '无权限访问' },
  NOT_ADMIN: { code: 2002, message: '需要管理员权限' },
  
  // 业务错误
  AMOUNT_EXCEEDED: { code: 3001, message: '报销金额超过限额' },
  ALREADY_APPROVED: { code: 3002, message: '该报销已审批' },
  RECORD_NOT_FOUND: { code: 3003, message: '记录不存在' },
  
  // 系统错误
  DATABASE_ERROR: { code: 9001, message: '数据库错误' },
  UNKNOWN_ERROR: { code: 9999, message: '未知错误' }
}
```

### 4.2 错误处理示例

```javascript
function handleError(error) {
  console.error('云函数错误:', error)
  
  // 根据错误类型返回不同的错误信息
  if (error.message.includes('权限')) {
    return {
      success: false,
      errorCode: ERROR_CODES.NO_PERMISSION.code,
      message: ERROR_CODES.NO_PERMISSION.message
    }
  }
  
  return {
    success: false,
    errorCode: ERROR_CODES.UNKNOWN_ERROR.code,
    message: error.message || ERROR_CODES.UNKNOWN_ERROR.message
  }
}
```

---

## 五、性能优化

### 5.1 数据库查询优化

```javascript
// 使用聚合查询优化统计
async function getReimbursementStatsByMonth(month) {
  const { startDate, endDate } = getMonthRange(month)
  
  const result = await db.collection('finance_cost_records')
    .aggregate()
    .match({
      isReimbursement: true,
      date: _.gte(startDate).and(_.lte(endDate)),
      isDeleted: _.neq(true)
    })
    .group({
      _id: '$reimbursement.status',
      count: $.sum(1),
      totalAmount: $.sum('$amount')
    })
    .end()
  
  // 格式化结果
  const stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmount: 0,
    avgAmount: 0
  }
  
  result.list.forEach(item => {
    stats[item._id] = item.count
    if (item._id === 'approved') {
      stats.totalAmount = item.totalAmount
    }
  })
  
  stats.avgAmount = stats.approved > 0 
    ? Math.round(stats.totalAmount / stats.approved) 
    : 0
  
  return stats
}
```

### 5.2 批量操作

```javascript
// 批量审批报销
async function batchApproveReimbursements(event, wxContext) {
  const { reimbursementIds, remark } = event
  
  // 权限检查
  const userInfo = await getUserInfo(wxContext.OPENID)
  if (!isAdmin(userInfo.role)) {
    throw new Error('无权限批量审批')
  }
  
  const now = new Date().toISOString()
  const results = []
  
  // 使用事务批量更新
  for (const id of reimbursementIds) {
    try {
      await db.collection('finance_cost_records')
        .doc(id)
        .update({
          data: {
            'reimbursement.status': 'approved',
            'reimbursement.approver': {
              openid: wxContext.OPENID,
              name: userInfo.nickname,
              role: userInfo.role
            },
            'reimbursement.approvalTime': now,
            updateTime: now
          }
        })
      results.push({ id, success: true })
    } catch (error) {
      results.push({ id, success: false, error: error.message })
    }
  }
  
  return {
    success: true,
    data: {
      total: reimbursementIds.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }
  }
}
```

---

## 六、测试用例

### 6.1 单元测试示例

```javascript
// 测试创建报销申请
describe('创建报销申请', () => {
  test('应该成功创建报销申请', async () => {
    const event = {
      action: 'create_reimbursement',
      data: {
        amount: 280,
        description: '差旅费',
        date: '2024-03-15',
        reimbursementType: 'travel'
      }
    }
    
    const result = await cloudFunction(event)
    expect(result.success).toBe(true)
    expect(result.data.status).toBe('pending')
  })
  
  test('金额为0时应该失败', async () => {
    const event = {
      action: 'create_reimbursement',
      data: {
        amount: 0,
        description: '测试',
        date: '2024-03-15',
        reimbursementType: 'travel'
      }
    }
    
    const result = await cloudFunction(event)
    expect(result.success).toBe(false)
  })
})
```

---

## 七、版本历史

| 版本 | 日期 | 修改内容 | 修改人 |
|------|------|---------|--------|
| v1.0 | 2024-03-15 | 初始版本，完成基础接口设计 | 系统设计 |

---

**相关文档**：
- 报销系统数据库设计文档
- 个人中心功能设计文档
- API调用示例文档


