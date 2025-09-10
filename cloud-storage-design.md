# 云存储文件夹结构和权限设计

## 概述
本文档详细设计了鹅场管理系统的云存储文件夹结构、访问权限和管理策略，确保文件的有序存储和安全访问。

## 存储架构设计

### 总体结构
```
云存储根目录/
├── production/          # 生产管理相关文件
│   ├── entry/          # 入栏记录附件
│   ├── exit/           # 出栏记录附件
│   ├── batches/        # 批次管理文件
│   └── materials/      # 物料记录附件
├── health/             # 健康管理相关文件
│   ├── records/        # 健康记录附件
│   ├── diagnosis/      # 诊断相关文件
│   ├── treatment/      # 治疗记录附件
│   ├── prevention/     # 预防记录附件
│   └── reports/        # 健康报告文件
├── finance/            # 财务管理相关文件
│   ├── invoices/       # 发票和票据
│   ├── receipts/       # 收款凭证
│   ├── reports/        # 财务报表
│   └── contracts/      # 合同文件
├── user/              # 用户相关文件
│   ├── avatars/        # 用户头像
│   ├── profiles/       # 用户资料文件
│   └── certifications/ # 资质证书
├── system/            # 系统文件
│   ├── backups/        # 数据备份文件
│   ├── exports/        # 导出文件
│   ├── logs/           # 日志文件
│   └── configs/        # 配置文件
├── temp/              # 临时文件
│   ├── uploads/        # 上传临时文件
│   ├── processing/     # 处理中的文件
│   └── cache/          # 缓存文件
└── public/            # 公共文件
    ├── templates/      # 模板文件
    ├── guides/         # 操作指南
    └── resources/      # 公共资源
```

## 详细文件夹设计

### 1. 生产管理文件夹 (`/production/`)

#### `/production/entry/` - 入栏记录附件
```
/production/entry/
├── {year}/
│   ├── {month}/
│   │   ├── {batch_number}/
│   │   │   ├── photos/
│   │   │   │   ├── {record_id}_1.jpg
│   │   │   │   ├── {record_id}_2.jpg
│   │   │   │   └── ...
│   │   │   ├── documents/
│   │   │   │   ├── {record_id}_certificate.pdf
│   │   │   │   ├── {record_id}_inspection.pdf
│   │   │   │   └── ...
│   │   │   └── videos/
│   │   │       ├── {record_id}_site.mp4
│   │   │       └── ...
```

**文件命名规范**：
- 格式：`{record_id}_{sequence}_{type}.{extension}`
- 示例：`ENT20240101001_1_photo.jpg`
- 类型：photo, document, video, audio

#### `/production/exit/` - 出栏记录附件
```
/production/exit/
├── {year}/
│   ├── {month}/
│   │   ├── {batch_number}/
│   │   │   ├── quality_check/
│   │   │   │   ├── {record_id}_quality.pdf
│   │   │   │   └── {record_id}_photos.jpg
│   │   │   ├── transport/
│   │   │   │   ├── {record_id}_vehicle.jpg
│   │   │   │   └── {record_id}_loading.mp4
│   │   │   └── sales/
│   │   │       ├── {record_id}_contract.pdf
│   │   │       └── {record_id}_receipt.jpg
```

#### `/production/batches/` - 批次管理文件
```
/production/batches/
├── {batch_number}/
│   ├── planning/
│   │   ├── plan.pdf
│   │   ├── schedule.xlsx
│   │   └── budget.pdf
│   ├── monitoring/
│   │   ├── weekly_reports/
│   │   ├── photos/
│   │   └── videos/
│   ├── completion/
│   │   ├── summary.pdf
│   │   ├── analysis.xlsx
│   │   └── photos/
│   └── archived/
│       └── {date}_archive.zip
```

#### `/production/materials/` - 物料记录附件
```
/production/materials/
├── feed/
│   ├── {year}/{month}/
│   │   ├── {record_id}_invoice.pdf
│   │   ├── {record_id}_quality.pdf
│   │   └── {record_id}_photos.jpg
├── equipment/
│   ├── purchase/
│   ├── maintenance/
│   └── disposal/
└── supplies/
    ├── medical/
    ├── cleaning/
    └── tools/
```

### 2. 健康管理文件夹 (`/health/`)

