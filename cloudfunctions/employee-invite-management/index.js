// cloudfunctions/employee-invite-management/index.js
// 员工邀请管理云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 生成邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 生成唯一邀请码
async function generateUniqueInviteCode() {
  let inviteCode = ''
  let isUnique = false
  let attempts = 0
  
  while (!isUnique && attempts < 10) {
    inviteCode = generateInviteCode()
    
    // 检查是否已存在
    const existingInvite = await db.collection('employee_invites')
      .where({ inviteCode: inviteCode })
      .get()
    
    if (existingInvite.data.length === 0) {
      isUnique = true
    }
    attempts++
  }
  
  if (!isUnique) {
    throw new Error('生成邀请码失败，请重试')
  }
  
  return inviteCode
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    // 验证管理员权限
    const hasPermission = await verifyAdminPermission(wxContext.OPENID)
    if (!hasPermission && action !== 'validate_invite' && action !== 'use_invite') {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        message: '权限不足，仅管理员可访问'
      }
    }

    switch (action) {
      case 'create_invite':
        return await createInvite(event, wxContext)
      case 'list_invites':
        return await listInvites(event, wxContext)
      case 'revoke_invite':
        return await revokeInvite(event, wxContext)
      case 'validate_invite':
        return await validateInvite(event, wxContext)
      case 'use_invite':
        return await useInvite(event, wxContext)
      case 'get_invite_stats':
        return await getInviteStats(event, wxContext)
      case 'resend_invite':
        return await resendInvite(event, wxContext)
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

    const userResult = await db.collection('users').where({
      _openid: openid
    }).get()

    if (userResult.data.length === 0) {
      return false
    }

    const user = userResult.data[0]
    return user.isSuper === true || user.role === 'admin' || user.role === 'manager' || user.role === 'operator'
  } catch (error) {
    return false
  }
}

// 创建邀请
async function createInvite(event, wxContext) {
  const {
    inviteeName,
    inviteePhone,
    department,
    position,
    role = 'user',
    remark = '',
    expiryDays = 7
  } = event

  try {
    // 数据验证
    if (!inviteeName || !inviteePhone) {
      throw new Error('缺少必填字段：姓名和手机号')
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(inviteePhone)) {
      throw new Error('手机号格式不正确')
    }

    // 检查是否已有未使用的邀请
    const existingInvites = await db.collection('employee_invites')
      .where({
        inviteePhone: inviteePhone,
        status: _.in(['pending', 'used'])
      })
      .get()

    if (existingInvites.data.length > 0) {
      const existingInvite = existingInvites.data[0]
      if (existingInvite.status === 'pending') {
        throw new Error('该手机号已有待使用的邀请')
      } else if (existingInvite.status === 'used') {
        throw new Error('该手机号已被邀请并注册')
      }
    }

    // 检查用户是否已注册
    const existingUsers = await db.collection('users')
      .where({ phone: inviteePhone })
      .get()

    if (existingUsers.data.length > 0) {
      throw new Error('该手机号用户已存在')
    }

    // 获取邀请人信息
    const inviterResult = await db.collection('users')
      .where({ _openid: wxContext.OPENID })
      .get()

    if (inviterResult.data.length === 0) {
      throw new Error('邀请人信息不存在')
    }

    const inviter = inviterResult.data[0]
    
    // 生成邀请码
    const inviteCode = await generateUniqueInviteCode()
    
    // 计算过期时间
    const now = new Date()
    const expiryTime = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000)

    // 创建邀请记录
    const inviteData = {
      inviteCode: inviteCode,
      inviterOpenId: wxContext.OPENID,
      inviterName: inviter.nickname || '管理员',
      inviteeName: inviteeName,
      inviteePhone: inviteePhone,
      department: department || '',
      position: position || '',
      role: role,
      status: 'pending',
      createTime: now,
      expiryTime: expiryTime,
      usedTime: null,
      usedByOpenId: null,
      remark: remark
    }

    const result = await db.collection('employee_invites').add({
      data: inviteData
    })

    return {
      success: true,
      data: {
        inviteId: result._id,
        inviteCode: inviteCode,
        ...inviteData
      },
      message: '邀请创建成功'
    }
  } catch (error) {
    throw error
  }
}

