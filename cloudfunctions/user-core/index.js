/**
 * user-core 云函数
 * 用户核心功能
 * 
 * 拆分自大型云函数，遵循单一职责原则
 */

const cloud = require('wx-server-sdk')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 导入业务逻辑处理函数
const create_user = require('./actions/create_user').main
const update_user = require('./actions/update_user').main
const get_user_info = require('./actions/get_user_info').main
const delete_user = require('./actions/delete_user').main
const update_avatar = require('./actions/update_avatar').main
const get_user_profile = require('./actions/get_user_profile').main
const update_user_settings = require('./actions/update_user_settings').main

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  // 执行action日志已关闭
  
  try {
    switch (action) {
      case 'create_user':
        return await create_user(event, wxContext)
      case 'update_user':
        return await update_user(event, wxContext)
      case 'get_user_info':
        return await get_user_info(event, wxContext)
      case 'delete_user':
        return await delete_user(event, wxContext)
      case 'update_avatar':
        return await update_avatar(event, wxContext)
      case 'get_user_profile':
        return await get_user_profile(event, wxContext)
      case 'update_user_settings':
        return await update_user_settings(event, wxContext)
      
      default:
        return {
          success: false,
          error: `不支持的操作: ${action}`
        }
    }
  } catch (error) {
    console.error('[user-core] 执行失败:', error)
    return {
      success: false,
      error: error.message || '执行失败'
    }
  }
}
