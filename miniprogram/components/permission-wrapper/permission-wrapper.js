/**
 * 权限控制组件
 * 统一的权限检查包装器，适用于整个小程序
 */

import permissionManager from '../../utils/permission-manager.js'
import { PERMISSION_ERRORS } from '../../utils/permission-config.js'

Component({
  /**
   * 组件属性
   */
  properties: {
    // 权限模块
    module: {
      type: String,
      value: ''
    },
    
    // 权限操作
    action: {
      type: String,
      value: ''
    },
    
    // 资源ID
    resourceId: {
      type: String,
      value: ''
    },
    
    // 允许的角色列表
    allowedRoles: {
      type: Array,
      value: []
    },
    
    // 组件ID（用于查找预配置权限）
    componentId: {
      type: String,
      value: ''
    },
    
    // 权限条件
    conditions: {
      type: Object,
      value: null
    },
    
    // 是否显示加载状态
    showLoader: {
      type: Boolean,
      value: true
    },
    
    // 无权限时的提示内容
    noPermissionText: {
      type: String,
      value: '您没有权限访问此功能'
    },
    
    // 无权限时是否显示提示
    showNoPermissionTip: {
      type: Boolean,
      value: true
    },
    
    // 是否静默检查（不显示错误提示）
    silent: {
      type: Boolean,
      value: false
    },
    
    // 自定义权限检查函数
    customCheck: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件数据
   */
  data: {
    hasPermission: false,
    loading: true,
    error: '',
    initialized: false
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      this.checkPermission()
    },
    
    ready() {
      // 组件完全创建完毕后再次检查
      if (!this.data.initialized) {
        this.checkPermission()
      }
    }
  },

  /**
   * 属性监听器
   */
  observers: {
    'module, action, resourceId, allowedRoles, componentId, conditions': function() {
      if (this.data.initialized) {
        this.checkPermission()
      }
    }
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 检查权限
     */
    async checkPermission() {
      const { 
        module, 
        action, 
        resourceId, 
        allowedRoles, 
        componentId, 
        conditions,
        silent,
        customCheck
      } = this.data

      this.setData({ 
        loading: true, 
        error: '',
        initialized: true
      })

      try {
        let hasPermission = false

        // 1. 如果有自定义检查函数
        if (customCheck && typeof this[customCheck] === 'function') {
          hasPermission = await this[customCheck]()
        }
        // 2. 如果指定了组件ID，使用组件权限配置
        else if (componentId) {
          hasPermission = await permissionManager.checkComponentPermission(
            componentId, 
            { 
              module, 
              action, 
              resourceId, 
              conditions 
            }
          )
        }
        // 3. 如果指定了角色列表，检查角色权限
        else if (allowedRoles && allowedRoles.length > 0) {
          hasPermission = permissionManager.hasAnyRole(allowedRoles)
        }
        // 4. 如果指定了模块和操作，进行权限检查
        else if (module && action) {
          hasPermission = await permissionManager.checkPermission(
            module, 
            action, 
            resourceId, 
            conditions
          )
        }
        // 5. 默认情况下，检查用户是否已登录
        else {
          hasPermission = !!permissionManager.currentUser
        }

        this.setData({
          hasPermission,
          loading: false
        })

        // 触发权限检查完成事件
        this.triggerEvent('permissionChecked', {
          hasPermission,
          module,
          action,
          resourceId
        })

        // 如果有权限，触发授权事件
        if (hasPermission) {
          this.triggerEvent('authorized', {
            module,
            action,
            resourceId
          })
        } else {
          // 无权限时的处理
          this.handleNoPermission()
        }

      } catch (error) {
        console.error('权限检查失败：', error)
        
        this.setData({
          hasPermission: false,
          loading: false,
          error: error.message || '权限检查失败'
        })

        if (!silent) {
          permissionManager.handlePermissionError(error, {
            module,
            action,
            resourceId
          })
        }

        // 触发错误事件
        this.triggerEvent('permissionError', {
          error: error.message,
          module,
          action,
          resourceId
        })
      }
    },

    /**
     * 处理无权限情况
     */
    handleNoPermission() {
      const { module, action, resourceId, silent, noPermissionText } = this.data

      // 触发无权限事件
      this.triggerEvent('unauthorized', {
        module,
        action,
        resourceId,
        message: noPermissionText
      })

      // 如果不是静默模式且显示提示
      if (!silent && this.data.showNoPermissionTip) {
        console.warn('权限不足：', {
          module,
          action,
          resourceId,
          message: noPermissionText
        })
      }
    },

    /**
     * 重新检查权限
     */
    recheckPermission() {
      // 清空权限缓存
      permissionManager.clearPermissionCache()
      // 重新检查
      this.checkPermission()
    },

    /**
     * 手动设置权限状态
     */
    setPermissionStatus(hasPermission, skipEvent = false) {
      this.setData({
        hasPermission,
        loading: false,
        error: ''
      })

      if (!skipEvent) {
        this.triggerEvent('permissionChecked', {
          hasPermission,
          manual: true
        })
      }
    },

    /**
     * 权限检查完成后的回调
     */
    onPermissionReady(callback) {
      if (typeof callback === 'function') {
        if (!this.data.loading) {
          callback(this.data.hasPermission)
        } else {
          // 等待权限检查完成
          const observer = () => {
            if (!this.data.loading) {
              callback(this.data.hasPermission)
              this.data.permissionObserver = null
            }
          }
          this.data.permissionObserver = observer
          setTimeout(observer, 100)
        }
      }
    },

    /**
     * 获取当前权限状态
     */
    getPermissionStatus() {
      return {
        hasPermission: this.data.hasPermission,
        loading: this.data.loading,
        error: this.data.error,
        initialized: this.data.initialized
      }
    }
  }
})
