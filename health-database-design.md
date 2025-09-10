# 🏥 健康管理模块数据库设计方案

## 📋 整体架构设计

基于Context Engineering最佳实践和微信小程序开发规范，设计健康管理模块数据库架构。

### 🎯 核心设计原则

1. **关联生产数据**: 健康数据与生产批次、存栏数据深度关联
2. **全流程追踪**: 从预防→监控→诊断→治疗→康复的完整链路
3. **AI智能集成**: 支持AI诊断和智能分析功能
4. **权限分级管理**: 基于用户角色的数据访问控制
5. **统计分析支持**: 支持多维度统计分析和报表生成

## 📊 数据集合结构

### 1. health_records (健康记录) - 核心集合
**权限**: 🟠 所有用户可读，仅创建者可读写

```javascript
{
  _id: "HR241210001",
  _openid: "user_openid",
  
  // 关联信息
  batchId: "B241201001", // 关联生产批次
  animalIds: ["A001", "A002"], // 受影响的个体ID（可选）
  locationId: "BARN_001", // 鹅舍位置
  
  // 健康基础信息
  recordDate: "2024-12-10",
  recordTime: "08:30:00",
  recordType: "abnormal", // abnormal|routine|follow_up|ai_diagnosis
  
  // 症状和诊断
  symptoms: "咳嗽、精神萎靡、食欲减退", 
  symptomsDetail: {
    respiratory: ["咳嗽", "喘气"],
    digestive: ["食欲减退"],
    behavioral: ["精神萎靡"],
    physical: ["体温偏高"],
    custom: []
  },
  
  // 严重程度和数量
  severity: "moderate", // mild|moderate|severe
  affectedCount: 5,
  totalCount: 100, // 该批次总数
  
  // 诊断信息
  diagnosis: {
    preliminary: "疑似呼吸道感染",
    confirmed: "细菌性肺炎", // 确诊后填写
    confidence: 85, // AI诊断置信度
    diagnosisMethod: "ai", // manual|ai|veterinary
    veterinarianId: "VET001" // 兽医ID（如果有）
  },
  
  // 治疗方案
  treatment: {
    plan: "恩诺沙星口服，隔离观察",
    medication: [{
      name: "恩诺沙星",
      dosage: "10mg/kg",
      frequency: "每日2次",
      duration: "5天"
    }],
    isolation: true,
    specialCare: ["保温", "单独喂养"]
  },
  
  // 状态跟踪
  status: "ongoing", // ongoing|cured|death|transferred
  result: "ongoing", // ongoing|cured|death
  
  // 成本信息
  treatmentCost: 25.50,
  materialUsed: [{
    materialId: "MED001",
    quantity: 2,
    unit: "支"
  }],
  
  // 图片和附件
  images: ["cloud://image1.jpg", "cloud://image2.jpg"],
  attachments: [],
  
  // 操作信息
  operator: "张三",
  operatorId: "OP001",
  
  // 系统字段
  createTime: "2024-12-10T08:30:00.000Z",
  updateTime: "2024-12-10T08:30:00.000Z",
  isDeleted: false
}
```

### 2. prevention_records (预防记录)
**权限**: 🟠 所有用户可读，仅创建者可读写

