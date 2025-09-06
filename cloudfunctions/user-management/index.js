// cloudfunctions/user-management/index.js
// 用户管理云函数 - 管理员专用
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
    // 首先验证管理员权限
    const hasPermission = await verifyAdminPermission(wxContext.OPENID)
    if (!hasPermission) {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        message: '权限不足，仅管理员可访问'
      }
    }

    switch (action) {
      case 'list_users':
        return await listUsers(event, wxContext)
      case 'get_user_detail':
        return await getUserDetail(event, wxContext)
      case 'update_user_role':
        return await updateUserRole(event, wxContext)
      case 'toggle_user_status':
        return await toggleUserStatus(event, wxContext)
      case 'get_user_stats':
        return await getUserStats(event, wxContext)
      case 'search_users':
        return await searchUsers(event, wxContext)
      case 'export_users':
        return await exportUsers(event, wxContext)
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

    // 查询用户信息
    const userResult = await db.collection('users').where({
      _openid: openid
    }).get()

    if (userResult.data.length === 0) {
      return false
    }

    const user = userResult.data[0]
    
    // 检查是否为超级管理员或管理员（包含operator角色）
    return user.isSuper === true || user.role === 'admin' || user.role === 'manager' || user.role === 'operator'
  } catch (error) {
    return false
  }
}

