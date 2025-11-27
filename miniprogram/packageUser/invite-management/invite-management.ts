// invite-management.ts - 邀请管理页面
import { createPageWithNavbar } from '../../utils/navigation'

// 邀请项类型定义
interface InviteItem {
  _id: string
  inviteCode: string
  inviteeName: string
  inviteePhone: string
  department: string
  position: string
  role: string
  status: 'pending' | 'used' | 'expired' | 'revoked'
  createTime: Date | string
  expiresAt: Date | string
  remark: string
  statusText?: string
  remainingDays?: number
  name?: string
  phone?: string
}

// 用户信息类型
interface UserInfo {
  _id?: string
  nickName?: string
  avatarUrl?: string
  role?: string
}

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  // ✅ 定时器管理
  _timerIds: [] as number[],
  
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  _clearAllTimers() {
    this._timerIds.forEach((id: number) => clearTimeout(id))
    this._timerIds = []
  },

  data: {
    // 用户信息
    userInfo: null as unknown,
    fromEmployeeManagement: false,  // 标记是否从员工管理中间页进入
    
    // 邀请列表数据
    inviteList: [] as unknown[],
    loading: true,
    loadingMore: false,
    hasMore: true,
    
    // 分页信息
    page: 1,
    pageSize: 20,
    
    // 筛选
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
    selectedInvite: null as unknown,
    
    // 创建邀请弹窗
    showCreateDialog: false,
    newInvite: {
      role: 'employee',
      expiryDays: 7,
      remark: ''
    },
    selectedRoleIndex: [0], // 默认选择员工（索引0）
    selectedExpiryIndex: [1], // 默认选择7天（索引1）
    
    // 邀请码生成结果
    generatedInviteCode: '', // 生成的邀请码
    isInviteGenerated: false, // 是否已生成邀请码
    
    // 撤销邀请弹窗
    showRevokeDialog: false,
    revokeReason: '',
    
    // 选项数据 - 使用新的4角色体系
    roleOptions: [
      { label: '员工', value: 'employee' },
      { label: '兽医', value: 'veterinarian' },
      { label: '经理', value: 'manager' },
      { label: '超级管理员', value: 'super_admin' }
    ],
    expiryOptions: [
      { label: '3天', value: 3 },
      { label: '7天', value: 7 },
      { label: '15天', value: 15 },
      { label: '30天', value: 30 }
    ]
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
    } else {
      this.checkUserPermission()
    }
    
    this.loadInviteStats()
    this.loadInviteList()
  },

  onUnload() {
    this._clearAllTimers()
  },

  // 检查用户权限
  async checkUserPermission() {
    try {
      const app = getApp()
      const userInfo = app.globalData.userInfo
      // 已移除调试日志
      if (!userInfo) {
        // 已移除调试日志
        return
      }
      
      // 已移除调试日志
      // 更新页面数据
      this.setData({
        userInfo: userInfo
      })
      
      // 如果用户是 admin 但不是超级管理员，提示设置为超级管理员
      if (userInfo.role === 'admin' && !userInfo.isSuper) {
        // 已移除调试日志
        // 已移除调试日志
        // 延迟一下显示弹窗，确保页面完全加载
        this._safeSetTimeout(() => {
          // 已移除调试日志
          wx.showModal({
            title: '权限提示',
            content: '检测到您是管理员但未设置为超级管理员，是否要设置为超级管理员以获得完整权限？',
            confirmText: '确认设置',
            cancelText: '取消',
            success: (res) => {
              // 已移除调试日志
              if (res.confirm) {
                // 已移除调试日志
                this.setSuperAdmin()
              } else {
                // 已移除调试日志
              }
            },
            fail: (error) => {
              // 已移除调试日志
            }
          })
        }, 1000)
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  // 设置为超级管理员
  async setSuperAdmin() {
    try {
      wx.showLoading({ title: '设置中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'set_super_admin'
        }
      })
      
      // 已移除调试日志
      if (result.result && result.result.success) {
        // 更新本地用户信息
        const app = getApp()
        const updatedUserInfo = {
          ...app.globalData.userInfo,
          isSuper: true
        }
        
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        // 更新页面数据
        this.setData({
          userInfo: updatedUserInfo
        })
        
        wx.showToast({
          title: '设置成功',
          icon: 'success'
        })
        
        // 已移除调试日志
      } else {
        throw new Error(result.result?.message || '设置失败')
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '设置失败：' + (error.message || '未知错误'),
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载邀请统计
  async loadInviteStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'user-management',
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
        name: 'user-management',
        data: {
          action: 'list_invites',
          page: currentPage,
          pageSize: this.data.pageSize,
          status: status,
          searchKeyword: null,
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

  // 创建邀请码
  async createInvite() {
    const { role, expiryDays, remark } = this.data.newInvite

    // 已移除调试日志
    try {
      wx.showLoading({ title: '生成邀请码中...' })

      // 获取当前用户信息用于调试
      const app = getApp()
      const userInfo = app.globalData.userInfo
      // 已移除调试日志
      // 已移除调试日志
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'create_invite',
          role: role,
          expiryDays: expiryDays,
          remark: remark.trim()
        }
      })

      // 已移除调试日志

      if (result.result && result.result.success) {
        // 已移除调试日志
        // 在同一个弹窗中显示生成的邀请码
        this.setData({
          generatedInviteCode: result.result.data.inviteCode,
          isInviteGenerated: true
        })
        
        // 显示成功提示
        wx.showToast({
          title: '邀请码生成成功！',
          icon: 'success',
          duration: 2000
        })
        
        // 更新列表和统计（但不关闭弹窗）
        this.loadInviteList()
        this.loadInviteStats()
      } else {
        let errorMessage = '生成失败'
        
        if (result.result) {
          if (result.result.error === 'PERMISSION_DENIED') {
            errorMessage = '权限不足，仅管理员可创建邀请码'
          } else {
            errorMessage = result.result.message || result.result.error || '生成失败'
          }
        } else if (result.errMsg) {
          errorMessage = `云函数调用失败：${result.errMsg}`
        }
        
        wx.showModal({
          title: '生成失败',
          content: `${errorMessage}\n\n请检查：\n1. 用户权限是否足够\n2. 云函数是否正确部署\n3. 网络连接是否正常`,
          showCancel: true,
          cancelText: '查看详情',
          confirmText: '确定',
          success: (res) => {
            if (res.cancel) {
              // 显示详细的调试信息
              // 已移除调试日志
              wx.showModal({
                title: '调试信息',
                content: `完整结果：${JSON.stringify(result, null, 2)}`,
                showCancel: false
              })
            }
          }
        })
      }
    } catch (error: unknown) {
      // 已移除调试日志
      let errorMessage = '生成失败，请重试'
      
      if (error.errCode) {
        switch (error.errCode) {
          case -1:
            errorMessage = '云函数不存在，请检查云函数是否正确部署'
            break
          case -2:
            errorMessage = '云函数运行错误，请检查云函数代码'
            break
          case -3:
            errorMessage = '云开发环境不存在或无权限'
            break
          default:
            errorMessage = `云函数调用失败 (${error.errCode}): ${error.errMsg || '未知错误'}`
        }
      } else if (error.errMsg) {
        errorMessage = error.errMsg
      } else if (error.message) {
        errorMessage = error.message
      }
      
      wx.showModal({
        title: '生成失败',
        content: `错误详情：\n${errorMessage}\n\n请检查：\n1. 云函数是否正确部署\n2. 云开发环境是否正常\n3. 网络连接是否正常\n4. 是否有足够的权限`,
        showCancel: false,
        confirmText: '确定'
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
        name: 'user-management',
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
        name: 'user-management',
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
  onTabChange(e: CustomEvent) {
    this.setData({
      activeTab: e.detail.value
    })
    this.loadInviteList()
  },

  onInviteClick(e: CustomEvent) {
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
        role: 'employee',
        expiryDays: 7,
        remark: ''
      },
      selectedRoleIndex: [0],
      selectedExpiryIndex: [1],
      // 重置邀请码生成状态
      generatedInviteCode: '',
      isInviteGenerated: false
    })
  },

  closeCreateDialog() {
    this.setData({
      showCreateDialog: false,
      // 清空邀请码生成状态
      generatedInviteCode: '',
      isInviteGenerated: false
    })
  },

  // 复制邀请码
  copyInviteCode() {
    const inviteCode = this.data.generatedInviteCode
    if (!inviteCode) return
    
    // 已移除调试日志
    wx.setClipboardData({
      data: inviteCode,
      success: () => {
        wx.showToast({
          title: '邀请码已复制到剪贴板',
          icon: 'success',
          duration: 2000
        })
      },
      fail: (err) => {
        // 已移除调试日志
        wx.showToast({
          title: '复制失败，请手动复制',
          icon: 'none'
        })
      }
    })
  },

  // 完成并关闭
  finishAndClose() {
    this.closeCreateDialog()
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
  onRoleChange(e: CustomEvent) {
    const selectedIndex = e.detail.value
    const selectedRole = this.data.roleOptions[selectedIndex]?.value || 'employee'
    this.setData({
      selectedRoleIndex: [selectedIndex],
      'newInvite.role': selectedRole
    })
  },

  onExpiryDaysChange(e: CustomEvent) {
    const selectedIndex = e.detail.value
    const selectedDays = this.data.expiryOptions[selectedIndex]?.value || 7
    this.setData({
      selectedExpiryIndex: [selectedIndex],
      'newInvite.expiryDays': selectedDays
    })
  },

  onRemarkInput(e: CustomEvent) {
    this.setData({
      'newInvite.remark': e.detail.value
    })
  },

  onRevokeReasonChange(e: CustomEvent) {
    this.setData({
      revokeReason: e.detail.value
    })
  },

  // 数据标准化函数
  normalizeInviteData(invite: unknown) {
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
      // 新的4角色体系
      'employee': '员工',
      'veterinarian': '兽医',
      'manager': '经理',
      'super_admin': '超级管理员',
      
      // 兼容旧角色
      'admin': '超级管理员',
      'user': '员工',
      'operator': '员工',
      'technician': '兽医',
      'finance': '经理'
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
