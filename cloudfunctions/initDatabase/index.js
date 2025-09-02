// cloudfunctions/initDatabase/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    console.log('初始化数据库，操作者:', wxContext.OPENID)
    
    let results = {
      success: true,
      initialized: [],
      errors: []
    }
    
    switch (action) {
      case 'initCollections':
        // 初始化所有必需的集合
        results = await initAllCollections()
        break
      case 'initInvites':
        // 只初始化邀请集合
        results = await initInvitesCollection()
        break
      default:
        // 默认初始化所有集合
        results = await initAllCollections()
    }
    
    return {
      success: results.success,
      message: results.success ? '数据库初始化完成' : '数据库初始化部分失败',
      details: results
    }
    
  } catch (error) {
    console.error('数据库初始化失败:', error)
    return {
      success: false,
      error: error.message,
      message: '数据库初始化时发生错误'
    }
  }
}

// 初始化所有集合
async function initAllCollections() {
  const results = {
    success: true,
    initialized: [],
    errors: []
  }
  
  // 初始化邀请集合
  const invitesResult = await initInvitesCollection()
  if (invitesResult.success) {
    results.initialized.push(...invitesResult.initialized)
  } else {
    results.errors.push(...invitesResult.errors)
    results.success = false
  }
  
  // 可以在这里添加其他集合的初始化
  
  return results
}

// 初始化邀请集合
async function initInvitesCollection() {
  const results = {
    success: true,
    initialized: [],
    errors: []
  }
  
  try {
    // 尝试在 employee_invites 集合中添加一个临时记录来创建集合
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
    
    results.initialized.push('employee_invites 集合已创建')
    
  } catch (error) {
    console.error('初始化 employee_invites 集合失败:', error)
    
    // 如果集合已存在，这也算成功
    if (error.message && error.message.includes('duplicate key')) {
      results.initialized.push('employee_invites 集合已存在')
    } else {
      results.errors.push(`employee_invites: ${error.message}`)
      results.success = false
    }
  }
  
  return results
}
