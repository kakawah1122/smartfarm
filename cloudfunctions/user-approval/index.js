// cloudfunctions/user-approval/index.js
// 用户审批管理云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 引入集合配置
const { COLLECTIONS } = require('./collections.js')

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    // 验证管理员权限
    const hasPermission = await verifyAdminPermission(wxContext.OPENID)
    if (!hasPermission) {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        message: '权限不足，仅管理员可访问'
      }
    }

    switch (action) {
      case 'list_pending_users':
        return await listPendingUsers(event, wxContext)
      case 'get_user_detail':
        return await getUserDetail(event, wxContext)
      case 'approve_user':
        return await approveUser(event, wxContext)
      case 'reject_user':
        return await rejectUser(event, wxContext)
      case 'get_approval_stats':
        return await getApprovalStats(event, wxContext)
      case 'batch_approve':
        return await batchApprove(event, wxContext)
      case 'get_approval_history':
        return await getApprovalHistory(event, wxContext)
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: error.message || '操作失败，请重试',
      errorCode: error.code,
      errorStack: error.stack
    }
  }
}

// 验证管理员权限
async function verifyAdminPermission(openid) {
  try {
    if (!openid) {
      return false
    }

    const userResult = await db.collection(COLLECTIONS.WX_USERS).where({
      _openid: openid
    }).get()

    if (userResult.data.length === 0) {
      return false
    }

    const user = userResult.data[0]
    return user.role === 'super_admin' || user.role === 'manager'
  } catch (error) {
    return false
  }
}

