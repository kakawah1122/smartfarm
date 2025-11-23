#!/usr/bin/env node

/**
 * 修复静态内联样式
 * 将静态样式移到CSS文件中
 */

const fs = require('fs');
const path = require('path');

// 静态内联样式的修复映射
const fixMap = {
  'skeleton': {
    file: 'miniprogram/components/skeleton/skeleton',
    styles: [
      { pattern: 'style="width: 60%;"', class: 'skeleton-w60' },
      { pattern: 'style="width: 40%; height: 24rpx; margin-top: 12rpx;"', class: 'skeleton-subtitle' },
      { pattern: 'style="width: 100%;"', class: 'skeleton-w100' },
      { pattern: 'style="width: 80%;"', class: 'skeleton-w80' },
      { pattern: 'style="width: 70%; height: 28rpx; margin-top: 12rpx;"', class: 'skeleton-title' },
      { pattern: 'style="width: 80rpx; height: 40rpx;"', class: 'skeleton-stat-value' },
      { pattern: 'style="width: 60rpx; height: 24rpx; margin-top: 8rpx;"', class: 'skeleton-stat-label' },
      { pattern: 'style="height: 32rpx;"', class: 'skeleton-h32' },
      { pattern: 'style="width: 48rpx; height: 48rpx; margin-right: 16rpx;"', class: 'skeleton-avatar' },
      { pattern: 'style="width: 50%;"', class: 'skeleton-w50' },
      { pattern: 'style="width: 30%;"', class: 'skeleton-w30' }
    ],
    cssRules: `
/* 骨架屏静态样式 */
.skeleton-w100 { width: 100%; }
.skeleton-w80 { width: 80%; }
.skeleton-w70 { width: 70%; }
.skeleton-w60 { width: 60%; }
.skeleton-w50 { width: 50%; }
.skeleton-w30 { width: 30%; }

.skeleton-subtitle {
  width: 40%;
  height: 24rpx;
  margin-top: 12rpx;
}

.skeleton-title {
  width: 70%;
  height: 28rpx;
  margin-top: 12rpx;
}

.skeleton-stat-value {
  width: 80rpx;
  height: 40rpx;
}

.skeleton-stat-label {
  width: 60rpx;
  height: 24rpx;
  margin-top: 8rpx;
}

.skeleton-h32 {
  height: 32rpx;
}

.skeleton-avatar {
  width: 48rpx;
  height: 48rpx;
  margin-right: 16rpx;
}
`
  },
  'other-static': {
    file: 'miniprogram/packageHealth/inspection-task/inspection-task',
    styles: [
      { pattern: 'style="height: 100vh;"', class: 'full-height' }
    ],
    cssRules: `
/* 通用样式 */
.full-height { height: 100vh; }
`
  }
};

let totalFixed = 0;
let filesModified = [];

/**
 * 修复WXML文件中的内联样式
 */
function fixWxmlFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  replacements.forEach(item => {
    if (content.includes(item.pattern)) {
      const newPattern = `class="${item.class}"`;
      content = content.replace(new RegExp(item.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPattern);
      modified = true;
      totalFixed++;
      console.log(`   ✓ 替换: ${item.pattern} → ${newPattern}`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    filesModified.push(filePath);
  }
  
  return modified;
}

/**
 * 添加CSS规则到样式文件
 */
function addCssRules(scssPath, cssRules) {
  if (!fs.existsSync(scssPath)) {
    console.log(`⚠️  样式文件不存在，创建新文件: ${scssPath}`);
    fs.writeFileSync(scssPath, cssRules);
    return true;
  }
  
  let content = fs.readFileSync(scssPath, 'utf8');
  
  // 检查是否已经添加过
  if (content.includes('/* 骨架屏静态样式 */') || content.includes('/* 通用样式 */')) {
    console.log(`   ℹ️  样式已存在，跳过`);
    return false;
  }
  
  // 添加到文件末尾
  content += '\n' + cssRules;
  fs.writeFileSync(scssPath, content);
  return true;
}

/**
 * 生成修复报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `INLINE-STYLES-FIX-REPORT-${timestamp.slice(0, 10)}.md`);
  
  let report = `# 内联样式修复报告

生成时间: ${new Date().toLocaleString()}

## 📊 修复统计

- 修复内联样式数: ${totalFixed}
- 修改文件数: ${filesModified.length}

## 📝 修改的文件

${filesModified.map(f => `- ${f}`).join('\n')}

## ✅ 修复内容

### skeleton组件
- 将静态宽度样式转换为CSS类
- 将复合样式提取为语义化的类名
- 保持视觉效果不变

### 其他组件
- 提取通用的全屏高度样式

## 🔍 验证步骤

1. 检查骨架屏组件显示是否正常
2. 确认各个宽度的加载效果
3. 验证全屏高度的页面是否正常

## 📋 下一步

1. 运行小程序，测试功能
2. 如无问题，提交更改
3. 继续处理混合内联样式
`;

  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🔧 修复静态内联样式\n');
console.log('⚠️  此操作将修改文件，请确保已备份！\n');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('是否继续？(y/n): ', (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('❌ 操作已取消');
    rl.close();
    return;
  }
  
  console.log('\n开始修复...\n');
  
  // 处理每个组件
  Object.keys(fixMap).forEach(key => {
    const config = fixMap[key];
    console.log(`\n📦 处理 ${key}:`);
    
    // 修复WXML文件
    const wxmlPath = config.file + '.wxml';
    console.log(`   修复 ${wxmlPath}`);
    const wxmlFixed = fixWxmlFile(wxmlPath, config.styles);
    
    // 添加CSS规则
    if (wxmlFixed && config.cssRules) {
      const scssPath = config.file + '.scss';
      console.log(`   更新 ${scssPath}`);
      addCssRules(scssPath, config.cssRules);
      filesModified.push(scssPath);
    }
  });
  
  console.log('\n\n✅ 修复完成！');
  console.log(`📊 统计：`);
  console.log(`   - 修复样式: ${totalFixed} 个`);
  console.log(`   - 修改文件: ${filesModified.length} 个`);
  
  const reportPath = generateReport();
  console.log(`\n📄 报告已生成: ${reportPath}`);
  
  console.log('\n💡 下一步:');
  console.log('   1. 运行小程序测试');
  console.log('   2. 检查骨架屏等组件显示');
  console.log('   3. 如无问题，提交更改');
  
  rl.close();
});
