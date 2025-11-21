/**
 * 通用事件管理器
 * 提供防抖、节流、事件总线等功能
 * 
 * @module common/event-manager
 * @since 1.0.0
 */

/// <reference path="../../../typings/index.d.ts" />

/**
 * 防抖配置
 */
export interface DebounceOptions {
  delay?: number
  immediate?: boolean
  maxWait?: number
}

/**
 * 节流配置
 */
export interface ThrottleOptions {
  delay?: number
  leading?: boolean
  trailing?: boolean
}

/**
 * 事件监听器
 */
export interface EventListener {
  id: string
  callback: Function
  once?: boolean
  context?: unknown}

/**
 * 事件管理器
 */
export class EventManager {
  // 全局事件总线
  private static eventBus: Map<string, EventListener[]> = new Map()
  
  // 防抖函数缓存
  private static debouncedFunctions: WeakMap<Function, Function> = new WeakMap()
  
  // 节流函数缓存
  private static throttledFunctions: WeakMap<Function, Function> = new WeakMap()
  
  /**
   * 防抖函数
   * @param fn 需要防抖的函数
   * @param options 防抖配置
   */
  static debounce<T extends Function>(
    fn: T,
    options: DebounceOptions = {}
  ): T & { cancel: () => void; flush: () => void } {
    const {
      delay = 300,
      immediate = false,
      maxWait = 0
    } = options
    
    let timer: any = null
    let lastCallTime: number | null = null
    let lastArgs: unknown[] | null = null
    let lastContext: any = null
    let result: any
    
    const invokeFunc = () => {
      const args = lastArgs
      const context = lastContext
      
      lastArgs = null
      lastContext = null
      lastCallTime = null
      
      result = fn.apply(context, args!)
      return result
    }
    
    const startTimer = (wait: number) => {
      timer = setTimeout(() => {
        timer = null
        if (!immediate && lastArgs) {
          invokeFunc()
        }
      }, wait)
    }
    
    const cancelTimer = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
    
    const debounced = function(this: unknown, ...args: unknown[]) {
      lastArgs = args
      lastContext = this
      
      const now = Date.now()
      
      // 处理maxWait
      if (maxWait > 0) {
        if (!lastCallTime) {
          lastCallTime = now
        } else if (now - lastCallTime >= maxWait) {
          cancelTimer()
          lastCallTime = now
          return invokeFunc()
        }
      }
      
      cancelTimer()
      
      if (immediate && !timer) {
        result = invokeFunc()
      } else {
        const wait = maxWait > 0 && lastCallTime
          ? Math.min(delay, maxWait - (now - lastCallTime))
          : delay
        
        startTimer(wait)
      }
      
      return result
    } as unknown as T & { cancel: () => void; flush: () => void }
    
    debounced.cancel = () => {
      cancelTimer()
      lastArgs = null
      lastContext = null
      lastCallTime = null
    }
    
    debounced.flush = () => {
      if (timer && lastArgs) {
        cancelTimer()
        invokeFunc()
      }
    }
    
    // 缓存防抖函数
    this.debouncedFunctions.set(fn, debounced)
    
    return debounced
  }
  
  /**
   * 节流函数
   * @param fn 需要节流的函数
   * @param options 节流配置
   */
  static throttle<T extends Function>(
    fn: T,
    options: ThrottleOptions = {}
  ): T & { cancel: () => void } {
    const {
      delay = 300,
      leading = true,
      trailing = true
    } = options
    
    let timer: any = null
    let lastCallTime = 0
    let lastArgs: unknown[] | null = null
    let lastContext: any = null
    
    const invokeFunc = () => {
      const args = lastArgs
      const context = lastContext
      
      lastArgs = null
      lastContext = null
      
      return fn.apply(context, args!)
    }
    
    const throttled = function(this: unknown, ...args: unknown[]) {
      const now = Date.now()
      
      if (!lastCallTime && !leading) {
        lastCallTime = now
      }
      
      const remaining = delay - (now - lastCallTime)
      
      lastArgs = args
      lastContext = this
      
      if (remaining <= 0 || remaining > delay) {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        
        lastCallTime = now
        return invokeFunc()
      } else if (!timer && trailing) {
        timer = setTimeout(() => {
          lastCallTime = leading ? Date.now() : 0
          timer = null
          
          if (lastArgs) {
            invokeFunc()
          }
        }, remaining)
      }
    } as unknown as T & { cancel: () => void }
    
    throttled.cancel = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      lastCallTime = 0
      lastArgs = null
      lastContext = null
    }
    
    // 缓存节流函数
    this.throttledFunctions.set(fn, throttled)
    
