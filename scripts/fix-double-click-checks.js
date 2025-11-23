#!/usr/bin/env node

/**
 * 修复所有checkDoubleClick调用，确保类型安全
 */

const fs = require('fs');
const path = require('path');

// 要扫描的目录
const scanDirs = [
  path.join(process.cwd(), 'miniprogram/pages/health'),
  path.join(process.cwd(), 'miniprogram/pages/index'),
  path.join(process.cwd(), 'miniprogram/pages/production'),
  path.join(process.cwd(), 'miniprogram/pages/profile')
];

// 统计
let totalFiles = 0;
let fixedFiles = 0;
let totalFixes = 0;

/**
 * 扫描并修复文件
 */
function scanAndFix(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️ 目录不存在: ${dir}`);
    return;
  }
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 递归扫描子目录
      scanAndFix(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      processFile(filePath);
    }
  });
}

/**
 * 处理单个文件
 */
function processFile(filePath) {
  totalFiles++;
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fixes = 0;
  
  // 模式1: if (this.checkDoubleClick && this.checkDoubleClick())
  const pattern1 = /if\s*\(\s*this\.checkDoubleClick\s*&&\s*this\.checkDoubleClick\(\)\s*\)\s*return/g;
  const replacement1 = 'if (typeof this.checkDoubleClick === \'function\' && this.checkDoubleClick()) return';
  
  content = content.replace(pattern1, (match) => {
    fixes++;
    return replacement1;
  });
  
  // 模式2: if (this.checkDoubleClick && this.checkDoubleClick()) {
  const pattern2 = /if\s*\(\s*this\.checkDoubleClick\s*&&\s*this\.checkDoubleClick\(\)\s*\)\s*{/g;
  const replacement2 = 'if (typeof this.checkDoubleClick === \'function\' && this.checkDoubleClick()) {';
  
  content = content.replace(pattern2, (match) => {
    fixes++;
    return replacement2;
  });
  
  // 模式3: 带参数的调用
  const pattern3 = /if\s*\(\s*this\.checkDoubleClick\s*&&\s*this\.checkDoubleClick\(([^)]*)\)\s*\)\s*return/g;
  const replacement3 = 'if (typeof this.checkDoubleClick === \'function\' && this.checkDoubleClick($1)) return';
  
  content = content.replace(pattern3, (match, params) => {
    // 跳过已经修复的
    if (match.includes('typeof')) {
      return match;
    }
    fixes++;
    return replacement3.replace('$1', params);
  });
  
  // 模式4: 已经部分修复但格式不对的
  const pattern4 = /if\s*\(\s*typeof\s+this\.checkDoubleClick\s*===\s*'function'\s*&&\s*this\.checkDoubleClick\(\)\s*\)\s*{\s*return\s*}/g;
  const replacement4 = 'if (typeof this.checkDoubleClick === \'function\' && this.checkDoubleClick()) {\n      return\n    }';
  
  content = content.replace(pattern4, (match) => {
    fixes++;
    return replacement4;
  });
  
  if (fixes > 0) {
    // 备份原文件
    const backupPath = filePath + '.dbl-click-backup';
    fs.writeFileSync(backupPath, originalContent);
    
    // 写入修复后的内容
    fs.writeFileSync(filePath, content);
    
    console.log(`✅ 修复 ${path.relative(process.cwd(), filePath)}: ${fixes} 处`);
    fixedFiles++;
    totalFixes += fixes;
  }
}

// 主程序
console.log('🔍 开始扫描并修复 checkDoubleClick 调用问题...\n');

scanDirs.forEach(dir => {
  console.log(`📁 扫描目录: ${path.relative(process.cwd(), dir)}`);
  scanAndFix(dir);
});

console.log('\n📊 修复统计:');
console.log(`   - 扫描文件: ${totalFiles} 个`);
console.log(`   - 修复文件: ${fixedFiles} 个`);
console.log(`   - 修复位置: ${totalFixes} 处`);

if (totalFixes > 0) {
  console.log('\n✅ 修复完成！');
  console.log('💡 建议：运行项目测试所有点击功能是否正常');
} else {
  console.log('\n✅ 没有发现需要修复的问题');
}
