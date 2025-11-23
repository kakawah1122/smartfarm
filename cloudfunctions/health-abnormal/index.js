/**
 * health-abnormal 云函数
 * 负责健康管理异常记录相关功能
 * 从 health-management 拆分出来的独立模块
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 引入共享的集合配置
const { COLLECTIONS } = require('./collections.js')

/**
 * 创建异常记录（兼容原有数据结构）
 */
async function createAbnormalRecord(event, wxContext) {
  try {
    const {
      diagnosisId,
      batchId,
      batchNumber,
      affectedCount,
      symptoms,
      diagnosisType = 'live_diagnosis',
      diagnosis,
      diagnosisConfidence,
      diagnosisDetails,
      severity,
      urgency,
      aiRecommendation,
      images,
      autopsyDescription,
      deathCount
    } = event
    const openid = wxContext.OPENID
    
    // 构建记录数据（兼容原有结构）
    const recordData = {
      batchId,
      batchNumber,
      diagnosisId,
      relatedDiagnosisId: diagnosisId,
      recordType: 'ai_diagnosis',  // 重要：标识为AI诊断记录
      diagnosisType,
      checkDate: new Date().toISOString().split('T')[0],
      reporter: openid,
      status: 'abnormal',  // 重要：异常状态
      affectedCount: affectedCount || 0,
      symptoms: symptoms || '',
      diagnosis: diagnosis || '',
      diagnosisConfidence: diagnosisConfidence || 0,
      diagnosisDetails: diagnosisDetails || null,
      severity: severity || 'unknown',
      urgency: urgency || 'unknown',
      aiRecommendation: aiRecommendation || null,
      images: images || [],
      autopsyDescription: autopsyDescription || '',
      deathCount: deathCount || 0,
      totalDeathCount: deathCount || 0,
      isDeleted: false,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
    
    // 使用 HEALTH_RECORDS 集合（与原系统保持一致）
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .add({
        data: recordData
      })
    
    return {
      success: true,
      data: {
        recordId: result._id,
        message: '异常记录创建成功'
      }
    }
  } catch (error) {
    console.error('[createAbnormalRecord] 错误:', error)
    return {
      success: false,
      error: error.message || '创建异常记录失败'
    }
  }
}

/**
 * 获取异常记录列表（兼容原有数据结构）
 */
async function listAbnormalRecords(event, wxContext) {
  try {
    const {
      batchId,
      page = 1,
      pageSize = 20,
      status,
      startDate,
      endDate
    } = event
    const openid = wxContext.OPENID
    
    // 构建查询条件（兼容原有结构）
    let conditions = {
      recordType: 'ai_diagnosis',  // 筛选AI诊断记录
      status: _.in(['abnormal', 'treating']),  // 显示异常和治疗中的记录
      isDeleted: _.neq(true)  // 未删除的记录
    }
    
    if (batchId && batchId !== 'all') {
      conditions.batchId = batchId
    }
    
    if (status) {
      conditions.status = status
    }
    
    if (startDate && endDate) {
      conditions.checkDate = _.and(_.gte(startDate), _.lte(endDate))
    }
    
    // 计算跳过的记录数
    const skip = (page - 1) * pageSize
    
    // 查询总数
    const countResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where(conditions)
      .count()
    
    // 查询列表
    const listResult = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .where(conditions)
      .orderBy('checkDate', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    return {
      success: true,
      data: {
        total: countResult.total,
        page,
        pageSize,
        list: listResult.data
      }
    }
  } catch (error) {
    console.error('[listAbnormalRecords] 错误:', error)
    return {
      success: false,
      error: error.message || '获取异常记录列表失败'
    }
  }
}

/**
 * 获取异常记录详情
 */
async function getAbnormalRecordDetail(event, wxContext) {
  try {
    const { recordId } = event
    
    if (!recordId) {
      return {
        success: false,
        error: '缺少记录ID'
      }
    }
    
    // 获取记录详情
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .get()
    
    if (!result.data) {
      return {
        success: false,
        error: '记录不存在'
      }
    }
    
    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    console.error('[getAbnormalRecordDetail] 错误:', error)
    return {
      success: false,
      error: error.message || '获取异常记录详情失败'
    }
  }
}

/**
 * 更新异常记录状态
 */
async function updateAbnormalStatus(event, wxContext) {
  try {
    const { recordId, status, note } = event
    const openid = wxContext.OPENID
    
    if (!recordId || !status) {
      return {
        success: false,
        error: '缺少必要参数'
      }
    }
    
    // 更新数据
    const updateData = {
      status,
      updateTime: db.serverDate(),
      updatedBy: openid
    }
    
    if (note) {
      updateData.statusNote = note
    }
    
    // 执行更新
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .update({
        data: updateData
      })
    
    return {
      success: true,
      data: {
        updated: result.stats.updated,
        message: '状态更新成功'
      }
    }
  } catch (error) {
    console.error('[updateAbnormalStatus] 错误:', error)
    return {
      success: false,
      error: error.message || '更新异常状态失败'
    }
  }
}

/**
 * 获取异常统计数据
 */
async function getAbnormalStats(event, wxContext) {
  try {
    const { batchId, dateRange } = event
    const openid = wxContext.OPENID
    
    // 构建查询条件（兼容原有结构）
    let conditions = {
      recordType: 'ai_diagnosis',  // 筛选AI诊断记录
      isDeleted: _.neq(true)  // 未删除的记录
    }
    
    if (batchId && batchId !== 'all') {
      conditions.batchId = batchId
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
      conditions.checkDate = _.and(_.gte(dateRange.start), _.lte(dateRange.end))
    }
    
    // 并行查询各状态数量
    const [
      pendingResult,
      processingResult,
      resolvedResult,
      totalResult
    ] = await Promise.all([
      // 待处理（异常状态）
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({ ...conditions, status: 'abnormal' })
        .count(),
      
      // 处理中（治疗中）
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({ ...conditions, status: 'treating' })
        .count(),
      
      // 已解决（已治愈）
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where({ ...conditions, status: 'cured' })
        .count(),
      
      // 总数
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .where(conditions)
        .count()
    ])
    
    return {
      success: true,
      data: {
        pending: pendingResult.total,
        processing: processingResult.total,
        resolved: resolvedResult.total,
        total: totalResult.total,
        resolveRate: totalResult.total > 0 
          ? ((resolvedResult.total / totalResult.total) * 100).toFixed(2)
          : '0.00'
      }
    }
  } catch (error) {
    console.error('[getAbnormalStats] 错误:', error)
    return {
      success: false,
      error: error.message || '获取异常统计失败'
    }
  }
}

/**
 * 纠正异常诊断
 */
async function correctAbnormalDiagnosis(event, wxContext) {
  try {
    const { recordId, correctDiagnosis, correctSuggestion } = event
    const openid = wxContext.OPENID
    
    if (!recordId || !correctDiagnosis) {
      return {
        success: false,
        error: '缺少必要参数'
      }
    }
    
    // 更新诊断信息
    const updateData = {
      correctDiagnosis,
      correctSuggestion: correctSuggestion || '',
      correctedBy: openid,
      correctedAt: db.serverDate(),
      updateTime: db.serverDate()
    }
    
    const result = await db.collection(COLLECTIONS.HEALTH_RECORDS)
      .doc(recordId)
      .update({
        data: updateData
      })
    
    return {
      success: true,
      data: {
        updated: result.stats.updated,
        message: '诊断纠正成功'
      }
    }
  } catch (error) {
    console.error('[correctAbnormalDiagnosis] 错误:', error)
    return {
      success: false,
      error: error.message || '纠正诊断失败'
    }
  }
}

/**
 * 批量删除异常记录（软删除）
 */
async function deleteAbnormalRecords(event, wxContext) {
  try {
    const { recordIds } = event
    const openid = wxContext.OPENID
    
    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return {
        success: false,
        error: '缺少要删除的记录ID'
      }
    }
    
    // 批量软删除
    const tasks = recordIds.map(id => 
      db.collection(COLLECTIONS.HEALTH_RECORDS)
        .doc(id)
        .update({
          data: {
            isDeleted: true,
            updatedAt: db.serverDate()
          }
        })
    )
    
    const results = await Promise.all(tasks)
    
    const deletedCount = results.reduce((sum, r) => sum + r.stats.updated, 0)
    
    return {
      success: true,
      data: {
        deletedCount,
        message: `成功删除 ${deletedCount} 条记录`
      }
    }
  } catch (error) {
    console.error('[deleteAbnormalRecords] 错误:', error)
    return {
      success: false,
      error: error.message || '删除记录失败'
    }
  }
}

// 主函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action } = event
  
  try {
    switch (action) {
      case 'create_abnormal_record':
        return await createAbnormalRecord(event, wxContext)
      
      case 'list_abnormal_records':
        return await listAbnormalRecords(event, wxContext)
      
      case 'get_abnormal_records':
        return await listAbnormalRecords(event, wxContext)
      
      case 'get_abnormal_record_detail':
        return await getAbnormalRecordDetail(event, wxContext)
      
      case 'update_abnormal_status':
        return await updateAbnormalStatus(event, wxContext)
      
      case 'get_abnormal_stats':
        return await getAbnormalStats(event, wxContext)
      
      case 'correct_abnormal_diagnosis':
        return await correctAbnormalDiagnosis(event, wxContext)
      
      case 'delete_abnormal_records':
        return await deleteAbnormalRecords(event, wxContext)
      
      default:
        return {
          success: false,
          error: `未知的 action: ${action}`
        }
    }
  } catch (error) {
    console.error('[health-abnormal] 云函数错误:', error)
    return {
      success: false,
      error: error.message || '云函数执行失败'
    }
  }
}
