#!/usr/bin/env node

/**
 * 安全的CSS清理脚本
 * 分批清理未使用的CSS类，确保不破坏UI
 */

const fs = require('fs');
const path = require('path');

// 第一批要清理的CSS类（最安全的50个）
const BATCH_1_CLASSES = [
  'abnormal-info',
  'abnormal-items',
  'action-bar',
  'action-grid',
  'action-icon-wrapper',
  'action-item',
  'action-label',
  'action-row',
  'action-section',
  'add-btn-wrapper',
  'add-medication-content',
  'adjust-plan-content',
  'ai-count-loading',
  'alert-high',
  'alert-low',
  'alert-medium',
  'analysis-card',
  'analysis-header',
  'analysis-stats',
  'analysis-trend',
  'analysis-value',
  'animated-entry',
  'app',
  'appetite-excellent',
  'appetite-fair',
  'appetite-good',
  'appetite-option',
  'appetite-options',
  'appetite-poor',
  'approval-footer',
  'approval-icon',
  'approval-time',
  'article-desc',
  'article-item-content',
  'article-item-top',
  'batch-selector-container',
  'batch-selector-header',
  'batch-selector-list',
  'batch-selector-option',
  'batch-selector-overlay',
  'batch-selector-title',
  'batch-stats-grid',
  'behavior-excellent',
  'behavior-fair',
  'behavior-good',
  'behavior-option',
  'behavior-options',
  'behavior-poor'
];

// 保护列表 - 这些类名即使未检测到使用也不应删除
const PROTECTED_CLASSES = [
  'active',  // 可能动态添加
  'hover',   // hover状态
  'disabled', // 禁用状态
  'loading', // 加载状态
  'error',   // 错误状态
  'success', // 成功状态
  'warning', // 警告状态
  'hidden',  // 隐藏状态
  'show',    // 显示状态
];

let processedFiles = 0;
let removedCount = 0;
let skippedCount = 0;

/**
 * 清理CSS文件中的未使用类
 */
function cleanCssFile(filePath, classesToRemove) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  classesToRemove.forEach(className => {
    // 跳过保护列表中的类
    if (PROTECTED_CLASSES.includes(className)) {
      skippedCount++;
      return;
    }
    
    // 匹配各种CSS选择器格式
    const patterns = [
      // .className { ... }
      new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 'g'),
      // .className,
      new RegExp(`\\.${className}\\s*,`, 'g'),
      // .parent .className
      new RegExp(`\\s+\\.${className}\\s*\\{`, 'g'),
      // .className.other
      new RegExp(`\\.${className}\\.`, 'g'),
      // .className:hover等伪类
      new RegExp(`\\.${className}:[a-z-]+`, 'g'),
      // .className[attr]属性选择器
      new RegExp(`\\.${className}\\[`, 'g'),
    ];
    
    patterns.forEach(pattern => {
      const before = content.length;
      content = content.replace(pattern, '');
      if (content.length < before) {
        modified = true;
        removedCount++;
      }
    });
  });
  
  if (modified) {
    // 清理多余的空行
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    fs.writeFileSync(filePath, content);
    processedFiles++;
  }
  
  return modified;
}

/**
 * 递归处理所有CSS文件
 */
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 跳过特定目录
      if (file === 'node_modules' || file === 'backups' || file === '.git') {
        return;
      }
      processDirectory(fullPath);
    } else if (file.endsWith('.scss') || file.endsWith('.css') || file.endsWith('.wxss')) {
      cleanCssFile(fullPath, BATCH_1_CLASSES);
    }
  });
}

/**
 * 生成清理报告
 */
function generateReport() {
  const reportPath = path.join(__dirname, '..', 'docs', `CSS-CLEANUP-BATCH1-${new Date().toISOString().slice(0, 10)}.md`);
  
  const report = `# CSS清理报告 - 第一批

生成时间: ${new Date().toLocaleString()}

## 📊 清理统计

- 目标清理类数: ${BATCH_1_CLASSES.length}
- 实际移除数: ${removedCount}
- 跳过保护类: ${skippedCount}
- 修改文件数: ${processedFiles}

## 🎯 清理的CSS类

${BATCH_1_CLASSES.map(cls => `- ${cls}`).join('\n')}

## ✅ 验证步骤

1. 检查主要页面UI是否正常
2. 测试关键功能是否可用
3. 对比清理前后的样式差异

## 🔄 回滚方法

如发现问题，可使用以下命令回滚：
\`\`\`bash
npm run restore:css
\`\`\`
`;

  fs.writeFileSync(reportPath, report);
  console.log(`\n📝 清理报告已生成: ${reportPath}`);
}

// 主执行逻辑
console.log('🧹 CSS安全清理脚本 - 第一批\n');
console.log('⚠️  警告: 请确保已经备份CSS文件！');
console.log('📋 本次将清理 ' + BATCH_1_CLASSES.length + ' 个未使用的CSS类\n');

// 等待用户确认
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('是否继续？(y/n): ', (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('❌ 操作已取消');
    rl.close();
    return;
  }
  
  console.log('\n🔍 开始扫描和清理...\n');
  
  const projectRoot = path.join(__dirname, '..');
  processDirectory(projectRoot);
  
  console.log('\n✅ 清理完成！');
  console.log(`📊 统计信息:`);
  console.log(`   - 处理文件: ${processedFiles}`);
  console.log(`   - 移除类数: ${removedCount}`);
  console.log(`   - 跳过保护: ${skippedCount}`);
  
  generateReport();
  
  console.log('\n💡 下一步:');
  console.log('   1. 测试主要页面功能');
  console.log('   2. 如无问题，继续清理下一批');
  console.log('   3. 如有问题，执行 npm run restore:css 回滚');
  
  rl.close();
});
