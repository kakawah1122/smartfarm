#!/usr/bin/env node

/**
 * 修复生产管理页面问题
 * 临时移除createPageWithNavbar包装，恢复到原始Page()
 */

const fs = require('fs');
const path = require('path');

const PRODUCTION_TS_PATH = path.join(__dirname, '../miniprogram/pages/production/production.ts');

console.log('🔧 修复生产管理页面...\n');

try {
  // 读取文件
  let content = fs.readFileSync(PRODUCTION_TS_PATH, 'utf8');
  
  // 备份原文件
  const backupPath = PRODUCTION_TS_PATH + '.backup';
  fs.writeFileSync(backupPath, content);
  console.log('✅ 已备份原文件到:', backupPath);
  
  // 检查当前使用的是哪种方式
  const hasCreatePageWithNavbar = content.includes('Page(createPageWithNavbar(pageConfig))');
  
  if (hasCreatePageWithNavbar) {
    console.log('\n📝 当前使用: Page(createPageWithNavbar(pageConfig))');
    console.log('🔄 临时改为: Page(pageConfig)');
    
    // 修改最后一行
    content = content.replace(
      'Page(createPageWithNavbar(pageConfig))',
      `// 临时禁用createPageWithNavbar，直接使用Page
// Page(createPageWithNavbar(pageConfig))
Page(pageConfig)`
    );
    
    // 保存文件
    fs.writeFileSync(PRODUCTION_TS_PATH, content);
    console.log('✅ 已修改文件\n');
    
    console.log('⚠️ 注意事项：');
    console.log('1. 这是临时修改，用于诊断问题');
    console.log('2. 请在微信开发者工具中重新编译');
    console.log('3. 测试页面是否能正常点击和加载数据');
    console.log('4. 如果正常，说明问题在createPageWithNavbar中');
    console.log('5. 如果仍有问题，说明是其他原因\n');
    
    console.log('📋 测试后的操作：');
    console.log('• 如果修复成功：运行 node scripts/restore-production-page.js 恢复');
    console.log('• 如果仍有问题：请提供控制台的错误信息\n');
    
  } else {
    console.log('❌ 未找到 createPageWithNavbar，文件可能已被修改');
  }
  
} catch (error) {
  console.error('❌ 修复失败:', error.message);
}
