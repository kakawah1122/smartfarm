#!/usr/bin/env node

/**
 * 项目备份脚本
 * 功能：备份代码和导出数据库结构信息
 * 安全性：不会修改任何现有文件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backupDir = path.join(__dirname, '../backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupName = `backup-${timestamp}`;
const backupPath = path.join(backupDir, backupName);

console.log('🔐 开始创建项目备份...');
console.log(`📁 备份目录: ${backupPath}`);

// 1. 创建备份目录
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}
fs.mkdirSync(backupPath);

// 2. 备份代码（使用Git archive）
console.log('📦 备份代码...');
try {
  execSync(`git archive --format=tar --output="${backupPath}/code.tar" HEAD`, {
    cwd: path.join(__dirname, '..')
  });
  console.log('✅ 代码备份完成');
} catch (error) {
  console.log('⚠️ Git备份失败，使用文件复制备份...');
  
  // 备份关键目录
  const dirsToBackup = [
    'miniprogram',
    'cloudfunctions',
    'shared-config',
    'data',
    'database-indexes',
    'scripts'
  ];
  
  dirsToBackup.forEach(dir => {
    const srcPath = path.join(__dirname, '..', dir);
    const destPath = path.join(backupPath, dir);
    if (fs.existsSync(srcPath)) {
      console.log(`  复制 ${dir}...`);
      copyDirRecursive(srcPath, destPath);
    }
  });
}

// 3. 记录数据库集合信息（不导出数据，仅记录结构）
console.log('📝 记录数据库结构信息...');
const dbInfo = {
  timestamp,
  collections: [
    // 用户管理模块
    'wx_users',
    'user_sessions',
    'user_notification_settings',
    'user_notifications',
    'user_invite_codes',
    'user_operation_logs',
    'user_feedback',
    
    // 生产管理模块
    'prod_batch_entries',
    'prod_batch_exits',
    'prod_material_records',
    'prod_material_categories',
    'feed_usage_records',
    'prod_inventory_snapshots',
    
    // 健康管理模块
    'health_prevention_records',
    'health_inspection_records',
    'health_abnormal_records',
    'health_treatment_records',
    'health_death_records',
    'health_ai_diagnosis',
    
    // 财务管理模块
    'finance_cost_records',
    'finance_analysis_history',
    'finance_reports',
    'price_config',
    
    // 任务管理模块
    'task_batch_schedules',
    'task_templates',
    
    // 系统管理模块
    'sys_knowledge_articles',
    'sys_permissions',
    'sys_overview_stats',
    'sys_notifications',
    'sys_approval_logs',
    'sys_operation_audit',
    'sys_logs',
    'sys_diagnosis_feedback',
    'sys_goose_prices',
    'sys_config',
    'sys_message_templates',
    
    // 文件管理模块
    'file_static_records'
  ],
  note: '这是数据库结构备份，不包含实际数据。如需恢复数据，请从云开发控制台导出。'
};

fs.writeFileSync(
  path.join(backupPath, 'database-structure.json'),
  JSON.stringify(dbInfo, null, 2)
);
console.log('✅ 数据库结构信息记录完成');

// 4. 记录当前Git状态
console.log('📊 记录Git状态...');
const gitInfo = {
  timestamp,
  branch: '',
  lastCommit: '',
  status: ''
};

try {
  gitInfo.branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  gitInfo.lastCommit = execSync('git log -1 --oneline', { encoding: 'utf-8' }).trim();
  gitInfo.status = execSync('git status --short', { encoding: 'utf-8' }).trim();
} catch (error) {
  console.log('⚠️ 无法获取Git信息');
}

fs.writeFileSync(
  path.join(backupPath, 'git-info.json'),
  JSON.stringify(gitInfo, null, 2)
);

// 5. 创建恢复说明
const restoreInstructions = `# 备份恢复说明

## 备份信息
- 时间: ${timestamp}
- 分支: ${gitInfo.branch}
- 最后提交: ${gitInfo.lastCommit}

## 恢复步骤

### 1. 恢复代码
\`\`\`bash
# 解压代码
tar -xf code.tar -C /path/to/project

# 或者从Git恢复到特定提交
git checkout ${gitInfo.lastCommit?.split(' ')[0] || 'HEAD'}
\`\`\`

### 2. 恢复数据库
数据库需要从云开发控制台手动恢复：
1. 登录微信云开发控制台
2. 进入数据库管理
3. 使用数据导入功能恢复数据

## 注意事项
- 恢复前请先备份当前版本
- 恢复后需要重新部署云函数
- 检查所有功能是否正常工作
`;

fs.writeFileSync(
  path.join(backupPath, 'RESTORE.md'),
  restoreInstructions
);

console.log('✅ 恢复说明创建完成');

// 辅助函数：递归复制目录
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // 跳过node_modules和临时文件
    if (entry.name === 'node_modules' || 
        entry.name === '.git' || 
        entry.name.startsWith('.')) {
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('\n' + '='.repeat(50));
console.log(`✅ 备份完成！`);
console.log(`📁 备份位置: ${backupPath}`);
console.log('='.repeat(50));
