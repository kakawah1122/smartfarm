// user-management/index.js - 用户管理和权限控制云函数
const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 角色代码常量（用于代码中引用）
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee', 
  VETERINARIAN: 'veterinarian'
}

// 角色缓存（从数据库加载）
let rolesCache = null
let rolesCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

// 从数据库加载角色配置
async function loadRolesFromDB() {
  const now = Date.now()
  if (rolesCache && (now - rolesCacheTime) < CACHE_TTL) {
    return rolesCache
  }
  
  try {
    const result = await db.collection(COLLECTIONS.USER_ROLES)
      .where({ isActive: true })
      .get()
    
    if (result.data && result.data.length > 0) {
      rolesCache = {}
      result.data.forEach(role => {
        rolesCache[role.code || role._id] = {
          code: role.code || role._id,
          name: role.name,
          description: role.description,
          level: role.level,
          permissions: role.permissions || []
        }
      })
      rolesCacheTime = now
      return rolesCache
    }
  } catch (err) {
    console.error('从数据库加载角色失败，使用默认配置:', err.message)
  }
  
  // 回退到默认配置
  return getDefaultRoles()
}

// 默认角色配置（作为回退）
function getDefaultRoles() {
  return {
    [ROLES.SUPER_ADMIN]: {
      code: 'super_admin',
      name: '超级管理员',
      description: '系统全局管理权限，可管理所有功能和用户',
      level: 1,
      permissions: ['*']
    },
    [ROLES.MANAGER]: {
      code: 'manager',
      name: '经理',
      description: '业务运营管理权限，负责整体运营和决策',
      level: 2,
      permissions: ['production.*', 'health.*', 'finance.*', 'ai_diagnosis.*', 'user.read', 'user.invite', 'user.update_role', 'user.approve']
    },
    [ROLES.EMPLOYEE]: {
      code: 'employee',
      name: '员工',
      description: '日常操作执行权限，包括AI诊断功能',
      level: 3,
      permissions: ['production.create', 'production.read', 'production.update_own', 'health.create', 'health.read', 'health.update_own', 'ai_diagnosis.create', 'ai_diagnosis.read', 'ai_diagnosis.validate', 'user.read_own']
    },
    [ROLES.VETERINARIAN]: {
      code: 'veterinarian', 
      name: '兽医',
      description: '健康诊疗专业权限，负责动物健康和AI诊断验证',
      level: 3,
      permissions: ['health.*', 'ai_diagnosis.*', 'production.read', 'user.read_own']
    }
  }
}

// 验证角色是否有效
async function validateRole(roleCode) {
  const roles = await loadRolesFromDB()
  return !!roles[roleCode]
}

// 检查权限
async function hasPermission(userRole, permission) {
  const roles = await loadRolesFromDB()
  const roleInfo = roles[userRole]
  if (!roleInfo) return false
  if (roleInfo.permissions.includes('*')) return true
  return roleInfo.permissions.includes(permission)
}

// 检查权限（异步版本，从数据库读取）
async function checkPermission(userRole, requiredPermission) {
  const roles = await loadRolesFromDB()
  const roleInfo = roles[userRole]
  if (!roleInfo) return false
  
  const permissions = roleInfo.permissions || []
  
  // 超级管理员拥有所有权限
  if (permissions.includes('*')) return true
  
  // 检查具体权限
  return permissions.some(perm => {
    if (perm === requiredPermission) return true
    // 支持通配符权限，如 'production.*'
    if (perm.endsWith('.*')) {
      const prefix = perm.slice(0, -2)
      return requiredPermission.startsWith(prefix + '.')
    }
    return false
  })
}

// 验证用户是否为管理员
async function validateAdminPermission(openid) {
  try {
    const user = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: openid }).get()
    if (user.data.length === 0) return false
    
    const userRole = user.data[0].role || 'employee'
    return ['super_admin', 'manager'].includes(userRole)
  } catch (error) {
    return false
  }
}

// 生成邀请码（6位，更专业）
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
    const existingInvite = await db.collection(COLLECTIONS.WX_USER_INVITES)
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