#### `/health/records/` - 健康记录附件
```
/health/records/
├── {year}/
│   ├── {month}/
│   │   ├── {batch_number}/
│   │   │   ├── routine_check/
│   │   │   │   ├── {record_id}_photos.jpg
│   │   │   │   ├── {record_id}_video.mp4
│   │   │   │   └── {record_id}_report.pdf
│   │   │   ├── abnormal/
│   │   │   │   ├── {record_id}_symptoms.jpg
│   │   │   │   ├── {record_id}_test_results.pdf
│   │   │   │   └── {record_id}_lab_report.pdf
│   │   │   └── recovery/
│   │   │       ├── {record_id}_before.jpg
│   │   │       ├── {record_id}_after.jpg
│   │   │       └── {record_id}_progress.pdf
```

#### `/health/diagnosis/` - 诊断相关文件
```
/health/diagnosis/
├── ai_diagnosis/
│   ├── {year}/{month}/
│   │   ├── {diagnosis_id}/
│   │   │   ├── input_images/
│   │   │   │   ├── symptom_1.jpg
│   │   │   │   ├── symptom_2.jpg
│   │   │   │   └── environment.jpg
│   │   │   ├── ai_analysis/
│   │   │   │   ├── result.json
│   │   │   │   ├── confidence.pdf
│   │   │   │   └── recommendations.pdf
│   │   │   └── validation/
│   │   │       ├── vet_review.pdf
│   │   │       └── final_diagnosis.pdf
├── lab_diagnosis/
│   ├── blood_tests/
│   ├── pathology/
│   └── microbiology/
└── expert_consultation/
    ├── remote_consultation/
    ├── site_visit/
    └── second_opinion/
```

#### `/health/treatment/` - 治疗记录附件
```
/health/treatment/
├── {year}/
│   ├── {month}/
│   │   ├── {treatment_id}/
│   │   │   ├── prescription/
│   │   │   │   ├── medication_list.pdf
│   │   │   │   ├── dosage_schedule.pdf
│   │   │   │   └── safety_notes.pdf
│   │   │   ├── administration/
│   │   │   │   ├── day_1_photos.jpg
│   │   │   │   ├── day_3_photos.jpg
│   │   │   │   └── administration_log.pdf
│   │   │   ├── monitoring/
│   │   │   │   ├── progress_photos/
│   │   │   │   ├── side_effects.pdf
│   │   │   │   └── effectiveness.pdf
│   │   │   └── completion/
│   │   │       ├── final_assessment.pdf
│   │   │       ├── before_after.jpg
│   │   │       └── recommendations.pdf
```

#### `/health/prevention/` - 预防记录附件
```
/health/prevention/
├── vaccination/
│   ├── {year}/
│   │   ├── {vaccine_plan_id}/
│   │   │   ├── planning/
│   │   │   │   ├── schedule.pdf
│   │   │   │   ├── vaccine_info.pdf
│   │   │   │   └── target_animals.xlsx
│   │   │   ├── execution/
│   │   │   │   ├── process_photos.jpg
│   │   │   │   ├── completion_report.pdf
│   │   │   │   └── adverse_reactions.pdf
│   │   │   └── follow_up/
│   │   │       ├── effectiveness.pdf
│   │   │       └── next_schedule.pdf
├── disinfection/
│   ├── routine/
│   ├── emergency/
│   └── equipment/
├── inspection/
│   ├── daily/
│   ├── weekly/
│   └── monthly/
└── nutrition/
    ├── feed_plans/
    ├── supplements/
    └── monitoring/
```

#### `/health/reports/` - 健康报告文件
```
/health/reports/
├── daily/
│   ├── {year}/{month}/
│   │   ├── {date}_daily_report.pdf
│   │   └── {date}_summary.xlsx
├── weekly/
│   ├── {year}/{week}/
│   │   ├── health_summary.pdf
│   │   ├── trend_analysis.pdf
│   │   └── recommendations.pdf
├── monthly/
│   ├── {year}/{month}/
│   │   ├── comprehensive_report.pdf
│   │   ├── statistics.xlsx
│   │   └── charts.pdf
├── annual/
│   ├── {year}/
│   │   ├── annual_health_report.pdf
│   │   ├── performance_analysis.pdf
│   │   └── improvement_plan.pdf
└── emergency/
    ├── outbreak_reports/
    ├── mortality_analysis/
    └── crisis_response/
```

### 3. 财务管理文件夹 (`/finance/`)

