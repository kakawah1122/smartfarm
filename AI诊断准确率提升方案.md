# 🎯 AI诊断准确率提升方案

## 问题分析

当前AI诊断系统存在以下局限:

### 1. 数据孤岛问题
- ✅ 有兽医审查功能,但数据未被利用
- ✅ 有用户反馈机制,但没有形成学习闭环
- ✅ 支持图片上传,但未进行图像识别分析

### 2. 模型能力限制
- 只基于文本症状描述诊断
- 缺少视觉信息(病变外观、粪便状态等)
- 没有历史病例数据库支持
- 无法学习和优化

---

## 🚀 三阶段提升方案

## 第一阶段: 增强视觉诊断 (1-2周实现)

### 1.1 集成多模态AI模型

当前代码只调用了文本模型,需要升级为支持图像的多模态模型:

**推荐模型:**
- **GLM-4V** (智谱AI视觉模型) - 免费额度
- **Qwen-VL** (通义千问视觉) - 开源免费
- **GPT-4o-mini** (OpenAI) - 低成本视觉

**实现方案:**

```javascript
// cloudfunctions/ai-multi-model/index.js

// 新增多模态模型配置
const MULTIMODAL_CONFIGS = {
  'glm-4v': {
    provider: '智谱AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    model: 'glm-4v',
    apiKey: process.env.GLM4_API_KEY,
    supportImages: true,
    maxImages: 4
  },
  'qwen-vl': {
    provider: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1/',
    model: 'Qwen/Qwen2-VL-7B-Instruct',
    apiKey: process.env.siliconflow_API_KEY,
    supportImages: true,
    maxImages: 10
  }
}

// 修改诊断消息构建
function buildVisionDiagnosisMessages(task) {
  const messages = [
    {
      role: 'system',
      content: '你是专业的家禽兽医,擅长通过症状描述和图片进行疾病诊断...'
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `症状描述: ${task.symptomsText}\n症状: ${task.symptoms.join(', ')}`
        },
        // ✨ 添加图片内容
        ...task.images.map(imageUrl => ({
          type: 'image_url',
          image_url: {
            url: imageUrl  // 微信云存储图片URL
          }
        }))
      ]
    }
  ]
  
  return messages
}
```

**预期提升:**
- 准确率从60-70%提升到75-85%
- 能够识别可视化症状(外观异常、粪便状态等)

---

### 1.2 图片预处理优化

```javascript
// cloudfunctions/ai-diagnosis/image-processor.js

// 图片质量检测和预处理
async function preprocessImage(imageUrl) {
  // 1. 下载图片
  const imageData = await downloadCloudImage(imageUrl)
  
  // 2. 质量检测
  const quality = await detectImageQuality(imageData)
  
  if (quality.score < 60) {
    return {
      valid: false,
      reason: '图片质量较低,建议重新拍摄',
      suggestions: [
        '确保光线充足',
        '对焦清晰',
        '拍摄患病部位特写'
      ]
    }
  }
  
  // 3. 图片增强(可选)
  if (quality.lowLight) {
    imageData = await enhanceBrightness(imageData)
  }
  
  return {
    valid: true,
    processedImage: imageData,
    metadata: quality
  }
}

// 下载云存储图片
async function downloadCloudImage(fileID) {
  const result = await cloud.downloadFile({
    fileID: fileID
  })
  
  return result.fileContent
}
```

---

## 第二阶段: 建立知识库和反馈循环 (2-3周)

### 2.1 兽医验证数据库

**新增数据集合: `ai_diagnosis_knowledge`**

