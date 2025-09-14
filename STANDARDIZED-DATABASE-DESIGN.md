# 🏗️ 规范化数据库设计方案

基于微信小程序云开发最佳实践，重新设计统一规范的数据库架构。

## 📋 **微信云开发命名规范**

### **集合命名规范**
- 使用 `snake_case` 小写下划线格式
- 使用复数名词（如 `users`，`records`）
- 按功能模块分组前缀
- 避免缩写，使用完整单词

### **字段命名规范**
- 使用 `camelCase` 驼峰格式
- 时间字段统一使用 `createdAt`、`updatedAt`
- 外键关联使用 `xxxId` 格式
- 布尔值使用 `is` 或 `has` 前缀

## 🏛️ **模块化数据库架构**

### **1. 用户管理模块 (User Management)**

#### **`wx_users`** - 用户基础信息
```json
{
  "_id": "user_20240913001",
  "_openid": "wx_openid_123456",
  "userInfo": {
    "nickName": "用户昵称",
    "avatarUrl": "头像地址",
    "gender": 1,
    "city": "城市",
    "province": "省份",
    "country": "国家"
  },
  "profile": {
    "realName": "真实姓名",
    "phone": "13800138000",
    "email": "user@example.com",
    "department": "部门名称",
    "position": "职位"
  },
  "role": "employee", // super_admin|manager|employee|observer
  "status": "active", // active|inactive|suspended
  "permissions": ["read_production", "write_health"],
  "lastLoginAt": "2024-09-13T08:00:00.000Z",
  "createdAt": "2024-09-13T08:00:00.000Z",
  "updatedAt": "2024-09-13T08:00:00.000Z",
  "isDeleted": false
}
```

#### **`wx_user_invites`** - 用户邀请记录
```json
{
  "_id": "invite_20240913001",
  "inviteCode": "INV20240913001",
  "inviterOpenId": "wx_openid_123456",
  "inviteePhone": "13800138000",
  "role": "employee",
  "permissions": [],
  "status": "pending", // pending|used|expired|revoked
  "expiresAt": "2024-09-20T08:00:00.000Z",
  "usedAt": null,
  "usedBy": null,
  "createdAt": "2024-09-13T08:00:00.000Z",
  "isDeleted": false
}
```

#### **`wx_user_sessions`** - 用户会话记录
```json
{
  "_id": "session_20240913001",
  "_openid": "wx_openid_123456",
  "sessionKey": "session_key_123",
  "loginTime": "2024-09-13T08:00:00.000Z",
  "logoutTime": null,
  "deviceInfo": {
    "platform": "devtools",
    "version": "8.0.5",
    "brand": "devtools",
    "model": "iPhone6"
  },
  "ipAddress": "192.168.1.100",
  "isActive": true,
  "createdAt": "2024-09-13T08:00:00.000Z"
}
```

### **2. 生产管理模块 (Production Management)**

#### **`prod_batch_entries`** - 入栏记录
```json
{
  "_id": "entry_20240913001",
  "batchId": "BATCH20240913001",
  "batchNumber": "BN20240913001",
  "species": "goose", // goose|duck|chicken
  "breed": "品种名称",
  "quantity": 1000,
  "averageWeight": 0.5,
  "totalWeight": 500.0,
  "sourceInfo": {
    "supplier": "供应商名称",
    "contact": "联系方式",
    "address": "供应地址",
    "certificate": "检疫证明号"
  },
  "entryDate": "2024-09-13",
  "location": "A区1号棚",
  "healthStatus": "healthy",
  "notes": "入栏备注",
  "createdBy": "wx_openid_123456",
  "createdAt": "2024-09-13T08:00:00.000Z",
  "updatedAt": "2024-09-13T08:00:00.000Z",
  "isDeleted": false
}
```

#### **`prod_batch_exits`** - 出栏记录
```json
{
  "_id": "exit_20240913001",
  "batchId": "BATCH20240913001",
  "exitType": "sale", // sale|transfer|elimination
  "quantity": 950,
  "averageWeight": 2.5,
  "totalWeight": 2375.0,
  "destinationInfo": {
    "buyer": "买方名称",
    "contact": "联系方式",
    "address": "目的地址"
  },
  "exitDate": "2024-11-13",
  "unitPrice": 25.0,
  "totalAmount": 59375.0,
  "notes": "出栏备注",
  "createdBy": "wx_openid_123456",
  "createdAt": "2024-11-13T08:00:00.000Z",
  "isDeleted": false
}
```