#### `/finance/invoices/` - 发票和票据
```
/finance/invoices/
├── purchase/
│   ├── {year}/
│   │   ├── {month}/
│   │   │   ├── feed/
│   │   │   │   ├── {invoice_number}.pdf
│   │   │   │   └── {invoice_number}_details.xlsx
│   │   │   ├── equipment/
│   │   │   ├── services/
│   │   │   └── others/
├── sales/
│   ├── {year}/
│   │   ├── {month}/
│   │   │   ├── {customer}/
│   │   │   │   ├── {invoice_number}.pdf
│   │   │   │   ├── {invoice_number}_receipt.jpg
│   │   │   │   └── {invoice_number}_contract.pdf
└── taxes/
    ├── {year}/
    │   ├── monthly/
    │   ├── quarterly/
    │   └── annual/
```

#### `/finance/reports/` - 财务报表
```
/finance/reports/
├── monthly/
│   ├── {year}/{month}/
│   │   ├── profit_loss.pdf
│   │   ├── cash_flow.pdf
│   │   ├── budget_analysis.pdf
│   │   └── cost_breakdown.xlsx
├── quarterly/
│   ├── {year}/Q{quarter}/
│   │   ├── comprehensive_report.pdf
│   │   ├── performance_metrics.xlsx
│   │   └── variance_analysis.pdf
├── annual/
│   ├── {year}/
│   │   ├── annual_financial_report.pdf
│   │   ├── tax_report.pdf
│   │   └── audit_report.pdf
└── projections/
    ├── budget_forecasts/
    ├── cash_flow_projections/
    └── scenario_analysis/
```

### 4. 用户管理文件夹 (`/user/`)

#### `/user/avatars/` - 用户头像
```
/user/avatars/
├── {user_openid}/
│   ├── current.jpg
│   ├── {timestamp}_1.jpg
│   ├── {timestamp}_2.jpg
│   └── backup/
│       └── {date}_old.jpg
```

#### `/user/profiles/` - 用户资料文件
```
/user/profiles/
├── {user_openid}/
│   ├── personal/
│   │   ├── id_card.jpg
│   │   ├── contact_info.pdf
│   │   └── emergency_contact.pdf
│   ├── professional/
│   │   ├── resume.pdf
│   │   ├── certifications/
│   │   │   ├── {cert_name}.pdf
│   │   │   └── {cert_name}_verification.jpg
│   │   └── training/
│   │       ├── {training_name}.pdf
│   │       └── completion_certificate.pdf
│   └── employment/
│       ├── contract.pdf
│       ├── job_description.pdf
│       └── performance_reviews/
```

### 5. 系统管理文件夹 (`/system/`)

#### `/system/backups/` - 数据备份文件
```
/system/backups/
├── daily/
│   ├── {year}/{month}/
│   │   ├── {date}_database.zip
│   │   ├── {date}_files.zip
│   │   └── {date}_logs.zip
├── weekly/
│   ├── {year}/{week}/
│   │   ├── full_backup.zip
│   │   └── verification.log
├── monthly/
│   ├── {year}/{month}/
│   │   ├── complete_system.zip
│   │   └── backup_report.pdf
└── emergency/
    ├── pre_update/
    ├── pre_maintenance/
    └── incident_recovery/
```

#### `/system/exports/` - 导出文件
```
/system/exports/
├── data_exports/
│   ├── {year}/{month}/
│   │   ├── {export_id}_production.xlsx
│   │   ├── {export_id}_health.xlsx
│   │   ├── {export_id}_finance.xlsx
│   │   └── {export_id}_users.xlsx
├── reports/
│   ├── scheduled/
│   │   ├── daily/
│   │   ├── weekly/
│   │   └── monthly/
│   └── on_demand/
│       ├── {request_id}_custom.pdf
│       └── {request_id}_analysis.xlsx
└── compliance/
    ├── audit_exports/
    ├── regulatory_reports/
    └── certification_data/
```

## 文件权限设计

### 权限级别定义

#### 1. 公共读取 (Public Read)
- 路径：`/public/*`
- 权限：所有认证用户可读
- 用途：模板、指南、公共资源

#### 2. 角色访问 (Role-based Access)
- 路径：`/production/*`, `/health/*`
- 权限：基于用户角色的访问控制
- 规则：
  ```javascript
  // 读取权限
  "read": "auth.openid != null && (
    resource.path.startsWith('/public/') || 
    getUserRole(auth.openid) in ['super_admin', 'manager', 'technician', 'employee']
  )"
  
  // 写入权限
  "write": "auth.openid != null && (
    getUserRole(auth.openid) in ['super_admin', 'manager', 'technician', 'employee']
  )"
  ```

