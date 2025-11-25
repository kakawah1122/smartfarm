/**
 * health-records 云函数
 * 健康记录管理
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
const create_health_record = require('./actions/create_health_record').main
const list_health_records = require('./actions/list_health_records').main
const update_health_record = require('./actions/update_health_record').main
const delete_health_record = require('./actions/delete_health_record').main
const get_health_record_detail = require('./actions/get_health_record_detail').main
const get_health_records_by_status = require('./actions/get_health_records_by_status').main
const get_batch_health_summary = require('./actions/get_batch_health_summary').main
const calculate_health_rate = require('./actions/calculate_health_rate').main

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  // 执行action日志已关闭
  
  try {
    switch (action) {
      case 'create_health_record':
        return await create_health_record(event, wxContext)
      case 'list_health_records':
        return await list_health_records(event, wxContext)
      case 'update_health_record':
        return await update_health_record(event, wxContext)
      case 'delete_health_record':
        return await delete_health_record(event, wxContext)
      case 'get_health_record_detail':
        return await get_health_record_detail(event, wxContext)
      case 'get_health_records_by_status':
        return await get_health_records_by_status(event, wxContext)
      case 'get_batch_health_summary':
        return await get_batch_health_summary(event, wxContext)
      case 'calculate_health_rate':
        return await calculate_health_rate(event, wxContext)
      
      default:
        return {
          success: false,
          error: `不支持的操作: ${action}`
        }
    }
  } catch (error) {
    console.error('[health-records] 执行失败:', error)
    return {
      success: false,
      error: error.message || '执行失败'
    }
  }
}
