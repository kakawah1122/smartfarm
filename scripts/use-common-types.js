#!/usr/bin/env node

/**
 * 更新文件使用统一的类型定义
 * 将分散的类型定义改为引用common.d.ts
 */

const fs = require('fs');
const path = require('path');

// 修复统计
let totalUpdated = 0;
const filesModified = new Set();

/**
 * 检查是否已经导入了common类型
 */
function hasCommonImport(content) {
  return content.includes("from '../types/common'") || 
         content.includes("from '../../types/common'") ||
         content.includes("from '../../../types/common'");
}

/**
 * 计算相对路径
 */
function getRelativePathToTypes(filePath) {
  const fileDir = path.dirname(filePath);
  const typesPath = path.join(process.cwd(), 'miniprogram/types/common');
  let relativePath = path.relative(fileDir, typesPath);
  
  // 转换为正斜杠
  relativePath = relativePath.replace(/\\/g, '/');
  
  // 如果不是以..开头，添加./
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  
  return relativePath;
}

/**
 * 更新文件使用通用类型
 */
function updateFileTypes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  let modified = false;
  
  // 如果已经导入了common类型，跳过
  if (hasCommonImport(content)) {
    console.log(`   ℹ️  已使用通用类型，跳过`);
    return false;
  }
  
  // 检查是否定义了重复的类型
  const duplicateTypes = [
    /^type CustomEvent.*?=.*?WechatMiniprogram\.CustomEvent.*?$/gm,
    /^interface ErrorWithMessage\s*{[^}]*}/gm,
  ];
  
  let hasduplicates = false;
  duplicateTypes.forEach(pattern => {
    if (pattern.test(content)) {
      hasduplicates = true;
    }
  });
  
  if (!hasduplicates) {
    // 没有重复类型，检查是否使用了相关类型
    if (!content.includes('CustomEvent') && 
        !content.includes('ErrorWithMessage') &&
        !content.includes('Task') &&
        !content.includes('Batch')) {
      return false; // 没有使用相关类型，跳过
    }
  }
  
  // 移除本地定义的重复类型
  const typesToRemove = [
    // CustomEvent定义
    /\/\/ 类型定义.*?\n?type CustomEvent.*?=.*?WechatMiniprogram\.CustomEvent.*?;?\n?/g,
    /type CustomEvent.*?=.*?WechatMiniprogram\.CustomEvent.*?;?\n?/g,
    // ErrorWithMessage定义
    /interface ErrorWithMessage\s*{\s*message:\s*string;?\s*\[key:\s*string\]:\s*any;?\s*}\n?/g,
    // BaseEvent定义
    /type BaseEvent\s*=\s*WechatMiniprogram\.BaseEvent;?\n?/g,
  ];
  
  typesToRemove.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      modified = true;
    }
  });
  
  if (modified) {
    // 添加通用类型导入
    const importPath = getRelativePathToTypes(filePath);
    const importStatement = `import type { CustomEvent, ErrorWithMessage, Task, Batch } from '${importPath}';\n`;
    
    // 找到合适的位置插入import
    const firstImportIndex = content.search(/^import /m);
    if (firstImportIndex !== -1) {
      // 在第一个import之前插入
      content = content.substring(0, firstImportIndex) + 
                importStatement + 
                content.substring(firstImportIndex);
    } else {
      // 如果没有import，在文件开头插入（跳过注释）
      const codeStartIndex = content.search(/^[^\/\*]/m);
      if (codeStartIndex !== -1) {
        content = content.substring(0, codeStartIndex) + 
                  importStatement + '\n' + 
                  content.substring(codeStartIndex);
      } else {
        content = importStatement + '\n' + content;
      }
    }
    
    // 保存文件
    fs.writeFileSync(filePath, content);
    filesModified.add(relativePath);
    totalUpdated++;
    console.log(`   ✓ 更新为使用通用类型`);
  }
  
  return modified;
}

/**
 * 生成报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `USE-COMMON-TYPES-${timestamp.slice(0, 10)}.md`);
  
  let report = `# 通用类型使用报告

生成时间: ${new Date().toLocaleString()}

## 📊 更新统计

- 更新文件数: ${filesModified.size}个
- 移除重复类型定义: ${totalUpdated}处

## 📝 更新的文件

`;
  
  Array.from(filesModified).forEach((file, index) => {
    report += `${index + 1}. ${file}\n`;
  });
  
  report += `\n## ✅ 改进效果

1. **减少代码重复** - 移除了重复的类型定义
2. **统一类型管理** - 所有类型定义集中在一处
3. **易于维护** - 修改类型只需要改一处
4. **提高一致性** - 确保所有文件使用相同的类型

## 📁 类型定义位置

所有通用类型定义现在位于：
\`miniprogram/types/common.d.ts\`

## 💡 后续建议

1. 继续添加更多通用类型到common.d.ts
2. 为特定模块创建专门的类型文件
3. 逐步替换剩余的any类型
`;
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🔧 更新文件使用通用类型定义\n');

// 目标文件
const targetFiles = [
  'miniprogram/pages/health/health.ts',
  'miniprogram/pages/index/index.ts',
  'miniprogram/pages/production/production.ts',
  'miniprogram/pages/profile/profile.ts'
];

console.log('📋 扫描目标文件...\n');

targetFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${file}`);
    return;
  }
  
  console.log(`📄 处理: ${file}`);
  updateFileTypes(filePath);
});

console.log('\n✅ 更新完成！');
console.log(`📊 统计：`);
console.log(`   - 更新文件: ${filesModified.size}个`);

if (filesModified.size > 0) {
  const reportPath = generateReport();
  console.log(`\n📄 报告已生成: ${reportPath}`);
  
  console.log('\n💡 提示:');
  console.log('   1. 编译检查是否有类型错误');
  console.log('   2. 测试功能是否正常');
  console.log('   3. 继续添加更多类型定义');
}
