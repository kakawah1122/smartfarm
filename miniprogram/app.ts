// app.ts

import CloudApi from './utils/cloud-api'

// 扩展全局数据类型
interface SubscriptionTemplateConfig {
  tmplId: string
  title: string
  description: string
  scene?: string
}

interface AppGlobalData {
  userInfo?: WechatMiniprogram.UserInfo;
  statusBarHeight?: number;
  navBarHeight?: number;
  openid?: string;
  isLoggedIn?: boolean;
  /**
   * 订阅消息模板配置，可在运行时注入真实模板 ID
   */
  subscriptionTemplates?: SubscriptionTemplateConfig[];
}

interface AppOption {
  globalData: AppGlobalData;
  setStatusBarHeight(): void;
  checkLoginStatus(): void;
  login(): Promise<void>;
  onError(error: string): void;
}

// 登录白名单页面（不需要登录就能访问的页面）
const LOGIN_WHITELIST = [
  '/packageUser/login/login',
]

App<AppOption>({
  globalData: {
    statusBarHeight: 44, // 默认状态栏高度
    navBarHeight: 88,    // 默认导航栏高度
    subscriptionTemplates: [
      // ⚠️ 部署前必填：在微信公众平台获取真实的订阅消息模板ID并替换下方配置
      // 获取方式：登录微信公众平台 -> 功能 -> 订阅消息 -> 公共模板库 -> 选择模板 -> 获取模板ID
      // 示例配置（请替换为真实模板ID）：
      // { tmplId: 'REAL_TEMPLATE_ID_1', title: '系统交互消息', description: '系统审批、任务通知等提醒' },
      // { tmplId: 'REAL_TEMPLATE_ID_2', title: '生产进度提醒', description: '生产计划、排行榜等动态提醒' }
    ]
  },
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV, // ✅ 按项目规范使用动态环境变量
        traceUser: false, // 禁用用户追踪以避免实时日志问题
      });
    }

    // 获取系统信息，设置状态栏高度
    this.setStatusBarHeight()
    
    // 检查用户登录状态
    this.checkLoginStatus()
    
    // 延迟跳转，避免onShow中的重复跳转
    setTimeout(() => {
      if (!this.globalData.isLoggedIn) {
        wx.reLaunch({
          url: '/packageUser/login/login'
        })
      }
    }, 100)
  },

  onShow() {
    // 每次小程序显示时都检查登录状态
    this.checkLoginStatus()
    
    // 避免重复跳转 - 只在非登录页且未登录时跳转
    setTimeout(() => {
      const pages = getCurrentPages()
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1]
        const currentRoute = `/${currentPage.route}`
        
        if (!this.globalData.isLoggedIn && !currentRoute.startsWith('/packageUser/login/login')) {
          wx.reLaunch({
            url: '/packageUser/login/login'
          })
        }
      }
    }, 100)
  },
  
  /**
   * 全局错误处理
   * 过滤掉已知的非致命错误，避免干扰用户
   */
  onError(error: string) {
    // 已知的非致命数据库 watch 状态机错误
    const knownWatchErrors = [
      'current state (CLOSED) does not accept',
      'current state (CONNECTED) does not accept',
      'initWatchFail',
      'connectionSuccess',
      'does not accept'
    ]
    
    // 检查是否为已知的 watch 状态错误
    const isKnownWatchError = knownWatchErrors.some(keyword => error.includes(keyword))
    
    if (isKnownWatchError) {
      // 静默处理，不输出错误日志
      // 这些错误通常在页面快速切换或网络不稳定时出现，不影响功能
      return
    }
    
    // 其他未知错误，记录到控制台
    console.error('App Error:', error)
  },

  // 设置状态栏高度
  setStatusBarHeight() {
    try {
      const windowInfo = wx.getWindowInfo()
      const statusBarHeight = windowInfo.statusBarHeight || 44
      const navBarHeight = 88 // rpx单位导航栏高度
      
      // 设置全局变量
      this.globalData.statusBarHeight = statusBarHeight
      this.globalData.navBarHeight = navBarHeight
      
      // 设置CSS变量  
      const statusBarHeightRpx = statusBarHeight * 2 // px转rpx
      
      // 动态设置CSS变量
      wx.nextTick(() => {
        const pages = getCurrentPages()
        if (pages.length > 0) {
          const currentPage = pages[pages.length - 1]
          if (currentPage && currentPage.setData) {
            currentPage.setData({
              statusBarHeight: statusBarHeightRpx,
              navBarHeight: navBarHeight,
              totalNavHeight: statusBarHeightRpx + navBarHeight
            })
          }
        }
      })
      

      
    } catch (error) {
      // 获取系统信息失败时使用默认值
    }
  },

  // 检查用户登录状态
  checkLoginStatus() {
    const openid = wx.getStorageSync('openid')
    const userInfo = wx.getStorageSync('userInfo')
    
    if (openid && userInfo) {
      this.globalData.openid = openid
      this.globalData.userInfo = userInfo
      this.globalData.isLoggedIn = true
    } else {
      this.globalData.isLoggedIn = false
    }
  },


  // 用户登录
  async login() {
    try {
      // 调用微信登录
      const loginRes = await CloudApi.callFunction<any>(
        'login',
        {},
        {
          showError: false
        }
      )
      
      const openid = loginRes?.openid ?? loginRes?.data?.openid
      
      if (openid) {
        this.globalData.openid = openid
        this.globalData.isLoggedIn = true
        
        // 保存到本地存储
        wx.setStorageSync('openid', openid)
        
      }
    } catch (error) {
      throw error
    }
  },
})