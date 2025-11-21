#!/usr/bin/env node

/**
 * 代码规范检查脚本
 * 根据项目开发规范检查文件命名、组件命名、变量函数命名
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 需要检查的目录
  checkDirs: [
    'miniprogram',
    'cloudfunctions'
  ],
  // 排除的目录
  excludeDirs: [
    'node_modules',
    'miniprogram_npm',
    '.git',
    'typings'
  ],
  // 需要检查的文件扩展名
  fileExtensions: ['.ts', '.js', '.wxml', '.wxss', '.scss', '.json']
};

// 规范检查结果
const results = {
  fileNaming: { errors: [], warnings: [] },
  componentNaming: { errors: [], warnings: [] },
  variableNaming: { errors: [], warnings: [] },
  classNaming: { errors: [], warnings: [] },
  functionNaming: { errors: [], warnings: [] }
};

// 正则表达式
const PATTERNS = {
  // kebab-case: 文件名和组件名
  kebabCase: /^[a-z]+(-[a-z]+)*$/,
  // camelCase: 变量和函数名
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  // PascalCase: 类名和接口名
  pascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  // 匹配类定义
  classDefinition: /(?:class|interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
  // 匹配函数定义
  functionDefinition: /(?:function\s+|const\s+|let\s+|var\s+)([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_][a-zA-Z0-9_]*)\s*=>|=\s*function|\()/g,
  // 匹配变量定义
  variableDefinition: /(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?::|=)/g,
  // 匹配组件定义（小程序特有）
  componentDefinition: /Component\s*\({/g,
  // 匹配Page定义（小程序特有）
  pageDefinition: /Page\s*\({/g
};

/**
 * 检查文件命名规范
 */
function checkFileNaming(filePath) {
  const fileName = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  
  // 跳过一些特殊文件
  const specialFiles = ['app', 'project.config', 'sitemap', 'package', 'package-lock', 'tsconfig'];
  if (specialFiles.includes(fileName)) {
    return;
  }
  
  // 检查页面和组件文件（.ts, .js, .wxml, .wxss）
  if (['.ts', '.js', '.wxml', '.wxss', '.scss'].includes(ext)) {
    // 排除测试文件和特殊文件
    if (fileName.includes('.test') || fileName.includes('.spec') || fileName.includes('.d')) {
      return;
    }
    
    // 检查是否符合 kebab-case
    if (!PATTERNS.kebabCase.test(fileName) && !fileName.match(/^[A-Z]/)) {
      // 如果是大写开头的文件（可能是类文件），给出警告而不是错误
      if (fileName.match(/^[A-Z]/)) {
        results.fileNaming.warnings.push({
          file: filePath,
          message: `文件名 "${fileName}" 应使用 kebab-case 命名（如 ${toKebabCase(fileName)}）`
        });
      } else {
        results.fileNaming.errors.push({
          file: filePath,
          message: `文件名 "${fileName}" 不符合 kebab-case 规范`
        });
      }
    }
  }
}

/**
 * 检查TypeScript/JavaScript代码规范
 */
function checkCodeNaming(filePath, content) {
  const ext = path.extname(filePath);
  
  if (!['.ts', '.js'].includes(ext)) {
    return;
  }
  
  // 移除注释，避免误判
  const cleanContent = removeComments(content);
  
  // 检查类和接口命名（PascalCase）
  let match;
  while ((match = PATTERNS.classDefinition.exec(cleanContent)) !== null) {
    const name = match[1];
    if (!PATTERNS.pascalCase.test(name)) {
      results.classNaming.errors.push({
        file: filePath,
        name: name,
        message: `类/接口名 "${name}" 应使用 PascalCase 命名`
      });
    }
  }
  
  // 检查函数命名（camelCase）
  PATTERNS.functionDefinition.lastIndex = 0;
  while ((match = PATTERNS.functionDefinition.exec(cleanContent)) !== null) {
    const name = match[1];
    // 排除构造函数、生命周期函数和特殊函数
    const specialFunctions = [
      'onLoad', 'onShow', 'onHide', 'onUnload', 'onReady',
      'onPullDownRefresh', 'onReachBottom', 'onShareAppMessage',
      'created', 'attached', 'ready', 'moved', 'detached',
      'Page', 'Component', 'App', 'getApp', '_'
    ];
    
    if (!specialFunctions.includes(name) && !name.startsWith('_')) {
      if (!PATTERNS.camelCase.test(name) && !PATTERNS.pascalCase.test(name)) {
        results.functionNaming.errors.push({
          file: filePath,
          name: name,
          message: `函数名 "${name}" 应使用 camelCase 命名`
        });
      }
    }
  }
  
  // 检查变量命名（camelCase）
  PATTERNS.variableDefinition.lastIndex = 0;
  while ((match = PATTERNS.variableDefinition.exec(cleanContent)) !== null) {
    const name = match[1];
    // 排除常量（全大写）和特殊变量
    if (!name.match(/^[A-Z_]+$/) && !name.startsWith('_')) {
      if (!PATTERNS.camelCase.test(name) && !PATTERNS.pascalCase.test(name)) {
        // 如果是PascalCase（可能是类的实例），给警告
        if (PATTERNS.pascalCase.test(name)) {
          results.variableNaming.warnings.push({
            file: filePath,
            name: name,
            message: `变量名 "${name}" 建议使用 camelCase 命名`
          });
        } else {
          results.variableNaming.errors.push({
            file: filePath,
            name: name,
            message: `变量名 "${name}" 应使用 camelCase 命名`
          });
        }
      }
    }
  }
  
  // 检查组件文件命名
  if (PATTERNS.componentDefinition.test(cleanContent)) {
    const dirName = path.basename(path.dirname(filePath));
    if (!PATTERNS.kebabCase.test(dirName)) {
      results.componentNaming.errors.push({
        file: filePath,
        message: `组件目录名 "${dirName}" 应使用 kebab-case 命名`
      });
    }
  }
}

