#!/usr/bin/env node

/**
 * 修复类型断言中的any
 * 使用更具体的类型替代 as any
 */

const fs = require('fs');
const path = require('path');

// 修复统计
let totalFixed = 0;
const filesModified = new Set();
const fixLog = [];

/**
 * 分析上下文推断合适的类型
 */
function inferTypeFromContext(line, varName) {
  // 常见的类型模式
  if (line.includes('result') || line.includes('response')) {
    return 'unknown';
  }
  if (line.includes('error') || line.includes('Error')) {
    return 'Error';
  }
  if (line.includes('data')) {
    return 'unknown';
  }
  if (line.includes('event')) {
    return 'CustomEvent';
  }
  if (line.includes('options') || line.includes('config')) {
    return 'Record<string, unknown>';
  }
  if (line.includes('params') || line.includes('args')) {
    return 'unknown[]';
  }
  if (line.includes('item') && line.includes('[]')) {
    return 'unknown[]';
  }
  
  // 默认使用unknown，比any更安全
  return 'unknown';
}

/**
 * 修复类型断言
 */
function fixTypeAssertions(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  let modified = false;
  const lines = content.split('\n');
  
  const newLines = lines.map((line, index) => {
    let newLine = line;
    
    // 匹配 as any 模式
    if (line.includes(' as any')) {
      // 提取变量或表达式
      const beforeAs = line.substring(0, line.indexOf(' as any'));
      const afterAs = line.substring(line.indexOf(' as any') + 7);
      
      // 分析上下文
      const inferredType = inferTypeFromContext(line, beforeAs);
      
      // 特殊情况处理
      let finalType = inferredType;
      
      // 如果是链式调用或属性访问，可能需要保留any
      if (beforeAs.includes('.') && !beforeAs.includes('result')) {
        // 检查是否是安全的替换
        if (line.includes('.data') || line.includes('.result')) {
          finalType = 'unknown';
        } else if (line.includes('.error') || line.includes('.message')) {
          finalType = 'Error | unknown';
        } else {
          // 复杂的属性访问，暂时保留any或使用unknown
          finalType = 'unknown';
        }
      }
      
      if (finalType !== 'any') {
        newLine = beforeAs + ' as ' + finalType + afterAs;
        modified = true;
        totalFixed++;
        fixLog.push({
          file: relativePath,
          line: index + 1,
          original: line.trim(),
          fixed: newLine.trim(),
          change: `as any → as ${finalType}`
        });
        console.log(`   ✓ 行${index + 1}: as any → as ${finalType}`);
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
 * 扫描文件查找as any
 */
function scanForTypeAssertions(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const assertions = [];
  
  lines.forEach((line, index) => {
    if (line.includes(' as any')) {
      assertions.push({
        line: index + 1,
        code: line.trim()
      });
    }
  });
  
  return assertions;
}

/**
 * 生成报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `TYPE-ASSERTIONS-FIX-${timestamp.slice(0, 10)}.md`);
  
  let report = `# 类型断言修复报告

生成时间: ${new Date().toLocaleString()}

## 📊 修复统计

- 修复类型断言: ${totalFixed}处
- 修改文件数: ${filesModified.size}个

## 📝 修复详情

### 修复列表
`;
  
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
修复 ${items.length} 处\n`;
    
    items.forEach(item => {
      report += `
- **行 ${item.line}**
  - 修改前: \`${item.original.substring(0, 60)}...\`
  - 修改后: ${item.change}
`;
    });
  });
  
  report += `\n## ✅ 修复策略

### 类型推断规则
1. **API响应**: \`as any\` → \`as unknown\`
2. **错误处理**: \`as any\` → \`as Error\` 或 \`as unknown\`
3. **配置对象**: \`as any\` → \`as Record<string, unknown>\`
4. **默认情况**: \`as any\` → \`as unknown\`

### unknown vs any
- \`unknown\` 更安全，需要类型检查才能使用
- \`any\` 跳过所有类型检查（不推荐）
- 优先使用 \`unknown\`，逐步细化类型

## 🔍 验证建议

1. 编译检查类型错误
2. 重点测试修改的代码路径
3. 确认功能正常运行

## ⚠️ 注意事项

- 类型断言只影响编译时
- 不影响运行时行为
- 可以逐步细化unknown类型
`;
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🎯 修复类型断言中的any\n');

// 根据分析报告，选择包含as any较多的文件
const targetFiles = [
  'miniprogram/pages/health/health.ts',
  'miniprogram/pages/index/index.ts', 
  'miniprogram/pages/production/production.ts',
  'miniprogram/packageHealth/treatment-record/treatment-record.ts',
  'miniprogram/packageFinance/finance/finance.ts',
  'miniprogram/packageUser/user-management/user-management.ts'
];

console.log('📋 扫描目标文件...\n');

let totalAssertions = 0;

// 先扫描统计
targetFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    return;
  }
  
  const assertions = scanForTypeAssertions(filePath);
  if (assertions.length > 0) {
    console.log(`📄 ${file}: 发现 ${assertions.length} 个 as any`);
    totalAssertions += assertions.length;
  }
});

if (totalAssertions === 0) {
  console.log('\n✅ 未发现需要修复的类型断言');
  process.exit(0);
}

console.log(`\n总计发现 ${totalAssertions} 个类型断言待修复\n`);

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  将修复类型断言，建议先备份\n');

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
    const fixed = fixTypeAssertions(filePath);
    
    if (!fixed) {
      console.log('   ℹ️  无需修复');
    }
  });
  
  console.log('\n\n✅ 修复完成！');
  console.log(`📊 统计：`);
  console.log(`   - 修复类型断言: ${totalFixed}处`);
  console.log(`   - 修改文件: ${filesModified.size}个`);
  
  if (totalFixed > 0) {
    const reportPath = generateReport();
    console.log(`\n📄 报告已生成: ${reportPath}`);
  }
  
  console.log('\n💡 下一步:');
  console.log('   1. 编译项目检查类型');
  console.log('   2. 测试相关功能');
  console.log('   3. 逐步细化unknown类型');
  
  rl.close();
});
