// index.ts - 严格按照原型图实现
Page({
  data: {
    // 状态栏信息
    statusBarHeight: 44,
    statusBarText: '9:41 AM • 中国移动 • 100%',
    
    // 天气数据 - 与原型图一致
    weather: {
      temperature: 22,
      humidity: 65
    },
    
    // 鹅价数据 - 与原型图一致
    priceUpdateTime: '09:30',
    goosePrice: {
      adult: '12.5',
      adultTrend: 1,
      adultChange: '+0.3',
      gosling: '8.2',
      goslingTrend: -1,
      goslingChange: '-0.1'
    },
    
    // 待办事项 - 与原型图一致
    todoList: [
      {
        id: 1,
        content: '3号鹅舍预计今日出栏',
        priority: 'danger',
        priorityText: '紧急',
        tagTheme: 'danger'
      },
      {
        id: 2,
        content: '10只鹅需接种疫苗',
        priority: 'warning',
        priorityText: '重要',
        tagTheme: 'warning'
      },
      {
        id: 3,
        content: '饲料库存不足提醒',
        priority: 'primary',
        priorityText: '普通',
        tagTheme: 'primary'
      }
    ]
  },

  onLoad() {
    this.initStatusBar()
    this.loadData()
  },

  onShow() {
    this.refreshWeatherData()
    this.refreshPriceData()
  },

  // 初始化状态栏
  initStatusBar() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      const statusBarHeight = systemInfo.statusBarHeight || 44
      const now = new Date()
      const timeStr = now.toTimeString().slice(0, 5)
      
      this.setData({
        statusBarHeight,
        statusBarText: `${timeStr} • 中国移动 • 100%`
      })

    } catch (error) {
      // 状态栏初始化失败，使用默认值
    }
  },

  // 加载数据
  loadData() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })
    
    Promise.all([
      this.getWeatherData(),
      this.getGoosePriceData(),
      this.getTodoListData()
    ]).then(() => {
      wx.hideLoading()
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    })
  },

  // 获取天气数据
  getWeatherData() {
    return new Promise((resolve) => {
      // 模拟API调用
      setTimeout(() => {
        const temperature = Math.floor(Math.random() * 15) + 15 // 15-30度
        const humidity = Math.floor(Math.random() * 30) + 50 // 50-80%
        this.setData({
          weather: { temperature, humidity }
        })
        resolve(true)
      }, 300)
    })
  },

  // 获取鹅价数据
  getGoosePriceData() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const now = new Date()
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        
        // 模拟价格波动
        const adultPrice = (Math.random() * 5 + 10).toFixed(1)
        const adultTrend = Math.random() > 0.5 ? 1 : -1
        const adultChange = (Math.random() * 1).toFixed(1)
        
        const goslingPrice = (Math.random() * 3 + 6).toFixed(1)
        const goslingTrend = Math.random() > 0.5 ? 1 : -1
        const goslingChange = (Math.random() * 0.5).toFixed(1)
        
        this.setData({
          priceUpdateTime: timeStr,
          goosePrice: {
            adult: adultPrice,
            adultTrend,
            adultChange: `${adultTrend > 0 ? '+' : ''}${adultChange}`,
            gosling: goslingPrice,
            goslingTrend,
            goslingChange: `${goslingTrend > 0 ? '+' : ''}${goslingChange}`
          }
        })
        resolve(true)
      }, 500)
    })
  },

  // 获取待办事项
  getTodoListData() {
    return new Promise((resolve) => {
      // 实际开发中这里会调用云函数或API
      setTimeout(() => {
        resolve(true)
      }, 200)
    })
  },

  // 刷新天气数据
  refreshWeatherData() {
    this.getWeatherData()
  },

  // 刷新价格数据
  refreshPriceData() {
    this.getGoosePriceData()
  },

  // 查看全部待办
  viewAllTodos() {
    wx.showToast({
      title: '跳转到待办页面',
      icon: 'none',
      duration: 1500
    })

  },

  // 下拉刷新
  onPullDownRefresh() {
    
    Promise.all([
      this.refreshWeatherData(),
      this.refreshPriceData(),
      this.getTodoListData()
    ]).then(() => {
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      })
    }).catch(() => {
      wx.showToast({
        title: '刷新失败',
        icon: 'error'
      })
    }).finally(() => {
      setTimeout(() => {
        wx.stopPullDownRefresh()
      }, 1000)
    })
  },




})