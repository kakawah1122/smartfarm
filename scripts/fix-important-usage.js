#!/usr/bin/env node

/**
 * 修复!important滥用问题
 * 主要处理app.scss中的字体定义
 */

const fs = require('fs');
const path = require('path');

const APP_SCSS_PATH = path.join(process.cwd(), 'miniprogram/app.scss');
const BACKUP_PATH = path.join(process.cwd(), 'miniprogram/app.scss.backup');

/**
 * 创建备份
 */
function createBackup() {
  console.log('📁 创建备份文件...');
  fs.copyFileSync(APP_SCSS_PATH, BACKUP_PATH);
  console.log('✅ 备份已创建: app.scss.backup');
}

/**
 * 修复字体定义中的!important
 */
function fixFontImportant() {
  console.log('\n🔧 开始修复!important问题...\n');
  
  let content = fs.readFileSync(APP_SCSS_PATH, 'utf8');
  const originalContent = content;
  
  // 统计!important数量
  const importantCount = (content.match(/!important/g) || []).length;
  console.log(`📊 发现 ${importantCount} 个!important\n`);
  
  // 修复策略1：移除不必要的!important
  const unnecessaryImportantPatterns = [
    // 字体相关
    /font-family:\s*([^;]+)\s*!important/g,
    /font-style:\s*normal\s*!important/g,
    /font-weight:\s*normal\s*!important/g,
    // 基础样式
    /margin:\s*0\s*!important/g,
    /padding:\s*0\s*!important/g,
    /box-sizing:\s*border-box\s*!important/g,
    // 颜色相关（如果是变量定义）
    /color:\s*var\([^)]+\)\s*!important/g,
    /background-color:\s*var\([^)]+\)\s*!important/g
  ];
  
  let fixedCount = 0;
  
  unnecessaryImportantPatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    if (matches.length > 0) {
      content = content.replace(pattern, (match) => {
        fixedCount++;
        return match.replace(' !important', '');
      });
    }
  });
  
  // 修复策略2：使用更具体的选择器替代!important
  // 对于确实需要覆盖的样式，通过提高选择器优先级
  const specificSelectors = [
    {
      old: /^(\s*)\.([a-z-]+)\s*{\s*([^}]*!important[^}]*)\}/gm,
      new: (match, indent, className, styles) => {
        // 如果是全局样式，提高选择器优先级
        const newStyles = styles.replace(/!important/g, '');
        return `${indent}.app .${className},\n${indent}.page .${className} {\n${newStyles}}`;
      }
    }
  ];
  
  specificSelectors.forEach(rule => {
    content = content.replace(rule.old, rule.new);
  });
  
  // 修复策略3：创建CSS变量系统
  const cssVariables = `/* CSS变量系统 - 替代!important */
:root {
  /* 字体 */
  --font-family-primary: 'PingFang SC', -apple-system, 'Helvetica Neue', Arial, sans-serif;
  --font-family-mono: 'SF Mono', Monaco, Consolas, monospace;
  
  /* 颜色 */
  --color-primary: #1890ff;
  --color-success: #52c41a;
  --color-warning: #faad14;
  --color-error: #f5222d;
  --color-text-primary: #262626;
  --color-text-secondary: #8c8c8c;
  
  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
}

`;
  
  // 如果还没有CSS变量定义，添加到文件开头
  if (!content.includes(':root')) {
    content = cssVariables + '\n' + content;
    console.log('✅ 添加了CSS变量系统');
  }
  
  // 保存修改后的文件
  if (content !== originalContent) {
    fs.writeFileSync(APP_SCSS_PATH, content, 'utf8');
    
    // 重新统计!important数量
    const newImportantCount = (content.match(/!important/g) || []).length;
    const reduced = importantCount - newImportantCount;
    
    console.log('\n📊 修复结果：');
    console.log(`  原始!important数量: ${importantCount}`);
    console.log(`  当前!important数量: ${newImportantCount}`);
    console.log(`  减少了: ${reduced} (${(reduced/importantCount*100).toFixed(1)}%)`);
    console.log(`  移除了: ${fixedCount} 个不必要的!important`);
    
    return true;
  } else {
    console.log('⚠️  没有需要修复的内容');
    return false;
  }
}

/**
 * 生成修复报告
 */
function generateReport() {
  console.log('\n📝 修复建议：\n');
  console.log('1. 已移除不必要的!important');
  console.log('2. 已添加CSS变量系统');
  console.log('3. 建议手动检查剩余的!important，评估是否真的需要');
  console.log('');
  console.log('🔍 剩余的!important可能用于：');
  console.log('   - 覆盖第三方组件样式（如TDesign）');
  console.log('   - 处理微信小程序默认样式');
  console.log('   - 确保关键样式生效');
  console.log('');
  console.log('💡 最佳实践：');
  console.log('   - 使用CSS变量管理主题');
  console.log('   - 通过选择器优先级解决样式冲突');
  console.log('   - 只在必要时使用!important，并添加注释说明原因');
}

/**
 * 主函数
 */
function main() {
  console.log('🎨 !important修复工具\n');
  console.log('='.repeat(60));
  
  try {
    // 检查文件是否存在
    if (!fs.existsSync(APP_SCSS_PATH)) {
      console.error('❌ 文件不存在: miniprogram/app.scss');
      process.exit(1);
    }
    
    // 创建备份
    createBackup();
    
    // 执行修复
    const fixed = fixFontImportant();
    
    // 生成报告
    generateReport();
    
    if (fixed) {
      console.log('\n✅ 修复完成！');
      console.log('   如需恢复，请使用: cp miniprogram/app.scss.backup miniprogram/app.scss');
    }
    
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    // 恢复备份
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, APP_SCSS_PATH);
      console.log('已恢复备份文件');
    }
    process.exit(1);
  }
}

// 执行
main();
