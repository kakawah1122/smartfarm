#!/usr/bin/env node

/**
 * 安全的CSS清理工具
 * 只删除明确识别的未使用类，不破坏文件结构
 */

const fs = require('fs');
const path = require('path');

// 统计信息
const stats = {
  filesProcessed: 0,
  classesRemoved: 0,
  filesModified: 0
};

// 安全删除CSS规则
function safeRemoveRule(content, className) {
  // 构建精确的正则表达式
  const patterns = [
    // 完整的类规则（包含花括号）
    new RegExp(`\\.${className}\\s*\\{[^{}]*\\}`, 'g'),
    // 多选择器中的类（保留其他选择器）
    new RegExp(`,\\s*\\.${className}(?=[,\\s{])`, 'g'),
    new RegExp(`\\.${className}\\s*,`, 'g')
  ];
  
  let modified = content;
  patterns.forEach(pattern => {
    modified = modified.replace(pattern, '');
  });
  
  // 清理多余的空行，但保留注释结构
  modified = modified.replace(/\n\n\n+/g, '\n\n');
  
  return modified;
}

// 验证CSS语法
function validateCSS(content) {
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  return openBraces === closeBraces;
}

// 处理单个文件
function processFile(filePath, unusedClasses) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  
  const originalContent = fs.readFileSync(filePath, 'utf8');
  let content = originalContent;
  
  // 验证原始文件语法
  if (!validateCSS(content)) {
    console.log(`⚠️  跳过语法有问题的文件: ${path.basename(filePath)}`);
    return;
  }
  
  // 只删除明确未使用的类
  const safeToRemove = [
    'abnormal-info',
    'abnormal-items', 
    'action-bar',
    'action-grid',
    'action-icon-wrapper',
    'action-item',
    'action-label',
    'action-row',
    'action-section'
    // 限制一次只删除少量类，确保安全
  ];
  
  let modified = false;
  safeToRemove.forEach(className => {
    if (unusedClasses.includes(className) && content.includes(`.${className}`)) {
      const newContent = safeRemoveRule(content, className);
      if (validateCSS(newContent)) {
        content = newContent;
        stats.classesRemoved++;
        modified = true;
        console.log(`  ✅ 删除类: ${className}`);
      } else {
        console.log(`  ⚠️  跳过类: ${className} (会破坏语法)`);
      }
    }
  });
  
  // 保存修改
  if (modified && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    stats.filesModified++;
    console.log(`✅ 修改文件: ${path.basename(filePath)}\n`);
  }
  
  stats.filesProcessed++;
}

// 主函数
function main() {
  console.log('🛡️ 安全CSS清理工具\n');
  
  // 读取未使用的类列表
  const reportPath = path.join(process.cwd(), 'docs/UNUSED-CSS-REPORT.md');
  if (!fs.existsSync(reportPath)) {
    console.log('❌ 未找到CSS报告');
    return;
  }
  
  const reportContent = fs.readFileSync(reportPath, 'utf8');
  const unusedClasses = [];
  const lines = reportContent.split('\n');
  
  let inList = false;
  for (const line of lines) {
    if (line.includes('## 未使用的CSS类列表')) {
      inList = true;
      continue;
    }
    if (inList && line.startsWith('- ')) {
      unusedClasses.push(line.substring(2).trim());
    }
    if (inList && line.includes('...')) {
      break;
    }
  }
  
  console.log(`找到 ${unusedClasses.length} 个未使用的类\n`);
  
  // 处理文件
  const cssFiles = [];
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
        cssFiles.push(fullPath);
      }
    });
  }
  
  scanDir(path.join(process.cwd(), 'miniprogram'));
  
  console.log(`处理 ${cssFiles.length} 个样式文件...\n`);
  
  cssFiles.forEach(file => {
    processFile(file, unusedClasses);
  });
  
  // 报告
  console.log('\n📊 清理结果：');
  console.log(`  • 扫描文件: ${stats.filesProcessed}`);
  console.log(`  • 修改文件: ${stats.filesModified}`);
  console.log(`  • 删除的类: ${stats.classesRemoved}`);
  console.log('\n✅ 安全清理完成！');
}

// 执行
main();
