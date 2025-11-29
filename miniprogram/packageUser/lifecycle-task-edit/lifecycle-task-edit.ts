// @ts-nocheck
// lifecycle-task-edit.ts - 养殖周期任务编辑页面
// 数据源：云数据库 task_templates 集合

import { logger } from '../../utils/logger'

Component({
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
    // 编辑模式：add/edit
    mode: 'add',
    
    // 日龄
    dayAge: 1,
    
    // 任务ID（编辑时使用）
    taskId: '',
    
    // 表单数据 - 默认值与任务类型选项保持一致
    formData: {
      title: '',
      type: 'inspection',  // 对应 '健康管理'
      category: '健康管理',
      priority: 'medium',
      description: '',
      dosage: '',
      duration: 1,
      dayInSeries: 1,
      estimatedTime: 0,
      materials: '',
      notes: ''
    },
    
    // 任务类型选项 - 与 breeding-schedule.ts 保持一致
    taskTypes: [
      { label: '健康管理', value: 'inspection' },
      { label: '疫苗管理', value: 'vaccine' },
      { label: '用药管理', value: 'medication' },
      { label: '营养管理', value: 'nutrition' },
      { label: '饲养管理', value: 'feeding' },
      { label: '保健管理', value: 'care' },
      { label: '环境管理', value: 'environment' },
      { label: '观察记录', value: 'observation' }
    ],
    taskTypeIndex: 0, // 当前选中的任务类型索引
    
    // 任务分类选项 - 与任务类型对应
    categories: ['健康管理', '疫苗管理', '用药管理', '营养管理', '饲养管理', '保健管理', '环境管理', '观察记录'],
    categoryIndex: 0,
    
    // 优先级选项
    priorities: [
      { label: '高优先级', value: 'high' },
      { label: '中优先级', value: 'medium' },
      { label: '低优先级', value: 'low' }
    ],
    priorityIndex: 1,
    
    // 导航栏高度
    statusBarHeight: 0,
    navbarHeight: 44,
    
    // 模板任务列表
    templateTasks: [] as Array<{
      id: string
      type: string
      title: string
      description: string
      category: string
      priority: string
      dosage?: string
      duration?: number
      dayInSeries?: number
    }>,
    selectedTemplateIndex: -1  // 当前选中的模板任务索引
  },

  lifetimes: {
    attached() {
      this.setNavigationBarHeight()
    },
    detached() {
      this._clearAllTimers()
    }
  },

  methods: {
    // 页面加载时接收参数（Component 构造器的页面使用 onLoad）
    onLoad(options: { mode?: string; dayAge?: string; taskId?: string }) {
      const mode = options.mode || 'add'
      const dayAge = parseInt(options.dayAge || '1') || 1
      const taskId = options.taskId || ''
      
      this.setData({ mode, dayAge, taskId })
      this.loadTasksFromCloud(dayAge, taskId, mode)
    },
    
    // 设置导航栏高度
    setNavigationBarHeight() {
      // 使用新的API替代废弃的getSystemInfoSync
      try {
        const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : { statusBarHeight: 44 }
        this.setData({
          statusBarHeight: (windowInfo as { statusBarHeight?: number }).statusBarHeight || 44
        })
      } catch (error) {
        // 如果新API不可用，设置默认值
        this.setData({
          statusBarHeight: 44
        })
      }
    },

    // 返回上一页
    goBack() {
      wx.navigateBack()
    },
    
    // 从云数据库加载任务
    async loadTasksFromCloud(dayAge: number, taskId: string, mode: string) {
      try {
        wx.showLoading({ title: '加载中...' })
        
        // 从云函数获取任务模板
        const result = await wx.cloud.callFunction({
          name: 'lifecycle-management',
          data: {
            action: 'get_schedule_template',
            templateName: '默认模板'
          }
        }) as { result?: { success?: boolean; data?: unknown[] } }
        
        wx.hideLoading()
        
        let allTasks: unknown[] = []
        if (result.result?.success && result.result.data) {
          allTasks = result.result.data
        }
        
        // 筛选该日龄的任务
        const templateTasks = allTasks.filter((t: { dayAge?: number }) => t.dayAge === dayAge)
        
        if (mode === 'edit' && taskId) {
          // 编辑模式：查找对应任务
          const taskIndex = templateTasks.findIndex((t: { id: string }) => t.id === taskId)
          if (taskIndex >= 0) {
            const template = templateTasks[taskIndex] as any
            this.fillFormWithTask(template, templateTasks, taskIndex)
          } else {
            // 未找到时使用第一个任务
            if (templateTasks.length > 0) {
              this.fillFormWithTask(templateTasks[0] as any, templateTasks, 0)
            } else {
              this.setData({ templateTasks, selectedTemplateIndex: -1 })
            }
          }
        } else if (mode === 'add' && templateTasks.length > 0) {
          // 添加模式：自动填充第一个任务
          const template = templateTasks[0] as any
          this.fillFormWithTask(template, templateTasks, 0)
        } else {
          this.setData({ templateTasks, selectedTemplateIndex: -1 })
        }
      } catch (error) {
        wx.hideLoading()
        logger.error('加载任务失败:', error)
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    },
    
    // 用任务数据填充表单
    fillFormWithTask(template: any, templateTasks: unknown[], taskIndex: number) {
      const taskTypeIndex = this.data.taskTypes.findIndex((t: { value: string }) => t.value === template.type)
      const categoryIndex = this.data.categories.indexOf(template.category)
      const priorityIndex = this.data.priorities.findIndex((p: { value: string }) => p.value === template.priority)
      
      this.setData({
        templateTasks,
        selectedTemplateIndex: taskIndex,
        formData: {
          title: template.title || '',
          type: template.type || 'inspection',
          category: template.category || '健康管理',
          priority: template.priority || 'medium',
          description: template.description || '',
          dosage: template.dosage || '',
          duration: template.duration || 1,
          dayInSeries: template.dayInSeries || 1,
          estimatedTime: template.estimatedTime || 0,
          materials: template.materials || '',
          notes: template.notes || ''
        },
        taskTypeIndex: taskTypeIndex >= 0 ? taskTypeIndex : 0,
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
        priorityIndex: priorityIndex >= 0 ? priorityIndex : 1
      })
    },
    
    // 选择任务卡片
    onTaskSelect(e: { currentTarget: { dataset: { index: number } } }) {
      const index = e.currentTarget.dataset.index
      if (index < 0 || index >= this.data.templateTasks.length) {
        return
      }
      
      const template = this.data.templateTasks[index]
      const taskTypeIndex = this.data.taskTypes.findIndex((t: { value: string }) => t.value === template.type)
      const categoryIndex = this.data.categories.indexOf(template.category)
      const priorityIndex = this.data.priorities.findIndex((p: { value: string }) => p.value === template.priority)
      
      // 选中任务并填充表单
      this.setData({
        selectedTemplateIndex: index,
        formData: {
          title: template.title || '',
          type: template.type || 'inspection',
          category: template.category || '健康管理',
          priority: template.priority || 'medium',
          description: template.description || '',
          dosage: template.dosage || '',
          duration: template.duration || 1,
          dayInSeries: template.dayInSeries || 1,
          estimatedTime: template.estimatedTime || 0,
          materials: template.materials || '',
          notes: template.notes || ''
        },
        taskTypeIndex: taskTypeIndex >= 0 ? taskTypeIndex : 0,
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
        priorityIndex: priorityIndex >= 0 ? priorityIndex : 1
      })
    },

    // 加载任务数据
    async loadTaskData(taskId: string) {
      try {
        wx.showLoading({ title: '加载中...' })
        
        const result = await wx.cloud.callFunction({
          name: 'lifecycle-management',
          data: {
            action: 'get_task',
            taskId
          }
        })
        
        if (result.result?.success) {
          const task = result.result.data
          
          // 设置各种索引
          const taskType = task.type || 'inspection'
          const taskTypeIndex = this.data.taskTypes.findIndex((t: unknown) => t.value === taskType)
          const categoryIndex = this.data.categories.indexOf(task.category)
          const priorityIndex = this.data.priorities.findIndex((p: unknown) => p.value === task.priority)
          
          this.setData({
            formData: {
              title: task.title || '',
              type: taskType,
              category: task.category || '健康管理',
              priority: task.priority || 'medium',
              description: task.description || '',
              dosage: task.dosage || '',
              duration: task.duration || 1,
              dayInSeries: task.dayInSeries || 1,
              estimatedTime: task.estimatedTime || 0,
              materials: task.materials || '',
              notes: task.notes || ''
            },
            taskTypeIndex: taskTypeIndex >= 0 ? taskTypeIndex : 0,
            categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
            priorityIndex: priorityIndex >= 0 ? priorityIndex : 1
          })
        }
        
        wx.hideLoading()
      } catch (error) {
        wx.hideLoading()
        logger.error('加载任务数据失败:', error)
        
        // 使用默认数据
        this.loadDefaultTaskData()
      }
    },

    // 加载默认任务数据（用于演示）
    loadDefaultTaskData() {
      // 模拟数据
      const defaultTask = {
        title: '开口药第3天',
        type: 'medication',
        category: '用药管理',
        priority: 'high',
        description: '预防雏鹅肠炎',
        dosage: '按说明书使用',
        duration: 4,
        dayInSeries: 3,
        estimatedTime: 0,
        materials: '',
        notes: ''
      }
      
      const taskTypeIndex = this.data.taskTypes.findIndex((t: unknown) => t.value === defaultTask.type)
      const categoryIndex = this.data.categories.indexOf(defaultTask.category)
      const priorityIndex = this.data.priorities.findIndex((p: unknown) => p.value === defaultTask.priority)
      
      this.setData({
        formData: defaultTask,
        taskTypeIndex: taskTypeIndex >= 0 ? taskTypeIndex : 0,
        categoryIndex,
        priorityIndex
      })
    },

    // 输入任务标题
    onTitleInput(e: CustomEvent) {
      this.setData({
        'formData.title': e.detail.value
      })
    },

    // 选择任务类型
    onTypeChange(e: CustomEvent) {
      const index = parseInt(e.detail.value)
      const type = this.data.taskTypes[index].value
      const label = this.data.taskTypes[index].label
      
      // 类型和分类保持一致（label 即为分类名称）
      const category = label
      const categoryIndex = this.data.categories.indexOf(category)
      
      this.setData({
        'formData.type': type,
        'formData.category': category,
        taskTypeIndex: index,
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 0
      })
    },

    // 选择分类
    onCategoryChange(e: CustomEvent) {
      const index = parseInt(e.detail.value)
      this.setData({
        'formData.category': this.data.categories[index],
        categoryIndex: index
      })
    },

    // 选择优先级
    onPriorityChange(e: CustomEvent) {
      const index = parseInt(e.detail.value)
      this.setData({
        'formData.priority': this.data.priorities[index].value,
        priorityIndex: index
      })
    },

    // 输入描述
    onDescriptionInput(e: CustomEvent) {
      this.setData({
        'formData.description': e.detail.value
      })
    },

    // 输入用量
    onDosageInput(e: CustomEvent) {
      this.setData({
        'formData.dosage': e.detail.value
      })
    },

    // 输入持续天数
    onDurationInput(e: CustomEvent) {
      this.setData({
        'formData.duration': parseInt(e.detail.value) || 1
      })
    },

    // 输入系列中的第几天
    onDayInSeriesInput(e: CustomEvent) {
      this.setData({
        'formData.dayInSeries': parseInt(e.detail.value) || 1
      })
    },

    // 输入预计时间
    onEstimatedTimeInput(e: CustomEvent) {
      this.setData({
        'formData.estimatedTime': parseInt(e.detail.value) || 0
      })
    },

    // 输入所需材料
    onMaterialsInput(e: CustomEvent) {
      this.setData({
        'formData.materials': e.detail.value
      })
    },

    // 输入备注
    onNotesInput(e: CustomEvent) {
      this.setData({
        'formData.notes': e.detail.value
      })
    },

    // 验证表单
    validateForm() {
      const { formData } = this.data
      
      if (!formData.title.trim()) {
        wx.showToast({
          title: '请输入任务标题',
          icon: 'none'
        })
        return false
      }
      
      if (!formData.description.trim()) {
        wx.showToast({
          title: '请输入任务描述',
          icon: 'none'
        })
        return false
      }
      
      return true
    },

    // 保存任务
    async saveTask() {
      if (!this.validateForm()) {
        return
      }
      
      try {
        wx.showLoading({ title: '保存中...', mask: true })
        
        const { mode, dayAge, taskId, formData } = this.data
        
        const action = mode === 'add' ? 'add_task' : 'update_task'
        
        const result = await wx.cloud.callFunction({
          name: 'lifecycle-management',
          data: {
            action,
            dayAge,
            taskId,
            taskData: formData
          }
        }) as { result?: { success?: boolean; error?: string } }
        
        wx.hideLoading()
        
        if (result.result?.success) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          })
          
          this._safeSetTimeout(() => {
            wx.navigateBack()
          }, 1500)
        } else {
          throw new Error(result.result?.error || '保存失败')
        }
      } catch (error) {
        wx.hideLoading()
        logger.error('[lifecycle-task-edit] 保存任务失败:', error)
        
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        })
      }
    }
  }
})
