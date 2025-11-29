// breeding-todo/breeding-todo.ts - 待办任务页面（优化版）
// @ts-nocheck - TODO: 需要分阶段重构，类型错误60+
import { logger } from '../../utils/logger'
import CloudApi from '../../utils/cloud-api'
import { formatTime } from '../../utils/util'
import { TYPE_NAMES, isMedicationTask, isNutritionTask } from '../../utils/breeding-schedule'
import { PaginationHelper, DataCache } from './breeding-todo-pagination'

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
  isMedicationTask: boolean
  isNutritionTask: boolean
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

// 页面参数类型
interface PageOptions {
  showAllBatches?: string
  batchId?: string
  dayAge?: string
  openVaccineForm?: string
  openMedicationForm?: string
  taskId?: string
}

// 批次类型
interface BatchInfo {
  _id: string
  batchNumber: string
  entryDate?: string
  dayAge?: number
  tasks?: Task[]
  completed?: boolean
}

// 物料类型
interface MaterialItem {
  _id: string
  name: string
  unit: string
  currentStock: number
  category?: string
  description?: string
}

Page({
  // ✅ 定时器管理
  _timerIds: [] as number[],
  
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  _clearAllTimers() {
    this._timerIds.forEach((id: number) => clearTimeout(id))
    this._timerIds = []
  },

  data: {
    // 任务数据
    todos: [] as Task[],
    selectedTask: null as Task | null,
    showTaskDetail: false,
    showTaskDetailPopup: false,
    
    // 任务详情字段多行状态
    taskFieldMultiline: {
      title: false,
      type: false,
      time: false,
      duration: false,
      materials: false,
      batch: false,
      age: false,
      description: false,
      dosage: false,
      notes: false
    } as Record<string, boolean>,
    
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
    upcomingTasks: [] as unknown[],
    historyTasks: [] as unknown[],
    taskOverlaps: [] as unknown[],
    
    // 分页配置
    upcomingPagination: PaginationHelper.createConfig(20),
    historyPagination: PaginationHelper.createConfig(20),
    displayedUpcomingTasks: [] as unknown[],
    displayedHistoryTasks: [] as unknown[],
    
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
    vaccineFormErrorList: [] as string[], // 用于模板遍历的错误列表
    vaccineRouteOptions: ['肌肉注射', '皮下注射', '滴鼻/滴眼', '饮水免疫', '喷雾免疫'],
    
    // 用药管理表单数据
    showMedicationFormPopup: false,
    availableMedicines: [] as unknown[], // 可用的药品库存
    selectedMedicine: null as unknown,
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
    medicationFormErrorList: [] as string[], // 用于模板遍历的错误列表

    // 营养管理表单数据
    showNutritionFormPopup: false,
    availableNutrition: [] as unknown[], // 可用的营养品库存
    selectedNutrition: null as unknown,
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
    nutritionFormErrorList: [] as string[], // 用于模板遍历的错误列表
    
    // 页面状态
    loading: false,
    refreshing: false,
    currentBatchId: '',
    currentDayAge: 0,
    
    // 批次相关
    showBatchDialog: false,
    batchList: [] as unknown[],
    selectedBatch: {} as unknown,
    
    // 统计信息
    completedCount: 0,
    totalCount: 0,
    completionRate: '0%'
  },

  /**
   * 页面加载
   */
  onLoad(options: PageOptions) {
    const showAllBatches = options.showAllBatches === 'true'
    
    this.setData({
      showAllBatches: showAllBatches,
      currentBatchId: options.batchId || this.getCurrentBatchId(),
      currentDayAge: parseInt(options.dayAge || '0') || 0
    })

    // 根据参数决定加载方式
    if (showAllBatches) {
      // 加载所有批次的今日待办
      this.loadAllBatchesTodayTasks()
    } else if (!this.data.currentBatchId) {
      // 如果没有批次ID，尝试获取默认批次，然后加载任务
      this.getDefaultBatch().then(() => {
        if (this.data.currentBatchId) {
          this.loadTodos()
        }
      })
    } else {
      // 检查是否需要直接打开疫苗表单
      if (options.openVaccineForm === 'true' && options.taskId) {
        this.openVaccineFormWithTaskId(options.taskId)
      } 
      // 检查是否需要直接打开用药管理表单
      else if (options.openMedicationForm === 'true' && options.taskId) {
        this.openMedicationFormWithTaskId(options.taskId)
      } 
      else {
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

  onUnload() {
    this._clearAllTimers()
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
        currentBatchId: defaultBatch._id,
        currentDayAge: dayAge
      })

      // 保存到缓存
      wx.setStorageSync('currentBatchId', defaultBatch._id)
      
      // 不在这里调用loadTodos，由调用者决定是否加载
    } catch (error) {
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
    // 如果没有批次ID，先获取默认批次
    if (!this.data.currentBatchId || this.data.currentBatchId.trim() === '') {
      await this.getDefaultBatch()
      
      // 如果还是没有批次ID，说明没有存栏批次
      if (!this.data.currentBatchId) {
        wx.showToast({
          title: '暂无存栏批次',
          icon: 'none'
        })
        return
      }
    }

    this.setData({ loading: true })

    try {
      const result = await CloudApi.getTodos(this.data.currentBatchId, this.data.currentDayAge)
      
      if (result.success && result.data) {
        const todos = Array.isArray(result.data) ? result.data : []
        
        // 检查任务完成状态
        todos.forEach((task: Task) => {
          if (task.completed) {
            // 加载到已完成任务
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
        
        // 任务加载完成统计
      }
    } catch (error: unknown) {
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
      const batchTasksPromises = activeBatches.map(async (batch: BatchInfo) => {
        try {
          const dayAge = this.calculateCurrentAge(batch.entryDate || '')
          
          const result = await CloudApi.getTodos(batch._id, dayAge)
          
          if (result.success && result.data) {
            // 检查任务完成状态
            result.data.forEach((task: Task) => {
              if (task.completed) {
                // 加载到已完成任务
              }
            })
            
            return {
              batchId: batch._id,
              batchNumber: batch.batchNumber || batch._id,
              dayAge: dayAge,
              tasks: result.data.map((task: Task) => ({
                ...task,
                batchNumber: batch.batchNumber || batch._id,
                dayAge: dayAge
              }))
            }
          } else {
            return {
              batchId: batch._id,
              batchNumber: batch.batchNumber || batch._id,
              dayAge: dayAge,
              tasks: []
            }
          }
        } catch (error) {
          return {
            batchId: batch._id,
            batchNumber: batch.batchNumber || batch._id,
            dayAge: this.calculateCurrentAge(batch.entryDate || ''),
            tasks: []
          }
        }
      })

      const batchTasksResults = await Promise.all(batchTasksPromises)
      
      // 计算总体统计
      let allTasksCount = 0
      let allCompletedCount = 0
      
      batchTasksResults.forEach((batchData) => {
        allTasksCount += batchData.tasks.length
        allCompletedCount += batchData.tasks.filter((task: Task) => task.completed).length
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

    } catch (error: unknown) {
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
  viewTaskDetail(e: CustomEvent) {
    const task = e.currentTarget.dataset.task as Task
    
    // 构建增强的任务数据，与首页保持一致
    const enhancedTask = {
      ...task,
      
      // 确保ID字段存在（支持多种ID字段名）
      id: task._id || task.taskId || task.id || '',
      
      title: task.title || task.content || '未命名任务',
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

    this.setData({
      selectedTask: enhancedTask as Task,
      showTaskDetailPopup: true
    })
  },

  /**
   * 判断是否为疫苗任务
   */
  isVaccineTask(task: unknown): boolean {
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
  isMedicationTask(task: unknown): boolean {
    return isMedicationTask(task)
  },

  /**
   * 判断是否为营养管理任务
   */
  isNutritionTask(task: unknown): boolean {
    return isNutritionTask(task)
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
    } else if (task.isMedicationTask) {
      this.openMedicationForm(task)
    } else if (task.isNutritionTask) {
      this.openNutritionForm(task)
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
    } catch (error: unknown) {
      // 完成任务失败处理
    }
  },

  /**
   * 打开疫苗表单 - 与首页保持一致
   */
  async openVaccineForm(task: Task) {
    await this.initVaccineFormData(task)
    this.setData({
      showVaccineFormPopup: true,
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
   * 通过任务ID打开用药管理表单
   */
  async openMedicationFormWithTaskId(taskId: string) {
    // 先尝试加载所有批次的今日任务，确保能找到任务
    if (!this.data.showAllBatches) {
      this.setData({ showAllBatches: true })
      await this.loadAllBatchesTodayTasks()
    } else {
      await this.loadTodos()
    }
    
    // 在所有批次任务中查找指定任务
    let foundTask = null
    
    // 先在todos中查找
    foundTask = this.data.todos.find(t => t._id === taskId || t.id === taskId || t.taskId === taskId)
    
    // 如果todos中没找到，在todayTasksByBatch中查找
    if (!foundTask && this.data.todayTasksByBatch.length > 0) {
      for (const batch of this.data.todayTasksByBatch) {
        foundTask = batch.tasks.find((t: unknown) => t._id === taskId || t.id === taskId || t.taskId === taskId)
        if (foundTask) {
          break
        }
      }
    }
    
    if (foundTask) {
      // 确保任务标记正确
      foundTask.isMedicationTask = this.isMedicationTask(foundTask)
      this.openMedicationForm(foundTask)
    } else {
      wx.showToast({
        title: '任务不存在或已完成',
        icon: 'error'
      })
    }
  },

  /**
   * 初始化疫苗表单数据
   */
  async initVaccineFormData(task: Task) {
    // 获取当前批次的存栏数量
    let currentBatchStockQuantity = 0
    const batchId = this.data.currentBatchId
    if (batchId) {
      try {
        const batchResult = await wx.cloud.callFunction({
          name: 'production-entry',
          data: { action: 'getActiveBatches' }
        })
        
        if (batchResult.result?.success) {
          const activeBatches = batchResult.result.data || []
          const currentBatch = activeBatches.find((b: unknown) => b._id === batchId)
          if (currentBatch) {
            currentBatchStockQuantity = currentBatch.currentStock || 
                                       currentBatch.currentQuantity || 
                                       currentBatch.currentCount || 
                                       0
          }
        }
      } catch (error) {
        logger.error('获取批次存栏数失败:', error)
      }
    }

    const vaccineFormData: VaccineFormData = {
      veterinarianName: '',
      veterinarianContact: '',
      vaccineName: task.title || '', // 使用任务标题作为疫苗名称初始值
      manufacturer: '',
      batchNumber: '',
      dosage: '0.5ml/只',
      routeIndex: 0,
      vaccinationCount: currentBatchStockQuantity,  // 默认填充存栏数量
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
  onVaccineFormInput(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`vaccineFormData.${field}`]: value
    })

    // 清除对应字段的错误
    if (this.data.vaccineFormErrors[field]) {
      const newErrors = { ...this.data.vaccineFormErrors }
      delete newErrors[field]
      this.setData({
        vaccineFormErrors: newErrors,
        vaccineFormErrorList: Object.values(newErrors)
      })
    }
  },

  /**
   * 数值输入处理（费用相关）
   */
  onVaccineNumberInput(e: CustomEvent) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`vaccineFormData.${field}`]: value
    }, () => {
      // 如果是费用相关字段，重新计算总费用
      if (['vaccineCost', 'veterinaryCost', 'otherCost'].includes(field)) {
        this._safeSetTimeout(() => {
          this.calculateTotalCost()
        }, 100)
      }
    })
  },

  /**
   * 路径选择处理
   */
  onVaccineRouteChange(e: CustomEvent) {
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

    // 更新错误对象和错误列表
    const errorList = Object.values(errors)
    this.setData({ 
      vaccineFormErrors: errors,
      vaccineFormErrorList: errorList
    })

    if (errorList.length > 0) {
      wx.showToast({
        title: errorList[0],
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

    // 获取批次ID（多种字段名兼容）
    const batchId = selectedTask.batchId || selectedTask.batchNumber || this.data.currentBatchId
    
    if (!batchId) {
      wx.showToast({
        title: '批次信息缺失',
        icon: 'error'
      })
      return
    }

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

    // 调用优化后的API（已内置 loading 和 error 处理）
    const result = await CloudApi.completeVaccineTask({
      taskId: selectedTask._id,
      batchId: batchId,
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
    // CloudApi 已经处理了错误提示，不需要额外的 catch
  },

  /**
   * 处理疫苗异常反应
   * 注：health-care页面已废弃，异常反应通过AI诊断或治疗记录处理
   */
  handleVaccineAdverseReaction(_preventionRecordId: string) {
    wx.showModal({
      title: '注意',
      content: '疫苗接种完成。如有异常反应，请通过AI诊断或治疗记录进行处理。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /**
   * 获取任务状态图标
   */
  getTaskStatusIcon(task: Task): string {
    if (task.completed) return '✅'
    if (task.isVaccineTask) return '💉'
    return '⚪'
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
    } catch (error: unknown) {
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
      path: '/packageHealth/breeding-todo/breeding-todo',
      imageUrl: '/assets/share-todo.png'
    }
  },

  /**
   * Tab切换事件 - 根据切换的tab加载相应数据
   */
  onTabChange(e: CustomEvent) {
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
      
      if (result.success && result.data) {
        
        // 将按日龄分组的数据转换为数组格式，过滤掉当前日龄及之前的任务
        const upcomingTasksArray = Object.keys(result.data)
          .map(dayAge => parseInt(dayAge))
          .filter(dayAge => dayAge > this.data.currentDayAge) // 只显示未来的任务
          .map(dayAge => ({
            dayAge: dayAge,
            tasks: result.data[dayAge.toString()].map((task: unknown) => ({
              ...task,
              isVaccineTask: this.isVaccineTask(task),
              batchNumber: this.data.currentBatchId
            }))
          }))
          .sort((a, b) => a.dayAge - b.dayAge)

        this.setData({ upcomingTasks: upcomingTasksArray })
      } else {
        this.setData({ upcomingTasks: [] })
      }
    } catch (error) {
      this.setData({ upcomingTasks: [] })
    }
  },

  /**
   * 加载所有批次的即将到来任务（优化版，支持分页）
   */
  async loadAllUpcomingTasks() {
    try {
      // 检查缓存
      const cacheKey = `upcoming_tasks_${this.data.showAllBatches}`
      const cachedData = DataCache.get(cacheKey)
      
      if (cachedData) {
        this.setData({ 
          upcomingTasks: cachedData,
          displayedUpcomingTasks: PaginationHelper.paginate(cachedData, this.data.upcomingPagination)
        })
        return
      }
      
      // 获取活跃批次
      const batchResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })

      const activeBatches = batchResult.result?.data || []
      
      if (activeBatches.length === 0) {
        this.setData({ 
          upcomingTasks: [],
          displayedUpcomingTasks: [] 
        })
        return
      }

      // 分批加载，避免一次性加载过多
      const loadBatchTasks = async (batch: unknown): Promise<any[]> => {
        try {
          const currentDayAge = this.calculateCurrentAge(batch.entryDate)
          const result = await CloudApi.getWeeklyTodos(batch._id, currentDayAge + 1)
          
          if (result.success && result.data) {
            return Object.keys(result.data)
              .map(taskDayAge => parseInt(taskDayAge))
              .filter(dayAge => dayAge > currentDayAge)
              .map(dayAge => ({
                dayAge: dayAge,
                tasks: result.data[dayAge.toString()].map((task: unknown) => ({
                  ...task,
                  batchNumber: batch.batchNumber || batch._id,
                  isVaccineTask: this.isVaccineTask(task)
                }))
              }))
          }
          return []
        } catch (error) {
          return []
        }
      }
      
      // 使用分批加载
      const upcomingTasksResults = await PaginationHelper.batchLoad(
        loadBatchTasks,
        activeBatches,
        5 // 每批处理5个批次
      )
      
      // 合并所有批次的任务并按日龄分组
      const mergedTasks: {[key: number]: unknown[]} = {}
      
      upcomingTasksResults.forEach((batchTasks: unknown[]) => {
        batchTasks.forEach((dayGroup: unknown) => {
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

      // 缓存数据
      DataCache.set(cacheKey, sortedUpcomingTasks, 5)
      
      // 更新分页配置
      const updatedPagination = PaginationHelper.updateConfig(
        this.data.upcomingPagination,
        sortedUpcomingTasks.length
      )
      
      // 设置数据和分页显示
      this.setData({ 
        upcomingTasks: sortedUpcomingTasks,
        upcomingPagination: updatedPagination,
        displayedUpcomingTasks: PaginationHelper.paginate(sortedUpcomingTasks, updatedPagination)
      })

    } catch (error) {
      this.setData({ 
        upcomingTasks: [],
        displayedUpcomingTasks: [] 
      })
    }
  },
  
  /**
   * 加载更多即将到来的任务
   */
  loadMoreUpcomingTasks() {
    if (!this.data.upcomingPagination.hasMore) return
    
    const nextPagination = PaginationHelper.nextPage(this.data.upcomingPagination)
    const moreData = PaginationHelper.paginate(this.data.upcomingTasks, nextPagination)
    
    this.setData({
      upcomingPagination: nextPagination,
      displayedUpcomingTasks: [...this.data.displayedUpcomingTasks, ...moreData]
    })
  },

  /**
   * 🔥 修复：直接从数据库加载已完成的任务
   */
  async loadHistoryTasks() {
    try {
      this.setData({ loading: true })
      
      if (this.data.showAllBatches) {
        // 从所有批次加载已完成任务
        
        // 获取所有活跃批次
        const batchResult = await wx.cloud.callFunction({
          name: 'production-entry',
          data: { action: 'getActiveBatches' }
        })
        
        const activeBatches = batchResult.result?.data || []
        let allCompletedTasks: unknown[] = []
        
        for (const batch of activeBatches) {
          try {
            const dayAge = this.calculateCurrentAge(batch.entryDate)
            const result = await CloudApi.getTodos(batch._id, dayAge)
            
            if (result.success && result.data) {
              const completedTasks = result.data.filter((task: unknown) => task.completed === true)
              const formattedTasks = completedTasks.map((task: unknown) => ({
                id: task._id,
                title: task.title,
                completedDate: task.completedAt ? formatTime(new Date(task.completedAt)) : '',
                completedBy: task.completedBy || '用户',
                batchNumber: batch.batchNumber || batch._id,
                dayAge: dayAge,
                completed: true
              }))
              allCompletedTasks = allCompletedTasks.concat(formattedTasks)
            }
          } catch (error) {
            // 批次已完成任务加载失败
          }
        }
        
        // 按完成时间排序
        allCompletedTasks.sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())
        
        this.setData({ historyTasks: allCompletedTasks })
        
      } else {
        // 从当前批次加载已完成任务
        
        if (!this.data.currentBatchId) {
          this.setData({ historyTasks: [] })
          return
        }
        
        const batch = this.data.batchList.find(b => b._id === this.data.currentBatchId)
        if (!batch) {
          this.setData({ historyTasks: [] })
          return
        }
        
        const dayAge = this.calculateCurrentAge(batch.entryDate)
        const result = await CloudApi.getTodos(this.data.currentBatchId, dayAge)
        
        if (result.success && result.data) {
          const completedTasks = result.data.filter((task: unknown) => task.completed === true)
          const formattedTasks = completedTasks.map((task: unknown) => ({
            id: task._id,
            title: task.title,
            completedDate: task.completedAt ? formatTime(new Date(task.completedAt)) : '',
            completedBy: task.completedBy || '用户',
            batchNumber: batch.batchNumber || batch._id,
            dayAge: dayAge,
            completed: true
          }))
          
          this.setData({ historyTasks: formattedTasks })
        } else {
          this.setData({ historyTasks: [] })
        }
      }

    } catch (error) {
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
  onTaskDetailPopupChange(event: unknown) {
    if (!event.detail.visible) {
      this.closeTaskDetailPopup()
    } else {
      // 弹窗显示时，检测文本换行并应用对齐样式
      this._safeSetTimeout(() => {
        this.checkTextAlignment()
      }, 100)
    }
  },

  /**
   * 检测文本是否换行，自动应用对齐样式
   */
  checkTextAlignment() {
    const query = wx.createSelectorQuery().in(this)
    const fieldMap = {
      'info-value-title': 'title',
      'info-value-type': 'type',
      'info-value-time': 'time',
      'info-value-duration': 'duration',
      'info-value-materials': 'materials',
      'info-value-batch': 'batch',
      'info-value-age': 'age',
      'info-value-description': 'description',
      'info-value-dosage': 'dosage',
      'info-value-notes': 'notes'
    }

    const ids = Object.keys(fieldMap)
    
    ids.forEach(id => {
      query.select(`#${id}`).boundingClientRect()
    })

    query.exec((res) => {
      if (!res) return

      const updates: Record<string, boolean> = {}
      
      res.forEach((rect: unknown, index: number) => {
        if (!rect) return

        const id = ids[index]
        const field = fieldMap[id as keyof typeof fieldMap]
        
        // 通过对比高度判断是否换行
        // 单行高度约为 42rpx (28rpx * 1.5行高)，换行后高度会明显增大
        const singleLineHeight = 42 // rpx
        const isMultiline = rect.height > singleLineHeight

        updates[`taskFieldMultiline.${field}`] = isMultiline
      })

      // 批量更新状态
      this.setData(updates)
    })
  },

  /**
   * 从弹窗完成任务 - 与首页保持一致
   */
  async completeTaskFromPopup() {
    const { selectedTask } = this.data
    
    // 完成任务开始
    
    if (!selectedTask || selectedTask.completed) {
      this.closeTaskDetailPopup()
      return
    }

    // 检查任务ID是否存在
    const taskId = selectedTask._id || selectedTask.id || selectedTask.taskId
    
    if (!taskId) {
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

      // 检查批次ID字段
      const batchId = selectedTask.batchNumber || selectedTask.batchId || this.data.currentBatchId
      
      if (!batchId) {
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
          action: 'complete_task',
          taskId: taskId,
          batchId: batchId,
          dayAge: selectedTask.dayAge,
          completedAt: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      })

      // 云函数返回结果处理

      if (result.result && result.result.success) {
        
        // 检查是否为重复完成
        if (result.result.already_completed) {
          
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
          this._safeSetTimeout(() => {
            if (this.data.showAllBatches) {
              this.loadAllBatchesTodayTasks()
            } else {
              this.loadTodos()
            }
          }, 500)
          
          // 不在这里调用hideLoading，交给finally处理
          return
        }
        
        // 任务完成处理
        
        // 🔥 重要：立即更新selectedTask状态，确保弹窗不再显示"完成任务"按钮
        this.setData({
          selectedTask: {
            ...selectedTask,
            completed: true,
            statusText: '已完成'
          } as unknown
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
        this._safeSetTimeout(() => {
          this.closeTaskDetailPopup()
        }, 1500)

        // 重新加载数据以确保UI同步（数据库中的状态已经更新）
        this._safeSetTimeout(() => {
          if (this.data.showAllBatches) {
            this.loadAllBatchesTodayTasks()
          } else {
            this.loadTodos()
          }
        }, 2000)

      } else {
        throw new Error(result.result?.error || result.result?.message || '完成任务失败')
      }

    } catch (error: unknown) {
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
    let taskFound = false
    
    // 🔥 强化ID匹配逻辑 - 尝试所有可能的ID字段
    const matchTask = (task: unknown) => {
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
      tasks: batchGroup.tasks.map((task: unknown) => {
        if (matchTask(task)) {
          taskFound = true
          // 批次任务列表中找到并更新任务
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
      // setData 回调执行，数据已更新
      
      // 强制页面重新渲染
      wx.nextTick(() => {
        // 强制页面重新渲染完成
      })
    })
    
    if (!taskFound) {
      // 未找到要更新的任务
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
          action: 'get_todos',
          batchId: batchId,
          dayAge: this.data.selectedTask?.dayAge || 1
        }
      })
      
      if (result.result && result.result.success) {
        const tasks = result.result.data || []
        const targetTask = tasks.find((task: unknown) => 
          task._id === taskId || task.taskId === taskId || task.id === taskId
        )
        
        if (targetTask) {
          // 已移除调试日志
          if (targetTask.completed) {
            // 已移除调试日志
          } else {
            // 已移除调试日志
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
          // 已移除调试日志
        }
      } else {
        // 已移除调试日志
      }
    } catch (error) {
      // 已移除调试日志
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

    // 已移除调试日志
    // 直接打开疫苗表单
    this.openVaccineForm(selectedTask)
  },


  /**
   * 查看疫苗记录 - 与首页保持一致
   */
  viewVaccineRecord() {
    const { selectedTask } = this.data
    if (!selectedTask) return

    // 跳转到疫苗记录列表查看详情
    wx.navigateTo({
      url: `/packageHealth/vaccine-records-list/vaccine-records-list`
    })
    
    this.closeTaskDetailPopup()
  },

  /**
   * 打开用药管理表单
   */
  async openMedicationForm(task: Task) {
    // 先加载可用的药品库存
    await this.loadAvailableMedicines()
    
    // 初始化表单数据
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      selectedTask: task,
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
      selectedMedicine: null,
      medicationFormErrors: {},
      medicationFormErrorList: [],
      showMedicationFormPopup: true,
      showTaskDetail: false,
      showTaskDetailPopup: false
    })
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
        const materials = result.result.data.materials || []
        // 只显示有库存的药品
        const availableMedicines = materials
          .filter((material: unknown) => (material.currentStock || 0) > 0)
          .map((material: unknown) => ({
            id: material._id,
            name: material.name,
            unit: material.unit || '件',
            stock: material.currentStock || 0,
            category: material.category,
            description: material.description || ''
          }))
        
        // 确保数组不为空，即使没有药品也要有空数组
        const safeMedicines = Array.isArray(availableMedicines) ? availableMedicines : []
        
        this.setData({
          availableMedicines: safeMedicines
        })
      } else {
        wx.showToast({
          title: '获取药品库存失败',
          icon: 'error'
        })
      }
    } catch (error: unknown) {
      wx.showToast({
        title: '网络异常，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 选择药品
   */
  onMedicineSelect(e: CustomEvent) {
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
   * 用药表单输入处理
   */
  onMedicationFormInput(e: CustomEvent) {
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
   * 用药数量输入处理
   */
  onMedicationQuantityInput(e: CustomEvent) {
    const { value } = e.detail
    const quantity = parseInt(value) || 0
    
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
   * 验证用药表单
   */
  validateMedicationForm(): boolean {
    const { medicationFormData, selectedMedicine } = this.data
    const errors: { [key: string]: string } = {}

    // 必填字段验证
    if (!medicationFormData.medicineId || !selectedMedicine) {
      errors.medicineId = '请选择药品'
    }

    if (!medicationFormData.quantity || medicationFormData.quantity <= 0) {
      errors.quantity = '请输入正确的用药数量'
    } else if (selectedMedicine && medicationFormData.quantity > selectedMedicine.stock) {
      errors.quantity = `库存不足，当前库存${selectedMedicine.stock}${selectedMedicine.unit}`
    }

    // ✅ 用药用途不需要用户填写，任务本身已经明确定义

    // 更新错误对象和错误列表
    const errorList = Object.values(errors)
    this.setData({ 
      medicationFormErrors: errors,
      medicationFormErrorList: errorList
    })

    if (errorList.length > 0) {
      wx.showToast({
        title: errorList[0],
        icon: 'error'
      })
      return false
    }

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

    if (!selectedTask) {
      wx.showToast({
        title: '任务信息丢失',
        icon: 'error'
      })
      return
    }

    // 获取批次ID（多种字段名兼容）
    const batchId = selectedTask.batchId || selectedTask.batchNumber || this.data.currentBatchId
    
    if (!batchId) {
      wx.showToast({
        title: '批次信息缺失',
        icon: 'error'
      })
      return
    }

    try {
      wx.showLoading({ title: '提交中...' })

      // ✅ 用途字段使用任务标题，不需要用户重复填写
      const purpose = selectedTask.title || '用药任务'

      // 构建用药记录数据
      const medicationRecord = {
        taskId: selectedTask._id,
        batchId: batchId,
        materialId: medicationFormData.medicineId,
        materialName: medicationFormData.medicineName,
        quantity: medicationFormData.quantity,
        unit: medicationFormData.unit,
        purpose: purpose,
        dosage: medicationFormData.dosage,
        notes: medicationFormData.notes,
        operator: medicationFormData.operator,
        useDate: new Date().toISOString().split('T')[0],
        createTime: new Date().toISOString()
      }
      

      // 构建云函数调用参数
      const cloudFunctionData = {
        action: 'create_record',
        recordData: {
          materialId: medicationRecord.materialId,
          materialName: medicationFormData.medicineName,  // ✅ 添加药品名称
          type: 'use',
          quantity: Number(medicationRecord.quantity),
          unit: medicationRecord.unit,  // ✅ 添加单位
          targetLocation: purpose,
          operator: medicationRecord.operator || '用户',
          status: '已完成',
          notes: `用途：${purpose}${medicationRecord.dosage ? '，剂量：' + medicationRecord.dosage : ''}${medicationRecord.notes ? '，备注：' + medicationRecord.notes : ''}，批次：${selectedTask.batchNumber || selectedTask.batchId || ''}`,
          recordDate: medicationRecord.useDate,
          batchId: batchId,  // ✅ 添加批次ID
          batchNumber: selectedTask.batchNumber || ''  // ✅ 添加批次编号
        }
      }
      
      // 调用云函数创建用药记录
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: cloudFunctionData
      })

      if (result.result && result.result.success) {
        // 用药记录创建成功，先关闭弹窗和显示成功提示
        wx.hideLoading()
        wx.showToast({
          title: '用药记录已创建',
          icon: 'success'
        })

        this.closeMedicationFormPopup()
        
        // 异步标记任务为完成（不阻塞用户操作）
        this.completeMedicationTask(selectedTask._id, batchId).catch(() => {
          // 任务标记失败不影响用药记录
        })
        
        // 确保使用正确的批次ID刷新任务列表
        if (!this.data.currentBatchId && batchId) {
          this.setData({ currentBatchId: batchId })
        }
        this.loadTodos() // 刷新任务列表

      } else {
        throw new Error(result.result?.message || '提交失败')
      }

    } catch (error: unknown) {
      // 已移除调试日志
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error'
      })
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
          action: 'complete_task',
          taskId: taskId,
          batchId: batchId,
          completedAt: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      })

      if (result.result && result.result.success) {
        // 已移除调试日志
      } else {
        // 已移除调试日志
      }
    } catch (error: unknown) {
      // 已移除调试日志
    }
  },

  // ========== 营养管理表单相关方法 ==========

  /**
   * 打开营养管理表单
   */
  async openNutritionForm(task: Task) {
    // 已移除调试日志
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
      showNutritionFormPopup: true,
      showTaskDetail: false,
      showTaskDetailPopup: false
    })
  },

  /**
   * 加载可用的营养品库存
   */
  async loadAvailableNutrition() {
    try {
      // 已移除调试日志
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_materials',
          category: '营养品'  // 只获取营养品类别的物料
        }
      })

      // 已移除调试日志
      if (result.result && result.result.success) {
        const materials = result.result.data?.materials || []
        // 已移除调试日志
        // 只显示有库存的营养品
        const availableNutrition = materials
          .filter((material: unknown) => (material.currentStock || 0) > 0)
          .map((material: unknown) => ({
            id: material._id,
            name: material.name,
            unit: material.unit || '件',
            stock: material.currentStock || 0,
            category: material.category,
            description: material.description || ''
          }))

        // 已移除调试日志
        // 已移除调试日志
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
    } catch (error: unknown) {
      // 已移除调试日志
      wx.showToast({
        title: '网络异常，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 选择营养品
   */
  onNutritionSelect(e: CustomEvent) {
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
   * 营养表单输入处理
   */
  onNutritionFormInput(e: CustomEvent) {
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
   * 营养数量输入处理
   */
  onNutritionQuantityInput(e: CustomEvent) {
    const { value } = e.detail
    const quantity = parseInt(value) || 0
    
    // 已移除调试日志
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
    
    // 已移除调试日志
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
   * 验证营养表单
   */
  validateNutritionForm(): boolean {
    const { nutritionFormData, selectedNutrition } = this.data
    const errors: { [key: string]: string } = {}

    // 已移除调试日志
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
      // 已移除调试日志
      wx.showToast({
        title: errorList[0],
        icon: 'error'
      })
      return false
    }

    // 已移除调试日志
    return true
  },

  /**
   * 提交营养表单
   */
  async submitNutritionForm() {
    if (!this.validateNutritionForm()) {
      return
    }

    const selectedTask = this.data.selectedTask
    const { nutritionFormData } = this.data
    
    if (!selectedTask) {
      wx.showToast({
        title: '任务信息丢失',
        icon: 'error'
      })
      return
    }

    // 获取批次ID（多种字段名兼容）
    const batchId = selectedTask.batchId || selectedTask.batchNumber || this.data.currentBatchId
    
    if (!batchId) {
      wx.showToast({
        title: '批次信息缺失',
        icon: 'error'
      })
      return
    }

    try {
      wx.showLoading({ title: '提交中...' })

      // 构建营养记录数据
      const recordData = {
        materialId: nutritionFormData.nutritionId,
        type: 'use',
        quantity: Number(nutritionFormData.quantity),
        targetLocation: selectedTask.title, // 使用任务标题作为用途
        operator: nutritionFormData.operator || '用户',
        status: '已完成',
        notes: `任务：${selectedTask.title}，批次：${batchId}${nutritionFormData.dosage ? '，剂量：' + nutritionFormData.dosage : ''}${nutritionFormData.notes ? '，备注：' + nutritionFormData.notes : ''}`,
        recordDate: new Date().toISOString().split('T')[0]
      }

      // 已移除调试日志
      // 调用云函数创建营养记录
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'create_record',
          recordData: recordData
        }
      })

      if (result.result && result.result.success) {
        // 完成对应的任务
        await this.completeNutritionTask(selectedTask._id, batchId)
        
        wx.hideLoading()
        wx.showToast({
          title: '营养使用记录已提交',
          icon: 'success'
        })

        this.closeNutritionFormPopup()
        this.loadTodos() // 刷新任务列表

      } else {
        throw new Error(result.result?.message || '提交失败')
      }

    } catch (error: unknown) {
      // 已移除调试日志
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 完成营养管理任务
   */
  async completeNutritionTask(taskId: string, batchId: string) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'complete_task',
          taskId: taskId,
          batchId: batchId,
          completedAt: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      })

      if (result.result && result.result.success) {
        // 已移除调试日志
      } else {
        // 已移除调试日志
      }
    } catch (error: unknown) {
      // 已移除调试日志
    }
  }
})
