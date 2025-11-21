#!/usr/bin/env node

/**
 * 样式规范检查脚本
 * 根据项目开发规范检查内联样式、!important、未使用的CSS
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 需要检查的目录
  checkDirs: [
    'miniprogram'
  ],
  // 排除的目录
  excludeDirs: [
    'node_modules',
    'miniprogram_npm',
    '.git',
    'typings'
  ]
};

// 检查结果
const results = {
  inlineStyles: { errors: [], warnings: [] },
  importantUsage: { errors: [], warnings: [] },
  unusedClasses: { errors: [], warnings: [] },
  styleIssues: { errors: [], warnings: [] }
};

// 收集的CSS类名
const cssClasses = new Map(); // className -> file[]
const usedClasses = new Map(); // className -> file[]

/**
 * 检查WXML文件中的内联样式
 */
function checkInlineStyles(filePath, content) {
  const lines = content.split('\n');
  const inlineStylePattern = /style\s*=\s*["']([^"']+)["']/gi;
  
  lines.forEach((line, index) => {
    const matches = line.match(inlineStylePattern);
    if (matches) {
      matches.forEach(match => {
        const styleContent = match.match(/style\s*=\s*["']([^"']+)["']/i)[1];
        
        // 检查是否是动态样式（包含{{}}）
        if (styleContent.includes('{{')) {
          // 动态样式给警告
          results.inlineStyles.warnings.push({
            file: filePath,
            line: index + 1,
            content: match,
            message: '使用了动态内联样式，建议使用类名切换'
          });
        } else {
          // 静态内联样式给错误
          results.inlineStyles.errors.push({
            file: filePath,
            line: index + 1,
            content: match,
            message: '❌ 使用了静态内联样式，应该移到样式文件中'
          });
        }
      });
    }
  });
}

/**
 * 检查CSS/SCSS文件中的!important使用
 */
function checkImportantUsage(filePath, content) {
  const lines = content.split('\n');
  const importantPattern = /!important/gi;
  
  lines.forEach((line, index) => {
    if (importantPattern.test(line)) {
      // 检查是否在注释中
      const cleanLine = line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '');
      if (cleanLine.includes('!important')) {
        results.importantUsage.errors.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          message: '❌ 使用了 !important，应避免使用'
        });
      }
    }
  });
}

/**
 * 收集CSS类名
 */
function collectCSSClasses(filePath, content) {
  // 匹配类选择器
  const classPattern = /\.([a-zA-Z0-9_-]+)\s*[{,\s]/g;
  let match;
  
  while ((match = classPattern.exec(content)) !== null) {
    const className = match[1];
    if (!cssClasses.has(className)) {
      cssClasses.set(className, []);
    }
    cssClasses.get(className).push(filePath);
  }
}

/**
 * 收集WXML中使用的类名
 */
function collectUsedClasses(filePath, content) {
  // 匹配class属性
  const classAttrPattern = /class\s*=\s*["']([^"']+)["']/gi;
  let match;
  
  while ((match = classAttrPattern.exec(content)) !== null) {
    const classValue = match[1];
    
    // 处理动态类名
    if (classValue.includes('{{')) {
      // 尝试提取静态部分
      const staticClasses = classValue.split(/\{\{[^}]+\}\}/).filter(s => s.trim());
      staticClasses.forEach(classStr => {
        classStr.split(/\s+/).forEach(className => {
          if (className && !className.startsWith('{{')) {
            if (!usedClasses.has(className)) {
              usedClasses.set(className, []);
            }
            usedClasses.get(className).push(filePath);
          }
        });
      });
    } else {
      // 静态类名
      classValue.split(/\s+/).forEach(className => {
        if (className) {
          if (!usedClasses.has(className)) {
            usedClasses.set(className, []);
          }
          usedClasses.get(className).push(filePath);
        }
      });
    }
  }
}

/**
 * 检查样式文件的其他问题
 */
