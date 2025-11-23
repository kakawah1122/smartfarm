#!/usr/bin/env node

/**
 * 智能重构重复代码
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
const BACKUP_DIR = path.join(__dirname, '..', 'backups', `smart-refactor-${Date.now()}`);

// 统计
let filesFixed = 0;
let totalRefactors = 0;
let backups = [];

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
 * 提取公共的formatDate实现到utils
 */
function ensureCommonFormatDate() {
  const utilsPath = path.join(process.cwd(), 'miniprogram/utils/common-utils.ts');
  let content = fs.readFileSync(utilsPath, 'utf8');
  
  // 检查是否已经有formatDate
  if (!content.includes('export function formatDate')) {
    console.log('⚠️ common-utils.ts中没有formatDate函数，需要先添加');
    return false;
  }
  
  return true;
}

/**
 * 移除重复的本地formatDate定义
 */
function removeLocalFormatDate(content, filePath) {
  let newContent = content;
  let removed = false;
  
  // 多种formatDate定义模式
  const patterns = [
    // function formatDate
    /\/\/?\s*格式化日期[\s\S]*?function\s+formatDate\s*\([^)]*\)\s*\{[\s\S]*?\n\}/gm,
    // const formatDate = function
    /const\s+formatDate\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]*?\n\}/gm,
    // const formatDate = () =>
    /const\s+formatDate\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\}/gm,
    // export function formatDate (但不是在common-utils中)
    /export\s+function\s+formatDate\s*\([^)]*\)\s*\{[\s\S]*?\n\}/gm
  ];
  
  if (filePath.includes('common-utils')) {
    return { content, removed: false };
  }
  
  patterns.forEach(pattern => {
    if (pattern.test(newContent)) {
      newContent = newContent.replace(pattern, '');
      removed = true;
      console.log('  ✅ 移除本地formatDate函数');
    }
  });
  
  return { content: newContent, removed };
}

/**
 * 添加common-utils导入
 */
function addCommonUtilsImport(content, filePath, functions) {
  // 计算相对路径
  const fromDir = path.dirname(filePath);
  const toPath = path.join(process.cwd(), 'miniprogram/utils/common-utils');
  let relativePath = path.relative(fromDir, toPath);
  
  // 确保路径格式正确
  relativePath = relativePath.replace(/\\/g, '/');
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  relativePath = relativePath.replace(/\.ts$/, '');
  
  // 检查是否已经有导入
  const importRegex = /import\s*\{[^}]*\}\s*from\s*['"][^'"]*common-utils['"]/;
  const existingImport = content.match(importRegex);
  
  if (existingImport) {
    // 更新现有导入
    const currentFunctions = existingImport[0].match(/\{([^}]*)\}/)[1]
      .split(',').map(s => s.trim()).filter(s => s);
    
    const allFunctions = [...new Set([...currentFunctions, ...functions])];
    const newImport = `import { ${allFunctions.join(', ')} } from '${relativePath}'`;
    
    content = content.replace(importRegex, newImport);
    console.log('  ✅ 更新common-utils导入');
  } else {
    // 添加新导入
    const importStatement = `import { ${functions.join(', ')} } from '${relativePath}';\n`;
    
    // 在文件开头或其他import后添加
    const firstImportIndex = content.search(/import\s/);
    if (firstImportIndex !== -1) {
      // 找到最后一个import语句
      const importMatches = [...content.matchAll(/import[^;]+;/g)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertPos = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertPos) + '\n' + importStatement + content.slice(insertPos);
      }
    } else {
      // 在文件开头添加
      content = importStatement + '\n' + content;
    }
    console.log('  ✅ 添加common-utils导入');
  }
  
  return content;
}

/**
 * 移除重复的showToast定义
 */
function removeLocalShowToast(content, filePath) {
  let newContent = content;
  let removed = false;
  
  // 只移除包装wx.showToast的本地函数
  const patterns = [
    // function showToast包装wx.showToast
    /function\s+showToast\s*\([^)]*\)\s*\{[^}]*wx\.showToast[^}]*\}/gm,
    // const showToast = 包装wx.showToast
    /const\s+showToast\s*=\s*\([^)]*\)\s*=>\s*\{[^}]*wx\.showToast[^}]*\}/gm
  ];
  
  if (filePath.includes('common-utils')) {
    return { content, removed: false };
  }
  
  patterns.forEach(pattern => {
    if (pattern.test(newContent)) {
      newContent = newContent.replace(pattern, '');
      removed = true;
      console.log('  ✅ 移除本地showToast函数');
    }
  });
  
  return { content: newContent, removed };
}

/**
 * 处理单个文件
 */
