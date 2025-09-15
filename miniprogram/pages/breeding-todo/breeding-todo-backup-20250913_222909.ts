// breeding-todo.ts - 养殖待办事项页面逻辑

// 任务类型配置（本地定义，避免导入问题）
const TASK_TYPES = {
  inspection: { name: '巡检检查', icon: 'search', color: '#0052D9' },
  vaccine: { name: '疫苗接种', icon: 'service', color: '#00A870' },
  medication: { name: '用药治疗', icon: 'pills', color: '#ED7B2F' },
  feeding: { name: '饲养管理', icon: 'food', color: '#8B5CF6' },
  environment: { name: '环境管理', icon: 'home', color: '#06B6D4' },
  evaluation: { name: '效果评估', icon: 'chart', color: '#EF4444' },
  care: { name: '特殊护理', icon: 'heart', color: '#F59E0B' },
  monitoring: { name: '观察监测', icon: 'view', color: '#10B981' },
  documentation: { name: '文件准备', icon: 'file', color: '#6366F1' },
  logistics: { name: '物流管理', icon: 'car', color: '#8B5A2B' },
  nutrition: { name: '营养管理', icon: 'add', color: '#22C55E' },
  disinfection: { name: '消毒防疫', icon: 'clean', color: '#F97316' },
  deworming: { name: '驱虫处理', icon: 'bug', color: '#A855F7' }
}

// 优先级配置
const PRIORITY_LEVELS = {
  critical: { name: '关键', color: '#EF4444', weight: 4 },
  high: { name: '高', color: '#F59E0B', weight: 3 },
  medium: { name: '中', color: '#0052D9', weight: 2 },
  low: { name: '低', color: '#9CA3AF', weight: 1 }
}

// 生成任务提醒文本
function generateTaskReminder(task: Task, _dayAge?: number): string {
  const typeInfo = (TASK_TYPES as any)[task.type]
  
  let reminder = `【${typeInfo?.name || task.type}】${task.title}\n`
  
  if (task.duration && task.dayInSeries) {
    reminder += `⚠️ 连续任务：第${task.dayInSeries}/${task.duration}天\n`
  }
  
  if (task.dosage) {
    reminder += `💊 用量：${task.dosage}\n`
  }
  
  if (task.estimatedTime) {
    reminder += `⏱️ 预计用时：${task.estimatedTime}分钟\n`
  }
  
  reminder += `📝 ${task.description}\n`
  
  if (task.notes) {
    reminder += `💡 注意：${task.notes}`
  }
  
  return reminder
}

interface BatchInfo {
  id: string
  batchNumber: string
  entryDate: string
  currentCount: number
  status: string
}

interface Task {
  id: string
  taskId?: string  // 云函数返回的任务ID
  type: string
  priority: string
  title: string
  description: string
  category: string
  estimatedTime: number
  materials: string[]
  dosage?: string
  duration?: number
  dayInSeries?: number
  notes: string
  completed?: boolean
  showDetail?: boolean
  completedDate?: string
  dayAge?: number
}

interface TaskOverlap {
  taskId: string
  type: string
  message: string
}

