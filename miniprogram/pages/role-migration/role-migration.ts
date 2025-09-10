// pages/role-migration/role-migration.ts
// 角色迁移管理页面

Page({
  data: {
    // 当前用户权限
    userRole: '',
    canMigrate: false,
    
    // 分析结果
    analysisResult: null,
    showAnalysisResult: false,
    
    // 迁移状态
    migrationInProgress: false,
    migrationResult: null,
    showMigrationResult: false,
    
    // 验证结果
    verificationResult: null,
    showVerificationResult: false,
    
    // 确认弹窗
    showConfirmDialog: false,
    confirmAction: '',
    confirmTitle: '',
    confirmContent: ''
  },

  onLoad() {
    this.checkUserPermission()
  },

  // 检查用户权限
  async checkUserPermission() {
    try {
      const app = getApp()
      const userInfo = app.globalData.userInfo
      
      if (!userInfo || (userInfo.role !== 'super_admin' && userInfo.role !== 'admin')) {
        wx.showModal({
          title: '权限不足',
          content: '只有超级管理员可以执行角色迁移操作',
          showCancel: false,
          success: () => {
            wx.navigateBack({
              fail: () => {
                wx.switchTab({
                  url: '/pages/profile/profile'
                })
              }
            })
          }
        })
        return
      }
      
      this.setData({
        userRole: userInfo.role,
        canMigrate: true
      })
    } catch (error) {
      console.error('权限检查失败：', error)
    }
  },

  // 分析角色分布
  async analyzeRoles() {
    if (!this.data.canMigrate) return

    try {
      wx.showLoading({ title: '分析中...' })

      const result = await wx.cloud.callFunction({
        name: 'role-migration',
        data: {
          action: 'analyze'
        }
      })

      if (result.result.success) {
        this.setData({
          analysisResult: result.result.data,
          showAnalysisResult: true
        })
        
        wx.showToast({
          title: '分析完成',
          icon: 'success'
        })
      } else {
        throw new Error(result.result.message)
      }
    } catch (error) {
      console.error('角色分析失败：', error)
      wx.showToast({
        title: '分析失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 预览迁移
  async previewMigration() {
    if (!this.data.canMigrate) return

    try {
      wx.showLoading({ title: '生成预览...' })

      const result = await wx.cloud.callFunction({
        name: 'role-migration',
        data: {
          action: 'migrate',
          dryRun: true
        }
      })

      if (result.result.success) {
        this.setData({
          migrationResult: result.result.data,
          showMigrationResult: true
        })
        
        wx.showToast({
          title: '预览生成完成',
          icon: 'success'
        })
      } else {
        throw new Error(result.result.message)
      }
    } catch (error) {
      console.error('迁移预览失败：', error)
      wx.showToast({
        title: '预览失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 执行迁移
  executeMigration() {
    if (!this.data.canMigrate) return

    this.setData({
      showConfirmDialog: true,
      confirmAction: 'migrate',
      confirmTitle: '确认执行迁移',
      confirmContent: '此操作将直接修改数据库中的用户角色，执行后无法撤销。请确保已经做好数据备份。\n\n是否继续执行角色迁移？'
    })
  },

  // 验证迁移结果
  async verifyMigration() {
    if (!this.data.canMigrate) return

    try {
      wx.showLoading({ title: '验证中...' })

      const result = await wx.cloud.callFunction({
        name: 'role-migration',
        data: {
          action: 'verify'
        }
      })

      if (result.result.success) {
        this.setData({
          verificationResult: result.result.data,
          showVerificationResult: true
        })
        
        wx.showToast({
          title: '验证完成',
          icon: 'success'
        })
      } else {
        throw new Error(result.result.message)
      }
    } catch (error) {
      console.error('迁移验证失败：', error)
      wx.showToast({
        title: '验证失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 确认对话框
  async onConfirm() {
    const { confirmAction } = this.data
    this.setData({ showConfirmDialog: false })

    if (confirmAction === 'migrate') {
      await this.performMigration()
    }
  },

  onCancel() {
    this.setData({ showConfirmDialog: false })
  },

  // 执行实际迁移
  async performMigration() {
    try {
      wx.showLoading({ title: '执行迁移中...', mask: true })

      const result = await wx.cloud.callFunction({
        name: 'role-migration',
        data: {
          action: 'migrate',
          dryRun: false
        }
      })

      if (result.result.success) {
        this.setData({
          migrationResult: result.result.data,
          showMigrationResult: true
        })
        
        wx.showModal({
          title: '迁移完成',
          content: `迁移执行完成！\n成功：${result.result.data.successCount}\n失败：${result.result.data.errorCount}`,
          showCancel: false
        })
        
        // 自动验证迁移结果
        setTimeout(() => {
          this.verifyMigration()
        }, 2000)
      } else {
        throw new Error(result.result.message)
      }
    } catch (error) {
      console.error('执行迁移失败：', error)
      wx.showModal({
        title: '迁移失败',
        content: error.message || '执行迁移时发生错误，请检查日志',
        showCancel: false
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 工具方法
  getRoleDisplayName(roleCode: string) {
    const roleMap: {[key: string]: string} = {
      'super_admin': '超级管理员',
      'manager': '经理',
      'employee': '员工',
      'veterinarian': '兽医',
      'admin': '管理员（旧）',
      'user': '普通用户（旧）',
      'operator': '操作员（旧）',
      'technician': '技术员（旧）',
      'finance': '财务（旧）'
    }
    return roleMap[roleCode] || roleCode
  },

  getRoleColor(roleCode: string) {
    const colorMap: {[key: string]: string} = {
      'super_admin': '#ff4d4f',
      'manager': '#1890ff',
      'employee': '#52c41a',
      'veterinarian': '#722ed1',
      'admin': '#ff7875',
      'user': '#95f985',
      'operator': '#95f985',
      'technician': '#b37feb',
      'finance': '#69c0ff'
    }
    return colorMap[roleCode] || '#666666'
  },

  // 关闭结果弹窗
  closeAnalysisResult() {
    this.setData({ showAnalysisResult: false })
  },

  closeMigrationResult() {
    this.setData({ showMigrationResult: false })
  },

  closeVerificationResult() {
    this.setData({ showVerificationResult: false })
  }
})
