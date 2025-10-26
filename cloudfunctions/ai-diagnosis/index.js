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

// 获取病鹅诊断的系统提示词
function getLiveDiagnosisSystemPrompt() {
  return `你是一位专业的家禽兽医，专精于鹅类疾病诊断。请根据提供的症状信息，给出准确的诊断建议和治疗方案。

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
        "duration": "疗程"
      }
    ],
    "supportive": ["支持性治疗1", "支持性治疗2"]
  },
  "preventionAdvice": ["预防建议1", "预防建议2"]
}`
}

// 获取死因剖析的系统提示词
function getAutopsySystemPrompt() {
  return `你是一位经验丰富的家禽病理学专家，专精于鹅类尸体解剖和死因分析。
请根据提供的生前症状、剖检所见和解剖发现，准确判断死亡原因。

分析规范：
1. 结合生前症状和剖检发现进行综合判断
2. 重点分析内脏病变与疾病的对应关系
3. 评估死因的置信度(0-100)
4. 提供针对性的预防措施
5. 建议生物安全改进方向
6. 理解农民的白话描述（如"肠子里面全是血"、"肝脏有很多白点"等）

回复格式请使用JSON：
{
  "primaryCause": {
    "disease": "死因名称",
    "confidence": 85,
    "reasoning": "判断依据（结合症状和剖检发现）",
    "autopsyEvidence": ["解剖证据1", "解剖证据2"]
  },
  "differentialCauses": [
    {"disease": "可能死因1", "confidence": 60},
    {"disease": "可能死因2", "confidence": 45}
  ],
  "pathologicalFindings": {
    "summary": "病理变化总结",
    "keyFindings": ["关键发现1", "关键发现2"]
  },
  "preventionMeasures": ["预防措施1", "预防措施2"],
  "biosecurityAdvice": ["生物安全建议1", "建议2"],
  "epidemiologyRisk": "low|medium|high"
}`
}

// 获取死因剖析的增强版系统提示词（包含历史案例学习）
function getAutopsySystemPromptV2(historyCases = []) {
  let casesSection = ''
  
  if (historyCases.length > 0) {
    casesSection = `

【历史准确诊断参考案例】
以下是本养殖场近期确诊的真实病例，供参考学习：

${historyCases.map((c, i) => `
案例${i+1}：${c.correctDiagnosis}（诊断准确性：${c.finalRating}星/5星）
  • 动物信息：日龄${c.dayAge}天，死亡${c.deathCount}只
  • 生前症状：${c.symptomsText || c.symptoms || '未详细观察'}
  • 剖检发现：${c.autopsyAbnormalities}
  ${c.autopsyDescription ? `• 农民描述：${c.autopsyDescription}` : ''}
  • AI初步判断：${c.aiInitialDiagnosis}
  • 兽医最终确诊：${c.correctDiagnosis}
  • 修正依据：${c.correctionReason}
`).join('\n')}

【学习要点】
1. 参考这些案例的症状-疾病对应关系
2. 注意兽医的修正理由，避免类似误判
3. 关注本养殖场的常见疾病模式
4. 特别注意剖检病变的鉴别诊断要点
`
  }
  
  return `你是一位经验丰富的家禽病理学专家，专精于鹅类尸体解剖和死因分析。
请根据提供的生前症状、剖检所见和解剖发现，准确判断死亡原因。

分析规范：
1. 结合生前症状和剖检发现进行综合判断
2. 重点分析内脏病变与疾病的对应关系
3. 评估死因的置信度(0-100)
4. 提供针对性的预防措施
5. 建议生物安全改进方向
6. 理解农民的白话描述（如"肠子里面全是血"、"肝脏有很多白点"等）
${casesSection}

回复格式请使用JSON：
{
  "primaryCause": {
    "disease": "死因名称",
    "confidence": 85,
    "reasoning": "判断依据（结合症状和剖检发现）",
    "autopsyEvidence": ["解剖证据1", "解剖证据2"]
  },
  "differentialCauses": [
    {"disease": "可能死因1", "confidence": 60},
    {"disease": "可能死因2", "confidence": 45}
  ],
  "pathologicalFindings": {
    "summary": "病理变化总结",
    "keyFindings": ["关键发现1", "关键发现2"]
  },
  "preventionMeasures": ["预防措施1", "预防措施2"],
  "biosecurityAdvice": ["生物安全建议1", "建议2"],
  "epidemiologyRisk": "low|medium|high"
}`
}

