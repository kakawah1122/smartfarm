#!/usr/bin/env node

/**
 * 安全修复函数参数中的any类型 - 第一批
 * 处理高频参数名
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
const BACKUP_DIR = path.join(__dirname, '..', 'backups', `params-fix-batch1-${Date.now()}`);

// 统计
let filesFixed = 0;
let totalFixes = 0;
let backups = [];

// 参数类型映射
const PARAM_TYPE_MAP = {
  // 高频参数
  'task': 'Record<string, unknown>',
  'page': 'Record<string, unknown>',
  'pageInstance': 'Record<string, unknown>',
  'data': 'unknown',
  'material': 'Record<string, unknown>',
  'batch': 'Record<string, unknown>',
  'batchData': 'Record<string, unknown>',
  
  // 事件相关
  'e': 'WechatMiniprogram.CustomEvent | unknown',
  'event': 'WechatMiniprogram.CustomEvent | unknown',
  
  // 错误相关
  'error': 'unknown',
  'err': 'unknown',
  
  // 回调相关
  'callback': '(...args: unknown[]) => unknown',
  'cb': '(...args: unknown[]) => unknown',
  
  // 通用
  'options': 'Record<string, unknown>',
  'config': 'Record<string, unknown>',
  'params': 'Record<string, unknown>',
  'context': 'unknown',
  'ctx': 'unknown',
  'value': 'unknown',
  'val': 'unknown',
  'item': 'unknown',
  'result': 'unknown',
  'res': 'unknown',
  
  // 数组相关
  'args': 'unknown[]',
  'items': 'unknown[]',
  'list': 'unknown[]',
  'arr': 'unknown[]',
  
  // 索引
  'index': 'number',
  'i': 'number',
  'idx': 'number'
};

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
 * 修复函数参数中的any类型
 */
function fixFunctionParamsAny(content, filePath) {
  let fixes = 0;
  let newContent = content;
  const fixLog = [];
  
  // 遍历参数映射
  for (const [paramName, newType] of Object.entries(PARAM_TYPE_MAP)) {
    // 创建精确匹配的正则表达式
    // 模式1: (paramName: any)
    const pattern1 = new RegExp(`\\(\\s*${paramName}\\s*:\\s*any\\s*\\)`, 'g');
    // 模式2: (paramName: any,
    const pattern2 = new RegExp(`\\(\\s*${paramName}\\s*:\\s*any\\s*,`, 'g');
    // 模式3: , paramName: any)
    const pattern3 = new RegExp(`,\\s*${paramName}\\s*:\\s*any\\s*\\)`, 'g');
    // 模式4: , paramName: any,
    const pattern4 = new RegExp(`,\\s*${paramName}\\s*:\\s*any\\s*,`, 'g');
    
    // 应用替换
    const patterns = [
      { pattern: pattern1, replacement: `(${paramName}: ${newType})` },
      { pattern: pattern2, replacement: `(${paramName}: ${newType},` },
      { pattern: pattern3, replacement: `, ${paramName}: ${newType})` },
      { pattern: pattern4, replacement: `, ${paramName}: ${newType},` }
    ];
    
    patterns.forEach(({ pattern, replacement }) => {
      const matches = newContent.match(pattern);
      if (matches) {
        const count = matches.length;
        newContent = newContent.replace(pattern, replacement);
        fixes += count;
        fixLog.push(`  ✅ 修复 ${count} 处 ${paramName}: any → ${newType}`);
      }
    });
  }
  
  // 输出修复日志
  if (fixLog.length > 0) {
    fixLog.forEach(log => console.log(log));
  }
  
  return { content: newContent, fixes };
}

/**
 * 处理单个文件
 */
async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 检查是否有any类型
  if (!content.includes(': any')) {
    return false;
  }
  
  console.log(`\n📄 处理文件: ${path.relative(process.cwd(), filePath)}`);
  
  // 修复函数参数
  const result = fixFunctionParamsAny(content, filePath);
  
  if (result.fixes > 0) {
    // 创建备份
    const backupPath = createBackup(filePath, content);
    console.log(`  📦 备份创建: ${path.relative(BACKUP_DIR, backupPath)}`);
    
    // 写入修改
    fs.writeFileSync(filePath, result.content);
    
    filesFixed++;
    totalFixes += result.fixes;
    console.log(`  ✨ 修复了 ${result.fixes} 处any类型`);
    
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
      // 跳过不需要的目录
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
  console.log('🔧 函数参数any类型批量修复工具');
  console.log('================================\n');
  
  console.log('📋 修复策略：');
  console.log('   - task/page/pageInstance → Record<string, unknown>');
  console.log('   - event/e → WechatMiniprogram.CustomEvent | unknown');
  console.log('   - error/err → unknown');
  console.log('   - data/result/value → unknown');
  console.log('   - 其他根据语义推断\n');
  
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
  
  // 批量处理（限制数量避免过多修改）
  const maxFiles = 20;
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
      
      // 生成修复报告
      const report = {
        timestamp: new Date().toISOString(),
        filesFixed,
        totalFixes,
        backupDir: path.relative(process.cwd(), BACKUP_DIR),
        files: backups.map(b => path.relative(process.cwd(), b.original))
      };
      
      const reportPath = path.join(__dirname, '..', 'docs', `PARAMS-FIX-REPORT-${new Date().toISOString().slice(0, 10)}.json`);
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
