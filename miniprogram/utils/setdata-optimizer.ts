/**
 * SetData 批量优化器
 * 用于合并频繁的setData调用，减少渲染次数，提升性能
 * 不会改变任何功能逻辑和UI表现
 */

interface PendingData {
  [key: string]: any
}

interface OptimizedComponent {
  setData: (data: any, callback?: () => void) => void
  _optimizedSetData?: (data: any, callback?: () => void) => void
  _pendingData?: PendingData
  _pendingCallbacks?: Array<() => void>
  _updateTimer?: number
}

/**
 * 创建优化的setData方法
 * @param component 页面或组件实例
 * @param options 优化选项
 */
export function optimizeSetData(
  component: OptimizedComponent,
  options: {
    delay?: number      // 批量延迟时间（毫秒），默认16ms（一帧）
    maxWait?: number    // 最大等待时间（毫秒），默认100ms
  } = {}
) {
  const { delay = 16, maxWait = 100 } = options
  
  // 保存原始的setData方法
  if (!component._optimizedSetData) {
    component._optimizedSetData = component.setData.bind(component)
  }
  
  // 初始化待处理数据
  component._pendingData = {}
  component._pendingCallbacks = []
  
  let firstCallTime = 0
  
  // 执行批量更新
  const flushUpdate = () => {
    if (!component._pendingData || Object.keys(component._pendingData).length === 0) {
      return
    }
    
    // 合并所有待处理数据
    const mergedData = { ...component._pendingData }
    const callbacks = [...(component._pendingCallbacks || [])]
    
    // 清空待处理数据
    component._pendingData = {}
    component._pendingCallbacks = []
    component._updateTimer = undefined
    firstCallTime = 0
    
    // 执行原始setData
    component._optimizedSetData!(mergedData, () => {
      // 执行所有回调
      callbacks.forEach(cb => {
        try {
          cb()
        } catch (e) {
          console.error('setData callback error:', e)
        }
      })
    })
  }
  
  // 替换setData方法
  component.setData = function(data: any, callback?: () => void) {
    // 合并数据到待处理队列
    Object.assign(component._pendingData!, data)
    
    // 添加回调
    if (callback) {
      component._pendingCallbacks!.push(callback)
    }
    
    // 记录第一次调用时间
    if (firstCallTime === 0) {
      firstCallTime = Date.now()
    }
    
    // 清除之前的定时器
    if (component._updateTimer) {
      clearTimeout(component._updateTimer)
    }
    
    // 检查是否超过最大等待时间
    const waitTime = Date.now() - firstCallTime
    if (waitTime >= maxWait) {
      // 立即执行
      flushUpdate()
    } else {
      // 延迟执行
      component._updateTimer = setTimeout(flushUpdate, delay) as any
    }
  }
}

/**
 * 恢复原始的setData方法
 * @param component 页面或组件实例
 */
export function restoreSetData(component: OptimizedComponent) {
  if (component._optimizedSetData) {
    // 清除定时器
    if (component._updateTimer) {
      clearTimeout(component._updateTimer)
    }
    
    // 执行最后的更新
    if (component._pendingData && Object.keys(component._pendingData).length > 0) {
      const mergedData = { ...component._pendingData }
      const callbacks = [...(component._pendingCallbacks || [])]
      component._optimizedSetData(mergedData, () => {
        callbacks.forEach(cb => cb())
      })
    }
    
    // 恢复原始方法
    component.setData = component._optimizedSetData
    delete component._optimizedSetData
    delete component._pendingData
    delete component._pendingCallbacks
    delete component._updateTimer
  }
}

/**
 * 防抖优化器
 * 用于优化频繁触发的操作
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300
): T {
  let timeout: number | undefined
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this
    
    if (timeout) {
      clearTimeout(timeout)
    }
    
    timeout = setTimeout(() => {
      func.apply(context, args)
    }, wait) as any
  } as T
}

/**
 * 节流优化器
 * 用于限制操作频率
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 100
): T {
  let lastTime = 0
  let timeout: number | undefined
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this
    const now = Date.now()
    const remaining = wait - (now - lastTime)
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = undefined
      }
      lastTime = now
      func.apply(context, args)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastTime = Date.now()
        timeout = undefined
        func.apply(context, args)
      }, remaining) as any
    }
  } as T
}
