// weather-detail.ts - 天气详情页

// 类型定义
interface WeatherData {
  temperature: number
  humidity: number
  condition: string
  emoji: string
  feelsLike: number
  windDirection: string
  windScale: string
  windSpeed: number
  visibility: number
  pressure: number
  updateTime: string
}

interface LocationInfo {
  province: string
  city: string
  district: string
}

interface TodayForecast {
  tempMax: number
  tempMin: number
}

interface WeatherWarning {
  id: string
  title: string
  severity: string
  severityLevel: number
  theme: string
  text: string
  type: string
  typeName: string
  startTime: string
  endTime: string
  pubTime: string
  status: string
  level: string
  urgency: string
  certainty: string
}

interface AirQualityData {
  aqi: number
  category: string
  color: string
  progress: number
  pm2p5: number
  pm10: number
  no2: number
  so2: number
  co: number
  o3: number
  updateTime?: string
}

interface NextHourWeather {
  time: string
  desc: string
  wind: string
  temp: string
  pop: string
}

interface HourlyForecastItem {
  time: string
  timeLabel: string
  temp: number
  icon: string
  text: string
  windSpeed: number
  humidity: number
  pop: number
}

interface DailyForecastItem {
  date: string
  dayName: string
  iconDay: string
  iconNight: string
  textDay: string
  textNight: string
  tempMax: number
  tempMin: number
  tempProgress: number
  humidity: number
  uvIndex: number
  vis: number
  windDir: string
  windScale: string
  windSpeed: number
}

interface CompleteWeatherData {
  current?: {
    temperature?: number
    humidity?: number
    feelsLike?: number
    windDirection?: string
    windScale?: string
    windSpeed?: number
    visibility?: number
    pressure?: number
    updateTime?: string
  }
  condition?: {
    text?: string
    emoji?: string
  }
  hourly?: Array<{
    fxTime: string
    temp: string | number
    text: string
    windSpeed?: number
    humidity?: number
    pop?: number
  }>
  daily?: Array<{
    fxDate: string
    tempMax: string | number
    tempMin: string | number
    textDay: string
    textNight: string
    humidity?: number
    uvIndex?: number
    vis?: number
    windDirDay?: string
    windScaleDay?: string
    windSpeedDay?: number
  }>
  air?: {
    aqi: string | number
    pm2p5?: string | number
    pm10?: string | number
    no2?: string | number
    so2?: string | number
    co?: string | number
    o3?: string | number
    updateTime?: string
  }
  warning?: Array<{
    id?: string
    title: string
    severity?: string
    severityColor?: string
    text?: string
    type?: string
    typeName?: string
    startTime?: string
    endTime?: string
    pubTime?: string
    status?: string
    level?: string
    urgency?: string
    certainty?: string
  }>
  locationInfo?: LocationInfo
}

interface LocationResult {
  latitude: number
  longitude: number
}

