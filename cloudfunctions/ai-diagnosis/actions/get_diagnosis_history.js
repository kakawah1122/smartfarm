/**
 * 获取诊断历史记录
 * 从health-management迁移
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 引入共享的集合配置
const { COLLECTIONS } = require('../collections.js')

// 数据库管理器
const dbManager = {
  buildNotDeletedCondition: function(includeDeleted = false) {
    if (!includeDeleted) {
      return { isDeleted: _.neq(true) }
    }
    return {}
  }
}

exports.main = async (event, wxContext) => {
  try {
    const {
      batchId,
      limit = 20,
      page = 1,
      dateRange,  // 支持日期范围筛选
      recentDays  // 新增：近N天筛选
    } = event
    const openid = wxContext.OPENID

    // 构建查询条件
    let whereCondition = {
      _openid: openid,
      ...dbManager.buildNotDeletedCondition(true)
    }

    // 诊断记录不受批次筛选影响，始终显示所有批次的记录

    // 如果指定了日期范围，添加日期过滤；否则若传入 recentDays，则按近N天过滤
    if (dateRange && dateRange.start && dateRange.end) {
      whereCondition.createTime = _.gte(dateRange.start).and(_.lte(dateRange.end + 'T23:59:59'))
    } else if (recentDays && Number(recentDays) > 0) {
      const now = new Date()
      const start = new Date(now.getTime() - Number(recentDays) * 24 * 60 * 60 * 1000)
      whereCondition.createTime = _.gte(start.toISOString()).and(_.lte(now.toISOString()))
    }

    let query = db.collection(COLLECTIONS.HEALTH_AI_DIAGNOSIS).where(whereCondition)

    // 查询数据
    const skip = (page - 1) * limit
    const result = await query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    // 映射数据库字段到前端期望的格式
    const mappedRecords = result.data.map(record => {
      // 修复：支持新旧两种数据结构
      // 新结构：record.result (从 process-ai-diagnosis 保存)
      // 旧结构：record.aiResult (从旧版本保存)
      const aiResult = record.result || record.aiResult || {}
      
      // 支持病鹅诊断和死因剖析两种类型
      const primaryDiagnosis = aiResult.primaryDiagnosis || aiResult.primaryCause || {}
      const treatmentRecommendation = aiResult.treatmentRecommendation || {}
      
      // 处理用药建议（支持多种格式）
      const medications = treatmentRecommendation.medication || 
                         treatmentRecommendation.medications || 
                         []
      
      // 修复：直接从顶层字段读取，而不是从 input.animalInfo
      const symptoms = record.symptomsText || (Array.isArray(record.symptoms) ? record.symptoms.join('、') : '') || ''
      // 修复：死因剖析使用deathCount，病鹅诊断使用affectedCount
      const affectedCount = record.diagnosisType === 'autopsy_analysis' 
        ? (record.deathCount || 0) 
        : (record.affectedCount || 0)
      const dayAge = record.dayAge || 0
      
      return {
        _id: record._id,
        // 诊断结果
        diagnosisResult: primaryDiagnosis.disease || '未知疾病',
        diagnosis: primaryDiagnosis.disease || '未知疾病',
        confidence: primaryDiagnosis.confidence || 0,
        
        // 症状和输入信息
        symptoms: symptoms,
        affectedCount: affectedCount,
        dayAge: dayAge,
        temperature: 0, // 暂不使用
        
        // 诊断图片（症状图片或剖检图片）
        images: record.images || [],
        diagnosisType: record.diagnosisType || 'live_diagnosis',
        
        // 治疗方案
        // 修复：治疗周期的获取逻辑
        treatmentDuration: (() => {
          if (aiResult.followUp?.reviewInterval) {
            return aiResult.followUp.reviewInterval
          } else if (treatmentRecommendation.followUp?.timeline) {
            return treatmentRecommendation.followUp.timeline
          } else if (medications.length > 0 && medications[0].duration) {
            return medications[0].duration
          }
          return '未知'
        })(),
        recommendedMedications: medications.map(med => 
          typeof med === 'string' ? med : (med.name || med.medication || '')
        ).filter(m => m),
        
        // 其他可能的疾病
        possibleDiseases: (aiResult.differentialDiagnosis || aiResult.differentialCauses || []).map(dd => ({
          name: dd.disease || '',
          confidence: dd.confidence || 0
        })),
        
        // 修复：时间格式处理
        createTime: (() => {
          if (record.createdAt) {
            return typeof record.createdAt === 'string' 
              ? record.createdAt 
              : record.createdAt.toISOString()
          } else if (record.createTime) {
            return typeof record.createTime === 'string' 
              ? record.createTime 
              : record.createTime.toISOString()
          }
          return ''
        })(),
        diagnosisDate: (() => {
          const createTimeStr = record.createdAt || record.createTime || ''
          if (!createTimeStr) return ''
          
          try {
            const date = new Date(createTimeStr)
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          } catch (e) {
            return ''
          }
        })(),
        
        // 原始数据
        originalRecord: record
      }
    })

    // 获取总数
    const countResult = await query.count()
    const total = countResult.total || 0

    return {
      success: true,
      data: {
        records: mappedRecords,
        total,
        page,
        pageSize: limit,
        hasMore: total > page * limit
      },
      message: '获取诊断历史成功'
    }

  } catch (error) {
    console.error('[getDiagnosisHistory] 错误:', error)
    return {
      success: false,
      error: error.message,
      message: '获取诊断历史失败'
    }
  }
}
