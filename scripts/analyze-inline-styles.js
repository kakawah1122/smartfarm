#!/usr/bin/env node

/**
 * 分析内联样式使用情况
 * 区分动态样式和静态样式
 */

const fs = require('fs');
const path = require('path');

const results = {
  dynamic: [],  // 动态样式（包含{{}}）
  static: [],   // 静态样式（纯CSS）
  mixed: []     // 混合样式
};

let totalFiles = 0;
let totalInlineStyles = 0;

/**
 * 判断样式类型
 */
function classifyStyle(styleStr) {
  const hasDynamic = styleStr.includes('{{');
  const hasStatic = /[a-z-]+\s*:\s*[^{]+/i.test(styleStr.replace(/\{\{[^}]+\}\}/g, ''));
  
  if (hasDynamic && hasStatic) return 'mixed';
  if (hasDynamic) return 'dynamic';
  return 'static';
}

/**
 * 提取样式建议
 */
function getSuggestion(styleStr, type) {
  if (type === 'static') {
    return '建议：移动到CSS文件中';
  } else if (type === 'mixed') {
    // 分析哪些部分可以提取
    const staticParts = [];
    const parts = styleStr.split(';').filter(p => p.trim());
    
    parts.forEach(part => {
      if (!part.includes('{{')) {
        staticParts.push(part.trim());
      }
    });
    
    if (staticParts.length > 0) {
      return `建议：可提取静态部分到CSS：${staticParts.join('; ')}`;
    }
  }
  return '建议：保留（动态样式）';
}

/**
 * 扫描WXML文件
 */
function scanWxmlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  // 匹配所有style属性
  const styleRegex = /style\s*=\s*"([^"]+)"/g;
  let match;
  let fileStyles = [];
  
  while ((match = styleRegex.exec(content)) !== null) {
    totalInlineStyles++;
    const styleStr = match[1];
    const type = classifyStyle(styleStr);
    const lineNum = content.substring(0, match.index).split('\n').length;
    
    fileStyles.push({
      line: lineNum,
      style: styleStr,
      type: type,
      suggestion: getSuggestion(styleStr, type)
    });
  }
  
  if (fileStyles.length > 0) {
    totalFiles++;
    
    fileStyles.forEach(item => {
      results[item.type].push({
        file: relativePath,
        line: item.line,
        style: item.style,
        suggestion: item.suggestion
      });
    });
  }
}

/**
 * 递归扫描目录
 */
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (file === 'node_modules' || file === '.git') {
        return;
      }
      scanDirectory(fullPath);
    } else if (file.endsWith('.wxml')) {
      scanWxmlFile(fullPath);
    }
  });
}

/**
 * 生成报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `INLINE-STYLES-REPORT-${timestamp.slice(0, 10)}.md`);
  
  let report = `# 内联样式分析报告

生成时间: ${new Date().toLocaleString()}

## 📊 统计概览

- 扫描文件数: ${totalFiles}
- 内联样式总数: ${totalInlineStyles}
- 静态样式: ${results.static.length} 个（可以移除）
- 动态样式: ${results.dynamic.length} 个（需要保留）
- 混合样式: ${results.mixed.length} 个（部分可移除）

## 🎯 优化机会

可以优化的内联样式数量: **${results.static.length + results.mixed.length}** 个

---

## 📝 详细分析

`;

  // 静态样式（优先处理）
  if (results.static.length > 0) {
    report += `### 1. 静态内联样式（${results.static.length}个）- 建议全部移除\n\n`;
    report += '这些样式完全是静态的，应该移到CSS文件中。\n\n';
    
    results.static.forEach((item, index) => {
      report += `#### ${index + 1}. ${item.file} (行 ${item.line})\n`;
      report += '```html\n';
      report += `style="${item.style}"\n`;
      report += '```\n';
      report += `**${item.suggestion}**\n\n`;
    });
  }
  
  // 混合样式（部分可优化）
  if (results.mixed.length > 0) {
    report += `### 2. 混合内联样式（${results.mixed.length}个）- 部分可优化\n\n`;
    report += '这些样式包含动态和静态部分，静态部分可以提取。\n\n';
    
    results.mixed.forEach((item, index) => {
      report += `#### ${index + 1}. ${item.file} (行 ${item.line})\n`;
      report += '```html\n';
      report += `style="${item.style}"\n`;
      report += '```\n';
      report += `**${item.suggestion}**\n\n`;
    });
  }
  
  // 动态样式（保留）
  if (results.dynamic.length > 0) {
    report += `### 3. 动态内联样式（${results.dynamic.length}个）- 需要保留\n\n`;
    report += '这些样式是动态的，必须保留在模板中。\n\n';
    
    // 只显示前10个作为示例
    const samples = results.dynamic.slice(0, 10);
    samples.forEach((item, index) => {
      report += `#### 示例 ${index + 1}. ${item.file}\n`;
      report += '```html\n';
      report += `style="${item.style}"\n`;
      report += '```\n\n';
    });
    
    if (results.dynamic.length > 10) {
      report += `\n... 还有 ${results.dynamic.length - 10} 个动态样式\n`;
    }
  }

  // 添加优化建议
  report += `\n## 🚀 优化建议

### 对于静态内联样式：
1. 创建对应的CSS类
2. 将样式移到.scss文件
3. 在模板中使用class替代style

### 对于混合样式：
1. 提取静态部分到CSS类
2. 只保留动态部分在style中
3. 使用class和style组合

### 示例优化：

**优化前：**
\`\`\`html
<view style="padding: 20rpx; margin: 10rpx; background-color: {{color}};">
\`\`\`

**优化后：**
\`\`\`html
<!-- CSS中定义 .item-container { padding: 20rpx; margin: 10rpx; } -->
<view class="item-container" style="background-color: {{color}};">
\`\`\`

## 📋 行动计划

1. **第一步**：处理所有静态内联样式（${results.static.length}个）
2. **第二步**：优化混合样式中的静态部分（${results.mixed.length}个）
3. **第三步**：代码审查，确保功能正常
`;

  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🔍 内联样式分析工具\n');
console.log('扫描中...\n');

const projectRoot = path.join(__dirname, '..', 'miniprogram');
scanDirectory(projectRoot);

console.log('\n✅ 扫描完成！\n');
console.log('📊 统计信息:');
console.log(`   - 文件数: ${totalFiles}`);
console.log(`   - 内联样式总数: ${totalInlineStyles}`);
console.log(`   - 静态: ${results.static.length}`);
console.log(`   - 动态: ${results.dynamic.length}`);
console.log(`   - 混合: ${results.mixed.length}`);

const reportPath = generateReport();
console.log(`\n📄 详细报告: ${reportPath}`);
console.log('\n💡 建议优先处理静态内联样式！');
