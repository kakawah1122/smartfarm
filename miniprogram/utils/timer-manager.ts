/**
 * 定时器管理工具
 * 提供安全的setTimeout管理，防止内存泄漏
 * 
 * 使用方式：
 * 1. 在Page/Component的data同级添加: ...TimerMixin
 * 2. 在onUnload/detached中调用: this._clearAllTimers()
 * 3. 使用 this._safeSetTimeout() 替代 setTimeout()
 */

// 定时器管理Mixin - 用于Page和Component
export const TimerMixin = {
  _timerIds: [] as number[],
  
  /**
   * 安全的setTimeout，自动管理定时器ID
   * @param callback 回调函数
   * @param delay 延迟时间（毫秒）
   * @returns 定时器ID
   */
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  /**
   * 清除所有定时器
   * 应在onUnload或detached生命周期中调用
   */
  _clearAllTimers() {
    this._timerIds.forEach((id: number) => clearTimeout(id))
    this._timerIds = []
  }
}

// 为Page创建定时器管理包装器
export function createTimerManagedPage<TData extends WechatMiniprogram.Page.DataOption>(
  pageConfig: WechatMiniprogram.Page.Options<TData, any>
): WechatMiniprogram.Page.Options<TData, any> {
  const originalOnUnload = pageConfig.onUnload
  
  return {
    ...TimerMixin,
    ...pageConfig,
    onUnload() {
      this._clearAllTimers()
      if (originalOnUnload) {
        originalOnUnload.call(this)
      }
    }
  }
}

// 为Component创建定时器管理包装器
export function createTimerManagedComponent<TData extends WechatMiniprogram.Component.DataOption>(
  componentConfig: WechatMiniprogram.Component.Options<TData, any, any>
): WechatMiniprogram.Component.Options<TData, any, any> {
  const originalDetached = componentConfig.lifetimes?.detached
  
  return {
    ...componentConfig,
    ...TimerMixin,
    lifetimes: {
      ...componentConfig.lifetimes,
      detached() {
        this._clearAllTimers()
        if (originalDetached) {
          originalDetached.call(this)
        }
      }
    }
  }
}
