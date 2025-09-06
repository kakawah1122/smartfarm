// employee-management.ts - 员工管理中心页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 用户信息
    userInfo: null as any,
    
    // 功能模块
    moduleItems: [
      {
        id: 1,
        title: '员工邀请管理',
        description: '管理邀请码、查看邀请状态、员工注册管理',
        icon: 'user-add',
        page: '/pages/invite-management/invite-management',
        requiredPermission: 'employee.invite',
        color: '#3498db',
        features: ['邀请码生成', '邀请状态跟踪', '员工信息管理']
      },
      {
        id: 2,
        title: '员工权限设置',
        description: '设置员工角色、权限分配、部门管理',
        icon: 'user-setting',
        page: '/pages/employee-permission/employee-permission',
        requiredPermission: 'employee.permission',
        color: '#e74c3c',
        features: ['角色管理', '权限分配', '部门设置']
      },
      {
        id: 3,
        title: '员工列表管理',
        description: '查看所有员工、导出员工数据、员工信息管理',
        icon: 'user-list',
        page: '/pages/user-management/user-management',
        requiredPermission: 'employee.view',
        color: '#2ecc71',
        features: ['员工列表', '信息查看', '数据导出']
      }
    ],
  },

  onLoad() {
    this.checkUserPermission()
  },

  // 检查用户权限
  async checkUserPermission() {
    try {
      const app = getApp()
      const userInfo = app.globalData.userInfo
      
      if (!userInfo) {
        console.warn('用户未登录')
        wx.showModal({
          title: '权限不足',
          content: '请先登录后再访问员工管理功能',
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
        return
      }
      
      // 检查是否有员工管理权限
      if (!this.hasEmployeeManagePermission(userInfo)) {
        wx.showModal({
          title: '权限不足',
          content: '您没有访问员工管理功能的权限，请联系管理员',
          showCancel: false,
          success: () => {
            wx.navigateBack()
          }
        })
        return
      }
      
      this.setData({
        userInfo: userInfo
      })
      
      console.log('员工管理权限验证通过')
    } catch (error) {
      console.error('检查用户权限异常：', error)
    }
  },

  // 检查员工管理权限
  hasEmployeeManagePermission(userInfo: any): boolean {
    // 超级管理员拥有所有权限
    if (userInfo.isSuper === true) return true
    
    // 管理员拥有所有权限
    if (userInfo.role === 'admin') return true
    
    // 检查是否有所有权限
    if (userInfo.permissions && userInfo.permissions.includes('all')) return true
    
    // 检查员工相关权限
    if (userInfo.permissions && (
      userInfo.permissions.includes('employee.view') || 
      userInfo.permissions.includes('employee.invite') ||
      userInfo.permissions.includes('employee.permission')
    )) return true
    
    return false
  },


  // 导航到模块页面
  navigateToModule(e: any) {
    const { item } = e.currentTarget.dataset
    
    // 检查权限
    if (item.requiredPermission && !this.hasPermission(item.requiredPermission)) {
      wx.showModal({
        title: '权限不足',
        content: `您没有访问"${item.title}"的权限，请联系管理员`,
        showCancel: false
      })
      return
    }
    
    if (item.page) {
      wx.navigateTo({
        url: item.page,
        fail: (error) => {
          console.error('页面跳转失败:', error)
          wx.showToast({
            title: item.id === 2 ? '功能开发中' : '跳转失败',
            icon: 'none'
          })
        }
      })
    } else {
      wx.showToast({
        title: '功能开发中',
        icon: 'none'
      })
    }
  },


  // 检查用户权限
  hasPermission(requiredPermission: string): boolean {
    const userInfo = this.data.userInfo
    
    if (!userInfo) return false
    
    // 超级管理员拥有所有权限
    if (userInfo.isSuper === true) return true
    
    // 管理员拥有所有权限
    if (userInfo.role === 'admin') return true
    
    // 检查是否有所有权限
    if (userInfo.permissions && userInfo.permissions.includes('all')) return true
    
    // 检查特定权限
    if (userInfo.permissions && userInfo.permissions.includes(requiredPermission)) return true
    
    return false
  },

  // 返回上一页
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