#### 3. 财务专用 (Finance Only)
- 路径：`/finance/*`
- 权限：财务角色专用访问
- 规则：
  ```javascript
  "read": "getUserRole(auth.openid) in ['super_admin', 'manager', 'finance', 'observer']",
  "write": "getUserRole(auth.openid) in ['super_admin', 'manager', 'finance']"
  ```

#### 4. 个人私有 (Personal Private)
- 路径：`/user/{openid}/*`
- 权限：用户只能访问自己的文件
- 规则：
  ```javascript
  "read": "auth.openid == extractOpenidFromPath(resource.path) || getUserRole(auth.openid) in ['super_admin', 'manager']",
  "write": "auth.openid == extractOpenidFromPath(resource.path) || getUserRole(auth.openid) in ['super_admin', 'manager']"
  ```

#### 5. 系统管理 (System Admin)
- 路径：`/system/*`
- 权限：管理员专用
- 规则：
  ```javascript
  "read": "getUserRole(auth.openid) in ['super_admin', 'manager']",
  "write": "getUserRole(auth.openid) == 'super_admin'"
  ```

#### 6. 临时文件 (Temporary)
- 路径：`/temp/*`
- 权限：创建者可访问，24小时后自动清理
- 规则：
  ```javascript
  "read": "auth.openid == resource.metadata.creator",
  "write": "auth.openid != null",
  "ttl": 86400  // 24小时
  ```

### 文件上传权限控制

#### 上传限制策略
```javascript
// 文件大小限制
const FILE_SIZE_LIMITS = {
  'image': 10 * 1024 * 1024,    // 10MB
  'video': 100 * 1024 * 1024,   // 100MB
  'document': 20 * 1024 * 1024, // 20MB
  'audio': 50 * 1024 * 1024     // 50MB
}

// 文件类型限制
const ALLOWED_FILE_TYPES = {
  'image': ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  'video': ['mp4', 'avi', 'mov', 'wmv'],
  'document': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'],
  'audio': ['mp3', 'wav', 'aac']
}

// 路径权限验证
function validateUploadPath(userRole, targetPath) {
  const pathPermissions = {
    '/production/': ['super_admin', 'manager', 'technician', 'employee'],
    '/health/': ['super_admin', 'manager', 'technician', 'employee'],
    '/finance/': ['super_admin', 'manager', 'finance'],
    '/user/': ['*'], // 需要额外验证是否为用户自己的目录
    '/system/': ['super_admin'],
    '/temp/': ['*']
  }
  
  for (const [path, roles] of Object.entries(pathPermissions)) {
    if (targetPath.startsWith(path)) {
      return roles.includes('*') || roles.includes(userRole)
    }
  }
  
  return false
}
```

## 文件管理策略

### 1. 文件生命周期管理

#### 临时文件清理
```javascript
// 自动清理策略
const CLEANUP_POLICIES = {
  '/temp/uploads/': {
    ttl: 24 * 60 * 60,        // 24小时
    action: 'delete'
  },
  '/temp/processing/': {
    ttl: 7 * 24 * 60 * 60,    // 7天
    action: 'delete'
  },
  '/temp/cache/': {
    ttl: 30 * 24 * 60 * 60,   // 30天
    action: 'delete'
  },
  '/system/logs/': {
    ttl: 90 * 24 * 60 * 60,   // 90天
    action: 'archive'
  }
}
```

#### 文件归档策略
```javascript
// 归档规则
const ARCHIVE_POLICIES = {
  '/production/': {
    condition: 'age > 365 days',
    action: 'move_to_cold_storage'
  },
  '/health/records/': {
    condition: 'age > 730 days',  // 2年
    action: 'compress_and_archive'
  },
  '/finance/': {
    condition: 'age > 2555 days', // 7年（财务数据保留期）
    action: 'permanent_archive'
  }
}
```

### 2. 文件安全策略

#### 访问日志记录
```javascript
// 文件访问日志
const logFileAccess = async (operation, filePath, userOpenid, result) => {
  await db.collection('file_access_logs').add({
    data: {
      operation,      // read, write, delete
      filePath,
      userOpenid,
      result,         // success, failed, denied
      timestamp: new Date().toISOString(),
      ipAddress: context.SOURCE,
      userAgent: context.USER_AGENT
    }
  })
}
```

