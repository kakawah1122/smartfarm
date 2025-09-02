// pages/employee/employee.ts
import { createPageWithNavbar } from '../../utils/navigation'

interface Employee {
  _id: string;
  nickname: string;
  avatarUrl: string;
  phone: string;
  role: string;
  permissions: string[];
  department: string;
  position: string;
  createTime: Date;
  lastLoginTime: Date;
  isActive: boolean;
}

interface Invite {
  _id: string;
  inviteCode: string;
  department: string;
  position: string;
  permissions: string[];
  createTime: Date;
  expireTime: Date;
  isUsed: boolean;
  usedBy?: string;
  usedTime?: Date;
}

const pageConfig = {
  data: {
    // 用户权限
    currentUser: null,
    hasManagePermission: false,
    hasInvitePermission: false,
    
    // 员工列表
    employees: [] as Employee[],
    totalEmployees: 0,
    
    // 邀请列表
    invites: [] as Invite[],
    
    // 权限定义
    permissions: {},
    
    // 界面状态
    activeTab: 'employees', // employees | invites
    loading: false,
    refreshing: false,
    
    // 弹窗状态
    showInviteDialog: false,
    showEditDialog: false,
    showJoinDialog: false,
    
    // 表单数据
    inviteForm: {
      department: '',
      position: '',
      permissions: ['basic'],
      validDays: 7
    },
    editForm: {
      employeeId: '',
      department: '',
      position: '',
      permissions: ['basic'],
      isActive: true
    },
    joinForm: {
      inviteCode: ''
    }
  },

  async onLoad() {
    await this.checkPermissions()
    await this.loadData()
  },

  async onShow() {
    await this.loadData()
  },

  // 检查用户权限
  async checkPermissions() {
    try {
      const app = getApp()
      const userInfo = app.globalData.userInfo
      
      if (!userInfo) {
        wx.showModal({
          title: '提示',
          content: '请先登录',
          showCancel: false,
          success: () => {
            wx.navigateTo({
              url: '/pages/login/login'
            })
          }
        })
        return
      }
      
      const hasManagePermission = userInfo.role === 'admin' || 
                                  userInfo.permissions.includes('employee.manage') ||
                                  userInfo.permissions.includes('all')
      
      const hasInvitePermission = userInfo.role === 'admin' || 
                                  userInfo.permissions.includes('employee.invite') ||
                                  userInfo.permissions.includes('all')
      
      this.setData({
        currentUser: userInfo,
        hasManagePermission: hasManagePermission,
        hasInvitePermission: hasInvitePermission
      })
      
      console.log('用户权限检查:', {
        role: userInfo.role,
        hasManagePermission,
        hasInvitePermission
      })
      
    } catch (error) {
      console.error('检查权限失败:', error)
    }
  },

  // 加载数据
  async loadData() {
    this.setData({ loading: true })
    
    try {
      await Promise.all([
        this.loadEmployees(),
        this.loadInvites(),
        this.loadPermissions()
      ])
    } catch (error) {
      console.error('加载数据失败:', error)
      wx.showToast({
        title: '数据加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载员工列表
  async loadEmployees() {
    if (!this.data.hasManagePermission) return
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'employeeManage',
        data: {
          action: 'getEmployees'
        }
      })
      
      if (result.result?.success) {
        this.setData({
          employees: result.result.employees,
          totalEmployees: result.result.total
        })
        console.log('员工列表加载成功:', result.result.employees.length)
      } else {
        console.error('获取员工列表失败:', result.result?.message)
      }
    } catch (error) {
      console.error('获取员工列表出错:', error)
    }
  },

  // 加载邀请列表
  async loadInvites() {
    if (!this.data.hasInvitePermission) return
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'employeeManage',
        data: {
          action: 'getInvites'
        }
      })
      
      if (result.result?.success) {
        this.setData({
          invites: result.result.invites
        })
        console.log('邀请列表加载成功:', result.result.invites.length)
      }
    } catch (error) {
      console.error('获取邀请列表出错:', error)
    }
  },

  // 加载权限定义
  async loadPermissions() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'employeeManage',
        data: {
          action: 'getPermissions'
        }
      })
      
      if (result.result?.success) {
        this.setData({
          permissions: result.result.permissions
        })
      }
    } catch (error) {
      console.error('获取权限定义出错:', error)
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    this.setData({ refreshing: true })
    await this.loadData()
    this.setData({ refreshing: false })
    wx.stopPullDownRefresh()
  },

  // 切换标签页
  switchTab(e: any) {
    const { tab } = e.currentTarget.dataset
    this.setData({
      activeTab: tab
    })
  },

  // 显示邀请员工对话框
  showInviteEmployee() {
    if (!this.data.hasInvitePermission) {
      wx.showToast({
        title: '无邀请权限',
        icon: 'error'
      })
      return
    }
    
    this.setData({
      showInviteDialog: true,
      inviteForm: {
        department: '',
        position: '',
        permissions: ['basic'],
        validDays: 7
      }
    })
  },

  // 邀请员工
  async inviteEmployee() {
    const { inviteForm } = this.data
    
    if (!inviteForm.department.trim()) {
      wx.showToast({
        title: '请输入部门',
        icon: 'error'
      })
      return
    }
    
    if (!inviteForm.position.trim()) {
      wx.showToast({
        title: '请输入职位',
        icon: 'error'
      })
      return
    }
    
    try {
      wx.showLoading({
        title: '生成邀请码...'
      })
      
      const result = await wx.cloud.callFunction({
        name: 'employeeManage',
        data: {
          action: 'inviteEmployee',
          department: inviteForm.department.trim(),
          position: inviteForm.position.trim(),
          permissions: inviteForm.permissions,
          validDays: inviteForm.validDays
        }
      })
      
      wx.hideLoading()
      
      if (result.result?.success) {
        wx.showModal({
          title: '邀请码生成成功',
          content: `邀请码：${result.result.inviteCode}\n\n有效期：${inviteForm.validDays}天\n\n请将此邀请码发送给员工`,
          showCancel: false,
          success: () => {
            // 复制邀请码到剪贴板
            wx.setClipboardData({
              data: result.result.inviteCode,
              success: () => {
                wx.showToast({
                  title: '邀请码已复制',
                  icon: 'success'
                })
              }
            })
          }
        })
        
        this.setData({
          showInviteDialog: false
        })
        
        // 刷新邀请列表
        await this.loadInvites()
      } else {
        wx.showToast({
          title: result.result?.message || '邀请失败',
          icon: 'error'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('邀请员工失败:', error)
      wx.showToast({
        title: '邀请失败',
        icon: 'error'
      })
    }
  },

  // 显示加入组织对话框
  showJoinOrganization() {
    this.setData({
      showJoinDialog: true,
      joinForm: {
        inviteCode: ''
      }
    })
  },

  // 加入组织
  async joinOrganization() {
    const { joinForm } = this.data
    
    if (!joinForm.inviteCode.trim()) {
      wx.showToast({
        title: '请输入邀请码',
        icon: 'error'
      })
      return
    }
    
    try {
      wx.showLoading({
        title: '加入中...'
      })
      
      const result = await wx.cloud.callFunction({
        name: 'employeeManage',
        data: {
          action: 'joinByInvite',
          inviteCode: joinForm.inviteCode.trim().toUpperCase()
        }
      })
      
      wx.hideLoading()
      
      if (result.result?.success) {
        wx.showModal({
          title: '加入成功',
          content: `您已成功加入组织\n\n部门：${result.result.department}\n职位：${result.result.position}`,
          showCancel: false,
          success: () => {
            // 更新全局用户信息
            const app = getApp()
            if (app.globalData.userInfo) {
              app.globalData.userInfo.role = result.result.role
              app.globalData.userInfo.permissions = result.result.permissions
              app.globalData.userInfo.department = result.result.department
              app.globalData.userInfo.position = result.result.position
              wx.setStorageSync('userInfo', app.globalData.userInfo)
            }
            
            // 刷新权限检查和数据
            this.checkPermissions()
            this.loadData()
          }
        })
        
        this.setData({
          showJoinDialog: false
        })
      } else {
        wx.showToast({
          title: result.result?.message || '加入失败',
          icon: 'error'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('加入组织失败:', error)
      wx.showToast({
        title: '加入失败',
        icon: 'error'
      })
    }
  },

  // 编辑员工
  editEmployee(e: any) {
    const { employee } = e.currentTarget.dataset
    
    this.setData({
      showEditDialog: true,
      editForm: {
        employeeId: employee._id,
        department: employee.department,
        position: employee.position,
        permissions: employee.permissions,
        isActive: employee.isActive
      }
    })
  },

  // 保存员工编辑
  async saveEmployeeEdit() {
    const { editForm } = this.data
    
    try {
      wx.showLoading({
        title: '保存中...'
      })
      
      const result = await wx.cloud.callFunction({
        name: 'employeeManage',
        data: {
          action: 'updateEmployee',
          employeeId: editForm.employeeId,
          updates: {
            department: editForm.department,
            position: editForm.position,
            permissions: editForm.permissions,
            isActive: editForm.isActive
          }
        }
      })
      
      wx.hideLoading()
      
      if (result.result?.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        
        this.setData({
          showEditDialog: false
        })
        
        // 刷新员工列表
        await this.loadEmployees()
      } else {
        wx.showToast({
          title: result.result?.message || '保存失败',
          icon: 'error'
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('保存员工信息失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'error'
      })
    }
  },

  // 移除员工
  removeEmployee(e: any) {
    const { employee } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认移除',
      content: `确定要移除员工 ${employee.nickname} 吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({
              title: '移除中...'
            })
            
            const result = await wx.cloud.callFunction({
              name: 'employeeManage',
              data: {
                action: 'removeEmployee',
                employeeId: employee._id
              }
            })
            
            wx.hideLoading()
            
            if (result.result?.success) {
              wx.showToast({
                title: '移除成功',
                icon: 'success'
              })
              
              // 刷新员工列表
              await this.loadEmployees()
            } else {
              wx.showToast({
                title: result.result?.message || '移除失败',
                icon: 'error'
              })
            }
          } catch (error) {
            wx.hideLoading()
            console.error('移除员工失败:', error)
            wx.showToast({
              title: '移除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  // 复制邀请码
  copyInviteCode(e: any) {
    const { code } = e.currentTarget.dataset
    
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success'
        })
      }
    })
  },

  // 表单输入处理
  onInviteDepartmentInput(e: any) {
    this.setData({
      'inviteForm.department': e.detail.value
    })
  },

  onInvitePositionInput(e: any) {
    this.setData({
      'inviteForm.position': e.detail.value
    })
  },

  onEditDepartmentInput(e: any) {
    this.setData({
      'editForm.department': e.detail.value
    })
  },

  onEditPositionInput(e: any) {
    this.setData({
      'editForm.position': e.detail.value
    })
  },

  onJoinCodeInput(e: any) {
    this.setData({
      'joinForm.inviteCode': e.detail.value
    })
  },

  onInviteValidDaysInput(e: any) {
    this.setData({
      'inviteForm.validDays': parseInt(e.detail.value) || 7
    })
  },

  onEditActiveChange(e: any) {
    this.setData({
      'editForm.isActive': e.detail.value
    })
  },

  // 权限选择
  onPermissionChange(e: any) {
    const { type } = e.currentTarget.dataset
    const { value } = e.detail
    // value 现在直接是权限键的数组
    const selectedPermissions = value || []
    
    if (type === 'invite') {
      this.setData({
        'inviteForm.permissions': selectedPermissions
      })
    } else if (type === 'edit') {
      this.setData({
        'editForm.permissions': selectedPermissions
      })
    }
    
    console.log(`权限选择变更 (${type}):`, selectedPermissions)
  },

  // 关闭对话框
  closeDialog() {
    this.setData({
      showInviteDialog: false,
      showEditDialog: false,
      showJoinDialog: false
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
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