// 获取疾病特征知识库提示词
function getDiseaseKnowledgePrompt() {
  return `

【常见鹅病特征速查表】

1. 小鹅瘟（雏鹅高发）
  • 易感日龄：1-15天（高峰期3-7天）
  • 典型症状：精神萎靡、拉白色或绿色水样稀便、突然死亡
  • 剖检特征：
    - 小肠表面有白色或黄白色纤维素性假膜（特征性）
    - 肝脏有针尖至小米粒大小白色坏死灶
    - 肠道充血出血
  • 鉴别要点：纤维素性假膜是关键，区别于大肠杆菌病

2. 鹅副粘病毒病（中大鹅常见）
  • 易感日龄：30-90天
  • 典型症状：神经症状明显（扭颈、瘫痪、转圈）、拉绿色稀便
  • 剖检特征：
    - 脑膜充血水肿
    - 心内膜及心外膜出血点
    - 腺胃出血
  • 鉴别要点：神经症状是关键特征

3. 维生素缺乏症
  • 易感日龄：10-30天
  • 典型症状：腿软、站立困难、生长迟缓、无神经症状
  • 剖检特征：
    - 骨骼软化、易折断
    - 内脏器官无明显病变（重要）
  • 鉴别要点：内脏正常但骨骼异常

4. 大肠杆菌病
  • 易感日龄：全日龄（尤其15-45天）
  • 典型症状：急性死亡、腹泻、呼吸困难
  • 剖检特征：
    - 心包炎、肝周炎、气囊炎（三炎并存）
    - 黄色纤维素性渗出物
    - 肠道可能有出血但无假膜
  • 鉴别要点：纤维素渗出但无肠道假膜

5. 鸭瘟（鹅瘟）
  • 易感日龄：20天以上
  • 典型症状：体温升高、流泪、下痢、头颈肿胀
  • 剖检特征：
    - 食道和泄殖腔黏膜出血、溃疡、假膜
    - 肝脏肿大有坏死灶
  • 鉴别要点：食道和泄殖腔病变

【诊断原则】
1. 先看日龄：缩小疾病范围
2. 看剖检：内脏病变最可靠
3. 看症状：辅助判断
4. 多鉴别：列出2-3个可能
5. 给置信度：不确定时说明原因
`
}

/**
 * 获取历史高准确率案例（用于Few-Shot Learning）
 * @param {number} limit - 返回案例数量
 * @returns {Promise<Array>} 案例列表
 */
async function getTopAccuracyCases(limit = 5) {
  try {
    const result = await db.collection('health_death_records')
      .where({
        isCorrected: true,
        aiAccuracyRating: _.gte(4) // 评分≥4星
      })
      .orderBy('aiAccuracyRating', 'desc')
      .orderBy('correctedAt', 'desc')
      .limit(limit)
      .get()
    
    if (!result.data || result.data.length === 0) {
      return []
    }
    
    return result.data.map(record => {
      const symptoms = record.diagnosisResult?.symptoms || []
      const autopsyAbnormalities = record.autopsyFindings?.abnormalities || []
      
      return {
        // 症状信息
        symptoms: symptoms.join('、') || '未详细记录',
        symptomsText: record.diagnosisResult?.symptomsText || '',
        
        // 剖检发现
        autopsyAbnormalities: autopsyAbnormalities.join('、') || '未详细记录',
        autopsyDescription: record.autopsyFindings?.description || '',
        
        // 诊断结果
        aiInitialDiagnosis: record.deathCause,
        correctDiagnosis: record.correctedCause,
        correctionReason: record.correctionReason,
        
        // 动物信息
        dayAge: record.diagnosisResult?.animalInfo?.dayAge || '未知',
        deathCount: record.deathCount || 1,
        
        // 可信度
        finalRating: record.aiAccuracyRating
      }
    })
  } catch (error) {
    console.error('获取历史案例失败:', error)
    return [] // 失败时返回空数组，不影响正常诊断流程
  }
}

