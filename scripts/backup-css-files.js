#!/usr/bin/env node

/**
 * CSS文件备份脚本
 * 在清理未使用的CSS之前，先备份所有CSS文件
 */

const fs = require('fs');
const path = require('path');

// 获取当前时间戳
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const backupDir = path.join(__dirname, '..', 'backups', `css-backup-${timestamp}`);

// 创建备份目录
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

let backupCount = 0;
let totalSize = 0;

/**
 * 递归备份CSS文件
 */
function backupCssFiles(dir, baseDir = '') {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 跳过node_modules和备份目录
      if (file === 'node_modules' || file === 'backups' || file === '.git') {
        return;
      }
      backupCssFiles(fullPath, path.join(baseDir, file));
    } else if (file.endsWith('.scss') || file.endsWith('.css') || file.endsWith('.wxss')) {
      // 创建对应的备份目录结构
      const backupSubDir = path.join(backupDir, baseDir);
      if (!fs.existsSync(backupSubDir)) {
        fs.mkdirSync(backupSubDir, { recursive: true });
      }
      
      // 复制文件
      const backupPath = path.join(backupSubDir, file);
      fs.copyFileSync(fullPath, backupPath);
      
      backupCount++;
      totalSize += stat.size;
      
      // 显示进度
      process.stdout.write(`\r备份中... 已处理 ${backupCount} 个文件`);
    }
  });
}

console.log('🔄 开始备份CSS文件...\n');
console.log(`📁 备份目录: ${backupDir}\n`);

// 从项目根目录开始备份
const projectRoot = path.join(__dirname, '..');
backupCssFiles(projectRoot);

console.log(`\n\n✅ 备份完成！`);
console.log(`📊 统计信息:`);
console.log(`   - 备份文件数: ${backupCount}`);
console.log(`   - 总大小: ${(totalSize / 1024).toFixed(2)} KB`);
console.log(`   - 备份位置: ${backupDir}`);
console.log(`\n💡 提示: 如需恢复，请使用 npm run restore:css 命令`);