// 获取待审批用户列表
async function listPendingUsers(event, wxContext) {
  const {
    page = 1,
    pageSize = 20,
    approvalStatus = 'pending',
    searchKeyword = null,
    sortBy = 'createTime',
    sortOrder = 'desc'
  } = event

  try {
    let query = db.collection(COLLECTIONS.WX_USERS)
    const where = {}

    // 审批状态筛选
    if (approvalStatus) {
      where.approvalStatus = approvalStatus
    }

    // 搜索功能
    if (searchKeyword) {
      where.$or = [
        { nickname: new RegExp(searchKeyword, 'i') },
        { phone: new RegExp(searchKeyword, 'i') },
        { farmName: new RegExp(searchKeyword, 'i') }
      ]
    }

    if (Object.keys(where).length > 0) {
      query = query.where(where)
    }

    // 排序
    query = query.orderBy(sortBy, sortOrder)

    // 分页查询
    const countResult = await query.count()
    const total = countResult.total

    const users = await query
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    // 处理用户数据，添加邀请信息
    const processedUsers = []
    for (const user of users.data) {
      // 获取邀请信息
      let inviteInfo = null
      if (user.inviteCode) {
        const inviteResult = await db.collection(COLLECTIONS.WX_USER_INVITES)
          .where({ inviteCode: user.inviteCode })
          .get()
        
        if (inviteResult.data.length > 0) {
          inviteInfo = inviteResult.data[0]
        }
      }

      processedUsers.push({
        ...user,
        // 脱敏处理
        phone: user.phone ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}` : '',
        statusText: getApprovalStatusText(user.approvalStatus),
        inviteInfo: inviteInfo ? {
          inviterName: inviteInfo.inviterName,
          department: inviteInfo.department,
          position: inviteInfo.position,
          createTime: inviteInfo.createTime
        } : null,
        // 计算等待时间
        waitingDays: user.createTime ? 
          Math.ceil((new Date() - new Date(user.createTime)) / (24 * 60 * 60 * 1000)) : 0
      })
    }

    return {
      success: true,
      data: {
        users: processedUsers,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    }
  } catch (error) {
    throw error
  }
}

// 获取用户详情
async function getUserDetail(event, wxContext) {
  const { userId } = event

  try {
    if (!userId) {
      throw new Error('缺少用户ID')
    }

    // 获取用户信息
    const user = await db.collection(COLLECTIONS.WX_USERS).doc(userId).get()
    if (!user.data) {
      throw new Error('用户不存在')
    }

    const userData = user.data

    // 获取邀请信息
    let inviteInfo = null
    if (userData.inviteCode) {
      const inviteResult = await db.collection(COLLECTIONS.WX_USER_INVITES)
        .where({ inviteCode: userData.inviteCode })
        .get()
      
      if (inviteResult.data.length > 0) {
        inviteInfo = inviteResult.data[0]
      }
    }

    // 获取用户的业务数据统计
    const [healthRecords, entryRecords, exitRecords] = await Promise.all([
      db.collection(COLLECTIONS.HEALTH_RECORDS).where({ userId: userData._openid }).count(),
      db.collection(COLLECTIONS.PROD_BATCH_ENTRIES).where({ userId: userData._openid }).count(),
      db.collection(COLLECTIONS.PROD_BATCH_EXITS).where({ userId: userData._openid }).count()
    ])

    return {
      success: true,
      data: {
        user: {
          ...userData,
          // 保留完整信息供审批参考，但标记为审批专用
          statusText: getApprovalStatusText(userData.approvalStatus),
          waitingDays: userData.createTime ? 
            Math.ceil((new Date() - new Date(userData.createTime)) / (24 * 60 * 60 * 1000)) : 0
        },
        inviteInfo: inviteInfo,
        businessStats: {
          healthRecords: healthRecords.total,
          entryRecords: entryRecords.total,
          exitRecords: exitRecords.total
        }
      }
    }
  } catch (error) {
    throw error
  }
}

// 批准用户
async function approveUser(event, wxContext) {
  const { userId, approvalRemark = '', assignedRole = null } = event

  try {
    if (!userId) {
      throw new Error('缺少用户ID')
    }

    // 检查用户是否存在
    const user = await db.collection(COLLECTIONS.WX_USERS).doc(userId).get()
    if (!user.data) {
      throw new Error('用户不存在')
    }

    if (user.data.approvalStatus === 'approved') {
      throw new Error('用户已经通过审批')
    }

    // 获取审批人信息
    const approverResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: wxContext.OPENID })
      .get()

    const approver = approverResult.data[0]

    // 更新用户状态
    const updateData = {
      approvalStatus: 'approved',
      approvedBy: wxContext.OPENID,
      approvedTime: new Date(),
      approvalRemark: approvalRemark,
      isActive: true
    }

    // 如果指定了角色，更新角色
    if (assignedRole) {
      updateData.role = assignedRole
    }

    await db.collection(COLLECTIONS.WX_USERS).doc(userId).update({
      data: updateData
    })

    // 记录审批日志
    await db.collection(COLLECTIONS.SYS_APPROVAL_LOGS).add({
      data: {
        action: 'approve',
        targetUserId: userId,
        targetUserInfo: {
          nickname: user.data.nickname,
          phone: user.data.phone
        },
        operatorId: wxContext.OPENID,
        operatorName: approver.nickname || '管理员',
        remark: approvalRemark,
        assignedRole: assignedRole,
        createTime: new Date()
      }
    })

    return {
      success: true,
      message: '用户审批通过'
    }
  } catch (error) {
    throw error
  }
}

// 拒绝用户
async function rejectUser(event, wxContext) {
  const { userId, rejectedReason } = event

  try {
    if (!userId) {
      throw new Error('缺少用户ID')
    }

    if (!rejectedReason || rejectedReason.trim() === '') {
      throw new Error('请填写拒绝原因')
    }

    // 检查用户是否存在
    const user = await db.collection(COLLECTIONS.WX_USERS).doc(userId).get()
    if (!user.data) {
      throw new Error('用户不存在')
    }

    if (user.data.approvalStatus === 'approved') {
      throw new Error('已通过审批的用户无法拒绝')
    }

    // 获取审批人信息
    const approverResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: wxContext.OPENID })
      .get()

    const approver = approverResult.data[0]

    // 更新用户状态
    await db.collection(COLLECTIONS.WX_USERS).doc(userId).update({
      data: {
        approvalStatus: 'rejected',
        rejectedBy: wxContext.OPENID,
        rejectedTime: new Date(),
        rejectedReason: rejectedReason.trim(),
        isActive: false
      }
    })

    // 记录审批日志
    await db.collection(COLLECTIONS.SYS_APPROVAL_LOGS).add({
      data: {
        action: 'reject',
        targetUserId: userId,
        targetUserInfo: {
          nickname: user.data.nickname,
          phone: user.data.phone
        },
        operatorId: wxContext.OPENID,
        operatorName: approver.nickname || '管理员',
        remark: rejectedReason.trim(),
        createTime: new Date()
      }
    })

    return {
      success: true,
      message: '用户审批已拒绝'
    }
  } catch (error) {
    throw error
  }
}

// 获取审批统计
async function getApprovalStats(event, wxContext) {
  try {
    const [
      totalUsers,
      pendingUsers,
      approvedUsers,
      rejectedUsers
    ] = await Promise.all([
      db.collection(COLLECTIONS.WX_USERS).count(),
      db.collection(COLLECTIONS.WX_USERS).where({ approvalStatus: 'pending' }).count(),
      db.collection(COLLECTIONS.WX_USERS).where({ approvalStatus: 'approved' }).count(),
      db.collection(COLLECTIONS.WX_USERS).where({ approvalStatus: 'rejected' }).count()
    ])

    // 获取最近7天的注册统计
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentRegistrations = await db.collection(COLLECTIONS.WX_USERS)
      .where({
        createTime: _.gte(sevenDaysAgo)
      })
      .get()

    // 获取最近7天的审批统计
    const recentApprovals = await db.collection(COLLECTIONS.SYS_APPROVAL_LOGS)
      .where({
        createTime: _.gte(sevenDaysAgo)
      })
      .get()

    return {
      success: true,
      data: {
        total: totalUsers.total,
        pending: pendingUsers.total,
        approved: approvedUsers.total,
        rejected: rejectedUsers.total,
        recentRegistrations: recentRegistrations.data.length,
        recentApprovals: recentApprovals.data.length,
        approvalRate: totalUsers.total > 0 ? 
          ((approvedUsers.total / totalUsers.total) * 100).toFixed(1) : '0.0'
      }
    }
  } catch (error) {
    throw error
  }
}

// 批量审批
async function batchApprove(event, wxContext) {
  const { userIds, action, remark = '', assignedRole = null } = event

  try {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('缺少用户ID列表')
    }

    if (action !== 'approve' && action !== 'reject') {
      throw new Error('无效的批量操作类型')
    }

    if (action === 'reject' && (!remark || remark.trim() === '')) {
      throw new Error('批量拒绝需要填写原因')
    }

    const results = []
    const errors = []

    // 获取审批人信息
    const approverResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: wxContext.OPENID })
      .get()

    const approver = approverResult.data[0]

    for (const userId of userIds) {
      try {
        if (action === 'approve') {
          await approveUser({ userId, approvalRemark: remark, assignedRole }, wxContext)
          results.push({ userId, success: true })
        } else {
          await rejectUser({ userId, rejectedReason: remark }, wxContext)
          results.push({ userId, success: true })
        }
      } catch (error) {
        errors.push({ userId, error: error.message })
      }
    }

    return {
      success: true,
      data: {
        results,
        errors,
        successCount: results.length,
        errorCount: errors.length
      },
      message: `批量${action === 'approve' ? '批准' : '拒绝'}完成，成功${results.length}个，失败${errors.length}个`
    }
  } catch (error) {
    throw error
  }
}

// 获取审批历史
async function getApprovalHistory(event, wxContext) {
  const {
    page = 1,
    pageSize = 20,
    action = null,
    dateRange = null
  } = event

  try {
    let query = db.collection(COLLECTIONS.SYS_APPROVAL_LOGS)
    const where = {}

    if (action) {
      where.action = action
    }

    if (dateRange && dateRange.start && dateRange.end) {
      where.createTime = _.gte(new Date(dateRange.start)).and(_.lte(new Date(dateRange.end)))
    }

    if (Object.keys(where).length > 0) {
      query = query.where(where)
    }

    // 排序
    query = query.orderBy('createTime', 'desc')

    // 分页查询
    const countResult = await query.count()
    const total = countResult.total

    const logs = await query
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return {
      success: true,
      data: {
        logs: logs.data,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    }
  } catch (error) {
    throw error
  }
}

// 获取审批状态文本
function getApprovalStatusText(status) {
  const statusMap = {
    'pending': '待审批',
    'approved': '已审批',
    'rejected': '已拒绝'
  }
  return statusMap[status] || '未知状态'
}
