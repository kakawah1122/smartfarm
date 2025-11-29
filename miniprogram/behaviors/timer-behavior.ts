/// <reference path="../../typings/index.d.ts" />

/**
 * 定时器管理 Behavior
 * 用于 Component 中安全管理定时器，避免内存泄漏
 * 
 * 使用方式：
 * ```typescript
 * import { timerBehavior } from '../../behaviors/timer-behavior'
 * 
 * Component({
 *   behaviors: [timerBehavior],
 *   methods: {
 *     someMethod() {
 *       this._safeSetTimeout(() => {
 *         // 延时执行的代码
 *       }, 1000)
 *     }
 *   }
 * })
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyThis = any

export const timerBehavior = Behavior({
  data: {
    /** 定时器 ID 列表（内部使用） */
    _timerIds: [] as number[]
  },

  methods: {
    /**
     * 安全设置定时器（自动跟踪 ID，组件销毁时自动清理）
     */
    _safeSetTimeout(this: AnyThis, callback: () => void, delay: number): number {
      const timerId = setTimeout(() => {
        // 执行后从列表中移除
        const index = this.data._timerIds.indexOf(timerId as unknown as number)
        if (index > -1) {
          const newTimerIds = [...this.data._timerIds]
          newTimerIds.splice(index, 1)
          this.setData({ _timerIds: newTimerIds })
        }
        callback()
      }, delay) as unknown as number

      // 添加到跟踪列表
      this.setData({
        _timerIds: [...this.data._timerIds, timerId]
      })

      return timerId
    },

    /**
     * 安全设置间隔定时器
     */
    _safeSetInterval(this: AnyThis, callback: () => void, interval: number): number {
      const timerId = setInterval(callback, interval) as unknown as number

      this.setData({
        _timerIds: [...this.data._timerIds, timerId]
      })

      return timerId
    },

    /**
     * 清除单个定时器
     */
    _clearTimer(this: AnyThis, timerId: number): void {
      clearTimeout(timerId)
      clearInterval(timerId)

      const index = this.data._timerIds.indexOf(timerId)
      if (index > -1) {
        const newTimerIds = [...this.data._timerIds]
        newTimerIds.splice(index, 1)
        this.setData({ _timerIds: newTimerIds })
      }
    },

    /**
     * 清除所有定时器（组件销毁时自动调用）
     */
    _clearAllTimers(this: AnyThis): void {
      this.data._timerIds.forEach((id: number) => {
        clearTimeout(id)
        clearInterval(id)
      })
      this.setData({ _timerIds: [] })
    }
  },

  lifetimes: {
    /**
     * 组件销毁时自动清理所有定时器
     */
    detached(this: AnyThis) {
      this._clearAllTimers()
    }
  }
})

/**
 * 定时器 Behavior 的类型定义
 * 用于在 Component 中获得正确的类型提示
 */
export interface TimerBehaviorData {
  _timerIds: number[]
}

export interface TimerBehaviorMethods {
  _safeSetTimeout(callback: () => void, delay: number): number
  _safeSetInterval(callback: () => void, interval: number): number
  _clearTimer(timerId: number): void
  _clearAllTimers(): void
}
