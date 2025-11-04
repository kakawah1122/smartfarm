// health-watchers.ts - 健康数据实时监听模块

export interface WatcherManager {
  healthRecordsWatcher: WechatMiniprogram.DBRealtimeListener | null
  deathRecordsWatcher: WechatMiniprogram.DBRealtimeListener | null
  treatmentRecordsWatcher: WechatMiniprogram.DBRealtimeListener | null
  refreshTimer: ReturnType<typeof setTimeout> | null
  initTimer: ReturnType<typeof setTimeout> | null
  readyTimer: ReturnType<typeof setTimeout> | null
  isActive: boolean
  watcherStates: {
    healthRecordsWatcher: boolean
    deathRecordsWatcher: boolean
    treatmentRecordsWatcher: boolean
  }
}

export interface StartWatcherOptions {
  onBeforeChange?: () => void
  onDataChange: () => void
  includeTreatmentWatcher?: boolean
  delay?: number
  query?: WechatMiniprogram.IAnyObject
}

export function createWatcherManager(): WatcherManager {
  return {
    healthRecordsWatcher: null,
    deathRecordsWatcher: null,
    treatmentRecordsWatcher: null,
    refreshTimer: null,
    initTimer: null,
    readyTimer: null,
    isActive: false,
    watcherStates: {
      healthRecordsWatcher: false,
      deathRecordsWatcher: false,
      treatmentRecordsWatcher: false
    }
  }
}

/**
 * 启动数据监听（优化版，带防抖和可选治疗记录监听）
 */
export function startDataWatcher(
  watchers: WatcherManager | null | undefined,
  {
    onBeforeChange,
    onDataChange,
    includeTreatmentWatcher = false,
    delay = 1000,
    query = { isDeleted: false }
  }: StartWatcherOptions
) {
  const manager = watchers ?? createWatcherManager()

  // 先停止现有的监听器
  stopDataWatcher(manager)

  const db = wx.cloud.database()

  const scheduleRefresh = () => {
    onBeforeChange?.()
    if (manager.refreshTimer) {
      clearTimeout(manager.refreshTimer)
    }
    manager.refreshTimer = setTimeout(() => {
      onDataChange()
    }, delay)
  }

  // 标记为活跃状态
  manager.isActive = true

  // 重置watcher状态为未就绪
  manager.watcherStates.healthRecordsWatcher = false
  manager.watcherStates.deathRecordsWatcher = false
  manager.watcherStates.treatmentRecordsWatcher = false

  // ✅ 增加延迟时间到300ms，给页面更多时间稳定
  // 延迟初始化监听器，避免过于频繁的初始化
  manager.initTimer = setTimeout(() => {
    // ✅ 双重检查：在初始化前再次确认是否还处于活跃状态
    if (!manager.isActive) {
      return
    }

    // ✅ 安全的watcher初始化函数
    const safeInitWatcher = (collectionName: string, watcherKey: keyof WatcherManager) => {
      try {
        // 最后一次检查活跃状态
        if (!manager.isActive) {
          return
        }
        
        const watcher = db.collection(collectionName)
          .where(query)
          .watch({
            onChange: () => {
              // ✅ 关键：onChange触发说明WebSocket已连接，标记为可安全关闭
              // 只有在watcher真正连接并接收到数据时才标记为就绪
              if (watcherKey === 'healthRecordsWatcher' || 
                  watcherKey === 'deathRecordsWatcher' || 
                  watcherKey === 'treatmentRecordsWatcher') {
                manager.watcherStates[watcherKey] = true
              }
              
              // 每次onChange时都检查活跃状态
              if (manager.isActive) {
                scheduleRefresh()
              }
            },
            onError: (err: any) => {
              // ✅ 区分不同类型的错误
              const errorMsg = err?.message || err?.errMsg || String(err)
              
              // 忽略已知的非致命状态机错误
              const knownErrors = [
                'CLOSED',
                'closed',
                'CONNECTED',
                'initWatchFail',
                'connectionSuccess',
                'does not accept'
              ]
              
              const isKnownError = knownErrors.some(keyword => errorMsg.includes(keyword))
              
              if (!isKnownError) {
                console.warn(`${collectionName} watcher error:`, errorMsg)
              }
              
              // 清除watcher引用和状态
              manager[watcherKey] = null
              if (watcherKey === 'healthRecordsWatcher' || watcherKey === 'deathRecordsWatcher' || watcherKey === 'treatmentRecordsWatcher') {
                manager.watcherStates[watcherKey] = false
              }
            }
          })
        
        // 只在成功创建后赋值
        manager[watcherKey] = watcher
      } catch (error: any) {
        const errorMsg = error?.message || error?.errMsg || String(error)
        
        // ✅ 静默处理已知的状态机错误
        const knownErrors = [
          'CLOSED',
          'closed',
          'CONNECTED',
          'initWatchFail',
          'connectionSuccess',
          'does not accept'
        ]
        
        const isKnownError = knownErrors.some(keyword => errorMsg.includes(keyword))
        
        if (!isKnownError) {
          console.warn(`Failed to init ${collectionName} watcher:`, errorMsg)
        }
        
        manager[watcherKey] = null
      }
    }

    // 初始化各个监听器
    safeInitWatcher('health_records', 'healthRecordsWatcher')
    safeInitWatcher('health_death_records', 'deathRecordsWatcher')
    
    if (includeTreatmentWatcher) {
      safeInitWatcher('health_treatment_records', 'treatmentRecordsWatcher')
    }

    // ✅ 不再使用固定延迟来标记就绪状态
    // 改为在onChange回调中标记，确保只有真正连接的watcher才会被标记为可关闭
    // 这样可以彻底避免在WebSocket未连接时调用close()导致的错误
  }, 300) // ✅ 延迟初始化，给页面稳定时间

  return manager
}

