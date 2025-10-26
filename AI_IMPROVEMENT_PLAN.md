# AI诊断准确性改进实施计划

## 📊 当前系统分析

### 已有基础设施
✅ AI多模型调用（通义千问系列）
✅ 诊断修正功能（人工纠错）
✅ AI准确性评分（1-5星）
✅ 修正记录持久化存储

### 系统架构
```
用户输入症状/图片
    ↓
ai-diagnosis云函数
    ↓
ai-multi-model（智能路由）
    ↓
返回诊断结果
    ↓
人工修正（如需要）
    ↓
保存反馈数据
```

---

## 🎯 三阶段改进路径

### 阶段1：立即可实施（1-2周）- Prompt工程优化

#### 1.1 Few-Shot Learning（少样本学习）

**原理**：在Prompt中加入真实案例，让AI模仿正确的诊断模式。

**实现步骤**：

1. **创建案例提取函数**（`cloudfunctions/ai-diagnosis/index.js`）

```javascript
/**
 * 获取历史高准确率案例
 * @param {number} limit - 返回案例数量
 * @param {string} diseaseType - 疾病类型筛选（可选）
 */
async function getTopAccuracyCases(limit = 5, diseaseType = null) {
  const _ = db.command
  const where = {
    isCorrected: true,
    aiAccuracyRating: _.gte(4), // ≥4星
    correctionType: _.neq('confirmed') // 排除"确认无误"的记录
  }
  
  if (diseaseType) {
    where.correctedCause = _.eq(diseaseType)
  }
  
  const result = await db.collection('health_death_records')
    .where(where)
    .orderBy('aiAccuracyRating', 'desc')
    .orderBy('correctedAt', 'desc')
    .limit(limit)
    .get()
  
  return result.data.map(record => {
    const symptoms = record.diagnosisResult?.symptoms || []
    const autopsyAbnormalities = record.autopsyFindings?.abnormalities || []
    
    return {
      // 症状信息
      symptoms: symptoms.join('、'),
      symptomsText: record.diagnosisResult?.symptomsText || '',
      
      // 剖检发现
      autopsyAbnormalities: autopsyAbnormalities.join('、'),
      autopsyDescription: record.autopsyFindings?.description || '',
      
      // 诊断结果
      aiInitialDiagnosis: record.deathCause,
      correctDiagnosis: record.correctedCause,
      correctionReason: record.correctionReason,
      
      // 可信度
      aiConfidence: record.diagnosisResult?.primaryCause?.confidence || 0,
      finalRating: record.aiAccuracyRating,
      
      // 动物信息
      dayAge: record.diagnosisResult?.animalInfo?.dayAge,
      deathCount: record.deathCount
    }
  })
}
```

2. **增强系统Prompt**

```javascript
function getAutopsySystemPromptV2(historyCases = []) {
  let casesSection = ''
  
  if (historyCases.length > 0) {
    casesSection = `

【历史准确诊断参考案例】
以下是本养殖场近期确诊的真实病例，供参考：

${historyCases.map((c, i) => `
案例${i+1}：${c.correctDiagnosis}（准确性：${c.finalRating}星）
  动物信息：日龄${c.dayAge || '未知'}天，死亡${c.deathCount || 1}只
  症状描述：${c.symptomsText || '未知'}
  剖检发现：${c.autopsyAbnormalities || '未详细记录'}
  ${c.autopsyDescription ? `农民描述：${c.autopsyDescription}` : ''}
  AI初判：${c.aiInitialDiagnosis}
  最终确诊：${c.correctDiagnosis}
  修正理由：${c.correctionReason}
`).join('\n')}

请特别注意：
1. 参考这些案例的症状-疾病对应关系
2. 学习兽医的修正理由，避免类似误判
3. 注意本场常见疾病模式
`
  }
  
  return `你是一位经验丰富的家禽病理学专家，专精于鹅类尸体解剖和死因分析。

【诊断规范】
1. 结合生前症状和剖检发现进行综合判断
2. 重点分析内脏病变与疾病的对应关系
3. 评估死因的置信度(0-100)
4. 理解农民的白话描述（如"肠子里面全是血"、"肝脏有很多白点"等）
${casesSection}

