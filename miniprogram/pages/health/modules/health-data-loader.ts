// health-data-loader.ts - 健康数据加载模块（✅优化：wx.storage持久化缓存）

import CloudApi from '../../../utils/cloud-api'
import { calculatePreventionStats, formatPreventionRecord } from './health-stats-calculator'

// ✅ 优化：使用wx.storage替代Map，实现持久化缓存
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存
const CACHE_PREFIX = 'health_cache_' // 缓存key前缀

interface CachedData {
  data: any
  timestamp: number
}

/**
 * 检查缓存是否有效（✅优化：从wx.storage读取）
 */
function isCacheValid(cacheKey: string): boolean {
  try {
    const cached = wx.getStorageSync(CACHE_PREFIX + cacheKey) as CachedData
    if (!cached) return false
    
    const now = Date.now()
    return (now - cached.timestamp) < CACHE_DURATION
  } catch (error) {
    return false
  }
}

/**
 * 获取缓存数据（✅优化：从wx.storage读取）
 */
function getCachedData(cacheKey: string): any {
  try {
    const cached = wx.getStorageSync(CACHE_PREFIX + cacheKey) as CachedData
    return cached ? cached.data : null
  } catch (error) {
    return null
  }
}

/**
 * 设置缓存数据（✅优化：保存到wx.storage）
 */
function setCachedData(cacheKey: string, data: any) {
  try {
    wx.setStorageSync(CACHE_PREFIX + cacheKey, {
      data,
      timestamp: Date.now()
    })
  } catch (error) {
    // 失败不影响主流程
  }
}

/**
 * 清除指定缓存（✅新增：用于缓存失效）
 */
export function clearCache(cacheKey: string) {
  try {
    wx.removeStorageSync(CACHE_PREFIX + cacheKey)
  } catch (error) {
    // 缓存清理失败时静默处理
  }
}

/**
 * 清除所有健康数据缓存（✅新增：用于数据更新后）
 */
export function clearAllHealthCache() {
  try {
    const info = wx.getStorageInfoSync()
    const healthCacheKeys = info.keys.filter((key: string) => key.startsWith(CACHE_PREFIX))
    healthCacheKeys.forEach((key: string) => {
      wx.removeStorageSync(key)
    })
  } catch (error) {
    // 缓存清理失败时静默处理
  }
}

/**
 * ✅ 智能清除批次缓存（只清除特定批次或全部批次的缓存）
 */
export function clearBatchCache(batchId: string) {
  try {
    if (batchId === 'all') {
      // 清除全部批次缓存
      clearCache('all_batches_health')
    } else {
      // 清除特定批次缓存
      clearCache(`batch_health_${batchId}`)
    }
  } catch (error) {
    // 缓存清理失败时静默处理
  }
}

// ✅ 已删除未使用的冗余函数：
// - loadAllBatchesData (已在health.ts中有独立实现)
// - loadSingleBatchData (已被loadSingleBatchDataOptimized替代)
// - loadHealthOverview (未使用)
// - loadPreventionData (未使用)
// - loadTreatmentData (未使用)
// - getTreatmentStatusText (未使用)
// - clearAllCache (重复定义，已有clearAllHealthCache)

