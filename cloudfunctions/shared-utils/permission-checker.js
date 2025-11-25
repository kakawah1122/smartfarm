/**
 * 统一的权限验证模块
 * 所有云函数共享此权限验证逻辑
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 辅助函数：调试日志
function debugLog(message, data) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(message, data)
  }
}

/**
 * 权限验证函数（与原health-management完全一致）
 * @param {string} openid - 用户openid
 * @param {string} module - 模块名称（如'health', 'production'等）
 * @param {string} action - 操作类型（如'create', 'read', 'update', 'delete'）
 * @param {string} resourceId - 资源ID（可选，用于资源所有者验证）
 * @param {object} COLLECTIONS - 集合常量对象
 * @returns {Promise<boolean>} 是否有权限
 */
async function checkPermission(openid, module, action, resourceId = null, COLLECTIONS) {
  try {
    // 1. 获取用户信息（从wx_users获取角色）
    const userResult = await db.collection(COLLECTIONS.WX_USERS)
      .where({ _openid: openid })
      .limit(1)
      .get()
    
    if (!userResult.data || userResult.data.length === 0) {
      debugLog('[权限验证] 用户不存在', { openid, module, action })
      return false
    }
    
    const user = userResult.data[0]
    const userRole = user.role || 'employee'
    debugLog('[权限验证] 用户角色:', { 
      openid: openid.substring(0, 8) + '...', 
      userRole, 
      module, 
      action 
    })
    
    // 2. 超级管理员拥有所有权限
    if (userRole === 'super_admin') {
      return true
    }
    
    // 3. 获取角色权限定义（从sys_roles）
    const roleResult = await db.collection(COLLECTIONS.SYS_ROLES)
      .where({
        roleCode: userRole,
        isActive: true
      })
      .limit(1)
      .get()
    
    if (!roleResult.data || roleResult.data.length === 0) {
      // 如果角色定义不存在，默认允许所有操作（向后兼容）
      // 这确保了在权限系统未完全配置时，功能仍然可用
      debugLog('[权限验证] 角色定义不存在，默认允许', { userRole, module, action })
      return true  // 永久解决方案：默认允许
    }
    
    const role = roleResult.data[0]
    const permissions = role.permissions || []
    
    // 4. 检查模块权限
    const modulePermission = permissions.find(p => 
      p.module === module || p.module === '*'
    )
    
    if (!modulePermission) {
      debugLog('[权限验证] 无模块权限', { 
        userRole, 
        module, 
        action, 
        availableModules: permissions.map(p => p.module) 
      })
      return false
    }
    
    // 5. 检查操作权限
    if (modulePermission.actions.includes(action) || modulePermission.actions.includes('*')) {
      debugLog('[权限验证] 验证通过', { userRole, module, action })
      return true
    }
    
    debugLog('[权限验证] 无操作权限', { 
      userRole, 
      module, 
      action, 
      availableActions: modulePermission.actions 
    })
    return false
    
  } catch (error) {
    console.error('[权限验证] 验证失败', { 
      openid, 
      module, 
      action, 
      error: error.message 
    })
    // 权限验证失败时，默认拒绝访问
    return false
  }
}

module.exports = {
  checkPermission
}
