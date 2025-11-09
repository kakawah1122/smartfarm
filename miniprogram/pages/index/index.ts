// index.ts - 清理版本，只使用和风天气地理编码
import { checkPageAuth } from '../../utils/auth-guard'
import { 
  TYPE_NAMES,
  isMedicationTask,
  isNutritionTask
} from '../../utils/breeding-schedule'
import CloudApi from '../../utils/cloud-api'

interface VaccineFormData {
  // 兽医信息
  veterinarianName: string
  veterinarianContact: string
  
  // 疫苗信息
  vaccineName: string
  manufacturer: string
  batchNumber: string
  dosage: string
  routeIndex: number
  
  // 接种信息
  vaccinationCount: number
  location: string
  
  // 费用信息
  vaccineCost: string
  veterinaryCost: string
  otherCost: string
  totalCost: number
  totalCostFormatted: string
  
  // 备注
  notes: string
}

Page({
  data: {
    // 状态栏信息
    statusBarHeight: 44,
    statusBarText: '9:41 AM • 中国移动 • 100%',
    
    // 知识库预览
    knowledgeList: [],
    
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
    
    // 鹅价数据（数据库字段：goslingBreeds鹅苗, meatBreeds肉鹅）
    priceUpdateTime: '',
    priceBreeds: [],
    currentPriceBreed: 'extraLarge',
    currentPriceBreedLabel: '',
    goosePriceData: {} as Record<string, any>,
    goosePrice: {
      adult: '--',      // 肉鹅价格（元/斤）
      adultTrend: 0,
      adultChange: '+0.0',
      gosling: '--',    // 鹅苗价格（元/只）
      goslingTrend: 0,
      goslingChange: '+0.0'
    },
    
    // 任务相关
    selectedTask: null as any,
    showTaskDetailPopup: false,
    
    // 疫苗表单数据
    showVaccineFormPopup: false,
    vaccineFormData: {
      veterinarianName: '',
      veterinarianContact: '',
      vaccineName: '',
      manufacturer: '',
      batchNumber: '',
      dosage: '',
      routeIndex: 0,
      vaccinationCount: 0,
      location: '',
      vaccineCost: '',
      veterinaryCost: '',
      otherCost: '',
      totalCost: 0,
      totalCostFormatted: '¥0.00',
      notes: ''
    },
    vaccineFormErrors: {} as { [key: string]: string },
    vaccineRouteOptions: [
      { label: '肌肉注射', value: 'intramuscular' },
      { label: '皮下注射', value: 'subcutaneous' }, 
      { label: '滴鼻/滴眼', value: 'nasal_ocular' },
      { label: '饮水免疫', value: 'drinking_water' },
      { label: '喷雾免疫', value: 'spray' }
    ],
    
    // 用药管理表单数据
    showMedicationFormPopup: false,
    availableMedicines: [] as any[], // 可用的药品库存
    selectedMedicine: null as any,
    medicationFormData: {
      medicineId: '',
      medicineName: '',
      quantity: 0,
      unit: '',
      dosage: '',
      notes: '',
      operator: ''
    },
    medicationFormErrors: {} as { [key: string]: string },
    medicationFormErrorList: [] as string[],

    // 营养管理表单数据
    showNutritionFormPopup: false,
    availableNutrition: [] as any[], // 可用的营养品库存
    selectedNutrition: null as any,
    nutritionFormData: {
      nutritionId: '',
      nutritionName: '',
      quantity: 0,
      unit: '',
      dosage: '',
      notes: '',
      operator: ''
    },
    nutritionFormErrors: {} as { [key: string]: string },
    nutritionFormErrorList: [] as string[] // 用于模板遍历的错误列表
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
    // 检查是否需要同步任务状态
    this.checkAndSyncTaskStatus()
    
    // 检查天气缓存是否过期，如果过期则自动刷新
    this.checkAndAutoRefreshWeather()
    // 只刷新价格数据，天气数据使用缓存
    this.refreshPriceData()
  },

  // 检查并同步任务状态
  checkAndSyncTaskStatus() {
    try {
      const globalData = getApp<any>().globalData || {}
      
      // 检查是否有需要同步的标识
      if (globalData.needSyncHomepage && globalData.lastSyncTime) {
        
        // 立即同步全局状态中的任务更新
        const taskStatusUpdates = globalData.taskStatusUpdates || {}
        Object.keys(taskStatusUpdates).forEach(taskId => {
          const updateInfo = taskStatusUpdates[taskId]
          this.syncSingleTaskStatus(taskId, updateInfo.completed)
        })
        
        // 清除同步标识
        globalData.needSyncHomepage = false
      }
    } catch (error: any) {
      // 检查同步状态失败
    }
  },

  // 初始化状态栏
  initStatusBar() {
    try {
      const windowInfo = wx.getWindowInfo()
      const statusBarHeight = windowInfo.statusBarHeight || 44
      const now = new Date()
      const timeStr = now.toTimeString().slice(0, 5)
      
      this.setData({
        statusBarHeight,
        statusBarText: `${timeStr} • 中国移动 • 100%`
      })
    } catch (error: any) {
      // 状态栏初始化失败，使用默认值
    }
  },

  // 加载数据
  loadData() {
    this.setData({ 'weather.loading': true })
    
    Promise.all([
      this.getWeatherData(),
      this.getGoosePriceData(),
      this.getTodoListData(),
      this.loadKnowledgePreview()
    ]).then(() => {
      // no-op
    }).catch(() => {
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    }).finally(() => {
      this.setData({ 'weather.loading': false })
    })
  },

  // 获取天气数据
  getWeatherData(forceRefresh = false) {
    return new Promise((resolve, _reject) => {
      // 为了确保位置信息正确更新，先清除缓存
      if (forceRefresh) {
        this.clearWeatherCache()
      }
      
      // 如果不是强制刷新，首先尝试使用缓存数据
      if (!forceRefresh) {
        const cachedData = this.getCachedWeatherData()
        if (cachedData) {
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
      this.getLocationAndWeather().then((res: any) => {
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
      }).catch(_err => {
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
      
      // 先检查位置权限
      wx.getSetting({
        success: (settingsRes) => {
          
          if (settingsRes.authSetting['scope.userLocation'] === false) {
            this.showLocationPermissionModal()
            reject(new Error('用户拒绝了位置权限'))
            return
          }
          
          // 强制获取高精度位置
          wx.getLocation({
            type: 'gcj02',
            isHighAccuracy: true,
            success: (locationRes) => {
              const { latitude, longitude, accuracy: _accuracy, speed: _speed, altitude: _altitude } = locationRes
              
              // 验证坐标有效性
              if (!latitude || !longitude || latitude === 0 || longitude === 0) {
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

              wx.cloud.callFunction({
                name: 'weather',
                data: {
                  action: 'getCompleteWeather',
                  lat: latitude,
                  lon: longitude
                }
              }).then((result: any) => {
                if (result.result && result.result.success) {
                  resolve(result)
                } else {
                  const errorMsg = result.result?.message || result.result?.error?.message || '天气数据获取失败'
                  wx.showModal({
                    title: '天气数据获取失败',
                    content: errorMsg,
                    showCancel: false
                  })
                  reject(new Error(errorMsg))
                }
              }).catch((error: any) => {
                wx.showModal({
                  title: '网络错误',
                  content: '无法连接天气服务，请检查网络后重试',
                  showCancel: false
                })
                reject(error)
              })
            },
            fail: (error) => {
              this.handleLocationError(error)
              reject(error)
            }
          })
        },
        fail: (error) => {
          reject(error)
        }
      })
    })
  },
  
  // 处理位置获取错误
  handleLocationError(error: any) {
    
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
  updateWeatherUI(weatherData: any) {
    
    // 适配新的云函数数据格式
    let actualWeatherData = weatherData
    
    // 如果是新格式的数据结构（带有data字段）
    if (weatherData.data) {
      actualWeatherData = weatherData.data
    }
    
    // ✅ 优化：合并setData调用，避免重复设置location
    const updateData: any = {}
    
    // 详细检查位置信息
    const locationInfo = actualWeatherData.locationInfo
    
    if (locationInfo) {
      updateData.location = {
          province: locationInfo.province || '当前位置',
          city: locationInfo.city || '实时定位', 
          district: locationInfo.district || '周边区域'
        }
    } else {
      updateData.location = {
          province: '位置解析失败',
          city: '请查看控制台',
          district: new Date().toLocaleTimeString()
        }
      
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
    
    // 如果有错误，更新位置信息
    if (hasError) {
      updateData.location = {
        province: '网络错误',
        city: '请检查网络连接',
        district: '或重试获取'
      }
    }
    
    updateData.weather = {
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
    }
    
    // ✅ 一次性更新所有数据
    this.setData(updateData)
  },

  // 格式化更新时间
  formatUpdateTime(updateTime: any) {
    if (!updateTime) return '刚刚更新'
    
    try {
      const now = new Date()
      const update = new Date(updateTime)
      const diff = Math.floor((now.getTime() - update.getTime()) / 1000 / 60) // 分钟差
      
      if (diff < 1) return '刚刚更新'
      if (diff < 60) return `${diff}分钟前更新`
      if (diff < 24 * 60) return `${Math.floor(diff / 60)}小时前更新`
      return '超过1天前更新'
    } catch (error: any) {
      return '刚刚更新'
    }
  },

  // 获取鹅价数据
  async getGoosePriceData() {
    try {
      const db = wx.cloud.database()
      
      // 获取最新的价格记录（添加日期条件避免全表扫描）
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const result = await db.collection('goose_prices')
        .where({
          updateTime: db.command.gte(thirtyDaysAgo)
        })
        .orderBy('updateTime', 'desc')
        .limit(1)
        .get()

      if (result.data && result.data.length > 0) {
        const latestPrice = result.data[0]
        
        // 直接使用数据库的品种数据，不做映射
        const goosePriceData: Record<string, any> = {}
        const displayBreeds: Array<{ key: string; label: string }> = []

        // 处理鹅苗价格
        if (latestPrice.goslingBreeds && latestPrice.goslingBreeds.length > 0) {
          latestPrice.goslingBreeds.forEach((breed: any) => {
            goosePriceData[breed.key] = {
              label: breed.label,
              gosling: {
                price: breed.price.toFixed(1),
                trend: 0,
                change: '+0.0',
                range: breed.range
              },
              adult: {
                price: '--',
                trend: 0,
                change: '+0.0'
              },
              history: {
                gosling: [],
                adult: []
              }
            }
            displayBreeds.push({ key: breed.key, label: breed.label })
          })
        }

        // 处理肉鹅价格（映射到adult字段）
        if (latestPrice.meatBreeds && latestPrice.meatBreeds.length > 0) {
          // 使用肉鹅130日龄的价格作为成鹅价格
          const meat130 = latestPrice.meatBreeds.find((m: any) => m.key === 'meat130')
          const meat120 = latestPrice.meatBreeds.find((m: any) => m.key === 'meat120')
          
          // 将肉鹅价格应用到所有品种
          Object.keys(goosePriceData).forEach((key) => {
            // 优先使用130日龄价格，否则使用120日龄价格
            const meatData = meat130 || meat120
            if (meatData) {
              goosePriceData[key].adult = {
                price: meatData.price.toFixed(1),
                trend: 0,
                change: '+0.0',
                range: meatData.range,
                unit: '元/斤'
              }
            }
          })
        }

        // 如果没有从数据库获取到数据，使用默认品种
        if (displayBreeds.length === 0) {
          displayBreeds.push(
            { key: 'middle', label: '中种鹅' },
            { key: 'large', label: '大种鹅' },
            { key: 'extraLarge', label: '特大种鹅' }
          )
        }

        const updateTime = latestPrice.date ? 
          new Date(latestPrice.date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) :
          new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })

        const targetBreed = this.data.currentPriceBreed || 'extraLarge'

        this.setData({
          priceUpdateTime: updateTime,
          priceBreeds: displayBreeds,
          goosePriceData
        }, () => {
          this.updateDisplayedPrice(targetBreed)
        })

        this.cacheGoosePriceSnapshot({
          updateTime: updateTime,
          breeds: displayBreeds,
          data: goosePriceData
        })
        
        return true
      } else {
        // 如果数据库没有数据，显示空状态
        this.setData({
          priceUpdateTime: '',
          priceBreeds: [],
          goosePrice: {
            adult: '--',
            adultTrend: 0,
            adultChange: '+0.0',
            gosling: '--',
            goslingTrend: 0,
            goslingChange: '+0.0'
          }
        })
        return false
      }
    } catch (error) {
      console.error('获取鹅价数据失败:', error)
      // 出错时显示空状态
      this.setData({
        priceUpdateTime: '',
        priceBreeds: [],
        goosePrice: {
          adult: '--',
          adultTrend: 0,
          adultChange: '+0.0',
          gosling: '--',
          goslingTrend: 0,
          goslingChange: '+0.0'
        }
      })
      return false
    }
  },

  generatePriceHistory(base: number, days: number, volatility: number) {
    const history: Array<{ date: string; value: number }> = []
    const today = new Date()
    let previousValue = base

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)

      const fluctuation = (Math.random() * volatility * 2) - volatility
      const nextValue = Math.max(0, parseFloat((previousValue + fluctuation).toFixed(1)))
      previousValue = nextValue

      history.push({
        date: `${date.getMonth() + 1}-${date.getDate().toString().padStart(2, '0')}`,
        value: nextValue
      })
    }

    return history
  },

  calculateTrend(history: Array<{ value: number }>) {
    if (!history || history.length < 2) {
      return { trend: 0, change: '+0.0' }
    }
    const last = history[history.length - 1].value
    const previous = history[history.length - 2].value
    const diff = parseFloat((last - previous).toFixed(1))

    let trend = 0
    if (diff > 0) {
      trend = 1
    } else if (diff < 0) {
      trend = -1
    }
    const sign = diff > 0 ? '+' : diff < 0 ? '-' : '+'
    const change = `${sign}${Math.abs(diff).toFixed(1)}`
    return { trend, change }
  },

  updateDisplayedPrice(breedKey: string) {
    const breedData = this.data.goosePriceData?.[breedKey]
    if (!breedData) {
      return
    }
    this.setData({
      currentPriceBreed: breedKey,
      currentPriceBreedLabel: breedData.label,
      goosePrice: {
        adult: breedData.adult.price,
        adultTrend: breedData.adult.trend,
        adultChange: breedData.adult.change,
        gosling: breedData.gosling.price,
        goslingTrend: breedData.gosling.trend,
        goslingChange: breedData.gosling.change
      }
    })
  },

  cacheGoosePriceSnapshot(snapshot: { updateTime: string; breeds: Array<{ key: string; label: string }>; data: Record<string, any> }) {
    try {
      wx.setStorageSync('goose_price_snapshot', snapshot)
    } catch (error: any) {
      // 忽略缓存失败
    }
  },

  // 获取待办事项 - 首页已移除待办列表显示，保留方法以兼容调用
  async getTodoListData() {
    try {
      // 首页不再显示待办列表，方法保留作为占位
      return true
    } catch (error: any) {
      return false
    }
  },

  // 加载今日养殖任务 - 首页已移除待办列表显示，保留方法以兼容调用
  async loadTodayBreedingTasks() {
    // 首页不再显示待办列表，方法保留作为占位
    // 实际的任务管理请在 健康管理 -> 养殖待办 页面查看
    return true
  },

  // 刷新天气数据
  refreshWeatherData() {
    this.getWeatherData(true)
  },

  // 刷新价格数据
  refreshPriceData() {
    this.getGoosePriceData()
  },

  // 从本地存储获取任务完成状态
  getLocalTaskCompletions() {
    try {
      return wx.getStorageSync('completed_tasks') || {}
    } catch (error: any) {
      return {}
    }
  },

  // 保存任务完成状态到本地存储
  saveTaskCompletionToLocal(taskId: string, completed: boolean) {
    try {
      const key = 'completed_tasks'
      let completedTasks = wx.getStorageSync(key) || {}
      
      if (completed) {
        completedTasks[taskId] = {
          completed: true,
          completedDate: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      } else {
        delete completedTasks[taskId]
      }
      
      wx.setStorageSync(key, completedTasks)
    } catch (error: any) {
      // 保存任务完成状态失败
    }
  },

  // 更新全局任务状态
  updateGlobalTaskStatus(taskId: string, completed: boolean) {
    try {
      getApp<any>().globalData = getApp<any>().globalData || {}
      getApp<any>().globalData.taskStatusUpdates = getApp<any>().globalData.taskStatusUpdates || {}
      getApp<any>().globalData.taskStatusUpdates[taskId] = {
        completed,
        timestamp: Date.now()
      }
    } catch (error: any) {
      // 首页更新全局状态失败
    }
  },

  // 同步单个任务状态（已移除首页待办列表，无需更新UI）
  syncSingleTaskStatus(taskId: string, completed: boolean) {
    // 首页已不再显示待办列表，此方法保留以兼容其他页面调用
    // 实际同步逻辑已移至全局状态管理
  },

  // 全局同步方法（供其他页面调用）
  syncTaskStatusFromGlobal(taskId: string, completed: boolean) {
    
    // 保存到本地存储
    this.saveTaskCompletionToLocal(taskId, completed)
    
    // 立即同步单个任务状态
    this.syncSingleTaskStatus(taskId, completed)
    
    // 标记全局状态已同步
    try {
      const globalData = getApp<any>().globalData || {}
      if (globalData.taskStatusUpdates && globalData.taskStatusUpdates[taskId]) {
        globalData.taskStatusUpdates[taskId].synced = true
      }
    } catch (error: any) {
      // 标记全局状态失败
    }
  },

  // 通知待办页面任务状态更新（首页完成任务时）
  notifyBreedingTodoPageUpdate(taskId: string, completed: boolean) {
    try {
      
      // 1. 保存到全局状态（供待办页面使用）
      getApp<any>().globalData = getApp<any>().globalData || {}
      getApp<any>().globalData.taskStatusUpdates = getApp<any>().globalData.taskStatusUpdates || {}
      getApp<any>().globalData.taskStatusUpdates[taskId] = {
        completed,
        timestamp: Date.now(),
        source: 'homepage' // 标识更新来源
      }
      
      // 2. 设置待办页面同步标识
      getApp<any>().globalData.needSyncBreedingTodo = true
      
      // 3. 尝试直接调用待办页面的同步方法（如果存在）
      try {
        const pages = getCurrentPages()
        const breedingTodoPage = pages.find((page: any) => page.route === 'packageHealth/breeding-todo/breeding-todo')
        if (breedingTodoPage && typeof (breedingTodoPage as any).syncTaskStatusFromHomepage === 'function') {
          setTimeout(() => {
            (breedingTodoPage as any).syncTaskStatusFromHomepage(taskId, completed)
          }, 100) // 延迟100ms确保状态保存完成
        }
      } catch (error: any) {
        // 直接调用待办页面方法失败（正常情况）
      }
    } catch (error: any) {
      // 通知待办页面失败
    }
  },

  /**
   * 判断是否为疫苗接种任务
   */
  isVaccineTask(task: any): boolean {
    // 首先排除用药管理任务
    if (task.type === 'medication' || task.type === 'medicine') {
      return false
    }
    
    // 直接根据类型判断
    if (task.type === 'vaccine') {
      return true
    }
    
    // 通过类型名称判断
    const typeName = this.getTypeName(task.type || '')
    return typeName === '疫苗管理'
  },

  /**
   * 判断是否为用药管理任务
   */
  isMedicationTask(task: any): boolean {
    return isMedicationTask(task)
  },

  /**
   * 判断是否为营养管理任务
   */
  isNutritionTask(task: any): boolean {
    return isNutritionTask(task)
  },

  /**
   * 处理疫苗任务 - 直接打开疫苗表单
   */
  handleVaccineTask() {
    const { selectedTask } = this.data
    if (!selectedTask) {
      this.closeTaskDetailPopup()
      return
    }

    // 直接打开疫苗表单
    this.openVaccineForm(selectedTask)
  },

  /**
   * 打开疫苗表单
   */
  openVaccineForm(task: any) {
    this.initVaccineFormData(task)
    this.setData({
      showVaccineFormPopup: true,
      showTaskDetailPopup: false
    })
  },

  /**
   * 初始化疫苗表单数据
   */
  initVaccineFormData(task: any) {
    const vaccineFormData: VaccineFormData = {
      veterinarianName: '',
      veterinarianContact: '',
      vaccineName: task.title || '', // 使用任务标题作为疫苗名称初始值
      manufacturer: '',
      batchNumber: '',
      dosage: '0.5ml/只',
      routeIndex: 0,
      vaccinationCount: 0,
      location: '',
      vaccineCost: '',
      veterinaryCost: '',
      otherCost: '',
      totalCost: 0,
      totalCostFormatted: '¥0.00',
      notes: task.description || '' // 使用任务描述作为备注初始值
    }

    this.setData({
      vaccineFormData,
      vaccineFormErrors: {}
    })
  },

  /**
   * 关闭疫苗表单
   */
  closeVaccineFormPopup() {
    this.setData({
      showVaccineFormPopup: false
    })
  },

  /**
   * 疫苗表单输入处理
   */
  onVaccineFormInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`vaccineFormData.${field}`]: value
    })

    // 清除对应字段的错误
    if (this.data.vaccineFormErrors[field]) {
      this.setData({
        [`vaccineFormErrors.${field}`]: ''
      })
    }
  },

  /**
   * 数值输入处理（费用相关）
   */
  onVaccineNumberInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`vaccineFormData.${field}`]: value
    }, () => {
      // 如果是费用相关字段，重新计算总费用
      if (['vaccineCost', 'veterinaryCost', 'otherCost'].includes(field)) {
        setTimeout(() => {
          this.calculateTotalCost()
        }, 100)
      }
    })
  },

  /**
   * 路径选择处理
   */
  onVaccineRouteChange(e: any) {
    const { value } = e.detail
    this.setData({
      'vaccineFormData.routeIndex': parseInt(value)
    })
  },

  /**
   * 计算总费用
   */
  calculateTotalCost() {
    const { vaccineFormData } = this.data
    const vaccineCost = parseFloat(vaccineFormData.vaccineCost) || 0
    const veterinaryCost = parseFloat(vaccineFormData.veterinaryCost) || 0
    const otherCost = parseFloat(vaccineFormData.otherCost) || 0
    
    const total = vaccineCost + veterinaryCost + otherCost
    
    this.setData({
      'vaccineFormData.totalCost': total,
      'vaccineFormData.totalCostFormatted': `¥${total.toFixed(2)}`
    })
  },

  /**
   * 验证疫苗表单
   */
  validateVaccineForm(): boolean {
    const { vaccineFormData } = this.data
    const errors: { [key: string]: string } = {}

    // 必填字段验证
    const requiredFields = [
      { field: 'veterinarianName', message: '请输入执行兽医姓名' },
      { field: 'vaccineName', message: '请输入疫苗名称' },
      { field: 'dosage', message: '请输入接种剂量' },
      { field: 'vaccineCost', message: '请输入疫苗费用' }
    ]

    requiredFields.forEach(({ field, message }) => {
      if (!vaccineFormData[field as keyof VaccineFormData] || 
          vaccineFormData[field as keyof VaccineFormData] === '') {
        errors[field] = message
      }
    })

    // 数值验证
    if (vaccineFormData.vaccinationCount <= 0) {
      errors.vaccinationCount = '接种数量必须大于0'
    }

    this.setData({
      vaccineFormErrors: errors
    })

    if (Object.keys(errors).length > 0) {
      wx.showToast({
        title: '请完善必填信息',
        icon: 'none',
        duration: 2000
      })
      return false
    }

    return true
  },

  /**
   * 提交疫苗表单
   */
  async submitVaccineForm() {
    if (!this.validateVaccineForm()) {
      return
    }

    const { selectedTask, vaccineFormData, vaccineRouteOptions } = this.data

    if (!selectedTask) {
      wx.showToast({
        title: '任务信息丢失',
        icon: 'error'
      })
      return
    }

    // 获取任务ID和批次ID（多种字段名兼容）
    const taskId = selectedTask.id || selectedTask.taskId || selectedTask._id
    const batchId = selectedTask.batchNumber || selectedTask.batchId
    
    if (!taskId || !batchId) {
      wx.showToast({
        title: '任务或批次信息缺失',
        icon: 'error'
      })
      return
    }

    // 构建疫苗记录数据（与待办页面保持一致的格式）
    const vaccineRecord = {
      vaccine: {
        name: vaccineFormData.vaccineName,
        manufacturer: vaccineFormData.manufacturer,
        batchNumber: vaccineFormData.batchNumber,
        dosage: vaccineFormData.dosage
      },
      veterinarian: {
        name: vaccineFormData.veterinarianName,
        contact: vaccineFormData.veterinarianContact
      },
      vaccination: {
        route: vaccineRouteOptions[vaccineFormData.routeIndex].label,
        count: vaccineFormData.vaccinationCount,
        location: vaccineFormData.location
      },
      cost: {
        vaccine: parseFloat(vaccineFormData.vaccineCost || '0'),
        veterinary: parseFloat(vaccineFormData.veterinaryCost || '0'),
        other: parseFloat(vaccineFormData.otherCost || '0'),
        total: vaccineFormData.totalCost
      },
      notes: vaccineFormData.notes
    }

    // 调用优化后的API（已内置 loading 和 error 处理）
    const result = await CloudApi.completeVaccineTask({
      taskId: taskId,
      batchId: batchId,
      vaccineRecord
    })

    if (result.success) {
      // 关闭表单
      this.closeVaccineFormPopup()
      
      // 刷新待办列表
      this.getTodoListData()
    }
    // CloudApi 已经处理了错误提示和 loading，不需要额外的 try-catch
  },

  /**
   * 任务操作确认 - 根据任务类型执行不同操作
   */
  onTaskConfirm() {
    const task = this.data.selectedTask
    if (!task) return

    if (task.isVaccineTask) {
      this.handleVaccineTask()
    } else if (task.isMedicationTask) {
      this.handleMedicationTask()
    } else if (task.isNutritionTask) {
      this.handleNutritionTask()
    } else {
      this.completeTaskFromPopup()
    }
  },

  /**
   * 处理用药管理任务 - 直接打开用药管理表单
   */
  async handleMedicationTask() {
    const { selectedTask } = this.data
    if (!selectedTask) return

    this.closeTaskDetailPopup()
    
    // 直接在首页打开用药管理表单
    await this.openMedicationForm(selectedTask)
  },

  /**
   * 处理营养管理任务 - 直接打开营养管理表单
   */
  async handleNutritionTask() {
    const { selectedTask } = this.data
    if (!selectedTask) return

    this.closeTaskDetailPopup()
    
    // 直接在首页打开营养管理表单
    await this.openNutritionForm(selectedTask)
  },

  /**
   * 从弹窗完成任务
   */
  async completeTaskFromPopup() {
    const { selectedTask } = this.data
    if (!selectedTask || selectedTask.completed) {
      this.closeTaskDetailPopup()
      return
    }

    // 检查任务ID是否存在
    const taskId = selectedTask.id || selectedTask.taskId || (selectedTask as any)._id
    if (!taskId) {
      wx.showToast({
        title: '任务ID缺失，无法完成',
        icon: 'error',
        duration: 2000
      })
      this.closeTaskDetailPopup()
      return
    }

    // 首页已不再显示待办列表，此方法不再需要
    wx.showToast({
      title: '请在健康管理页面操作',
      icon: 'none'
    })
  },

  /**
   * 简化版本：立即更新首页UI中的任务完成状态（已移除首页待办列表）
   */
  updateTaskCompletionStatusInUI(taskId: string, completed: boolean) {
    // 首页已不再显示待办列表，此方法保留以兼容其他页面调用
    // 实际同步逻辑已移至全局状态管理
  },

  /**
   * 关闭任务详情弹窗
   */
  closeTaskDetailPopup() {
    this.setData({
      showTaskDetailPopup: false,
      selectedTask: null
    })
  },

  /**
   * 任务详情弹窗可见性变化
   */
  onTaskDetailPopupChange(event: any) {
    if (!event.detail.visible) {
      this.closeTaskDetailPopup()
    }
  },

  /**
   * 获取任务类型名称 - 使用统一的TYPE_NAMES映射
   */
  getTypeName(type: string): string {
    return TYPE_NAMES[type as keyof typeof TYPE_NAMES] || '其他'
  },


  // 跳转到天气详情页
  navigateToWeatherDetail() {
    wx.navigateTo({
      url: '/packageAI/weather-detail/weather-detail'
    })
  },

  // 跳转到鹅价详情页
  navigateToPriceDetail(event: any) {
    const { goosePriceData, priceBreeds, currentPriceBreed, priceUpdateTime } = this.data
    if (!goosePriceData || Object.keys(goosePriceData).length === 0) {
      wx.showToast({
        title: '暂未获取到鹅价数据',
        icon: 'none'
      })
      return
    }

    this.cacheGoosePriceSnapshot({
      updateTime: priceUpdateTime,
      breeds: priceBreeds,
      data: goosePriceData
    })

    // 从事件中获取 data-tab 属性，默认为 adult
    const targetTab = event?.currentTarget?.dataset?.tab || 'adult'
    const breed = currentPriceBreed || 'extraLarge'

    wx.navigateTo({
      url: `/packageProduction/goose-price-detail/goose-price-detail?breed=${breed}&tab=${targetTab}`
    })
  },

  // 手动刷新天气数据
  onWeatherRefresh(_event: any) {
    // 在微信小程序中，使用catchtap来阻止事件冒泡，而不是stopPropagation()
    
    this.setData({ 'weather.loading': true })
    
    // 强制刷新
    this.getWeatherData(true).then(() => {
      wx.showToast({
        title: '天气更新成功',
        icon: 'success',
        duration: 1500
      })
    }).catch((_error: any) => {
      wx.showToast({
        title: '刷新失败',
        icon: 'error',
        duration: 1500
      })
    }).finally(() => {
      this.setData({ 'weather.loading': false })
    })
  },

  // 缓存天气数据到本地存储
  cacheWeatherData(weatherData: any) {
    try {
      const cacheData = {
        data: weatherData,
        timestamp: Date.now(),
        expireTime: Date.now() + 60 * 60 * 1000 // 1小时过期
      }
      wx.setStorageSync('weather_cache', cacheData)
    } catch (error: any) {
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
    } catch (error: any) {
      return null
    }
  },

  // 清除天气缓存
  clearWeatherCache() {
    try {
      wx.removeStorageSync('weather_cache')
    } catch (error: any) {
      // 已移除调试日志
    }
  },

  // 检查并自动刷新天气
  checkAndAutoRefreshWeather() {
    try {
      const cacheData = wx.getStorageSync('weather_cache')
      if (!cacheData) {
        return
      }

      const now = Date.now()
      const cacheTime = cacheData.timestamp || 0
      const oneHour = 60 * 60 * 1000 // 1小时的毫秒数

      // 检查缓存是否超过1小时
      if (now - cacheTime > oneHour) {
        
        // 静默刷新，不显示loading和toast
        this.getWeatherData(true).then(() => {
          // 静默更新成功，不显示任何提示
        }).catch((error: any) => {
          // 已移除调试日志
          // 静默失败，不干扰用户体验
        })
      } else {
        // 缓存仍在有效期内，无需刷新
      }
    } catch (error: any) {
      // 已移除调试日志
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
  },

  // 计算当前日龄（与详情页逻辑保持一致）
  calculateCurrentAge(entryDate: string): number {
    // 只比较日期部分，不考虑具体时间（与 utils/breeding-schedule.js 保持一致）
    const today = new Date()
    const todayDateStr = today.toISOString().split('T')[0] // YYYY-MM-DD
    
    // 确保入栏日期也是 YYYY-MM-DD 格式
    const entryDateStr = entryDate.split('T')[0] // 移除可能的时间部分
    
    const todayDate = new Date(todayDateStr + 'T00:00:00')
    const startDate = new Date(entryDateStr + 'T00:00:00')
    
    // 计算日期差异
    const diffTime = todayDate.getTime() - startDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const dayAge = diffDays + 1 // 入栏当天为第1日龄
    
    return dayAge
  },

  // ========== 用药管理表单相关方法 ==========

  /**
   * 打开用药管理表单
   */
  async openMedicationForm(task: any) {
    // 确保selectedTask数据正确设置
    this.setData({
      selectedTask: task
    })
    
    // 先加载可用的药品库存
    await this.loadAvailableMedicines()
    
    // 初始化表单数据
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      medicationFormData: {
        medicineId: '',
        medicineName: '',
        quantity: 0,
        unit: '',
        dosage: '',
        notes: '',
        operator: userInfo?.nickName || userInfo?.name || '用户'
      },
      medicationFormErrors: {},
      medicationFormErrorList: [],
      showMedicationFormPopup: true
    })
    
    // 首页用药表单初始化完成
  },

  /**
   * 打开营养管理表单
   */
  async openNutritionForm(task: any) {
    // 确保selectedTask数据正确设置
    this.setData({
      selectedTask: task
    })
    
    // 先加载可用的营养品库存
    await this.loadAvailableNutrition()
    
    // 初始化表单数据
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      nutritionFormData: {
        nutritionId: '',
        nutritionName: '',
        quantity: 0,
        unit: '',
        dosage: '',
        notes: '',
        operator: userInfo?.nickName || userInfo?.name || '用户'
      },
      nutritionFormErrors: {},
      nutritionFormErrorList: [],
      showNutritionFormPopup: true
    })
    
    // 首页营养表单初始化完成
  },

  /**
   * 加载可用的药品库存
   */
  async loadAvailableMedicines() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_materials',
          category: '药品'  // 只获取药品类别的物料
        }
      })

      if (result.result && result.result.success) {
        const materials = result.result.data?.materials || []
        
        // 只显示有库存的药品
        const availableMedicines = materials
          .filter((material: any) => (material.currentStock || 0) > 0)
          .map((material: any) => ({
            id: material._id,
            name: material.name,
            unit: material.unit || '件',
            stock: material.currentStock || 0,
            category: material.category,
            description: material.description || ''
          }))

        // 首页加载到药品库存
        
        this.setData({
          availableMedicines: availableMedicines
        })
      } else {
        // 已移除调试日志
        // 已移除调试日志
        wx.showToast({
          title: '获取药品库存失败',
          icon: 'error'
        })
      }
    } catch (error: any) {
      wx.showToast({
        title: '网络异常，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 加载可用的营养品库存
   */
  async loadAvailableNutrition() {
    try {
      // 首页加载营养品库存
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_materials',
          category: '营养品'  // 只获取营养品类别的物料
        }
      })

      // 首页营养品云函数返回结果
      
      if (result.result && result.result.success) {
        const materials = result.result.data?.materials || []
        // 首页原始营养品数据
        
        // 只显示有库存的营养品
        const availableNutrition = materials
          .filter((material: any) => (material.currentStock || 0) > 0)
          .map((material: any) => ({
            id: material._id,
            name: material.name,
            unit: material.unit || '件',
            stock: material.currentStock || 0,
            category: material.category,
            description: material.description || ''
          }))

        // 首页加载到营养品库存
        // 首页可用营养品列表
        
        this.setData({
          availableNutrition: availableNutrition
        })
      } else {
        // 已移除调试日志
        // 已移除调试日志
        wx.showToast({
          title: '获取营养品库存失败',
          icon: 'error'
        })
      }
    } catch (error: any) {
      // 已移除调试日志
      wx.showToast({
        title: '网络异常，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 选择药品
   */
  onMedicineSelect(e: any) {
    const index = e.detail.value
    const selectedMedicine = this.data.availableMedicines[index]
    
    if (selectedMedicine) {
      this.setData({
        selectedMedicine: selectedMedicine,
        'medicationFormData.medicineId': selectedMedicine.id,
        'medicationFormData.medicineName': selectedMedicine.name,
        'medicationFormData.unit': selectedMedicine.unit
      })
      
      // 清除相关错误
      if (this.data.medicationFormErrors.medicineId) {
        const newErrors = { ...this.data.medicationFormErrors }
        delete newErrors.medicineId
        this.setData({
          medicationFormErrors: newErrors,
          medicationFormErrorList: Object.values(newErrors)
        })
      }
    }
  },

  /**
   * 选择营养品
   */
  onNutritionSelect(e: any) {
    const index = e.detail.value
    const selectedNutrition = this.data.availableNutrition[index]
    
    if (selectedNutrition) {
      this.setData({
        selectedNutrition: selectedNutrition,
        'nutritionFormData.nutritionId': selectedNutrition.id,
        'nutritionFormData.nutritionName': selectedNutrition.name,
        'nutritionFormData.unit': selectedNutrition.unit
      })
      
      // 清除相关错误
      if (this.data.nutritionFormErrors.nutritionId) {
        const newErrors = { ...this.data.nutritionFormErrors }
        delete newErrors.nutritionId
        this.setData({
          nutritionFormErrors: newErrors,
          nutritionFormErrorList: Object.values(newErrors)
        })
      }
    }
  },

  /**
   * 用药表单输入处理
   */
  onMedicationFormInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`medicationFormData.${field}`]: value
    })

    // 清除对应字段的错误
    if (this.data.medicationFormErrors[field]) {
      const newErrors = { ...this.data.medicationFormErrors }
      delete newErrors[field]
      this.setData({
        medicationFormErrors: newErrors,
        medicationFormErrorList: Object.values(newErrors)
      })
    }
  },

  /**
   * 营养表单输入处理
   */
  onNutritionFormInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`nutritionFormData.${field}`]: value
    })

    // 清除对应字段的错误
    if (this.data.nutritionFormErrors[field]) {
      const newErrors = { ...this.data.nutritionFormErrors }
      delete newErrors[field]
      this.setData({
        nutritionFormErrors: newErrors,
        nutritionFormErrorList: Object.values(newErrors)
      })
    }
  },

  /**
   * 用药数量输入处理
   */
  onMedicationQuantityInput(e: any) {
    const { value } = e.detail
    const quantity = parseInt(value) || 0
    
    // 首页用药数量输入
    
    this.setData({
      'medicationFormData.quantity': quantity
    })

    // 验证库存
    const { selectedMedicine } = this.data
    if (selectedMedicine && quantity > selectedMedicine.stock) {
      const newErrors = { ...this.data.medicationFormErrors }
      newErrors.quantity = `库存不足，当前库存${selectedMedicine.stock}${selectedMedicine.unit}`
      this.setData({
        medicationFormErrors: newErrors,
        medicationFormErrorList: Object.values(newErrors)
      })
    } else if (this.data.medicationFormErrors.quantity) {
      const newErrors = { ...this.data.medicationFormErrors }
      delete newErrors.quantity
      this.setData({
        medicationFormErrors: newErrors,
        medicationFormErrorList: Object.values(newErrors)
      })
    }
    
    // 首页用药数量更新完成
  },

  /**
   * 营养数量输入处理
   */
  onNutritionQuantityInput(e: any) {
    const { value } = e.detail
    const quantity = parseInt(value) || 0
    
    // 首页营养数量输入
    
    this.setData({
      'nutritionFormData.quantity': quantity
    })

    // 验证库存
    const { selectedNutrition } = this.data
    if (selectedNutrition && quantity > selectedNutrition.stock) {
      const newErrors = { ...this.data.nutritionFormErrors }
      newErrors.quantity = `库存不足，当前库存${selectedNutrition.stock}${selectedNutrition.unit}`
      this.setData({
        nutritionFormErrors: newErrors,
        nutritionFormErrorList: Object.values(newErrors)
      })
    } else if (this.data.nutritionFormErrors.quantity) {
      const newErrors = { ...this.data.nutritionFormErrors }
      delete newErrors.quantity
      this.setData({
        nutritionFormErrors: newErrors,
        nutritionFormErrorList: Object.values(newErrors)
      })
    }
    
    // 首页营养数量更新完成
  },

  /**
   * 关闭用药管理表单
   */
  closeMedicationFormPopup() {
    this.setData({
      showMedicationFormPopup: false,
      selectedMedicine: null,
      medicationFormData: {
        medicineId: '',
        medicineName: '',
        quantity: 0,
        unit: '',
        dosage: '',
        notes: '',
        operator: ''
      },
      medicationFormErrors: {},
      medicationFormErrorList: []
    })
  },

  /**
   * 关闭营养管理表单
   */
  closeNutritionFormPopup() {
    this.setData({
      showNutritionFormPopup: false,
      selectedNutrition: null,
      nutritionFormData: {
        nutritionId: '',
        nutritionName: '',
        quantity: 0,
        unit: '',
        dosage: '',
        notes: '',
        operator: ''
      },
      nutritionFormErrors: {},
      nutritionFormErrorList: []
    })
  },

  /**
   * 验证用药表单
   */
  validateMedicationForm(): boolean {
    const { medicationFormData, selectedMedicine } = this.data
    const errors: { [key: string]: string } = {}

    // 首页表单验证开始
    // 已移除调试日志
    // 已移除调试日志
    // 必填字段验证
    if (!medicationFormData.medicineId || !selectedMedicine) {
      errors.medicineId = '请选择药品'
      // 已移除调试日志
    }

    if (!medicationFormData.quantity || medicationFormData.quantity <= 0) {
      errors.quantity = '请输入正确的用药数量'
      // 已移除调试日志
    } else if (selectedMedicine && medicationFormData.quantity > selectedMedicine.stock) {
      errors.quantity = `库存不足，当前库存${selectedMedicine.stock}${selectedMedicine.unit}`
      // 已移除调试日志
    }

    // ✅ 用药用途不需要用户填写，任务本身已经明确定义

    // 更新错误对象和错误列表
    const errorList = Object.values(errors)
    this.setData({ 
      medicationFormErrors: errors,
      medicationFormErrorList: errorList
    })

    if (errorList.length > 0) {
      // 首页表单验证失败
      wx.showToast({
        title: errorList[0],
        icon: 'error'
      })
      return false
    }

    // 首页表单验证通过
    return true
  },

  /**
   * 验证营养表单
   */
  validateNutritionForm(): boolean {
    const { nutritionFormData, selectedNutrition } = this.data
    const errors: { [key: string]: string } = {}

    // 首页营养表单验证开始
    // 已移除调试日志
    // 已移除调试日志
    // 必填字段验证
    if (!nutritionFormData.nutritionId || !selectedNutrition) {
      errors.nutritionId = '请选择营养品'
      // 已移除调试日志
    }

    if (!nutritionFormData.quantity || nutritionFormData.quantity <= 0) {
      errors.quantity = '请输入正确的使用数量'
      // 已移除调试日志
    } else if (selectedNutrition && nutritionFormData.quantity > selectedNutrition.stock) {
      errors.quantity = `库存不足，当前库存${selectedNutrition.stock}${selectedNutrition.unit}`
      // 已移除调试日志
    }

    // 更新错误对象和错误列表
    const errorList = Object.values(errors)
    this.setData({ 
      nutritionFormErrors: errors,
      nutritionFormErrorList: errorList
    })

    if (errorList.length > 0) {
      // 首页营养表单验证失败
      wx.showToast({
        title: errorList[0],
        icon: 'error'
      })
      return false
    }

    // 首页营养表单验证通过
    return true
  },

  /**
   * 提交用药表单
   */
  async submitMedicationForm() {
    if (!this.validateMedicationForm()) {
      return
    }

    const { selectedTask, medicationFormData } = this.data
    
    // 首页提交用药表单
    // 已移除调试日志
    // 已移除调试日志
    if (!selectedTask) {
      // 已移除调试日志
      wx.showToast({
        title: '任务信息丢失',
        icon: 'error'
      })
      return
    }

    try {
      // 首页提交用药表单
      wx.showLoading({ title: '提交中...' })

      // ✅ 用途字段使用任务标题，不需要用户重复填写
      const purpose = selectedTask.title || '用药任务'

      // 构建用药记录数据 - 使用简化的API格式
      const recordData = {
        materialId: medicationFormData.medicineId,
        type: 'use',
        quantity: Number(medicationFormData.quantity),
        targetLocation: purpose,
        operator: medicationFormData.operator || '用户',
        status: '已完成',
        notes: `用途：${purpose}${medicationFormData.dosage ? '，剂量：' + medicationFormData.dosage : ''}${medicationFormData.notes ? '，备注：' + medicationFormData.notes : ''}，批次：${selectedTask.batchNumber || selectedTask.batchId || ''}`,
        recordDate: new Date().toISOString().split('T')[0]
      }

      // 首页构建的记录数据

      // 调用临时修复版云函数创建用药记录
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'create_record',
          recordData: recordData
        }
      })

      // 首页云函数调用结果

      if (result.result && result.result.success) {
        // 首页用药记录创建成功
        
        // 标记任务为完成
        await this.completeMedicationTask(selectedTask._id || selectedTask.id, selectedTask.batchNumber || selectedTask.batchId)
        
        wx.hideLoading()
        wx.showToast({
          title: '用药记录已创建',
          icon: 'success'
        })

        this.closeMedicationFormPopup()
        this.loadTodayBreedingTasks() // 刷新任务列表

      } else {
        // 已移除调试日志
        throw new Error(result.result?.message || result.result?.error || '提交失败')
      }

    } catch (error: any) {
      // 已移除调试日志
      wx.hideLoading()
      
      // 根据错误类型显示不同的处理方式
      if (error.message && error.message.includes('DATABASE_COLLECTION_NOT_EXIST')) {
        wx.showModal({
          title: '数据库配置异常',
          content: '物料记录系统暂时不可用，是否仅完成任务？仅完成任务不会扣减库存。',
          showCancel: true,
          cancelText: '取消',
          confirmText: '仅完成任务',
          success: (res) => {
            if (res.confirm) {
              this.completeMedicationTaskOnly(selectedTask)
            }
          }
        })
      } else {
        wx.showToast({
          title: error.message || '提交失败，请重试',
          icon: 'none',
          duration: 2000
        })
      }
    }
  },

  /**
   * 完成用药管理任务
   */
  async completeMedicationTask(taskId: string, batchId: string) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'completeTask',
          taskId: taskId,
          batchId: batchId,
          completedAt: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      })

      if (result.result && result.result.success) {
        // 首页用药管理任务完成
      } else {
        // 已移除调试日志
      }
    } catch (error: any) {
      // 已移除调试日志
    }
  },

  /**
   * 仅完成用药管理任务（不创建物料记录）
   */
  async completeMedicationTaskOnly(selectedTask: any) {
    try {
      wx.showLoading({ title: '完成任务中...' })
      
      // 首页仅完成用药管理任务，跳过物料记录
      
      // 标记任务为完成
      await this.completeMedicationTask(selectedTask._id || selectedTask.id, selectedTask.batchNumber || selectedTask.batchId)
      
      wx.hideLoading()
      wx.showToast({
        title: '任务已完成',
        icon: 'success'
      })

      this.closeMedicationFormPopup()
      this.loadTodayBreedingTasks() // 刷新任务列表

    } catch (error: any) {
      // 已移除调试日志
      wx.hideLoading()
      wx.showToast({
        title: '任务完成失败',
        icon: 'error'
      })
    }
  },

  // ========== 营养管理表单相关方法 ==========

  /**
   * 提交营养表单
   */
  async submitNutritionForm() {
    if (!this.validateNutritionForm()) {
      return
    }

    const { selectedTask, nutritionFormData } = this.data
    
    // 首页提交营养表单
    // 已移除调试日志
    // 已移除调试日志
    if (!selectedTask) {
      // 已移除调试日志
      wx.showToast({
        title: '任务信息丢失',
        icon: 'error'
      })
      return
    }

    try {
      // 首页提交营养表单
      wx.showLoading({ title: '提交中...' })

      // 构建营养记录数据 - 使用简化的API格式
      const recordData = {
        materialId: nutritionFormData.nutritionId,
        type: 'use',
        quantity: Number(nutritionFormData.quantity),
        targetLocation: selectedTask.title, // 使用任务标题作为用途
        operator: nutritionFormData.operator || '用户',
        status: '已完成',
        notes: `任务：${selectedTask.title}，批次：${selectedTask.batchNumber || selectedTask.batchId || ''}${nutritionFormData.dosage ? '，剂量：' + nutritionFormData.dosage : ''}${nutritionFormData.notes ? '，备注：' + nutritionFormData.notes : ''}`,
        recordDate: new Date().toISOString().split('T')[0]
      }

      // 首页构建的营养记录数据

      // 调用云函数创建营养记录
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'create_record',
          recordData: recordData
        }
      })

      // 首页营养云函数返回结果

      if (result.result && result.result.success) {
        // 首页营养记录创建成功
        
        // 完成对应的任务
        await this.completeNutritionTask(selectedTask)
        
        wx.hideLoading()
        wx.showToast({
          title: '营养使用记录已提交',
          icon: 'success',
          duration: 2000
        })

        this.closeNutritionFormPopup()
        this.loadTodayBreedingTasks() // 刷新任务列表

      } else {
        // 已移除调试日志
        throw new Error(result.result?.message || result.result?.error || '提交失败')
      }

    } catch (error: any) {
      // 已移除调试日志
      wx.hideLoading()
      
      // 根据错误类型显示不同的处理方式
      if (error.message && error.message.includes('DATABASE_COLLECTION_NOT_EXIST')) {
        wx.showModal({
          title: '数据库配置异常',
          content: '物料记录系统暂时不可用，是否仅完成任务？仅完成任务不会扣减库存。',
          showCancel: true,
          cancelText: '取消',
          confirmText: '仅完成任务',
          success: (res) => {
            if (res.confirm) {
              this.completeNutritionTaskOnly(selectedTask)
            }
          }
        })
      } else {
        wx.showToast({
          title: error.message || '提交失败，请重试',
          icon: 'none',
          duration: 2000
        })
      }
    }
  },

  /**
   * 完成营养管理任务
   */
  async completeNutritionTask(task: any) {
    // 首页完成营养管理任务
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo', 
        data: {
          action: 'completeTask',
          taskId: task.id || task.taskId || task._id,
          batchId: task.batchId || task.batchNumber || '',
          notes: '营养品领用完成'
        }
      })

      if (result.result?.success) {
        // 首页营养任务完成成功
        return true
      } else {
        // 已移除调试日志
        return false
      }
    } catch (error: any) {
      // 已移除调试日志
      return false
    }
  },

  /**
   * 仅完成营养管理任务（不创建物料记录）
   */
  async completeNutritionTaskOnly(selectedTask: any) {
    try {
      wx.showLoading({ title: '完成任务中...' })

      const success = await this.completeNutritionTask(selectedTask)

      wx.hideLoading()

      if (success) {
        wx.showToast({
          title: '任务已完成',
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: '任务完成失败',
          icon: 'error'
        })
      }

      this.closeNutritionFormPopup()
      this.loadTodayBreedingTasks() // 刷新任务列表

    } catch (error: any) {
      // 已移除调试日志
      wx.hideLoading()
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
    }
  },

  /**
   * 加载知识库预览数据（显示最近5篇文章）
   */
  async loadKnowledgePreview() {
    try {
      // 从数据库获取最近5篇文章
      const result = await wx.cloud.callFunction({
        name: 'knowledge-management',
        data: {
          action: 'list',
          page: 1,
          pageSize: 5
        }
      })

      if (result.result && result.result.success) {
        const articles = result.result.data.list || []
        // 转换为前端需要的格式
        const formattedArticles = articles.map((article: any) => ({
          id: article._id,
          title: article.title,
          description: article.description,
          category: article.category,
          categoryName: article.categoryName,
          categoryTheme: article.categoryTheme,
          views: article.views,
          readTime: article.readTime,
          date: article.date,
          content: article.content
        }))
        
        this.setData({
          knowledgeList: formattedArticles
        })
      } else {
        // 如果数据库没有数据，显示空状态
        this.setData({
          knowledgeList: []
        })
      }
    } catch (error) {
      console.error('加载知识库预览失败:', error)
      this.setData({
        knowledgeList: []
      })
    }
  },

  /**
   * 导航到知识库页面
   */
  navigateToKnowledge(e?: any) {
    // 阻止事件冒泡，避免触发卡片点击
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation()
    }
    wx.navigateTo({
      url: '/pages/knowledge/knowledge'
    })
  },

  /**
   * 查看文章详情
   */
  viewKnowledgeArticle(e: any) {
    const article = e.currentTarget.dataset.article
    if (!article) {
      return
    }

    try {
      const payload = encodeURIComponent(JSON.stringify(article))
      wx.navigateTo({
        url: `/pages/knowledge/article-detail/article-detail?article=${payload}`
      })
    } catch (error) {
      wx.showToast({ title: '文章打开失败', icon: 'none' })
    }
  }
})