【回复格式】使用JSON：
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
  "epidemiologyRisk": "low|medium|high",
  "confidenceFactors": {
    "supporting": ["支持该诊断的证据1", "证据2"],
    "uncertain": ["不确定的因素1", "因素2"]
  }
}`
}
```

3. **修改AI调用逻辑**

```javascript
async function callAIModel(inputData) {
  try {
    const { diagnosisType, animalInfo, symptoms, autopsyFindings } = inputData
    
    // 🔥 获取历史案例
    let historyCases = []
    try {
      if (diagnosisType === 'autopsy_analysis') {
        // 死因剖析：获取相似日龄的案例
        historyCases = await getTopAccuracyCases(5)
      }
    } catch (caseError) {
      console.warn('获取历史案例失败，继续诊断:', caseError)
    }
    
    // 使用增强版Prompt
    const systemPrompt = diagnosisType === 'autopsy_analysis' 
      ? getAutopsySystemPromptV2(historyCases)
      : getLiveDiagnosisSystemPrompt()
    
    // ... 继续原有逻辑
  }
}
```

**预期效果**：
- 提升常见疾病诊断准确率 **15-25%**
- 减少低级错误（如混淆小鹅瘟和大肠杆菌）
- AI能学习本场的疾病模式

---

#### 1.2 疾病特征强化提示

在Prompt中加入疾病特征映射表：

```javascript
function getDiseaseKnowledgePrompt() {
  return `
【常见鹅病特征速查】

小鹅瘟（雏鹅常见）：
  ✓ 日龄：1-15天最高发
  ✓ 典型症状：突然死亡、败血症状
  ✓ 剖检特征：肠道出血、纤维素性假膜、肝脏有白色坏死灶
  ✓ 鉴别点：与大肠杆菌区别在于纤维素性渗出物

鹅副粘病毒（中大鹅常见）：
  ✓ 日龄：30-90天
  ✓ 典型症状：神经症状、扭颈、瘫痪
  ✓ 剖检特征：脑膜充血、心内膜出血点
  ✓ 鉴别点：有明显神经症状

维生素缺乏症：
  ✓ 日龄：10-30天
  ✓ 典型症状：腿软、生长迟缓、无神经症状
  ✓ 剖检特征：骨骼软化、内脏无明显病变
  ✓ 鉴别点：内脏器官完整无病变

大肠杆菌病：
  ✓ 日龄：全日龄
  ✓ 典型症状：急性死亡、腹泻
  ✓ 剖检特征：心包炎、肝周炎、气囊炎（纤维素性渗出）
  ✓ 鉴别点：纤维素渗出明显但无肠道假膜

请根据这些特征进行鉴别诊断。
`
}

// 在构建systemPrompt时附加
const fullSystemPrompt = `${getAutopsySystemPromptV2(historyCases)}

${getDiseaseKnowledgePrompt()}`
```

---

#### 1.3 置信度校准机制

让AI在不确定时"说人话"：

```javascript
function addConfidenceCalibration() {
  return `
【置信度评估指南】
- 90-100分：症状+剖检高度吻合，几乎确诊
- 70-89分：主要特征吻合，但有1-2个不典型点
- 50-69分：症状相似，但剖检不完全吻合，需进一步化验
- 30-49分：仅部分症状吻合，需更多信息
- 0-29分：症状模糊，无法诊断

⚠️ 重要原则：
1. 当置信度<70时，必须明确说明不确定因素
2. 优先给出最可能的2-3个鉴别诊断
3. 建议需要补充的检查项目（如实验室检验）
4. 不要过度自信，宁可保守判断
`
}
```

**实施时间**：1周
**工作量**：后端开发2天 + 测试3天
**成本**：0元（纯代码优化）

---

### 阶段2：中期优化（1-2个月）- 知识库与数据积累

#### 2.1 建立疾病知识库

**创建数据库集合**：`disease_knowledge`

