/**
 * 修复用户权限脚本
 * 
 * 用途：为当前登录用户添加管理员角色
 * 使用：在云开发控制台 → 云函数 → 新建云函数 → 粘贴代码 → 测试运行
 */

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  
  console.log('当前用户 openid:', OPENID)
  
  try {
    // 1. 查询用户是否存在
    const userResult = await db.collection('wx_users')
      .where({ _openid: OPENID })
      .get()
    
    if (userResult.data.length > 0) {
      // 用户存在，更新角色
      const userId = userResult.data[0]._id
      await db.collection('wx_users').doc(userId).update({
        data: {
          role: 'manager',  // 设置为管理员
          updateTime: db.serverDate()
        }
      })
      
      console.log('✅ 用户角色已更新为 manager')
      return {
        success: true,
        message: '用户角色已更新为 manager',
        user: userResult.data[0]
      }
    } else {
      // 用户不存在，创建用户记录
      await db.collection('wx_users').add({
        data: {
          _openid: OPENID,
          role: 'manager',  // 设置为管理员
          nickName: '管理员',
          avatarUrl: '',
          status: 'approved',
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      console.log('✅ 用户记录已创建，角色为 manager')
      return {
        success: true,
        message: '用户记录已创建，角色为 manager'
      }
    }
  } catch (error) {
    console.error('❌ 修复失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

