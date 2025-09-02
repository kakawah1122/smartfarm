// cloudfunctions/clearTestData/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, confirmKey } = event
  
  // 安全验证：需要特定的确认密钥才能执行清理
  const CLEAR_CONFIRM_KEY = 'CLEAR_TEST_DATA_2024'
  
  if (confirmKey !== CLEAR_CONFIRM_KEY) {
    return {
      success: false,
      message: '安全验证失败，请提供正确的确认密钥'
    }
  }
  
  try {
    console.log('开始清理测试数据，操作者:', wxContext.OPENID)
    
    let results = {
      success: true,
      cleared: [],
      errors: []
    }
    
    switch (action) {
      case 'clearAll':
        // 清除所有测试数据
        results = await clearAllData()
        break
      case 'clearUsers':
        // 只清除用户数据
        results = await clearUsersData()
        break
      case 'clearInvites':
        // 只清除邀请数据
        results = await clearInvitesData()
        break
      case 'resetToDemo':
        // 重置为演示数据
        results = await resetToDemoData()
        break
      default:
        return {
          success: false,
          message: '未知的清理操作类型'
        }
    }
    
    return {
      success: results.success,
      message: results.success ? '数据清理完成' : '数据清理部分失败',
      details: results
    }
    
  } catch (error) {
    console.error('清理数据失败:', error)
    return {
      success: false,
      error: error.message,
      message: '清理数据时发生错误'
    }
  }
}

// 清除所有数据
async function clearAllData() {
  const results = {
    success: true,
    cleared: [],
    errors: []
  }
  
  try {
    // 清除用户数据
    const usersResult = await clearCollection('users')
    if (usersResult.success) {
      results.cleared.push(`users: ${usersResult.deleted} 条记录`)
    } else {
      results.errors.push(`users: ${usersResult.error}`)
    }
    
    // 清除邀请数据
    const invitesResult = await clearCollection('employee_invites')
    if (invitesResult.success) {
      results.cleared.push(`employee_invites: ${invitesResult.deleted} 条记录`)
    } else {
      results.errors.push(`employee_invites: ${invitesResult.error}`)
    }
    
  } catch (error) {
    results.success = false
    results.errors.push(error.message)
  }
  
  return results
}

// 清除用户数据
async function clearUsersData() {
  const results = {
    success: true,
    cleared: [],
    errors: []
  }
  
  const usersResult = await clearCollection('users')
  if (usersResult.success) {
    results.cleared.push(`users: ${usersResult.deleted} 条记录`)
  } else {
    results.success = false
    results.errors.push(`users: ${usersResult.error}`)
  }
  
  return results
}

// 清除邀请数据
async function clearInvitesData() {
  const results = {
    success: true,
    cleared: [],
    errors: []
  }
  
  const invitesResult = await clearCollection('employee_invites')
  if (invitesResult.success) {
    results.cleared.push(`employee_invites: ${invitesResult.deleted} 条记录`)
  } else {
    results.success = false
    results.errors.push(`employee_invites: ${invitesResult.error}`)
  }
  
  return results
}

// 重置为演示数据
async function resetToDemoData() {
  const results = {
    success: true,
    cleared: [],
    errors: []
  }
  
  try {
    // 先清除现有数据
    await clearAllData()
    
    // 创建演示用户数据
    const demoUsers = [
      {
        _openid: 'demo_admin_openid',
        nickname: '演示管理员',
        avatarUrl: '',
        phone: '13800138000',
        farmName: '演示养殖场',
        role: 'admin',
        permissions: ['all'],
        department: '管理部',
        position: '总经理',
        createTime: new Date(),
        isActive: true
      },
      {
        _openid: 'demo_employee_openid',
        nickname: '演示员工',
        avatarUrl: '',
        phone: '13800138001',
        farmName: '演示养殖场',
        role: 'employee',
        permissions: ['basic', 'production.view', 'health.view'],
        department: '生产部',
        position: '饲养员',
        createTime: new Date(),
        isActive: true
      }
    ]
    
    for (const user of demoUsers) {
      try {
        await db.collection('users').add({ data: user })
        results.cleared.push(`创建演示用户: ${user.nickname}`)
      } catch (error) {
        results.errors.push(`创建用户 ${user.nickname} 失败: ${error.message}`)
      }
    }
    
  } catch (error) {
    results.success = false
    results.errors.push(error.message)
  }
  
  return results
}

// 清除指定集合
async function clearCollection(collectionName) {
  try {
    // 获取所有文档
    const queryResult = await db.collection(collectionName).get()
    const docs = queryResult.data
    
    if (docs.length === 0) {
      return {
        success: true,
        deleted: 0,
        message: `集合 ${collectionName} 中没有数据`
      }
    }
    
    // 批量删除
    let deletedCount = 0
    for (const doc of docs) {
      try {
        await db.collection(collectionName).doc(doc._id).remove()
        deletedCount++
      } catch (error) {
        console.error(`删除文档 ${doc._id} 失败:`, error)
      }
    }
    
    return {
      success: true,
      deleted: deletedCount,
      total: docs.length
    }
    
  } catch (error) {
    // 如果集合不存在，这也算成功
    if (error.errCode === -502005 || error.message?.includes('collection not exists')) {
      return {
        success: true,
        deleted: 0,
        message: `集合 ${collectionName} 不存在，无需清理`
      }
    }
    
    return {
      success: false,
      error: error.message
    }
  }
}