// 清理旧的邀请记录，只保留最新的5个
async function cleanupOldInvites() {
  try {
    // 已移除调试日志
    // 获取所有邀请记录，按创建时间倒序排列
    const allInvites = await db.collection(COLLECTIONS.WX_USER_INVITES)
      .orderBy('createTime', 'desc')
      .get()

    // 已移除调试日志
    // 如果总数超过5个，删除多余的记录
    if (allInvites.data.length > 5) {
      // 保留前5个最新的，删除其余的
      const invitesToDelete = allInvites.data.slice(5)
      // 已移除调试日志
      // 批量删除
      for (const invite of invitesToDelete) {
        await db.collection(COLLECTIONS.WX_USER_INVITES).doc(invite._id).remove()
        // 已移除调试日志
      }

      // 已移除调试日志
    } else {
      // 已移除调试日志
    }
  } catch (error) {
    // 已移除调试日志
    // 清理失败不影响主流程，只记录错误
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      // 用户管理
      case 'get_user_info':
        return await getUserInfo(event, wxContext)
      case 'get_user_by_openid':
        return await getUserByOpenId(event, wxContext)
      case 'update_user_profile':
      case 'update_profile': // 兼容旧版本调用
        return await updateUserProfile(event, wxContext)
      case 'list_users':
        return await listUsers(event, wxContext)
      case 'get_user_stats':
        return await getUserStats(event, wxContext)
      case 'update_user_role':
        return await updateUserRole(event, wxContext)
      case 'delete_user':
        return await deleteUser(event, wxContext)
      case 'deactivate_user':
        return await deactivateUser(event, wxContext)
      
      // 邀请管理
      case 'create_invite':
        return await createInvite(event, wxContext)
      case 'list_invites':
        return await listInvites(event, wxContext)
      case 'use_invite':
        return await useInvite(event, wxContext)
      case 'revoke_invite':
        return await revokeInvite(event, wxContext)
      case 'validate_invite':
        return await validateInvite(event, wxContext)
      case 'get_invite_stats':
        return await getInviteStats(event, wxContext)
      case 'resend_invite':
        return await resendInvite(event, wxContext)
      
      // 权限管理
      case 'check_permission':
        return await checkUserPermission(event, wxContext)
      case 'get_role_permissions':
        return await getRolePermissions(event, wxContext)
      case 'get_user_roles':
        return await getUserRoles(event, wxContext)
      
      // 审计日志
      case 'log_operation':
        return await logOperation(event, wxContext)
      case 'get_audit_logs':
        return await getAuditLogs(event, wxContext)
      
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: error.message || '用户管理操作失败，请重试'
    }
  }
}

// 获取用户信息
async function getUserInfo(event, wxContext) {
  const openid = wxContext.OPENID
  
  try {
    const user = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: openid }).get()
    
    if (user.data.length === 0) {
      // 如果用户不存在，创建默认用户记录
      const newUser = {
        _openid: openid,
        nickName: '新用户',
        farmName: '',                    // 主要字段
        department: '',                  // 兼容字段
        phone: '',
        avatarUrl: '',
        role: 'employee',
        status: 'pending', // pending, active, inactive
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        lastLoginTime: new Date().toISOString()
      }
      
      await db.collection(COLLECTIONS.WX_USERS).add({ data: newUser })
      
      return {
        success: true,
        data: {
          ...newUser,
          // 提供完整的兼容性字段
          nickname: newUser.nickName,
          farmName: newUser.farmName,
          department: newUser.department,
          roleInfo: ROLE_PERMISSIONS[newUser.role]
        }
      }
    }
    
    const userData = user.data[0]
    
    // 更新最后登录时间
    await db.collection(COLLECTIONS.WX_USERS).doc(userData._id).update({
      data: { lastLoginTime: new Date().toISOString() }
    })
    
    return {
      success: true,
      data: {
        ...userData,
        // 提供完整的兼容性字段
        nickname: userData.nickName,           // nickname 兼容字段
        farmName: userData.farmName,           // 主要字段（如果没有则使用department）
        department: userData.department,       // 兼容字段（如果没有则使用farmName）
        roleInfo: ROLE_PERMISSIONS[userData.role || 'employee']
      }
    }
  } catch (error) {
    // 已移除调试日志
    throw new Error('获取用户信息失败')
  }
}

