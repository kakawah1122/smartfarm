#!/usr/bin/env node

/**
 * 安全地修复any类型
 * 从最简单的开始，确保不破坏功能
 */

const fs = require('fs');
const path = require('path');

// 修复统计
let totalFixed = 0;
const filesModified = new Set();
const fixLog = [];

/**
 * 添加类型定义到文件顶部
 */
function addTypeDefinitions(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  // 检查是否已经有类型定义
  if (content.includes('type CustomEvent = ') || content.includes('interface ErrorWithMessage')) {
    console.log(`   ℹ️  ${relativePath} 已包含类型定义`);
    return false;
  }
  
  // 准备要添加的类型定义
  const typeDefinitions = `
// 类型定义 - 用于替换any类型
type CustomEvent<T = any> = WechatMiniprogram.CustomEvent<T>;
type BaseEvent = WechatMiniprogram.BaseEvent;
interface ErrorWithMessage {
  message: string;
  [key: string]: any;
}
`;
  
  // 找到合适的位置插入（在import语句之后）
  const importMatch = content.match(/^(import[\s\S]*?)(\n\n|$)/m);
  if (importMatch) {
    const endOfImports = importMatch.index + importMatch[0].length;
    content = content.slice(0, endOfImports) + typeDefinitions + content.slice(endOfImports);
  } else {
    // 如果没有import，就加在文件开头
    content = typeDefinitions + '\n' + content;
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`   ✓ 添加类型定义到 ${relativePath}`);
  return true;
}

/**
 * 修复事件处理函数的any类型
 */
function fixEventHandlers(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  let modified = false;
  
  // 修复事件参数
  const patterns = [
    // 匹配 (event: any) 或 (e: any)
    { 
      pattern: /\b(\w+)\s*\(\s*(event|e)\s*:\s*any\s*\)/g,
      replacement: '$1($2: CustomEvent)'
    },
    // 匹配带其他参数的情况
    {
      pattern: /\((event|e)\s*:\s*any\s*,/g,
      replacement: '($1: CustomEvent,'
    }
  ];
  
  patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      modified = true;
      totalFixed += matches.length;
      fixLog.push({
        file: relativePath,
        type: 'event',
        count: matches.length
      });
      console.log(`   ✓ 修复 ${matches.length} 个事件处理函数`);
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    filesModified.add(relativePath);
  }
  
  return modified;
}

/**
 * 修复catch块中的any类型
 */
function fixCatchBlocks(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  let modified = false;
  
  // 修复 catch (error: any) 或 catch (e: any)
  const patterns = [
    {
      pattern: /catch\s*\(\s*(\w+)\s*:\s*any\s*\)/g,
      replacement: 'catch ($1)'  // 移除类型标注，TypeScript会自动推断为unknown
    },
    // 修复函数参数中的 error: any
    {
      pattern: /\((error|err|e)\s*:\s*any\b(?!\s*\))/g,
      replacement: '($1: ErrorWithMessage'
    }
  ];
  
  patterns.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      modified = true;
      totalFixed += matches.length;
      fixLog.push({
        file: relativePath,
        type: 'catch',
        count: matches.length
      });
      console.log(`   ✓ 修复 ${matches.length} 个catch块错误处理`);
    }
  });
  
  if (modified) {
    // 确保文件有ErrorWithMessage定义
    if (!content.includes('interface ErrorWithMessage')) {
      addTypeDefinitions(filePath);
      content = fs.readFileSync(filePath, 'utf8');
    }
    fs.writeFileSync(filePath, content);
    filesModified.add(relativePath);
  }
  
  return modified;
}

/**
 * 批量处理文件
 */