interface WeatherAPIResponse {
  result?: {
    success?: boolean
    data?: CompleteWeatherData
    error?: {
      message?: string
    }
    message?: string
  }
}

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
    warningList: [] as WeatherWarning[],
    
    // 空气质量数据
    airData: null as AirQualityData | null,
    
    // 下一小时天气预报
    nextHourWeather: null as NextHourWeather | null,
    
    // 24小时预报
    hourlyForecast: [] as HourlyForecastItem[],
    
    // 7日预报
    dailyForecast: [] as DailyForecastItem[],
    
    // 刷新状态
    refreshing: false,
    
    // 加载状态
    isLoading: false,
    
    // Loading 状态管理
    loadingVisible: false,
    
    // 位置获取重试次数
    locationRetryCount: 0
  },

  onLoad(_options: Record<string, any>) {
    this.loadWeatherData()
  },

  // 安全显示 Loading
  showLoadingSafe(title = '加载中...') {
    if (!this.data.loadingVisible) {
      wx.showLoading({ title })
      this.setData({ loadingVisible: true })
    }
  },

  // 安全隐藏 Loading
  hideLoadingSafe() {
    if (this.data.loadingVisible) {
      wx.hideLoading()
      this.setData({ loadingVisible: false })
    }
  },

  // 强制清理 Loading 状态（用于异常情况）
  forceHideLoading() {
    try {
      wx.hideLoading()
    } catch (e) {
      // 忽略 hideLoading 可能的异常
    }
    this.setData({ loadingVisible: false })
  },

  // 统一异常处理
  handleError(error: Error | { message?: string; errMsg?: string } | unknown, context = '操作') {
    // 确保 Loading 状态被清理
    this.forceHideLoading()
    
    // 重置相关状态
    this.setData({ 
      isLoading: false,
      refreshing: false 
    })
    
    // 显示错误提示
    let errorMessage = `${context}失败，请稍后重试`
    if (error && typeof error === 'object') {
      errorMessage = (error as any).message || (error as any).errMsg || errorMessage
    }
    wx.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 2000
    })
  },

  onShow() {
    // 重置 Loading 状态，防止页面切换导致的状态不一致
    if (this.data.loadingVisible && !this.data.isLoading) {
      this.setData({ loadingVisible: false })
    }
    
    // 检查是否需要自动刷新（1小时后）
    this.checkAutoRefresh()
  },

  onUnload() {
    // 页面卸载时强制清理 Loading 状态
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
      this.updateCompleteWeatherData(cachedData)
    } else {
      // 首次加载时静默获取，不显示toast
      await this.getWeatherData(false)
    }
  },

  // 获取完整天气数据
  async getWeatherData(showLoading = true) {
    // 防止重复调用
    if (this.data.isLoading) {
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
        throw new Error(errorMessage)
      }
    } catch (error) {
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
  getLocation(retryCount = 0): Promise<LocationResult> {
    return new Promise((resolve, reject) => {
      // 防止无限递归重试
      if (retryCount >= 3) {
        reject(new Error('位置获取失败，重试次数超限'))
        return
      }
      
      // 先检查位置权限
      wx.getSetting({
        success: (settingsRes) => {
          if (settingsRes.authSetting['scope.userLocation'] === false) {
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
          wx.getLocation({
            type: 'gcj02',
            isHighAccuracy: true,
            success: (locationRes) => {
              const { latitude, longitude } = locationRes
              // 验证坐标有效性
              if (!latitude || !longitude || latitude === 0 || longitude === 0) {
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
          reject(error)
        }
      })
    })
  },

  // 调用完整天气API
  callCompleteWeatherAPI(lat: number, lon: number): Promise<WeatherAPIResponse> {
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
  updateCompleteWeatherData(weatherData: CompleteWeatherData | { data?: CompleteWeatherData }) {
    // 处理云函数返回的嵌套数据结构
    // 云函数返回格式: { success: true, data: { current: {...}, hourly: [...] } }
    const actualData = ('data' in weatherData && weatherData.data) ? weatherData.data : weatherData as CompleteWeatherData
    
    // 优先更新位置信息 - 彻底清除"实时定位获取中"状态
    const locationInfo = actualData.locationInfo
    if (locationInfo) {
      // 立即清除"实时定位获取中"的显示
      this.setData({
        location: {
          province: locationInfo.province || '当前位置',
          city: locationInfo.city || '实时定位',
          district: locationInfo.district || '周边区域'
        }
      })
    } else {
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
      this.processHourlyForecast(actualData.hourly)
    }
    
    // 更新每日预报
    if (actualData.daily && Array.isArray(actualData.daily) && actualData.daily.length > 0) {
      this.processDailyForecast(actualData.daily)
    }
    
    // 更新空气质量
    if (actualData.air) {
      this.processAirQuality(actualData.air)
    }
    
    // 更新天气预警
    if (actualData.warning) {
      this.processWeatherWarning(actualData.warning)
    } else {
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

  // 格式化预警时间为iOS兼容的24小时制
  formatWarningTime(isoTime: string): string {
    if (!isoTime) return ''
    
    try {
      // 处理ISO 8601格式：2025-11-17T17:57+08:00
      // 转换为：2025-11-17 17:57
      const date = new Date(isoTime)
      
      // 验证日期有效性
      if (isNaN(date.getTime())) {
        return isoTime
      }
      
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${year}-${month}-${day} ${hours}:${minutes}`
    } catch (error) {
      return isoTime
    }
  },

  // 处理逐小时预报数据
  processHourlyForecast(hourlyData: CompleteWeatherData['hourly']) {
    // 确保 hourlyData 是数组
    if (!Array.isArray(hourlyData)) {
      return
    }
    
    const hourlyForecast = hourlyData.slice(0, 24).map((item, index: number) => {
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
        temp: parseInt(String(item.temp)) || 0,
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
      temp: `${parseInt(String(nextHour.temp)) || 0}°C`,
      pop: nextHour.pop ? `降水概率${nextHour.pop}%` : ''
    } : null
    
    this.setData({
      hourlyForecast,
      nextHourWeather
    })
  },

  // 处理每日预报数据
  processDailyForecast(dailyData: CompleteWeatherData['daily']) {
    // 确保 dailyData 是数组
    if (!Array.isArray(dailyData)) {
      return
    }
    
    // 更新今日最高最低温度
    const today = dailyData[0]
    if (today) {
      this.setData({
        todayForecast: {
          tempMax: parseInt(String(today.tempMax)) || 0,
          tempMin: parseInt(String(today.tempMin)) || 0
        }
      })
    }
    
    const dailyForecast = dailyData.slice(0, 7).map((item, index: number) => {
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
        .map(d => [parseInt(String(d.tempMax)), parseInt(String(d.tempMin))])
        .flat()
        .filter(temp => !isNaN(temp))
      
      const maxTemp = allTemps.length > 0 ? Math.max(...allTemps) : 30
      const minTemp = allTemps.length > 0 ? Math.min(...allTemps) : 0
      const tempRange = maxTemp - minTemp
      const itemTempMax = parseInt(String(item.tempMax)) || 0
      const itemTempMin = parseInt(String(item.tempMin)) || 0
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
  processAirQuality(airData: CompleteWeatherData['air']) {
    if (!airData || typeof airData.aqi === 'undefined') {
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
    
    const aqi = parseInt(String(airData.aqi)) || 0
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
        pm2p5: parseInt(String(airData.pm2p5 || 0)) || 0,
        pm10: parseInt(String(airData.pm10 || 0)) || 0,
        no2: parseInt(String(airData.no2 || 0)) || 0,
        so2: parseInt(String(airData.so2 || 0)) || 0,
        co: parseFloat(String(airData.co || 0)) || 0,
        o3: parseInt(String(airData.o3 || 0)) || 0,
        updateTime: airData.updateTime || new Date().toISOString()
      }
    })
  },

  // 处理天气预警数据
  processWeatherWarning(warningData: CompleteWeatherData['warning']) {
    // 确保 warningData 是数组
    if (!Array.isArray(warningData)) {
      this.setData({ warningList: [] })
      return
    }
    
    // 英文严重程度映射
    const severityMap: Record<string, string> = {
      'Severe': '严重',
      'Moderate': '中等',
      'Minor': '较轻',
      'Extreme': '极端',
      'Unknown': '未知'
    }
    
    // 过滤并处理预警数据
    const warningList = warningData.filter(item => item && item.title).map((item) => {
      let theme = 'primary'
      let severityLevel = 0 // 用于排序：4=红色(最高), 3=橙色, 2=黄色, 1=蓝色
      let severityText = item.severity || '预警'
      
      // 转换英文严重程度为中文
      if (severityMap[severityText]) {
        severityText = severityMap[severityText]
      }
      
      // 根据严重等级确定主题和级别
      const severity = item.severity || item.severityColor || ''
      if (severity.includes('红') || severity.toLowerCase().includes('red') || severity.toLowerCase().includes('severe') || severity.toLowerCase().includes('extreme')) {
        theme = 'danger'
        severityLevel = 4
      } else if (severity.includes('橙') || severity.toLowerCase().includes('orange')) {
        theme = 'warning'
        severityLevel = 3
      } else if (severity.includes('黄') || severity.toLowerCase().includes('yellow') || severity.toLowerCase().includes('moderate')) {
        theme = 'warning'
        severityLevel = 2
      } else if (severity.includes('蓝') || severity.toLowerCase().includes('blue') || severity.toLowerCase().includes('minor')) {
        theme = 'primary'
        severityLevel = 1
      }
      
      return {
        id: item.id || `warning_${Date.now()}_${Math.random()}`,
        title: item.title,
        severity: severityText,
        severityLevel,
        theme,
        text: item.text || '',
        type: item.type || '',
        typeName: item.typeName || '',
        startTime: item.startTime || '',
        endTime: item.endTime || '',
        pubTime: this.formatWarningTime(item.pubTime || ''),
        status: item.status || '',
        level: item.level || '',
        urgency: item.urgency || '',
        certainty: item.certainty || ''
      }
    })
    
    // 按严重级别排序（红色在前）
    warningList.sort((a, b) => b.severityLevel - a.severityLevel)
    
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
        await this.getWeatherData(false)
      } else {
        // 有缓存数据，检查是否过期（1小时）
        const now = Date.now()
        const cacheTime = cachedData.timestamp || 0
        const oneHour = 60 * 60 * 1000
        
        if (now - cacheTime > oneHour) {
          await this.getWeatherData(false)
        }
      }
    } catch (error) {
      this.handleError(error, '自动刷新检查')
    }
  },

  // 缓存天气数据
  cacheWeatherData(weatherData: CompleteWeatherData) {
    try {
      const cacheData = {
        data: weatherData,
        timestamp: Date.now(),
        expireTime: Date.now() + 60 * 60 * 1000 // 1小时过期
      }
      wx.setStorageSync('weather_cache', cacheData)
    } catch (error) {
      // 缓存失败不影响主流程
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
      // 清除缓存失败不影响主流程
    }
  },

  // 导航栏返回按钮事件
  onNavigateBack() {
    // 清理页面状态和资源
    this.forceHideLoading()
    
    // 可以在这里添加其他清理逻辑，比如：
    // - 保存用户浏览历史
    // - 清理定时器
    // - 发送统计数据等
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
