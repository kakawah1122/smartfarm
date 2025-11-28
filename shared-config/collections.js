// 统一的数据库集合名称配置
// 所有云函数必须引用此文件，禁止硬编码集合名称
// 基于标准化命名规范：模块前缀_功能描述
// 共32个标准化集合，涵盖9大业务模块

const COLLECTIONS = {
  // ========== 标准化集合定义（32个） ==========
  
  // 用户管理模块 (User Management)
  WX_USERS: 'wx_users',
  WX_USER_INVITES: 'wx_user_invites',
  USER_NOTIFICATIONS: 'user_notifications',
  USER_ROLES: 'user_roles',  // 用户角色定义

  // 生产管理模块 (Production Management)
  PROD_BATCH_ENTRIES: 'prod_batch_entries',
  PROD_BATCH_EXITS: 'prod_batch_exits',
  PROD_MATERIALS: 'prod_materials',
  PROD_MATERIAL_RECORDS: 'prod_material_records',
  PROD_INVENTORY_LOGS: 'prod_inventory_logs',
  PROD_FEED_USAGE_RECORDS: 'feed_usage_records',  // 投喂记录（统一使用 PROD_ 前缀）

  // 健康管理模块 (Health Management)
  HEALTH_RECORDS: 'health_records',
  HEALTH_PREVENTION_RECORDS: 'health_prevention_records',
  HEALTH_TREATMENT_RECORDS: 'health_treatment_records',
  HEALTH_AI_DIAGNOSIS: 'health_ai_diagnosis',
  HEALTH_DEATH_RECORDS: 'health_death_records',

  // 财务管理模块 (Finance Management)
  FINANCE_COST_RECORDS: 'finance_cost_records',
  FINANCE_REVENUE_RECORDS: 'finance_revenue_records',
  FINANCE_REPORTS: 'finance_reports',
  FINANCE_SUMMARIES: 'finance_summaries',
  FINANCE_ANALYSIS_HISTORY: 'finance_analysis_history',

  // 任务管理模块 (Task Management)
  TASK_BATCH_SCHEDULES: 'task_batch_schedules',
  TASK_COMPLETIONS: 'task_completions',
  TASK_TEMPLATES: 'task_templates',

  // 系统管理模块 (System Management)
  SYS_AUDIT_LOGS: 'sys_audit_logs',
  SYS_AI_CACHE: 'sys_ai_cache',
  SYS_AI_USAGE: 'sys_ai_usage',
  SYS_APPROVAL_LOGS: 'sys_approval_logs',
  SYS_OVERVIEW_STATS: 'sys_overview_stats',
  SYS_STORAGE_STATISTICS: 'sys_storage_statistics',
  
  // 知识库模块 (Knowledge Management)
  KNOWLEDGE_ARTICLES: 'knowledge_articles',

  // AI模块 (AI Management)
  AI_LEARNING_CASES: 'ai_learning_cases',  // AI学习案例

  // 文件管理模块 (File Management)
  FILE_DYNAMIC_RECORDS: 'file_dynamic_records',

  // 价格管理模块 (Price Management)
  GOOSE_PRICES: 'goose_prices'  // 鹅价格记录
}

// 按模块分组的集合配置
const COLLECTION_MODULES = {
  USER_MANAGEMENT: [
    COLLECTIONS.WX_USERS,
    COLLECTIONS.WX_USER_INVITES,
    COLLECTIONS.USER_NOTIFICATIONS,
    COLLECTIONS.USER_ROLES
  ],
  
  PRODUCTION_MANAGEMENT: [
    COLLECTIONS.PROD_BATCH_ENTRIES,
    COLLECTIONS.PROD_BATCH_EXITS,
    COLLECTIONS.PROD_MATERIALS,
    COLLECTIONS.PROD_MATERIAL_RECORDS,
    COLLECTIONS.PROD_INVENTORY_LOGS,
    COLLECTIONS.PROD_FEED_USAGE_RECORDS  // 投喂记录
  ],
  
  HEALTH_MANAGEMENT: [
    COLLECTIONS.HEALTH_RECORDS,
    COLLECTIONS.HEALTH_PREVENTION_RECORDS,
    COLLECTIONS.HEALTH_TREATMENT_RECORDS,
    COLLECTIONS.HEALTH_AI_DIAGNOSIS,
    COLLECTIONS.HEALTH_DEATH_RECORDS
  ],
  
  FINANCE_MANAGEMENT: [
    COLLECTIONS.FINANCE_COST_RECORDS,
    COLLECTIONS.FINANCE_REVENUE_RECORDS,
    COLLECTIONS.FINANCE_REPORTS,
    COLLECTIONS.FINANCE_SUMMARIES,
    COLLECTIONS.FINANCE_ANALYSIS_HISTORY
  ],
  
  TASK_MANAGEMENT: [
    COLLECTIONS.TASK_BATCH_SCHEDULES,
    COLLECTIONS.TASK_COMPLETIONS,
    COLLECTIONS.TASK_TEMPLATES
  ],
  
  SYSTEM_MANAGEMENT: [
    COLLECTIONS.SYS_AUDIT_LOGS,
    COLLECTIONS.SYS_AI_CACHE,
    COLLECTIONS.SYS_AI_USAGE,
    COLLECTIONS.SYS_APPROVAL_LOGS,
    COLLECTIONS.SYS_OVERVIEW_STATS,
    COLLECTIONS.SYS_STORAGE_STATISTICS
  ],
  
  KNOWLEDGE_MANAGEMENT: [
    COLLECTIONS.KNOWLEDGE_ARTICLES
  ],
  
  AI_MANAGEMENT: [
    COLLECTIONS.AI_LEARNING_CASES
  ],
  
  FILE_MANAGEMENT: [
    COLLECTIONS.FILE_DYNAMIC_RECORDS
  ],
  
  PRICE_MANAGEMENT: [
    COLLECTIONS.GOOSE_PRICES
  ]
}

// 使用指南
const USAGE_GUIDE = `
使用说明：
1. 在云函数中引用：const { COLLECTIONS } = require('../../shared-config/collections.js')
2. 使用集合：db.collection(COLLECTIONS.WX_USERS)
3. 禁止硬编码集合名称：db.collection('wx_users') // ❌ 错误
4. 正确使用配置文件：db.collection(COLLECTIONS.WX_USERS) // ✅ 正确

命名规范：
- 用户模块：wx_ 或 user_ 前缀
- 生产模块：prod_ 前缀
- 健康模块：health_ 前缀
- 财务模块：finance_ 前缀
- 任务模块：task_ 前缀
- 系统模块：sys_ 前缀
- 知识库模块：knowledge_ 前缀
- AI模块：ai_ 前缀
- 文件模块：file_ 前缀
- 价格模块：goose_ 前缀（注：历史命名）
`

module.exports = {
  COLLECTIONS,
  COLLECTION_MODULES,
  USAGE_GUIDE
}