#### 敏感文件加密
```javascript
// 敏感文件加密存储
const ENCRYPTION_REQUIRED = [
  '/finance/contracts/',
  '/user/profiles/personal/',
  '/system/configs/',
  '/user/certifications/'
]

function requiresEncryption(filePath) {
  return ENCRYPTION_REQUIRED.some(path => filePath.startsWith(path))
}
```

### 3. 文件同步和备份

#### 备份策略
```javascript
// 备份配置
const BACKUP_CONFIG = {
  critical_data: {
    paths: ['/production/', '/health/', '/finance/'],
    frequency: 'daily',
    retention: '90 days',
    encryption: true
  },
  user_data: {
    paths: ['/user/'],
    frequency: 'weekly',
    retention: '30 days',
    encryption: true
  },
  system_data: {
    paths: ['/system/'],
    frequency: 'daily',
    retention: '365 days',
    encryption: true
  },
  temp_data: {
    paths: ['/temp/'],
    frequency: 'never',
    retention: '0 days',
    encryption: false
  }
}
```

## 部署配置指南

### 1. 云存储配置

#### 存储桶设置
```javascript
// 在微信云开发控制台配置
const STORAGE_CONFIG = {
  maxFileSize: '100MB',
  allowedFileTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/avi', 'video/mov',
    'application/pdf', 'application/msword', 'application/vnd.ms-excel',
    'text/plain', 'audio/mpeg', 'audio/wav'
  ],
  corsPolicy: {
    allowOrigins: ['*.qq.com', '*.weixin.qq.com'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Authorization', 'Content-Type']
  }
}
```

#### 权限规则配置
```javascript
// 在云开发控制台设置存储权限
{
  "read": "auth.openid != null && validateFileAccess(auth.openid, resource.path, 'read')",
  "write": "auth.openid != null && validateFileAccess(auth.openid, resource.path, 'write')"
}
```

### 2. 云函数支持

#### 文件管理云函数
```javascript
// cloudfunctions/file-management/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { action, filePath, targetPath, userRole } = event
  
  switch (action) {
    case 'upload':
      return await handleFileUpload(filePath, userRole)
    case 'move':
      return await moveFile(filePath, targetPath, userRole)
    case 'delete':
      return await deleteFile(filePath, userRole)
    case 'cleanup':
      return await cleanupExpiredFiles()
    case 'backup':
      return await backupCriticalFiles()
    default:
      throw new Error('无效的操作类型')
  }
}

async function handleFileUpload(filePath, userRole) {
  // 验证上传路径权限
  if (!validateUploadPath(userRole, filePath)) {
    throw new Error('无权限上传到此路径')
  }
  
  // 验证文件类型和大小
  // ... 实现文件验证逻辑
  
  // 记录上传日志
  await logFileAccess('upload', filePath, context.openid, 'success')
  
  return { success: true, message: '文件上传成功' }
}
```

### 3. 监控和维护

#### 存储使用监控
```javascript
// 存储使用情况监控
const monitorStorageUsage = async () => {
  const usage = await cloud.getStorageUsage()
  
  if (usage.used / usage.total > 0.8) {
    // 发送存储空间不足警告
    await sendAlert('STORAGE_WARNING', {
      used: usage.used,
      total: usage.total,
      percentage: (usage.used / usage.total * 100).toFixed(2)
    })
  }
  
  return usage
}
```

#### 定期清理任务
```javascript
// 定期清理过期文件
const scheduleCleanup = async () => {
  const now = new Date()
  
  for (const [path, policy] of Object.entries(CLEANUP_POLICIES)) {
    const expiredFiles = await findExpiredFiles(path, policy.ttl)
    
    for (const file of expiredFiles) {
      if (policy.action === 'delete') {
        await cloud.deleteFile({ fileList: [file.fileID] })
      } else if (policy.action === 'archive') {
        await archiveFile(file)
      }
    }
  }
}
```

## 部署检查清单

- [ ] 云存储权限规则已配置
- [ ] 文件上传限制已设置
- [ ] 文件管理云函数已部署
- [ ] 自动清理任务已配置
- [ ] 备份策略已实施
- [ ] 访问日志已启用
- [ ] 监控告警已配置
- [ ] 安全策略已验证

这个完整的云存储设计为鹅场管理系统提供了安全、有序、高效的文件存储和管理方案。
