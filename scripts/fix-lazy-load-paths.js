#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要修复的文件
const files = [
  'miniprogram/pages/profile/profile.json',
  'miniprogram/pages/production/production.json', 
  'miniprogram/packageHealth/death-record/death-record.json',
  'miniprogram/packageHealth/treatment-record/treatment-record.json',
  'miniprogram/packageProduction/entry-records-list/entry-records-list.json',
  'miniprogram/packageProduction/exit-records-list/exit-records-list.json',
  'miniprogram/packageUser/knowledge/knowledge.json'
];

// 正确的路径映射
const correctPaths = {
  'miniprogram/pages/profile/profile.json': '../../components/lazy-load/lazy-load',
  'miniprogram/pages/production/production.json': '../../components/lazy-load/lazy-load',
  'miniprogram/packageHealth/death-record/death-record.json': '../../../components/lazy-load/lazy-load',
  'miniprogram/packageHealth/treatment-record/treatment-record.json': '../../../components/lazy-load/lazy-load',
  'miniprogram/packageProduction/entry-records-list/entry-records-list.json': '../../../components/lazy-load/lazy-load',
  'miniprogram/packageProduction/exit-records-list/exit-records-list.json': '../../../components/lazy-load/lazy-load',
  'miniprogram/packageUser/knowledge/knowledge.json': '../../../components/lazy-load/lazy-load'
};

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    
    if (config.usingComponents && config.usingComponents['lazy-load']) {
      const correctPath = correctPaths[file];
      if (config.usingComponents['lazy-load'] !== correctPath) {
        config.usingComponents['lazy-load'] = correctPath;
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
        console.log(`✅ 修复: ${file}`);
        console.log(`   新路径: ${correctPath}`);
      } else {
        console.log(`✓ ${file} 路径已正确`);
      }
    }
  }
});

console.log('\n✅ 路径修复完成！');
