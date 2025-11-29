// breeding-todo-data.ts - 数据加载服务
import CloudApi from '../../utils/cloud-api'
import { logger } from '../../utils/logger'
import type { Task, BatchInfo, TasksByBatch, CloudResult } from './breeding-todo-types'

/**
 * 计算日龄
 */
export function calculateCurrentAge(entryDate: string): number {
  if (!entryDate) return 1
  const entryTime = new Date(entryDate).getTime()
  const currentTime = new Date().getTime()
  const dayAge = Math.floor((currentTime - entryTime) / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, dayAge)
}

/**
 * 获取当前批次ID（从缓存或全局状态）
 */
export function getCurrentBatchId(): string {
  return wx.getStorageSync('currentBatchId') || ''
}

/**
 * 保存当前批次ID到缓存
 */
export function saveCurrentBatchId(batchId: string): void {
  wx.setStorageSync('currentBatchId', batchId)
}

/**
 * 获取活跃批次列表
 */
export async function getActiveBatches(): Promise<BatchInfo[]> {
  try {
    const batchResult = await wx.cloud.callFunction({
      name: 'production-entry',
      data: { action: 'getActiveBatches' }
    }) as { result?: CloudResult<BatchInfo[]> }

    return (batchResult.result?.data as BatchInfo[]) || []
  } catch (error) {
    logger.error('获取活跃批次失败:', error)
    return []
  }
}

/**
 * 获取默认批次
 */
export async function getDefaultBatch(): Promise<BatchInfo | null> {
  const activeBatches = await getActiveBatches()
  
  if (activeBatches.length === 0) {
    return null
  }

  return activeBatches[0]
}

/**
 * 加载单个批次的任务
 */
export async function loadBatchTodos(batchId: string, dayAge: number): Promise<Task[]> {
  try {
    const result = await CloudApi.getTodos(batchId, dayAge) as CloudResult<Task[]>
    
    if (result.success && result.data) {
      return Array.isArray(result.data) ? result.data : []
    }
    return []
  } catch (error) {
    logger.error('加载任务失败:', error)
    return []
  }
}

/**
 * 计算任务统计
 */
export function calculateTaskStats(tasks: Task[]): {
  completedCount: number
  totalCount: number
  completionRate: string
} {
  const totalCount = tasks.length
  const completedCount = tasks.filter((task: Task) => task.completed).length
  const completionRate = totalCount > 0 
    ? ((completedCount / totalCount) * 100).toFixed(1) + '%' 
    : '0%'
  
  return { completedCount, totalCount, completionRate }
}

/**
 * 加载所有批次的今日待办任务
 */
export async function loadAllBatchesTodayTasks(): Promise<{
  tasksByBatch: TasksByBatch[]
  activeBatchCount: number
  allTasksCount: number
  allCompletedCount: number
  allCompletionPercentage: number
}> {
  const activeBatches = await getActiveBatches()
  
  if (activeBatches.length === 0) {
    return {
      tasksByBatch: [],
      activeBatchCount: 0,
      allTasksCount: 0,
      allCompletedCount: 0,
      allCompletionPercentage: 0
    }
  }

  // 为每个活跃批次获取今日任务
  const batchTasksPromises = activeBatches.map(async (batch: BatchInfo): Promise<TasksByBatch> => {
    try {
      const dayAge = calculateCurrentAge(batch.entryDate || '')
      const tasks = await loadBatchTodos(batch._id, dayAge)
      
      return {
        batchId: batch._id,
        batchNumber: batch.batchNumber || batch._id,
        dayAge: dayAge,
        tasks: tasks.map((task: Task) => ({
          ...task,
          batchNumber: batch.batchNumber || batch._id,
          dayAge: dayAge
        }))
      }
    } catch (error) {
      return {
        batchId: batch._id,
        batchNumber: batch.batchNumber || batch._id,
        dayAge: calculateCurrentAge(batch.entryDate || ''),
        tasks: []
      }
    }
  })

  const batchTasksResults = await Promise.all(batchTasksPromises)
  
  // 计算总体统计
  let allTasksCount = 0
  let allCompletedCount = 0
  
  batchTasksResults.forEach((batchData) => {
    allTasksCount += batchData.tasks.length
    allCompletedCount += batchData.tasks.filter((task: Task) => task.completed).length
  })
  
  const allCompletionPercentage = allTasksCount > 0 
    ? Math.round((allCompletedCount / allTasksCount) * 100) 
    : 0

  return {
    tasksByBatch: batchTasksResults,
    activeBatchCount: activeBatches.length,
    allTasksCount,
    allCompletedCount,
    allCompletionPercentage
  }
}

/**
 * 完成普通任务
 */
export async function completeTask(taskId: string, batchId: string): Promise<boolean> {
  try {
    const result = await CloudApi.callFunction('lifecycle-management', {
      action: 'completeTask',
      taskId,
      batchId,
      completedAt: new Date().toISOString()
    }) as CloudResult

    return result.success === true
  } catch (error) {
    logger.error('完成任务失败:', error)
    return false
  }
}

/**
 * 查找任务（在所有批次任务中）
 */
export function findTaskById(
  taskId: string, 
  todos: Task[], 
  tasksByBatch: TasksByBatch[]
): Task | null {
  // 先在单批次任务中查找
  let task = todos.find((t: Task) => 
    t._id === taskId || t.id === taskId || t.taskId === taskId
  )
  
  // 如果没找到，在全部批次任务中查找
  if (!task && tasksByBatch.length > 0) {
    for (const batch of tasksByBatch) {
      task = batch.tasks.find((t: Task) => 
        t._id === taskId || t.id === taskId || t.taskId === taskId
      )
      if (task) break
    }
  }
  
  return task || null
}
