/**
 * 健康管理页面事件管理模块
 * 负责处理防抖、节流、事件监听等功能
 * 保持原有功能不变，只是提取和模块化
 */

/// <reference path="../../../../typings/index.d.ts" />

/**
 * 防抖配置接口
 */
interface DebounceOptions {
  delay?: number        // 延迟时间（毫秒）
  immediate?: boolean   // 是否立即执行
}

/**
 * 节流配置接口
 */
interface ThrottleOptions {
  delay?: number        // 间隔时间（毫秒）
  trailing?: boolean    // 是否在最后执行一次
}

/**
 * 事件管理器
 */
export class HealthEventManager {
  // 默认防重复点击时间间隔
  static readonly DEFAULT_CLICK_INTERVAL = 500
  
  // 默认防抖延迟时间
  static readonly DEFAULT_DEBOUNCE_DELAY = 100
  
  // 默认节流间隔时间
  static readonly DEFAULT_THROTTLE_DELAY = 300
  
  /**
   * 防重复点击装饰器（高阶函数）
   * @param interval 防重复点击间隔（毫秒）
   */
  static preventDoubleClick(fn: Function, interval: number = this.DEFAULT_CLICK_INTERVAL) {
    let lastClickTime = 0
    
    return function(this: any, ...args: any[]) {
      const now = Date.now()
      if (now - lastClickTime < interval) {
        console.log('防重复点击：操作太频繁')
        return
      }
      lastClickTime = now
      return fn.apply(this, args)
    }
  }
  
  /**
   * 防抖函数
   * @param fn 需要防抖的函数
   * @param options 防抖配置
   */
  static debounce(fn: Function, options: DebounceOptions = {}) {
    const { 
      delay = this.DEFAULT_DEBOUNCE_DELAY, 
      immediate = false 
    } = options
    
    let timer: any = null
    let result: any
    
    const debounced = function(this: any, ...args: any[]) {
      const context = this
      
      const later = () => {
        timer = null
        if (!immediate) {
          result = fn.apply(context, args)
        }
      }
      
      const callNow = immediate && !timer
      
      if (timer) {
        clearTimeout(timer)
      }
      
      timer = setTimeout(later, delay)
      
      if (callNow) {
        result = fn.apply(context, args)
      }
      
      return result
    }
    
    // 添加取消方法
    debounced.cancel = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
    
    return debounced
  }
  
  /**
   * 节流函数
   * @param fn 需要节流的函数
   * @param options 节流配置
   */
  static throttle(fn: Function, options: ThrottleOptions = {}) {
    const { 
      delay = this.DEFAULT_THROTTLE_DELAY,
      trailing = true 
    } = options
    
    let timer: any = null
    let lastTime = 0
    let lastArgs: any[] | null = null
    let lastContext: any = null
    
    const throttled = function(this: any, ...args: any[]) {
      const context = this
      const now = Date.now()
      
      if (!lastTime) {
        lastTime = now
      }
      
      const remaining = delay - (now - lastTime)
      
      lastArgs = args
      lastContext = context
      
      if (remaining <= 0 || remaining > delay) {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        lastTime = now
        fn.apply(context, args)
      } else if (!timer && trailing) {
        timer = setTimeout(() => {
          lastTime = Date.now()
          timer = null
          if (lastArgs) {
            fn.apply(lastContext, lastArgs)
            lastArgs = null
            lastContext = null
          }
        }, remaining)
      }
    }
    
    // 添加取消方法
    throttled.cancel = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      lastTime = 0
      lastArgs = null
      lastContext = null
    }
    
