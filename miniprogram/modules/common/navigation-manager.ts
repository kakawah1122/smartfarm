/**
 * 通用导航管理器
 * 提供整个应用的统一导航管理
 * 
 * @module common/navigation-manager
 * @since 1.0.0
 */

/// <reference path="../../../typings/index.d.ts" />

/**
 * 导航选项接口
 */
export interface NavigationOptions {
  url: string
  params?: Record<string, unknown>
  events?: Record<string, Function>
  success?: () => void
  fail?: (error: unknown) => void
  complete?: () => void
}

/**
 * 页面路由配置
 */
export interface RouteConfig {
  name: string
  path: string
  package?: string
  params?: string[]
}

/**
 * 通用导航管理器
 */
export class NavigationManager {
  // 路由表
  private static routes: Map<string, RouteConfig> = new Map()
  
  // 防重复点击时间间隔
  private static readonly CLICK_INTERVAL = 500
  
  // 上次点击时间
  private static lastClickTime = 0
  
  /**
   * 初始化路由表
   */
  static init() {
    // 主包页面
    this.registerRoute('index', { name: 'index', path: '/pages/index/index' })
    this.registerRoute('health', { name: 'health', path: '/pages/health/health' })
    this.registerRoute('production', { name: 'production', path: '/pages/production/production' })
    this.registerRoute('finance', { name: 'finance', path: '/pages/finance/finance' })
    this.registerRoute('user', { name: 'user', path: '/pages/user/user' })
    
    // 健康管理分包
    this.registerRoute('treatment-record', {
      name: 'treatment-record',
      path: '/packageHealth/treatment-record/treatment-record',
      package: 'packageHealth',
      params: ['id', 'mode']
    })
    
    this.registerRoute('vaccine-record', {
      name: 'vaccine-record',
      path: '/packageHealth/vaccine-record/vaccine-record',
      package: 'packageHealth',
      params: ['id', 'batchId', 'mode']
    })
    
    // AI分包
    this.registerRoute('ai-diagnosis', {
      name: 'ai-diagnosis',
      path: '/packageAI/ai-diagnosis/ai-diagnosis',
      package: 'packageAI',
      params: ['batchId']
    })
    
    this.registerRoute('diagnosis-history', {
      name: 'diagnosis-history',
      path: '/packageAI/diagnosis-history/diagnosis-history',
      package: 'packageAI'
    })
    
    // 生产管理分包
    this.registerRoute('batch-entry', {
      name: 'batch-entry',
      path: '/packageProduction/batch-entry/batch-entry',
      package: 'packageProduction',
      params: ['mode']
    })
    
    this.registerRoute('batch-exit', {
      name: 'batch-exit',
      path: '/packageProduction/batch-exit/batch-exit',
      package: 'packageProduction',
      params: ['batchId']
    })
    
    // 财务管理分包
    this.registerRoute('reimbursement', {
      name: 'reimbursement',
      path: '/packageFinance/reimbursement/reimbursement',
      package: 'packageFinance',
      params: ['type']
    })
    
    this.registerRoute('analysis-history', {
      name: 'analysis-history',
      path: '/packageFinance/analysis-history-list/analysis-history-list',
      package: 'packageFinance'
    })
  }
  
  /**
   * 注册路由
   */
  static registerRoute(name: string, config: RouteConfig) {
    this.routes.set(name, config)
  }
  
  /**
   * 获取路由配置
   */
  static getRoute(name: string): RouteConfig | undefined {
    return this.routes.get(name)
  }
  
  /**
   * 检查防重复点击
   */
  static checkDoubleClick(): boolean {
    const now = Date.now()
    if (now - this.lastClickTime < this.CLICK_INTERVAL) {
      return true // 重复点击
    }
    this.lastClickTime = now
    return false // 非重复点击
  }
  
  /**
   * 构建URL
   */
  static buildUrl(routeName: string, params?: Record<string, unknown>): string | null {
    const route = this.getRoute(routeName)
    if (!route) {
      console.error(`路由 ${routeName} 未找到`)
      return null
    }
    
    let url = route.path
    
    // 添加参数
    if (params && Object.keys(params).length > 0) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')
      url += '?' + queryString
    }
    
