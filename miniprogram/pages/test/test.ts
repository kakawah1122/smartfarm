// pages/test/test.ts
import { createPageWithNavbar } from '../../utils/navigation'
import { PermissionManager } from '../../utils/permission'

const pageConfig = {
  data: {
    // 测试状态
    testing: false,
    testResults: [] as any[],
    
    // 当前用户信息
    currentUser: null,
    isLoggedIn: false,
    
    // 测试步骤
    testSteps: [
      { id: 1, name: '清除测试数据', status: 'pending', result: '' },
      { id: 2, name: '管理员注册测试', status: 'pending', result: '' },
      { id: 3, name: '生成邀请码测试', status: 'pending', result: '' },
      { id: 4, name: '员工加入测试', status: 'pending', result: '' },
      { id: 5, name: '权限验证测试', status: 'pending', result: '' }
    ],
    
    // 测试数据
    testInviteCode: '',
    confirmKey: 'CLEAR_TEST_DATA_2024',
    
    // 简化邀请码存储（页面级别）
    localInvites: [] as any[]
  },

  onLoad() {
    this.checkLoginStatus()
  },

  onShow() {
    this.checkLoginStatus()
  },

  // 检查登录状态
  checkLoginStatus() {
    const app = getApp()
    const isLoggedIn = app.globalData.isLoggedIn || false
    const userInfo = app.globalData.userInfo
    
    this.setData({
      isLoggedIn: isLoggedIn,
      currentUser: userInfo || null
    })
  },

  // 开始完整测试流程
  async startFullTest() {
    this.setData({ testing: true })
    
    const steps = [...this.data.testSteps]
    
    try {
      // 步骤1: 清除测试数据
      await this.runTestStep(1, '清除测试数据', async () => {
        return await this.clearTestData()
      })
      
      // 步骤2: 提示重新登录
      await this.runTestStep(2, '管理员注册测试', async () => {
        return {
          success: true,
          message: '请退出当前登录，重新登录以成为管理员'
        }
      })
      
      wx.showModal({
        title: '测试进行中',
        content: '数据已清除，请退出当前登录并重新登录以成为管理员，然后继续测试',
        showCancel: false,
        confirmText: '我知道了'
      })
      
    } catch (error) {
      console.error('测试流程出错:', error)
      wx.showToast({
        title: '测试失败',
        icon: 'error'
      })
    } finally {
      this.setData({ testing: false })
    }
  },

  // 执行测试步骤
  async runTestStep(stepId: number, stepName: string, testFunction: Function) {
    this.updateTestStep(stepId, 'running', '执行中...')
    
    try {
      const result = await testFunction()
      
      if (result.success) {
        this.updateTestStep(stepId, 'success', result.message || '成功')
      } else {
        this.updateTestStep(stepId, 'failed', result.message || '失败')
      }
      
      return result
    } catch (error) {
      console.error(`测试步骤 ${stepName} 出错:`, error)
      this.updateTestStep(stepId, 'failed', error.message || '执行出错')
      throw error
    }
  },

  // 更新测试步骤状态
  updateTestStep(stepId: number, status: string, result: string) {
    const steps = this.data.testSteps.map(step => {
      if (step.id === stepId) {
        return { ...step, status, result }
      }
      return step
    })
    
    this.setData({ testSteps: steps })
  },

  // 清除测试数据
  async clearTestData() {
    try {
      // 尝试使用云函数清除（如果已部署）
      try {
        const result = await wx.cloud.callFunction({
          name: 'clearTestData',
          data: {
            action: 'clearAll',
            confirmKey: this.data.confirmKey
          }
        })
        
        if (result.result?.success) {
          // 清除本地存储
          this.clearLocalData()
          
          return {
            success: true,
            message: `数据清除成功: ${result.result.details?.cleared?.join(', ')}`
          }
        } else {
          return {
            success: false,
            message: result.result?.message || '清除失败'
          }
        }
      } catch (cloudError) {
        console.log('云函数clearTestData未部署，使用直接清除方法')
        
        // 如果云函数不存在，使用直接数据库操作
        return await this.clearDataDirectly()
      }
    } catch (error) {
      console.error('清除数据失败:', error)
      return {
        success: false,
        message: `清除数据失败: ${error.message}`
      }
    }
  },

  // 直接清除数据（不依赖云函数）
  async clearDataDirectly() {
    try {
      const db = wx.cloud.database()
      let clearedCount = 0
      let errors = []
      
      // 清除users集合
      try {
        const usersResult = await db.collection('users').get()
        for (const user of usersResult.data) {
          try {
            await db.collection('users').doc(user._id).remove()
            clearedCount++
          } catch (deleteError) {
            console.error('删除用户失败:', deleteError)
          }
        }
      } catch (getUsersError) {
        if (!getUsersError.message?.includes('collection not exists')) {
          errors.push('获取用户列表失败')
        }
      }
      
      // 清除employee_invites集合
      try {
        const invitesResult = await db.collection('employee_invites').get()
        for (const invite of invitesResult.data) {
          try {
            await db.collection('employee_invites').doc(invite._id).remove()
            clearedCount++
          } catch (deleteError) {
            console.error('删除邀请失败:', deleteError)
          }
        }
      } catch (getInvitesError) {
        if (!getInvitesError.message?.includes('collection not exists')) {
          errors.push('获取邀请列表失败')
        }
      }
      
      // 清除本地存储
      this.clearLocalData()
      
      return {
        success: true,
        message: `直接清除成功: 删除了 ${clearedCount} 条记录${errors.length > 0 ? '，部分操作失败' : ''}`
      }
    } catch (error) {
      console.error('直接清除数据失败:', error)
      return {
        success: false,
        message: `直接清除失败: ${error.message}`
      }
    }
  },

  // 清除本地数据
  clearLocalData() {
    // 清除本地存储
    wx.removeStorageSync('openid')
    wx.removeStorageSync('userInfo')
    
    // 清除全局状态
    const app = getApp()
    app.globalData.openid = null
    app.globalData.isLoggedIn = false
    app.globalData.userInfo = null
  },

  // 测试管理员权限
  async testAdminPermissions() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'error'
      })
      return
    }
    
    this.setData({ testing: true })
    
    try {
      const userInfo = this.data.currentUser
      
      // 检查是否是管理员
      const isAdmin = PermissionManager.isAdmin(userInfo)
      const hasAllPermissions = PermissionManager.hasPermission(userInfo, 'all')
      const hasEmployeeManage = PermissionManager.hasPermission(userInfo, 'employee.manage')
      
      let result = `管理员权限测试结果:\n`
      result += `- 是否为管理员: ${isAdmin ? '✅' : '❌'}\n`
      result += `- 是否有所有权限: ${hasAllPermissions ? '✅' : '❌'}\n`
      result += `- 是否有员工管理权限: ${hasEmployeeManage ? '✅' : '❌'}\n`
      result += `- 角色: ${userInfo?.role || '未知'}\n`
      result += `- 权限列表: ${userInfo?.permissions?.join(', ') || '无'}`
      
      wx.showModal({
        title: '管理员权限测试',
        content: result,
        showCancel: false
      })
      
    } catch (error) {
      console.error('权限测试失败:', error)
      wx.showToast({
        title: '测试失败',
        icon: 'error'
      })
    } finally {
      this.setData({ testing: false })
    }
  },

  // 测试生成邀请码
  async testGenerateInvite() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'error'
      })
      return
    }
    
    this.setData({ testing: true })
    
    try {
      // 先检查用户权限
      const userInfo = this.data.currentUser
      console.log('当前用户信息:', userInfo)
      console.log('用户权限:', userInfo?.permissions)
      console.log('用户角色:', userInfo?.role)
      
      wx.showLoading({
        title: '生成邀请码...',
        mask: true
      })
      
      const result = await wx.cloud.callFunction({
        name: 'employeeManage',
        data: {
          action: 'inviteEmployee',
          department: '测试部门',
          position: '测试职位',
          permissions: ['basic', 'production.view'],
          validDays: 7
        }
      })
      
      wx.hideLoading()
      console.log('邀请码生成结果:', result)
      
      if (result.result?.success) {
        const inviteCode = result.result.inviteCode
        this.setData({ testInviteCode: inviteCode })
        
        wx.showModal({
          title: '邀请码生成成功',
          content: `邀请码: ${inviteCode}\n\n请复制此邀请码用于测试员工加入功能`,
          confirmText: '复制邀请码',
          success: (res) => {
            if (res.confirm) {
              wx.setClipboardData({
                data: inviteCode,
                success: () => {
                  wx.showToast({
                    title: '邀请码已复制',
                    icon: 'success'
                  })
                }
              })
            }
          }
        })
      } else {
        const errorMsg = result.result?.message || '未知错误'
        console.error('邀请码生成失败:', result.result)
        
        wx.showModal({
          title: '生成邀请码失败',
          content: `错误信息: ${errorMsg}\n\n详细信息:\n- 用户角色: ${userInfo?.role || '未知'}\n- 用户权限: ${userInfo?.permissions?.join(', ') || '无'}`,
          showCancel: false
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('生成邀请码出错:', error)
      
      let errorDetail = '未知错误'
      if (error.errCode) {
        errorDetail = `错误码: ${error.errCode}\n错误信息: ${error.errMsg}`
      } else if (error.message) {
        errorDetail = error.message
      }
      
      wx.showModal({
        title: '生成邀请码失败',
        content: `调用失败: ${errorDetail}\n\n可能原因:\n1. employeeManage 云函数未部署\n2. 用户权限不足\n3. 网络连接问题`,
        showCancel: false
      })
    } finally {
      this.setData({ testing: false })
    }
  },

  // 测试员工加入（模拟）
  async testEmployeeJoin() {
    if (!this.data.testInviteCode) {
      wx.showToast({
        title: '请先生成邀请码',
        icon: 'error'
      })
      return
    }
    
    wx.showModal({
      title: '员工加入测试',
      content: `测试邀请码: ${this.data.testInviteCode}\n\n要完整测试员工加入功能，需要:\n1. 用另一个微信账号登录\n2. 在员工管理页面点击"加入组织"\n3. 输入上述邀请码`,
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  // 测试云函数连接
  async testCloudFunction() {
    this.setData({ testing: true })
    
    try {
      wx.showLoading({
        title: '测试云函数...',
        mask: true
      })
      
      // 测试基本云函数调用
      const result = await wx.cloud.callFunction({
        name: 'employeeManage',
        data: {
          action: 'getPermissions'
        }
      })
      
      wx.hideLoading()
      console.log('云函数测试结果:', result)
      
      if (result.result?.success) {
        wx.showModal({
          title: '云函数测试成功',
          content: `employeeManage 云函数正常工作\n\n权限定义数量: ${Object.keys(result.result.permissions || {}).length}`,
          showCancel: false
        })
      } else {
        wx.showModal({
          title: '云函数测试失败',
          content: `错误信息: ${result.result?.message || '未知错误'}\n\n请检查云函数部署状态`,
          showCancel: false
        })
      }
    } catch (error) {
      wx.hideLoading()
      console.error('云函数测试失败:', error)
      
      let errorDetail = '未知错误'
      if (error.errCode === -501000) {
        errorDetail = 'employeeManage 云函数未部署或不存在'
      } else if (error.errCode) {
        errorDetail = `错误码: ${error.errCode}\n错误信息: ${error.errMsg}`
      } else if (error.message) {
        errorDetail = error.message
      }
      
      wx.showModal({
        title: '云函数测试失败',
        content: `${errorDetail}\n\n解决方案:\n1. 确认 employeeManage 云函数已正确部署\n2. 检查云开发环境配置\n3. 重新部署云函数`,
        showCancel: false
      })
    } finally {
      this.setData({ testing: false })
    }
  },

  // 初始化数据库集合
  async initDatabase() {
    this.setData({ testing: true })
    
    try {
      wx.showLoading({
        title: '初始化数据库...',
        mask: true
      })
      
      // 尝试调用初始化云函数
      try {
        const result = await wx.cloud.callFunction({
          name: 'initDatabase',
          data: {
            action: 'initCollections'
          }
        })
        
        wx.hideLoading()
        
        if (result.result?.success) {
          wx.showModal({
            title: '数据库初始化成功',
            content: `初始化完成:\n${result.result.details?.initialized?.join('\n') || '所有集合已准备就绪'}`,
            showCancel: false
          })
        } else {
          wx.showModal({
            title: '数据库初始化失败',
            content: `错误信息: ${result.result?.message}\n\n${result.result.details?.errors?.join('\n') || ''}`,
            showCancel: false
          })
        }
      } catch (cloudError) {
        wx.hideLoading()
        
        // 如果云函数不存在，使用手动方式初始化
        if (cloudError.errCode === -501000) {
          console.log('initDatabase云函数不存在，使用手动初始化')
          await this.manualInitDatabase()
        } else {
          throw cloudError
        }
      }
    } catch (error) {
      wx.hideLoading()
      console.error('数据库初始化失败:', error)
      
      wx.showModal({
        title: '数据库初始化失败',
        content: `初始化过程出错: ${error.message}\n\n请手动在云开发控制台创建 employee_invites 集合`,
        showCancel: false
      })
    } finally {
      this.setData({ testing: false })
    }
  },

  // 手动初始化数据库
  async manualInitDatabase() {
    try {
      const db = wx.cloud.database()
      
      // 尝试创建一个临时邀请记录来初始化集合
      const tempInvite = {
        inviteCode: 'TEMP_INIT',
        inviterOpenid: 'temp_init',
        inviterName: '系统初始化',
        organizationId: 'temp',
        department: '临时',
        position: '临时',
        permissions: ['basic'],
        createTime: new Date(),
        expireTime: new Date(Date.now() - 1000), // 已过期
        isUsed: true,
        usedBy: 'system',
        usedTime: new Date(),
        isTemp: true // 标记为临时记录
      }
      
      const addResult = await db.collection('employee_invites').add({
        data: tempInvite
      })
      
      // 立即删除临时记录
      await db.collection('employee_invites').doc(addResult._id).remove()
      
      wx.showModal({
        title: '数据库初始化成功',
        content: 'employee_invites 集合已成功创建\n\n现在可以正常使用邀请功能了',
        showCancel: false
      })
      
    } catch (error) {
      console.error('手动初始化失败:', error)
      
      wx.showModal({
        title: '手动初始化失败',
        content: `创建集合失败: ${error.message}\n\n请在云开发控制台手动创建 employee_invites 集合`,
        showCancel: false
      })
    }
  },

  // 手动清除数据
  async manualClearData() {
    wx.showModal({
      title: '确认清除',
      content: '这将清除所有用户和邀请数据，确定继续吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '清除中...',
            mask: true
          })
          
          const result = await this.clearTestData()
          wx.hideLoading()
          
          if (result.success) {
            wx.showToast({
              title: '数据已清除',
              icon: 'success'
            })
          } else {
            wx.showModal({
              title: '清除结果',
              content: result.message,
              showCancel: false
            })
          }
          
          // 重新检查登录状态
          setTimeout(() => {
            this.checkLoginStatus()
          }, 1000)
        }
      }
    })
  },

  // 快速清除（仅本地数据）
  quickClearLocal() {
    wx.showModal({
      title: '快速清除',
      content: '这将清除本地登录状态，不会删除云端数据',
      success: (res) => {
        if (res.confirm) {
          this.clearLocalData()
          this.checkLoginStatus()
          wx.showToast({
            title: '本地数据已清除',
            icon: 'success'
          })
        }
      }
    })
  },

  // 查看测试数据
  async viewTestData() {
    try {
      // 获取本地存储的简化邀请码
      const simpleInvites = wx.getStorageSync('simpleInvites') || []
      
      let content = `本地测试数据:\n\n`
      content += `简化邀请码数量: ${simpleInvites.length}\n\n`
      
      if (simpleInvites.length > 0) {
        content += `简化邀请码列表:\n`
        simpleInvites.forEach((invite: any, index: number) => {
          const isExpired = new Date() > new Date(invite.expireTime)
          content += `${index + 1}. ${invite.code} (${isExpired ? '已过期' : '有效'})\n`
          content += `   部门: ${invite.department}\n`
          content += `   职位: ${invite.position}\n`
          content += `   创建者: ${invite.creator}\n\n`
        })
      }
      
      // 尝试获取云端数据
      try {
        wx.showLoading({ title: '加载云端数据...' })
        
        // 获取员工列表
        const employeeResult = await wx.cloud.callFunction({
          name: 'employeeManage',
          data: { action: 'getEmployees' }
        })
        
        // 获取邀请列表
        const inviteResult = await wx.cloud.callFunction({
          name: 'employeeManage',
          data: { action: 'getInvites' }
        })
        
        wx.hideLoading()
        
        const employees = employeeResult.result?.employees || []
        const invites = inviteResult.result?.invites || []
        
        content += `\n云端数据:\n`
        content += `用户数量: ${employees.length}\n`
        content += `云端邀请数量: ${invites.length}\n\n`
        
        if (employees.length > 0) {
          content += `用户列表:\n`
          employees.forEach((emp: any, index: number) => {
            content += `${index + 1}. ${emp.nickname} (${emp.role})\n`
          })
        }
        
        if (invites.length > 0) {
          content += `\n云端邀请列表:\n`
          invites.forEach((invite: any, index: number) => {
            content += `${index + 1}. ${invite.inviteCode} (${invite.isUsed ? '已使用' : '未使用'})\n`
          })
        }
        
      } catch (cloudError) {
        wx.hideLoading()
        content += `\n云端数据加载失败: ${cloudError.message || '云函数调用失败'}`
      }
      
      wx.showModal({
        title: '测试数据概览',
        content: content,
        showCancel: false
      })
      
    } catch (error) {
      wx.hideLoading()
      console.error('获取测试数据失败:', error)
      wx.showToast({
        title: '获取数据失败',
        icon: 'error'
      })
    }
  },

  // 快速登录测试
  quickLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  // 前往员工管理
  goToEmployee() {
    wx.navigateTo({
      url: '/pages/employee/employee'
    })
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 生成简化邀请码（不依赖数据库）
  async generateSimpleInvite() {
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'error'
      })
      return
    }

    try {
      // 生成一个简单的邀请码（基于时间戳）
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
      const simpleInviteCode = `${randomStr}${timestamp.toString().slice(-2)}`
      
      // 将邀请码保存到本地存储（作为临时方案）
      const inviteData = {
        code: simpleInviteCode,
        creator: this.data.currentUser?.nickname || '管理员',
        department: '测试部门',
        position: '测试职位',
        permissions: ['basic', 'production.view'],
        createTime: new Date().toISOString(),
        expireTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7天后过期
      }
      
      // 保存到本地存储
      const existingInvites = wx.getStorageSync('simpleInvites') || []
      existingInvites.push(inviteData)
      wx.setStorageSync('simpleInvites', existingInvites)
      
      // 同时保存到页面数据中
      this.setData({ testInviteCode: simpleInviteCode })
      
      console.log('生成的邀请码:', simpleInviteCode)
      console.log('保存的邀请数据:', inviteData)
      console.log('当前所有邀请:', existingInvites)
      
      wx.showModal({
        title: '简化邀请码生成成功',
        content: `邀请码: ${simpleInviteCode}\n\n注意：这是不依赖数据库的临时方案\n适用于演示和测试权限功能`,
        confirmText: '复制邀请码',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({
              data: simpleInviteCode,
              success: () => {
                wx.showToast({
                  title: '邀请码已复制',
                  icon: 'success'
                })
              }
            })
          }
        }
      })
      
    } catch (error) {
      console.error('生成简化邀请码失败:', error)
      wx.showToast({
        title: '生成失败',
        icon: 'error'
      })
    }
  },

  // 使用简化邀请码加入
  async joinBySimpleInvite() {
    wx.showModal({
      title: '加入组织',
      content: '请输入邀请码',
      editable: true,
      placeholderText: '请输入8位邀请码',
      success: async (res) => {
        if (res.confirm && res.content) {
          const inviteCode = res.content.trim().toUpperCase()
          
          try {
            // 从本地存储查找邀请码
            const existingInvites = wx.getStorageSync('simpleInvites') || []
            
            console.log('输入的邀请码:', inviteCode)
            console.log('存储的邀请列表:', existingInvites)
            console.log('邀请码匹配检查:', existingInvites.map((inv: any) => ({ 
              stored: inv.code, 
              input: inviteCode, 
              match: inv.code === inviteCode 
            })))
            
            const invite = existingInvites.find((inv: any) => inv.code === inviteCode)
            
            if (!invite) {
              // 显示更详细的错误信息
              const codes = existingInvites.map((inv: any) => inv.code).join(', ')
              wx.showModal({
                title: '邀请码不存在',
                content: `输入的邀请码: ${inviteCode}\n\n存储的邀请码: ${codes || '无'}\n\n请确认邀请码是否正确`,
                showCancel: false
              })
              return
            }
            
            // 检查是否过期
            if (new Date() > new Date(invite.expireTime)) {
              wx.showToast({
                title: '邀请码已过期',
                icon: 'error'
              })
              return
            }
            
            // 模拟更新用户权限（保存到本地存储）
            let userInfo = this.data.currentUser
            if (userInfo) {
              // 创建一个新的用户信息对象，避免直接修改
              userInfo = {
                ...userInfo,
                role: 'employee',
                permissions: invite.permissions,
                department: invite.department,
                position: invite.position
              }
              
              // 更新全局状态
              const app = getApp()
              app.globalData.userInfo = userInfo
              wx.setStorageSync('userInfo', userInfo)
              
              this.setData({ currentUser: userInfo })
              
              wx.showModal({
                title: '加入成功',
                content: `您已成功加入组织\n\n部门：${invite.department}\n职位：${invite.position}\n权限：${invite.permissions.join(', ')}\n\n角色已变更为：员工`,
                showCancel: false,
                success: () => {
                  // 刷新页面状态
                  this.checkLoginStatus()
                }
              })
            } else {
              wx.showToast({
                title: '用户信息获取失败',
                icon: 'error'
              })
            }
            
          } catch (error) {
            console.error('加入组织失败:', error)
            wx.showModal({
              title: '加入失败',
              content: `错误详情: ${error.message}`,
              showCancel: false
            })
          }
        }
      }
    })
  },

  // 复制邀请码
  copyInviteCode(e: any) {
    const { code } = e.currentTarget.dataset
    
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success'
        })
      }
    })
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
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
