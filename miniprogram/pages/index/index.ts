// index.ts - 清理版本，只使用和风天气地理编码
import { checkPageAuth } from '../../utils/auth-guard'
import { 
  getTodayTasks, 
  TASK_TYPES, 
  PRIORITY_LEVELS 
} from '../../utils/breeding-schedule'
import CloudApi from '../../utils/cloud-api'

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
    todoList: [],
    todoLoading: false,
    
    // 弹窗相关状态
    showTaskDetailPopup: false,
    selectedTask: null as any,
    
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
    } catch (error) {
      console.error('❌ 检查同步状态失败:', error)
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
      
      // 先检查位置权限
      wx.getSetting({
        success: (settingsRes) => {
          
          if (settingsRes.authSetting['scope.userLocation'] === false) {
            console.error('🌍 首页：用户已拒绝位置权限')
            this.showLocationPermissionModal()
            reject(new Error('用户拒绝了位置权限'))
            return
          }
          
          // 强制获取高精度位置
          wx.getLocation({
            type: 'gcj02',
            isHighAccuracy: true,
            success: (locationRes) => {
              const { latitude, longitude, accuracy, speed, altitude } = locationRes
              
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

              wx.cloud.callFunction({
                name: 'weather',
                data: {
                  action: 'getCompleteWeather',
                  lat: latitude,
                  lon: longitude
                }
              }).then((result) => {
                if (result.result && result.result.success) {
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
  updateWeatherUI(weatherData) {
    
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

  // 获取待办事项 - 直接调用真实数据加载
  async getTodoListData() {
    console.log('🔄 首页getTodoListData开始')
    try {
      await this.loadTodayBreedingTasks()
      return true
    } catch (error) {
      console.error('❌ 首页获取待办事项失败:', error)
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
    } catch (error) {
      console.error('获取本地任务完成状态失败:', error)
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
    } catch (error) {
      console.error('首页保存任务完成状态失败:', error)
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
    } catch (error) {
      console.error('首页更新全局状态失败:', error)
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
    } catch (error) {
      console.error('❌ 同步单个任务状态失败:', error)
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
    } catch (error) {
      console.error('标记全局状态失败:', error)
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
      } catch (error) {
        // 直接调用待办页面方法失败（正常情况）
      }
    } catch (error) {
      console.error('❌ 通知待办页面失败:', error)
    }
  },

  // 加载今日养殖任务 - 与breeding-todo页面保持一致的逻辑
  async loadTodayBreedingTasks() {
    console.log('🔄 首页加载今日待办任务...')
    
    this.setData({ todoLoading: true })

    try {
      // 获取活跃批次
      const batchResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })

      const activeBatches = batchResult.result?.data || []
      console.log('📊 找到活跃批次:', activeBatches.length, '个')
      
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
          console.log(`📅 批次 ${batch.batchNumber || batch.id} 当前日龄: ${dayAge}`)
          
          // 使用与breeding-todo页面相同的CloudApi方法
          const result = await CloudApi.getTodos(batch.id, dayAge)
          
          if (result.success && result.data) {
            const tasks = result.data
            console.log(`✅ 批次 ${batch.batchNumber || batch.id} 获取到任务: ${tasks.length} 个`)
            
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
                priority: this.mapPriorityToTheme(task.priority),
                priorityText: PRIORITY_LEVELS[task.priority]?.name || '普通',
                tagTheme: this.mapPriorityToTheme(task.priority),
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
            console.warn(`⚠️ 批次 ${batch.batchNumber || batch.id} 任务获取失败:`, result.message)
          }
        } catch (batchError) {
          console.error(`❌ 批次 ${batch.batchNumber || batch.id} 处理失败:`, batchError)
        }
      }

      // 按优先级排序
      allTodos.sort((a, b) => {
        const priorityOrder: Record<string, number> = {
          'danger': 1,
          'warning': 2,
          'primary': 3,
          'default': 4
        }
        return (priorityOrder[a.priority] || 999) - (priorityOrder[b.priority] || 999)
      })

      // 首页只显示前6条，与未完成的任务
      const displayTodos = allTodos
        .filter(todo => !todo.completed) // 只显示未完成的
        .slice(0, 6)
      
      console.log(`✅ 首页待办加载完成: 总任务${allTodos.length}个, 显示${displayTodos.length}个未完成任务`)
      
      this.setData({
        todoList: displayTodos,
        todoLoading: false
      })
      
    } catch (error) {
      console.error('❌ 首页加载今日养殖任务失败:', error)
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

  // 辅助方法：获取优先级文本
  getPriorityText(priority: string): string {
    const priorityMap: Record<string, string> = {
      critical: '紧急',
      high: '重要',  
      medium: '普通',
      low: '较低'
    }
    return priorityMap[priority] || '普通'
  },

  // 调试方法：手动重新加载待办
  async debugLoadTodos() {
    console.log('🔧 用户点击调试按钮，重新加载待办')
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
    } catch (error) {
      console.error('调试加载失败:', error)
      wx.showToast({
        title: '加载失败，请查看控制台',
        icon: 'error'
      })
    }
  },

  // 优先级到主题颜色的映射
  mapPriorityToTheme(priority: string): string {
    const themeMap: Record<string, string> = {
      critical: 'danger',
      high: 'warning', 
      medium: 'primary',
      low: 'default'
    }
    return themeMap[priority] || 'primary'
  },

  // 查看全部待办 - 直接进入全批次今日待办页面
  async viewAllTodos() {
    try {
      // 直接跳转到breeding-todo页面，显示所有批次的今日待办
      wx.navigateTo({
        url: `/pages/breeding-todo/breeding-todo?showAllBatches=true`
      })
    } catch (error) {
      console.error('跳转到待办页面失败:', error)
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
    return task.type === 'vaccine' ||
           task.title?.includes('疫苗') || 
           task.title?.includes('接种') ||
           task.title?.includes('免疫') ||
           task.title?.includes('注射') ||
           task.title?.includes('血清') ||
           task.title?.includes('抗体') ||
           task.title?.includes('一针') ||
           task.title?.includes('二针') ||
           task.title?.includes('三针') ||
           task.description?.includes('注射') ||
           task.description?.includes('接种') ||
           task.description?.includes('疫苗') ||
           task.description?.includes('血清')
  },

  /**
   * 查看任务详情 - 使用弹窗展示
   */
  viewTaskDetail(event: any) {
    console.log('🔥 首页 viewTaskDetail 被调用')
    
    const task = event.currentTarget.dataset.task
    console.log('首页任务数据:', task)
    
    // 从任务数据中构建详细信息，所有任务都显示详情弹窗
    const enhancedTask = {
      ...task,
      
      // 确保ID字段存在（支持多种ID字段名）
      id: task.id || task.taskId || (task as any)._id || '',
      
      title: task.content || task.title || '未命名任务',
      typeName: this.getTypeName(task.type || ''),
      priorityName: this.getPriorityName(task.priority || 'medium'),
      priorityTheme: this.getPriorityTheme(task.priority || 'medium'),
      statusText: task.completed ? '已完成' : '待完成',
      
      // 标记是否为疫苗任务，用于弹窗中的按钮显示
      isVaccineTask: this.isVaccineTask(task),
      
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
    
    console.log('📋 显示任务详情弹窗:', enhancedTask.title)
    
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
   * 处理疫苗任务 - 跳转到详情页填写接种信息
   */
  handleVaccineTask() {
    const { selectedTask } = this.data
    if (!selectedTask) {
      this.closeTaskDetailPopup()
      return
    }

    console.log('🔄 处理疫苗任务:', selectedTask.title)
    
    // 关闭弹窗
    this.closeTaskDetailPopup()
    
    // 跳转到养殖待办页面并传递任务信息
    wx.navigateTo({
      url: `/pages/breeding-todo/breeding-todo?taskId=${selectedTask.id}&openVaccineForm=true`
    })
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
      console.error('首页任务ID缺失，任务数据:', selectedTask)
      wx.showToast({
        title: '任务ID缺失，无法完成',
        icon: 'error',
        duration: 2000
      })
      this.closeTaskDetailPopup()
      return
    }

    try {
      wx.showLoading({
        title: '正在完成任务...',
        mask: true
      })

      // 调用云函数完成任务
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'completeTask',
          taskId: taskId,
          batchId: selectedTask.batchNumber,
          dayAge: selectedTask.dayAge,
          completedAt: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      })

      if (result.result && result.result.success) {
        
        // 保存完成状态到本地存储
        this.saveTaskCompletionToLocal(taskId, true)
        
        // 更新全局状态
        this.updateGlobalTaskStatus(taskId, true)
        
        // 通知待办页面状态更新
        this.notifyBreedingTodoPageUpdate(taskId, true)
        
        // 更新首页待办列表中的任务状态（只更新匹配的任务）
        const updatedTodoList = this.data.todoList.map(task => {
          if (task.id && task.id === taskId) {
            return { ...task, completed: true, completedDate: new Date().toLocaleString() }
          }
          return task
        })
        
        this.setData({
          todoList: updatedTodoList
        })

        // 关闭弹窗
        this.closeTaskDetailPopup()

        // 显示成功提示
        wx.showToast({
          title: '任务已完成',
          icon: 'success',
          duration: 2000
        })

        // 重新加载今日任务以确保数据同步
        setTimeout(() => {
          this.loadTodayBreedingTasks()
        }, 1000)

      } else {
        throw new Error(result.result?.message || '完成任务失败')
      }

    } catch (error) {
      console.error('完成任务失败:', error)
      wx.showToast({
        title: '完成失败，请重试',
        icon: 'error',
        duration: 2000
      })
    } finally {
      wx.hideLoading()
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
   * 获取任务类型名称
   */
  getTypeName(type: string): string {
    const typeMap: Record<string, string> = {
      health: '健康检查',
      feed: '饲料管理',
      environment: '环境管理',
      medicine: '药物投喂',
      cleaning: '清洁消毒',
      observation: '观察记录',
      vaccination: '疫苗接种',
      treatment: '治疗护理'
    }
    return typeMap[type] || '其他'
  },

  /**
   * 获取优先级名称
   */
  getPriorityName(priority: string): string {
    const priorityMap: Record<string, string> = {
      critical: '紧急',
      high: '重要',
      medium: '普通',
      low: '较低'
    }
    return priorityMap[priority] || '普通'
  },

  /**
   * 获取优先级主题色
   */
  getPriorityTheme(priority: string): string {
    const themeMap: Record<string, string> = {
      critical: 'danger',
      high: 'warning',
      medium: 'primary',
      low: 'default'
    }
    return themeMap[priority] || 'primary'
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
        
        wx.cloud.callFunction({
          name: 'weather',
          data: {
            action: 'testAPI',
            lat: locationRes.latitude,
            lon: locationRes.longitude
          }
        }).then((result) => {
          wx.hideLoading()
          
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
        
        wx.cloud.callFunction({
          name: 'weather',
          data: {
            action: 'diagnoseAPI',
            lat: locationRes.latitude,
            lon: locationRes.longitude
          }
        }).then((result) => {
          wx.hideLoading()
          
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
        }).catch((error) => {
          console.error('天气数据自动刷新失败:', error)
          // 静默失败，不干扰用户体验
        })
      } else {
        const remainingTime = Math.floor((oneHour - (now - cacheTime)) / 1000 / 60)
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
  },
  
  // 刷新AI建议（用于下拉刷新）
  async refreshAIAdvice() {
    if (this.data.aiAdvice.result) {
      // 如果已有建议，静默刷新
      await this.generateFarmingAdvice()
    }
  }
})