#### **`prod_materials`** - 物料信息
```json
{
  "_id": "material_20240913001",
  "materialCode": "FEED20240913001",
  "name": "育雏饲料",
  "category": "feed", // feed|medicine|equipment|disinfectant
  "subCategory": "starter_feed",
  "unit": "kg",
  "specification": "25kg/袋",
  "supplier": "饲料供应商",
  "currentStock": 5000.0,
  "minStock": 1000.0,
  "maxStock": 10000.0,
  "unitCost": 3.5,
  "storageLocation": "仓库A区",
  "expiryDays": 180,
  "isActive": true,
  "createdAt": "2024-09-13T08:00:00.000Z",
  "updatedAt": "2024-09-13T08:00:00.000Z",
  "isDeleted": false
}
```

#### **`prod_material_records`** - 物料使用记录
```json
{
  "_id": "usage_20240913001",
  "materialId": "material_20240913001",
  "batchId": "BATCH20240913001",
  "operationType": "use", // use|purchase|return|waste
  "quantity": 100.0,
  "unitCost": 3.5,
  "totalCost": 350.0,
  "operationDate": "2024-09-13",
  "operator": "wx_openid_123456",
  "notes": "日常饲喂",
  "createdAt": "2024-09-13T08:00:00.000Z",
  "isDeleted": false
}
```

### **3. 健康管理模块 (Health Management)**

#### **`health_records`** - 健康记录
```json
{
  "_id": "health_20240913001",
  "batchId": "BATCH20240913001",
  "recordType": "routine_check", // routine_check|disease_report|treatment|death
  "checkDate": "2024-09-13",
  "inspector": "wx_openid_123456",
  "totalCount": 1000,
  "healthyCount": 980,
  "sickCount": 15,
  "deadCount": 5,
  "symptoms": ["咳嗽", "精神不振"],
  "diagnosis": "疑似呼吸道感染",
  "treatment": "隔离观察，抗生素治疗",
  "notes": "需要密切观察",
  "followUpRequired": true,
  "followUpDate": "2024-09-14",
  "severity": "medium", // low|medium|high|critical
  "createdAt": "2024-09-13T08:00:00.000Z",
  "isDeleted": false
}
```

#### **`health_prevention_records`** - 预防记录
```json
{
  "_id": "prevention_20240913001",
  "batchId": "BATCH20240913001",
  "preventionType": "vaccine", // vaccine|disinfection|nutrition|inspection
  "preventionDate": "2024-09-13",
  "vaccineInfo": {
    "name": "新城疫疫苗",
    "manufacturer": "疫苗厂商",
    "batchNumber": "V20240913001",
    "dosage": "0.5ml/只",
    "route": "肌肉注射",
    "count": 1000
  },
  "veterinarianInfo": {
    "name": "张兽医",
    "contact": "13800138000",
    "license": "VET123456"
  },
  "costInfo": {
    "vaccineCost": 1200.0,
    "laborCost": 200.0,
    "otherCost": 100.0,
    "totalCost": 1500.0
  },
  "effectiveness": "excellent", // poor|fair|good|excellent
  "sideEffects": "无明显副作用",
  "nextScheduled": "2024-12-13",
  "notes": "接种顺利完成",
  "operator": "wx_openid_123456",
  "createdAt": "2024-09-13T08:00:00.000Z",
  "isDeleted": false
}
```

