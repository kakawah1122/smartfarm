/**
 * 健康管理模块专用类型定义
 */

/**
 * 批次数据类型
 */
export interface BatchData {
  _id: string
  batchNumber?: string
  batchId?: string
  entryDate?: string | Date
  dayAge?: number
  currentQuantity?: number
  status?: 'active' | 'inactive' | 'completed'
  breed?: string
  userId?: string
  _openid?: string
}

/**
 * 预防任务数据
 */
export interface PreventionTask {
  id?: string
  _id?: string
  taskId?: string
  taskName?: string
  type?: string
  status?: string
  completed?: boolean
  dayAge?: number
  batchNumber?: string
  batchId?: string
  dueDate?: string
  description?: string
  preventionType?: string
  targetCount?: number
  actualCount?: number
  createTime?: string | Date
  updateTime?: string | Date
  [key: string]: any
}

/**
 * 批次任务数据
 */
export interface BatchTaskData {
  batchNumber: string
  batchName?: string
  dayAge: number
  tasks: PreventionTask[]
}

/**
 * 基础响应类型
 */
export interface BaseResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  errMsg?: string
}

/**
 * 页面实例类型
 */
export interface PageInstance {
  data: {
    currentBatchId?: string
    viewMode?: string
    availableBatches?: BatchData[]
    todayTasksByBatch?: BatchTaskData[]
    upcomingTasksByBatch?: BatchTaskData[]
    historyTasksByBatch?: BatchTaskData[]
    preventionData?: {
      todayTasks?: PreventionTask[]
      upcomingTasks?: PreventionTask[]
      historyTasks?: PreventionTask[]
    }
    selectedTask?: PreventionTask
    showTaskDetailPopup?: boolean
    showTaskDrawer?: boolean
    [key: string]: any
  }
  setData: (data: any, callback?: () => void) => void
  refreshPreventionData?: () => void
  completeNormalTask?: (taskId: string, completed: boolean) => Promise<void>
}

/**
 * 云函数调用参数
 */
export interface CloudCallParams {
  name: string
  data: Record<string, any>
}

/**
 * 任务覆盖数据
 */
export interface TaskOverrides {
  batchNumber?: string
  dayAge?: number
  [key: string]: any
}

/**
 * 分组后的任务数据
 */
export interface GroupedTasks {
  [key: string]: {
    batchNumber: string
    batchName?: string
    dayAge: number
    tasks: PreventionTask[]
  }
}
