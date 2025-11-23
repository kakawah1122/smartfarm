#!/usr/bin/env node

/**
 * 修复数组类型和变量声明中的any
 * 第二批安全修复
 */

const fs = require('fs');
const path = require('path');

// 修复统计
let totalFixed = 0;
const filesModified = new Set();
const fixLog = [];

// 常见的数组类型映射
const arrayTypeMapping = {
  'tasks': 'Task[]',
  'batches': 'Batch[]',
  'records': 'Record<string, any>[]',
  'items': 'any[]', // 暂时保留，需要具体分析
  'list': 'any[]',  // 暂时保留
  'data': 'any[]',  // 暂时保留
  'results': 'any[]' // 暂时保留
};

/**
 * 分析数组变量名推断类型
 */
function inferArrayType(varName, context) {
  // 根据变量名推断
  if (varName.includes('task') || varName.includes('Task')) {
    return 'Task[]';
  }
  if (varName.includes('batch') || varName.includes('Batch')) {
    return 'Batch[]';
  }
  if (varName.includes('record') || varName.includes('Record')) {
    return 'Record<string, any>[]';
  }
  if (varName.includes('item') || varName.includes('Item')) {
    return 'unknown[]'; // 比any[]更安全
  }
  if (varName.includes('error') || varName.includes('Error')) {
    return 'Error[]';
  }
  
  // 默认使用unknown[]，比any[]更安全
  return 'unknown[]';
}

/**
 * 修复数组类型
 */
function fixArrayTypes(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  let modified = false;
  const lines = content.split('\n');
  
  const newLines = lines.map((line, index) => {
    let newLine = line;
    
    // 匹配 : any[]
    if (line.includes(': any[]')) {
      // 提取变量名
      const varMatch = line.match(/(\w+)\s*:\s*any\[\]/);
      if (varMatch) {
        const varName = varMatch[1];
        const newType = inferArrayType(varName, line);
        
        if (newType !== 'any[]') {
          newLine = line.replace(/:\s*any\[\]/, `: ${newType}`);
          modified = true;
          totalFixed++;
          fixLog.push({
            file: relativePath,
            type: 'array',
            line: index + 1,
            change: `any[] → ${newType}`
          });
          console.log(`   ✓ 行${index + 1}: any[] → ${newType}`);
        }
      }
    }
    
    // 匹配 Array<any>
    if (line.includes('Array<any>')) {
      const varMatch = line.match(/(\w+)\s*:\s*Array<any>/);
      if (varMatch) {
        const varName = varMatch[1];
        const newType = inferArrayType(varName, line);
        
        newLine = line.replace(/Array<any>/, newType);
        modified = true;
        totalFixed++;
        fixLog.push({
          file: relativePath,
          type: 'array',
          line: index + 1,
          change: `Array<any> → ${newType}`
        });
        console.log(`   ✓ 行${index + 1}: Array<any> → ${newType}`);
      }
    }
    
    return newLine;
  });
  
  if (modified) {
    content = newLines.join('\n');
    fs.writeFileSync(filePath, content);
    filesModified.add(relativePath);
  }
  
  return modified;
}

/**
 * 修复变量声明中的any
 */
function fixVariableDeclarations(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  let modified = false;
  const lines = content.split('\n');
  
  const newLines = lines.map((line, index) => {
    let newLine = line;
    
    // 匹配 let/const/var xxx: any
    const patterns = [
      /\b(let|const|var)\s+(\w+)\s*:\s*any\b/g
    ];
    
    patterns.forEach(pattern => {
      const matches = [...line.matchAll(pattern)];
      matches.forEach(match => {
        const varType = match[1];
        const varName = match[2];
        
        // 根据上下文推断类型
        let newType = 'unknown'; // 默认使用unknown
        
        // 如果是result/response相关，可能是API响应
        if (varName.includes('result') || varName.includes('Result')) {
          newType = 'unknown';
        } else if (varName.includes('data') || varName.includes('Data')) {
          newType = 'unknown';
        } else if (varName.includes('error') || varName.includes('Error')) {
          newType = 'Error | unknown';
        }
        
        if (newType !== 'any') {
          newLine = newLine.replace(
            new RegExp(`\\b${varType}\\s+${varName}\\s*:\\s*any\\b`),
            `${varType} ${varName}: ${newType}`
          );
          modified = true;
          totalFixed++;
          fixLog.push({
            file: relativePath,
            type: 'variable',
            line: index + 1,
            change: `any → ${newType}`
          });
          console.log(`   ✓ 行${index + 1}: ${varName}: any → ${newType}`);
        }
      });
    });
    
    return newLine;
  });
  
  if (modified) {
    content = newLines.join('\n');
    fs.writeFileSync(filePath, content);
    filesModified.add(relativePath);
  }
  
  return modified;
}

/**
 * 生成修复报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `ANY-ARRAYS-VARS-FIX-${timestamp.slice(0, 10)}.md`);
  
  let report = `# Any类型修复报告 - 数组和变量

生成时间: ${new Date().toLocaleString()}

## 📊 修复统计

- 修复any类型: ${totalFixed}处
- 修改文件数: ${filesModified.size}个

## 📝 修复详情

### 修复列表
`;
  
  fixLog.forEach((item, index) => {
    report += `\n${index + 1}. **${path.basename(item.file)}**
   - 行号: ${item.line}
   - 类型: ${item.type === 'array' ? '数组' : '变量'}
   - 修改: ${item.change}\n`;
  });
  
  report += `\n## ✅ 修复策略

### 数组类型
- \`any[]\` → \`unknown[]\` (更安全的默认值)
- 根据变量名推断具体类型
- 保持类型兼容性

### 变量声明
- \`any\` → \`unknown\` (默认)
- 错误相关使用 \`Error | unknown\`
- API响应使用 \`unknown\`

## 🔍 验证步骤

1. 编译检查类型错误
2. 测试数组操作功能
3. 确认变量使用正常

## 💡 说明

- 使用 \`unknown\` 替代 \`any\` 更安全
- \`unknown\` 强制进行类型检查
- 不影响运行时行为
`;
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🎯 修复数组类型和变量声明中的any\n');

// 目标文件（根据分析报告选择）
const targetFiles = [
  'miniprogram/pages/health/health.ts',
  'miniprogram/pages/health/modules/health-prevention-module.ts',
  'miniprogram/pages/production/production.ts',
  'miniprogram/packageHealth/treatment-record/treatment-record.ts'
];

console.log('📋 扫描目标文件...\n');

targetFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${file}`);
    return;
  }
  
  console.log(`\n📄 处理: ${file}`);
  
  const arrayFixed = fixArrayTypes(filePath);
  const varFixed = fixVariableDeclarations(filePath);
  
  if (!arrayFixed && !varFixed) {
    console.log('   ℹ️  无需修复');
  }
});

console.log('\n\n✅ 扫描完成！');
console.log(`📊 统计：`);
console.log(`   - 修复any类型: ${totalFixed}处`);
console.log(`   - 修改文件: ${filesModified.size}个`);

if (totalFixed > 0) {
  const reportPath = generateReport();
  console.log(`\n📄 报告已生成: ${reportPath}`);
}

console.log('\n💡 建议:');
console.log('   1. 编译项目检查类型');
console.log('   2. 测试相关功能');
console.log('   3. 逐步细化unknown类型');
