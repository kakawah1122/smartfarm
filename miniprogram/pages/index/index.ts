// index.ts - 清理版本，只使用和风天气地理编码
Page({
  data: {
    // 状态栏信息
    statusBarHeight: 44,
    statusBarText: '9:41 AM • 中国移动 • 100%',
    
    // 天气数据
    weather: {
      temperature: 22,
      humidity: 65,
      condition: '晴',
      emoji: '☀️',
      feelsLike: 22,
      windDirection: '无风',
      windScale: '0级',
      updateTime: '刚刚更新'
    },
    
    // 位置信息
    location: {
      province: '江苏省',
      city: '苏州市',
      district: '吴中区'
    },
    
    // 鹅价数据
    priceUpdateTime: '09:30',
    goosePrice: {
      adult: '12.5',
      adultTrend: 1,
      adultChange: '+0.3',
      gosling: '8.2',
      goslingTrend: -1,
      goslingChange: '-0.1'
    },
    
    // 待办事项
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
    // 只刷新价格数据，天气数据使用缓存
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
  getWeatherData(forceRefresh = false) {
    return new Promise((resolve, reject) => {
      // 为了确保位置信息正确更新，先清除缓存
      if (forceRefresh) {
        console.log('🗑️ 强制刷新，清除天气缓存')
        this.clearWeatherCache()
      }
      
      // 如果不是强制刷新，首先尝试使用缓存数据
      if (!forceRefresh) {
        const cachedData = this.getCachedWeatherData()
        if (cachedData) {
          console.log('📦 使用缓存的天气数据')
          this.updateWeatherUI(cachedData)
          resolve(true)
          return
        }
      }
      
      // 显示加载状态
      this.setData({
        'weather.loading': true
      })
      
      // 获取位置和天气
      this.getLocationAndWeather().then(res => {
        if (res.result.success && res.result.data) {
          const weatherData = res.result.data
          
          // 缓存天气数据
          this.cacheWeatherData(weatherData)
          
          // 更新UI
          this.updateWeatherUI(weatherData)
          
          resolve(true)
        } else {
          const errorMsg = res.result?.message || res.result?.error || '天气数据获取失败'
          
          wx.showModal({
            title: '天气数据获取失败',
            content: errorMsg + '\n\n请检查网络连接或联系管理员',
            showCancel: false,
            confirmText: '确定'
          })
          
          throw new Error(errorMsg)
        }
      }).catch(err => {
        // 降级处理：使用默认数据
        this.setData({
          'weather.loading': false
        })
        
        wx.showToast({
          title: '天气加载失败',
          icon: 'none',
          duration: 2000
        })
        
        resolve(false)
      })
    })
  },

  // 获取位置并获取天气 - 使用GPS + 和风天气地理编码
  getLocationAndWeather() {
    return new Promise((resolve, reject) => {
      console.log('开始获取位置信息...')
      
      // 先检查位置权限
      wx.getSetting({
        success: (settingsRes) => {
          console.log('当前权限设置:', settingsRes.authSetting)
          
          if (settingsRes.authSetting['scope.userLocation'] === false) {
            // 用户拒绝过位置权限，需要引导用户去设置
            this.showLocationPermissionModal()
            reject(new Error('用户拒绝了位置权限'))
            return
          }
          
          // 获取用户GPS坐标 - 恢复标准实现
          wx.getLocation({
            type: 'gcj02', // 微信小程序标准坐标系
            altitude: false,
            isHighAccuracy: true,
            success: (locationRes) => {
              const { latitude, longitude, accuracy } = locationRes
              console.log(`获取位置成功: 纬度${latitude}, 经度${longitude}, 精度${accuracy}米`)
              
              // 调用和风天气API获取天气和位置信息
              wx.cloud.callFunction({
                name: 'weather',
                data: {
                  action: 'getCurrentWeather',
                  lat: latitude,
                  lon: longitude
                }
              }).then((weatherRes) => {
                console.log('云函数调用结果:', weatherRes)
                
                if (weatherRes.result && weatherRes.result.success) {
                  console.log('✅ 天气数据获取成功')
                  resolve(weatherRes)
                } else {
                  const errorMsg = weatherRes.result?.message || weatherRes.result?.error || '天气数据获取失败'
                  console.error('❌ 天气数据获取失败:', errorMsg)
                  reject(new Error(errorMsg))
                }
              }).catch((error) => {
                console.error('❌ 云函数调用失败:', error)
                reject(error)
              })
            },
            fail: (error) => {
              console.error('❌ 位置获取失败:', error)
              this.handleLocationError(error)
              reject(error)
            }
          })
        },
        fail: (error) => {
          console.error('❌ 获取设置失败:', error)
          reject(error)
        }
      })
    })
  },
  
  // 处理位置获取错误
  handleLocationError(error) {
    console.log('位置获取错误详情:', error)
    
    if (error.errMsg) {
      if (error.errMsg.includes('auth')) {
        // 权限问题
        this.showLocationPermissionModal()
      } else if (error.errMsg.includes('timeout')) {
        // 超时问题
        wx.showToast({
          title: '位置获取超时，请检查网络',
          icon: 'none',
          duration: 3000
        })
      } else if (error.errMsg.includes('fail')) {
        // 其他失败
        wx.showToast({
          title: '位置服务不可用',
          icon: 'none',
          duration: 3000
        })
      }
    }
  },
  
  // 显示位置权限引导弹窗
  showLocationPermissionModal() {
    wx.showModal({
      title: '需要位置权限',
      content: '为了给您提供准确的天气信息，需要获取您的位置。请在设置中开启位置权限。',
      showCancel: true,
      cancelText: '取消',
      confirmText: '去设置',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting({
            success: (settingRes) => {
              console.log('设置页面返回:', settingRes.authSetting)
              if (settingRes.authSetting['scope.userLocation']) {
                // 用户开启了权限，重新获取天气
                wx.showToast({
                  title: '正在重新获取天气...',
                  icon: 'loading'
                })
                setTimeout(() => {
                  this.getWeatherData(true)
                }, 1000)
              }
            }
          })
        }
      }
    })
  },

  // 更新天气 UI
  updateWeatherUI(weatherData) {
    console.log('🎨 更新天气UI，接收到的数据:', weatherData)
    console.log('📍 位置信息:', weatherData.locationInfo)
    
    // 确保位置信息正确更新
    const locationInfo = weatherData.locationInfo
    if (locationInfo) {
      console.log('✅ 使用新的位置信息:', locationInfo)
    } else {
      console.warn('⚠️ 未收到位置信息，保持当前位置显示')
    }
    
    this.setData({
      weather: {
        temperature: weatherData.current.temperature,
        humidity: weatherData.current.humidity,
        condition: weatherData.condition.text,
        emoji: weatherData.condition.emoji,
        feelsLike: weatherData.current.feelsLike,
        windDirection: weatherData.current.windDirection,
        windScale: weatherData.current.windScale,
        updateTime: this.formatUpdateTime(weatherData.current.updateTime),
        loading: false
      },
      // 强制更新位置信息，如果没有新位置信息则显示"获取中"
      location: locationInfo || {
        province: '位置获取中',
        city: '...',
        district: '...'
      }
    })
  },

  // 格式化更新时间
  formatUpdateTime(updateTime) {
    if (!updateTime) return '刚刚更新'
    
    try {
      const now = new Date()
      const update = new Date(updateTime)
      const diff = Math.floor((now.getTime() - update.getTime()) / 1000 / 60) // 分钟差
      
      if (diff < 1) return '刚刚更新'
      if (diff < 60) return `${diff}分钟前更新`
      if (diff < 24 * 60) return `${Math.floor(diff / 60)}小时前更新`
      return '超过1天前更新'
    } catch (error) {
      return '刚刚更新'
    }
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
      setTimeout(() => {
        resolve(true)
      }, 200)
    })
  },

  // 刷新天气数据
  refreshWeatherData() {
    this.getWeatherData(true)
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

  // 手动刷新天气数据
  onWeatherRefresh() {
    // 双击显示调试菜单
    const currentTime = Date.now()
    if (this.data.lastTapTime && currentTime - this.data.lastTapTime < 300) {
      this.showDebugMenu()
      return
    }
    this.setData({
      lastTapTime: currentTime
    })
    
    wx.showLoading({
      title: '获取天气中...',
      mask: true
    })
    
    // 强制刷新
    this.getWeatherData(true).then(() => {
      wx.hideLoading()
      wx.showToast({
        title: '天气更新成功',
        icon: 'success',
        duration: 1500
      })
    }).catch((error) => {
      wx.hideLoading()
      wx.showToast({
        title: '刷新失败',
        icon: 'error',
        duration: 1500
      })
    })
  },

  // 显示调试菜单（双击天气卡片触发）
  showDebugMenu() {
    const that = this
    wx.showActionSheet({
      itemList: ['🗑️ 清除天气缓存', '📍 强制获取天气'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0: // 清除天气缓存
            that.clearWeatherCache()
            wx.showToast({
              title: '缓存已清除',
              icon: 'success'
            })
            break
          case 1: // 强制获取天气
            that.forceGetWeather()
            break
        }
      }
    })
  },

  // 强制获取天气
  forceGetWeather() {
    wx.showLoading({ title: '强制获取天气...' })
    
    // 清除缓存
    this.clearWeatherCache()
    
    // 强制获取天气
    this.getWeatherData(true).then(() => {
      wx.hideLoading()
      wx.showToast({
        title: '获取成功',
        icon: 'success',
        duration: 2000
      })
    }).catch((error) => {
      wx.hideLoading()
      wx.showModal({
        title: '获取失败',
        content: error.errMsg || error.message || '获取天气失败',
        showCancel: false
      })
    })
  },

  // 缓存天气数据到本地存储
  cacheWeatherData(weatherData) {
    try {
      const cacheData = {
        data: weatherData,
        timestamp: Date.now(),
        expireTime: Date.now() + 60 * 60 * 1000 // 1小时过期
      }
      wx.setStorageSync('weather_cache', cacheData)
    } catch (error) {
      console.warn('天气数据缓存失败:', error)
    }
  },

  // 获取缓存的天气数据
  getCachedWeatherData() {
    try {
      const cacheData = wx.getStorageSync('weather_cache')
      if (cacheData && cacheData.expireTime > Date.now()) {
        return cacheData.data
      }
      return null
    } catch (error) {
      return null
    }
  },

  // 清除天气缓存
  clearWeatherCache() {
    try {
      wx.removeStorageSync('weather_cache')
    } catch (error) {
      console.warn('清除天气缓存失败:', error)
    }
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
  }
})