// 构建病鹅诊断的用户消息
function buildLiveDiagnosisUserMessage(symptomsText, symptoms, animalInfo, environmentInfo, images) {
  return `请诊断以下鹅群情况：

症状描述：
${symptomsText}

具体症状：
${symptoms.join(', ')}

动物信息：
- 日龄：${animalInfo.dayAge || '未知'}天
- 数量：${animalInfo.count || 1}只
- 种类：${animalInfo.species || '狮头鹅'}

环境信息：
- 温度：${environmentInfo.temperature || '未知'}°C
- 湿度：${environmentInfo.humidity || '未知'}%

${images && images.length > 0 ? `症状图片：${images.length}张（已上传）` : ''}

请进行专业诊断并提供治疗建议。`
}

// 构建死因剖析的用户消息
function buildAutopsyUserMessage(symptomsText, symptoms, animalInfo, autopsyFindings, images) {
  const abnormalities = autopsyFindings?.abnormalities || []
  const description = autopsyFindings?.description || ''
  
  return `请分析以下鹅只的死亡原因：

动物信息：
- 日龄：${animalInfo.dayAge || '未知'}天
- 死亡数量：${animalInfo.deathCount || 1}只
- 种类：${animalInfo.species || '狮头鹅'}

生前症状：
${symptomsText || '无明显症状或未观察到'}
${symptoms && symptoms.length > 0 ? `\n具体表现：${symptoms.join('、')}` : ''}

剖检发现：
${abnormalities.length > 0 ? `\n观察到的异常：\n${abnormalities.map((item, i) => `${i+1}. ${item}`).join('\n')}` : ''}
${description ? `\n农民描述：${description}` : ''}

${images && images.length > 0 ? `\n剖检照片：${images.length}张（已上传）` : ''}

请根据以上信息进行死因分析，并提供预防建议。`
}

// 构建批次上下文信息
function buildBatchContextSection(batchPromptData) {
  if (!batchPromptData || Object.keys(batchPromptData).length === 0) {
    return ''
  }

  const { batch = {}, stats = {}, diagnosisTrend = [], treatmentHistory = [], isolationHistory = [], deathHistory = [], correctionFeedback = [] } = batchPromptData

  const batchLines = []
  batchLines.push('\n【狮头鹅批次基线数据】')
  batchLines.push(`- 批次编号：${batch.batchNumber || '未知'}`)
  batchLines.push(`- 入栏日龄：第${batch.dayAge || '未知'}天，入栏日期：${batch.entryDate || '未知'}`)
  batchLines.push(`- 当前总鹅数：${stats.totalAnimals ?? '未知'}，健康：${stats.healthyCount ?? '未知'}，患病：${stats.sickCount ?? '未知'}，死亡累计：${stats.deadCount ?? '未知'}`)
  batchLines.push(`- 异常记录数：${stats.abnormalCount ?? 0}，治疗中：${stats.treatingCount ?? 0}，隔离中：${stats.isolatedCount ?? 0}`)
  batchLines.push(`- 批次基础信息：品种${batch.breed || '狮头鹅'}，来源${batch.supplier || '未知'}，饲料/营养记录：${batch.feedType || '未记录'}`)

  if (diagnosisTrend && diagnosisTrend.length > 0) {
    batchLines.push('\n【近期异常/诊断记录】')
    diagnosisTrend.slice(0, 5).forEach((record, index) => {
      batchLines.push(`案例${index + 1}（${record.checkDate || '未知日期'}）：诊断 ${record.diagnosis || '未知'}，症状 ${Array.isArray(record.symptoms) ? record.symptoms.join('、') : '未记录'}，病鹅数 ${record.sickCount || 0} 只，严重度 ${record.severity || '未注明'}`)
    })
  }

  if (treatmentHistory && treatmentHistory.length > 0) {
    batchLines.push('\n【近期治疗记录】')
    treatmentHistory.slice(0, 3).forEach((record, index) => {
      batchLines.push(`治疗${index + 1}（${record.treatmentDate || '未知日期'}）：诊断 ${record.diagnosis || '未知'}，方案 ${record.treatmentPlan || '未记录'}，药物 ${Array.isArray(record.medications) ? record.medications.map(m => `${m.name}(${m.dosage})`).join('、') : '未记录'}，疗效 ${record.outcome || '进行中'}`)
    })
  }

  if (isolationHistory && isolationHistory.length > 0) {
    batchLines.push('\n【隔离观察记录】')
    isolationHistory.slice(0, 3).forEach((record, index) => {
      batchLines.push(`隔离${index + 1}（${record.startDate || '未知开始'}）：原因 ${record.reason || '未记录'}，状态 ${record.status || '未记录'}，备注 ${record.notes || '无'}`)
    })
  }

  if (deathHistory && deathHistory.length > 0) {
    batchLines.push('\n【死亡记录】')
    deathHistory.slice(0, 5).forEach((record, index) => {
      batchLines.push(`死亡${index + 1}（${record.deathDate || '未知日期'}）：死亡 ${record.deathCount || 0} 只，AI初判 ${record.aiDiagnosis || '未知'}，兽医修正 ${record.correctedDiagnosis || '无'}，评分 ${record.aiAccuracyRating || '未评分'}，修正原因 ${record.correctionReason || '未提供'}`)
    })
  }

  if (correctionFeedback && correctionFeedback.length > 0) {
    batchLines.push('\n【AI修正反馈】')
    correctionFeedback.slice(0, 10).forEach((record, index) => {
      batchLines.push(`反馈${index + 1}：原诊断已被修正为 ${record.correctedDiagnosis || '未知'}，原因：${record.correctionReason || '未提供'}，AI准确性评分：${record.aiAccuracyRating || '未评分'}，修正日期：${record.correctedAt || '未知'}`)
    })
  }

  batchLines.push('\n【诊断注意】请结合以上批次历史与实时数据，对当前狮头鹅案例给出针对性诊断和建议。')

  return '\n' + batchLines.join('\n') + '\n'
}

