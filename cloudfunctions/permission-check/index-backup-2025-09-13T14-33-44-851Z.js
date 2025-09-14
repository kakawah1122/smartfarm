const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, module, resourceId, additionalContext } = event
  const { OPENID } = cloud.getWXContext()
  
  try {
    // 检查用户权限
    const hasPermission = await checkUserPermission(
      OPENID, 
      module, 
      action, 
      resourceId, 
      additionalContext
    )
    
    // 记录权限检查日志
    await logPermissionCheck(OPENID, module, action, hasPermission, context)
    
    return {
      success: true,
      hasPermission,
      message: hasPermission ? '权限验证通过' : '权限不足'
    }
  } catch (error) {
    console.error('权限检查失败：', error)
    return {
      success: false,
      hasPermission: false,
      message: '权限检查失败',
      error: error.message
    }
  }
}

// 检查用户权限
async function checkUserPermission(openid, module, action, resourceId, context) {
  // 1. 获取用户角色
  const userRoles = await getUserRoles(openid)
  if (!userRoles.length) {
    return false
  }
  
  // 2. 检查每个角色的权限
  for (const userRole of userRoles) {
    const rolePermissions = await getRolePermissions(userRole.roleCode)
    if (!rolePermissions) {
      continue
    }
    
    // 3. 检查模块权限
    const modulePermission = rolePermissions.permissions.find(p => 
      p.module === module || p.module === '*'
    )
    if (!modulePermission) {
      continue
    }
    
    // 4. 检查操作权限
    if (!modulePermission.actions.includes(action) && !modulePermission.actions.includes('*')) {
      continue
    }
    
    // 5. 检查权限条件
    if (modulePermission.conditions) {
      const conditionMet = await evaluatePermissionConditions(
        modulePermission.conditions, 
        openid, 
        resourceId, 
        context
      )
      if (!conditionMet) {
        continue
      }
    }
    
    // 6. 检查被拒绝的权限
    const isDenied = userRole.deniedPermissions?.some(dp => 
      dp.module === module && dp.actions.includes(action)
    )
    if (isDenied) {
      continue
    }
    
    // 7. 检查时间和IP限制
    const restrictionPassed = await checkRestrictions(rolePermissions.restrictions, context)
    if (!restrictionPassed) {
      continue
    }
    
    // 如果通过所有检查，返回true
    return true
  }
  
  return false
}

// 获取用户角色
async function getUserRoles(openid) {
  const result = await db.collection('user_roles')
    .where({
      openid,
      isActive: true,
      $or: [
        { expiryTime: _.eq(null) },
        { expiryTime: _.gt(new Date()) }
      ]
    })
    .get()
  
  return result.data
}

// 获取角色权限
async function getRolePermissions(roleCode) {
  const result = await db.collection('roles')
    .where({
      roleCode,
      isActive: true
    })
    .get()
  
  return result.data[0]
}

// 评估权限条件
async function evaluatePermissionConditions(conditions, openid, resourceId, context) {
  // 条件评估逻辑
  
  // 只能访问自己创建的资源
  if (conditions.ownerOnly && resourceId) {
    const resource = await getResourceOwner(resourceId, conditions.resourceCollection)
    return resource && resource.creator === openid
  }
  
  // 只能在特定时间段访问
  if (conditions.timeRestriction) {
    const currentHour = new Date().getHours()
    return currentHour >= conditions.timeRestriction.start && 
           currentHour <= conditions.timeRestriction.end
  }
  
  // 批次权限检查 - 只能访问指定批次的数据
  if (conditions.batchAccess && resourceId) {
    const userBatches = await getUserAssignedBatches(openid)
    const resourceBatch = await getResourceBatch(resourceId, conditions.resourceCollection)
    return userBatches.includes(resourceBatch)
  }
  
  // 部门权限检查
  if (conditions.departmentAccess) {
    const userDepartment = await getUserDepartment(openid)
    return conditions.allowedDepartments.includes(userDepartment)
  }
  
  return true
}

// 获取资源所有者
async function getResourceOwner(resourceId, collection) {
  if (!collection || !resourceId) return null
  
  try {
    const result = await db.collection(collection)
      .doc(resourceId)
      .field({ creator: true, openid: true })
      .get()
    
    return result.data
  } catch (error) {
    console.error('获取资源所有者失败：', error)
    return null
  }
}

