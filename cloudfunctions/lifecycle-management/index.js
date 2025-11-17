// lifecycle-management云函数 - 养殖周期管理
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 引入集合配置
const { COLLECTIONS } = require('./collections.js')

// 引入标准养殖计划
const { BREEDING_SCHEDULE, getTasksByAge, getAllTaskDays } = require('./breeding-schedule.js')

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event

  try {
    switch (action) {
      case 'get_schedule_template':
        return await getScheduleTemplate(event, wxContext)
      case 'get_task':
        return await getTask(event, wxContext)
      case 'add_task':
        return await addTask(event, wxContext)
      case 'update_task':
        return await updateTask(event, wxContext)
      case 'delete_task':
        return await deleteTask(event, wxContext)
      case 'copy_task':
        return await copyTask(event, wxContext)
      case 'import_standard_template':
        return await importStandardTemplate(event, wxContext)
      case 'export_template':
        return await exportTemplate(event, wxContext)
      case 'get_all_templates':
        return await getAllTemplates(event, wxContext)
      case 'save_template':
        return await saveTemplate(event, wxContext)
      case 'delete_template':
        return await deleteTemplate(event, wxContext)
      case 'get_template_tasks':
        return await getTemplateTasks(event, wxContext)
      case 'parse_template_file':
        return await parseTemplateFile(event, wxContext)
      case 'save_imported_template':
        return await saveImportedTemplate(event, wxContext)
      case 'create_template':
        return await createTemplate(event, wxContext)
      default:
        return {
          success: false,
          error: '未知操作类型'
        }
    }
  } catch (error) {
    console.error('lifecycle-management云函数执行失败:', error)
    return {
      success: false,
      error: error.message || '操作失败'
    }
  }
}

