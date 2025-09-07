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
    
    // 搜索和筛选
    searchKeyword: '',
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
    
    // 角色修改弹窗
    showRoleDialog: false,
    newRole: '',
    selectedRoleIndex: [0], // picker需要数组格式
    roleChangeReason: '',
    roleOptions: [
      { label: '普通用户', value: 'user' },
      { label: '操作员', value: 'operator' },
      { label: '管理员', value: 'admin' },
      { label: '经理', value: 'manager' }
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
      
      console.log('从员工管理中间页接收权限信息，跳过权限检查')
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
      console.error('加载用户统计失败:', error)
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
      console.error('加载用户列表失败:', error)
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

  // 搜索用户
  async searchUsers() {
    if (!this.data.searchKeyword.trim()) {
      this.loadUserList()
      return
    }

    try {
      this.setData({ loading: true })

      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'search_users',
          keyword: this.data.searchKeyword.trim(),
          searchType: 'all',
          page: 1,
          pageSize: this.data.pageSize
        }
      })

      if (result.result && result.result.success) {
        this.setData({
          userList: result.result.data.users,
          hasMore: false,
          loading: false
        })
      }
    } catch (error) {
      console.error('搜索用户失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '搜索失败',
        icon: 'none'
      })
    }
  },

  // 获取用户详情
  async getUserDetail(userId: string) {
    try {
      wx.showLoading({ title: '加载详情...' })

      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'get_user_detail',
          userId: userId
        }
      })

      if (result.result && result.result.success) {
        this.setData({
          selectedUser: result.result.data.user,
          showUserDetail: true
        })
      }
    } catch (error) {
      console.error('获取用户详情失败:', error)
      wx.showToast({
        title: '获取详情失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 更新用户角色
  async updateUserRole() {
    if (!this.data.newRole) {
      wx.showToast({
        title: '请选择角色',
        icon: 'none'
      })
      return
    }

    if (!this.data.roleChangeReason.trim()) {
      wx.showToast({
        title: '请填写修改原因',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '更新中...' })

      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_user_role',
          userId: this.data.selectedUser._id,
          newRole: this.data.newRole,
          reason: this.data.roleChangeReason.trim()
        }
      })

      if (result.result && result.result.success) {
        wx.showToast({
          title: '角色更新成功',
          icon: 'success'
        })
        
        this.closeRoleDialog()
        this.closeUserDetail()
        this.loadUserList()
        this.loadUserStats()
      }
    } catch (error) {
      console.error('更新用户角色失败:', error)
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
    const newStatus = user.status === 'active' ? 'disabled' : 'active'
    const actionText = newStatus === 'active' ? '启用' : '禁用'

    wx.showModal({
      title: `${actionText}用户`,
      content: `确定要${actionText}用户"${user.nickname}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: `${actionText}中...` })

            const result = await wx.cloud.callFunction({
              name: 'user-management',
              data: {
                action: 'toggle_user_status',
                userId: user._id,
                status: newStatus,
                reason: `管理员${actionText}用户`
              }
            })

            if (result.result && result.result.success) {
              wx.showToast({
                title: `${actionText}成功`,
                icon: 'success'
              })
              
              this.closeUserDetail()
              this.loadUserList()
              this.loadUserStats()
            }
          } catch (error) {
            console.error('切换用户状态失败:', error)
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
      console.error('导出用户数据失败:', error)
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

  onSearchChange(e: any) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  onSearch() {
    this.searchUsers()
  },

  onSearchClear() {
    this.setData({
      searchKeyword: ''
    })
    this.loadUserList()
  },

  onUserClick(e: any) {
    const user = e.currentTarget.dataset.user
    this.getUserDetail(user._id)
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
      selectedUser: null
    })
  },

  showRoleDialog() {
    // 找到当前用户角色在选项中的索引
    const currentRoleIndex = this.data.roleOptions.findIndex(
      option => option.value === this.data.selectedUser.role
    )
    
    this.setData({
      showRoleDialog: true,
      newRole: this.data.selectedUser.role,
      selectedRoleIndex: [Math.max(0, currentRoleIndex)],
      roleChangeReason: ''
    })
  },

  closeRoleDialog() {
    this.setData({
      showRoleDialog: false,
      newRole: '',
      selectedRoleIndex: [0],
      roleChangeReason: ''
    })
  },

  onRoleChange(e: any) {
    const selectedIndex = e.detail.value
    const selectedRole = this.data.roleOptions[selectedIndex]?.value || 'user'
    
    this.setData({
      selectedRoleIndex: [selectedIndex],
      newRole: selectedRole
    })
  },

  onReasonChange(e: any) {
    this.setData({
      roleChangeReason: e.detail.value
    })
  },

  // 工具函数
  getUserRoleText(role: string): string {
    const roleMap = {
      'user': '普通用户',
      'operator': '操作员',
      'admin': '管理员',
      'manager': '经理'
    }
    return roleMap[role] || '未知角色'
  },

  getUserRoleTheme(role: string): string {
    if (!role) return 'default'
    const themeMap = {
      'user': 'default',
      'operator': 'primary', 
      'admin': 'warning',
      'manager': 'danger'
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
        url: '/pages/employee-permission/employee-permission'
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