#### **`health_treatment_records`** - 治疗记录
```json
{
  "_id": "treatment_20240913001",
  "batchId": "BATCH20240913001",
  "healthRecordId": "health_20240913001",
  "treatmentType": "medication", // medication|surgery|isolation|supportive
  "treatmentDate": "2024-09-13",
  "diagnosis": "细菌性肠炎",
  "medications": [
    {
      "name": "阿莫西林",
      "dosage": "10mg/kg",
      "frequency": "2次/天",
      "duration": "5天"
    }
  ],
  "treatmentPlan": "抗生素治疗配合隔离",
  "veterinarian": "张兽医",
  "affectedCount": 15,
  "treatmentCost": 300.0,
  "outcome": "recovered", // recovered|improved|unchanged|deteriorated|died
  "notes": "治疗效果良好",
  "createdAt": "2024-09-13T08:00:00.000Z",
  "isDeleted": false
}
```

#### **`health_ai_diagnosis`** - AI诊断记录
```json
{
  "_id": "ai_diag_20240913001",
  "batchId": "BATCH20240913001",
  "healthRecordId": "health_20240913001",
  "symptoms": ["咳嗽", "精神不振", "食欲下降"],
  "images": ["cloud://image1.jpg", "cloud://image2.jpg"],
  "aiModel": "poultry_health_v2.1",
  "diagnosis": {
    "primaryDiagnosis": "呼吸道感染",
    "confidence": 0.85,
    "differentialDiagnosis": ["病毒性感冒", "细菌感染"],
    "recommendedTreatment": ["隔离", "抗生素治疗"],
    "severity": "medium"
  },
  "humanVerification": {
    "isVerified": true,
    "verifiedBy": "wx_openid_123456",
    "verificationNote": "AI诊断准确",
    "finalDiagnosis": "细菌性呼吸道感染"
  },
  "createdAt": "2024-09-13T08:00:00.000Z"
}
```

### **4. 财务管理模块 (Finance Management)**

#### **`finance_cost_records`** - 成本记录
```json
{
  "_id": "cost_20240913001",
  "costType": "medical", // feed|medical|labor|facility|utilities|other
  "subCategory": "vaccine",
  "title": "新城疫疫苗接种费用",
  "description": "批次BATCH20240913001疫苗接种",
  "amount": 1500.0,
  "currency": "CNY",
  "batchId": "BATCH20240913001",
  "relatedRecords": [
    {
      "type": "prevention",
      "recordId": "prevention_20240913001"
    }
  ],
  "costBreakdown": {
    "vaccine": 1200.0,
    "labor": 200.0,
    "other": 100.0
  },
  "paymentInfo": {
    "method": "bank_transfer",
    "status": "paid",
    "paidAt": "2024-09-13T10:00:00.000Z",
    "reference": "TXN20240913001"
  },
  "costDate": "2024-09-13",
  "createdBy": "wx_openid_123456",
  "createdAt": "2024-09-13T08:00:00.000Z",
  "isDeleted": false
}
```

#### **`finance_revenue_records`** - 收入记录
```json
{
  "_id": "revenue_20240913001",
  "revenueType": "sales", // sales|subsidy|investment|other
  "title": "批次出栏销售收入",
  "description": "BATCH20240913001出栏销售",
  "amount": 59375.0,
  "currency": "CNY",
  "batchId": "BATCH20240913001",
  "relatedRecords": [
    {
      "type": "exit",
      "recordId": "exit_20240913001"
    }
  ],
  "paymentInfo": {
    "method": "bank_transfer",
    "status": "received",
    "receivedAt": "2024-11-15T10:00:00.000Z",
    "reference": "REC20241115001"
  },
  "revenueDate": "2024-11-13",
  "createdBy": "wx_openid_123456",
  "createdAt": "2024-11-13T08:00:00.000Z",
  "isDeleted": false
}
```

#### **`finance_summaries`** - 财务汇总
```json
{
  "_id": "summary_202409",
  "period": "2024-09",
  "periodType": "month", // day|week|month|quarter|year
  "totalRevenue": 50000.0,
  "totalCost": 35000.0,
  "netProfit": 15000.0,
  "profitMargin": 30.0,
  "costBreakdown": {
    "feed": 20000.0,
    "medical": 5000.0,
    "labor": 8000.0,
    "facility": 2000.0
  },
  "revenueBreakdown": {
    "sales": 48000.0,
    "subsidy": 2000.0
  },
  "batchCount": 5,
  "generatedAt": "2024-10-01T00:00:00.000Z",
  "generatedBy": "system",
  "isLocked": false
}
```