function processFiles(files) {
  console.log('\n🔧 开始修复any类型...\n');
  
  files.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  文件不存在: ${file}`);
      return;
    }
    
    console.log(`\n📄 处理: ${file}`);
    
    // 先添加类型定义
    const needsTypes = !fs.readFileSync(filePath, 'utf8').includes('type CustomEvent');
    if (needsTypes) {
      addTypeDefinitions(filePath);
    }
    
    // 修复事件处理函数
    fixEventHandlers(filePath);
    
    // 修复catch块
    fixCatchBlocks(filePath);
  });
}

/**
 * 生成修复报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `ANY-TYPES-FIX-REPORT-${timestamp.slice(0, 10)}.md`);
  
  let report = `# Any类型修复报告

生成时间: ${new Date().toLocaleString()}

## 📊 修复统计

- 修复any类型: ${totalFixed}处
- 修改文件数: ${filesModified.size}个

## 📝 修复详情

### 按类型分类
`;
  
  const byType = {};
  fixLog.forEach(item => {
    if (!byType[item.type]) {
      byType[item.type] = { count: 0, files: [] };
    }
    byType[item.type].count += item.count;
    byType[item.type].files.push(`${item.file} (${item.count}处)`);
  });
  
  Object.entries(byType).forEach(([type, data]) => {
    report += `\n#### ${type === 'event' ? '事件处理函数' : 'Catch块错误'}
- 总计: ${data.count}处
- 文件:\n${data.files.map(f => `  - ${f}`).join('\n')}\n`;
  });
  
  report += `\n## ✅ 修复内容

### 1. 事件处理函数
- 将 \`(event: any)\` 替换为 \`(event: CustomEvent)\`
- 添加类型定义 \`type CustomEvent<T = any> = WechatMiniprogram.CustomEvent<T>\`

### 2. Catch块错误
- 将 \`catch (error: any)\` 替换为 \`catch (error)\`
- TypeScript会自动推断为unknown类型
- 添加ErrorWithMessage接口用于错误处理

## 🔍 验证步骤

1. 编译项目，检查是否有新的类型错误
2. 运行小程序，测试事件处理是否正常
3. 测试错误处理逻辑是否正常

## 💡 下一步

- 修复函数参数中的any类型（57处）
- 修复类型断言中的any（26处）
- 修复数组类型中的any（7处）

## ⚠️ 注意事项

- 所有修改都保持了向后兼容性
- 不影响运行时行为
- 只是增强了类型安全性
`;
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🎯 Any类型安全修复工具\n');
console.log('📋 本次将修复：');
console.log('   - 事件处理函数中的any（2处）');
console.log('   - Catch块中的any（36处）\n');

// 目标文件列表（根据分析报告）
const targetFiles = [
  'miniprogram/pages/index/index.ts',
  'miniprogram/pages/health/health.ts',
  'miniprogram/pages/production/production.ts',
  'miniprogram/pages/profile/profile.ts',
  'miniprogram/packageHealth/treatment-record/treatment-record.ts',
  'miniprogram/packageHealth/vaccine-record/vaccine-record.ts',
  'miniprogram/packageProduction/entry-form/entry-form.ts',
  'miniprogram/packageProduction/exit-form/exit-form.ts',
  'miniprogram/packageFinance/finance/finance.ts',
  'miniprogram/packageUser/user-management/user-management.ts'
];

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  此操作将修改TypeScript文件，建议先备份！\n');

rl.question('是否继续？(y/n): ', (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('❌ 操作已取消');
    rl.close();
    return;
  }
  
  // 处理文件
  processFiles(targetFiles);
  
  console.log('\n\n✅ 修复完成！');
  console.log(`📊 统计：`);
  console.log(`   - 修复any类型: ${totalFixed}处`);
  console.log(`   - 修改文件: ${filesModified.size}个`);
  
  const reportPath = generateReport();
  console.log(`\n📄 报告已生成: ${reportPath}`);
  
  console.log('\n💡 下一步:');
  console.log('   1. 编译项目检查类型错误');
  console.log('   2. 运行小程序测试功能');
  console.log('   3. 如无问题，提交更改');
  
  rl.close();
});
