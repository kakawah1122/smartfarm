// index.ts - 清理版本，只使用和风天气地理编码
import { checkPageAuth } from '../../utils/auth-guard'

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
      updateTime: '刚刚更新',
      loading: false,
      hasError: false
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
    ],
    
    // AI智能建议
    aiAdvice: {
      loading: false,
      result: null as any,
      error: null as string | null,
      lastUpdateTime: null as string | null
    }
  },

  onLoad() {
    // 检查登录状态
    if (!checkPageAuth()) {
      return // 如果未登录，停止页面加载
    }
    
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

  // 获取位置和天气 - 修复Promise返回问题
  getLocationAndWeather() {
    return new Promise((resolve, reject) => {
      console.log('🌍 === 首页开始获取真实地理位置 ===')
      
      // 先检查位置权限
      wx.getSetting({
        success: (settingsRes) => {
          console.log('🌍 首页权限设置:', settingsRes.authSetting)
          console.log('🌍 首页位置权限状态:', settingsRes.authSetting['scope.userLocation'])
          
          if (settingsRes.authSetting['scope.userLocation'] === false) {
            console.error('🌍 首页：用户已拒绝位置权限')
            this.showLocationPermissionModal()
            reject(new Error('用户拒绝了位置权限'))
            return
          }
          
          // 强制获取高精度位置
          console.log('🌍 首页开始调用wx.getLocation...')
          wx.getLocation({
            type: 'gcj02',
            isHighAccuracy: true,
            success: (locationRes) => {
              const { latitude, longitude, accuracy, speed, altitude } = locationRes
              console.log('🌍 === 首页位置获取成功 ===')
              console.log(`🌍 首页纬度: ${latitude}`)
              console.log(`🌍 首页经度: ${longitude}`)
              console.log(`🌍 首页精度: ${accuracy}米`)
              console.log(`🌍 首页速度: ${speed}`)
              console.log(`🌍 首页海拔: ${altitude}`)
              console.log('🌍 首页完整位置对象:', locationRes)
              
              // 验证坐标有效性
              if (!latitude || !longitude || latitude === 0 || longitude === 0) {
                console.error('🌍 首页获取到的坐标无效:', { latitude, longitude })
                reject(new Error('获取到的坐标无效'))
                return
              }
              
              // 立即更新首页显示为"定位成功"
              this.setData({
                location: {
                  province: '定位成功',
                  city: '正在解析位置...',
                  district: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                }
              })

              console.log('🌍 首页开始调用天气云函数...')
              wx.cloud.callFunction({
                name: 'weather',
                data: {
                  action: 'getCompleteWeather',
                  lat: latitude,
                  lon: longitude
                }
              }).then((result) => {
                console.log('🌍 首页云函数调用成功:', result)
                if (result.result && result.result.success) {
                  console.log('✅ 首页天气数据获取成功')
                  resolve(result)
                } else {
                  const errorMsg = result.result?.message || result.result?.error?.message || '天气数据获取失败'
                  console.error('❌ 首页天气数据获取失败:', errorMsg)
                  wx.showModal({
                    title: '天气数据获取失败',
                    content: errorMsg,
                    showCancel: false
                  })
                  reject(new Error(errorMsg))
                }
              }).catch((error) => {
                console.error('❌ 首页云函数调用失败:', error)
                wx.showModal({
                  title: '网络错误',
                  content: '无法连接天气服务，请检查网络后重试',
                  showCancel: false
                })
                reject(error)
              })
            },
            fail: (error) => {
              console.error('🌍 首页位置获取失败:', error)
              this.handleLocationError(error)
              reject(error)
            }
          })
        },
        fail: (error) => {
          console.error('🌍 首页获取权限设置失败:', error)
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
    console.log('🎨 === 首页更新天气UI开始 ===')
    console.log('🎨 接收到的原始数据:', JSON.stringify(weatherData, null, 2))
    
    // 适配新的云函数数据格式
    let actualWeatherData = weatherData
    
    // 如果是新格式的数据结构（带有data字段）
    if (weatherData.data) {
      actualWeatherData = weatherData.data
      console.log('📦 检测到新格式数据结构')
      console.log('📦 weatherData.data结构:', Object.keys(weatherData.data))
    }
    
    console.log('📦 处理后的数据结构:', JSON.stringify(actualWeatherData, null, 2))
    
    // 详细检查位置信息
    const locationInfo = actualWeatherData.locationInfo
    console.log('📍 === 位置信息详细分析 ===')
    console.log('📍 locationInfo存在:', !!locationInfo)
    console.log('📍 locationInfo内容:', JSON.stringify(locationInfo, null, 2))
    console.log('📍 locationInfo类型:', typeof locationInfo)
    
    if (locationInfo) {
      console.log('✅ 找到位置信息，开始处理:')
      console.log('  - province:', locationInfo.province)
      console.log('  - city:', locationInfo.city) 
      console.log('  - district:', locationInfo.district)
      console.log('  - country:', locationInfo.country)
      console.log('  - locationId:', locationInfo.locationId)
      
      // 立即更新位置信息
      this.setData({
        location: {
          province: locationInfo.province || '当前位置',
          city: locationInfo.city || '实时定位', 
          district: locationInfo.district || '周边区域'
        }
      })
      
      console.log('✅ 首页位置信息已更新')
    } else {
      console.error('❌ === 位置信息为空，开始详细分析 ===')
      console.error('❌ weatherData结构:', Object.keys(weatherData || {}))
      console.error('❌ actualWeatherData结构:', Object.keys(actualWeatherData || {}))
      console.error('❌ 完整数据dump:', JSON.stringify({
        originalWeatherData: weatherData,
        actualWeatherData: actualWeatherData
      }, null, 2))
      
      // 显示详细错误信息
      this.setData({
        location: {
          province: '位置解析失败',
          city: '请查看控制台',
          district: new Date().toLocaleTimeString()
        }
      })
      
      // 在真机上显示错误信息
      wx.showModal({
        title: '调试信息',
        content: `位置信息为空\n数据结构: ${Object.keys(actualWeatherData || {}).join(', ')}\n时间: ${new Date().toLocaleTimeString()}`,
        showCancel: false
      })
    }
    
    // 安全地获取天气数据
    const currentWeather = actualWeatherData.current || {}
    const conditionInfo = actualWeatherData.condition || {}
    
    // 检查是否有API失败的标识
    const hasError = (conditionInfo.text && conditionInfo.text.includes('获取失败')) || 
                     (conditionInfo.text && conditionInfo.text.includes('API调用失败')) ||
                     (locationInfo && locationInfo.city && locationInfo.city.includes('API调用失败'))
    
    this.setData({
      weather: {
        temperature: currentWeather.temperature || this.data.weather.temperature,
        humidity: currentWeather.humidity || this.data.weather.humidity,
        condition: hasError ? '天气数据获取失败' : (conditionInfo.text || this.data.weather.condition),
        emoji: hasError ? '❌' : (conditionInfo.emoji || this.data.weather.emoji),
        feelsLike: currentWeather.feelsLike || this.data.weather.feelsLike,
        windDirection: currentWeather.windDirection || this.data.weather.windDirection,
        windScale: currentWeather.windScale || this.data.weather.windScale,
        updateTime: hasError ? '获取失败' : (this.formatUpdateTime(currentWeather.updateTime) || '刚刚更新'),
        loading: false,
        hasError: hasError
      },
      // 强制更新位置信息
      location: locationInfo && !hasError ? locationInfo : {
        province: hasError ? '网络错误' : '位置获取中',
        city: hasError ? '请检查网络连接' : '...',
        district: hasError ? '或重试获取' : '...'
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
    // 在微信小程序中，使用catchtap来阻止事件冒泡，而不是stopPropagation()
    console.log('手动刷新天气数据')
    
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
      itemList: ['🗑️ 清除天气缓存', '📍 强制获取天气', '🧪 测试API连接', '🔍 API问题诊断'],
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
          case 2: // 测试API连接
            that.testAPIConnections()
            break
          case 3: // API问题诊断
            that.diagnoseAPIIssues()
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

  // 测试API连接
  testAPIConnections() {
    wx.showLoading({ title: '测试API连接...' })
    
    // 先获取位置
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (locationRes) => {
        console.log('🧪 测试用坐标:', locationRes)
        
        wx.cloud.callFunction({
          name: 'weather',
          data: {
            action: 'testAPI',
            lat: locationRes.latitude,
            lon: locationRes.longitude
          }
        }).then((result) => {
          wx.hideLoading()
          console.log('🧪 API测试结果:', result)
          
          if (result.result && result.result.success) {
            const tests = result.result.data.tests
            let message = '测试结果:\n'
            
            // API Key测试
            if (tests.apiKey) {
              message += `API Key: ${tests.apiKey.success ? '✅' : '❌'} ${tests.apiKey.message}\n`
            }
            
            // 天气API测试
            if (tests.weatherAPI) {
              message += `天气API: ${tests.weatherAPI.success ? '✅' : '❌'} ${tests.weatherAPI.message}\n`
            }
            
            // GeoAPI测试
            if (tests.geoAPI) {
              message += `位置API: ${tests.geoAPI.success ? '✅' : '❌'} ${tests.geoAPI.message}\n`
              if (tests.geoAPI.success && tests.geoAPI.firstLocation !== '无') {
                message += `解析位置: ${tests.geoAPI.firstLocation}`
              }
            }
            
            wx.showModal({
              title: 'API测试结果',
              content: message,
              showCancel: false
            })
          } else {
            wx.showModal({
              title: 'API测试失败',
              content: result.result?.error || '测试过程出错',
              showCancel: false
            })
          }
        }).catch((error) => {
          wx.hideLoading()
          console.error('🧪 API测试错误:', error)
          wx.showModal({
            title: 'API测试错误',
            content: error.errMsg || error.message || '测试失败',
            showCancel: false
          })
        })
      },
      fail: (error) => {
        wx.hideLoading()
        wx.showModal({
          title: '位置获取失败',
          content: '无法获取位置进行API测试',
          showCancel: false
        })
      }
    })
  },

  // API问题诊断 - 基于官方文档的深度诊断
  diagnoseAPIIssues() {
    wx.showLoading({ title: '正在诊断API问题...' })
    
    // 先获取位置
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (locationRes) => {
        console.log('🔍 诊断用坐标:', locationRes)
        
        wx.cloud.callFunction({
          name: 'weather',
          data: {
            action: 'diagnoseAPI',
            lat: locationRes.latitude,
            lon: locationRes.longitude
          }
        }).then((result) => {
          wx.hideLoading()
          console.log('🔍 诊断结果:', result)
          
          if (result.result && result.result.success) {
            const diagnosis = result.result.data
            
            // 构建诊断报告
            let reportContent = `📊 诊断报告\n\n`
            reportContent += `总体状态: ${diagnosis.summary?.overallStatus || '未知'}\n`
            reportContent += `成功率: ${diagnosis.summary?.successRate || 0}%\n`
            reportContent += `成功测试: ${diagnosis.summary?.successfulTests || 0}/${diagnosis.summary?.totalTests || 0}\n\n`
            
            if (diagnosis.issues && diagnosis.issues.length > 0) {
              reportContent += `❌ 发现问题:\n`
              diagnosis.issues.forEach(issue => {
                reportContent += `${issue}\n`
              })
              reportContent += `\n`
            }
            
            if (diagnosis.recommendations && diagnosis.recommendations.length > 0) {
              reportContent += `💡 建议措施:\n`
              diagnosis.recommendations.slice(0, 3).forEach(rec => {
                reportContent += `${rec}\n`
              })
            }
            
            wx.showModal({
              title: 'API诊断报告',
              content: reportContent,
              showCancel: false,
              confirmText: '了解'
            })
          } else {
            wx.showModal({
              title: '诊断失败',
              content: result.result?.error || '诊断过程出错，请查看控制台日志',
              showCancel: false
            })
          }
        }).catch((error) => {
          wx.hideLoading()
          console.error('🔍 诊断错误:', error)
          wx.showModal({
            title: '诊断错误',
            content: '诊断过程出错: ' + (error.errMsg || error.message || '未知错误'),
            showCancel: false
          })
        })
      },
      fail: (error) => {
        wx.hideLoading()
        wx.showModal({
          title: '位置获取失败',
          content: '无法获取位置进行诊断',
          showCancel: false
        })
      }
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
      this.getTodoListData(),
      this.refreshAIAdvice()
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

  // ========== AI智能养殖建议功能 ==========

  // 生成养殖建议
  async generateFarmingAdvice() {
    console.log('生成AI智能养殖建议')
    
    this.setData({
      'aiAdvice.loading': true,
      'aiAdvice.error': null
    })
    
    try {
      // 收集环境和生产数据
      const environmentData = this.collectEnvironmentData()
      const productionData = await this.collectProductionData()
      const healthData = await this.collectHealthData()
      
      // 构建AI分析提示词
      const prompt = this.buildFarmingAdvicePrompt(environmentData, productionData, healthData)
      
      console.log('调用AI多模型服务生成养殖建议')
      
      // 调用AI分析云函数
      const result = await wx.cloud.callFunction({
        name: 'ai-multi-model',
        data: {
          action: 'chat_completion',
          messages: [
            {
              role: 'system',
              content: '你是一个资深的鹅类养殖专家，具有20年的养殖经验，擅长根据天气、环境、生产、健康等多维度数据提供科学的养殖管理建议。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          taskType: 'general_advice',
          priority: 'balanced'
        }
      })
      
      if (result.result.success) {
        const adviceData = this.parseAdviceResult(result.result.data.content)
        
        this.setData({
          'aiAdvice.loading': false,
          'aiAdvice.result': adviceData,
          'aiAdvice.error': null,
          'aiAdvice.lastUpdateTime': new Date().toLocaleString()
        })
        
        wx.vibrateShort({ type: 'medium' })
        
        wx.showToast({
          title: 'AI分析完成',
          icon: 'success',
          duration: 1500
        })
        
      } else {
        // AI分析失败，使用fallback建议
        this.setData({
          'aiAdvice.loading': false,
          'aiAdvice.result': this.generateFallbackAdvice(environmentData, productionData),
          'aiAdvice.error': result.result.error
        })
        
        wx.showToast({
          title: '建议生成完成',
          icon: 'none',
          duration: 2000
        })
      }
      
    } catch (error) {
      console.error('AI养殖建议生成失败:', error)
      
      this.setData({
        'aiAdvice.loading': false,
        'aiAdvice.error': error.message || 'AI服务异常',
        'aiAdvice.result': null
      })
      
      wx.showToast({
        title: '建议生成失败，请稍后重试',
        icon: 'none',
        duration: 2000
      })
    }
  },
  
  // 收集环境数据
  collectEnvironmentData() {
    const { weather, location } = this.data
    return {
      temperature: weather.temperature,
      humidity: weather.humidity,
      condition: weather.condition,
      windDirection: weather.windDirection,
      windScale: weather.windScale,
      location: `${location.city}${location.district}`,
      season: this.getCurrentSeason(),
      timeOfDay: this.getTimeOfDay()
    }
  },
  
  // 收集生产数据（模拟，实际可从云函数获取）
  async collectProductionData() {
    try {
      // 这里可以调用云函数获取真实的生产数据
      // const result = await wx.cloud.callFunction({
      //   name: 'production-dashboard',
      //   data: { action: 'get_current_stats' }
      // })
      
      // 使用模拟数据
      return {
        totalGeese: 450,
        avgAge: 65, // 天
        feedConsumption: 1200, // kg/day
        avgWeight: 3.2, // kg
        eggProduction: 85, // 只/天
        mortality: 0.5, // %
        feedType: '配合饲料',
        housingDensity: 8 // 只/平方米
      }
    } catch (error) {
      console.error('获取生产数据失败:', error)
      return null
    }
  },
  
  // 收集健康数据
  async collectHealthData() {
    try {
      // 模拟健康数据，实际可从健康管理云函数获取
      return {
        healthyCount: 432,
        abnormalCount: 18,
        vaccinationRate: 95, // %
        recentDiseases: ['禽流感', '肠道感染'],
        treatmentSuccess: 88 // %
      }
    } catch (error) {
      console.error('获取健康数据失败:', error)
      return null
    }
  },
  
  // 构建AI分析提示词
  buildFarmingAdvicePrompt(envData: any, prodData: any, healthData: any): string {
    return `请基于以下数据为我的鹅养殖场提供今日智能管理建议：

🌤️ **环境数据**：
- 地点：${envData.location}
- 天气：${envData.condition}，气温 ${envData.temperature}°C，湿度 ${envData.humidity}%
- 风向：${envData.windDirection}，风力：${envData.windScale}
- 季节：${envData.season}，时段：${envData.timeOfDay}

🏭 **生产数据**：
- 鹅群总数：${prodData?.totalGeese || 450} 只
- 平均日龄：${prodData?.avgAge || 65} 天
- 日均采食量：${prodData?.feedConsumption || 1200} kg
- 平均体重：${prodData?.avgWeight || 3.2} kg
- 产蛋量：${prodData?.eggProduction || 85} 只/天
- 死亡率：${prodData?.mortality || 0.5}%
- 饲养密度：${prodData?.housingDensity || 8} 只/平方米

🏥 **健康数据**：
- 健康个体：${healthData?.healthyCount || 432} 只
- 异常个体：${healthData?.abnormalCount || 18} 只
- 疫苗接种率：${healthData?.vaccinationRate || 95}%
- 近期疾病：${healthData?.recentDiseases?.join('、') || '禽流感、肠道感染'}
- 治疗成功率：${healthData?.treatmentSuccess || 88}%

请提供以下格式的JSON建议：
{
  "overallRating": {
    "score": 85,
    "level": "good|normal|poor",
    "emoji": "😊|😐|😟",
    "title": "养殖状况评级标题",
    "description": "简短评价描述"
  },
  "keyAdvice": [
    {
      "icon": "🌡️",
      "title": "建议标题",
      "description": "具体建议内容",
      "priority": "high|medium|low",
      "priorityText": "优先级文字"
    }
  ],
  "environmentAdvice": [
    {
      "category": "通风管理",
      "status": "good|warning|danger",
      "statusText": "状态描述",
      "recommendation": "具体建议"
    }
  ]
}`
  },
  
  // 解析AI建议结果
  parseAdviceResult(content: string): any {
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      } else {
        // 如果无法解析，返回fallback
        return this.generateFallbackAdvice()
      }
    } catch (error) {
      console.error('解析AI建议结果失败:', error)
      return this.generateFallbackAdvice()
    }
  },
  
  // 生成fallback建议
  generateFallbackAdvice(envData?: any, prodData?: any): any {
    const { weather } = this.data
    const temp = weather.temperature
    const humidity = weather.humidity
    
    // 基于天气条件生成简单建议
    let ratingLevel = 'good'
    let ratingEmoji = '😊'
    let ratingTitle = '养殖环境良好'
    let ratingScore = 85
    
    if (temp < 5 || temp > 35) {
      ratingLevel = 'poor'
      ratingEmoji = '😟'
      ratingTitle = '温度条件不佳'
      ratingScore = 65
    } else if (temp < 10 || temp > 30) {
      ratingLevel = 'normal'
      ratingEmoji = '😐'
      ratingTitle = '温度需要关注'
      ratingScore = 75
    }
    
    const keyAdvice = []
    const environmentAdvice = []
    
    // 根据温度生成建议
    if (temp < 10) {
      keyAdvice.push({
        icon: '🔥',
        title: '加强保温措施',
        description: '气温较低，注意鹅舍保温，防止鹅群感冒',
        priority: 'high',
        priorityText: '重要'
      })
      environmentAdvice.push({
        category: '温度控制',
        status: 'warning',
        statusText: '偏低',
        recommendation: '检查加热设备，增加垫料厚度'
      })
    } else if (temp > 30) {
      keyAdvice.push({
        icon: '🌬️',
        title: '加强通风降温',
        description: '气温较高，增加通风，提供充足饮水',
        priority: 'high',
        priorityText: '重要'
      })
      environmentAdvice.push({
        category: '温度控制',
        status: 'warning',
        statusText: '偏高',
        recommendation: '开启通风系统，检查饮水设备'
      })
    } else {
      keyAdvice.push({
        icon: '✅',
        title: '维持当前管理',
        description: '温度适宜，继续当前的饲养管理',
        priority: 'medium',
        priorityText: '正常'
      })
      environmentAdvice.push({
        category: '温度控制',
        status: 'good',
        statusText: '适宜',
        recommendation: '保持现有温控措施'
      })
    }
    
    // 根据湿度生成建议
    if (humidity > 80) {
      keyAdvice.push({
        icon: '💨',
        title: '降低湿度',
        description: '湿度过高，加强通风除湿，预防疾病',
        priority: 'medium',
        priorityText: '关注'
      })
      environmentAdvice.push({
        category: '湿度控制',
        status: 'warning',
        statusText: '偏高',
        recommendation: '加强通风，清理积水，更换垫料'
      })
    } else if (humidity < 40) {
      environmentAdvice.push({
        category: '湿度控制',
        status: 'warning',
        statusText: '偏低',
        recommendation: '适度增湿，防止灰尘过多'
      })
    } else {
      environmentAdvice.push({
        category: '湿度控制',
        status: 'good',
        statusText: '适宜',
        recommendation: '保持现有湿度控制措施'
      })
    }
    
    // 通用建议
    keyAdvice.push({
      icon: '🍽️',
      title: '检查饲料质量',
      description: '定时检查饲料新鲜度，确保营养均衡',
      priority: 'medium',
      priorityText: '日常'
    })
    
    environmentAdvice.push({
      category: '饲养管理',
      status: 'good',
      statusText: '正常',
      recommendation: '按时喂食，保持饲料新鲜，观察采食情况'
    })
    
    return {
      overallRating: {
        score: ratingScore,
        level: ratingLevel,
        emoji: ratingEmoji,
        title: ratingTitle,
        description: `基于当前环境条件的综合评估`
      },
      keyAdvice: keyAdvice.slice(0, 3), // 最多3条关键建议
      environmentAdvice
    }
  },
  
  // 获取当前季节
  getCurrentSeason(): string {
    const month = new Date().getMonth() + 1
    if (month >= 3 && month <= 5) return '春季'
    if (month >= 6 && month <= 8) return '夏季'
    if (month >= 9 && month <= 11) return '秋季'
    return '冬季'
  },
  
  // 获取时段
  getTimeOfDay(): string {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 12) return '上午'
    if (hour >= 12 && hour < 18) return '下午'
    if (hour >= 18 && hour < 22) return '傍晚'
    return '夜间'
  },
  
  // 查看详细建议
  viewDetailedAdvice() {
    // 这里可以跳转到详细的建议页面
    wx.showModal({
      title: '详细建议',
      content: '详细建议功能开发中，敬请期待！',
      showCancel: false
    })
  },
  
  // 添加建议到待办
  addAdviceToTodo() {
    const { result } = this.data.aiAdvice
    if (!result || !result.keyAdvice) {
      wx.showToast({
        title: '没有可添加的建议',
        icon: 'none'
      })
      return
    }
    
    // 获取高优先级建议
    const highPriorityAdvice = result.keyAdvice.filter(item => item.priority === 'high')
    if (highPriorityAdvice.length === 0) {
      wx.showToast({
        title: '没有重要建议需要添加',
        icon: 'none'
      })
      return
    }
    
    // 添加到待办列表（这里是模拟，实际可以保存到云端）
    const newTodos = highPriorityAdvice.map((advice, index) => ({
      id: Date.now() + index,
      content: advice.title + '：' + advice.description,
      priority: 'warning',
      priorityText: 'AI建议',
      tagTheme: 'success'
    }))
    
    const updatedTodoList = [...newTodos, ...this.data.todoList].slice(0, 10) // 最多保留10条
    
    this.setData({
      todoList: updatedTodoList
    })
    
    wx.showToast({
      title: `已添加${newTodos.length}条建议到待办`,
      icon: 'success',
      duration: 2000
    })
    
    wx.vibrateShort({ type: 'light' })
  },
  
  // 刷新AI建议（用于下拉刷新）
  async refreshAIAdvice() {
    if (this.data.aiAdvice.result) {
      // 如果已有建议，静默刷新
      await this.generateFarmingAdvice()
    }
  }
})