Page({
  data: {
    // 基础数据
    loading: false,
    activeTab: 'today',
    
    // 批次相关
    selectedBatch: {} as BatchInfo,
    batchList: [] as BatchInfo[],
    showBatchDialog: false,
    activeBatchCount: 0,
    
    // 全局任务统计
    allTasksCount: 0,
    allCompletedCount: 0,
    allCompletionPercentage: 0,
    
    // 分组任务数据
    todayTasksByBatch: [] as any[],
    upcomingTasks: [] as any[],
    historyTasks: [] as Task[],
    taskOverlaps: [] as TaskOverlap[],
    
    // 兼容性数据（保留原有接口）
    currentDayAge: 0,
    todayDate: '',
    todayTasks: [] as Task[],
    completedTasksCount: 0,
    completionPercentage: 0,
    
    // 弹窗相关
    showTaskDialog: false,
    selectedTask: null as Task | null,
    
    // 任务详情弹窗相关
    showTaskDetailPopup: false,
    
    // 疫苗接种表单弹窗相关
    showVaccineFormPopup: false,
    vaccineFormData: {
      // 兽医信息
      veterinarianName: '',
      veterinarianPhone: '',
      
      // 疫苗信息
      vaccineName: '',
      manufacturer: '',
      batchNumber: '',
      dosage: '',
      vaccineCount: 0,
      route: 'subcutaneous',
      routeIndex: 0,
      
      // 费用信息
      vaccineCost: 0,
      veterinaryCost: 0,
      otherCost: 0,
      totalCost: 0,
      totalCostFormatted: '¥0.00',
      
      // 备注信息
      notes: ''
    },
    vaccineFormErrors: {} as Record<string, string>,
    
    // 疫苗接种选项
    vaccineRouteOptions: [
      { label: '皮下注射', value: 'subcutaneous' },
      { label: '肌肉注射', value: 'intramuscular' },
      { label: '静脉注射', value: 'intravenous' },
      { label: '口服', value: 'oral' },
      { label: '滴鼻', value: 'nasal' },
      { label: '喷雾', value: 'spray' }
    ],
    
    // 异常反应处理弹窗
    showAdverseReactionPopup: false,
    adverseReactionData: {
      count: 0,
      symptoms: '',
      severity: 'mild',
      severityIndex: 0,
      treatment: '',
      followUp: ''
    },
    severityOptions: [
      { label: '轻微', value: 'mild', color: '#00a870' },
      { label: '中等', value: 'moderate', color: '#ed7b2f' },
      { label: '严重', value: 'severe', color: '#e34d59' }
    ],
    
    // 当前处理的任务
    currentVaccineTask: null as Task | null
  },

  onLoad(options: any) {
    // 已移除调试日志
    // 检查是否需要直接打开疫苗表单
    if (options?.openVaccineForm === 'true' && options?.taskId) {
      // 延迟执行，等页面完全加载后再打开表单
      setTimeout(() => {
        this.openVaccineFormWithTaskId(options.taskId)
      }, 1000)
    }
    
    this.initPage()
  },

  onShow() {
    
    // 检查是否需要从首页同步任务状态
    this.checkAndSyncTaskStatusFromHomepage()
    
    // 每次显示页面时刷新数据
    this.refreshData()
  },

  // 检查并同步来自首页的任务状态
  checkAndSyncTaskStatusFromHomepage() {
    try {
      const globalData = getApp<any>().globalData || {}
      
      // 检查是否有需要同步的标识
      if (globalData.needSyncBreedingTodo && globalData.taskStatusUpdates) {
        
        // 同步所有来自首页的任务更新
        Object.keys(globalData.taskStatusUpdates).forEach(taskId => {
          const updateInfo = globalData.taskStatusUpdates[taskId]
          if (updateInfo.source === 'homepage' && !updateInfo.syncedToBreedingTodo) {
            this.syncTaskStatusFromHomepage(taskId, updateInfo.completed)
            // 标记已同步到待办页面
            updateInfo.syncedToBreedingTodo = true
          }
        })
        
        // 清除同步标识
        globalData.needSyncBreedingTodo = false
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  onPullDownRefresh() {
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 初始化页面
   */
  async initPage() {
    this.setData({ loading: true })
    
    try {
      // 加载批次列表
      await this.loadBatchList()
      
      // 加载所有批次的任务数据
      await Promise.all([
        this.loadAllBatchTasks(), // "进行中" - 所有批次今日任务
        this.loadAllUpcomingTasks(), // "即将到来" - 所有批次未来任务
        this.loadAllHistoryTasks() // "已完成" - 所有批次历史任务
      ])
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 刷新数据
   */
  async refreshData() {
    this.setData({ loading: true })
    
    try {
      await Promise.all([
        this.loadAllBatchTasks(),
        this.loadAllUpcomingTasks(),
        this.loadAllHistoryTasks()
      ])
    } catch (error) {
      // 已移除调试日志
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 加载批次列表
   */
  async loadBatchList() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'getActiveBatches'
        }
      }) as any

      const batchList = result?.result?.data || []
      
      this.setData({ batchList })
      
      // 输出每个批次的详细信息
    } catch (error) {
      // 已移除调试日志
      throw error
    }
  },

  /**
   * 计算当前日龄（与 utils/breeding-schedule.js 保持一致）
   * 规则：入栏第一日算1日龄
   */
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

  /**
   * 验证日龄计算逻辑一致性（用于开发测试）
   * 可以手动调用此方法验证不同日龄计算结果的一致性
   */
  validateDayAgeCalculation(entryDate: string): { localResult: number, expectedLogic: string } {
    try {
      // 本地计算结果
      const localResult = this.calculateCurrentAge(entryDate)
      
      // 期望的逻辑描述
      const expectedLogic = `使用 Math.floor + 1 的标准逻辑：入栏第一日算1日龄`
      
      
      return { localResult, expectedLogic }
    } catch (error) {
      // 已移除调试日志
      return { localResult: -1, expectedLogic: '验证失败' }
    }
  },

  /**
   * 计算指定日龄对应的日期（与新的日龄计算逻辑保持一致）
   */
  calculateDate(dayAge: number): string {
    if (!this.data.selectedBatch.entryDate) return ''
    
    // 使用与 calculateCurrentAge 相同的日期处理方式
    const entryDateStr = this.data.selectedBatch.entryDate.split('T')[0] // YYYY-MM-DD
    const startDate = new Date(entryDateStr + 'T00:00:00')
    
    // 第1日龄对应入栏当天，所以需要加(dayAge - 1)天
    const targetDate = new Date(startDate.getTime() + (dayAge - 1) * 24 * 60 * 60 * 1000)
    
    return `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
  },

  /**
   * 加载所有批次的任务数据
   */
  async loadAllBatchTasks() {
    try {
      
      // 修改筛选条件：根据日志显示，批次状态是"已完成"而不是"active"
      const activeBatches = this.data.batchList.filter((batch: BatchInfo) => {
        // 根据实际情况调整筛选条件
        // 如果是刚入栏的批次，状态可能是"已完成"（入栏完成）但仍需要养殖任务
        return batch.status === 'active' || 
               batch.status === '已完成' || 
               batch.status === '活跃' ||
               batch.status === 'ongoing' ||
               batch.status === '进行中'
      })
      
      this.setData({ activeBatchCount: activeBatches.length })
      
      if (activeBatches.length === 0) {
        this.setData({
          todayTasksByBatch: [],
          allTasksCount: 0,
          allCompletedCount: 0,
          allCompletionPercentage: 0
        })
        return
      }
      
      let allTasks: Task[] = []
      const tasksByBatch: any[] = []
      
      // 为每个活跃批次加载任务
      for (const batch of activeBatches) {
        const dayAge = this.calculateCurrentAge(batch.entryDate)
        
        // 验证日龄计算逻辑（开发阶段）
        this.validateDayAgeCalculation(batch.entryDate)
        
        // 调用云函数获取该批次的今日任务
        const result = await wx.cloud.callFunction({
          name: 'breeding-todo',
          data: {
            action: 'getTodayTasks',
            batchId: batch.id,
            dayAge: dayAge
          }
        })
        
        if (result.result && result.result.success) {
          // 适配云函数返回的数据格式
          const batchTasks = result.result.data?.tasks || result.result.tasks || []
          
          // 添加展开状态
          const tasksWithStatus = batchTasks.map((task: Task) => ({
            ...task,
            showDetail: false
          }))
          
          if (tasksWithStatus.length > 0) {
            const batchGroup = {
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              dayAge: dayAge,
              tasks: tasksWithStatus
            }
            tasksByBatch.push(batchGroup)
            
            allTasks = allTasks.concat(tasksWithStatus)
          }
        }
      }
      
      // 应用本地完成状态
      const tasksByBatchWithLocalStatus = tasksByBatch.map(batchGroup => ({
        ...batchGroup,
        tasks: this.applyLocalCompletionStatus(batchGroup.tasks)
      }))
      
      const allTasksWithLocalStatus = this.applyLocalCompletionStatus(allTasks)
      
      // 重新计算统计（基于本地状态）
      const completedCount = allTasksWithLocalStatus.filter(task => task.completed).length
      const totalCount = allTasksWithLocalStatus.length
      const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
      
      // 任务统计结果已计算完成
      
      this.setData({
        todayTasksByBatch: tasksByBatchWithLocalStatus,
        allTasksCount: totalCount,
        allCompletedCount: completedCount,
        allCompletionPercentage: percentage,
        // 兼容性数据
        todayTasks: allTasksWithLocalStatus,
        completedTasksCount: completedCount,
        completionPercentage: percentage
      })
      
      // 任务数据设置完成
      
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '加载任务失败',
        icon: 'error'
      })
    }
  },

  /**
   * 更新任务统计信息
   */
  updateTaskStatistics() {
    // 重新计算全局统计
    let allTasks: Task[] = []
    this.data.todayTasksByBatch.forEach(batchGroup => {
      allTasks = allTasks.concat(batchGroup.tasks)
    })
    
    const completedCount = allTasks.filter(task => task.completed).length
    const totalCount = allTasks.length
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    
    this.setData({ 
      allTasksCount: totalCount,
      allCompletedCount: completedCount,
      allCompletionPercentage: percentage,
      // 兼容性数据
      todayTasks: allTasks,
      completedTasksCount: completedCount,
      completionPercentage: percentage
    })
  },

  /**
   * 加载今日任务
   */
  async loadTodayTasks() {
    if (!this.data.selectedBatch.id) return

    try {
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'getTodayTasks',
          batchId: this.data.selectedBatch.id
        }
      }) as any

      if (result?.result?.success) {
        const { dayAge, tasks } = result.result.data || {}
        
        const tasksWithStatus = (tasks || []).map((task: any) => ({
          ...task,
          id: task.taskId || task.id, // 兼容前端使用的id字段
          showDetail: false
        }))

        // 格式化今日日期
        const today = new Date()
        const todayDate = `${today.getMonth() + 1}月${today.getDate()}日`

        this.setData({
          currentDayAge: dayAge || 1,
          todayDate,
          todayTasks: tasksWithStatus,
          taskOverlaps: [] // 暂时清空重叠检查
        })

        // 更新任务统计信息
        this.updateTaskStatistics()
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '加载任务失败',
        icon: 'error'
      })
    }
  },

  /**
   * 加载即将到来的任务
   */
  async loadUpcomingTasks() {
    if (!this.data.selectedBatch.id) return

    try {
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'getUpcomingTasks',
          batchId: this.data.selectedBatch.id,
          days: 7
        }
      }) as any

      if (result?.result?.success) {
        this.setData({ upcomingTasks: result.result.data || [] })
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  /**
   * 加载历史任务
   */
  async loadHistoryTasks() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'getCompletedTasks',
          batchId: this.data.selectedBatch.id
        }
      }) as any

      const historyTasks = result?.result?.data || []
      this.setData({ historyTasks })
    } catch (error) {
      // 已移除调试日志
    }
  },

  /**
   * 获取已完成任务列表
   */
  async getCompletedTasks(dayAge: number): Promise<string[]> {
    try {
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'getCompletedTaskIds',
          batchId: this.data.selectedBatch.id,
          dayAge
        }
      }) as any

      return result?.result?.data || []
    } catch (error) {
      // 已移除调试日志
      return []
    }
  },

  /**
   * Tab切换
   */
  onTabChange(event: any) {
    this.setData({
      activeTab: event.detail.value
    })
  },

  /**
   * 显示批次选择器
   */
  showBatchPicker() {
    this.setData({ showBatchDialog: true })
  },

  /**
   * 隐藏批次选择器
   */
  hideBatchPicker() {
    this.setData({ showBatchDialog: false })
  },

  /**
   * 选择批次
   */
  async selectBatch(event: any) {
    const batch = event.currentTarget.dataset.batch
    this.setData({
      selectedBatch: batch,
      showBatchDialog: false
    })

    // 刷新任务数据
    await this.refreshData()
  },

  /**
   * 任务完成状态切换
   */
  async onTaskComplete(event: any) {
    const taskId = event.currentTarget.dataset.taskId
    const completed = event.detail.value
    
    try {
      // 更新本地状态
      // 更新分组数据
      const updatedTasksByBatch = this.data.todayTasksByBatch.map(batchGroup => {
        const updatedTasks = batchGroup.tasks.map((task: Task) => {
          if (task.id === taskId || task.taskId === taskId) {
            return { ...task, completed }
          }
          return task
        })
        return { ...batchGroup, tasks: updatedTasks }
      })
      
      this.setData({ todayTasksByBatch: updatedTasksByBatch })

      // 更新任务统计信息
      this.updateTaskStatistics()

      // 同步到服务器
      await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: completed ? 'completeTask' : 'uncompleteTask',
          batchId: this.data.selectedBatch.id,
          dayAge: this.data.currentDayAge,
          taskId,
          completedTime: completed ? new Date().toISOString() : null
        }
      }) as any

      if (completed) {
        wx.showToast({
          title: '任务已完成',
          icon: 'success'
        })
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
      
      // 回滚分组数据
      const revertedTasksByBatch = this.data.todayTasksByBatch.map(batchGroup => {
        const revertedTasks = batchGroup.tasks.map((task: Task) => {
          if (task.id === taskId || task.taskId === taskId) {
            return { ...task, completed: !completed }
          }
          return task
        })
        return { ...batchGroup, tasks: revertedTasks }
      })
      
      this.setData({ todayTasksByBatch: revertedTasksByBatch })
      
      // 更新任务统计信息
      this.updateTaskStatistics()
    }
  },

  /**
   * 切换任务详情显示 (已废弃，改为使用弹窗)
   */
  toggleTaskDetail() {
    // 已改为使用弹窗模式，该方法保留但不再使用
  },

  /**
   * 开始执行任务
   */
  startTask(event: any) {
    const taskId = event.currentTarget.dataset.taskId
    const task = this.data.todayTasks.find(t => t.id === taskId || t.taskId === taskId)
    
    if (!task) return

    wx.showModal({
      title: '开始任务',
      content: `确定开始执行"${task.title}"吗？`,
      success: (res) => {
        if (res.confirm) {
          // 显示任务提醒
          wx.showModal({
            title: task.title,
            content: generateTaskReminder(task, this.data.currentDayAge),
            showCancel: false,
            confirmText: '知道了'
          })
        }
      }
    })
  },

  /**
   * 添加任务记录
   */
  recordTask(event: any) {
    const taskId = event.currentTarget.dataset.taskId
    const task = this.data.todayTasks.find(t => t.id === taskId || t.taskId === taskId)
    
    if (!task) return

    // 根据任务类型跳转到相应的记录页面
    const pageMap: Record<string, string> = {
      vaccine: '/pages/vaccine-record/vaccine-record',
      medication: '/pages/treatment-record/treatment-record',
      inspection: '/pages/health-inspection/health-inspection',
      environment: '/pages/disinfection-record/disinfection-record'
    }

    const targetPage = pageMap[task.type]
    if (targetPage) {
      wx.navigateTo({
        url: `${targetPage}?batchId=${this.data.selectedBatch.id}&taskId=${taskId}&dayAge=${this.data.currentDayAge}`
      })
    } else {
      wx.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    }
  },

  /**
   * 显示统计信息
   */
  showStatistics() {
    wx.navigateTo({
      url: `/pages/breeding-statistics/breeding-statistics?batchId=${this.data.selectedBatch.id}`
    })
  },

  /**
   * 关闭任务详情弹窗
   */
  closeTaskDialog() {
    this.setData({
      showTaskDialog: false,
      selectedTask: null
    })
  },

  /**
   * 确认任务详情弹窗
   */
  confirmTaskDialog() {
    this.closeTaskDialog()
  },

  /**
   * 查看任务详情 - 使用弹窗展示
   */
  viewTaskDetail(event: any) {
    // 已移除调试日志
    const task = event.currentTarget.dataset.task
    
    // 调试：打印任务数据以检查类型字段
    // 已移除调试日志
    // 已移除调试日志
    console.log('任务类型名称:', this.getTypeName(task?.type || ''))
    // 已移除调试日志
    // 已移除调试日志
    // 检查是否是疫苗接种任务
    const isVaccineTaskResult = this.isVaccineTask(task)

    // 已移除调试日志
    // 已移除调试日志
    // 已移除调试日志
    // 预处理任务数据，添加显示用的字段
    const enhancedTask = {
      ...task,
      
      // 确保ID字段存在（支持多种ID字段名）
      id: task.id || task.taskId || (task as any)._id || '',
      
      // 疫苗任务标识
      isVaccineTask: isVaccineTaskResult,
      
      typeName: this.getTypeName(task.type || ''),
      priorityName: this.getPriorityName(task.priority || 'medium'),
      priorityTheme: this.getPriorityTheme(task.priority || 'medium'),
      statusText: task.completed ? '已完成' : (task.completedDate ? '已完成' : '待完成'),
      
      // 确保关键字段存在
      title: task.title || '未命名任务',
      description: task.description || '',
      notes: task.notes || '',
      estimatedTime: task.estimatedTime || '',
      duration: task.duration || '',
      dayInSeries: task.dayInSeries || '',
      dosage: task.dosage || '',
      materials: Array.isArray(task.materials) ? task.materials : [],
      batchNumber: task.batchNumber || '',
      dayAge: task.dayAge || '',
      
      // 对于已完成的任务，添加完成时间信息
      completedDate: task.completedDate || '',
      
      // 确保completed状态正确
      completed: task.completed || !!task.completedDate,
      
      // 检查是否可以完成：只有"即将到来"标签页中的任务不能完成
      canComplete: this.data.activeTab !== 'upcoming'
    }
    
    // 已移除调试日志
    // 已移除调试日志
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
      // 已移除调试日志
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


      // 获取当前批次信息
      const currentBatch = this.getCurrentBatch()
      if (!currentBatch) {
        throw new Error('未找到当前批次信息')
      }

      // 调用云函数完成任务
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'completeTask',
          taskId: taskId,
          batchId: currentBatch.id,
          dayAge: selectedTask.dayAge || this.data.currentDayAge || 0,
          completedAt: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      })

      if (result.result && result.result.success) {
        // 保存完成状态到本地存储
        this.saveTaskCompletionToLocal(taskId, true)

        // 更新本地任务状态
        this.updateLocalTaskStatus(taskId, true)

        // 更新统计信息
        this.updateTaskStatistics()

        // 通知首页刷新今日待办
        this.notifyHomepageTaskUpdate(taskId, true)

        // 关闭弹窗
        this.closeTaskDetailPopup()

        // 显示成功提示
        wx.showToast({
          title: '任务已完成',
          icon: 'success',
          duration: 2000
        })

      } else {
        throw new Error(result.result?.message || '完成任务失败')
      }

    } catch (error) {
      // 已移除调试日志
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
   * 获取当前批次信息
   */
  getCurrentBatch() {
    // 从待办任务中获取批次信息，或者从页面参数中获取
    if (this.data.selectedBatch) {
      return this.data.selectedBatch
    }
    
    // 如果没有选中批次，尝试从任务数据中获取
    if (this.data.todayTasksByBatch && this.data.todayTasksByBatch.length > 0) {
      const firstBatch = this.data.todayTasksByBatch[0]
      return {
        id: firstBatch.batchId || firstBatch.batch?.id,
        batchNumber: firstBatch.batchNumber || firstBatch.batch?.batchNumber
      }
    }
    
    return null
  },

  /**
   * 保存任务完成状态到本地存储
   */
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
      // 已移除调试日志
    }
  },

  /**
   * 从本地存储获取任务完成状态
   */
  getLocalTaskCompletions(): Record<string, any> {
    try {
      return wx.getStorageSync('completed_tasks') || {}
    } catch (error) {
      // 已移除调试日志
      return {}
    }
  },

  /**
   * 应用本地完成状态到任务数据
   */
  applyLocalCompletionStatus(tasks: any[]): any[] {
    const localCompletions = this.getLocalTaskCompletions()
    
    return tasks.map(task => {
      const taskId = task.id || task.taskId || (task as any)._id
      if (taskId && localCompletions[taskId]) {
        return {
          ...task,
          completed: true,
          completedDate: localCompletions[taskId].completedDate
        }
      }
      return task
    })
  },

  /**
   * 通知首页更新任务状态（增强版）
   */
  notifyHomepageTaskUpdate(taskId: string, completed: boolean) {
    try {
      
      // 1. 使用事件通知首页更新
      const eventChannel = this.getOpenerEventChannel?.()
      if (eventChannel) {
        eventChannel.emit('taskStatusChanged', { taskId, completed })
      }
      
      // 2. 同时保存到全局变量供首页使用
      getApp<any>().globalData = getApp<any>().globalData || {}
      getApp<any>().globalData.taskStatusUpdates = getApp<any>().globalData.taskStatusUpdates || {}
      getApp<any>().globalData.taskStatusUpdates[taskId] = {
        completed,
        timestamp: Date.now()
      }
      
      // 3. 立即触发首页状态同步标识
      getApp<any>().globalData.needSyncHomepage = true
      getApp<any>().globalData.lastSyncTime = Date.now()
      
      // 4. 尝试直接调用首页的同步方法（如果存在）
      try {
        const pages = getCurrentPages()
        const homePage = pages.find((page: any) => page.route === 'pages/index/index')
        if (homePage && typeof (homePage as any).syncTaskStatusFromGlobal === 'function') {
          setTimeout(() => {
            (homePage as any).syncTaskStatusFromGlobal(taskId, completed)
          }, 100) // 延迟100ms确保状态保存完成
        }
      } catch (error) {
        // 直接调用首页方法失败（正常情况）
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  // 从首页同步任务状态（供首页调用）
  syncTaskStatusFromHomepage(taskId: string, completed: boolean) {
    
    // 立即更新本地任务状态
    this.updateLocalTaskStatus(taskId, completed)
    
    // 保存到本地存储
    this.saveTaskCompletionToLocal(taskId, completed)
    
    // 更新统计信息
    this.updateTaskStatistics()
    
    // 标记全局状态已同步
    try {
      const globalData = getApp<any>().globalData || {}
      if (globalData.taskStatusUpdates && globalData.taskStatusUpdates[taskId]) {
        globalData.taskStatusUpdates[taskId].syncedToBreedingTodo = true
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  /**
   * 更新本地任务状态
   */
  updateLocalTaskStatus(taskId: string, completed: boolean) {
    
    if (!taskId) {
      // 已移除调试日志
      return
    }

    let updatedCount = 0
    
    // 更新今日任务分组数据
    const updatedTasksByBatch = this.data.todayTasksByBatch.map(batchGroup => {
      const updatedTasks = batchGroup.tasks.map((task: any) => {
        if ((task.id && task.id === taskId) || (task.taskId && task.taskId === taskId)) {
          updatedCount++
          return { ...task, completed, completedDate: completed ? new Date().toLocaleString() : null }
        }
        return task
      })
      return { ...batchGroup, tasks: updatedTasks }
    })

    // 更新即将到来的任务
    const updatedUpcomingTasks = this.data.upcomingTasks.map(dayGroup => {
      const updatedTasks = dayGroup.tasks.map((task: any) => {
        if ((task.id && task.id === taskId) || (task.taskId && task.taskId === taskId)) {
          return { ...task, completed, completedDate: completed ? new Date().toLocaleString() : null }
        }
        return task
      })
      return { ...dayGroup, tasks: updatedTasks }
    })

    // 更新历史任务（如果任务被完成，添加到历史记录）
    let updatedHistoryTasks = [...this.data.historyTasks]
    if (completed) {
      // 找到刚完成的任务
      let completedTask = null
      for (const batchGroup of updatedTasksByBatch) {
        const task = batchGroup.tasks.find((t: any) => 
          ((t.id && t.id === taskId) || (t.taskId && t.taskId === taskId)) && t.completed
        )
        if (task) {
          completedTask = task
          break
        }
      }
      
      if (completedTask) {
        updatedHistoryTasks.unshift({
          ...completedTask,
          completedDate: new Date().toLocaleString()
        })
      }
    }

    this.setData({
      todayTasksByBatch: updatedTasksByBatch,
      upcomingTasks: updatedUpcomingTasks,
      historyTasks: updatedHistoryTasks
    })
  },

  /**
   * 任务详情弹窗可见性变化
   */
  onTaskDetailPopupChange(event: any) {
    const { visible } = event.detail
    if (!visible) {
      this.setData({
        showTaskDetailPopup: false,
        selectedTask: null
      })
    }
  },


  /**
   * 返回上一页
   */
  onGoBack() {
    wx.navigateBack()
  },

  /**
   * 获取任务类型名称
   */
  getTypeName(type: string): string {
    return (TASK_TYPES as any)[type]?.name || type
  },

  /**
   * 获取任务类型主题
   */
  getTypeTheme(type: string): string {
    const colorMap: Record<string, string> = {
      inspection: 'primary',
      vaccine: 'success',
      medication: 'warning',
      feeding: 'info',
      environment: 'primary',
      evaluation: 'danger',
      care: 'warning',
      monitoring: 'success',
      documentation: 'info',
      logistics: 'default'
    }
    return colorMap[type] || 'default'
  },

  /**
   * 获取优先级名称
   */
  getPriorityName(priority: string): string {
    return (PRIORITY_LEVELS as any)[priority]?.name || priority
  },

  /**
   * 获取优先级颜色
   */
  getPriorityColor(priority: string): string {
    return (PRIORITY_LEVELS as any)[priority]?.color || '#9CA3AF'
  },

  /**
   * 获取优先级主题
   */
  getPriorityTheme(priority: string): string {
    const themeMap: Record<string, string> = {
      critical: 'danger',
      high: 'danger', 
      medium: 'warning',
      low: 'primary'
    }
    return themeMap[priority] || 'primary'
  },

  /**
   * 加载所有批次的即将到来任务
   */
  async loadAllUpcomingTasks() {
    try {
      const activeBatches = this.data.batchList.filter((batch: BatchInfo) => {
        return batch.status === 'active' || 
               batch.status === '已完成' || 
               batch.status === '活跃' ||
               batch.status === 'ongoing' ||
               batch.status === '进行中'
      })
      if (activeBatches.length === 0) {
        this.setData({ upcomingTasks: [] })
        return
      }

      let allUpcomingTasks: any[] = []

      // 为每个活跃批次加载即将到来的任务
      for (const batch of activeBatches) {
        const result = await wx.cloud.callFunction({
          name: 'breeding-todo',
          data: {
            action: 'getUpcomingTasks',
            batchId: batch.id,
            days: 7
          }
        }) as any

        if (result?.result?.success) {
          const batchUpcomingTasks = result.result.data || []
          
          // 为每个日期组添加批次信息
          batchUpcomingTasks.forEach((dayGroup: any) => {
            dayGroup.batchInfo = {
              batchId: batch.id,
              batchNumber: batch.batchNumber
            }
            // 为每个任务添加批次信息
            dayGroup.tasks.forEach((task: any) => {
              task.batchNumber = batch.batchNumber
              task.batchId = batch.id
            })
          })
          
          allUpcomingTasks = allUpcomingTasks.concat(batchUpcomingTasks)
        }
      }

      // 按日龄排序并合并相同日龄的任务
      const groupedTasks: Record<number, any> = {}
      allUpcomingTasks.forEach(dayGroup => {
        const dayAge = dayGroup.dayAge
        if (!groupedTasks[dayAge]) {
          groupedTasks[dayAge] = {
            dayAge,
            tasks: []
          }
        }
        groupedTasks[dayAge].tasks = groupedTasks[dayAge].tasks.concat(dayGroup.tasks)
      })

      // 转换为数组并排序
      const sortedUpcomingTasks = Object.values(groupedTasks).sort((a: any, b: any) => a.dayAge - b.dayAge)

      this.setData({ upcomingTasks: sortedUpcomingTasks })
    } catch (error) {
      // 已移除调试日志
    }
  },

  /**
   * 加载所有批次的历史任务
   */
  async loadAllHistoryTasks() {
    try {
      const activeBatches = this.data.batchList.filter((batch: BatchInfo) => {
        return batch.status === 'active' || 
               batch.status === '已完成' || 
               batch.status === '活跃' ||
               batch.status === 'ongoing' ||
               batch.status === '进行中'
      })
      if (activeBatches.length === 0) {
        this.setData({ historyTasks: [] })
        return
      }

      let allHistoryTasks: any[] = []

      // 为每个活跃批次加载历史任务
      for (const batch of activeBatches) {
        const result = await wx.cloud.callFunction({
          name: 'breeding-todo',
          data: {
            action: 'getCompletedTasks',
            batchId: batch.id
          }
        }) as any

        if (result?.result?.success) {
          const batchHistoryTasks = (result.result.data || []).map((task: any) => ({
            ...task,
            batchNumber: batch.batchNumber,
            batchId: batch.id
          }))
          
          allHistoryTasks = allHistoryTasks.concat(batchHistoryTasks)
        }
      }

      // 按完成时间倒序排序
      allHistoryTasks.sort((a, b) => {
        const timeA = new Date(a.completedTime || a.completedDate || 0).getTime()
        const timeB = new Date(b.completedTime || b.completedDate || 0).getTime()
        return timeB - timeA
      })

      this.setData({ historyTasks: allHistoryTasks })
    } catch (error) {
      // 已移除调试日志
    }
  },

  // ========== 疫苗接种表单相关方法 ==========

  /**
   * 判断是否为疫苗接种任务
   */
  isVaccineTask(task: Task): boolean {
    // 已移除调试日志
    // 已移除调试日志
    // 已移除调试日志
    // 已移除调试日志
    // 已移除调试日志
    const checks = [
      { name: 'type === vaccine', result: task.type === 'vaccine' },
      { name: 'title包含疫苗', result: task.title?.includes('疫苗') || false },
      { name: 'title包含接种', result: task.title?.includes('接种') || false },
      { name: 'title包含免疫', result: task.title?.includes('免疫') || false },
      { name: 'title包含注射', result: task.title?.includes('注射') || false },
      { name: 'title包含血清', result: task.title?.includes('血清') || false },
      { name: 'title包含抗体', result: task.title?.includes('抗体') || false },
      { name: 'title包含一针', result: task.title?.includes('一针') || false },
      { name: 'title包含二针', result: task.title?.includes('二针') || false },
      { name: 'title包含三针', result: task.title?.includes('三针') || false },
      { name: 'description包含注射', result: task.description?.includes('注射') || false },
      { name: 'description包含接种', result: task.description?.includes('接种') || false },
      { name: 'description包含疫苗', result: task.description?.includes('疫苗') || false },
      { name: 'description包含血清', result: task.description?.includes('血清') || false },
      { name: 'typeName为疫苗接种', result: this.getTypeName(task.type || '') === '疫苗接种' }
    ]
    
    // 已移除调试日志
    checks.forEach(check => {
      // 已移除调试日志
    })
    
    const isVaccine = checks.some(check => check.result)
    // 已移除调试日志
    // 已移除调试日志
    return isVaccine
  },

  /**
   * 打开疫苗接种表单
   */
  openVaccineForm() {
    const { selectedTask } = this.data
    if (!selectedTask) {
      wx.showToast({
        title: '任务信息缺失',
        icon: 'none'
      })
      return
    }

    // 已移除调试日志
    // 已移除调试日志
    // 检查是否是疫苗接种任务
    if (!this.isVaccineTask(selectedTask)) {
      wx.showToast({
        title: '当前任务不是疫苗接种任务',
        icon: 'none'
      })
      return
    }

    // 初始化表单数据
    this.initVaccineFormData(selectedTask)
    
    this.setData({
      currentVaccineTask: selectedTask,
      showTaskDetailPopup: false,
      showVaccineFormPopup: true
    }, () => {
      // 打开表单后重新计算总费用
      this.calculateTotalCost()
    })
  },

  /**
   * 初始化疫苗表单数据
   */
  initVaccineFormData(_task: Task) {

    this.setData({
      vaccineFormData: {
        // 兽医信息
        veterinarianName: '',
        veterinarianPhone: '',
        
        // 疫苗信息
        vaccineName: '',
        manufacturer: '',
        batchNumber: '',
        dosage: '',
        vaccineCount: 0,
        route: 'subcutaneous',
        routeIndex: 0,
        
        // 费用信息
        vaccineCost: 0,
        veterinaryCost: 0,
        otherCost: 0,
        totalCost: 0,
        totalCostFormatted: '¥0.00',
        
        // 备注信息
        notes: ''
      },
      vaccineFormErrors: {}
    }, () => {
      // 初始化后计算总费用
      this.calculateTotalCost()
    })
  },

  /**
   * 关闭疫苗接种表单弹窗
   */
  closeVaccineFormPopup() {
    this.setData({
      showVaccineFormPopup: false,
      currentVaccineTask: null,
      vaccineFormErrors: {}
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
    
    this.validateVaccineField(field, value)
  },

  /**
   * 疫苗表单数字输入处理
   */
  onVaccineNumberInput(e: any) {
    const { field } = e.currentTarget.dataset
    const value = parseFloat(e.detail.value) || 0
    
    // 更新单个字段
    this.setData({
      [`vaccineFormData.${field}`]: value
    }, () => {
      // 在更新完成后计算总费用
      if (['vaccineCost', 'veterinaryCost', 'otherCost'].includes(field)) {
        setTimeout(() => {
          this.calculateTotalCost()
        }, 100) // 短暂延迟确保数据更新完成
      }
    })
    
    this.validateVaccineField(field, value)
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
    
    // 已移除调试日志
    // 已移除调试日志
    // 更新整个vaccineFormData对象
    this.setData({
      vaccineFormData: {
        ...this.data.vaccineFormData,
        totalCost: totalCost,
        totalCostFormatted: totalCostFormatted
      }
    }, () => {
      // 已移除调试日志
      // 已移除调试日志
      // 已移除调试日志
    })
  },


  /**
   * 疫苗接种方式选择
   */
  onVaccineRouteChange(e: any) {
    const index = e.detail.value
    const selectedRoute = this.data.vaccineRouteOptions[index]
    
    this.setData({
      'vaccineFormData.route': selectedRoute.value,
      'vaccineFormData.routeIndex': index
    })
  },

  /**
   * 验证疫苗表单字段
   */
  validateVaccineField(field: string, value: any) {
    const errors = { ...this.data.vaccineFormErrors }
    
    switch (field) {
      case 'veterinarianName':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入执行兽医姓名'
        } else {
          delete errors[field]
        }
        break
      case 'vaccineName':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入疫苗名称'
        } else {
          delete errors[field]
        }
        break
      case 'dosage':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入接种剂量'
        } else {
          delete errors[field]
        }
        break
      case 'vaccineCount':
        if (!value || value <= 0) {
          errors[field] = '接种数量必须大于0'
        } else {
          delete errors[field]
        }
        break
      case 'vaccineCost':
        if (!value || value <= 0) {
          errors[field] = '疫苗费用必须大于0'
        } else {
          delete errors[field]
        }
        break
    }
    
    this.setData({ vaccineFormErrors: errors })
  },

  /**
   * 验证疫苗表单
   */
  validateVaccineForm(): boolean {
    const { vaccineFormData } = this.data
    const errors: Record<string, string> = {}
    
    // 必填字段验证
    if (!vaccineFormData.veterinarianName) errors.veterinarianName = '请输入执行兽医姓名'
    if (!vaccineFormData.vaccineName) errors.vaccineName = '请输入疫苗名称'
    if (!vaccineFormData.dosage) errors.dosage = '请输入接种剂量'
    if (!vaccineFormData.vaccineCount || vaccineFormData.vaccineCount <= 0) {
      errors.vaccineCount = '接种数量必须大于0'
    }
    if (!vaccineFormData.vaccineCost || vaccineFormData.vaccineCost <= 0) {
      errors.vaccineCost = '疫苗费用必须大于0'
    }
    
    
    this.setData({ vaccineFormErrors: errors })
    return Object.keys(errors).length === 0
  },

  /**
   * 提交疫苗接种表单
   */
  async submitVaccineForm() {
    if (!this.validateVaccineForm()) {
      wx.showToast({
        title: '请检查表单信息',
        icon: 'none'
      })
      return
    }

    this.setData({ submitting: true })

    try {
      const { vaccineFormData, currentVaccineTask } = this.data
      
      if (!currentVaccineTask) {
        throw new Error('任务信息丢失')
      }

      // 获取当前批次信息
      const currentBatch = this.getCurrentBatch()
      if (!currentBatch) {
        throw new Error('未找到当前批次信息')
      }

      // 构建疫苗记录数据
      const vaccineRecord = {
        taskId: currentVaccineTask.id || currentVaccineTask.taskId,
        batchId: currentBatch.id,
        batchNumber: currentBatch.batchNumber,
        
        // 兽医信息
        veterinarian: {
          name: vaccineFormData.veterinarianName,
          phone: vaccineFormData.veterinarianPhone
        },
        
        // 疫苗信息
        vaccine: {
          name: vaccineFormData.vaccineName,
          manufacturer: vaccineFormData.manufacturer,
          batchNumber: vaccineFormData.batchNumber,
          dosage: vaccineFormData.dosage,
          route: vaccineFormData.route
        },
        
        // 接种信息
        vaccination: {
          count: vaccineFormData.vaccineCount,
          executionDate: new Date().toISOString(),
          operator: vaccineFormData.veterinarianName,
          notes: vaccineFormData.notes
        },
        
        // 费用信息
        cost: {
          vaccine: vaccineFormData.vaccineCost,
          veterinary: vaccineFormData.veterinaryCost,
          other: vaccineFormData.otherCost,
          total: vaccineFormData.totalCost
        },
        
      }

      // 调用云函数完成任务并创建预防记录
      // 已移除调试日志
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'completeVaccineTask',
          taskId: currentVaccineTask.id || currentVaccineTask.taskId,
          batchId: currentBatch.id,
          dayAge: currentVaccineTask.dayAge || this.data.currentDayAge || 0,
          vaccineRecord: vaccineRecord
        }
      })

      // 已移除调试日志
      // 已移除调试日志
      // 已移除调试日志
      if (result.result && result.result.success) {
        // 获取任务ID
        const taskId = currentVaccineTask.id || currentVaccineTask.taskId || ''
        
        if (taskId) {
          // 保存完成状态到本地存储
          this.saveTaskCompletionToLocal(taskId, true)

          // 更新本地任务状态
          this.updateLocalTaskStatus(taskId, true)

          // 更新统计信息
          this.updateTaskStatistics()

          // 通知首页刷新今日待办
          this.notifyHomepageTaskUpdate(taskId, true)
        }

        // 关闭弹窗
        this.closeVaccineFormPopup()

        wx.showToast({
          title: '疫苗接种记录保存成功',
          icon: 'success'
        })


      } else {
        // 已移除调试日志
        const errorMessage = result.result?.error || result.result?.message || '保存失败'
        throw new Error(errorMessage)
      }

    } catch (error: any) {
      // 已移除调试日志
      wx.showToast({
        title: error.message || '保存失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  /**
   * 处理疫苗异常反应
   */
  handleVaccineAdverseReaction(_vaccineRecordData: any) {
    this.setData({
      adverseReactionData: {
        count: 0,
        symptoms: '',
        severity: 'mild',
        severityIndex: 0,
        treatment: '',
        followUp: ''
      },
      showAdverseReactionPopup: true
    })
  },

  /**
   * 关闭异常反应处理弹窗
   */
  closeAdverseReactionPopup() {
    this.setData({
      showAdverseReactionPopup: false
    })
  },

  /**
   * 异常反应表单输入处理
   */
  onAdverseReactionInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`adverseReactionData.${field}`]: value
    })
  },

  /**
   * 症状等级选择
   */
  onSeverityChange(e: any) {
    const index = e.detail.value
    const selectedSeverity = this.data.severityOptions[index]
    
    this.setData({
      'adverseReactionData.severity': selectedSeverity.value,
      'adverseReactionData.severityIndex': index
    })
  },

  /**
   * 提交异常反应记录
   */
  async submitAdverseReactionRecord() {
    const { adverseReactionData, currentVaccineTask } = this.data
    
    if (!adverseReactionData.treatment) {
      wx.showToast({
        title: '请填写处理措施',
        icon: 'none'
      })
      return
    }

    try {
      // 获取当前批次信息
      const currentBatch = this.getCurrentBatch()
      if (!currentBatch) {
        throw new Error('未找到当前批次信息')
      }

      // 创建健康记录
      await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_health_record',
          batchId: currentBatch.id,
          recordType: 'adverse_reaction',
          symptoms: adverseReactionData.symptoms,
          affectedCount: adverseReactionData.count,
          severity: adverseReactionData.severity,
          initialTreatment: adverseReactionData.treatment,
          followUpPlan: adverseReactionData.followUp,
          notes: `疫苗接种异常反应：${adverseReactionData.symptoms}`,
          sourceType: 'vaccine_adverse',
          sourceTaskId: currentVaccineTask?.id || currentVaccineTask?.taskId
        }
      })

      this.closeAdverseReactionPopup()

      wx.showToast({
        title: '异常反应记录已保存',
        icon: 'success'
      })

      // 询问是否立即跳转到诊疗管理
      wx.showModal({
        title: '异常反应已记录',
        content: '是否立即跳转到诊疗管理进行进一步处理？',
        confirmText: '前往处理',
        cancelText: '稍后处理',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/health/health?activeTab=treatment'
            })
          }
        }
      })

    } catch (error: any) {
      // 已移除调试日志
      wx.showToast({
        title: error.message || '记录失败，请重试',
        icon: 'none'
      })
    }
  },

  /**
   * 查看疫苗接种记录（已完成的任务）
   */
  viewVaccineRecord() {
    const { selectedTask } = this.data
    if (!selectedTask) return

    // 已移除调试日志
    // 检查是否是疫苗接种任务
    if (!this.isVaccineTask(selectedTask)) {
      wx.showToast({
        title: '这不是疫苗接种任务',
        icon: 'none'
      })
      return
    }

    // 查询已完成的疫苗记录
    this.queryVaccineRecord(selectedTask)
  },

  /**
   * 查询疫苗记录
   */
  async queryVaccineRecord(task: Task) {
    try {
      wx.showLoading({
        title: '查询记录中...'
      })

      // 调用云函数查询疫苗记录
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_prevention_record',
          taskId: task.id || task.taskId,
          batchId: (task as any).batchId || this.getCurrentBatch()?.id,
          recordType: 'vaccine'
        }
      })

      wx.hideLoading()

      if (result.result && result.result.success && result.result.data) {
        // 显示疫苗记录详情
        this.showVaccineRecordDetail(result.result.data)
      } else {
        // 如果没有找到记录，可以让用户重新填写
        wx.showModal({
          title: '未找到接种记录',
          content: '该任务的疫苗接种记录未找到，是否重新填写接种信息？',
          confirmText: '重新填写',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              this.openVaccineForm()
            }
          }
        })
      }

    } catch (error: any) {
      wx.hideLoading()
      // 已移除调试日志
      // 查询失败，提供重新填写选项
      wx.showModal({
        title: '查询失败',
        content: '无法查询到接种记录，是否重新填写接种信息？',
        confirmText: '重新填写',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.openVaccineForm()
          }
        }
      })
    }
  },

  /**
   * 显示疫苗记录详情
   */
  showVaccineRecordDetail(record: any) {
    const recordInfo = `疫苗名称：${record.vaccine?.name || '未知'}
生产厂家：${record.vaccine?.manufacturer || '未填写'}
接种数量：${record.vaccination?.count || 0}只
接种方式：${this.getRouteLabel(record.vaccine?.route)}
执行兽医：${record.veterinarian?.name || '未填写'}
接种费用：¥${record.cost?.total || 0}
${record.vaccination?.notes ? `备注：${record.vaccination.notes}` : ''}`

    wx.showModal({
      title: '疫苗接种记录',
      content: recordInfo,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /**
   * 获取接种方式标签
   */
  getRouteLabel(route: string): string {
    const routeMap: Record<string, string> = {
      'subcutaneous': '皮下注射',
      'intramuscular': '肌肉注射',
      'intravenous': '静脉注射',
      'oral': '口服',
      'nasal': '滴鼻',
      'spray': '喷雾'
    }
    return routeMap[route] || route || '未知'
  },

  /**
   * 根据任务ID打开疫苗表单
   */
  async openVaccineFormWithTaskId(taskId: string) {
    try {
      // 已移除调试日志
      // 先确保数据已加载
      if (this.data.todayTasksByBatch.length === 0) {
        await this.loadAllBatchTasks()
      }
      
      // 查找对应的任务
      let targetTask = null
      for (const batchGroup of this.data.todayTasksByBatch) {
        for (const task of batchGroup.tasks) {
          if (task.id === taskId || task.taskId === taskId) {
            targetTask = task
            break
          }
        }
        if (targetTask) break
      }
      
      if (targetTask) {
        // 已移除调试日志
        // 检查是否是疫苗任务
        if (this.isVaccineTask(targetTask)) {
          // 设置选中的任务并打开疫苗表单
          this.setData({
            selectedTask: targetTask,
            currentVaccineTask: targetTask
          })
          
          // 初始化表单数据
          this.initVaccineFormData(targetTask)
          
    // 打开疫苗表单
    this.setData({
      showVaccineFormPopup: true
    }, () => {
      // 打开表单后重新计算总费用
      this.calculateTotalCost()
    })
          
          wx.showToast({
            title: '疫苗接种表单已打开',
            icon: 'success'
          })
        } else {
          wx.showToast({
            title: '该任务不是疫苗接种任务',
            icon: 'none'
          })
        }
      } else {
        // 已移除调试日志
        wx.showToast({
          title: '未找到对应的任务',
          icon: 'none'
        })
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '打开表单失败',
        icon: 'none'
      })
    }
  }
})