```javascript
// 数据结构
{
  _id: "dk_001",
  disease: "小鹅瘟",
  aliases: ["鹅细小病毒病", "雏鹅病毒性肠炎"],
  category: "病毒性疾病",
  
  // 流行病学
  epidemiology: {
    susceptibleAge: [1, 15], // 易感日龄范围
    seasonality: ["spring", "winter"], // 高发季节
    mortalityRate: [50, 100], // 死亡率范围
    transmissionRoute: ["垂直传播", "水平传播"]
  },
  
  // 临床症状
  symptoms: {
    typical: [
      { symptom: "突然死亡", weight: 10 },
      { symptom: "精神萎靡", weight: 8 },
      { symptom: "拉白色或绿色稀便", weight: 9 }
    ],
    rare: ["鼻孔流液", "眼结膜炎"]
  },
  
  // 剖检病变
  autopsyFindings: {
    pathognomonic: [ // 特征性病变
      {
        organ: "小肠",
        finding: "纤维素性假膜",
        description: "肠道表面有白色或黄白色膜状物",
        weight: 10
      },
      {
        organ: "肝脏",
        finding: "白色坏死灶",
        description: "肝脏表面散在针尖至小米粒大小白色坏死点",
        weight: 9
      }
    ],
    common: [
      { organ: "肠道", finding: "肠道出血" },
      { organ: "心脏", finding: "心肌出血点" }
    ]
  },
  
  // 鉴别诊断
  differential: {
    confusedWith: ["大肠杆菌病", "鹅副粘病毒病"],
    differentiationPoints: [
      "大肠杆菌病：纤维素性渗出但无肠道假膜",
      "鹅副粘病毒病：有神经症状，小鹅瘟无"
    ]
  },
  
  // 治疗和预防
  treatment: {
    specific: "抗小鹅瘟血清",
    supportive: ["补液", "维生素C", "抗生素防继发感染"],
    prevention: ["种鹅免疫", "雏鹅注射高免血清"]
  },
  
  // 统计数据
  statistics: {
    totalCases: 23, // 本场历史病例数
    confirmedCases: 18, // 确诊病例数
    averageConfidence: 87, // AI平均置信度
    averageRating: 4.2 // 平均准确性评分
  },
  
  createdAt: new Date(),
  updatedAt: new Date()
}
```

**知识库初始化脚本**：

```javascript
// cloudfunctions/init-disease-knowledge/index.js
const INITIAL_DISEASES = [
  {
    disease: "小鹅瘟",
    // ... 完整数据
  },
  {
    disease: "鹅副粘病毒病",
    // ... 完整数据
  },
  // ... 其他常见疾病
]

exports.main = async (event, context) => {
  const db = cloud.database()
  const promises = INITIAL_DISEASES.map(disease => 
    db.collection('disease_knowledge').add({ data: disease })
  )
  
  await Promise.all(promises)
  return { success: true, count: INITIAL_DISEASES.length }
}
```

#### 2.2 基于知识库的智能匹配

```javascript
/**
 * 根据症状和剖检匹配疾病
 */
async function matchDiseaseFromKnowledge(symptoms, autopsyFindings, dayAge) {
  const db = cloud.database()
  const _ = db.command
  
  // 查询匹配日龄的疾病
  const result = await db.collection('disease_knowledge')
    .where({
      'epidemiology.susceptibleAge.0': _.lte(dayAge),
      'epidemiology.susceptibleAge.1': _.gte(dayAge)
    })
    .get()
  
  // 计算匹配度
  const matches = result.data.map(disease => {
    let score = 0
    
    // 症状匹配
    symptoms.forEach(symptom => {
      const found = disease.symptoms.typical.find(s => 
        s.symptom.includes(symptom) || symptom.includes(s.symptom)
      )
      if (found) score += found.weight
    })
    
    // 剖检病变匹配
    autopsyFindings.forEach(finding => {
      const found = disease.autopsyFindings.pathognomonic.find(af => 
        af.finding.includes(finding) || finding.includes(af.finding)
      )
      if (found) score += found.weight * 1.5 // 剖检证据权重更高
    })
    
    return {
      disease: disease.disease,
      score,
      confidence: Math.min(score * 5, 100), // 转换为置信度
      matchedSymptoms: symptoms.filter(s => 
        disease.symptoms.typical.some(ds => 
          ds.symptom.includes(s) || s.includes(ds.symptom)
        )
      ),
      matchedFindings: autopsyFindings.filter(f => 
        disease.autopsyFindings.pathognomonic.some(af => 
          af.finding.includes(f) || f.includes(af.finding)
        )
      )
    }
  })
  
  // 按得分排序
  return matches.sort((a, b) => b.score - a.score).slice(0, 3)
}

// 在AI诊断前调用
async function callAIModelWithKnowledge(inputData) {
  const { symptoms, autopsyFindings, animalInfo } = inputData
  
  // 从知识库获取匹配疾病
  const knowledgeMatches = await matchDiseaseFromKnowledge(
    symptoms,
    autopsyFindings?.abnormalities || [],
    animalInfo.dayAge
  )
  
  // 将知识库结果注入Prompt
  const knowledgeHint = `
