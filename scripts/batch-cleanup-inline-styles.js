#!/usr/bin/env node
/**
 * 批量清理内联样式脚本
 * 自动将常见的固定内联样式提取到SCSS类中
 */

const fs = require('fs');
const path = require('path');

const MINIPROGRAM_DIR = path.join(__dirname, '../miniprogram');

// 常见的固定样式模式
const FIXED_STYLE_PATTERNS = [
  {
    pattern: /style="height:\s*120rpx;?"/g,
    replacement: 'class="safe-area"',
    scssClass: '.safe-area { height: 120rpx; }',
    description: '底部安全区域'
  },
  {
    pattern: /style="margin-top:\s*0\s*!important;?"/g,
    replacement: 'class="no-margin-top"',
    scssClass: '.no-margin-top { margin-top: 0; }',
    description: '无顶部间距'
  },
  {
    pattern: /style="padding-top:\s*0\s*!important;?"/g,
    replacement: 'class="no-padding-top"',
    scssClass: '.no-padding-top { padding-top: 0; }',
    description: '无顶部内边距'
  }
];

/**
 * 递归查找所有WXML文件
 */
function findWxmlFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!['node_modules', 'miniprogram_npm'].includes(item)) {
        findWxmlFiles(fullPath, files);
      }
    } else if (stat.isFile() && item.endsWith('.wxml')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * 清理单个文件
 */
function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  const changes = [];
  
  for (const { pattern, replacement, description } of FIXED_STYLE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      modified = true;
      changes.push({
        pattern: description,
        count: matches.length
      });
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { file: path.relative(MINIPROGRAM_DIR, filePath), changes };
  }
  
  return null;
}

/**
 * 确保SCSS文件包含必要的类
 */
function ensureScssClasses(scssFile, classes) {
  if (!fs.existsSync(scssFile)) {
    // 创建新的SCSS文件
    const content = classes.map(c => `/* ${c.description} */\n${c.scssClass}\n`).join('\n');
    fs.writeFileSync(scssFile, content, 'utf-8');
    return true;
  } else {
    // 检查并添加缺失的类
    let content = fs.readFileSync(scssFile, 'utf-8');
    let modified = false;
    
    for (const { scssClass, description } of classes) {
      const className = scssClass.match(/\.(\w+)/)?.[1];
      if (className && !content.includes(`.${className}`)) {
        content += `\n\n/* ${description} */\n${scssClass}\n`;
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(scssFile, content, 'utf-8');
      return true;
    }
  }
  
  return false;
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始批量清理内联样式...\n');
  
  const wxmlFiles = findWxmlFiles(MINIPROGRAM_DIR);
  const cleanedFiles = [];
  const scssFilesToUpdate = new Map();
  
  // 清理WXML文件
  for (const file of wxmlFiles) {
    const result = cleanFile(file);
    if (result) {
      cleanedFiles.push(result);
      
      // 找到对应的SCSS文件
      const scssFile = file.replace('.wxml', '.scss');
      if (!scssFilesToUpdate.has(scssFile)) {
        scssFilesToUpdate.set(scssFile, []);
      }
      
      // 收集需要添加的类
      for (const change of result.changes) {
        const pattern = FIXED_STYLE_PATTERNS.find(p => p.description === change.pattern);
        if (pattern && !scssFilesToUpdate.get(scssFile).find(c => c.description === pattern.description)) {
          scssFilesToUpdate.get(scssFile).push(pattern);
        }
      }
    }
  }
  
  // 更新SCSS文件
  for (const [scssFile, classes] of scssFilesToUpdate.entries()) {
    ensureScssClasses(scssFile, classes);
  }
  
  // 输出结果
  console.log(`✅ 清理完成！\n`);
  console.log(`📊 统计:`);
  console.log(`   - 清理了 ${cleanedFiles.length} 个文件`);
  console.log(`   - 更新了 ${scssFilesToUpdate.size} 个SCSS文件\n`);
  
  if (cleanedFiles.length > 0) {
    console.log('📝 清理的文件:');
    cleanedFiles.forEach(({ file, changes }) => {
      console.log(`   - ${file}`);
      changes.forEach(c => {
        console.log(`     • ${c.pattern}: ${c.count}处`);
      });
    });
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = { cleanFile, ensureScssClasses };
}