/**
 * 停止数据监听（优化版，正确处理关闭）
 */
export function stopDataWatcher(watchers: WatcherManager | null | undefined) {
  if (!watchers) {
    return
  }

  // 标记为非活跃状态，防止正在初始化的监听器继续执行
  watchers.isActive = false

  // 清除初始化定时器
  if (watchers.initTimer) {
    clearTimeout(watchers.initTimer)
    watchers.initTimer = null
  }

  // ✅ 清除就绪状态定时器（关键：防止在停止后还标记为就绪）
  if (watchers.readyTimer) {
    clearTimeout(watchers.readyTimer)
    watchers.readyTimer = null
  }

  // 清除刷新定时器
  if (watchers.refreshTimer) {
    clearTimeout(watchers.refreshTimer)
    watchers.refreshTimer = null
  }

  // ✅ 定义所有已知的WebSocket相关非致命错误模式
  const isNonFatalError = (errorMsg: string): boolean => {
    const knownErrorPatterns = [
      'websocket not connected',
      'not connected',
      'ws readyState invalid',
      'WebSocket is closed',
      'connection is established',
      'CLOSED',
      'closed',
      'CONNECTED',
      'connectionSuccess',
      'does not accept',
      'initWatchFail'
    ]
    return knownErrorPatterns.some(pattern => errorMsg.includes(pattern))
  }

  // ✅ 安全关闭watcher的辅助函数
  const safeCloseWatcher = (
    watcher: WechatMiniprogram.DBRealtimeListener | null,
    watcherName: 'healthRecordsWatcher' | 'deathRecordsWatcher' | 'treatmentRecordsWatcher'
  ): void => {
    if (!watcher) {
      return
    }

    // ✅ 关键：只对已就绪的watcher调用close()，未就绪的直接置空
    if (!watchers.watcherStates[watcherName]) {
      // watcher还未就绪（WebSocket可能还在连接中），直接置空引用
      // 不调用close()，避免"ws readyState invalid"等错误
      watchers[watcherName] = null
      watchers.watcherStates[watcherName] = false
      return
    }

    // watcher已就绪，可以安全关闭
    try {
      watcher.close()
    } catch (error: any) {
      // ✅ 增强的错误过滤：完全静默已知的非致命错误
      const errorMsg = error?.message || error?.errMsg || String(error || '')
      
      if (!isNonFatalError(errorMsg)) {
        // 只记录未知的、可能真正有问题的错误
        console.warn(`Error closing ${watcherName}:`, errorMsg)
      }
      // 对于已知的非致命错误，完全静默处理
    } finally {
      watchers[watcherName] = null
      watchers.watcherStates[watcherName] = false
    }
  }

  // 使用安全关闭函数处理所有watcher
  safeCloseWatcher(watchers.healthRecordsWatcher, 'healthRecordsWatcher')
  safeCloseWatcher(watchers.deathRecordsWatcher, 'deathRecordsWatcher')
  safeCloseWatcher(watchers.treatmentRecordsWatcher, 'treatmentRecordsWatcher')
}


