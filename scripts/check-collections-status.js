/**
 * 检查数据库集合配置状态
 * 用于验证所有集合是否按规范创建和配置
 */

const { COLLECTIONS } = require('../shared-config/collections.js')

// 集合权限配置映射
const COLLECTION_PERMISSIONS = {
  // 规则1：仅创建者可读写
  CREATOR_ONLY: [
    'user_notification_settings',
    'task_batch_schedules', 
    'task_completions',
    'task_records',
    'health_prevention_records',
    'health_treatment_records',
    'health_ai_diagnosis',
    'health_cure_records',
    'health_death_records',
    'health_followup_records',
    'finance_analysis_history',
    'file_dynamic_records'
  ],
  
  // 规则2：所有用户可读，仅创建者可写
  PUBLIC_READ_CREATOR_WRITE: [
    'health_records',
    'production_batches',
    'finance_cost_records',
    'finance_revenue_records'
  ],
  
  // 规则3：所有用户可读，禁止写入
  PUBLIC_READ_ONLY: [
    'finance_reports',
    'finance_summaries',
    'sys_overview_stats',
    'sys_notifications',
    'health_vaccine_plans',
    'knowledge_articles',
    'prod_materials',
    'file_static_records'
  ],
  
  // 规则4：仅创建者可读，禁止写入
  CREATOR_READ_ONLY: [
    'wx_users',
    'user_notifications',
    'health_alerts',
    'prod_inventory_logs',
    'task_templates'
  ],
  
  // 规则5：userId字段权限
  USER_ID_BASED: [
    'prod_batch_entries',
    'prod_batch_exits',
    'prod_material_records'
  ],
  
  // 规则6：邀请关系权限
  INVITE_BASED: [
    'wx_user_invites'
  ],
  
  // 规则7：审批日志权限
  APPROVAL_BASED: [
    'sys_approval_logs'
  ],
  
  // 规则8：系统内部
  SYSTEM_ONLY: [
    'sys_audit_logs',
    'sys_ai_cache',
    'sys_ai_usage',
    'sys_cleanup_logs',
    'sys_configurations',
    'sys_permissions',
    'sys_roles',
    'sys_storage_statistics'
  ]
}

// 集合索引配置
const COLLECTION_INDEXES = {
  // 通用索引
  COMMON: ['_openid_createTime'],
  
  // 特定集合的额外索引
  SPECIFIC: {
    'wx_users': ['username', 'role_status'],
    'user_notifications': ['_openid_isRead_createTime'],
    'prod_batch_entries': ['batchCode', 'userId_createTime', 'status_createTime'],
    'health_records': ['animalId_recordDate', 'type_status_createTime'],
    'finance_cost_records': ['category_recordDate', 'batchId_category'],
    'task_templates': ['_openid_templateName', '_openid_isDeleted'],
    'task_batch_schedules': ['batchId_dayAge', 'batchId_status_dayAge']
  }
}

// 检查集合配置
function checkCollectionConfig() {
  const allCollections = Object.values(COLLECTIONS)
  const configuredCollections = []
  const unconfiguredCollections = []
  
  // 获取所有配置的集合
  for (const [rule, collections] of Object.entries(COLLECTION_PERMISSIONS)) {
    configuredCollections.push(...collections)
  }
  
  // 检查未配置的集合
  for (const collection of allCollections) {
    if (!configuredCollections.includes(collection)) {
      unconfiguredCollections.push(collection)
    }
  }
  
  return {
    total: allCollections.length,
    configured: configuredCollections.length,
    unconfigured: unconfiguredCollections
  }
}

// 生成集合配置报告
function generateReport() {
  console.log('========================================')
  console.log('数据库集合配置检查报告')
  console.log('========================================\n')
  
  const checkResult = checkCollectionConfig()
  
  console.log(`总集合数：${checkResult.total}`)
  console.log(`已配置数：${checkResult.configured}`)
  console.log(`未配置数：${checkResult.unconfigured.length}\n`)
  
  if (checkResult.unconfigured.length > 0) {
    console.log('⚠️  未配置的集合：')
    checkResult.unconfigured.forEach(c => console.log(`  - ${c}`))
    console.log('')
  }
  
  console.log('权限配置分组：')
  console.log('----------------------------------------')
  
  for (const [rule, collections] of Object.entries(COLLECTION_PERMISSIONS)) {
    console.log(`\n${formatRuleName(rule)} (${collections.length}个)：`)
    collections.forEach(c => console.log(`  ✓ ${c}`))
  }
  
  console.log('\n========================================')
  console.log('索引配置建议')
  console.log('========================================\n')
  
  console.log('通用索引（所有集合都应该有）：')
  COLLECTION_INDEXES.COMMON.forEach(idx => console.log(`  - ${idx}`))
  
  console.log('\n特定集合的额外索引：')
  for (const [collection, indexes] of Object.entries(COLLECTION_INDEXES.SPECIFIC)) {
    console.log(`\n${collection}:`)
    indexes.forEach(idx => console.log(`  - ${idx}`))
  }
  
  console.log('\n========================================')
  console.log('配置完成检查清单')
  console.log('========================================')
  console.log('□ 所有集合都已创建')
  console.log('□ 所有集合都已设置权限')
  console.log('□ 核心集合已创建索引')
  console.log('□ 生产模块使用userId字段')
  console.log('□ 系统集合设置为不可读写')
  console.log('□ 云函数使用COLLECTIONS配置')
}

// 格式化规则名称
function formatRuleName(rule) {
  const ruleNames = {
    CREATOR_ONLY: '规则1：仅创建者可读写',
    PUBLIC_READ_CREATOR_WRITE: '规则2：所有用户可读，仅创建者可写',
    PUBLIC_READ_ONLY: '规则3：所有用户可读，禁止写入',
    CREATOR_READ_ONLY: '规则4：仅创建者可读，禁止写入',
    USER_ID_BASED: '规则5：userId字段权限',
    INVITE_BASED: '规则6：邀请关系权限',
    APPROVAL_BASED: '规则7：审批日志权限',
    SYSTEM_ONLY: '规则8：系统内部'
  }
  return ruleNames[rule] || rule
}

// 导出为云函数可用
exports.checkCollections = checkCollectionConfig
exports.generateReport = generateReport

// 如果直接运行脚本
if (require.main === module) {
  generateReport()
}
