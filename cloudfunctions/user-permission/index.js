/**
 * user-permission 云函数
 * 权限管理
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
const assign_role = require('./actions/assign_role').main
const check_permission = require('./actions/check_permission').main
const get_user_permissions = require('./actions/get_user_permissions').main
const update_permissions = require('./actions/update_permissions').main
const get_role_list = require('./actions/get_role_list').main
const create_role = require('./actions/create_role').main
const update_role = require('./actions/update_role').main

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  console.log('[user-permission] 执行action:', action)
  
  try {
    switch (action) {
      case 'assign_role':
        return await assign_role(event, wxContext)
      case 'check_permission':
        return await check_permission(event, wxContext)
      case 'get_user_permissions':
        return await get_user_permissions(event, wxContext)
      case 'update_permissions':
        return await update_permissions(event, wxContext)
      case 'get_role_list':
        return await get_role_list(event, wxContext)
      case 'create_role':
        return await create_role(event, wxContext)
      case 'update_role':
        return await update_role(event, wxContext)
      
      default:
        return {
          success: false,
          error: `不支持的操作: ${action}`
        }
    }
  } catch (error) {
    console.error('[user-permission] 执行失败:', error)
    return {
      success: false,
      error: error.message || '执行失败'
    }
  }
}