// 通过 OpenID 获取用户信息（用于查询其他用户）
async function getUserByOpenId(event, wxContext) {
  const { openid } = event
  
  if (!openid) {
    return {
      success: false,
      error: '缺少 openid 参数'
    }
  }
  
  try {
    const user = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: openid }).get()
    
    if (user.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      }
    }
    
    const userData = user.data[0]
    
    return {
      success: true,
      data: {
        _id: userData._id,
        openid: userData._openid,
        nickName: userData.nickName || userData.nickname || '用户',
        nickname: userData.nickName || userData.nickname || '用户',
        avatarUrl: userData.avatarUrl || '',
        phone: userData.phone || '',
        farmName: userData.farmName || userData.department || '',
        department: userData.department || userData.farmName || '',
        role: userData.role || 'employee'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || '查询用户信息失败'
    }
  }
}

// 更新用户资料
async function updateUserProfile(event, wxContext) {
  const { nickName, avatarUrl, phone, department, farmName } = event
  const openid = wxContext.OPENID
  
  const updateData = {
    updateTime: new Date().toISOString()
  }
  
  if (nickName) updateData.nickName = nickName
  if (avatarUrl) updateData.avatarUrl = avatarUrl
  if (phone) updateData.phone = phone
  
  // 统一处理养殖场名称字段 - 支持两种字段名
  const farmNameValue = farmName || department
  if (farmNameValue) {
    updateData.farmName = farmNameValue    // 主要字段
    updateData.department = farmNameValue  // 兼容字段，保持一致
  }
  
  await db.collection(COLLECTIONS.WX_USERS).where({ _openid: openid }).update({
    data: updateData
  })
  
  // 获取更新后的用户信息
  const updatedUser = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: openid }).get()
  
  if (updatedUser.data.length > 0) {
    const userData = updatedUser.data[0]
    return {
      success: true,
      data: {
        user: {
          ...userData,
          // 提供完整的兼容性字段
          nickname: userData.nickName,           // nickname 兼容字段
          farmName: userData.farmName,           // 主要字段
          department: userData.department        // 兼容字段
        }
      },
      message: '用户资料更新成功'
    }
  } else {
    throw new Error('用户不存在')
  }
}

// 获取用户列表
async function listUsers(event, wxContext) {
  const { page = 1, pageSize = 10, role, status } = event
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    throw new Error('无权限查看用户列表')
  }
  
  let query = db.collection(COLLECTIONS.WX_USERS)
  
  // 特殊处理：当 role 为 'admin' 时，查询所有管理类角色
  if (role === 'admin') {
    query = query.where({
      role: db.command.in(['manager', 'super_admin', 'admin']) // 包含新旧角色体系的管理员
    })
  } else if (role === 'user') {
    // 特殊处理：当 role 为 'user' 时，查询所有普通用户角色
    query = query.where({
      role: db.command.in(['employee', 'veterinarian', 'user', 'operator']) // 包含新旧角色体系的普通用户
    })
  } else if (role) {
    query = query.where({ role })
  }
  
  if (status) query = query.where({ status })
  
  const total = await query.count()
  const users = await query
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  // 添加角色信息
  const usersWithRoleInfo = users.data.map(user => ({
    ...user,
    roleInfo: ROLE_PERMISSIONS[user.role || 'employee']
  }))
  
  return {
    success: true,
    data: {
      users: usersWithRoleInfo,
      pagination: {
        page,
        pageSize,
        total: total.total,
        totalPages: Math.ceil(total.total / pageSize)
      }
    }
  }
}

