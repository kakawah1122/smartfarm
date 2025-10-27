// 最简单的 JS 页面（不使用 TypeScript）
Page({
  data: {
    currentTime: ''
  },

  onLoad() {
    console.log('===== 测试页面加载成功 =====')
    console.log('如果您能看到这条消息，说明 console 工作正常')
    
    this.setData({
      currentTime: new Date().toLocaleString()
    })
    
    wx.showToast({
      title: '页面加载成功！',
      icon: 'success'
    })
  }
})

