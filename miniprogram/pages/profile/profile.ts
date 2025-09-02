// profile.ts
import { createPageWithNavbar } from '../../utils/navigation'

// 获取全局应用实例
const app = getApp<IAppOption>()

const pageConfig = {
  data: {
    // 用户信息
    userInfo: {
      name: '未设置',
      role: '用户',
      farm: '未设置',
      experience: '0',
      currentStock: '0',
      healthRate: '0',
      avatarUrl: '/assets/icons/profile.png' // 默认头像
    },
    

    
    // 财务概览
    financeOverview: {
      income: '21.2',
      incomeGrowth: '15.3',
      expense: '16.8',
      expenseGrowth: '8.7',
      profit: '4.4',
      profitGrowth: '32.1'
    },
    
    // 功能菜单
    menuItems: [
      {
        id: 1,
        title: '财务管理',
        description: '收支记录、AI建议、报表分析',
        icon: 'money-circle',
        page: '/pages/finance/finance'
      },
      {
        id: 2,
        title: '员工管理',
        description: '员工账号、权限设置、考勤统计',
        icon: 'user-group'
      },
      {
        id: 3,
        title: '报销审核',
        description: '待审核报销申请、采购申请',
        icon: 'file-text',
        badge: '3'
      },
      {
        id: 4,
        title: '系统设置',
        description: '养殖场信息、AI配置、数据备份',
        icon: 'setting'
      }
    ],
    
    // 待处理事项
    pendingItems: [
      {
        id: 1,
        title: '李四提交的差旅费报销',
        description: '金额：¥280 • 提交时间：今天 14:30',
        priority: 'danger',
        status: '待审核'
      },
      {
        id: 2,
        title: '王五的饲料采购申请',
        description: '饲料2吨 • 预计金额：¥6,000',
        priority: 'warning',
        status: '待审核'
      },
      {
        id: 3,
        title: '疫苗采购申请',
        description: '禽流感疫苗50支 • 预计金额：¥750',
        priority: 'primary',
        status: '待审核'
      }
    ],
    
    // 养殖场统计
    farmStats: {
      totalStock: '1,280',
      stockChange: '120',
      survivalRate: '95.2',
      staffCount: '8',
      adminCount: '1',
      employeeCount: '7',
      monthlyProfit: '4.4',
      profitGrowth: '32'
    },

    // 消息通知
    notifications: [
      {
        id: 1,
        title: '系统消息',
        content: '您有3条待审核的报销申请',
        time: '10分钟前',
        type: 'system',
        read: false
      },
      {
        id: 2,
        title: '健康提醒',
        content: '今日疫苗接种提醒：200只鹅需要接种',
        time: '1小时前',
        type: 'health',
        read: false
      }
    ]
  },

  onLoad() {
    this.initUserInfo()
  },

  onShow() {
    // 页面显示时刷新数据
  },







  // 初始化用户信息
  async initUserInfo() {
    // 加载默认用户信息
    this.setData({
      userInfo: {
        name: '游客',
        role: '用户',
        farm: '示范养殖场',
        experience: '1',
        currentStock: '1280',
        healthRate: '95.2',
        avatarUrl: '/assets/icons/profile.png'
      }
    })
  },















  // 返回上一页
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  },

  // 查看财务详情
  viewFinanceDetail() {
    wx.navigateTo({
      url: '/pages/finance/finance',
      fail: () => {
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
      }
    })
  },

  // 导航到功能菜单
  navigateToMenu(e: any) {
    const { item } = e.currentTarget.dataset
    
    if (item.page) {
      wx.navigateTo({
        url: item.page,
        fail: () => {
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          })
        }
      })
    } else {
      wx.showModal({
        title: item.title,
        content: item.description,
        showCancel: false,
        success: () => {
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          })
        }
      })
    }
  },

  // 处理待办事项
  handlePendingItem(e: any) {
    const { item } = e.currentTarget.dataset
    
    wx.showModal({
      title: '处理申请',
      content: `${item.title}\n\n${item.description}`,
      confirmText: '审核',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '审核操作',
            content: '是否通过此申请？',
            confirmText: '通过',
            cancelText: '拒绝',
            success: (result) => {
              const action = result.confirm ? '通过' : '拒绝'
              wx.showToast({
                title: `申请已${action}`,
                icon: 'success'
              })
              
              // 更新待处理事项列表
              this.removePendingItem(item.id)
            }
          })
        }
      }
    })
  },

  // 移除待处理事项
  removePendingItem(id: number) {
    const pendingItems = this.data.pendingItems.filter(item => item.id !== id)
    this.setData({
      pendingItems
    })
  },

  // 更换头像
  async changeAvatar() {
    try {
      // 使用微信头像昵称授权
      const { userInfo } = await wx.getUserProfile({
        desc: '用于完善会员资料',
      })
      
      // 更新本地显示
      this.setData({
        'userInfo.name': userInfo.nickName,
        'userInfo.avatarUrl': userInfo.avatarUrl
      })

      wx.showToast({
        title: '头像更新成功',
        icon: 'success'
      })
    } catch (error) {
      if (error.errMsg && error.errMsg.includes('cancel')) {
        wx.showToast({
          title: '取消授权',
          icon: 'none'
        })
      } else {
        wx.showToast({
          title: '授权失败',
          icon: 'none'
        })
      }
    }
  },

  // 编辑个人信息
  editProfile() {
    wx.showActionSheet({
      itemList: ['编辑养殖场名称', '编辑职位', '更新存栏数量', '更新健康率'],
      success: async (res) => {
        const options = ['养殖场名称', '职位', '存栏数量', '健康率']
        const currentValues = [
          this.data.userInfo.farm, 
          this.data.userInfo.role, 
          this.data.userInfo.currentStock,
          this.data.userInfo.healthRate
        ]
        
        wx.showModal({
          title: `编辑${options[res.tapIndex]}`,
          content: `当前${options[res.tapIndex]}：${currentValues[res.tapIndex]}`,
          placeholderText: `请输入新的${options[res.tapIndex]}`,
          editable: true,
          confirmText: '保存',
          success: (modalRes) => {
            if (modalRes.confirm && modalRes.content.trim()) {
              this.handleSaveProfile(modalRes.content.trim(), res.tapIndex, options[res.tapIndex])
            }
          }
        })
      }
    })
  },

  // 处理保存个人信息
  async handleSaveProfile(newValue: string, fieldIndex: number, fieldName: string) {
    try {
      wx.showLoading({
        title: '保存中...'
      })

      // 更新本地显示
      const keys = ['farm', 'role', 'currentStock', 'healthRate']
      const dataKey = `userInfo.${keys[fieldIndex]}`
      this.setData({
        [dataKey]: newValue
      })

      wx.hideLoading()
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 显示消息通知
  showNotifications() {
    const unreadCount = this.data.notifications.filter(n => !n.read).length
    const notificationList = this.data.notifications.map(n => `${n.title}: ${n.content}`).join('\n\n')
    
    wx.showModal({
      title: `消息通知 (${unreadCount}条未读)`,
      content: notificationList || '暂无消息',
      confirmText: '全部已读',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          // 标记所有消息为已读
          const notifications = this.data.notifications.map(n => ({ ...n, read: true }))
          this.setData({ notifications })
          wx.showToast({
            title: '已标记为已读',
            icon: 'success'
          })
        }
      }
    })
  },

  // 隐私设置
  privacySettings() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 帮助与反馈
  helpAndFeedback() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 关于我们
  aboutUs() {
    wx.showModal({
      title: '关于智慧养鹅',
      content: '智慧养鹅小程序 v1.0.0\n\n集生产管理、健康监控、知识学习和财务分析于一体的专业养鹅管理系统。',
      showCancel: false
    })
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 重置页面数据
          this.setData({
            userInfo: {
              name: '游客',
              role: '用户',
              farm: '示范养殖场',
              experience: '0',
              currentStock: '0',
              healthRate: '0',
              avatarUrl: '/assets/icons/profile.png'
            }
          })
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
        }
      }
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
