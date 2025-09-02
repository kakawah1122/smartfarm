// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 如果是测试请求，直接返回测试结果
    if (event.test) {
      return {
        success: true,
        message: '云开发环境测试成功！',
        timestamp: new Date().toISOString(),
        environment: cloud.DYNAMIC_CURRENT_ENV,
        openid: wxContext.OPENID || 'unknown',
        appid: wxContext.APPID || 'unknown'
      }
    }

    // 获取用户的 openid
    const { OPENID, APPID, UNIONID } = wxContext
    
    console.log('用户登录，OPENID:', OPENID)
    
    // 创建用户信息对象
    const createTime = new Date()
    const userInfo = {
      _openid: OPENID,
      appid: APPID,
      unionid: UNIONID,
      nickname: '',
      avatarUrl: '',
      phone: '',
      farmName: '', // 添加养殖场名称字段
      gender: 0,
      createTime: createTime,
      lastLoginTime: createTime,
      loginCount: 1,
      isActive: true
    }
    
    let user = null
    let isNewUser = false
    
    try {
      // 首先尝试检查用户是否已存在
      let userQuery = null
      
      try {
        userQuery = await db.collection('users').where({
          _openid: OPENID
        }).get()
      } catch (queryError) {
        // 如果查询失败且是集合不存在错误，直接跳到创建逻辑
        if (queryError.errCode === -502005 || queryError.message?.includes('collection not exists')) {
          console.log('users集合不存在，将通过创建用户来初始化集合')
          userQuery = { data: [] } // 模拟空查询结果
        } else {
          throw queryError
        }
      }
      
      if (userQuery.data.length === 0) {
        // 用户不存在，创建新用户记录
        console.log('创建新用户:', OPENID)
        
        try {
          const createResult = await db.collection('users').add({
            data: userInfo
          })
          
          user = {
            ...userInfo,
            _id: createResult._id
          }
          isNewUser = true
          console.log('新用户创建成功:', OPENID)
          
        } catch (createError) {
          console.error('创建用户时出错:', createError)
          // 特别处理集合不存在的错误
          if (createError.errCode === -502005 || createError.message?.includes('collection not exists')) {
            throw new Error('数据库集合不存在。请联系管理员初始化数据库，或尝试重新部署云函数。')
          }
          throw createError
        }
        
      } else {
        // 用户已存在，更新登录信息
        console.log('用户已存在，更新登录信息:', OPENID)
        user = userQuery.data[0]
        
        try {
          await db.collection('users').doc(user._id).update({
            data: {
              lastLoginTime: new Date(),
              loginCount: db.command.inc(1)
            }
          })
          
          // 更新用户对象的登录信息
          user.lastLoginTime = new Date()
          user.loginCount = (user.loginCount || 0) + 1
          
        } catch (updateError) {
          console.error('更新用户信息时出错:', updateError)
          // 更新失败不影响登录流程，只记录错误
        }
      }
    } catch (error) {
      console.error('数据库操作出错:', error)
      throw error
    }
    
    // 返回登录结果
    return {
      success: true,
      openid: OPENID,
      user: {
        _id: user._id,
        openid: OPENID,
        nickname: user.nickname || '',
        avatarUrl: user.avatarUrl || '',
        phone: user.phone || '',
        farmName: user.farmName || '', // 添加养殖场名称到返回数据
        gender: user.gender || 0,
        createTime: user.createTime,
        lastLoginTime: user.lastLoginTime || new Date(),
        loginCount: user.loginCount || 1,
        isActive: user.isActive !== undefined ? user.isActive : true
      },
      message: isNewUser ? '新用户注册成功' : '登录成功'
    }
    
  } catch (error) {
    console.error('登录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '登录失败，请重试'
    }
  }
}
