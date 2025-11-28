/**
 * 健康管理 - 预防任务模块
 * 负责管理今日任务、即将到来任务、历史任务等预防相关功能
 * 保持原有功能和UI完全不变
 */

import CloudApi from '../../../utils/cloud-api'
import { safeCloudCall } from '../../../utils/safe-cloud-call'
import { logger } from '../../../utils/logger'

interface BaseResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
}

// 任务类型定义
interface Task {
  id: string
  batchId: string
  batchNumber: string
  dayAge: number
  taskType: string
  taskName: string
  status?: string
  completed?: boolean
  createTime?: string
  [key: string]: any
}

// CustomEvent类型已通过全局定义

// 预防任务模块管理器
export class PreventionModuleManager {
  private pageInstance: any
  
  constructor(pageInstance: Record<string, unknown>) {
    this.pageInstance = pageInstance
  }
  
  /**
   * 规范化任务数据
   */
  private normalizeTaskData(task: any, overrides: any = {}) {
    return {
      _id: task._id || task.id,
      id: task.id || task._id,
      taskId: task.taskId || task._id,
      batchId: task.batchId || overrides.batchId,
      batchNumber: task.batchNumber || overrides.batchNumber,
      dayAge: task.dayAge || task.day_age,
      taskType: task.taskType || task.type || task.category,
      taskName: task.taskName || task.title || task.name,
      type: task.type || task.category,
      category: task.category || task.type,
      title: task.title || task.taskName,
      description: task.description || '',
      status: task.status || (task.completed ? 'completed' : 'pending'),
      completed: task.completed || false,
      completedAt: task.completedAt || task.completed_at,
      isVaccine: task.category === 'vaccine' || task.type === 'vaccine',
      isMedication: task.category === 'medication' || task.type === 'medication',
      isNutrition: task.category === 'nutrition' || task.type === 'nutrition'
    }
  }
  
  /**
   * 分组历史任务
   */
  private groupHistoryTasksByBatch(tasks: any[]) {
    const grouped: Record<string, any> = {}
    tasks.forEach(task => {
      const batchId = task.batchId || 'unknown'
      if (!grouped[batchId]) {
        grouped[batchId] = {
          batchId,
          batchNumber: task.batchNumber || batchId,
          tasks: []
        }
      }
      grouped[batchId].tasks.push(task)
    })
    return Object.values(grouped)
  }
  
  /**
   * 加载预防数据
   */
  async loadPreventionData() {
    const subTab = this.pageInstance.data.preventionSubTab
    
    // 获取预防统计数据（包括成本）
    await this.loadPreventionStats()
    
    // 根据子标签加载任务
    if (subTab === 'today') {
      await this.loadTodayTasks()
    } else if (subTab === 'upcoming') {
      await this.loadUpcomingTasks()
    } else if (subTab === 'history') {
      await this.loadHistoryTasks()
    }
  }
  
  /**
   * 加载预防统计数据（包括成本）
   */
  async loadPreventionStats() {
    try {
      const batchId = this.pageInstance.data.currentBatchId || 'all'
      
      // 调用预防管理云函数获取统计数据
      const result = await CloudApi.callFunction(
        'health-prevention',
        {
          action: 'get_prevention_dashboard',
          batchId: batchId
        },
        { showError: false }
      ) as BaseResponse
      
      if (result?.success && result.data) {
        const data = result.data as any
        
        // 更新预防统计数据 - 使用云函数实际返回的字段名
        this.pageInstance.setData({
          'preventionStats': {
            totalPreventions: data.totalCount || 0,
            vaccineCount: data.vaccineCount || 0,
            vaccineCoverage: data.vaccineCoverage || 0,
            medicationCount: data.medicationCount || 0,
            disinfectionCount: data.disinfectionCount || 0,
            totalCost: data.preventionCost || data.totalCost || 0
          },
          'preventionData.stats': {
            vaccinationRate: data.vaccinationRate || 0,
            vaccineCount: data.vaccineCount || 0,
            medicationCount: data.medicationCount || 0,
            vaccineCoverage: data.vaccineCoverage || 0,
            preventionCost: data.preventionCost || data.totalCost || 0
          }
        })
        
        logger.info('[loadPreventionStats] 预防成本:', data.totalCost || 0)
      }
    } catch (error) {
      logger.error('[loadPreventionStats] 获取预防统计失败:', error)
    }
  }
  
