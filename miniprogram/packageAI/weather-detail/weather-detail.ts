// weather-detail.ts - 天气详情页
Page({
  data: {
    // 天气数据
    weather: {
      temperature: 22,
      humidity: 65,
      condition: '晴',
      emoji: '☀️',
      feelsLike: 22,
      windDirection: '无风',
      windScale: '0级',
      windSpeed: 0,
      visibility: 10,
      pressure: 1013,
      updateTime: '刚刚更新'
    },
    
    // 位置信息 - 动态获取，不使用硬编码
    location: {
      province: '定位中...',
      city: '获取位置信息...',
      district: '请稍候...'
    },
    
    // 今日最高最低温度
    todayForecast: {
      tempMax: 25,
      tempMin: 18
    },
    
    // 天气预警列表
    warningList: [] as any[],
    
    // 空气质量数据
    airData: null as any,
    
    // 下一小时天气预报
    nextHourWeather: null as any,
    
    // 24小时预报
    hourlyForecast: [] as any[],
    hourlyLabels: [] as any[],
    
    // 7日预报
    dailyForecast: [] as any[],
    
    // 刷新状态
    refreshing: false,
    
    // 加载状态
    isLoading: false,
    
    // Loading 状态管理
    loadingVisible: false,
    
    // 位置获取重试次数
    locationRetryCount: 0
  },

  onLoad(options: any) {
    // 已移除调试日志
    // 添加调试信息
    // 已移除调试日志
    // 已移除调试日志
    this.loadWeatherData()
  },

  // 安全显示 Loading
  showLoadingSafe(title = '加载中...') {
    if (!this.data.loadingVisible) {
      // 已移除调试日志
      wx.showLoading({ title })
      this.setData({ loadingVisible: true })
    }
  },

  // 安全隐藏 Loading
  hideLoadingSafe() {
    if (this.data.loadingVisible) {
      // 已移除调试日志
      wx.hideLoading()
      this.setData({ loadingVisible: false })
    } else {
      // 已移除调试日志
    }
  },

  // 强制清理 Loading 状态（用于异常情况）
  forceHideLoading() {
    // 已移除调试日志
    try {
      wx.hideLoading()
    } catch (e) {
      // 忽略 hideLoading 可能的异常
    }
    this.setData({ loadingVisible: false })
  },

  // 统一异常处理
  handleError(error: any, context = '操作') {
    // 已移除调试日志
    // 确保 Loading 状态被清理
    this.forceHideLoading()
    
    // 重置相关状态
    this.setData({ 
      isLoading: false,
      refreshing: false 
    })
    
    // 显示错误提示
    const errorMessage = error?.message || error?.errMsg || `${context}失败，请稍后重试`
    wx.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 2000
    })
  },

  onShow() {
    // 重置 Loading 状态，防止页面切换导致的状态不一致
    if (this.data.loadingVisible && !this.data.isLoading) {
      // 已移除调试日志
      this.setData({ loadingVisible: false })
    }
    
    // 检查是否需要自动刷新（1小时后）
    this.checkAutoRefresh()
  },

  onUnload() {
    // 页面卸载时强制清理 Loading 状态
    // 已移除调试日志
    this.forceHideLoading()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshWeatherData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载天气数据
  async loadWeatherData() {
    const cachedData = this.getCachedWeatherData()
    if (cachedData) {
      // 已移除调试日志
      this.updateCompleteWeatherData(cachedData)
    } else {
      // 已移除调试日志
      // 首次加载时静默获取，不显示toast
      await this.getWeatherData(false)
    }
  },

  // 获取完整天气数据
  async getWeatherData(showLoading = true) {
    // 防止重复调用
    if (this.data.isLoading) {
      // 已移除调试日志
      return
    }

    let shouldHideLoading = false
    try {
      this.setData({ isLoading: true })
      if (showLoading) {
        this.showLoadingSafe('获取天气中...')
        shouldHideLoading = true
      }
      
      const locationRes = await this.getLocation()
      const weatherRes = await this.callCompleteWeatherAPI(locationRes.latitude, locationRes.longitude)
      
      if (weatherRes.result && weatherRes.result.success) {
        const weatherData = weatherRes.result.data
        this.updateCompleteWeatherData(weatherData)
        this.cacheWeatherData(weatherData)
        
        // 只在显示Loading时显示成功提示
        if (showLoading) {
          wx.showToast({
            title: '天气更新成功',
            icon: 'success'
          })
        }
      } else {
        // 增强错误处理，显示云函数返回的具体错误信息
        const errorMessage = weatherRes.result?.error?.message || weatherRes.result?.message || '天气数据获取失败，请稍后重试'
        // 已移除调试日志
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      this.handleError(error, '获取天气数据')
    } finally {
      this.setData({ isLoading: false })
      // 确保 Loading 状态正确清理
      if (shouldHideLoading) {
        this.hideLoadingSafe()
      }
    }
  },

  // 获取位置 - 彻底重写，确保获取真实位置
  getLocation(retryCount = 0): Promise<any> {
    return new Promise((resolve, reject) => {
      // 已移除调试日志
      // 已移除调试日志
      // 防止无限递归重试
      if (retryCount >= 3) {
        // 已移除调试日志
        reject(new Error('位置获取失败，重试次数超限'))
        return
      }
      
      // 先检查位置权限
      wx.getSetting({
        success: (settingsRes) => {
          // 已移除调试日志
          // 已移除调试日志
          if (settingsRes.authSetting['scope.userLocation'] === false) {
            // 已移除调试日志
            wx.showModal({
              title: '需要位置权限',
              content: '为了获取准确的天气信息，需要您的位置权限。请在设置中开启位置权限。',
              confirmText: '去设置',
              success: (res) => {
                if (res.confirm) {
                  wx.openSetting()
                }
              }
            })
            reject(new Error('用户拒绝了位置权限'))
            return
          }
          
          // 强制获取高精度位置
          // 已移除调试日志
          wx.getLocation({
            type: 'gcj02',
            isHighAccuracy: true,
            success: (locationRes) => {
              const { latitude, longitude, accuracy, speed, altitude } = locationRes
              // 已移除调试日志
              // 已移除调试日志
              // 已移除调试日志
              // 已移除调试日志
              // 已移除调试日志
              // 已移除调试日志
              // 已移除调试日志
              // 验证坐标有效性
              if (!latitude || !longitude || latitude === 0 || longitude === 0) {
                // 已移除调试日志
                reject(new Error('获取到的坐标无效'))
                return
              }
              
              // 立即更新详情页显示为"定位成功"
              this.setData({
                location: {
                  province: '定位成功',
                  city: '正在解析位置...',
                  district: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                }
              })
              
              resolve(locationRes)
            },
            fail: (error) => {
              // 已移除调试日志
              wx.showModal({
                title: '位置获取失败',
                content: `无法获取您的位置信息: ${error.errMsg || '未知错误'}`,
                confirmText: '重试',
                success: (res) => {
                  if (res.confirm) {
                    // 重新尝试获取位置，递增重试次数
                    this.getLocation(retryCount + 1).then(resolve).catch(reject)
                  } else {
                    reject(error)
                  }
                }
              })
            }
          })
        },
        fail: (error) => {
          // 已移除调试日志
          reject(error)
        }
      })
    })
  },

  // 调用完整天气API
  callCompleteWeatherAPI(lat: number, lon: number): Promise<any> {
    return wx.cloud.callFunction({
      name: 'weather',
      data: {
        action: 'getCompleteWeather',
        lat: lat,
        lon: lon
      }
    })
  },

  // 更新完整天气数据
  updateCompleteWeatherData(weatherData: any) {
    // 已移除调试日志
    // 处理云函数返回的嵌套数据结构
    // 云函数返回格式: { success: true, data: { current: {...}, hourly: [...] } }
    const actualData = weatherData.data || weatherData
    
    // 已移除调试日志
    // 已移除调试日志
    
    // 优先更新位置信息 - 彻底清除"实时定位获取中"状态
    const locationInfo = actualData.locationInfo
    if (locationInfo) {
      // 已移除调试日志
      // 立即清除"实时定位获取中"的显示
      this.setData({
        location: {
          province: locationInfo.province || '当前位置',
          city: locationInfo.city || '实时定位',
          district: locationInfo.district || '周边区域'
        }
      })
      
      // 已移除调试日志
    } else {
      // 已移除调试日志
      // 即使没有位置信息，也要清除"获取中"状态
      this.setData({
        location: {
          province: '当前位置',
          city: '实时定位',
          district: '位置服务异常'
        }
      })
    }

    // 更新当前天气
    if (actualData.current) {
      this.setData({
        weather: {
          temperature: actualData.current?.temperature || this.data.weather.temperature,
          humidity: actualData.current?.humidity || this.data.weather.humidity,
          condition: actualData.condition?.text || this.data.weather.condition,
          emoji: actualData.condition?.emoji || this.data.weather.emoji,
          feelsLike: actualData.current?.feelsLike || this.data.weather.feelsLike,
          windDirection: actualData.current?.windDirection || this.data.weather.windDirection,
          windScale: actualData.current?.windScale || this.data.weather.windScale,
          windSpeed: actualData.current?.windSpeed || this.data.weather.windSpeed,
          visibility: actualData.current?.visibility || this.data.weather.visibility,
          pressure: actualData.current?.pressure || this.data.weather.pressure,
          updateTime: this.formatUpdateTime(actualData.current?.updateTime) || this.data.weather.updateTime
        }
      })
    }
    
    // 更新逐小时预报
    if (actualData.hourly && Array.isArray(actualData.hourly) && actualData.hourly.length > 0) {
      // 已移除调试日志
      this.processHourlyForecast(actualData.hourly)
    } else {
      // 已移除调试日志
    }
    
    // 更新每日预报
    if (actualData.daily && Array.isArray(actualData.daily) && actualData.daily.length > 0) {
      // 已移除调试日志
      this.processDailyForecast(actualData.daily)
    } else {
      // 已移除调试日志
    }
    
    // 更新空气质量
    if (actualData.air) {
      // 已移除调试日志
      this.processAirQuality(actualData.air)
    } else {
      // 已移除调试日志
    }
    
    // 更新天气预警
    if (actualData.warning) {
      // 已移除调试日志
      this.processWeatherWarning(actualData.warning)
    } else {
      // 已移除调试日志
      this.setData({ warningList: [] })
    }
  },

  // 格式化更新时间
  formatUpdateTime(updateTime: string): string {
    if (!updateTime) return '刚刚更新'
    
    try {
      const now = new Date()
      const update = new Date(updateTime)
      const diff = Math.floor((now.getTime() - update.getTime()) / 1000 / 60)
      
      if (diff < 1) return '刚刚更新'
      if (diff < 60) return `${diff}分钟前更新`
      if (diff < 24 * 60) return `${Math.floor(diff / 60)}小时前更新`
      return '超过1天前更新'
    } catch (error) {
      return '刚刚更新'
    }
  },

  // 处理逐小时预报数据
  processHourlyForecast(hourlyData: any) {
    // 已移除调试日志
    // 确保 hourlyData 是数组
    if (!Array.isArray(hourlyData)) {
      // 已移除调试日志
      return
    }
    
    const hourlyForecast = hourlyData.slice(0, 24).map((item: any, index: number) => {
      const time = new Date(item.fxTime)
      let timeLabel = ''
      
      if (index === 0) {
        timeLabel = '现在'
      } else {
        timeLabel = `${time.getHours().toString().padStart(2, '0')}:00`
      }
      
      return {
        time: item.fxTime,
        timeLabel,
        temp: parseInt(item.temp) || 0,
        icon: this.getWeatherEmoji(item.text),
        text: item.text,
        windSpeed: item.windSpeed || 0,
        humidity: item.humidity || 0,
        pop: item.pop || 0  // 降水概率
      }
    })
    
    // 生成下一小时天气描述
    const nextHour = hourlyData[1]
    const nextHourWeather = nextHour ? {
      time: `${new Date(nextHour.fxTime).getHours().toString().padStart(2, '0')}:00`,
      desc: `预计${nextHour.text}`,
      wind: `风速${nextHour.windSpeed || 0}公里/小时`,
      temp: `${parseInt(nextHour.temp) || 0}°C`,
      pop: nextHour.pop ? `降水概率${nextHour.pop}%` : ''
    } : null
    
    this.setData({
      hourlyForecast,
      nextHourWeather
    })
  },

  // 处理每日预报数据
  processDailyForecast(dailyData: any) {
    // 已移除调试日志
    // 确保 dailyData 是数组
    if (!Array.isArray(dailyData)) {
      // 已移除调试日志
      return
    }
    
    // 更新今日最高最低温度
    const today = dailyData[0]
    if (today) {
      this.setData({
        todayForecast: {
          tempMax: parseInt(today.tempMax) || 0,
          tempMin: parseInt(today.tempMin) || 0
        }
      })
    }
    
    const dailyForecast = dailyData.slice(0, 7).map((item: any, index: number) => {
      const date = new Date(item.fxDate)
      let dayName = ''
      
      if (index === 0) {
        dayName = '今天'
      } else if (index === 1) {
        dayName = '明天'
      } else if (index === 2) {
        dayName = '后天'
      } else {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        dayName = days[date.getDay()]
      }
      
      // 计算温度进度条（基于7天内的温度范围）
      const allTemps = dailyData.slice(0, 7)
        .filter(d => d && d.tempMax != null && d.tempMin != null)
        .map(d => [parseInt(d.tempMax), parseInt(d.tempMin)])
        .flat()
        .filter(temp => !isNaN(temp))
      
      const maxTemp = allTemps.length > 0 ? Math.max(...allTemps) : 30
      const minTemp = allTemps.length > 0 ? Math.min(...allTemps) : 0
      const tempRange = maxTemp - minTemp
      const itemTempMax = parseInt(item.tempMax) || 0
      const itemTempMin = parseInt(item.tempMin) || 0
      const tempProgress = tempRange > 0 ? ((itemTempMax - minTemp) / tempRange) * 100 : 50
      
      return {
        date: item.fxDate,
        dayName,
        iconDay: this.getWeatherEmoji(item.textDay),
        iconNight: this.getWeatherEmoji(item.textNight),
        textDay: item.textDay,
        textNight: item.textNight,
        tempMax: itemTempMax,
        tempMin: itemTempMin,
        tempProgress,
        humidity: item.humidity || 0,
        uvIndex: item.uvIndex || 0,
        vis: item.vis || 0,
        windDir: item.windDirDay || '无风',
        windScale: item.windScaleDay || '0级',
        windSpeed: item.windSpeedDay || 0
      }
    })
    
    this.setData({ dailyForecast })
  },

  // 处理空气质量数据
  processAirQuality(airData: any) {
    // 已移除调试日志
    if (!airData || typeof airData.aqi === 'undefined') {
      // 已移除调试日志
      this.setData({
        airData: {
          aqi: 0,
          category: '无数据',
          color: '#999999',
          progress: 0,
          pm2p5: 0,
          pm10: 0,
          no2: 0,
          so2: 0,
          co: 0,
          o3: 0
        }
      })
      return
    }
    
    const aqi = parseInt(airData.aqi) || 0
    let category = ''
    let color = ''
    let progress = 0
    
    if (aqi <= 50) {
      category = '优'
      color = '#00e400'
      progress = (aqi / 50) * 20
    } else if (aqi <= 100) {
      category = '良'
      color = '#ffff00'
      progress = 20 + ((aqi - 50) / 50) * 20
    } else if (aqi <= 150) {
      category = '轻度污染'
      color = '#ff7e00'
      progress = 40 + ((aqi - 100) / 50) * 20
    } else if (aqi <= 200) {
      category = '中度污染'
      color = '#ff0000'
      progress = 60 + ((aqi - 150) / 50) * 20
    } else if (aqi <= 300) {
      category = '重度污染'
      color = '#8f3f97'
      progress = 80 + ((aqi - 200) / 100) * 15
    } else {
      category = '严重污染'
      color = '#7e0023'
      progress = 95
    }
    
    this.setData({
      airData: {
        aqi,
        category,
        color,
        progress,
        pm2p5: parseInt(airData.pm2p5) || 0,
        pm10: parseInt(airData.pm10) || 0,
        no2: parseInt(airData.no2) || 0,
        so2: parseInt(airData.so2) || 0,
        co: parseFloat(airData.co) || 0,
        o3: parseInt(airData.o3) || 0,
        updateTime: airData.updateTime || new Date().toISOString()
      }
    })
  },

  // 处理天气预警数据
  processWeatherWarning(warningData: any) {
    // 已移除调试日志
    // 确保 warningData 是数组
    if (!Array.isArray(warningData)) {
      // 已移除调试日志
      this.setData({ warningList: [] })
      return
    }
    
    // 过滤并处理预警数据
    const warningList = warningData.filter(item => item && item.title).map((item: any) => {
      let theme = 'primary'
      let severityLevel = 0 // 用于排序：4=红色(最高), 3=橙色, 2=黄色, 1=蓝色
      
      // 根据严重等级确定主题和级别
      const severity = item.severity || item.severityColor || ''
      if (severity.includes('红') || severity.toLowerCase().includes('red')) {
        theme = 'danger'
        severityLevel = 4
      } else if (severity.includes('橙') || severity.toLowerCase().includes('orange')) {
        theme = 'warning'
        severityLevel = 3
      } else if (severity.includes('黄') || severity.toLowerCase().includes('yellow')) {
        theme = 'warning'
        severityLevel = 2
      } else if (severity.includes('蓝') || severity.toLowerCase().includes('blue')) {
        theme = 'primary'
        severityLevel = 1
      }
      
      return {
        id: item.id || `warning_${Date.now()}_${Math.random()}`,
        title: item.title,
        severity: item.severity || '预警',
        severityLevel,
        theme,
        text: item.text || '',
        type: item.type || '',
        typeName: item.typeName || '',
        startTime: item.startTime || '',
        endTime: item.endTime || '',
        pubTime: item.pubTime || '',
        status: item.status || '',
        level: item.level || '',
        urgency: item.urgency || '',
        certainty: item.certainty || ''
      }
    })
    
    // 按严重级别排序（红色在前）
    warningList.sort((a, b) => b.severityLevel - a.severityLevel)
    
    // 已移除调试日志
    this.setData({ warningList })
  },

  // 获取天气表情图标
  getWeatherEmoji(weather: string): string {
    const emojiMap: Record<string, string> = {
      '晴': '☀️',
      '多云': '⛅',
      '阴': '☁️',
      '小雨': '🌦️',
      '中雨': '🌧️',
      '大雨': '⛈️',
      '雷阵雨': '⛈️',
      '雪': '❄️',
      '小雪': '❄️',
      '中雪': '❄️',
      '大雪': '❄️',
      '雾': '🌫️',
      '霾': '😷',
      '沙尘暴': '🌪️',
      '浮尘': '🌪️',
      '扬沙': '🌪️'
    }
    
    return emojiMap[weather] || '🌤️'
  },

  // 刷新天气按钮点击
  onRefreshWeather() {
    this.refreshWeatherData()
  },

  // 刷新天气数据
  async refreshWeatherData() {
    if (this.data.refreshing) return
    
    this.setData({ refreshing: true })
    
    try {
      // 清除缓存，强制获取新数据
      this.clearWeatherCache()
      await this.getWeatherData()
    } catch (error) {
      this.handleError(error, '刷新天气数据')
    } finally {
      this.setData({ refreshing: false })
    }
  },

  // 检查是否需要自动刷新
  async checkAutoRefresh() {
    try {
      const cachedData = this.getCachedWeatherData()
      if (!cachedData) {
        // 没有缓存数据，自动获取（静默模式，不显示Loading）
        // 已移除调试日志
        await this.getWeatherData(false)
      } else {
        // 有缓存数据，检查是否过期（1小时）
        const now = Date.now()
        const cacheTime = cachedData.timestamp || 0
        const oneHour = 60 * 60 * 1000
        
        if (now - cacheTime > oneHour) {
          // 已移除调试日志
          await this.getWeatherData(false)
        }
      }
    } catch (error) {
      this.handleError(error, '自动刷新检查')
    }
  },

  // 缓存天气数据
  cacheWeatherData(weatherData: any) {
    try {
      const cacheData = {
        data: weatherData,
        timestamp: Date.now(),
        expireTime: Date.now() + 60 * 60 * 1000 // 1小时过期
      }
      wx.setStorageSync('weather_cache', cacheData)
      // 已移除调试日志
    } catch (error) {
      // 已移除调试日志
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
      // 已移除调试日志
    } catch (error) {
      // 已移除调试日志
    }
  },

  // 计算天气建议
  calculateWeatherTips() {
    const { weather, airData, warningList } = this.data
    const tips = []
    
    // 基于温度的建议
    if (weather.temperature < 0) {
      tips.push('气温较低，注意保暖，外出建议穿厚外套')
    } else if (weather.temperature < 10) {
      tips.push('气温偏低，建议穿长袖和外套')
    } else if (weather.temperature > 35) {
      tips.push('高温天气，注意防暑降温，多补充水分')
    } else if (weather.temperature > 30) {
      tips.push('气温较高，建议穿轻薄透气的衣服')
    }
    
    // 基于湿度的建议
    if (weather.humidity > 80) {
      tips.push('湿度较高，注意通风，预防潮湿')
    } else if (weather.humidity < 30) {
      tips.push('空气干燥，注意补水，使用保湿产品')
    }
    
    // 基于天气状况的建议
    if (weather.condition.includes('雨')) {
      tips.push('有降雨，外出请携带雨具')
    } else if (weather.condition.includes('雪')) {
      tips.push('有降雪，路面湿滑，出行注意安全')
    } else if (weather.condition.includes('雾') || weather.condition.includes('霾')) {
      tips.push('能见度较低，驾驶时请注意安全')
    }
    
    // 基于空气质量的建议
    if (airData && airData.aqi > 150) {
      tips.push('空气质量较差，建议减少户外活动，外出佩戴口罩')
    } else if (airData && airData.aqi > 100) {
      tips.push('空气质量一般，敏感人群应减少户外活动')
    }
    
    // 基于预警的建议
    if (warningList.length > 0) {
      tips.push(`有${warningList.length}条天气预警，请关注天气变化`)
    }
    
    // 如果没有特殊建议，给出通用建议
    if (tips.length === 0) {
      tips.push('天气状况良好，适宜户外活动')
    }
    
    // 已移除调试日志
    return tips
  },

  // 导航栏返回按钮事件
  onNavigateBack() {
    // 已移除调试日志
    // 清理页面状态和资源
    this.forceHideLoading()
    
    // 可以在这里添加其他清理逻辑，比如：
    // - 保存用户浏览历史
    // - 清理定时器
    // - 发送统计数据等
    
    // 已移除调试日志
  },

  // 页面分享
  onShareAppMessage() {
    const { location, weather } = this.data
    return {
      title: `${location.city}当前${weather.condition} ${weather.temperature}°C`,
      path: '/packageAI/weather-detail/weather-detail',
      imageUrl: '' // 可以设置分享图片
    }
  }
})