【知识库匹配结果】
基于本场历史数据和疾病知识库，初步匹配：
${knowledgeMatches.map((m, i) => `
${i+1}. ${m.disease}（匹配度：${m.confidence}%）
   匹配症状：${m.matchedSymptoms.join('、')}
   匹配病变：${m.matchedFindings.join('、')}
`).join('\n')}

请结合这些匹配结果和你的专业判断给出最终诊断。
`
  
  // 加入到用户消息
  const enhancedUserMessage = `${buildAutopsyUserMessage(...)}

${knowledgeHint}`
  
  // 继续AI调用...
}
```

#### 2.3 反馈数据自动学习

```javascript
/**
 * 每次诊断被修正后，自动更新知识库统计
 */
async function updateDiseaseStatistics(correctionRecord) {
  const db = cloud.database()
  const _ = db.command
  
  const { correctedCause, aiAccuracyRating, deathCause } = correctionRecord
  
  // 更新确诊疾病的统计
  await db.collection('disease_knowledge')
    .where({ disease: correctedCause })
    .update({
      data: {
        'statistics.totalCases': _.inc(1),
        'statistics.confirmedCases': _.inc(1),
        'statistics.averageRating': _.set(
          // 计算新平均值（需要先查询旧值）
        ),
        updatedAt: new Date()
      }
    })
  
  // 如果AI误判，记录混淆矩阵
  if (deathCause !== correctedCause) {
    await db.collection('disease_confusion_matrix').add({
      data: {
        aiDiagnosis: deathCause,
        actualDiagnosis: correctedCause,
        symptoms: correctionRecord.diagnosisResult?.symptoms,
        autopsyFindings: correctionRecord.autopsyFindings,
        correctionReason: correctionRecord.correctionReason,
        dayAge: correctionRecord.diagnosisResult?.animalInfo?.dayAge,
        createdAt: new Date()
      }
    })
  }
}

// 在correctDeathDiagnosis函数中调用
async function correctDeathDiagnosis(event, wxContext) {
  // ... 原有修正逻辑
  
  // 🔥 更新知识库
  await updateDiseaseStatistics(updateData)
  
  return { success: true, ... }
}
```

**实施时间**：1-2个月
**工作量**：
- 知识库建设：1周（录入常见疾病）
- 匹配算法开发：1周
- 统计功能开发：3天
- 测试与优化：1周

**预期效果**：
- 准确率提升 **25-40%**
- 系统会"越用越聪明"
- 建立本场专属疾病模式库

---

### 阶段3：长期优化（3-6个月）- 模型微调

#### 3.1 数据标注与准备

```javascript
/**
 * 导出训练数据集
 */
async function exportTrainingDataset() {
  const db = cloud.database()
  
  // 导出所有已修正的记录
  const result = await db.collection('health_death_records')
    .where({
      isCorrected: true,
      aiAccuracyRating: _.exists(true)
    })
    .get()
  
  // 转换为训练格式
  const dataset = result.data.map(record => ({
    // 输入
    input: {
      symptoms: record.diagnosisResult?.symptomsText || '',
      symptomList: record.diagnosisResult?.symptoms || [],
      autopsyAbnormalities: record.autopsyFindings?.abnormalities || [],
      autopsyDescription: record.autopsyFindings?.description || '',
      dayAge: record.diagnosisResult?.animalInfo?.dayAge,
      deathCount: record.deathCount,
      hasImages: (record.photos || []).length > 0
    },
    
    // 输出（标准答案）
    output: {
      disease: record.correctedCause,
      confidence: record.aiAccuracyRating * 20, // 转换为0-100
      reasoning: record.correctionReason,
      preventionMeasures: record.diagnosisResult?.preventionMeasures || []
    },
    
    // 元数据
    metadata: {
      aiInitialDiagnosis: record.deathCause,
      rating: record.aiAccuracyRating,
      correctedBy: record.correctedByName,
      correctedAt: record.correctedAt
    }
  }))
  
  // 导出为JSON Lines格式（LLM微调标准格式）
  const jsonl = dataset.map(item => JSON.stringify({
    messages: [
      {
        role: "system",
        content: getAutopsySystemPrompt()
      },
      {
        role: "user",
        content: `请分析以下鹅只的死亡原因：