// 获取任务计划模板
async function getScheduleTemplate(event, wxContext) {
  const { templateName = '默认模板' } = event
  const openid = wxContext.OPENID

  try {
    // 查询用户的自定义模板
    const templateResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        templateName: templateName,
        isDeleted: _.neq(true)
      })
      .get()

    let tasks = []

    if (templateResult.data && templateResult.data.length > 0) {
      // 使用自定义模板
      const template = templateResult.data[0]
      tasks = template.tasks || []
    } else if (templateName === '默认模板') {
      // 使用标准模板
      tasks = convertBreedingScheduleToTasks()
    }

    return {
      success: true,
      data: tasks
    }
  } catch (error) {
    console.error('获取任务计划模板失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取单个任务
async function getTask(event, wxContext) {
  const { taskId } = event
  const openid = wxContext.OPENID

  try {
    // 从模板中查询任务
    const templateResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        'tasks.id': taskId,
        isDeleted: _.neq(true)
      })
      .get()

    if (templateResult.data && templateResult.data.length > 0) {
      const template = templateResult.data[0]
      const task = template.tasks.find(t => t.id === taskId)
      
      return {
        success: true,
        data: task
      }
    }

    // 从标准模板中查找
    const standardTask = findTaskInBreedingSchedule(taskId)
    if (standardTask) {
      return {
        success: true,
        data: standardTask
      }
    }

    return {
      success: false,
      error: '任务不存在'
    }
  } catch (error) {
    console.error('获取任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 添加任务
async function addTask(event, wxContext) {
  const { dayAge, taskData } = event
  const openid = wxContext.OPENID

  try {
    // 生成任务ID
    const taskId = generateTaskId()
    const newTask = {
      ...taskData,
      id: taskId,
      dayAge: dayAge,
      createdAt: new Date(),
      createdBy: openid
    }

    // 获取或创建用户的自定义模板
    const templateResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        templateName: '自定义模板',
        isDeleted: _.neq(true)
      })
      .get()

    if (templateResult.data && templateResult.data.length > 0) {
      // 更新现有模板
      const template = templateResult.data[0]
      const tasks = template.tasks || []
      tasks.push(newTask)

      await db.collection(COLLECTIONS.TASK_TEMPLATES)
        .doc(template._id)
        .update({
          data: {
            tasks: tasks,
            updatedAt: new Date()
          }
        })
    } else {
      // 创建新模板
      await db.collection(COLLECTIONS.TASK_TEMPLATES).add({
        data: {
          _openid: openid,
          templateName: '自定义模板',
          description: '用户自定义养殖周期模板',
          tasks: [newTask],
          isDefault: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    return {
      success: true,
      data: newTask,
      message: '任务添加成功'
    }
  } catch (error) {
    console.error('添加任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 更新任务
async function updateTask(event, wxContext) {
  const { taskId, taskData } = event
  const openid = wxContext.OPENID

  try {
    // 查找包含该任务的模板
    const templateResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        'tasks.id': taskId,
        isDeleted: _.neq(true)
      })
      .get()

    if (!templateResult.data || templateResult.data.length === 0) {
      return {
        success: false,
        error: '任务不存在'
      }
    }

    const template = templateResult.data[0]
    const tasks = template.tasks || []
    const taskIndex = tasks.findIndex(t => t.id === taskId)

    if (taskIndex === -1) {
      return {
        success: false,
        error: '任务不存在'
      }
    }

    // 更新任务
    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...taskData,
      updatedAt: new Date(),
      updatedBy: openid
    }

    // 更新模板
    await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .doc(template._id)
      .update({
        data: {
          tasks: tasks,
          updatedAt: new Date()
        }
      })

    return {
      success: true,
      message: '任务更新成功'
    }
  } catch (error) {
    console.error('更新任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 删除任务
async function deleteTask(event, wxContext) {
  const { dayAge, taskId } = event
  const openid = wxContext.OPENID

  try {
    // 查找包含该任务的模板
    const templateResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        'tasks.id': taskId,
        isDeleted: _.neq(true)
      })
      .get()

    if (!templateResult.data || templateResult.data.length === 0) {
      return {
        success: false,
        error: '任务不存在'
      }
    }

    const template = templateResult.data[0]
    const tasks = template.tasks || []
    const filteredTasks = tasks.filter(t => t.id !== taskId)

    // 更新模板
    await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .doc(template._id)
      .update({
        data: {
          tasks: filteredTasks,
          updatedAt: new Date()
        }
      })

    return {
      success: true,
      message: '任务删除成功'
    }
  } catch (error) {
    console.error('删除任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 复制任务到其他日龄
async function copyTask(event, wxContext) {
  const { taskData, startDay, endDay } = event
  const openid = wxContext.OPENID

  try {
    // 获取或创建用户的自定义模板
    const templateResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        templateName: '自定义模板',
        isDeleted: _.neq(true)
      })
      .get()

    let tasks = []
    let templateId = null

    if (templateResult.data && templateResult.data.length > 0) {
      const template = templateResult.data[0]
      tasks = template.tasks || []
      templateId = template._id
    }

    // 为每个日龄创建任务副本
    const newTasks = []
    for (let day = startDay; day <= endDay; day++) {
      const newTask = {
        ...taskData,
        id: generateTaskId(),
        dayAge: day,
        title: `${taskData.title}（第${day}日龄）`,
        createdAt: new Date(),
        createdBy: openid
      }
      newTasks.push(newTask)
    }

    tasks.push(...newTasks)

    if (templateId) {
      // 更新现有模板
      await db.collection(COLLECTIONS.TASK_TEMPLATES)
        .doc(templateId)
        .update({
          data: {
            tasks: tasks,
            updatedAt: new Date()
          }
        })
    } else {
      // 创建新模板
      await db.collection(COLLECTIONS.TASK_TEMPLATES).add({
        data: {
          _openid: openid,
          templateName: '自定义模板',
          description: '用户自定义养殖周期模板',
          tasks: tasks,
          isDefault: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    return {
      success: true,
      message: `成功复制任务到第${startDay}-${endDay}日龄`,
      count: newTasks.length
    }
  } catch (error) {
    console.error('复制任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 导入标准模板
async function importStandardTemplate(event, wxContext) {
  const openid = wxContext.OPENID

  try {
    // 将标准养殖计划转换为任务列表
    const tasks = convertBreedingScheduleToTasks()

    // 创建或更新用户的标准模板副本
    const existingResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        templateName: '标准模板副本',
        isDeleted: _.neq(true)
      })
      .get()

    if (existingResult.data && existingResult.data.length > 0) {
      // 更新现有模板
      await db.collection(COLLECTIONS.TASK_TEMPLATES)
        .doc(existingResult.data[0]._id)
        .update({
          data: {
            tasks: tasks,
            updatedAt: new Date()
          }
        })
    } else {
      // 创建新模板
      await db.collection(COLLECTIONS.TASK_TEMPLATES).add({
        data: {
          _openid: openid,
          templateName: '标准模板副本',
          description: '从标准养殖计划导入的模板',
          tasks: tasks,
          isDefault: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    return {
      success: true,
      message: '标准模板导入成功',
      taskCount: tasks.length
    }
  } catch (error) {
    console.error('导入标准模板失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 导出模板
async function exportTemplate(event, wxContext) {
  const { templateName = '自定义模板' } = event
  const openid = wxContext.OPENID

  try {
    // 查询模板
    const templateResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        templateName: templateName,
        isDeleted: _.neq(true)
      })
      .get()

    if (!templateResult.data || templateResult.data.length === 0) {
      return {
        success: false,
        error: '模板不存在'
      }
    }

    const template = templateResult.data[0]

    return {
      success: true,
      data: {
        templateName: template.templateName,
        description: template.description,
        tasks: template.tasks,
        exportedAt: new Date()
      }
    }
  } catch (error) {
    console.error('导出模板失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取所有模板
async function getAllTemplates(event, wxContext) {
  const openid = wxContext.OPENID

  try {
    let templates = []
    
    try {
      const templateResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
        .where({
          _openid: openid,
          isDeleted: _.neq(true)
        })
        .orderBy('createTime', 'desc')
        .get()
      
      templates = templateResult.data || []
    } catch (error) {
      // 如果集合不存在，尝试创建
      if (error.errCode === -502005 || (error.message && error.message.includes('not exist'))) {

        try {
          // 创建一个初始化记录来建立集合
          await db.collection(COLLECTIONS.TASK_TEMPLATES).add({
            data: {
              _openid: 'system_init',
              templateName: '__初始化__',
              description: '系统初始化记录',
              tasks: [],
              isDeleted: true,
              createTime: db.serverDate(),
              updateTime: db.serverDate()
            }
          })

          templates = []
        } catch (initError) {
          console.error('创建集合失败:', initError)
          templates = []
        }
      } else {
        // 其他错误，记录但继续
        console.error('查询模板失败:', error)
        templates = []
      }
    }

    // 添加默认模板选项
    const allTemplates = [
      {
        templateName: '默认模板',
        description: '系统标准养殖周期模板',
        isDefault: true,
        taskCount: Object.keys(BREEDING_SCHEDULE).reduce((sum, day) => sum + BREEDING_SCHEDULE[day].length, 0)
      },
      ...templates.map(t => ({
        ...t,
        taskCount: t.tasks ? t.tasks.length : 0
      }))
    ]

    return {
      success: true,
      data: allTemplates
    }
  } catch (error) {
    console.error('获取模板列表失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 保存模板
async function saveTemplate(event, wxContext) {
  const { templateName, description, tasks } = event
  const openid = wxContext.OPENID

  try {
    // 检查模板是否已存在
    const existingResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        templateName: templateName,
        isDeleted: _.neq(true)
      })
      .get()

    if (existingResult.data && existingResult.data.length > 0) {
      // 更新现有模板
      await db.collection(COLLECTIONS.TASK_TEMPLATES)
        .doc(existingResult.data[0]._id)
        .update({
          data: {
            description: description,
            tasks: tasks,
            updatedAt: new Date()
          }
        })
    } else {
      // 创建新模板
      await db.collection(COLLECTIONS.TASK_TEMPLATES).add({
        data: {
          _openid: openid,
          templateName: templateName,
          description: description,
          tasks: tasks,
          isDefault: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    return {
      success: true,
      message: '模板保存成功'
    }
  } catch (error) {
    console.error('保存模板失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 删除模板
async function deleteTemplate(event, wxContext) {
  const { templateId } = event
  const openid = wxContext.OPENID

  try {
    // 软删除模板
    await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .doc(templateId)
      .update({
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: openid
        }
      })

    return {
      success: true,
      message: '模板删除成功'
    }
  } catch (error) {
    console.error('删除模板失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 辅助函数：将BREEDING_SCHEDULE转换为任务列表
function convertBreedingScheduleToTasks() {
  const tasks = []
  
  Object.keys(BREEDING_SCHEDULE).forEach(dayAge => {
    const dayTasks = BREEDING_SCHEDULE[dayAge]
    dayTasks.forEach(task => {
      tasks.push({
        ...task,
        dayAge: parseInt(dayAge),
        priority: task.priority || (task.type === 'vaccine' ? 'high' : 'medium')
      })
    })
  })

  return tasks
}

// 辅助函数：在BREEDING_SCHEDULE中查找任务
function findTaskInBreedingSchedule(taskId) {
  for (const dayAge in BREEDING_SCHEDULE) {
    const dayTasks = BREEDING_SCHEDULE[dayAge]
    const task = dayTasks.find(t => t.id === taskId)
    if (task) {
      return {
        ...task,
        dayAge: parseInt(dayAge),
        priority: task.priority || (task.type === 'vaccine' ? 'high' : 'medium')
      }
    }
  }
  return null
}

// 辅助函数：生成任务ID
function generateTaskId() {
  const timestamp = Date.now().toString(36)
  const randomStr = Math.random().toString(36).substr(2, 5)
  return `task_${timestamp}_${randomStr}`
}

// 获取模板的任务配置
async function getTemplateTasks(event, wxContext) {
  const { templateId } = event
  
  try {
    // 如果是默认模板，返回标准养殖计划
    if (templateId === 'default') {
      const tasks = {}
      Object.keys(BREEDING_SCHEDULE).forEach(dayAge => {
        tasks[dayAge] = BREEDING_SCHEDULE[dayAge]
      })
      
      return {
        success: true,
        data: tasks
      }
    }
    
    // 查询自定义模板
    const templateResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .doc(templateId)
      .get()
    
    if (templateResult.data) {
      const template = templateResult.data
      
      // 将任务按日龄分组
      const tasksByDayAge = {}
      
      if (template.tasks && Array.isArray(template.tasks)) {
        template.tasks.forEach(task => {
          const dayAge = task.dayAge || 1
          if (!tasksByDayAge[dayAge]) {
            tasksByDayAge[dayAge] = []
          }
          tasksByDayAge[dayAge].push(task)
        })
      }
      
      return {
        success: true,
        data: tasksByDayAge
      }
    }
    
    return {
      success: false,
      error: '模板不存在'
    }
  } catch (error) {
    console.error('获取模板任务配置失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 解析模板文件（Excel或PDF）
async function parseTemplateFile(event, wxContext) {
  const { fileID, fileType } = event
  const openid = wxContext.OPENID

  try {
    // 下载文件
    const downloadResult = await cloud.downloadFile({
      fileID: fileID
    })
    
    const fileBuffer = downloadResult.fileContent
    
    let parsedData = {
      templateName: '导入模板',
      tasks: []
    }
    
    if (fileType === 'xlsx' || fileType === 'xls') {
      // 解析Excel文件 - 使用更高效的配置
      const XLSX = require('xlsx')
      const workbook = XLSX.read(fileBuffer, { 
        type: 'buffer',
        cellDates: false,  // 不解析日期
        cellNF: false,     // 不解析数字格式
        cellText: false,   // 不生成文本
        sheetStubs: false  // 不包含空白单元格
      })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const data = XLSX.utils.sheet_to_json(worksheet, {
        raw: true,  // 使用原始值
        defval: ''  // 默认值
      })
      
      // 首先收集所有原始任务
      const rawTasks = data.map((row, index) => {
        const title = row['任务名称'] || row['Task Name'] || row['title'] || ''
        const description = row['任务描述'] || row['Description'] || row['description'] || ''
        
        // 智能识别持续时间（从标题或描述中提取）
        let duration = parseInt(row['持续天数'] || row['Duration'] || row['duration'] || 1)
        
        // 如果没有明确的持续天数字段，尝试从文本中解析
        if (duration === 1) {
          duration = parseDurationFromText(title + ' ' + description) || 1
        }
        
        return {
          id: `imported_${index + 1}`,
          dayAge: parseInt(row['日龄'] || row['Day Age'] || row['day'] || 1),
          title: cleanTaskTitle(title), // 清理标题中的持续时间描述
          description: description,
          type: parseTaskType(row['任务类型'] || row['Type'] || row['type'] || ''),
          category: row['任务分类'] || row['Category'] || row['category'] || '',
          priority: parsePriority(row['优先级'] || row['Priority'] || row['priority'] || ''),
          dosage: row['用量'] || row['Dosage'] || row['dosage'] || '',
          duration: duration,
          materials: row['所需材料'] || row['Materials'] || row['materials'] || '',
          notes: row['备注'] || row['Notes'] || row['notes'] || '',
          estimatedTime: parseInt(row['预计用时'] || row['Estimated Time'] || row['estimatedTime'] || 30)
        }
      }).filter(task => task.title) // 过滤掉没有标题的任务
      
      // 限制原始任务数量
      if (rawTasks.length > 100) {
        console.warn('任务数量过多，只处理前100个')
        rawTasks.splice(100)
      }
      
      // 智能分解任务：将持续多天的任务分解到各个日龄
      const expandedTasks = []
      let taskIdCounter = 1
      const MAX_EXPANDED_TASKS = 500 // 限制展开后的最大任务数
      
      for (const task of rawTasks) {
        // 检查是否超过最大任务数限制
        if (expandedTasks.length >= MAX_EXPANDED_TASKS) {
          console.warn('达到最大任务数限制，停止分解')
          break
        }
        
        // 限制单个任务的最大持续天数
        const maxDuration = Math.min(task.duration, 30) // 最多30天
        
        // 检查是否需要分解任务（持续天数大于1）
        if (maxDuration > 1) {
          // 分解任务到多个日龄
          for (let i = 0; i < maxDuration && expandedTasks.length < MAX_EXPANDED_TASKS; i++) {
            const dayAge = task.dayAge + i
            const dayLabel = getDayLabel(i + 1, task.duration) // 获取天数标签
            
            expandedTasks.push({
              ...task,
              id: `expanded_${taskIdCounter++}`,
              dayAge: dayAge,
              title: `${task.title}${dayLabel}`,
              description: task.description ? 
                `${task.description}（第${i + 1}/${task.duration}天）` : 
                `第${i + 1}/${task.duration}天`,
              duration: 1, // 分解后每个任务都是单天任务
              originalDuration: task.duration, // 保留原始持续天数信息
              dayInSequence: i + 1, // 在序列中的第几天
              isSequenceTask: true // 标记为序列任务
            })
          }
        } else {
          // 不需要分解的任务直接添加
          expandedTasks.push({
            ...task,
            id: `expanded_${taskIdCounter++}`,
            isSequenceTask: false
          })
        }
      }
      
      // 智能识别和合并相似任务
      parsedData.tasks = mergeAndOptimizeTasks(expandedTasks)
      
      // 从文件名提取模板名称
      if (event.fileName) {
        parsedData.templateName = event.fileName.replace(/\.(xlsx?|pdf)$/i, '')
      }
    } else if (fileType === 'pdf') {
      // PDF解析较复杂，这里提供基础实现
      // 实际项目中可能需要使用专门的PDF解析库
      return {
        success: false,
        message: 'PDF解析功能正在开发中'
      }
    }
    
    // 异步删除临时文件（不等待结果）
    cloud.deleteFile({
      fileList: [fileID]
    }).catch(err => {
      console.error('删除临时文件失败:', err)
    })

    return {
      success: true,
      data: parsedData
    }
  } catch (error) {
    console.error('解析模板文件失败:', error)
    
    // 尝试删除临时文件
    if (fileID) {
      cloud.deleteFile({
        fileList: [fileID]
      }).catch(err => {
        console.error('删除临时文件失败:', err)
      })
    }
    
    return {
      success: false,
      error: error.message,
      message: '文件解析失败，请检查文件格式'
    }
  }
}

// 获取天数标签
function getDayLabel(currentDay, totalDays) {
  if (totalDays === 1) return ''
  
  // 特殊标签
  if (currentDay === 1) return '（首日）'
  if (currentDay === totalDays) return '（末日）'
  
  // 中间天数
  return `（第${currentDay}天）`
}

// 合并和优化任务（去重、排序等）
function mergeAndOptimizeTasks(tasks) {
  // 按日龄分组
  const tasksByDay = {}
  
  for (const task of tasks) {
    const dayAge = task.dayAge
    if (!tasksByDay[dayAge]) {
      tasksByDay[dayAge] = []
    }
    tasksByDay[dayAge].push(task)
  }
  
  // 扁平化并排序
  const optimizedTasks = []
  const sortedDays = Object.keys(tasksByDay).map(d => parseInt(d)).sort((a, b) => a - b)
  
  for (const day of sortedDays) {
    const dayTasks = tasksByDay[day]
    
    // 对同一天的任务按优先级和类型排序
    dayTasks.sort((a, b) => {
      // 优先级排序
      const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 }
      if (a.priority !== b.priority) {
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
      }
      
      // 类型排序
      const typeOrder = {
        'vaccine': 0,    // 疫苗优先
        'medication': 1, // 其次用药
        'feeding': 2,    // 然后饲养
        'nutrition': 3,  // 营养
        'inspection': 4, // 健康检查
        'care': 5       // 特殊护理
      }
      return (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5)
    })
    
    optimizedTasks.push(...dayTasks)
  }
  
  return optimizedTasks
}

// 保存导入的模板
async function saveImportedTemplate(event, wxContext) {
  const { templateName, tasks } = event
  const openid = wxContext.OPENID
  
  try {
    // 检查模板名称是否已存在
    const existingTemplate = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        templateName: templateName,
        isDeleted: _.neq(true)
      })
      .get()
    
    if (existingTemplate.data && existingTemplate.data.length > 0) {
      // 更新现有模板
      const templateId = existingTemplate.data[0]._id
      await db.collection(COLLECTIONS.TASK_TEMPLATES)
        .doc(templateId)
        .update({
          data: {
            tasks: tasks,
            updateTime: db.serverDate()
          }
        })
    } else {
      // 创建新模板
      await db.collection(COLLECTIONS.TASK_TEMPLATES)
        .add({
          data: {
            _openid: openid,
            templateName: templateName,
            tasks: tasks,
            isDeleted: false,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        })
    }
    
    return {
      success: true,
      message: '模板保存成功'
    }
  } catch (error) {
    console.error('保存导入模板失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 创建新模板
async function createTemplate(event, wxContext) {
  const { templateName, description } = event
  const openid = wxContext.OPENID

  try {
    // 检查模板名称是否已存在
    const existingTemplate = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .where({
        _openid: openid,
        templateName: templateName,
        isDeleted: _.neq(true)
      })
      .get()
    
    if (existingTemplate.data && existingTemplate.data.length > 0) {
      return {
        success: false,
        message: '模板名称已存在'
      }
    }
    
    // 创建新模板，初始化为默认任务
    const defaultTasks = convertBreedingScheduleToTasks()
    
    const addResult = await db.collection(COLLECTIONS.TASK_TEMPLATES)
      .add({
        data: {
          _openid: openid,
          templateName: templateName,
          description: description || '自定义养殖模板',
          tasks: defaultTasks,
          isDeleted: false,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })

    return {
      success: true,
      message: '模板创建成功',
      templateId: addResult._id
    }
  } catch (error) {
    console.error('创建模板失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 解析任务类型
function parseTaskType(typeStr) {
  const typeMap = {
    '健康检查': 'inspection',
    '疫苗接种': 'vaccine',
    '用药管理': 'medication',
    '营养管理': 'nutrition',
    '饲养管理': 'feeding',
    '特殊护理': 'care',
    'health': 'inspection',
    'vaccine': 'vaccine',
    'medicine': 'medication',
    'nutrition': 'nutrition',
    'feeding': 'feeding',
    'care': 'care'
  }
  
  return typeMap[typeStr] || 'feeding'
}

// 解析优先级
function parsePriority(priorityStr) {
  const priorityMap = {
    '高': 'high',
    '中': 'medium',
    '低': 'low',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
    '高优先级': 'high',
    '中优先级': 'medium',
    '低优先级': 'low'
  }
  
  return priorityMap[priorityStr] || 'medium'
}

// 从文本中解析持续时间
function parseDurationFromText(text) {
  if (!text) return null
  
  // 匹配各种持续时间的模式
  const patterns = [
    /连喂(\d+)[天日]/,          // 连喂3天
    /连续(\d+)[天日]/,          // 连续3天
    /持续(\d+)[天日]/,          // 持续3天
    /(\d+)[天日]连续/,          // 3天连续
    /(\d+)[天日]疗程/,          // 3天疗程
    /每天.*共(\d+)[天日]/,       // 每天...共3天
    /(\d+)-(\d+)[天日]/,        // 3-5天（取最大值）
    /第(\d+)-(\d+)[天日]/,      // 第1-3天
    /(\d+)日疗程/,             // 3日疗程
    /连用(\d+)[天日]/,          // 连用3天
    /共(\d+)[天日]/,            // 共3天
    /为期(\d+)[天日]/,          // 为期3天
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      // 如果是范围（如3-5天），取最大值
      if (match[2]) {
        return parseInt(match[2])
      }
      return parseInt(match[1])
    }
  }
  
  // 匹配中文数字
  const chineseNumbers = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '两': 2, '俩': 2
  }
  
  const chinesePattern = /连喂([一二三四五六七八九十两俩]+)[天日]/
  const chineseMatch = text.match(chinesePattern)
  if (chineseMatch) {
    return chineseNumbers[chineseMatch[1]] || null
  }
  
  return null
}

// 清理任务标题（移除持续时间描述）
function cleanTaskTitle(title) {
  if (!title) return ''
  
  // 移除持续时间相关的描述
  const cleanedTitle = title
    .replace(/[（(]?连喂\d+[天日][）)]?/g, '')
    .replace(/[（(]?连续\d+[天日][）)]?/g, '')
    .replace(/[（(]?持续\d+[天日][）)]?/g, '')
    .replace(/[（(]?\d+[天日]疗程[）)]?/g, '')
    .replace(/[（(]?连用\d+[天日][）)]?/g, '')
    .replace(/[（(]?共\d+[天日][）)]?/g, '')
    .replace(/[（(]?第\d+-\d+[天日][）)]?/g, '')
    .replace(/[（(]?\d+-\d+[天日][）)]?/g, '')
    .replace(/[（(]?为期\d+[天日][）)]?/g, '')
    .replace(/\s+/g, ' ') // 清理多余空格
    .trim()
  
  return cleanedTitle
}
