/**
 * 清理空的云函数目录
 * 删除没有实际代码文件的云函数目录
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.bright}${colors.cyan}========================================`);
console.log(`  🧹 清理空的云函数目录`);
console.log(`========================================${colors.reset}\n`);

const cloudfunctionsDir = path.join(__dirname, '..', 'cloudfunctions');

// 获取所有云函数目录
const cloudFunctions = fs.readdirSync(cloudfunctionsDir)
  .filter(item => {
    const itemPath = path.join(cloudfunctionsDir, item);
    return fs.statSync(itemPath).isDirectory();
  });

console.log(`${colors.blue}📦 扫描云函数目录...${colors.reset}`);
console.log(`发现 ${cloudFunctions.length} 个云函数目录\n`);

const emptyDirs = [];
const validFunctions = [];

// 检查每个云函数目录
cloudFunctions.forEach(funcName => {
  const funcPath = path.join(cloudfunctionsDir, funcName);
  const files = fs.readdirSync(funcPath);
  
  // 检查是否有必需的文件
  const hasIndexJs = files.includes('index.js');
  const hasPackageJson = files.includes('package.json');
  
  // 过滤掉 node_modules 和 .git 等目录
  const actualFiles = files.filter(file => {
    return !['node_modules', '.git', '.DS_Store'].includes(file);
  });
  
  if (!hasIndexJs || !hasPackageJson) {
    // 缺少必需文件
    emptyDirs.push({
      name: funcName,
      reason: !hasIndexJs ? '缺少 index.js' : '缺少 package.json',
      files: actualFiles
    });
  } else {
    validFunctions.push(funcName);
  }
});

// 显示结果
console.log(`${colors.green}✅ 有效的云函数 (${validFunctions.length}个)：${colors.reset}`);
validFunctions.forEach(func => {
  console.log(`  - ${func}`);
});

if (emptyDirs.length > 0) {
  console.log(`\n${colors.yellow}⚠️ 空的或无效的云函数目录 (${emptyDirs.length}个)：${colors.reset}`);
  emptyDirs.forEach(dir => {
    console.log(`  ${colors.red}- ${dir.name}${colors.reset}`);
    console.log(`    原因：${dir.reason}`);
    if (dir.files.length > 0) {
      console.log(`    包含文件：${dir.files.join(', ')}`);
    }
  });
  
  // 询问是否删除
  console.log(`\n${colors.yellow}这些目录将被删除：${colors.reset}`);
  emptyDirs.forEach(dir => {
    const dirPath = path.join(cloudfunctionsDir, dir.name);
    console.log(`  ${colors.red}删除：${dirPath}${colors.reset}`);
    
    // 执行删除
    try {
      // 递归删除目录
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`  ${colors.green}✅ 已删除${colors.reset}`);
    } catch (error) {
      console.log(`  ${colors.red}❌ 删除失败：${error.message}${colors.reset}`);
    }
  });
  
  console.log(`\n${colors.green}🎉 清理完成！删除了 ${emptyDirs.length} 个空目录${colors.reset}`);
} else {
  console.log(`\n${colors.green}✨ 所有云函数目录都是有效的，无需清理！${colors.reset}`);
}

// 显示最终统计
console.log(`\n${colors.bright}${colors.cyan}========================================`);
console.log(`  📊 最终统计`);
console.log(`========================================${colors.reset}`);
console.log(`${colors.bright}云函数总数：${validFunctions.length}${colors.reset}`);
console.log(`${colors.bright}已清理：${emptyDirs.length}${colors.reset}`);

// 显示云函数分类
console.log(`\n${colors.cyan}📋 云函数分类：${colors.reset}`);
const categories = {
  '健康管理': validFunctions.filter(f => f.startsWith('health-')),
  '生产管理': validFunctions.filter(f => f.startsWith('production-') || f.startsWith('prod-')),
  '用户管理': validFunctions.filter(f => f.startsWith('user-') || f === 'login' || f === 'register'),
  '财务管理': validFunctions.filter(f => f.startsWith('finance-')),
  'AI功能': validFunctions.filter(f => f.startsWith('ai-')),
  '其他功能': validFunctions.filter(f => 
    !f.startsWith('health-') && 
    !f.startsWith('production-') && 
    !f.startsWith('prod-') &&
    !f.startsWith('user-') && 
    !f.startsWith('finance-') && 
    !f.startsWith('ai-') &&
    f !== 'login' && 
    f !== 'register'
  )
};

Object.entries(categories).forEach(([category, funcs]) => {
  if (funcs.length > 0) {
    console.log(`\n${colors.bright}${category} (${funcs.length}个)：${colors.reset}`);
    funcs.forEach(func => console.log(`  - ${func}`));
  }
});

console.log(`\n${colors.magenta}========================================${colors.reset}`);
