// utils/permission.ts

// 权限定义（与数据库 user_roles 保持一致）
export const PERMISSIONS: Record<string, string> = {
  // 通配符权限
  '*': '所有权限',
  'production.*': '生产管理（全部）',
  'health.*': '健康管理（全部）',
  'finance.*': '财务管理（全部）',
  'ai_diagnosis.*': 'AI诊断（全部）',
  'profile.*': '个人中心（全部）',
  // 生产管理
  'production.create': '生产-新增',
  'production.read': '生产-查看',
  'production.update': '生产-编辑',
  'production.update_own': '生产-编辑自己的',
  'production.delete': '生产-删除',
  // 健康管理
  'health.create': '健康-新增',
  'health.read': '健康-查看',
  'health.update': '健康-编辑',
  'health.update_own': '健康-编辑自己的',
  'health.delete': '健康-删除',
  'health.diagnose': '健康-诊断',
  // 财务管理
  'finance.create': '财务-新增',
  'finance.read': '财务-查看',
  'finance.update': '财务-编辑',
  'finance.delete': '财务-删除',
  'finance.approve': '财务-审批',
  // AI诊断
  'ai_diagnosis.create': 'AI诊断-新增',
  'ai_diagnosis.read': 'AI诊断-查看',
  'ai_diagnosis.validate': 'AI诊断-验证',
  // 用户管理
  'user.read': '用户-查看',
  'user.read_own': '用户-查看自己',
  'user.create': '用户-新增',
  'user.update': '用户-编辑',
  'user.delete': '用户-删除',
  'user.invite': '用户-邀请',
  'user.approve': '用户-审批',
  'user.update_role': '用户-修改角色',
  // 个人中心
  'profile.read': '个人中心-查看',
  'profile.update': '个人中心-编辑'
}

// 角色定义（与数据库 user_roles 保持一致）
export const ROLES: Record<string, string> = {
  'super_admin': '超级管理员',
  'manager': '经理',
  'employee': '员工',
  'veterinarian': '兽医'
}

// 角色颜色配置
export const ROLE_COLORS: Record<string, string> = {
  'super_admin': '#ff0000', // 深红色（超级管理员）
  'manager': '#f56c6c',     // 红色（经理）
  'employee': '#409eff',    // 蓝色（员工）
  'veterinarian': '#67c23a' // 绿色（兽医）
}

// 角色层级（数字越小权限越高）
export const ROLE_LEVELS: Record<string, number> = {
  'super_admin': 1,
  'manager': 2,
  'employee': 3,
  'veterinarian': 4
}

// 用户信息接口
interface UserInfo {
  role?: string
  permissions?: string[]
  [key: string]: unknown
}

// 菜单项接口
interface MenuItem {
  requiredPermission?: string
  [key: string]: unknown
}

/**
 * 权限管理工具类
 */
export class PermissionManager {
  
  /**
   * 检查单个权限是否匹配（支持通配符）
   * @param userPermission 用户拥有的权限
   * @param requiredPermission 需要的权限
   * @returns 是否匹配
   */
  private static matchPermission(userPermission: string, requiredPermission: string): boolean {
    // 完全匹配
    if (userPermission === requiredPermission) return true
    
    // 超级权限
    if (userPermission === '*') return true
    
    // 通配符匹配，如 production.* 匹配 production.read
    if (userPermission.endsWith('.*')) {
      const prefix = userPermission.slice(0, -2) // 去掉 .*
      return requiredPermission.startsWith(prefix + '.')
    }
    
    return false
  }
  
  /**
   * 检查用户是否有指定权限
   * @param userInfo 用户信息
   * @param permission 权限名称
   * @returns 是否有权限
   */
  static hasPermission(userInfo: UserInfo | null | undefined, permission: string): boolean {
    if (!userInfo) return false
    
    const role = userInfo.role || ''
    const permissions = userInfo.permissions || []
    
    // 超级管理员和经理拥有大部分权限
    if (role === 'super_admin') return true
    if (role === 'manager') {
      // 经理不能管理超管和系统设置
      if (permission === 'system.admin' || permission === 'user.manage_super_admin') {
        return false
      }
      return true
    }
    
    // 检查用户权限列表
    return permissions.some(userPerm => this.matchPermission(userPerm, permission))
  }
  