```javascript
{
  _id: "PR241210001",
  _openid: "user_openid",
  
  // 关联信息
  batchId: "B241201001",
  locationId: "BARN_001",
  
  // 预防类型
  preventionType: "vaccine", // vaccine|disinfection|nutrition|inspection
  
  // 疫苗接种记录
  vaccineRecord: {
    vaccineName: "禽流感疫苗H5N1",
    manufacturer: "华兽制药",
    batchNumber: "VN20240315",
    expiryDate: "2025-03-15",
    dosage: "0.5ml/只",
    route: "肌肉注射", // 接种途径
    targetCount: 200,
    actualCount: 198,
    nextSchedule: "2024-04-15" // 下次接种时间
  },
  
  // 消毒记录
  disinfectionRecord: {
    disinfectant: "聚维酮碘",
    concentration: "1:200",
    area: 500, // 平方米
    method: "喷雾消毒",
    weather: "晴天", // 天气条件
    temperature: 18, // 温度
    humidity: 65 // 湿度
  },
  
  // 营养保健
  nutritionRecord: {
    supplement: "维生素C",
    dosage: "2g/100只",
    method: "饮水添加",
    duration: 7, // 天数
    purpose: "增强免疫力"
  },
  
  // 巡检记录
  inspectionRecord: {
    inspector: "李四",
    inspectionItems: ["精神状态", "食欲情况", "呼吸状态", "排泄正常"],
    abnormalFindings: [],
    totalInspected: 100,
    abnormalCount: 0,
    notes: "整体健康状况良好"
  },
  
  // 执行信息
  executionDate: "2024-12-10",
  executionTime: "09:00:00",
  operator: "张三",
  operatorId: "OP001",
  
  // 成本和效果
  cost: 150.00,
  materialUsed: [{
    materialId: "VAC001",
    quantity: 40,
    unit: "支",
    cost: 120.00
  }],
  effectiveness: "excellent", // excellent|good|fair|poor
  
  // 下次计划
  nextScheduled: {
    date: "2024-04-15",
    type: "vaccine",
    notes: "二免接种"
  },
  
  // 系统字段
  createTime: "2024-12-10T09:00:00.000Z",
  updateTime: "2024-12-10T09:00:00.000Z",
  isDeleted: false
}
```

### 3. treatment_records (治疗记录)
**权限**: 🟠 所有用户可读，仅创建者可读写

```javascript
{
  _id: "TR241210001",
  _openid: "user_openid",
  
  // 关联信息
  healthRecordId: "HR241210001",
  batchId: "B241201001",
  animalIds: ["A001", "A002"],
  
  // 治疗基础信息
  treatmentDate: "2024-12-10",
  treatmentType: "medication", // medication|surgery|isolation|supportive
  
  // 诊断信息
  diagnosis: "细菌性呼吸道感染",
  diagnosisConfidence: 90,
  veterinarianId: "VET001",
  veterinarianName: "王医师",
  
  // 治疗方案详情
  treatmentPlan: {
    primary: "抗生素治疗",
    secondary: ["隔离观察", "营养支持"],
    duration: 7, // 预计治疗天数
    followUpSchedule: ["3天后复查", "7天后评估"]
  },
  
  // 用药记录
  medications: [{
    medicationId: "MED001",
    name: "恩诺沙星注射液",
    dosage: "10mg/kg",
    route: "肌肉注射", // 给药途径
    frequency: "每日2次",
    startDate: "2024-12-10",
    endDate: "2024-12-17",
    totalDays: 7,
    status: "ongoing" // ongoing|completed|discontinued
  }],
  
  // 治疗进展
  progress: [{
    date: "2024-12-10",
    day: 1,
    symptoms: "咳嗽减轻，精神状态改善",
    temperature: 39.2,
    appetite: "good",
    notes: "治疗效果明显",
    operator: "张三"
  }],
  
  // 治疗结果
  outcome: {
    status: "ongoing", // ongoing|cured|improved|deteriorated|death
    curedCount: 0,
    improvedCount: 3,
    deathCount: 0,
    totalTreated: 5,
    recoveryRate: 0, // 治愈率（治疗完成后计算）
    averageTreatmentDays: 0
  },
  
  // 费用统计
  cost: {
    medication: 85.50,
    veterinary: 100.00,
    supportive: 20.00,
    total: 205.50
  },
  
  // 物料消耗
  materialsUsed: [{
    materialId: "MED001",
    quantity: 3,
    unit: "支",
    unitCost: 28.50,
    totalCost: 85.50
  }],
  
  // 系统字段
  createTime: "2024-12-10T10:00:00.000Z",
  updateTime: "2024-12-10T10:00:00.000Z",
  isDeleted: false
}
```

### 4. health_alerts (健康预警)
**权限**: 🟠 所有用户可读，仅创建者可读写

