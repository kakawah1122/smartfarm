/**
 * 批量修复云函数中的硬编码集合名称
 * 将 db.collection('xxx') 替换为 db.collection(COLLECTIONS.XXX)
 */

const fs = require('fs');
const path = require('path');

// 集合名称映射表（从 shared-config/collections.js）
const COLLECTION_MAP = {
  // 用户管理模块
  'wx_users': 'COLLECTIONS.WX_USERS',
  'wx_user_invites': 'COLLECTIONS.WX_USER_INVITES',
  'user_notifications': 'COLLECTIONS.USER_NOTIFICATIONS',
  'user_notification_settings': 'COLLECTIONS.USER_NOTIFICATION_SETTINGS',
  
  // 生产管理模块
  'prod_batch_entries': 'COLLECTIONS.PROD_BATCH_ENTRIES',
  'prod_batch_exits': 'COLLECTIONS.PROD_BATCH_EXITS',
  'prod_materials': 'COLLECTIONS.PROD_MATERIALS',
  'prod_material_records': 'COLLECTIONS.PROD_MATERIAL_RECORDS',
  'prod_inventory_logs': 'COLLECTIONS.PROD_INVENTORY_LOGS',
  'production_batches': 'COLLECTIONS.PRODUCTION_BATCHES',
  
  // 健康管理模块
  'health_records': 'COLLECTIONS.HEALTH_RECORDS',
  'health_prevention_records': 'COLLECTIONS.HEALTH_PREVENTION_RECORDS',
  'health_treatment_records': 'COLLECTIONS.HEALTH_TREATMENT_RECORDS',
  'health_ai_diagnosis': 'COLLECTIONS.HEALTH_AI_DIAGNOSIS',
  'health_cure_records': 'COLLECTIONS.HEALTH_CURE_RECORDS',
  'health_death_records': 'COLLECTIONS.HEALTH_DEATH_RECORDS',
  'health_followup_records': 'COLLECTIONS.HEALTH_FOLLOWUP_RECORDS',
  'health_alerts': 'COLLECTIONS.HEALTH_ALERTS',
  'health_vaccine_plans': 'COLLECTIONS.HEALTH_VACCINE_PLANS',
  
  // 财务管理模块
  'finance_cost_records': 'COLLECTIONS.FINANCE_COST_RECORDS',
  'finance_revenue_records': 'COLLECTIONS.FINANCE_REVENUE_RECORDS',
  'finance_reports': 'COLLECTIONS.FINANCE_REPORTS',
  'finance_summaries': 'COLLECTIONS.FINANCE_SUMMARIES',
  'finance_analysis_history': 'COLLECTIONS.FINANCE_ANALYSIS_HISTORY',
  
  // 任务管理模块
  'task_batch_schedules': 'COLLECTIONS.TASK_BATCH_SCHEDULES',
  'task_completions': 'COLLECTIONS.TASK_COMPLETIONS',
  'task_records': 'COLLECTIONS.TASK_RECORDS',
  'task_templates': 'COLLECTIONS.TASK_TEMPLATES',
  
  // 系统管理模块
  'sys_audit_logs': 'COLLECTIONS.SYS_AUDIT_LOGS',
  'sys_ai_cache': 'COLLECTIONS.SYS_AI_CACHE',
  'sys_ai_usage': 'COLLECTIONS.SYS_AI_USAGE',
  'sys_approval_logs': 'COLLECTIONS.SYS_APPROVAL_LOGS',
  'sys_cleanup_logs': 'COLLECTIONS.SYS_CLEANUP_LOGS',
  'sys_configurations': 'COLLECTIONS.SYS_CONFIGURATIONS',
  'sys_overview_stats': 'COLLECTIONS.SYS_OVERVIEW_STATS',
  'sys_notifications': 'COLLECTIONS.SYS_NOTIFICATIONS',
  'sys_permissions': 'COLLECTIONS.SYS_PERMISSIONS',
  'sys_roles': 'COLLECTIONS.SYS_ROLES',
  'sys_storage_statistics': 'COLLECTIONS.SYS_STORAGE_STATISTICS',
  
  // 知识库模块
  'knowledge_articles': 'COLLECTIONS.KNOWLEDGE_ARTICLES',
  
  // 文件管理模块
  'file_dynamic_records': 'COLLECTIONS.FILE_DYNAMIC_RECORDS',
  'file_static_records': 'COLLECTIONS.FILE_STATIC_RECORDS'
};