// 获取用户统计
async function getUserStats(event, wxContext) {
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    throw new Error('无权限查看用户统计')
  }
  
  try {
    // 获取总用户数
    const totalUsersResult = await db.collection(COLLECTIONS.WX_USERS).count()
    const totalUsers = totalUsersResult.total
    
    // 获取活跃用户数（兼容两种字段格式）
    // 新格式：status = 'active'
    // 旧格式：isActive = true
    const activeUsersWithStatus = await db.collection(COLLECTIONS.WX_USERS)
      .where({ status: 'active' })
      .count()
    
    const activeUsersWithIsActive = await db.collection(COLLECTIONS.WX_USERS)
      .where({ isActive: true })
      .count()
    
    // 使用两者中较大的值（避免重复计数，通常只有一种格式有数据）
    const activeUsers = Math.max(activeUsersWithStatus.total, activeUsersWithIsActive.total)
    
    // 获取管理员数量（包含新旧角色体系）
    const adminUsersResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({
        role: db.command.in(['manager', 'super_admin', 'admin'])
      })
      .count()
    const adminUsers = adminUsersResult.total
    
    // 获取30天内活跃的用户数
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentActiveUsersResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({
        lastLoginTime: db.command.gte(thirtyDaysAgo)
      })
      .count()
    const recentActiveUsers = recentActiveUsersResult.total
    
    return {
      success: true,
      data: {
        totalUsers: totalUsers,
        activeUsers: activeUsers,
        adminUsers: adminUsers,
        recentActiveUsers: recentActiveUsers
      }
    }
  } catch (error) {
    console.error('获取用户统计失败:', error)
    // 返回默认值，避免页面报错
    return {
      success: true,
      data: {
        totalUsers: 0,
        activeUsers: 0,
        adminUsers: 0,
        recentActiveUsers: 0
      }
    }
  }
}

// 更新用户角色
async function updateUserRole(event, wxContext) {
  const { targetUserId, newRole } = event
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    throw new Error('无权限修改用户角色')
  }
  
  if (!ROLE_PERMISSIONS[newRole]) {
    throw new Error('无效的角色类型')
  }
  
  // 不能修改自己的角色（防止锁定）
  const targetUser = await db.collection(COLLECTIONS.WX_USERS).doc(targetUserId).get()
  if (targetUser.data._openid === openid) {
    throw new Error('不能修改自己的角色')
  }
  
  await db.collection(COLLECTIONS.WX_USERS).doc(targetUserId).update({
    data: {
      role: newRole,
      updateTime: new Date().toISOString()
    }
  })
  
  // 记录操作日志
  await logOperation({
    action: 'update_user_role',
    targetUserId,
    newRole,
    description: `将用户角色修改为${ROLE_PERMISSIONS[newRole].name}`
  }, wxContext)
  
  return {
    success: true,
    message: '用户角色更新成功'
  }
}

// 创建邀请（整合专业功能）
async function createInvite(event, wxContext) {
  const {
    role = 'employee', // 默认角色改为员工
    remark = '',
    expiryDays = 7
  } = event

  // 已移除调试日志
  try {
    const openid = wxContext.OPENID
    
    if (!await validateAdminPermission(openid)) {
      throw new Error('无权限创建邀请')
    }
    
    if (!ROLE_PERMISSIONS[role]) {
      throw new Error('无效的角色类型')
    }

    // 获取邀请人信息
    const inviterResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: openid })
      .get()

    // 已移除调试日志
    if (inviterResult.data.length === 0) {
      // 已移除调试日志
      throw new Error('邀请人信息不存在')
    }

    const inviter = inviterResult.data[0]
    
    // 生成唯一邀请码
    // 已移除调试日志
    const inviteCode = await generateUniqueInviteCode()
    // 已移除调试日志
    // 计算过期时间
    const now = new Date()
    const expiryTime = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000)
    // 已移除调试日志
    // 创建邀请记录
    const inviteData = {
      inviteCode: inviteCode,
      inviterOpenId: openid,
      inviterName: inviter.nickname || inviter.nickName || '管理员',
      // 被邀请人信息将在使用邀请码时填写
      inviteeName: null,
      inviteePhone: null,
      department: null,
      position: null,
      // 预设的默认角色，注册时可调整
      defaultRole: role,
      role: null, // 实际角色在注册时确定
      status: 'pending',
      createTime: now,
      expiryTime: expiryTime,
      usedTime: null,
      usedByOpenId: null,
      remark: remark
    }

    // 已移除调试日志
    const result = await db.collection(COLLECTIONS.WX_USER_INVITES).add({
      data: inviteData
    })

    // 已移除调试日志
    // 清理旧记录，只保留最新的5个邀请码
    await cleanupOldInvites()

    const responseData = {
      success: true,
      data: {
        inviteId: result._id,
        inviteCode: inviteCode,
        role: role,
        expiryTime: expiryTime,
        remark: remark
      },
      message: '邀请码生成成功'
    }
    
    // 已移除调试日志
    return responseData
  } catch (error) {
    // 已移除调试日志
    throw error
  }
}

