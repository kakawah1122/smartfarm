// profile.ts - 个人中心页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 报销类型配置 - 养殖场景
const REIMBURSEMENT_TYPES = [
  { code: 'feed', name: '饲料采购' },
  { code: 'medicine', name: '兽药采购' },
  { code: 'vaccine', name: '防疫费用' },
  { code: 'equipment', name: '设备维修' },
  { code: 'transport', name: '运输费用' },
  { code: 'utilities', name: '水电费' },
  { code: 'labor', name: '劳务费用' },
  { code: 'other', name: '其他费用' }
]

// 管理功能配置
const ADMIN_FUNCTIONS = [
  { id: 1, label: '人员管理', page: '/packageUser/user-management/user-management' },
  { id: 2, label: '邀请码管理', page: '/packageUser/invite-management/invite-management' },
  { id: 3, label: '财务管理', page: '/packageFinance/finance/finance' },
  { id: 4, label: '数据分析', page: '/packageFinance/performance-analysis/performance-analysis' }
]

// 系统设置配置
const SYSTEM_SETTINGS = [
  { id: 1, label: '隐私设置', action: 'privacy' },
  { id: 2, label: '通知设置', action: 'notification-settings' },
  { id: 3, label: '关于我们', action: 'about' },
  { id: 4, label: '帮助中心', action: 'help' }
]