```javascript
{
  _id: "HA241210001",
  _openid: "system", // 系统生成
  
  // 预警基础信息
  alertType: "mortality", // mortality|abnormal|survival_rate|epidemic
  severity: "high", // low|medium|high|critical
  status: "active", // active|acknowledged|resolved|ignored
  
  // 触发条件
  trigger: {
    condition: "单批次死亡率超过3%",
    threshold: 3, // 阈值
    actualValue: 5.2, // 实际值
    batchId: "B241201001",
    locationId: "BARN_001"
  },
  
  // 预警内容
  title: "1号鹅舍死亡率异常",
  message: "批次B241201001死亡率达到5.2%，超过预警阈值3%",
  
  // 关联数据
  relatedRecords: {
    healthRecordIds: ["HR241210001", "HR241210002"],
    deathRecordIds: ["DR241210001"],
    batchIds: ["B241201001"]
  },
  
  // 建议措施
  recommendations: [
    "立即隔离异常个体",
    "加强健康监控频率",
    "联系兽医进行专业诊断",
    "检查饲料和饮水质量"
  ],
  
  // 处理记录
  handling: {
    acknowledgedBy: "张三",
    acknowledgedTime: "2024-12-10T11:00:00.000Z",
    actions: ["已隔离异常个体", "已联系兽医"],
    resolvedTime: null,
    resolvedBy: null,
    resolution: null
  },
  
  // 系统字段
  createTime: "2024-12-10T10:30:00.000Z",
  updateTime: "2024-12-10T11:00:00.000Z",
  isDeleted: false
}
```

### 5. health_statistics (健康统计)
**权限**: 🟠 所有用户可读，仅创建者可读写

```javascript
{
  _id: "HS241210001",
  _openid: "system",
  
  // 统计周期
  periodType: "daily", // daily|weekly|monthly|batch
  periodStart: "2024-12-10T00:00:00.000Z",
  periodEnd: "2024-12-10T23:59:59.000Z",
  
  // 统计范围
  scope: {
    batchIds: ["B241201001", "B241201002"],
    locationIds: ["BARN_001", "BARN_002"],
    totalScope: true // 全场统计
  },
  
  // 基础统计
  basicStats: {
    totalAnimals: 2000, // 总存栏
    healthyCount: 1950, // 健康个体
    abnormalCount: 35, // 异常个体
    treatingCount: 30, // 治疗中
    isolatedCount: 15, // 隔离中
    deathCount: 15, // 死亡个体
    survivalRate: 99.25 // 存活率
  },
  
  // 疾病统计
  diseaseStats: [{
    disease: "呼吸道感染",
    count: 20,
    rate: 1.0,
    curedCount: 15,
    cureRate: 75.0,
    avgTreatmentDays: 5.2
  }],
  
  // 死亡原因分析
  mortalityAnalysis: [{
    cause: "呼吸道感染",
    count: 8,
    rate: 53.3,
    ageGroup: "幼雏", // 幼雏|青年|成年
    preventable: true
  }],
  
  // 预防效果统计
  preventionStats: {
    vaccinationRate: 98.5,
    disinfectionFrequency: 2, // 每周次数
    inspectionCompliance: 95.0, // 巡检完成率
    preventionCost: 1250.00
  },
  
  // 治疗效果统计
  treatmentStats: {
    totalTreatments: 45,
    cureRate: 88.9,
    avgTreatmentDays: 4.8,
    treatmentCost: 2150.00,
    medicationUsage: [{
      medication: "恩诺沙星",
      usage: 15,
      cost: 450.00
    }]
  },
  
  // 成本分析
  costAnalysis: {
    preventionCost: 1250.00,
    treatmentCost: 2150.00,
    totalHealthCost: 3400.00,
    costPerAnimal: 1.70,
    preventionRatio: 36.8, // 预防成本占比
    roi: 2.5 // 投入产出比
  },
  
  // 趋势分析
  trends: {
    survivalRateTrend: "stable", // improving|stable|declining
    diseaseTrend: "decreasing",
    costTrend: "stable",
    comparisonPeriod: "last_month"
  },
  
  // 系统字段
  calculatedTime: "2024-12-10T23:30:00.000Z",
  createTime: "2024-12-10T23:30:00.000Z",
  isDeleted: false
}
```

