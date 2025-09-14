// breeding-todo/breeding-todo.ts - 待办任务页面（优化版）
import CloudApi from '../../utils/cloud-api'
import { TYPE_NAMES } from '../../utils/breeding-schedule'

interface Task {
  _id: string
  id?: string
  taskId?: string
  title: string
  content?: string
  description: string
  type: string
  dayAge: number | string
  batchId: string
  batchNumber?: string
  completed: boolean
  completedDate?: string
  isVaccineTask: boolean
  priority: string
  estimatedDuration: number
  estimatedTime?: number
  duration?: number
  dayInSeries?: number
  dosage?: string
  notes?: string
  materials?: string[]
}

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
    // 任务数据
    todos: [] as Task[],
    selectedTask: null as Task | null,
    showTaskDetail: false,
    showTaskDetailPopup: false,
    
    // 多批次任务数据
    showAllBatches: false,
    todayTasksByBatch: [] as Array<{
      batchId: string,
      batchNumber: string,
      dayAge: number,
      tasks: Task[]
    }>,
    activeBatchCount: 0,
    allTasksCount: 0,
    allCompletedCount: 0,
    allCompletionPercentage: 0,
    
    // Tab相关
    activeTab: 'today',
    upcomingTasks: [] as any[],
    historyTasks: [] as any[],
    taskOverlaps: [] as any[],
    
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
    vaccineRouteOptions: ['肌肉注射', '皮下注射', '滴鼻/滴眼', '饮水免疫', '喷雾免疫'],
    
    // 页面状态
    loading: false,
    refreshing: false,
    currentBatchId: '',
    currentDayAge: 0,
    
    // 批次相关
    showBatchDialog: false,
    batchList: [] as any[],
    selectedBatch: {} as any,
    
    // 统计信息
    completedCount: 0,
    totalCount: 0,
    completionRate: '0%'
  },

  /**
   * 页面加载
   */
  onLoad(options: any) {
    console.log('页面加载参数:', options)
    
    const showAllBatches = options.showAllBatches === 'true'
    
    this.setData({
      showAllBatches: showAllBatches,
      currentBatchId: options.batchId || this.getCurrentBatchId(),
      currentDayAge: parseInt(options.dayAge) || 0
    })

    // 根据参数决定加载方式
    if (showAllBatches) {
      // 加载所有批次的今日待办
      this.loadAllBatchesTodayTasks()
    } else if (!this.data.currentBatchId) {
      // 如果没有批次ID，尝试获取默认批次
      this.getDefaultBatch()
    } else {
      // 检查是否需要直接打开疫苗表单
      if (options.openVaccineForm === 'true' && options.taskId) {
        this.openVaccineFormWithTaskId(options.taskId)
      } else {
        this.loadTodos()
      }
    }
  },

  /**
   * 页面显示时刷新数据
   */
  onShow() {
    if (this.data.showAllBatches) {
      this.loadAllBatchesTodayTasks()
    } else if (this.data.currentBatchId) {
      this.loadTodos()
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({ refreshing: true })
    
    if (this.data.showAllBatches) {
      this.loadAllBatchesTodayTasks().finally(() => {
        this.setData({ refreshing: false })
        wx.stopPullDownRefresh()
      })
    } else {
      this.loadTodos().finally(() => {
        this.setData({ refreshing: false })
        wx.stopPullDownRefresh()
      })
    }
  },

  /**
   * 获取当前批次ID（从缓存或全局状态）
   */
  getCurrentBatchId(): string {
    // 从本地存储或全局状态获取当前批次ID
    return wx.getStorageSync('currentBatchId') || ''
  },

  /**
   * 获取默认批次
   */
  async getDefaultBatch() {
    try {
      const batchResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })

      const activeBatches = batchResult.result?.data || []
      
      if (activeBatches.length === 0) {
        wx.showModal({
          title: '提示',
          content: '暂无活跃批次，请先在生产管理页面创建批次',
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
        return
      }

      // 使用第一个活跃批次
      const defaultBatch = activeBatches[0]
      const dayAge = this.calculateCurrentAge(defaultBatch.entryDate)
      
      this.setData({
        currentBatchId: defaultBatch.id,
        currentDayAge: dayAge
      })

      // 保存到缓存
      wx.setStorageSync('currentBatchId', defaultBatch.id)
      
      this.loadTodos()
    } catch (error) {
      console.error('获取默认批次失败:', error)
      wx.showToast({
        title: '获取批次信息失败',
        icon: 'error'
      })
    }
  },

  /**
   * 计算日龄
   */
  calculateCurrentAge(entryDate: string): number {
    const entryTime = new Date(entryDate).getTime()
    const currentTime = new Date().getTime()
    const dayAge = Math.floor((currentTime - entryTime) / (1000 * 60 * 60 * 24)) + 1
    return Math.max(1, dayAge)
  },

  /**
   * 加载任务列表
   */
  async loadTodos() {
    if (!this.data.currentBatchId) {
      wx.showToast({
        title: '批次信息缺失',
        icon: 'error'
      })
      return
    }

    this.setData({ loading: true })

    try {
      const result = await CloudApi.getTodos(this.data.currentBatchId, this.data.currentDayAge)
      
      if (result.success && result.data) {
        const todos = result.data
        
        // 🔍 详细日志 - 检查任务完成状态
        todos.forEach((task: any) => {
          if (task.completed) {
            console.log('🟢 loadTodos加载到已完成任务:', {
              taskId: task._id,
              title: task.title,
              completed: task.completed,
              batchId: this.data.currentBatchId
            })
          }
        })
        
        const completedCount = todos.filter((task: Task) => task.completed).length
        const totalCount = todos.length
        const completionRate = totalCount > 0 ? 
          ((completedCount / totalCount) * 100).toFixed(1) + '%' : '0%'

        this.setData({
          todos,
          completedCount,
          totalCount,
          completionRate
        })
        
        console.log('📊 任务加载完成统计:', {
          总任务数: totalCount,
          已完成: completedCount,
          完成率: completionRate
        })
      }
    } catch (error: any) {
      console.error('加载任务失败:', error)
      wx.showToast({
        title: '加载任务失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 加载所有批次的今日待办任务
   */
  async loadAllBatchesTodayTasks() {
    this.setData({ loading: true })

    try {
      // 获取活跃批次
      const batchResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })

      const activeBatches = batchResult.result?.data || []
      
      if (activeBatches.length === 0) {
        this.setData({
          todayTasksByBatch: [],
          activeBatchCount: 0,
          allTasksCount: 0,
          allCompletedCount: 0,
          allCompletionPercentage: 0
        })
        return
      }

      // 为每个活跃批次获取今日任务
      const batchTasksPromises = activeBatches.map(async (batch: any) => {
        try {
          const dayAge = this.calculateCurrentAge(batch.entryDate)
          
          const result = await CloudApi.getTodos(batch.id, dayAge)
          
          if (result.success && result.data) {
            // 🔍 详细日志 - 检查任务完成状态
            result.data.forEach((task: any) => {
              if (task.completed) {
                console.log('🟢 加载到已完成任务:', {
                  taskId: task._id,
                  title: task.title,
                  completed: task.completed,
                  batchId: batch.id
                })
              }
            })
            
            return {
              batchId: batch.id,
              batchNumber: batch.batchNumber || batch.id,
              dayAge: dayAge,
              tasks: result.data.map((task: any) => ({
                ...task,
                batchNumber: batch.batchNumber || batch.id,
                dayAge: dayAge
              }))
            }
          } else {
            return {
              batchId: batch.id,
              batchNumber: batch.batchNumber || batch.id,
              dayAge: dayAge,
              tasks: []
            }
          }
        } catch (error) {
          console.error(`获取批次 ${batch.id} 任务失败:`, error)
          return {
            batchId: batch.id,
            batchNumber: batch.batchNumber || batch.id,
            dayAge: this.calculateCurrentAge(batch.entryDate),
            tasks: []
          }
        }
      })

      const batchTasksResults = await Promise.all(batchTasksPromises)
      
      // 计算总体统计
      let allTasksCount = 0
      let allCompletedCount = 0
      
      batchTasksResults.forEach((batchData: any) => {
        allTasksCount += batchData.tasks.length
        allCompletedCount += batchData.tasks.filter((task: any) => task.completed).length
      })
      
      const allCompletionPercentage = allTasksCount > 0 ? 
        Math.round((allCompletedCount / allTasksCount) * 100) : 0

      this.setData({
        todayTasksByBatch: batchTasksResults,
        activeBatchCount: activeBatches.length,
        allTasksCount: allTasksCount,
        allCompletedCount: allCompletedCount,
        allCompletionPercentage: allCompletionPercentage
      })

    } catch (error: any) {
      console.error('加载所有批次任务失败:', error)
      wx.showToast({
        title: '加载任务失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 查看任务详情 - 与首页弹窗保持一致
   */
  viewTaskDetail(e: any) {
    const task = e.currentTarget.dataset.task as Task
    console.log('🔥 待办页面 viewTaskDetail 被调用，任务:', task)
    console.log('🏷️ 任务类型映射:', `${task.type} -> ${this.getTypeName(task.type || '')}`)
    
    // 🔍 日龄检查日志
    console.log('⏰ 时间检查:', {
      taskDayAge: task.dayAge,
      currentDayAge: this.data.currentDayAge,
      canComplete: task.dayAge ? task.dayAge <= this.data.currentDayAge : true
    })

    // 构建增强的任务数据，与首页保持一致
    const enhancedTask = {
      ...task,
      
      // 确保ID字段存在（支持多种ID字段名）
      id: task._id || task.taskId || task.id || '',
      
      title: task.title || task.content || '未命名任务',
      typeName: this.getTypeName(task.type || ''),
      priorityName: this.getPriorityName(task.priority || 'medium'),
      priorityTheme: this.getPriorityTheme(task.priority || 'medium'),
      statusText: task.completed ? '已完成' : '待完成',
      
      // 🔥 判断任务是否可以执行（时间是否到了）
      canComplete: task.dayAge ? task.dayAge <= this.data.currentDayAge : true,
      
      // 标记是否为疫苗任务，用于弹窗中的按钮显示
      isVaccineTask: this.isVaccineTask(task),
      
      // 确保其他字段存在
      description: task.description || '',
      notes: task.notes || '',
      estimatedTime: task.estimatedTime || task.estimatedDuration || '',
      duration: task.duration || '',
      dayInSeries: task.dayInSeries || '',
      dosage: task.dosage || '',
      materials: Array.isArray(task.materials) ? task.materials : [],
      batchNumber: task.batchNumber || task.batchId || '',
      dayAge: task.dayAge || '',
      
      // 确保completed状态正确
      completed: task.completed || false,
      completedDate: task.completedDate || ''
    }

    console.log('📋 显示任务详情弹窗:', enhancedTask.title)

    this.setData({
      selectedTask: enhancedTask as Task,
      showTaskDetailPopup: true
    })
  },

  /**
   * 判断是否为疫苗任务
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

  /**
   * 关闭任务详情（旧方法，保留兼容）
   */
  closeTaskDetail() {
    this.setData({
      showTaskDetail: false,
      selectedTask: null
    })
  },


  /**
   * 任务操作确认
   */
  onTaskConfirm() {
    const task = this.data.selectedTask
    if (!task) return

    if (task.isVaccineTask) {
      this.openVaccineForm(task)
    } else {
      this.completeNormalTask(task)
    }
  },

  /**
   * 完成普通任务
   */
  async completeNormalTask(task: Task) {
    try {
      const result = await CloudApi.completeTask(task._id, task.batchId)
      
      if (result.success) {
        this.closeTaskDetail()
        this.loadTodos() // 刷新任务列表
      }
    } catch (error: any) {
      console.error('完成任务失败:', error)
    }
  },

  /**
   * 打开疫苗表单 - 与首页保持一致
   */
  openVaccineForm(task: Task) {
    this.initVaccineFormData(task)
    this.setData({
      showVaccineFormPopup: true,
      showTaskDetail: false,
      showTaskDetailPopup: false
    })
  },

  /**
   * 通过任务ID打开疫苗表单
   */
  async openVaccineFormWithTaskId(taskId: string) {
    const task = this.data.todos.find(t => t._id === taskId)
    if (task) {
      this.openVaccineForm(task)
    } else {
      // 如果任务列表中没有，先加载任务列表
      await this.loadTodos()
      const foundTask = this.data.todos.find(t => t._id === taskId)
      if (foundTask) {
        this.openVaccineForm(foundTask)
      }
    }
  },

  /**
   * 初始化疫苗表单数据
   */
  initVaccineFormData(task: Task) {
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
    const vaccineCost = parseFloat(vaccineFormData.vaccineCost?.toString() || '0') || 0
    const veterinaryCost = parseFloat(vaccineFormData.veterinaryCost?.toString() || '0') || 0
    const otherCost = parseFloat(vaccineFormData.otherCost?.toString() || '0') || 0
    const totalCost = vaccineCost + veterinaryCost + otherCost
    
    const totalCostFormatted = `¥${totalCost.toFixed(2)}`
    
    console.log('计算总费用:', { vaccineCost, veterinaryCost, otherCost, totalCost, totalCostFormatted })
    
    this.setData({
      vaccineFormData: {
        ...this.data.vaccineFormData,
        totalCost: totalCost,
        totalCostFormatted: totalCostFormatted
      }
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
      { field: 'veterinarianName', message: '请填写兽医姓名' },
      { field: 'vaccineName', message: '请填写疫苗名称' },
      { field: 'vaccinationCount', message: '请填写接种数量' }
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

    // 联系方式验证（如果填写了）
    if (vaccineFormData.veterinarianContact && 
        !/^1[3-9]\d{9}$/.test(vaccineFormData.veterinarianContact)) {
      errors.veterinarianContact = '请填写正确的手机号码'
    }

    this.setData({ vaccineFormErrors: errors })

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0]
      wx.showToast({
        title: firstError,
        icon: 'error'
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

    try {
      // 构建疫苗记录数据
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
          route: vaccineRouteOptions[vaccineFormData.routeIndex],
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

      // 调用优化后的API
      const result = await CloudApi.completeVaccineTask({
        taskId: selectedTask._id,
        batchId: selectedTask.batchId,
        vaccineRecord
      })

      if (result.success) {
        this.closeVaccineFormPopup()
        this.loadTodos() // 刷新任务列表
        
        // 检查是否有异常反应需要处理
        if (result.data?.hasAdverseReactions) {
          this.handleVaccineAdverseReaction(result.data.preventionRecordId)
        }
      }

    } catch (error: any) {
      console.error('提交疫苗接种记录失败:', error)
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 处理疫苗异常反应
   */
  handleVaccineAdverseReaction(preventionRecordId: string) {
    wx.showModal({
      title: '注意',
      content: '疫苗接种完成，是否需要记录异常反应？',
      showCancel: true,
      confirmText: '记录',
      cancelText: '暂不记录',
      success: (res) => {
        if (res.confirm) {
          // 跳转到异常反应记录页面
          wx.navigateTo({
            url: `/pages/health-care/health-care?type=adverse_reaction&preventionRecordId=${preventionRecordId}`
          })
        }
      }
    })
  },

  /**
   * 获取任务状态图标
   */
  getTaskStatusIcon(task: Task): string {
    if (task.completed) return '✅'
    if (task.isVaccineTask) return '💉'
    
    switch (task.priority) {
      case 'high': return '🔴'
      case 'medium': return '🟡'
      default: return '⚪'
    }
  },

  /**
   * 获取任务状态文本
   */
  getTaskStatusText(task: Task): string {
    if (task.completed) return '已完成'
    if (task.isVaccineTask) return '疫苗接种'
    return '待完成'
  },

  /**
   * 🔧 数据迁移函数（临时）- 修复现有任务数据
   */
  async migrateTaskData() {
    try {
      wx.showLoading({ title: '正在修复数据...' })
      
      const result = await wx.cloud.callFunction({
        name: 'task-migration',
        data: { action: 'addCompletedField' }
      })
      
      if (result.result?.success) {
        wx.showToast({
          title: `✅ 修复完成！迁移${result.result.data?.migratedCount || 0}个任务`,
          icon: 'success',
          duration: 3000
        })
        
        // 重新加载数据
        this.onLoad(this.options)
      } else {
        throw new Error(result.result?.message || '迁移失败')
      }
    } catch (error: any) {
      console.error('❌ 数据迁移失败:', error)
      wx.showToast({
        title: '修复失败: ' + error.message,
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 分享任务信息
   */
  onShareAppMessage() {
    return {
      title: '养殖管理 - 今日待办',
      path: '/pages/breeding-todo/breeding-todo',
      imageUrl: '/assets/share-todo.png'
    }
  },

  /**
   * Tab切换事件 - 根据切换的tab加载相应数据
   */
  onTabChange(e: any) {
    const newTab = e.detail.value
    this.setData({
      activeTab: newTab
    })

    // 根据切换的tab加载相应的数据
    switch(newTab) {
      case 'today':
        // 今日任务已在页面加载时获取
        break
      case 'upcoming':
        this.loadUpcomingTasks()
        break
      case 'history':
        this.loadHistoryTasks()
        break
    }
  },

  /**
   * 加载即将到来的任务
   */
  async loadUpcomingTasks() {
    try {
      this.setData({ loading: true })
      
      if (this.data.showAllBatches) {
        await this.loadAllUpcomingTasks()
      } else {
        await this.loadSingleBatchUpcomingTasks()
      }
    } catch (error) {
      console.error('加载即将到来的任务失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 加载单批次即将到来的任务
   */
  async loadSingleBatchUpcomingTasks() {
    if (!this.data.currentBatchId) {
      this.setData({ upcomingTasks: [] })
      return
    }

    try {
      // 获取从当前日龄+1开始的未来任务
      const nextDayAge = this.data.currentDayAge + 1
      const result = await CloudApi.getWeeklyTodos(this.data.currentBatchId, nextDayAge)
      
      console.log(`加载即将到来任务 - 批次: ${this.data.currentBatchId}, 起始日龄: ${nextDayAge}`)
      
      if (result.success && result.data) {
        console.log('获取到即将到来任务数据:', result.data)
        
        // 将按日龄分组的数据转换为数组格式，过滤掉当前日龄及之前的任务
        const upcomingTasksArray = Object.keys(result.data)
          .map(dayAge => parseInt(dayAge))
          .filter(dayAge => dayAge > this.data.currentDayAge) // 只显示未来的任务
          .map(dayAge => ({
            dayAge: dayAge,
            tasks: result.data[dayAge.toString()].map((task: any) => ({
              ...task,
              isVaccineTask: this.isVaccineTask(task),
              batchNumber: this.data.currentBatchId
            }))
          }))
          .sort((a, b) => a.dayAge - b.dayAge)

        console.log('处理后的即将到来任务:', upcomingTasksArray)
        this.setData({ upcomingTasks: upcomingTasksArray })
      } else {
        console.log('获取即将到来任务失败或无数据:', result)
        this.setData({ upcomingTasks: [] })
      }
    } catch (error) {
      console.error('加载单批次即将到来任务失败:', error)
      this.setData({ upcomingTasks: [] })
    }
  },

  /**
   * 加载所有批次的即将到来任务
   */
  async loadAllUpcomingTasks() {
    try {
      // 获取活跃批次
      const batchResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })

      const activeBatches = batchResult.result?.data || []
      
      if (activeBatches.length === 0) {
        this.setData({ upcomingTasks: [] })
        return
      }

      // 为每个活跃批次加载未来一周的任务
      const upcomingTasksPromises = activeBatches.map(async (batch: any): Promise<any[]> => {
        try {
          const currentDayAge = this.calculateCurrentAge(batch.entryDate)
          const result = await CloudApi.getWeeklyTodos(batch.id, currentDayAge + 1)
          
          console.log(`批次 ${batch.batchNumber} 即将到来任务查询结果:`, result)
          
          if (result.success && result.data) {
            return Object.keys(result.data)
              .map(taskDayAge => parseInt(taskDayAge))
              .filter(dayAge => dayAge > currentDayAge) // 只显示未来的任务
              .map(dayAge => ({
                dayAge: dayAge,
                tasks: result.data[dayAge.toString()].map((task: any) => ({
                  ...task,
                  batchNumber: batch.batchNumber || batch.id,
                  isVaccineTask: this.isVaccineTask(task)
                }))
              }))
          }
          return []
        } catch (error) {
          console.error(`获取批次 ${batch.id} 即将到来任务失败:`, error)
          return []
        }
      })

      const upcomingTasksResults = await Promise.all(upcomingTasksPromises)
      
      // 合并所有批次的任务并按日龄分组
      const mergedTasks: {[key: number]: any[]} = {}
      
      upcomingTasksResults.forEach((batchTasks: any[]) => {
        batchTasks.forEach((dayGroup: any) => {
          const dayAge = dayGroup.dayAge
          if (!mergedTasks[dayAge]) {
            mergedTasks[dayAge] = []
          }
          mergedTasks[dayAge] = mergedTasks[dayAge].concat(dayGroup.tasks)
        })
      })

      // 转换为数组格式并排序
      const sortedUpcomingTasks = Object.keys(mergedTasks).map(dayAge => ({
        dayAge: parseInt(dayAge),
        tasks: mergedTasks[parseInt(dayAge)]
      })).sort((a, b) => a.dayAge - b.dayAge)

      this.setData({ upcomingTasks: sortedUpcomingTasks })

    } catch (error) {
      console.error('加载所有批次即将到来任务失败:', error)
      this.setData({ upcomingTasks: [] })
    }
  },

  /**
   * 🔥 修复：直接从数据库加载已完成的任务
   */
  async loadHistoryTasks() {
    try {
      this.setData({ loading: true })
      
      if (this.data.showAllBatches) {
        // 🔥 从所有批次加载已完成任务
        console.log('🔄 加载所有批次的已完成任务...')
        
        // 获取所有活跃批次
        const batchResult = await wx.cloud.callFunction({
          name: 'production-entry',
          data: { action: 'getActiveBatches' }
        })
        
        const activeBatches = batchResult.result?.data || []
        let allCompletedTasks: any[] = []
        
        for (const batch of activeBatches) {
          try {
            const dayAge = this.calculateCurrentAge(batch.entryDate)
            const result = await CloudApi.getTodos(batch.id, dayAge)
            
            if (result.success && result.data) {
              const completedTasks = result.data.filter((task: any) => task.completed === true)
              const formattedTasks = completedTasks.map((task: any) => ({
                id: task._id,
                title: task.title,
                completedDate: task.completedAt ? new Date(task.completedAt).toLocaleString() : '',
                completedBy: task.completedBy || '用户',
                batchNumber: batch.batchNumber || batch.id,
                dayAge: dayAge,
                completed: true
              }))
              allCompletedTasks = allCompletedTasks.concat(formattedTasks)
            }
          } catch (error) {
            console.warn(`批次 ${batch.id} 已完成任务加载失败:`, error)
          }
        }
        
        // 按完成时间排序
        allCompletedTasks.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())
        
        console.log(`✅ 加载到所有批次已完成任务: ${allCompletedTasks.length} 个`)
        this.setData({ historyTasks: allCompletedTasks })
        
      } else {
        // 🔥 从当前批次加载已完成任务
        console.log('🔄 加载当前批次的已完成任务...')
        
        if (!this.data.currentBatchId) {
          this.setData({ historyTasks: [] })
          return
        }
        
        const batch = this.data.batchList.find(b => b.id === this.data.currentBatchId)
        if (!batch) {
          this.setData({ historyTasks: [] })
          return
        }
        
        const dayAge = this.calculateCurrentAge(batch.entryDate)
        const result = await CloudApi.getTodos(this.data.currentBatchId, dayAge)
        
        if (result.success && result.data) {
          const completedTasks = result.data.filter((task: any) => task.completed === true)
          const formattedTasks = completedTasks.map((task: any) => ({
            id: task._id,
            title: task.title,
            completedDate: task.completedAt ? new Date(task.completedAt).toLocaleString() : '',
            completedBy: task.completedBy || '用户',
            batchNumber: batch.batchNumber || batch.id,
            dayAge: dayAge,
            completed: true
          }))
          
          console.log(`✅ 加载到当前批次已完成任务: ${formattedTasks.length} 个`)
          this.setData({ historyTasks: formattedTasks })
        } else {
          this.setData({ historyTasks: [] })
        }
      }

    } catch (error) {
      console.error('❌ 加载历史任务失败:', error)
      this.setData({ historyTasks: [] })
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
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
   * 获取任务类型名称 - 使用统一的TYPE_NAMES映射
   */
  getTypeName(type: string): string {
    return TYPE_NAMES[type as keyof typeof TYPE_NAMES] || '其他'
  },

  /**
   * 计算指定日龄对应的日期
   */
  calculateDate(dayAge: number): string {
    const today = new Date()
    const targetDate = new Date(today.getTime() + (dayAge - 1) * 24 * 60 * 60 * 1000)
    return targetDate.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    })
  },

  /**
   * 关闭任务详情弹窗 - 与首页保持一致
   */
  closeTaskDetailPopup() {
    this.setData({
      showTaskDetailPopup: false,
      selectedTask: null
    })
  },

  /**
   * 任务详情弹窗可见性变化 - 与首页保持一致
   */
  onTaskDetailPopupChange(event: any) {
    if (!event.detail.visible) {
      this.closeTaskDetailPopup()
    }
  },

  /**
   * 从弹窗完成任务 - 与首页保持一致
   */
  async completeTaskFromPopup() {
    const { selectedTask } = this.data
    
    console.log('🔍 completeTaskFromPopup开始，selectedTask详情:', {
      selectedTask: selectedTask,
      completed: selectedTask?.completed,
      id字段: selectedTask?.id,
      _id字段: selectedTask?._id,
      taskId字段: selectedTask?.taskId,
      title: selectedTask?.title
    })
    
    if (!selectedTask || selectedTask.completed) {
      this.closeTaskDetailPopup()
      return
    }

    // 检查任务ID是否存在
    const taskId = selectedTask._id || selectedTask.id || selectedTask.taskId
    console.log('🔍 提取的taskId:', taskId)
    
    if (!taskId) {
      console.error('待办页面任务ID缺失，任务数据:', selectedTask)
      wx.showToast({
        title: '任务ID缺失，无法完成',
        icon: 'error',
        duration: 2000
      })
      this.closeTaskDetailPopup()
      return
    }

    // 使用页面级 loading 遮罩，避免全局 wx.showLoading/hideLoading 配对告警
    this.setData({ loading: true })
    try {

      // 🔍 检查批次ID字段 - 详细日志
      const batchId = selectedTask.batchNumber || selectedTask.batchId || this.data.currentBatchId
      console.log('📋 准备调用云函数完成任务，详细参数分析:', {
        taskId: taskId,
        提取的batchId: batchId,
        selectedTask中的batchNumber: selectedTask.batchNumber,
        selectedTask中的batchId: selectedTask.batchId,
        页面当前batchId: this.data.currentBatchId,
        dayAge: selectedTask.dayAge,
        完整selectedTask: selectedTask
      })
      
      console.log('🔍 完成前任务状态检查:', {
        taskCompleted: selectedTask.completed,
        taskTitle: selectedTask.title
      })
      
      if (!batchId) {
        console.error('❌ batchId缺失，selectedTask:', selectedTask)
        // 不在这里调用 hideLoading，交由 finally 统一处理
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

      console.log('☁️ 云函数返回结果:', result)
      console.log('🔍 云函数返回详细信息:', {
        success: result.result?.success,
        already_completed: result.result?.already_completed,
        error: result.result?.error,
        message: result.result?.message,
        完整result: result.result
      })

      if (result.result && result.result.success) {
        
        // 检查是否为重复完成
        if (result.result.already_completed) {
          console.log('ℹ️ 任务已经完成过了，立即更新UI')
          
          // 立即更新当前页面的任务状态以显示划线效果
          this.updateTaskCompletionStatusInUI(taskId, true)
          
          // 关闭弹窗
          this.closeTaskDetailPopup()
          
          // 显示友好提示
          wx.showToast({
            title: '该任务已完成',
            icon: 'success',
            duration: 2000
          })
          
          // 重新加载数据确保状态同步
          setTimeout(() => {
            if (this.data.showAllBatches) {
              this.loadAllBatchesTodayTasks()
            } else {
              this.loadTodos()
            }
          }, 500)
          
          // 不在这里调用hideLoading，交给finally处理
          return
        }
        
        // 🔥 全新简化版本：任务完成处理
        console.log('🎯 新版待办页任务完成处理')
        
        // 🔥 重要：立即更新selectedTask状态，确保弹窗不再显示"完成任务"按钮
        this.setData({
          selectedTask: {
            ...selectedTask,
            completed: true,
            statusText: '已完成'
          } as any
        })
        
        // 立即更新当前页面的任务状态以显示划线效果
        this.updateTaskCompletionStatusInUI(taskId, true)

        // 显示成功提示
        wx.showToast({
          title: '任务完成成功！',
          icon: 'success',
          duration: 2000
        })

        // 延迟关闭弹窗，让用户看到状态变化
        setTimeout(() => {
          this.closeTaskDetailPopup()
        }, 1500)

        // 重新加载数据以确保UI同步（数据库中的状态已经更新）
        setTimeout(() => {
          console.log('🔄 待办页重新加载数据...')
          if (this.data.showAllBatches) {
            this.loadAllBatchesTodayTasks()
          } else {
            this.loadTodos()
          }
        }, 2000)

      } else {
        console.error('❌ 云函数返回失败:', result.result)
        throw new Error(result.result?.error || result.result?.message || '完成任务失败')
      }

    } catch (error: any) {
      console.error('完成任务失败:', error)
      wx.showToast({
        title: error.message === '任务已经完成' ? '该任务已完成' : '完成失败，请重试',
        icon: error.message === '任务已经完成' ? 'success' : 'error',
        duration: 2000
      })
    } finally {
      // 关闭页面级 loading 遮罩
      this.setData({ loading: false })
    }
  },

  /**
   * 🔥 超级简化版本：强制更新UI中的任务完成状态
   */
  updateTaskCompletionStatusInUI(taskId: string, completed: boolean) {
    console.log('🔥 强制更新UI任务状态:', { taskId, completed })
    
    let taskFound = false
    
    // 🔥 强化ID匹配逻辑 - 尝试所有可能的ID字段
    const matchTask = (task: any) => {
      const possibleIds = [task._id, task.id, task.taskId].filter(Boolean)
      const targetIds = [taskId].filter(Boolean)
      
      for (const currentId of possibleIds) {
        for (const targetId of targetIds) {
          if (currentId === targetId) {
            return true
          }
        }
      }
      return false
    }
    
    // 🔥 修复：优先从 todayTasksByBatch 中更新，因为 todos 可能为空
    let updatedTodos = [...this.data.todos] // 保持原有todos数组
    
    // 🔥 重点：更新批次任务分组（这里才是真正的数据源）
    const updatedTodayTasksByBatch = this.data.todayTasksByBatch.map(batchGroup => ({
      ...batchGroup,
      tasks: batchGroup.tasks.map((task: any) => {
        if (matchTask(task)) {
          taskFound = true // 🔥 重要：在这里设置 taskFound
          console.log('✅ 批次任务列表中找到并更新任务:', task.title, '设置completed为:', completed)
          console.log('🔍 批次任务匹配ID信息:', {
            传入taskId: taskId,
            任务_id: task._id,
            任务id: task.id,
            任务taskId: task.taskId
          })
          return {
            ...task,
            completed: completed,
            completedAt: completed ? new Date().toISOString() : null,
            completedBy: completed ? 'user' : null
          }
        }
        return task
      })
    }))
    
    // 强制数据更新
    this.setData({
      todos: updatedTodos,
      todayTasksByBatch: updatedTodayTasksByBatch
    }, () => {
      console.log('✅ setData 回调执行，数据已更新')
      console.log('🔍 更新后的数据:', {
        todosCount: updatedTodos.length,
        completedTodos: updatedTodos.filter(t => t.completed).length,
        batchesCount: updatedTodayTasksByBatch.length
      })
      
      // 强制页面重新渲染
      wx.nextTick(() => {
        console.log('🔄 强制页面重新渲染完成')
      })
    })
    
    if (!taskFound) {
      console.error('❌ 未找到要更新的任务:', taskId)
      console.error('🔍 在todayTasksByBatch中查找失败，检查所有任务:')
      
      this.data.todayTasksByBatch.forEach((batch, batchIndex) => {
        console.log(`  批次[${batchIndex}] ${batch.batchNumber}:`)
        batch.tasks.forEach((t, taskIndex) => {
          const isMatch = matchTask(t)
          console.log(`    任务[${taskIndex}] ${isMatch ? '🎯 匹配!' : '❌ 不匹配'}:`, {
            _id: t._id,
            id: t.id,
            taskId: t.taskId,
            title: t.title,
            completed: t.completed,
            匹配目标: taskId
          })
        })
      })
    } else {
      console.log('✅ 在批次任务列表中成功找到并更新任务，completed状态:', completed)
    }
  },

  /**
   * 🔍 验证任务完成状态是否正确保存到数据库
   */
  async verifyTaskCompletionInDatabase(taskId: string, batchId: string) {
    try {
      console.log('🔍 待办页验证数据库中的任务完成状态:', { taskId, batchId })
      
      // 直接调用云函数获取最新的任务状态
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'getTodos',
          batchId: batchId,
          dayAge: this.data.selectedTask?.dayAge || 1
        }
      })
      
      if (result.result && result.result.success) {
        const tasks = result.result.data || []
        const targetTask = tasks.find((task: any) => 
          task._id === taskId || task.taskId === taskId || task.id === taskId
        )
        
        if (targetTask) {
          console.log('🔍 待办页数据库验证结果:', {
            taskId: taskId,
            title: targetTask.title,
            completed: targetTask.completed,
            云函数返回状态: targetTask.completed ? '✅ 已完成' : '❌ 未完成'
          })
          
          if (targetTask.completed) {
            console.log('✅ 待办页数据库状态正确：任务已标记为完成')
          } else {
            console.error('❌ 待办页数据库状态错误：任务未标记为完成')
            
            // 尝试修复数据同步问题
            wx.showModal({
              title: '数据同步问题',
              content: '任务完成状态未正确保存到数据库，可能是权限或网络问题',
              showCancel: false,
              success: () => {
                // 强制重新加载数据
                if (this.data.showAllBatches) {
                  this.loadAllBatchesTodayTasks()
                } else {
                  this.loadTodos()
                }
              }
            })
          }
        } else {
          console.error('❌ 待办页未在云函数返回的任务列表中找到目标任务')
        }
      } else {
        console.error('❌ 待办页云函数调用失败:', result.result)
      }
    } catch (error) {
      console.error('❌ 待办页验证数据库状态失败:', error)
    }
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
    
    // 直接打开疫苗表单
    this.openVaccineForm(selectedTask)
  },


  /**
   * 查看疫苗记录 - 与首页保持一致
   */
  viewVaccineRecord() {
    const { selectedTask } = this.data
    if (!selectedTask) return

    const taskId = selectedTask.id || selectedTask.taskId || selectedTask._id

    wx.navigateTo({
      url: `/pages/health-care/health-care?type=vaccine_record&taskId=${taskId}`
    })
    
    this.closeTaskDetailPopup()
  }
})
