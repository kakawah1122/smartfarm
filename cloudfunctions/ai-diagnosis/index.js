// cloudfunctions/ai-diagnosis/index.js
// AI诊断云函数 - 专门处理AI智能诊断功能
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 引入疾病知识库
const { getDiseaseKnowledgePrompt } = require('./disease-knowledge')

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
  return `你是一位资深家禽兽医，只针对狮头鹅开展诊断与处置。请基于提供的结构化数据、批次上下文、历史诊疗记录以及图片描述，做出严谨、可追溯的临床诊断。

诊断原则：
1. 按狮头鹅日龄阶段（0-7、8-21、22-45、46-70、71天以上）判定高风险病种，并对比批次历史异常；
2. 综合以下维度逐条论证：
   • 临床症状与体征：精神、采食、呼吸、肠道、神经、姿势、羽毛、皮肤等；
   • 图片线索：逐张说明羽毛、粘膜、肢体、姿势、分泌物等特征；
   • 环境与饲养信息：温湿度、密度、饲料、应激、免疫记录；
   • 批次动态：近期异常记录、治疗/隔离/死亡案例及AI修正反馈。
3. 差异诊断：给出至少2项易混病的排除依据（结合日龄、病变特征、实验室结果或缺失信息）；
4. 治疗建议：明确药物剂量、途径、频次、疗程；标注支持性护理和批次管理措施（隔离、消毒、饲养调整等）；
5. 预防/复评：根据日龄阶段和历史风险，制定监测指标、随访周期、二次检测建议；
6. 若信息不足，列出必须补充的狮头鹅数据或更清晰照片，不得臆测；
7. 输出仅限狮头鹅相关内容，禁止扩展到其他禽类。

请严格使用以下JSON结构回复：
{
  "primaryDiagnosis": {
    "disease": "疾病名称",
    "confidence": 85,
    "reasoning": "结合症状、图片、日龄与历史数据的论证要点"
  },
  "differentialDiagnosis": [
    {"disease": "鉴别疾病1", "confidence": 60, "exclusionReason": "排除或佐证依据"},
    {"disease": "鉴别疾病2", "confidence": 45, "exclusionReason": "排除或佐证依据"}
  ],
  "riskFactors": [
    "记录高危因素：如日龄阶段、免疫空档、环境或管理缺陷"
  ],
  "severity": "mild|moderate|severe",
  "urgency": "low|medium|high|critical",
  "treatmentRecommendation": {
    "immediate": ["现场紧急措施，含隔离/支持性处理"],
    "medication": [
      {
        "name": "药物名称",
        "dosage": "mg/kg或mL/L",
        "route": "口服|饮水|注射等",
        "frequency": "给药频次",
        "duration": "疗程天数",
        "notes": "注意事项/配伍禁忌/适用日龄"
      }
    ],
    "supportive": ["补液、电解质、营养、温湿度调整等措施"]
  },
  "preventionAdvice": [
    "批次生物安全与免疫建议：结合日龄阶段、历史病史与环境风险"
  ],
  "followUp": {
    "monitoring": ["未来24-72h需监测的指标及阈值"],
    "recommendedTests": ["建议追加的实验室检测"],
    "reviewInterval": "建议的复查或随访时间"
  }
}`
}

