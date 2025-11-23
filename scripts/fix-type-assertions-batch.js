#!/usr/bin/env node

/**
 * 安全修复类型断言和变量声明中的any类型
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
const BACKUP_DIR = path.join(__dirname, '..', 'backups', `type-assertions-fix-${Date.now()}`);

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
  
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupPath, content);
  backups.push({ original: filePath, backup: backupPath });
  
  return backupPath;
}

/**
 * 修复as any类型断言
 */
function fixTypeAssertions(content, filePath) {
  let fixes = 0;
  let newContent = content;
  
  // 模式1: as any
  const asAnyPattern = /\s+as\s+any/g;
  const matches = newContent.match(asAnyPattern);
  
  if (matches) {
    // 替换为 as unknown
    newContent = newContent.replace(asAnyPattern, ' as unknown');
    fixes = matches.length;
    console.log(`  ✅ 修复 ${fixes} 处 'as any' → 'as unknown'`);
  }
  
  // 模式2: <any>
  const angleAnyPattern = /<any>/g;
  const angleMatches = newContent.match(angleAnyPattern);
  
  if (angleMatches) {
    newContent = newContent.replace(angleAnyPattern, '<unknown>');
    fixes += angleMatches.length;
    console.log(`  ✅ 修复 ${angleMatches.length} 处 '<any>' → '<unknown>'`);
  }
  
  return { content: newContent, fixes };
}

/**
 * 修复变量声明中的any
 */
function fixVariableDeclarations(content, filePath) {
  let fixes = 0;
  let newContent = content;
  
  // 模式1: let/const/var xxx: any = 
  const varDeclPattern = /(let|const|var)\s+(\w+)\s*:\s*any\s*=/g;
  newContent = newContent.replace(varDeclPattern, (match, keyword, varName) => {
    fixes++;
    console.log(`  ✅ 修复变量声明: ${varName}: any → unknown`);
    return `${keyword} ${varName}: unknown =`;
  });
  
  // 模式2: let/const/var xxx: any;
  const varDeclPattern2 = /(let|const|var)\s+(\w+)\s*:\s*any\s*;/g;
  newContent = newContent.replace(varDeclPattern2, (match, keyword, varName) => {
    fixes++;
    console.log(`  ✅ 修复变量声明: ${varName}: any → unknown`);
    return `${keyword} ${varName}: unknown;`;
  });
  
  // 模式3: : any = {} 或 : any = []
  const initPattern = /:\s*any\s*=\s*(\{|\[)/g;
  newContent = newContent.replace(initPattern, (match, bracket) => {
    fixes++;
    if (bracket === '{') {
      console.log(`  ✅ 修复对象初始化: any → Record<string, unknown>`);
      return `: Record<string, unknown> = ${bracket}`;
    } else {
      console.log(`  ✅ 修复数组初始化: any → unknown[]`);
      return `: unknown[] = ${bracket}`;
    }
  });
  
  return { content: newContent, fixes };
}

/**
 * 修复函数返回值中的any
 */
function fixReturnTypes(content, filePath) {
  let fixes = 0;
  let newContent = content;
  
  // 模式1: ): any {
  const returnPattern1 = /\)\s*:\s*any\s*\{/g;
  newContent = newContent.replace(returnPattern1, (match) => {
    fixes++;
    console.log(`  ✅ 修复函数返回值: any → unknown`);
    return '): unknown {';
  });
  
  // 模式2: ): Promise<any>
  const promisePattern = /\)\s*:\s*Promise<any>/g;
  newContent = newContent.replace(promisePattern, (match) => {
    fixes++;
    console.log(`  ✅ 修复Promise返回值: Promise<any> → Promise<unknown>`);
    return '): Promise<unknown>';
  });
  
  // 模式3: => any
  const arrowReturnPattern = /=>\s*any/g;
  newContent = newContent.replace(arrowReturnPattern, (match) => {
    fixes++;
    console.log(`  ✅ 修复箭头函数返回值: any → unknown`);
    return '=> unknown';
  });
  
  return { content: newContent, fixes };
}

/**
 * 处理单个文件
 */
async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 检查是否有any类型
  if (!content.includes(' any') && !content.includes('<any>')) {
    return false;
  }
  
  console.log(`\n📄 处理文件: ${path.relative(process.cwd(), filePath)}`);
  
  let newContent = content;
  let totalFixesInFile = 0;
  
  // 1. 修复类型断言
  const assertionResult = fixTypeAssertions(newContent, filePath);
  newContent = assertionResult.content;
  totalFixesInFile += assertionResult.fixes;
  
  // 2. 修复变量声明
  const varResult = fixVariableDeclarations(newContent, filePath);
  newContent = varResult.content;
  totalFixesInFile += varResult.fixes;
  
  // 3. 修复返回值类型
  const returnResult = fixReturnTypes(newContent, filePath);
  newContent = returnResult.content;
  totalFixesInFile += returnResult.fixes;
  
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
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
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
  console.log('🔧 类型断言和变量声明any类型修复工具');
  console.log('================================\n');
  
  console.log('📋 修复策略：');
  console.log('   1. as any → as unknown');
  console.log('   2. <any> → <unknown>');
  console.log('   3. 变量: any → unknown');
  console.log('   4. 函数返回值: any → unknown');
  console.log('   5. Promise<any> → Promise<unknown>\n');
  
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
  console.log(`\n🎯 找到 ${files.length} 个TypeScript文件`);
  
  // 批量处理（限制数量）
  const maxFiles = 15;
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
      
      // 生成报告
      const report = {
        timestamp: new Date().toISOString(),
        filesFixed,
        totalFixes,
        backupDir: path.relative(process.cwd(), BACKUP_DIR),
        files: backups.map(b => path.relative(process.cwd(), b.original))
      };
      
      const reportPath = path.join(__dirname, '..', 'docs', `TYPE-ASSERTIONS-FIX-REPORT-${new Date().toISOString().slice(0, 10)}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 修复报告: ${path.relative(process.cwd(), reportPath)}`);
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