// 使用邀请码（注册时调用）
async function useInvite(event, wxContext) {
  const { 
    inviteCode,
    inviteeName,
    inviteePhone,
    department,
    position,
    finalRole // 最终确定的角色，可能与默认角色不同
  } = event
  const openid = wxContext.OPENID

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

    // 准备更新数据
    const updateData = {
      status: 'used',
      usedTime: new Date(),
      usedByOpenId: openid
    }

    // 如果提供了用户信息，则更新邀请记录
    if (inviteeName) updateData.inviteeName = inviteeName
    if (inviteePhone) updateData.inviteePhone = inviteePhone
    if (department) updateData.department = department
    if (position) updateData.position = position
    if (finalRole) updateData.role = finalRole

    // 标记邀请码为已使用并更新用户信息
    await db.collection(COLLECTIONS.WX_USER_INVITES).doc(invite._id).update({
      data: updateData
    })

    // 更新用户角色和状态
    const userRole = finalRole || invite.defaultRole || 'employee'
    await db.collection(COLLECTIONS.WX_USERS).where({ _openid: openid }).update({
      data: {
        role: userRole,
        status: 'active',
        nickName: inviteeName || undefined,
        phone: inviteePhone || undefined,
        department: department || undefined,
        position: position || undefined,
        updateTime: new Date().toISOString()
      }
    })

    return {
      success: true,
      data: {
        invite: {
          ...invite,
          defaultRole: invite.defaultRole, // 返回默认角色供注册时参考
          ...updateData
        }
      },
      message: '邀请码使用成功，账户已激活'
    }
  } catch (error) {
    // 已移除调试日志
    throw error
  }
}

// 检查用户权限
async function checkUserPermission(event, wxContext) {
  const { permission } = event
  const openid = wxContext.OPENID
  
  try {
    const user = await db.collection(COLLECTIONS.WX_USERS).where({ _openid: openid }).get()
    if (user.data.length === 0) {
      return { success: true, data: { hasPermission: false } }
    }
    
    const userRole = user.data[0].role || 'employee'
    const hasPermission = checkPermission(userRole, permission)
    
    return {
      success: true,
      data: {
        hasPermission,
        userRole,
        permission
      }
    }
  } catch (error) {
    // 已移除调试日志
    return { success: true, data: { hasPermission: false } }
  }
}

// 获取角色权限信息（从数据库读取）
async function getRolePermissions(event, wxContext) {
  try {
    const roles = await loadRolesFromDB()
    
    // 转换为前端需要的格式
    const rolePermissions = {}
    Object.keys(roles).forEach(code => {
      const role = roles[code]
      rolePermissions[code] = {
        name: role.name,
        permissions: role.permissions,
        description: role.description
      }
    })
    
    return {
      success: true,
      data: rolePermissions
    }
  } catch (err) {
    console.error('获取角色权限失败:', err.message)
    return {
      success: false,
      error: err.message
    }
  }
}