// 调用大模型API进行诊断
async function callAIModel(inputData) {
  try {
    const {
      symptoms,
      symptomsText,
      animalInfo,
      environmentInfo,
      images,
      diagnosisType,
      autopsyFindings,
      batchPromptData
    } = inputData
    
    // 🔥 获取历史案例（仅用于死因剖析）
    let historyCases = []
    if (diagnosisType === 'autopsy_analysis') {
      try {
        historyCases = await getTopAccuracyCases(5)
        console.log(`✅ 获取历史案例${historyCases.length}条`)
      } catch (caseError) {
        console.warn('⚠️ 获取历史案例失败，继续使用标准诊断:', caseError.message)
      }
    }
    
    // 构建批次数据提示
    const batchContext = buildBatchContextSection(batchPromptData)

    // 根据诊断类型选择系统提示词（使用增强版）
    let systemPrompt = ''
    if (diagnosisType === 'autopsy_analysis') {
      // 死因剖析：使用增强版Prompt + 疾病知识库
      systemPrompt = getAutopsySystemPromptV2(historyCases) + batchContext + getDiseaseKnowledgePrompt()
    } else {
      // 病鹅诊断：使用原有Prompt
      systemPrompt = getLiveDiagnosisSystemPrompt() + batchContext + getDiseaseKnowledgePrompt()
    }
    
    // 根据诊断类型构建用户消息
    const userMessage = diagnosisType === 'autopsy_analysis'
      ? buildAutopsyUserMessage(symptomsText, symptoms, animalInfo, autopsyFindings, images)
      : buildLiveDiagnosisUserMessage(symptomsText, symptoms, animalInfo, environmentInfo, images)

    // 构建AI诊断请求 - 使用正确的ai-multi-model格式
    const aiRequest = {
      action: 'chat_completion',   // ✨ 重要：ai-multi-model 期望这个action
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      taskType: 'health_diagnosis',  // ✨ ai-multi-model 根据此选择模型
      priority: 'free_only'           // ✨ 优先使用免费模型
    }

    // 调用AI多模型服务
    // ⚠️ 重要：微信云函数默认超时3秒，需要手动改为30秒以上
    const aiResult = await cloud.callFunction({
      name: 'ai-multi-model',
      data: aiRequest,
      timeout: 60000  // ✅ 增加到60秒超时（通义千问API在处理图片时可能需要更长时间）
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
              modelName: aiResult.result.data.model,
              provider: aiResult.result.data.provider,
              responseTime: aiResult.result.data.responseTime || 0,
              tokens: aiResult.result.data.tokens || { input: 0, output: 0, total: 0 },
              cost: aiResult.result.data.cost || 0
            }
          }
        }
      } catch (parseError) {
        // 如果JSON解析失败，返回原始文本
        return parseTextResponse(aiResponse, aiResult.result)
      }
    } else {
      throw new Error(aiResult.result?.error || 'AI服务调用失败')
    }
  } catch (error) {
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
    
    await db.collection('health_ai_diagnosis').add({
      data: diagnosisRecord
    })
    
    return {
      success: true,
      data: { recordId, diagnosis: diagnosisRecord },
      message: 'AI诊断记录保存成功'
    }
  } catch (error) {
    // 已移除调试日志
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
  
  // 已移除调试日志

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
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      message: error.message || 'AI诊断服务异常，请重试'
    }
  }
}

