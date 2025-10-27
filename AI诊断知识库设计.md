# 🧠 AI诊断知识库设计方案

## 📊 数据集合：ai_diagnosis_knowledge

### 集合用途
存储经过兽医验证的诊断案例，用于：
1. 提供相似病例参考，提高AI诊断准确率
2. 构建鹅类疾病知识图谱
3. 为后续模型微调提供训练数据

---

## 📋 字段结构

```javascript
{
  _id: 'knowledge_20241022_001',
  _openid: 'openid_xxx',  // 创建者
  
  // ==================== 基础信息 ====================
  createdAt: new Date('2024-10-22'),
  updatedAt: new Date('2024-10-22'),
  isDeleted: false,
  verified: true,           // 是否经过兽医验证
  verifiedBy: 'vet_openid', // 验证兽医ID
  verifiedAt: new Date('2024-10-22'),
  usageCount: 12,           // 被引用次数
  
  // ==================== 症状特征 ====================
  symptoms: ['腹泻', '精神萎靡', '食欲不振', '白色粪便'],
  symptomsText: '1日龄雏鹅出现严重腹泻，粪便呈白色糊状，肛门周围羽毛粘连...',
  
  // ==================== 图片信息 ====================
  images: [
    {
      url: 'cloud://prod-xxx/symptoms/img001.jpg',
      uploadedAt: new Date(),
      type: 'feces',  // 图片类型: feces(粪便), body(全身), local(局部病变)
      
      // AI图片分析结果
      aiAnalysis: {
        quality: 'good',  // good | fair | poor
        brightness: 0.75,
        clarity: 0.82,
        features: ['白色粪便', '肛门粘连']
      },
      
      // 人工标注特征
      manualAnnotations: ['粪便呈白色糊状', '肛门周围羽毛严重污染']
    }
  ],
  
  // ==================== 动物信息 ====================
  animalInfo: {
    dayAge: 1,          // 日龄
    species: '狮头鹅',
    batchId: 'batch_20241020_001',
    batchNumber: '2024-1020',
    affectedCount: 8,   // 受影响数量
    totalCount: 100     // 批次总数
  },
  
  // ==================== 环境信息 ====================
  environmentInfo: {
    temperature: 32,
    humidity: 65,
    season: 'autumn',
    location: '广东',
    feedType: '育雏饲料'
  },
  
  // ==================== AI诊断结果 ====================
  aiDiagnosis: {
    disease: '肠炎',
    confidence: 75,
    reasoning: '基于腹泻和精神萎靡症状的判断',
    differentialDiagnosis: [
      { disease: '雏鹅白痢', confidence: 60 },
      { disease: '营养不良', confidence: 40 }
    ],
    severity: 'moderate',
    urgency: 'high',
    modelInfo: {
      modelName: 'Qwen/Qwen2.5-72B-Instruct',
      provider: 'SiliconFlow',
      usedVision: false
    }
  },
  
  // ==================== ✅ 兽医确认诊断（重点）====================
  veterinaryDiagnosis: {
    disease: '雏鹅白痢',  // 实际确诊疾病
    confidence: 95,
    
    // 诊断依据
    reasoning: '粪便实验室检查确认为沙门氏菌感染，符合雏鹅白痢典型症状',
    
    // AI诊断是否正确
    agreement: 'disagree',  // agree | partial | disagree
    
    // 关键症状特征（用于匹配）
    keySymptoms: [
      '白色粪便',
      '1-3日龄发病',
      '肛门粘连',
      '精神萎靡'
    ],
    
    // 关键图片特征
    keyImageFeatures: [
      '粪便呈白色糊状',
      '肛门周围羽毛严重污染'
    ],
    
    // 鉴别诊断要点（与其他疾病的区别）
    differentialPoints: [
      {
        disease: '肠炎',
        difference: '白痢粪便是白色，肠炎粪便通常是绿色或黄色'
      },
      {
        disease: '营养不良',
        difference: '白痢多发于3日龄内，营养不良通常7日龄后出现'
      }
    ],
    
    // 实验室检查结果（如有）
    labResults: {
      method: '粪便细菌培养',
      result: '检出沙门氏菌',
      date: new Date('2024-10-22')
    }
  },
  
  // ==================== 治疗方案和效果 ====================
  treatmentPlan: {
    immediate: ['立即隔离病鹅', '清洁消毒鹅舍'],
    
    medication: [
      {
        name: '恩诺沙星',
        dosage: '5mg/kg体重',
        route: '口服拌料',
        frequency: '每日2次',
        duration: '5天',
        actualUsed: true
      },
      {
        name: '益生菌',
        dosage: '按说明添加',
        route: '饮水',
        frequency: '每日1次',
        duration: '7天',
        actualUsed: true
      }
    ],
    
    supportive: [
      '提高育雏温度至33-35℃',
      '加强通风',
      '补充电解质'
    ]
  },
  
  // ==================== 治疗结果（重要）====================
  treatmentOutcome: {
    // 治疗开始和结束时间
    startDate: new Date('2024-10-22'),
    endDate: new Date('2024-10-27'),
    
    // 治疗效果
    effectiveRate: 0.875,  // 治愈率 87.5%
    recoveryDays: 5,       // 平均康复天数
    mortality: 0.125,      // 死亡率 12.5%
    
    // 详细统计
    affected: 8,    // 受影响数量
    recovered: 7,   // 康复数量
    died: 1,        // 死亡数量
    
    // 治疗评价
    evaluation: 'good',  // excellent | good | fair | poor
    notes: '治疗及时，大部分鹅3天后症状明显改善'
  },
  
  // ==================== 预后和复发 ====================
  followUp: {
    hasRelapse: false,    // 是否复发
    relapseRate: 0,
    preventionMeasures: [
      '加强育雏期温度控制',
      '严格消毒进雏设备',
      '使用抗菌药物预防'
    ]
  },
  
  // ==================== 元数据 ====================
  metadata: {
    dataSource: 'clinical',  // clinical | user_feedback | literature
    reliability: 0.95,       // 数据可靠性评分
    tags: ['雏鹅', '消化道', '细菌感染', '1日龄'],
    region: '广东',
    season: 'autumn',
    year: 2024
  }
}
```

