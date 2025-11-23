#!/usr/bin/env node

/**
 * 分析any类型使用情况
 * 找出可以安全替换的部分
 */

const fs = require('fs');
const path = require('path');

const anyUsages = {
  eventHandlers: [],      // 事件处理函数参数
  functionParams: [],     // 函数参数
  functionReturns: [],    // 函数返回值
  typeAssertions: [],     // 类型断言
  variables: [],          // 变量声明
  arrayTypes: [],         // 数组类型
  objectProps: [],        // 对象属性
  catchBlocks: [],        // catch块中的错误
  other: []              // 其他用法
};

let totalAnyCount = 0;
const fileStats = {};

/**
 * 分析TypeScript文件
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(process.cwd(), filePath);
  
  let fileAnyCount = 0;
  const fileUsages = [];
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // 跳过注释行
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }
    
    // 检查是否包含any
    if (!line.includes('any')) {
      return;
    }
    
    // 分类any的使用场景
    const usage = classifyAnyUsage(line, lineNum, relativePath);
    if (usage) {
      fileUsages.push(usage);
      fileAnyCount++;
      totalAnyCount++;
      
      // 添加到对应分类
      anyUsages[usage.category].push(usage);
    }
  });
  
  if (fileAnyCount > 0) {
    fileStats[relativePath] = {
      count: fileAnyCount,
      usages: fileUsages
    };
  }
}

/**
 * 分类any的使用场景
 */
function classifyAnyUsage(line, lineNum, file) {
  const trimmedLine = line.trim();
  
  // 事件处理函数
  if (trimmedLine.match(/\(e(vent)?:\s*any\)/) || trimmedLine.match(/\(event:\s*any\)/)) {
    return {
      category: 'eventHandlers',
      file,
      line: lineNum,
      code: trimmedLine,
      suggestion: '可以使用 WechatMiniprogram.CustomEvent 类型'
    };
  }
  
  // catch块中的错误
  if (trimmedLine.match(/catch\s*\([^)]*:\s*any\)/) || trimmedLine.match(/error:\s*any/)) {
    return {
      category: 'catchBlocks',
      file,
      line: lineNum,
      code: trimmedLine,
      suggestion: '可以使用 Error 类型或自定义错误类型'
    };
  }
  
  // 函数参数
  if (trimmedLine.match(/\([^)]*:\s*any[,)]/) || trimmedLine.match(/\(.*:\s*any\s*\)/)) {
    return {
      category: 'functionParams',
      file,
      line: lineNum,
      code: trimmedLine,
      suggestion: '需要定义具体的参数类型'
    };
  }
  
  // 函数返回值
  if (trimmedLine.match(/\):\s*any\s*[{;]/) || trimmedLine.match(/=>\s*any/)) {
    return {
      category: 'functionReturns',
      file,
      line: lineNum,
      code: trimmedLine,
      suggestion: '需要定义具体的返回类型'
    };
  }
  
  // 类型断言
  if (trimmedLine.match(/as\s+any/)) {
    return {
      category: 'typeAssertions',
      file,
      line: lineNum,
      code: trimmedLine,
      suggestion: '尽量使用具体类型断言'
    };
  }
  
  // 数组类型
  if (trimmedLine.match(/:\s*any\[\]/) || trimmedLine.match(/Array<any>/)) {
    return {
      category: 'arrayTypes',
      file,
      line: lineNum,
      code: trimmedLine,
      suggestion: '定义数组元素的具体类型'
    };
  }
  
  // 变量声明
  if (trimmedLine.match(/let\s+\w+:\s*any/) || trimmedLine.match(/const\s+\w+:\s*any/) || trimmedLine.match(/var\s+\w+:\s*any/)) {
    return {
      category: 'variables',
      file,
      line: lineNum,
      code: trimmedLine,
      suggestion: '使用具体类型或类型推断'
    };
  }
  
  // 对象属性
  if (trimmedLine.match(/\w+:\s*any[,;}\s]/) && !trimmedLine.match(/\([^)]*:\s*any/)) {
    return {
      category: 'objectProps',
      file,
      line: lineNum,
      code: trimmedLine,
      suggestion: '定义属性的具体类型'
    };
  }
  
  // 其他
  if (trimmedLine.includes('any')) {
    return {
      category: 'other',
      file,
      line: lineNum,
      code: trimmedLine,
      suggestion: '需要进一步分析'
    };
  }
  
  return null;
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
      // 跳过特定目录
      if (file === 'node_modules' || file === 'miniprogram_npm' || file === '.git') {
        return;
      }
      scanDirectory(fullPath);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      process.stdout.write(`\r扫描中... ${fullPath.slice(-50)}`);
      analyzeFile(fullPath);
    }
  });
}

/**
 * 生成优化建议
 */