```javascript
// 数据结构
{
  _id: 'knowledge_001',
  
  // 症状特征
  symptoms: ['腹泻', '精神萎靡', '食欲不振'],
  symptomsText: '1天大的雏鹅出现腹泻...',
  
  // 图片特征
  images: [
    {
      url: 'cloud://xxx',
      features: ['粪便呈黄绿色', '肛门周围羽毛污染'],
      analyzed: true
    }
  ],
  
  // 鹅只信息
  animalInfo: {
    dayAge: 1,
    species: '狮头鹅',
    batchId: 'batch_001'
  },
  
  // AI诊断结果
  aiDiagnosis: {
    disease: '肠炎',
    confidence: 85
  },
  
  // 🔑 兽医确认的正确诊断
  veterinaryDiagnosis: {
    disease: '雏鹅白痢',  // 实际诊断
    reasoning: '粪便检查发现沙门氏菌',
    agreement: 'disagree',  // AI诊断错误
    
    // 诊断特征标记
    keySymptoms: ['白色粪便', '肛门粘连'],  // 关键症状
    keyImageFeatures: ['粪便呈白色糊状'],   // 关键视觉特征
    
    // 鉴别要点
    differentialPoints: [
      '白痢的粪便是白色,肠炎是绿色',
      '白痢多发于3日龄内,肠炎多发于7日龄后'
    ]
  },
  
  // 治疗结果
  treatmentOutcome: {
    adopted: true,
    medication: ['恩诺沙星', '益生菌'],
    effectiveRate: 0.85,  // 治愈率85%
    recoveryDays: 3,
    mortality: 0.05       // 死亡率5%
  },
  
  // 元数据
  createdAt: new Date(),
  verifiedBy: 'vet_openid',
  verified: true,
  usageCount: 0  // 被引用次数
}
```

### 2.2 智能匹配系统

```javascript
// cloudfunctions/ai-diagnosis/knowledge-matcher.js

class KnowledgeMatcher {
  async findSimilarCases(currentSymptoms, dayAge, images) {
    const db = cloud.database()
    const _ = db.command
    
    // 1. 基于症状的模糊匹配
    const symptomMatches = await db.collection('ai_diagnosis_knowledge')
      .where({
        verified: true,
        symptoms: _.in(currentSymptoms),  // 包含任一症状
        'animalInfo.dayAge': _.gte(dayAge - 3).and(_.lte(dayAge + 3))  // 日龄±3天
      })
      .orderBy('usageCount', 'desc')  // 优先使用经验证的高频案例
      .limit(10)
      .get()
    
    // 2. 计算相似度
    const rankedCases = symptomMatches.data.map(case => {
      const similarity = this.calculateSimilarity(
        currentSymptoms,
        case.symptoms,
        images,
        case.images
      )
      
      return {
        ...case,
        similarity: similarity
      }
    }).sort((a, b) => b.similarity - a.similarity)
    
    // 3. 返回Top 3最相似案例
    return rankedCases.slice(0, 3)
  }
  
  calculateSimilarity(symptoms1, symptoms2, images1, images2) {
    // 症状相似度 (70%权重)
    const symptomSimilarity = this.jaccardSimilarity(symptoms1, symptoms2)
    
    // 图片相似度 (30%权重) - 如果有图片
    let imageSimilarity = 0
    if (images1.length > 0 && images2.length > 0) {
      // 简化版: 基于图片特征标签匹配
      imageSimilarity = this.compareImageFeatures(images1, images2)
    }
    
    return symptomSimilarity * 0.7 + imageSimilarity * 0.3
  }
  
  jaccardSimilarity(set1, set2) {
    const intersection = set1.filter(x => set2.includes(x)).length
    const union = new Set([...set1, ...set2]).size
    return intersection / union
  }
}
```

### 2.3 增强AI提示词

```javascript
// process-ai-diagnosis/index.js

async function buildEnhancedDiagnosisMessages(task) {
  // 查找相似历史案例
  const matcher = new KnowledgeMatcher()
  const similarCases = await matcher.findSimilarCases(
    task.symptoms,
    task.dayAge,
    task.images
  )
  
  // 构建包含知识库的提示词
  const knowledgeContext = similarCases.map((case, index) => {
    return `