  /**
   * 加载今日任务
   */
  async loadTodayTasks() {
    try {
      // 获取批次列表
      let batches = []
      
      if (this.pageInstance.data.currentBatchId === 'all') {
        // 全部批次模式：获取所有活跃批次
        batches = this.pageInstance.data.availableBatches || []
        if (batches.length === 0) {
          // 如果没有缓存的批次数据，重新加载
          await this.pageInstance.loadAvailableBatches()
          batches = this.pageInstance.data.availableBatches || []
        }
      } else {
        // 单批次模式：只处理当前批次
        const currentBatch = this.pageInstance.data.availableBatches?.find(
          (b: any) => b._id === this.pageInstance.data.currentBatchId
        )
        if (currentBatch) {
          batches = [currentBatch]
        }
      }
      
      if (batches.length === 0) {
        this.pageInstance.setData({
          todayTasksByBatch: [],
          'preventionData.todayTasks': []
        })
        return
      }
      
      // 并行加载所有批次的任务
      const batchTasksPromises = batches.map(async (batch: Record<string, unknown>) => {
        try {
          const dayAge = batch.day_age || ((batch as any).dayAge || 1)
          const result = await safeCloudCall({
            name: 'breeding-todo',
            data: {
              action: 'getTodos',
              batchId: batch._id || this.pageInstance.data.currentBatchId,
              dayAge: dayAge
            }
          })
          
          const response = result as BaseResponse
          if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
            const tasks = response.data
            const normalizedTasks = tasks.map((task: Record<string, unknown>) =>
              this.normalizeTask(task, {
                batchNumber: batch.batchNumber || batch._id,
                dayAge: task.dayAge || dayAge
              })
            )
            
            return {
              id: `${batch._id}_${dayAge}`,
              batchId: batch._id || this.pageInstance.data.currentBatchId,
              batchNumber: batch.batchNumber || batch._id,
              dayAge: dayAge,
              tasks: normalizedTasks
            }
          }
          return null
        } catch (error: Error | unknown) {
          logger.error(`批次${(batch as any).batchNumber}今日任务加载失败:`, error)
          return null
        }
      })
      
      const results = await Promise.all(batchTasksPromises)
      const validBatchTasks = results.filter((item: any) => item !== null && item.tasks && item.tasks.length > 0)
      
      // 收集所有任务
      let allTasks: Task[] = []
      validBatchTasks.forEach((batchData: any) => {
        allTasks = allTasks.concat(batchData.tasks || [])
      })
      
      this.pageInstance.setData({
        todayTasksByBatch: validBatchTasks,
        'preventionData.todayTasks': allTasks
      })
      
    } catch (error: any) {
      logger.error('获取历史任务失败:', error?.message || error)
      this.pageInstance.setData({
        todayTasksByBatch: [],
        'preventionData.todayTasks': []
      })
    }
  }
  
  /**
   * 加载即将到来的任务
   */
  async loadUpcomingTasks() {
    try {
      // 获取批次列表
      let batches = []
      
      if (this.pageInstance.data.currentBatchId === 'all') {
        // 全部批次模式
        batches = this.pageInstance.data.availableBatches || []
      } else {
        // 单批次模式
        const currentBatch = this.pageInstance.data.availableBatches?.find(
          (b: any) => b._id === this.pageInstance.data.currentBatchId
        )
        if (currentBatch) {
          batches = [currentBatch]
        }
      }
      
      if (batches.length === 0) {
        this.pageInstance.setData({
          upcomingTasksByBatch: [],
          'preventionData.upcomingTasks': []
        })
        return
      }
      
      // 并行加载所有批次的未来7天任务
      const upcomingPromises = batches.map(async (batch: Record<string, unknown>) => {
        try {
          const currentDayAge = (batch as any).dayAge || 1
          const startDayAge = currentDayAge + 1
          const endDayAge = currentDayAge + 7
          const result = await safeCloudCall({
            name: 'breeding-todo',
            data: {
              action: 'getUpcomingTodos',
              batchId: batch._id,
              startDayAge: startDayAge,
              endDayAge: endDayAge
            }
          })
          
          const response = result as BaseResponse
          if (response.success && response.data) {
            const tasks = Array.isArray(response.data) ? response.data : []
            const normalizedTasks = tasks.map((task: Record<string, unknown>) =>
              this.normalizeTaskData(task, {
                batchNumber: batch.batchNumber || batch._id
              })
            )
            
            // 按日龄分组
            const tasksByDayAge: Record<number, any[]> = {}
            normalizedTasks.forEach((task: Record<string, unknown>) => {
              const dayAge = (task as any).dayAge || currentDayAge
              if (!tasksByDayAge[dayAge]) {
                tasksByDayAge[dayAge] = []
              }
              tasksByDayAge[dayAge].push(task)
            })
            
            // 转换为数组格式
            return Object.entries(tasksByDayAge).map(([dayAge, dayTasks]) => ({
              id: `${batch._id}_${dayAge}`,
              batchId: (batch as any)._id,
              batchNumber: (batch as any).batchNumber || (batch as any)._id,
              dayAge: parseInt(dayAge),
              tasks: dayTasks
            }))
          }
          return []
        } catch (error) {
          logger.error(`批次未来任务加载失败:`, error)
          return []
        }
      })
      
      const results = await Promise.all(upcomingPromises)
      const allBatchTasks = results.flat().filter(item => item && item.tasks && item.tasks.length > 0)
      
      // 按日龄排序
      allBatchTasks.sort((a, b) => a.dayAge - b.dayAge)
      
      // 收集所有任务
      let allTasks: Task[] = []
      allBatchTasks.forEach((batchData: Record<string, unknown>) => {
        allTasks = allTasks.concat((batchData as any).tasks || [])
      })
      
      this.pageInstance.setData({
        upcomingTasksByBatch: allBatchTasks,
        'preventionData.upcomingTasks': allTasks
      })
      
    } catch (error: Error | unknown) {
      logger.error('加载未来任务失败:', error)
      this.pageInstance.setData({
        upcomingTasksByBatch: [],
        'preventionData.upcomingTasks': []
      })
    }
  }
  
  /**
   * 加载历史任务
   */
  async loadHistoryTasks() {
    try {
      const result = await CloudApi.callFunction(
        'breeding-todo',
        {
          action: 'getCompletedTodos',
          batchId: this.pageInstance.data.currentBatchId,
          limit: 50
        }
      ) as BaseResponse
      
      if (result?.success && result.data) {
        // 历史任务是直接的数组
        const tasks: any[] = Array.isArray(result.data) ? result.data : []
        const normalizedTasks = tasks.map((task: Record<string, unknown>) => this.normalizeTaskData(task))
        
        // 分组历史任务
        const groupedTasks = this.groupHistoryTasksByBatch(normalizedTasks)
        
        this.pageInstance.setData({
          historyTasksByBatch: groupedTasks,
          'preventionData.historyTasks': normalizedTasks
        })
      } else {
        this.pageInstance.setData({
          historyTasksByBatch: [],
          'preventionData.historyTasks': []
        })
      }
    } catch (error: Error | unknown) {
      logger.error('加载历史任务失败:', error)
      this.pageInstance.setData({
        historyTasksByBatch: [],
        'preventionData.historyTasks': []
      })
    }
  }
  
  /**
   * 分组历史任务（按批次和日龄组合分组） - 外部版本
   */
  groupHistoryTasksByBatchPublic(tasks: Task[] = []) {
    const batchMap: Record<string, any> = {}
    
    tasks.forEach((task: Record<string, unknown>) => {
      const batchKey = task.batchNumber || task.batchId || 'unknown'
      const taskDayAge = task.dayAge || 0
      // 使用批次号和日龄组合作为唯一键
      const groupKey = `${batchKey}_${taskDayAge}`
      
      if (!batchMap[groupKey]) {
        batchMap[groupKey] = {
          id: groupKey,
          batchId: task.batchId || batchKey,
          batchNumber: task.batchNumber || batchKey,
          dayAge: taskDayAge,
          tasks: []
        }
      }
      
      batchMap[groupKey].tasks.push(task)
    })
    
    return Object.values(batchMap).sort((a, b) => {
      // 先按批次号排序
      const batchCompare = (a.batchNumber || '').localeCompare(b.batchNumber || '')
      if (batchCompare !== 0) return batchCompare
      // 再按日龄排序
      return b.dayAge - a.dayAge
    })
  }
  
  /**
   * 标准化任务数据
   */
  normalizeTask(task: Record<string, unknown> = {}, overrides: Record<string, any> = {}) {
    return {
      // 🔧 关键修复：保留原始_id字段，这是数据库文档ID
      _id: task._id || task.id || '',
      id: task.id || task._id || '',
      taskId: task.taskId || task.id || task._id || '',
      batchId: task.batchId || this.pageInstance.data.currentBatchId || '',
      batchNumber: task.batchNumber || overrides.batchNumber || '',
      dayAge: task.dayAge || overrides.dayAge || 0,
      type: task.type || task.taskType || '',
      category: task.category || '',
      title: task.title || task.taskTitle || task.name || '',
      description: task.description || task.taskDescription || '',
      status: task.status || task.completed ? 'completed' : 'pending',
      completed: task.completed || task.status === 'completed',
      completedAt: task.completedAt || task.completeTime || '',
      isVaccine: task.type === 'vaccine',
      isMedication: task.type === 'medication' || task.type === 'medicine',
      isNutrition: task.type === 'nutrition',
      ...overrides
    }
  }
  
  /**
   * 完成任务
   */
  async completeTask(e: WechatMiniprogram.CustomEvent) {
    const { task } = e.currentTarget.dataset
    if (!task) return
    
    try {
      wx.showLoading({ title: '处理中...' })
      
      const result = await CloudApi.callFunction(
        'breeding-todo',
        {
          action: 'completeTask',
          taskId: task.taskId || task.id,
          batchId: task.batchId || this.pageInstance.data.currentBatchId
        }
      ) as BaseResponse
      
      wx.hideLoading()
      
      if (result?.success) {
        wx.showToast({
          title: '任务已完成',
          icon: 'success'
        })
        
        // 刷新当前任务列表
        await this.loadPreventionData()
      } else {
        throw new Error(result?.error || '操作失败')
      }
    } catch (error: Error | unknown) {
      wx.hideLoading()
      wx.showToast({
        title: (error as any)?.message || '完成任务失败',
        icon: 'none'
      })
    }
  }
  
  /**
   * 切换预防子标签
   */
  async onPreventionSubTabChange(e: WechatMiniprogram.CustomEvent) {
    const subTab = e.detail?.value || e.currentTarget?.dataset?.tab
    if (!subTab || subTab === this.pageInstance.data.preventionSubTab) return
    
    this.pageInstance.setData({ preventionSubTab: subTab })
    
    // 根据子标签加载对应数据
    switch (subTab) {
      case 'today':
        await this.loadTodayTasks()
        break
      case 'upcoming':
        await this.loadUpcomingTasks()
        break
      case 'history':
        await this.loadHistoryTasks()
        break
    }
  }
  
  /**
   * 查看记录详情
   */
  onViewRecord(e: WechatMiniprogram.CustomEvent) {
    const { recordId, type } = e.currentTarget.dataset
    if (!recordId) return
    
    // 根据类型导航到相应的详情页
    const urlMap: Record<string, string> = {
      vaccine: `/packageHealth/vaccination-detail/vaccination-detail?id=${recordId}`,
      medication: `/packageHealth/medication-detail/medication-detail?id=${recordId}`,
      nutrition: `/packageHealth/nutrition-detail/nutrition-detail?id=${recordId}`
    }
    
    const url = urlMap[type]
    if (url) {
      wx.navigateTo({ url })
    }
  }
  
  /**
   * 打开任务详情弹窗
   */
  openTaskDetailPopup(task: Record<string, unknown>) {
    this.pageInstance.setData({
      selectedTask: task,
      showTaskDetailPopup: true
    })
  }
  
  /**
   * 关闭任务详情弹窗
   */
  closeTaskDetailPopup() {
    this.pageInstance.setData({
      showTaskDetailPopup: false,
      selectedTask: null
    })
  }
}

/**
 * 创建预防模块实例
 */
export function createPreventionModule(pageInstance: Record<string, unknown>) {
  return new PreventionModuleManager(pageInstance)
}
