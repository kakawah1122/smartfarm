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
      // 触发页面的返回事件，让页面自己处理返回逻辑
      this.triggerEvent('back')
    }
  }
})