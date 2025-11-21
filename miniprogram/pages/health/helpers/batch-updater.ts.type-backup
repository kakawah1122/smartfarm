/**
 * 批量更新工具
 * 用于合并多次setData调用，提升性能
 */

export class BatchUpdater {
  private pendingUpdates: Record<string, any> = {}
  private updateTimer: number | null = null
  private pageInstance: any
  
  constructor(pageInstance: any) {
    this.pageInstance = pageInstance
  }
  
  /**
   * 添加待更新的数据
   * @param updates 要更新的数据对象
   * @param immediate 是否立即执行
   */
  update(updates: Record<string, any>, immediate = false) {
    // 合并更新
    Object.assign(this.pendingUpdates, updates)
    
    if (immediate) {
      this.flush()
    } else {
      this.scheduleUpdate()
    }
  }
  
  /**
   * 调度更新（使用微任务）
   */
  private scheduleUpdate() {
    if (this.updateTimer) return
    
    this.updateTimer = setTimeout(() => {
      this.flush()
    }, 0) as any
  }
  
  /**
   * 执行批量更新
   */
  flush() {
    if (Object.keys(this.pendingUpdates).length === 0) return
    
    // 执行setData
    this.pageInstance.setData(this.pendingUpdates)
    
    // 清空待更新数据
    this.pendingUpdates = {}
    
    // 清除定时器
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
  }
  
  /**
   * 清空所有待更新数据
   */
  clear() {
    this.pendingUpdates = {}
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
  }
}

/**
 * 创建批量更新器
 */
export function createBatchUpdater(pageInstance: any): BatchUpdater {
  return new BatchUpdater(pageInstance)
}
