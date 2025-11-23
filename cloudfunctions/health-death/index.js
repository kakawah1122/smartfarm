/**
 * health-death 云函数
 * 死亡记录管理
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
const create_death_record = require('./actions/create_death_record').main
const createDeathRecord = require('./actions/createDeathRecord').main
const list_death_records = require('./actions/list_death_records').main
const listDeathRecords = require('./actions/listDeathRecords').main
const get_death_stats = require('./actions/get_death_stats').main
const getDeathStats = require('./actions/getDeathStats').main
const get_death_record_detail = require('./actions/get_death_record_detail').main
const create_death_record_with_finance = require('./actions/create_death_record_with_finance').main
const correct_death_diagnosis = require('./actions/correct_death_diagnosis').main
const create_death_from_vaccine = require('./actions/create_death_from_vaccine').main
const get_death_records_list = require('./actions/get_death_records_list').main
const fix_batch_death_count = require('./actions/fix_batch_death_count').main

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  console.log('[health-death] 执行action:', action)
  
  try {
    switch (action) {
      case 'create_death_record':
        return await create_death_record(event, wxContext)
      case 'createDeathRecord':
        return await createDeathRecord(event, wxContext)
      case 'list_death_records':
        return await list_death_records(event, wxContext)
      case 'listDeathRecords':
        return await listDeathRecords(event, wxContext)
      case 'get_death_stats':
        return await get_death_stats(event, wxContext)
      case 'getDeathStats':
        return await getDeathStats(event, wxContext)
      case 'get_death_record_detail':
        return await get_death_record_detail(event, wxContext)
      case 'create_death_record_with_finance':
        return await create_death_record_with_finance(event, wxContext)
      case 'correct_death_diagnosis':
        return await correct_death_diagnosis(event, wxContext)
      case 'create_death_from_vaccine':
        return await create_death_from_vaccine(event, wxContext)
      case 'get_death_records_list':
        return await get_death_records_list(event, wxContext)
      case 'fix_batch_death_count':
        return await fix_batch_death_count(event, wxContext)
      
      default:
        return {
          success: false,
          error: `不支持的操作: ${action}`
        }
    }
  } catch (error) {
    console.error('[health-death] 执行失败:', error)
    return {
      success: false,
      error: error.message || '执行失败'
    }
  }
}
