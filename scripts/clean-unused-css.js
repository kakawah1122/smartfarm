#!/usr/bin/env node

/**
 * 清理未使用的CSS类
 * 扫描所有WXML文件，找出实际使用的CSS类，并清理未使用的
 */

const fs = require('fs');
const path = require('path');

// 统计信息
const stats = {
  totalCSSClasses: 0,
  usedClasses: new Set(),
  unusedClasses: new Set(),
  filesScanned: 0,
  filesModified: 0
};

// 提取WXML中的类名
function extractClassesFromWXML(content) {
  const classes = new Set();
  
  // 匹配 class="xxx"
  const staticClassRegex = /class\s*=\s*"([^"]+)"/g;
  let match;
  while ((match = staticClassRegex.exec(content)) !== null) {
    const classString = match[1];
    classString.split(/\s+/).forEach(cls => {
      if (cls) classes.add(cls);
    });
  }
  
  // 匹配动态类名 class="{{xxx}}"
  const dynamicClassRegex = /class\s*=\s*"\{\{([^}]+)\}\}"/g;
  while ((match = dynamicClassRegex.exec(content)) !== null) {
    // 对于动态类名，标记为可能使用
    classes.add('__dynamic__');
  }
  
  // 匹配混合类名 class="static {{dynamic}}"
  const mixedClassRegex = /class\s*=\s*"([^"]*\{\{[^}]+\}\}[^"]*)"/g;
  while ((match = mixedClassRegex.exec(content)) !== null) {
    const classString = match[1];
    // 提取静态部分
    const staticParts = classString.replace(/\{\{[^}]+\}\}/g, ' ').split(/\s+/);
    staticParts.forEach(cls => {
      if (cls) classes.add(cls);
    });
  }
  
  return classes;
}

// 提取CSS中的类名
function extractClassesFromCSS(content) {
  const classes = new Set();
  
  // 匹配 .class-name
  const classRegex = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    classes.add(match[1]);
  }
  
  return classes;
}

// 扫描所有WXML文件，收集使用的类
function collectUsedClasses() {
  const wxmlFiles = [];
  
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 跳过node_modules等
        if (!['node_modules', '.git', 'miniprogram_npm'].includes(item)) {
          scanDir(fullPath);
        }
      } else if (item.endsWith('.wxml')) {
        wxmlFiles.push(fullPath);
      }
    });
  }
  
  scanDir(path.join(process.cwd(), 'miniprogram'));
  
  // 提取所有WXML中的类名
  wxmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const classes = extractClassesFromWXML(content);
    classes.forEach(cls => stats.usedClasses.add(cls));
    stats.filesScanned++;
  });
  
  console.log(`✅ 扫描了 ${stats.filesScanned} 个WXML文件`);
  console.log(`✅ 找到 ${stats.usedClasses.size} 个使用的CSS类`);
}

// 分析CSS文件
function analyzeCSSFiles() {
  const cssFiles = [];
  
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'miniprogram_npm'].includes(item)) {
          scanDir(fullPath);
        }
      } else if (item.endsWith('.scss') || item.endsWith('.wxss')) {
        cssFiles.push(fullPath);
      }
    });
  }
  
  scanDir(path.join(process.cwd(), 'miniprogram'));
  
  // 收集所有CSS类
  const allClasses = new Set();
  cssFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const classes = extractClassesFromCSS(content);
    classes.forEach(cls => allClasses.add(cls));
  });
  
  stats.totalCSSClasses = allClasses.size;
  
  // 找出未使用的类
  allClasses.forEach(cls => {
    if (!stats.usedClasses.has(cls) && !isSystemClass(cls)) {
      stats.unusedClasses.add(cls);
    }
  });
  
  console.log(`✅ 分析了 ${cssFiles.length} 个样式文件`);
  console.log(`✅ 找到 ${stats.totalCSSClasses} 个CSS类定义`);
  console.log(`⚠️  发现 ${stats.unusedClasses.size} 个可能未使用的CSS类`);
}

// 判断是否是系统或框架类
function isSystemClass(className) {
  const systemPrefixes = [
    't-', // TDesign组件
    'wx-', // 微信组件
    'weui-', // WeUI组件
    'van-', // Vant组件
    'iconfont', // 图标字体
    'icon-', // 图标
    'fa-' // FontAwesome
  ];
  
  return systemPrefixes.some(prefix => className.startsWith(prefix));
}

// 生成报告
function generateReport() {
  const reportPath = path.join(process.cwd(), 'docs/UNUSED-CSS-REPORT.md');
  
  let report = `# 未使用CSS类清理报告

生成时间：${new Date().toLocaleString('zh-CN')}

## 统计概览

- 扫描文件数：${stats.filesScanned}
- CSS类总数：${stats.totalCSSClasses}
- 使用的类：${stats.usedClasses.size}
- 未使用的类：${stats.unusedClasses.size}
- 使用率：${((stats.usedClasses.size / stats.totalCSSClasses) * 100).toFixed(2)}%

## 未使用的CSS类列表（前100个）

`;

  const unusedArray = Array.from(stats.unusedClasses).sort();
  const displayCount = Math.min(100, unusedArray.length);
  
  for (let i = 0; i < displayCount; i++) {
    report += `- ${unusedArray[i]}\n`;
  }
  
  if (unusedArray.length > 100) {
    report += `\n... 还有 ${unusedArray.length - 100} 个未使用的类\n`;
  }
  
  report += `
## 建议

1. **谨慎删除**：某些类可能通过动态方式使用，删除前请确认
2. **批量处理**：可以使用PurgeCSS等工具批量清理
3. **备份文件**：清理前请备份样式文件
4. **测试验证**：清理后需要全面测试功能

## 注意事项

- 动态生成的类名可能被误判为未使用
- 条件渲染的类名可能被漏掉
- 建议手动确认后再删除
`;
  
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\n📄 报告已生成：docs/UNUSED-CSS-REPORT.md`);
}

// 主函数
function main() {
  console.log('🧹 开始清理未使用的CSS类...\n');
  
  try {
    // 1. 收集使用的类
    collectUsedClasses();
    
    // 2. 分析CSS文件
    analyzeCSSFiles();
    
    // 3. 生成报告
    generateReport();
    
    console.log('\n✅ 分析完成！');
    console.log('📝 请查看生成的报告，谨慎删除未使用的类');
  } catch (error) {
    console.error('❌ 分析失败:', error.message);
    process.exit(1);
  }
}

// 执行
main();
