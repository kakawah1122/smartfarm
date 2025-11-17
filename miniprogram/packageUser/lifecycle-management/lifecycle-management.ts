// lifecycle-management.ts - 任务管理页面

import { getTasksByDayAge, getAllTasks } from '../../utils/breeding-schedule-data'

// 定义全局变量存储定时器
let scrollTimer: number | null = null

Component({
  data: {
    // 日龄任务列表
    taskGroups: [] as any[],
    
    // 展开的日龄组
    expandedGroups: {} as any,
    
    // 筛选条件
    filterCategory: '全部',
    categories: ['全部', '健康管理', '用药管理', '营养管理', '疫苗接种', '饲养管理', '特殊护理'],
    
    // 加载状态
    loading: false,
    showSkeleton: false, // 显示骨架屏
    
    // 模板相关
    currentTemplate: '默认模板',
    templateList: [] as any[], // 模板列表
    selectedTemplate: null as any, // 当前选中的模板
    
    // 总任务数
    totalTasks: 0,
    
    // 导航栏高度
    statusBarHeight: 0,
    navbarHeight: 44
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
        
        // 使用本地养殖计划数据
        this.loadDefaultDataFromBreedingSchedule()
        
        wx.hideLoading()
      } catch (error) {
        wx.hideLoading()
        console.error('加载任务计划失败:', error)
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },

    // 从breeding-schedule加载数据
    loadDefaultDataFromBreedingSchedule() {
      const taskGroups = getTasksByDayAge()
      const allTasks = getAllTasks()
      
      // 根据筛选条件过滤任务
      let filteredGroups = taskGroups
      
      // 按分类筛选
      if (this.data.filterCategory !== '全部') {
        filteredGroups = taskGroups.map(group => ({
          ...group,
          tasks: group.tasks.filter((task: any) => task.category === this.data.filterCategory)
        })).filter(group => group.tasks.length > 0)
      }
      
      // 默认折叠所有日龄
      const expandedGroups: any = {}
      
      this.setData({
        taskGroups: filteredGroups,
        totalTasks: allTasks.length,
        expandedGroups
      })
    },


    // 按日龄分组任务
    groupTasksByDayAge(tasks: any[]) {
      const groups: any = {}
      
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
      return Object.values(groups).sort((a: any, b: any) => a.dayAge - b.dayAge)
    },

    // 切换日龄展开状态
    toggleDayExpand(e: any) {
      const { dayAge } = e.currentTarget.dataset
      const expandedGroups = this.data.expandedGroups
      expandedGroups[dayAge] = !expandedGroups[dayAge]
      
      this.setData({
        expandedGroups
      })
    },

    // 添加任务
    addTask(e: any) {
      const dayAge = e.currentTarget.dataset.dayAge
      wx.navigateTo({
        url: `/packageUser/lifecycle-task-edit/lifecycle-task-edit?dayAge=${dayAge}&mode=add`
      })
    },

    // 编辑任务
    editTask(e: any) {
      const { dayAge, taskId } = e.currentTarget.dataset
      wx.navigateTo({
        url: `/packageUser/lifecycle-task-edit/lifecycle-task-edit?dayAge=${dayAge}&taskId=${taskId}&mode=edit`
      })
    },

    // 删除任务
    deleteTask(e: any) {
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
    onCategoryChange(e: any) {
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
    onTemplateChange(e: any) {
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
        console.error('导入文件失败:', error)
        wx.showToast({
          title: '导入失败',
          icon: 'none'
        })
      }
    },

    // 显示解析结果
    showParseResult(parsedData: any) {
      // 统计任务分解情况
      const totalTasks = parsedData.tasks?.length || 0
      const expandedCount = parsedData.tasks?.filter((t: any) => t.isSequenceTask).length || 0
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
    calculateDayRanges(tasks: any[]) {
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
    showTaskPreview(parsedData: any) {
      // 按日龄分组任务
      const tasksByDay: any = {}
      
      parsedData.tasks.forEach((task: any) => {
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
        tasksByDay[day].forEach((task: any) => {
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
    async saveImportedTasks(parsedData: any) {
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
        console.error('保存模板失败:', error)
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
        console.error('导入模板失败:', error)
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
      } catch (error: any) {
        this.setData({ showSkeleton: false })
        console.error('加载模板失败:', error)
        
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
          console.error('集合初始化失败:', result.result?.error)
          wx.showToast({
            title: '初始化失败',
            icon: 'none'
          })
        }
      } catch (error) {
        wx.hideLoading()
        console.error('调用初始化云函数失败:', error)
        
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
          const templates = result.result.data.map((template: any) => ({
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
          
          console.error('获取模板列表失败:', result.result?.error)
        }
      } catch (error) {
        wx.hideLoading()
        console.error('加载模板失败:', error)
        
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
          wx.hideLoading()
          return
        }
        
        let allTasks = []
        
        // 根据模板类型加载任务
        if (selectedTemplate.isDefault) {
          // 默认模板：使用本地的养殖计划数据
          this.loadDefaultDataFromBreedingSchedule()
          allTasks = this.data.taskGroups.reduce((acc: any[], group: any) => {
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
            
            allTasks = taskGroups.reduce((acc: any[], group: any) => {
              return acc.concat(group.tasks)
            }, [])
          }
        }
        
        // 设置为分组后的任务
        const groupedTasks = this.data.taskGroups.map((group: any) => ({
          dayAge: group.dayAge,
          taskCount: group.tasks.length,
          tasks: group.tasks
        }))
        
        // 默认折叠所有日龄
        const expandedGroups: any = {}
        
        this.setData({
          groupedTasks,
          expandedGroups,
          totalTasks: allTasks.length,
          showSkeleton: false
        })
      } catch (error) {
        this.setData({ showSkeleton: false })
        console.error('加载任务失败:', error)
        wx.showToast({
          title: '加载任务失败',
          icon: 'none'
        })
      }
    },
    
    // 选择模板
    selectTemplate(e: any) {
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
        console.error('创建模板失败:', error)
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
