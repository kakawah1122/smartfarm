#!/usr/bin/env node

/**
 * 诊断生产管理页面问题
 */

const fs = require('fs');
const path = require('path');

const PRODUCTION_PAGE_PATH = path.join(__dirname, '../miniprogram/pages/production');
const APP_JSON_PATH = path.join(__dirname, '../miniprogram/app.json');

console.log('🔍 诊断生产管理页面问题...\n');

// 1. 检查文件是否存在
console.log('1️⃣ 检查文件完整性：');
const requiredFiles = [
  'production.json',
  'production.wxml',
  'production.ts',
  'production.scss'
];

requiredFiles.forEach(file => {
  const filePath = path.join(PRODUCTION_PAGE_PATH, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${file}: ${exists ? '存在' : '缺失'}`);
});

// 2. 检查JSON配置
console.log('\n2️⃣ 检查production.json配置：');
try {
  const jsonPath = path.join(PRODUCTION_PAGE_PATH, 'production.json');
  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  const json = JSON.parse(jsonContent);
  
  console.log('  组件引用：');
  if (json.usingComponents) {
    Object.keys(json.usingComponents).forEach(name => {
      console.log(`    • ${name}: ${json.usingComponents[name]}`);
    });
  } else {
    console.log('    无组件引用');
  }
  
  console.log(`  导航栏样式: ${json.navigationStyle || '默认'}`);
  console.log(`  下拉刷新: ${json.enablePullDownRefresh ? '启用' : '禁用'}`);
} catch (error) {
  console.log(`  ❌ 解析失败: ${error.message}`);
}

// 3. 检查WXML中使用的TDesign组件
console.log('\n3️⃣ 检查WXML中使用的TDesign组件：');
try {
  const wxmlPath = path.join(PRODUCTION_PAGE_PATH, 'production.wxml');
  const wxmlContent = fs.readFileSync(wxmlPath, 'utf8');
  
  const tdesignComponents = new Set();
  const regex = /<t-(\w+)[\s>]/g;
  let match;
  
  while ((match = regex.exec(wxmlContent)) !== null) {
    tdesignComponents.add(`t-${match[1]}`);
  }
  
  console.log(`  发现 ${tdesignComponents.size} 个TDesign组件：`);
  Array.from(tdesignComponents).sort().forEach(comp => {
    console.log(`    • ${comp}`);
  });
  
  // 4. 检查这些组件是否在全局配置中
  console.log('\n4️⃣ 检查全局组件配置：');
  const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
  const globalComponents = appJson.usingComponents || {};
  
  const missingComponents = [];
  tdesignComponents.forEach(comp => {
    if (!globalComponents[comp]) {
      missingComponents.push(comp);
    }
  });
  
  if (missingComponents.length > 0) {
    console.log('  ⚠️ 以下组件未在全局或页面中引入：');
    missingComponents.forEach(comp => {
      console.log(`    • ${comp}`);
    });
  } else {
    console.log('  ✅ 所有使用的TDesign组件都已全局引入');
  }
  
} catch (error) {
  console.log(`  ❌ 检查失败: ${error.message}`);
}

// 5. 检查TS文件语法
console.log('\n5️⃣ 检查TypeScript文件：');
try {
  const tsPath = path.join(PRODUCTION_PAGE_PATH, 'production.ts');
  const tsContent = fs.readFileSync(tsPath, 'utf8');
  
  // 简单检查是否有明显的语法错误
  if (tsContent.includes('createPageWithNavbar')) {
    console.log('  ✅ 使用createPageWithNavbar工具函数');
  }
  
  if (tsContent.includes('onLoad')) {
    console.log('  ✅ 包含onLoad生命周期函数');
  }
  
  if (tsContent.includes('loadData')) {
    console.log('  ✅ 包含loadData数据加载函数');
  }
  
  // 检查是否有未闭合的括号等
  const openBraces = (tsContent.match(/\{/g) || []).length;
  const closeBraces = (tsContent.match(/\}/g) || []).length;
  const openParens = (tsContent.match(/\(/g) || []).length;
  const closeParens = (tsContent.match(/\)/g) || []).length;
  
  if (openBraces !== closeBraces) {
    console.log(`  ⚠️ 花括号不匹配: { ${openBraces} vs } ${closeBraces}`);
  }
  
  if (openParens !== closeParens) {
    console.log(`  ⚠️ 圆括号不匹配: ( ${openParens} vs ) ${closeParens}`);
  }
  
  if (openBraces === closeBraces && openParens === closeParens) {
    console.log('  ✅ 括号匹配正常');
  }
  
} catch (error) {
  console.log(`  ❌ 检查失败: ${error.message}`);
}

// 6. 给出建议
console.log('\n' + '='.repeat(60));
console.log('\n💡 诊断建议：\n');

console.log('1. **重新构建npm**：');
console.log('   工具 → 构建npm → 重新编译\n');

console.log('2. **清理缓存**：');
console.log('   工具 → 清除缓存 → 清除全部缓存\n');

console.log('3. **重启开发者工具**：');
console.log('   完全关闭并重新打开微信开发者工具\n');

console.log('4. **检查控制台错误**：');
console.log('   查看调试器中的Console和Network标签\n');

console.log('5. **如果问题持续**：');
console.log('   删除miniprogram_npm目录，重新构建npm\n');

console.log('='.repeat(60) + '\n');
