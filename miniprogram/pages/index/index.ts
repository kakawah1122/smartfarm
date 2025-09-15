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
    todoList: [] as any[],
    todoLoading: false,
    
    // 弹窗相关状态
    showTaskDetailPopup: false,
    selectedTask: null as any,
    
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
      purpose: '',
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
      purpose: '',
      dosage: '',
      notes: '',
      operator: ''
    },
    nutritionFormErrors: {} as { [key: string]: string },
    nutritionFormErrorList: [] as string[], // 用于模板遍历的错误列表
    
    // AI智能建议
    aiAdvice: {
      loading: false,
      result: {
        keyAdvice: [],
        environmentAdvice: []
      } as any,
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
    this.loadTodayBreedingTasks()
  },

  onShow() {
    // 检查是否需要同步任务状态
    this.checkAndSyncTaskStatus()
    
    // 检查天气缓存是否过期，如果过期则自动刷新
    this.checkAndAutoRefreshWeather()
    // 只刷新价格数据，天气数据使用缓存
    this.refreshPriceData()
    // 刷新今日养殖任务
    this.loadTodayBreedingTasks()
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
      const systemInfo = wx.getSystemInfoSync()
      const statusBarHeight = systemInfo.statusBarHeight || 44
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
    this.setData({ todoLoading: true, 'weather.loading': true })
    
    Promise.all([
      this.getWeatherData(),
      this.getGoosePriceData(),
      this.getTodoListData()
    ]).then(() => {
      // no-op
    }).catch(() => {
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    }).finally(() => {
      this.setData({ todoLoading: false, 'weather.loading': false })
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
    
    // 详细检查位置信息
    const locationInfo = actualWeatherData.locationInfo
    
    if (locationInfo) {
      
      // 立即更新位置信息
      this.setData({
        location: {
          province: locationInfo.province || '当前位置',
          city: locationInfo.city || '实时定位', 
          district: locationInfo.district || '周边区域'
        }
      })
    } else {
      // 位置信息为空分析
      
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

  // 获取待办事项 - 直接调用真实数据加载
  async getTodoListData() {
    try {
      await this.loadTodayBreedingTasks()
      return true
    } catch (error: any) {
      return false
    }
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

  // 同步单个任务状态（立即更新UI）
  syncSingleTaskStatus(taskId: string, completed: boolean) {
    try {
      
      // 立即更新首页待办列表中的任务状态
      const updatedTodoList = this.data.todoList.map(task => {
        if (task.id === taskId) {
          return { 
            ...task, 
            completed: completed,
            completedDate: completed ? new Date().toLocaleString() : ''
          }
        }
        return task
      })
      
      // 立即更新UI
      this.setData({
        todoList: updatedTodoList
      })
    } catch (error: any) {
      // 同步单个任务状态失败
    }
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
        const breedingTodoPage = pages.find((page: any) => page.route === 'pages/breeding-todo/breeding-todo')
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

  // 加载今日养殖任务 - 与breeding-todo页面保持一致的逻辑
  async loadTodayBreedingTasks() {
    // 首页加载今日待办任务
    
    this.setData({ todoLoading: true })

    try {
      // 获取活跃批次
      const batchResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })

      const activeBatches = batchResult.result?.data || []
      // 找到活跃批次
      
      if (activeBatches.length === 0) {
        this.setData({ 
          todoList: [],
          todoLoading: false
        })
        return
      }

      // 获取所有批次的今日任务
      let allTodos: any[] = []
      
      for (const batch of activeBatches) {
        try {
          const dayAge = this.calculateCurrentAge(batch.entryDate)
          // 批次当前日龄
          
          // 使用与breeding-todo页面相同的CloudApi方法
          const result = await CloudApi.getTodos(batch.id, dayAge)
          
          if (result.success && result.data) {
            const tasks = result.data
            // 批次获取到任务
            
            // 转换为首页显示格式 
            const formattedTasks = tasks.map((task: any) => {
              const taskId = task._id || task.id || task.taskId
              
              // 检查本地和全局的完成状态
              const localCompletions = this.getLocalTaskCompletions()
              const globalUpdates = getApp<any>().globalData?.taskStatusUpdates || {}
              
              let isCompleted = false
              let completedDate = ''
              
              if (localCompletions[taskId]) {
                isCompleted = localCompletions[taskId].completed
                completedDate = localCompletions[taskId].completedDate
              } else if (globalUpdates[taskId]) {
                isCompleted = globalUpdates[taskId].completed
              } else {
                isCompleted = task.completed || false
                completedDate = task.completedDate || ''
              }
              
              return {
                id: taskId,
                content: task.title,
                title: task.title,
                type: task.type,
                dayAge: dayAge,
                description: task.description || '',
                notes: task.notes || '',
                estimatedTime: task.estimatedDuration || '',
                duration: task.duration || '',
                dayInSeries: task.dayInSeries || '',
                dosage: task.dosage || '',
                materials: task.materials || [],
                batchNumber: batch.batchNumber || batch.id,
                completed: isCompleted,
                completedDate: completedDate
              }
            })
            
            allTodos = allTodos.concat(formattedTasks)
          } else {
            // 批次任务获取失败
          }
        } catch (batchError) {
          // 批次处理失败
        }
      }

      // 按批次分组，然后按任务类型排序
      allTodos.sort((a, b) => {
        // 首先按批次编号排序
        const batchCompare = (a.batchNumber || '').localeCompare(b.batchNumber || '')
        if (batchCompare !== 0) {
          return batchCompare
        }
        
        // 同一批次内，按任务类型排序 (疫苗任务优先)
        const typeOrder: Record<string, number> = {
          'vaccine': 1,
          'medication': 2,
          'inspection': 3,
          'nutrition': 4,
          'care': 5,
          'feeding': 6
        }
        return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99)
      })

      // 为每个任务添加批次索引，用于背景色区分
      const batchColors = ['batch-color-1', 'batch-color-2', 'batch-color-3', 'batch-color-4', 'batch-color-5']
      const batchNumbers = [...new Set(allTodos.map(todo => todo.batchNumber))]
      
      // 批次颜色分配信息
      
      allTodos = allTodos.map(todo => {
        const colorIndex = batchNumbers.indexOf(todo.batchNumber) % batchColors.length
        const colorClass = batchColors[colorIndex]
        
        return {
          ...todo,
          batchColorIndex: colorIndex,
          batchColorClass: colorClass
        }
      })

      // 首页显示逻辑：优先显示未完成的任务，然后显示最近完成的任务
      const uncompletedTodos = allTodos.filter(todo => !todo.completed)
      const recentlyCompletedTodos = allTodos
        .filter(todo => todo.completed && todo.completedDate)
        .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())
        .slice(0, 2) // 最多显示2个最近完成的任务
      
      // 合并未完成和最近完成的任务，总共不超过6条
      const displayTodos = [...uncompletedTodos, ...recentlyCompletedTodos].slice(0, 6)
      
      // 首页待办加载完成
      
      this.setData({
        todoList: displayTodos,
        todoLoading: false
      })
      
    } catch (error: any) {
      this.setData({
        todoList: [],
        todoLoading: false
      })
      
      wx.showToast({
        title: '加载待办失败',
        icon: 'error',
        duration: 2000
      })
    }
  },


  // 调试方法：手动重新加载待办
  async debugLoadTodos() {
    wx.showToast({
      title: '开始重新加载...',
      icon: 'loading',
      duration: 1500
    })
    
    // 重置状态
    this.setData({
      todoLoading: true,
      todoList: []
    })
    
    try {
      await this.loadTodayBreedingTasks()
    } catch (error: any) {
      wx.showToast({
        title: '加载失败，请查看控制台',
        icon: 'error'
      })
    }
  },

  // 修复批次任务
  async fixAllBatchTasks() {
    
    wx.showModal({
      title: '修复任务',
      content: '这将重新创建所有活跃批次的任务，是否继续？',
      showCancel: true,
      confirmText: '修复',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({
              title: '修复任务中...',
              mask: true
            })

            // 获取活跃批次
            const batchResult = await wx.cloud.callFunction({
              name: 'production-entry',
              data: { action: 'getActiveBatches' }
            })

            const activeBatches = batchResult.result?.data || []
            // 找到活跃批次

            if (activeBatches.length === 0) {
              wx.hideLoading()
              wx.showToast({
                title: '没有找到活跃批次',
                icon: 'none'
              })
              return
            }

            let totalFixed = 0
            let successCount = 0

            // 为每个批次修复任务
            for (const batch of activeBatches) {
              try {
                const result = await CloudApi.fixBatchTasks(batch.id)
                if (result.success) {
                  totalFixed += result.data?.taskCount || 0
                  successCount++
                  // 批次修复成功
                }
              } catch (error: any) {
                // 批次修复失败
              }
            }

            wx.hideLoading()

            // 显示修复结果
            wx.showModal({
              title: '修复完成',
              content: `成功修复 ${successCount}/${activeBatches.length} 个批次\n共创建任务 ${totalFixed} 个`,
              showCancel: false,
              confirmText: '确定',
              success: () => {
                // 重新加载待办列表
                this.loadTodayBreedingTasks()
              }
            })

          } catch (error: any) {
            wx.hideLoading()
            wx.showToast({
              title: '修复失败，请重试',
              icon: 'error'
            })
          }
        }
      }
    })
  },


  // 查看全部待办 - 直接进入全批次今日待办页面
  async viewAllTodos() {
    try {
      // 直接跳转到breeding-todo页面，显示所有批次的今日待办
      wx.navigateTo({
        url: `/pages/breeding-todo/breeding-todo?showAllBatches=true`
      })
    } catch (error: any) {
      wx.showToast({
        title: '跳转失败',
        icon: 'error'
      })
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
   * 查看任务详情 - 使用弹窗展示
   */
  viewTaskDetail(event: any) {
    const task = event.currentTarget.dataset.task
    
    // 从任务数据中构建详细信息，所有任务都显示详情弹窗
    const enhancedTask = {
      ...task,
      
      // 确保ID字段存在（支持多种ID字段名）
      id: task.id || task.taskId || (task as any)._id || '',
      
      title: task.content || task.title || '未命名任务',
      typeName: this.getTypeName(task.type || ''),
      statusText: task.completed ? '已完成' : '待完成',
      
      // 标记是否为疫苗任务，用于弹窗中的按钮显示
      isVaccineTask: this.isVaccineTask(task),
      
      // 标记是否为用药管理任务，用于弹窗中的按钮显示
      isMedicationTask: this.isMedicationTask(task),
      
      // 标记是否为营养管理任务，用于弹窗中的按钮显示
      isNutritionTask: this.isNutritionTask(task),
      
      // 确保其他字段存在
      description: task.description || '',
      notes: task.notes || '',
      estimatedTime: task.estimatedTime || '',
      duration: task.duration || '',
      dayInSeries: task.dayInSeries || '',
      dosage: task.dosage || '',
      materials: Array.isArray(task.materials) ? task.materials : [],
      batchNumber: task.batchNumber || '',
      dayAge: task.dayAge || '',
      
      // 确保completed状态正确
      completed: task.completed || false
    }
    
    this.setData({
      selectedTask: enhancedTask,
      showTaskDetailPopup: true
    })
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

    wx.showLoading({
      title: '提交中...',
      mask: true
    })

    try {
      // 构建提交数据
      const vaccineRecord = {
        ...vaccineFormData,
        routeName: vaccineRouteOptions[vaccineFormData.routeIndex].label,
        completedDate: new Date().toISOString()
      }

      const submitData = {
        taskId: selectedTask.id || selectedTask.taskId || selectedTask._id,
        batchId: selectedTask.batchNumber || selectedTask.batchId,
        vaccineRecord: vaccineRecord
      }

      // 调用云函数
      const result = await CloudApi.completeVaccineTask(submitData)
      
      if (result.success) {
        wx.hideLoading()
        wx.showToast({
          title: '接种记录已提交',
          icon: 'success',
          duration: 2000
        })

        // 关闭表单
        this.closeVaccineFormPopup()
        
        // 刷新待办列表
        this.getTodoListData()
        
      } else {
        throw new Error(result.error || '提交失败')
      }

    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error',
        duration: 3000
      })
    }
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

    // 使用页面级loading，避免全局show/hide未配对告警
    this.setData({ todoLoading: true })
    try {

      // 检查批次ID字段
      const batchId = selectedTask.batchNumber || selectedTask.batchId
      
      if (!batchId) {
        wx.showToast({
          title: '批次ID缺失，无法完成任务',
          icon: 'error',
          duration: 2000
        })
        this.closeTaskDetailPopup()
        return
      }

      // 调用云函数完成任务
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'completeTask',
          taskId: taskId,
          batchId: batchId,
          dayAge: selectedTask.dayAge,
          completedAt: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      })
      
      if (result.result && result.result.success) {
        
        // 检查是否为重复完成
        if (result.result.already_completed) {
          
          // 立即更新UI状态显示划线效果
          this.updateTaskCompletionStatusInUI(taskId, true)
          
          // 关闭弹窗
          this.closeTaskDetailPopup()
          
          // 显示友好提示
          wx.showToast({
            title: '该任务已完成',
            icon: 'success',
            duration: 2000
          })
          
          // 重新加载数据确保同步
          setTimeout(() => {
            this.loadTodayBreedingTasks()
          }, 500)
          
          // 仅依赖 finally 统一隐藏，避免未配对告警
          return
        }
        
        // 任务完成处理
        
        // 立即更新UI状态显示划线效果
        this.updateTaskCompletionStatusInUI(taskId, true)

        // 关闭弹窗
        this.closeTaskDetailPopup()

        // 显示成功提示
        wx.showToast({
          title: '任务完成成功！',
          icon: 'success',
          duration: 2000
        })

        // 重新加载数据以确保UI同步（数据库中的状态已经更新）
        setTimeout(() => {
          this.loadTodayBreedingTasks()
        }, 500)

      } else {
        throw new Error(result.result?.error || result.result?.message || '完成任务失败')
      }

    } catch (error: any) {
      wx.showToast({
        title: error.message === '任务已经完成' ? '该任务已完成' : '完成失败，请重试',
        icon: error.message === '任务已经完成' ? 'success' : 'error',
        duration: 2000
      })
    } finally {
      this.setData({ todoLoading: false })
    }
  },

  /**
   * 简化版本：立即更新首页UI中的任务完成状态
   */
  updateTaskCompletionStatusInUI(taskId: string, completed: boolean) {
    let taskFound = false
    
    // 🔥 强化ID匹配逻辑
    const matchTask = (task: any) => {
      const possibleIds = [task._id, task.id, task.taskId].filter(Boolean)
      return possibleIds.includes(taskId)
    }
    
    // 更新首页待办列表中的任务状态
    const updatedTodoList = this.data.todoList.map(task => {
      if (matchTask(task)) {
        taskFound = true
        // 首页找到并更新任务
        return { 
          ...task, 
          completed, 
          completedDate: completed ? new Date().toLocaleString() : ''
        }
      }
      return task
    })
    
    if (!taskFound) {
      // 首页未找到匹配的任务ID
    }
    
    // 强制数据更新
    this.setData({
      todoList: updatedTodoList
    })
  },

  /**
   * 🔥 新增：一键修复任务系统
   */
  async fixTaskSystem() {
    wx.showLoading({ title: '正在修复任务系统...' })
    
    try {
      // 1. 检查迁移状态
      const checkResult = await wx.cloud.callFunction({
        name: 'task-migration',
        data: { action: 'checkMigrationStatus' }
      })
      
      if (checkResult.result.success) {
        const status = checkResult.result.data
        // 已移除调试日志
        if (status.needsMigration > 0) {
          // 2. 执行迁移
          // 已移除调试日志
          const migrateResult = await wx.cloud.callFunction({
            name: 'task-migration',
            data: { action: 'addCompletedField' }
          })
          
          if (migrateResult.result.success) {
            // 已移除调试日志
            // 3. 同步已完成状态
            const syncResult = await wx.cloud.callFunction({
              name: 'task-migration',
              data: { action: 'migrateCompletedTasks' }
            })
            
            if (syncResult.result.success) {
              // 已移除调试日志
              wx.hideLoading()
              wx.showModal({
                title: '修复完成',
                content: `任务系统修复成功！\n迁移了 ${migrateResult.result.data.migratedCount} 个任务\n同步了 ${syncResult.result.data.syncedCount} 个完成状态`,
                showCancel: false,
                success: () => {
                  this.loadTodayBreedingTasks()
                }
              })
              return
            }
          }
        } else {
          wx.hideLoading()
          wx.showToast({
            title: '任务系统状态正常',
            icon: 'success'
          })
          
          // 重新加载数据
          this.loadTodayBreedingTasks()
          return
        }
      }
      
      throw new Error('修复过程中出现错误')
      
    } catch (error: any) {
      // 已移除调试日志
      wx.hideLoading()
      wx.showModal({
        title: '修复失败',
        content: `错误信息: ${error.message}`,
        showCancel: false
      })
    }
  },

  /**
   * 🔍 验证任务完成状态是否正确保存到数据库
   */
  async verifyTaskCompletionInDatabase(taskId: string, batchId: string) {
    try {
      // 已移除调试日志
      // 直接调用云函数获取最新的任务状态
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'getTodos',
          batchId: batchId,
          dayAge: this.data.selectedTask?.dayAge || this.calculateCurrentAge(new Date().toISOString().split('T')[0])
        }
      })
      
      if (result.result && result.result.success) {
        const tasks = result.result.data || []
        const targetTask = tasks.find((task: any) => 
          task._id === taskId || task.taskId === taskId || task.id === taskId
        )
        
        if (targetTask) {
          // 已移除调试日志
          if (targetTask.completed) {
            // 已移除调试日志
          } else {
            // 已移除调试日志
            // 尝试修复：强制重新调用完成接口
            wx.showModal({
              title: '检测到数据同步问题',
              content: '任务完成状态未正确保存，是否尝试修复？',
              success: async (res) => {
                if (res.confirm) {
                  // 已移除调试日志
                  try {
                    await CloudApi.completeTask(taskId, batchId, '修复同步')
                    setTimeout(() => {
                      this.loadTodayBreedingTasks()
                    }, 1000)
                  } catch (error: any) {
                    // 已移除调试日志
                  }
                }
              }
            })
          }
        } else {
          // 已移除调试日志
        }
      } else {
        // 已移除调试日志
      }
    } catch (error: any) {
      // 已移除调试日志
    }
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
      url: '/pages/weather-detail/weather-detail'
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
    this.setData({ 'weather.loading': true })
    
    // 清除缓存
    this.clearWeatherCache()
    
    // 强制获取天气
    this.getWeatherData(true).then(() => {
      wx.showToast({
        title: '获取成功',
        icon: 'success',
        duration: 2000
      })
    }).catch((error: any) => {
      wx.showModal({
        title: '获取失败',
        content: error.errMsg || error.message || '获取天气失败',
        showCancel: false
      })
    }).finally(() => {
      this.setData({ 'weather.loading': false })
    })
  },

  // 测试API连接
  testAPIConnections() {
    this.setData({ 'weather.loading': true })
    
    // 先获取位置
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (locationRes) => {
        
        wx.cloud.callFunction({
          name: 'weather',
          data: {
            action: 'testAPI',
            lat: locationRes.latitude,
            lon: locationRes.longitude
          }
        }).then((result: any) => {
          
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
        }).catch((error: any) => {
          // 已移除调试日志
          wx.showModal({
            title: 'API测试错误',
            content: error.errMsg || error.message || '测试失败',
            showCancel: false
          })
        }).finally(() => {
          this.setData({ 'weather.loading': false })
        })
      },
      fail: (_error) => {
        wx.showModal({
          title: '位置获取失败',
          content: '无法获取位置进行API测试',
          showCancel: false
        })
        this.setData({ 'weather.loading': false })
      }
    })
  },

  // API问题诊断 - 基于官方文档的深度诊断
  diagnoseAPIIssues() {
    this.setData({ 'weather.loading': true })
    
    // 先获取位置
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (locationRes) => {
        
        wx.cloud.callFunction({
          name: 'weather',
          data: {
            action: 'diagnoseAPI',
            lat: locationRes.latitude,
            lon: locationRes.longitude
          }
        }).then((result: any) => {
          
          if (result.result && result.result.success) {
            const diagnosis = result.result.data
            
            // 构建诊断报告
            let reportContent = `📊 诊断报告\n\n`
            reportContent += `总体状态: ${diagnosis.summary?.overallStatus || '未知'}\n`
            reportContent += `成功率: ${diagnosis.summary?.successRate || 0}%\n`
            reportContent += `成功测试: ${diagnosis.summary?.successfulTests || 0}/${diagnosis.summary?.totalTests || 0}\n\n`
            
            if (diagnosis.issues && diagnosis.issues.length > 0) {
              reportContent += `❌ 发现问题:\n`
              diagnosis.issues.forEach((issue: any) => {
                reportContent += `${issue}\n`
              })
              reportContent += `\n`
            }
            
            if (diagnosis.recommendations && diagnosis.recommendations.length > 0) {
              reportContent += `💡 建议措施:\n`
              diagnosis.recommendations.slice(0, 3).forEach((rec: any) => {
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
        }).catch((error: any) => {
          // 已移除调试日志
          wx.showModal({
            title: '诊断错误',
            content: '诊断过程出错: ' + (error.errMsg || error.message || '未知错误'),
            showCancel: false
          })
        }).finally(() => {
          this.setData({ 'weather.loading': false })
        })
      },
      fail: (_error) => {
        wx.showModal({
          title: '位置获取失败',
          content: '无法获取位置进行诊断',
          showCancel: false
        })
        this.setData({ 'weather.loading': false })
      }
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
        
        // 静默刷新，不显示loading
        this.getWeatherData(true).then(() => {
          // 可以显示一个轻量提示
          wx.showToast({
            title: '天气已更新',
            icon: 'none',
            duration: 1000
          })
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
      
    } catch (error: any) {
      // 已移除调试日志
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
    } catch (error: any) {
      // 已移除调试日志
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
    } catch (error: any) {
      // 已移除调试日志
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
      "description": "具体建议内容"
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
    } catch (error: any) {
      // 已移除调试日志
      return this.generateFallbackAdvice()
    }
  },
  
  // 生成fallback建议
  generateFallbackAdvice(_envData?: any, _prodData?: any): any {
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
        description: '气温较低，注意鹅舍保温，防止鹅群感冒'
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
        description: '气温较高，增加通风，提供充足饮水'
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
        description: '温度适宜，继续当前的饲养管理'
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
        description: '湿度过高，加强通风除湿，预防疾病'
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
      description: '定时检查饲料新鲜度，确保营养均衡'
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
    
    // 获取关键建议
    const keyAdvice = result.keyAdvice || []
    if (keyAdvice.length === 0) {
      wx.showToast({
        title: '没有重要建议需要添加',
        icon: 'none'
      })
      return
    }
    
    // 添加到待办列表（这里是模拟，实际可以保存到云端）
    const newTodos = keyAdvice.map((advice: any, index: any) => ({
      id: Date.now() + index,
      content: advice.title + '：' + advice.description,
      typeName: 'AI建议'
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
  },
  
  // 刷新AI建议（用于下拉刷新）
  async refreshAIAdvice() {
    if (this.data.aiAdvice.result) {
      // 如果已有建议，静默刷新
      await this.generateFarmingAdvice()
    }
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
        purpose: '',
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
        purpose: '',
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
        purpose: '',
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
        purpose: '',
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

    if (!medicationFormData.purpose) {
      errors.purpose = '请填写用药用途'
      // 已移除调试日志
    }

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

    if (!nutritionFormData.purpose) {
      errors.purpose = '请填写使用用途'
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

      // 构建用药记录数据 - 使用简化的API格式
      const recordData = {
        materialId: medicationFormData.medicineId,
        type: 'use',
        quantity: Number(medicationFormData.quantity),
        targetLocation: medicationFormData.purpose,
        operator: medicationFormData.operator || '用户',
        status: '已完成',
        notes: `用途：${medicationFormData.purpose}${medicationFormData.dosage ? '，剂量：' + medicationFormData.dosage : ''}${medicationFormData.notes ? '，备注：' + medicationFormData.notes : ''}，任务：${selectedTask.title}，批次：${selectedTask.batchNumber || selectedTask.batchId || ''}`,
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
        targetLocation: nutritionFormData.purpose,
        operator: nutritionFormData.operator || '用户',
        status: '已完成',
        notes: `用途：${nutritionFormData.purpose}${nutritionFormData.dosage ? '，剂量：' + nutritionFormData.dosage : ''}${nutritionFormData.notes ? '，备注：' + nutritionFormData.notes : ''}，任务：${selectedTask.title}，批次：${selectedTask.batchNumber || selectedTask.batchId || ''}`,
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
          action: 'complete_task',
          taskId: task.id || task.taskId || task._id
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

  // ========== 临时调试方法 ==========
  
  /**
   * 测试数据库连接（临时调试用）
   */
  async testDatabaseConnection() {
    try {
      // 已移除调试日志
      wx.showLoading({ title: '测试中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'test-material',
        data: {}
      })
      
      wx.hideLoading()
      // 已移除调试日志
      // 已移除调试日志
      // 已移除调试日志
      if (!result.result) {
        wx.showModal({
          title: '云函数返回异常',
          content: '云函数没有返回预期的结果，请检查云函数是否正确上传和执行',
          showCancel: false
        })
        return
      }
      
      if (result.result.success) {
        wx.showModal({
          title: '数据库测试成功',
          content: '所有数据库操作测试通过！',
          showCancel: false
        })
      } else {
        wx.showModal({
          title: '数据库测试失败',
          content: `失败步骤: ${result.result.step || '未知'}\n错误: ${result.result.error || '未知错误'}`,
          showCancel: false
        })
      }
      
    } catch (error: any) {
      // 已移除调试日志
      wx.hideLoading()
      wx.showModal({
        title: '测试执行失败',
        content: `错误信息: ${error.message}`,
        showCancel: false
      })
    }
  }
})

