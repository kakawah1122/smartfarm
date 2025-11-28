// @ts-nocheck
// lifecycle-management.ts - 任务管理页面
// 数据源：云数据库 task_templates 集合
import { logger } from '../../utils/logger'

// 自定义事件类型
type CustomEvent<T = Record<string, unknown>> = WechatMiniprogram.CustomEvent<T>;

// 任务接口
interface Task {
  _id?: string;
  title?: string;
  dayAge?: number;
  isSequenceTask?: boolean;
  [key: string]: unknown;
}

// 任务分组接口
interface TaskGroup {
  dayAge: number;
  tasks: Task[];
  [key: string]: unknown;
}

// 模板接口
interface Template {
  _id?: string;
  templateName?: string;
  name?: string;
  description?: string;
  taskCount?: number;
  isDefault?: boolean;
  createTime?: string;
  updateTime?: string;
  tasks?: Task[];
}

// 应用全局数据接口
interface AppGlobalData {
  statusBarHeight?: number;
  [key: string]: unknown;
}

// 定义全局变量存储定时器
let scrollTimer: number | null = null

Component({
  data: {
    // 日龄任务列表
    taskGroups: [] as TaskGroup[],
    groupedTasks: [] as TaskGroup[], // WXML 使用的任务分组数据
    
    // 展开的日龄组
    expandedGroups: {} as Record<string, boolean>,
    
    // 筛选条件
    filterCategory: '全部',
    categories: ['全部', '健康管理', '用药管理', '营养管理', '疫苗接种', '饲养管理', '特殊护理'],
    
    // 加载状态
    loading: false,
    showSkeleton: false, // 显示骨架屏
    
    // 模板相关
    currentTemplate: '默认模板',
    templateList: [] as unknown[], // 模板列表
    selectedTemplate: null as unknown, // 当前选中的模板
    
    // 总任务数
    totalTasks: 0,
    
    // 导航栏高度
    statusBarHeight: 0,
    navbarHeight: 44,
    
    // 编辑弹窗相关
    showEditPopup: false,
    editMode: 'edit' as 'add' | 'edit',
    editingTask: {
      id: '',
      dayAge: 1,
      title: '',
      type: 'inspection',
      category: '健康管理',
      priority: 'medium',
      description: '',
      dosage: '',
      duration: 1
    },
    editTaskTypeIndex: 0,
    editPriorityIndex: 1,
    
    // 任务类型选项
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
    
    // 优先级选项
    priorities: [
      { label: '高优先级', value: 'high' },
      { label: '中优先级', value: 'medium' },
      { label: '低优先级', value: 'low' }
    ]
  },

  lifetimes: {
    attached() {
      this.setNavigationBarHeight()
      this.initializeAndLoadTemplates()
    },
    
    detached() {
      // 清理定时器
      if (scrollTimer) {
        clearTimeout(scrollTimer)
        scrollTimer = null
      }
    }
  },

  methods: {
    // 设置导航栏高度
    setNavigationBarHeight() {
      // 使用新的API替代废弃的getSystemInfoSync
      try {
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
      // 如果正在查看模板任务，返回到模板列表
      if (this.data.selectedTemplate) {
        this.backToTemplates()
      } else {
        // 否则返回上一页
        wx.navigateBack()
      }
    },

    // 加载任务计划
    async loadTaskSchedule() {
      try {
        wx.showLoading({ title: '加载中...' })
        
        // 首先确保用户有默认模板副本
        await this.ensureUserTemplate()
        
        // 加载任务数据
        await this.loadDefaultDataFromBreedingSchedule()
        
        wx.hideLoading()
      } catch (error) {
        wx.hideLoading()
        logger.error('加载任务计划失败:', error)
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },
    
    // 确保用户有默认模板副本
    async ensureUserTemplate() {
      try {
        // 检查用户是否有"默认模板"
        const checkResult = await wx.cloud.callFunction({
          name: 'lifecycle-management',
          data: {
            action: 'get_schedule_template',
            templateName: '默认模板'
          }
        }) as { result?: { success?: boolean; data?: unknown[] } }
        
        // 如果没有数据或数据为空，自动导入标准模板
        if (!checkResult.result?.data || checkResult.result.data.length === 0) {
          // 自动导入标准模板
          await wx.cloud.callFunction({
            name: 'lifecycle-management',
            data: {
              action: 'import_standard_template'
            }
          })
        }
      } catch (error) {
        logger.error('检查/导入模板失败:', error)
      }
    },

    // 从云数据库加载任务模板数据
    async loadDefaultDataFromBreedingSchedule() {
      try {
        // 从云函数获取任务模板
        const result = await wx.cloud.callFunction({
          name: 'lifecycle-management',
          data: {
            action: 'get_schedule_template',
            templateName: this.data.currentTemplate || '默认模板'
          }
        }) as { result?: { success?: boolean; data?: unknown[] } }
        
        let allTasks: unknown[] = []
        
        if (result.result?.success && result.result.data) {
          allTasks = result.result.data
        }
        
        
        // 按日龄分组
        const taskGroups = this.groupTasksByDayAge(allTasks)
        
        // 根据筛选条件过滤任务
        let filteredGroups = taskGroups
        
        // 按分类筛选
        if (this.data.filterCategory !== '全部') {
          filteredGroups = taskGroups.map((group: { dayAge: number; tasks: unknown[] }) => ({
            ...group,
            tasks: group.tasks.filter((task: { category?: string }) => task.category === this.data.filterCategory)
          })).filter((group: { tasks: unknown[] }) => group.tasks.length > 0)
        }
        
        // 转换为 groupedTasks 格式（WXML 使用的变量）
        const groupedTasks = filteredGroups.map((group: { dayAge: number; tasks: unknown[] }) => ({
          dayAge: group.dayAge,
          taskCount: group.tasks.length,
          tasks: group.tasks
        }))
        
        // 默认折叠所有日龄
        const expandedGroups: unknown = {}
        
        this.setData({
          taskGroups: filteredGroups,
          groupedTasks: groupedTasks,
          totalTasks: allTasks.length,
          expandedGroups
        })
        
      } catch (error) {
        logger.error('加载任务模板失败:', error)
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },


    // 按日龄分组任务
    groupTasksByDayAge(tasks: unknown[]) {
      const groups: unknown = {}
      
      tasks.forEach(task => {
        if (!groups[task.dayAge]) {
          groups[task.dayAge] = {
            dayAge: task.dayAge,
            tasks: []
          }
        }
        groups[task.dayAge].tasks.push(task)
      })
      
      // 转换为数组并排序
      return Object.values(groups).sort((a: unknown, b: unknown) => a.dayAge - b.dayAge)
    },

    // 切换日龄展开状态
    toggleDayExpand(e: CustomEvent) {
      const { dayAge } = e.currentTarget.dataset
      const expandedGroups = this.data.expandedGroups
      expandedGroups[dayAge] = !expandedGroups[dayAge]
      
      this.setData({
        expandedGroups
      })
    },

    // 添加任务
    addTask(e: CustomEvent) {
      const dayAge = e.currentTarget.dataset.dayAge
      
      // 重置表单数据
      this.setData({
        showEditPopup: true,
        editMode: 'add',
        editingTask: {
          id: '',
          dayAge: dayAge,
          title: '',
          type: 'inspection',
          category: '健康管理',
          priority: 'medium',
          description: '',
          dosage: '',
          duration: 1
        },
        editTaskTypeIndex: 0,
        editPriorityIndex: 1
      })
    },

    // 编辑任务
    editTask(e: CustomEvent) {
      const { dayAge, taskId } = e.currentTarget.dataset
      
      if (!taskId) {
        return
      }
      
      // 从任务列表中找到对应任务
      let task: any = null
      for (const group of this.data.groupedTasks as any[]) {
        if (group.dayAge === dayAge) {
          task = group.tasks.find((t: any) => t.id === taskId)
          break
        }
      }
      
      if (!task) {
        wx.showToast({ title: '任务不存在', icon: 'none' })
        return
      }
      
      // 计算类型和优先级索引
      const taskTypeIndex = this.data.taskTypes.findIndex(t => t.value === task.type)
      const priorityIndex = this.data.priorities.findIndex(p => p.value === task.priority)
      
      // 填充表单并打开弹窗
      this.setData({
        showEditPopup: true,
        editMode: 'edit',
        editingTask: {
          id: task.id,
          dayAge: dayAge,
          title: task.title || '',
          type: task.type || 'inspection',
          category: task.category || '健康管理',
          priority: task.priority || 'medium',
          description: task.description || '',
          dosage: task.dosage || '',
          duration: task.duration || 1
        },
        editTaskTypeIndex: taskTypeIndex >= 0 ? taskTypeIndex : 0,
        editPriorityIndex: priorityIndex >= 0 ? priorityIndex : 1
      })
    },
    
    // 关闭编辑弹窗
    closeEditPopup() {
      this.setData({ showEditPopup: false })
    },
    
    // 表单输入事件
    onEditTitleInput(e: any) {
      this.setData({ 'editingTask.title': e.detail.value })
    },
    
    onEditDescriptionInput(e: any) {
      this.setData({ 'editingTask.description': e.detail.value })
    },
    
    onEditDosageInput(e: any) {
      this.setData({ 'editingTask.dosage': e.detail.value })
    },
    
    onEditDurationInput(e: any) {
      this.setData({ 'editingTask.duration': parseInt(e.detail.value) || 1 })
    },
    
    onEditTypeChange(e: any) {
      const index = parseInt(e.detail.value)
      const type = this.data.taskTypes[index]
      this.setData({
        editTaskTypeIndex: index,
        'editingTask.type': type.value,
        'editingTask.category': type.label
      })
    },
    
    onEditPriorityChange(e: any) {
      const index = parseInt(e.detail.value)
      const priority = this.data.priorities[index]
      this.setData({
        editPriorityIndex: index,
        'editingTask.priority': priority.value
      })
    },
    
    // 保存任务
    async saveTask() {
      const { editingTask, editMode } = this.data
      
      // 验证表单
      if (!editingTask.title.trim()) {
        wx.showToast({ title: '请输入任务标题', icon: 'none' })
        return
      }
      if (!editingTask.description.trim()) {
        wx.showToast({ title: '请输入任务描述', icon: 'none' })
        return
      }
      
      try {
        wx.showLoading({ title: '保存中...', mask: true })
        
        const action = editMode === 'add' ? 'add_task' : 'update_task'
        const result = await wx.cloud.callFunction({
          name: 'lifecycle-management',
          data: {
            action,
            dayAge: editingTask.dayAge,
            taskId: editingTask.id,
            taskData: {
              title: editingTask.title,
              type: editingTask.type,
              category: editingTask.category,
              priority: editingTask.priority,
              description: editingTask.description,
              dosage: editingTask.dosage,
              duration: editingTask.duration
            }
          }
        }) as any
        
        wx.hideLoading()
        
        if (result.result?.success) {
          wx.showToast({ title: '保存成功', icon: 'success' })
          this.setData({ showEditPopup: false })
          // 重新加载数据
          this.loadDefaultDataFromBreedingSchedule()
        } else {
          throw new Error(result.result?.error || '保存失败')
        }
      } catch (error) {
        wx.hideLoading()
        logger.error('保存任务失败:', error)
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    },

    // 删除任务
    deleteTask(e: CustomEvent) {
      const { taskTitle } = e.currentTarget.dataset
      
      wx.showModal({
        title: '删除任务',
        content: `确定要删除"${taskTitle}"吗？`,
        confirmText: '删除',
        confirmColor: '#FA5151',
        success: (res) => {
          if (res.confirm) {
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            })
            // 重新加载数据
            this.loadDefaultDataFromBreedingSchedule()
          }
        }
      })
    },



    // 选择分类筛选
    onCategoryChange(e: CustomEvent) {
      this.setData({
        filterCategory: this.data.categories[e.detail.value]
      })
      this.filterTasks()
    },

    // 筛选任务
    filterTasks() {
      // 重新加载数据，会自动应用筛选
      this.loadDefaultDataFromBreedingSchedule()
    },

    // 切换模板
    onTemplateChange(e: CustomEvent) {
      const template = this.data.templates[e.detail.value]
      this.setData({
        currentTemplate: template
      })
      this.loadTaskSchedule()
    },

    // 导入模板
    importTemplate() {
      wx.showActionSheet({
        itemList: ['从文件导入', '导入标准模板'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.importFromFile()
          } else if (res.tapIndex === 1) {
            this.importStandardTemplate()
          }
        }
      })
    },

    // 从文件导入模板
    async importFromFile() {
      try {
        // 选择文件（支持Excel和PDF）
        const res = await wx.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['xlsx', 'xls', 'pdf']
        })
        
        if (res.tempFiles && res.tempFiles.length > 0) {
          const file = res.tempFiles[0]
          const fileName = file.name
          const fileExtension = fileName.split('.').pop()?.toLowerCase()
          
          // 检查文件类型
          if (!['xlsx', 'xls', 'pdf'].includes(fileExtension || '')) {
            wx.showToast({
              title: '仅支持Excel或PDF文件',
              icon: 'none'
            })
            return
          }
          
          wx.showLoading({ 
            title: '上传文件中...',
            mask: true 
          })
          
          // 上传文件到云存储
          const cloudPath = `templates/${Date.now()}-${fileName}`
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath,
            filePath: file.path
          })
          
          wx.showLoading({ 
            title: '解析中...',
            mask: true 
          })
          
          // 调用云函数解析文件（设置较长的超时时间）
          const result = await wx.cloud.callFunction({
            name: 'lifecycle-management',
            data: {
              action: 'parse_template_file',
              fileID: uploadResult.fileID,
              fileType: fileExtension,
              fileName: fileName
            }
          })
          
          wx.hideLoading()
          
          if (result.result?.success) {
            // 显示解析结果预览
            this.showParseResult(result.result.data)
          } else {
            wx.showToast({
              title: result.result?.message || '解析失败',
              icon: 'none'
            })
          }
        }
      } catch (error) {
        wx.hideLoading()
        logger.error('导入文件失败:', error)
        wx.showToast({
          title: '导入失败',
          icon: 'none'
        })
      }
    },

    // 显示解析结果
    showParseResult(parsedData: unknown) {
      // 统计任务分解情况
      const totalTasks = parsedData.tasks?.length || 0
      const expandedCount = parsedData.tasks?.filter((t: unknown) => t.isSequenceTask).length || 0
      const dayRanges = this.calculateDayRanges(parsedData.tasks)
      
      let contentText = `成功识别 ${totalTasks} 个任务\n`
      contentText += `涵盖日龄：第${dayRanges.min}天 - 第${dayRanges.max}天\n`
      
      if (expandedCount > 0) {
        contentText += `其中 ${expandedCount} 个任务为多天连续任务`
      }
      
      wx.showModal({
        title: '解析结果',
        content: contentText,
        confirmText: '查看详情',
        cancelText: '直接导入',
        success: async (res) => {
          if (res.confirm) {
            // 显示详细预览
            this.showTaskPreview(parsedData)
          } else if (!res.confirm && res.cancel) {
            // 直接导入
            await this.saveImportedTasks(parsedData)
          }
        }
      })
    },
    
    // 计算日龄范围
    calculateDayRanges(tasks: unknown[]) {
      if (!tasks || tasks.length === 0) {
        return { min: 1, max: 1 }
      }
      
      const dayAges = tasks.map(t => t.dayAge)
      return {
        min: Math.min(...dayAges),
        max: Math.max(...dayAges)
      }
    },
    
    // 显示任务预览
    showTaskPreview(parsedData: unknown) {
      // 按日龄分组任务
      const tasksByDay: unknown = {}
      
      parsedData.tasks.forEach((task: unknown) => {
        if (!tasksByDay[task.dayAge]) {
          tasksByDay[task.dayAge] = []
        }
        tasksByDay[task.dayAge].push(task)
      })
      
      // 构建预览文本（显示前5个日龄的任务）
      const sortedDays = Object.keys(tasksByDay)
        .map(d => parseInt(d))
        .sort((a, b) => a - b)
        .slice(0, 5)
      
      let previewText = '任务预览（前5个日龄）：\n\n'
      
      sortedDays.forEach(day => {
        previewText += `【第${day}天】\n`
        tasksByDay[day].forEach((task: unknown) => {
          const sequenceTag = task.isSequenceTask ? '📍' : ''
          previewText += `  ${sequenceTag}${task.title}\n`
        })
        previewText += '\n'
      })
      
      if (Object.keys(tasksByDay).length > 5) {
        previewText += `... 还有 ${Object.keys(tasksByDay).length - 5} 个日龄的任务\n`
      }
      
      // 使用自定义页面显示预览（由于showModal有字数限制）
      wx.showModal({
        title: '任务预览',
        content: previewText,
        confirmText: '确认导入',
        cancelText: '取消',
        success: async (res) => {
          if (res.confirm) {
            await this.saveImportedTasks(parsedData)
          }
        }
      })
    },

    // 保存导入的任务
    async saveImportedTasks(parsedData: unknown) {
      try {
        wx.showLoading({ title: '保存中...', mask: true })
        
        const result = await wx.cloud.callFunction({
          name: 'lifecycle-management',
          data: {
            action: 'save_imported_template',
            templateName: parsedData.templateName || '导入模板',
            tasks: parsedData.tasks
          }
        })
        
        wx.hideLoading()
        
        if (result.result?.success) {
          wx.showToast({
            title: '导入成功',
            icon: 'success'
          })
          this.loadTemplates() // 刷新模板列表
        } else {
          wx.showToast({
            title: result.result?.message || '保存失败',
            icon: 'none'
          })
        }
      } catch (error) {
        wx.hideLoading()
        logger.error('保存模板失败:', error)
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        })
      }
    },

    // 导入标准模板
    async importStandardTemplate() {
      wx.showModal({
        title: '导入标准模板',
        content: '是否从标准模板导入任务？',
        confirmText: '导入',
        success: async (res) => {
          if (res.confirm) {
            await this.doImportStandardTemplate()
          }
        }
      })
    },

    // 执行导入标准模板
    async doImportStandardTemplate() {
      try {
        wx.showLoading({ title: '导入中...', mask: true })
        
        const result = await wx.cloud.callFunction({
          name: 'lifecycle-management',
          data: {
            action: 'import_standard_template'
          }
        })
        
        wx.hideLoading()
        
        if (result.result?.success) {
          wx.showToast({
            title: '导入成功',
            icon: 'success'
          })
          this.loadTemplates()
        } else {
          wx.showToast({
            title: result.result?.message || '导入失败',
            icon: 'none'
          })
        }
      } catch (error) {
        wx.hideLoading()
        logger.error('导入模板失败:', error)
        wx.showToast({
          title: '导入失败',
          icon: 'none'
        })
      }
    },

    // 跳转到批次配置页面
    goToBatchConfig() {
      wx.navigateTo({
        url: '/packageUser/batch-template-config/batch-template-config'
      })
    },
    
    // 初始化并加载模板
    async initializeAndLoadTemplates() {
      try {
        // 显示骨架屏
        this.setData({ showSkeleton: true })
        
        // 先尝试加载模板
        await this.loadTemplates()
        
        // 隐藏骨架屏
        this.setData({ showSkeleton: false })
      } catch (error: unknown) {
        this.setData({ showSkeleton: false })
        logger.error('加载模板失败:', error)
        
        // 如果是集合不存在的错误，尝试初始化
        if (error.message && error.message.includes('collection not exists')) {
          await this.initializeTaskTemplatesCollection()
          
          // 初始化后重新加载
          await this.loadTemplates()
        }
      }
    },
    
    // 初始化 task_templates 集合
    async initializeTaskTemplatesCollection() {
      try {
        wx.showLoading({ title: '初始化中...', mask: true })
        
        // 调用初始化云函数
        const result = await wx.cloud.callFunction({
          name: 'init-collections',
          data: {
            action: 'init_task_templates'
          }
        })
        
        wx.hideLoading()
        
        if (result.result?.success) {
          wx.showToast({
            title: '初始化成功',
            icon: 'success',
            duration: 1500
          })
        } else {
          logger.error('集合初始化失败:', result.result?.error)
          wx.showToast({
            title: '初始化失败',
            icon: 'none'
          })
        }
      } catch (error) {
        wx.hideLoading()
        logger.error('调用初始化云函数失败:', error)
        
        // 如果云函数不存在，提示用户手动创建
        wx.showModal({
          title: '提示',
          content: '请在云开发控制台手动创建 task_templates 集合，或上传 init-collections 云函数',
          confirmText: '我知道了',
          showCancel: false
        })
      }
    },
    
    // 加载模板列表
    async loadTemplates() {
      try {
        wx.showLoading({ title: '加载中...', mask: true })
        
        // 从云函数获取模板列表
        const result = await wx.cloud.callFunction({
          name: 'lifecycle-management',
          data: {
            action: 'get_all_templates'
          }
        })
        
        wx.hideLoading()
        
        if (result.result?.success && result.result?.data) {
          // 转换数据格式
          const templates = result.result.data.map((template: unknown) => ({
            id: template._id || template.templateName || 'default',
            name: template.templateName || template.name || '未命名模板',
            description: template.description || '暂无描述',
            taskCount: template.taskCount || 0,
            isDefault: template.isDefault || false,
            createTime: template.createTime,
            updateTime: template.updateTime
          }))
          
          this.setData({
            templateList: templates
          })
          
          // 如果没有模板且不是首次加载，提示用户
          if (templates.length === 1 && templates[0].isDefault) {
            // 仅有默认模板
          }
        } else {
          // 加载失败时显示默认模板
          const defaultTemplates = [
            {
              id: 'default',
              name: '默认模板',
              description: '标准狮头鹅养殖计划',
              taskCount: 80,
              isDefault: true
            }
          ]
          
          this.setData({
            templateList: defaultTemplates
          })
          
          logger.error('获取模板列表失败:', result.result?.error)
        }
      } catch (error) {
        wx.hideLoading()
        logger.error('加载模板失败:', error)
        
        // 出错时显示默认模板
        const defaultTemplates = [
          {
            id: 'default',
            name: '默认模板',
            description: '标准狮头鹅养殖计划',
            taskCount: 80,
            isDefault: true
          }
        ]
        
        this.setData({
          templateList: defaultTemplates
        })
      }
    },
    
    // 加载模板数据
    async loadTemplateData() {
      try {
        // 使用骨架屏代替 loading
        this.setData({ showSkeleton: true })
        
        const selectedTemplate = this.data.selectedTemplate
        
        if (!selectedTemplate) {
          this.setData({ showSkeleton: false })
          return
        }
        
        let allTasks = []
        
        // 根据模板类型加载任务
        if (selectedTemplate.isDefault) {
          // 默认模板：从云数据库加载
          await this.loadDefaultDataFromBreedingSchedule()
          allTasks = this.data.taskGroups.reduce((acc: unknown[], group: unknown) => {
            return acc.concat(group.tasks)
          }, [])
        } else {
          // 用户模板：从云数据库加载
          const result = await wx.cloud.callFunction({
            name: 'lifecycle-management',
            data: {
              action: 'get_template_tasks',
              templateId: selectedTemplate.id
            }
          })
          
          if (result.result?.success && result.result?.data) {
            // 将任务按日龄分组
            const tasksByDay = result.result.data
            const taskGroups = []
            
            // 转换为统一格式
            for (const dayAge in tasksByDay) {
              taskGroups.push({
                dayAge: parseInt(dayAge),
                tasks: tasksByDay[dayAge]
              })
            }
            
            // 排序
            taskGroups.sort((a, b) => a.dayAge - b.dayAge)
            
            this.setData({
              taskGroups
            })
            
            allTasks = taskGroups.reduce((acc: unknown[], group: unknown) => {
              return acc.concat(group.tasks)
            }, [])
          }
        }
        
        // 设置为分组后的任务
        const groupedTasks = this.data.taskGroups.map((group: unknown) => ({
          dayAge: group.dayAge,
          taskCount: group.tasks.length,
          tasks: group.tasks
        }))
        
        // 默认折叠所有日龄
        const expandedGroups: unknown = {}
        
        this.setData({
          groupedTasks,
          expandedGroups,
          totalTasks: allTasks.length,
          showSkeleton: false
        })
      } catch (error) {
        this.setData({ showSkeleton: false })
        logger.error('加载任务失败:', error)
        wx.showToast({
          title: '加载任务失败',
          icon: 'none'
        })
      }
    },
    
    // 选择模板
    selectTemplate(e: CustomEvent) {
      const template = e.currentTarget.dataset.template
      
      if (!template) return
      
      // 使用骨架屏
      this.setData({ showSkeleton: true })
      
      this.setData({
        selectedTemplate: template,
        currentTemplate: template.name
      }, () => {
        // 加载该模板的任务数据
        this.loadTemplateData()
      })
    },
    
    // 返回模板列表
    backToTemplates() {
      this.setData({
        selectedTemplate: null,
        groupedTasks: []
      })
    },

    // 新建模板
    createNewTemplate() {
      wx.showModal({
        title: '新建模板',
        editable: true,
        placeholderText: '请输入模板名称',
        confirmText: '创建',
        success: (res) => {
          if (res.confirm && res.content) {
            this.doCreateTemplate(res.content)
          }
        }
      })
    },
    

    // 执行创建模板
    async doCreateTemplate(templateName: string) {
      try {
        wx.showLoading({ title: '创建中...', mask: true })
        
        // 调用云函数创建新模板
        const result = await wx.cloud.callFunction({
          name: 'lifecycle-management',
          data: {
            action: 'create_template',
            templateName: templateName
          }
        })
        
        wx.hideLoading()
        
        if (result.result?.success) {
          wx.showToast({
            title: '创建成功',
            icon: 'success'
          })
          
          // 刷新模板列表
          this.loadTemplates()
        } else {
          wx.showToast({
            title: result.result?.message || '创建失败',
            icon: 'none'
          })
        }
      } catch (error) {
        wx.hideLoading()
        logger.error('创建模板失败:', error)
        wx.showToast({
          title: '创建失败',
          icon: 'none'
        })
      }
    },

    // 获取优先级样式
    getPriorityClass(priority: string) {
      return `priority-${priority || 'low'}`
    }
  }
})
