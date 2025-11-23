#!/usr/bin/env node

/**
 * 替换重复代码为公共工具模块调用
 * 安全、渐进、可回滚
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 创建交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 问询函数
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// 备份目录
const BACKUP_DIR = path.join(__dirname, '..', 'backups', `duplicate-replace-${Date.now()}`);

// 统计
let filesFixed = 0;
let totalReplacements = 0;
let backups = [];

// 公共工具模块路径（相对路径会根据文件位置调整）
const COMMON_UTILS_PATH = 'miniprogram/utils/common-utils';

/**
 * 创建备份
 */
function createBackup(filePath, content) {
  const relativePath = path.relative(process.cwd(), filePath);
  const backupPath = path.join(BACKUP_DIR, relativePath);
  const backupDir = path.dirname(backupPath);
  
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupPath, content);
  backups.push({ original: filePath, backup: backupPath });
  
  return backupPath;
}

/**
 * 计算相对导入路径
 */
function getRelativeImportPath(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  const toPath = path.join(process.cwd(), toFile);
  let relativePath = path.relative(fromDir, toPath);
  
  // 移除.ts扩展名
  relativePath = relativePath.replace(/\.ts$/, '');
  
  // 确保以./或../开头
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  
  // Windows路径转换
  relativePath = relativePath.replace(/\\/g, '/');
  
  return relativePath;
}

/**
 * 检查是否已经导入了公共工具模块
 */
function hasCommonUtilsImport(content) {
  return content.includes('from \'../../utils/common-utils\'') ||
         content.includes('from "../../utils/common-utils"') ||
         content.includes('from \'../utils/common-utils\'') ||
         content.includes('from "../utils/common-utils"') ||
         content.includes('from \'./utils/common-utils\'') ||
         content.includes('from "./utils/common-utils"');
}

/**
 * 添加导入语句
 */
function addImportStatement(content, filePath, functions) {
  if (hasCommonUtilsImport(content)) {
    // 已经有导入，更新导入的函数
    const importPattern = /import\s*\{([^}]+)\}\s*from\s*['"][^'"]*common-utils['"]/;
    const match = content.match(importPattern);
    
    if (match) {
      const existingImports = match[1].split(',').map(s => s.trim());
      const allImports = [...new Set([...existingImports, ...functions])];
      const newImport = `import { ${allImports.join(', ')} } from '${getRelativeImportPath(filePath, COMMON_UTILS_PATH)}'`;
      content = content.replace(importPattern, newImport);
    }
  } else {
    // 添加新的导入语句
    const importPath = getRelativeImportPath(filePath, COMMON_UTILS_PATH);
    const importStatement = `import { ${functions.join(', ')} } from '${importPath}';\n`;
    
    // 在其他import语句之后添加
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const lineEnd = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, lineEnd + 1) + importStatement + content.slice(lineEnd + 1);
    } else {
      // 如果没有import语句，添加到文件开头
      content = importStatement + '\n' + content;
    }
  }
  
  return content;
}

/**
 * 替换formatDate函数
 */
function replaceFormatDate(content, filePath) {
  let replacements = 0;
  let newContent = content;
  
  // 查找本地定义的formatDate函数
  const formatDatePatterns = [
    // 函数声明
    /function\s+formatDate\s*\([^)]*\)\s*\{[^}]+\}/g,
    // const/let/var formatDate = function
    /(const|let|var)\s+formatDate\s*=\s*function\s*\([^)]*\)\s*\{[^}]+\}/g,
    // 箭头函数
    /(const|let|var)\s+formatDate\s*=\s*\([^)]*\)\s*=>\s*\{[^}]+\}/g,
    // export function formatDate
    /export\s+function\s+formatDate\s*\([^)]*\)\s*\{[^}]+\}/g
  ];
  
  let hasLocalFormatDate = false;
  formatDatePatterns.forEach(pattern => {
    if (pattern.test(newContent)) {
      hasLocalFormatDate = true;
      // 删除本地定义
      newContent = newContent.replace(pattern, '');
      replacements++;
      console.log('  ✅ 删除本地formatDate函数定义');
    }
  });
  
  // 如果有本地定义被删除，需要添加导入
  if (hasLocalFormatDate && !hasCommonUtilsImport(newContent)) {
    newContent = addImportStatement(newContent, filePath, ['formatDate']);
    console.log('  ✅ 添加formatDate导入');
  }
  
  return { content: newContent, replacements };
}

