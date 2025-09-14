#!/usr/bin/env node
// 批量更新所有云函数的集合名称映射脚本

const fs = require('fs');
const path = require('path');

// 集合名称映射表（旧名称 → 新名称）
const COLLECTION_MAPPINGS = {
  // 用户管理
  'users': 'wx_users',
  'employee_invites': 'wx_user_invites',
  
  // 生产管理
  'entry_records': 'prod_batch_entries',
  'exit_records': 'prod_batch_exits',
  'materials': 'prod_materials',
  'material_records': 'prod_material_records',
  'inventory_logs': 'prod_inventory_logs',
  
  // 健康管理
  'prevention_records': 'health_prevention_records',
  'treatment_records': 'health_treatment_records',
  'ai_diagnosis_records': 'health_ai_diagnosis',
  'cure_records': 'health_cure_records',
  'death_records': 'health_death_records',
  'followup_records': 'health_followup_records',
  'vaccine_plans': 'health_vaccine_plans',
  'health_alerts': 'health_alerts',
  
  // 财务管理
  'cost_records': 'finance_cost_records',
  'revenue_records': 'finance_revenue_records',
  'financial_reports': 'finance_reports',
  'financial_summaries': 'finance_summaries',
  
  // 任务管理
  'batch_todos': 'task_batch_schedules',
  'task_completions': 'task_completions',
  'task_records': 'task_records',
  'task_templates': 'task_templates',
  
  // 系统管理
  'admin_logs': 'sys_audit_logs',
  'approval_logs': 'sys_approval_logs',
  'cleanup_logs': 'sys_cleanup_logs',
  'storage_statistics': 'sys_storage_statistics',
  'notifications': 'sys_notifications',
  'permissions': 'sys_permissions',
  'roles': 'sys_roles',
  'ai_cache': 'sys_ai_cache',
  'ai_usage': 'sys_ai_usage',
  'system_configs': 'sys_configurations',
  'overview_stats': 'sys_overview_stats',
  
  // 文件管理
  'dynamic_file_records': 'file_dynamic_records',
  'file_records': 'file_static_records'
};

// 需要备份和更新的云函数列表
const CLOUD_FUNCTIONS_TO_UPDATE = [
  'ai-diagnosis',
  'ai-multi-model',
  'breeding-todo',
  'dynamic-file-manager',
  'finance-management',
  'health-management',
  'login',
  'notification-management',
  'permission-check',
  'production-dashboard',
  'production-entry',
  'production-exit',
  'production-management',
  'production-material',
  'production-upload',
  'register',
  'role-migration',
  'setup-health-permissions',
  'user-approval',
  'user-management'
];

// 备份文件
function backupFile(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = filePath.replace('.js', `-backup-${timestamp}.js`);
  fs.copyFileSync(filePath, backupPath);
  console.log(`✅ 已备份: ${path.basename(filePath)} → ${path.basename(backupPath)}`);
}

// 更新集合名称
function updateCollectionNames(content) {
  let updatedContent = content;
  let changeCount = 0;
  
  // 更新 db.collection('old_name') 格式
  Object.entries(COLLECTION_MAPPINGS).forEach(([oldName, newName]) => {
    const oldPattern = new RegExp(`db\\.collection\\('${oldName}'\\)`, 'g');
    const newPattern = `db.collection('${newName}')`;
    
    const beforeCount = (updatedContent.match(oldPattern) || []).length;
    updatedContent = updatedContent.replace(oldPattern, newPattern);
    const afterCount = (updatedContent.match(new RegExp(`db\\.collection\\('${newName}'\\)`, 'g')) || []).length;
    
    if (beforeCount > 0) {
      changeCount += beforeCount;
      console.log(`  📝 ${oldName} → ${newName} (${beforeCount}处)`);
    }
  });
  
  // 更新 db.collection("old_name") 格式（双引号）
  Object.entries(COLLECTION_MAPPINGS).forEach(([oldName, newName]) => {
    const oldPattern = new RegExp(`db\\.collection\\("${oldName}"\\)`, 'g');
    const newPattern = `db.collection("${newName}")`;
    
    const beforeCount = (updatedContent.match(oldPattern) || []).length;
    updatedContent = updatedContent.replace(oldPattern, newPattern);
    
    if (beforeCount > 0) {
      changeCount += beforeCount;
      console.log(`  📝 ${oldName} → ${newName} (${beforeCount}处, 双引号)`);
    }
  });
  
  return { content: updatedContent, changes: changeCount };
}

// 主要更新函数
function updateCloudFunction(functionName) {
  const functionDir = path.join(__dirname, 'cloudfunctions', functionName);
  const indexPath = path.join(functionDir, 'index.js');
  
  if (!fs.existsSync(indexPath)) {
    console.log(`❌ 跳过 ${functionName}: index.js 不存在`);
    return;
  }
  
  console.log(`\n🔄 更新 ${functionName}:`);
  
  // 备份原文件
  backupFile(indexPath);
  
  // 读取文件内容
  const originalContent = fs.readFileSync(indexPath, 'utf8');
  
  // 更新集合名称
  const { content: updatedContent, changes } = updateCollectionNames(originalContent);
  
  if (changes > 0) {
    // 写入更新后的内容
    fs.writeFileSync(indexPath, updatedContent, 'utf8');
    console.log(`✅ ${functionName} 更新完成，共修改 ${changes} 处`);
  } else {
    console.log(`ℹ️  ${functionName} 无需更新`);
  }
}

// 主函数
function main() {
  console.log('🚀 开始批量更新云函数集合名称...\n');
  
  let totalUpdated = 0;
  let totalChanges = 0;
  
  CLOUD_FUNCTIONS_TO_UPDATE.forEach(functionName => {
    try {
      const beforeChanges = totalChanges;
      updateCloudFunction(functionName);
      
      // 重新读取文件计算实际更改数
      const functionDir = path.join(__dirname, 'cloudfunctions', functionName);
      const indexPath = path.join(functionDir, 'index.js');
      
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        const currentChanges = Object.values(COLLECTION_MAPPINGS).reduce((count, newName) => {
          return count + (content.match(new RegExp(`db\\.collection\\(["']${newName}["']\\)`, 'g')) || []).length;
        }, 0);
        
        if (currentChanges > 0) {
          totalUpdated++;
        }
      }
      
    } catch (error) {
      console.error(`❌ 更新 ${functionName} 失败:`, error.message);
    }
  });
  
  console.log(`\n🎉 批量更新完成!`);
  console.log(`📊 更新统计:`);
  console.log(`  - 处理云函数: ${CLOUD_FUNCTIONS_TO_UPDATE.length} 个`);
  console.log(`  - 成功更新: ${totalUpdated} 个`);
  console.log(`\n📋 下一步操作:`);
  console.log(`  1. 在微信开发者工具中重新上传所有云函数`);
  console.log(`  2. 编译前端项目`);
  console.log(`  3. 测试各项功能`);
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { updateCloudFunction, COLLECTION_MAPPINGS };
