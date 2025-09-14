// cloudfunctions/notification-management/index.js
// 通知管理云函数 - 统一处理所有通知逻辑
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      // 通知创建和管理
      case 'create_notification':
        return await createNotification(event, wxContext)
      case 'get_user_notifications':
        return await getUserNotifications(event, wxContext)
      case 'mark_as_read':
        return await markAsRead(event, wxContext)
      case 'mark_all_read':
        return await markAllRead(event, wxContext)
      case 'delete_notification':
        return await deleteNotification(event, wxContext)
      
      // 通知统计和管理
      case 'get_notification_stats':
        return await getNotificationStats(event, wxContext)
      case 'get_notification_settings':
        return await getNotificationSettings(event, wxContext)
      case 'update_notification_settings':
        return await updateNotificationSettings(event, wxContext)
      
      // 批量操作
      case 'batch_mark_read':
        return await batchMarkRead(event, wxContext)
      case 'clean_old_notifications':
        return await cleanOldNotifications(event, wxContext)
      
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: error.message || '操作失败，请重试'
    }
  }
}

// 创建通知
async function createNotification(event, wxContext) {
  const { 
    targetUsers, // 目标用户列表 (openid数组) 或 'all' 或 'admins'
    title,
    content,
    type, // 'system', 'approval', 'health', 'production', 'finance'
    priority, // 'low', 'normal', 'high', 'urgent'
    relatedData, // 相关业务数据
    actionUrl, // 点击跳转的页面
    expireTime // 过期时间
  } = event
  
  try {
    // 数据验证
    if (!title || !content || !type) {
      throw new Error('缺少必填字段：title, content, type')
    }
    
    // 解析目标用户
    let recipients = []
    if (targetUsers === 'all') {
      // 发送给所有用户
      const allUsers = await db.collection('wx_users')
        .where({ isActive: true })
        .field({ _openid: true })
        .get()
      recipients = allUsers.data.map(user => user._openid)
    } else if (targetUsers === 'admins') {
      // 发送给管理员
      const adminUsers = await db.collection('wx_users')
        .where({ 
          isActive: true,
          role: _.in(['admin', 'manager', 'operator'])
        })
        .field({ _openid: true })
        .get()
      recipients = adminUsers.data.map(user => user._openid)
    } else if (Array.isArray(targetUsers)) {
      recipients = targetUsers
    } else {
      throw new Error('无效的目标用户格式')
    }
    
    if (recipients.length === 0) {
      throw new Error('没有找到目标用户')
    }
    
    const now = new Date()
    const notificationId = generateNotificationId()
    
    // 创建通知记录
    const notification = {
      _id: notificationId,
      title,
      content,
      type,
      priority: priority || 'normal',
      relatedData: relatedData || {},
      actionUrl: actionUrl || '',
      senderOpenid: wxContext.OPENID,
      recipients: recipients,
      readBy: [], // 已读用户列表
      createTime: now,
      expireTime: expireTime ? new Date(expireTime) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 默认30天过期
      isActive: true
    }
    
    // 保存通知
    await db.collection('sys_notifications').add({
      data: notification
    })
    
    // 为每个用户创建个人通知记录（便于查询和统计）
    const userNotifications = recipients.map(openid => ({
      notificationId,
      userOpenid: openid,
      isRead: false,
      readTime: null,
      createTime: now
    }))
    
    // 批量创建用户通知关联
    const batchSize = 20 // 微信云开发批量操作限制
    for (let i = 0; i < userNotifications.length; i += batchSize) {
      const batch = userNotifications.slice(i, i + batchSize)
      await Promise.all(
        batch.map(userNotif => 
          db.collection('user_notifications').add({ data: userNotif })
        )
      )
    }
    
    // 尝试发送模板消息（可选，需要模板消息权限）
    if (priority === 'high' || priority === 'urgent') {
      await sendTemplateMessage(recipients, notification)
    }
    
    return {
      success: true,
      data: {
        notificationId,
        recipientCount: recipients.length
      },
      message: '通知发送成功'
    }
  } catch (error) {
    throw error
  }
}

