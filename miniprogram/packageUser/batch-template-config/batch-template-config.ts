// 批次模板配置页面

Page({
  data: {
    // 批次列表
    batchList: [] as unknown[],
    
    // 可用模板列表
    templates: [] as unknown[],
    
    // 模板任务映射
    templateTasks: {} as unknown,
    
    // 是否加载中
    loading: false,
    
    // 导航栏高度
    statusBarHeight: 44,
    navBarHeight: 44
  },

  onLoad() {
    this.setNavigationBarHeight()
    this.initializeData()
  },
  
  // 设置导航栏高度
  setNavigationBarHeight() {
    try {
      // @ts-ignore
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {}
      const statusBarHeight = windowInfo.statusBarHeight || 44
      const navBarHeight = 44  // 导航栏固定高度
      
      this.setData({
        statusBarHeight,
        navBarHeight
      })
    } catch (error) {
      this.setData({
        statusBarHeight: 44,
        navBarHeight: 44
      })
    }
  },

  // 初始化数据
  async initializeData() {
    this.setData({ loading: true })
    
    // 先加载模板，再加载批次列表（因为批次列表依赖模板数据）
    await this.loadTemplates()
    await this.loadBatchList()
    
    this.setData({ loading: false })
  },

  // 加载模板列表
  async loadTemplates() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'lifecycle-management',
        data: {
          action: 'get_all_templates'
        }
      })
      
      let templates = []
      let templateTasks: any = {}
      
      if (result.result?.success && result.result.data?.length > 0) {
        templates = result.result.data
        // 构建模板任务映射
        templates.forEach((template: unknown) => {
          // 默认模板使用'default'作为ID，其他使用_id
          const templateId = template.isDefault ? 'default' : template._id
          // 确保任务是数组格式
          const tasks = template.tasks || []
          templateTasks[templateId] = Array.isArray(tasks) ? tasks : []
        })
      }
      
      // 如果没有模板，添加默认模板
      if (templates.length === 0) {
        templates = [
          { _id: 'default', templateName: '默认模板', isDefault: true, tasks: [] }
        ]
        templateTasks['default'] = []
      }
      
      // 保存模板列表
      const templateList = templates.map((t: unknown) => ({
        id: t.isDefault ? 'default' : t._id,
        name: t.templateName || t.name || '未命名模板'
      }))
      
      // 先设置模板列表和初始任务
      this.setData({ 
        templates: templateList,
        templateTasks 
      })
      
      // 获取默认模板的任务（从云函数）
      await this.loadDefaultTemplateTasks()
      
      // 更新任务数据（loadDefaultTemplateTasks会直接修改this.data.templateTasks）
      this.setData({
        templateTasks: this.data.templateTasks
      })
    } catch (error) {
      
      // 加载失败时使用默认模板
      this.setData({
        templates: [
          { id: 'default', name: '默认模板' }
        ],
        templateTasks: { default: [] }
      })
    }
  },
  
  // 加载默认模板任务
  async loadDefaultTemplateTasks() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'lifecycle-management',
        data: {
          action: 'get_template_tasks',
          templateId: 'default',
          templateName: '默认模板'
        }
      })
      
      if (result.result?.success && result.result.data) {
        // 云函数返回的是按日龄分组的对象，需要转换为任务数组
        const tasksByDayAge = result.result.data
        const tasks: unknown[] = []
        
        // 将按日龄分组的任务转换为平面数组
        Object.keys(tasksByDayAge).forEach(dayAge => {
          const dayTasks = tasksByDayAge[dayAge] || []
          dayTasks.forEach((task: unknown) => {
            tasks.push({
              ...task,
              dayAge: parseInt(dayAge)
            })
          })
        })
        
        // 更新默认模板的任务
        this.data.templateTasks['default'] = tasks
      }
    } catch (error) {
      // 失败时也要设置空数组
      this.data.templateTasks['default'] = []
    }
  },

  // 加载批次列表
  async loadBatchList() {
    try {
      // 从数据库获取所有批次（不限制状态）
      const db = wx.cloud.database()
      // 先尝试获取所有批次，看看数据结构
      const { data: batches } = await db.collection('prod_batch_entries')
        .orderBy('entryDate', 'desc')
        .limit(20)  // 限制数量避免数据过多
        .get()
      
      // 计算每个批次的当前日龄和今日任务
      const batchList = batches.map((batch: unknown) => {
        const currentDayAge = this.calculateDayAge(batch.entryDate)
        
        // 如果批次没有模板，默认使用'default'（默认模板）
        let templateId = batch.templateId || 'default'
        let templateName = batch.templateName || ''
        
        // 查找对应的模板
        const template = this.data.templates.find((t: unknown) => t.id === templateId)
        if (template) {
          templateName = template.name
        } else if (this.data.templates.length > 0) {
          // 如果没找到对应模板，使用第一个模板（通常是默认模板）
          const firstTemplate = this.data.templates[0]
          templateId = firstTemplate.id
          templateName = firstTemplate.name
        }
        
        const templateIndex = Math.max(0, this.data.templates.findIndex((t: unknown) => t.id === templateId))
        const todayTasks = this.getTasksForDayAge(templateId, currentDayAge)
        
        // 格式化日期
        const entryDate = batch.entryDate instanceof Date 
          ? this.formatDate(batch.entryDate)
          : batch.entryDate
        
        // 构建批次名称
        const batchName = batch.batchName || 
                         (batch.batchNumber ? `批次${batch.batchNumber}` : `批次${batch.batchId || batch._id}`)
        
        return {
          id: batch._id,
          batchName,
          entryDate,
          entryCount: batch.quantity || 0,
          currentCount: batch.currentQuantity || batch.quantity || 0,
          templateId,
          templateName,
          currentDayAge,
          templateIndex: templateIndex >= 0 ? templateIndex : 0,  // 默认选中第一个
          todayTasks
        }
      })
      
      this.setData({ batchList })
      
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 计算日龄
  calculateDayAge(entryDate: string | Date): number {
    const entry = new Date(entryDate)
    const today = new Date()
    const diffTime = today.getTime() - entry.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1  // 入栏当天算第1日龄
    return Math.max(1, diffDays)  // 确保至少是第1日龄
  },
  
  // 格式化日期
  formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 获取指定日龄的任务
  getTasksForDayAge(templateId: string | null, dayAge: number): unknown[] {
    if (!templateId) {
      return []
    }
    
    const allTasks = this.data.templateTasks[templateId]
    
    // 确保 allTasks 是数组
    if (!Array.isArray(allTasks)) {
      return []
    }
    
    // 如果没有任务数据，返回空数组
    if (allTasks.length === 0) {
      return []
    }
    
    // 筛选出当前日龄的任务
    const tasks = allTasks.filter((task: unknown) => task.dayAge === dayAge)
    
    // 限制返回的任务数量，避免渲染过多
    return tasks.slice(0, 5)
  },

  // 模板选择变更
  onTemplateChange(e: CustomEvent) {
    const { batchIndex } = e.currentTarget.dataset
    const templateIndex = parseInt(e.detail.value)
    const selectedTemplate = this.data.templates[templateIndex]
    
    if (!selectedTemplate) {
      return
    }
    
    // 使用索引更新批次的模板配置
    const batchList = [...this.data.batchList]
    const batch = batchList[batchIndex]
    
    if (batch) {
      const todayTasks = this.getTasksForDayAge(selectedTemplate.id, batch.currentDayAge)
      batchList[batchIndex] = {
        ...batch,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        templateIndex,
        todayTasks
      }
      
      this.setData({ batchList })
      
      // 显示选择成功提示
      wx.showToast({
        title: '已选择模板',
        icon: 'success',
        duration: 1500
      })
    }
  },

  // 保存配置
  async saveConfig() {
    try {
      wx.showLoading({ title: '保存中...' })
      
      // 收集配置信息
      const updates = this.data.batchList.map((batch: unknown) => ({
        batchId: batch.id,
        templateId: batch.templateId,
        templateName: batch.templateName
      }))
      
      // 调用云函数批量更新批次模板
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'update_batch_templates',
          updates
        }
      })
      
      wx.hideLoading()
      
      if (result.result?.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        
        // 延迟返回
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: result.result?.error || '保存失败',
          icon: 'none'
        })
      }
      
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },
  
  // 跳转到入栏管理
  goToProduction() {
    // 跳转到生产管理的入栏管理页面
    wx.switchTab({
      url: '/pages/production/production'
    })
  }
})
