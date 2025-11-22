/**
 * SetData 智能批量更新包装器 - Profile页面专用
 * 用于优化频繁的setData调用，自动批量合并更新
 * 
 * 设计原则：
 * 1. 批量合并：将短时间内多次setData合并为一次，减少渲染次数
 * 2. 路径更新：支持'a.b.c'格式的路径更新
 * 3. 回调保证：确保所有回调按顺序执行
 * 4. 紧急更新：支持urgent参数立即执行
 * 
 * 符合微信小程序性能优化规范
 */

export interface SetDataWrapper {
  setData: (data: Record<string, any>, callback?: () => void, urgent?: boolean) => void
  forceFlush: () => void
  cleanup: () => void
}

export function createSetDataWrapper(context: any): SetDataWrapper {
  const BATCH_DELAY = 16 // ms, 约等于一帧（符合微信小程序建议）
  const MAX_BATCH_SIZE = 50 // 最大批量属性数（避免单次setData数据过大）
  
  let pendingUpdates: Record<string, any> = {}
  let pendingCallbacks: Array<() => void> = []
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let updateCount = 0
  
  /**
   * 合并更新数据
   * 注意：对于路径更新（如'a.b.c'），直接覆盖，不做深度合并
   * 这符合微信小程序setData的行为
   */
  const mergeData = (target: Record<string, any>, source: Record<string, any>) => {
    Object.keys(source).forEach(key => {
      target[key] = source[key]
    })
  }
  
  /**
   * 执行批量更新
   * 将累积的更新一次性发送给原生setData
   */
  const flush = () => {
    if (Object.keys(pendingUpdates).length === 0) {
      return
    }
    
    const updates = { ...pendingUpdates }
    const callbacks = [...pendingCallbacks]
    
    // 清空待处理队列
    pendingUpdates = {}
    pendingCallbacks = []
    updateCount = 0
    
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    
    // 执行原生setData
    context.setData.call(context, updates, () => {
      callbacks.forEach(cb => {
        try {
          cb()
        } catch (error) {
          console.error('[SetDataWrapper] 回调执行错误:', error)
        }
      })
    })
  }
  
  /**
   * 包装后的setData方法
   */
  const wrappedSetData = (
    data: Record<string, any>, 
    callback?: () => void, 
    urgent: boolean = false
  ) => {
    // 紧急更新立即执行
    if (urgent) {
      flush() // 先清空之前的
      context.setData.call(context, data, callback)
      return
    }
    
    // 合并数据
    mergeData(pendingUpdates, data)
    updateCount += Object.keys(data).length
    
    if (callback) {
      pendingCallbacks.push(callback)
    }
    
    // 如果批量过大，立即执行
    if (updateCount >= MAX_BATCH_SIZE) {
      flush()
      return
    }
    
    // 延迟批量更新
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flush()
      }, BATCH_DELAY)
    }
  }
  
  /**
   * 强制执行所有待处理更新
   */
  const forceFlush = () => {
    flush()
  }
  
  /**
   * 清理定时器
   */
  const cleanup = () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    flush() // 执行最后的更新
  }
  
  return {
    setData: wrappedSetData,
    forceFlush,
    cleanup
  }
}
