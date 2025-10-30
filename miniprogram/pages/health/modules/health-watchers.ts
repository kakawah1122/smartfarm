// health-watchers.ts - 健康数据实时监听模块

export interface WatcherManager {
  healthRecordsWatcher: WechatMiniprogram.DBRealtimeListener | null
  deathRecordsWatcher: WechatMiniprogram.DBRealtimeListener | null
  treatmentRecordsWatcher: WechatMiniprogram.DBRealtimeListener | null
  refreshTimer: ReturnType<typeof setTimeout> | null
  initTimer: ReturnType<typeof setTimeout> | null
  isActive: boolean
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
    isActive: false
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

  // ✅ 增加延迟时间到300ms，给页面更多时间稳定
  // 延迟初始化监听器，避免过于频繁的初始化
  manager.initTimer = setTimeout(() => {
    // ✅ 双重检查：在初始化前再次确认是否还处于活跃状态
    if (!manager.isActive) {
      console.log('Watcher initialization cancelled - manager is not active')
      return
    }

    // ✅ 安全的watcher初始化函数
    const safeInitWatcher = (collectionName: string, watcherKey: keyof WatcherManager) => {
      try {
        // 最后一次检查活跃状态
        if (!manager.isActive) {
          console.log(`Skipping ${collectionName} watcher - manager is not active`)
          return
        }
        
        const watcher = db.collection(collectionName)
          .where(query)
          .watch({
            onChange: () => {
              // 每次onChange时都检查活跃状态
              if (manager.isActive) {
                scheduleRefresh()
              }
            },
            onError: (err: any) => {
              // ✅ 区分不同类型的错误
              const errorMsg = err?.message || err?.errMsg || String(err)
              
              // 忽略已知的非致命错误
              if (errorMsg.includes('CLOSED') || errorMsg.includes('closed')) {
                console.log(`${collectionName} watcher closed normally`)
              } else {
                console.warn(`${collectionName} watcher error:`, errorMsg)
              }
              
              // 清除watcher引用
              manager[watcherKey] = null
            }
          })
        
        // 只在成功创建后赋值
        manager[watcherKey] = watcher
      } catch (error: any) {
        const errorMsg = error?.message || error?.errMsg || String(error)
        
        // ✅ 静默处理已知的状态错误
        if (errorMsg.includes('CLOSED') || errorMsg.includes('closed') || errorMsg.includes('initWatchFail')) {
          console.log(`${collectionName} watcher init skipped - connection closed`)
        } else {
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
  }, 300) // ✅ 增加到300ms，更稳定

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

  // 清除刷新定时器
  if (watchers.refreshTimer) {
    clearTimeout(watchers.refreshTimer)
    watchers.refreshTimer = null
  }

  // 关闭健康记录监听器
  if (watchers.healthRecordsWatcher) {
    try {
      watchers.healthRecordsWatcher.close()
    } catch (error: any) {
      // 忽略 WebSocket 连接已断开的非致命错误
      console.warn('Error closing healthRecordsWatcher:', error?.message)
    } finally {
      watchers.healthRecordsWatcher = null
    }
  }

  // 关闭死亡记录监听器
  if (watchers.deathRecordsWatcher) {
    try {
      watchers.deathRecordsWatcher.close()
    } catch (error: any) {
      // 忽略 WebSocket 连接已断开的非致命错误
      console.warn('Error closing deathRecordsWatcher:', error?.message)
    } finally {
      watchers.deathRecordsWatcher = null
    }
  }

  // 关闭治疗记录监听器
  if (watchers.treatmentRecordsWatcher) {
    try {
      watchers.treatmentRecordsWatcher.close()
    } catch (error: any) {
      // 忽略 WebSocket 连接已断开的非致命错误
      console.warn('Error closing treatmentRecordsWatcher:', error?.message)
    } finally {
      watchers.treatmentRecordsWatcher = null
    }
  }
}

