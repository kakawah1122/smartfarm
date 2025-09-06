// invite-management.ts - 邀请管理页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 邀请列表数据
    inviteList: [] as any[],
    loading: true,
    loadingMore: false,
    hasMore: true,
    
    // 分页信息
    page: 1,
    pageSize: 20,
    
    // 搜索和筛选
    searchKeyword: '',
    activeTab: 'all',
    
    // 统计数据
    stats: {
      total: 0,
      pending: 0,
      used: 0,
      revoked: 0,
      expired: 0,
      usageRate: '0.0'
    },
    
    // 邀请详情弹窗
    showInviteDetail: false,
    selectedInvite: null as any,
    
    // 创建邀请弹窗
    showCreateDialog: false,
    newInvite: {
      inviteeName: '',
      inviteePhone: '',
      department: '',
      position: '',
      role: 'user',
      expiryDays: 7,
      remark: ''
    },
    selectedRoleIndex: [0], // 默认选择普通用户（索引0）
    selectedExpiryIndex: [1], // 默认选择7天（索引1）
    
    // 撤销邀请弹窗
    showRevokeDialog: false,
    revokeReason: '',
    
    // 选项数据
    roleOptions: [
      { label: '普通用户', value: 'user' },
      { label: '操作员', value: 'operator' },
      { label: '管理员', value: 'admin' }
    ],
    expiryOptions: [
      { label: '3天', value: 3 },
      { label: '7天', value: 7 },
      { label: '15天', value: 15 },
      { label: '30天', value: 30 }
    ]
  },

  onLoad() {
    this.loadInviteStats()
    this.loadInviteList()
  },

  // 加载邀请统计
  async loadInviteStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'employee-invite-management',
        data: {
          action: 'get_invite_stats'
        }
      })

      if (result.result && result.result.success) {
        this.setData({
          stats: result.result.data
        })
      }
    } catch (error) {
    }
  },

  // 加载邀请列表
  async loadInviteList(reset = true) {
    try {
      if (reset) {
        this.setData({ loading: true, page: 1 })
      } else {
        this.setData({ loadingMore: true })
      }

      const currentPage = reset ? 1 : this.data.page + 1
      let status = null

      // 根据选项卡设置筛选条件
      if (this.data.activeTab !== 'all') {
        status = this.data.activeTab
      }

      const result = await wx.cloud.callFunction({
        name: 'employee-invite-management',
        data: {
          action: 'list_invites',
          page: currentPage,
          pageSize: this.data.pageSize,
          status: status,
          searchKeyword: this.data.searchKeyword || null,
          sortBy: 'createTime',
          sortOrder: 'desc'
        }
      })

      if (result.result && result.result.success) {
        const rawInvites = result.result.data.invites || []
        const pagination = result.result.data.pagination
        
        // 标准化邀请数据，确保所有字段都有默认值
        const newInvites = rawInvites.map(invite => this.normalizeInviteData(invite))

        this.setData({
          inviteList: reset ? newInvites : [...this.data.inviteList, ...newInvites],
          page: currentPage,
          hasMore: currentPage < pagination.totalPages,
          loading: false,
          loadingMore: false
        })
      } else {
        throw new Error(result.result?.message || '加载失败')
      }
    } catch (error) {
      this.setData({
        loading: false,
        loadingMore: false
      })
      
      if (error.message?.includes('权限不足')) {
        wx.showModal({
          title: '权限不足',
          content: '您没有邀请管理权限，请联系超级管理员',
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

  // 搜索邀请
  async searchInvites() {
    this.loadInviteList()
  },

  // 创建邀请
  async createInvite() {
    const { inviteeName, inviteePhone, department, position, role, expiryDays, remark } = this.data.newInvite

    // 数据验证
    if (!inviteeName.trim()) {
      wx.showToast({
        title: '请输入被邀请人姓名',
        icon: 'none'
      })
      return
    }

    if (!inviteePhone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      })
      return
    }

    // 手机号验证
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(inviteePhone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '创建中...' })

      const result = await wx.cloud.callFunction({
        name: 'employee-invite-management',
        data: {
          action: 'create_invite',
          inviteeName: inviteeName.trim(),
          inviteePhone: inviteePhone.trim(),
          department: department.trim(),
          position: position.trim(),
          role: role,
          expiryDays: expiryDays,
          remark: remark.trim()
        }
      })

      if (result.result && result.result.success) {
        wx.showToast({
          title: '邀请创建成功',
          icon: 'success'
        })
        
        // 显示邀请码
        wx.showModal({
          title: '邀请创建成功',
          content: `邀请码：${result.result.data.inviteCode}\n请将邀请码发送给被邀请人`,
          showCancel: false
        })
        
        this.closeCreateDialog()
        this.loadInviteList()
        this.loadInviteStats()
      }
    } catch (error) {
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 撤销邀请
  async confirmRevoke() {
    if (!this.data.revokeReason.trim()) {
      wx.showToast({
        title: '请填写撤销原因',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '撤销中...' })

      const result = await wx.cloud.callFunction({
        name: 'employee-invite-management',
        data: {
          action: 'revoke_invite',
          inviteId: this.data.selectedInvite._id,
          reason: this.data.revokeReason.trim()
        }
      })

      if (result.result && result.result.success) {
        wx.showToast({
          title: '邀请已撤销',
          icon: 'success'
        })
        
        this.closeRevokeDialog()
        this.closeInviteDetail()
        this.loadInviteList()
        this.loadInviteStats()
      }
    } catch (error) {
      wx.showToast({
        title: '撤销失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 重新发送邀请
  async resendInvite() {
    try {
      wx.showLoading({ title: '处理中...' })

      const result = await wx.cloud.callFunction({
        name: 'employee-invite-management',
        data: {
          action: 'resend_invite',
          inviteId: this.data.selectedInvite._id,
          expiryDays: 7
        }
      })

      if (result.result && result.result.success) {
        wx.showToast({
          title: '邀请已重新发送',
          icon: 'success'
        })
        
        this.closeInviteDetail()
        this.loadInviteList()
      }
    } catch (error) {
      wx.showToast({
        title: '发送失败',
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
    this.loadInviteList()
  },

  onSearchChange(e: any) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  onSearch() {
    this.searchInvites()
  },

  onSearchClear() {
    this.setData({
      searchKeyword: ''
    })
    this.loadInviteList()
  },

  onInviteClick(e: any) {
    const invite = e.currentTarget.dataset.invite
    this.setData({
      selectedInvite: invite,
      showInviteDetail: true
    })
  },

  loadMore() {
    if (!this.data.loadingMore && this.data.hasMore) {
      this.loadInviteList(false)
    }
  },

  // 弹窗控制
  showCreateDialog() {
    this.setData({
      showCreateDialog: true,
      newInvite: {
        inviteeName: '',
        inviteePhone: '',
        department: '',
        position: '',
        role: 'user',
        expiryDays: 7,
        remark: ''
      }
    })
  },

  closeCreateDialog() {
    this.setData({
      showCreateDialog: false
    })
  },

  closeInviteDetail() {
    this.setData({
      showInviteDetail: false,
      selectedInvite: null
    })
  },

  revokeInvite() {
    this.setData({
      showRevokeDialog: true,
      revokeReason: ''
    })
  },

  closeRevokeDialog() {
    this.setData({
      showRevokeDialog: false,
      revokeReason: ''
    })
  },

  // 表单事件
  onInviteeNameChange(e: any) {
    this.setData({
      'newInvite.inviteeName': e.detail.value
    })
  },

  onInviteePhoneChange(e: any) {
    this.setData({
      'newInvite.inviteePhone': e.detail.value
    })
  },

  onDepartmentChange(e: any) {
    this.setData({
      'newInvite.department': e.detail.value
    })
  },

  onPositionChange(e: any) {
    this.setData({
      'newInvite.position': e.detail.value
    })
  },

  onRoleChange(e: any) {
    const selectedIndex = e.detail.value
    const selectedRole = this.data.roleOptions[selectedIndex[0]]?.value || 'user'
    this.setData({
      selectedRoleIndex: selectedIndex,
      'newInvite.role': selectedRole
    })
  },

  onExpiryDaysChange(e: any) {
    const selectedIndex = e.detail.value
    const selectedDays = this.data.expiryOptions[selectedIndex[0]]?.value || 7
    this.setData({
      selectedExpiryIndex: selectedIndex,
      'newInvite.expiryDays': selectedDays
    })
  },

  onRemarkChange(e: any) {
    this.setData({
      'newInvite.remark': e.detail.value
    })
  },

  onRevokeReasonChange(e: any) {
    this.setData({
      revokeReason: e.detail.value
    })
  },

  // 数据标准化函数
  normalizeInviteData(invite: any) {
    // 确保所有必要字段都有默认值
    const normalized = {
      ...invite,
      _id: invite._id || '',
      inviteCode: invite.inviteCode || '',
      inviteeName: invite.inviteeName || invite.name || '未知用户',
      inviteePhone: invite.inviteePhone || invite.phone || '',
      department: invite.department || '',
      position: invite.position || '',
      role: invite.role || 'user',
      status: invite.status || 'pending',
      createTime: invite.createTime || new Date(),
      expiresAt: invite.expiresAt || new Date(),
      remark: invite.remark || ''
    }
    
    // 计算状态文本
    normalized.statusText = this.getStatusText(normalized.status)
    
    // 计算剩余天数（如果是待使用状态）
    if (normalized.status === 'pending') {
      const now = new Date()
      const expiresAt = new Date(normalized.expiresAt)
      const diffTime = expiresAt.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      normalized.remainingDays = Math.max(0, diffDays)
    }
    
    return normalized
  },

  // 工具函数
  getStatusTheme(status: string): string {
    if (!status) return 'default'
    const themeMap = {
      'pending': 'warning',
      'used': 'success',
      'expired': 'danger',
      'revoked': 'default'
    }
    return themeMap[status] || 'default'
  },

  getStatusText(status: string): string {
    if (!status) return '未知状态'
    const statusMap = {
      'pending': '待使用',
      'used': '已使用',
      'expired': '已过期',
      'revoked': '已撤销'
    }
    return statusMap[status] || '未知状态'
  },

  getRoleText(role: string): string {
    const roleMap = {
      'user': '普通用户',
      'operator': '操作员',
      'admin': '管理员',
      'manager': '经理'
    }
    return roleMap[role] || '未知角色'
  },

  formatTime(time: string | Date): string {
    if (!time) return '未知'
    const date = new Date(time)
    return date.toLocaleString()
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
}

Page(createPageWithNavbar(pageConfig))