/**
 * 移除注释
 */
function removeComments(content) {
  // 移除单行注释
  content = content.replace(/\/\/.*$/gm, '');
  // 移除多行注释
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  return content;
}

/**
 * 转换为 kebab-case
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/_/g, '-');
}

/**
 * 递归检查目录
 */
function checkDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);
  
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    // 跳过排除的目录
    if (stat.isDirectory()) {
      if (CONFIG.excludeDirs.includes(item)) {
        return;
      }
      checkDirectory(fullPath);
    } else {
      // 检查文件扩展名
      const ext = path.extname(item);
      if (CONFIG.fileExtensions.includes(ext)) {
        // 检查文件命名
        checkFileNaming(fullPath);
        
        // 检查代码内容
        if (['.ts', '.js'].includes(ext)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          checkCodeNaming(fullPath, content);
        }
      }
    }
  });
}

/**
 * 打印结果
 */
function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 代码规范检查结果');
  console.log('='.repeat(60));
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  // 打印各类检查结果
  const categories = [
    { name: '文件命名', key: 'fileNaming', emoji: '📁' },
    { name: '组件命名', key: 'componentNaming', emoji: '🧩' },
    { name: '类/接口命名', key: 'classNaming', emoji: '📦' },
    { name: '函数命名', key: 'functionNaming', emoji: '⚡' },
    { name: '变量命名', key: 'variableNaming', emoji: '📌' }
  ];
  
  categories.forEach(category => {
    const result = results[category.key];
    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.log(`\n${category.emoji} ${category.name}:`);
      
      // 打印错误
      if (result.errors.length > 0) {
        console.log(`  ❌ 错误 (${result.errors.length}):`);
        result.errors.slice(0, 10).forEach(error => {
          const filePath = error.file ? path.relative(process.cwd(), error.file) : '';
          if (error.name) {
            console.log(`    - ${filePath}: ${error.name} - ${error.message}`);
          } else {
            console.log(`    - ${filePath}: ${error.message}`);
          }
        });
        if (result.errors.length > 10) {
          console.log(`    ... 还有 ${result.errors.length - 10} 个错误`);
        }
        totalErrors += result.errors.length;
      }
      
      // 打印警告
      if (result.warnings.length > 0) {
        console.log(`  ⚠️  警告 (${result.warnings.length}):`);
        result.warnings.slice(0, 5).forEach(warning => {
          const filePath = warning.file ? path.relative(process.cwd(), warning.file) : '';
          if (warning.name) {
            console.log(`    - ${filePath}: ${warning.name} - ${warning.message}`);
          } else {
            console.log(`    - ${filePath}: ${warning.message}`);
          }
        });
        if (result.warnings.length > 5) {
          console.log(`    ... 还有 ${result.warnings.length - 5} 个警告`);
        }
        totalWarnings += result.warnings.length;
      }
    }
  });
  
  // 打印总结
  console.log('\n' + '-'.repeat(60));
  console.log('📊 总结:');
  console.log(`  错误总数: ${totalErrors}`);
  console.log(`  警告总数: ${totalWarnings}`);
  
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('\n✅ 恭喜！代码完全符合命名规范！');
  } else if (totalErrors === 0) {
    console.log('\n⚠️  代码基本符合规范，但有一些警告需要关注。');
  } else {
    console.log('\n❌ 发现代码规范问题，请根据错误信息进行修正。');
    console.log('\n建议：');
    console.log('  1. 文件和组件使用 kebab-case 命名（如 user-info）');
    console.log('  2. 变量和函数使用 camelCase 命名（如 userName）');
    console.log('  3. 类和接口使用 PascalCase 命名（如 UserInfo）');
  }
  
  console.log('='.repeat(60) + '\n');
  
  // 返回是否有错误（用于CI/CD）
  return totalErrors === 0;
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始检查代码规范...\n');
  
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
  
  // 打印结果
  const success = printResults();
  
  // 如果有错误，退出码设为1
  process.exit(success ? 0 : 1);
}

// 执行主函数
main();
