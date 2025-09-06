// 登录守卫工具
// 在每个需要登录的页面中使用

// 登录白名单页面
const LOGIN_WHITELIST = [
  '/pages/login/login',
]

/**
 * 检查当前页面是否需要登录
 * 在页面的 onLoad 中调用此方法
 */
export function checkPageAuth() {
  const app = getApp<IAppOption>()
  const pages = getCurrentPages()
  
  if (pages.length === 0) return true
  
  const currentPage = pages[pages.length - 1]
  const currentRoute = `/${currentPage.route}`
  
  // 检查是否在白名单中
  const isWhitelisted = LOGIN_WHITELIST.some(path => currentRoute.startsWith(path))
  
  if (!isWhitelisted && !app.globalData.isLoggedIn) {
    console.log(`页面 ${currentRoute} 需要登录，但用户未登录，直接跳转`)
    
    // 直接跳转，不显示弹窗
    wx.reLaunch({
      url: '/pages/login/login'
    })
    
    return false
  }
  
  return true
}

/**
 * 页面路由守卫装饰器
 * 在页面配置中使用
 */
export function withAuthGuard<T extends WechatMiniprogram.Page.Options<any, any>>(pageConfig: T): T {
  const originalOnLoad = pageConfig.onLoad
  
  pageConfig.onLoad = function(options) {
    // 检查登录状态
    if (!checkPageAuth()) {
      return // 如果未登录，停止页面加载
    }
    
    // 如果已登录，继续正常页面加载
    if (originalOnLoad) {
      originalOnLoad.call(this, options)
    }
  }
  
  return pageConfig
}
