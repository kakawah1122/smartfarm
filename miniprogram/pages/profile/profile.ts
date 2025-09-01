// profile.ts
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    // 用户信息
    userInfo: {
      name: '张养鹅',
      role: '管理员',
      farm: '吴中区智慧养鹅场',
      experience: '5',
      currentStock: '1,280',
      healthRate: '95'
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
    }
  },

  onLoad() {
    this.loadUserData()
  },

  onShow() {
    this.refreshData()
  },

  // 加载用户数据
  loadUserData() {
    // 模拟API调用获取用户信息
    // 实际开发中这里会调用云函数或API
  },

  // 刷新数据
  refreshData() {
    this.loadUserData()
    this.loadFinanceOverview()
    this.loadPendingItems()
  },

  // 加载财务概览
  loadFinanceOverview() {
    // 模拟API调用
  },

  // 加载待处理事项
  loadPendingItems() {
    // 模拟API调用
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

  // 编辑个人信息
  editProfile() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 通知设置
  notificationSettings() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
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
          // 清除用户数据
          wx.clearStorageSync()
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
          
          // 跳转到登录页或首页
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index'
            })
          }, 1500)
        }
      }
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
