// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 引入集合配置
const { COLLECTIONS } = require('./collections.js')

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { checkOnly } = event // 如果 checkOnly 为 true，只检查用户是否存在
  
  try {
    // 获取用户的 openid
    const { OPENID, APPID, UNIONID } = wxContext
    
    // 如果只是检查用户是否存在
    if (checkOnly) {
      try {
        // 已移除调试日志
        const userQuery = await db.collection(COLLECTIONS.WX_USERS).where({
          _openid: OPENID
        }).get()
        
        // 已移除调试日志
        const exists = userQuery.data.length > 0
        
        return {
          success: true,
          exists: exists,
          openid: OPENID,
          debug: {
            queryCount: userQuery.data.length,
            searchOpenid: OPENID
          }
        }
      } catch (error) {
        // 已移除调试日志
        // 如果是集合不存在的错误，用户确实不存在
        if (error.errCode === -502005 || error.message?.includes('collection not exists')) {
          return {
            success: true,
            exists: false,
            openid: OPENID,
            debug: {
              error: 'collection_not_exists',
              message: '用户集合不存在'
            }
          }
        }
        
        // 其他错误，返回错误信息用于调试
        return {
          success: false,
          exists: false,
          openid: OPENID,
          error: error.message,
          debug: {
            errorCode: error.errCode,
            errorMessage: error.message
          }
        }
      }
    }
    
    // 创建用户信息对象
    const createTime = new Date()
    
    // 检查是否已有用户存在，如果没有则第一个用户自动成为超级管理员
    let isFirstUser = false
    try {
      const allUsersQuery = await db.collection(COLLECTIONS.WX_USERS).count()
      isFirstUser = allUsersQuery.total === 0
      // 已移除调试日志
    } catch (countError) {
      // 如果集合不存在，说明是第一个用户
      // 已移除调试日志
      isFirstUser = true
    }
    
    // 为第一个用户设置完整的管理员权限
    const adminPermissions = [
      'all',
      'basic',
      'production.view',
      'production.manage', 
      'health.view',
      'health.manage',
      'finance.view',
      'finance.manage',
      'finance.approve',
      'employee.view',
      'employee.manage',
      'employee.invite',
      'system.admin'
    ]

    const userInfo = {
      _openid: OPENID,
      appid: APPID,
      unionid: UNIONID,
      nickName: '',                     // 统一使用nickName字段
      avatarUrl: '',
      phone: '',
      farmName: '',                     // 主要字段：养殖场名称
      department: '',                   // 兼容字段：与farmName保持一致
      gender: 0,
    // 角色和权限字段
    role: isFirstUser ? 'super_admin' : 'employee', // super_admin: 超级管理员, manager: 经理, employee: 员工, veterinarian: 兽医
    permissions: isFirstUser ? adminPermissions : ['basic'], // 第一个用户获得所有权限
    position: isFirstUser ? '超级管理员' : '', // 职位
      managedBy: null, // 管理者ID（第一个用户没有上级）
      organizationId: null, // 组织ID（用于多组织管理）
      // 邀请审批相关字段
      inviteCode: '', // 使用的邀请码
      approvalStatus: isFirstUser ? 'approved' : 'pending', // pending: 待审批, approved: 已审批, rejected: 已拒绝
      approvedBy: isFirstUser ? OPENID : null, // 审批人OPENID（第一个用户自己审批自己）
      approvedTime: isFirstUser ? createTime : null, // 审批时间
      rejectedBy: null, // 拒绝人OPENID
      rejectedTime: null, // 拒绝时间
      rejectedReason: '', // 拒绝原因
      approvalRemark: isFirstUser ? '系统自动创建的超级管理员账户' : '', // 审批备注
      // 时间字段
      createTime: createTime,
      lastLoginTime: createTime,
      loginCount: 1,
      isActive: isFirstUser // 第一个用户直接激活，其他用户需要审批
    }
    
    // 第一个用户特殊处理日志
    if (isFirstUser) {
      // 已移除调试日志
    }
    
    let user = null
    let isNewUser = false
    
    try {
      // 首先尝试检查用户是否已存在
      let userQuery = null
      
      try {
        userQuery = await db.collection(COLLECTIONS.WX_USERS).where({
          _openid: OPENID
        }).get()
      } catch (queryError) {
        // 如果查询失败且是集合不存在错误，直接跳到创建逻辑
        if (queryError.errCode === -502005 || queryError.message?.includes('collection not exists')) {
          userQuery = { data: [] } // 空查询结果
        } else {
          throw queryError
        }
      }
      
      if (userQuery.data.length === 0) {
        // 用户不存在，创建新用户记录
        
        try {
          const createResult = await db.collection(COLLECTIONS.WX_USERS).add({
            data: userInfo
          })
          
          user = {
            ...userInfo,
            _id: createResult._id
          }
          isNewUser = true
          
        } catch (createError) {
          // 特别处理集合不存在的错误
          if (createError.errCode === -502005 || createError.message?.includes('collection not exists')) {
            throw new Error('数据库集合不存在。请联系管理员初始化数据库，或尝试重新部署云函数。')
          }
          throw createError
        }
        
      } else {
        // 用户已存在，更新登录信息
        user = userQuery.data[0]
        
        try {
          await db.collection(COLLECTIONS.WX_USERS).doc(user._id).update({
            data: {
              lastLoginTime: new Date(),
              loginCount: db.command.inc(1)
            }
          })
          
          // 更新用户对象的登录信息
          user.lastLoginTime = new Date()
          user.loginCount = (user.loginCount || 0) + 1
          
        } catch (updateError) {
          // 更新失败不影响登录流程
        }
      }
    } catch (error) {
      throw error
    }
    
    // 检查用户审批状态
    const approvalStatus = user.approvalStatus || 'pending'
    
    // 返回登录结果（包含审批状态）
    const loginResult = {
      success: true,
      openid: OPENID,
      user: {
        _id: user._id,
        openid: OPENID,
        // 同时返回 nickname 与 nickName，兼容前端各种读取方式
        nickname: user.nickname || user.nickName || '',
        nickName: user.nickName || user.nickname || '',
        avatarUrl: user.avatarUrl || '',
        phone: user.phone || '',
        farmName: user.farmName || '', // 添加养殖场名称到返回数据
        department: user.department || user.farmName || '', // 兼容字段
        gender: user.gender || 0,
        // 角色和权限信息
        role: user.role || 'user',
        permissions: user.permissions || ['basic'],
        position: user.position || '',
        managedBy: user.managedBy || null,
        organizationId: user.organizationId || null,
        // 审批相关信息
        approvalStatus: approvalStatus,
        approvedTime: user.approvedTime || null,
        rejectedReason: user.rejectedReason || '',
        // 时间信息
        createTime: user.createTime,
        lastLoginTime: user.lastLoginTime || new Date(),
        loginCount: user.loginCount || 1,
        isActive: user.isActive !== undefined ? user.isActive : true
      }
    }
    
    // 根据审批状态返回不同的消息和状态
    if (approvalStatus === 'pending') {
      loginResult.message = isNewUser ? '注册成功，等待管理员审批' : '账户待审批，请联系管理员'
      loginResult.needApproval = true
    } else if (approvalStatus === 'rejected') {
      loginResult.message = '账户审批未通过：' + (user.rejectedReason || '请联系管理员了解详情')
      loginResult.isRejected = true
    } else {
      // 特殊处理第一个用户（超级管理员）的消息
      if (isNewUser && isFirstUser) {
        loginResult.message = '🎉 欢迎！您是第一个用户，已自动获得超级管理员权限'
        loginResult.isFirstAdmin = true
      } else {
        loginResult.message = isNewUser ? '新用户注册成功' : '登录成功'
      }
      loginResult.canUseApp = true
    }
    
    return loginResult
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '登录失败，请重试'
    }
  }
}
