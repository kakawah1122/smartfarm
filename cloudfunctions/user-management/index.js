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
    // 对于更新个人资料，允许用户修改自己的信息
    if (action === 'update_profile') {
      const hasPermission = await verifyUserPermission(wxContext.OPENID, event.targetUserId)
      if (!hasPermission) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: '权限不足，您只能修改自己的资料'
        }
      }
    } else {
      // 其他操作需要管理员权限
      const hasPermission = await verifyAdminPermission(wxContext.OPENID)
      if (!hasPermission) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: '权限不足，仅管理员可访问'
        }
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
      case 'set_super_admin':
        return await setSuperAdmin(event, wxContext)
      case 'update_profile':
        return await updateProfile(event, wxContext)
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

// 验证用户权限（用户可以修改自己的资料）
async function verifyUserPermission(openid, targetUserId) {
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
    
    // 如果是管理员，有权限修改任何用户
    if (user.isSuper === true || user.role === 'admin' || user.role === 'manager' || user.role === 'operator') {
      return true
    }
    
    // 如果没有指定目标用户ID，说明是修改自己的资料
    if (!targetUserId) {
      return true
    }
    
    // 用户只能修改自己的资料
    return user._id === targetUserId
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

// 设置超级管理员
async function setSuperAdmin(event, wxContext) {
  try {
    // 检查当前用户是否存在
    const currentUser = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get()

    if (currentUser.data.length === 0) {
      throw new Error('用户不存在')
    }

    const user = currentUser.data[0]
    
    // 检查用户是否已经是管理员或超级管理员
    if (user.role !== 'admin' && !user.isSuper) {
      throw new Error('只有管理员才能设置为超级管理员')
    }

    // 如果已经是超级管理员，直接返回成功
    if (user.isSuper === true) {
      return {
        success: true,
        message: '您已经是超级管理员',
        data: {
          user: user
        }
      }
    }

    // 更新用户为超级管理员
    await db.collection('users').doc(user._id).update({
      data: {
        isSuper: true,
        role: 'admin', // 确保角色是管理员
        superAdminSetTime: new Date(),
        updateTime: new Date()
      }
    })

    // 记录操作日志
    await db.collection('admin_logs').add({
      data: {
        action: 'set_super_admin',
        operatorId: wxContext.OPENID,
        targetUserId: user._id,
        createTime: new Date(),
        description: '用户设置为超级管理员'
      }
    })

    // 获取更新后的用户信息
    const updatedUser = await db.collection('users').doc(user._id).get()

    return {
      success: true,
      message: '已成功设置为超级管理员',
      data: {
        user: updatedUser.data
      }
    }
  } catch (error) {
    throw error
  }
}

// 更新用户个人资料
async function updateProfile(event, wxContext) {
  try {
    const {
      nickname,
      avatarUrl,
      farmName,
      phone,
      department,
      position,
      targetUserId
    } = event

    // 获取要更新的用户信息
    let user
    if (targetUserId) {
      // 更新其他用户（管理员操作）
      const targetUser = await db.collection('users').doc(targetUserId).get()
      if (!targetUser.data) {
        throw new Error('目标用户不存在')
      }
      user = targetUser.data
    } else {
      // 更新自己的信息
      const currentUser = await db.collection('users').where({
        _openid: wxContext.OPENID
      }).get()

      if (currentUser.data.length === 0) {
        throw new Error('用户不存在')
      }
      user = currentUser.data[0]
    }
    
    // 准备更新数据
    const updateData = {
      updateTime: new Date()
    }

    // 只更新提供的字段
    if (nickname !== undefined && nickname !== null) {
      updateData.nickname = nickname.trim()
    }
    
    if (avatarUrl !== undefined && avatarUrl !== null) {
      updateData.avatarUrl = avatarUrl
    }
    
    if (farmName !== undefined && farmName !== null) {
      updateData.farmName = farmName.trim()
    }
    
    if (department !== undefined && department !== null) {
      updateData.department = department.trim()
    }
    
    if (position !== undefined && position !== null) {
      updateData.position = position.trim()
    }
    
    if (phone !== undefined && phone !== null) {
      // 验证手机号格式
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(phone)) {
        throw new Error('手机号格式不正确')
      }
      updateData.phone = phone.trim()
    }

    // 更新用户信息
    await db.collection('users').doc(user._id).update({
      data: updateData
    })

    // 记录操作日志
    await db.collection('admin_logs').add({
      data: {
        action: 'update_profile',
        operatorId: wxContext.OPENID,
        targetUserId: user._id,
        updateFields: Object.keys(updateData),
        createTime: new Date(),
        description: targetUserId ? '管理员更新用户资料' : '用户更新个人资料'
      }
    })

    // 获取更新后的用户信息
    const updatedUser = await db.collection('users').doc(user._id).get()

    return {
      success: true,
      message: '个人资料更新成功',
      data: {
        user: updatedUser.data
      }
    }
  } catch (error) {
    throw error
  }
}
