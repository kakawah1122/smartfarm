// employee-permission.ts - 员工权限设置页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig = {
  data: {
    // 用户信息
    userInfo: null,
    
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
    
    // 角色选项
    roleOptions: [
      { label: '用户', value: 'user', description: '基础功能权限' },
      { label: '操作员', value: 'operator', description: '生产操作权限' },
      { label: '经理', value: 'manager', description: '部门管理权限' },
      { label: '管理员', value: 'admin', description: '系统管理权限' }
    ],
    
    // 权限模板
    permissionTemplates: {
      'user': ['health.view', 'production.view'],
      'operator': ['health.view', 'health.add', 'production.view', 'production.add'],
      'manager': ['health.*', 'production.*', 'finance.view'],
      'admin': ['all']
    },
    
    // 权限详情弹窗
    showPermissionDetail: false,
    selectedEmployee: null,
    
    // 角色编辑弹窗
    showRoleEdit: false,
    editingEmployee: null,
    selectedRoleIndex: [0],
    
    // 批量操作
    showBatchActions: false,
    selectedEmployees: [],
    
    // 部门管理
    departments: [],
    showDepartmentManage: false,
    newDepartmentName: ''
  },

  onLoad: function() {
    this.initPage()
  },

  // 初始化页面
  initPage: function() {
    const self = this
    
    // 检查权限
    self.checkUserPermission().then(function(hasPermission) {
      if (!hasPermission) {
        return // 权限不足，已经导航回去
      }
      
      // 加载员工列表
      return self.loadEmployeeList()
    }).catch(function(error) {
      console.error('页面初始化失败:', error)
      self.setData({ loading: false })
      wx.showToast({
        title: '页面加载失败',
        icon: 'none'
      })
    })
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
              wx.navigateBack()
            }
          })
          resolve(false)
          return
        }
        
        // 只有超级管理员和管理员可以管理权限
        if (!userInfo.isSuper && userInfo.role !== 'admin') {
          wx.showModal({
            title: '权限不足',
            content: '只有管理员可以访问权限设置功能',
            showCancel: false,
            success: function() {
              wx.navigateBack()
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
        console.error('检查用户权限异常：', error)
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
                return self.formatEmployeeData(employee)
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
            console.error('加载员工列表失败:', error)
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
        console.error('加载员工列表异常:', error)
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
    const { editingEmployee, selectedRoleIndex, roleOptions } = self.data
    if (!editingEmployee) return

    const newRole = roleOptions[selectedRoleIndex[0]].value

    if (newRole === editingEmployee.role) {
      wx.showToast({
        title: '角色未变更',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '更新中...' })

    wx.cloud.callFunction({
      name: 'user-management',
      data: {
        action: 'update_user_role',
        userId: editingEmployee._id,
        newRole: newRole,
        reason: '管理员修改角色为' + self.getRoleDisplayName(newRole)
      },
      success: function(result) {
        if (result.result && result.result.success) {
          wx.showToast({
            title: '角色更新成功',
            icon: 'success'
          })

          self.closeRoleEdit()
          self.loadEmployeeList()
        } else {
          wx.showToast({
            title: result.result?.message || '更新失败',
            icon: 'none'
          })
        }
      },
      fail: function(error) {
        console.error('更新角色失败:', error)
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        })
      },
      complete: function() {
        wx.hideLoading()
      }
    })
  },

  // 批量更新角色
  batchUpdateRole: function(newRole) {
    const self = this
    const selectedEmployees = self.data.selectedEmployees

    if (selectedEmployees.length === 0) {
      wx.showToast({
        title: '请先选择员工',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '批量更新中...' })

    // 批量更新角色 - 由于没有批量更新的云函数，暂时不实现
    wx.showModal({
      title: '功能提示',
      content: '批量修改角色功能暂未实现，请单个修改员工角色',
      showCancel: false
    })

    self.setData({
      selectedEmployees: [],
      showBatchActions: false
    })

    wx.hideLoading()
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
    this.setData({
      selectedEmployee: employee,
      showPermissionDetail: true
    })
  },

  onEmployeeSelect: function(e) {
    const employee = e.currentTarget.dataset.employee
    const selectedEmployees = this.data.selectedEmployees
    
    const index = selectedEmployees.indexOf(employee._id)
    if (index > -1) {
      selectedEmployees.splice(index, 1)
    } else {
      selectedEmployees.push(employee._id)
    }
    
    this.setData({
      selectedEmployees: selectedEmployees,
      showBatchActions: selectedEmployees.length > 0
    })
  },

  editEmployeeRole: function(e) {
    const employee = e.currentTarget.dataset.employee
    const roleIndex = this.data.roleOptions.findIndex(function(r) {
      return r.value === employee.role
    })
    
    this.setData({
      editingEmployee: employee,
      selectedRoleIndex: [Math.max(0, roleIndex)],
      showRoleEdit: true
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
      selectedEmployee: null
    })
  },

  closeRoleEdit: function() {
    this.setData({
      showRoleEdit: false,
      editingEmployee: null
    })
  },

  closeBatchActions: function() {
    this.setData({
      showBatchActions: false,
      selectedEmployees: []
    })
  },

  // 表单事件
  onRoleChange: function(e) {
    const selectedIndex = e.detail.value
    const selectedRole = this.data.roleOptions[selectedIndex]?.value || 'user'
    
    this.setData({
      selectedRoleIndex: [selectedIndex],
      newRole: selectedRole
    })
  },

  // 批量操作
  batchSetUser: function() {
    this.batchUpdateRole('user')
  },

  batchSetOperator: function() {
    this.batchUpdateRole('operator')
  },

  batchSetManager: function() {
    this.batchUpdateRole('manager')
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
        console.warn('日期格式化失败:', employee.registerTime, error)
      }
    }

    return Object.assign({}, employee, {
      formattedRegisterTime: formattedRegisterTime
    })
  },

  getRoleDisplayName: function(role) {
    const roleMap = {
      'user': '用户',
      'operator': '操作员', 
      'manager': '经理',
      'admin': '管理员'
    }
    return roleMap[role] || '未知角色'
  },

  getRoleColor: function(role) {
    if (!role) return '#95a5a6'
    const colorMap = {
      'user': '#3498db',
      'operator': '#2ecc71',
      'manager': '#f39c12',
      'admin': '#e74c3c'
    }
    return colorMap[role] || '#95a5a6'
  },

  isEmployeeSelected: function(employeeId) {
    return this.data.selectedEmployees.indexOf(employeeId) !== -1
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack()
  }
}

Page(createPageWithNavbar(pageConfig))