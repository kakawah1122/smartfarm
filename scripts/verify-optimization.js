#!/usr/bin/env node

/**
 * 验证优化效果的脚本
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 验证优化效果...\n');
console.log('=' .repeat(50));

// 1. 检查云函数是否还有硬编码
console.log('\n📌 检查云函数硬编码问题：');
const cloudFunctions = [
  '../cloudfunctions/login/index.js',
  '../cloudfunctions/production-upload/index.js',
  '../cloudfunctions/user-approval/index.js'
];

let hasHardcode = false;
cloudFunctions.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const hardcodePattern = /db\.collection\(['"`](wx_users|file_static_records|health_records|prod_batch_entries|prod_batch_exits|sys_approval_logs|wx_user_invites)['"`]\)/g;
    const matches = content.match(hardcodePattern);
    
    if (matches) {
      console.log(`  ❌ ${file}: 发现 ${matches.length} 处硬编码`);
      hasHardcode = true;
    } else {
      console.log(`  ✅ ${file}: 无硬编码`);
    }
  }
});

// 2. 检查图片大小
console.log('\n📊 检查图片资源大小：');
const assetsDir = path.join(__dirname, '../miniprogram/assets');
if (fs.existsSync(assetsDir)) {
  let totalSize = 0;
  
  function getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return stats.size;
  }
  
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        walkDir(filePath);
      } else {
        const size = getFileSize(filePath);
        totalSize += size;
        if (size > 100 * 1024) { // 大于100KB
          console.log(`  ⚠️ ${path.relative(assetsDir, filePath)}: ${(size / 1024).toFixed(2)}KB`);
        }
      }
    });
  }
  
  walkDir(assetsDir);
  const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
  console.log(`  📦 总大小: ${totalMB}MB`);
  
  if (totalMB > 0.5) {
    console.log(`  ❌ 图片资源过大，需要进一步优化`);
  } else {
    console.log(`  ✅ 图片资源大小合理`);
  }
}

// 3. 检查app.json配置
console.log('\n⚙️ 检查优化配置：');
const appJsonPath = path.join(__dirname, '../miniprogram/app.json');
if (fs.existsSync(appJsonPath)) {
  const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  
  // 检查全局组件
  if (appConfig.usingComponents && Object.keys(appConfig.usingComponents).length > 0) {
    console.log(`  ✅ 已配置全局组件: ${Object.keys(appConfig.usingComponents).length}个`);
  } else {
    console.log(`  ❌ 未配置全局组件`);
  }
  
  // 检查独立分包
  const independentPackages = appConfig.subpackages?.filter(pkg => pkg.independent) || [];
  if (independentPackages.length > 0) {
    console.log(`  ✅ 已配置独立分包: ${independentPackages.map(p => p.name).join(', ')}`);
  } else {
    console.log(`  ⚠️ 未配置独立分包`);
  }
  
  // 检查分包预下载
  if (appConfig.preloadRule && Object.keys(appConfig.preloadRule).length > 0) {
    console.log(`  ✅ 已配置分包预下载: ${Object.keys(appConfig.preloadRule).length}个规则`);
  } else {
    console.log(`  ⚠️ 未配置分包预下载`);
  }
  
  // 检查按需加载
  if (appConfig.lazyCodeLoading === 'requiredComponents') {
    console.log(`  ✅ 已启用按需加载组件`);
  } else {
    console.log(`  ❌ 未启用按需加载`);
  }
}

// 4. 统计分包大小
console.log('\n📦 分包大小统计：');
const packages = [
  { name: '主包', path: '../miniprogram/pages' },
  { name: 'packageProduction', path: '../miniprogram/packageProduction' },
  { name: 'packageHealth', path: '../miniprogram/packageHealth' },
  { name: 'packageUser', path: '../miniprogram/packageUser' },
  { name: 'packageFinance', path: '../miniprogram/packageFinance' },
  { name: 'packageAI', path: '../miniprogram/packageAI' }
];

packages.forEach(pkg => {
  const pkgPath = path.join(__dirname, pkg.path);
  if (fs.existsSync(pkgPath)) {
    let size = 0;
    
    function calcSize(dir) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          calcSize(filePath);
        } else {
          size += stats.size;
        }
      });
    }
    
    calcSize(pkgPath);
    const sizeMB = (size / (1024 * 1024)).toFixed(2);
    const status = sizeMB > 2 ? '❌' : sizeMB > 1.5 ? '⚠️' : '✅';
    console.log(`  ${status} ${pkg.name}: ${sizeMB}MB`);
  }
});

console.log('\n' + '=' .repeat(50));
console.log('✅ 验证完成！');

if (!hasHardcode) {
  console.log('🎉 云函数硬编码问题已全部修复');
} else {
  console.log('⚠️ 还有云函数存在硬编码问题');
}

console.log('\n📌 下一步建议：');
console.log('1. 手动压缩图片资源（使用TinyPNG等工具）');
console.log('2. 在开发者工具中查看详细的包大小分析');
console.log('3. 测试各功能是否正常');