// 获取死因剖析的系统提示词
function getAutopsySystemPrompt() {
  return `你是一位资深家禽病理学专家，仅针对狮头鹅尸体解剖和死因分析。请基于批次历史、日龄阶段、临床表现、剖检病变与图片证据，精准判定死亡原因并给出防控建议。

分析要求：
1. 对照不同日龄阶段常见死因（如雏鹅病毒性疾病、中鹅寄生虫、成鹅代谢病等），结合当前批次历史异常；
2. 系统比对生前症状与剖检特征（肝脏、脾脏、肠系膜、呼吸道、神经系统等）逐条论证；
3. 按照片信息逐张描述病变部位的颜色、质地、渗出、坏死、充血等特征；
4. 提供死因置信度，并给出至少2项鉴别死因及排除理由；
5. 结合批次现有隔离/治疗措施，提出针对性的预防与复盘建议，包括生物安全、营养、密度、消毒流程；
6. 明确列出后续需要的实验室检查或新增样品采集；
7. 若信息不足，请指出缺失项（如缺少肝脏切面照片、胆管情况等），不要猜测；
8. 输出仅限狮头鹅相关内容。

请使用以下JSON结构输出：
{
  "primaryCause": {
    "disease": "主要死因",
    "confidence": 85,
    "reasoning": "结合症状+剖检+历史的详细推理",
    "autopsyEvidence": ["关键解剖证据1", "关键解剖证据2"],
    "pathogenesis": "推断致死机制"
  },
  "differentialCauses": [
    {"disease": "鉴别死因1", "confidence": 60, "exclusionReason": "排除或保留理由"},
    {"disease": "鉴别死因2", "confidence": 45, "exclusionReason": "排除或保留理由"}
  ],
  "pathologicalFindings": {
    "summary": "病理变化概述",
    "organs": [
      {"organ": "器官名称", "lesions": ["病变描述1", "病变描述2"], "imageReference": "对应图片序号"}
    ]
  },
  "preventionMeasures": ["针对该日龄批次的预防措施"],
  "biosecurityAdvice": ["生物安全改进建议"],
  "epidemiologyRisk": "low|medium|high",
  "recommendedTests": ["建议追加的实验室/病理检测"],
  "followUp": {
    "monitoring": ["后续观察指标"],
    "correctiveActions": ["需要立即执行的矫正措施"],
    "dataToCollect": ["建议补充的照片或数据"],
    "feedbackForAI": "此次分析中可用于改进模型的关键字段或修正要点"
  }
}`
}

// 获取死因剖析的增强版系统提示词（包含历史案例学习）
function getAutopsySystemPromptV2(historyCases = []) {
  let casesSection = ''
  
  if (historyCases.length > 0) {
    casesSection = `

【本场历史准确诊断参考案例（Few-Shot Learning）】
以下是本养殖场近期兽医确诊的真实病例，供学习避免误判：

${historyCases.map((c, i) => `
案例${i+1}：${c.correctDiagnosis}（AI准确性：${c.finalRating}星/5星）
  • 动物信息：日龄${c.dayAge}天，死亡${c.deathCount}只
  • 生前症状：${c.symptomsText || c.symptoms || '未详细观察'}
  • 剖检发现：${c.autopsyAbnormalities}
  ${c.autopsyDescription ? `• 农民描述：${c.autopsyDescription}` : ''}
  • AI初步判断：${c.aiInitialDiagnosis}
  • 兽医最终确诊：${c.correctDiagnosis}
  • 修正依据：${c.correctionReason}
  • ⚠️ 关键教训：${c.aiInitialDiagnosis !== c.correctDiagnosis ? '注意区分相似病变，避免重复误判' : 'AI诊断准确，可作为正例参考'}
`).join('\n')}

【学习要点】
1. 参考这些案例的症状-疾病对应关系和日龄匹配
2. 特别注意兽医的修正理由，避免类似误判陷阱
3. 关注本养殖场的常见疾病模式和环境特点
4. 优先考虑历史高频疾病，但不能忽视新发病种
5. 剖检病变鉴别诊断是关键，必须结合多个特征综合判断
`
  }
  
  return getAutopsySystemPrompt() + casesSection
}

// 疾病知识库已移到独立文件 disease-knowledge.js

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

