#!/usr/bin/env node

/**
 * 修复花括号不匹配问题
 */

const fs = require('fs');
const path = require('path');

function fixBraces(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`文件不存在: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // 统计花括号
  let openCount = 0;
  let closeCount = 0;
  let depth = 0;
  let maxDepth = 0;
  const depthMap = [];
  
  lines.forEach((line, index) => {
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    
    openCount += openBraces;
    closeCount += closeBraces;
    depth += openBraces - closeBraces;
    
    if (depth > maxDepth) maxDepth = depth;
    if (depth < 0) {
      console.log(`⚠️  第 ${index + 1} 行深度为负: ${depth}`);
      console.log(`   内容: ${line.trim()}`);
    }
    
    depthMap.push({ line: index + 1, depth, content: line });
  });
  
  console.log(`\n文件: ${path.basename(filePath)}`);
  console.log(`开花括号: ${openCount}`);
  console.log(`闭花括号: ${closeCount}`);
  console.log(`差异: ${openCount - closeCount}`);
  console.log(`最大深度: ${maxDepth}`);
  
  // 如果闭花括号多余，需要删除多余的
  if (closeCount > openCount) {
    const excessCloses = closeCount - openCount;
    console.log(`\n需要删除 ${excessCloses} 个多余的闭花括号`);
    
    // 从文件末尾开始查找并删除多余的闭花括号
    let removed = 0;
    for (let i = lines.length - 1; i >= 0 && removed < excessCloses; i--) {
      // 如果这一行只有一个闭花括号，删除它
      if (lines[i].trim() === '}') {
        console.log(`删除第 ${i + 1} 行的闭花括号`);
        lines.splice(i, 1);
        removed++;
      }
    }
    
    if (removed > 0) {
      // 保存修复后的文件
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      console.log(`✅ 已删除 ${removed} 个多余的闭花括号`);
    }
  }
}

// 主函数
function main() {
  const problemFiles = [
    'miniprogram/pages/health/health.scss',
    'miniprogram/packageHealth/treatment-record/treatment-record.scss',
    'miniprogram/packageUser/employee-permission/employee-permission.scss',
    'miniprogram/packageUser/invite-management/invite-management.scss',
    'miniprogram/packageUser/lifecycle-management/lifecycle-management.scss',
    'miniprogram/styles/components/card-common.scss'
  ];
  
  console.log('🔧 修复花括号不匹配问题\n');
  
  problemFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    fixBraces(filePath);
    console.log('---');
  });
  
  console.log('\n✅ 修复完成！');
}

// 执行
main();