// 获取用户列表
async function listUsers(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 20, 
    role = null,
    status = null,
    sortBy = 'createTime',
    sortOrder = 'desc'
  } = event

  try {
    // 构建查询条件
    let query = db.collection('users')
    const where = {}

    if (role) {
      where.role = role
    }

    if (status !== null) {
      where.status = status
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

    // 清理敏感信息（保留管理需要的信息）
    const cleanedUsers = users.data.map(user => ({
      _id: user._id,
      _openid: user._openid,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      phone: user.phone ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}` : '', // 手机号脱敏
      role: user.role,
      farmName: user.farmName,
      isSuper: user.isSuper,
      status: user.status || 'active',
      createTime: user.createTime,
      lastLoginTime: user.lastLoginTime,
      loginCount: user.loginCount || 0
    }))

    return {
      success: true,
      data: {
        users: cleanedUsers,
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

    const user = await db.collection('users').doc(userId).get()
    if (!user.data) {
      throw new Error('用户不存在')
    }

    // 获取用户相关的业务数据统计
    const [healthRecords, entryRecords, exitRecords] = await Promise.all([
      // 健康记录数量
      db.collection('health_records').where({
        userId: user.data._openid
      }).count(),
      
      // 入栏记录数量
      db.collection('entry_records').where({
        userId: user.data._openid
      }).count(),
      
      // 出栏记录数量
      db.collection('exit_records').where({
        userId: user.data._openid
      }).count()
    ])

    // 清理并返回详细信息
    const userDetail = {
      ...user.data,
      phone: user.data.phone ? `${user.data.phone.slice(0, 3)}****${user.data.phone.slice(-4)}` : '',
      stats: {
        healthRecords: healthRecords.total,
        entryRecords: entryRecords.total,
        exitRecords: exitRecords.total
      }
    }

    return {
      success: true,
      data: {
        user: userDetail
      }
    }
  } catch (error) {
    throw error
  }
}

// 更新用户角色
async function updateUserRole(event, wxContext) {
  const { userId, newRole, reason } = event

  try {
    if (!userId || !newRole) {
      throw new Error('缺少必填参数')
    }

    // 验证角色值
    const validRoles = ['user', 'admin', 'manager', 'operator']
    if (!validRoles.includes(newRole)) {
      throw new Error('无效的角色类型')
    }

    // 检查目标用户是否存在
    const user = await db.collection('users').doc(userId).get()
    if (!user.data) {
      throw new Error('目标用户不存在')
    }

    // 更新用户角色
    await db.collection('users').doc(userId).update({
      data: {
        role: newRole,
        roleUpdateTime: new Date(),
        roleUpdateBy: wxContext.OPENID,
        roleUpdateReason: reason || ''
      }
    })

    // 记录操作日志（可选）
    await db.collection('admin_logs').add({
      data: {
        action: 'update_user_role',
        operatorId: wxContext.OPENID,
        targetUserId: userId,
        oldRole: user.data.role,
        newRole: newRole,
        reason: reason || '',
        createTime: new Date()
      }
    })

    return {
      success: true,
      message: '用户角色更新成功'
    }
  } catch (error) {
    throw error
  }
}

// 切换用户状态（启用/禁用）
async function toggleUserStatus(event, wxContext) {
  const { userId, status, reason } = event

  try {
    if (!userId || !status) {
      throw new Error('缺少必填参数')
    }

    const validStatuses = ['active', 'disabled', 'suspended']
    if (!validStatuses.includes(status)) {
      throw new Error('无效的状态类型')
    }

    const user = await db.collection('users').doc(userId).get()
    if (!user.data) {
      throw new Error('目标用户不存在')
    }

    await db.collection('users').doc(userId).update({
      data: {
        status: status,
        statusUpdateTime: new Date(),
        statusUpdateBy: wxContext.OPENID,
        statusUpdateReason: reason || ''
      }
    })

    // 记录操作日志
    await db.collection('admin_logs').add({
      data: {
        action: 'toggle_user_status',
        operatorId: wxContext.OPENID,
        targetUserId: userId,
        oldStatus: user.data.status || 'active',
        newStatus: status,
        reason: reason || '',
        createTime: new Date()
      }
    })

    return {
      success: true,
      message: '用户状态更新成功'
    }
  } catch (error) {
    throw error
  }
}

// 获取用户统计信息
async function getUserStats(event, wxContext) {
  try {
    // 获取用户总数和角色分布
    const [allUsers, adminUsers, activeUsers] = await Promise.all([
      db.collection('users').count(),
      db.collection('users').where({
        role: db.command.in(['admin', 'manager'])
      }).count(),
      db.collection('users').where({
        status: db.command.eq('active')
      }).count()
    ])

    // 获取最近登录统计
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentActiveUsers = await db.collection('users').where({
      lastLoginTime: db.command.gte(thirtyDaysAgo)
    }).count()

    // 获取角色分布
    const roleStats = await db.collection('users').aggregate()
      .group({
        _id: '$role',
        count: { $sum: 1 }
      })
      .end()

    return {
      success: true,
      data: {
        totalUsers: allUsers.total,
        adminUsers: adminUsers.total,
        activeUsers: activeUsers.total,
        recentActiveUsers: recentActiveUsers.total,
        roleDistribution: roleStats.list,
        inactiveUsers: allUsers.total - activeUsers.total
      }
    }
  } catch (error) {
    throw error
  }
}

// 搜索用户
async function searchUsers(event, wxContext) {
  const { keyword, searchType = 'all', page = 1, pageSize = 10 } = event

  try {
    if (!keyword || keyword.trim() === '') {
      throw new Error('搜索关键词不能为空')
    }

    let query = db.collection('users')
    
    // 根据搜索类型构建查询条件
    switch (searchType) {
      case 'nickname':
        query = query.where({
          nickname: new RegExp(keyword, 'i')
        })
        break
      case 'farmName':
        query = query.where({
          farmName: new RegExp(keyword, 'i')
        })
        break
      case 'phone':
        // 手机号搜索需要精确匹配（出于安全考虑）
        query = query.where({
          phone: keyword
        })
        break
      default:
        // 全文搜索
        query = query.where(
          db.command.or([
            {
              nickname: new RegExp(keyword, 'i')
            },
            {
              farmName: new RegExp(keyword, 'i')
            }
          ])
        )
    }

    const countResult = await query.count()
    const users = await query
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const cleanedUsers = users.data.map(user => ({
      _id: user._id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      farmName: user.farmName,
      role: user.role,
      status: user.status || 'active',
      createTime: user.createTime,
      lastLoginTime: user.lastLoginTime
    }))

    return {
      success: true,
      data: {
        users: cleanedUsers,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    }
  } catch (error) {
    throw error
  }
}

// 导出用户数据（简化版）
async function exportUsers(event, wxContext) {
  try {
    const users = await db.collection('users')
      .orderBy('createTime', 'desc')
      .get()

    const exportData = users.data.map(user => ({
      用户ID: user._id,
      昵称: user.nickname,
      农场名称: user.farmName,
      角色: user.role,
      状态: user.status || 'active',
      注册时间: user.createTime ? new Date(user.createTime).toLocaleString() : '',
      最后登录: user.lastLoginTime ? new Date(user.lastLoginTime).toLocaleString() : '',
      登录次数: user.loginCount || 0
    }))

    return {
      success: true,
      data: {
        users: exportData,
        exportTime: new Date().toISOString(),
        total: exportData.length
      }
    }
  } catch (error) {
    throw error
  }
}