---

## 🔍 索引设计

```javascript
// 1. 症状查询索引（复合）
db.collection('ai_diagnosis_knowledge').createIndex({
  symptoms: 1,
  'animalInfo.dayAge': 1,
  verified: 1
})

// 2. 疾病查询索引
db.collection('ai_diagnosis_knowledge').createIndex({
  'veterinaryDiagnosis.disease': 1,
  verified: 1
})

// 3. 时间索引
db.collection('ai_diagnosis_knowledge').createIndex({
  createdAt: -1
})

// 4. 使用频率索引
db.collection('ai_diagnosis_knowledge').createIndex({
  usageCount: -1,
  verified: 1
})

// 5. 日龄索引（常用筛选条件）
db.collection('ai_diagnosis_knowledge').createIndex({
  'animalInfo.dayAge': 1
})
```

---

## 📈 使用场景

### 1. 相似病例匹配

```javascript
// 在 process-ai-diagnosis 中调用
async function findSimilarCases(symptoms, dayAge, images) {
  const db = cloud.database()
  const _ = db.command
  
  // 查找相似症状的已验证案例
  const results = await db.collection('ai_diagnosis_knowledge')
    .where({
      verified: true,
      symptoms: _.in(symptoms),  // 包含任一症状
      'animalInfo.dayAge': _.gte(dayAge - 3).and(_.lte(dayAge + 3)),  // 日龄±3天
      'treatmentOutcome.effectiveRate': _.gte(0.7)  // 治愈率>70%
    })
    .orderBy('usageCount', 'desc')  // 优先使用高频案例
    .limit(5)
    .get()
  
  return results.data
}
```

### 2. 增强AI提示词

```javascript
// 将相似案例加入提示词
const similarCases = await findSimilarCases(task.symptoms, task.dayAge, task.images)

const knowledgeContext = similarCases.map((case, index) => {
  return `