    return url
  }
  
  /**
   * 导航到指定页面（通过路由名）
   */
  static navigateTo(routeName: string, options?: Partial<NavigationOptions>) {
    if (this.checkDoubleClick()) {
      // 操作太频繁
      return Promise.reject(new Error('操作太频繁'))
    }
    
    const url = this.buildUrl(routeName, options?.params)
    if (!url) {
      return Promise.reject(new Error('路由未找到'))
    }
    
    return this.navigate(url, options)
  }
  
  /**
   * 导航到指定URL
   */
  static navigate(url: string, options?: Partial<NavigationOptions>) {
    return new Promise((resolve, reject) => {
      wx.navigateTo({
        url,
        events: options?.events,
        success: () => {
          options?.success?.()
          resolve(true)
        },
        fail: (error) => {
          console.error('导航失败:', error)
          options?.fail?.(error)
          reject(error)
        },
        complete: options?.complete
      })
    })
  }
  
  /**
   * 后退
   */
  static navigateBack(delta = 1) {
    return new Promise((resolve, reject) => {
      wx.navigateBack({
        delta,
        success: () => resolve(true),
        fail: (error) => reject(error)
      })
    })
  }
  
  /**
   * 重定向
   */
  static redirectTo(routeName: string, options?: Partial<NavigationOptions>) {
    const url = this.buildUrl(routeName, options?.params)
    if (!url) {
      return Promise.reject(new Error('路由未找到'))
    }
    
    return new Promise((resolve, reject) => {
      wx.redirectTo({
        url,
        success: () => {
          options?.success?.()
          resolve(true)
        },
        fail: (error) => {
          options?.fail?.(error)
          reject(error)
        },
        complete: options?.complete
      })
    })
  }
  
  /**
   * 切换Tab
   */
  static switchTab(tabName: string) {
    const url = this.buildUrl(tabName)
    if (!url) {
      return Promise.reject(new Error('Tab页面未找到'))
    }
    
    return new Promise((resolve, reject) => {
      wx.switchTab({
        url,
        success: () => resolve(true),
        fail: (error) => reject(error)
      })
    })
  }
  
  /**
   * 重新加载当前页面
   */
  static relaunch(routeName?: string, params?: Record<string, unknown>) {
    const url = routeName 
      ? this.buildUrl(routeName, params)
      : getCurrentPages()[getCurrentPages().length - 1].route
      
    if (!url) {
      return Promise.reject(new Error('页面路径错误'))
    }
    
    return new Promise((resolve, reject) => {
      wx.reLaunch({
        url: url.startsWith('/') ? url : '/' + url,
        success: () => resolve(true),
        fail: (error) => reject(error)
      })
    })
  }
  
  /**
   * 预加载分包
   */
  static preloadPackage(packageName: string) {
    if (wx.preloadSubpackage) {
      wx.preloadSubpackage({
        package: packageName,
        success: () => {},
        fail: (error: unknown) => console.error(`分包 ${packageName} 预加载失败:`, error)
      })
    }
  }
  
  /**
   * 获取当前页面路径
   */
  static getCurrentPath(): string {
    const pages = getCurrentPages()
    if (pages.length === 0) return ''
    
    const currentPage = pages[pages.length - 1]
    return '/' + currentPage.route
  }
  
  /**
   * 获取当前页面参数
   */
  static getCurrentParams(): Record<string, unknown> {
    const pages = getCurrentPages()
    if (pages.length === 0) return {}
    
    const currentPage = pages[pages.length - 1] as unknown
    return currentPage.options || {}
  }
}

/**
 * 初始化导航管理器
 */
NavigationManager.init()

/**
 * 导出便捷方法
 */
export const navigateTo = NavigationManager.navigateTo.bind(NavigationManager)
export const navigateBack = NavigationManager.navigateBack.bind(NavigationManager)
export const redirectTo = NavigationManager.redirectTo.bind(NavigationManager)
export const switchTab = NavigationManager.switchTab.bind(NavigationManager)
export const relaunch = NavigationManager.relaunch.bind(NavigationManager)
export const getCurrentPath = NavigationManager.getCurrentPath.bind(NavigationManager)
export const getCurrentParams = NavigationManager.getCurrentParams.bind(NavigationManager)

/**
 * 导出默认实例
 */
export default NavigationManager