症状描述：${item.input.symptoms}
剖检发现：${item.input.autopsyAbnormalities.join('、')}
${item.input.autopsyDescription ? `农民描述：${item.input.autopsyDescription}` : ''}
动物日龄：${item.input.dayAge}天`
      },
      {
        role: "assistant",
        content: JSON.stringify({
          primaryCause: {
            disease: item.output.disease,
            confidence: item.output.confidence,
            reasoning: item.output.reasoning
          },
          preventionMeasures: item.output.preventionMeasures
        })
      }
    ]
  })).join('\n')
  
  return {
    dataset: jsonl,
    count: dataset.length,
    distribution: getDatasetDistribution(dataset)
  }
}

function getDatasetDistribution(dataset) {
  const diseases = {}
  dataset.forEach(item => {
    const disease = item.output.disease
    diseases[disease] = (diseases[disease] || 0) + 1
  })
  return diseases
}
```

#### 3.2 模型微调（Fine-tuning）

通义千问支持模型微调，需要：

1. **数据要求**：
   - 最少50条高质量标注数据
   - 推荐200+条覆盖各种疾病
   - 数据格式：JSON Lines

2. **微调步骤**：
   ```bash
   # 使用阿里云PAI-DSW或本地环境
   
   # 1. 上传训练数据
   aliyun pai-dsw upload-dataset \
     --file training_data.jsonl \
     --name goose-disease-diagnosis
   
   # 2. 创建微调任务
   aliyun pai-dsw create-finetune \
     --base-model qwen-plus \
     --dataset goose-disease-diagnosis \
     --epochs 3 \
     --learning-rate 2e-5
   
   # 3. 部署微调后的模型
   aliyun pai-dsw deploy-model \
     --model-id ft-qwen-plus-goose-v1
   ```

3. **集成到系统**：
   ```javascript
   // ai-multi-model/index.js
   const MODEL_CONFIGS = {
     // 新增自定义微调模型
     'qwen-plus-goose-v1': {
       provider: '阿里通义',
       baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
       model: 'ft-qwen-plus-goose-v1', // 微调后的模型ID
       apiKey: process.env.QWEN_API_KEY,
       tier: 'custom',
       specialty: 'goose-veterinary',
       description: '基于本场数据微调的专属鹅病诊断模型'
     }
   }
   
   const TASK_MODEL_MAPPING = {
     'health_diagnosis': {
       primary: 'qwen-plus-goose-v1', // 优先使用微调模型
       fallback: ['qwen-plus', 'qwen-long']
     }
   }
   ```

**成本估算**：
- 微调费用：约500-1000元（一次性）
- 调用费用：与原模型相同
- 预期准确率提升：**40-60%**

#### 3.3 持续优化循环