    return throttled
  }
  
  /**
   * 为页面实例添加防重复点击功能
   * @param pageInstance 页面实例
   */
  static setupClickPrevention(pageInstance: any) {
    // 初始化点击时间记录
    if (!pageInstance.lastClickTime) {
      pageInstance.lastClickTime = 0
    }
    
    // 添加防重复点击检查方法
    pageInstance.checkDoubleClick = function(interval = HealthEventManager.DEFAULT_CLICK_INTERVAL) {
      const now = Date.now()
      if (now - this.lastClickTime < interval) {
        return true // 是重复点击
      }
      this.lastClickTime = now
      return false // 不是重复点击
    }
  }
  
  /**
   * 为页面实例设置防抖的数据加载
   * @param pageInstance 页面实例
   * @param loadFunction 数据加载函数
   * @param delay 防抖延迟
   */
  static setupDebouncedLoad(pageInstance: any, loadFunction: Function, delay = 100) {
    // 创建防抖版本的加载函数
    const debouncedLoad = this.debounce(loadFunction.bind(pageInstance), { delay })
    
    // 保存到页面实例
    pageInstance.debouncedLoadData = debouncedLoad
    
    // 在页面卸载时取消防抖
    const originalOnUnload = pageInstance.onUnload
    pageInstance.onUnload = function() {
      debouncedLoad.cancel()
      if (originalOnUnload) {
        originalOnUnload.call(this)
      }
    }
  }
  
  /**
   * 为滚动事件添加节流
   * @param pageInstance 页面实例
   * @param scrollHandler 滚动处理函数
   * @param delay 节流延迟
   */
  static setupThrottledScroll(pageInstance: any, scrollHandler: Function, delay = 100) {
    // 创建节流版本的滚动处理函数
    const throttledScroll = this.throttle(scrollHandler.bind(pageInstance), { 
      delay,
      trailing: true 
    })
    
    // 保存到页面实例
    pageInstance.throttledScrollHandler = throttledScroll
    
    // 在页面卸载时取消节流
    const originalOnUnload = pageInstance.onUnload
    pageInstance.onUnload = function() {
      throttledScroll.cancel()
      if (originalOnUnload) {
        originalOnUnload.call(this)
      }
    }
    
    return throttledScroll
  }
  
  /**
   * 创建一个带防重复点击的事件处理器
   * @param handler 原始事件处理函数
   * @param interval 防重复点击间隔
   */
  static createClickHandler(handler: Function, interval = this.DEFAULT_CLICK_INTERVAL) {
    let lastClickTime = 0
    
    return function(this: any, e: any) {
      const now = Date.now()
      if (now - lastClickTime < interval) {
        console.log('操作太频繁，请稍后再试')
        return
      }
      lastClickTime = now
      
      return handler.call(this, e)
    }
  }
  
  /**
   * 批量绑定防重复点击的事件处理器
   * @param pageInstance 页面实例
   * @param handlers 事件处理器映射
   */
  static bindClickHandlers(pageInstance: any, handlers: Record<string, Function>) {
    const wrappedHandlers: Record<string, Function> = {}
    
    for (const [name, handler] of Object.entries(handlers)) {
      wrappedHandlers[name] = this.createClickHandler(handler.bind(pageInstance))
    }
    
    // 将包装后的处理器绑定到页面实例
    Object.assign(pageInstance, wrappedHandlers)
    
    return wrappedHandlers
  }
  
  /**
   * 创建事件总线（用于跨页面通信）
   */
  static createEventBus() {
    const events: Record<string, Function[]> = {}
    
    return {
      // 注册事件监听器
      on(event: string, handler: Function) {
        if (!events[event]) {
          events[event] = []
        }
        events[event].push(handler)
      },
      
      // 触发事件
      emit(event: string, data?: any) {
        if (events[event]) {
          events[event].forEach(handler => {
            try {
              handler(data)
            } catch (error) {
              console.error(`事件处理器错误 [${event}]:`, error)
            }
          })
        }
      },
      
      // 移除事件监听器
      off(event: string, handler?: Function) {
        if (!events[event]) return
        
        if (handler) {
          const index = events[event].indexOf(handler)
          if (index > -1) {
            events[event].splice(index, 1)
          }
        } else {
          delete events[event]
        }
      },
      
      // 一次性事件监听器
      once(event: string, handler: Function) {
        const wrapper = (data: any) => {
          handler(data)
          this.off(event, wrapper)
        }
        this.on(event, wrapper)
      }
    }
  }
  
  /**
   * 设置页面数据更新的防抖
   * @param pageInstance 页面实例
   */
  static setupDataUpdateDebounce(pageInstance: any) {
    const originalSetData = pageInstance.setData.bind(pageInstance)
    
    // 创建防抖版本的 setData
    const debouncedSetData = this.debounce((data: any, callback?: Function) => {
      originalSetData(data, callback)
    }, { delay: 50 })
    
    // 添加立即更新和防抖更新两个方法
    pageInstance.setDataImmediate = originalSetData
    pageInstance.setDataDebounced = debouncedSetData
  }
}

/**
 * 快速设置页面事件管理
 * @param pageInstance 页面实例
 */
export function setupEventManagement(pageInstance: any) {
  // 设置防重复点击
  HealthEventManager.setupClickPrevention(pageInstance)
  
  // 设置数据更新防抖
  HealthEventManager.setupDataUpdateDebounce(pageInstance)
  
  // 返回事件管理器供页面使用
  return HealthEventManager
}

/**
 * 导出常用的事件处理工具
 */
export const {
  debounce,
  throttle,
  preventDoubleClick,
  createClickHandler
} = HealthEventManager
