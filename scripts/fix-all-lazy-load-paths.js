#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要修复的所有文件
const files = [
  'miniprogram/pages/profile/profile.json',
  'miniprogram/pages/production/production.json', 
  'miniprogram/packageHealth/death-record/death-record.json',
  'miniprogram/packageHealth/treatment-record/treatment-record.json',
  'miniprogram/packageProduction/entry-records-list/entry-records-list.json',
  'miniprogram/packageProduction/exit-records-list/exit-records-list.json',
  'miniprogram/packageUser/knowledge/knowledge.json'
];

// 统一使用绝对路径
const correctPath = '/components/lazy-load/lazy-load';

console.log('🔧 开始修复所有lazy-load组件路径...\n');

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    
    if (config.usingComponents && config.usingComponents['lazy-load']) {
      const oldPath = config.usingComponents['lazy-load'];
      
      if (oldPath !== correctPath) {
        config.usingComponents['lazy-load'] = correctPath;
        
        // 保持JSON格式化
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
        
        console.log(`✅ 修复: ${file}`);
        console.log(`   旧路径: ${oldPath}`);
        console.log(`   新路径: ${correctPath}\n`);
      } else {
        console.log(`✓ ${file}`);
        console.log(`  路径已正确: ${correctPath}\n`);
      }
    } else {
      console.log(`⚠️  ${file} 未使用lazy-load组件\n`);
    }
  } else {
    console.log(`❌ 文件不存在: ${file}\n`);
  }
});

// 验证修复结果
console.log('\n📊 验证修复结果...\n');

let allCorrect = true;
files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (fs.existsSync(filePath)) {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (config.usingComponents && config.usingComponents['lazy-load']) {
      if (config.usingComponents['lazy-load'] === correctPath) {
        console.log(`✅ ${path.basename(file)}: 路径正确`);
      } else {
        console.log(`❌ ${path.basename(file)}: 路径错误 - ${config.usingComponents['lazy-load']}`);
        allCorrect = false;
      }
    }
  }
});

if (allCorrect) {
  console.log('\n✨ 所有lazy-load组件路径已正确配置！');
} else {
  console.log('\n⚠️  部分文件路径仍有问题，请检查！');
}

console.log('\n📝 提示：');
console.log('1. 使用绝对路径 /components/... 可避免相对路径计算错误');
console.log('2. 确保所有分包和页面使用统一的路径格式');
console.log('3. 重新编译项目验证修复效果');
