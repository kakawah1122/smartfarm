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
    
    // 位置信息 - 动态获取，不使用硬编码
    location: {
      province: '定位中...',
      city: '获取位置信息...',
      district: '请稍候...'
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
    // 检查天气缓存是否过期，如果过期则自动刷新
    this.checkAndAutoRefreshWeather()
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

  // 获取位置并获取天气 - 彻底重写，确保获取真实位置
  getLocationAndWeather() {
    return new Promise((resolve, reject) => {
      console.log('🌍 === 开始获取真实地理位置 ===')
      
      // 先检查位置权限
      wx.getSetting({
        success: (settingsRes) => {
          console.log('🌍 当前权限设置:', settingsRes.authSetting)
          console.log('🌍 位置权限状态:', settingsRes.authSetting['scope.userLocation'])
          
          if (settingsRes.authSetting['scope.userLocation'] === false) {
            console.error('🌍 用户已拒绝位置权限')
            this.showLocationPermissionModal()
            reject(new Error('用户拒绝了位置权限'))
            return
          }
          
          // 强制获取高精度位置
          console.log('🌍 开始调用wx.getLocation...')
          wx.getLocation({
            type: 'gcj02', // 微信小程序标准坐标系
            isHighAccuracy: true,
            success: (locationRes) => {
              const { latitude, longitude, accuracy, speed, altitude } = locationRes
              console.log('🌍 === 位置获取成功 ===')
              console.log(`🌍 纬度: ${latitude}`)
              console.log(`🌍 经度: ${longitude}`)
              console.log(`🌍 精度: ${accuracy}米`)
              console.log(`🌍 速度: ${speed}`)
              console.log(`🌍 海拔: ${altitude}`)
              console.log('🌍 完整位置对象:', locationRes)
              
              // 验证坐标有效性
              if (!latitude || !longitude || latitude === 0 || longitude === 0) {
                console.error('🌍 获取到的坐标无效:', { latitude, longitude })
                reject(new Error('获取到的坐标无效'))
                return
              }
              
              // 立即更新前端显示为"定位成功"
              this.setData({
                location: {
                  province: '定位成功',
                  city: '正在解析位置...',
                  district: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                }
              })
              
              // 调用和风天气API获取完整天气信息（包括实时、预报、空气质量等）
              wx.cloud.callFunction({
                name: 'weather',
                data: {
                  action: 'getCompleteWeather',
                  lat: latitude,
                  lon: longitude
                }
              }).then((weatherRes) => {
                console.log('=== 详细调试信息 ===')
                console.log('云函数调用结果完整数据:', JSON.stringify(weatherRes, null, 2))
                console.log('result字段:', weatherRes.result)
                console.log('success字段:', weatherRes.result?.success)
                console.log('data字段:', weatherRes.result?.data)
                console.log('error字段:', weatherRes.result?.error)
                console.log('==================')
                
                if (weatherRes.result && weatherRes.result.success) {
                  console.log('✅ 天气数据获取成功')
                  console.log('返回的天气数据结构:', weatherRes.result.data)
                  resolve(weatherRes)
                } else {
                  // 处理云函数返回的错误信息
                  let errorMsg = '天气数据获取失败'
                  if (weatherRes.result?.error) {
                    if (typeof weatherRes.result.error === 'object') {
                      errorMsg = weatherRes.result.error.message || weatherRes.result.error.code || errorMsg
                    } else {
                      errorMsg = weatherRes.result.error
                    }
                  } else if (weatherRes.result?.message) {
                    errorMsg = weatherRes.result.message
                  }
                  
                  console.error('❌ 天气数据获取失败:', errorMsg)
                  console.error('完整错误信息:', weatherRes.result)
                  console.error('完整响应:', JSON.stringify(weatherRes, null, 2))
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
    
    // 适配新的云函数数据格式
    let actualWeatherData = weatherData
    
    // 如果是新格式的数据结构（带有data字段）
    if (weatherData.data && weatherData.data.current) {
      actualWeatherData = weatherData.data
      console.log('📦 检测到新格式数据结构')
    }
    
    console.log('📍 位置信息:', actualWeatherData.locationInfo)
    
    // 确保位置信息正确更新 - 彻底清除固定位置
    const locationInfo = actualWeatherData.locationInfo
    if (locationInfo) {
      console.log('✅ 使用真实地理位置信息:', locationInfo)
      // 立即更新位置信息，清除"苏州市吴中区"等硬编码位置
      this.setData({
        location: {
          province: locationInfo.province || '当前位置',
          city: locationInfo.city || '实时定位', 
          district: locationInfo.district || '周边区域'
        }
      })
    } else {
      console.warn('⚠️ 未收到位置信息，使用默认显示')
      this.setData({
        location: {
          province: '当前位置',
          city: '实时定位',
          district: '获取中...'
        }
      })
    }
    
    // 安全地获取天气数据
    const currentWeather = actualWeatherData.current || {}
    const conditionInfo = actualWeatherData.condition || {}
    
    this.setData({
      weather: {
        temperature: currentWeather.temperature || this.data.weather.temperature,
        humidity: currentWeather.humidity || this.data.weather.humidity,
        condition: conditionInfo.text || this.data.weather.condition,
        emoji: conditionInfo.emoji || this.data.weather.emoji,
        feelsLike: currentWeather.feelsLike || this.data.weather.feelsLike,
        windDirection: currentWeather.windDirection || this.data.weather.windDirection,
        windScale: currentWeather.windScale || this.data.weather.windScale,
        updateTime: this.formatUpdateTime(currentWeather.updateTime) || '刚刚更新',
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

  // 跳转到天气详情页
  navigateToWeatherDetail() {
    wx.navigateTo({
      url: '/pages/weather-detail/weather-detail'
    })
  },

  // 手动刷新天气数据
  onWeatherRefresh(event: any) {
    // 阻止事件冒泡，防止触发卡片点击跳转
    if (event) {
      event.stopPropagation()
    }
    
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

  // 检查并自动刷新天气
  checkAndAutoRefreshWeather() {
    try {
      const cacheData = wx.getStorageSync('weather_cache')
      if (!cacheData) {
        console.log('没有天气缓存，不需要自动刷新')
        return
      }

      const now = Date.now()
      const cacheTime = cacheData.timestamp || 0
      const oneHour = 60 * 60 * 1000 // 1小时的毫秒数

      // 检查缓存是否超过1小时
      if (now - cacheTime > oneHour) {
        console.log('天气缓存已过期，自动刷新天气数据')
        
        // 静默刷新，不显示loading
        this.getWeatherData(true).then(() => {
          console.log('天气数据自动刷新成功')
          // 可以显示一个轻量提示
          wx.showToast({
            title: '天气已更新',
            icon: 'none',
            duration: 1000
          })
        }).catch((error) => {
          console.error('天气数据自动刷新失败:', error)
          // 静默失败，不干扰用户体验
        })
      } else {
        const remainingTime = Math.floor((oneHour - (now - cacheTime)) / 1000 / 60)
        console.log(`天气缓存还有 ${remainingTime} 分钟过期`)
      }
    } catch (error) {
      console.warn('检查天气缓存失败:', error)
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