function checkStyleIssues(filePath, content) {
  const lines = content.split('\n');
  
  // 检查选择器嵌套深度（SCSS）
  if (path.extname(filePath) === '.scss') {
    let nestingLevel = 0;
    const maxNesting = 3;
    
    lines.forEach((line, index) => {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      nestingLevel += openBraces - closeBraces;
      
      if (nestingLevel > maxNesting) {
        results.styleIssues.warnings.push({
          file: filePath,
          line: index + 1,
          message: `嵌套深度超过 ${maxNesting} 层，建议简化`
        });
      }
    });
  }
  
  // 检查颜色值格式
  const colorPattern = /#[0-9a-fA-F]{3,6}/g;
  lines.forEach((line, index) => {
    const matches = line.match(colorPattern);
    if (matches) {
      matches.forEach(color => {
        // 检查是否使用小写
        if (color !== color.toLowerCase()) {
          results.styleIssues.warnings.push({
            file: filePath,
            line: index + 1,
            content: color,
            message: `颜色值 "${color}" 建议使用小写`
          });
        }
      });
    }
  });
  
  // 检查是否有重复的属性定义
  const properties = new Map();
  let currentSelector = '';
  
  lines.forEach((line, index) => {
    // 简单检测选择器
    if (line.includes('{')) {
      currentSelector = line;
      properties.clear();
    } else if (line.includes('}')) {
      properties.clear();
    } else if (line.includes(':')) {
      const prop = line.split(':')[0].trim();
      if (prop && properties.has(prop)) {
        results.styleIssues.warnings.push({
          file: filePath,
          line: index + 1,
          content: prop,
          message: `属性 "${prop}" 可能重复定义`
        });
      }
      properties.set(prop, true);
    }
  });
}

/**
 * 递归检查目录
 */
function checkDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);
  
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!CONFIG.excludeDirs.includes(item)) {
        checkDirectory(fullPath);
      }
    } else {
      const ext = path.extname(item);
      
      // 检查WXML文件
      if (ext === '.wxml') {
        const content = fs.readFileSync(fullPath, 'utf8');
        checkInlineStyles(fullPath, content);
        collectUsedClasses(fullPath, content);
      }
      
      // 检查CSS/SCSS/WXSS文件
      if (['.css', '.scss', '.wxss'].includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        checkImportantUsage(fullPath, content);
        collectCSSClasses(fullPath, content);
        checkStyleIssues(fullPath, content);
      }
    }
  });
}

/**
 * 查找未使用的CSS类
 */
function findUnusedClasses() {
  cssClasses.forEach((files, className) => {
    if (!usedClasses.has(className)) {
      // 排除一些特殊的类名
      const specialClasses = [
        'container', 'wrapper', 'content', 'header', 'footer',
        'active', 'disabled', 'hidden', 'show', 'hide',
        'clearfix', 'ellipsis'
      ];
      
      if (!specialClasses.includes(className) && !className.startsWith('t-')) {
        results.unusedClasses.warnings.push({
          className: className,
          files: files.map(f => path.relative(process.cwd(), f)),
          message: `可能未使用的CSS类 "${className}"`
        });
      }
    }
  });
}

/**
 * 打印结果
 */