// 需要修复的云函数列表（根据grep结果）
const TARGET_FUNCTIONS = [
  'production-exit',
  'notification-management',
  'production-dashboard',
  'production-management',
  'task-migration',
  'register',
  'role-migration',
  'user-management',
  'breeding-todo',
  'health-management'
];

// 统计信息
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  replacements: 0,
  errors: []
};

/**
 * 在文件中替换硬编码集合名
 */
function replaceInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let fileReplacements = 0;
    
    // 检查文件是否已经引入COLLECTIONS
    const hasCollectionsImport = content.includes('require(') && content.includes('collections');
    
    // 为每个集合名称执行替换
    for (const [oldName, newName] of Object.entries(COLLECTION_MAP)) {
      // 匹配 db.collection('xxx') 或 db.collection("xxx")
      const regex1 = new RegExp(`db\\.collection\\(['"]${oldName}['"]\\)`, 'g');
      const matches = content.match(regex1);
      
      if (matches && matches.length > 0) {
        content = content.replace(regex1, `db.collection(${newName})`);
        modified = true;
        fileReplacements += matches.length;
      }
    }
    
    // 如果有替换但没有引入COLLECTIONS，添加引入语句
    if (modified && !hasCollectionsImport) {
      // 查找最后一个require语句的位置
      const requireRegex = /const .+ = require\(.+\)/g;
      const matches = content.match(requireRegex);
      
      if (matches && matches.length > 0) {
        const lastRequire = matches[matches.length - 1];
        const lastRequireIndex = content.lastIndexOf(lastRequire);
        const insertPosition = lastRequireIndex + lastRequire.length;
        
        // 在最后一个require之后插入COLLECTIONS引入
        content = content.slice(0, insertPosition) + 
                 '\nconst { COLLECTIONS } = require(\'./collections.js\')' +
                 content.slice(insertPosition);
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.filesModified++;
      stats.replacements += fileReplacements;
      console.log(`✅ 修复: ${path.basename(filePath)} (${fileReplacements}处)`);
    }
    
    stats.filesProcessed++;
  } catch (error) {
    stats.errors.push({ file: filePath, error: error.message });
    console.error(`❌ 错误: ${path.basename(filePath)} - ${error.message}`);
  }
}

/**
 * 扫描并修复云函数目录
 */
function processCloudFunctions() {
  const cloudfunctionsDir = path.join(__dirname, '../cloudfunctions');
  
  console.log('开始修复云函数硬编码集合名称...\n');
  console.log(`目标目录: ${cloudfunctionsDir}\n`);
  
  // 遍历所有云函数目录
  const functionDirs = fs.readdirSync(cloudfunctionsDir);
  
  for (const funcDir of functionDirs) {
    const funcPath = path.join(cloudfunctionsDir, funcDir);
    
    // 跳过非目录文件
    if (!fs.statSync(funcPath).isDirectory()) {
      continue;
    }
    
    // 检查是否有collections.js（说明这个云函数使用collections配置）
    const collectionsPath = path.join(funcPath, 'collections.js');
    if (!fs.existsSync(collectionsPath)) {
      continue;
    }
    
    console.log(`\n📁 处理云函数: ${funcDir}`);
    
    // 处理index.js
    const indexPath = path.join(funcPath, 'index.js');
    if (fs.existsSync(indexPath)) {
      replaceInFile(indexPath);
    }
    
    // 处理其他.js文件
    const files = fs.readdirSync(funcPath);
    for (const file of files) {
      if (file.endsWith('.js') && file !== 'index.js' && file !== 'collections.js') {
        const filePath = path.join(funcPath, file);
        if (fs.statSync(filePath).isFile()) {
          replaceInFile(filePath);
        }
      }
    }
  }
  
  // 打印统计信息
  console.log('\n' + '='.repeat(60));
  console.log('修复完成！统计信息：');
  console.log('='.repeat(60));
  console.log(`📊 处理文件总数: ${stats.filesProcessed}`);
  console.log(`✅ 修改文件数量: ${stats.filesModified}`);
  console.log(`🔄 替换次数总计: ${stats.replacements}`);
  console.log(`❌ 错误数量: ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\n错误详情:');
    stats.errors.forEach(err => {
      console.log(`  - ${err.file}: ${err.error}`);
    });
  }
  
  console.log('\n💡 提示: 请测试修复后的云函数，确保功能正常');
  console.log('='.repeat(60));
}

// 执行修复
processCloudFunctions();