// 获取用户分配的批次
async function getUserAssignedBatches(openid) {
  try {
    const result = await db.collection('user_batch_assignments')
      .where({ openid, isActive: true })
      .field({ batchNumber: true })
      .get()
    
    return result.data.map(item => item.batchNumber)
  } catch (error) {
    console.error('获取用户批次分配失败：', error)
    return []
  }
}

// 获取资源所属批次
async function getResourceBatch(resourceId, collection) {
  if (!collection || !resourceId) return null
  
  try {
    const result = await db.collection(collection)
      .doc(resourceId)
      .field({ batchNumber: true })
      .get()
    
    return result.data?.batchNumber
  } catch (error) {
    console.error('获取资源批次失败：', error)
    return null
  }
}

// 获取用户部门
async function getUserDepartment(openid) {
  try {
    const result = await db.collection('users')
      .where({ openid })
      .field({ department: true })
      .get()
    
    return result.data[0]?.department
  } catch (error) {
    console.error('获取用户部门失败：', error)
    return null
  }
}

// 检查角色限制
async function checkRestrictions(restrictions, context) {
  if (!restrictions) return true
  
  // 检查时间限制
  if (restrictions.timeRestrictions) {
    const now = new Date()
    const currentHour = now.getHours()
    const currentDay = now.getDay() || 7 // 将周日从0转为7
    
    const { allowedHours, allowedDays } = restrictions.timeRestrictions
    
    if (allowedHours && (currentHour < allowedHours[0] || currentHour > allowedHours[1])) {
      return false
    }
    
    if (allowedDays && !allowedDays.includes(currentDay)) {
      return false
    }
  }
  
  // 检查IP限制
  if (restrictions.allowedIpRanges && restrictions.allowedIpRanges.length > 0) {
    const userIp = context.SOURCE
    const isAllowedIp = restrictions.allowedIpRanges.some(range => 
      isIpInRange(userIp, range)
    )
    if (!isAllowedIp) {
      return false
    }
  }
  
  // 检查并发会话限制
  if (restrictions.maxConcurrentSessions) {
    const activeSessions = await getActiveUserSessions(context.OPENID)
    if (activeSessions >= restrictions.maxConcurrentSessions) {
      return false
    }
  }
  
  return true
}

// 检查IP是否在指定范围内
function isIpInRange(ip, range) {
  // 简单的IP范围检查实现
  // 支持单个IP和CIDR表示法
  if (range.includes('/')) {
    // CIDR表示法
    return isIpInCIDR(ip, range)
  } else {
    // 单个IP
    return ip === range
  }
}

// 检查IP是否在CIDR范围内
function isIpInCIDR(ip, cidr) {
  // 简化的CIDR检查实现
  const [network, prefixLength] = cidr.split('/')
  const prefix = parseInt(prefixLength)
  
  const ipParts = ip.split('.').map(Number)
  const networkParts = network.split('.').map(Number)
  
  const bitsToCheck = Math.floor(prefix / 8)
  const remainingBits = prefix % 8
  
  // 检查完整字节
  for (let i = 0; i < bitsToCheck; i++) {
    if (ipParts[i] !== networkParts[i]) {
      return false
    }
  }
  
  // 检查剩余位
  if (remainingBits > 0 && bitsToCheck < 4) {
    const mask = (0xFF << (8 - remainingBits)) & 0xFF
    if ((ipParts[bitsToCheck] & mask) !== (networkParts[bitsToCheck] & mask)) {
      return false
    }
  }
  
  return true
}

// 获取用户活跃会话数
async function getActiveUserSessions(openid) {
  try {
    const result = await db.collection('user_sessions')
      .where({
        openid,
        isActive: true,
        lastActivity: _.gt(new Date(Date.now() - 30 * 60 * 1000)) // 30分钟内活跃
      })
      .count()
    
    return result.total
  } catch (error) {
    console.error('获取用户会话数失败：', error)
    return 0
  }
}

// 记录权限检查日志
async function logPermissionCheck(openid, module, action, hasPermission, context) {
  try {
    await db.collection('permission_logs').add({
      data: {
        openid,
        module,
        action,
        hasPermission,
        timestamp: new Date(),
        source: 'permission_check',
        ipAddress: context.SOURCE,
        userAgent: context.USER_AGENT,
        requestId: context.REQUEST_ID
      }
    })
  } catch (error) {
    console.error('记录权限日志失败：', error)
  }
}
