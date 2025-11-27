/**
 * setData批量更新器
 * 用于合并短时间内的多次setData调用，提升性能
 * 符合项目开发规范，不改变业务逻辑和UI
 */
import { logger } from '../../../utils/logger'

interface BatchUpdate {
  [key: string]: unknown
}

// 页面/组件实例接口（支持setData方法）
export interface PageInstance {
  setData: (data: Record<string, unknown>, callback?: () => void) => void
}

export class SetDataBatcher {
  private page: PageInstance
  private updates: BatchUpdate = {}
  private timer: number | null = null
  private delay: number
  private isProcessing: boolean = false

  constructor(page: PageInstance, delay: number = 16) { // 默认一帧时间
    this.page = page
    this.delay = delay
  }

  /**
   * 添加更新项（不立即执行）
   * @param path 数据路径
   * @param value 数据值
   */
  add(path: string, value: unknown): void {
    this.updates[path] = value
    this.scheduleUpdate()
  }

  /**
   * 批量添加更新项
   * @param updates 更新对象
   */
  addBatch(updates: BatchUpdate): void {
    Object.assign(this.updates, updates)
    this.scheduleUpdate()
  }

  /**
   * 调度更新（防抖）
   */
  private scheduleUpdate(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => {
      this.flush()
    }, this.delay) as unknown as number
  }

  /**
   * 立即执行所有待更新项
   */
  flush(): void {
    if (this.isProcessing || Object.keys(this.updates).length === 0) {
      return
    }

    this.isProcessing = true
    const updatesCopy = { ...this.updates }
    this.updates = {}
    this.timer = null

    try {
      // 执行setData
      this.page.setData(updatesCopy, () => {
        this.isProcessing = false
      })
    } catch (error) {
      logger.error('SetDataBatcher flush error:', error)
      this.isProcessing = false
    }
  }

  /**
   * 清空所有待更新项
   */
  clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.updates = {}
    this.isProcessing = false
  }

  /**
   * 销毁批量更新器
   */
  destroy(): void {
    this.clear()
    this.page = null
  }
}

/**
 * 创建setData批量更新器
 * @param page 页面实例
 * @param delay 延迟时间（ms）
 * @returns SetDataBatcher实例
 */
export function createSetDataBatcher(page: PageInstance, delay?: number): SetDataBatcher {
  return new SetDataBatcher(page, delay)
}

/**
 * 数据差异比较工具
 * 只更新真正变化的数据，减少不必要的渲染
 */
export class DataDiffer {
  /**
   * 比较两个对象，返回差异部分
   * @param oldData 旧数据
   * @param newData 新数据
   * @param prefix 路径前缀
   * @returns 差异对象
   */
  static diff(oldData: unknown, newData: unknown, prefix: string = ''): BatchUpdate {
    const updates: BatchUpdate = {}

    // 如果是基础类型或null，直接比较
    if (oldData === newData) {
      return updates
    }

    if (typeof newData !== 'object' || newData === null) {
      if (oldData !== newData) {
        updates[prefix || 'value'] = newData
      }
      return updates
    }

    // 对象或数组的差异比较
    Object.keys(newData).forEach(key => {
      const path = prefix ? `${prefix}.${key}` : key
      const oldValue = oldData?.[key]
      const newValue = newData[key]

      if (oldValue !== newValue) {
        // 如果是对象，继续递归比较
        if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
          const nestedDiff = DataDiffer.diff(oldValue || {}, newValue, path)
          Object.assign(updates, nestedDiff)
        } else {
          // 基础类型或数组，直接更新
          updates[path] = newValue
        }
      }
    })

    return updates
  }

  /**
   * 应用差异更新（使用批量更新器）
   * @param page 页面实例
   * @param oldData 旧数据
   * @param newData 新数据
   * @param batcher 批量更新器（可选）
   */
  static applyDiff(page: PageInstance, oldData: unknown, newData: unknown, batcher?: SetDataBatcher): void {
    const updates = DataDiffer.diff(oldData, newData)
    
    if (Object.keys(updates).length === 0) {
      return // 没有变化，不需要更新
    }

    if (batcher) {
      batcher.addBatch(updates)
    } else {
      page.setData(updates)
    }
  }
}