const pageConfig = {
  data: {
    // 用户信息
    userInfo: {
      name: '未登录',
      role: '用户',
      farm: '智慧养殖场',
      phone: '',
      workYears: '0年',
      joinDate: '',
      avatarUrl: '/assets/icons/profile.png'
    },
    
    // 角色信息
    isAdmin: false,
    userRole: '',
    
    // 报销统计
    reimbursementStats: {
      monthlyAmount: 0,
      totalAmount: 0,
      monthlyCount: 0,
      totalCount: 0
    },
    
    // 功能配置
    adminFunctions: ADMIN_FUNCTIONS,
    systemSettings: SYSTEM_SETTINGS,
    
    // 弹窗状态
    showReimbursementDialog: false,
    
    // 报销表单
    reimbursementTypes: REIMBURSEMENT_TYPES,
    reimbursementForm: {
      typeIndex: 0,
      amount: '',
      date: '',
      description: '',
      detail: '',
      vouchers: []
    },
    
    // 加载状态
    loading: false
  },

  onLoad() {
    this.initPage()
  },

  onShow() {
    this.refreshData()
  },

  /**
   * 初始化页面
   */
  async initPage() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      await this.loadUserInfo()
      await this.loadReimbursementStats()
      
      wx.hideLoading()
    } catch (error) {
      wx.hideLoading()
      console.error('页面初始化失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 刷新数据
   */
  async refreshData() {
    // 静默刷新，不显示loading
    try {
      await this.loadReimbursementStats()
    } catch (error) {
      console.error('刷新数据失败:', error)
    }
  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      const app = getApp<IAppOption>()
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      
      if (!userInfo) {
        throw new Error('未登录')
      }
      
      // 计算工龄
      const joinDate = userInfo.createTime ? new Date(userInfo.createTime) : new Date()
      const now = new Date()
      const years = now.getFullYear() - joinDate.getFullYear()
      const months = now.getMonth() - joinDate.getMonth()
      const totalMonths = years * 12 + months
      const workYears = totalMonths >= 12 
        ? `${Math.floor(totalMonths / 12)}年${totalMonths % 12}个月`
        : `${totalMonths}个月`
      
      // 判断是否是管理员
      const isAdmin = ['manager', 'super_admin'].includes(userInfo.role)
      
      // 使用路径更新优化 setData 性能
      this.setData({
        'userInfo.name': userInfo.nickname || userInfo.nickName || '未设置',
        'userInfo.role': this.getRoleDisplayName(userInfo.role),
        'userInfo.farm': userInfo.farmName || userInfo.department || '智慧养殖场',
        'userInfo.phone': userInfo.phone || '未设置',
        'userInfo.avatarUrl': userInfo.avatarUrl || '/assets/icons/profile.png',
        isAdmin: isAdmin,
        userRole: userInfo.role
      })
    } catch (error) {
      console.error('加载用户信息失败:', error)
      throw error
    }
  },

  /**
   * 加载报销统计
   */
  async loadReimbursementStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'get_my_reimbursement_stats'
        }
      })
      
      if (result.result && result.result.success) {
        const data = result.result.data
        this.setData({
          reimbursementStats: {
            monthlyAmount: data.monthlyAmount.toLocaleString(),
            totalAmount: data.totalAmount.toLocaleString(),
            monthlyCount: data.monthlyCount,
            totalCount: data.totalCount
          }
        })
      }
    } catch (error) {
      console.error('加载报销统计失败:', error)
    }
  },

  /**
   * 选择头像
   */
  async onChooseAvatar(e: any) {
    const { avatarUrl } = e.detail
    
    if (!avatarUrl) {
      wx.showToast({ title: '头像获取失败', icon: 'none' })
      return
    }
    
    try {
      wx.showLoading({ title: '上传中...' })
      
      // 获取图片信息，检查文件大小
      const imageInfo = await wx.getImageInfo({ src: avatarUrl })
      const fileManager = wx.getFileSystemManager()
      const fileStats = fileManager.statSync(avatarUrl)
      
      // 检查文件大小（限制 2MB）
      if (fileStats.size > 2 * 1024 * 1024) {
        wx.hideLoading()
        wx.showToast({ title: '图片不能超过2MB', icon: 'none' })
        return
      }
      
      // 压缩图片
      let finalPath = avatarUrl
      if (fileStats.size > 500 * 1024) { // 超过 500KB 则压缩
        const compressResult = await wx.compressImage({
          src: avatarUrl,
          quality: 80
        })
        finalPath = compressResult.tempFilePath
      }
      
      // 上传到云存储
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).substring(2)}.jpg`
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: finalPath
      })
      
      // 更新用户信息
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_user_profile',
          avatarUrl: uploadResult.fileID
        }
      })
      
      if (result.result && result.result.success) {
        const app = getApp<IAppOption>()
        app.globalData.userInfo.avatarUrl = uploadResult.fileID
        wx.setStorageSync('userInfo', app.globalData.userInfo)
        
        this.setData({
          'userInfo.avatarUrl': uploadResult.fileID
        })
        
        wx.hideLoading()
        wx.showToast({ title: '头像更新成功', icon: 'success' })
      }
    } catch (error) {
      console.error('头像上传失败:', error)
      wx.hideLoading()
      wx.showToast({ title: '头像更新失败', icon: 'none' })
    }
  },

  /**
   * 新建报销申请
   */
  createReimbursement() {
    const today = new Date().toISOString().split('T')[0]
    this.setData({
      showReimbursementDialog: true,
      reimbursementForm: {
        typeIndex: 0,
        amount: '',
        date: today,
        description: '',
        vouchers: []
      }
    })
  },

  /**
   * 关闭报销弹窗
   */
  closeReimbursementDialog() {
    this.setData({
      showReimbursementDialog: false
    })
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 阻止点击弹窗内容时关闭弹窗
  },

  /**
   * 提交报销申请
   */
  async submitReimbursement() {
    const { typeIndex, amount, date, description, vouchers } = this.data.reimbursementForm
    const reimbursementType = REIMBURSEMENT_TYPES[typeIndex]
    
    // 验证表单
    if (!amount || parseFloat(amount) <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    
    if (!description || !description.trim()) {
      wx.showToast({ title: '请填写报销说明', icon: 'none' })
      return
    }
    
    try {
      wx.showLoading({ title: '提交中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'finance-management',
        data: {
          action: 'create_reimbursement',
          data: {
            amount: parseFloat(amount),
            description: description.trim(),
            date: date,
            reimbursementType: reimbursementType.code,
            vouchers: vouchers
          }
        }
      })
      
      if (result.result && result.result.success) {
        this.setData({
          showReimbursementDialog: false
        })
        
        // 刷新数据
        await this.loadReimbursementStats()
        
        wx.hideLoading()
        wx.showToast({ title: '报销申请已提交', icon: 'success' })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  },

  /**
   * 查看所有报销记录
   */
  viewAllReimbursements() {
    wx.navigateTo({
      url: '/packageFinance/reimbursement-list/reimbursement-list'
    })
  },

  /**
   * 导航到功能页面
   */
  navigateToFunction(e: any) {
    const { page, action } = e.currentTarget.dataset
    
    if (page) {
      wx.navigateTo({
        url: page,
        fail: () => {
          wx.showToast({ title: '功能开发中', icon: 'none' })
        }
      })
    } else if (action) {
      this.handleAction(action)
    }
  },

  /**
   * 处理系统设置
   */
  handleSystemSetting(e: any) {
    const { action } = e.currentTarget.dataset
    this.handleAction(action)
  },

  /**
   * 处理操作
   */
  handleAction(action: string) {
    switch (action) {
      case 'notification':
        wx.showToast({ title: '消息通知功能开发中', icon: 'none' })
        break
      case 'help':
        wx.showModal({
          title: '帮助中心',
          content: '如有问题，请联系管理员',
          showCancel: false
        })
        break
      case 'privacy':
        wx.showToast({ title: '隐私设置功能开发中', icon: 'none' })
        break
      case 'notification-settings':
        wx.showToast({ title: '通知设置功能开发中', icon: 'none' })
        break
      case 'about':
        wx.showModal({
          title: '关于鹅数通',
          content: '鹅数通 v1.1.0\n\n智慧养殖管理小程序',
          showCancel: false
        })
        break
      case 'export':
        wx.showToast({ title: '数据导出功能开发中', icon: 'none' })
        break
      default:
        wx.showToast({ title: '功能开发中', icon: 'none' })
    }
  },

  /**
   * 退出登录
   */
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          const app = getApp<IAppOption>()
          app.globalData.openid = undefined
          app.globalData.isLoggedIn = false
          app.globalData.userInfo = undefined
          
          wx.removeStorageSync('openid')
          wx.removeStorageSync('userInfo')
          
          wx.reLaunch({
            url: '/packageUser/login/login'
          })
        }
      }
    })
  },

  /**
   * 表单输入处理
   */
  onReimbursementTypeChange(e: any) {
    this.setData({
      'reimbursementForm.typeIndex': e.detail.value
    })
  },

  onAmountInput(e: any) {
    this.setData({
      'reimbursementForm.amount': e.detail.value
    })
  },

  onDateChange(e: any) {
    this.setData({
      'reimbursementForm.date': e.detail.value
    })
  },

  onDescriptionInput(e: any) {
    this.setData({
      'reimbursementForm.description': e.detail.value
    })
  },

  /**
   * 选择凭证图片
   */
  async chooseVoucher() {
    try {
      const res = await wx.chooseImage({
        count: 5 - this.data.reimbursementForm.vouchers.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      
      const vouchers = this.data.reimbursementForm.vouchers
      const newVouchers = res.tempFilePaths.map(path => ({
        tempPath: path,
        fileId: '',
        fileName: `凭证${vouchers.length + 1}.jpg`,
        fileType: 'image'
      }))
      
      this.setData({
        'reimbursementForm.vouchers': [...vouchers, ...newVouchers]
      })
    } catch (error) {
      // 用户取消选择
    }
  },

  /**
   * 移除凭证
   */
  removeVoucher(e: any) {
    const { index } = e.currentTarget.dataset
    const vouchers = this.data.reimbursementForm.vouchers
    vouchers.splice(index, 1)
    this.setData({
      'reimbursementForm.vouchers': vouchers
    })
  },

  /**
   * 切换管理员角色（开发调试用）
   */
  toggleAdminRole() {
    const newIsAdmin = !this.data.isAdmin
    this.setData({
      isAdmin: newIsAdmin
    })
    
    wx.showToast({
      title: newIsAdmin ? '已切换到管理员模式' : '已切换到普通用户模式',
      icon: 'success',
      duration: 1500
    })
  },

  /**
   * 获取角色显示名称
   */
  getRoleDisplayName(role: string): string {
    const roleNames: Record<string, string> = {
      'super_admin': '超级管理员',
      'manager': '经理',
      'employee': '员工',
      'veterinarian': '兽医'
    }
    return roleNames[role] || '用户'
  }
}

Page(createPageWithNavbar(pageConfig))