  /**
   * 检查用户是否有任一权限
   */
  static hasAnyPermission(userInfo: UserInfo | null | undefined, permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(userInfo, permission))
  }
  
  /**
   * 检查用户是否有所有权限
   */
  static hasAllPermissions(userInfo: UserInfo | null | undefined, permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(userInfo, permission))
  }
  
  /**
   * 获取角色显示名称
   */
  static getRoleDisplayName(role: string): string {
    return ROLES[role] || '未知角色'
  }
  
  /**
   * 获取权限显示名称
   */
  static getPermissionDisplayName(permission: string): string {
    return PERMISSIONS[permission] || permission
  }
  
  /**
   * 获取用户权限列表（包含显示名称）
   */
  static getUserPermissionList(userInfo: UserInfo | null | undefined): Array<{code: string, name: string}> {
    if (!userInfo || !userInfo.permissions) return []
    
    const role = userInfo.role || ''
    
    // 如果是超管或经理，返回所有权限
    if (role === 'super_admin' || role === 'manager') {
      return Object.entries(PERMISSIONS).map(([code, name]) => ({code, name}))
    }
    
    // 返回用户具体权限
    return userInfo.permissions.map((permission: string) => ({
      code: permission,
      name: this.getPermissionDisplayName(permission)
    }))
  }
  
  /**
   * 验证权限并显示提示
   */
  static validatePermission(userInfo: UserInfo | null | undefined, permission: string, showToast: boolean = true): boolean {
    const hasPerm = this.hasPermission(userInfo, permission)
    
    if (!hasPerm && showToast) {
      wx.showModal({
        title: '权限不足',
        content: `您需要 "${this.getPermissionDisplayName(permission)}" 权限才能访问此功能，请联系管理员`,
        showCancel: false
      })
    }
    
    return hasPerm
  }
  
  /**
   * 检查是否是管理员（超管或经理）
   */
  static isAdmin(userInfo: UserInfo | null | undefined): boolean {
    if (!userInfo) return false
    return userInfo.role === 'super_admin' || userInfo.role === 'manager'
  }
  
  /**
   * 检查是否是员工级别（员工、兽医、经理、超管）
   */
  static isEmployee(userInfo: UserInfo | null | undefined): boolean {
    if (!userInfo) return false
    return ['super_admin', 'manager', 'employee', 'veterinarian'].includes(userInfo.role || '')
  }
  
  /**
   * 检查是否可以管理目标用户
   */
  static canManageUser(currentUser: UserInfo | null | undefined, targetUserRole: string): boolean {
    if (!currentUser) return false
    
    const currentLevel = ROLE_LEVELS[currentUser.role || ''] || 999
    const targetLevel = ROLE_LEVELS[targetUserRole] || 999
    
    // 只能管理比自己层级低的用户
    return currentLevel < targetLevel
  }
  
  /**
   * 获取当前用户信息
   */
  static getCurrentUser(): UserInfo | null {
    try {
      const app = getApp()
      return app?.globalData?.userInfo || null
    } catch {
      return null
    }
  }
  
  /**
   * 过滤有权限的菜单项
   */
  static filterMenuByPermission(menuItems: MenuItem[], userInfo: UserInfo | null | undefined): MenuItem[] {
    return menuItems.filter(item => {
      if (!item.requiredPermission) return true
      return this.hasPermission(userInfo, item.requiredPermission)
    })
  }
}

/**
 * 权限装饰器（用于页面方法）
 * @param permission 所需权限
 * @param showToast 是否显示权限不足提示
 */
export function requirePermission(permission: string, showToast: boolean = true) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = function (...args: unknown[]) {
      const userInfo = PermissionManager.getCurrentUser()
      
      if (!PermissionManager.validatePermission(userInfo, permission, showToast)) {
        return
      }
      
      return originalMethod.apply(this, args)
    }
    
    return descriptor
  }
}

/**
 * 页面权限检查混入
 */
export const PermissionMixin = {
  /**
   * 检查权限
   */
  hasPermission(permission: string): boolean {
    const app = getApp()
    return PermissionManager.hasPermission(app.globalData.userInfo, permission)
  },
  
  /**
   * 验证权限
   */
  validatePermission(permission: string, showToast: boolean = true): boolean {
    const app = getApp()
    return PermissionManager.validatePermission(app.globalData.userInfo, permission, showToast)
  },
  
  /**
   * 是否是管理员
   */
  isAdmin(): boolean {
    const app = getApp()
    return PermissionManager.isAdmin(app.globalData.userInfo)
  },
  
  /**
   * 是否是员工
   */
  isEmployee(): boolean {
    const app = getApp()
    return PermissionManager.isEmployee(app.globalData.userInfo)
  }
}

// 兼容性函数，用于与旧代码保持一致
export function getRoleName(role: string): string {
  return ROLES[role as keyof typeof ROLES] || '未知角色'
}

export function getRoleColor(role: string): string {
  return ROLE_COLORS[role as keyof typeof ROLE_COLORS] || '#909399'
}

export function formatRoleDisplay(role: string, isSuper?: boolean): string {
  const roleName = getRoleName(role)
  return isSuper ? `超级${roleName}` : roleName
}
