/**
 * 统一权限管理工具类
 * 提供整个小程序的权限检查、缓存和控制功能
 */

import { 
  ROLES, 
  MODULES, 
  ACTIONS, 
  PAGE_PERMISSIONS, 
  COMPONENT_PERMISSIONS,
  ROLE_NAMES,
  PERMISSION_CACHE_TIME,
  DEFAULT_PERMISSIONS,
  PERMISSION_ERRORS,
  validatePermissionConfig,
  isValidRole
} from './permission-config.js'

class PermissionManager {
  constructor() {
    this.currentUser = null
    this.userRoles = []
    this.permissionCache = new Map()
    this.cacheTimestamps = new Map()
  }

  /**
   * 初始化用户权限信息
   */
  async initializeUser() {
    try {
      // 获取当前用户信息
      const userInfo = wx.getStorageSync('userInfo')
      if (!userInfo) {
        console.warn('未找到用户信息')
        return false
      }

      this.currentUser = userInfo
      
      // 获取用户角色
      await this.loadUserRoles()
      
      return true
    } catch (error) {
      console.error('初始化用户权限失败：', error)
      return false
    }
  }

  /**
   * 加载用户角色信息
   */
  async loadUserRoles() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'get_user_roles',
          openid: this.currentUser.openid
        }
      })

      if (result.result.success) {
        this.userRoles = result.result.roles || []
        this.clearPermissionCache() // 角色变更时清空缓存
      } else {
        console.error('获取用户角色失败：', result.result.message)
        this.userRoles = []
      }
    } catch (error) {
      console.error('加载用户角色失败：', error)
      this.userRoles = []
    }
  }

  /**
   * 检查用户是否有特定权限
   */
  async checkPermission(module, action, resourceId = null, conditions = null) {
    // 检查基本参数
    if (!this.currentUser) {
      throw new Error(PERMISSION_ERRORS.LOGIN_REQUIRED)
    }

    if (!this.userRoles.length) {
      await this.loadUserRoles()
    }

    // 检查缓存
    const cacheKey = `${module}-${action}-${resourceId || 'null'}`
    const cachedResult = this.getFromCache(cacheKey)
    if (cachedResult !== null) {
      return cachedResult
    }

    try {
      // 调用云函数进行权限检查
      const result = await wx.cloud.callFunction({
        name: 'permission-check',
        data: {
          module,
          action,
          resourceId,
          additionalContext: conditions
        }
      })

      const hasPermission = result.result.success && result.result.hasPermission
      
      // 缓存结果
      this.setToCache(cacheKey, hasPermission)
      
      return hasPermission
    } catch (error) {
      console.error('权限检查失败：', error)
      return false
    }
  }

  /**
   * 检查页面访问权限
   */
  async checkPagePermission(pagePath) {
    // 检查是否为公共页面
    if (DEFAULT_PERMISSIONS.publicPages.includes(pagePath)) {
      return true
    }

    // 检查是否为需要登录的页面
    if (DEFAULT_PERMISSIONS.authPages.includes(pagePath)) {
      return !!this.currentUser
    }

    // 检查配置的页面权限
    const pageConfig = PAGE_PERMISSIONS[pagePath]
    if (!pageConfig) {
      console.warn(`未配置页面权限：${pagePath}`)
      return false
    }

    // 检查角色权限
    const hasRolePermission = this.hasAnyRole(pageConfig.allowedRoles)
    if (!hasRolePermission) {
      return false
    }

    // 如果有模块和操作要求，进行权限检查
    if (pageConfig.module && pageConfig.action) {
      return await this.checkPermission(
        pageConfig.module, 
        pageConfig.action, 
        null, 
        pageConfig.conditions
      )
    }

    return true
  }

  /**
   * 检查组件权限
   */
  async checkComponentPermission(componentId, context = {}) {
    const componentConfig = COMPONENT_PERMISSIONS[componentId]
    if (!componentConfig) {
      console.warn(`未配置组件权限：${componentId}`)
      return false
    }

    // 检查角色权限
    const hasRolePermission = this.hasAnyRole(componentConfig.allowedRoles)
    if (!hasRolePermission) {
      return false
    }

    // 动态确定模块（如果配置为null）
    let module = componentConfig.module
    if (!module && context.module) {
      module = context.module
    }

    // 如果有模块和操作要求，进行权限检查
    if (module && componentConfig.action) {
      return await this.checkPermission(
        module, 
        componentConfig.action, 
        context.resourceId, 
        context.conditions
      )
    }

    return true
  }

  /**
   * 检查用户是否拥有任一指定角色
   */
  hasAnyRole(allowedRoles) {
    if (!Array.isArray(allowedRoles) || !this.userRoles.length) {
      return false
    }

    return this.userRoles.some(userRole => 
      allowedRoles.includes(userRole.roleCode) && userRole.isActive
    )
  }

  /**
   * 检查用户是否拥有特定角色
   */
  hasRole(roleCode) {
    return this.userRoles.some(userRole => 
      userRole.roleCode === roleCode && userRole.isActive
    )
  }

  /**
   * 获取当前用户的所有角色
   */
  getCurrentRoles() {
    return this.userRoles.filter(role => role.isActive)
  }

  /**
   * 获取当前用户的最高级别角色
   */
  getHighestRole() {
    const activeRoles = this.getCurrentRoles()
    if (!activeRoles.length) return null

    // 按角色级别排序（级别越低越高级）
    activeRoles.sort((a, b) => a.level - b.level)
    return activeRoles[0]
  }

  /**
   * 获取角色显示名称
   */
  getRoleDisplayName(roleCode) {
    return ROLE_NAMES[roleCode] || roleCode
  }

  /**
   * 权限缓存管理
   */
  getFromCache(key) {
    const timestamp = this.cacheTimestamps.get(key)
    if (!timestamp || Date.now() - timestamp > PERMISSION_CACHE_TIME) {
      this.permissionCache.delete(key)
      this.cacheTimestamps.delete(key)
      return null
    }
    return this.permissionCache.get(key)
  }

  setToCache(key, value) {
    this.permissionCache.set(key, value)
    this.cacheTimestamps.set(key, Date.now())
  }

  clearPermissionCache() {
    this.permissionCache.clear()
    this.cacheTimestamps.clear()
  }

  /**
   * 权限装饰器 - 用于页面onLoad方法
   */
  requirePermission(pagePath) {
    return async function(options) {
      const hasPermission = await this.checkPagePermission(pagePath)
      if (!hasPermission) {
        wx.showModal({
          title: '访问受限',
          content: PERMISSION_ERRORS.NO_PERMISSION,
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
        return
      }
      
      // 调用原始的onLoad方法
      if (this.originalOnLoad) {
        return this.originalOnLoad.call(this, options)
      }
    }
  }

  /**
   * 权限检查中间件 - 用于导航拦截
   */
  async navigationGuard(url) {
    // 解析页面路径
    const pagePath = url.split('?')[0]
    
    const hasPermission = await this.checkPagePermission(pagePath)
    if (!hasPermission) {
      wx.showToast({
        title: PERMISSION_ERRORS.NO_PERMISSION,
        icon: 'none'
      })
      return false
    }
    
    return true
  }

  /**
   * 批量检查权限
   */
  async checkMultiplePermissions(permissions) {
    const results = {}
    
    for (const [key, config] of Object.entries(permissions)) {
      try {
        results[key] = await this.checkPermission(
          config.module,
          config.action,
          config.resourceId,
          config.conditions
        )
      } catch (error) {
        console.error(`检查权限失败 ${key}:`, error)
        results[key] = false
      }
    }
    
    return results
  }

  /**
   * 权限错误处理
   */
  handlePermissionError(error, context = {}) {
    let message = PERMISSION_ERRORS.NO_PERMISSION
    
    if (error.message) {
      message = error.message
    }
    
    console.error('权限错误：', error, context)
    
    wx.showModal({
      title: '权限不足',
      content: message,
      showCancel: false
    })
  }

  /**
   * 调试权限信息
   */
  debugPermissions() {
    console.group('权限调试信息')
    console.log('当前用户：', this.currentUser)
    console.log('用户角色：', this.userRoles)
    console.log('缓存大小：', this.permissionCache.size)
    console.log('最高级别角色：', this.getHighestRole())
    console.groupEnd()
  }
}

// 创建单例实例
const permissionManager = new PermissionManager()

// 导出单例和类
export default permissionManager
export { PermissionManager }

// 提供全局方法
export const checkPermission = permissionManager.checkPermission.bind(permissionManager)
export const checkPagePermission = permissionManager.checkPagePermission.bind(permissionManager)
export const checkComponentPermission = permissionManager.checkComponentPermission.bind(permissionManager)
export const hasRole = permissionManager.hasRole.bind(permissionManager)
export const getCurrentRoles = permissionManager.getCurrentRoles.bind(permissionManager)
