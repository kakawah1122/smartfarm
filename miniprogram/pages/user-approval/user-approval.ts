// user-approval.ts - 用户审批页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 用户列表数据
    userList: [] as any[],
    loading: true,
    loadingMore: false,
    hasMore: true,
    
    // 分页信息
    page: 1,
    pageSize: 20,
    
    // 搜索和筛选
    searchKeyword: '',
    activeTab: 'pending',
    
    // 统计数据
    stats: {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      approvalRate: '0.0'
    },
    
    // 用户详情弹窗
    showUserDetail: false,
    selectedUser: null as any,
    
    // 审批弹窗
    showApprovalDialog: false,
    approvalData: {
      assignedRole: 'user',
      approvalRemark: ''
    },
    selectedApprovalRoleIndex: [0], // Picker组件需要数组索引
    
    // 拒绝弹窗
    showRejectDialog: false,
    rejectedReason: '',
    
    // 批量操作
    selectedUsers: [] as string[],
    showBatchDialog: false,
    batchAction: 'approve' as 'approve' | 'reject',
    batchData: {
      assignedRole: 'user',
      remark: ''
    },
    selectedBatchRoleIndex: [0], // 批量操作Picker组件需要数组索引
    
    // 选项数据
    roleOptions: [
      { label: '普通用户', value: 'user' },
      { label: '操作员', value: 'operator' },
      { label: '管理员', value: 'admin' }
    ],
    
    // 统一弹窗状态
    showPermissionDeniedPopup: false,
    showApproveConfirmPopup: false,
    showRejectConfirmPopup: false,
    showBatchConfirmPopup: false,
    popupData: {
      title: '',
      content: '',
      type: '', // 'approve', 'reject', 'batch'
      action: ''
    }
  },

  onLoad() {
    this.loadApprovalStats()
    this.loadUserList()
  },

  // 加载审批统计
  async loadApprovalStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'user-approval',
        data: {
          action: 'get_approval_stats'
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

  // 加载用户列表
  async loadUserList(reset = true) {
    try {
      if (reset) {
        this.setData({ loading: true, page: 1 })
      } else {
        this.setData({ loadingMore: true })
      }

      const currentPage = reset ? 1 : this.data.page + 1
      let approvalStatus = null

      // 根据选项卡设置筛选条件
      if (this.data.activeTab !== 'all') {
        approvalStatus = this.data.activeTab
      }

      const result = await wx.cloud.callFunction({
        name: 'user-approval',
        data: {
          action: 'list_pending_users',
          page: currentPage,
          pageSize: this.data.pageSize,
          approvalStatus: approvalStatus,
          searchKeyword: this.data.searchKeyword || null,
          sortBy: 'createTime',
          sortOrder: 'desc'
        }
      })

      if (result.result && result.result.success) {
        const rawUsers = result.result.data.users || []
        const pagination = result.result.data.pagination
        
        // 标准化用户数据，确保所有字段都有默认值
        const newUsers = rawUsers.map(user => this.normalizeUserData(user))

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
      this.setData({
        loading: false,
        loadingMore: false
      })
      
      if (error.message?.includes('权限不足')) {
        this.setData({
          showPermissionDeniedPopup: true,
          popupData: {
            title: '权限不足',
            content: '您没有用户审批权限，请联系超级管理员',
            type: 'permission',
            action: ''
          }
        })
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    }
  },

  // 获取用户详情
  async getUserDetail(userId: string) {
    try {
      wx.showLoading({ title: '加载详情...' })

      const result = await wx.cloud.callFunction({
        name: 'user-approval',
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
      wx.showToast({
        title: '获取详情失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 显示审批确认弹窗
  showApproveConfirm() {
    const user = this.data.selectedUser
    const roleName = this.data.roleOptions.find(r => r.value === this.data.approvalData.assignedRole)?.label || '普通用户'
    
    this.setData({
      showApproveConfirmPopup: true,
      popupData: {
        title: '确认审批通过',
        content: `确定要审批通过用户 "${user.nickname}" 吗？\n分配角色：${roleName}`,
        type: 'approve',
        action: 'approve'
      }
    })
  },
  
  // 批准用户
  async approveUser() {
    const { assignedRole, approvalRemark } = this.data.approvalData

    try {
      wx.showLoading({ title: '审批中...' })

      const result = await wx.cloud.callFunction({
        name: 'user-approval',
        data: {
          action: 'approve_user',
          userId: this.data.selectedUser._id,
          assignedRole: assignedRole,
          approvalRemark: approvalRemark.trim()
        }
      })

      if (result.result && result.result.success) {
        wx.showToast({
          title: '用户审批通过',
          icon: 'success'
        })
        
        this.closeApprovalDialog()
        this.closeUserDetail()
        this.loadUserList()
        this.loadApprovalStats()
      }
    } catch (error) {
      wx.showToast({
        title: '审批失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 显示拒绝确认弹窗
  showRejectConfirm() {
    const user = this.data.selectedUser
    const reason = this.data.rejectedReason.trim()
    
    if (!reason) {
      wx.showToast({
        title: '请先填写拒绝原因',
        icon: 'none'
      })
      return
    }
    
    this.setData({
      showRejectConfirmPopup: true,
      popupData: {
        title: '确认拒绝审批',
        content: `确定要拒绝用户 "${user.nickname}" 的申请吗？\n拒绝原因：${reason}`,
        type: 'reject',
        action: 'reject'
      }
    })
  },
  
  // 拒绝用户
  async rejectUser() {
    if (!this.data.rejectedReason.trim()) {
      wx.showToast({
        title: '请填写拒绝原因',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '处理中...' })

      const result = await wx.cloud.callFunction({
        name: 'user-approval',
        data: {
          action: 'reject_user',
          userId: this.data.selectedUser._id,
          rejectedReason: this.data.rejectedReason.trim()
        }
      })

      if (result.result && result.result.success) {
        wx.showToast({
          title: '用户审批已拒绝',
          icon: 'success'
        })
        
        this.closeRejectDialog()
        this.closeUserDetail()
        this.loadUserList()
        this.loadApprovalStats()
      }
    } catch (error) {
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 显示批量操作确认弹窗
  showBatchConfirm() {
    const { selectedUsers, batchAction, batchData } = this.data

    if (selectedUsers.length === 0) {
      wx.showToast({
        title: '请选择用户',
        icon: 'none'
      })
      return
    }

    if (batchAction === 'reject' && !batchData.remark.trim()) {
      wx.showToast({
        title: '请填写拒绝原因',
        icon: 'none'
      })
      return
    }

    const actionText = batchAction === 'approve' ? '批准' : '拒绝'
    const roleName = batchAction === 'approve' ? 
      (this.data.roleOptions.find(r => r.value === batchData.assignedRole)?.label || '普通用户') : ''
    
    let content = `确定要${actionText} ${selectedUsers.length} 个用户吗？`
    if (batchAction === 'approve') {
      content += `\n分配角色：${roleName}`
    } else {
      content += `\n拒绝原因：${batchData.remark}`
    }

    this.setData({
      showBatchConfirmPopup: true,
      popupData: {
        title: `确认${actionText}操作`,
        content: content,
        type: 'batch',
        action: batchAction
      }
    })
  },
  
  // 批量操作
  async confirmBatchAction() {
    const { selectedUsers, batchAction, batchData } = this.data

    if (selectedUsers.length === 0) {
      wx.showToast({
        title: '请选择用户',
        icon: 'none'
      })
      return
    }

    if (batchAction === 'reject' && !batchData.remark.trim()) {
      wx.showToast({
        title: '请填写拒绝原因',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '批量处理中...' })

      const result = await wx.cloud.callFunction({
        name: 'user-approval',
        data: {
          action: 'batch_approve',
          userIds: selectedUsers,
          action: batchAction,
          assignedRole: batchAction === 'approve' ? batchData.assignedRole : null,
          remark: batchData.remark.trim()
        }
      })

      if (result.result && result.result.success) {
        const { successCount, errorCount } = result.result.data
        wx.showToast({
          title: `成功${successCount}个，失败${errorCount}个`,
          icon: successCount > 0 ? 'success' : 'none'
        })
        
        this.closeBatchDialog()
        this.clearSelection()
        this.loadUserList()
        this.loadApprovalStats()
      }
    } catch (error) {
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 事件处理
  onTabChange(e: any) {
    this.setData({
      activeTab: e.detail.value,
      selectedUsers: [] // 切换标签时清除选择
    })
    this.loadUserList()
  },

  onSearchChange(e: any) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  onSearch() {
    this.loadUserList()
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

  onCheckboxChange(e: any) {
    e.stopPropagation() // 阻止冒泡到 cell 点击事件
    
    const userId = e.currentTarget.dataset.userId
    const selectedUsers = [...this.data.selectedUsers]
    const index = selectedUsers.indexOf(userId)
    
    if (index === -1) {
      selectedUsers.push(userId)
    } else {
      selectedUsers.splice(index, 1)
    }
    
    this.setData({
      selectedUsers: selectedUsers
    })
  },

  loadMore() {
    if (!this.data.loadingMore && this.data.hasMore) {
      this.loadUserList(false)
    }
  },

  // 批量操作
  batchApprove() {
    this.setData({
      batchAction: 'approve',
      showBatchDialog: true,
      batchData: {
        assignedRole: 'user',
        remark: ''
      }
    })
  },

  batchReject() {
    this.setData({
      batchAction: 'reject',
      showBatchDialog: true,
      batchData: {
        assignedRole: 'user',
        remark: ''
      }
    })
  },

  clearSelection() {
    this.setData({
      selectedUsers: []
    })
  },

  // 弹窗控制
  closeUserDetail() {
    this.setData({
      showUserDetail: false,
      selectedUser: null
    })
  },

  showApprovalDialog() {
    this.setData({
      showApprovalDialog: true,
      approvalData: {
        assignedRole: 'user',
        approvalRemark: ''
      }
    })
  },

  closeApprovalDialog() {
    this.setData({
      showApprovalDialog: false
    })
  },

  showRejectDialog() {
    this.setData({
      showRejectDialog: true,
      rejectedReason: ''
    })
  },

  closeRejectDialog() {
    this.setData({
      showRejectDialog: false,
      rejectedReason: ''
    })
  },

  closeBatchDialog() {
    this.setData({
      showBatchDialog: false
    })
  },

  // 表单事件
  onAssignedRoleChange(e: any) {
    const selectedIndex = e.detail.value
    const selectedRole = this.data.roleOptions[selectedIndex[0]]?.value || 'user'
    this.setData({
      selectedApprovalRoleIndex: selectedIndex,
      'approvalData.assignedRole': selectedRole
    })
  },

  onApprovalRemarkChange(e: any) {
    this.setData({
      'approvalData.approvalRemark': e.detail.value
    })
  },

  onRejectedReasonChange(e: any) {
    this.setData({
      rejectedReason: e.detail.value
    })
  },

  onBatchRoleChange(e: any) {
    const selectedIndex = e.detail.value
    const selectedRole = this.data.roleOptions[selectedIndex[0]]?.value || 'user'
    this.setData({
      selectedBatchRoleIndex: selectedIndex,
      'batchData.assignedRole': selectedRole
    })
  },

  onBatchRemarkChange(e: any) {
    this.setData({
      'batchData.remark': e.detail.value
    })
  },
  
  // 关闭权限不足弹窗
  closePermissionDeniedPopup() {
    this.setData({
      showPermissionDeniedPopup: false
    })
  },
  
  // 关闭审批确认弹窗
  closeApproveConfirmPopup() {
    this.setData({
      showApproveConfirmPopup: false
    })
  },
  
  // 确认审批操作
  confirmApprove() {
    this.setData({
      showApproveConfirmPopup: false
    })
    this.approveUser()
  },
  
  // 关闭拒绝确认弹窗
  closeRejectConfirmPopup() {
    this.setData({
      showRejectConfirmPopup: false
    })
  },
  
  // 确认拒绝操作
  confirmReject() {
    this.setData({
      showRejectConfirmPopup: false
    })
    this.rejectUser()
  },
  
  // 关闭批量确认弹窗
  closeBatchConfirmPopup() {
    this.setData({
      showBatchConfirmPopup: false
    })
  },
  
  // 确认批量操作
  confirmBatch() {
    this.setData({
      showBatchConfirmPopup: false
    })
    this.confirmBatchAction()
  },

  // 数据标准化函数
  normalizeUserData(user: any) {
    // 确保所有必要字段都有默认值
    const normalized = {
      ...user,
      _id: user._id || '',
      nickname: user.nickname || '未设置昵称',
      phone: user.phone || '',
      farmName: user.farmName || '',
      approvalStatus: user.approvalStatus || 'pending',
      createTime: user.createTime || new Date(),
      avatarUrl: user.avatarUrl || ''
    }
    
    // 计算状态文本
    normalized.statusText = this.getStatusText(normalized.approvalStatus)
    
    // 计算等待天数
    if (normalized.createTime) {
      const now = new Date()
      const createTime = new Date(normalized.createTime)
      const diffTime = now.getTime() - createTime.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      normalized.waitingDays = Math.max(0, diffDays)
    } else {
      normalized.waitingDays = 0
    }
    
    return normalized
  },

  // 工具函数
  getStatusTheme(status: string): string {
    if (!status) return 'default' // 增强null/undefined检查
    const themeMap = {
      'pending': 'warning',
      'approved': 'success',
      'rejected': 'danger'
    }
    return themeMap[status] || 'default'
  },

  getStatusText(status: string): string {
    if (!status) return '未知状态'
    const statusMap = {
      'pending': '待审批',
      'approved': '已审批',
      'rejected': '已拒绝'
    }
    return statusMap[status] || '未知状态'
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
