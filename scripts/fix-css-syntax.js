#!/usr/bin/env node

/**
 * 修复CSS语法错误
 * 清理空的注释块和修复语法问题
 */

const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const filesToFix = [
  'miniprogram/packageUser/knowledge/knowledge.scss',
  'miniprogram/packageUser/role-migration/role-migration.scss',
  'miniprogram/packageUser/knowledge-management/knowledge-management.scss',
  'miniprogram/packageUser/employee-permission/employee-permission.scss',
  'miniprogram/packageUser/notification-settings/notification-settings.scss',
  'miniprogram/packageUser/lifecycle-task-edit/lifecycle-task-edit.scss',
  'miniprogram/packageUser/price-management/price-management.scss',
  'miniprogram/packageUser/invite-management/invite-management.scss',
  'miniprogram/packageUser/about/about.scss',
  'miniprogram/packageUser/knowledge/article-detail/article-detail.scss'
];

let fixedCount = 0;

function fixCSSFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;
  
  // 修复模式1: 删除空的注释块后面紧跟的空行和孤立的花括号
  content = content.replace(/\/\*[^*]*\*\/\s*\n\s*\n/g, '\n');
  
  // 修复模式2: 删除注释后面直接跟着的空规则
  content = content.replace(/\/\*[^*]*\*\/\s*\n\s*\./g, '.');
  
  // 修复模式3: 处理孤立的注释（注释后面没有任何规则）
  content = content.replace(/\/\*\s*[^*]*\s*\*\/\s*\n(?=\s*(\/\*|\.|#|@media|\}|$))/g, '');
  
  // 修复模式4: 删除多余的空行
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  // 修复模式5: 确保文件末尾有换行
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ 修复: ${filePath}`);
    fixedCount++;
  } else {
    console.log(`ℹ️  无需修复: ${filePath}`);
  }
}

// 扫描所有SCSS文件查找语法问题
function scanAllFiles() {
  const allFiles = [];
  
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'miniprogram_npm', 'backups'].includes(item)) {
          scanDir(fullPath);
        }
      } else if (item.endsWith('.scss') || item.endsWith('.wxss')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // 检查是否有孤立的注释
        if (/\/\*[^*]*\*\/\s*\n\s*(\.|#|\/\*|\}|$)/m.test(content)) {
          allFiles.push(path.relative(process.cwd(), fullPath));
        }
      }
    });
  }
  
  scanDir(path.join(process.cwd(), 'miniprogram'));
  return allFiles;
}

// 主函数
function main() {
  console.log('🔧 修复CSS语法错误...\n');
  
  // 扫描所有文件
  console.log('📋 扫描所有样式文件...');
  const problemFiles = scanAllFiles();
  console.log(`找到 ${problemFiles.length} 个可能有问题的文件\n`);
  
  // 修复已知问题文件
  console.log('🛠️ 修复已知问题文件...');
  filesToFix.forEach(file => {
    fixCSSFile(file);
  });
  
  // 修复扫描到的其他问题文件
  if (problemFiles.length > filesToFix.length) {
    console.log('\n🛠️ 修复其他问题文件...');
    problemFiles.forEach(file => {
      if (!filesToFix.includes(file)) {
        fixCSSFile(file);
      }
    });
  }
  
  console.log(`\n✅ 修复完成！共修复 ${fixedCount} 个文件`);
  console.log('\n💡 请重新编译项目验证是否解决了WXSS编译错误');
}

// 执行
main();
