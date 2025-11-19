#!/usr/bin/env node

/**
 * 批量修复所有使用createPageWithNavbar的页面
 * 将Page(createPageWithNavbar(pageConfig))改为Page(pageConfig)
 * 并在onLoad中手动添加必要的逻辑
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MINIPROGRAM_PATH = path.join(__dirname, '../miniprogram');

console.log('🔧 批量修复所有使用createPageWithNavbar的页面...\n');

// 使用grep查找所有使用createPageWithNavbar的文件
let grepResult;
try {
  grepResult = execSync(
    `grep -r "createPageWithNavbar" --include="*.ts" "${MINIPROGRAM_PATH}"`,
    { encoding: 'utf8' }
  );
} catch (error) {
  console.log('✅ 没有找到需要修复的文件');
  process.exit(0);
}

// 解析grep结果，获取文件路径
const lines = grepResult.split('\n').filter(line => line.trim());
const files = new Set();

lines.forEach(line => {
  const match = line.match(/^(.+?\.ts):/);
  if (match) {
    files.add(match[1]);
  }
});

// 排除utils/navigation.ts（这是工具文件本身）
const filesToFix = Array.from(files).filter(file => !file.includes('utils/navigation.ts'));

console.log(`📋 找到 ${filesToFix.length} 个需要修复的文件：\n`);

let successCount = 0;
let failedCount = 0;
const failedFiles = [];

filesToFix.forEach((file, index) => {
  const relativePath = file.replace(MINIPROGRAM_PATH, '');
  console.log(`${index + 1}. ${relativePath}`);
  
  try {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // 1. 更新import语句
    if (content.includes("import { createPageWithNavbar } from '../../utils/navigation'")) {
      content = content.replace(
        "import { createPageWithNavbar } from '../../utils/navigation'",
        "import { getSystemNavBarSizes } from '../../utils/navigation'\nimport { checkPageAuth } from '../../utils/auth-guard'"
      );
      modified = true;
    }
    
    // 2. 在data中添加导航栏高度
    // 查找data对象的开始位置
    const dataMatch = content.match(/data:\s*{/);
    if (dataMatch && !content.includes('statusBarHeight: 88')) {
      const dataStart = dataMatch.index + dataMatch[0].length;
      const beforeData = content.substring(0, dataStart);
      const afterData = content.substring(dataStart);
      
      content = beforeData + '\n    // 导航栏高度\n    statusBarHeight: 88,\n    navBarHeight: 88,\n    totalNavHeight: 176,\n    ' + afterData;
      modified = true;
    }
    
    // 3. 更新onLoad方法
    // 查找onLoad方法
    const onLoadMatch = content.match(/onLoad\s*\([^)]*\)\s*{/);
    if (onLoadMatch) {
      const onLoadStart = onLoadMatch.index + onLoadMatch[0].length;
      
      // 检查是否已经有auth和navbar设置
      const onLoadEnd = findClosingBrace(content, onLoadStart);
      const onLoadContent = content.substring(onLoadStart, onLoadEnd);
      
      if (!onLoadContent.includes('checkPageAuth') && !onLoadContent.includes('getSystemNavBarSizes')) {
        const beforeOnLoad = content.substring(0, onLoadStart);
        const afterOnLoad = content.substring(onLoadStart);
        
        const authAndNavbarCode = `
    // 检查登录状态
    if (!checkPageAuth()) {
      return
    }
    
    // 设置状态栏高度
    const sizes = getSystemNavBarSizes()
    this.setData({
      statusBarHeight: sizes.statusBarHeight,
      navBarHeight: sizes.navBarHeight,
      totalNavHeight: sizes.totalNavHeight
    })
    `;
        
        content = beforeOnLoad + authAndNavbarCode + afterOnLoad;
        modified = true;
      }
    }
    
    // 4. 添加goBack方法（如果还没有）
    if (!content.includes('goBack()') && !content.includes('goBack ()')) {
      // 在最后一个方法后添加goBack
      const lastMethodEnd = content.lastIndexOf('},');
      if (lastMethodEnd > 0) {
        const before = content.substring(0, lastMethodEnd + 2);
        const after = content.substring(lastMethodEnd + 2);
        
        const goBackCode = `
  
  /**
   * 返回上一页
   */
  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({
        url: '/pages/index/index'
      })
    }
  }`;
        
        content = before + goBackCode + after;
        modified = true;
      }
    }
    
    // 5. 替换Page调用
    if (content.includes('Page(createPageWithNavbar(pageConfig))')) {
      content = content.replace(
        'Page(createPageWithNavbar(pageConfig))',
        '// 直接使用Page注册，不使用createPageWithNavbar包装\nPage(pageConfig)'
      );
      modified = true;
    }
    
    if (modified) {
      // 备份原文件
      fs.writeFileSync(file + '.backup', fs.readFileSync(file));
      
      // 写入修改后的内容
      fs.writeFileSync(file, content);
      console.log(`   ✅ 已修复\n`);
      successCount++;
    } else {
      console.log(`   ⏭️ 跳过（已修复或无需修改）\n`);
    }
    
  } catch (error) {
    console.log(`   ❌ 失败: ${error.message}\n`);
    failedCount++;
    failedFiles.push(relativePath);
  }
});

console.log('='.repeat(60));
console.log('\n📊 修复结果：');
console.log(`  ✅ 成功修复: ${successCount} 个文件`);
console.log(`  ⏭️ 跳过: ${filesToFix.length - successCount - failedCount} 个文件`);
console.log(`  ❌ 失败: ${failedCount} 个文件`);

if (failedFiles.length > 0) {
  console.log('\n失败的文件：');
  failedFiles.forEach(file => console.log(`  • ${file}`));
}

console.log('\n⚠️ 注意事项：');
console.log('1. 原文件已备份为 .backup 后缀');
console.log('2. 请在微信开发者工具中重新编译');
console.log('3. 测试所有页面是否正常工作');
console.log('4. 如有问题，可以使用备份文件恢复\n');

console.log('='.repeat(60) + '\n');

/**
 * 查找匹配的右大括号位置
 */
function findClosingBrace(content, startPos) {
  let count = 1;
  let pos = startPos;
  
  while (pos < content.length && count > 0) {
    if (content[pos] === '{') {
      count++;
    } else if (content[pos] === '}') {
      count--;
    }
    pos++;
  }
  
  return pos;
}
