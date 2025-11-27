// pages/login/login.ts

import { logger } from '../../utils/logger'
interface UserInfo {
  _id: string;
  openid: string;
  nickname: string;
  avatarUrl: string;
  phone: string;
  farmName: string;
  gender?: number;
  // 角色和权限字段 - 使用新的4角色体系
  role: string; // super_admin | manager | employee | veterinarian
  permissions: string[];
  department: string;
  position: string;
  managedBy?: string;
  organizationId?: string;
  // 时间字段
  createTime: Date;
  updateTime?: Date;
  lastLoginTime: Date;
  loginCount: number;
  isActive: boolean;
}

interface LoginPageData {
  isLoggedIn: boolean;
  isLoading: boolean;
  userInfo: UserInfo | null;
  nickname: string;
  phone: string;
  farmName: string;
  selectedAvatarUrl: string;
  statusBarHeight: number;
  navBarHeight: number;
  // 邀请码注册相关
  showInviteDialog: boolean;
  inviteCode: string;
  inviteNickname: string;
  invitePhone: string;
  inviteCodeFocus: boolean;
}

Page({
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
    isLoggedIn: false,
    isLoading: false,
    userInfo: null,
    nickname: '',
    phone: '',
    farmName: '',
    selectedAvatarUrl: '',
    statusBarHeight: 44,
    navBarHeight: 88,
    // 邀请码注册相关
    showInviteDialog: false,
    inviteCode: '',
    inviteNickname: '',
    invitePhone: '',
    inviteCodeFocus: false,
  },

  onLoad() {
    // 获取全局状态栏高度
    const app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 44,
      navBarHeight: app.globalData.navBarHeight || 88,
    })

    // 初始化云开发环境
    this.initCloudEnvironment()
    
    // 检查登录状态
    this.checkLoginStatus()
  },

  onUnload() {
    this._clearAllTimers()
  },

  // 初始化云开发环境
  async initCloudEnvironment() {
    try {
      // 确保云开发已初始化
      if (!wx.cloud) {
        wx.cloud.init({
          env: 'your-env-id', // 这里需要替换为你的云开发环境ID
          traceUser: true
        })
      }
    } catch (error) {
      // 云开发初始化失败处理
    }
  },

  onShow() {
    // 页面显示时重新检查登录状态
    this.checkLoginStatus()
  },

  // 检查登录状态
  async checkLoginStatus() {
    const app = getApp()
    let isLoggedIn = app.globalData.isLoggedIn || false
    let openid = app.globalData.openid

    // 如果应用全局状态中没有登录信息，尝试从本地存储恢复
    if (!isLoggedIn || !openid) {
      const storedOpenid = wx.getStorageSync('openid')
      const storedUserInfo = wx.getStorageSync('userInfo')
      
      if (storedOpenid && storedUserInfo) {
        app.globalData.openid = storedOpenid
        app.globalData.isLoggedIn = true
        app.globalData.userInfo = storedUserInfo
        
        isLoggedIn = true
        openid = storedOpenid
        
        this.setData({
          userInfo: storedUserInfo,
          nickname: storedUserInfo.nickname || '',
          phone: storedUserInfo.phone || '',
          farmName: storedUserInfo.farmName || ''
        })
      }
    }

    this.setData({
      isLoggedIn: isLoggedIn
    })

    if (isLoggedIn && openid) {
      // 如果已登录，获取最新用户信息
      await this.getUserInfo()
    }
  },

  // 获取用户信息
  async getUserInfo() {
    try {
      const db = wx.cloud.database()
      const result = await db.collection('users').where({
        _openid: wx.cloud.database().command.exists(true)
      }).get()

      if (result.data.length > 0) {
        const userInfo = result.data[0] as UserInfo
        
        // 更新页面数据
        this.setData({
          userInfo: userInfo as unknown,
          nickname: userInfo.nickname || '',
          phone: userInfo.phone || '',
          farmName: userInfo.farmName || ''
        })

        // 更新全局数据
        const app = getApp()
        app.globalData.userInfo = userInfo

        // 持久化到本地存储
        wx.setStorageSync('userInfo', userInfo)
        
      }
    } catch (error) {
      // 获取用户信息失败处理
    }
  },

  // 微信登录
  async onWeChatLogin() {
    if (this.data.isLoading) return

    this.setData({ isLoading: true })

    try {
      // 首先检查云开发是否正确初始化
      if (!wx.cloud) {
        wx.showToast({
          title: '云开发未初始化',
          icon: 'error'
        })
        this.setData({ isLoading: false })
        return
      }

      wx.showLoading({
        title: '检查用户状态...',
        mask: true
      })

      try {
        // 首先检查用户是否存在
        const checkResult = await wx.cloud.callFunction({
          name: 'login',
          data: {
            checkOnly: true
          }
        })

        if (!checkResult.result?.success) {
          // 如果云函数调用失败
          wx.hideLoading()
          this.setData({ isLoading: false })
          
          wx.showModal({
            title: '登录检查失败',
            content: `云函数调用出错：${checkResult.result?.error || '未知错误'}\n\n请检查：\n1. 网络连接是否正常\n2. 云函数是否正确部署`,
            showCancel: false,
            confirmText: '确定'
          })
          return
        }

        if (!checkResult.result?.exists) {
          // 用户不存在，检查是否是第一个用户
          wx.hideLoading()
          this.setData({ isLoading: false })
          
          // 检查数据库中是否还没有任何用户（第一个用户）
          try {
            const result = await wx.cloud.callFunction({
              name: 'login',
              data: {} // 直接尝试创建用户
            })
            
            if (result.result && result.result.success) {
              const app = getApp()
              app.globalData.openid = result.result.openid
              app.globalData.isLoggedIn = true
              app.globalData.userInfo = result.result.user
              
              wx.setStorageSync('openid', result.result.openid)
              wx.setStorageSync('userInfo', result.result.user)
              
              // 如果是第一个管理员，显示特殊欢迎信息
              if (result.result.isFirstAdmin) {
                wx.showModal({
                  title: '🎉 超级管理员',
                  content: result.result.message + '\n\n您现在拥有系统的所有管理权限！',
                  showCancel: false,
                  confirmText: '开始使用',
                  success: () => {
                    wx.reLaunch({
                      url: '/pages/index/index'
                    })
                  }
                })
              } else {
                wx.reLaunch({
                  url: '/pages/index/index'
                })
              }
              return
            }
          } catch (createError) {
            // 不是第一个用户，需要邀请码注册
          }
          
          // 不是第一个用户，需要邀请码注册
          wx.showModal({
            title: '用户未注册',
            content: '检测到您尚未注册，请使用邀请码进行注册',
            confirmText: '去注册',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                this.showInviteRegister()
              }
            }
          })
          return
        }

        // 用户存在，隐藏第一个loading，显示登录loading
        wx.hideLoading()
        wx.showLoading({
          title: '登录中...',
          mask: true
        })
      } catch (error) {
        // 检查用户状态失败
        wx.hideLoading()
        this.setData({ isLoading: false })
        throw error
      }

      // 用户存在，执行登录
      const result = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      })

      wx.hideLoading()

      if (result.result && result.result.success) {
        const app = getApp()
        app.globalData.openid = result.result.openid
        app.globalData.isLoggedIn = true

        // 更新全局数据
        app.globalData.userInfo = result.result.user

        // 保存到本地存储
        wx.setStorageSync('openid', result.result.openid)
        wx.setStorageSync('userInfo', result.result.user)

        // 特殊处理第一个用户（超级管理员）
        if (result.result.isFirstAdmin) {
          wx.showModal({
            title: '🎉 超级管理员',
            content: result.result.message + '\n\n您现在拥有系统的所有管理权限，包括：\n• 员工管理和邀请\n• 财务审批\n• 系统设置\n• 生产和健康数据管理',
            showCancel: false,
            confirmText: '开始使用',
            success: () => {
              wx.reLaunch({
                url: '/pages/index/index'
              })
            }
          })
        } else {
          // 其他用户检查信息是否完整
          if (result.result.canUseApp) {
            const userInfo = result.result.user
            
            // 更严格的信息完整性检查 - 兼容多种字段名称
            const nickname = userInfo.nickname || userInfo.nickName || ''
            const farmName = userInfo.farmName || userInfo.department || ''
            const phone = userInfo.phone || ''
            
            // 检查信息完整性
            const isInfoComplete = nickname && 
                                  nickname.trim() !== '' && 
                                  nickname !== '未设置' &&
                                  phone && 
                                  phone.trim() !== '' &&
                                  farmName && 
                                  farmName.trim() !== '' && 
                                  farmName !== '智慧养殖场' &&
                                  farmName !== '未设置'
            
            // 检查用户是否已经完善过信息（永久标记）
            const profileCompleted = wx.getStorageSync('profileCompleted') || false
            
            // 检查用户是否已经跳过完善信息
            const hasSkippedInfo = wx.getStorageSync('hasSkippedProfileSetup') || false
            
            // 完善信息状态检查
            // 只有在信息不完整、没有永久完善标记、且用户没有跳过的情况下才提示
            if (!isInfoComplete && !profileCompleted && !hasSkippedInfo) {
              // 信息不完整且用户未跳过，提示用户完善
              wx.showModal({
                title: '完善个人信息',
                content: '为了更好的使用体验，请先完善您的个人信息（昵称、手机号、养殖场名称）',
                confirmText: '去完善',
                cancelText: '稍后再说',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    // 设置标记，表示用户需要完善信息
                    wx.setStorageSync('needProfileSetup', true)
                    // 跳转到个人中心（tabBar页面需要用switchTab）
                    wx.switchTab({
                      url: '/pages/profile/profile'
                    })
                  } else {
                    // 用户选择稍后再说，记录状态（24小时内不再提示）
                    const skipUntil = Date.now() + 24 * 60 * 60 * 1000 // 24小时后
                    wx.setStorageSync('hasSkippedProfileSetup', true)
                    wx.setStorageSync('skipProfileSetupUntil', skipUntil)
                    
                    // 直接进入首页
                    wx.reLaunch({
                      url: '/pages/index/index'
                    })
                  }
                }
              })
            } else {
              // 信息完整或用户已跳过，直接进入首页
              wx.reLaunch({
                url: '/pages/index/index'
              })
            }
          } else {
            // 处理需要审批或被拒绝的情况
            wx.showModal({
              title: '登录提示',
              content: result.result.message,
              showCancel: false,
              confirmText: '确定'
            })
          }
        }
      } else {
        
        wx.showToast({
          title: result.result?.message || '登录失败',
          icon: 'error'
        })
      }
    } catch (error: unknown) {
      wx.hideLoading()
      
      // 根据不同错误类型提供具体的错误信息
      let errorMessage = '登录失败，请重试'
      
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
      }
      
      wx.showModal({
        title: '登录失败',
        content: `错误详情：\n${errorMessage}\n\n请检查：\n1. 云函数是否正确部署\n2. 云开发环境是否正常\n3. 网络连接是否正常`,
        showCancel: false,
        confirmText: '我知道了'
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  // 测试云开发环境
  async testCloudEnv() {
    try {
      wx.showLoading({
        title: '测试云环境...',
        mask: true
      })

      // 测试云开发环境是否正常
      const testResult = await wx.cloud.callFunction({
        name: 'login',
        data: { test: true }
      })
      
      wx.hideLoading()
      
      wx.showModal({
        title: '云环境测试结果',
        content: `测试成功！\n云函数响应：${JSON.stringify(testResult.result, null, 2)}`,
        showCancel: false,
        confirmText: '确定'
      })
      
    } catch (error: unknown) {
      wx.hideLoading()
      
      wx.showModal({
        title: '云环境测试失败',
        content: `错误码：${error.errCode}\n错误信息：${error.errMsg}\n\n可能原因：\n1. 云函数未部署或部署失败\n2. 云开发环境ID配置错误\n3. 网络连接问题`,
        showCancel: false,
        confirmText: '确定'
      })
    }
  },
  // 输入框事件
  onNicknameInput(e: CustomEvent) {
    this.setData({
      nickname: e.detail.value
    })
  },

  onPhoneInput(e: CustomEvent) {
    this.setData({
      phone: e.detail.value
    })
  },

  onFarmNameInput(e: CustomEvent) {
    this.setData({
      farmName: e.detail.value
    })
  },

  // 选择头像
  async onChooseAvatar(e: CustomEvent) {
    const { avatarUrl } = e.detail
    this.setData({
      selectedAvatarUrl: avatarUrl
    })
    
    wx.showToast({
      title: '头像已选择',
      icon: 'success'
    })
  },

  // 获取微信昵称
  onNicknameChange(e: CustomEvent) {
    const nickname = e.detail.value
    this.setData({
      nickname: nickname
    })
  },

  // 保存用户信息
  async onSaveProfile() {
    const { nickname, phone, farmName, selectedAvatarUrl } = this.data

    if (!nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'error'
      })
      return
    }

    if (!phone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'error'
      })
      return
    }

    if (!farmName.trim()) {
      wx.showToast({
        title: '请输入养殖场名称',
        icon: 'error'
      })
      return
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'error'
      })
      return
    }

    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      })

      // 使用 user-management 云函数更新用户信息
      const result = await wx.cloud.callFunction({
        name: 'user-management',
        data: {
          action: 'update_profile',
          nickName: nickname.trim(),        // 修正字段名称：nickname → nickName
          phone: phone.trim(),
          farmName: farmName.trim(),
          avatarUrl: selectedAvatarUrl || ''
        }
      })

      wx.hideLoading()

      if (result.result && result.result.success) {
        const updatedUserInfo = result.result.data.user
        
        // 更新页面状态
        this.setData({
          userInfo: updatedUserInfo
        })

        // 更新全局数据
        const app = getApp()
        app.globalData.userInfo = updatedUserInfo

        // 持久化到本地存储
        wx.setStorageSync('userInfo', updatedUserInfo)

        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })

        // 延迟跳转到首页
        this._safeSetTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }, 1500)
      } else {
        wx.showToast({
          title: result.result?.message || '保存失败',
          icon: 'error'
        })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'error'
      })
    }
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出登录后需要重新登录才能使用完整功能',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清除登录状态
            const app = getApp()
            app.globalData.openid = undefined
            app.globalData.isLoggedIn = false
            app.globalData.userInfo = undefined

            // 清除本地存储
            wx.removeStorageSync('openid')
            wx.removeStorageSync('userInfo')

            // 重置页面状态
            this.setData({
              isLoggedIn: false,
              userInfo: null,
              nickname: '',
              phone: '',
              farmName: '',
              selectedAvatarUrl: ''
            })

            wx.showToast({
              title: '已退出登录',
              icon: 'success'
            })
          } catch (error) {
            // 捕获可能的异常（如微信开发者工具的内部错误）
            logger.warn('退出登录过程中出现警告（已忽略）:', error)
            
            // 即使出错，也确保显示成功提示
            wx.showToast({
              title: '已退出登录',
              icon: 'success'
            })
          }
        }
      }
    })
  },

  // 返回首页
  onBackHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    })
  },

  // 显示邀请码注册弹窗
  showInviteRegister() {
    this.setData({
      showInviteDialog: true,
      inviteCode: '',
      inviteNickname: '',
      invitePhone: '',
      inviteCodeFocus: true
    })
  },

  // 关闭邀请码注册弹窗
  closeInviteDialog() {
    this.setData({
      showInviteDialog: false,
      inviteCode: '',
      inviteNickname: '',
      invitePhone: '',
      inviteCodeFocus: false
    })
  },

  // 输入框聚焦处理
  onInputFocus() {
    // 输入框获得焦点处理
  },

  // 邀请码输入
  onInviteCodeInput(e: CustomEvent) {
    this.setData({
      inviteCode: e.detail.value.toUpperCase()
    })
  },

  // 姓名输入
  onInviteNicknameInput(e: CustomEvent) {
    this.setData({
      inviteNickname: e.detail.value
    })
  },

  // 手机号输入
  onInvitePhoneInput(e: CustomEvent) {
    this.setData({
      invitePhone: e.detail.value
    })
  },

  // 邀请码注册
  async onInviteRegister() {
    const { inviteCode, inviteNickname, invitePhone } = this.data

    // 验证输入
    if (!inviteCode.trim()) {
      wx.showToast({
        title: '请输入邀请码',
        icon: 'error'
      })
      return
    }

    if (!inviteNickname.trim()) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'error'
      })
      return
    }

    if (!invitePhone.trim()) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'error'
      })
      return
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(invitePhone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'error'
      })
      return
    }

    try {
      wx.showLoading({
        title: '注册中...',
        mask: true
      })

      // 调用云函数进行用户登录（创建用户记录）
      const cloudLoginResult = await wx.cloud.callFunction({
        name: 'login'
      })

      if (!cloudLoginResult.result?.success) {
        throw new Error('登录失败')
      }

      // 使用邀请码注册
      const registerResult = await wx.cloud.callFunction({
        name: 'register',
        data: {
          nickname: inviteNickname.trim(),
          avatarUrl: '', // 后续可以在个人中心设置
          phone: invitePhone.trim(),
          gender: 0, // 默认值
          farmName: '', // 邀请码注册时养殖场名称可能由邀请信息确定
          inviteCode: inviteCode.trim()
        }
      })

      wx.hideLoading()

      if (registerResult.result?.success) {
        // 更新全局状态
        const app = getApp()
        app.globalData.openid = cloudLoginResult.result.openid
        app.globalData.isLoggedIn = true
        app.globalData.userInfo = registerResult.result.user

        // 存储到本地
        wx.setStorageSync('openid', cloudLoginResult.result.openid)
        wx.setStorageSync('userInfo', registerResult.result.user)

        // 关闭弹窗
        this.setData({
          showInviteDialog: false,
          isLoggedIn: true,
          userInfo: registerResult.result.user
        })

        wx.showToast({
          title: '注册成功！',
          icon: 'success',
          duration: 2000
        })

        // 直接跳转到首页
        wx.reLaunch({
          url: '/pages/index/index'
        })

      } else {
        wx.showToast({
          title: registerResult.result?.message || '注册失败',
          icon: 'error'
        })
      }

    } catch (error) {
      wx.hideLoading()
      
      let errorMessage = '注册失败，请重试'
      if (error.message) {
        errorMessage = error.message
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'error'
      })
    }
  }
})
