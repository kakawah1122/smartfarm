/**
 * SetData智能包装器
 * 自动批量合并短时间内的多次setData调用
 * 保持功能和UI完全不变，仅优化性能
 */
import { logger } from '../../../utils/logger'

interface BatchedUpdate {
  data: Record<string, any>
  callbacks: Array<() => void>
  timestamp: number
}

// 页面实例接口
export interface PageInstance {
  setData: (data: Record<string, unknown>, callback?: () => void) => void
  [key: string]: unknown
}

export class SetDataWrapper {
  private page: PageInstance
  private originalSetData: (data: Record<string, unknown>, callback?: () => void) => void
  private pendingUpdate: BatchedUpdate | null = null
  private updateTimer: number | null = null
  private readonly batchDelay: number = 16 // 一帧时间
  private readonly maxBatchSize: number = 50 // 最大批量大小
  
  constructor(page: PageInstance) {
    this.page = page
    this.originalSetData = page.setData.bind(page)
    this.wrapSetData()
  }
  
  /**
   * 包装setData方法
   */
  private wrapSetData() {
    this.page.setData = (data: Record<string, any>, callback?: () => void) => {
      // 对于紧急更新，直接执行
      if (this.isUrgentUpdate(data)) {
        this.flush()
        this.originalSetData(data, callback)
        return
      }
      
      // 批量处理常规更新
      this.addToBatch(data, callback)
    }
  }
  
  /**
   * 判断是否为紧急更新
   */
  private isUrgentUpdate(data: Record<string, any>): boolean {
    // loading状态变化需要立即响应
    if ('loading' in data || 'refreshing' in data) {
      return true
    }
    
    // 弹窗状态需要立即响应
    const urgentKeys = ['showVaccineFormPopup', 'showMedicationFormPopup', 'showNutritionFormPopup']
    return urgentKeys.some(key => key in data)
  }
  
  /**
   * 添加到批量更新
   */
  private addToBatch(data: Record<string, any>, callback?: () => void) {
    if (!this.pendingUpdate) {
      this.pendingUpdate = {
        data: {},
        callbacks: [],
        timestamp: Date.now()
      }
    }
    
    // 合并数据
    Object.assign(this.pendingUpdate.data, data)
    
    // 收集回调
    if (callback) {
      this.pendingUpdate.callbacks.push(callback)
    }
    
    // 如果批量大小超过限制，立即执行
    if (Object.keys(this.pendingUpdate.data).length >= this.maxBatchSize) {
      this.flush()
      return
    }
    
    // 调度批量更新
    this.scheduleUpdate()
  }
  
  /**
   * 调度更新
   */
  private scheduleUpdate() {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
    }
    
    this.updateTimer = setTimeout(() => {
      this.flush()
    }, this.batchDelay)
  }
  
  /**
   * 执行批量更新
   */
  private flush() {
    if (!this.pendingUpdate || Object.keys(this.pendingUpdate.data).length === 0) {
      return
    }
    
    const update = this.pendingUpdate
    this.pendingUpdate = null
    
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
    
    // 执行批量setData
    this.originalSetData(update.data, () => {
      // 执行所有回调
      update.callbacks.forEach(cb => {
        try {
          cb()
        } catch (error) {
          logger.error('SetData callback error:', error)
        }
      })
    })
  }
  
  /**
   * 销毁包装器
   */
  destroy() {
    this.flush()
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
    }
    // 恢复原始setData
    this.page.setData = this.originalSetData
  }
}

/**
 * 创建setData包装器
 */
export function createSetDataWrapper(page: PageInstance): SetDataWrapper {
  return new SetDataWrapper(page)
}
