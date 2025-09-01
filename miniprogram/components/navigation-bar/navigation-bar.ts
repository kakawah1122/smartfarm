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
    showMenu: {
      type: Boolean,
      value: true
    },
    showRecord: {
      type: Boolean,
      value: true
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
      console.error('获取系统信息失败:', error)
    }
  },

  methods: {
    goBack() {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      })
      this.triggerEvent('back')
    },

    onMenuTap() {
      this.triggerEvent('menu')
    },

    onRecordTap() {
      this.triggerEvent('record')
    }
  }
})