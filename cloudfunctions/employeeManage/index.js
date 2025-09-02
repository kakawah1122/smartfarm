// cloudfunctions/employeeManage/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 权限定义
const PERMISSIONS = {
  // 基础权限
  'basic': '基础功能访问',
  // 生产管理
  'production.view': '生产数据查看',
  'production.manage': '生产数据管理',
  // 健康管理
  'health.view': '健康数据查看',
  'health.manage': '健康数据管理',
  // 财务管理
  'finance.view': '财务数据查看',
  'finance.manage': '财务数据管理',
  'finance.approve': '财务审批',
  // 员工管理
  'employee.view': '员工信息查看',
  'employee.manage': '员工信息管理',
  'employee.invite': '员工邀请',
  // 系统管理
  'system.admin': '系统管理',
  // 所有权限
  'all': '所有权限'
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { OPENID } = wxContext
  const { action } = event
  
  try {
    // 验证用户身份
    const currentUser = await getCurrentUser(OPENID)
    if (!currentUser) {
      return {
        success: false,
        message: '用户不存在'
      }
    }
    
    // 根据操作类型执行相应功能
    switch (action) {
      case 'getEmployees':
        return await getEmployees(currentUser, event)
      case 'inviteEmployee':
        return await inviteEmployee(currentUser, event)
      case 'updateEmployee':
        return await updateEmployee(currentUser, event)
      case 'removeEmployee':
        return await removeEmployee(currentUser, event)
      case 'joinByInvite':
        return await joinByInvite(currentUser, event)
      case 'getInvites':
        return await getInvites(currentUser, event)
      case 'getPermissions':
        return await getPermissions()
      default:
        return {
          success: false,
          message: '未知操作'
        }
    }
    
  } catch (error) {
    console.error('员工管理操作失败:', error)
    return {
      success: false,
      error: error.message,
      message: '操作失败，请重试'
    }
  }
}

// 获取当前用户信息
async function getCurrentUser(openid) {
  try {
    const result = await db.collection('users').where({
      _openid: openid
    }).get()
    
    return result.data.length > 0 ? result.data[0] : null
  } catch (error) {
    console.error('获取当前用户失败:', error)
    return null
  }
}

// 检查权限
function hasPermission(user, requiredPermission) {
  if (!user || !user.permissions) return false
  
  // 管理员或拥有所有权限
  if (user.role === 'admin' || user.permissions.includes('all')) {
    return true
  }
  
  // 检查特定权限
  return user.permissions.includes(requiredPermission)
}

// 获取员工列表
async function getEmployees(currentUser, event) {
  // 验证权限
  if (!hasPermission(currentUser, 'employee.view')) {
    return {
      success: false,
      message: '无权限查看员工信息'
    }
  }
  
  try {
    // 获取同组织的员工
    const query = {
      isActive: true
    }
    
    // 如果不是管理员，只能看到自己管理的员工
    if (currentUser.role !== 'admin') {
      query.managedBy = currentUser._id
    }
    
    const result = await db.collection('users').where(query).get()
    
    // 过滤敏感信息
    const employees = result.data.map(user => ({
      _id: user._id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions,
      department: user.department,
      position: user.position,
      createTime: user.createTime,
      lastLoginTime: user.lastLoginTime,
      isActive: user.isActive
    }))
    
    return {
      success: true,
      employees: employees,
      total: employees.length
    }
  } catch (error) {
    console.error('获取员工列表失败:', error)
    throw error
  }
}

