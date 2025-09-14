// breeding-todo/breeding-todo.ts - 待办任务页面（优化版）
import CloudApi from '../../utils/cloud-api'

interface Task {
  _id: string
  title: string
  description: string
  type: string
  dayAge: number
  batchId: string
  completed: boolean
  isVaccineTask: boolean
  priority: string
  estimatedDuration: number
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
   * 查看任务详情
   */
  viewTaskDetail(e: any) {
    const task = e.currentTarget.dataset.task as Task
    console.log('查看任务详情:', task)

    this.setData({
      selectedTask: task,
      showTaskDetail: true
    })
  },

  /**
   * 关闭任务详情
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
   * 打开疫苗表单
   */
  openVaccineForm(task: Task) {
    this.initVaccineFormData(task)
    this.setData({
      showVaccineFormPopup: true,
      showTaskDetail: false
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
   * Tab切换事件
   */
  onTabChange(e: any) {
    this.setData({
      activeTab: e.detail.value
    })
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
      vaccine: '疫苗接种',
      vaccination: '疫苗接种',
      treatment: '治疗护理'
    }
    return typeMap[type] || '其他'
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
   * 从弹窗完成任务
   */
  async completeTaskFromPopup() {
    const { selectedTask } = this.data
    if (!selectedTask || selectedTask.completed) {
      this.closeTaskDetailPopup()
      return
    }

    try {
      const result = await CloudApi.completeTask(selectedTask._id, selectedTask.batchId)
      
      if (result.success) {
        this.closeTaskDetailPopup()
        
        // 根据当前模式重新加载数据
        if (this.data.showAllBatches) {
          this.loadAllBatchesTodayTasks()
        } else {
          this.loadTodos()
        }
      }
    } catch (error: any) {
      console.error('完成任务失败:', error)
      wx.showToast({
        title: '完成失败，请重试',
        icon: 'error'
      })
    }
  },


  /**
   * 查看疫苗记录
   */
  viewVaccineRecord() {
    const { selectedTask } = this.data
    if (!selectedTask) return

    wx.navigateTo({
      url: `/pages/health-care/health-care?type=vaccine_record&taskId=${selectedTask._id}`
    })
    
    this.closeTaskDetailPopup()
  }
})