// 构建批次上下文信息（优化格式，突出关键信息）
function buildBatchContextSection(batchPromptData) {
  if (!batchPromptData || Object.keys(batchPromptData).length === 0) {
    return ''
  }

  const { batch = {}, stats = {}, diagnosisTrend = [], treatmentHistory = [], isolationHistory = [], deathHistory = [], correctionFeedback = [] } = batchPromptData

  const batchLines = []
  
  // === 批次快照（一行概览）===
  const dayAge = batch.dayAge || '未知'
  const totalAnimals = stats.totalAnimals ?? '未知'
  const abnormalCount = stats.abnormalCount ?? 0
  const deadCount = stats.deadCount ?? 0
  const mortalityRate = stats.mortalityRate ? `${stats.mortalityRate}%` : '未计算'
  
  batchLines.push('\n═══════════════════════════════════════════════')
  batchLines.push(`【批次快照】${batch.batchNumber || '未知批次'} | 第${dayAge}天 | 存栏${totalAnimals}只 | ${abnormalCount > 0 ? `⚠️ 异常${abnormalCount}只` : '✓ 无异常'} | 累计死亡${deadCount}只(${mortalityRate})`)
  batchLines.push('═══════════════════════════════════════════════')

  // === 高风险提示（仅在有异常时显示）===
  if (diagnosisTrend.length > 0 || correctionFeedback.length > 0) {
    const highRiskAlerts = []
    
    // 从近期诊断中提取高频病种
    if (diagnosisTrend.length > 0) {
      const recentDiseases = {}
      diagnosisTrend.slice(0, 5).forEach(record => {
        const disease = record.diagnosis || '未知'
        recentDiseases[disease] = (recentDiseases[disease] || 0) + 1
      })
      const topDisease = Object.entries(recentDiseases).sort((a, b) => b[1] - a[1])[0]
      if (topDisease && topDisease[1] > 1) {
        highRiskAlerts.push(`近7天内${topDisease[1]}例"${topDisease[0]}"病例 → 警惕流行趋势`)
      }
    }
    
    // 从修正反馈中提取AI常见误判
    if (correctionFeedback.length > 0) {
      const recentCorrection = correctionFeedback[0]
      if (recentCorrection.aiAccuracyRating <= 3) {
        highRiskAlerts.push(`⚠️ 上次AI误判：需从"${recentCorrection.correctedDiagnosis}"鉴别（${recentCorrection.correctionReason}）`)
      }
    }
    
    if (highRiskAlerts.length > 0) {
      batchLines.push('\n【⚠️ 高风险提示】')
      highRiskAlerts.forEach(alert => batchLines.push(`  ${alert}`))
    }
  }

  // === 近期异常诊断（简化，突出核心）===
  if (diagnosisTrend && diagnosisTrend.length > 0) {
    batchLines.push('\n【近期异常诊断】')
    diagnosisTrend.slice(0, 3).forEach((record, index) => {
      const symptoms = Array.isArray(record.symptoms) && record.symptoms.length > 0 
        ? record.symptoms.slice(0, 3).join('、') + (record.symptoms.length > 3 ? '等' : '')
        : '未记录'
      const severityIcon = record.severity === 'severe' ? '🔴' : record.severity === 'moderate' ? '🟠' : '🟡'
      batchLines.push(`  ${severityIcon} ${record.checkDate || '未知日期'} | ${record.diagnosis || '未知'} | ${record.sickCount || 0}只 | 症状：${symptoms}`)
    })
  }

  // === 治疗中方案（仅显示进行中的）===
  const ongoingTreatments = treatmentHistory.filter(t => t.outcome === 'ongoing' || !t.outcome)
  if (ongoingTreatments.length > 0) {
    batchLines.push('\n【治疗中方案】')
    ongoingTreatments.slice(0, 2).forEach(record => {
      const medications = Array.isArray(record.medications) && record.medications.length > 0
        ? record.medications.map(m => m.name).join('、')
        : '未记录药物'
      batchLines.push(`  💊 ${record.treatmentDate || '未知'} | ${record.diagnosis || '未知'} | 用药：${medications}`)
    })
  }

  // === 隔离观察（仅显示进行中的）===
  const ongoingIsolations = isolationHistory.filter(i => i.status === 'ongoing' || !i.endDate)
  if (ongoingIsolations.length > 0) {
    batchLines.push('\n【隔离观察中】')
    ongoingIsolations.slice(0, 2).forEach(record => {
      batchLines.push(`  🔒 ${record.startDate || '未知'} | 原因：${record.reason || '未记录'}`)
    })
  }

  // === 死亡记录（突出修正差异）===
  if (deathHistory && deathHistory.length > 0) {
    batchLines.push('\n【死亡记录（含AI修正对比）】')
    deathHistory.slice(0, 3).forEach(record => {
      const correctionMark = record.correctedDiagnosis && record.aiDiagnosis !== record.correctedDiagnosis
        ? `❌ AI初判"${record.aiDiagnosis}" → ✅ 兽医确诊"${record.correctedDiagnosis}"`
        : `${record.aiDiagnosis || '未知'}`
      const rating = record.aiAccuracyRating ? `(${record.aiAccuracyRating}★)` : ''
      batchLines.push(`  ${record.deathDate || '未知'} | ${record.deathCount || 0}只 | ${correctionMark} ${rating}`)
      if (record.correctionReason) {
        batchLines.push(`      └─ 修正依据：${record.correctionReason}`)
      }
    })
  }

  // === 关键学习点（从修正反馈中总结）===
  if (correctionFeedback && correctionFeedback.length > 0) {
    const lowRatingFeedback = correctionFeedback.filter(f => f.aiAccuracyRating && f.aiAccuracyRating <= 3)
    if (lowRatingFeedback.length > 0) {
      batchLines.push('\n【🎯 关键学习点（避免重复误判）】')
      lowRatingFeedback.slice(0, 2).forEach(record => {
        batchLines.push(`  ⚠️ "${record.correctedDiagnosis}" - ${record.correctionReason}`)
      })
    }
  }

  batchLines.push('\n═══════════════════════════════════════════════')
  batchLines.push('【诊断指引】请结合以上批次历史数据、疾病流行趋势与修正反馈，')
  batchLines.push('按照"日龄定位→主症分析→剖检对照→历史关联→鉴别诊断→置信度评估"')
  batchLines.push('的六步流程，对当前狮头鹅案例给出精准、可追溯的诊断建议。')
  batchLines.push('═══════════════════════════════════════════════\n')

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
      } catch (caseError) {
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
      priority: 'free_only',          // ✨ 优先使用免费模型
      images: images || []            // ✅ 传递图片文件ID（如果有）
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
      case 'get_diagnosis_result':
        return await getDiagnosisResult(event, openid)
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


    // ✨ 触发后台处理任务（异步）
    // ⚠️ 注意：即使触发超时，任务仍在数据库中，会自动重试或在控制台配置超时
    cloud.callFunction({
      name: 'process-ai-diagnosis',
      data: { diagnosisId: diagnosisId }
    }).then(() => {
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
// 治疗结果文本映射
function getOutcomeText(outcome) {
  const outcomeMap = {
    'ongoing': '治疗中',
    'effective': '有效',
    'ineffective': '无效',
    'completed': '已完成',
    'stopped': '已中止'
  }
  return outcomeMap[outcome] || outcome || '未知'
}

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

    // ✅ 批量查询批次信息，填充批次编号
    const batchIds = [...new Set(result.data.map(r => r.batchId).filter(id => id))]
    const batchMap = {}
    
    if (batchIds.length > 0) {
      try {
        const batchResult = await db.collection('production_batches')
          .where({
            _id: _.in(batchIds)
          })
          .field({ batchNumber: true })
          .get()
        
        batchResult.data.forEach(batch => {
          batchMap[batch._id] = batch.batchNumber
        })
      } catch (batchError) {
        console.error('查询批次信息失败:', batchError)
        // 继续执行，不影响诊断记录的返回
      }
    }

    // ✅ 批量查询关联的治疗记录
    const diagnosisIds = result.data.map(r => r._id)
    const treatmentMap = {}
    
    if (diagnosisIds.length > 0) {
      try {
        const treatmentResult = await db.collection('health_treatment_records')
          .where({
            diagnosisId: _.in(diagnosisIds),
            isDeleted: _.neq(true)
          })
          .field({
            diagnosisId: true,
            treatmentPlan: true,
            medications: true,
            treatmentDate: true,
            outcome: true,
            updatedAt: true
          })
          .get()
        
        // 按诊断ID分组，取最新的治疗记录
        treatmentResult.data.forEach(treatment => {
          const existingTreatment = treatmentMap[treatment.diagnosisId]
          const treatmentTime = treatment.updatedAt || treatment.treatmentDate
          const existingTime = existingTreatment?.updatedAt || existingTreatment?.treatmentDate
          
          // 如果没有现有记录，或当前记录更新时间更晚，则使用当前记录
          if (!existingTreatment || treatmentTime > existingTime) {
            treatmentMap[treatment.diagnosisId] = treatment
          }
        })
      } catch (treatmentError) {
        console.error('查询治疗记录失败:', treatmentError)
        // 继续执行，不影响诊断记录的返回
      }
    }

    // 映射数据库字段到前端期望的格式
    const mappedRecords = result.data.map(record => {
      // ✅ 修复：支持新旧两种数据结构
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
      
      // ✅ 修复：直接从顶层字段读取，而不是从 input.animalInfo
      const symptoms = record.symptomsText || (Array.isArray(record.symptoms) ? record.symptoms.join('、') : '') || ''
      const affectedCount = record.affectedCount || 0
      const dayAge = record.dayAge || 0
      
      // ✅ 修复：治疗周期的获取逻辑
      let treatmentDuration = '未知'
      if (aiResult.followUp?.reviewInterval) {
        treatmentDuration = aiResult.followUp.reviewInterval
      } else if (treatmentRecommendation.followUp?.timeline) {
        treatmentDuration = treatmentRecommendation.followUp.timeline
      } else if (medications.length > 0 && medications[0].duration) {
        treatmentDuration = medications[0].duration
      }
      
      // ✅ 修复：时间格式处理
      let createTimeStr = ''
      if (record.createdAt) {
        createTimeStr = typeof record.createdAt === 'string' 
          ? record.createdAt 
          : record.createdAt.toISOString()
      } else if (record.createTime) {
        createTimeStr = typeof record.createTime === 'string' 
          ? record.createTime 
          : record.createTime.toISOString()
      }
      
      // ✅ 获取关联的实际治疗记录
      const actualTreatment = treatmentMap[record._id]
      let actualTreatmentData = null
      
      if (actualTreatment) {
        actualTreatmentData = {
          treatmentPlan: actualTreatment.treatmentPlan || '',
          medications: actualTreatment.medications || [],
          treatmentDate: actualTreatment.treatmentDate || '',
          outcome: getOutcomeText(actualTreatment.outcome || ''),
          updatedAt: actualTreatment.updatedAt
        }
      }
      
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
        
        // ✅ 诊断图片（症状图片或剖检图片）
        images: record.images || [],
        diagnosisType: record.diagnosisType || 'live_diagnosis',
        
        // 治疗方案
        treatmentDuration: treatmentDuration,
        recommendedMedications: medications.map(med => 
          typeof med === 'string' ? med : (med.name || med.medication || '')
        ).filter(m => m),
        
        // 其他可能的疾病
        possibleDiseases: (aiResult.differentialDiagnosis || aiResult.differentialCauses || []).map(dd => ({
          name: dd.disease || '',
          confidence: dd.confidence || 0
        })),
        
        // 时间和批次信息
        createTime: createTimeStr,
        diagnosisDate: createTimeStr ? createTimeStr.substring(0, 16).replace('T', ' ') : '',
        batchId: record.batchId || '',
        batchNumber: batchMap[record.batchId] || record.batchNumber || '未知批次',
        
        // 操作员信息
        operator: record.operatorName || record._openid?.substring(0, 8) || '',
        
        // 状态信息
        status: record.status || 'completed',
        reviewed: record.veterinaryReview?.reviewed || false,
        adopted: record.application?.adopted || false,
        
        // ✅ 修正信息（如果存在）
        isCorrected: record.isCorrected || false,
        correctedDiagnosis: record.correctedDiagnosis || '',
        correctionReason: record.correctionReason || '',
        veterinarianDiagnosis: record.veterinarianDiagnosis || '',
        veterinarianTreatmentPlan: record.veterinarianTreatmentPlan || '',
        aiAccuracyRating: record.aiAccuracyRating || 0,
        correctedBy: record.correctedBy || '',
        correctedByName: record.correctedByName || '',
        correctedAt: record.correctedAt || '',
        
        // ✅ 实际治疗记录（如果存在）
        actualTreatment: actualTreatmentData,
        
        // 保留原始数据以备需要
        _raw: record
      }
    })

    return {
      success: true,
      data: {
        records: mappedRecords,
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

// 获取单条诊断记录详情（用于治疗记录页面）
async function getDiagnosisResult(event, openid) {
  try {
    const { diagnosisId } = event

    if (!diagnosisId) {
      throw new Error('诊断ID不能为空')
    }

    const record = await db.collection('health_ai_diagnosis')
      .doc(diagnosisId)
      .get()

    if (!record.data) {
      throw new Error('诊断记录不存在')
    }

    // 验证权限：只能查看自己的记录
    if (record.data._openid !== openid) {
      throw new Error('无权查看该诊断记录')
    }

    // 处理并返回诊断结果
    const aiResult = record.data.result || record.data.aiResult || {}
    const primaryDiagnosis = aiResult.primaryDiagnosis || aiResult.primaryCause || {}
    const treatmentRecommendation = aiResult.treatmentRecommendation || {}
    
    // 查询批次信息
    let batchNumber = record.data.batchNumber || '未知批次'
    if (record.data.batchId && !record.data.batchNumber) {
      try {
        const batchResult = await db.collection('production_batches')
          .doc(record.data.batchId)
          .field({ batchNumber: true })
          .get()
        
        if (batchResult.data) {
          batchNumber = batchResult.data.batchNumber
        }
      } catch (batchError) {
        console.error('查询批次信息失败:', batchError)
      }
    }

    return {
      success: true,
      data: {
        // 基本信息
        diagnosisId: record.data._id,
        batchId: record.data.batchId || '',
        batchNumber: batchNumber,
        diagnosisType: record.data.diagnosisType || 'live_diagnosis',
        
        // 诊断结果
        primaryDiagnosis: primaryDiagnosis.disease || '未知疾病',
        confidence: primaryDiagnosis.confidence || 0,
        reasoning: primaryDiagnosis.reasoning || '',
        
        // 症状信息
        symptoms: record.data.symptomsText || (Array.isArray(record.data.symptoms) ? record.data.symptoms.join('、') : ''),
        affectedCount: record.data.affectedCount || record.data.deathCount || 0,
        dayAge: record.data.dayAge || 0,
        
        // 治疗建议
        treatmentRecommendation: treatmentRecommendation,
        medications: treatmentRecommendation.medication || [],
        
        // 完整的AI结果（供需要时使用）
        fullResult: aiResult,
        
        // 时间信息
        createdAt: record.data.createdAt || record.data.createTime || '',
        status: record.data.status || 'completed'
      }
    }
  } catch (error) {
    console.error('获取诊断结果失败:', error)
    return {
      success: false,
      error: error.message,
      message: error.message || '获取诊断结果失败'
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
