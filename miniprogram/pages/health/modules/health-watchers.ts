// health-watchers.ts - 健康数据实时监听模块

interface WatcherManager {
  healthRecordsWatcher: any
  deathRecordsWatcher: any
  refreshTimer: any
}

/**
 * 启动数据监听（优化版，带防抖和错误处理）
 */
export function startDataWatcher(
  context: any,
  watchers: WatcherManager,
  onDataChange: () => void
) {
  // 先停止旧的监听器，确保状态清理干净
  stopDataWatcher(watchers)
  
  const db = wx.cloud.database()
  
  // 延迟启动，给连接状态重置留出时间
  setTimeout(() => {
    // 监听健康记录变化
    try {
      watchers.healthRecordsWatcher = db.collection('health_records')
        .where({
          isDeleted: false
        })
        .watch({
          onChange: (snapshot) => {
            // 延迟刷新，避免频繁更新（防抖机制）
            if (watchers.refreshTimer) {
              clearTimeout(watchers.refreshTimer)
            }
            watchers.refreshTimer = setTimeout(() => {
              onDataChange()
            }, 1000) // 1秒防抖
          },
          onError: (err) => {
            // 错误时自动重置监听器
            watchers.healthRecordsWatcher = null
          }
        })
    } catch (error) {
      watchers.healthRecordsWatcher = null
    }
    
    // 监听死亡记录变化
    try {
      watchers.deathRecordsWatcher = db.collection('health_death_records')
        .where({
          isDeleted: false
        })
        .watch({
          onChange: (snapshot) => {
            // 延迟刷新，避免频繁更新（防抖机制）
            if (watchers.refreshTimer) {
              clearTimeout(watchers.refreshTimer)
            }
            watchers.refreshTimer = setTimeout(() => {
              onDataChange()
            }, 1000) // 1秒防抖
          },
          onError: (err) => {
            // 错误时自动重置监听器
            watchers.deathRecordsWatcher = null
          }
        })
    } catch (error) {
      watchers.deathRecordsWatcher = null
    }
  }, 100) // 延迟100ms启动
}

/**
 * 停止数据监听（优化版，正确处理关闭）
 */
export function stopDataWatcher(watchers: WatcherManager) {
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
  
  if (watchers.refreshTimer) {
    clearTimeout(watchers.refreshTimer)
    watchers.refreshTimer = null
  }
}

