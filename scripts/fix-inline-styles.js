#!/usr/bin/env node

/**
 * 修复内联样式
 * 将内联样式移到样式文件中
 */

const fs = require('fs');
const path = require('path');

// 统计信息
const stats = {
  filesScanned: 0,
  filesModified: 0,
  inlineStylesFound: 0,
  inlineStylesFixed: 0,
  dynamicStylesFound: 0
};

// 存储找到的样式
const collectedStyles = new Map();

// 样式类名生成器
let classNameCounter = 1;
function generateClassName(componentName) {
  return `${componentName}-style-${classNameCounter++}`;
}

// 提取组件名
function getComponentName(filePath) {
  const baseName = path.basename(filePath, '.wxml');
  const dirName = path.basename(path.dirname(filePath));
  return dirName === 'pages' ? baseName : dirName;
}

// 分析WXML文件中的内联样式
function analyzeWXML(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const componentName = getComponentName(filePath);
  
  // 匹配静态内联样式
  const staticStyleRegex = /style="([^"]+)"/g;
  let match;
  const styles = [];
  
  while ((match = staticStyleRegex.exec(content)) !== null) {
    const styleContent = match[1];
    
    // 检查是否是动态样式
    if (styleContent.includes('{{')) {
      stats.dynamicStylesFound++;
      console.log(`  ⚠️  动态样式: ${filePath}`);
      console.log(`     ${match[0].substring(0, 50)}...`);
    } else {
      stats.inlineStylesFound++;
      styles.push({
        original: match[0],
        styleContent: styleContent,
        position: match.index
      });
    }
  }
  
  if (styles.length > 0) {
    collectedStyles.set(filePath, {
      componentName,
      styles
    });
  }
  
  return styles.length;
}

// 生成CSS类
function generateCSSClasses(componentStyles) {
  const cssClasses = [];
  
  componentStyles.styles.forEach((style, index) => {
    const className = generateClassName(componentStyles.componentName);
    const cssRule = `.${className} {\n  ${style.styleContent.replace(/;/g, ';\n  ').trim()}\n}`;
    
    cssClasses.push({
      className,
      cssRule,
      originalStyle: style
    });
  });
  
  return cssClasses;
}

// 修复内联样式
function fixInlineStyles(dryRun = true) {
  collectedStyles.forEach((componentStyles, filePath) => {
    // 生成CSS类
    const cssClasses = generateCSSClasses(componentStyles);
    
    // 读取WXML文件
    let wxmlContent = fs.readFileSync(filePath, 'utf8');
    
    // 确定样式文件路径
    const scssPath = filePath.replace('.wxml', '.scss');
    const wxssPath = filePath.replace('.wxml', '.wxss');
    const stylePath = fs.existsSync(scssPath) ? scssPath : wxssPath;
    
    // 准备样式内容
    let additionalStyles = '\n/* 从内联样式自动提取 */\n';
    
    // 替换内联样式为类名
    cssClasses.forEach(({ className, cssRule, originalStyle }) => {
      // 在WXML中替换
      const elementRegex = new RegExp(`(<[^>]+)(${originalStyle.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})([^>]*>)`, 'g');
      wxmlContent = wxmlContent.replace(elementRegex, (match, before, style, after) => {
        // 检查是否已有class属性
        if (before.includes('class=')) {
          // 添加到现有class
          return before.replace(/class="([^"]+)"/, `class="$1 ${className}"`) + after;
        } else {
          // 添加新的class属性
          return `${before} class="${className}"${after}`;
        }
      });
      
      // 收集CSS规则
      additionalStyles += cssRule + '\n\n';
      stats.inlineStylesFixed++;
    });
    
    if (!dryRun) {
      // 更新WXML文件
      fs.writeFileSync(filePath, wxmlContent, 'utf8');
      
      // 添加样式到样式文件
      if (fs.existsSync(stylePath)) {
        const currentStyles = fs.readFileSync(stylePath, 'utf8');
        fs.writeFileSync(stylePath, currentStyles + additionalStyles, 'utf8');
      } else {
        // 创建新的样式文件
        fs.writeFileSync(wxssPath, additionalStyles, 'utf8');
      }
      
      stats.filesModified++;
      console.log(`  ✅ 修复: ${path.relative(process.cwd(), filePath)}`);
    } else {
      console.log(`  📝 待修复: ${path.relative(process.cwd(), filePath)}`);
      console.log(`     将添加 ${cssClasses.length} 个CSS类`);
    }
  });
}

// 扫描目录
function scanDirectory() {
  const wxmlFiles = [];
  
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
      } else if (item.endsWith('.wxml')) {
        wxmlFiles.push(fullPath);
      }
    });
  }
  
  scanDir(path.join(process.cwd(), 'miniprogram'));
  
  wxmlFiles.forEach(file => {
    stats.filesScanned++;
    analyzeWXML(file);
  });
}

// 生成报告
function generateReport() {
  const report = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
内联样式修复报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 统计：
  • 扫描文件：${stats.filesScanned}
  • 内联样式：${stats.inlineStylesFound}
  • 动态样式：${stats.dynamicStylesFound}（需手动处理）
  • 已修复：${stats.inlineStylesFixed}
  • 修改文件：${stats.filesModified}

📝 建议：
  1. 动态样式建议使用条件类名替代
  2. 复杂样式建议提取为组件
  3. 修复后需要全面测试UI表现
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  
  console.log(report);
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');
  
  console.log('🔍 扫描内联样式...\n');
  
  try {
    // 1. 扫描文件
    scanDirectory();
    
    console.log(`\n📊 发现 ${stats.inlineStylesFound} 个静态内联样式\n`);
    
    if (stats.inlineStylesFound > 0) {
      // 2. 修复样式
      console.log(dryRun ? '🔍 预览模式（使用 --fix 参数执行修复）:\n' : '🔧 开始修复...\n');
      fixInlineStyles(dryRun);
    }
    
    // 3. 生成报告
    generateReport();
    
    if (dryRun && stats.inlineStylesFound > 0) {
      console.log('💡 使用 node scripts/fix-inline-styles.js --fix 执行修复');
    }
  } catch (error) {
    console.error('❌ 处理失败:', error.message);
    process.exit(1);
  }
}

// 执行
main();