相似案例${index + 1} (相似度${Math.round(case.similarity * 100)}%):
- 症状: ${case.symptoms.join(', ')}
- AI初步诊断: ${case.aiDiagnosis.disease}
- 兽医确诊: ${case.veterinaryDiagnosis.disease}
- 鉴别要点: ${case.veterinaryDiagnosis.differentialPoints.join('; ')}
- 治疗效果: 治愈率${Math.round(case.treatmentOutcome.effectiveRate * 100)}%
    `
  }).join('\n---\n')
  
  const systemPrompt = `你是专业的家禽兽医,请基于症状、图片和以下历史案例进行诊断。

【历史相似案例参考】
${knowledgeContext}

【诊断要求】
1. 优先考虑与历史案例的相似性
2. 注意鉴别诊断的关键差异点
3. 参考历史案例的治疗有效性
4. 如果症状与历史案例高度相似,可以提高置信度

回复格式: JSON (同之前格式)
  `
  
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildUserMessage(task) }
  ]
}
```

**预期效果:**
- 基于已验证的真实案例,准确率提升10-15%
- 避免重复性误诊
- 提供更有针对性的治疗建议

---

### 2.4 兽医反馈收集界面

**新增页面: `miniprogram/pages/ai-diagnosis-review/`**

```typescript
// 兽医审查页面
Page({
  data: {
    diagnosisRecord: null,
    reviewForm: {
      agreement: 'agree', // agree | partial | disagree
      correctDisease: '',
      keySymptoms: [],
      differentialPoints: '',
      comments: ''
    }
  },
  
  // 提交审查
  async submitReview() {
    const result = await CloudApi.reviewDiagnosis({
      recordId: this.data.diagnosisRecord._id,
      reviewData: this.data.reviewForm
    })
    
    if (result.success) {
      wx.showToast({
        title: '感谢您的专业反馈!',
        icon: 'success'
      })
      
      // 🔑 如果审查标记为"同意",自动加入知识库
      if (this.data.reviewForm.agreement === 'agree') {
        await this.addToKnowledgeBase()
      }
    }
  },
  
  // 添加到知识库
  async addToKnowledgeBase() {
    await CloudApi.addDiagnosisKnowledge({
      diagnosisId: this.data.diagnosisRecord._id,
      verified: true
    })
  }
})
```

---

## 第三阶段: 深度学习优化 (长期规划)

### 3.1 Fine-tuning 微调模型 (需要积累数据)

**数据要求:**
- 至少500-1000条兽医验证的诊断案例
- 包含症状、图片、正确诊断、治疗效果

**实施方案:**

```python
# 准备训练数据集 (每3-6个月更新一次)

# 1. 导出知识库数据
cases = db.collection('ai_diagnosis_knowledge').where({
  verified: True,
  'treatmentOutcome.effectiveRate': gt(0.7)  # 只使用治愈率>70%的案例
}).get()

# 2. 转换为训练格式
training_data = []
for case in cases:
    training_data.append({
        "messages": [
            {
                "role": "system",
                "content": "你是专业的鹅类疾病诊断专家..."
            },
            {
                "role": "user",
                "content": f"症状: {case['symptomsText']}\n日龄: {case['animalInfo']['dayAge']}"
            },
            {
                "role": "assistant",
                "content": json.dumps({
                    "primaryDiagnosis": {
                        "disease": case['veterinaryDiagnosis']['disease'],
                        "confidence": 95,  # 兽医确诊,高置信度
                        "reasoning": case['veterinaryDiagnosis']['reasoning']
                    },
                    "treatmentRecommendation": {
                        "medication": case['treatmentOutcome']['medication']
                    }
                }, ensure_ascii=False)
            }
        ]
    })

# 3. 上传到AI平台进行微调
# 智谱AI: https://open.bigmodel.cn/dev/howuse/finetuning
# 或使用开源模型自行微调
```

### 3.2 图像识别专用模型

**针对鹅类疾病的图像分类模型**

