// pages/role-management/role-management.ts
import { 
  ROLES, 
  ROLE_INFO, 
  ROLE_OPTIONS, 
  ROLE_PERMISSION_MATRIX,
  getRoleName, 
  getRoleColor,
  getAvailableRolesForUser,
  formatRoleDisplay 
} from '../../utils/role-config.js'

interface User {
  _id: string
  nickname: string
  avatarUrl?: string
  phone?: string
  role: string
  isActive: boolean
  createTime: string
}

interface RoleInfo {
  code: string
  name: string
  description: string
  level: number
  color: string
  userCount?: number
}

Page({
  data: {
    // 当前用户角色
    userRole: '',
    
    // 角色列表
    roleList: [] as RoleInfo[],
    
    // 权限矩阵
    permissionMatrix: ROLE_PERMISSION_MATRIX,
    
    // 用户列表
    userList: [] as User[],
    searchKeyword: '',
    
    // 分页
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    loadingMore: false,
    
    // 角色分配弹窗
    showRoleDialog: false,
    selectedUser: {} as User,
    selectedRole: '',
    availableRoles: [] as any[]
  },

  onLoad() {
    this.initPage()
  },

  async initPage() {
    try {
      // 获取当前用户信息
      await this.getCurrentUserInfo()
      
      // 初始化角色列表
      this.initRoleList()
      
      // 加载用户列表
      if (this.canManageUsers()) {
        await this.loadUsers()
        await this.loadUserCounts()
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '页面加载失败',
        icon: 'error'
      })
    }
  },

  // 获取当前用户信息
  async getCurrentUserInfo() {
    const app = getApp()
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    
    if (userInfo && userInfo.role) {
      this.setData({
        userRole: userInfo.role
      })
    } else {
      // 如果没有用户信息，跳转到登录页
      wx.redirectTo({
        url: '/packageUser/login/login'
      })
    }
  },

  // 初始化角色列表
  initRoleList() {
    const roleList = Object.values(ROLE_INFO).map(role => ({
      ...role,
      userCount: 0
    }))
    
    this.setData({ roleList })
  },

  // 检查是否可以管理用户
  canManageUsers() {
    const { userRole } = this.data
    return userRole === ROLES.SUPER_ADMIN || userRole === ROLES.MANAGER
  },

  // 加载用户列表
  async loadUsers(reset = false) {
    if (!this.canManageUsers()) return

    const { currentPage, pageSize, userList, searchKeyword } = this.data
    const page = reset ? 1 : currentPage

    try {
      this.setData({ loadingMore: true })

      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'list_users',
          page,
          pageSize,
          searchKeyword: searchKeyword || undefined,
          includeRole: true
        }
      })

      if (result.result.success) {
        const newUsers = result.result.data.users || []
        const updatedUserList = reset ? newUsers : [...userList, ...newUsers]
        
        this.setData({
          userList: updatedUserList,
          currentPage: page,
          hasMore: newUsers.length === pageSize,
          loadingMore: false
        })
      } else {
        throw new Error(result.result.message)
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '加载用户失败',
        icon: 'error'
      })
      this.setData({ loadingMore: false })
    }
  },

  // 加载各角色用户数量
  async loadUserCounts() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'get_role_statistics'
        }
      })

      if (result.result.success) {
        const statistics = result.result.data.statistics || {}
        const { roleList } = this.data
        
        const updatedRoleList = roleList.map(role => ({
          ...role,
          userCount: statistics[role.code] || 0
        }))
        
        this.setData({ roleList: updatedRoleList })
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  // 搜索用户
  onSearchChange(event: any) {
    const searchKeyword = event.detail.value
    this.setData({ searchKeyword })
    
    // 防抖搜索
    clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => {
      this.loadUsers(true)
    }, 500)
  },

  // 加载更多用户
  loadMoreUsers() {
    if (!this.data.hasMore || this.data.loadingMore) return
    
    this.setData({
      currentPage: this.data.currentPage + 1
    })
    this.loadUsers()
  },

  // 选择用户
  onUserSelect(event: any) {
    if (!this.canManageUsers()) {
      wx.showToast({
        title: '无权限管理用户',
        icon: 'error'
      })
      return
    }

    const user = event.currentTarget.dataset.user
    const availableRoles = getAvailableRolesForUser(this.data.userRole)
    
    this.setData({
      selectedUser: user,
      selectedRole: user.role,
      availableRoles,
      showRoleDialog: true
    })
  },

  // 选择角色
  onRoleSelect(event: any) {
    const role = event.currentTarget.dataset.role
    this.setData({ selectedRole: role })
  },

  // 确认角色分配
  async onRoleConfirm() {
    const { selectedUser, selectedRole } = this.data
    
    if (!selectedRole || selectedRole === selectedUser.role) {
      return
    }

    try {
      wx.showLoading({ title: '正在分配角色...' })

      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_user_role',
          userId: selectedUser._id,
          newRole: selectedRole,
          remark: `管理员分配角色：${getRoleName(selectedRole)}`
        }
      })

      wx.hideLoading()

      if (result.result.success) {
        wx.showToast({
          title: '角色分配成功',
          icon: 'success'
        })

        // 更新用户列表中的角色
        const { userList } = this.data
        const updatedUserList = userList.map(user => 
          user._id === selectedUser._id 
            ? { ...user, role: selectedRole }
            : user
        )
        
        this.setData({
          userList: updatedUserList,
          showRoleDialog: false
        })

        // 重新加载角色统计
        this.loadUserCounts()
      } else {
        throw new Error(result.result.message)
      }
    } catch (error) {
      wx.hideLoading()
      // 已移除调试日志
      wx.showToast({
        title: '角色分配失败',
        icon: 'error'
      })
    }
  },

  // 关闭角色弹窗
  onRoleDialogClose() {
    this.setData({
      showRoleDialog: false,
      selectedUser: {},
      selectedRole: '',
      availableRoles: []
    })
  },

  // 获取权限级别样式类
  getPermissionLevel(permission: string) {
    if (!permission || permission === '无权限') return 'no-permission'
    if (permission.includes('完全')) return 'full-permission'
    if (permission.includes('部分') || permission.includes('基础')) return 'partial-permission'
    return 'limited-permission'
  },

  // 工具方法
  getRoleName(roleCode: string) {
    return getRoleName(roleCode)
  },

  getRoleColor(roleCode: string) {
    return getRoleColor(roleCode)
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '鹅场管理系统 - 角色管理',
      path: '/packageUser/role-management/role-management'
    }
  },

  // 私有属性
  searchTimer: null as any
})
