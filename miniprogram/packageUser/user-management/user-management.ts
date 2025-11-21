// user-management.ts - 用户管理页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 用户列表数据
    userList: [] as unknown[],
    loading: true,
    loadingMore: false,
    hasMore: true,
    loadError: false,
    
    // 权限相关
    userInfo: null,
    fromEmployeeManagement: false,  // 标记是否从员工管理中间页进入
    
    // 分页信息
    page: 1,
    pageSize: 20,
    
    // 筛选
    activeTab: 'all',
    
    // 统计数据
    stats: {
      totalUsers: 0,
      activeUsers: 0,
      adminUsers: 0,
      recentActiveUsers: 0
    },
    
    // 用户详情弹窗
    showUserDetail: false,
    selectedUser: null as unknown,
    originalRole: '', // 原始角色，用于判断是否有变更
    roleChanged: false, // 角色是否变更
    
    // 角色选择
    selectedRoleIndex: [0],
    roleOptions: [
      { label: '员工', value: 'employee' },
      { label: '兽医', value: 'veterinarian' },
      { label: '经理', value: 'manager' },
      { label: '超级管理员', value: 'super_admin' }
    ],
    
    // 角色权限映射
    rolePermissionsMap: {
      'employee': ['basic', 'production.view', 'production.manage', 'health.view', 'health.manage'],
      'veterinarian': ['basic', 'production.view', 'health.view', 'health.manage'],
      'manager': ['basic', 'production.view', 'production.manage', 'health.view', 'health.manage', 'finance.view', 'finance.manage', 'employee.view'],
      'super_admin': ['all']
    },
    
    // 当前预览的权限（根据选择的角色动态更新）
    previewPermissions: [] as string[],
    
    // 显示的权限文本列表
    displayPermissions: [] as string[]
  },

  onLoad(options: unknown) {
    // 检查是否从员工管理中间页传递了权限信息
    if (options && options.from === 'employee-management' && options.hasPermission === 'true') {
      const userInfo = {
        role: options.userRole,
        isSuper: options.isSuper === 'true'
      }
      
      this.setData({
        userInfo: userInfo,
        fromEmployeeManagement: true
      })
      
      // 已移除调试日志
    }
    
    this.loadUserStats()
    this.loadUserList()
  },

  // 加载用户统计
  async loadUserStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'get_user_stats'
        }
      })

      if (result.result && result.result.success) {
        this.setData({
          stats: result.result.data
        })
      }
    } catch (error) {
      console.error('用户统计加载失败:', error)
      // 统计数据加载失败不阻塞页面显示
    }
  },

  // 加载用户列表
  async loadUserList(reset = true) {
    try {
      if (reset) {
        this.setData({ loading: true, page: 1, loadError: false })
      } else {
        this.setData({ loadingMore: true })
      }

      const currentPage = reset ? 1 : this.data.page + 1
      let role = null
      let status = null

      // 根据选项卡设置筛选条件
      switch (this.data.activeTab) {
        case 'admin':
          role = 'admin'
          break
        case 'user':
          role = 'user'
          break
        case 'disabled':
          status = 'disabled'
          break
      }

      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'list_users',
          page: currentPage,
          pageSize: this.data.pageSize,
          role: role,
          status: status,
          sortBy: 'createTime',
          sortOrder: 'desc'
        }
      })

      if (result.result && result.result.success) {
        const rawUsers = result.result.data.users
        const pagination = result.result.data.pagination
        
        // 标准化用户数据，确保字段一致性
        const newUsers = rawUsers.map((user: unknown) => ({
          ...user,
          nickname: user.nickname || user.nickName || '未设置昵称',
          farmName: user.farmName || user.department || '未设置农场',
          phone: user.phone || '未绑定手机',
          roleText: this.getUserRoleText(user.role || 'employee'),
          roleTheme: this.getUserRoleTheme(user.role || 'employee')
        }))

        this.setData({
          userList: reset ? newUsers : [...this.data.userList, ...newUsers],
          page: currentPage,
          hasMore: currentPage < pagination.totalPages,
          loading: false,
          loadingMore: false
        })
      } else {
        throw new Error(result.result?.message || '加载失败')
      }
    } catch (error: unknown) {
      this.setData({
        loading: false,
        loadingMore: false,
        loadError: true
      })
      
      // 权限不足提示
      if (error.message?.includes('权限不足') || error.errMsg?.includes('权限不足')) {
        wx.showModal({
          title: '权限不足',
          content: '您没有用户管理权限，请联系超级管理员',
          showCancel: false
        })
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    }
  },

  // 显示用户详情弹窗
  openUserDetail(user: unknown) {
    const currentRoleIndex = this.data.roleOptions.findIndex(
      (option: { label: string; value: string }) => option.value === user.role
    )
    
    // 获取当前角色的权限
    const currentRole = user.role || 'employee'
    const permissions = this.data.rolePermissionsMap[currentRole] || []
    
    // 计算显示的权限文本
    const displayPermissions = this.getDisplayPermissions(permissions)
    
    // 格式化用户数据
    const formattedUser = {
      ...user,
      status: user.status || 'active', // 确保状态字段存在
      statusText: this.getUserStatusText(user.status || 'active')
    }
    
    this.setData({
      selectedUser: formattedUser,
      originalRole: user.role,
      selectedRoleIndex: [Math.max(0, currentRoleIndex)],
      roleChanged: false,
      previewPermissions: permissions,
      displayPermissions: displayPermissions,
      showUserDetail: true
    })
  },

  // 确认角色更新
  async confirmRoleUpdate() {
    if (!this.data.roleChanged) {
      return
    }

    const newRole = this.data.roleOptions[this.data.selectedRoleIndex[0]].value
    const newRoleName = this.data.roleOptions[this.data.selectedRoleIndex[0]].label

    try {
      wx.showLoading({ title: '更新中...' })

      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_user_role',
          userId: this.data.selectedUser._id,
          newRole: newRole,
          reason: `管理员修改角色为${newRoleName}`
        }
      })

      if (result.result && result.result.success) {
        wx.showToast({
          title: '角色更新成功',
          icon: 'success'
        })
        
        // 更新本地数据
        const updatedUser = {
          ...this.data.selectedUser,
          role: newRole
        }
        
        this.setData({
          selectedUser: updatedUser,
          originalRole: newRole,
          roleChanged: false,
          showUserDetail: false
        })
        
        // 刷新列表
        this.loadUserList()
        this.loadUserStats()
      }
    } catch (error) {
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 切换用户状态
  async toggleUserStatus() {
    const user = this.data.selectedUser
    const isActive = user.isActive !== false
    const actionText = isActive ? '禁用' : '启用'

    wx.showModal({
      title: `${actionText}账户`,
      content: `确定要${actionText}用户"${user.nickName || user.nickname}"的账户吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: `${actionText}中...` })

            const result = await wx.cloud.callFunction({
              name: 'user-management',
              data: {
                action: 'toggle_user_status',
                userId: user._id,
                isActive: !isActive,
                reason: `管理员${actionText}账户`
              }
            })

            if (result.result && result.result.success) {
              wx.showToast({
                title: `${actionText}成功`,
                icon: 'success'
              })
              
              // 更新本地数据
              const updatedUser = {
                ...this.data.selectedUser,
                isActive: !isActive
              }
              
              this.setData({
                selectedUser: updatedUser
              })
              
              // 刷新列表
              this.loadUserList()
              this.loadUserStats()
            }
          } catch (error) {
            wx.showToast({
              title: `${actionText}失败`,
              icon: 'none'
            })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  // 事件处理
  onTabChange(e: CustomEvent) {
    this.setData({
      activeTab: e.detail.value
    })
    this.loadUserList()
  },

  onUserClick(e: CustomEvent) {
    const user = e.currentTarget.dataset.user
    this.openUserDetail(user)
  },

  loadMore() {
    if (!this.data.loadingMore && this.data.hasMore) {
      this.loadUserList(false)
    }
  },

  // 弹窗控制
  closeUserDetail() {
    this.setData({
      showUserDetail: false,
      selectedUser: null,
      roleChanged: false
    })
  },

  onUserDetailPopupChange(e: CustomEvent) {
    if (!e.detail.visible) {
      this.closeUserDetail()
    }
  },

  onPopupVisibleChange(e: CustomEvent) {
    if (!e.detail.visible) {
      this.closeUserDetail()
    }
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  onRoleChange(e: CustomEvent) {
    const selectedIndex = e.detail.value[0] || e.detail.value
    const selectedRole = this.data.roleOptions[selectedIndex]?.value
    const roleChanged = selectedRole !== this.data.originalRole
    
    // 获取新选择角色的权限
    const newPermissions = this.data.rolePermissionsMap[selectedRole] || []
    
    // 计算显示的权限文本
    const displayPermissions = this.getDisplayPermissions(newPermissions)
    
    this.setData({
      selectedRoleIndex: [selectedIndex],
      roleChanged: roleChanged,
      previewPermissions: newPermissions,
      displayPermissions: displayPermissions
    })
  },

  // 获取角色样式类
  getRoleClass(role: string): string {
    const classMap: Record<string, string> = {
      'super_admin': 'role-super-admin',
      'manager': 'role-manager',
      'employee': 'role-employee',
      'veterinarian': 'role-veterinarian',
      'admin': 'role-admin',
      'user': 'role-user',
      'operator': 'role-operator'
    }
    return classMap[role] || 'role-employee'
  },

  // 获取显示的权限（简化版）
  getDisplayPermissions(permissions: string[]): string[] {
    if (!permissions || permissions.length === 0) {
      return []
    }
    
    // 如果包含 * 或 all，显示全部权限
    if (permissions.includes('*') || permissions.includes('all')) {
      return ['全部权限']
    }
    
    // 权限映射表
    const permissionMap: Record<string, string> = {
      'basic': '基础权限',
      'production.view': '查看生产',
      'production.manage': '管理生产',
      'health.view': '查看健康',
      'health.manage': '管理健康',
      'finance.view': '查看财务',
      'finance.manage': '管理财务',
      'finance.approve': '审批财务',
      'employee.view': '查看员工',
      'employee.manage': '管理员工',
      'employee.invite': '邀请员工',
      'system.admin': '系统管理'
    }
    
    // 映射并过滤未知权限，去重
    const mapped = permissions
      .map(p => permissionMap[p])
      .filter(p => p !== undefined)
    
    // 去重
    return [...new Set(mapped)]
  },

  // 工具函数
  getUserRoleText(role: string): string {
    if (!role) return '员工'
    const roleMap: Record<string, string> = {
      // 新角色系统
      'super_admin': '超级管理员',
      'manager': '经理',
      'employee': '员工',
      'veterinarian': '兽医',
      // 旧角色兼容
      'admin': '管理员',
      'user': '普通用户',
      'operator': '操作员'
    }
    return roleMap[role] || '员工'
  },

  getUserRoleTheme(role: string): string {
    if (!role) return 'default'
    const themeMap: Record<string, string> = {
      // 新角色系统
      'super_admin': 'danger',
      'manager': 'warning',
      'employee': 'default',
      'veterinarian': 'success',
      // 旧角色兼容
      'admin': 'warning',
      'user': 'default',
      'operator': 'primary'
    }
    return themeMap[role] || 'default'
  },

  getUserStatusText(status: string): string {
    if (!status) return '正常'
    const statusMap: Record<string, string> = {
      'active': '正常',
      'disabled': '禁用',
      'suspended': '暂停'
    }
    return statusMap[status] || '正常'
  },

  getUserStatusTheme(status: string): string {
    if (!status) return 'success'
    const themeMap: Record<string, string> = {
      'active': 'success',
      'disabled': 'danger',
      'suspended': 'warning'
    }
    return themeMap[status] || 'success'
  },

  formatTime(time: string | Date): string {
    if (!time) return '未知'
    try {
      const date = new Date(time)
      // 检查日期是否有效
      if (isNaN(date.getTime())) return '未知'
      
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      
      return `${year}-${month}-${day} ${hours}:${minutes}`
    } catch (error) {
      return '未知'
    }
  },

  // 返回上一页
  goBack() {
    // 智能返回逻辑
    if (this.data.fromEmployeeManagement) {
      // 如果是从员工管理中间页来的，替换当前页面返回到员工管理中心
      wx.redirectTo({
        url: '/packageUser/employee-permission/employee-permission'
      })
    } else {
      // 否则执行普通返回
      wx.navigateBack({
        fail: () => {
          wx.switchTab({
            url: '/pages/profile/profile'
          })
        }
      })
    }
  }
}

Page(createPageWithNavbar(pageConfig))