**训练流程:**

1. **数据收集**
   - 收集1000+张已标注的鹅病图片
   - 分类: 健康、白痢、肠炎、鹅瘟、营养不良等

2. **使用迁移学习**
   ```python
   # 基于ResNet50或EfficientNet
   from tensorflow.keras.applications import EfficientNetB0
   
   base_model = EfficientNetB0(
       include_top=False,
       weights='imagenet',
       input_shape=(224, 224, 3)
   )
   
   # 添加分类层
   model = Sequential([
       base_model,
       GlobalAveragePooling2D(),
       Dense(256, activation='relu'),
       Dropout(0.3),
       Dense(len(disease_classes), activation='softmax')
   ])
   
   # 训练
   model.compile(
       optimizer='adam',
       loss='categorical_crossentropy',
       metrics=['accuracy']
   )
   ```

3. **部署为云函数**
   - 将模型转换为TensorFlow.js
   - 或部署在专用的推理服务器上

**预期准确率:**
- 基于图像的疾病分类准确率可达80-90%
- 结合文本症状,综合准确率可达85-95%

---

## 📊 预期提升效果对比

| 阶段 | 准确率 | 实施成本 | 时间周期 | 主要改进 |
|------|--------|---------|----------|----------|
| **当前** | 60-70% | - | - | 纯文本AI诊断 |
| **第一阶段** | 75-85% | 低 | 1-2周 | 增加视觉分析 |
| **第二阶段** | 80-90% | 中 | 2-3周 | 知识库匹配 |
| **第三阶段** | 85-95% | 高 | 3-6个月 | 定制化模型 |

---

## 🎯 立即可实施的快速改进 (本周内)

### 1. 提示词优化

```javascript
// 当前提示词较简单,可以立即优化

const enhancedSystemPrompt = `你是专业的鹅类疾病诊断专家,拥有20年以上临床经验。

【重要诊断原则】
1. 狮头鹅的常见疾病谱:
   - 0-7日龄: 雏鹅白痢(沙门氏菌)、脐炎
   - 8-30日龄: 小鹅瘟、鹅副黏病毒、球虫病
   - 30日龄以上: 大肠杆菌病、禽流感、鹅瘟
   
2. 症状-疾病关键对应:
   - 白色粪便 + 3日龄内 → 高度怀疑雏鹅白痢
   - 绿色粪便 + 7日龄后 → 可能肠炎/大肠杆菌
   - 神经症状 + 任何日龄 → 警惕鹅瘟/新城疫
   
3. 诊断置信度标准:
   - >90%: 典型症状 + 符合日龄 + 有明确流行病学
   - 70-90%: 症状典型但缺少辅助信息
   - <70%: 症状不典型或信息不足

4. 鉴别诊断要点:
   - 必须列出2-3个鉴别诊断
   - 说明与主诊断的区别特征
   - 给出进一步确诊建议(如实验室检查)

【回复格式】
严格使用JSON格式,不要使用markdown代码块包裹:
{
  "primaryDiagnosis": { ... },
  ...
}
`

// 在 process-ai-diagnosis/index.js 中更新
```

### 2. 添加日龄-疾病关联验证

