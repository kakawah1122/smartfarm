// health-watchers.ts - 健康数据实时监听模块

export interface WatcherManager {
  healthRecordsWatcher: WechatMiniprogram.DBRealtimeListener | null
  deathRecordsWatcher: WechatMiniprogram.DBRealtimeListener | null
  treatmentRecordsWatcher: WechatMiniprogram.DBRealtimeListener | null
  refreshTimer: ReturnType<typeof setTimeout> | null
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
    refreshTimer: null
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

  setTimeout(() => {
    try {
      manager.healthRecordsWatcher = db.collection('health_records')
        .where(query)
        .watch({
          onChange: () => {
            scheduleRefresh()
          },
          onError: () => {
            manager.healthRecordsWatcher = null
          }
        })
    } catch (error) {
      manager.healthRecordsWatcher = null
    }

    try {
      manager.deathRecordsWatcher = db.collection('health_death_records')
        .where(query)
        .watch({
          onChange: () => {
            scheduleRefresh()
          },
          onError: () => {
            manager.deathRecordsWatcher = null
          }
        })
    } catch (error) {
      manager.deathRecordsWatcher = null
    }

    if (includeTreatmentWatcher) {
      try {
        manager.treatmentRecordsWatcher = db.collection('health_treatment_records')
          .where(query)
          .watch({
            onChange: () => {
              scheduleRefresh()
            },
            onError: () => {
              manager.treatmentRecordsWatcher = null
            }
          })
      } catch (error) {
        manager.treatmentRecordsWatcher = null
      }
    }
  }, 100)

  return manager
}

/**
 * 停止数据监听（优化版，正确处理关闭）
 */
export function stopDataWatcher(watchers: WatcherManager | null | undefined) {
  if (!watchers) {
    return
  }

  if (watchers.healthRecordsWatcher) {
    try {
      watchers.healthRecordsWatcher.close()
    } catch (error: any) {
      // 忽略 WebSocket 连接已断开的非致命错误
    } finally {
      watchers.healthRecordsWatcher = null
    }
  }

  if (watchers.deathRecordsWatcher) {
    try {
      watchers.deathRecordsWatcher.close()
    } catch (error: any) {
      // 忽略 WebSocket 连接已断开的非致命错误
    } finally {
      watchers.deathRecordsWatcher = null
    }
  }

  if (watchers.treatmentRecordsWatcher) {
    try {
      watchers.treatmentRecordsWatcher.close()
    } catch (error: any) {
      // 忽略 WebSocket 连接已断开的非致命错误
    } finally {
      watchers.treatmentRecordsWatcher = null
    }
  }

  if (watchers.refreshTimer) {
    clearTimeout(watchers.refreshTimer)
    watchers.refreshTimer = null
  }
}