// 获取邀请列表
async function listInvites(event, wxContext) {
  const {
    page = 1,
    pageSize = 20,
    status = null,
    searchKeyword = null,
    sortBy = 'createTime',
    sortOrder = 'desc'
  } = event

  try {
    let query = db.collection('employee_invites')
    const where = {}

    // 状态筛选
    if (status) {
      where.status = status
    }

    // 搜索功能
    if (searchKeyword) {
      where.$or = [
        { inviteeName: new RegExp(searchKeyword, 'i') },
        { inviteePhone: new RegExp(searchKeyword, 'i') },
        { inviteCode: new RegExp(searchKeyword, 'i') }
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

    const invites = await query
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    // 处理数据，添加状态描述
    const processedInvites = invites.data.map(invite => ({
      ...invite,
      statusText: getStatusText(invite.status),
      isExpired: invite.status === 'pending' && new Date() > new Date(invite.expiryTime),
      remainingDays: invite.status === 'pending' ? 
        Math.max(0, Math.ceil((new Date(invite.expiryTime) - new Date()) / (24 * 60 * 60 * 1000))) : 0
    }))

    return {
      success: true,
      data: {
        invites: processedInvites,
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

// 撤销邀请
async function revokeInvite(event, wxContext) {
  const { inviteId, reason = '' } = event

  try {
    if (!inviteId) {
      throw new Error('缺少邀请ID')
    }

    // 检查邀请是否存在
    const invite = await db.collection('employee_invites').doc(inviteId).get()
    if (!invite.data) {
      throw new Error('邀请不存在')
    }

    if (invite.data.status !== 'pending') {
      throw new Error('只能撤销待使用的邀请')
    }

    // 更新邀请状态
    await db.collection('employee_invites').doc(inviteId).update({
      data: {
        status: 'revoked',
        revokedTime: new Date(),
        revokedBy: wxContext.OPENID,
        revokedReason: reason
      }
    })

    return {
      success: true,
      message: '邀请已撤销'
    }
  } catch (error) {
    throw error
  }
}

// 验证邀请码
async function validateInvite(event, wxContext) {
  const { inviteCode } = event

  try {
    if (!inviteCode) {
      throw new Error('缺少邀请码')
    }

    // 查找邀请记录
    const inviteResult = await db.collection('employee_invites')
      .where({ inviteCode: inviteCode.toUpperCase() })
      .get()

    if (inviteResult.data.length === 0) {
      return {
        success: false,
        error: 'INVITE_NOT_FOUND',
        message: '邀请码不存在'
      }
    }

    const invite = inviteResult.data[0]

    // 检查邀请状态
    if (invite.status === 'used') {
      return {
        success: false,
        error: 'INVITE_USED',
        message: '邀请码已被使用'
      }
    }

    if (invite.status === 'revoked') {
      return {
        success: false,
        error: 'INVITE_REVOKED',
        message: '邀请码已被撤销'
      }
    }

    if (invite.status === 'expired') {
      return {
        success: false,
        error: 'INVITE_EXPIRED',
        message: '邀请码已过期'
      }
    }

    // 检查是否过期
    if (new Date() > new Date(invite.expiryTime)) {
      // 自动标记为过期
      await db.collection('employee_invites').doc(invite._id).update({
        data: { status: 'expired' }
      })

      return {
        success: false,
        error: 'INVITE_EXPIRED',
        message: '邀请码已过期'
      }
    }

    return {
      success: true,
      data: {
        invite: {
          ...invite,
          // 不返回敏感信息
          inviterOpenId: undefined
        }
      },
      message: '邀请码有效'
    }
  } catch (error) {
    throw error
  }
}

// 使用邀请码（注册时调用）
async function useInvite(event, wxContext) {
  const { inviteCode } = event

  try {
    if (!inviteCode) {
      throw new Error('缺少邀请码')
    }

    // 验证邀请码
    const validateResult = await validateInvite({ inviteCode }, wxContext)
    if (!validateResult.success) {
      return validateResult
    }

    const invite = validateResult.data.invite

    // 标记邀请码为已使用
    await db.collection('employee_invites').doc(invite._id).update({
      data: {
        status: 'used',
        usedTime: new Date(),
        usedByOpenId: wxContext.OPENID
      }
    })

    return {
      success: true,
      data: {
        invite: invite
      },
      message: '邀请码使用成功'
    }
  } catch (error) {
    throw error
  }
}

// 获取邀请统计
async function getInviteStats(event, wxContext) {
  try {
    const [
      totalInvites,
      pendingInvites,
      usedInvites,
      revokedInvites,
      expiredInvites
    ] = await Promise.all([
      db.collection('employee_invites').count(),
      db.collection('employee_invites').where({ status: 'pending' }).count(),
      db.collection('employee_invites').where({ status: 'used' }).count(),
      db.collection('employee_invites').where({ status: 'revoked' }).count(),
      db.collection('employee_invites').where({ status: 'expired' }).count()
    ])

    // 获取最近7天的邀请统计
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentInvites = await db.collection('employee_invites')
      .where({
        createTime: _.gte(sevenDaysAgo)
      })
      .get()

    return {
      success: true,
      data: {
        total: totalInvites.total,
        pending: pendingInvites.total,
        used: usedInvites.total,
        revoked: revokedInvites.total,
        expired: expiredInvites.total,
        recentCount: recentInvites.data.length,
        usageRate: totalInvites.total > 0 ? 
          ((usedInvites.total / totalInvites.total) * 100).toFixed(1) : '0.0'
      }
    }
  } catch (error) {
    throw error
  }
}

// 重新发送邀请（延长有效期）
async function resendInvite(event, wxContext) {
  const { inviteId, expiryDays = 7 } = event

  try {
    if (!inviteId) {
      throw new Error('缺少邀请ID')
    }

    // 检查邀请是否存在
    const invite = await db.collection('employee_invites').doc(inviteId).get()
    if (!invite.data) {
      throw new Error('邀请不存在')
    }

    if (invite.data.status !== 'pending') {
      throw new Error('只能重新发送待使用的邀请')
    }

    // 延长有效期
    const newExpiryTime = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

    await db.collection('employee_invites').doc(inviteId).update({
      data: {
        expiryTime: newExpiryTime,
        lastResendTime: new Date()
      }
    })

    return {
      success: true,
      message: '邀请已重新发送'
    }
  } catch (error) {
    throw error
  }
}

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    'pending': '待使用',
    'used': '已使用',
    'expired': '已过期',
    'revoked': '已撤销'
  }
  return statusMap[status] || '未知状态'
}