async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let hasChanges = false;
  const functionsToImport = [];
  
  // 跳过common-utils本身
  if (filePath.includes('common-utils.ts')) {
    return false;
  }
  
  console.log(`\n📄 分析文件: ${path.relative(process.cwd(), filePath)}`);
  
  // 1. 处理formatDate
  const formatDateResult = removeLocalFormatDate(newContent, filePath);
  if (formatDateResult.removed) {
    newContent = formatDateResult.content;
    functionsToImport.push('formatDate');
    hasChanges = true;
  }
  
  // 2. 处理showToast
  const showToastResult = removeLocalShowToast(newContent, filePath);
  if (showToastResult.removed) {
    newContent = showToastResult.content;
    functionsToImport.push('showToast');
    hasChanges = true;
  }
  
  // 3. 如果有需要导入的函数，添加导入语句
  if (functionsToImport.length > 0) {
    newContent = addCommonUtilsImport(newContent, filePath, functionsToImport);
  }
  
  if (hasChanges) {
    // 创建备份
    const backupPath = createBackup(filePath, content);
    console.log(`  📦 备份创建: ${path.relative(BACKUP_DIR, backupPath)}`);
    
    // 写入修改
    fs.writeFileSync(filePath, newContent);
    
    filesFixed++;
    totalRefactors += functionsToImport.length;
    console.log(`  ✨ 重构了 ${functionsToImport.length} 个重复函数`);
    
    return true;
  } else {
    console.log('  ℹ️ 未发现需要重构的代码');
  }
  
  return false;
}

/**
 * 扫描需要处理的文件
 */
function findTargetFiles() {
  const targetDir = path.join(process.cwd(), 'miniprogram');
  const files = [];
  
  function scan(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!item.includes('node_modules') && 
            !item.includes('backup') && 
            !item.includes('.git')) {
          scan(fullPath);
        }
      } else if (item.endsWith('.ts')) {
        files.push(fullPath);
      }
    });
  }
  
  scan(targetDir);
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
  console.log('🔧 智能重构重复代码工具');
  console.log('================================\n');
  
  console.log('📋 重构策略：');
  console.log('   1. 移除本地的formatDate定义');
  console.log('   2. 移除本地的showToast包装');
  console.log('   3. 自动添加common-utils导入');
  console.log('   4. 保持函数调用不变\n');
  
  console.log('⚠️  安全措施：');
  console.log('   - 只处理明确的重复函数');
  console.log('   - 每个文件都备份');
  console.log('   - 可随时回滚\n');
  
  // 首先确认common-utils中有需要的函数
  if (!ensureCommonFormatDate()) {
    console.log('❌ 请先确保common-utils.ts中有必要的公共函数');
    process.exit(1);
  }
  
  const answer = await question('是否继续？(y/n): ');
  if (answer.toLowerCase() !== 'y') {
    console.log('❌ 已取消');
    process.exit(0);
  }
  
  // 创建备份目录
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`\n📁 备份目录: ${path.relative(process.cwd(), BACKUP_DIR)}`);
  
  // 查找目标文件
  const files = findTargetFiles();
  console.log(`\n🎯 找到 ${files.length} 个文件待分析`);
  
  // 限制处理数量
  const maxFiles = 10;
  let processedCount = 0;
  
  for (const file of files) {
    if (processedCount >= maxFiles) {
      console.log(`\n⚠️ 已达到最大处理数量 ${maxFiles}，停止处理`);
      break;
    }
    
    // 只处理可能有重复的文件
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('function formatDate') || 
        content.includes('function showToast')) {
      const fixed = await processFile(file);
      if (fixed) {
        processedCount++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 重构统计：');
  console.log(`   - 修改文件: ${filesFixed} 个`);
  console.log(`   - 重构函数: ${totalRefactors} 个`);
  console.log('='.repeat(50));
  
  if (totalRefactors > 0) {
    console.log('\n⚠️  请测试功能是否正常！');
    console.log('   特别注意：');
    console.log('   - 日期格式化是否正确');
    console.log('   - Toast提示是否正常');
    console.log('   - 导入路径是否正确');
    
    const testAnswer = await question('\n测试通过了吗？(y/n): ');
    
    if (testAnswer.toLowerCase() !== 'y') {
      rollback();
    } else {
      console.log('\n✅ 重构完成！');
      console.log(`💡 提示：备份保存在 ${path.relative(process.cwd(), BACKUP_DIR)}`);
      
      // 生成报告
      const report = {
        timestamp: new Date().toISOString(),
        filesFixed,
        totalRefactors,
        backupDir: path.relative(process.cwd(), BACKUP_DIR),
        files: backups.map(b => ({
          file: path.relative(process.cwd(), b.original),
          backup: path.relative(process.cwd(), b.backup)
        }))
      };
      
      const reportPath = path.join(__dirname, '..', 'docs', `SMART-REFACTOR-REPORT-${new Date().toISOString().slice(0, 10)}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 重构报告: ${path.relative(process.cwd(), reportPath)}`);
    }
  } else {
    console.log('\n✅ 没有发现需要重构的代码');
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
