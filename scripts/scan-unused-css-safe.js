#!/usr/bin/env node

/**
 * 安全的CSS扫描脚本 - 只扫描不删除
 * 生成详细报告，供人工审查
 */

const fs = require('fs');
const path = require('path');

// 从UNUSED-CSS-REPORT.md读取的未使用类列表（前100个）
const UNUSED_CLASSES = [
  'abnormal-info', 'abnormal-items', 'action-bar', 'action-grid',
  'action-icon-wrapper', 'action-item', 'action-label', 'action-row',
  'action-section', 'active', 'add-btn-wrapper', 'add-medication-content',
  'adjust-plan-content', 'ai-count-loading', 'alert-high', 'alert-low',
  'alert-medium', 'analysis-card', 'analysis-header', 'analysis-stats',
  'analysis-trend', 'analysis-value', 'animated-entry', 'app',
  'appetite-excellent', 'appetite-fair', 'appetite-good', 'appetite-option',
  'appetite-options', 'appetite-poor', 'approval-footer', 'approval-icon',
  'approval-time', 'article-desc', 'article-item-content', 'article-item-top'
];

// 保护列表 - 这些类名即使未检测到使用也不应删除
const PROTECTED_PATTERNS = [
  /^active/, /^hover/, /^disabled/, /^loading/, /^error/,
  /^success/, /^warning/, /^hidden/, /^show/, /^is-/,
  /^has-/, /^t-/, // TDesign组件类
];

const scanResults = [];
let totalFiles = 0;
let totalOccurrences = 0;

/**
 * 查找类名在文件中的行号
 */
function findLineNumbers(content, className) {
  const lines = content.split('\n');
  const lineNumbers = [];
  
  lines.forEach((line, index) => {
    if (line.includes(`.${className}`)) {
      lineNumbers.push({
        line: index + 1,
        content: line.trim(),
        context: getContext(lines, index)
      });
    }
  });
  
  return lineNumbers;
}

/**
 * 获取上下文（前后各2行）
 */
function getContext(lines, index) {
  const context = [];
  for (let i = Math.max(0, index - 2); i <= Math.min(lines.length - 1, index + 2); i++) {
    context.push({
      line: i + 1,
      content: lines[i],
      current: i === index
    });
  }
  return context;
}

/**
 * 判断是否应该保护这个类
 */
function shouldProtect(className) {
  return PROTECTED_PATTERNS.some(pattern => pattern.test(className));
}

/**
 * 扫描CSS文件
 */
function scanCssFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const fileResults = [];
  
  UNUSED_CLASSES.forEach(className => {
    if (shouldProtect(className)) {
      return;
    }
    
    const occurrences = findLineNumbers(content, className);
    if (occurrences.length > 0) {
      totalOccurrences += occurrences.length;
      fileResults.push({
        className,
        occurrences
      });
    }
  });
  
  if (fileResults.length > 0) {
    totalFiles++;
    scanResults.push({
      file: relativePath,
      classes: fileResults
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
      if (file === 'node_modules' || file === 'backups' || file === '.git') {
        return;
      }
      scanDirectory(fullPath);
    } else if (file.endsWith('.scss') || file.endsWith('.css') || file.endsWith('.wxss')) {
      process.stdout.write(`\r扫描中... ${fullPath.slice(-50)}`);
      scanCssFile(fullPath);
    }
  });
}

/**
 * 生成详细报告
 */
function generateDetailedReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `CSS-SCAN-REPORT-${timestamp.slice(0, 10)}.md`);
  
  let report = `# CSS未使用类扫描报告

生成时间: ${new Date().toLocaleString()}

## 📊 扫描统计

- 扫描类数: ${UNUSED_CLASSES.length}
- 发现文件数: ${totalFiles}
- 总出现次数: ${totalOccurrences}

## ⚠️ 安全提醒

以下类出现在CSS文件中，但可能未被HTML/JS使用。
**请人工审查后再决定是否删除！**

---

`;

  // 按文件分组显示
  scanResults.forEach(fileResult => {
    report += `\n### 📄 ${fileResult.file}\n\n`;
    
    fileResult.classes.forEach(classResult => {
      report += `#### \`.${classResult.className}\`\n\n`;
      
      classResult.occurrences.forEach(occ => {
        report += `**行 ${occ.line}:**\n`;
        report += '```scss\n';
        occ.context.forEach(ctx => {
          const marker = ctx.current ? '>>> ' : '    ';
          report += `${marker}${ctx.line}: ${ctx.content}\n`;
        });
        report += '```\n\n';
      });
    });
  });

  // 添加安全删除建议
  report += `\n## 🛡️ 安全删除建议

### 可以安全删除的类（低风险）
以下类可能真的未使用：
`;

  const safeToDelete = [];
  const riskyToDelete = [];
  
  scanResults.forEach(fileResult => {
    fileResult.classes.forEach(classResult => {
      const className = classResult.className;
      const occCount = classResult.occurrences.length;
      
      // 简单判断风险等级
      if (occCount === 1 && !className.includes('-')) {
        safeToDelete.push(className);
      } else {
        riskyToDelete.push(className);
      }
    });
  });

  report += '\n' + safeToDelete.map(c => `- ${c}`).join('\n');

  report += `\n\n### 需要谨慎评估的类（高风险）
以下类可能被动态使用：
`;
  
  report += '\n' + riskyToDelete.map(c => `- ${c}`).join('\n');

  report += `\n\n## 📝 手动清理步骤

1. 打开每个文件
2. 搜索标记的类名
3. 确认是否真的未使用
4. 手动删除相关代码
5. 测试功能是否正常

## ⚡ 快速命令

\`\`\`bash
# 在VSCode中搜索特定类
# 使用正则表达式: \\.className\\b
\`\`\`
`;

  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🔍 CSS未使用类安全扫描工具\n');
console.log('📝 本工具只扫描和报告，不会修改任何文件\n');
console.log('扫描中...\n');

const projectRoot = path.join(__dirname, '..');
scanDirectory(projectRoot);

console.log('\n\n✅ 扫描完成！\n');
console.log(`📊 统计信息:`);
console.log(`   - 发现文件: ${totalFiles}`);
console.log(`   - 总出现次数: ${totalOccurrences}`);

const reportPath = generateDetailedReport();
console.log(`\n📄 详细报告已生成: ${reportPath}`);
console.log('\n💡 请查看报告，人工审查后再决定是否删除');
console.log('⚠️  不要盲目删除，某些类可能被动态使用！');