#### **`finance_reports`** - 财务报表
```json
{
  "_id": "report_20240913001",
  "reportType": "profit_loss", // profit_loss|cash_flow|balance_sheet|cost_analysis
  "reportPeriod": {
    "start": "2024-09-01",
    "end": "2024-09-30"
  },
  "title": "2024年9月损益表",
  "data": {
    "revenue": 50000.0,
    "costs": 35000.0,
    "profit": 15000.0,
    "charts": {
      "costTrend": [],
      "profitTrend": [],
      "categoryBreakdown": []
    }
  },
  "format": "detailed", // summary|detailed|executive
  "status": "finalized", // draft|review|finalized
  "generatedBy": "wx_openid_123456",
  "reviewedBy": null,
  "createdAt": "2024-10-01T08:00:00.000Z"
}
```

### **5. 任务管理模块 (Task Management)**

#### **`task_templates`** - 任务模板
```json
{
  "_id": "template_vaccine_basic",
  "name": "基础疫苗接种",
  "category": "health", // health|production|maintenance|inspection
  "type": "vaccine",
  "description": "常规疫苗接种任务",
  "defaultDayAges": [7, 21, 35],
  "estimatedDuration": 120, // 分钟
  "requiredSkills": ["疫苗接种", "畜禽处理"],
  "materials": ["疫苗", "注射器", "消毒剂"],
  "instructions": "按照疫苗说明书进行接种",
  "isActive": true,
  "createdAt": "2024-09-13T08:00:00.000Z"
}
```

#### **`task_batch_schedules`** - 批次任务计划
```json
{
  "_id": "schedule_20240913001",
  "batchId": "BATCH20240913001",
  "templateId": "template_vaccine_basic",
  "taskName": "7日龄新城疫疫苗接种",
  "scheduledDate": "2024-09-20",
  "dayAge": 7,
  "priority": "high", // low|medium|high|urgent
  "status": "pending", // pending|in_progress|completed|cancelled|overdue
  "assignedTo": "wx_openid_123456",
  "estimatedDuration": 120,
  "actualDuration": null,
  "notes": "首次疫苗接种，注意观察反应",
  "createdAt": "2024-09-13T08:00:00.000Z",
  "updatedAt": "2024-09-13T08:00:00.000Z"
}
```

#### **`task_completions`** - 任务完成记录
```json
{
  "_id": "completion_20240913001",
  "scheduleId": "schedule_20240913001",
  "batchId": "BATCH20240913001",
  "taskType": "vaccine",
  "completedBy": "wx_openid_123456",
  "completedAt": "2024-09-20T10:30:00.000Z",
  "actualDuration": 105,
  "quality": "excellent", // poor|fair|good|excellent
  "notes": "任务完成顺利，无异常情况",
  "attachments": ["cloud://completion_photo.jpg"],
  "relatedRecords": [
    {
      "type": "prevention",
      "recordId": "prevention_20240913001"
    }
  ],
  "createdAt": "2024-09-20T10:30:00.000Z"
}
```

### **6. 系统管理模块 (System Management)**

#### **`sys_overview_stats`** - 概览统计
```json
{
  "_id": "overview_202409",
  "period": "2024-09",
  "periodType": "month",
  "batchStats": {
    "totalBatches": 5,
    "activeBatches": 3,
    "totalAnimals": 5000,
    "mortalityRate": 2.5
  },
  "healthStats": {
    "healthyRate": 95.5,
    "treatmentCount": 12,
    "preventionCount": 15,
    "alertCount": 3
  },
  "productionStats": {
    "entryCount": 2,
    "exitCount": 1,
    "feedConsumption": 50000.0,
    "avgWeight": 2.3
  },
  "financeStats": {
    "totalRevenue": 50000.0,
    "totalCost": 35000.0,
    "netProfit": 15000.0,
    "profitMargin": 30.0
  },
  "taskStats": {
    "totalTasks": 48,
    "completedTasks": 45,
    "pendingTasks": 2,
    "overdueTasks": 1
  },
  "lastUpdated": "2024-09-30T23:59:59.000Z",
  "isLocked": false
}
```

