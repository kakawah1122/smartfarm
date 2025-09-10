// cloudfunctions/ai-diagnosis/index.js
// AI诊断云函数 - 专门处理AI智能诊断功能
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 生成AI诊断记录ID
function generateAIDiagnosisId() {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `AD${year}${month}${day}${random}`
}

// 调用大模型API进行诊断
async function callAIModel(inputData) {
  try {
    const { symptoms, symptomsText, animalInfo, environmentInfo, images } = inputData

    // 构建AI诊断请求
    const aiRequest = {
      action: 'health_diagnosis',
      model: 'ERNIE-Bot-4.0', // 使用文心一言4.0
      messages: [
        {
          role: 'system',
          content: `你是一位专业的家禽兽医，专精于鹅类疾病诊断。请根据提供的症状信息，给出准确的诊断建议和治疗方案。

诊断规范：
1. 基于症状进行差异诊断
2. 考虑环境因素和鹅只状态
3. 提供置信度评估(0-100)
4. 给出具体治疗建议
5. 建议预防措施

回复格式请使用JSON：
{
  "primaryDiagnosis": {
    "disease": "疾病名称",
    "confidence": 85,
    "reasoning": "诊断依据"
  },
  "differentialDiagnosis": [
    {"disease": "可能疾病1", "confidence": 60},
    {"disease": "可能疾病2", "confidence": 45}
  ],
  "riskFactors": ["风险因素1", "风险因素2"],
  "severity": "mild|moderate|severe",
  "urgency": "low|medium|high|critical",
  "treatmentRecommendation": {
    "immediate": ["立即措施1", "立即措施2"],
    "medication": [
      {
        "name": "药物名称",
        "dosage": "用量",
        "route": "给药途径",
        "frequency": "频率",
        "duration": "疗程",
        "confidence": 90
      }
    ],
    "supportive": ["支持性治疗1", "支持性治疗2"],
    "followUp": {
      "timeline": "复查时间",
      "indicators": ["观察指标1", "观察指标2"]
    }
  },
  "preventionAdvice": ["预防建议1", "预防建议2"]
}`
        },
        {
          role: 'user',
          content: `请诊断以下情况：

动物信息：
- 物种：${animalInfo.species || '鹅'}
- 品种：${animalInfo.breed || '未知'}
- 日龄：${animalInfo.ageInDays || '未知'}日龄
- 数量：${animalInfo.count || 1}只
- 体重：${animalInfo.weight || '未知'}

症状描述：
${symptomsText}

具体症状：
${symptoms.join(', ')}

环境信息：
- 温度：${environmentInfo.temperature || '未知'}°C
- 湿度：${environmentInfo.humidity || '未知'}%
- 通风情况：${environmentInfo.ventilation || '未知'}
- 饲养密度：${environmentInfo.density || '未知'}
- 季节：${environmentInfo.season || '未知'}

${images && images.length > 0 ? `症状图片：${images.length}张（已上传）` : ''}

请进行专业诊断并提供治疗建议。`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    }

    // 调用AI多模型服务
    const aiResult = await cloud.callFunction({
      name: 'ai-multi-model',
      data: aiRequest
    })

    if (aiResult.result && aiResult.result.success) {
      const aiResponse = aiResult.result.data.content

      try {
        // 尝试解析JSON响应
        const diagnosisResult = JSON.parse(aiResponse)
        
        return {
          success: true,
          data: {
            ...diagnosisResult,
            modelInfo: {
              modelName: 'ERNIE-Bot-4.0',
              modelVersion: '4.0',
              provider: 'BaiduQianfan',
              responseTime: aiResult.result.responseTime || 0,
              tokens: aiResult.result.tokens || { input: 0, output: 0, total: 0 },
              cost: aiResult.result.cost || 0
            }
          }
        }
      } catch (parseError) {
        // 如果JSON解析失败，返回原始文本
        console.warn('AI响应JSON解析失败，使用文本解析:', parseError)
        return parseTextResponse(aiResponse, aiResult.result)
      }
    } else {
      throw new Error(aiResult.result?.error || 'AI服务调用失败')
    }
  } catch (error) {
    console.error('调用AI模型失败:', error)
    
    // 返回兜底诊断建议
    return getFallbackDiagnosis(inputData)
  }
}

// 文本响应解析器（兜底方案）
function parseTextResponse(textResponse, aiResult) {
  // 基于关键词的简单解析
  const confidence = extractConfidence(textResponse)
  const disease = extractDisease(textResponse)
  const severity = extractSeverity(textResponse)
  
  return {
    success: true,
    data: {
      primaryDiagnosis: {
        disease: disease || '疑似感染性疾病',
        confidence: confidence || 75,
        reasoning: '基于症状描述的初步分析'
      },
      differentialDiagnosis: [
        { disease: '细菌性感染', confidence: 60 },
        { disease: '病毒性感染', confidence: 45 }
      ],
      riskFactors: ['环境应激', '免疫力低下'],
      severity: severity || 'moderate',
      urgency: 'medium',
      treatmentRecommendation: {
        immediate: ['隔离观察', '保持环境清洁'],
        medication: [{
          name: '广谱抗生素',
          dosage: '按体重计算',
          route: '口服或注射',
          frequency: '每日2次',
          duration: '5-7天',
          confidence: 70
        }],
        supportive: ['加强营养', '保持适宜温度'],
        followUp: {
          timeline: '3天后复查',
          indicators: ['症状改善', '食欲恢复']
        }
      },
      preventionAdvice: ['加强环境管理', '定期健康检查'],
      modelInfo: {
        modelName: 'Text-Parser',
        modelVersion: '1.0',
        provider: 'Fallback',
        responseTime: aiResult?.responseTime || 0,
        tokens: aiResult?.tokens || { input: 0, output: 0, total: 0 },
        cost: aiResult?.cost || 0
      },
      textResponse
    }
  }
}

// 兜底诊断建议
function getFallbackDiagnosis(inputData) {
  const { symptoms, animalInfo } = inputData
  
  // 基于症状的简单规则诊断
  let primaryDisease = '疑似感染性疾病'
  let severity = 'moderate'
  let confidence = 60
  
  if (symptoms.includes('咳嗽') || symptoms.includes('呼吸困难')) {
    primaryDisease = '呼吸道感染'
    confidence = 75
  } else if (symptoms.includes('腹泻') || symptoms.includes('消化不良')) {
    primaryDisease = '消化道疾病'
    confidence = 70
  } else if (symptoms.includes('精神萎靡') || symptoms.includes('食欲不振')) {
    primaryDisease = '全身性感染'
    confidence = 65
  }
  
  if (symptoms.includes('死亡') || symptoms.includes('严重')) {
    severity = 'severe'
    confidence += 10
  }
  
  return {
    success: true,
    data: {
      primaryDiagnosis: {
        disease: primaryDisease,
        confidence: Math.min(confidence, 85),
        reasoning: '基于症状关键词的规则诊断'
      },
      differentialDiagnosis: [
        { disease: '环境应激综合征', confidence: 50 },
        { disease: '营养缺乏症', confidence: 40 }
      ],
      riskFactors: ['环境因素', '管理因素'],
      severity,
      urgency: severity === 'severe' ? 'high' : 'medium',
      treatmentRecommendation: {
        immediate: ['立即隔离', '改善环境条件'],
        medication: [{
          name: '根据具体症状选择药物',
          dosage: '请咨询兽医',
          route: '遵医嘱',
          frequency: '遵医嘱',
          duration: '遵医嘱',
          confidence: 50
        }],
        supportive: ['加强营养管理', '保持环境卫生'],
        followUp: {
          timeline: '建议24小时内复查',
          indicators: ['症状变化', '一般状态']
        }
      },
      preventionAdvice: ['改善饲养管理', '定期健康监控'],
      modelInfo: {
        modelName: 'Rule-Based-Diagnosis',
        modelVersion: '1.0',
        provider: 'Fallback',
        responseTime: 0,
        tokens: { input: 0, output: 0, total: 0 },
        cost: 0
      },
      isFallback: true
    }
  }
}

// 辅助函数：提取置信度
function extractConfidence(text) {
  const confidenceMatch = text.match(/置信度[：:]?\s*(\d+)%?/i) || 
                         text.match(/confidence[：:]?\s*(\d+)/i)
  return confidenceMatch ? parseInt(confidenceMatch[1]) : null
}

// 辅助函数：提取疾病名称
function extractDisease(text) {
  const diseases = [
    '禽流感', '新城疫', '小鹅瘟', '鹅副黏病毒病', 
    '细菌性肝炎', '大肠杆菌病', '沙门氏菌病',
    '呼吸道感染', '消化道感染', '肠炎',
    '营养缺乏', '维生素缺乏', '应激综合征'
  ]
  
  for (const disease of diseases) {
    if (text.includes(disease)) {
      return disease
    }
  }
  
  return null
}

// 辅助函数：提取严重程度
function extractSeverity(text) {
  if (text.includes('严重') || text.includes('重度') || text.includes('severe')) {
    return 'severe'
  } else if (text.includes('中度') || text.includes('moderate')) {
    return 'moderate'
  } else if (text.includes('轻度') || text.includes('轻微') || text.includes('mild')) {
    return 'mild'
  }
  return null
}

// 保存AI诊断记录
async function saveAIDiagnosisRecord(inputData, aiResult, openid) {
  try {
    const recordId = generateAIDiagnosisId()
    
    const diagnosisRecord = {
      _id: recordId,
      _openid: openid,
      healthRecordId: inputData.healthRecordId || null,
      batchId: inputData.batchId || null,
      
      // 输入信息
      input: {
        symptoms: inputData.symptoms || [],
        symptomsText: inputData.symptomsText || '',
        animalInfo: inputData.animalInfo || {},
        environmentInfo: inputData.environmentInfo || {},
        images: inputData.images || []
      },
      
      // AI分析结果
      aiResult: aiResult.data,
      
      // 人工验证状态
      veterinaryReview: {
        reviewed: false,
        reviewerId: null,
        reviewerName: null,
        reviewTime: null,
        agreement: null,
        comments: null,
        adjustments: []
      },
      
      // 结果应用状态
      application: {
        adopted: false,
        adoptedBy: null,
        adoptionTime: null,
        treatmentPlanId: null,
        outcome: null,
        feedback: null
      },
      
      // 系统字段
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      isDeleted: false
    }
    
    await db.collection('ai_diagnosis_history').add({
      data: diagnosisRecord
    })
    
    return {
      success: true,
      data: { recordId, diagnosis: diagnosisRecord },
      message: 'AI诊断记录保存成功'
    }
  } catch (error) {
    console.error('保存AI诊断记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '保存诊断记录失败'
    }
  }
}

exports.main = async (event, context) => {
  const { action } = event
  const openid = cloud.getWXContext().OPENID
  
  console.log('AI诊断云函数调用:', { action, openid, eventKeys: Object.keys(event) })

  try {
    switch (action) {
      case 'ai_diagnosis':
        return await performAIDiagnosis(event, openid)
      case 'get_diagnosis_history':
        return await getDiagnosisHistory(event, openid)
      case 'update_diagnosis_review':
        return await updateDiagnosisReview(event, openid)
      case 'adopt_diagnosis':
        return await adoptDiagnosis(event, openid)
      case 'feedback_diagnosis':
        return await feedbackDiagnosis(event, openid)
      case 'get_diagnosis_stats':
        return await getDiagnosisStats(event, openid)
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    console.error('AI诊断云函数执行失败:', error)
    return {
      success: false,
      error: error.message,
      message: error.message || 'AI诊断服务异常，请重试'
    }
  }
}

// 执行AI诊断
async function performAIDiagnosis(event, openid) {
  try {
    const {
      symptoms,
      symptomsText,
      animalInfo,
      environmentInfo,
      images,
      healthRecordId,
      batchId,
      saveRecord = true
    } = event

    // 验证输入参数
    if (!symptoms || symptoms.length === 0) {
      throw new Error('症状信息不能为空')
    }
    if (!symptomsText || symptomsText.trim() === '') {
      throw new Error('症状描述不能为空')
    }

    const inputData = {
      symptoms,
      symptomsText,
      animalInfo: animalInfo || {},
      environmentInfo: environmentInfo || {},
      images: images || [],
      healthRecordId,
      batchId
    }

    // 调用AI模型进行诊断
    const aiResult = await callAIModel(inputData)
    
    if (!aiResult.success) {
      throw new Error(aiResult.error || 'AI诊断失败')
    }

    let savedRecord = null
    if (saveRecord) {
      // 保存诊断记录
      const saveResult = await saveAIDiagnosisRecord(inputData, aiResult, openid)
      if (saveResult.success) {
        savedRecord = saveResult.data
      }
    }

    return {
      success: true,
      data: {
        diagnosis: aiResult.data,
        savedRecord: savedRecord,
        timestamp: new Date().toISOString()
      },
      message: 'AI诊断完成'
    }
  } catch (error) {
    console.error('执行AI诊断失败:', error)
    return {
      success: false,
      error: error.message,
      message: error.message || 'AI诊断失败'
    }
  }
}

// 获取诊断历史
async function getDiagnosisHistory(event, openid) {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      batchId, 
      reviewed,
      adopted,
      dateRange 
    } = event

    let query = db.collection('ai_diagnosis_history')
      .where({
        _openid: openid,
        isDeleted: _.neq(true)
      })

    if (batchId) {
      query = query.where({ batchId })
    }
    if (reviewed !== undefined) {
      query = query.where({ 'veterinaryReview.reviewed': reviewed })
    }
    if (adopted !== undefined) {
      query = query.where({ 'application.adopted': adopted })
    }
    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const result = await query
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const total = await query.count()

    return {
      success: true,
      data: {
        records: result.data,
        pagination: {
          page,
          pageSize,
          total: total.total,
          totalPages: Math.ceil(total.total / pageSize)
        }
      }
    }
  } catch (error) {
    console.error('获取诊断历史失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 更新诊断审查状态
async function updateDiagnosisReview(event, openid) {
  try {
    const { recordId, reviewData } = event
    const { agreement, comments, adjustments, reviewerName } = reviewData

    const updateData = {
      'veterinaryReview.reviewed': true,
      'veterinaryReview.reviewerId': openid,
      'veterinaryReview.reviewerName': reviewerName || '兽医师',
      'veterinaryReview.reviewTime': new Date().toISOString(),
      'veterinaryReview.agreement': agreement || 'medium',
      'veterinaryReview.comments': comments || '',
      'veterinaryReview.adjustments': adjustments || [],
      updateTime: new Date().toISOString()
    }

    await db.collection('ai_diagnosis_history')
      .doc(recordId)
      .update({
        data: updateData
      })

    return {
      success: true,
      message: '诊断审查更新成功'
    }
  } catch (error) {
    console.error('更新诊断审查失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 采用诊断建议
async function adoptDiagnosis(event, openid) {
  try {
    const { recordId, treatmentPlanId, adopter } = event

    const updateData = {
      'application.adopted': true,
      'application.adoptedBy': openid,
      'application.adoptionTime': new Date().toISOString(),
      'application.treatmentPlanId': treatmentPlanId || null,
      updateTime: new Date().toISOString()
    }

    await db.collection('ai_diagnosis_history')
      .doc(recordId)
      .update({
        data: updateData
      })

    return {
      success: true,
      message: '诊断建议已采用'
    }
  } catch (error) {
    console.error('采用诊断建议失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 诊断反馈
async function feedbackDiagnosis(event, openid) {
  try {
    const { recordId, feedback } = event
    const { useful, accuracy, comments, outcome } = feedback

    const updateData = {
      'application.feedback': {
        useful: useful || true,
        accuracy: accuracy || 5,
        comments: comments || '',
        feedbackTime: new Date().toISOString()
      },
      'application.outcome': outcome || null,
      updateTime: new Date().toISOString()
    }

    await db.collection('ai_diagnosis_history')
      .doc(recordId)
      .update({
        data: updateData
      })

    return {
      success: true,
      message: '诊断反馈提交成功'
    }
  } catch (error) {
    console.error('提交诊断反馈失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取诊断统计
async function getDiagnosisStats(event, openid) {
  try {
    const { dateRange } = event

    let query = db.collection('ai_diagnosis_history')
      .where({
        _openid: openid,
        isDeleted: _.neq(true)
      })

    if (dateRange && dateRange.start && dateRange.end) {
      query = query.where({
        createTime: _.gte(dateRange.start).and(_.lte(dateRange.end))
      })
    }

    const records = await query.get()

    // 统计分析
    const stats = {
      totalDiagnosis: records.data.length,
      reviewedCount: records.data.filter(r => r.veterinaryReview.reviewed).length,
      adoptedCount: records.data.filter(r => r.application.adopted).length,
      avgConfidence: 0,
      diseaseStats: {},
      severityStats: {},
      modelStats: {}
    }

    let totalConfidence = 0
    
    records.data.forEach(record => {
      const confidence = record.aiResult.primaryDiagnosis.confidence || 0
      totalConfidence += confidence

      const disease = record.aiResult.primaryDiagnosis.disease || '未知'
      stats.diseaseStats[disease] = (stats.diseaseStats[disease] || 0) + 1

      const severity = record.aiResult.severity || 'unknown'
      stats.severityStats[severity] = (stats.severityStats[severity] || 0) + 1

      const model = record.aiResult.modelInfo?.modelName || 'unknown'
      stats.modelStats[model] = (stats.modelStats[model] || 0) + 1
    })

    if (records.data.length > 0) {
      stats.avgConfidence = Math.round(totalConfidence / records.data.length)
    }

    // 计算采用率和准确率
    stats.adoptionRate = stats.totalDiagnosis > 0 ? 
      Math.round((stats.adoptedCount / stats.totalDiagnosis) * 100) : 0

    stats.reviewRate = stats.totalDiagnosis > 0 ? 
      Math.round((stats.reviewedCount / stats.totalDiagnosis) * 100) : 0

    return {
      success: true,
      data: stats
    }
  } catch (error) {
    console.error('获取诊断统计失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
