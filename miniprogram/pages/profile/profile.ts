// profile.ts - 个人中心页面逻辑
import { logger } from '../../utils/logger'
// 类型定义 - 用于替换any类型
type CustomEvent<T = any> = WechatMiniprogram.CustomEvent<T>;
type BaseEvent = WechatMiniprogram.BaseEvent;
interface ErrorWithMessage {
  message: string;
  [key: string]: any;
}

import { createSetDataWrapper } from './helpers/setdata-wrapper'
import type { 
  ExtendedUserInfo,
  AppInstance,
  CustomEvent,
  InputEvent,
  GlobalData,
  ErrorResponse
} from './types'

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
  { id: 2, label: '邀请管理', page: '/packageUser/invite-management/invite-management' },
  { id: 3, label: '财务管理', page: '/packageFinance/finance/finance' },
  { id: 4, label: '鹅价管理', page: '/packageUser/price-management/price-management' },
  { id: 5, label: '文章管理', page: '/packageUser/knowledge-management/knowledge-management' },
  { id: 6, label: '任务管理', page: '/packageUser/lifecycle-management/lifecycle-management' }
]

// 系统设置配置
const SYSTEM_SETTINGS = [
  { id: 1, label: '隐私设置', action: 'privacy' },
  { id: 2, label: '通知设置', action: 'notification-settings' },
  { id: 3, label: '关于我们', action: 'about' },
  { id: 4, label: '帮助中心', action: 'help' }
]