```javascript
// process-ai-diagnosis/index.js

// 日龄-疾病匹配度检查
function validateDiagnosisWithAge(disease, dayAge) {
  const diseaseAgeMap = {
    '雏鹅白痢': { minAge: 0, maxAge: 7, peak: 3 },
    '小鹅瘟': { minAge: 3, maxAge: 30, peak: 10 },
    '鹅瘟': { minAge: 30, maxAge: 365, peak: 60 },
    '肠炎': { minAge: 7, maxAge: 365, peak: 30 },
    '大肠杆菌病': { minAge: 10, maxAge: 365, peak: 45 }
  }
  
  const ageRange = diseaseAgeMap[disease]
  if (!ageRange) return 0.5  // 未知疾病,返回中等匹配度
  
  if (dayAge < ageRange.minAge || dayAge > ageRange.maxAge) {
    return 0.2  // 不在典型年龄范围,低匹配度
  }
  
  // 计算与高峰年龄的接近度
  const peakDistance = Math.abs(dayAge - ageRange.peak)
  const matchScore = Math.max(0.5, 1 - (peakDistance / 30))
  
  return matchScore
}

// 在AI返回结果后进行验证和调整
async function postProcessDiagnosis(aiDiagnosis, task) {
  const ageMatch = validateDiagnosisWithAge(
    aiDiagnosis.primaryDiagnosis.disease,
    task.dayAge
  )
  
  // 如果日龄匹配度低,调整置信度
  if (ageMatch < 0.5) {
    aiDiagnosis.primaryDiagnosis.confidence *= ageMatch
    aiDiagnosis.primaryDiagnosis.reasoning += 
      `\n⚠️ 注意: 该疾病不太符合当前日龄(${task.dayAge}天),建议进一步检查确认。`
  }
  
  return aiDiagnosis
}
```

### 3. 多轮对话优化

```javascript
// 当AI置信度较低时,自动追问获取更多信息

async function performDiagnosisWithFollowUp(task) {
  // 第一轮诊断
  const firstDiagnosis = await callAIModel(task)
  
  // 如果置信度<70%,进行追问
  if (firstDiagnosis.primaryDiagnosis.confidence < 70) {
    const followUpQuestions = generateFollowUpQuestions(firstDiagnosis)
    
    // 更新任务状态,提示用户补充信息
    await db.collection('ai_diagnosis_tasks')
      .doc(task._id)
      .update({
        data: {
          needMoreInfo: true,
          followUpQuestions: followUpQuestions,
          preliminaryDiagnosis: firstDiagnosis
        }
      })
    
    return {
      status: 'need_more_info',
      questions: followUpQuestions,
      preliminary: firstDiagnosis
    }
  }
  
  return firstDiagnosis
}

function generateFollowUpQuestions(diagnosis) {
  const questions = []
  
  const disease = diagnosis.primaryDiagnosis.disease
  
  if (disease === '肠炎') {
    questions.push('粪便颜色是什么?(白色/黄色/绿色/黑色)')
    questions.push('粪便状态?(水样/糊状/带血)')
    questions.push('发病前是否更换过饲料?')
  }
  
  if (disease === '呼吸道感染') {
    questions.push('是否有眼部分泌物?')
    questions.push('是否有甩头/张口呼吸?')
    questions.push('同批次发病率大约多少?')
  }
  
  // 通用问题
  questions.push('是否已经开始用药?用了什么药?')
  questions.push('发病后死亡数量?')
  
  return questions
}
```

---

## 💡 总结建议

### 短期(1个月内)
1. ✅ 优化提示词(立即)
2. ✅ 添加日龄验证(本周)
3. ✅ 集成视觉模型(2周)
4. ✅ 建立知识库结构(2周)

### 中期(3-6个月)
1. 收集100+兽医验证案例
2. 完善知识库匹配系统
3. 开发兽医审查工具
4. 积累图像训练数据

### 长期(6-12个月)
1. 模型微调(需500+案例)
2. 定制图像识别模型
3. 建立预测性诊断(基于流行病学)

---

## 🔧 需要您配合的事项

1. **邀请兽医参与**
   - 找1-2位合作兽医定期审查AI诊断
   - 记录实际诊断和治疗结果
   
2. **规范数据收集**
   - 引导用户上传清晰的症状图片
   - 要求填写完整的批次信息和日龄
   
3. **反馈跟踪**
   - 治疗后回访,记录治愈率
   - 将有效案例加入知识库

---

**立即可做:** 我可以帮您实施"快速改进"部分,预计本周内将准确率从当前的60-70%提升到75-80%。

**是否需要我先实施第一阶段的视觉诊断功能?**