// 获取用户通知列表
async function getUserNotifications(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 20,
    type = null,
    priority = null,
    isRead = null,
    dateRange = null
  } = event
  
  try {
    // 构建查询条件
    let query = db.collection('user_notifications')
      .where({ userOpenid: wxContext.OPENID })
    
    if (isRead !== null) {
      query = query.where({ isRead })
    }
    
    // 获取用户通知关联记录
    const userNotifications = await query
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    // 获取通知详情
    const notificationIds = userNotifications.data.map(un => un.notificationId)
    if (notificationIds.length === 0) {
      return {
        success: true,
        data: {
          notifications: [],
          pagination: { page, pageSize, total: 0, totalPages: 0 }
        }
      }
    }
    
    // 获取通知详情
    let notificationsQuery = db.collection('sys_notifications')
      .where({ 
        _id: _.in(notificationIds),
        isActive: true,
        expireTime: _.gte(new Date())
      })
    
    // 应用过滤条件
    if (type) {
      notificationsQuery = notificationsQuery.where({ type })
    }
    if (priority) {
      notificationsQuery = notificationsQuery.where({ priority })
    }
    if (dateRange && dateRange.start && dateRange.end) {
      notificationsQuery = notificationsQuery.where({
        createTime: _.gte(new Date(dateRange.start)).and(_.lte(new Date(dateRange.end)))
      })
    }
    
    const notifications = await notificationsQuery.get()
    
    // 合并通知数据和用户阅读状态
    const result = []
    const notificationMap = new Map(notifications.data.map(n => [n._id, n]))
    
    for (const userNotif of userNotifications.data) {
      const notification = notificationMap.get(userNotif.notificationId)
      if (notification) {
        result.push({
          ...notification,
          isRead: userNotif.isRead,
          readTime: userNotif.readTime,
          userNotificationId: userNotif._id
        })
      }
    }
    
    // 获取总数
    const totalCount = await query.count()
    
    return {
      success: true,
      data: {
        notifications: result,
        pagination: {
          page,
          pageSize,
          total: totalCount.total,
          totalPages: Math.ceil(totalCount.total / pageSize)
        }
      }
    }
  } catch (error) {
    throw error
  }
}

// 标记为已读
async function markAsRead(event, wxContext) {
  const { notificationId } = event
  
  try {
    if (!notificationId) {
      throw new Error('缺少通知ID')
    }
    
    const now = new Date()
    
    // 更新用户通知状态
    await db.collection('user_notifications')
      .where({
        notificationId,
        userOpenid: wxContext.OPENID
      })
      .update({
        data: {
          isRead: true,
          readTime: now
        }
      })
    
    // 同时更新通知表的已读用户列表
    await db.collection('sys_notifications')
      .doc(notificationId)
      .update({
        data: {
          readBy: _.addToSet(wxContext.OPENID)
        }
      })
    
    return {
      success: true,
      message: '标记已读成功'
    }
  } catch (error) {
    throw error
  }
}

// 标记全部已读
async function markAllRead(event, wxContext) {
  try {
    const now = new Date()
    
    // 更新用户所有未读通知
    await db.collection('user_notifications')
      .where({
        userOpenid: wxContext.OPENID,
        isRead: false
      })
      .update({
        data: {
          isRead: true,
          readTime: now
        }
      })
    
    return {
      success: true,
      message: '全部标记已读成功'
    }
  } catch (error) {
    throw error
  }
}

// 获取通知统计
async function getNotificationStats(event, wxContext) {
  try {
    const [unreadCount, totalCount, recentCount] = await Promise.all([
      // 未读数量
      db.collection('user_notifications')
        .where({
          userOpenid: wxContext.OPENID,
          isRead: false
        })
        .count(),
      
      // 总通知数
      db.collection('user_notifications')
        .where({
          userOpenid: wxContext.OPENID
        })
        .count(),
      
      // 最近7天新通知
      db.collection('user_notifications')
        .where({
          userOpenid: wxContext.OPENID,
          createTime: _.gte(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        })
        .count()
    ])
    
    return {
      success: true,
      data: {
        unreadCount: unreadCount.total,
        totalCount: totalCount.total,
        recentCount: recentCount.total
      }
    }
  } catch (error) {
    throw error
  }
}

// 删除通知
async function deleteNotification(event, wxContext) {
  const { notificationId } = event
  
  try {
    if (!notificationId) {
      throw new Error('缺少通知ID')
    }
    
    // 删除用户通知关联
    await db.collection('user_notifications')
      .where({
        notificationId,
        userOpenid: wxContext.OPENID
      })
      .remove()
    
    return {
      success: true,
      message: '通知删除成功'
    }
  } catch (error) {
    throw error
  }
}

// 生成通知ID
function generateNotificationId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const hour = now.getHours().toString().padStart(2, '0')
  const minute = now.getMinutes().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `N${year}${month}${day}${hour}${minute}${random}`
}

