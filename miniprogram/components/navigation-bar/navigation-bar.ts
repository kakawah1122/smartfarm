Component({
  properties: {
    title: {
      type: String,
      value: '智慧养鹅'
    },
    showBack: {
      type: Boolean,
      value: false
    },
    // 新增：返回失败时的备用页面
    fallbackUrl: {
      type: String,
      value: ''
    }
  },

  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    capsuleWidth: 87,
    capsuleRight: 0,  // 胶囊按钮右侧总宽度（包含间距）
    isNavigating: false  // 防止重复点击的标志
  },

  attached() {
    this.setNavigationBarInfo()
  },

  methods: {
    // 设置导航栏信息
    setNavigationBarInfo() {
      try {
        // 使用新的API获取窗口信息
        // 使用类型断言绕过TypeScript类型检查（类型定义文件还未更新）
        const windowInfo = (wx as any).getWindowInfo ? (wx as any).getWindowInfo() : {}
        const statusBarHeight = windowInfo.statusBarHeight || 44
        
        // 获取胶囊按钮信息
        const menuButtonInfo = wx.getMenuButtonBoundingClientRect()
        
        // 计算导航栏高度 = 胶囊按钮底部 - 状态栏高度
        const navBarHeight = (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height
        
        // 胶囊按钮宽度
        const capsuleWidth = menuButtonInfo.width
        
        // 计算胶囊按钮右侧总宽度 = 屏幕宽度 - 胶囊按钮左边距
        const capsuleRight = windowInfo.windowWidth - menuButtonInfo.left
        
        this.setData({
          statusBarHeight,
          navBarHeight,
          capsuleWidth,
          capsuleRight
        })
      } catch (error) {
        // 获取失败，使用默认值
      }
    },

    goBack() {
      // 防止重复点击
      if (this.data.isNavigating) {
        return
      }
      
      // 设置导航标志
      this.setData({ isNavigating: true })
      
      // 清除导航标志的函数
      const clearNavigating = () => {
        setTimeout(() => {
          this.setData({ isNavigating: false })
        }, 500) // 500ms后允许再次点击
      }
      
      // 检查当前页面是否定义了goBack方法（通常表示页面绑定了back事件）
      const pages = getCurrentPages()
      const currentPage = pages.length > 0 ? pages[pages.length - 1] : null
      const hasBackEventListener = currentPage && typeof (currentPage as any).goBack === 'function'
      
      if (hasBackEventListener) {
        // 如果页面绑定了back事件，只触发事件，让页面处理返回逻辑
        this.triggerEvent('back', {}, { bubbles: true, composed: true })
        clearNavigating()
        return
      }
      
      // 如果页面没有绑定back事件，执行默认返回
      wx.navigateBack({
        delta: 1,
        success: () => {
          clearNavigating()
        },
        fail: () => {
          // 返回失败时的处理
          const fallbackUrl = this.properties.fallbackUrl
          
          if (fallbackUrl) {
            // 如果指定了备用页面，跳转到备用页面
            wx.redirectTo({
              url: fallbackUrl,
              success: clearNavigating,
              fail: () => {
                // 备用页面跳转失败，尝试跳转到首页
                wx.switchTab({
                  url: '/pages/index/index',
                  complete: clearNavigating
                })
              }
            })
          } else {
            // 没有指定备用页面，跳转到首页
            wx.switchTab({
              url: '/pages/index/index',
              complete: clearNavigating
            })
          }
        }
      })
    },
    
    // 跳转到健康管理页
    goToHealthPage() {
      wx.switchTab({
        url: '/pages/health/health',
        fail: () => {
          // 如果健康管理页不是 tab 页，使用 redirectTo
          wx.redirectTo({
            url: '/pages/health/health',
            fail: () => {
              // 最后尝试跳转到首页
              wx.switchTab({
                url: '/pages/index/index'
              })
            }
          })
        }
      })
    }
  }
})