// 记录操作日志
async function logOperation(event, wxContext) {
  const { action, targetId, targetType, description, additionalData } = event
  const openid = wxContext.OPENID
  
  try {
    const log = {
      _openid: openid,
      action,
      targetId: targetId || '',
      targetType: targetType || '',
      description: description || '',
      additionalData: additionalData || {},
      ipAddress: wxContext.SOURCE || '',
      userAgent: wxContext.SOURCE || '',
      createTime: new Date().toISOString()
    }
    
    await db.collection(COLLECTIONS.SYS_AUDIT_LOGS).add({ data: log })
    
    return {
      success: true,
      message: '操作日志记录成功'
    }
  } catch (error) {
    // 已移除调试日志
    // 日志记录失败不应影响业务操作
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取审计日志
async function getAuditLogs(event, wxContext) {
  const { page = 1, pageSize = 20, action, targetType, dateRange } = event
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    throw new Error('无权限查看审计日志')
  }
  
  let query = db.collection(COLLECTIONS.SYS_AUDIT_LOGS)
  
  if (action) query = query.where({ action })
  if (targetType) query = query.where({ targetType })
  if (dateRange && dateRange.start && dateRange.end) {
    query = query.where({
      createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
    })
  }
  
  const total = await query.count()
  const logs = await query
    .orderBy('createTime', 'desc')
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
        total: total.total,
        totalPages: Math.ceil(total.total / pageSize)
      }
    }
  }
}