/**
 * 替换showToast函数
 */
function replaceShowToast(content, filePath) {
  let replacements = 0;
  let newContent = content;
  
  // 查找本地定义的showToast函数（不是wx.showToast）
  const showToastPattern = /function\s+showToast\s*\([^)]*\)\s*\{[^}]*wx\.showToast[^}]+\}/g;
  const arrowShowToastPattern = /(const|let|var)\s+showToast\s*=\s*\([^)]*\)\s*=>\s*\{[^}]*wx\.showToast[^}]+\}/g;
  
  let hasLocalShowToast = false;
  
  if (showToastPattern.test(newContent)) {
    hasLocalShowToast = true;
    newContent = newContent.replace(showToastPattern, '');
    replacements++;
    console.log('  ✅ 删除本地showToast函数定义');
  }
  
  if (arrowShowToastPattern.test(newContent)) {
    hasLocalShowToast = true;
    newContent = newContent.replace(arrowShowToastPattern, '');
    replacements++;
    console.log('  ✅ 删除本地showToast函数定义');
  }
  
  // 如果有本地定义被删除，需要添加导入
  if (hasLocalShowToast) {
    newContent = addImportStatement(newContent, filePath, ['showToast']);
    console.log('  ✅ 添加showToast导入');
  }
  
  return { content: newContent, replacements };
}

/**
 * 替换isEmpty函数
 */
function replaceIsEmpty(content, filePath) {
  let replacements = 0;
  let newContent = content;
  
  // 查找本地定义的isEmpty函数
  const isEmptyPatterns = [
    /function\s+isEmpty\s*\([^)]*\)\s*\{[^}]+\}/g,
    /(const|let|var)\s+isEmpty\s*=\s*function\s*\([^)]*\)\s*\{[^}]+\}/g,
    /(const|let|var)\s+isEmpty\s*=\s*\([^)]*\)\s*=>\s*\{[^}]+\}/g
  ];
  
  let hasLocalIsEmpty = false;
  isEmptyPatterns.forEach(pattern => {
    if (pattern.test(newContent)) {
      hasLocalIsEmpty = true;
      newContent = newContent.replace(pattern, '');
      replacements++;
      console.log('  ✅ 删除本地isEmpty函数定义');
    }
  });
  
  if (hasLocalIsEmpty) {
    newContent = addImportStatement(newContent, filePath, ['isEmpty']);
    console.log('  ✅ 添加isEmpty导入');
  }
  
  return { content: newContent, replacements };
}

/**
 * 处理单个文件
 */
async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let totalReplacementsInFile = 0;
  
  // 跳过common-utils.ts本身
  if (filePath.includes('common-utils.ts')) {
    return false;
  }
  
  console.log(`\n📄 分析文件: ${path.relative(process.cwd(), filePath)}`);
  
  // 1. 替换formatDate
  const formatDateResult = replaceFormatDate(newContent, filePath);
  newContent = formatDateResult.content;
  totalReplacementsInFile += formatDateResult.replacements;
  
  // 2. 替换showToast
  const showToastResult = replaceShowToast(newContent, filePath);
  newContent = showToastResult.content;
  totalReplacementsInFile += showToastResult.replacements;
  
  // 3. 替换isEmpty
  const isEmptyResult = replaceIsEmpty(newContent, filePath);
  newContent = isEmptyResult.content;
  totalReplacementsInFile += isEmptyResult.replacements;
  
  if (totalReplacementsInFile > 0) {
    // 创建备份
    const backupPath = createBackup(filePath, content);
    console.log(`  📦 备份创建: ${path.relative(BACKUP_DIR, backupPath)}`);
    
    // 写入修改
    fs.writeFileSync(filePath, newContent);
    
    filesFixed++;
    totalReplacements += totalReplacementsInFile;
    console.log(`  ✨ 替换了 ${totalReplacementsInFile} 处重复代码`);
    
    return true;
  } else {
    console.log('  ℹ️ 未发现需要替换的重复代码');
  }
  
  return false;
}

