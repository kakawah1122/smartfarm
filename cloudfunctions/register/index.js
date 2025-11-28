// cloudfunctions/register/index.js
const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

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
    'super_admin': { code: 'super_admin', name: '超级管理员', permissions: ['*'], level: 1 },
    'manager': { code: 'manager', name: '经理', permissions: ['production.*', 'health.*', 'finance.*', 'ai_diagnosis.*', 'user.read', 'user.invite', 'user.update_role', 'user.approve'], level: 2 },
    'employee': { code: 'employee', name: '员工', permissions: ['production.create', 'production.read', 'production.update_own', 'health.create', 'health.read', 'health.update_own', 'ai_diagnosis.create', 'ai_diagnosis.read', 'ai_diagnosis.validate', 'user.read_own'], level: 3 },
    'veterinarian': { code: 'veterinarian', name: '兽医', permissions: ['health.*', 'ai_diagnosis.*', 'production.read', 'user.read_own'], level: 3 }
  }
}

// 根据角色获取权限列表（异步版本）
async function getPermissionsByRole(role) {
  const roles = await loadRolesFromDB()
  const roleConfig = roles[role]
  return roleConfig ? roleConfig.permissions : ['basic']
}

// 根据角色获取职位名称（异步版本）
async function getPositionByRole(role) {
  const roles = await loadRolesFromDB()
  const roleConfig = roles[role]
  return roleConfig ? roleConfig.name : '员工'
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { nickname, avatarUrl, phone, gender, farmName, inviteCode } = event
  
  try {
    // 获取用户的 openid
    const { OPENID } = wxContext
    
    if (!OPENID) {
      return {
        success: false,
        message: '用户身份验证失败'
      }
    }
    
    // 查找用户记录
    let userQuery = null
    let user = null
    
    try {
      userQuery = await db.collection(COLLECTIONS.WX_USERS).where({
        _openid: OPENID
      }).get()
      
      if (userQuery.data.length === 0) {
        return {
          success: false,
          message: '用户不存在，请先登录'
        }
      }
      
      user = userQuery.data[0]
      
    } catch (queryError) {
      
      if (queryError.errCode === -502005 || queryError.message?.includes('collection not exists')) {
        return {
          success: false,
          message: '数据库集合不存在，请先完成登录以初始化数据库',
          error: 'database_collection_not_exists'
        }
      }
      
      throw queryError
    }
    
    // 处理邀请码验证（如果提供了邀请码）
    let inviteInfo = null
    if (inviteCode) {
      try {
        // 验证邀请码
        const inviteValidation = await validateInviteCode(inviteCode, OPENID)
        if (!inviteValidation.success) {
          return {
            success: false,
            message: inviteValidation.message,
            error: inviteValidation.error
          }
        }
        
        inviteInfo = inviteValidation.data.invite
        
        // 使用邀请码
        const useResult = await useInviteCode(inviteCode, OPENID)
        if (!useResult.success) {
          return {
            success: false,
            message: useResult.message,
            error: useResult.error
          }
        }
        
      } catch (inviteError) {
        return {
          success: false,
          message: '邀请码验证失败，请重试',
          error: 'invite_code_validation_failed'
        }
      }
    }
    
    // 准备更新数据
    const updateData = {
      updateTime: new Date()
    }
    
    // 添加要更新的字段
    if (nickname !== undefined) {
      updateData.nickName = nickname  // 修正：存储为数据库标准字段名nickName
    }
    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl
    }
    if (phone !== undefined) {
      updateData.phone = phone
    }
    if (gender !== undefined) {
      updateData.gender = gender
    }
    if (farmName !== undefined) {
      updateData.farmName = farmName
      updateData.department = farmName  // 保持兼容性字段同步
    }
    
    // 如果有邀请信息，更新相关字段
    if (inviteInfo) {
      updateData.inviteCode = inviteCode
      
      // ✅ 修复：优先使用 defaultRole，兼容 role 字段
      // 邀请码创建时角色存储在 defaultRole 字段
      const inviteRole = inviteInfo.defaultRole || inviteInfo.role || 'employee'
      
      // ✅ 设置角色
      updateData.role = inviteRole
      
      // ✅ 从数据库获取权限列表和职位名称
      const rolePermissions = await getPermissionsByRole(inviteRole)
      const rolePosition = await getPositionByRole(inviteRole)
      
      // ✅ 设置对应的权限列表
      updateData.permissions = rolePermissions
      
      // ✅ 设置职位名称（优先使用邀请信息中的职位，否则根据角色自动生成）
      updateData.position = inviteInfo.position || rolePosition
      
      // 如果邀请信息中有部门/养殖场信息，使用邀请信息
      if (inviteInfo.department) {
        updateData.farmName = inviteInfo.department
        updateData.department = inviteInfo.department
      }
      
      // ✅ 使用有效邀请码注册的用户自动通过审批
      updateData.approvalStatus = 'approved'
      updateData.approvedBy = inviteInfo.inviterOpenId || inviteInfo.createdBy || 'system'
      updateData.approvedTime = new Date()
      updateData.approvalRemark = `通过邀请码自动审批，角色: ${rolePosition}`
      updateData.isActive = true
    }
    
    // 更新用户信息
    const updateResult = await db.collection(COLLECTIONS.WX_USERS).doc(user._id).update({
      data: updateData
    })
    
    if (updateResult.stats.updated === 1) {
      // 获取更新后的用户信息
      const updatedUser = await db.collection(COLLECTIONS.WX_USERS).doc(user._id).get()
      
      return {
        success: true,
        message: '用户信息更新成功',
        user: {
          _id: updatedUser.data._id,
          openid: OPENID,
          nickname: updatedUser.data.nickname || updatedUser.data.nickName,
          nickName: updatedUser.data.nickName || updatedUser.data.nickname,
          avatarUrl: updatedUser.data.avatarUrl,
          phone: updatedUser.data.phone,
          gender: updatedUser.data.gender,
          farmName: updatedUser.data.farmName,
          department: updatedUser.data.department,
          // ✅ 返回角色和权限信息
          role: updatedUser.data.role,
          permissions: updatedUser.data.permissions,
          position: updatedUser.data.position,
          // 审批状态
          approvalStatus: updatedUser.data.approvalStatus,
          // 时间信息
          createTime: updatedUser.data.createTime,
          updateTime: updatedUser.data.updateTime,
          lastLoginTime: updatedUser.data.lastLoginTime,
          loginCount: updatedUser.data.loginCount,
          isActive: updatedUser.data.isActive
        }
      }
    } else {
      return {
        success: false,
        message: '用户信息更新失败'
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '操作失败，请重试'
    }
  }
}