function generateOptimizationPlan() {
  const plan = [];
  
  // 优先级1：事件处理函数（最容易修复）
  if (anyUsages.eventHandlers.length > 0) {
    plan.push({
      priority: 1,
      category: 'eventHandlers',
      count: anyUsages.eventHandlers.length,
      difficulty: 'easy',
      solution: '使用 WechatMiniprogram.CustomEvent 或具体事件类型'
    });
  }
  
  // 优先级2：catch块错误（容易修复）
  if (anyUsages.catchBlocks.length > 0) {
    plan.push({
      priority: 2,
      category: 'catchBlocks',
      count: anyUsages.catchBlocks.length,
      difficulty: 'easy',
      solution: '使用 Error 类型或自定义错误接口'
    });
  }
  
  // 优先级3：数组类型（中等难度）
  if (anyUsages.arrayTypes.length > 0) {
    plan.push({
      priority: 3,
      category: 'arrayTypes',
      count: anyUsages.arrayTypes.length,
      difficulty: 'medium',
      solution: '定义具体的数组元素类型'
    });
  }
  
  // 优先级4：函数参数（需要仔细分析）
  if (anyUsages.functionParams.length > 0) {
    plan.push({
      priority: 4,
      category: 'functionParams',
      count: anyUsages.functionParams.length,
      difficulty: 'hard',
      solution: '根据实际使用定义参数类型'
    });
  }
  
  return plan;
}

/**
 * 生成报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `ANY-TYPES-ANALYSIS-${timestamp.slice(0, 10)}.md`);
  
  let report = `# Any类型使用分析报告

生成时间: ${new Date().toLocaleString()}

## 📊 统计概览

- 总计any使用: ${totalAnyCount}处
- 涉及文件数: ${Object.keys(fileStats).length}个

### 按类别分布
- 事件处理函数: ${anyUsages.eventHandlers.length}处
- catch块错误: ${anyUsages.catchBlocks.length}处
- 函数参数: ${anyUsages.functionParams.length}处
- 函数返回值: ${anyUsages.functionReturns.length}处
- 类型断言: ${anyUsages.typeAssertions.length}处
- 数组类型: ${anyUsages.arrayTypes.length}处
- 变量声明: ${anyUsages.variables.length}处
- 对象属性: ${anyUsages.objectProps.length}处
- 其他: ${anyUsages.other.length}处

## 🎯 优化计划

`;
  
  const plan = generateOptimizationPlan();
  plan.forEach(item => {
    report += `\n### 优先级${item.priority}：${item.category}
- 数量: ${item.count}处
- 难度: ${item.difficulty}
- 解决方案: ${item.solution}\n`;
  });
  
  report += `\n## 📝 具体分析

### 1. 事件处理函数（${anyUsages.eventHandlers.length}处）
最容易修复，可以批量替换。

`;
  
  // 只显示前5个示例
  anyUsages.eventHandlers.slice(0, 5).forEach((usage, index) => {
    report += `\n#### 示例${index + 1}
- 文件: ${usage.file}
- 行号: ${usage.line}
- 代码: \`${usage.code.substring(0, 80)}...\`
- 建议: ${usage.suggestion}\n`;
  });
  
  report += `\n### 2. Catch块错误（${anyUsages.catchBlocks.length}处）
容易修复，统一使用Error类型。

`;
  
  anyUsages.catchBlocks.slice(0, 5).forEach((usage, index) => {
    report += `\n#### 示例${index + 1}
- 文件: ${usage.file}
- 行号: ${usage.line}
- 代码: \`${usage.code.substring(0, 80)}...\`
- 建议: ${usage.suggestion}\n`;
  });
  
  // 文件统计
  report += `\n## 📊 文件分布（Top 10）

`;
  
  const sortedFiles = Object.entries(fileStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  
  sortedFiles.forEach(([file, stats]) => {
    report += `- ${path.basename(file)}: ${stats.count}处\n`;
  });
  
  report += `\n## 💡 修复建议

### 第一步：批量修复事件处理函数
创建类型定义：
\`\`\`typescript
type CustomEvent = WechatMiniprogram.CustomEvent;
type BaseEvent = WechatMiniprogram.BaseEvent;
\`\`\`

### 第二步：修复错误处理
\`\`\`typescript
interface ErrorWithMessage {
  message: string;
  [key: string]: any;
}
\`\`\`

### 第三步：逐个处理复杂类型
需要根据实际使用情况定义具体类型。

## ⚠️ 注意事项

1. 不要盲目替换，确保功能正常
2. 分批处理，每次修复一类
3. 充分测试，确保不破坏功能
`;
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🔍 分析Any类型使用情况\n');
console.log('扫描中...\n');

const projectRoot = path.join(__dirname, '..', 'miniprogram');
scanDirectory(projectRoot);

console.log('\n\n✅ 扫描完成！\n');
console.log('📊 统计信息:');
console.log(`   - 总计any: ${totalAnyCount}处`);
console.log(`   - 涉及文件: ${Object.keys(fileStats).length}个`);
console.log(`   - 事件处理: ${anyUsages.eventHandlers.length}处`);
console.log(`   - 错误处理: ${anyUsages.catchBlocks.length}处`);

const reportPath = generateReport();
console.log(`\n📄 详细报告: ${reportPath}`);
console.log('\n💡 建议从事件处理函数开始修复！');