// 执行AI诊断 - 改为异步版本
async function performAIDiagnosis(event, openid) {
  try {
    const {
      symptoms,
      symptomsText,
      batchId,
      affectedCount,
      deathCount,
      dayAge,
      images,
      diagnosisType = 'live_diagnosis',
      autopsyFindings,
      saveRecord = true
    } = event

    // 根据诊断类型验证输入参数
    if (diagnosisType === 'live_diagnosis') {
      if (!symptoms || symptoms.length === 0) {
        throw new Error('症状信息不能为空')
      }
      if (!symptomsText || symptomsText.trim() === '') {
        throw new Error('症状描述不能为空')
      }
    } else if (diagnosisType === 'autopsy_analysis') {
      if (!deathCount || deathCount <= 0) {
        throw new Error('死亡数量不能为空')
      }
    }

    // ✨ 改为异步：快速保存任务到数据库 (< 1秒)
    const taskData = {
      // 不指定_id，让微信自动生成
      _openid: openid,  // ✨ 使用 _openid 以符合微信权限系统
      openid: openid,    // 保留 openid 用于业务查询
      diagnosisType: diagnosisType,
      symptoms: symptoms || [],
      symptomsText: symptomsText || '',
      batchId: batchId,
      affectedCount: affectedCount || 0,
      deathCount: deathCount || 0,
      dayAge: dayAge || 0,
      images: images || [],
      autopsyFindings: autopsyFindings || null,
      status: 'processing',  // processing | completed | failed
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // 保存到数据库
    const addResult = await db.collection('health_ai_diagnosis').add({
      data: taskData
    })

    // 使用微信自动生成的_id
    const diagnosisId = addResult._id

    console.log(`诊断任务已创建: ${diagnosisId}，状态: processing`)

    // ✨ 触发后台处理任务（异步）
    // ⚠️ 注意：即使触发超时，任务仍在数据库中，会自动重试或在控制台配置超时
    cloud.callFunction({
      name: 'process-ai-diagnosis',
      data: { diagnosisId: diagnosisId }
    }).then(() => {
      console.log(`✅ 后台处理任务已触发: ${diagnosisId}`)
    }).catch((error) => {
      // ⚠️ 触发可能超时，但不标记任务失败
      // 任务状态由 process-ai-diagnosis 自己维护
      console.error(`⚠️ 触发信号超时（任务继续执行）: ${diagnosisId}`, error.message)
    })

    // ✨ 立即返回诊断ID给前端 (< 2秒总耗时)
    return {
      success: true,
      data: {
        diagnosisId: diagnosisId,
        status: 'processing',
        message: '诊断已提交，请稍候...'
      },
      message: 'AI诊断任务已创建'
    }
  } catch (error) {
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

    let query = db.collection('health_ai_diagnosis')
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
    // 已移除调试日志
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

    await db.collection('health_ai_diagnosis')
      .doc(recordId)
      .update({
        data: updateData
      })

    return {
      success: true,
      message: '诊断审查更新成功'
    }
  } catch (error) {
    // 已移除调试日志
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

    await db.collection('health_ai_diagnosis')
      .doc(recordId)
      .update({
        data: updateData
      })

    return {
      success: true,
      message: '诊断建议已采用'
    }
  } catch (error) {
    // 已移除调试日志
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

    await db.collection('health_ai_diagnosis')
      .doc(recordId)
      .update({
        data: updateData
      })

    return {
      success: true,
      message: '诊断反馈提交成功'
    }
  } catch (error) {
    // 已移除调试日志
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

    let query = db.collection('health_ai_diagnosis')
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
    // 已移除调试日志
    return {
      success: false,
      error: error.message
    }
  }
}