Page({
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
    showEditUserDialog: false,
    
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
    
    // 编辑用户信息表单
    editUserForm: {
      nickName: '',
      phone: '',
      farmName: ''
    },
    
    // 加载状态
    loading: false
  },

  onLoad() {
    // 🔧 关键修复：先保存原始setData，再创建包装器
    const originalSetData = this.setData.bind(this)
    
    // 创建SetData包装器，传入原始setData
    const setDataWrapper = createSetDataWrapper({
      ...this,
      setData: originalSetData
    })
    
    // 替换 setData 方法
    this.setData = (data: unknown, callback?: () => void, urgent?: boolean) => {
      setDataWrapper.setData(data, callback, urgent)
    }
    
    // 原来的初始化逻辑
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
      logger.error('页面初始化失败:', error)
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
      logger.error('刷新数据失败:', error)
    }
  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      const app = getApp() as AppInstance
      const userInfo = app.globalData?.userInfo || wx.getStorageSync('userInfo') as ExtendedUserInfo
      
      if (!userInfo) {
        throw new Error('未登录')
      }
      
      // 计算工龄
      const joinDate = userInfo?.createTime ? new Date(userInfo.createTime as string) : new Date()
      const now = new Date()
      const years = now.getFullYear() - joinDate.getFullYear()
      const months = now.getMonth() - joinDate.getMonth()
      const totalMonths = years * 12 + months
      const workYears = totalMonths >= 12 
        ? `${Math.floor(totalMonths / 12)}年${totalMonths % 12}个月`
        : `${totalMonths}个月`
      
      // 判断是否是管理员
      const isAdmin = ['admin', 'manager', 'super_admin'].includes(userInfo.role || '')
      
      // 获取角色显示名称
      const roleDisplayName = this.getRoleDisplayName(userInfo.role || 'user')
      
      // 使用路径更新优化 setData 性能
      this.setData({
        'userInfo.name': userInfo.nickname || userInfo.nickName || '未设置',
        'userInfo.role': roleDisplayName,
        'userInfo.farm': userInfo.farmName || userInfo.department || '智慧养殖场',
        'userInfo.phone': userInfo.phone || '',
        'userInfo.avatarUrl': userInfo.avatarUrl,
        'userInfo.workYears': workYears,
        'userInfo.joinDate': joinDate.toLocaleDateString(),
        isAdmin: isAdmin,
        adminFunctions: isAdmin ? ADMIN_FUNCTIONS : [],
        showAdminSection: userInfo.role === 'super_admin'
      })
    } catch (error) {
      logger.error('加载用户信息失败:', error)
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
      logger.error('加载报销统计失败:', error)
    }
  },

  /**
   * 选择头像
   */
  async onChooseAvatar(e: CustomEvent) {
    const { avatarUrl } = e.detail
    
    if (!avatarUrl) {
      wx.showToast({ title: '头像获取失败', icon: 'none' })
      return
    }
    
    try {
      wx.showLoading({ title: '上传中...' })
      
      // 获取图片信息，检查文件大小
      // const imageInfo = await wx.getImageInfo({ src: avatarUrl })
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
        if (app.globalData && app.globalData.userInfo) {
          app.globalData.userInfo.avatarUrl = uploadResult.fileID
          wx.setStorageSync('userInfo', app.globalData.userInfo)
        }
        
        this.setData({
          'userInfo.avatarUrl': uploadResult.fileID
        })
        
        wx.hideLoading()
        wx.showToast({ title: '头像更新成功', icon: 'success' })
      }
    } catch (error) {
      logger.error('头像上传失败:', error)
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
        detail: '',
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
  navigateToFunction(e: CustomEvent) {
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
  handleSystemSetting(e: CustomEvent) {
    const { action } = e.currentTarget.dataset
    this.handleAction(action)
  },

  /**
   * 处理操作
   */
  handleAction(action: string) {
    switch (action) {
      case 'privacy':
        wx.navigateTo({
          url: '/packageUser/privacy-settings/privacy-settings',
          fail: () => {
            wx.showToast({ title: '页面跳转失败', icon: 'none' })
          }
        })
        break
      case 'notification-settings':
        wx.navigateTo({
          url: '/packageUser/notification-settings/notification-settings',
          fail: () => {
            wx.showToast({ title: '页面跳转失败', icon: 'none' })
          }
        })
        break
      case 'about':
        wx.navigateTo({
          url: '/packageUser/about/about',
          fail: () => {
            wx.showToast({ title: '页面跳转失败', icon: 'none' })
          }
        })
        break
      case 'help':
        wx.navigateTo({
          url: '/packageUser/help/help',
          fail: () => {
            wx.showToast({ title: '页面跳转失败', icon: 'none' })
          }
        })
        break
      case 'notification':
        wx.showToast({ title: '消息通知功能开发中', icon: 'none' })
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
          const app = getApp() as AppInstance
          const globalData = (app.globalData || {}) as GlobalData
          globalData.openid = undefined
          globalData.isLoggedIn = false
          globalData.userInfo = undefined
          
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
  onReimbursementTypeChange(e: CustomEvent) {
    this.setData({
      'reimbursementForm.typeIndex': e.detail.value
    })
  },

  onAmountInput(e: CustomEvent) {
    this.setData({
      'reimbursementForm.amount': e.detail.value
    })
  },

  onDateChange(e: CustomEvent) {
    this.setData({
      'reimbursementForm.date': e.detail.value
    })
  },

  onDescriptionInput(e: InputEvent) {
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
  removeVoucher(e: CustomEvent) {
    const { index } = e.currentTarget.dataset
    const vouchers = this.data.reimbursementForm.vouchers
    vouchers.splice(index, 1)
    this.setData({
      'reimbursementForm.vouchers': vouchers
    })
  },

  /**
   * 获取角色显示名称
   */
  getRoleDisplayName(role: string): string {
    const roleNames: Record<string, string> = {
      'super_admin': '超级管理员',
      'admin': '管理员',
      'manager': '经理',
      'employee': '员工',
      'veterinarian': '兽医',
      'user': '普通用户'
    }
    return roleNames[role] || '用户'
  },

  /**
   * 打开编辑用户信息弹窗
   */
  editUserInfo() {
    const { userInfo } = this.data
    this.setData({
      showEditUserDialog: true,
      editUserForm: {
        nickName: userInfo.name || '',
        phone: userInfo.phone || '',
        farmName: userInfo.farm || ''
      }
    })
  },

  /**
   * 关闭编辑用户信息弹窗
   */
  closeEditUserDialog() {
    this.setData({
      showEditUserDialog: false
    })
  },


  /**
   * 编辑用户信息表单输入处理
   */
  onNickNameInput(e: CustomEvent) {
    this.setData({
      'editUserForm.nickName': e.detail.value
    })
  },

  onPhoneInput(e: CustomEvent) {
    this.setData({
      'editUserForm.phone': e.detail.value
    })
  },

  onFarmNameInput(e: CustomEvent) {
    this.setData({
      'editUserForm.farmName': e.detail.value
    })
  },

  /**
   * 提交更新用户信息
   */
  async submitEditUserInfo() {
    const { nickName, phone, farmName } = this.data.editUserForm
    
    // 验证表单
    if (!nickName || !nickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    
    if (!phone || !phone.trim()) {
      wx.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    
    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phone.trim())) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    
    if (!farmName || !farmName.trim()) {
      wx.showToast({ title: '请输入养殖场名称', icon: 'none' })
      return
    }
    
    try {
      wx.showLoading({ title: '更新中...' })
      
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_user_profile',
          nickName: nickName.trim(),
          phone: phone.trim(),
          farmName: farmName.trim()
        }
      })
      
      if (result.result && result.result.success) {
        // 更新本地用户信息
        const app = getApp() as AppInstance
        const userInfo = (app.globalData?.userInfo || {}) as ExtendedUserInfo
        userInfo.nickName = nickName
        userInfo.nickname = nickName
        userInfo.phone = phone
        userInfo.farmName = farmName
        userInfo.department = farmName
        wx.setStorageSync('userInfo', userInfo)
        
        // 更新页面显示
        await this.loadUserInfo()
        
        this.setData({
          showEditUserDialog: false
        })
        
        wx.hideLoading()
        wx.showToast({ title: '更新成功', icon: 'success' })
      } else {
        throw new Error(result.result?.message || '更新失败')
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ 
        title: (error as ErrorResponse).message || '更新失败', 
        icon: 'none' 
      })
    }
  }
})


