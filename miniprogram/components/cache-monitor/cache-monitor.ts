/**
 * 缓存监控组件
 */

import { CacheManager, CacheStats } from '../../utils/cache-manager'

Component({
  properties: {
    // 是否显示监控面板
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    showMonitor: false,
    stats: {
      totalItems: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      avgAccessTime: 0
    } as CacheStats,
    formattedSize: '0KB',
    formattedHitRate: '0%'
  },

  observers: {
    'show': function(show: boolean) {
      this.setData({ showMonitor: show })
      if (show) {
        this.loadStats()
      }
    }
  },

  methods: {
    /**
     * 加载缓存统计
     */
    loadStats() {
      const cacheManager = CacheManager.getInstance()
      const stats = cacheManager.getStats()
      
      this.setData({
        stats,
        formattedSize: this.formatSize(stats.totalSize),
        formattedHitRate: `${(stats.hitRate * 100).toFixed(1)}%`
      })
    },

    /**
     * 格式化文件大小
     */
    formatSize(bytes: number): string {
      if (bytes < 1024) return `${bytes}B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
      return `${(bytes / 1024 / 1024).toFixed(2)}MB`
    },

    /**
     * 刷新统计
     */
    onRefresh() {
      this.loadStats()
      wx.showToast({
        title: '已刷新',
        icon: 'success',
        duration: 1000
      })
    },

    /**
     * 清空缓存
     */
    onClear() {
      wx.showModal({
        title: '确认清空',
        content: '确定要清空所有缓存吗？',
        success: (res) => {
          if (res.confirm) {
            const cacheManager = CacheManager.getInstance()
            cacheManager.clear()
            this.loadStats()
            wx.showToast({
              title: '缓存已清空',
              icon: 'success'
            })
          }
        }
      })
    },

    /**
     * 关闭监控面板
     */
    onClose() {
      this.triggerEvent('close')
    }
  }
})
