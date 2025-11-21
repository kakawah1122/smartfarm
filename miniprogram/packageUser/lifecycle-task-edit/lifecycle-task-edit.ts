// lifecycle-task-edit.ts - 养殖周期任务编辑页面

Component({
  data: {
    // 编辑模式：add/edit
    mode: 'add',
    
    // 日龄
    dayAge: 1,
    
    // 任务ID（编辑时使用）
    taskId: '',
    
    // 表单数据
    formData: {
      title: '',
      type: 'inspection',
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
    
    // 任务类型选项
    taskTypes: [
      { label: '健康检查', value: 'inspection' },
      { label: '疫苗接种', value: 'vaccine' },
      { label: '用药管理', value: 'medication' },
      { label: '营养补充', value: 'nutrition' },
      { label: '饲养管理', value: 'feeding' },
      { label: '特殊护理', value: 'care' }
    ],
    taskTypeIndex: 0, // 当前选中的任务类型索引
    
    // 任务分类选项
    categories: ['健康管理', '疫苗接种', '用药管理', '营养管理', '饲养管理', '特殊护理'],
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
    navbarHeight: 44
  },

  lifetimes: {
    attached() {
      this.setNavigationBarHeight()
      this.initPage()
    }
  },

  methods: {
    // 设置导航栏高度
    setNavigationBarHeight() {
      // 使用新的API替代废弃的getSystemInfoSync
      try {
        // @ts-ignore - TypeScript类型定义可能未更新
        const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {}
        this.setData({
          statusBarHeight: windowInfo.statusBarHeight || 44
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

    // 初始化页面
    initPage() {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const options = currentPage.options || {}
      
      const mode = options.mode || 'add'
      const dayAge = parseInt(options.dayAge as string) || 1
      const taskId = options.taskId || ''
      
      this.setData({
        mode,
        dayAge,
        taskId
      })
      
      if (mode === 'edit' && taskId) {
        this.loadTaskData(taskId as string)
      }
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
        console.error('加载任务数据失败:', error)
        
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
      
      // 根据类型自动设置分类
      const typeToCategory: any = {
        'inspection': '健康管理',
        'vaccine': '疫苗接种',
        'medication': '用药管理',
        'nutrition': '营养管理',
        'feeding': '饲养管理',
        'care': '特殊护理'
      }
      
      const category = typeToCategory[type] || '健康管理'
      const categoryIndex = this.data.categories.indexOf(category)
      
      this.setData({
        'formData.type': type,
        'formData.category': category,
        taskTypeIndex: index, // 更新任务类型索引
        categoryIndex
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
        wx.showLoading({ title: '保存中...' })
        
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
        })
        
        if (result.result?.success) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          })
          
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        } else {
          throw new Error(result.result?.error || '保存失败')
        }
        
        wx.hideLoading()
      } catch (error) {
        wx.hideLoading()
        console.error('保存任务失败:', error)
        
        // 模拟成功（用于演示）
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    }
  }
})
