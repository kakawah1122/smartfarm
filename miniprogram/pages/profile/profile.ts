// profile.ts
import { createPageWithNavbar } from '../../utils/navigation'
import { checkPageAuth } from '../../utils/auth-guard'
import { ROLES, getRoleName, getRoleColor, formatRoleDisplay } from '../../utils/permission'

// 获取全局应用实例
const app = getApp<IAppOption>()

const pageConfig = {
  data: {
    // 登录状态
    isLoggedIn: false,
    // 用户信息
    userInfo: {
      name: '未设置',
      role: '用户', 
      farm: '未设置',
      experience: '0',
      currentStock: '0',
      healthRate: '0',
      avatarUrl: '/assets/icons/profile.png' // 默认头像
    },
    // 云开发用户信息
    cloudUserInfo: null,
    // 编辑弹窗显示
    showEditProfilePopup: false,
    editNickname: '',
    editFarmName: '',
    editPhone: '',
    // 是否需要完善信息提示
    showProfileSetupTip: false,
    
    // 统一弹窗状态
    showEditNicknamePopup: false,
    showEditFarmPopup: false,
    showLogoutConfirmPopup: false,
    showPermissionDeniedPopup: false,
    showNotificationPopup: false,
    showAboutPopup: false,
    // 弹窗数据
    popupData: {
      title: '',
      content: '',
      inputValue: '',
      originalValue: ''
    },
    

    
    // 财务概览
    financeOverview: {
      income: '21.2',
      incomeGrowth: '15.3',
      expense: '16.8',
      expenseGrowth: '8.7',
      profit: '4.4',
      profitGrowth: '32.1'
    },
    
    // 功能菜单
    menuItems: [
      {
        id: 1,
        title: '财务管理',
        description: '收支记录、AI建议、报表分析',
        icon: 'money-circle',
        page: '/packageFinance/finance/finance'
      },
      {
        id: 2,
        title: '员工管理',
        description: '邀请码管理、员工权限设置',
        icon: 'user-group',
        page: '/packageUser/employee-permission/employee-permission',
        requiredPermission: 'employee.view'
      },
      {
        id: 3,
        title: '报销审核',
        description: '待审核报销申请、采购申请',
        icon: 'file-text',
        badge: '3'
      },
      {
        id: 4,
        title: '系统设置',
        description: '隐私设置、帮助反馈、关于我们',
        icon: 'setting'
      }
    ],
    
    // 待处理事项
    pendingItems: [
      {
        id: 1,
        title: '李四提交的差旅费报销',
        description: '金额：¥280 • 提交时间：今天 14:30',
        priority: 'danger',
        status: '待审核'
      },
      {
        id: 2,
        title: '王五的饲料采购申请',
        description: '饲料2吨 • 预计金额：¥6,000',
        priority: 'warning',
        status: '待审核'
      },
      {
        id: 3,
        title: '疫苗采购申请',
        description: '禽流感疫苗50支 • 预计金额：¥750',
        priority: 'primary',
        status: '待审核'
      }
    ],
    
    // 养殖场统计
    farmStats: {
      totalStock: '1,280',
      stockChange: '120',
      survivalRate: '95.2',
      staffCount: '8',
      adminCount: '1',
      employeeCount: '7',
      monthlyProfit: '4.4',
      profitGrowth: '32'
    },

    // 消息通知
    notifications: [
      {
        id: 1,
        title: '系统消息',
        content: '您有3条待审核的报销申请',
        time: '10分钟前',
        type: 'system',
        read: false
      },
      {
        id: 2,
        title: '健康提醒',
        content: '今日疫苗接种提醒：200只鹅需要接种',
        time: '1小时前',
        type: 'health',
        read: false
      }
    ]
  },

  onLoad() {
    // 设置全局错误处理
    this.setupGlobalErrorHandling()
    // 确保数组字段初始化正确，防止渲染层迭代器错误
    this.ensureArrayFieldsInitialized()
    this.checkLoginStatus()
    this.initUserInfo()
  },

  // 设置全局错误处理
  setupGlobalErrorHandling() {
    const originalSetData = this.setData.bind(this)
    this.setData = function(data: any, callback?: () => void) {
      try {
        // 在设置数据前进行安全检查
        // 已移除调试日志
        originalSetData(data, callback)
      } catch (error) {
        // 已移除调试日志
        // 已移除调试日志
        // 尝试修复数组字段
        this.ensureArrayFieldsInitialized()
        
        // 重新尝试设置数据（移除可能有问题的字段）
        if (data && typeof data === 'object') {
          const safeData = { ...data }
          // 移除可能导致问题的字段
          Object.keys(safeData).forEach(key => {
            if (safeData[key] === undefined) {
              // 已移除调试日志
              delete safeData[key]
            }
          })
          
          if (Object.keys(safeData).length > 0) {
            originalSetData(safeData, callback)
          }
        }
      }
    }
  },

  // 确保数组字段初始化，防止渲染层迭代器错误
  ensureArrayFieldsInitialized() {
    const currentData = this.data
    const updates = {}
    
    // 检查并修复可能为 undefined 的数组字段
    if (!Array.isArray(currentData.menuItems)) {
      // 已移除调试日志
      updates.menuItems = [
        {
          id: 1,
          title: '财务管理',
          description: '收支记录、AI建议、报表分析',
          icon: 'money-circle',
          page: '/packageFinance/finance/finance'
        },
        {
          id: 2,
          title: '员工管理',
          description: '邀请码管理、员工权限设置',
          icon: 'user-group',
          page: '/packageUser/employee-permission/employee-permission',
          requiredPermission: 'employee.view'
        },
        {
          id: 3,
          title: '报销审核',
          description: '待审核报销申请、采购申请',
          icon: 'file-text',
          badge: '3'
        },
        {
          id: 4,
          title: '系统设置',
          description: '隐私设置、帮助反馈、关于我们',
          icon: 'setting'
        }
      ]
    }
    
    if (!Array.isArray(currentData.pendingItems)) {
      // 已移除调试日志
      updates.pendingItems = []
    }
    
    if (!Array.isArray(currentData.notifications)) {
      // 已移除调试日志
      updates.notifications = []
    }
    
    // 如果有需要更新的字段，执行 setData
    if (Object.keys(updates).length > 0) {
      // 已移除调试日志
      this.setData(updates)
    }
  },

  // 安全的 setData 包装，确保不会破坏数组字段
  safeSetData(data: any, callback?: () => void) {
    try {
      // 检查是否有可能破坏数组字段的操作
      if (data) {
        // 如果尝试直接设置整个 data 对象，保护数组字段
        if (data.hasOwnProperty('menuItems') && !Array.isArray(data.menuItems)) {
          // 已移除调试日志
          delete data.menuItems
        }
        if (data.hasOwnProperty('pendingItems') && !Array.isArray(data.pendingItems)) {
          // 已移除调试日志
          delete data.pendingItems
        }
        if (data.hasOwnProperty('notifications') && !Array.isArray(data.notifications)) {
          // 已移除调试日志
          delete data.notifications
        }
      }
      
      this.setData(data, callback)
    } catch (error) {
      // 已移除调试日志
      // 已移除调试日志
      // 尝试恢复数组字段
      this.ensureArrayFieldsInitialized()
      throw error
    }
  },

  // 统一的信息完整性检查函数
  checkUserInfoCompleteness(userInfo: any) {
    if (!userInfo) return false
    
    const nickname = userInfo.nickname || userInfo.nickName || ''
    const farmName = userInfo.farmName || userInfo.department || ''
    const phone = userInfo.phone || ''
    
    const isComplete = nickname && 
                      nickname.trim() !== '' && 
                      nickname !== '未设置' &&
                      phone && 
                      phone.trim() !== '' &&
                      farmName && 
                      farmName.trim() !== '' && 
                      farmName !== '智慧养殖场' &&
                      farmName !== '未设置'
    
    // 已移除调试日志
    return isComplete
  },

  // 统一的云函数调用包装，带错误处理
  async callCloudFunctionSafely(functionName: string, data: any) {
    try {
      const result = await wx.cloud.callFunction({
        name: functionName,
        data: data
      })
      return result
    } catch (error) {
      // 已移除调试日志
      // 处理同步错误
      if (error && (error.message || '').includes('sync-0')) {
        // 已移除调试日志
        throw new Error('网络连接不稳定，请稍后重试')
      }
      
      // 重新抛出原始错误
      throw error
    }
  },

  async onShow() {
    // 页面显示时也确保数组字段正确
    this.ensureArrayFieldsInitialized()
    // 页面显示时刷新数据
    // 已移除调试日志
    await this.checkLoginStatus()
    if (this.data.isLoggedIn) {
      // 已移除调试日志
      await this.loadCloudUserInfo()
      
      // 检查是否需要显示完善信息提示
      // 注意：这个检查会优先检查永久标记，避免重复弹出
      this.checkProfileSetupNeeded()
    } else {
      // 已移除调试日志
    }
  },

  // 检查登录状态
  async checkLoginStatus() {
    const app = getApp<App.AppOption>()
    let isLoggedIn = app.globalData.isLoggedIn || false
    let openid = app.globalData.openid

    // 如果应用全局状态中没有登录信息，尝试从本地存储恢复
    if (!isLoggedIn || !openid) {
      const storedOpenid = wx.getStorageSync('openid')
      const storedUserInfo = wx.getStorageSync('userInfo')
      
      if (storedOpenid && storedUserInfo) {
        // 已移除调试日志
        app.globalData.openid = storedOpenid
        app.globalData.isLoggedIn = true
        app.globalData.userInfo = storedUserInfo
        
        isLoggedIn = true
        openid = storedOpenid
        
        // 立即更新用户信息显示
        this.setData({
          userInfo: {
            name: storedUserInfo.nickname || '未设置',
            role: this.getRoleDisplayName(storedUserInfo.role || 'user', storedUserInfo.isSuper),
            farm: storedUserInfo.farmName || '智慧养殖场',
            experience: '1',
            currentStock: '1280',
            healthRate: '95.2',
            avatarUrl: storedUserInfo.avatarUrl || '/assets/icons/profile.png'
          }
        })
      }
    }
    
    this.setData({
      isLoggedIn: isLoggedIn
    })

    // 已移除调试日志
  },

  // 从云开发加载用户信息
  async loadCloudUserInfo() {
    try {
      // 已移除调试日志
      // 优先使用云函数获取用户信息（更稳定）
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'get_user_info'
        }
      })

      if (result.result && result.result.success && result.result.data) {
        const cloudUserInfo = result.result.data
        
        // 更新本地和全局用户信息
        const app = getApp<App.AppOption>()
        app.globalData.userInfo = cloudUserInfo
        wx.setStorageSync('userInfo', cloudUserInfo)
        
        // 确保所有可能的字段名都被考虑到
        const displayName = cloudUserInfo.nickname || cloudUserInfo.nickName || '未设置'
        const displayFarm = cloudUserInfo.farmName || cloudUserInfo.department || '智慧养殖场'
        const displayAvatar = cloudUserInfo.avatarUrl || '/assets/icons/profile.png'
        
        // 已移除调试日志
        this.setData({
          cloudUserInfo: cloudUserInfo,
          userInfo: {
            name: displayName,
            role: this.getRoleDisplayName(cloudUserInfo.role || 'user', cloudUserInfo.isSuper),
            farm: displayFarm,
            experience: '1',
            currentStock: '1280',
            healthRate: '95.2',
            avatarUrl: displayAvatar
          }
        })
        
        // 已移除调试日志
        // 已移除调试日志
        return
      }
    } catch (error) {
      // 已移除调试日志
      // 处理特定的同步错误
      if (error && (error.message || '').includes('sync-0')) {
        // 已移除调试日志
        wx.showToast({
          title: '网络连接不稳定，使用本地数据',
          icon: 'none',
          duration: 3000
        })
      }
      
      // 已移除调试日志
      // 使用本地存储的用户信息作为备选
      const storedUserInfo = wx.getStorageSync('userInfo')
      if (storedUserInfo) {
        // 确保所有可能的字段名都被考虑到
        const displayName = storedUserInfo.nickname || storedUserInfo.nickName || '未设置'
        const displayFarm = storedUserInfo.farmName || storedUserInfo.department || '智慧养殖场'
        const displayAvatar = storedUserInfo.avatarUrl || '/assets/icons/profile.png'
        
        // 已移除调试日志
        this.setData({
          cloudUserInfo: storedUserInfo,
          userInfo: {
            name: displayName,
            role: this.getRoleDisplayName(storedUserInfo.role || 'user', storedUserInfo.isSuper),
            farm: displayFarm,
            experience: '1',
            currentStock: '1280',
            healthRate: '95.2',
            avatarUrl: displayAvatar
          }
        })
        
        // 已移除调试日志
        // 已移除调试日志
      } else {
        // 已移除调试日志
      }
    }
  },







  // 初始化用户信息
  async initUserInfo() {
    if (this.data.isLoggedIn) {
      // 已登录，先尝试从本地存储获取，再从云开发加载最新信息
      const storedUserInfo = wx.getStorageSync('userInfo')
      if (storedUserInfo) {
        this.setData({
          userInfo: {
            name: storedUserInfo.nickname || '未设置',
            role: '用户',
            farm: storedUserInfo.farmName || '智慧养殖场',
            experience: '1',
            currentStock: '1280',
            healthRate: '95.2',
            avatarUrl: storedUserInfo.avatarUrl || '/assets/icons/profile.png'
          }
        })
      }
      
      // 从云开发加载最新用户信息
      await this.loadCloudUserInfo()
    } else {
      // 未登录，显示默认信息
      this.setData({
        userInfo: {
          name: '游客',
          role: '用户',
          farm: '示范养殖场',
          experience: '0',
          currentStock: '0',
          healthRate: '0',
          avatarUrl: '/assets/icons/profile.png'
        }
      })
    }
  },

  // 登录
  goToLogin() {
    wx.navigateTo({
      url: '/packageUser/login/login'
    })
  },

  // 云开发登录
  async cloudLogin() {
    let loadingShown = false
    try {
      wx.showLoading({
        title: '登录中...',
        mask: true
      })
      loadingShown = true

      const app = getApp<App.AppOption>()
      await app.login()

      // 更新页面状态
      this.setData({
        isLoggedIn: true
      })
      
      // 加载用户信息
      await this.loadCloudUserInfo()

      if (loadingShown) {
        wx.hideLoading()
        loadingShown = false
      }

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })
    } catch (error) {
      // 已移除调试日志
      if (loadingShown) {
        wx.hideLoading()
        loadingShown = false
      }
      
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'error'
      })
    }
  },
















  // 查看财务详情
  viewFinanceDetail() {
    wx.navigateTo({
      url: '/packageFinance/finance/finance',
      fail: () => {
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
      }
    })
  },

  // 导航到功能菜单
  navigateToMenu(e: any) {
    const { item } = e.currentTarget.dataset
    
    // 检查权限
    if (item.requiredPermission && !this.hasPermission(item.requiredPermission)) {
      wx.showModal({
        title: '权限不足',
        content: '您没有访问此功能的权限，请联系管理员',
        showCancel: false
      })
      return
    }
    
    // 如果是系统设置，显示设置选项
    if (item.id === 4) {
      this.showSystemSettings()
      return
    }
    
    if (item.page) {
      wx.navigateTo({
        url: item.page,
        fail: () => {
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          })
        }
      })
    } else {
      wx.showModal({
        title: item.title,
        content: item.description,
        showCancel: false,
        success: () => {
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          })
        }
      })
    }
  },

  // 显示系统设置选项
  showSystemSettings() {
    wx.showActionSheet({
      itemList: ['隐私设置', '帮助与反馈', '关于我们'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.privacySettings()
            break
          case 1:
            this.helpAndFeedback()
            break
          case 2:
            this.aboutUs()
            break
        }
      }
    })
  },

  // 处理待办事项
  handlePendingItem(e: any) {
    const { item } = e.currentTarget.dataset
    
    wx.showModal({
      title: '处理申请',
      content: `${item.title}\n\n${item.description}`,
      confirmText: '审核',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '审核操作',
            content: '是否通过此申请？',
            confirmText: '通过',
            cancelText: '拒绝',
            success: (result) => {
              const action = result.confirm ? '通过' : '拒绝'
              wx.showToast({
                title: `申请已${action}`,
                icon: 'success'
              })
              
              // 更新待处理事项列表
              this.removePendingItem(item.id)
            }
          })
        }
      }
    })
  },

  // 移除待处理事项
  removePendingItem(id: number) {
    const pendingItems = this.data.pendingItems.filter(item => item.id !== id)
    this.setData({
      pendingItems
    })
  },

  // 更换头像 - 直接获取微信头像
  changeAvatar() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    // 头像按钮已经直接集成在UI中，无需额外操作
  },

  // 获取微信头像授权
  async onChooseAvatar(e: any) {
    // 已移除调试日志
    const { avatarUrl } = e.detail
    
    // 检查头像URL是否有效
    if (!avatarUrl || avatarUrl === '') {
      // 已移除调试日志
      wx.showModal({
        title: '提示',
        content: '头像获取失败，请确保已授权微信头像获取权限，或在真机上测试此功能。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }
    
    // 已移除调试日志
    // 立即显示新头像，提升用户体验
    this.setData({
      'userInfo.avatarUrl': avatarUrl
    })
    
    // 显示成功提示
    wx.showToast({
      title: '头像已更新',
      icon: 'success',
      duration: 1500
    })
    
    let loadingShown = false
    try {
      wx.showLoading({ 
        title: '更新头像中...',
        mask: true 
      })
      loadingShown = true
      
      // 调用云函数更新用户头像
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_user_profile',
          avatarUrl: avatarUrl
        }
      })
      
      if (result.result && result.result.success) {
        // 更新本地显示
        const app = getApp<App.AppOption>()
        const updatedUserInfo = result.result.data?.user || {
          ...app.globalData.userInfo,
          avatarUrl: avatarUrl
        }
        
        // 已移除调试日志
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        this.setData({
          'userInfo.avatarUrl': avatarUrl,
          cloudUserInfo: updatedUserInfo
        })
        
        wx.hideLoading()
        loadingShown = false
        
        wx.showToast({
          title: '头像更新成功',
          icon: 'success'
        })
      } else {
        throw new Error(result.result?.message || '云端更新失败')
      }
    } catch (error) {
      // 已移除调试日志
      // 如果是文件路径错误（开发者工具常见问题），给出友好提示
      let errorMessage = '头像更新失败'
      if (error.message && error.message.includes('ENOENT')) {
        errorMessage = '开发环境头像路径错误，请在真机上测试'
        // 在开发环境中，头像仍然显示（已经设置），只是云端同步失败
        // 已移除调试日志
      } else {
        // 其他错误，恢复原头像
        const app = getApp<App.AppOption>()
        const originalAvatar = app.globalData.userInfo?.avatarUrl || '/assets/icons/profile.png'
        this.setData({
          'userInfo.avatarUrl': originalAvatar
        })
      }
      
      if (loadingShown) {
        wx.hideLoading()
        loadingShown = false
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      })
    }
  },

  // 编辑个人信息
  editProfile() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    const cloudUserInfo = this.data.cloudUserInfo
    this.setData({
      showEditProfilePopup: true,
      editNickname: cloudUserInfo?.nickname || this.data.userInfo.name || '',
      editFarmName: cloudUserInfo?.farmName || this.data.userInfo.farm || '',
      editPhone: cloudUserInfo?.phone || ''
    })
  },

  // 关闭编辑个人信息弹窗
  closeEditProfilePopup() {
    this.setData({
      showEditProfilePopup: false,
      editNickname: '',
      editFarmName: '',
      editPhone: ''
    })
  },

  // 确认编辑个人信息
  confirmEditProfile() {
    this.onSaveEditProfile()
  },

  // 编辑个人信息弹窗可见性变化
  onEditProfilePopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showEditProfilePopup: false,
        editNickname: '',
        editFarmName: '',
        editPhone: ''
      })
    }
  },

  // 编辑昵称输入
  onEditNicknameInput(e: any) {
    this.setData({
      editNickname: e.detail.value
    })
  },

  // 编辑养殖场名称输入
  onEditFarmNameInput(e: any) {
    this.setData({
      editFarmName: e.detail.value
    })
  },

  // 编辑手机号输入
  onEditPhoneInput(e: any) {
    this.setData({
      editPhone: e.detail.value
    })
  },

  // 保存编辑的个人信息
  async onSaveEditProfile() {
    const { editNickname, editFarmName, editPhone } = this.data

    if (!editNickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'error'
      })
      return
    }

    if (!editPhone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'error'
      })
      return
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(editPhone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'error'
      })
      return
    }

    if (!editFarmName.trim()) {
      wx.showToast({
        title: '请输入养殖场名称',
        icon: 'error'
      })
      return
    }

    let loadingShown = false
    try {
      wx.showLoading({ 
        title: '保存中...',
        mask: true 
      })
      loadingShown = true
      
      // 调用云函数更新用户信息
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_user_profile',
          nickName: editNickname.trim(),
          department: editFarmName.trim(),
          phone: editPhone.trim()
        }
      })
      
      if (result.result && result.result.success) {
        // 更新本地显示
        const app = getApp<App.AppOption>()
        const updatedUserInfo = result.result.data.user
        
        // 已移除调试日志
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        // 确保数据字段正确映射到界面显示
        const displayName = updatedUserInfo.nickname || updatedUserInfo.nickName || editNickname.trim()
        const displayFarm = updatedUserInfo.farmName || updatedUserInfo.department || editFarmName.trim()
        
        this.setData({
          'userInfo.name': displayName,
          'userInfo.farm': displayFarm,
          'userInfo.avatarUrl': updatedUserInfo.avatarUrl || this.data.userInfo.avatarUrl,
          cloudUserInfo: updatedUserInfo,
          showEditProfilePopup: false
        })
        
        // 已移除调试日志
        // 先隐藏loading再显示toast
        if (loadingShown) {
          wx.hideLoading()
          loadingShown = false
        }
        
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        
        // 检查信息是否现在完整了 - 使用统一的检查逻辑
        const isNowComplete = this.checkUserInfoCompleteness(updatedUserInfo)
        
        if (isNowComplete) {
          // 信息已完善，设置永久标记并清除临时标记
          wx.setStorageSync('profileCompleted', true) // 永久标记，表示用户已完善过信息
          wx.setStorageSync('profileCompletedTime', Date.now()) // 记录完善时间
          
          // 清除临时提示标记
          wx.removeStorageSync('needProfileSetup')
          wx.removeStorageSync('hasSkippedProfileSetup')
          wx.removeStorageSync('skipProfileSetupUntil')
          
          this.setData({
            showProfileSetupTip: false
          })
          
          // 已移除调试日志
          // 已移除调试日志
          
          // 显示完善成功提示
          setTimeout(() => {
            wx.showToast({
              title: '个人信息已完善！',
              icon: 'success',
              duration: 2000
            })
          }, 500)
        } else {
          // 已移除调试日志
        }
      } else {
        throw new Error(result.result?.message || '保存失败')
      }
    } catch (error) {
      // 已移除调试日志
      if (loadingShown) {
        wx.hideLoading()
        loadingShown = false
      }
      
      // 处理特定的同步错误
      let errorMessage = error.message || '保存失败'
      if (error && (error.message || '').includes('sync-0')) {
        errorMessage = '网络连接不稳定，请稍后重试'
        // 已移除调试日志
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      })
    }
  },

  // 检查是否需要显示完善信息提示
  checkProfileSetupNeeded() {
    // 已移除调试日志
    // 首先检查是否已经有永久完善标记 - 优先检查永久标记
    const profileCompleted = wx.getStorageSync('profileCompleted') || false
    const profileCompletedTime = wx.getStorageSync('profileCompletedTime')
    
    // 已移除调试日志
    
    if (profileCompleted) {
      // 已移除调试日志
      this.setData({
        showProfileSetupTip: false
      })
      return
    }
    
    // 检查当前用户信息是否已经完整 - 使用统一的检查逻辑
    const cloudUserInfo = this.data.cloudUserInfo
    // 已移除调试日志
    if (cloudUserInfo) {
      const isInfoComplete = this.checkUserInfoCompleteness(cloudUserInfo)
      
      // 已移除调试日志
      if (isInfoComplete) {
        // 信息已经完整，设置永久标记并清除临时标记
        wx.setStorageSync('profileCompleted', true)
        wx.setStorageSync('profileCompletedTime', Date.now())
        
        // 清除临时提示标记
        wx.removeStorageSync('needProfileSetup')
        wx.removeStorageSync('hasSkippedProfileSetup')
        wx.removeStorageSync('skipProfileSetupUntil')
        
        this.setData({
          showProfileSetupTip: false
        })
        
        // 已移除调试日志
        return // 直接返回，不执行后续逻辑
      }
    } else {
      // 已移除调试日志
    }
    
    // 信息不完整且没有永久标记时才检查是否需要提示
    const needSetup = wx.getStorageSync('needProfileSetup')
    const hasSkipped = wx.getStorageSync('hasSkippedProfileSetup')
    const skipUntil = wx.getStorageSync('skipProfileSetupUntil')
    
    // 已移除调试日志
    // 检查跳过状态是否过期
    if (skipUntil && Date.now() > skipUntil) {
      // 已移除调试日志
      wx.removeStorageSync('hasSkippedProfileSetup')
      wx.removeStorageSync('skipProfileSetupUntil')
    }
    
    // 只有在需要完善且用户没有跳过的情况下才显示提示
    if (needSetup && !hasSkipped) {
      // 已移除调试日志
      this.setData({
        showProfileSetupTip: true
      })
      
      // 自动弹出编辑弹窗
      setTimeout(() => {
        this.editProfile()
      }, 500)
    } else {
      // 已移除调试日志
      this.setData({
        showProfileSetupTip: false
      })
    }
    
    // 已移除调试日志
  },

  // 关闭完善信息提示
  closeProfileSetupTip() {
    // 手动关闭时也清除相关标记
    wx.removeStorageSync('needProfileSetup')
    wx.removeStorageSync('hasSkippedProfileSetup')
    wx.removeStorageSync('skipProfileSetupUntil')
    
    this.setData({
      showProfileSetupTip: false
    })
  },

  // 开发调试：清除所有完善信息相关的缓存（长按用户名触发）
  onLongPressUserName() {
    wx.showActionSheet({
      itemList: ['刷新用户信息显示', '查看完善状态信息', '重置完善状态（测试用）', '查看调试信息'],
      success: async (res) => {
        switch (res.tapIndex) {
          case 0:
            // 刷新用户信息显示
            wx.showLoading({ title: '刷新中...' })
            await this.loadCloudUserInfo()
            wx.hideLoading()
            wx.showToast({ title: '信息已刷新', icon: 'success' })
            break
          case 1:
            // 查看完善状态信息
            const profileCompleted = wx.getStorageSync('profileCompleted')
            const profileCompletedTime = wx.getStorageSync('profileCompletedTime')
            const needSetup = wx.getStorageSync('needProfileSetup')
            const hasSkipped = wx.getStorageSync('hasSkippedProfileSetup')
            const skipUntil = wx.getStorageSync('skipProfileSetupUntil')
            
            const statusInfo = `完善状态: ${profileCompleted ? '已完善' : '未完善'}\n完善时间: ${profileCompletedTime ? new Date(profileCompletedTime).toLocaleString() : '无'}\n需要完善: ${needSetup ? '是' : '否'}\n已跳过: ${hasSkipped ? '是' : '否'}\n跳过到期: ${skipUntil ? new Date(skipUntil).toLocaleString() : '无'}`
            
            wx.showModal({
              title: '完善状态信息',
              content: statusInfo,
              showCancel: false
            })
            break
          case 2:
            // 重置完善状态（测试用）
            wx.showModal({
              title: '重置完善状态',
              content: '这将清除所有完善信息相关的标记，用于测试。确定要继续吗？',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.removeStorageSync('profileCompleted')
                  wx.removeStorageSync('profileCompletedTime')
                  wx.removeStorageSync('needProfileSetup')
                  wx.removeStorageSync('hasSkippedProfileSetup')
                  wx.removeStorageSync('skipProfileSetupUntil')
                  this.setData({ showProfileSetupTip: false })
                  wx.showToast({ title: '完善状态已重置', icon: 'success' })
                  // 已移除调试日志
                }
              }
            })
            break
          case 3:
            // 查看调试信息
            const cloudUserInfo = this.data.cloudUserInfo
            const userInfo = this.data.userInfo
            const isComplete = this.checkUserInfoCompleteness(cloudUserInfo)
            
            // 已移除调试日志
            wx.showModal({
              title: '调试信息',
              content: `界面显示: ${userInfo.name} | ${userInfo.farm}\n云端数据: ${cloudUserInfo?.nickname || cloudUserInfo?.nickName || '无'} | ${cloudUserInfo?.farmName || cloudUserInfo?.department || '无'}\n信息完整: ${isComplete ? '是' : '否'}`,
              showCancel: false
            })
            break
        }
      }
    })
  },

  // 编辑昵称
  editNickname() {
    const currentNickname = this.data.userInfo.name || '未设置'
    
    this.setData({
      showEditNicknamePopup: true,
      popupData: {
        title: '编辑昵称',
        content: `当前昵称：${currentNickname}`,
        inputValue: currentNickname,
        originalValue: currentNickname
      }
    })
  },
  
  // 确认修改昵称
  confirmEditNickname() {
    const inputValue = this.data.popupData.inputValue
    if (inputValue && inputValue.trim()) {
      this.updateNickname(inputValue.trim())
      this.closeEditNicknamePopup()
    } else {
      wx.showToast({
        title: '请输入有效昵称',
        icon: 'none'
      })
    }
  },
  
  // 关闭编辑昵称弹窗
  closeEditNicknamePopup() {
    this.setData({
      showEditNicknamePopup: false
    })
  },
  
  // 昵称输入变化
  onNicknameInput(e: any) {
    this.setData({
      'popupData.inputValue': e.detail.value
    })
  },

  // 编辑养殖场名称
  editFarmName() {
    const currentFarmName = this.data.userInfo.farm || '智慧养殖场'
    
    this.setData({
      showEditFarmPopup: true,
      popupData: {
        title: '编辑养殖场名称',
        content: `当前养殖场：${currentFarmName}`,
        inputValue: currentFarmName,
        originalValue: currentFarmName
      }
    })
  },
  
  // 确认修改养殖场名称
  confirmEditFarm() {
    const inputValue = this.data.popupData.inputValue
    if (inputValue && inputValue.trim()) {
      this.updateFarmName(inputValue.trim())
      this.closeEditFarmPopup()
    } else {
      wx.showToast({
        title: '请输入有效名称',
        icon: 'none'
      })
    }
  },
  
  // 关闭编辑养殖场弹窗
  closeEditFarmPopup() {
    this.setData({
      showEditFarmPopup: false
    })
  },
  
  // 养殖场名称输入变化
  onFarmNameInput(e: any) {
    this.setData({
      'popupData.inputValue': e.detail.value
    })
  },

  // 更新昵称
  async updateNickname(newNickname: string) {
    try {
      wx.showLoading({ title: '更新中...' })
      
      // 调用云函数更新用户信息
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_user_profile',
          nickName: newNickname
        }
      })
      
      if (result.result && result.result.success) {
        // 更新本地显示
        const app = getApp<App.AppOption>()
        const updatedUserInfo = result.result.data?.user || {
          ...app.globalData.userInfo,
          nickname: newNickname,
          nickName: newNickname
        }
        
        // 已移除调试日志
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        // 确保显示名称正确更新
        const displayName = updatedUserInfo.nickname || updatedUserInfo.nickName || newNickname
        this.setData({
          'userInfo.name': displayName,
          cloudUserInfo: updatedUserInfo
        })
        
        // 已移除调试日志
        wx.showToast({
          title: '昵称更新成功',
          icon: 'success'
        })
        
        // 检查更新后信息是否完整
        if (this.checkUserInfoCompleteness(updatedUserInfo)) {
          wx.setStorageSync('profileCompleted', true)
          wx.setStorageSync('profileCompletedTime', Date.now())
          // 已移除调试日志
          // 已移除调试日志
        } else {
          // 已移除调试日志
        }
      } else {
        throw new Error(result.result?.message || '更新失败')
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 更新养殖场名称
  async updateFarmName(newFarmName: string) {
    try {
      wx.showLoading({ title: '更新中...' })
      
      // 调用云函数更新用户信息
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_user_profile',
          department: newFarmName
        }
      })
      
      if (result.result && result.result.success) {
        // 更新本地显示
        const app = getApp<App.AppOption>()
        const updatedUserInfo = result.result.data?.user || {
          ...app.globalData.userInfo,
          farmName: newFarmName,
          department: newFarmName
        }
        
        // 已移除调试日志
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        // 确保显示名称正确更新
        const displayFarm = updatedUserInfo.farmName || updatedUserInfo.department || newFarmName
        this.setData({
          'userInfo.farm': displayFarm,
          cloudUserInfo: updatedUserInfo
        })
        
        // 已移除调试日志
        wx.showToast({
          title: '养殖场名称更新成功',
          icon: 'success'
        })
        
        // 检查更新后信息是否完整
        if (this.checkUserInfoCompleteness(updatedUserInfo)) {
          wx.setStorageSync('profileCompleted', true)
          wx.setStorageSync('profileCompletedTime', Date.now())
          // 已移除调试日志
          // 已移除调试日志
        } else {
          // 已移除调试日志
        }
      } else {
        throw new Error(result.result?.message || '更新失败')
      }
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 处理保存个人信息
  async handleSaveProfile(newValue: string, fieldIndex: number, fieldName: string) {
    try {
      wx.showLoading({
        title: '保存中...'
      })

      // 更新本地显示
      const keys = ['farm', 'role']
      const dataKey = `userInfo.${keys[fieldIndex]}`
      this.setData({
        [dataKey]: newValue
      })

      wx.hideLoading()
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 显示消息通知
  showNotifications() {
    const unreadCount = this.data.notifications.filter(n => !n.read).length
    const notificationList = this.data.notifications.map(n => `${n.title}: ${n.content}`).join('\n\n')
    
    wx.showModal({
      title: `消息通知 (${unreadCount}条未读)`,
      content: notificationList || '暂无消息',
      confirmText: '全部已读',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          // 标记所有消息为已读
          const notifications = this.data.notifications.map(n => ({ ...n, read: true }))
          this.setData({ notifications })
          wx.showToast({
            title: '已标记为已读',
            icon: 'success'
          })
        }
      }
    })
  },

  // 隐私设置
  privacySettings() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 帮助与反馈
  helpAndFeedback() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 关于我们
  aboutUs() {
    wx.showModal({
      title: '关于智慧养鹅',
      content: '智慧养鹅小程序 v1.0.0\n\n集生产管理、健康监控、知识学习和财务分析于一体的专业养鹅管理系统。',
      showCancel: false
    })
  },

  // 获取角色显示名称 - 使用新的4角色体系
  getRoleDisplayName(role: string, isSuper?: boolean): string {
    // 使用新的角色配置
    const roleName = getRoleName(role)
    return roleName !== '未知角色' ? roleName : '员工'
  },

  // 检查用户权限
  hasPermission(requiredPermission: string): boolean {
    const app = getApp<App.AppOption>()
    const userInfo = app.globalData.userInfo
    
    if (!userInfo) return false
    
    // 超级管理员拥有所有权限
    if (userInfo.isSuper === true) return true
    
    // 管理员拥有所有权限
    if (userInfo.role === 'admin') return true
    
    // 检查是否有所有权限
    if (userInfo.permissions && userInfo.permissions.includes('all')) return true
    
    // 检查特定权限
    if (userInfo.permissions && userInfo.permissions.includes(requiredPermission)) return true
    
    return false
  },

  // 退出登录
  logout() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '您还未登录',
        icon: 'none'
      })
      return
    }

    this.setData({
      showLogoutConfirmPopup: true,
      popupData: {
        title: '退出登录',
        content: '确定要退出登录吗？退出后需要重新登录才能使用完整功能。',
        inputValue: '',
        originalValue: ''
      }
    })
  },
  
  // 确认退出登录
  confirmLogout() {
    try {
      // 清除全局登录状态
      const app = getApp<App.AppOption>()
      app.globalData.openid = undefined
      app.globalData.isLoggedIn = false
      app.globalData.userInfo = undefined

      // 清除本地存储
      wx.removeStorageSync('openid')
      wx.removeStorageSync('userInfo')
      
      // 注意：不清除完善信息的永久状态标记
      // 用户完善过的信息状态应该永久保持，避免重复弹出完善弹窗
      // wx.removeStorageSync('needProfileSetup')  // 这个可以清除，因为是临时提示标记
      // wx.removeStorageSync('hasSkippedProfileSetup')  // 这个也可以清除
      // wx.removeStorageSync('skipProfileSetupUntil')   // 这个也可以清除
      
      // 但是我们需要保留一个永久标记表示用户已经完善过信息
      // 这样下次登录时就不会再弹出完善弹窗了
      // 已移除调试日志
      
      // 重置页面数据
      this.setData({
        isLoggedIn: false,
        cloudUserInfo: null,
        showLogoutConfirmPopup: false,
        showProfileSetupTip: false, // 确保完善信息提示也被隐藏
        userInfo: {
          name: '游客',
          role: '用户',
          farm: '示范养殖场',
          experience: '0',
          currentStock: '0',
          healthRate: '0',
          avatarUrl: '/assets/icons/profile.png'
        }
      })
      
      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      })
      
    } catch (error) {
      // 捕获可能的异常（如微信开发者工具的内部错误）
      console.warn('退出登录过程中出现警告（已忽略）:', error)
      
      // 即使出错，也确保UI更新
      this.setData({
        isLoggedIn: false,
        showLogoutConfirmPopup: false
      })
      
      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      })
    }
  },
  
  // 关闭退出确认弹窗
  closeLogoutPopup() {
    this.setData({
      showLogoutConfirmPopup: false
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