// 发送模板消息（需要模板消息权限）
async function sendTemplateMessage(recipients, notification) {
  try {
    // 这里应该调用微信模板消息API
    // 由于需要申请模板消息权限，这里只是示例代码
    // 模板消息发送逻辑待实现
  } catch (error) {
    // 模板消息失败不影响通知创建
  }
}

// 清理过期通知
async function cleanOldNotifications(event, wxContext) {
  try {
    const now = new Date()
    
    // 删除过期通知
    await db.collection('sys_notifications')
      .where({
        expireTime: _.lt(now)
      })
      .remove()
    
    // 删除对应的用户通知关联
    const expiredNotifications = await db.collection('sys_notifications')
      .where({
        expireTime: _.lt(now)
      })
      .field({ _id: true })
      .get()
    
    const expiredIds = expiredNotifications.data.map(n => n._id)
    if (expiredIds.length > 0) {
      await db.collection('user_notifications')
        .where({
          notificationId: _.in(expiredIds)
        })
        .remove()
    }
    
    return {
      success: true,
      data: {
        cleanedCount: expiredIds.length
      },
      message: '过期通知清理完成'
    }
  } catch (error) {
    throw error
  }
}

// 批量标记已读
async function batchMarkRead(event, wxContext) {
  const { notificationIds } = event
  
  try {
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new Error('无效的通知ID列表')
    }
    
    const now = new Date()
    
    // 批量更新
    await db.collection('user_notifications')
      .where({
        notificationId: _.in(notificationIds),
        userOpenid: wxContext.OPENID,
        isRead: false
      })
      .update({
        data: {
          isRead: true,
          readTime: now
        }
      })
    
    return {
      success: true,
      message: '批量标记已读成功'
    }
  } catch (error) {
    throw error
  }
}

// 获取用户通知设置
async function getNotificationSettings(event, wxContext) {
  try {
    const settings = await db.collection('user_notification_settings')
      .where({ userOpenid: wxContext.OPENID })
      .get()
    
    if (settings.data.length === 0) {
      // 返回默认设置
      return {
        success: true,
        data: {
          settings: {
            enablePush: true,
            enableSystem: true,
            enableApproval: true,
            enableHealth: true,
            enableProduction: true,
            enableFinance: true,
            quietHours: {
              enabled: false,
              startTime: '22:00',
              endTime: '08:00'
            }
          }
        }
      }
    }
    
    return {
      success: true,
      data: {
        settings: settings.data[0]
      }
    }
  } catch (error) {
    throw error
  }
}

// 更新用户通知设置
async function updateNotificationSettings(event, wxContext) {
  const { settings } = event
  
  try {
    if (!settings) {
      throw new Error('缺少设置数据')
    }
    
    const now = new Date()
    const settingsData = {
      userOpenid: wxContext.OPENID,
      ...settings,
      updateTime: now
    }
    
    // 尝试更新，如果不存在则创建
    const existingSettings = await db.collection('user_notification_settings')
      .where({ userOpenid: wxContext.OPENID })
      .get()
    
    if (existingSettings.data.length === 0) {
      // 创建新设置
      settingsData.createTime = now
      await db.collection('user_notification_settings').add({
        data: settingsData
      })
    } else {
      // 更新现有设置
      await db.collection('user_notification_settings')
        .doc(existingSettings.data[0]._id)
        .update({
          data: settingsData
        })
    }
    
    return {
      success: true,
      message: '通知设置更新成功'
    }
  } catch (error) {
    throw error
  }
}

