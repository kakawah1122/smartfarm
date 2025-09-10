# 完整数据库集合设计文档

## 概述
本文档详细描述了鹅场管理系统的完整数据库集合设计，涵盖生产、健康、财务、用户管理等所有业务模块。

## 数据库集合分类

### 1. 生产经营数据集合

#### `entry_records` - 入栏记录
```javascript
{
  _id: "ENT202401011234567", // 记录ID
  _openid: "user_openid",     // 创建者
  quantity: 100,              // 入栏数量
  source: "供应商A",          // 来源
  batchNumber: "B24010112",   // 批次号
  unitPrice: 15.50,           // 单价
  totalCost: 1550.00,         // 总成本
  notes: "优质苗种",          // 备注
  photos: ["url1", "url2"],   // 照片
  status: "active",           // 状态
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `exit_records` - 出栏记录
```javascript
{
  _id: "EXT202401011234567",
  _openid: "user_openid",
  quantity: 50,
  destination: "批发市场",
  batchNumber: "B24010112",
  unitPrice: 45.00,
  totalRevenue: 2250.00,
  exitReason: "sale", // sale, death, transfer
  notes: "正常销售",
  status: "completed",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `inventory_logs` - 库存变动日志
```javascript
{
  _id: "auto_generated_id",
  recordId: "ENT202401011234567", // 关联记录ID
  type: "entry", // entry, exit, death, transfer
  quantity: 100,
  batchNumber: "B24010112",
  beforeStock: 200,
  afterStock: 300,
  createTime: "2024-01-01T12:00:00.000Z",
  _openid: "user_openid"
}
```

#### `production_batches` - 生产批次管理
```javascript
{
  _id: "BATCH202401011234567",
  _openid: "user_openid",
  name: "2024年第1批次",
  batchNumber: "B24010112",
  plannedQuantity: 1000,
  actualQuantity: 980,
  expectedStartDate: "2024-01-01T00:00:00.000Z",
  expectedEndDate: "2024-06-01T00:00:00.000Z",
  actualStartDate: "2024-01-01T00:00:00.000Z",
  actualEndDate: "",
  status: "active", // planned, active, completed, cancelled
  notes: "春季批次",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `material_records` - 物料使用记录
```javascript
{
  _id: "MAT202401011234567",
  _openid: "user_openid",
  materialType: "feed", // feed, medicine, equipment, other
  materialName: "鹅用饲料",
  quantity: 500,
  unit: "kg",
  unitPrice: 3.50,
  totalCost: 1750.00,
  supplier: "饲料供应商",
  batchNumber: "B24010112",
  relatedRecordId: "ENT202401011234567",
  notes: "优质饲料",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

### 2. 健康管理数据集合

#### `health_records` - 健康记录
```javascript
{
  _id: "HEALTH202401011234567",
  _openid: "user_openid",
  animalId: "G001", // 个体标识
  batchNumber: "B24010112",
  location: "1号鹅舍",
  symptoms: "精神萎靡，食欲不振",
  diagnosisDisease: "疑似感冒",
  treatment: "隔离观察，投喂药物",
  severity: "mild", // mild, moderate, severe
  affectedCount: 5,
  result: "ongoing", // ongoing, cured, death
  notes: "持续观察",
  photos: ["url1", "url2"],
  followUpDate: "2024-01-03T00:00:00.000Z",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `prevention_records` - 预防记录
```javascript
{
  _id: "PREV202401011234567",
  _openid: "user_openid",
  preventionType: "vaccination", // vaccination, disinfection, inspection, healthcare
  vaccineName: "禽流感疫苗",
  location: "1号鹅舍",
  targetAnimals: 100,
  executorName: "张技术员",
  scheduledDate: "2024-01-01T00:00:00.000Z",
  executedDate: "2024-01-01T10:00:00.000Z",
  status: "completed", // scheduled, completed, delayed, cancelled
  effectEvaluation: "良好",
  nextScheduleDate: "2024-02-01T00:00:00.000Z",
  notes: "按计划执行",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `treatment_records` - 治疗记录
```javascript
{
  _id: "TREAT202401011234567",
  _openid: "user_openid",
  healthRecordId: "HEALTH202401011234567", // 关联健康记录
  diagnosisId: "AID202401011234567", // 关联AI诊断
  diagnosisDisease: "禽流感",
  treatment: "抗病毒治疗",
  medicationUsed: ["药物A", "药物B"],
  dosage: "每日两次，每次10ml",
  treatmentDuration: "7天",
  treatmentDay: 3, // 当前治疗天数
  status: "ongoing", // ongoing, completed, discontinued
  nextTreatmentDate: "2024-01-02T00:00:00.000Z",
  sideEffects: "",
  effectiveness: "good", // poor, fair, good, excellent
  notes: "按时服药",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `ai_diagnosis_records` - AI诊断记录
```javascript
{
  _id: "AID202401011234567",
  _openid: "user_openid",
  healthRecordId: "HEALTH202401011234567", // 可选关联
  symptoms: "发热、咳嗽、精神萎靡",
  affectedCount: 5,
  dayAge: 30,
  temperature: 25,
  images: ["url1", "url2"],
  diagnosisResult: "疑似禽流感",
  possibleDiseases: ["禽流感", "新城疫"],
  recommendedMedications: ["抗病毒药物", "免疫增强剂"],
  treatmentDuration: "7-10天",
  confidence: 85,
  precautions: ["隔离病鹅", "加强消毒"],
  status: "pending_confirmation", // pending_confirmation, adopted, confirmed, rejected
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `vaccine_plans` - 疫苗计划
```javascript
{
  _id: "VAC202401011234567",
  _openid: "user_openid",
  planName: "春季免疫计划",
  vaccineName: "禽流感疫苗",
  targetBatch: "B24010112",
  plannedDate: "2024-01-15T00:00:00.000Z",
  plannedQuantity: 1000,
  actualDate: "",
  actualQuantity: 0,
  location: "1号鹅舍",
  executorName: "",
  status: "planned", // planned, executed, delayed, cancelled
  notes: "首次免疫",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `health_alerts` - 健康预警
```javascript
{
  _id: "ALERT202401011234567",
  type: "high_mortality", // high_mortality, disease_outbreak, low_vaccination_rate
  severity: "high", // low, medium, high, critical
  message: "死亡率异常，建议立即检查",
  affectedBatch: "B24010112",
  affectedLocation: "1号鹅舍",
  triggerCondition: "死亡率超过5%",
  currentValue: 7.5,
  thresholdValue: 5.0,
  recommendations: ["立即隔离", "兽医诊断", "加强消毒"],
  status: "active", // active, acknowledged, resolved, ignored
  acknowledgedBy: "",
  acknowledgedTime: "",
  resolvedTime: "",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `death_records` - 死亡记录
```javascript
{
  _id: "DEATH202401011234567",
  _openid: "user_openid",
  batchNumber: "B24010112",
  location: "1号鹅舍",
  deathCount: 3,
  deathReason: "疾病", // disease, accident, natural, unknown
  diagnosedDisease: "禽流感",
  ageAtDeath: 45, // 日龄
  bodyCondition: "消瘦",
  necropsy: false, // 是否解剖
  necropsyResults: "",
  preventiveMeasures: "加强消毒，隔离健康鹅群",
  notes: "及时处理",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `followup_records` - 跟进记录
```javascript
{
  _id: "FOLLOW202401011234567",
  _openid: "user_openid",
  relatedRecordId: "HEALTH202401011234567", // 关联记录
  relatedRecordType: "health", // health, treatment, prevention
  followUpType: "treatment_progress", // treatment_progress, recovery_check, prevention_effect
  currentCondition: "症状减轻，食欲恢复",
  nextAction: "继续治疗3天",
  nextFollowUpDate: "2024-01-03T00:00:00.000Z",
  notes: "恢复良好",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `cure_records` - 治愈记录
```javascript
{
  _id: "CURE202401011234567",
  _openid: "user_openid",
  healthRecordId: "HEALTH202401011234567",
  treatmentRecordId: "TREAT202401011234567",
  originalSymptoms: "发热、咳嗽",
  diagnosedDisease: "禽流感",
  treatmentUsed: "抗病毒治疗",
  treatmentDuration: 7, // 天数
  curedCount: 5,
  recoveryRate: 100, // 康复率百分比
  finalCondition: "完全康复",
  preventiveMeasures: "定期检查，加强营养",
  notes: "治疗效果良好",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

### 3. 财务管理数据集合

#### `cost_records` - 成本记录
```javascript
{
  _id: "COST202401011234567",
  _openid: "user_openid",
  costType: "feed", // feed, health, labor, facility, other
  amount: 1500.00,
  description: "购买饲料",
  relatedRecordId: "MAT202401011234567", // 关联业务记录
  invoiceNumber: "INV-001",
  supplier: "饲料供应商",
  paymentMethod: "bank_transfer", // cash, bank_transfer, credit
  paymentDate: "2024-01-01T00:00:00.000Z",
  status: "confirmed", // pending, confirmed, disputed
  notes: "按时付款",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `revenue_records` - 收入记录
```javascript
{
  _id: "REV202401011234567",
  _openid: "user_openid",
  revenueType: "sales", // sales, subsidy, other
  amount: 5000.00,
  description: "销售商品鹅",
  relatedRecordId: "EXT202401011234567", // 关联出栏记录
  customer: "批发商A",
  invoiceNumber: "SALE-001",
  paymentMethod: "bank_transfer",
  receivedDate: "2024-01-01T00:00:00.000Z",
  status: "confirmed",
  notes: "按时收款",
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  isDeleted: false
}
```

#### `financial_summaries` - 财务汇总
```javascript
{
  _id: "SUMMARY202401",
  period: "2024-01", // 汇总期间
  periodType: "month", // day, week, month, quarter, year
  totalRevenue: 50000.00,
  totalCost: 35000.00,
  profit: 15000.00,
  profitMargin: 30.00, // 利润率百分比
  costBreakdown: {
    feed: 20000.00,
    health: 5000.00,
    labor: 8000.00,
    facility: 2000.00,
    other: 0.00
  },
  revenueBreakdown: {
    sales: 48000.00,
    subsidy: 2000.00,
    other: 0.00
  },
  generatedTime: "2024-02-01T00:00:00.000Z",
  generatedBy: "system"
}
```

#### `financial_reports` - 财务报表
```javascript
{
  _id: "RPT202401011234567",
  reportType: "comprehensive", // comprehensive, cost_analysis, profit_loss
  dateRange: {
    start: "2024-01-01T00:00:00.000Z",
    end: "2024-01-31T23:59:59.000Z"
  },
  summary: {
    totalRevenue: 50000.00,
    totalCost: 35000.00,
    profit: 15000.00,
    profitMargin: 30.00
  },
  details: {
    costRecords: [], // 详细成本记录
    revenueRecords: [] // 详细收入记录
  },
  charts: {
    costTrend: [], // 成本趋势数据
    profitTrend: [] // 利润趋势数据
  },
  generateTime: "2024-02-01T12:00:00.000Z",
  generatedBy: "user_openid"
}
```

### 4. 系统管理数据集合

#### `users` - 用户信息
```javascript
{
  _id: "auto_generated_id",
  _openid: "user_openid",
  nickName: "张三",                    // 用户昵称
  avatarUrl: "https://...",           // 头像URL
  phone: "13800138000",               // 手机号
  email: "zhangsan@example.com",      // 邮箱
  farmName: "千羽牧业",               // 养殖场名称（主字段）
  department: "千羽牧业",             // 兼容字段（与farmName保持一致）
  role: "employee", // super_admin, manager, employee, veterinarian
  status: "active", // active, inactive, pending
  permissions: [], // 额外权限
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z",
  lastLoginTime: "2024-01-01T12:00:00.000Z"
}
```

**字段说明：**
- `nickName`: 用户昵称（符合微信小程序规范）
- `farmName`: 养殖场名称（主要业务字段）
- `department`: 兼容字段，与farmName保持一致，用于向后兼容
- `role`: 更新为符合养殖场业务的角色体系

#### `roles` - 角色定义
```javascript
{
  _id: "role_technician",
  name: "技术员",
  description: "负责生产和健康管理的专业技术人员",
  permissions: [
    "production.*",
    "health.*",
    "user.read"
  ],
  isDefault: true,
  createTime: "2024-01-01T12:00:00.000Z",
  updateTime: "2024-01-01T12:00:00.000Z"
}
```

#### `permissions` - 权限配置
```javascript
{
  _id: "perm_production_create",
  module: "production",
  action: "create",
  resource: "*",
  description: "创建生产记录",
  isActive: true
}
```

#### `employee_invites` - 员工邀请
```javascript
{
  _id: "auto_generated_id",
  code: "ABCD1234", // 邀请码
  role: "technician",
  status: "active", // active, used, revoked, expired
  expiryTime: "2024-01-04T12:00:00.000Z",
  notes: "技术员邀请",
  createdBy: "admin_openid",
  createTime: "2024-01-01T12:00:00.000Z",
  usedBy: null,
  usedTime: null,
  revokedBy: null,
  revokedTime: null
}
```

#### `audit_logs` - 操作审计日志
```javascript
{
  _id: "auto_generated_id",
  _openid: "user_openid",
  action: "create_entry_record",
  targetId: "ENT202401011234567",
  targetType: "entry_record",
  description: "创建入栏记录",
  additionalData: {
    quantity: 100,
    batchNumber: "B24010112"
  },
  ipAddress: "127.0.0.1",
  userAgent: "miniprogram",
  createTime: "2024-01-01T12:00:00.000Z"
}
```

#### `notifications` - 通知记录
```javascript
{
  _id: "NOTIF202401011234567",
  type: "health_alert", // health_alert, vaccine_reminder, system_notification
  title: "健康预警",
  content: "发现异常死亡，请及时检查",
  targetUsers: ["user1", "user2"], // 空数组表示所有用户
  priority: "high", // low, normal, high, urgent
  relatedRecordId: "ALERT202401011234567",
  status: "unread", // unread, read, dismissed
  sendTime: "2024-01-01T12:00:00.000Z",
  expiryTime: "2024-01-03T12:00:00.000Z",
  createTime: "2024-01-01T12:00:00.000Z"
}
```

#### `user_notifications` - 用户通知状态
```javascript
{
  _id: "auto_generated_id",
  _openid: "user_openid",
  notificationId: "NOTIF202401011234567",
  status: "read", // unread, read, dismissed
  readTime: "2024-01-01T13:00:00.000Z",
  dismissedTime: null
}
```

#### `system_configs` - 系统配置
```javascript
{
  _id: "config_health_alerts",
  category: "health",
  key: "mortality_threshold",
  value: 5.0,
  description: "死亡率预警阈值（百分比）",
  dataType: "number", // string, number, boolean, object
  isEditable: true,
  updateTime: "2024-01-01T12:00:00.000Z",
  updatedBy: "admin_openid"
}
```

## 数据关联关系

### 核心业务流程关联
```
entry_records (入栏) 
    ↓ [batchNumber]
production_batches (批次管理)
    ↓ [batchNumber]
health_records (健康记录)
    ↓ [healthRecordId]
ai_diagnosis_records (AI诊断)
    ↓ [diagnosisId]
treatment_records (治疗记录)
    ↓ [treatmentRecordId]
cure_records (治愈记录)
    ↓ [batchNumber]
exit_records (出栏)
```

### 财务关联关系
```
entry_records → cost_records (入栏成本)
material_records → cost_records (物料成本)
treatment_records → cost_records (治疗成本)
exit_records → revenue_records (销售收入)
cost_records + revenue_records → financial_summaries
```

### 用户权限关联
```
users → roles → permissions
users → audit_logs (操作记录)
users → notifications (接收通知)
```

## 索引设计策略

### 主要索引
```javascript
// 高频查询索引
{ "_openid": 1, "createTime": -1 }  // 用户数据时间序列
{ "batchNumber": 1, "createTime": -1 }  // 批次相关记录
{ "status": 1, "createTime": -1 }  // 状态筛选
{ "isDeleted": 1, "createTime": -1 }  // 软删除筛选

// 业务特定索引
{ "severity": 1, "status": 1 }  // 健康预警
{ "costType": 1, "createTime": -1 }  // 成本分类
{ "role": 1, "status": 1 }  // 用户角色
{ "code": 1, "status": 1 }  // 邀请码查询
```

## 数据完整性约束

### 必填字段
- 所有记录必须有：`_openid`, `createTime`, `isDeleted`
- 业务记录必须有：对应的业务字段和状态字段
- 关联记录必须有：对应的关联ID字段

### 数据验证规则
- 数量字段必须为正数
- 金额字段必须为非负数
- 状态字段必须在预定义枚举值内
- 时间字段必须为有效的ISO 8601格式
- 关联ID必须引用存在的记录

### 业务规则
- 出栏数量不能超过当前存栏
- 治疗记录必须关联有效的健康记录
- 权限操作必须验证用户角色
- 财务记录创建需要相应权限

## 数据生命周期管理

### 软删除策略
- 所有业务数据采用软删除（`isDeleted: true`）
- 保留删除时间和删除人信息
- 定期清理超过保留期的软删除数据

### 数据归档
- 超过1年的历史数据可归档到冷存储
- 保留最近3个月的热数据供快速查询
- 重要审计数据永久保留

### 数据备份
- 每日增量备份关键业务数据
- 每周全量备份所有数据
- 备份数据存储在云存储中，保留3个月

这个完整的数据库设计为整个鹅场管理系统提供了坚实的数据基础，支持所有业务模块的数据需求和未来扩展。
