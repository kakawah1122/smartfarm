#!/usr/bin/env node

/**
 * 云函数全面审查脚本
 * 1. 列出所有云函数
 * 2. 查找前端调用情况
 * 3. 识别未使用的云函数
 * 4. 检查与数据库集合的匹配性
 */

const fs = require('fs');
const path = require('path');

// 云函数目录
const CLOUD_FUNCTIONS_DIR = path.join(__dirname, '..', 'cloudfunctions');
const MINIPROGRAM_DIR = path.join(__dirname, '..', 'miniprogram');

// 收集所有云函数
function getAllCloudFunctions() {
  const cloudFunctions = [];
  const dirs = fs.readdirSync(CLOUD_FUNCTIONS_DIR);
  
  dirs.forEach(dir => {
    const funcPath = path.join(CLOUD_FUNCTIONS_DIR, dir);
    const stat = fs.statSync(funcPath);
    
    if (stat.isDirectory()) {
      const hasIndexJS = fs.existsSync(path.join(funcPath, 'index.js'));
      const hasPackageJSON = fs.existsSync(path.join(funcPath, 'package.json'));
      
      cloudFunctions.push({
        name: dir,
        hasIndexJS,
        hasPackageJSON,
        path: funcPath,
        isEmpty: !hasIndexJS && !hasPackageJSON
      });
    }
  });
  
  return cloudFunctions;
}

// 查找前端调用的云函数
function findUsedCloudFunctions() {
  const usedFunctions = new Set();
  const callPatterns = [];
  
  // 递归搜索文件
  function searchFiles(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        searchFiles(filePath);
      } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.js'))) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // 匹配云函数调用模式
        // 1. wx.cloud.callFunction({ name: 'xxx' })
        const pattern1 = /wx\.cloud\.callFunction\s*\(\s*\{[^}]*name\s*:\s*['"`]([^'"`]+)['"`]/g;
        // 2. safeCloudCall({ name: 'xxx' })
        const pattern2 = /safeCloudCall\s*\(\s*\{[^}]*name\s*:\s*['"`]([^'"`]+)['"`]/g;
        // 3. cloud.callFunction({ name: 'xxx' })
        const pattern3 = /cloud\.callFunction\s*\(\s*\{[^}]*name\s*:\s*['"`]([^'"`]+)['"`]/g;
        
        let match;
        while ((match = pattern1.exec(content)) !== null) {
          usedFunctions.add(match[1]);
          callPatterns.push({
            function: match[1],
            file: filePath.replace(MINIPROGRAM_DIR, ''),
            type: 'wx.cloud.callFunction'
          });
        }
        
        while ((match = pattern2.exec(content)) !== null) {
          usedFunctions.add(match[1]);
          callPatterns.push({
            function: match[1],
            file: filePath.replace(MINIPROGRAM_DIR, ''),
            type: 'safeCloudCall'
          });
        }
        
        while ((match = pattern3.exec(content)) !== null) {
          usedFunctions.add(match[1]);
          callPatterns.push({
            function: match[1],
            file: filePath.replace(MINIPROGRAM_DIR, ''),
            type: 'cloud.callFunction'
          });
        }
      }
    });
  }
  
  searchFiles(MINIPROGRAM_DIR);
  return { usedFunctions: Array.from(usedFunctions), callPatterns };
}

// 分析云函数使用情况
function analyzeCloudFunctions() {
  console.log('========================================');
  console.log('云函数全面审查报告');
  console.log('========================================\n');
  
  // 获取所有云函数
  const allFunctions = getAllCloudFunctions();
  console.log(`📁 云函数总数: ${allFunctions.length}\n`);
  
  // 获取使用的云函数
  const { usedFunctions, callPatterns } = findUsedCloudFunctions();
  console.log(`📞 前端调用的云函数: ${usedFunctions.length}\n`);
  
  // 分类云函数
  const emptyFunctions = allFunctions.filter(f => f.isEmpty);
  const activeFunctions = allFunctions.filter(f => !f.isEmpty && usedFunctions.includes(f.name));
  const unusedFunctions = allFunctions.filter(f => !f.isEmpty && !usedFunctions.includes(f.name));
  
  console.log('## 云函数分类\n');
  console.log(`✅ 活跃云函数（前端有调用）: ${activeFunctions.length}`);
  console.log(`❌ 未使用云函数（前端无调用）: ${unusedFunctions.length}`);
  console.log(`⚠️  空目录: ${emptyFunctions.length}\n`);
  
  // 列出活跃云函数
  console.log('## ✅ 活跃云函数列表\n');
  activeFunctions.forEach(func => {
    const calls = callPatterns.filter(p => p.function === func.name);
    console.log(`- ${func.name} (${calls.length}次调用)`);
  });
  
  console.log('\n## ❌ 未使用的云函数（建议删除）\n');
  unusedFunctions.forEach(func => {
    console.log(`- ${func.name}`);
  });
  
  console.log('\n## ⚠️ 空目录（可以直接删除）\n');
  emptyFunctions.forEach(func => {
    console.log(`- ${func.name}/`);
  });
  
  // 统计调用频率
  console.log('\n## 📊 调用频率统计（Top 10）\n');
  const callFrequency = {};
  callPatterns.forEach(pattern => {
    callFrequency[pattern.function] = (callFrequency[pattern.function] || 0) + 1;
  });
  
  const sorted = Object.entries(callFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  sorted.forEach(([func, count]) => {
    console.log(`${func}: ${count}次`);
  });
  
  // 生成清理脚本
  console.log('\n## 🧹 清理命令\n');
  console.log('```bash');
  console.log('# 删除空目录');
  emptyFunctions.forEach(func => {
    console.log(`rm -rf cloudfunctions/${func.name}`);
  });
  
  console.log('\n# 删除未使用的云函数（请确认后执行）');
  unusedFunctions.forEach(func => {
    console.log(`# rm -rf cloudfunctions/${func.name}`);
  });
  console.log('```\n');
  
  // 生成报告文件
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: allFunctions.length,
      active: activeFunctions.length,
      unused: unusedFunctions.length,
      empty: emptyFunctions.length
    },
    active: activeFunctions.map(f => f.name),
    unused: unusedFunctions.map(f => f.name),
    empty: emptyFunctions.map(f => f.name),
    callPatterns: callPatterns
  };
  
  fs.writeFileSync(
    path.join(__dirname, '..', 'docs', 'CLOUD-FUNCTIONS-REPORT.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log('✅ 报告已生成: docs/CLOUD-FUNCTIONS-REPORT.json\n');
  
  return report;
}

// 执行分析
analyzeCloudFunctions();