// 邀请员工
async function inviteEmployee(currentUser, event) {
  const { department, position, permissions, validDays = 7 } = event
  
  // 验证权限
  if (!hasPermission(currentUser, 'employee.invite')) {
    return {
      success: false,
      message: '无权限邀请员工'
    }
  }
  
  try {
    // 生成邀请码
    const inviteCode = generateInviteCode()
    const expireTime = new Date()
    expireTime.setDate(expireTime.getDate() + validDays)
    
    // 创建邀请记录
    const inviteData = {
      inviteCode: inviteCode,
      inviterOpenid: currentUser._openid,
      inviterName: currentUser.nickname,
      organizationId: currentUser.organizationId || currentUser._id,
      department: department || '',
      position: position || '',
      permissions: permissions || ['basic'],
      createTime: new Date(),
      expireTime: expireTime,
      isUsed: false,
      usedBy: null,
      usedTime: null
    }
    
    // 方案1：尝试使用 employee_invites 集合
    try {
      const result = await db.collection('employee_invites').add({
        data: inviteData
      })
      
      return {
        success: true,
        message: '邀请码生成成功',
        inviteCode: inviteCode,
        expireTime: expireTime,
        inviteId: result._id
      }
    } catch (addError) {
      console.log('employee_invites集合操作失败，使用users集合存储邀请信息')
      
      // 方案2：如果 employee_invites 集合有问题，使用 users 集合存储邀请信息
      try {
        // 在当前用户记录中添加邀请信息
        const userInvites = currentUser.invites || []
        userInvites.push(inviteData)
        
        await db.collection('users').doc(currentUser._id).update({
          data: {
            invites: userInvites,
            updateTime: new Date()
          }
        })
        
        return {
          success: true,
          message: '邀请码生成成功（使用用户存储）',
          inviteCode: inviteCode,
          expireTime: expireTime,
          inviteId: `user_${currentUser._id}_${inviteCode}`,
          storageMethod: 'user_collection'
        }
      } catch (userError) {
        console.error('使用用户集合存储邀请失败:', userError)
        return {
          success: false,
          message: '邀请码生成失败，数据库操作异常',
          error: userError.message
        }
      }
    }
  } catch (error) {
    console.error('创建员工邀请失败:', error)
    return {
      success: false,
      message: '邀请码生成失败，请重试',
      error: error.message
    }
  }
}

// 更新员工信息
async function updateEmployee(currentUser, event) {
  const { employeeId, updates } = event
  
  // 验证权限
  if (!hasPermission(currentUser, 'employee.manage')) {
    return {
      success: false,
      message: '无权限管理员工信息'
    }
  }
  
  try {
    // 获取要更新的员工信息
    const employee = await db.collection('users').doc(employeeId).get()
    if (!employee.data) {
      return {
        success: false,
        message: '员工不存在'
      }
    }
    
    // 准备更新数据
    const updateData = {
      updateTime: new Date()
    }
    
    // 允许更新的字段
    const allowedFields = ['department', 'position', 'permissions', 'isActive']
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field]
      }
    })
    
    // 如果是角色更新，需要额外权限验证
    if (updates.role && updates.role !== employee.data.role) {
      if (currentUser.role !== 'admin') {
        return {
          success: false,
          message: '只有管理员可以修改员工角色'
        }
      }
      updateData.role = updates.role
    }
    
    // 更新员工信息
    await db.collection('users').doc(employeeId).update({
      data: updateData
    })
    
    return {
      success: true,
      message: '员工信息更新成功'
    }
  } catch (error) {
    console.error('更新员工信息失败:', error)
    throw error
  }
}

// 移除员工
async function removeEmployee(currentUser, event) {
  const { employeeId } = event
  
  // 验证权限
  if (!hasPermission(currentUser, 'employee.manage')) {
    return {
      success: false,
      message: '无权限移除员工'
    }
  }
  
  try {
    // 软删除：设置为非活跃状态
    await db.collection('users').doc(employeeId).update({
      data: {
        isActive: false,
        updateTime: new Date(),
        removedBy: currentUser._id,
        removeTime: new Date()
      }
    })
    
    return {
      success: true,
      message: '员工已移除'
    }
  } catch (error) {
    console.error('移除员工失败:', error)
    throw error
  }
}

