// profile.ts
import { createPageWithNavbar } from '../../utils/navigation'
import { checkPageAuth } from '../../utils/auth-guard'

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
    showEditDialog: false,
    editNickname: '',
    editFarmName: '',
    editPhone: '',
    // 是否需要完善信息提示
    showProfileSetupTip: false,
    

    
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
        page: '/pages/finance/finance'
      },
      {
        id: 2,
        title: '员工管理',
        description: '邀请码管理、员工权限设置',
        icon: 'user-group',
        page: '/pages/employee-permission/employee-permission',
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
    this.checkLoginStatus()
    this.initUserInfo()
  },

  async onShow() {
    // 页面显示时刷新数据
    console.log('个人中心页面显示，开始检查登录状态')
    await this.checkLoginStatus()
    if (this.data.isLoggedIn) {
      console.log('用户已登录，加载云端用户信息')
      await this.loadCloudUserInfo()
      // 检查是否需要显示完善信息提示
      this.checkProfileSetupNeeded()
    } else {
      console.log('用户未登录')
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
        console.log('个人中心: 从本地存储恢复登录状态')
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

    console.log('个人中心登录状态检查:', { isLoggedIn, hasOpenid: !!openid })
  },

  // 从云开发加载用户信息
  async loadCloudUserInfo() {
    try {
      const db = wx.cloud.database()
      const result = await db.collection('users').where({
        _openid: wx.cloud.database().command.exists(true)
      }).get()

      if (result.data.length > 0) {
        const cloudUserInfo = result.data[0]
        
        // 更新本地和全局用户信息
        const app = getApp<App.AppOption>()
        app.globalData.userInfo = cloudUserInfo
        wx.setStorageSync('userInfo', cloudUserInfo)
        
        this.setData({
          cloudUserInfo: cloudUserInfo,
          userInfo: {
            name: cloudUserInfo.nickname || '未设置',
            role: this.getRoleDisplayName(cloudUserInfo.role || 'user', cloudUserInfo.isSuper),
            farm: cloudUserInfo.farmName || '智慧养殖场', // 使用数据库中的养殖场名称
            experience: '1',
            currentStock: '1280',
            healthRate: '95.2',
            avatarUrl: cloudUserInfo.avatarUrl || '/assets/icons/profile.png'
          }
        })
        
        console.log('个人中心用户信息已更新:', {
          name: cloudUserInfo.nickname,
          farm: cloudUserInfo.farmName,
          phone: cloudUserInfo.phone
        })
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
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
      url: '/pages/login/login'
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
      console.error('登录失败:', error)
      
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















  // 返回上一页
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  },

  // 查看财务详情
  viewFinanceDetail() {
    wx.navigateTo({
      url: '/pages/finance/finance',
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
    const { avatarUrl } = e.detail
    console.log('获取到新头像:', avatarUrl)
    
    // 检查头像URL是否有效
    if (!avatarUrl || avatarUrl === '') {
      wx.showToast({
        title: '头像获取失败，请重试',
        icon: 'error'
      })
      return
    }
    
    // 立即显示新头像，提升用户体验
    this.setData({
      'userInfo.avatarUrl': avatarUrl
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
          action: 'update_profile',
          avatarUrl: avatarUrl
        }
      })
      
      if (result.result && result.result.success) {
        // 更新本地显示
        const app = getApp<App.AppOption>()
        const updatedUserInfo = {
          ...app.globalData.userInfo,
          avatarUrl: avatarUrl
        }
        
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
      console.error('更新头像失败:', error)
      
      // 如果是文件路径错误（开发者工具常见问题），给出友好提示
      let errorMessage = '头像更新失败'
      if (error.message && error.message.includes('ENOENT')) {
        errorMessage = '开发环境头像路径错误，请在真机上测试'
        // 在开发环境中，头像仍然显示（已经设置），只是云端同步失败
        console.warn('开发者工具头像路径问题，真机环境正常')
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
      showEditDialog: true,
      editNickname: cloudUserInfo?.nickname || this.data.userInfo.name || '',
      editFarmName: cloudUserInfo?.farmName || this.data.userInfo.farm || '',
      editPhone: cloudUserInfo?.phone || ''
    })
  },

  // 关闭编辑弹窗
  closeEditDialog() {
    this.setData({
      showEditDialog: false,
      editNickname: '',
      editFarmName: '',
      editPhone: ''
    })
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
          action: 'update_profile',
          nickname: editNickname.trim(),
          farmName: editFarmName.trim(),
          phone: editPhone.trim()
        }
      })
      
      if (result.result && result.result.success) {
        // 更新本地显示
        const app = getApp<App.AppOption>()
        const updatedUserInfo = result.result.data.user
        
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        this.setData({
          'userInfo.name': updatedUserInfo.nickname,
          'userInfo.farm': updatedUserInfo.farmName,
          cloudUserInfo: updatedUserInfo,
          showEditDialog: false
        })
        
        // 先隐藏loading再显示toast
        if (loadingShown) {
          wx.hideLoading()
          loadingShown = false
        }
        
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })
        
        // 检查信息是否现在完整了
        const isNowComplete = updatedUserInfo.nickname && 
                             updatedUserInfo.nickname.trim() !== '' && 
                             updatedUserInfo.nickname !== '未设置' &&
                             updatedUserInfo.phone && 
                             updatedUserInfo.phone.trim() !== '' &&
                             updatedUserInfo.farmName && 
                             updatedUserInfo.farmName.trim() !== '' && 
                             updatedUserInfo.farmName !== '智慧养殖场' &&
                             updatedUserInfo.farmName !== '未设置'
        
        if (isNowComplete) {
          // 信息已完善，清除所有相关标记
          wx.removeStorageSync('needProfileSetup')
          wx.removeStorageSync('hasSkippedProfileSetup')
          wx.removeStorageSync('skipProfileSetupUntil')
          
          this.setData({
            showProfileSetupTip: false
          })
          
          // 显示完善成功提示
          setTimeout(() => {
            wx.showToast({
              title: '个人信息已完善！',
              icon: 'success',
              duration: 2000
            })
          }, 500)
        }
      } else {
        throw new Error(result.result?.message || '保存失败')
      }
    } catch (error) {
      console.error('保存个人信息失败:', error)
      
      if (loadingShown) {
        wx.hideLoading()
        loadingShown = false
      }
      
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      })
    }
  },

  // 检查是否需要显示完善信息提示
  checkProfileSetupNeeded() {
    // 首先检查当前用户信息是否已经完整
    const cloudUserInfo = this.data.cloudUserInfo
    if (cloudUserInfo) {
      const isInfoComplete = cloudUserInfo.nickname && 
                            cloudUserInfo.nickname.trim() !== '' && 
                            cloudUserInfo.nickname !== '未设置' &&
                            cloudUserInfo.phone && 
                            cloudUserInfo.phone.trim() !== '' &&
                            cloudUserInfo.farmName && 
                            cloudUserInfo.farmName.trim() !== '' && 
                            cloudUserInfo.farmName !== '智慧养殖场' &&
                            cloudUserInfo.farmName !== '未设置'
      
      if (isInfoComplete) {
        // 信息已经完整，清除所有相关标记，不显示任何提示
        wx.removeStorageSync('needProfileSetup')
        wx.removeStorageSync('hasSkippedProfileSetup')
        wx.removeStorageSync('skipProfileSetupUntil')
        
        this.setData({
          showProfileSetupTip: false
        })
        return // 直接返回，不执行后续逻辑
      }
    }
    
    // 信息不完整时才检查是否需要提示
    const needSetup = wx.getStorageSync('needProfileSetup')
    if (needSetup) {
      this.setData({
        showProfileSetupTip: true
      })
      
      // 自动弹出编辑弹窗
      setTimeout(() => {
        this.editProfile()
      }, 500)
    }
    
    // 检查跳过状态是否过期
    const skipUntil = wx.getStorageSync('skipProfileSetupUntil')
    if (skipUntil && Date.now() > skipUntil) {
      // 跳过状态已过期，清除标记
      wx.removeStorageSync('hasSkippedProfileSetup')
      wx.removeStorageSync('skipProfileSetupUntil')
    }
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
    if (process.env.NODE_ENV === 'development') {
      wx.showModal({
        title: '开发调试',
        content: '是否清除所有个人信息完善相关的缓存？',
        success: (res) => {
          if (res.confirm) {
            wx.removeStorageSync('needProfileSetup')
            wx.removeStorageSync('hasSkippedProfileSetup')
            wx.removeStorageSync('skipProfileSetupUntil')
            
            this.setData({
              showProfileSetupTip: false
            })
            
            wx.showToast({
              title: '缓存已清除',
              icon: 'success'
            })
          }
        }
      })
    }
  },

  // 编辑昵称
  editNickname() {
    const currentNickname = this.data.userInfo.name || '未设置'
    
    wx.showModal({
      title: '编辑昵称',
      content: `当前昵称：${currentNickname}`,
      placeholderText: '请输入新的昵称',
      editable: true,
      confirmText: '保存',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          this.updateNickname(res.content.trim())
        }
      }
    })
  },

  // 编辑养殖场名称
  editFarmName() {
    const currentFarmName = this.data.userInfo.farm || '智慧养殖场'
    
    wx.showModal({
      title: '编辑养殖场名称',
      content: `当前养殖场：${currentFarmName}`,
      placeholderText: '请输入新的养殖场名称',
      editable: true,
      confirmText: '保存',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          this.updateFarmName(res.content.trim())
        }
      }
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
          action: 'update_profile',
          nickname: newNickname
        }
      })
      
      if (result.result && result.result.success) {
        // 更新本地显示
        const app = getApp<App.AppOption>()
        const updatedUserInfo = {
          ...app.globalData.userInfo,
          nickname: newNickname
        }
        
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        this.setData({
          'userInfo.name': newNickname,
          cloudUserInfo: updatedUserInfo
        })
        
        wx.showToast({
          title: '昵称更新成功',
          icon: 'success'
        })
      } else {
        throw new Error(result.result?.message || '更新失败')
      }
    } catch (error) {
      console.error('更新昵称失败:', error)
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
          action: 'update_profile',
          farmName: newFarmName
        }
      })
      
      if (result.result && result.result.success) {
        // 更新本地显示
        const app = getApp<App.AppOption>()
        const updatedUserInfo = {
          ...app.globalData.userInfo,
          farmName: newFarmName
        }
        
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)
        
        this.setData({
          'userInfo.farm': newFarmName,
          cloudUserInfo: updatedUserInfo
        })
        
        wx.showToast({
          title: '养殖场名称更新成功',
          icon: 'success'
        })
      } else {
        throw new Error(result.result?.message || '更新失败')
      }
    } catch (error) {
      console.error('更新养殖场名称失败:', error)
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

  // 获取角色显示名称
  getRoleDisplayName(role: string, isSuper?: boolean): string {
    // 如果是超级管理员，优先显示超级管理员
    if (isSuper === true) {
      return '超级管理员'
    }
    
    switch (role) {
      case 'admin':
        return '管理员'
      case 'manager':
        return '经理'
      case 'operator':
        return '操作员'
      case 'employee':
        return '员工'
      case 'user':
      default:
        return '用户'
    }
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

    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？退出后需要重新登录才能使用完整功能。',
      success: (res) => {
        if (res.confirm) {
          // 清除全局登录状态
          const app = getApp<App.AppOption>()
          app.globalData.openid = undefined
          app.globalData.isLoggedIn = false
          app.globalData.userInfo = undefined

          // 清除本地存储
          wx.removeStorageSync('openid')
          wx.removeStorageSync('userInfo')

          // 重置页面数据
          this.setData({
            isLoggedIn: false,
            cloudUserInfo: null,
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

          console.log('已退出登录，状态已重置')
        }
      }
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
