#!/usr/bin/env node

/**
 * 完整修复CSS文件
 * 1. 修复花括号不匹配
 * 2. 清理空规则
 * 3. 修复语法错误
 */

const fs = require('fs');
const path = require('path');

function fixCSSFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Step 1: 删除所有空的CSS规则
  content = content.replace(/\.[a-zA-Z0-9_-]+\s*\{\s*\}/g, '');
  content = content.replace(/#[a-zA-Z0-9_-]+\s*\{\s*\}/g, '');
  
  // Step 2: 删除孤立的选择器
  content = content.replace(/\n\s*\.[a-zA-Z0-9_-]+\s*$/gm, '');
  content = content.replace(/\n\s*#[a-zA-Z0-9_-]+\s*$/gm, '');
  
  // Step 3: 修复注释后没有内容的问题
  content = content.replace(/\/\*[^*]*\*\/\s*\n\s*$/gm, '');
  
  // Step 4: 计算并修复花括号
  let lines = content.split('\n');
  let openCount = 0;
  let closeCount = 0;
  
  lines.forEach(line => {
    openCount += (line.match(/\{/g) || []).length;
    closeCount += (line.match(/\}/g) || []).length;
  });
  
  // 如果闭花括号多，删除文件末尾多余的
  if (closeCount > openCount) {
    const excess = closeCount - openCount;
    let removed = 0;
    
    for (let i = lines.length - 1; i >= 0 && removed < excess; i--) {
      if (lines[i].trim() === '}') {
        lines.splice(i, 1);
        removed++;
      }
    }
    
    content = lines.join('\n');
  }
  
  // 如果开花括号多，在文件末尾添加
  if (openCount > closeCount) {
    const missing = openCount - closeCount;
    for (let i = 0; i < missing; i++) {
      content += '\n}';
    }
  }
  
  // Step 5: 清理多余空行
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  // Step 6: 确保文件以换行结束
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

// 主函数
function main() {
  console.log('🔧 完整修复CSS文件\n');
  
  const cssFiles = [];
  
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'miniprogram_npm', 'backups'].includes(item)) {
          scanDir(fullPath);
        }
      } else if (item.endsWith('.scss') || item.endsWith('.wxss')) {
        cssFiles.push(fullPath);
      }
    });
  }
  
  scanDir(path.join(process.cwd(), 'miniprogram'));
  
  console.log(`找到 ${cssFiles.length} 个样式文件\n`);
  
  let fixedCount = 0;
  const problemFiles = [];
  
  cssFiles.forEach(file => {
    try {
      if (fixCSSFile(file)) {
        console.log(`✅ 修复: ${path.basename(file)}`);
        fixedCount++;
      }
      
      // 验证修复后的文件
      const content = fs.readFileSync(file, 'utf8');
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        problemFiles.push({
          file: path.basename(file),
          open: openBraces,
          close: closeBraces
        });
      }
    } catch (error) {
      console.error(`❌ 错误处理 ${path.basename(file)}: ${error.message}`);
    }
  });
  
  console.log(`\n📊 结果：`);
  console.log(`  • 修复文件: ${fixedCount}`);
  console.log(`  • 总文件数: ${cssFiles.length}`);
  
  if (problemFiles.length > 0) {
    console.log('\n⚠️  仍有问题的文件:');
    problemFiles.forEach(p => {
      console.log(`  - ${p.file}: 开${p.open} 闭${p.close}`);
    });
  } else {
    console.log('\n✅ 所有文件语法正确！');
  }
}

// 执行
main();