### 6. vaccine_plans (疫苗计划)
**权限**: 🟠 所有用户可读，仅创建者可读写

```javascript
{
  _id: "VP241210001",
  _openid: "user_openid",
  
  // 疫苗计划基础信息
  planName: "2024年冬季免疫计划",
  planType: "routine", // routine|emergency|seasonal
  status: "active", // active|completed|cancelled|suspended
  
  // 疫苗信息
  vaccine: {
    name: "禽流感疫苗H5N1",
    manufacturer: "华兽制药",
    type: "inactivated", // live|inactivated|subunit
    diseases: ["禽流感H5N1", "禽流感H7N9"],
    ageGroups: ["雏鹅", "成鹅"],
    route: "肌肉注射",
    dosage: "0.5ml/只"
  },
  
  // 接种计划
  schedule: {
    firstDose: {
      date: "2024-12-15",
      ageRange: "14-21日龄",
      targetCount: 500,
      locations: ["BARN_001", "BARN_002"]
    },
    secondDose: {
      date: "2024-01-15",
      ageRange: "42-49日龄",
      targetCount: 480, // 考虑自然损耗
      locations: ["BARN_001", "BARN_002"]
    },
    booster: {
      interval: 6, // 月
      nextDate: "2024-07-15"
    }
  },
  
  // 目标批次
  targetBatches: [{
    batchId: "B241201001",
    locationId: "BARN_001",
    animalCount: 250,
    estimatedCost: 125.00
  }],
  
  // 物料需求
  materialRequirements: [{
    materialId: "VAC001",
    name: "禽流感疫苗H5N1",
    requiredQuantity: 100,
    unit: "支",
    estimatedCost: 500.00,
    supplier: "华兽制药",
    orderStatus: "ordered" // planned|ordered|received|used
  }],
  
  // 执行记录
  execution: [{
    executionDate: "2024-12-15",
    actualCount: 248,
    successRate: 99.2,
    operatorId: "OP001",
    notes: "2只因病未接种",
    cost: 124.00,
    completed: true
  }],
  
  // 效果评估
  effectiveness: {
    protectionRate: 95.0, // 保护率
    adverseReactions: 2, // 不良反应数
    immuneDuration: 6, // 免疫持续时间（月）
    nextEvaluation: "2024-06-15"
  },
  
  // 提醒设置
  reminders: [{
    type: "preparation", // preparation|execution|follow_up
    advanceDays: 7,
    notifyUsers: ["OP001", "VET001"],
    message: "疫苗接种准备提醒"
  }],
  
  // 系统字段
  createTime: "2024-12-01T09:00:00.000Z",
  updateTime: "2024-12-10T15:30:00.000Z",
  createdBy: "OP001",
  isDeleted: false
}
```

### 7. ai_diagnosis_history (AI诊断历史)
**权限**: 🟠 所有用户可读，仅创建者可读写

