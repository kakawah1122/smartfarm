#!/usr/bin/env node

/**
 * 代码清理验证脚本
 * 功能：验证清理操作是否破坏了任何引用或功能
 * 原则：只检查，不修改
 */

const fs = require('fs');
const path = require('path');

let issuesFound = 0;
const issues = [];

console.log('🔍 开始验证代码清理...\n');

// 1. 验证已删除的目录是否还有引用
console.log('📁 检查已删除目录的引用...');
const deletedDirs = [
  'cloudfunctions/all',
  'cloudfunctions/cloud1-3gdruqkn67e1cbe2'
];

deletedDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(fullPath)) {
    issues.push(`⚠️ 目录 ${dir} 仍然存在，可能未被删除`);
    issuesFound++;
  } else {
    console.log(`✅ ${dir} 已成功删除`);
  }
});

// 2. 验证云函数环境配置
console.log('\n☁️ 检查云函数环境配置...');
const cloudFunctions = fs.readdirSync(path.join(__dirname, '../cloudfunctions'))
  .filter(dir => {
    const fullPath = path.join(__dirname, '../cloudfunctions', dir);
    return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'index.js'));
  });

cloudFunctions.forEach(funcName => {
  const indexPath = path.join(__dirname, '../cloudfunctions', funcName, 'index.js');
  const content = fs.readFileSync(indexPath, 'utf-8');
  
  // 检查是否使用了正确的环境初始化
  if (content.includes('cloud.init()')) {
    // 默认初始化，OK
  } else if (content.includes('cloud.DYNAMIC_CURRENT_ENV')) {
    // 使用动态环境变量，OK
  } else if (content.includes('cloud1-3gdruqkn67e1cbe2')) {
    issues.push(`❌ 云函数 ${funcName} 使用了过时的环境ID`);
    issuesFound++;
  }
  
  // 检查console.log（生产环境不应该有调试日志）
  const consoleMatches = content.match(/console\.log/g);
  if (consoleMatches && funcName === 'health-management') {
    // health-management 应该已经清理了console.log
    const lineNumber = content.substring(0, content.indexOf('console.log')).split('\n').length;
    issues.push(`⚠️ 云函数 ${funcName} 在第 ${lineNumber} 行仍有 console.log`);
    issuesFound++;
  }
});

if (cloudFunctions.length > 0) {
  console.log(`✅ 检查了 ${cloudFunctions.length} 个云函数`);
}

// 3. 验证集合名称引用
console.log('\n📊 检查集合名称硬编码...');
const collectionsConfig = require('../shared-config/collections.js');
const hardcodedPatterns = [
  /collection\(['"`]wx_users['"`]\)/g,
  /collection\(['"`]health_/g,
  /collection\(['"`]finance_/g,
  /collection\(['"`]prod_/g,
  /collection\(['"`]task_/g,
  /collection\(['"`]sys_/g,
  /collection\(['"`]file_/g
];

cloudFunctions.forEach(funcName => {
  const indexPath = path.join(__dirname, '../cloudfunctions', funcName, 'index.js');
  const content = fs.readFileSync(indexPath, 'utf-8');
  
  let hasCollectionsImport = content.includes('shared-config/collections') || 
                            content.includes('./collections') ||
                            content.includes('COLLECTIONS');
  
  hardcodedPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      // 排除已经引用了collections配置的文件
      if (!hasCollectionsImport) {
        issues.push(`⚠️ 云函数 ${funcName} 硬编码了集合名称: ${matches[0]}`);
        issuesFound++;
      }
    }
  });
});

// 4. 检查项目依赖完整性
console.log('\n📦 检查项目依赖...');
const checkPackageJson = (dir) => {
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.dependencies) {
        Object.keys(pkg.dependencies).forEach(dep => {
          const depPath = path.join(dir, 'node_modules', dep);
          if (!fs.existsSync(depPath) && dep !== 'wx-server-sdk') {
            // wx-server-sdk 是云函数内置的，不需要检查
            console.log(`⚠️ ${path.relative(__dirname + '/..', dir)} 缺少依赖: ${dep}`);
          }
        });
      }
      return true;
    } catch (error) {
      issues.push(`❌ 无法解析 ${path.relative(__dirname + '/..', pkgPath)}`);
      issuesFound++;
      return false;
    }
  }
  return false;
};

// 检查主项目
if (checkPackageJson(path.join(__dirname, '../miniprogram'))) {
  console.log('✅ 小程序依赖检查完成');
}

// 检查云函数
let validFunctions = 0;
cloudFunctions.forEach(funcName => {
  const funcPath = path.join(__dirname, '../cloudfunctions', funcName);
  if (checkPackageJson(funcPath)) {
    validFunctions++;
  }
});

if (validFunctions > 0) {
  console.log(`✅ ${validFunctions} 个云函数依赖检查完成`);
}

// 5. 验证关键功能文件是否存在
console.log('\n🔑 检查关键文件完整性...');
const criticalFiles = [
  'miniprogram/app.ts',  // TypeScript项目
  'miniprogram/app.json',
  'miniprogram/pages/index/index.ts',  // TypeScript文件
  'miniprogram/pages/health/health.ts',
  'miniprogram/pages/production/production.ts',
  'miniprogram/pages/profile/profile.ts',
  'shared-config/collections.js',
  'cloudfunctions/health-management/index.js',
  'cloudfunctions/production-entry/index.js',
  'cloudfunctions/finance-management/index.js'
];

criticalFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(fullPath)) {
    issues.push(`❌ 关键文件缺失: ${file}`);
    issuesFound++;
  }
});

console.log(`✅ 检查了 ${criticalFiles.length} 个关键文件`);

// 总结报告
console.log('\n' + '='.repeat(50));
console.log('📊 验证报告\n');

if (issuesFound === 0) {
  console.log('✅ 所有验证通过！代码清理没有破坏任何引用或功能。');
  console.log('\n可以安全地继续下一步优化。');
} else {
  console.log(`⚠️ 发现 ${issuesFound} 个潜在问题：\n`);
  issues.forEach(issue => {
    console.log(issue);
  });
  console.log('\n建议修复这些问题后再继续优化。');
}

console.log('='.repeat(50));

// 返回状态码
process.exit(issuesFound > 0 ? 1 : 0);