function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('🎨 样式规范检查结果');
  console.log('='.repeat(60));
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  // 内联样式
  if (results.inlineStyles.errors.length > 0 || results.inlineStyles.warnings.length > 0) {
    console.log('\n📐 内联样式:');
    
    if (results.inlineStyles.errors.length > 0) {
      console.log(`  ❌ 错误 (${results.inlineStyles.errors.length}):`);
      results.inlineStyles.errors.slice(0, 5).forEach(error => {
        const filePath = path.relative(process.cwd(), error.file);
        console.log(`    - ${filePath}:${error.line}`);
        console.log(`      ${error.message}`);
      });
      if (results.inlineStyles.errors.length > 5) {
        console.log(`    ... 还有 ${results.inlineStyles.errors.length - 5} 个错误`);
      }
      totalErrors += results.inlineStyles.errors.length;
    }
    
    if (results.inlineStyles.warnings.length > 0) {
      console.log(`  ⚠️  警告 (${results.inlineStyles.warnings.length}):`);
      results.inlineStyles.warnings.slice(0, 3).forEach(warning => {
        const filePath = path.relative(process.cwd(), warning.file);
        console.log(`    - ${filePath}:${warning.line}`);
        console.log(`      ${warning.message}`);
      });
      if (results.inlineStyles.warnings.length > 3) {
        console.log(`    ... 还有 ${results.inlineStyles.warnings.length - 3} 个警告`);
      }
      totalWarnings += results.inlineStyles.warnings.length;
    }
  }
  
  // !important 使用
  if (results.importantUsage.errors.length > 0) {
    console.log('\n⚠️  !important 使用:');
    console.log(`  ❌ 错误 (${results.importantUsage.errors.length}):`);
    results.importantUsage.errors.slice(0, 5).forEach(error => {
      const filePath = path.relative(process.cwd(), error.file);
      console.log(`    - ${filePath}:${error.line}`);
      console.log(`      ${error.content.substring(0, 50)}...`);
    });
    if (results.importantUsage.errors.length > 5) {
      console.log(`    ... 还有 ${results.importantUsage.errors.length - 5} 个错误`);
    }
    totalErrors += results.importantUsage.errors.length;
  }
  
  // 未使用的CSS类
  if (results.unusedClasses.warnings.length > 0) {
    console.log('\n🗑️  可能未使用的CSS类:');
    console.log(`  ⚠️  警告 (${results.unusedClasses.warnings.length}):`);
    results.unusedClasses.warnings.slice(0, 10).forEach(warning => {
      console.log(`    - ${warning.className}`);
      console.log(`      定义在: ${warning.files[0]}`);
    });
    if (results.unusedClasses.warnings.length > 10) {
      console.log(`    ... 还有 ${results.unusedClasses.warnings.length - 10} 个警告`);
    }
    totalWarnings += results.unusedClasses.warnings.length;
  }
  
  // 其他样式问题
  if (results.styleIssues.warnings.length > 0) {
    console.log('\n📝 其他样式问题:');
    console.log(`  ⚠️  警告 (${results.styleIssues.warnings.length}):`);
    results.styleIssues.warnings.slice(0, 5).forEach(warning => {
      const filePath = path.relative(process.cwd(), warning.file);
      console.log(`    - ${filePath}:${warning.line}`);
      console.log(`      ${warning.message}`);
    });
    if (results.styleIssues.warnings.length > 5) {
      console.log(`    ... 还有 ${results.styleIssues.warnings.length - 5} 个警告`);
    }
    totalWarnings += results.styleIssues.warnings.length;
  }
  
  // 打印总结
  console.log('\n' + '-'.repeat(60));
  console.log('📊 总结:');
  console.log(`  错误总数: ${totalErrors}`);
  console.log(`  警告总数: ${totalWarnings}`);
  console.log(`  检查的CSS类: ${cssClasses.size}`);
  console.log(`  使用的CSS类: ${usedClasses.size}`);
  
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('\n✅ 恭喜！样式完全符合规范！');
  } else if (totalErrors === 0) {
    console.log('\n⚠️  样式基本符合规范，但有一些警告需要关注。');
  } else {
    console.log('\n❌ 发现样式规范问题，请根据错误信息进行修正。');
    console.log('\n建议：');
    console.log('  1. 避免使用内联样式，将样式移到样式文件中');
    console.log('  2. 避免使用 !important，通过提高选择器优先级解决');
    console.log('  3. 定期清理未使用的CSS类');
    console.log('  4. 保持样式文件整洁有序');
  }
  
  console.log('='.repeat(60) + '\n');
  
  return totalErrors === 0;
}

/**
 * 主函数
 */
function main() {
  console.log('🎨 开始检查样式规范...\n');
  
  // 检查每个配置的目录
  CONFIG.checkDirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      console.log(`正在检查: ${dir}/`);
      checkDirectory(dirPath);
    } else {
      console.log(`⚠️  目录不存在: ${dir}/`);
    }
  });
  
  // 查找未使用的类
  findUnusedClasses();
  
  // 打印结果
  const success = printResults();
  
  process.exit(success ? 0 : 1);
}

// 执行主函数
main();
