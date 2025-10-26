/**
 * 后台异步处理AI诊断云函数
 * 用于处理耗时的大模型API调用
 * 不受3秒云函数超时限制
 */

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 处理AI诊断任务
 * 支持两种模式：
 * 1. 传入 diagnosisId - 处理指定任务
 * 2. 不传参数 - 自动扫描处理所有待处理任务（定时触发器模式）
 */
exports.main = async (event, context) => {
  const { diagnosisId } = event || {}
  
  try {
    // ✨ 模式1：处理指定任务
    if (diagnosisId) {
      console.log(`====== 模式1: 处理指定任务 ======`)
      console.log(`诊断ID: ${diagnosisId}`)
      return await processTask(diagnosisId)
    }
    
    // ✨ 模式2：自动扫描处理所有待处理任务（定时触发器）
    console.log(`====== 模式2: 自动扫描待处理任务 ======`)
    const tasksResult = await db.collection('health_ai_diagnosis')
      .where({
        status: 'processing',
        createdAt: db.command.gte(new Date(Date.now() - 10 * 60 * 1000)) // 只处理10分钟内的任务
      })
      .orderBy('createdAt', 'asc')
      .limit(5) // 一次最多处理5个任务
      .get()
    
    const tasks = tasksResult.data || []
    console.log(`找到 ${tasks.length} 个待处理任务`)
    
    if (tasks.length === 0) {
      return {
        success: true,
        message: '没有待处理任务',
        processedCount: 0
      }
    }
    
    // 并行处理多个任务
    const results = await Promise.allSettled(
      tasks.map(task => processTask(task._id))
    )
    
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
    console.log(`处理完成: 成功 ${successCount}/${tasks.length}`)
    
    return {
      success: true,
      message: `处理了 ${tasks.length} 个任务，成功 ${successCount} 个`,
      processedCount: tasks.length,
      successCount: successCount
    }
    
  } catch (error) {
    console.error('处理任务失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ========== 智能任务类型选择 ==========
/**
 * 评估诊断复杂度
 */
function evaluateDiagnosisComplexity(task) {
  const complexKeywords = [
    '死亡', '批量', '大量', '突然', '疑难', '不明原因', 
    '反复', '多次', '鉴别诊断', '并发症', '传染', '快速扩散',
    '重症', '急性', '严重'
  ]
  
  const description = (task.symptomsText || '') + ' ' + (task.symptoms || []).join(' ')
  
  // 检查是否包含复杂关键词
  const hasComplexKeyword = complexKeywords.some(kw => description.includes(kw))
  
  // 症状数量
  const symptomCount = task.symptoms?.length || 0
  
  // 受影响数量
  const affectedCount = task.affectedCount || 1
  
  // 复杂度评分
  let score = 0
  if (hasComplexKeyword) score += 3
  if (symptomCount >= 5) score += 2
  if (affectedCount >= 10) score += 2
  if (affectedCount >= 50) score += 3
  
  return score >= 4 ? 'high' : (score >= 2 ? 'medium' : 'low')
}

/**
 * 评估紧急程度
 */
function evaluateUrgency(task) {
  const urgentKeywords = ['急性', '突然', '死亡', '快速', '恶化', '危重']
  const description = (task.symptomsText || '') + ' ' + (task.symptoms || []).join(' ')
  
  const isUrgent = urgentKeywords.some(kw => description.includes(kw))
  const affectedCount = task.affectedCount || 1
  
  if (isUrgent && affectedCount >= 10) return 'high'
  if (isUrgent || affectedCount >= 50) return 'medium'
  return 'low'
}

/**
 * 判断是否值得使用视觉模型（图片质量足够且病情需要）
 */
function isWorthUsingVision(task, complexity) {
  const hasImages = task.images && task.images.length > 0
  if (!hasImages) return false
  
  // 如果是复杂病例或受影响数量较多，视觉分析价值更高
  const affectedCount = task.affectedCount || 1
  
  return complexity === 'high' || affectedCount >= 5
}

/**
 * 智能选择最优任务类型
 */
function selectOptimalTaskType(task) {
  const hasImages = task.images && task.images.length > 0
  const complexity = evaluateDiagnosisComplexity(task)
  const urgency = evaluateUrgency(task)
  
  console.log(`📊 诊断特征分析:`)
  console.log(`  - 复杂度: ${complexity}`)
  console.log(`  - 紧急度: ${urgency}`)
  console.log(`  - 图片数: ${task.images?.length || 0}`)
  console.log(`  - 受影响数量: ${task.affectedCount || 1}`)
  
  // 1. 有图片 → 优先使用视觉模型
  if (hasImages) {
    return 'health_diagnosis_vision'  // ERNIE 4.5 VL（2分/次）
  }
  
  // 2. 复杂病例 → 使用专家模型
  if (complexity === 'high') {
    return 'complex_diagnosis'  // ERNIE 4.0 Turbo（0.6分/次）
  }
  
  // 3. 紧急情况 → 使用快速模型
  if (urgency === 'high') {
    return 'urgent_diagnosis'  // SiliconFlow（免费且快）
  }
  
  // 4. 默认常规诊断 → 使用免费模型
  return 'health_diagnosis'  // ERNIE-Speed-128K（免费）
}

/**
 * 处理单个诊断任务
 */
async function processTask(diagnosisId) {
  try {
    console.log(`\n----- 处理任务: ${diagnosisId} -----`)
    
    // 1. 从数据库获取任务
    const taskResult = await db.collection('health_ai_diagnosis')
      .where({ _id: diagnosisId })
      .get()
    
    if (!taskResult.data || taskResult.data.length === 0) {
      throw new Error(`诊断任务不存在: ${diagnosisId}`)
    }
    
    const task = taskResult.data[0]
    console.log(`任务状态: ${task.status}`)
    
    // 2. 检查状态
    if (task.status !== 'processing') {
      console.log(`任务状态不是processing，跳过`)
      return {
        success: false,
        error: `任务状态不正确: ${task.status}`
      }
    }
    
    // 3. ✨ 智能选择任务类型（基于复杂度、图片、紧急度）
    const optimalTaskType = selectOptimalTaskType(task)
    
    console.log(`====== 准备调用 ai-multi-model ======`)
    console.log(`智能路由结果: ${optimalTaskType}`)
    console.log(`图片数量: ${task.images ? task.images.length : 0}`)
    
    // 调用AI多模型服务进行诊断
    const aiResult = await cloud.callFunction({
      name: 'ai-multi-model',
      data: {
        action: 'chat_completion',
        messages: buildDiagnosisMessages(task),
        taskType: optimalTaskType,  // ✨ 使用智能选择的任务类型
        priority: 'balanced',
        images: task.images || []
      },
      timeout: 60000  // ✅ 设置60秒超时（ai-multi-model需要调用通义千问API，15-25秒）
    })
    
    console.log(`====== ai-multi-model 调用结果 ======`)
    console.log(`调用成功: ${!!aiResult}`)
    console.log(`返回结果: ${JSON.stringify(aiResult.result).substring(0, 200)}`)
    
    if (!aiResult.result || !aiResult.result.success) {
      const errorMsg = aiResult.result?.error || aiResult.result?.fallback || 'AI诊断调用失败'
      // ✅ 检查是否是图片相关错误
      if (errorMsg.includes('图片') || errorMsg.includes('过大') || errorMsg.includes('image')) {
        throw new Error(`图片诊断失败：${errorMsg}\n\n建议：\n1. 删除图片仅使用文字描述\n2. 或使用更小的图片（压缩后<1MB）`)
      }
      throw new Error(errorMsg)
    }
    
    // 4. 解析AI返回的诊断结果
    const diagnosisContent = aiResult.result.data.content
    let diagnosisData = {}
    
    try {
      // 尝试提取JSON内容（处理markdown代码块包裹的情况）
      let jsonContent = diagnosisContent
      
      // 如果内容被```json ... ```包裹，提取中间的JSON
      const jsonMatch = diagnosisContent.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim()
        console.log('检测到markdown代码块，已提取JSON内容')
      }
      
      // 解析JSON
      diagnosisData = JSON.parse(jsonContent)
      console.log('JSON解析成功')
    } catch (parseError) {
      console.error('JSON解析失败:', parseError.message)
      // 如果无法解析JSON，尝试提取文本内容
      diagnosisData = {
        primaryDiagnosis: {
          disease: '诊断结果解析失败',
          confidence: 0,
          reasoning: diagnosisContent
        }
      }
    }
    
    // 5. 更新数据库中的诊断任务为completed状态
    const updateResult = await db.collection('health_ai_diagnosis')
      .where({ _id: diagnosisId })
      .update({
        data: {
          status: 'completed',
          result: diagnosisData,
          modelInfo: {
            modelName: aiResult.result.data.model,
            provider: aiResult.result.data.provider,
            cost: aiResult.result.data.cost || 0
          },
          updatedAt: new Date(),
          completedAt: new Date()
        }
      })
    
    console.log(`诊断任务处理成功: ${diagnosisId}`)
    
    return {
      success: true,
      data: {
        diagnosisId: diagnosisId,
        status: 'completed'
      }
    }
  } catch (error) {
    console.error(`====== 处理诊断任务失败 ======`)
    console.error(`诊断ID: ${diagnosisId}`)
    console.error(`错误信息: ${error.message}`)
    console.error(`错误栈:`, error.stack)
    
    // 构建详细错误信息
    let detailedError = error.message
    if (error.stack) {
      detailedError += `\n堆栈: ${error.stack.split('\n').slice(0, 3).join('\n')}`
    }
    
    try {
      // 更新为失败状态
      await db.collection('health_ai_diagnosis')
        .where({ _id: diagnosisId })
        .update({
          data: {
            status: 'failed',
            error: detailedError,
            errorRaw: error.message,
            updatedAt: new Date(),
            failedAt: new Date()
          }
        })
      
      console.log(`已更新任务状态为 failed: ${diagnosisId}`)
    } catch (updateError) {
      console.error('更新失败状态异常:', updateError)
    }
    
    return {
      success: false,
      error: error.message,
      detailedError: detailedError
    }
  }
}

/**
 * 构建诊断的消息内容
 */
function buildDiagnosisMessages(task) {
  const diagnosisType = task.diagnosisType || 'live_diagnosis'
  const hasImages = task.images && task.images.length > 0
  
  // 根据诊断类型返回不同的消息
  if (diagnosisType === 'autopsy_analysis') {
    return buildAutopsyMessages(task, hasImages)
  } else {
    return buildLiveDiagnosisMessages(task, hasImages)
  }
}

/**
 * 构建病鹅诊断的消息内容
 */
function buildLiveDiagnosisMessages(task, hasImages) {
  // ✨ 充分利用ERNIE 4.5 VL的多模态和推理能力
  const systemPrompt = `你是一位资深家禽兽医专家，专精于**狮头鹅**的疾病诊断和死因分析，拥有20年以上临床经验。${hasImages ? '\n\n你具备卓越的图像识别能力和医学推理能力，可以通过观察症状图片（粪便、体态、病变等）结合文字描述，进行精准的多模态综合诊断。' : '\n\n请基于文字症状描述进行专业诊断。'}

【重要诊断原则】
1. 狮头鹅的常见疾病谱:
   - 0-7日龄: 雏鹅白痢(沙门氏菌)、脐炎、维生素缺乏
   - 8-30日龄: 小鹅瘟、鹅副黏病毒、球虫病、肠炎
   - 30日龄以上: 大肠杆菌病、禽流感、鹅瘟、寄生虫病
   
2. 症状-疾病关键对应:
   - 白色粪便 + 3日龄内 → 高度怀疑雏鹅白痢
   - 绿色粪便 + 精神萎靡 → 可能肠炎/大肠杆菌病
   - 神经症状 + 任何日龄 → 警惕鹅瘟/新城疫
   - 腹泻 + 食欲不振 → 消化道疾病/感染
   
3. ${hasImages ? '【图片诊断核心能力】（充分利用多模态视觉分析）:' : '诊断要点:'}
   ${hasImages ? `请仔细观察每一张图片，运用你的专业知识进行细致分析：
   
   ✅ 粪便特征识别（OCR级别精确度）：
   - 颜色：白色（白痢）、黄绿色（肠炎）、血便（球虫）、黑褐色（消化道出血）
   - 性状：水样（急性腹泻）、糊状（消化不良）、粘液（肠道炎症）
   - 异常物：未消化饲料、血丝、寄生虫卵
   
   ✅ 体态与精神状态评估：
   - 站姿：正常/萎靡/蹲伏/倒地不起
   - 头颈姿势：扭颈（神经症状）、低垂（衰竭）
   - 眼神：有神/呆滞/闭眼
   
   ✅ 羽毛与皮肤病变：
   - 肛门周围：清洁/粘粪/粘连
   - 羽毛：蓬松/塌陷/脱毛
   - 皮肤：充血/出血点/肿胀/溃疡
   
   ✅ 环境与饲养条件观察：
   - 垫料：干燥/潮湿/粪污程度
   - 密度：拥挤/适中/空旷
   - 采食饮水行为
   
   请将图片观察结果与文字描述综合分析，给出精准诊断！` : `- 仔细分析症状描述
   - 结合日龄判断疾病可能性
   - 考虑环境和管理因素`}
   
4. 诊断置信度标准:
   - >90%: 典型症状 + 符合日龄 + ${hasImages ? '图片特征明显' : '有明确流行病学'}
   - 70-90%: 症状典型但${hasImages ? '图片不够清晰或' : ''}缺少辅助信息
   - <70%: 症状不典型或信息不足，需要实验室检查

5. 鉴别诊断要点:
   - 必须列出2-3个鉴别诊断
   - 说明与主诊断的区别特征
   - 给出进一步确诊建议

【回复格式】
严格使用纯JSON格式,不要使用markdown代码块包裹:
{
  "primaryDiagnosis": {
    "disease": "疾病名称",
    "confidence": 85,
    "reasoning": "诊断依据（${hasImages ? '结合图片观察和' : ''}症状分析）"
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
    "supportive": ["支持性治疗1", "支持性治疗2"],
    "followUp": {
      "timeline": "复查时间",
      "indicators": ["观察指标1", "观察指标2"]
    }
  },
  "preventionAdvice": ["预防建议1", "预防建议2"]${hasImages ? `,
  "imageAnalysis": {
    "quality": "good|fair|poor",
    "observations": ["图片观察点1", "图片观察点2"],
    "suggestAdditionalImages": []
  }` : ''}
}`

  const userMessage = `请诊断以下鹅群情况：

【症状描述】
${task.symptomsText}

【具体症状】
${task.symptoms.join(', ')}

【动物信息】
- 日龄：${task.dayAge || '未知'}天
- 受影响数量：${task.affectedCount || 1}只
- 批次编号：${task.batchId || '未知'}
- 品种：狮头鹅

${hasImages ? `【症状图片】
已提供${task.images.length}张症状图片，请仔细观察图片中的：
1. 粪便颜色和性状
2. 鹅只精神状态和姿势
3. 肛门周围羽毛情况
4. 其他可见异常症状

结合图片和文字描述进行综合诊断。` : '【提示】如有可能，建议补充症状图片以提高诊断准确性。'}

请进行专业诊断并提供详细的治疗建议。`

  return [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: userMessage
    }
  ]
}

/**
 * 构建死因剖析的消息内容
 */
function buildAutopsyMessages(task, hasImages) {
  const autopsyFindings = task.autopsyFindings || {}
  const abnormalities = autopsyFindings.abnormalities || []
  const description = autopsyFindings.description || ''
  
  const systemPrompt = `你是一位经验丰富的家禽病理学专家，专精于**狮头鹅**的尸体解剖和死因分析。你拥有20年以上的病理解剖经验。${hasImages ? '\n\n你具备卓越的病理图像识别能力，可以通过观察剖检照片（内脏病变、器官异常等）结合文字描述，进行精准的死因分析。' : '\n\n请基于文字描述和剖检发现进行死因分析。'}

【重要分析原则】
1. 狮头鹅的常见死因谱:
   - 0-7日龄: 雏鹅白痢(脐炎败血症)、维生素缺乏、保温不当
   - 8-30日龄: 小鹅瘟(肝脏坏死、肠道出血)、鹅副黏病毒、球虫病
   - 30日龄以上: 大肠杆菌病(肝周炎、气囊炎)、禽流感、鹅瘟、中毒
   
2. 病理特征与疾病对应:
   - 肝脏白点/坏死灶 → 小鹅瘟
   - 肝脏发黄/脂肪肝 → 中毒/营养失衡
   - 肠道出血/坏死 → 球虫病/肠炎
   - 心包积液/肝周炎 → 大肠杆菌病
   - 气管充血/肺炎 → 呼吸道疾病
   
3. ${hasImages ? '【剖检图片分析核心能力】:' : '剖检分析要点:'}
   ${hasImages ? `请仔细观察每一张剖检照片，运用你的病理学专业知识：
   
   ✅ 肝脏病变识别：
   - 颜色：正常红褐色/发黄/发黑/苍白
   - 病变：白色坏死点（小鹅瘟）、脂肪变性、纤维素包膜
   - 质地：正常/肿大/萎缩
   
   ✅ 肠道病变观察：
   - 粘膜：充血/出血/坏死/溃疡
   - 内容物：血液/粘液/未消化饲料
   - 肠壁厚度：正常/增厚/变薄
   
   ✅ 心肺病变评估：
   - 心包：正常/积液/纤维素渗出
   - 肺部：充血/水肿/实变/出血点
   - 气囊：清亮/混浊/纤维素性炎症
   
   ✅ 其他器官异常：
   - 脾脏：正常/肿大/出血
   - 肾脏：充血/尿酸盐沉积
   - 腺胃：溃疡/出血点
   
   请将图片观察结果与农民的白话描述综合分析！` : `- 仔细分析剖检发现描述
   - 理解农民的白话表达（如"肠子里面全是血"、"肝脏有很多白点"等）
   - 结合日龄判断死因可能性`}
   
4. 诊断置信度标准:
   - >90%: 典型病理特征 + ${hasImages ? '图片清晰可见病变' : '描述详细准确'}
   - 70-90%: 病理特征符合但${hasImages ? '图片不够清晰或' : ''}信息不够完整
   - <70%: 病理特征不典型，需要实验室检查（PCR、细菌培养等）

5. 理解农民语言：
   - "肠子里面全是血" → 肠道严重出血，可能球虫病或急性肠炎
   - "肝脏有很多白点" → 肝脏坏死灶，高度怀疑小鹅瘟
   - "心脏积水" → 心包积液，可能大肠杆菌病或心衰
   - "肺部发黑" → 肺炎或败血症

【回复格式】
严格使用纯JSON格式:
{
  "primaryCause": {
    "disease": "死因名称",
    "confidence": 85,
    "reasoning": "判断依据（${hasImages ? '结合剖检图片和' : ''}病理特征分析）",
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
  "epidemiologyRisk": "low|medium|high"${hasImages ? `,
  "imageAnalysis": {
    "quality": "good|fair|poor",
    "observations": ["剖检图片观察点1", "观察点2"]
  }` : ''}
}`

  const userMessage = `请分析以下鹅只的死亡原因：

【动物信息】
- 日龄：${task.dayAge || '未知'}天
- 死亡数量：${task.deathCount || 1}只
- 批次编号：${task.batchId || '未知'}
- 品种：狮头鹅

【生前症状】
${task.symptomsText || '无明显症状或未观察到'}
${task.symptoms && task.symptoms.length > 0 ? `\n具体表现：${task.symptoms.join('、')}` : ''}

【剖检发现】
${abnormalities.length > 0 ? `\n观察到的异常：\n${abnormalities.map((item, i) => `${i+1}. ${item}`).join('\n')}` : ''}
${description ? `\n农民描述：${description}` : ''}

${hasImages ? `【剖检照片】
已提供${task.images.length}张剖检照片，请仔细观察图片中的：
1. 肝脏颜色、大小和病变（白点、坏死等）
2. 肠道粘膜状态和内容物
3. 心包、肺部和气囊的病变
4. 其他可见器官异常

结合图片和文字描述进行综合死因分析。` : '【提示】如有可能，建议补充剖检照片以提高分析准确性。'}

请进行专业死因分析并提供预防建议。`

  return [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: userMessage
    }
  ]
}
