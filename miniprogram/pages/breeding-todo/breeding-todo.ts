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
    showTaskDetailPopup: false
  },

  onLoad() {
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
      console.error('❌ 检查首页同步状态失败:', error)
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
      
      console.log('🚀 步骤2: 并行加载所有批次任务数据')
      // 加载所有批次的任务数据
      await Promise.all([
        this.loadAllBatchTasks(), // "进行中" - 所有批次今日任务
        this.loadAllUpcomingTasks(), // "即将到来" - 所有批次未来任务
        this.loadAllHistoryTasks() // "已完成" - 所有批次历史任务
      ])
      console.log('✅ 页面初始化完成')
    } catch (error) {
      console.error('❌ 初始化页面失败:', error)
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
      console.error('刷新数据失败:', error)
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 加载批次列表
   */
  async loadBatchList() {
    try {
      console.log('🔍 开始加载批次列表...')
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
      console.error('❌ 加载批次列表失败:', error)
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
      
      console.log('✅ 日龄计算逻辑验证:', {
        入栏日期: entryDate.split('T')[0],
        计算日龄: localResult,
        逻辑规则: expectedLogic,
        计算公式: 'Math.floor((今日-入栏日)/毫秒) + 1'
      })
      
      return { localResult, expectedLogic }
    } catch (error) {
      console.error('❌ 日龄计算验证失败:', error)
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
        console.log(`📋 批次 ${batch.batchNumber} 状态: "${batch.status}"`)
        
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
      console.error('加载所有批次任务失败:', error)
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
      console.error('加载今日任务失败:', error)
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
      console.error('加载即将到来的任务失败:', error)
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
      console.error('加载历史任务失败:', error)
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
      console.error('获取已完成任务失败:', error)
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
      console.error('更新任务状态失败:', error)
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
    const task = event.currentTarget.dataset.task
    
    // 预处理任务数据，添加显示用的字段
    const enhancedTask = {
      ...task,
      
      // 确保ID字段存在（支持多种ID字段名）
      id: task.id || task.taskId || (task as any)._id || '',
      
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
      console.error('任务ID缺失，任务数据:', selectedTask)
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
      console.error('保存任务完成状态失败:', error)
    }
  },

  /**
   * 从本地存储获取任务完成状态
   */
  getLocalTaskCompletions(): Record<string, any> {
    try {
      return wx.getStorageSync('completed_tasks') || {}
    } catch (error) {
      console.error('获取本地任务完成状态失败:', error)
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
      console.error('❌ 通知首页失败:', error)
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
      console.error('标记全局状态失败:', error)
    }
  },

  /**
   * 更新本地任务状态
   */
  updateLocalTaskStatus(taskId: string, completed: boolean) {
    
    if (!taskId) {
      console.error('任务ID为空，无法更新状态')
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
      console.error('加载所有批次即将到来任务失败:', error)
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
      console.error('加载所有批次历史任务失败:', error)
    }
  }
})
