// employee-permission.ts - 员工权限设置页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    // 主选项卡
    activeMainTab: 'permission', // 'permission' 或 'invite'
    
    // 用户信息
    userInfo: null,
    fromEmployeeManagement: false,  // 标记是否从员工管理中间页进入
    
    // 员工列表
    employeeList: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    
    // 搜索和筛选
    searchKeyword: '',
    activeTab: 'all',
    
    // 邀请管理相关
    inviteList: [],
    inviteLoading: true,
    inviteLoadingMore: false,
    inviteHasMore: true,
    invitePage: 1,
    invitePageSize: 20,
    
    // 邀请搜索筛选
    inviteSearchKeyword: '',
    inviteActiveTab: 'all',
    
    // 邀请统计数据
    inviteStats: {
      total: 0,
      pending: 0,
      used: 0,
      revoked: 0,
      expired: 0,
      usageRate: '0.0'
    },
    
    // 邀请详情弹窗
    showInviteDetail: false,
    selectedInvite: null,
    
    // 防重复提交状态
    isSubmitting: false,
    
    // 创建邀请弹窗
    showCreateDialog: false,
    newInvite: {
      role: 'employee',
      expiryDays: 7,
      remark: ''
    },
    selectedInviteRoleIndex: [0],
    selectedInviteExpiryIndex: [1],
    
    // 邀请码生成结果
    generatedInviteCode: '',
    isInviteGenerated: false,
    
    // 邀请选项数据 - 使用新的4角色体系
    inviteRoleOptions: [
      { label: '员工', value: 'employee' },
      { label: '兽医', value: 'veterinarian' },
      { label: '经理', value: 'manager' },
      { label: '超级管理员', value: 'super_admin' }
    ],
    inviteExpiryOptions: [
      { label: '3天', value: 3 },
      { label: '7天', value: 7 },
      { label: '15天', value: 15 },
      { label: '30天', value: 30 }
    ],
    
    // 角色选项 - 使用新的4角色体系
    roleOptions: [
      { label: '员工', value: 'employee', description: '日常操作执行权限，包括AI诊断' },
      { label: '兽医', value: 'veterinarian', description: '健康诊疗专业权限' },
      { label: '经理', value: 'manager', description: '业务运营管理权限' },
      { label: '超级管理员', value: 'super_admin', description: '系统全局管理权限' }
    ],
    
    // 权限模板 - 兼容新旧角色体系
    permissionTemplates: {
      // 新的4角色体系
      'employee': ['health.view', 'health.add', 'production.view', 'production.add', 'ai_diagnosis.*'],
      'veterinarian': ['health.*', 'ai_diagnosis.*', 'production.view'],
      'manager': ['health.*', 'production.*', 'finance.*', 'ai_diagnosis.*', 'user.manage'],
      'super_admin': ['all'],
      
      // 兼容旧角色（映射到对应权限）
      'admin': ['all'],
      'user': ['health.view', 'health.add', 'production.view', 'production.add', 'ai_diagnosis.*'],
      'operator': ['health.view', 'health.add', 'production.view', 'production.add', 'ai_diagnosis.*'],
      'technician': ['health.*', 'ai_diagnosis.*', 'production.view'],
      'finance': ['health.*', 'production.*', 'finance.*', 'ai_diagnosis.*', 'user.manage']
    },
    
    // 权限详情弹窗
    showPermissionDetail: false,
    selectedEmployee: null,
    selectedEmployeeRoleDisplayName: '',
    selectedEmployeePermissions: [],
    permissionDetailMode: 'view', // 'view' 或 'edit'
    
    // 基本信息编辑
    editingInfo: false,
    tempEmployee: {},
    
    // 角色编辑相关
    selectedRoleIndex: [0],
    newRole: '',
    
    // 部门管理
    departments: [],
    showDepartmentManage: false,
    newDepartmentName: ''
  },

  onLoad: function(options) {
    this.initPage(options)
  },

  // 初始化页面
  initPage: function(options) {
    const self = this
    
    // 检查是否从员工管理中间页传递了权限信息
    if (options && options.from === 'employee-management' && options.hasPermission === 'true') {
      // 从URL参数恢复用户权限信息，避免重复检查
      const userInfo = {
        role: options.userRole,
        isSuper: options.isSuper === 'true'
      }
      
      self.setData({
        userInfo: userInfo,
        fromEmployeeManagement: true  // 标记来源
      })
      
      // 初始化所有数据
      self.loadEmployeeList().catch(function(error) {
        // 已移除调试日志
        self.setData({ loading: false })
        wx.showToast({
          title: '页面加载失败',
          icon: 'none'
        })
      })
      
      self.loadInviteStats()
      self.loadInviteList()
    } else {
      // 传统的权限检查流程
      self.checkUserPermission().then(function(hasPermission) {
        if (!hasPermission) {
          return // 权限不足，已经处理
        }
        // 加载权限管理数据
        return self.loadEmployeeList()
      }).then(function() {
        // 加载邀请管理数据
        self.loadInviteStats()
        self.loadInviteList()
      }).catch(function(error) {
        // 已移除调试日志
        self.setData({ loading: false, inviteLoading: false })
        wx.showToast({
          title: '页面加载失败',
          icon: 'none'
        })
      })
    }
  },

  // 检查用户权限
  checkUserPermission: function() {
    const self = this
    return new Promise(function(resolve) {
      try {
        const app = getApp()
        const userInfo = app.globalData.userInfo
        
        if (!userInfo) {
          wx.showModal({
            title: '权限不足',
            content: '请先登录后再访问权限设置功能',
            showCancel: false,
            success: function() {
              // 调用页面的智能返回方法
              self.goBack()
            }
          })
          resolve(false)
          return
        }
        
        // 只有超级管理员和管理员可以管理权限
        if (userInfo.role !== 'super_admin' && userInfo.role !== 'manager') {
          wx.showModal({
            title: '权限不足',
            content: '只有管理员可以访问权限设置功能',
            showCancel: false,
            success: function() {
              // 调用页面的智能返回方法
              self.goBack()
            }
          })
          resolve(false)
          return
        }
        
        self.setData({
          userInfo: userInfo
        })
        resolve(true)
      } catch (error) {
        // 已移除调试日志
        resolve(false)
      }
    })
  },

  // 加载员工列表
  loadEmployeeList: function(reset = true) {
    const self = this
    return new Promise(function(resolve, reject) {
      try {
        if (reset) {
          self.setData({ loading: true, page: 1 })
        } else {
          self.setData({ loadingMore: true })
        }

        const currentPage = reset ? 1 : self.data.page + 1
        let role = null
        let status = null

        // 根据选项卡设置筛选条件
        if (self.data.activeTab !== 'all') {
          if (self.data.activeTab === 'disabled') {
            status = 'disabled'
          } else {
            role = self.data.activeTab
          }
        }

        wx.cloud.callFunction({
          name: 'user-management',
          data: {
            action: 'list_users',
            page: currentPage,
            pageSize: self.data.pageSize,
            role: role,
            status: status,
            sortBy: 'createTime',
            sortOrder: 'desc'
          },
          success: function(result) {
            if (result.result && result.result.success) {
              const rawEmployees = result.result.data.users || []
              const pagination = result.result.data.pagination

              // 格式化员工数据，处理日期等字段
              const employees = rawEmployees.map(function(employee) {
                const formatted = self.formatEmployeeData(employee)
                
                // 预先计算角色显示名
                formatted.roleDisplayName = self.getRoleDisplayName(formatted.role)
                
                // 预先计算角色标签样式
                const roleColor = self.getRoleColor(formatted.role)
                formatted.roleTagStyle = `background-color: ${roleColor}15; border-color: ${roleColor}; color: ${roleColor}`
                formatted.roleBadgeStyle = `background-color: ${roleColor}; color: #ffffff;`
                
                return formatted
              })

              self.setData({
                employeeList: reset ? employees : self.data.employeeList.concat(employees),
                page: currentPage,
                hasMore: currentPage < pagination.totalPages,
                loading: false,
                loadingMore: false
              })
              resolve()
            } else {
              // 如果云函数返回失败，设置为空列表但不是加载状态
              self.setData({
                employeeList: [],
                loading: false,
                loadingMore: false,
                hasMore: false
              })
              resolve()
            }
          },
          fail: function(error) {
            // 已移除调试日志
            self.setData({
              loading: false,
              loadingMore: false,
              employeeList: [],
              hasMore: false
            })
            wx.showToast({
              title: '加载失败，请重试',
              icon: 'none'
            })
            reject(error)
          }
        })
      } catch (error) {
        // 已移除调试日志
        self.setData({
          loading: false,
          loadingMore: false,
          employeeList: [],
          hasMore: false
        })
        reject(error)
      }
    })
  },

  // 修改员工角色
  updateEmployeeRole: function() {
    const self = this
    const { selectedEmployee, selectedRoleIndex, roleOptions, isSubmitting } = self.data
    
    // 防重复提交
    if (isSubmitting) {
      return
    }
    
    if (!selectedEmployee) return

    const newRole = roleOptions[selectedRoleIndex[0]].value

    if (newRole === selectedEmployee.role) {
      wx.showToast({
        title: '角色未变更',
        icon: 'none'
      })
      return
    }

    self.setData({ isSubmitting: true })
    
    // 使用安全的 loading 管理
    let loadingShown = false
    try {
      wx.showLoading({ 
        title: '更新中...', 
        mask: true 
      })
      loadingShown = true

      wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_user_role',
          userId: selectedEmployee._id,
          newRole: newRole,
          reason: '管理员修改角色为' + self.getRoleDisplayName(newRole)
        },
        success: function(result) {
          try {
            if (result.result && result.result.success) {
              wx.showToast({
                title: '角色更新成功',
                icon: 'success'
              })

              // 更新当前选中员工的角色信息
              const updatedEmployee = Object.assign({}, selectedEmployee, {
                role: newRole
              })

              // 重新计算角色显示名和权限列表
              const roleDisplayName = self.getRoleDisplayName(newRole)
              const permissions = self.getPermissionList(newRole)

              self.setData({
                selectedEmployee: updatedEmployee,
                selectedEmployeeRoleDisplayName: roleDisplayName,
                selectedEmployeePermissions: permissions,
                permissionDetailMode: 'view'
              })

              // 刷新员工列表
              self.loadEmployeeList()
            } else {
              wx.showToast({
                title: result.result?.message || '更新失败',
                icon: 'none',
                duration: 3000
              })
            }
          } catch (err) {
            // 已移除调试日志
          }
        },
        fail: function(error) {
          // 已移除调试日志
          wx.showToast({
            title: '更新失败',
            icon: 'none',
            duration: 3000
          })
        },
        complete: function() {
          try {
            self.setData({ isSubmitting: false })
            if (loadingShown) {
              wx.hideLoading()
              loadingShown = false
            }
          } catch (err) {
            // 已移除调试日志
            wx.hideLoading()
          }
        }
      })
    } catch (error) {
      // 已移除调试日志
      self.setData({ isSubmitting: false })
      if (loadingShown) {
        wx.hideLoading()
      }
      
      wx.showToast({
        title: '更新失败，请重试',
        icon: 'none',
        duration: 3000
      })
    }
  },


  // 事件处理
  onTabChange: function(e) {
    this.setData({
      activeTab: e.detail.value
    })
    this.loadEmployeeList()
  },

  onSearchChange: function(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  onSearch: function() {
    this.loadEmployeeList()
  },

  onEmployeeClick: function(e) {
    const employee = e.currentTarget.dataset.employee
    
    // 预先计算角色显示名和权限列表
    const roleDisplayName = this.getRoleDisplayName(employee.role)
    const permissions = this.getPermissionList(employee.role)
    
    // 确保样式已计算（如果数据中没有）
    if (!employee.roleTagStyle) {
      const roleColor = this.getRoleColor(employee.role)
      employee.roleTagStyle = `background-color: ${roleColor}15; border-color: ${roleColor}; color: ${roleColor}`
      employee.roleBadgeStyle = `background-color: ${roleColor}; color: #ffffff;`
    }
    
    this.setData({
      selectedEmployee: employee,
      selectedEmployeeRoleDisplayName: roleDisplayName,
      selectedEmployeePermissions: permissions,
      showPermissionDetail: true,
      permissionDetailMode: 'view'
    })
  },



  loadMore: function() {
    if (!this.data.loadingMore && this.data.hasMore) {
      this.loadEmployeeList(false)
    }
  },

  // 弹窗控制
  closePermissionDetail: function() {
    this.setData({
      showPermissionDetail: false,
      selectedEmployee: null,
      selectedEmployeeRoleDisplayName: '',
      selectedEmployeePermissions: [],
      permissionDetailMode: 'view',
      editingInfo: false,
      tempEmployee: {}
    })
  },

  // 权限详情弹窗状态变化
  onPermissionDetailChange: function(e) {
    if (!e.detail.visible) {
      this.closePermissionDetail()
    }
  },

  // 切换到编辑模式
  switchToEditMode: function() {
    if (!this.data.selectedEmployee) return
    
    const roleIndex = this.data.roleOptions.findIndex((r) => {
      return r.value === this.data.selectedEmployee.role
    })
    
    this.setData({
      permissionDetailMode: 'edit',
      selectedRoleIndex: [Math.max(0, roleIndex)]
    })
  },

  // 切换回查看模式
  switchToViewMode: function() {
    this.setData({
      permissionDetailMode: 'view'
    })
  },

  // 切换基本信息编辑模式
  toggleEditInfo: function() {
    if (this.data.editingInfo) {
      // 保存基本信息
      this.saveEmployeeInfo()
    } else {
      // 进入编辑模式
      this.setData({
        editingInfo: true,
        tempEmployee: {
          farmName: this.data.selectedEmployee.farmName || '',
          department: this.data.selectedEmployee.department || '',
          position: this.data.selectedEmployee.position || ''
        }
      })
    }
  },

  // 处理输入框输入
  onInfoInput: function(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    const tempEmployee = Object.assign({}, this.data.tempEmployee)
    tempEmployee[field] = value
    
    this.setData({
      tempEmployee: tempEmployee
    })
  },

  // 保存员工基本信息
  saveEmployeeInfo: function() {
    const self = this
    const { selectedEmployee, tempEmployee, isSubmitting } = self.data
    
    // 防重复提交
    if (isSubmitting) {
      return
    }
    
    if (!selectedEmployee || !selectedEmployee._id) {
      wx.showToast({
        title: '员工信息错误',
        icon: 'none'
      })
      return
    }
    
    self.setData({ isSubmitting: true })
    
    // 使用安全的 loading 管理
    let loadingShown = false
    try {
      wx.showLoading({ 
        title: '保存中...', 
        mask: true 
      })
      loadingShown = true
    
      wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_profile',
          targetUserId: selectedEmployee._id,
          farmName: tempEmployee.farmName,
          department: tempEmployee.department,
          position: tempEmployee.position
        },
        success: function(result) {
          try {
            if (result.result && result.result.success) {
              wx.showToast({
                title: '保存成功',
                icon: 'success'
              })
              
              // 更新当前选中员工的信息
              const updatedEmployee = Object.assign({}, selectedEmployee, {
                farmName: tempEmployee.farmName,
                department: tempEmployee.department,
                position: tempEmployee.position
              })
              
              self.setData({
                selectedEmployee: updatedEmployee,
                editingInfo: false
              })
              
              // 刷新员工列表
              self.loadEmployeeList()
            } else {
              wx.showToast({
                title: result.result?.message || result.result?.error || '保存失败',
                icon: 'none',
                duration: 3000
              })
            }
          } catch (err) {
            // 已移除调试日志
          }
        },
        fail: function(error) {
          // 已移除调试日志
          wx.showToast({
            title: '保存失败: ' + (error.errMsg || '网络错误'),
            icon: 'none',
            duration: 3000
          })
        },
        complete: function() {
          try {
            self.setData({ isSubmitting: false })
            if (loadingShown) {
              wx.hideLoading()
              loadingShown = false
            }
          } catch (err) {
            // 已移除调试日志
            wx.hideLoading()
          }
        }
      })
    } catch (error) {
      // 已移除调试日志
      self.setData({ isSubmitting: false })
      if (loadingShown) {
        wx.hideLoading()
      }
      
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 3000
      })
    }
  },

  // 页面生命周期管理
  onUnload: function() {
    // 确保页面销毁时隐藏loading
    wx.hideLoading()
    // 重置提交状态
    this.setData({ isSubmitting: false })
  },

  onHide: function() {
    // 页面隐藏时也清理loading状态
    wx.hideLoading()
  },

  // 选择角色
  selectRole: function(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      selectedRoleIndex: [index]
    })
  },


  // 表单事件
  onRoleChange: function(e) {
    const selectedIndex = e.detail.value
    const selectedRole = this.data.roleOptions[selectedIndex]?.value || 'employee'
    
    this.setData({
      selectedRoleIndex: [selectedIndex],
      newRole: selectedRole
    })
  },


  // 工具函数
  formatEmployeeData: function(employee) {
    // 格式化注册时间
    let formattedRegisterTime = '未知'
    if (employee.registerTime) {
      try {
        const date = new Date(employee.registerTime)
        if (!isNaN(date.getTime())) {
          formattedRegisterTime = date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          })
        }
      } catch (error) {
        // 已移除调试日志
      }
    }

    return Object.assign({}, employee, {
      formattedRegisterTime: formattedRegisterTime
    })
  },

  getRoleDisplayName: function(role) {
    const roleMap = {
      // 新的4角色体系
      'employee': '员工',
      'veterinarian': '兽医', 
      'manager': '经理',
      'super_admin': '超级管理员',
      
      // 兼容旧角色（向下兼容）
      'admin': '超级管理员',
      'user': '员工',
      'operator': '员工',
      'technician': '兽医',
      'finance': '经理'
    }
    return roleMap[role] || '未知角色'
  },

  getRoleColor: function(role) {
    if (!role) return '#95a5a6'
    const colorMap = {
      // 新的4角色体系
      'employee': '#52c41a',
      'veterinarian': '#722ed1',
      'manager': '#1890ff',
      'super_admin': '#ff4d4f',
      
      // 兼容旧角色（使用相同颜色）
      'admin': '#ff4d4f',    // 对应超级管理员
      'user': '#52c41a',     // 对应员工
      'operator': '#52c41a', // 对应员工
      'technician': '#722ed1', // 对应兽医
      'finance': '#1890ff'   // 对应经理
    }
    return colorMap[role] || '#95a5a6'
  },


  // 获取权限列表的友好描述
  getPermissionList: function(role) {
    const permissionDescriptions = {
      'health.view': '查看健康记录',
      'health.add': '添加健康记录',
      'health.edit': '编辑健康记录',
      'health.delete': '删除健康记录',
      'health.*': '健康管理（全部权限）',
      'production.view': '查看生产记录',
      'production.add': '添加生产记录',
      'production.edit': '编辑生产记录',
      'production.delete': '删除生产记录',
      'production.*': '生产管理（全部权限）',
      'finance.view': '查看财务数据',
      'finance.add': '添加财务记录',
      'finance.edit': '编辑财务记录',
      'finance.*': '财务管理（全部权限）',
      'ai_diagnosis.create': '发起AI诊断',
      'ai_diagnosis.read': '查看诊断结果',
      'ai_diagnosis.validate': '验证诊断结果',
      'ai_diagnosis.*': 'AI诊断（全部权限）',
      'user.manage': '用户管理',
      'system.config': '系统配置',
      'all': '超级管理员（全部权限）'
    }

    const permissions = this.data.permissionTemplates[role] || []
    
    if (permissions.includes('all')) {
      return ['超级管理员（全部权限）', '用户管理', '权限管理', '系统配置', '数据管理', 'AI诊断管理']
    }

    const friendlyPermissions = []
    permissions.forEach(function(permission) {
      const description = permissionDescriptions[permission] || permission
      friendlyPermissions.push(description)
    })

    // 如果没有权限，至少返回一个默认提示
    if (friendlyPermissions.length === 0) {
      friendlyPermissions.push('暂无分配权限')
    }

    return friendlyPermissions
  },

  // 获取角色索引
  getRoleIndex: function(role) {
    return this.data.roleOptions.findIndex(function(r) {
      return r.value === role
    })
  },

  // ==================== 邀请管理功能 ====================

  // 主选项卡切换
  onMainTabChange: function(e) {
    this.setData({
      activeMainTab: e.detail.value
    })
  },

  // 加载邀请统计
  loadInviteStats: function() {
    const self = this
    
    wx.cloud.callFunction({
      name: 'user-management',
      data: {
        action: 'get_invite_stats'
      },
      success: function(result) {
        if (result.result && result.result.success) {
          self.setData({
            inviteStats: result.result.data
          })
        }
      },
      fail: function(error) {
        // 已移除调试日志
      }
    })
  },

  // 加载邀请列表
  loadInviteList: function(reset = true) {
    const self = this
    
    try {
      if (reset) {
        self.setData({ inviteLoading: true, invitePage: 1 })
      } else {
        self.setData({ inviteLoadingMore: true })
      }

      const currentPage = reset ? 1 : self.data.invitePage + 1
      let status = null

      // 根据选项卡设置筛选条件
      if (self.data.inviteActiveTab !== 'all') {
        status = self.data.inviteActiveTab
      }

      wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'list_invites',
          page: currentPage,
          pageSize: self.data.invitePageSize,
          status: status,
          searchKeyword: self.data.inviteSearchKeyword || null,
          sortBy: 'createTime',
          sortOrder: 'desc'
        },
        success: function(result) {
          if (result.result && result.result.success) {
            const rawInvites = result.result.data.invites || []
            const pagination = result.result.data.pagination
            
            // 标准化邀请数据，确保所有字段都有默认值
            const newInvites = rawInvites.map(function(invite) {
              return self.normalizeInviteData(invite)
            })

            self.setData({
              inviteList: reset ? newInvites : self.data.inviteList.concat(newInvites),
              invitePage: currentPage,
              inviteHasMore: currentPage < pagination.totalPages,
              inviteLoading: false,
              inviteLoadingMore: false
            })
          } else {
            throw new Error(result.result?.message || '加载失败')
          }
        },
        fail: function(error) {
          self.setData({
            inviteLoading: false,
            inviteLoadingMore: false
          })
          
          // 已移除调试日志
        }
      })
    } catch (error) {
      self.setData({
        inviteLoading: false,
        inviteLoadingMore: false
      })
      // 已移除调试日志
    }
  },

  // 邀请选项卡切换
  onInviteTabChange: function(e) {
    this.setData({
      inviteActiveTab: e.detail.value
    })
    this.loadInviteList()
  },

  // 邀请搜索
  onInviteSearchChange: function(e) {
    this.setData({
      inviteSearchKeyword: e.detail.value
    })
  },

  onInviteSearch: function() {
    this.loadInviteList()
  },

  onInviteSearchClear: function() {
    this.setData({
      inviteSearchKeyword: ''
    })
    this.loadInviteList()
  },

  // 点击邀请项
  onInviteClick: function(e) {
    const invite = e.currentTarget.dataset.invite
    this.setData({
      selectedInvite: invite,
      showInviteDetail: true
    })
  },

  // 加载更多邀请
  loadMoreInvites: function() {
    if (!this.data.inviteLoadingMore && this.data.inviteHasMore) {
      this.loadInviteList(false)
    }
  },

  // 显示创建邀请弹窗
  showCreateDialog: function() {
    this.setData({
      showCreateDialog: true,
      newInvite: {
        role: 'employee',
        expiryDays: 7,
        remark: ''
      },
      selectedInviteRoleIndex: [0],
      selectedInviteExpiryIndex: [1],
      generatedInviteCode: '',
      isInviteGenerated: false
    })
  },

  // 关闭创建邀请弹窗
  closeCreateDialog: function() {
    this.setData({
      showCreateDialog: false,
      generatedInviteCode: '',
      isInviteGenerated: false
    })
  },

  // 创建弹窗显示状态变化
  onCreateDialogChange: function(e) {
    if (!e.detail.visible) {
      this.closeCreateDialog()
    }
  },

  // 创建邀请码
  createInvite: function() {
    const self = this
    const { role, expiryDays, remark } = self.data.newInvite
    
    // 防重复提交 - 增强检查
    if (self.data.isSubmitting) {
      // 已移除调试日志
      return
    }

    // 立即设置提交状态并显示loading
    self.setData({ isSubmitting: true })
    
    // 使用 try-catch 确保 loading 配对
    let loadingShown = false
    try {
      wx.showLoading({ 
        title: '生成邀请码中...', 
        mask: true  // 防止用户再次点击
      })
      loadingShown = true

      wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'create_invite',
          role: role,
          expiryDays: expiryDays,
          remark: remark.trim()
        },
        success: function(result) {
          try {
            if (result.result && result.result.success) {
              // 在同一个弹窗中显示生成的邀请码
              self.setData({
                generatedInviteCode: result.result.data.inviteCode,
                isInviteGenerated: true
              })
              
              wx.showToast({
                title: '邀请码生成成功！',
                icon: 'success',
                duration: 2000
              })
              
              // 更新列表和统计
              self.loadInviteList()
              self.loadInviteStats()
            } else {
              let errorMessage = '生成失败'
              
              if (result.result) {
                if (result.result.error === 'PERMISSION_DENIED') {
                  errorMessage = '权限不足，仅管理员可创建邀请码'
                } else {
                  errorMessage = result.result.message || result.result.error || '生成失败'
                }
              }
              
              wx.showToast({
                title: errorMessage,
                icon: 'none',
                duration: 3000
              })
            }
          } catch (err) {
            // 已移除调试日志
          }
        },
        fail: function(error) {
          // 已移除调试日志
          wx.showToast({
            title: '生成失败，请重试',
            icon: 'none',
            duration: 3000
          })
        },
        complete: function() {
          try {
            // 重置提交状态
            self.setData({ isSubmitting: false })
            
            // 确保 hideLoading 被调用
            if (loadingShown) {
              wx.hideLoading()
              loadingShown = false
            }
          } catch (err) {
            // 已移除调试日志
            // 即使出错也要确保 hideLoading
            wx.hideLoading()
          }
        }
      })
    } catch (error) {
      // 已移除调试日志
      // 确保在任何情况下都清理状态
      self.setData({ isSubmitting: false })
      if (loadingShown) {
        wx.hideLoading()
      }
      
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none',
        duration: 3000
      })
    }
  },

  // 复制邀请码
  copyInviteCode: function() {
    const inviteCode = this.data.generatedInviteCode
    if (!inviteCode) return
    
    wx.setClipboardData({
      data: inviteCode,
      success: function() {
        wx.showToast({
          title: '邀请码已复制到剪贴板',
          icon: 'success',
          duration: 2000
        })
      },
      fail: function() {
        wx.showToast({
          title: '复制失败，请手动复制',
          icon: 'none'
        })
      }
    })
  },

  // 邀请表单事件
  onInviteRoleChange: function(e) {
    const selectedIndex = e.detail.value
    const selectedRole = this.data.inviteRoleOptions[selectedIndex]?.value || 'employee'
    this.setData({
      selectedInviteRoleIndex: [selectedIndex],
      'newInvite.role': selectedRole
    })
  },

  onInviteExpiryDaysChange: function(e) {
    const selectedIndex = e.detail.value
    const selectedDays = this.data.inviteExpiryOptions[selectedIndex]?.value || 7
    this.setData({
      selectedInviteExpiryIndex: [selectedIndex],
      'newInvite.expiryDays': selectedDays
    })
  },

  onInviteRemarkInput: function(e) {
    this.setData({
      'newInvite.remark': e.detail.value
    })
  },

  // 邀请详情弹窗状态变化
  onInviteDetailChange: function(e) {
    if (!e.detail.visible) {
      this.closeInviteDetail()
    }
  },

  // 关闭邀请详情
  closeInviteDetail: function() {
    this.setData({
      showInviteDetail: false,
      selectedInvite: null
    })
  },

  // 复制邀请码（从详情页）
  copyInviteCodeFromDetail: function() {
    const selectedInvite = this.data.selectedInvite
    if (!selectedInvite || !selectedInvite.inviteCode) {
      wx.showToast({
        title: '邀请码为空',
        icon: 'none'
      })
      return
    }

    wx.setClipboardData({
      data: selectedInvite.inviteCode,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        })
      }
    })
  },

  // 撤销邀请（直接执行）
  revokeInvite: function() {
    const self = this
    
    if (!self.data.selectedInvite || !self.data.selectedInvite._id) {
      wx.showToast({
        title: '邀请信息错误',
        icon: 'none'
      })
      return
    }

    // 使用安全的 loading 管理
    let loadingShown = false
    try {
      wx.showLoading({
        title: '撤销中...',
        mask: true
      })
      loadingShown = true

      wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'revoke_invite',
          inviteId: self.data.selectedInvite._id,
          reason: '管理员撤销'
        },
        success: function(result) {
          try {
            if (result.result && result.result.success) {
              wx.showToast({
                title: '邀请已撤销',
                icon: 'success'
              })
              
              // 关闭详情弹窗
              self.closeInviteDetail()
              
              // 从列表中移除该邀请
              self.removeInviteFromList(self.data.selectedInvite._id)
              
              // 刷新统计数据
              self.loadInviteStats()
            } else {
              wx.showToast({
                title: '撤销失败',
                icon: 'none',
                duration: 3000
              })
            }
          } catch (err) {
            // 已移除调试日志
          }
        },
        fail: function(error) {
          // 已移除调试日志
          wx.showToast({
            title: '撤销失败',
            icon: 'none',
            duration: 3000
          })
        },
        complete: function() {
          try {
            if (loadingShown) {
              wx.hideLoading()
              loadingShown = false
            }
          } catch (err) {
            // 已移除调试日志
            wx.hideLoading()
          }
        }
      })
    } catch (error) {
      // 已移除调试日志
      if (loadingShown) {
        wx.hideLoading()
      }
      
      wx.showToast({
        title: '撤销失败，请重试',
        icon: 'none',
        duration: 3000
      })
    }
  },

  // 从列表中移除指定邀请
  removeInviteFromList: function(inviteId) {
    const currentList = this.data.inviteList
    const updatedList = currentList.filter(function(invite) {
      return invite._id !== inviteId
    })
    
    this.setData({
      inviteList: updatedList
    })
  },

  // 重新发送邀请
  resendInvite: function() {
    const self = this
    
    // 使用安全的 loading 管理
    let loadingShown = false
    try {
      wx.showLoading({ 
        title: '处理中...', 
        mask: true 
      })
      loadingShown = true

      wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'resend_invite',
          inviteId: self.data.selectedInvite._id,
          expiryDays: 7
        },
        success: function(result) {
          try {
            if (result.result && result.result.success) {
              wx.showToast({
                title: '邀请已重新发送',
                icon: 'success'
              })
              
              self.closeInviteDetail()
              self.loadInviteList()
            } else {
              wx.showToast({
                title: '发送失败',
                icon: 'none',
                duration: 3000
              })
            }
          } catch (err) {
            // 已移除调试日志
          }
        },
        fail: function(error) {
          // 已移除调试日志
          wx.showToast({
            title: '发送失败',
            icon: 'none',
            duration: 3000
          })
        },
        complete: function() {
          try {
            if (loadingShown) {
              wx.hideLoading()
              loadingShown = false
            }
          } catch (err) {
            // 已移除调试日志
            wx.hideLoading()
          }
        }
      })
    } catch (error) {
      // 已移除调试日志
      if (loadingShown) {
        wx.hideLoading()
      }
      
      wx.showToast({
        title: '发送失败，请重试',
        icon: 'none',
        duration: 3000
      })
    }
  },

  // 邀请数据标准化
  normalizeInviteData: function(invite) {
    const self = this
    
    // 确保所有必要字段都有默认值
    const normalized = Object.assign({}, invite, {
      _id: invite._id || '',
      inviteCode: invite.inviteCode || '',
      inviteeName: invite.inviteeName || invite.name || '未知用户',
      inviteePhone: invite.inviteePhone || invite.phone || '',
      department: invite.department || '',
      position: invite.position || '',
      role: invite.role || 'user',
      status: invite.status || 'pending',
      createTime: invite.createTime || new Date(),
      expiresAt: invite.expiresAt || invite.expiryTime || new Date(),
      remark: invite.remark || ''
    })
    
    // 计算状态文本
    normalized.statusText = self.getInviteStatusText(normalized.status)
    
    // 添加格式化的显示字段
    normalized.roleDisplayName = self.getInviteRoleText(normalized.role)
    normalized.formattedCreateTime = self.formatInviteTime(normalized.createTime)
    normalized.formattedExpiresAt = self.formatInviteTime(normalized.expiresAt)
    
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

  // 邀请状态相关工具函数
  getInviteStatusTheme: function(status) {
    const themeMap = {
      'pending': 'warning',
      'used': 'success',
      'expired': 'danger',
      'revoked': 'default'
    }
    return themeMap[status] || 'default'
  },

  getInviteStatusText: function(status) {
    const statusMap = {
      'pending': '待使用',
      'used': '已使用',
      'expired': '已过期',
      'revoked': '已撤销'
    }
    return statusMap[status] || '未知状态'
  },

  getInviteRoleText: function(role) {
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

  formatInviteTime: function(time) {
    if (!time) return '未知'
    const date = new Date(time)
    // 使用24小时制格式
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  },

  // 返回上一页
  goBack: function() {
    // 直接返回上一页或回到profile页面
      wx.navigateBack({
        fail: function() {
          wx.switchTab({
            url: '/pages/profile/profile'
          })
        }
      })
  }
}

Page(createPageWithNavbar(pageConfig))