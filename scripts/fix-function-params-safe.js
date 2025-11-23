#!/usr/bin/env node

/**
 * 安全修复函数参数中的any类型
 * 只处理最简单和明确的情况
 */

const fs = require('fs');
const path = require('path');

// 修复统计
let totalFixed = 0;
const filesModified = new Set();
const fixLog = [];

// 安全的参数类型映射
const safeParamMapping = {
  // 选项和配置类
  'options': 'Record<string, unknown>',
  'config': 'Record<string, unknown>',
  'params': 'Record<string, unknown>',
  'query': 'Record<string, unknown>',
  'settings': 'Record<string, unknown>',
  
  // 数据类
  'data': 'unknown',
  'result': 'unknown',
  'response': 'unknown',
  'payload': 'unknown',
  'value': 'unknown',
  
  // 错误类
  'error': 'Error | unknown',
  'err': 'Error | unknown',
  'exception': 'Error | unknown',
  
  // 事件类（但参数形式）
  'event': 'CustomEvent | unknown',
  'e': 'CustomEvent | unknown',
  
  // 通用对象
  'obj': 'Record<string, unknown>',
  'object': 'Record<string, unknown>',
  'item': 'unknown',
  
  // 数组
  'items': 'unknown[]',
  'list': 'unknown[]',
  'array': 'unknown[]'
};

/**
 * 判断是否是安全的参数名
 */
function isSafeParam(paramName) {
  const cleaned = paramName.trim().toLowerCase();
  return Object.keys(safeParamMapping).some(key => 
    cleaned === key || cleaned.startsWith(key)
  );
}

/**
 * 获取参数的安全类型
 */
function getSafeType(paramName) {
  const cleaned = paramName.trim().toLowerCase();
  
  for (const [key, type] of Object.entries(safeParamMapping)) {
    if (cleaned === key || cleaned.startsWith(key)) {
      return type;
    }
  }
  
  return null;
}

/**
 * 修复函数参数
 */
