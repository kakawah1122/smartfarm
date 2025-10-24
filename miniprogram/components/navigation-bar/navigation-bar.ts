Component({
  properties: {
    title: {
      type: String,
      value: '智慧养鹅'
    },
    showBack: {
      type: Boolean,
      value: false
    }
  },

  data: {
    statusBarHeight: 44,
    navBarHeight: 44,
    capsuleWidth: 87
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
        
        // 胶囊按钮宽度（用于右侧预留空间）
        const capsuleWidth = menuButtonInfo.width
        
        this.setData({
          statusBarHeight,
          navBarHeight,
          capsuleWidth
        })
      } catch (error) {
        // 获取失败，使用默认值
        console.warn('获取导航栏信息失败，使用默认值')
      }
    },

    goBack() {
      // 返回上一页
      wx.navigateBack({
        delta: 1,
        fail: () => {
          // 返回失败，跳转到首页
          wx.switchTab({
            url: '/pages/index/index',
            fail: () => {
              wx.redirectTo({
                url: '/pages/index/index'
              })
            }
          })
        }
      })
      
      // 触发返回事件
      this.triggerEvent('back')
    }
  }
})