/**
 * 扫描目录
 */
function scanDirectory(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!item.includes('node_modules') && 
          !item.includes('backup') && 
          !item.includes('.git') &&
          !item.includes('dist') &&
          !item.includes('build')) {
        scanDirectory(fullPath, files);
      }
    } else if (item.endsWith('.ts') || item.endsWith('.js')) {
      files.push(fullPath);
    }
  });
  
  return files;
}

/**
 * 回滚功能
 */
function rollback() {
  console.log('\n⏮️ 开始回滚...');
  
  backups.forEach(({ original, backup }) => {
    const content = fs.readFileSync(backup, 'utf8');
    fs.writeFileSync(original, content);
    console.log(`  ✅ 已恢复: ${path.relative(process.cwd(), original)}`);
  });
  
  // 删除备份目录
  fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  console.log('✅ 回滚完成！');
}

/**
 * 主程序
 */
async function main() {
  console.log('🔧 重复代码替换工具');
  console.log('================================\n');
  
  console.log('📋 替换策略：');
  console.log('   1. 删除本地的formatDate、showToast、isEmpty等函数');
  console.log('   2. 添加公共工具模块导入');
  console.log('   3. 保持所有调用不变（函数签名相同）\n');
  
  console.log('⚠️  注意：');
  console.log('   - 只替换与公共模块签名相同的函数');
  console.log('   - 保留特殊实现的本地函数');
  console.log('   - 每个文件都会备份\n');
  
  const answer = await question('是否继续？(y/n): ');
  if (answer.toLowerCase() !== 'y') {
    console.log('❌ 已取消');
    process.exit(0);
  }
  
  // 创建备份目录
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`\n📁 备份目录: ${path.relative(process.cwd(), BACKUP_DIR)}`);
  
  // 扫描miniprogram目录
  const targetDir = path.join(process.cwd(), 'miniprogram');
  const files = scanDirectory(targetDir);
  console.log(`\n🎯 找到 ${files.length} 个文件`);
  
  // 限制处理数量
  const maxFiles = 10;
  let processedCount = 0;
  
  for (const file of files) {
    if (processedCount >= maxFiles) {
      console.log(`\n⚠️ 已达到最大处理数量 ${maxFiles}，停止处理`);
      break;
    }
    
    const fixed = await processFile(file);
    if (fixed) {
      processedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 替换统计：');
  console.log(`   - 修改文件: ${filesFixed} 个`);
  console.log(`   - 替换函数: ${totalReplacements} 处`);
  console.log('='.repeat(50));
  
  if (totalReplacements > 0) {
    console.log('\n⚠️  请测试功能是否正常！');
    console.log('   特别注意：');
    console.log('   - formatDate格式是否正确');
    console.log('   - showToast提示是否正常');
    console.log('   - 数据验证是否工作');
    
    const testAnswer = await question('\n测试通过了吗？(y/n): ');
    
    if (testAnswer.toLowerCase() !== 'y') {
      rollback();
    } else {
      console.log('\n✅ 替换完成！');
      console.log(`💡 提示：备份保存在 ${path.relative(process.cwd(), BACKUP_DIR)}`);
      
      // 生成报告
      const report = {
        timestamp: new Date().toISOString(),
        filesFixed,
        totalReplacements,
        backupDir: path.relative(process.cwd(), BACKUP_DIR),
        files: backups.map(b => ({
          file: path.relative(process.cwd(), b.original),
          backup: path.relative(process.cwd(), b.backup)
        }))
      };
      
      const reportPath = path.join(__dirname, '..', 'docs', `DUPLICATE-REPLACE-REPORT-${new Date().toISOString().slice(0, 10)}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 替换报告: ${path.relative(process.cwd(), reportPath)}`);
    }
  } else {
    console.log('\n✅ 没有发现需要替换的重复代码');
    // 清理备份目录
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
  
  rl.close();
}

// 运行主程序
main().catch(err => {
  console.error('❌ 错误:', err);
  rl.close();
  process.exit(1);
});
