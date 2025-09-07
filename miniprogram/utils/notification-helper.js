// utils/notification-helper.js
// 通知助手工具 - 统一处理通知相关操作

/**
 * 通知类型枚举
 */
const NotificationTypes = {
  SYSTEM: 'system',      // 系统消息
  APPROVAL: 'approval',  // 审批相关
  HEALTH: 'health',      // 健康管理
  PRODUCTION: 'production', // 生产管理
  FINANCE: 'finance'     // 财务管理
}

/**
 * 通知优先级枚举
 */
const NotificationPriority = {
  LOW: 'low',        // 低优先级
  NORMAL: 'normal',  // 普通
  HIGH: 'high',      // 高优先级
  URGENT: 'urgent'   // 紧急
}

/**
 * 通知模板配置
 */
const NotificationTemplates = {
  // 用户审批相关
  USER_PENDING_APPROVAL: {
    type: NotificationTypes.APPROVAL,
    priority: NotificationPriority.NORMAL,
    title: '新用户等待审批',
    contentTemplate: '用户 {{nickname}} 已注册，等待审批',
    actionUrl: '/pages/user-approval/user-approval'
  },
  
  USER_APPROVED: {
    type: NotificationTypes.APPROVAL,
    priority: NotificationPriority.NORMAL,
    title: '账户审批通过',
    contentTemplate: '恭喜！您的账户已通过审批，现在可以使用所有功能',
    actionUrl: '/pages/index/index'
  },
  
  USER_REJECTED: {
    type: NotificationTypes.APPROVAL,
    priority: NotificationPriority.HIGH,
    title: '账户审批未通过',
    contentTemplate: '很抱歉，您的账户审批未通过。原因：{{reason}}',
    actionUrl: '/pages/profile/profile'
  },
  
  // 健康管理相关
  HEALTH_RECORD_CREATED: {
    type: NotificationTypes.HEALTH,
    priority: NotificationPriority.HIGH,
    title: '新增健康异常记录',
    contentTemplate: '批次 {{batchNumber}} 发现健康异常，受影响数量：{{affectedCount}}',
    actionUrl: '/pages/health/health'
  },
  
  VACCINATION_REMINDER: {
    type: NotificationTypes.HEALTH,
    priority: NotificationPriority.NORMAL,
    title: '疫苗接种提醒',
    contentTemplate: '批次 {{batchNumber}} 需要进行疫苗接种，预计数量：{{quantity}}只',
    actionUrl: '/pages/health-record-form/health-record-form'
  },
  
  DEATH_RECORD_ALERT: {
    type: NotificationTypes.HEALTH,
    priority: NotificationPriority.URGENT,
    title: '死亡记录警报',
    contentTemplate: '批次 {{batchNumber}} 发生死亡，数量：{{deathCount}}只，原因：{{reason}}',
    actionUrl: '/pages/health/health'
  },
  
  // 生产管理相关
  ENTRY_COMPLETED: {
    type: NotificationTypes.PRODUCTION,
    priority: NotificationPriority.NORMAL,
    title: '入栏操作完成',
    contentTemplate: '批次 {{batchNumber}} 入栏完成，数量：{{quantity}}只',
    actionUrl: '/pages/production/production'
  },
  
  EXIT_COMPLETED: {
    type: NotificationTypes.PRODUCTION,
    priority: NotificationPriority.NORMAL,
    title: '出栏操作完成',
    contentTemplate: '批次 {{batchNumber}} 出栏完成，数量：{{quantity}}只',
    actionUrl: '/pages/production/production'
  },
  
  STOCK_WARNING: {
    type: NotificationTypes.PRODUCTION,
    priority: NotificationPriority.HIGH,
    title: '库存预警',
    contentTemplate: '当前存栏数量：{{currentStock}}只，建议关注库存状况',
    actionUrl: '/pages/production/production'
  },
  
  // 财务管理相关
  EXPENSE_PENDING: {
    type: NotificationTypes.FINANCE,
    priority: NotificationPriority.NORMAL,
    title: '新的报销申请',
    contentTemplate: '{{submitter}} 提交了报销申请，金额：¥{{amount}}',
    actionUrl: '/pages/finance/finance'
  },
  
  PURCHASE_REQUEST: {
    type: NotificationTypes.FINANCE,
    priority: NotificationPriority.NORMAL,
    title: '采购申请',
    contentTemplate: '{{submitter}} 提交了采购申请：{{items}}，预计金额：¥{{amount}}',
    actionUrl: '/pages/finance/finance'
  },
  
  APPROVAL_RESULT: {
    type: NotificationTypes.FINANCE,
    priority: NotificationPriority.NORMAL,
    title: '审批结果通知',
    contentTemplate: '您的{{requestType}}申请已{{status}}',
    actionUrl: '/pages/finance/finance'
  },
  
  // 系统消息
  SYSTEM_MAINTENANCE: {
    type: NotificationTypes.SYSTEM,
    priority: NotificationPriority.HIGH,
    title: '系统维护通知',
    contentTemplate: '系统将于 {{maintenanceTime}} 进行维护，预计持续 {{duration}}',
    actionUrl: '/pages/index/index'
  },
  
  PERMISSION_UPDATED: {
    type: NotificationTypes.SYSTEM,
    priority: NotificationPriority.NORMAL,
    title: '权限更新',
    contentTemplate: '您的账户权限已更新，新角色：{{newRole}}',
    actionUrl: '/pages/profile/profile'
  }
}

