// app.ts

// 扩展全局数据类型
interface AppGlobalData {
  userInfo?: WechatMiniprogram.UserInfo;
  statusBarHeight?: number;
  navBarHeight?: number;
}

interface AppOption {
  globalData: AppGlobalData;
  setStatusBarHeight(): void;
}

App<AppOption>({
  globalData: {
    statusBarHeight: 44, // 默认状态栏高度
    navBarHeight: 88,    // 默认导航栏高度
  },
  onLaunch() {
    // 获取系统信息，设置状态栏高度
    this.setStatusBarHeight()
    
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        console.log(res.code)
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      },
    })
  },

  // 设置状态栏高度
  setStatusBarHeight() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      const statusBarHeight = systemInfo.statusBarHeight || 44
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
      
      console.log('状态栏高度设置:', {
        statusBarHeight: statusBarHeight,
        statusBarHeightRpx: statusBarHeightRpx,
        navBarHeight: navBarHeight,
        systemInfo: systemInfo
      })
      
    } catch (error) {
      console.error('获取系统信息失败:', error)
    }
  },
})