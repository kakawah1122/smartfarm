// cloudfunctions/register/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { nickname, avatarUrl, phone, gender, farmName } = event
  
  try {
    // 获取用户的 openid
    const { OPENID } = wxContext
    
    if (!OPENID) {
      return {
        success: false,
        message: '用户身份验证失败'
      }
    }
    
    // 查找用户记录
    let userQuery = null
    let user = null
    
    try {
      userQuery = await db.collection('users').where({
        _openid: OPENID
      }).get()
      
      if (userQuery.data.length === 0) {
        return {
          success: false,
          message: '用户不存在，请先登录'
        }
      }
      
      user = userQuery.data[0]
      
    } catch (queryError) {
      console.error('查询用户时出错:', queryError)
      
      if (queryError.errCode === -502005 || queryError.message?.includes('collection not exists')) {
        return {
          success: false,
          message: '数据库集合不存在，请先完成登录以初始化数据库',
          error: 'database_collection_not_exists'
        }
      }
      
      throw queryError
    }
    
    // 准备更新数据
    const updateData = {
      updateTime: new Date()
    }
    
    // 添加要更新的字段
    if (nickname !== undefined) {
      updateData.nickname = nickname
    }
    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl
    }
    if (phone !== undefined) {
      updateData.phone = phone
    }
    if (gender !== undefined) {
      updateData.gender = gender
    }
    if (farmName !== undefined) {
      updateData.farmName = farmName
    }
    
    // 更新用户信息
    const updateResult = await db.collection('users').doc(user._id).update({
      data: updateData
    })
    
    if (updateResult.stats.updated === 1) {
      // 获取更新后的用户信息
      const updatedUser = await db.collection('users').doc(user._id).get()
      
      return {
        success: true,
        message: '用户信息更新成功',
        user: {
          _id: updatedUser.data._id,
          openid: OPENID,
          nickname: updatedUser.data.nickname,
          avatarUrl: updatedUser.data.avatarUrl,
          phone: updatedUser.data.phone,
          gender: updatedUser.data.gender,
          farmName: updatedUser.data.farmName,
          createTime: updatedUser.data.createTime,
          updateTime: updatedUser.data.updateTime,
          lastLoginTime: updatedUser.data.lastLoginTime,
          loginCount: updatedUser.data.loginCount,
          isActive: updatedUser.data.isActive
        }
      }
    } else {
      return {
        success: false,
        message: '用户信息更新失败'
      }
    }
    
  } catch (error) {
    console.error('注册/更新用户信息失败:', error)
    return {
      success: false,
      error: error.message,
      message: '操作失败，请重试'
    }
  }
}