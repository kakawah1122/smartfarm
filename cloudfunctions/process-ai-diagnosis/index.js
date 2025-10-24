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
    
    // 3. 调用AI多模型服务进行诊断
    console.log(`====== 准备调用 ai-multi-model ======`)
    console.log(`任务类型: health_diagnosis`)
    console.log(`优先级: free_only`)
    console.log(`图片数量: ${task.images ? task.images.length : 0}`)
    
    const aiResult = await cloud.callFunction({
      name: 'ai-multi-model',
      data: {
        action: 'chat_completion',
        messages: buildDiagnosisMessages(task),
        taskType: 'health_diagnosis',
        priority: 'free_only',
        images: task.images || []  // ✨ 传递图片URL数组
      }
    })
    
    console.log(`====== ai-multi-model 调用结果 ======`)
    console.log(`调用成功: ${!!aiResult}`)
    console.log(`返回结果: ${JSON.stringify(aiResult.result).substring(0, 200)}`)
    
    if (!aiResult.result || !aiResult.result.success) {
      throw new Error(aiResult.result?.error || 'AI诊断调用失败')
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
  // ✨ 根据是否有图片使用不同的系统提示词
  const hasImages = task.images && task.images.length > 0
  
  const systemPrompt = `你是一位专业的家禽兽医，专精于鹅类疾病诊断，拥有20年以上临床经验。${hasImages ? '你可以通过观察症状图片和文字描述进行综合诊断。' : '请根据提供的症状信息进行诊断。'}

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
   
3. ${hasImages ? '图片观察要点:' : '诊断要点:'}
   ${hasImages ? `- 粪便颜色和性状（白色/黄色/绿色/血便）
   - 肛门周围羽毛状态（污染/粘连）
   - 体态姿势（精神/萎靡/倒地）
   - 可见病变（皮肤/眼部/肢体异常）` : `- 仔细分析症状描述
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
