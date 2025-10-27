// pages/test-blank/test-blank.ts
Page({
  data: {
  },

  onLoad() {
    console.log('测试页面加载成功！')
  },

  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  }
})

