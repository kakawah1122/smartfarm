#!/usr/bin/env node
/**
 * 样式清理脚本
 * 用于检查并清理项目中的样式问题：
 * 1. 检查内联样式
 * 2. 统计!important使用情况
 * 3. 检查未使用的样式类
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MINIPROGRAM_DIR = path.join(__dirname, '../miniprogram');

// 统计结果
const stats = {
  inlineStyles: [],
  importantCount: {},
  unusedStyles: [],
  conflictFiles: []
};

/**
 * 递归查找所有文件
 */
function findFiles(dir, ext, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 跳过node_modules和miniprogram_npm
      if (!['node_modules', 'miniprogram_npm'].includes(item)) {
        findFiles(fullPath, ext, files);
      }
    } else if (stat.isFile() && item.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * 检查内联样式
 */
function checkInlineStyles() {
  console.log('🔍 检查内联样式...');
  const wxmlFiles = findFiles(MINIPROGRAM_DIR, '.wxml');
  
  for (const file of wxmlFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const matches = content.match(/style="[^"]*"/g);
    
    if (matches) {
      const relativePath = path.relative(MINIPROGRAM_DIR, file);
      stats.inlineStyles.push({
        file: relativePath,
        count: matches.length,
        matches: matches.slice(0, 5) // 只显示前5个
      });
    }
  }
  
  console.log(`   找到 ${stats.inlineStyles.length} 个文件包含内联样式`);
}

/**
 * 统计!important使用情况
 */
function checkImportantUsage() {
  console.log('🔍 统计!important使用情况...');
  const scssFiles = findFiles(MINIPROGRAM_DIR, '.scss');
  
  for (const file of scssFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const matches = content.match(/!important/g);
    
    if (matches) {
      const relativePath = path.relative(MINIPROGRAM_DIR, file);
      stats.importantCount[relativePath] = matches.length;
    }
  }
  
  const total = Object.values(stats.importantCount).reduce((a, b) => a + b, 0);
  console.log(`   总共找到 ${total} 个!important，分布在 ${Object.keys(stats.importantCount).length} 个文件中`);
}

/**
 * 查找冲突副本文件
 */
function findConflictFiles() {
  console.log('🔍 查找冲突副本文件...');
  const allFiles = findFiles(MINIPROGRAM_DIR, '');
  
  for (const file of allFiles) {
    const fileName = path.basename(file);
    if (fileName.includes('冲突副本') || fileName.includes('conflict')) {
      const relativePath = path.relative(MINIPROGRAM_DIR, file);
      stats.conflictFiles.push(relativePath);
    }
  }
  
  console.log(`   找到 ${stats.conflictFiles.length} 个冲突副本文件`);
}

/**
 * 生成报告
 */
function generateReport() {
  console.log('\n📊 样式检查报告\n');
  console.log('='.repeat(60));
  
  // 冲突文件
  if (stats.conflictFiles.length > 0) {
    console.log('\n⚠️  冲突副本文件:');
    stats.conflictFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
  }
  
  // 内联样式
  if (stats.inlineStyles.length > 0) {
    console.log('\n⚠️  包含内联样式的文件:');
    stats.inlineStyles.slice(0, 10).forEach(item => {
      console.log(`   - ${item.file} (${item.count}处)`);
    });
    if (stats.inlineStyles.length > 10) {
      console.log(`   ... 还有 ${stats.inlineStyles.length - 10} 个文件`);
    }
  }
  
  // !important统计
  console.log('\n📈 !important使用统计（Top 10）:');
  const sortedImportant = Object.entries(stats.importantCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  sortedImportant.forEach(([file, count]) => {
    console.log(`   - ${file}: ${count}个`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ 检查完成！');
}

// 执行检查
console.log('🚀 开始样式检查...\n');
findConflictFiles();
checkInlineStyles();
checkImportantUsage();
generateReport();

// 导出结果供其他脚本使用
if (require.main === module) {
  // 直接运行
} else {
  module.exports = { stats, findFiles, checkInlineStyles, checkImportantUsage };
}