```javascript
{
  _id: "AD241210001",
  _openid: "user_openid",
  
  // 关联信息
  healthRecordId: "HR241210001",
  batchId: "B241201001",
  
  // 输入信息
  input: {
    symptoms: ["咳嗽", "精神萎靡", "食欲减退"],
    symptomsText: "鹅群出现咳嗽症状，精神萎靡，食欲减退",
    animalInfo: {
      species: "鹅",
      breed: "太湖鹅",
      ageInDays: 35,
      count: 5,
      weight: "1.2kg"
    },
    environmentInfo: {
      temperature: 18,
      humidity: 70,
      ventilation: "良好",
      density: "正常",
      season: "冬季"
    },
    images: ["cloud://symptoms1.jpg", "cloud://symptoms2.jpg"]
  },
  
  // AI分析结果
  aiResult: {
    primaryDiagnosis: {
      disease: "细菌性呼吸道感染",
      confidence: 85.5,
      probability: 0.855,
      reasoning: "基于症状组合和环境因素分析"
    },
    differentialDiagnosis: [{
      disease: "病毒性呼吸道感染",
      confidence: 68.2,
      probability: 0.682
    }, {
      disease: "冷应激综合征",
      confidence: 45.8,
      probability: 0.458
    }],
    riskFactors: [
      "冬季低温环境",
      "湿度偏高",
      "雏鹅免疫力较弱"
    ],
    severity: "moderate",
    urgency: "medium" // low|medium|high|critical
  },
  
  // 治疗建议
  treatmentRecommendation: {
    immediate: [
      "立即隔离患病个体",
      "改善舍内通风环境",
      "监测体温变化"
    ],
    medication: [{
      name: "恩诺沙星",
      dosage: "10-15mg/kg",
      route: "口服或肌注",
      frequency: "每日2次",
      duration: "5-7天",
      confidence: 90
    }],
    supportive: [
      "保持舍温20-22°C",
      "降低饲养密度",
      "提供清洁饮水"
    ],
    followUp: {
      timeline: "3天后复查",
      indicators: ["症状改善", "食欲恢复", "精神状态"]
    }
  },
  
  // 预防建议
  preventionAdvice: [
    "定期通风换气",
    "控制饲养密度",
    "加强营养管理",
    "做好冬季保温"
  ],
  
  // 模型信息
  modelInfo: {
    modelName: "VetAI-Poultry-v2.1",
    modelVersion: "2.1.0",
    trainingData: "2024年Q3数据集",
    accuracy: 89.2,
    lastUpdated: "2024-11-01"
  },
  
  // 人工验证
  veterinaryReview: {
    reviewed: true,
    reviewerId: "VET001",
    reviewerName: "王医师",
    reviewTime: "2024-12-10T11:30:00.000Z",
    agreement: "high", // high|medium|low|disagree
    comments: "AI诊断准确，治疗方案合理",
    adjustments: []
  },
  
  // 结果应用
  application: {
    adopted: true,
    adoptedBy: "张三",
    adoptionTime: "2024-12-10T10:45:00.000Z",
    treatmentPlanId: "TR241210001",
    outcome: null, // 治疗结果跟踪
    feedback: {
      useful: true,
      accuracy: 9, // 1-10评分
      comments: "诊断准确，很有帮助"
    }
  },
  
  // API调用信息
  apiInfo: {
    provider: "BaiduQianfan", // 大模型提供商
    model: "ERNIE-Bot-4.0",
    tokens: {
      input: 1250,
      output: 850,
      total: 2100
    },
    cost: 0.021, // 成本（元）
    responseTime: 2.8 // 响应时间（秒）
  },
  
  // 系统字段
  createTime: "2024-12-10T10:15:00.000Z",
  updateTime: "2024-12-10T11:30:00.000Z",
  isDeleted: false
}
```

## 📈 数据库索引设计

基于查询性能优化需求，扩展现有索引配置：

