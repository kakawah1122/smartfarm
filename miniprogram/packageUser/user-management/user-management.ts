// user-management.ts - 用户管理页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 用户列表数据
    userList: [] as any[],
    loading: true,
    loadingMore: false,
    hasMore: true,
    
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
    selectedUser: null as any,
    originalRole: '', // 原始角色，用于判断是否有变更
    roleChanged: false, // 角色是否变更
    
    // 角色选择
    selectedRoleIndex: [0],
    roleOptions: [
      { label: '员工', value: 'employee' },
      { label: '兽医', value: 'veterinarian' },
      { label: '经理', value: 'manager' },
      { label: '超级管理员', value: 'super_admin' }
    ]
  },

  onLoad(options: any) {
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
      // 已移除调试日志
    }
  },

  // 加载用户列表
  async loadUserList(reset = true) {
    try {
      if (reset) {
        this.setData({ loading: true, page: 1 })
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
        const newUsers = result.result.data.users
        const pagination = result.result.data.pagination

        // 临时调试：查看用户数据
        if (newUsers.length > 0) {
          console.log('用户数据示例:', JSON.stringify(newUsers[0], null, 2))
        }

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
    } catch (error) {
      // 已移除调试日志
      this.setData({
        loading: false,
        loadingMore: false
      })
      
      // 权限不足提示
      if (error.message?.includes('权限不足')) {
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
  openUserDetail(user: any) {
    console.log('准备显示用户详情:', user.nickName, user.role)
    
    const currentRoleIndex = this.data.roleOptions.findIndex(
      option => option.value === user.role
    )
    
    console.log('当前角色索引:', currentRoleIndex)
    
    this.setData({
      selectedUser: user,
      originalRole: user.role,
      selectedRoleIndex: [Math.max(0, currentRoleIndex)],
      roleChanged: false,
      showUserDetail: true
    }, () => {
      console.log('弹窗状态已更新:', this.data.showUserDetail)
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
          roleChanged: false
        })
        
        // 刷新列表
        this.loadUserList()
        this.loadUserStats()
      }
    } catch (error) {
      console.error('更新角色失败:', error)
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
            console.error(`${actionText}账户失败:`, error)
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

  // 导出用户数据
  async exportUsers() {
    try {
      wx.showLoading({ title: '导出中...' })

      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'export_users'
        }
      })

      if (result.result && result.result.success) {
        // 这里可以实现具体的导出逻辑
        // 比如显示数据或生成文件
        wx.showModal({
          title: '导出成功',
          content: `已导出 ${result.result.data.total} 条用户数据\n导出时间：${new Date(result.result.data.exportTime).toLocaleString()}`,
          showCancel: false
        })
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 事件处理
  onTabChange(e: any) {
    this.setData({
      activeTab: e.detail.value
    })
    this.loadUserList()
  },

  onUserClick(e: any) {
    const user = e.currentTarget.dataset.user
    console.log('点击用户:', user)
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

  stopPropagation() {
    // 阻止事件冒泡
  },

  onRoleChange(e: any) {
    const selectedIndex = e.detail.value
    const selectedRole = this.data.roleOptions[selectedIndex]?.value
    const roleChanged = selectedRole !== this.data.originalRole
    
    this.setData({
      selectedRoleIndex: [selectedIndex],
      roleChanged: roleChanged
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
    if (!permissions || permissions.length === 0) return []
    
    // 如果包含 * 或 all，显示全部权限
    if (permissions.includes('*') || permissions.includes('all')) {
      return ['全部权限']
    }
    
    // 权限映射表
    const permissionMap: Record<string, string> = {
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
    
    // 只显示前8个主要权限
    return permissions
      .slice(0, 8)
      .map(p => permissionMap[p] || p)
      .filter(p => p !== 'basic')
  },

  // 工具函数
  getUserRoleText(role: string): string {
    if (!role) return '员工'
    const roleMap = {
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
    const themeMap = {
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
    const statusMap = {
      'active': '正常',
      'disabled': '禁用',
      'suspended': '暂停'
    }
    return statusMap[status] || '正常'
  },

  getUserStatusTheme(status: string): string {
    if (!status) return 'success'
    const themeMap = {
      'active': 'success',
      'disabled': 'danger',
      'suspended': 'warning'
    }
    return themeMap[status] || 'success'
  },

  formatTime(time: string | Date): string {
    if (!time) return '未知'
    const date = new Date(time)
    return date.toLocaleString()
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
