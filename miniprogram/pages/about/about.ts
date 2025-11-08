// about.ts - 关于我们页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    appName: '鹅数通',
    appVersion: 'v1.1.0',
    appDescription: '智慧养殖管理小程序',
    buildDate: '2024年',
    copyright: '© 2024 鹅数通 版权所有',
    features: [
      { id: 'production', title: '生产管理', emoji: '📊', theme: 'blue' },
      { id: 'health', title: '健康管理', emoji: '❤️', theme: 'pink' },
      { id: 'finance', title: '财务管理', emoji: '💰', theme: 'green' },
      { id: 'user', title: '人员管理', emoji: '👥', theme: 'orange' },
      { id: 'ai', title: 'AI智能诊断', emoji: '🤖', theme: 'purple' }
    ]
  },

  onLoad() {
    // 可以在这里加载更多信息
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/profile/profile'
        })
      }
    })
  }
}

Page(createPageWithNavbar(pageConfig))