```json
{
  "health_records": [
    {"fields": ["_openid", "createTime"], "order": "desc"},
    {"fields": ["batchId", "recordDate"], "order": "desc"},
    {"fields": ["status", "severity", "recordType"]},
    {"fields": ["diagnosis.confirmed", "result"]},
    {"fields": ["locationId", "createTime"]},
    {"fields": ["recordDate", "affectedCount"], "order": "desc"}
  ],
  "prevention_records": [
    {"fields": ["_openid", "createTime"], "order": "desc"},
    {"fields": ["batchId", "preventionType", "executionDate"]},
    {"fields": ["preventionType", "executionDate"], "order": "desc"},
    {"fields": ["nextScheduled.date", "nextScheduled.type"]}
  ],
  "treatment_records": [
    {"fields": ["_openid", "createTime"], "order": "desc"},
    {"fields": ["healthRecordId", "treatmentDate"], "order": "desc"},
    {"fields": ["batchId", "outcome.status"]},
    {"fields": ["veterinarianId", "treatmentDate"]}
  ],
  "health_alerts": [
    {"fields": ["status", "severity", "createTime"], "order": "desc"},
    {"fields": ["alertType", "trigger.batchId"]},
    {"fields": ["relatedRecords.batchIds", "createTime"]}
  ],
  "health_statistics": [
    {"fields": ["periodType", "periodStart"], "order": "desc"},
    {"fields": ["scope.batchIds", "calculatedTime"]},
    {"fields": ["scope.totalScope", "periodStart"], "order": "desc"}
  ],
  "vaccine_plans": [
    {"fields": ["_openid", "createTime"], "order": "desc"},
    {"fields": ["status", "schedule.firstDose.date"]},
    {"fields": ["targetBatches.batchId", "status"]}
  ],
  "ai_diagnosis_history": [
    {"fields": ["_openid", "createTime"], "order": "desc"},
    {"fields": ["healthRecordId", "createTime"]},
    {"fields": ["aiResult.primaryDiagnosis.confidence"], "order": "desc"},
    {"fields": ["veterinaryReview.agreement", "createTime"]}
  ]
}
```

## 🔐 数据权限配置

基于现有权限架构，健康管理相关集合权限配置：

### 生产经营数据 (🟠 所有用户可读，仅创建者可读写)
- health_records - 健康记录
- prevention_records - 预防记录  
- treatment_records - 治疗记录
- health_alerts - 健康预警
- health_statistics - 健康统计
- vaccine_plans - 疫苗计划
- ai_diagnosis_history - AI诊断历史

### 敏感管理数据 (🔴 所有用户不可读写)
- ai_usage_stats - AI使用统计（成本敏感）
- veterinary_audit_logs - 兽医操作审计日志

## 🔄 数据流转关系

### 1. 生产数据关联
```
entry_records (入栏) → health_records (健康监控)
exit_records (出栏) ← health_statistics (健康统计)
materials (物料) → prevention_records (疫苗消耗)
materials (物料) → treatment_records (药品消耗)
```

### 2. 健康流程链路
```
prevention_records (预防) → health_records (监控) → treatment_records (治疗) → health_statistics (统计)
                                    ↓
ai_diagnosis_history (AI诊断) → treatment_records (治疗方案)
                                    ↓
health_alerts (预警系统) ← health_statistics (数据分析)
```

### 3. 统计分析数据流
```
所有健康记录 → health_statistics (实时统计) → 报表生成
vaccine_plans (疫苗计划) → prevention_records (执行记录) → 效果评估
```

## ⚙️ 业务规则设计

### 1. 存活率计算规则
```javascript
存活率 = (当前存栏数 / 入栏总数) * 100%
异常率 = (异常个体数 / 当前存栏数) * 100%  
治愈率 = (治愈个体数 / 治疗总数) * 100%
```

### 2. 预警触发规则
```javascript
死亡率预警: 单批次死亡率 > 3%
异常预警: 单批次异常个体 > 5只
存活率预警: 存活率 < 95%
疫情预警: 同类疾病 > 10例且48小时内
```

### 3. AI诊断规则
```javascript
高置信度: confidence >= 80% - 可直接参考
中置信度: 60% <= confidence < 80% - 需人工确认  
低置信度: confidence < 60% - 建议人工诊断
```

## 🚀 部署和维护

### 1. 集合创建顺序
1. health_records (核心集合)
2. prevention_records  
3. treatment_records
4. health_alerts
5. vaccine_plans
6. ai_diagnosis_history
7. health_statistics (最后，依赖其他集合数据)

### 2. 数据迁移策略
- 现有health_records数据格式兼容性检查
- 渐进式迁移，保持系统可用性
- 数据备份和回滚方案

### 3. 性能优化
- 定期统计数据预计算
- 大数据量分页查询
- 缓存热点数据
- 索引使用监控

这个数据库设计方案为健康管理模块提供了完整的数据支撑，支持从预防到治疗的全流程管理，并为AI智能诊断和统计分析提供了数据基础。