/**
 * 通知助手类
 */
class NotificationHelper {
  
  /**
   * 发送通知
   * @param {string} templateKey - 通知模板键
   * @param {Object} data - 模板数据
   * @param {string|Array} targetUsers - 目标用户
   * @param {Object} options - 额外选项
   */
  static async sendNotification(templateKey, data = {}, targetUsers = 'admins', options = {}) {
    try {
      const template = NotificationTemplates[templateKey]
      if (!template) {
        throw new Error(`通知模板不存在: ${templateKey}`)
      }
      
      // 渲染内容模板
      const content = this.renderTemplate(template.contentTemplate, data)
      
      // 合并配置
      const notificationData = {
        targetUsers,
        title: template.title,
        content,
        type: template.type,
        priority: options.priority || template.priority,
        relatedData: {
          templateKey,
          originalData: data,
          ...options.relatedData
        },
        actionUrl: options.actionUrl || template.actionUrl,
        expireTime: options.expireTime
      }
      
      // 调用云函数发送通知
      const result = await wx.cloud.callFunction({
        name: 'notification-management',
        data: {
          action: 'create_notification',
          ...notificationData
        }
      })
      
      if (!result.result.success) {
        throw new Error(result.result.message || '通知发送失败')
      }
      
      return result.result
    } catch (error) {
      // 通知发送失败不应该影响主业务流程
      return { success: false, error: error.message }
    }
  }
  
  /**
   * 获取用户通知列表
   * @param {Object} params - 查询参数
   */
  static async getUserNotifications(params = {}) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'notification-management',
        data: {
          action: 'get_user_notifications',
          ...params
        }
      })
      
      if (!result.result.success) {
        throw new Error(result.result.message || '获取通知列表失败')
      }
      
      return result.result.data
    } catch (error) {
      return { notifications: [], pagination: { total: 0 } }
    }
  }
  
  /**
   * 获取通知统计
   */
  static async getNotificationStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'notification-management',
        data: {
          action: 'get_notification_stats'
        }
      })
      
      if (!result.result.success) {
        throw new Error(result.result.message || '获取通知统计失败')
      }
      
      return result.result.data
    } catch (error) {
      return { unreadCount: 0, totalCount: 0, recentCount: 0 }
    }
  }
  
  /**
   * 标记通知为已读
   * @param {string} notificationId - 通知ID
   */
  static async markAsRead(notificationId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'notification-management',
        data: {
          action: 'mark_as_read',
          notificationId
        }
      })
      
      return result.result
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  
  /**
   * 标记所有通知为已读
   */
  static async markAllRead() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'notification-management',
        data: {
          action: 'mark_all_read'
        }
      })
      
      return result.result
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  
  /**
   * 删除通知
   * @param {string} notificationId - 通知ID
   */
  static async deleteNotification(notificationId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'notification-management',
        data: {
          action: 'delete_notification',
          notificationId
        }
      })
      
      return result.result
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  
  /**
   * 渲染模板
   * @param {string} template - 模板字符串
   * @param {Object} data - 数据对象
   */
  static renderTemplate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match
    })
  }
  
  /**
   * 格式化通知时间
   * @param {string|Date} time - 时间
   */
  static formatNotificationTime(time) {
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    
    if (diff < minute) {
      return '刚刚'
    } else if (diff < hour) {
      return `${Math.floor(diff / minute)}分钟前`
    } else if (diff < day) {
      return `${Math.floor(diff / hour)}小时前`
    } else if (diff < 7 * day) {
      return `${Math.floor(diff / day)}天前`
    } else {
      return date.toLocaleDateString()
    }
  }
  
  /**
   * 获取通知优先级颜色
   * @param {string} priority - 优先级
   */
  static getPriorityColor(priority) {
    const colorMap = {
      [NotificationPriority.LOW]: '#999999',
      [NotificationPriority.NORMAL]: '#14b8a6',
      [NotificationPriority.HIGH]: '#f59e0b',
      [NotificationPriority.URGENT]: '#ef4444'
    }
    return colorMap[priority] || colorMap[NotificationPriority.NORMAL]
  }
  
  /**
   * 获取通知类型图标
   * @param {string} type - 通知类型
   */
  static getTypeIcon(type) {
    const iconMap = {
      [NotificationTypes.SYSTEM]: '⚙️',
      [NotificationTypes.APPROVAL]: '📋',
      [NotificationTypes.HEALTH]: '🏥',
      [NotificationTypes.PRODUCTION]: '🏭',
      [NotificationTypes.FINANCE]: '💰'
    }
    return iconMap[type] || '📢'
  }
}

