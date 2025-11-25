/**
 * health-treatment 云函数
 * 治疗管理
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
const create_treatment_record = require('./actions/create_treatment_record').main
const update_treatment_record = require('./actions/update_treatment_record').main
const get_treatment_record_detail = require('./actions/get_treatment_record_detail').main
const submit_treatment_plan = require('./actions/submit_treatment_plan').main
const update_treatment_progress = require('./actions/update_treatment_progress').main
const complete_treatment_as_cured = require('./actions/complete_treatment_as_cured').main
const complete_treatment_as_died = require('./actions/complete_treatment_as_died').main
const get_ongoing_treatments = require('./actions/get_ongoing_treatments').main
const add_treatment_note = require('./actions/add_treatment_note').main
const add_treatment_medication = require('./actions/add_treatment_medication').main
const update_treatment_plan = require('./actions/update_treatment_plan').main
const calculate_treatment_cost = require('./actions/calculate_treatment_cost').main
const calculate_batch_treatment_costs = require('./actions/calculate_batch_treatment_costs').main
const get_treatment_history = require('./actions/get_treatment_history').main
const get_treatment_detail = require('./actions/get_treatment_detail').main
const create_treatment_from_diagnosis = require('./actions/create_treatment_from_diagnosis').main
const create_treatment_from_abnormal = require('./actions/create_treatment_from_abnormal').main
const create_treatment_from_vaccine = require('./actions/create_treatment_from_vaccine').main
const fix_treatment_records_openid = require('./actions/fix_treatment_records_openid').main
const get_treatment_statistics = require('./actions/get_treatment_statistics').main

// 导入系统维护功能
const {
  fixDiagnosisTreatmentStatus,
  fixTreatmentRecordsOpenId,
  batchFixDataConsistency,
  recordTreatmentDeath,
  listTreatmentRecords
} = require('./system-maintenance.js')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  console.log('[health-treatment] 执行action:', action)
  
  try {
    switch (action) {
      case 'create_treatment_record':
        return await create_treatment_record(event, wxContext)
      case 'update_treatment_record':
        return await update_treatment_record(event, wxContext)
      case 'get_treatment_record_detail':
        return await get_treatment_record_detail(event, wxContext)
      case 'submit_treatment_plan':
        return await submit_treatment_plan(event, wxContext)
      case 'update_treatment_progress':
        return await update_treatment_progress(event, wxContext)
      case 'complete_treatment_as_cured':
        return await complete_treatment_as_cured(event, wxContext)
      case 'complete_treatment_as_died':
        return await complete_treatment_as_died(event, wxContext)
      case 'get_ongoing_treatments':
        return await get_ongoing_treatments(event, wxContext)
      case 'add_treatment_note':
        return await add_treatment_note(event, wxContext)
      case 'add_treatment_medication':
        return await add_treatment_medication(event, wxContext)
      case 'update_treatment_plan':
        return await update_treatment_plan(event, wxContext)
      case 'calculate_treatment_cost':
        return await calculate_treatment_cost(event, wxContext)
      case 'calculate_batch_treatment_costs':
        return await calculate_batch_treatment_costs(event, wxContext)
      case 'get_treatment_history':
        return await get_treatment_history(event, wxContext)
      case 'get_treatment_detail':
        return await get_treatment_detail(event, wxContext)
      case 'create_treatment_from_diagnosis':
        return await create_treatment_from_diagnosis(event, wxContext)
      case 'create_treatment_from_abnormal':
        return await create_treatment_from_abnormal(event, wxContext)
      case 'create_treatment_from_vaccine':
        return await create_treatment_from_vaccine(event, wxContext)
      case 'get_cured_records_list':
        const get_cured_records_list = require('./actions/get_cured_records_list')
        return await get_cured_records_list.main(event, wxContext)
      case 'get_treatment_statistics':
        return await get_treatment_statistics(event, wxContext)
      case 'list_treatment_records':
        return await listTreatmentRecords(event, wxContext)
      case 'record_treatment_death':
        return await recordTreatmentDeath(event, wxContext)
      
      // 系统维护功能
      case 'fix_diagnosis_treatment_status':
        return await fixDiagnosisTreatmentStatus(event, wxContext.OPENID)
      case 'fix_treatment_records_openid':
        return await fixTreatmentRecordsOpenId(event, wxContext.OPENID)
      case 'batch_fix_data_consistency':
        return await batchFixDataConsistency(event, wxContext.OPENID)
      
      default:
        return {
          success: false,
          error: `不支持的操作: ${action}`
        }
    }
  } catch (error) {
    console.error('[health-treatment] 执行失败:', error)
    return {
      success: false,
      error: error.message || '执行失败'
    }
  }
}
