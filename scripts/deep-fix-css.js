#!/usr/bin/env node

/**
 * 深度修复CSS语法错误
 * 更彻底地清理和修复CSS文件
 */

const fs = require('fs');
const path = require('path');

let totalFixed = 0;
const problematicFiles = [];

function deepFixCSS(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fixed = false;
  
  // 1. 删除完全空的CSS规则块
  content = content.replace(/\.[a-zA-Z0-9_-]+\s*\{\s*\}/g, '');
  content = content.replace(/#[a-zA-Z0-9_-]+\s*\{\s*\}/g, '');
  
  // 2. 修复孤立的选择器（没有规则体）
  content = content.replace(/\n\s*\.[a-zA-Z0-9_-]+\s*\n/g, '\n');
  content = content.replace(/\n\s*#[a-zA-Z0-9_-]+\s*\n/g, '\n');
  
  // 3. 修复注释后直接跟选择器的情况（添加换行）
  content = content.replace(/(\*\/)\s*(\.[a-zA-Z0-9_-])/g, '$1\n\n$2');
  content = content.replace(/(\*\/)\s*(#[a-zA-Z0-9_-])/g, '$1\n\n$2');
  
  // 4. 修复末尾多余的分号
  content = content.replace(/;\s*;/g, ';');
  
  // 5. 修复嵌套错误 - 确保每个开花括号都有对应的闭花括号
  let openBraces = (content.match(/\{/g) || []).length;
  let closeBraces = (content.match(/\}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    console.log(`⚠️  ${path.basename(filePath)}: 花括号不匹配 (开: ${openBraces}, 闭: ${closeBraces})`);
    problematicFiles.push(filePath);
    
    // 尝试自动修复
    if (openBraces > closeBraces) {
      // 缺少闭花括号，在文件末尾添加
      const missing = openBraces - closeBraces;
      for (let i = 0; i < missing; i++) {
        content += '\n}';
      }
      console.log(`  → 添加了 ${missing} 个闭花括号`);
    }
    fixed = true;
  }
  
  // 6. 清理连续的空行
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  // 7. 修复注释内容（确保注释格式正确）
  content = content.replace(/\/\*\s*\*\//g, ''); // 删除空注释
  content = content.replace(/\/\*([^*])\*/g, '/* $1 */'); // 修复缺少空格的注释
  
  // 8. 修复行尾空白
  content = content.replace(/[ \t]+$/gm, '');
  
  // 9. 确保文件以换行结束
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFixed++;
    return true;
  }
  
  return false;
}

function scanAndFix() {
  const cssFiles = [];
  
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'miniprogram_npm', 'backups', '.DS_Store'].includes(item)) {
          scanDir(fullPath);
        }
      } else if (item.endsWith('.scss') || item.endsWith('.wxss')) {
        cssFiles.push(fullPath);
      }
    });
  }
  
  scanDir(path.join(process.cwd(), 'miniprogram'));
  
  console.log(`📋 扫描到 ${cssFiles.length} 个样式文件\n`);
  console.log('🔧 开始深度修复...\n');
  
  let fixedInThisRun = 0;
  cssFiles.forEach(file => {
    if (deepFixCSS(file)) {
      console.log(`✅ 修复: ${path.relative(process.cwd(), file)}`);
      fixedInThisRun++;
    }
  });
  
  console.log(`\n📊 本次修复了 ${fixedInThisRun} 个文件`);
  
  if (problematicFiles.length > 0) {
    console.log('\n⚠️  以下文件可能仍有问题：');
    problematicFiles.forEach(file => {
      console.log(`  - ${path.relative(process.cwd(), file)}`);
    });
  }
}

// 验证CSS语法
function validateCSS(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  
  // 检查花括号匹配
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`花括号不匹配: 开${openBraces} 闭${closeBraces}`);
  }
  
  // 检查是否有孤立的选择器
  if (/\n\s*\.[a-zA-Z0-9_-]+\s*$/m.test(content)) {
    errors.push('存在孤立的类选择器');
  }
  
  // 检查是否有空规则
  if (/\{[\s\n]*\}/g.test(content)) {
    errors.push('存在空的CSS规则');
  }
  
  return errors;
}

// 主函数
function main() {
  console.log('🚀 深度CSS修复工具\n');
  
  // 执行修复
  scanAndFix();
  
  // 验证关键文件
  console.log('\n🔍 验证关键文件...\n');
  const keyFiles = [
    'miniprogram/app.scss',
    'miniprogram/packageUser/knowledge/knowledge.scss',
    'miniprogram/pages/health/health.scss'
  ];
  
  keyFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const errors = validateCSS(filePath);
      if (errors.length > 0) {
        console.log(`❌ ${path.basename(file)}:`);
        errors.forEach(err => console.log(`   - ${err}`));
      } else {
        console.log(`✅ ${path.basename(file)}: 语法正确`);
      }
    }
  });
  
  console.log('\n✨ 修复完成！');
  console.log('📝 请重新编译项目验证');
}

// 执行
main();