#### **`sys_audit_logs`** - 系统审计日志
```json
{
  "_id": "audit_20240913001",
  "userId": "wx_openid_123456",
  "action": "create_prevention_record",
  "resource": "health_prevention_records",
  "resourceId": "prevention_20240913001",
  "details": {
    "batchId": "BATCH20240913001",
    "preventionType": "vaccine",
    "amount": 1500.0
  },
  "ipAddress": "192.168.1.100",
  "userAgent": "MicroMessenger/8.0.5",
  "result": "success", // success|failure|partial
  "timestamp": "2024-09-13T08:00:00.000Z"
}
```

#### **`sys_configurations`** - 系统配置
```json
{
  "_id": "config_system",
  "category": "system",
  "settings": {
    "timezone": "Asia/Shanghai",
    "currency": "CNY",
    "language": "zh-CN",
    "dateFormat": "YYYY-MM-DD",
    "autoBackup": true,
    "backupFrequency": "daily"
  },
  "features": {
    "aiDiagnosis": true,
    "wechatNotification": true,
    "autoReporting": true,
    "multiEnvironment": true
  },
  "limits": {
    "maxBatchSize": 10000,
    "maxFileSize": "10MB",
    "sessionTimeout": 3600
  },
  "updatedBy": "wx_openid_123456",
  "updatedAt": "2024-09-13T08:00:00.000Z"
}
```

## 🔐 **权限配置标准**

### **权限分级**
```javascript
// 1. 超级管理员 (super_admin)
"permissions": ["*"] // 所有权限

// 2. 管理员 (manager)  
"permissions": [
  "read_all", "write_production", "write_health", 
  "write_finance", "manage_users", "generate_reports"
]

// 3. 员工 (employee)
"permissions": [
  "read_production", "write_health", "read_finance_basic",
  "complete_tasks", "create_records"
]

// 4. 观察员 (observer)
"permissions": ["read_production", "read_health", "read_tasks"]
```

### **集合权限设置**
```javascript
// 用户隐私数据 - 仅创建者可读写
const userPrivateCollections = [
  'wx_users', 'wx_user_sessions'
]

// 业务核心数据 - 仅创建者可读写  
const businessCoreCollections = [
  'health_records', 'health_prevention_records', 'health_treatment_records',
  'finance_cost_records', 'finance_revenue_records', 'task_completions'
]

// 基础信息数据 - 所有用户可读，管理员可写
const businessBaseCollections = [
  'prod_materials', 'task_templates', 'sys_configurations'
]

// 汇总统计数据 - 所有用户可读
const summaryCollections = [
  'finance_summaries', 'finance_reports', 'sys_overview_stats'
]
```

## 📊 **索引优化配置**

### **高频查询索引**
```javascript
// 按批次查询（最常用）
{
  "batchId": 1,
  "createdAt": -1
}

// 按用户查询
{
  "_openid": 1,
  "createdAt": -1
}

// 按时间范围查询
{
  "createdAt": -1,
  "isDeleted": 1
}

// 按状态查询
{
  "status": 1,
  "priority": 1,
  "scheduledDate": 1
}

// 财务查询
{
  "costType": 1,
  "costDate": -1,
  "amount": -1
}
```

## 🔄 **数据流向规范**

### **标准数据流**
```
前端操作 → 云函数处理 → 原始数据表 → 定期汇总 → 报表生成 → 前端展示
```

### **具体示例：疫苗接种流程**
```
breeding-todo页面 → breeding-todo云函数 → health_prevention_records
                                    ↓
                    finance-management云函数 → finance_cost_records
                                    ↓
                    定期汇总任务 → finance_summaries → sys_overview_stats
```

## 🚀 **实施建议**

### **第一阶段：核心重构**
1. 重命名现有集合为标准格式
2. 统一字段命名规范
3. 配置标准权限

### **第二阶段：功能增强**
1. 添加缺失的系统管理集合
2. 完善数据关联关系
3. 优化索引配置

### **第三阶段：性能优化**
1. 实施数据分片策略
2. 配置自动汇总任务
3. 设置数据归档规则

---

**这套标准化架构将确保您的系统具有更好的可维护性、扩展性和性能！** 🎯