// 获取邀请列表（整合专业搜索功能）
async function listInvites(event, wxContext) {
  const {
    page = 1,
    pageSize = 20,
    status = null,
    searchKeyword = null,
    sortBy = 'createTime',
    sortOrder = 'desc'
  } = event
  const openid = wxContext.OPENID

  try {
    if (!await validateAdminPermission(openid)) {
      throw new Error('无权限查看邀请列表')
    }

    let query = db.collection(COLLECTIONS.WX_USER_INVITES)
    const where = {}

    // 状态筛选
    if (status) {
      where.status = status
    }

    // 搜索功能
    if (searchKeyword) {
      where.$or = [
        { inviteCode: new RegExp(searchKeyword, 'i') },
        { remark: new RegExp(searchKeyword, 'i') },
        // 只有已使用的邀请才有被邀请人信息
        { inviteeName: new RegExp(searchKeyword, 'i') },
        { inviteePhone: new RegExp(searchKeyword, 'i') }
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
    // 已移除调试日志
    throw error
  }
}

// 撤销邀请（增强版）
async function revokeInvite(event, wxContext) {
  const { inviteId, reason = '' } = event
  const openid = wxContext.OPENID

  try {
    if (!await validateAdminPermission(openid)) {
      throw new Error('无权限撤销邀请')
    }

    if (!inviteId) {
      throw new Error('缺少邀请ID')
    }

    // 检查邀请是否存在
    const invite = await db.collection(COLLECTIONS.WX_USER_INVITES).doc(inviteId).get()
    if (!invite.data) {
      throw new Error('邀请不存在')
    }

    if (invite.data.status !== 'pending') {
      throw new Error('只能撤销待使用的邀请')
    }

    // 更新邀请状态
    await db.collection(COLLECTIONS.WX_USER_INVITES).doc(inviteId).update({
      data: {
        status: 'revoked',
        revokedTime: new Date(),
        revokedBy: openid,
        revokedReason: reason
      }
    })

    return {
      success: true,
      message: '邀请已撤销'
    }
  } catch (error) {
    // 已移除调试日志
    throw error
  }
}

// 删除用户
async function deleteUser(event, wxContext) {
  const { targetUserId } = event
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    throw new Error('无权限删除用户')
  }
  
  if (!targetUserId) {
    throw new Error('缺少用户ID')
  }
  
  // 检查目标用户是否存在
  const targetUser = await db.collection(COLLECTIONS.WX_USERS).doc(targetUserId).get()
  if (!targetUser.data) {
    throw new Error('用户不存在')
  }
  
  // 不能删除自己
  if (targetUser.data._openid === openid) {
    throw new Error('不能删除自己的账户')
  }
  
  // 不能删除超级管理员
  if (targetUser.data.role === 'super_admin') {
    throw new Error('不能删除超级管理员')
  }
  
  // 删除用户记录
  await db.collection(COLLECTIONS.WX_USERS).doc(targetUserId).remove()
  
  // 记录操作日志
  await logOperation({
    action: 'delete_user',
    targetUserId,
    description: `删除用户: ${targetUser.data.nickName || targetUser.data.nickname || '未知用户'}`
  }, wxContext)
  
  return {
    success: true,
    message: '用户已删除'
  }
}

async function deactivateUser(event, wxContext) {
  const { targetUserId } = event
  const openid = wxContext.OPENID
  
  if (!await validateAdminPermission(openid)) {
    throw new Error('无权限停用用户')
  }
  
  await db.collection(COLLECTIONS.WX_USERS).doc(targetUserId).update({
    data: {
      status: 'inactive',
      updateTime: new Date().toISOString()
    }
  })
  
  return {
    success: true,
    message: '用户已停用'
  }
}

// 获取用户角色信息（从数据库读取）
async function getUserRoles(event, wxContext) {
  const { openid } = event
  const requestOpenid = openid || wxContext.OPENID
  
  try {
    // 查询用户信息
    const userResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: requestOpenid })
      .get()
    
    if (userResult.data.length === 0) {
      return {
        success: false,
        message: '用户不存在',
        roles: []
      }
    }
    
    const user = userResult.data[0]
    const userRole = user.role || 'employee'
    
    // 从数据库加载角色配置
    const rolesConfig = await loadRolesFromDB()
    
    // 验证角色是否有效
    if (!rolesConfig[userRole]) {
      return {
        success: false,
        message: '用户角色无效',
        roles: []
      }
    }
    
    // 获取角色信息（从数据库）
    const roleInfo = rolesConfig[userRole]
    
    // 构造角色数据
    const roles = [{
      roleCode: userRole,
      roleName: roleInfo.name,
      level: roleInfo.level,
      isActive: user.isActive !== false,
      permissions: roleInfo.permissions,
      assignTime: user.createTime || new Date(),
      expiryTime: null // 角色不过期
    }]
    
    return {
      success: true,
      roles: roles,
      message: '获取用户角色成功'
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      message: '获取用户角色失败',
      error: error.message,
      roles: []
    }
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
    const inviteResult = await db.collection(COLLECTIONS.WX_USER_INVITES)
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
      await db.collection(COLLECTIONS.WX_USER_INVITES).doc(invite._id).update({
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
    // 已移除调试日志
    throw error
  }
}

// 获取邀请统计
async function getInviteStats(event, wxContext) {
  const openid = wxContext.OPENID

  try {
    if (!await validateAdminPermission(openid)) {
      throw new Error('无权限查看邀请统计')
    }

    const [
      totalInvites,
      pendingInvites,
      usedInvites,
      revokedInvites,
      expiredInvites
    ] = await Promise.all([
      db.collection(COLLECTIONS.WX_USER_INVITES).count(),
      db.collection(COLLECTIONS.WX_USER_INVITES).where({ status: 'pending' }).count(),
      db.collection(COLLECTIONS.WX_USER_INVITES).where({ status: 'used' }).count(),
      db.collection(COLLECTIONS.WX_USER_INVITES).where({ status: 'revoked' }).count(),
      db.collection(COLLECTIONS.WX_USER_INVITES).where({ status: 'expired' }).count()
    ])

    // 获取最近7天的邀请统计
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentInvites = await db.collection(COLLECTIONS.WX_USER_INVITES)
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
    // 已移除调试日志
    throw error
  }
}

// 重新发送邀请（延长有效期）
async function resendInvite(event, wxContext) {
  const { inviteId, expiryDays = 7 } = event
  const openid = wxContext.OPENID

  try {
    if (!await validateAdminPermission(openid)) {
      throw new Error('无权限重新发送邀请')
    }

    if (!inviteId) {
      throw new Error('缺少邀请ID')
    }

    // 检查邀请是否存在
    const invite = await db.collection(COLLECTIONS.WX_USER_INVITES).doc(inviteId).get()
    if (!invite.data) {
      throw new Error('邀请不存在')
    }

    if (invite.data.status !== 'pending') {
      throw new Error('只能重新发送待使用的邀请')
    }

    // 延长有效期
    const newExpiryTime = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

    await db.collection(COLLECTIONS.WX_USER_INVITES).doc(inviteId).update({
      data: {
        expiryTime: newExpiryTime,
        lastResendTime: new Date()
      }
    })

    return {
      success: true,
      message: '邀请已重新发送',
      data: {
        newExpiryTime: newExpiryTime
      }
    }
  } catch (error) {
    // 已移除调试日志
    throw error
  }
}