// 验证邀请码
async function validateInviteCode(inviteCode, openid) {
  try {
    if (!inviteCode) {
      return {
        success: false,
        message: '缺少邀请码',
        error: 'missing_invite_code'
      }
    }

    // 查找邀请记录
    const inviteResult = await db.collection(COLLECTIONS.WX_USER_INVITES)
      .where({ inviteCode: inviteCode.toUpperCase() })
      .get()

    if (inviteResult.data.length === 0) {
      return {
        success: false,
        message: '邀请码不存在',
        error: 'invite_not_found'
      }
    }

    const invite = inviteResult.data[0]

    // 检查邀请状态
    if (invite.status === 'used') {
      return {
        success: false,
        message: '邀请码已被使用',
        error: 'invite_used'
      }
    }

    if (invite.status === 'revoked') {
      return {
        success: false,
        message: '邀请码已被撤销',
        error: 'invite_revoked'
      }
    }

    if (invite.status === 'expired') {
      return {
        success: false,
        message: '邀请码已过期',
        error: 'invite_expired'
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
        message: '邀请码已过期',
        error: 'invite_expired'
      }
    }

    return {
      success: true,
      data: {
        invite: invite
      },
      message: '邀请码有效'
    }
  } catch (error) {
    return {
      success: false,
      message: '邀请码验证失败',
      error: 'validation_failed'
    }
  }
}

// 使用邀请码
async function useInviteCode(inviteCode, openid) {
  try {
    // 再次验证邀请码
    const validateResult = await validateInviteCode(inviteCode, openid)
    if (!validateResult.success) {
      return validateResult
    }

    const invite = validateResult.data.invite

    // 标记邀请码为已使用
    await db.collection(COLLECTIONS.WX_USER_INVITES).doc(invite._id).update({
      data: {
        status: 'used',
        usedTime: new Date(),
        usedByOpenId: openid
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
    return {
      success: false,
      message: '使用邀请码失败',
      error: 'use_invite_failed'
    }
  }
}