#!/usr/bin/env node

/**
 * 安全修复Any类型 - 第二批
 * 1. 修复catch块错误（3处）
 * 2. 修复数组类型（3处）
 * 3. 部分函数参数优化
 * 
 * 特点：
 * - 自动备份
 * - 可回滚
 * - 用户确认
 * - 详细日志
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
const BACKUP_DIR = path.join(__dirname, '..', 'backups', `any-fix-batch2-${Date.now()}`);

// 统计
let filesFixed = 0;
let totalFixes = 0;
let backups = [];

/**
 * 创建备份
 */
function createBackup(filePath, content) {
  const relativePath = path.relative(process.cwd(), filePath);
  const backupPath = path.join(BACKUP_DIR, relativePath);
  const backupDir = path.dirname(backupPath);
  
  // 创建备份目录
  fs.mkdirSync(backupDir, { recursive: true });
  
  // 写入备份文件
  fs.writeFileSync(backupPath, content);
  backups.push({ original: filePath, backup: backupPath });
  
  return backupPath;
}

/**
 * 修复catch块中的any类型
 */
function fixCatchBlockAny(content, filePath) {
  let fixes = 0;
  let newContent = content;
  
  // 模式1: } catch (error: any) {
  const catchPattern1 = /\}\s*catch\s*\(\s*(\w+)\s*:\s*any\s*\)\s*\{/g;
  newContent = newContent.replace(catchPattern1, (match, varName) => {
    fixes++;
    console.log(`  ✅ 修复catch块: ${varName}: any → unknown`);
    return `} catch (${varName}: unknown) {`;
  });
  
  // 模式2: } catch (error: any) { (缩进版本)
  const catchPattern2 = /catch\s*\(\s*(\w+)\s*:\s*any\s*\)/g;
  newContent = newContent.replace(catchPattern2, (match, varName) => {
    fixes++;
    console.log(`  ✅ 修复catch块: ${varName}: any → unknown`);
    return `catch (${varName}: unknown)`;
  });
  
  return { content: newContent, fixes };
}

/**
 * 修复数组类型中的any
 */
function fixArrayTypeAny(content, filePath) {
  let fixes = 0;
  let newContent = content;
  
  // 模式1: any[] 作为变量类型
  const arrayPattern1 = /(\w+)\s*:\s*any\[\]/g;
  newContent = newContent.replace(arrayPattern1, (match, varName) => {
    // 根据变量名推断类型
    if (varName.includes('error') || varName.includes('Error')) {
      fixes++;
      console.log(`  ✅ 修复数组类型: ${varName}: any[] → Error[]`);
      return `${varName}: Error[]`;
    } else if (varName.includes('data') || varName.includes('result')) {
      fixes++;
      console.log(`  ✅ 修复数组类型: ${varName}: any[] → unknown[]`);
      return `${varName}: unknown[]`;
    } else {
      fixes++;
      console.log(`  ✅ 修复数组类型: ${varName}: any[] → unknown[]`);
      return `${varName}: unknown[]`;
    }
  });
  
  // 模式2: Array<any>
  const arrayPattern2 = /Array<any>/g;
  newContent = newContent.replace(arrayPattern2, (match) => {
    fixes++;
    console.log(`  ✅ 修复数组类型: Array<any> → Array<unknown>`);
    return 'Array<unknown>';
  });
  
  return { content: newContent, fixes };
}

/**
 * 修复特定的函数参数any（安全的部分）
 */
function fixSafeFunctionParams(content, filePath) {
  let fixes = 0;
  let newContent = content;
  
  // handleError函数的error参数
  const errorHandlerPattern = /function\s+handleError\s*\(\s*error\s*:\s*any/g;
  newContent = newContent.replace(errorHandlerPattern, (match) => {
    fixes++;
    console.log(`  ✅ 修复handleError参数: error: any → unknown`);
    return 'function handleError(error: unknown';
  });
  
  // export function handleError的情况
  const exportErrorHandlerPattern = /export\s+function\s+handleError\s*\(\s*error\s*:\s*any/g;
  newContent = newContent.replace(exportErrorHandlerPattern, (match) => {
    fixes++;
    console.log(`  ✅ 修复handleError参数: error: any → unknown`);
    return 'export function handleError(error: unknown';
  });
  
  return { content: newContent, fixes };
}

/**
 * 处理单个文件
 */
async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let totalFixesInFile = 0;
  
  console.log(`\n📄 处理文件: ${path.relative(process.cwd(), filePath)}`);
  
  // 1. 修复catch块
  const catchResult = fixCatchBlockAny(newContent, filePath);
  newContent = catchResult.content;
  totalFixesInFile += catchResult.fixes;
  
  // 2. 修复数组类型
  const arrayResult = fixArrayTypeAny(newContent, filePath);
  newContent = arrayResult.content;
  totalFixesInFile += arrayResult.fixes;
  
  // 3. 修复安全的函数参数
  const paramResult = fixSafeFunctionParams(newContent, filePath);
  newContent = paramResult.content;
  totalFixesInFile += paramResult.fixes;
  
  if (totalFixesInFile > 0) {
    // 创建备份
    const backupPath = createBackup(filePath, content);
    console.log(`  📦 备份创建: ${path.relative(BACKUP_DIR, backupPath)}`);
    
    // 写入修改
    fs.writeFileSync(filePath, newContent);
    
    filesFixed++;
    totalFixes += totalFixesInFile;
    console.log(`  ✨ 修复了 ${totalFixesInFile} 处any类型`);
    
    return true;
  }
  
  return false;
}

/**
 * 扫描需要处理的文件
 */
function findTargetFiles() {
  const files = [];
  
  // 目标文件（根据分析报告）
  const targetFiles = [
    'miniprogram/pages/health/modules/health-monitoring-module.ts',
    'miniprogram/utils/common-utils.ts',
    'miniprogram/pages/index/index.ts',
    'miniprogram/utils/page-transition.ts',
    'miniprogram/pages/health/modules/health-prevention-module.ts'
  ];
  
  targetFiles.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
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
  console.log('🔧 Any类型安全修复工具 - 第二批');
  console.log('================================\n');
  
  console.log('📋 修复内容：');
  console.log('   1. catch块中的any类型 → unknown');
  console.log('   2. 数组类型any[] → unknown[]');
  console.log('   3. handleError参数 → unknown\n');
  
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
  console.log(`\n🎯 找到 ${files.length} 个目标文件`);
  
  // 处理文件
  for (const file of files) {
    await processFile(file);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 修复统计：');
  console.log(`   - 修复文件: ${filesFixed} 个`);
  console.log(`   - 修复any: ${totalFixes} 处`);
  console.log('='.repeat(50));
  
  if (totalFixes > 0) {
    console.log('\n⚠️  请测试功能是否正常！');
    const testAnswer = await question('\n测试通过了吗？(y/n): ');
    
    if (testAnswer.toLowerCase() !== 'y') {
      rollback();
    } else {
      console.log('\n✅ 修复完成！');
      console.log(`💡 提示：备份保存在 ${path.relative(process.cwd(), BACKUP_DIR)}`);
    }
  } else {
    console.log('\n✅ 没有需要修复的内容');
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