// 通过邀请码加入
async function joinByInvite(currentUser, event) {
  const { inviteCode } = event
  
  try {
    let invite = null
    let inviteSource = null
    let inviteId = null
    
    // 方案1：从 employee_invites 集合查找
    try {
      const inviteResult = await db.collection('employee_invites').where({
        inviteCode: inviteCode,
        isUsed: false
      }).get()
      
      if (inviteResult.data.length > 0) {
        invite = inviteResult.data[0]
        inviteSource = 'employee_invites'
        inviteId = invite._id
      }
    } catch (queryError) {
      console.log('从employee_invites集合查找失败，尝试从users集合查找')
    }
    
    // 方案2：如果没找到，从所有用户的invites字段中查找
    if (!invite) {
      try {
        const allUsersResult = await db.collection('users').where({
          role: 'admin'
        }).get()
        
        for (const user of allUsersResult.data) {
          const userInvites = user.invites || []
          const foundInvite = userInvites.find(inv => 
            inv.inviteCode === inviteCode && !inv.isUsed
          )
          
          if (foundInvite) {
            invite = foundInvite
            inviteSource = 'users'
            inviteId = user._id
            break
          }
        }
      } catch (userQueryError) {
        console.log('从users集合查找邀请失败:', userQueryError.message)
      }
    }
    
    if (!invite) {
      return {
        success: false,
        message: '邀请码不存在或已使用'
      }
    }
    
    // 检查是否过期
    if (new Date() > new Date(invite.expireTime)) {
      return {
        success: false,
        message: '邀请码已过期'
      }
    }
    
    // 更新用户角色和权限
    const updateData = {
      role: 'employee',
      permissions: invite.permissions,
      department: invite.department,
      position: invite.position,
      organizationId: invite.organizationId,
      managedBy: invite.inviterOpenid,
      updateTime: new Date()
    }
    
    await db.collection('users').doc(currentUser._id).update({
      data: updateData
    })
    
    // 标记邀请码为已使用（根据存储方式）
    if (inviteSource === 'employee_invites') {
      // 从独立集合更新
      await db.collection('employee_invites').doc(inviteId).update({
        data: {
          isUsed: true,
          usedBy: currentUser._openid,
          usedTime: new Date()
        }
      })
    } else if (inviteSource === 'users') {
      // 从用户记录中更新
      try {
        const userResult = await db.collection('users').doc(inviteId).get()
        const userInvites = userResult.data.invites || []
        
        // 找到并更新对应的邀请
        const updatedInvites = userInvites.map(inv => {
          if (inv.inviteCode === inviteCode) {
            return {
              ...inv,
              isUsed: true,
              usedBy: currentUser._openid,
              usedTime: new Date()
            }
          }
          return inv
        })
        
        await db.collection('users').doc(inviteId).update({
          data: {
            invites: updatedInvites,
            updateTime: new Date()
          }
        })
      } catch (updateError) {
        console.log('更新用户邀请记录失败:', updateError.message)
        // 这里不抛出错误，因为用户已经成功加入
      }
    }
    
    return {
      success: true,
      message: '成功加入组织',
      role: 'employee',
      permissions: invite.permissions,
      department: invite.department,
      position: invite.position,
      inviteSource: inviteSource
    }
  } catch (error) {
    console.error('加入组织失败:', error)
    return {
      success: false,
      message: '加入组织失败，请重试',
      error: error.message
    }
  }
}

// 获取邀请列表
async function getInvites(currentUser, event) {
  // 验证权限
  if (!hasPermission(currentUser, 'employee.invite')) {
    return {
      success: false,
      message: '无权限查看邀请记录'
    }
  }
  
  let invites = []
  
  // 方案1：尝试从 employee_invites 集合获取
  try {
    const result = await db.collection('employee_invites').where({
      inviterOpenid: currentUser._openid
    }).orderBy('createTime', 'desc').get()
    
    invites = result.data
  } catch (error) {
    console.log('从employee_invites集合获取失败，尝试从users集合获取:', error.message)
  }
  
  // 方案2：从用户记录中获取邀请信息
  try {
    const userResult = await db.collection('users').doc(currentUser._id).get()
    const userInvites = userResult.data.invites || []
    
    // 合并两种来源的邀请
    invites = invites.concat(userInvites)
  } catch (userError) {
    console.log('从users集合获取邀请失败:', userError.message)
  }
  
  // 按创建时间排序
  invites.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
  
  return {
    success: true,
    invites: invites,
    total: invites.length
  }
}

// 获取权限列表
async function getPermissions() {
  return {
    success: true,
    permissions: PERMISSIONS
  }
}

// 生成邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
