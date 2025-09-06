// pages/login/login.ts

interface UserInfo {
  _id: string;
  openid: string;
  nickname: string;
  avatarUrl: string;
  phone: string;
  farmName: string;
  gender?: number;
  // 角色和权限字段
  role: string;
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

  // 初始化云开发环境
  async initCloudEnvironment() {
    try {
      // 确保云开发已初始化
      if (!wx.cloud) {
        console.log('云开发未初始化，正在初始化...')
        wx.cloud.init({
          env: 'your-env-id', // 这里需要替换为你的云开发环境ID
          traceUser: true
        })
      }
    } catch (error) {
      console.error('云开发初始化失败:', error)
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
        console.log('从本地存储恢复登录状态')
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
          userInfo: userInfo as any,
          nickname: userInfo.nickname || '',
          phone: userInfo.phone || '',
          farmName: userInfo.farmName || ''
        })

        // 更新全局数据
        const app = getApp()
        app.globalData.userInfo = userInfo

        // 持久化到本地存储
        wx.setStorageSync('userInfo', userInfo)
        
        console.log('用户信息已更新:', userInfo)
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
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

      console.log('检查用户是否已注册...')

          // 首先检查用户是否存在
          const checkResult = await wx.cloud.callFunction({
            name: 'login',
            data: {
              checkOnly: true
            }
          })

          console.log('checkOnly 云函数返回结果:', checkResult)
          console.log('checkResult.result:', checkResult.result)

          if (!checkResult.result?.success) {
            // 如果云函数调用失败
            wx.hideLoading()
            this.setData({ isLoading: false })
            
            wx.showModal({
              title: '登录检查失败',
              content: `云函数调用出错：${checkResult.result?.error || '未知错误'}\n\n调试信息：${JSON.stringify(checkResult.result?.debug, null, 2)}`,
              showCancel: false,
              confirmText: '确定'
            })
            return
          }

          if (!checkResult.result?.exists) {
        // 用户不存在，提示注册
        wx.hideLoading()
        this.setData({ isLoading: false })
        
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

      wx.showLoading({
        title: '登录中...',
        mask: true
      })

      console.log('用户已注册，开始登录...')

      // 用户存在，执行登录
      const result = await wx.cloud.callFunction({
        name: 'login',
        data: {}
      })

      console.log('云函数调用结果:', result)
      console.log('云函数返回的result对象:', JSON.stringify(result.result, null, 2))
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

        console.log('登录成功，用户信息:', result.result.user)

        // 直接跳转到首页，不显示中间页面和Toast
        wx.reLaunch({
          url: '/pages/index/index'
        })
      } else {
        console.error('云函数返回失败:', result)
        console.error('完整的result结构:', JSON.stringify(result, null, 2))
        console.error('result.result的类型:', typeof result.result)
        console.error('result.result是否为null:', result.result === null)
        console.error('result.result是否为undefined:', result.result === undefined)
        
        wx.showToast({
          title: result.result?.message || '登录失败',
          icon: 'error'
        })
      }
    } catch (error: any) {
      console.error('登录失败详细错误:', error)
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

      console.log('开始测试云开发环境...')
      
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
      
      console.log('云环境测试成功:', testResult)
    } catch (error: any) {
      wx.hideLoading()
      console.error('云环境测试失败:', error)
      
      wx.showModal({
        title: '云环境测试失败',
        content: `错误码：${error.errCode}\n错误信息：${error.errMsg}\n\n可能原因：\n1. 云函数未部署或部署失败\n2. 云开发环境ID配置错误\n3. 网络连接问题`,
        showCancel: false,
        confirmText: '确定'
      })
    }
  },


  // 输入框事件
  onNicknameInput(e: any) {
    this.setData({
      nickname: e.detail.value
    })
  },

  onPhoneInput(e: any) {
    this.setData({
      phone: e.detail.value
    })
  },

  onFarmNameInput(e: any) {
    this.setData({
      farmName: e.detail.value
    })
  },

  // 选择头像
  async onChooseAvatar(e: any) {
    const { avatarUrl } = e.detail
    this.setData({
      selectedAvatarUrl: avatarUrl
    })
    
    wx.showToast({
      title: '头像已选择',
      icon: 'success'
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

      const result = await wx.cloud.callFunction({
        name: 'register',
        data: {
          nickname: nickname.trim(),
          phone: phone.trim(),
          farmName: farmName.trim(),
          avatarUrl: selectedAvatarUrl || ''
        }
      })

      wx.hideLoading()

      if (result.result && result.result.success) {
        const updatedUserInfo = result.result.user
        
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
        setTimeout(() => {
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
      console.error('保存用户信息失败:', error)
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
    console.log('显示邀请码注册弹窗')
    this.setData({
      showInviteDialog: true,
      inviteCode: '',
      inviteNickname: '',
      invitePhone: '',
      inviteCodeFocus: true
    })
    console.log('弹窗状态已设置:', this.data.showInviteDialog)
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
    console.log('输入框获得焦点')
  },

  // 邀请码输入
  onInviteCodeInput(e: any) {
    this.setData({
      inviteCode: e.detail.value.toUpperCase()
    })
  },

  // 姓名输入
  onInviteNicknameInput(e: any) {
    this.setData({
      inviteNickname: e.detail.value
    })
  },

  // 手机号输入
  onInvitePhoneInput(e: any) {
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
      console.error('邀请码注册失败:', error)
      
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
