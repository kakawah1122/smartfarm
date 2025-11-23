#!/usr/bin/env node

/**
 * 修复剩余的静态内联样式（第二批）
 * 不包括第三方库文件
 */

const fs = require('fs');
const path = require('path');

// 剩余静态内联样式的修复映射
const fixMap = {
  'skeleton-remaining': {
    file: 'miniprogram/components/skeleton/skeleton',
    styles: [
      { pattern: 'style="width: 200rpx; height: 44rpx;"', class: 'skeleton-detail-value' },
      { pattern: 'style="width: 120rpx; height: 32rpx; margin-top: 16rpx;"', class: 'skeleton-detail-label' },
      { pattern: 'style="width: 150rpx; height: 36rpx; margin-bottom: 20rpx;"', class: 'skeleton-detail-title' },
      { pattern: 'style="width: 90%;"', class: 'skeleton-w90' },
      { pattern: 'style="width: 75%;"', class: 'skeleton-w75' }
    ],
    cssRules: `
/* 骨架屏详情样式 */
.skeleton-w90 { width: 90%; }
.skeleton-w75 { width: 75%; }

.skeleton-detail-value {
  width: 200rpx;
  height: 44rpx;
}

.skeleton-detail-label {
  width: 120rpx;
  height: 32rpx;
  margin-top: 16rpx;
}

.skeleton-detail-title {
  width: 150rpx;
  height: 36rpx;
  margin-bottom: 20rpx;
}
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
  if (content.includes('/* 骨架屏详情样式 */')) {
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
  const reportPath = path.join(__dirname, '..', 'docs', `INLINE-STYLES-FIX-BATCH2-${timestamp.slice(0, 10)}.md`);
  
  let report = `# 内联样式修复报告 - 第二批

生成时间: ${new Date().toLocaleString()}

## 📊 修复统计

- 修复内联样式数: ${totalFixed}
- 修改文件数: ${filesModified.length}

## 📝 修改的文件

${filesModified.map(f => `- ${f}`).join('\n')}

## ✅ 修复内容

### skeleton组件（剩余部分）
- 添加w90和w75宽度类
- 添加详情页专用样式类
- 保持视觉效果不变

## 🔍 验证步骤

1. 检查骨架屏组件显示是否正常
2. 确认新增样式类的效果
3. 验证详情页骨架屏效果

## 📋 剩余工作

### 静态内联样式
- skeleton组件: ✅ 全部完成（12/12）
- TDesign组件: ⚠️ 跳过（第三方库，6个）
- 其他组件: 待处理（0个）

### 下一步
1. 处理混合内联样式（82个）
2. 提取其中的静态部分
3. 手动清理确认的未使用CSS类

## 💡 说明

TDesign组件库中的内联样式不进行修改，原因：
1. 第三方库应保持原样
2. 升级时会被覆盖
3. 可能影响组件功能
`;

  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🔧 修复剩余静态内联样式（第二批）\n');
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
  console.log('   2. 检查骨架屏组件显示');
  console.log('   3. 如无问题，提交更改');
  console.log('   4. 开始处理混合内联样式');
  
  rl.close();
});
