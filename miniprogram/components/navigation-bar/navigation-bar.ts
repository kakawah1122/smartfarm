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
    capsuleRight: 0  // 胶囊按钮右侧总宽度（包含间距）
  },

  attached() {
    this.setNavigationBarInfo()
  },

  methods: {
    // 设置导航栏信息
    setNavigationBarInfo() {
      try {
        // 获取系统信息
        const windowInfo = wx.getWindowInfo()
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
      // 先触发返回事件，允许页面自定义返回逻辑
      const event = this.triggerEvent('back', {}, { bubbles: true, composed: true })
      
      // 如果事件被阻止，则不执行默认返回
      if (event && event.defaultPrevented) {
        return
      }
      
      // 返回上一页
      wx.navigateBack({
        delta: 1,
        fail: () => {
          // 返回失败时的处理
          const fallbackUrl = this.properties.fallbackUrl
          
          if (fallbackUrl) {
            // 如果指定了备用页面，跳转到备用页面
            wx.redirectTo({
              url: fallbackUrl,
              fail: () => {
                // 备用页面跳转失败，尝试跳转到健康管理页
                this.goToHealthPage()
              }
            })
          } else {
            // 没有指定备用页面，跳转到健康管理页
            this.goToHealthPage()
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