    return throttled
  }
  
  /**
   * 获取已缓存的防抖函数
   */
  static getDebouncedFunction(fn: Function): Function | undefined {
    return this.debouncedFunctions.get(fn)
  }
  
  /**
   * 获取已缓存的节流函数
   */
  static getThrottledFunction(fn: Function): Function | undefined {
    return this.throttledFunctions.get(fn)
  }
  
  /**
   * 发布事件
   * @param event 事件名称
   * @param data 事件数据
   */
  static emit(event: string, data?: unknown) {
    const listeners = this.eventBus.get(event)
    
    if (!listeners || listeners.length === 0) {
      return
    }
    
    // 复制监听器数组，防止在遍历过程中被修改
    const listenersToCall = [...listeners]
    
    listenersToCall.forEach(listener => {
      try {
        listener.callback.call(listener.context, data)
        
        // 如果是一次性监听器，移除它
        if (listener.once) {
          this.off(event, listener.id)
        }
      } catch (error) {
        console.error(`事件 ${event} 的监听器执行失败:`, error)
      }
    })
  }
  
  /**
   * 订阅事件
   * @param event 事件名称
   * @param callback 回调函数
   * @param context 上下文
   */
  static on(event: string, callback: Function, context?: unknown): string {
    const id = this.generateListenerId()
    
    const listener: EventListener = {
      id,
      callback,
      context
    }
    
    if (!this.eventBus.has(event)) {
      this.eventBus.set(event, [])
    }
    
    this.eventBus.get(event)!.push(listener)
    
    return id
  }
  
  /**
   * 订阅一次性事件
   * @param event 事件名称
   * @param callback 回调函数
   * @param context 上下文
   */
  static once(event: string, callback: Function, context?: unknown): string {
    const id = this.generateListenerId()
    
    const listener: EventListener = {
      id,
      callback,
      once: true,
      context
    }
    
    if (!this.eventBus.has(event)) {
      this.eventBus.set(event, [])
    }
    
    this.eventBus.get(event)!.push(listener)
    
    return id
  }
  
  /**
   * 取消订阅
   * @param event 事件名称
   * @param idOrCallback 监听器ID或回调函数
   */
  static off(event: string, idOrCallback?: string | Function) {
    const listeners = this.eventBus.get(event)
    
    if (!listeners || listeners.length === 0) {
      return
    }
    
    if (!idOrCallback) {
      // 移除所有监听器
      this.eventBus.delete(event)
      return
    }
    
    // 移除指定的监听器
    const filtered = listeners.filter(listener => {
      if (typeof idOrCallback === 'string') {
        return listener.id !== idOrCallback
      } else {
        return listener.callback !== idOrCallback
      }
    })
    
    if (filtered.length === 0) {
      this.eventBus.delete(event)
    } else {
      this.eventBus.set(event, filtered)
    }
  }
  
  /**
   * 清除所有事件监听
   */
  static clear() {
    this.eventBus.clear()
  }
  
  /**
   * 生成监听器ID
   */
  private static generateListenerId(): string {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * 创建独立的事件总线实例
   */
  static createEventBus() {
    const eventBus = new Map<string, EventListener[]>()
    
    return {
      emit(event: string, data?: unknown) {
        const listeners = eventBus.get(event)
        
        if (!listeners || listeners.length === 0) {
          return
        }
        
        listeners.forEach(listener => {
          try {
            listener.callback.call(listener.context, data)
            
            if (listener.once) {
              this.off(event, listener.id)
            }
          } catch (error) {
            console.error(`事件 ${event} 执行失败:`, error)
          }
        })
      },
      
      on(event: string, callback: Function, context?: unknown): string {
        const id = EventManager.generateListenerId()
        
        const listener: EventListener = {
          id,
          callback,
          context
        }
        
        if (!eventBus.has(event)) {
          eventBus.set(event, [])
        }
        
        eventBus.get(event)!.push(listener)
        
        return id
      },
      
      once(event: string, callback: Function, context?: unknown): string {
        const id = EventManager.generateListenerId()
        
        const listener: EventListener = {
          id,
          callback,
          once: true,
          context
        }
        
        if (!eventBus.has(event)) {
          eventBus.set(event, [])
        }
        
        eventBus.get(event)!.push(listener)
        
        return id
      },
      
      off(event: string, idOrCallback?: string | Function) {
        const listeners = eventBus.get(event)
        
        if (!listeners || listeners.length === 0) {
          return
        }
        
        if (!idOrCallback) {
          eventBus.delete(event)
          return
        }
        
        const filtered = listeners.filter(listener => {
          if (typeof idOrCallback === 'string') {
            return listener.id !== idOrCallback
          } else {
            return listener.callback !== idOrCallback
          }
        })
        
        if (filtered.length === 0) {
          eventBus.delete(event)
        } else {
          eventBus.set(event, filtered)
        }
      },
      
      clear() {
        eventBus.clear()
      }
    }
  }
}

/**
 * 导出便捷方法
 */
export const debounce = EventManager.debounce.bind(EventManager)
export const throttle = EventManager.throttle.bind(EventManager)
export const emit = EventManager.emit.bind(EventManager)
export const on = EventManager.on.bind(EventManager)
export const once = EventManager.once.bind(EventManager)
export const off = EventManager.off.bind(EventManager)
export const createEventBus = EventManager.createEventBus.bind(EventManager)

/**
 * 导出默认实例
 */
export default EventManager
