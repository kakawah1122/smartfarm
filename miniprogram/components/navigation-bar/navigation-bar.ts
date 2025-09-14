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
    statusBarHeight: {
      type: Number,
      value: 44
    }
  },

  attached() {
    // 获取系统状态栏高度
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight || 44
      })
    } catch (error) {
      // 获取系统信息失败，使用默认值
    }
  },

  methods: {
    goBack() {
      // 首先尝试返回上一页
      wx.navigateBack({
        delta: 1,
        success: () => {
          // 返回上一页成功
        },
        fail: (error) => {
          console.log('返回上一页失败，尝试跳转到首页:', error)
          // 如果返回失败（比如这是第一个页面），则跳转到首页
          wx.switchTab({
            url: '/pages/index/index',
            success: () => {
              // 跳转到首页成功
            },
            fail: (tabError) => {
              console.error('跳转到首页也失败:', tabError)
              // 最后尝试重定向到首页
              wx.redirectTo({
                url: '/pages/index/index'
              })
            }
          })
        }
      })
      
      // 同时触发页面的返回事件，让页面可以执行额外的清理工作
      this.triggerEvent('back')
    }
  }
})