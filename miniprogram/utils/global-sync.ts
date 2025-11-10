/**
 * 全局同步工具
 * 用于在各业务页面之间标记并清除首页所需的刷新状态
 * 遵循项目规范：通过 App.globalData 保持跨页面状态一致
 */

type GlobalData = {
  needSyncHomepage?: boolean
  lastSyncTime?: number
  [key: string]: any
}

const ensureGlobalData = (): GlobalData => {
  const app = getApp<any>()
  app.globalData = app.globalData || {}
  return app.globalData
}

/**
 * 标记首页需要刷新
 */
export const markHomepageNeedSync = () => {
  try {
    const globalData = ensureGlobalData()
    globalData.needSyncHomepage = true
    globalData.lastSyncTime = Date.now()
  } catch (_error) {
    // 静默处理，避免影响业务流程
  }
}

/**
 * 清除首页刷新标记
 */
export const clearHomepageNeedSync = () => {
  try {
    const globalData = ensureGlobalData()
    delete globalData.lastSyncTime
    globalData.needSyncHomepage = false
  } catch (_error) {
    // 静默处理
  }
}

/**
 * 判断首页是否需要刷新
 */
export const isHomepageNeedSync = (): boolean => {
  try {
    const globalData = ensureGlobalData()
    return Boolean(globalData.needSyncHomepage)
  } catch (_error) {
    return false
  }
}