```javascript
/**
 * 定期评估模型性能
 */
async function evaluateModelPerformance() {
  const db = cloud.database()
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  // 查询最近一个月的诊断记录
  const result = await db.collection('health_death_records')
    .where({
      createdAt: _.gte(oneMonthAgo),
      isCorrected: true
    })
    .get()
  
  // 计算指标
  const metrics = {
    totalCases: result.data.length,
    avgRating: result.data.reduce((sum, r) => sum + r.aiAccuracyRating, 0) / result.data.length,
    highAccuracy: result.data.filter(r => r.aiAccuracyRating >= 4).length,
    lowAccuracy: result.data.filter(r => r.aiAccuracyRating <= 2).length,
    
    // 按疾病统计
    byDisease: {},
    
    // 混淆矩阵
    confusionPairs: {}
  }
  
  result.data.forEach(record => {
    const disease = record.correctedCause
    if (!metrics.byDisease[disease]) {
      metrics.byDisease[disease] = {
        count: 0,
        avgRating: 0,
        ratings: []
      }
    }
    metrics.byDisease[disease].count++
    metrics.byDisease[disease].ratings.push(record.aiAccuracyRating)
    
    // 记录误判情况
    if (record.deathCause !== disease) {
      const pair = `${record.deathCause} → ${disease}`
      metrics.confusionPairs[pair] = (metrics.confusionPairs[pair] || 0) + 1
    }
  })
  
  // 计算每个疾病的平均评分
  Object.keys(metrics.byDisease).forEach(disease => {
    const ratings = metrics.byDisease[disease].ratings
    metrics.byDisease[disease].avgRating = 
      ratings.reduce((sum, r) => sum + r, 0) / ratings.length
  })
  
  return metrics
}

// 定时任务：每月1号执行
// 可使用云函数定时触发器配置
exports.main = async (event, context) => {
  const metrics = await evaluateModelPerformance()
  
  // 如果平均评分<3.5，触发模型优化
  if (metrics.avgRating < 3.5) {
    console.log('模型性能下降，建议重新微调')
    // 发送通知给管理员
    await sendModelPerformanceAlert(metrics)
  }
  
  // 保存评估报告
  await db.collection('model_performance_reports').add({
    data: {
      period: '2025-10',
      metrics,
      createdAt: new Date()
    }
  })
  
  return metrics
}
```

---

## 📈 预期效果对比

| 阶段 | 实施时间 | 准确率提升 | 成本 | 难度 |
|------|---------|-----------|------|------|
| 阶段1：Prompt优化 | 1-2周 | +15-25% | 0元 | ⭐⭐ |
| 阶段2：知识库建设 | 1-2月 | +25-40% | 0元 | ⭐⭐⭐ |
| 阶段3：模型微调 | 3-6月 | +40-60% | 500-1000元 | ⭐⭐⭐⭐⭐ |

---

## 🚀 快速开始（本周可实施）

### 第一步：立即优化Prompt（2小时）

1. 修改 `cloudfunctions/ai-diagnosis/index.js`
2. 加入 `getTopAccuracyCases()` 函数
3. 更新 `getAutopsySystemPromptV2()` 函数
4. 部署云函数

### 第二步：测试效果（3天）

1. 用历史案例测试新Prompt
2. 对比修正前后的准确率
3. 收集用户反馈

### 第三步：迭代优化（持续）

1. 每周查看评分数据
2. 调整Prompt中的案例和规则
3. 逐步积累知识库数据

---

## 📝 实施检查清单

### 阶段1（本月完成）
- [ ] 实现 `getTopAccuracyCases()` 函数
- [ ] 优化系统Prompt加入案例
- [ ] 加入疾病特征速查表
- [ ] 实现置信度校准提示
- [ ] 部署并测试
- [ ] 收集一周数据对比效果

### 阶段2（下月开始）
- [ ] 设计疾病知识库数据结构
- [ ] 录入前10种常见疾病
- [ ] 开发知识库匹配算法
- [ ] 实现自动统计更新
- [ ] 建立混淆矩阵记录
- [ ] 生成可视化报表

### 阶段3（3个月后）
- [ ] 积累200+标注数据
- [ ] 导出训练数据集
- [ ] 提交模型微调任务
- [ ] 部署微调模型
- [ ] A/B测试对比效果
- [ ] 建立持续评估机制

---

## 💡 关键成功因素

1. **数据质量**：确保每次修正都认真填写修正理由
2. **持续反馈**：鼓励兽医使用评分功能
3. **循序渐进**：先优化Prompt，再建知识库，最后才微调模型
4. **成本控制**：优先使用免费方案，效果不足再考虑付费微调

---

## 🔗 相关文档

- [通义千问模型微调文档](https://help.aliyun.com/zh/model-studio/developer-reference/fine-tuning)
- [Few-Shot Learning最佳实践](https://platform.openai.com/docs/guides/prompt-engineering)
- [知识图谱在医疗AI中的应用](https://arxiv.org/abs/2302.10205)

---

## 📧 需要帮助？

如有疑问，请联系开发团队或查阅以上文档。

祝改进顺利！🎉

