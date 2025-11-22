// utils/permission.ts

// 权限定义
export const PERMISSIONS = {
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

// 角色定义
export const ROLES = {
  'super_admin': '超级管理员',
  'admin': '管理员',
  'employee': '员工',
  'user': '普通用户'
}

// 角色颜色配置
export const ROLE_COLORS = {
  'super_admin': '#ff0000', // 深红色（超级管理员）
  'admin': '#f56c6c',       // 红色（管理员）
  'employee': '#409eff',    // 蓝色（员工）
  'user': '#67c23a'         // 绿色（普通用户）
}

// 角色默认权限
export const ROLE_PERMISSIONS = {
  'super_admin': ['all'],
  'admin': ['all'],
  'employee': ['basic', 'production.view', 'health.view'],
  'user': ['basic']
}

/**
 * 权限管理工具类
 */
export class PermissionManager {
  
  /**
   * 检查用户是否有指定权限
   * @param userInfo 用户信息
   * @param permission 权限名称
   * @returns 是否有权限
   */
  static hasPermission(userInfo: unknown, permission: string): boolean {
    if (!userInfo) return false
    
    // 🔧 关键修复：管理员和超级管理员都拥有所有权限
    if (userInfo.role === 'admin' || userInfo.role === 'super_admin') return true
    
    // 检查是否有所有权限
    if (userInfo.permissions && userInfo.permissions.includes('all')) return true
    
    // 检查特定权限
    if (userInfo.permissions && userInfo.permissions.includes(permission)) return true
    
    return false
  }
  
  /**
   * 检查用户是否有任一权限
   * @param userInfo 用户信息
   * @param permissions 权限列表
   * @returns 是否有任一权限
   */
  static hasAnyPermission(userInfo: unknown, permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(userInfo, permission))
  }
  
  /**
   * 检查用户是否有所有权限
   * @param userInfo 用户信息
   * @param permissions 权限列表
   * @returns 是否有所有权限
   */
  static hasAllPermissions(userInfo: unknown, permissions: string[]): boolean {
    return permissions.every(permission => this.hasPermission(userInfo, permission))
  }
  
  /**
   * 获取角色显示名称
   * @param role 角色代码
   * @returns 角色显示名称
   */
  static getRoleDisplayName(role: string): string {
    return ROLES[role as keyof typeof ROLES] || '未知角色'
  }
  
  /**
   * 获取权限显示名称
   * @param permission 权限代码
   * @returns 权限显示名称
   */
  static getPermissionDisplayName(permission: string): string {
    return PERMISSIONS[permission as keyof typeof PERMISSIONS] || '未知权限'
  }
  
  /**
   * 获取用户权限列表（包含显示名称）
   * @param userInfo 用户信息
   * @returns 权限列表
   */
  static getUserPermissionList(userInfo: unknown): Array<{code: string, name: string}> {
    if (!userInfo || !userInfo.permissions) return []
    
    // 如果是管理员或拥有所有权限，返回所有权限
    if (userInfo.role === 'admin' || userInfo.permissions.includes('all')) {
      return Object.entries(PERMISSIONS).map(([code, name]) => ({code, name}))
    }
    
    // 返回用户具体权限
    return userInfo.permissions
      .filter((permission: string) => PERMISSIONS[permission as keyof typeof PERMISSIONS])
      .map((permission: string) => ({
        code: permission,
        name: this.getPermissionDisplayName(permission)
      }))
  }
  
  /**
   * 验证权限并显示提示
   * @param userInfo 用户信息
   * @param permission 权限名称
   * @param showToast 是否显示提示
   * @returns 是否有权限
   */
  static validatePermission(userInfo: unknown, permission: string, showToast: boolean = true): boolean {
    const hasPermission = this.hasPermission(userInfo, permission)
    
    if (!hasPermission && showToast) {
      wx.showModal({
        title: '权限不足',
        content: `您需要 "${this.getPermissionDisplayName(permission)}" 权限才能访问此功能，请联系管理员`,
        showCancel: false
      })
    }
    
    return hasPermission
  }
  
  /**
   * 检查是否是管理员
   * @param userInfo 用户信息
   * @returns 是否是管理员
   */
  static isAdmin(userInfo: unknown): boolean {
    return userInfo && userInfo.role === 'admin'
  }
  
  /**
   * 检查是否是员工
   * @param userInfo 用户信息
   * @returns 是否是员工
   */
  static isEmployee(userInfo: unknown): boolean {
    return userInfo && (userInfo.role === 'employee' || userInfo.role === 'admin')
  }
  
  /**
   * 获取当前用户信息
   * @returns 用户信息
   */
  static getCurrentUser(): unknown {
    const app = getApp()
    return app.globalData.userInfo
  }
  
  /**
   * 过滤有权限的菜单项
   * @param menuItems 菜单项列表
   * @param userInfo 用户信息
   * @returns 过滤后的菜单项
   */
  static filterMenuByPermission(menuItems: unknown[], userInfo: unknown): unknown[] {
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