// 业务场景快捷发送方法
NotificationHelper.Business = {
  
  // 用户审批通知
  async notifyUserPendingApproval(userData) {
    return await NotificationHelper.sendNotification(
      'USER_PENDING_APPROVAL',
      { nickname: userData.nickname },
      'admins'
    )
  },
  
  async notifyUserApproved(userOpenid) {
    return await NotificationHelper.sendNotification(
      'USER_APPROVED',
      {},
      [userOpenid]
    )
  },
  
  async notifyUserRejected(userOpenid, reason) {
    return await NotificationHelper.sendNotification(
      'USER_REJECTED',
      { reason },
      [userOpenid]
    )
  },
  
  // 健康管理通知
  async notifyHealthRecord(healthData) {
    return await NotificationHelper.sendNotification(
      'HEALTH_RECORD_CREATED',
      {
        batchNumber: healthData.batchNumber,
        affectedCount: healthData.affectedCount
      },
      'admins',
      { priority: NotificationPriority.HIGH }
    )
  },
  
  async notifyVaccinationReminder(batchData) {
    return await NotificationHelper.sendNotification(
      'VACCINATION_REMINDER',
      {
        batchNumber: batchData.batchNumber,
        quantity: batchData.quantity
      },
      'all'
    )
  },
  
  async notifyDeathRecord(deathData) {
    return await NotificationHelper.sendNotification(
      'DEATH_RECORD_ALERT',
      {
        batchNumber: deathData.batchNumber,
        deathCount: deathData.deathCount,
        reason: deathData.deathReason
      },
      'admins',
      { priority: NotificationPriority.URGENT }
    )
  },
  
  // 生产管理通知
  async notifyEntryCompleted(entryData) {
    return await NotificationHelper.sendNotification(
      'ENTRY_COMPLETED',
      {
        batchNumber: entryData.batchNumber,
        quantity: entryData.quantity
      },
      'all'
    )
  },
  
  async notifyExitCompleted(exitData) {
    return await NotificationHelper.sendNotification(
      'EXIT_COMPLETED',
      {
        batchNumber: exitData.batchNumber,
        quantity: exitData.quantity
      },
      'all'
    )
  },
  
  async notifyStockWarning(stockData) {
    return await NotificationHelper.sendNotification(
      'STOCK_WARNING',
      {
        currentStock: stockData.currentStock
      },
      'admins',
      { priority: NotificationPriority.HIGH }
    )
  },
  
  // 财务管理通知
  async notifyExpensePending(expenseData) {
    return await NotificationHelper.sendNotification(
      'EXPENSE_PENDING',
      {
        submitter: expenseData.submitter,
        amount: expenseData.amount
      },
      'admins'
    )
  },
  
  async notifyPurchaseRequest(purchaseData) {
    return await NotificationHelper.sendNotification(
      'PURCHASE_REQUEST',
      {
        submitter: purchaseData.submitter,
        items: purchaseData.items,
        amount: purchaseData.amount
      },
      'admins'
    )
  },
  
  async notifyApprovalResult(userOpenid, requestType, status) {
    return await NotificationHelper.sendNotification(
      'APPROVAL_RESULT',
      {
        requestType,
        status: status === 'approved' ? '通过' : '拒绝'
      },
      [userOpenid]
    )
  }
}

module.exports = {
  NotificationHelper,
  NotificationTypes,
  NotificationPriority,
  NotificationTemplates
}
