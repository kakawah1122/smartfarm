/**
 * 健康管理 - 预防任务模块
 * 负责管理今日任务、即将到来任务、历史任务等预防相关功能
 * 保持原有功能和UI完全不变
 */

import { safeCloudCall } from '../../../utils/cloud-helper'
import { calculateCurrentAge } from '../../../utils/date-utils'
import { logger } from '../../../utils/logger'
import { BaseResponse } from '../../../types/health.d'
import type {
  BatchData,
  PreventionTask,
  BatchTaskData,
  PageInstance,
  TaskOverrides,
  GroupedTasks
} from './types'

// 预防任务模块管理器
export class PreventionModuleManager {
  private pageInstance: PageInstance
  
  constructor(pageInstance: PageInstance) {
    this.pageInstance = pageInstance
  }
  
  /**
   * 加载预防数据
   */
  async loadPreventionData() {
    try {
      // 根据当前子标签加载相应数据
      const subTab = this.pageInstance.data.preventionSubTab
      
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
        default:
          await this.loadTodayTasks()
      }
    } catch (error) {
      logger.error('加载预防数据失败:', error)
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
    }
  }
  
  /**
   * 加载今日任务
   */
  async loadTodayTasks() {
    try {
      // 获取批次列表
      let batches: BatchData[] = []
      
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
          (b: BatchData) => b._id === this.pageInstance.data.currentBatchId
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
      const batchTasksPromises = batches.map(async (batch: BatchData) => {
        try {
          const dayAge = batch.dayAge || calculateCurrentAge(batch.entryDate)
          const result = await safeCloudCall({
            name: 'breeding-todo',
            data: {
              action: 'getTodos',
              batchId: batch._id || this.pageInstance.data.currentBatchId,
              dayAge: dayAge
            }
          })
          
          const response = result as BaseResponse<PreventionTask[]>
          if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
            const tasks = response.data
            const normalizedTasks = tasks.map((task: PreventionTask) =>
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
        } catch (error: any) {
          logger.error(`批次任务加载失败:`, error)
          return null
        }
      })
      
      const results = await Promise.all(batchTasksPromises)
      const validBatchTasks = results.filter((item: any) => item !== null && item.tasks.length > 0)
      
      // 收集所有任务
      let allTasks: any[] = []
      validBatchTasks.forEach((batchData: any) => {
        allTasks = allTasks.concat(batchData.tasks)
      })
      
      this.pageInstance.setData({
        todayTasksByBatch: validBatchTasks,
        'preventionData.todayTasks': allTasks
      })
      
    } catch (error: any) {
      logger.error('加载今日任务失败:', error)
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
      let batches: BatchData[] = []
      
      if (this.pageInstance.data.currentBatchId === 'all') {
        // 全部批次模式
        batches = this.pageInstance.data.availableBatches || []
      } else {
        // 单批次模式
        const currentBatch = this.pageInstance.data.availableBatches?.find(
          (b: BatchData) => b._id === this.pageInstance.data.currentBatchId
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
      const upcomingPromises = batches.map(async (batch: any) => {
        try {
          const currentDayAge = batch.dayAge || calculateCurrentAge(batch.entryDate)
          const result = await safeCloudCall({
            name: 'breeding-todo',
            data: {
              action: 'getUpcomingTodos',
              batchId: batch._id,
              startDayAge: currentDayAge + 1,
              endDayAge: currentDayAge + 7
            }
          })
          
          const response = result as BaseResponse
          if (response.success && response.data) {
            const tasks = Array.isArray(response.data) ? response.data : []
            const normalizedTasks = tasks.map((task: any) =>
              this.normalizeTask(task, {
                batchNumber: batch.batchNumber || batch._id
              })
            )
            
            // 按日龄分组
            const tasksByDayAge: Record<number, any[]> = {}
            normalizedTasks.forEach((task: any) => {
              const dayAge = task.dayAge || currentDayAge
              if (!tasksByDayAge[dayAge]) {
                tasksByDayAge[dayAge] = []
              }
              tasksByDayAge[dayAge].push(task)
            })
            
            // 转换为数组格式
            return Object.entries(tasksByDayAge).map(([dayAge, dayTasks]) => ({
              id: `${batch._id}_${dayAge}`,
              batchId: batch._id,
              batchNumber: batch.batchNumber || batch._id,
              dayAge: parseInt(dayAge),
              tasks: dayTasks
            }))
          }
          return []
        } catch (error: any) {
          logger.error(`批次未来任务加载失败:`, error)
          return []
        }
      })
      
      const results = await Promise.all(upcomingPromises)
      const allBatchTasks = results.flat().filter(item => item && item.tasks && item.tasks.length > 0)
      
      // 按日龄排序
      allBatchTasks.sort((a, b) => a.dayAge - b.dayAge)
      
      // 收集所有任务
      let allTasks: any[] = []
      allBatchTasks.forEach((batchData: any) => {
        allTasks = allTasks.concat(batchData.tasks)
      })
      
      this.pageInstance.setData({
        upcomingTasksByBatch: allBatchTasks,
        'preventionData.upcomingTasks': allTasks
      })
      
    } catch (error: any) {
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
        const tasks = Array.isArray(result.data) ? result.data : []
        const normalizedTasks = tasks.map((task: any) => this.normalizeTask(task))
        
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
    } catch (error: any) {
      logger.error('加载历史任务失败:', error)
      this.pageInstance.setData({
        historyTasksByBatch: [],
        'preventionData.historyTasks': []
      })
    }
  }
  
  /**
   * 分组历史任务（按批次和日龄组合分组）
   */
  groupHistoryTasksByBatch(tasks: any[] = []) {
    const batchMap: Record<string, any> = {}
    
    tasks.forEach((task: any) => {
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
  normalizeTask(task: any = {}, overrides: Record<string, any> = {}) {
    return {
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
    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '操作失败',
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
  openTaskDetailPopup(task: any) {
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
export function createPreventionModule(pageInstance: any) {
  return new PreventionModuleManager(pageInstance)
}