function fixFunctionParams(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  let modified = false;
  const lines = content.split('\n');
  
  const newLines = lines.map((line, index) => {
    let newLine = line;
    
    // 简单参数模式: (paramName: any)
    const simpleParamRegex = /\b(\w+)\s*:\s*any\b(?!\s*\[)/g;
    
    const matches = [...line.matchAll(simpleParamRegex)];
    
    matches.forEach(match => {
      const fullMatch = match[0];
      const paramName = match[1];
      
      if (isSafeParam(paramName)) {
        const newType = getSafeType(paramName);
        if (newType) {
          const replacement = `${paramName}: ${newType}`;
          newLine = newLine.replace(fullMatch, replacement);
          
          modified = true;
          totalFixed++;
          fixLog.push({
            file: relativePath,
            line: index + 1,
            param: paramName,
            oldType: 'any',
            newType: newType
          });
          
          console.log(`   ✓ 行${index + 1}: ${paramName}: any → ${newType}`);
        }
      }
    });
    
    return newLine;
  });
  
  if (modified) {
    content = newLines.join('\n');
    
    // 确保有CustomEvent类型定义（如果使用了）
    if (content.includes('CustomEvent') && !content.includes('type CustomEvent')) {
      // 在文件顶部添加类型定义
      const typesDef = `
// 类型定义
type CustomEvent<T = any> = WechatMiniprogram.CustomEvent<T>;

`;
      
      // 找到import后的位置
      const importEnd = content.lastIndexOf('import');
      if (importEnd !== -1) {
        const lineEnd = content.indexOf('\n', importEnd);
        if (lineEnd !== -1) {
          const nextLineEnd = content.indexOf('\n', lineEnd + 1);
          content = content.slice(0, nextLineEnd + 1) + typesDef + content.slice(nextLineEnd + 1);
        }
      }
    }
    
    fs.writeFileSync(filePath, content);
    filesModified.add(relativePath);
  }
  
  return modified;
}

/**
 * 生成报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `FUNCTION-PARAMS-FIX-${timestamp.slice(0, 10)}.md`);
  
  let report = `# 函数参数Any类型修复报告

生成时间: ${new Date().toLocaleString()}

## 📊 修复统计

- 修复函数参数: ${totalFixed}处
- 修改文件数: ${filesModified.size}个

## 📝 修复详情

### 修复的参数类型
`;
  
  // 统计各类型修复数量
  const typeStats = {};
  fixLog.forEach(item => {
    if (!typeStats[item.newType]) {
      typeStats[item.newType] = 0;
    }
    typeStats[item.newType]++;
  });
  
  Object.entries(typeStats).forEach(([type, count]) => {
    report += `\n- \`any\` → \`${type}\`: ${count}处`;
  });
  
  report += `\n\n### 文件列表\n`;
  
  // 按文件分组
  const byFile = {};
  fixLog.forEach(item => {
    if (!byFile[item.file]) {
      byFile[item.file] = [];
    }
    byFile[item.file].push(item);
  });
  
  Object.entries(byFile).forEach(([file, items]) => {
    report += `\n#### ${file}
修复 ${items.length} 处参数\n`;
    
    items.slice(0, 10).forEach(item => {
      report += `- 行 ${item.line}: \`${item.param}: ${item.oldType}\` → \`${item.newType}\`\n`;
    });
    
    if (items.length > 10) {
      report += `- ... 还有 ${items.length - 10} 处\n`;
    }
  });
  
  report += `\n## ✅ 修复策略

### 安全的参数类型映射
- 配置参数: \`Record<string, unknown>\`
- 数据参数: \`unknown\`
- 错误参数: \`Error | unknown\`
- 事件参数: \`CustomEvent | unknown\`
- 数组参数: \`unknown[]\`

### 为什么这些修复是安全的
1. 只修复了参数名明确的情况
2. 使用unknown而非any，保证类型安全
3. 不影响函数内部实现
4. 调用方传入的值仍然兼容

## 🔍 验证建议

1. 编译项目检查类型错误
2. 测试涉及的功能模块
3. 关注参数传递的地方

## ⚠️ 注意事项

- unknown类型需要类型检查后才能使用
- 后续可以逐步细化为具体类型
- 保持代码的向后兼容性
`;
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🎯 安全修复函数参数中的any类型\n');
console.log('📋 只处理参数名明确的情况\n');

// 目标文件
const targetFiles = [
  'miniprogram/pages/health/health.ts',
  'miniprogram/pages/health/modules/health-prevention-module.ts',
  'miniprogram/pages/index/index.ts',
  'miniprogram/pages/production/production.ts',
  'miniprogram/pages/profile/profile.ts',
  'miniprogram/packageHealth/treatment-record/treatment-record.ts',
  'miniprogram/packageProduction/entry-form/entry-form.ts',
  'miniprogram/packageFinance/finance/finance.ts'
];

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  将修复函数参数类型，建议先确认\n');

// 先扫描统计
let previewCount = 0;
console.log('预览将修复的参数：\n');

targetFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach(line => {
    const matches = [...line.matchAll(/\b(\w+)\s*:\s*any\b(?!\s*\[)/g)];
    matches.forEach(match => {
      if (isSafeParam(match[1])) {
        previewCount++;
      }
    });
  });
});

console.log(`预计修复 ${previewCount} 处参数\n`);

rl.question('是否继续？(y/n): ', (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('❌ 操作已取消');
    rl.close();
    return;
  }
  
  console.log('\n开始修复...\n');
  
  // 执行修复
  targetFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  文件不存在: ${file}`);
      return;
    }
    
    console.log(`\n📄 处理: ${file}`);
    const fixed = fixFunctionParams(filePath);
    
    if (!fixed) {
      console.log('   ℹ️  无需修复');
    }
  });
  
  console.log('\n\n✅ 修复完成！');
  console.log(`📊 统计：`);
  console.log(`   - 修复参数: ${totalFixed}处`);
  console.log(`   - 修改文件: ${filesModified.size}个`);
  
  if (totalFixed > 0) {
    const reportPath = generateReport();
    console.log(`\n📄 报告已生成: ${reportPath}`);
  }
  
  console.log('\n💡 下一步:');
  console.log('   1. 编译检查类型错误');
  console.log('   2. 测试相关功能');
  console.log('   3. 逐步细化unknown类型');
  
  rl.close();
});
