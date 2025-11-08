// help.ts - 帮助中心页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    guideList: [
      {
        id: 1,
        title: '快速入门',
        content: '欢迎使用鹅数通！首次使用请先完成账号注册和登录，然后根据您的角色权限使用相应功能。'
      },
      {
        id: 2,
        title: '生产管理',
        content: '生产管理模块包括入栏记录、出栏记录、物料使用等功能，帮助您全面管理养殖生产过程。'
      },
      {
        id: 3,
        title: '健康管理',
        content: '健康管理模块记录疫苗、治疗、死亡等健康信息，支持AI智能诊断，帮助您及时发现和处理健康问题。'
      },
      {
        id: 4,
        title: '财务管理',
        content: '财务管理模块记录收支情况，支持报销申请和审批，提供财务报表和数据分析功能。'
      }
    ]
  },

  onLoad() {
    // 可以在这里加载更多帮助内容
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

