// 任务详情页面
Page({
  data: {
    taskData: {} as unknown,
    dayAge: 1,
    priorityTheme: 'default',
    priorityText: '中',
    relatedTasks: [] as unknown[]
  },
  
  onLoad(options: unknown) {
    if (options.task) {
      try {
        const task = JSON.parse(decodeURIComponent(options.task))
        const dayAge = parseInt(options.dayAge) || 1
        
        this.setData({
          taskData: task,
          dayAge: dayAge,
          priorityTheme: this.getPriorityTheme(task.priority),
          priorityText: this.getPriorityText(task.priority)
        })
        
        // 加载同日其他任务
        this.loadRelatedTasks(dayAge, task.id)
        
      } catch (error) {
        console.error('解析任务数据失败:', error)
        wx.showToast({
          title: '任务数据错误',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } else {
      wx.showToast({
        title: '缺少任务数据',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },
  
  // 获取优先级主题
  getPriorityTheme(priority: string): string {
    switch (priority) {
      case 'high':
        return 'danger'
      case 'low':
        return 'default'
      default:
        return 'warning'
    }
  },
  
  // 获取优先级文本
  getPriorityText(priority: string): string {
    switch (priority) {
      case 'high':
        return '高优先级'
      case 'low':
        return '低优先级'
      default:
        return '中优先级'
    }
  },
  
  // 加载同日其他任务
  async loadRelatedTasks(dayAge: number, currentTaskId: string) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'lifecycle-management',
        data: {
          action: 'get_tasks_by_day',
          dayAge: dayAge
        }
      })
      
      if (result.result?.success && result.result.data) {
        // 过滤掉当前任务
        const relatedTasks = result.result.data.filter((task: unknown) => task.id !== currentTaskId)
        this.setData({ relatedTasks })
      }
    } catch (error) {
      console.error('加载相关任务失败:', error)
    }
  },
  
  // 切换任务
  switchTask(e: CustomEvent) {
    const task = e.currentTarget.dataset.task
    if (!task) return
    
    this.setData({
      taskData: task,
      priorityTheme: this.getPriorityTheme(task.priority),
      priorityText: this.getPriorityText(task.priority)
    })
    
    // 滚动到顶部
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    })
  },
  
  // 编辑任务
  editTask() {
    const task = this.data.taskData
    const dayAge = this.data.dayAge
    
    wx.navigateTo({
      url: `/packageUser/lifecycle-task-edit/lifecycle-task-edit?dayAge=${dayAge}&taskId=${task.id}`
    })
  },
  
  // 返回
  goBack() {
    wx.navigateBack()
  }
})