【相似案例${index + 1}】（相似度${calculateSimilarity(task, case)}%）
- 症状: ${case.symptoms.join(', ')}
- AI初诊: ${case.aiDiagnosis.disease} (${case.aiDiagnosis.confidence}%)
- 兽医确诊: ${case.veterinaryDiagnosis.disease} (${case.veterinaryDiagnosis.confidence}%)
- 鉴别要点: ${case.veterinaryDiagnosis.differentialPoints.map(p => p.difference).join('; ')}
- 治疗效果: 治愈率${Math.round(case.treatmentOutcome.effectiveRate * 100)}%，${case.treatmentOutcome.recoveryDays}天康复
- 用药: ${case.treatmentPlan.medication.map(m => m.name).join('、')}
  `
}).join('\n\n')

// 加入系统提示词
const systemPrompt = `你是专业兽医，请参考以下历史案例进行诊断：

${knowledgeContext}

请基于症状、图片和历史案例进行综合判断...`
```

### 3. 诊断后保存到知识库

```javascript
// 在兽医审查确认后自动添加
async function saveToKnowledgeBase(diagnosisId, veterinaryReview) {
  const db = cloud.database()
  
  // 获取原始诊断任务
  const task = await db.collection('ai_diagnosis_tasks').doc(diagnosisId).get()
  
  // 构建知识库记录
  const knowledgeRecord = {
    ...task.data,
    verified: true,
    verifiedBy: veterinaryReview.reviewerId,
    verifiedAt: new Date(),
    veterinaryDiagnosis: {
      disease: veterinaryReview.correctDisease,
      confidence: 95,
      reasoning: veterinaryReview.reasoning,
      agreement: veterinaryReview.agreement,
      keySymptoms: veterinaryReview.keySymptoms,
      differentialPoints: veterinaryReview.differentialPoints
    },
    usageCount: 0
  }
  
  await db.collection('ai_diagnosis_knowledge').add({
    data: knowledgeRecord
  })
}
```

### 4. 统计分析

```javascript
// 疾病谱分析
async function getDiseaseStatistics() {
  const db = cloud.database()
  
  const result = await db.collection('ai_diagnosis_knowledge')
    .aggregate()
    .match({ verified: true })
    .group({
      _id: '$veterinaryDiagnosis.disease',
      count: db.command.aggregate.sum(1),
      avgRecoveryDays: db.command.aggregate.avg('$treatmentOutcome.recoveryDays'),
      avgEffectiveRate: db.command.aggregate.avg('$treatmentOutcome.effectiveRate')
    })
    .sort({ count: -1 })
    .end()
  
  return result.list
}
```

---

## 🎯 数据积累计划

### 第一阶段：手动录入（1-2周）
- 兽医团队录入20-30个典型病例
- 覆盖常见疾病：雏鹅白痢、小鹅瘟、肠炎、大肠杆菌病

### 第二阶段：用户反馈（1-2个月）
- 用户使用AI诊断后，引导兽医审查
- 每次审查后自动加入知识库
- 目标：积累100+验证案例

### 第三阶段：持续优化（3-6个月）
- 根据使用频率优化案例质量
- 删除低效案例
- 补充边缘病例
- 目标：500+高质量案例

---

## 💡 准确率提升预期

| 阶段 | 案例数 | AI准确率 | 提升效果 |
|------|--------|----------|----------|
| **当前** | 0 | 60-70% | - |
| **阶段一** | 20-30 | 70-75% | +10% |
| **阶段二** | 100+ | 75-85% | +15-25% |
| **阶段三** | 500+ | 80-90% | +20-30% |

---

## 🔧 实施步骤

### 1. 创建集合（立即）

```javascript
// 在微信云开发控制台 → 数据库 → 创建集合
集合名称: ai_diagnosis_knowledge
权限: 仅创建者及管理员可读写
```

### 2. 添加测试数据（本周）

```javascript
// 手动添加2-3个典型案例测试
db.collection('ai_diagnosis_knowledge').add({
  data: {
    // ... 参考上面的字段结构
  }
})
```

### 3. 集成到诊断流程（下周）

- 修改 `process-ai-diagnosis` 云函数
- 添加相似案例查询功能
- 优化提示词构建

### 4. 开发兽医审查界面（2周后）

- 新增页面：`miniprogram/pages/vet-review/`
- 引导审查功能
- 一键加入知识库

---

## 📚 参考文档

- 详细实施代码见：《AI诊断准确率提升方案.md》第二阶段
- 数据库集合规范：《数据库集合初始化指南.md》
- 云函数开发规范：《微信云开发云函数规范.md》（项目memory）

