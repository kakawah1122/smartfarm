#!/usr/bin/env node

/**
 * 分析函数参数中的any类型
 * 找出可以安全替换的部分
 */

const fs = require('fs');
const path = require('path');

// 分类统计
const paramAnalysis = {
  callbacks: [],        // 回调函数参数
  options: [],         // 配置对象参数
  data: [],           // 数据参数
  arrays: [],         // 数组参数
  complex: [],        // 复杂参数（需要仔细分析）
  other: []           // 其他
};

let totalParams = 0;

/**
 * 分析函数参数
 */
function analyzeParam(line, lineNum, file) {
  const trimmed = line.trim();
  
  // 提取参数信息
  const patterns = [
    // 匹配 (param: any)
    /\(([^)]*:\s*any[^)]*)\)/g,
    // 匹配箭头函数参数
    /([a-zA-Z_]\w*)\s*:\s*any\s*=>/g,
    // 匹配方法参数
    /\b([a-zA-Z_]\w*)\s*\([^)]*:\s*any[^)]*\)/g
  ];
  
  patterns.forEach(pattern => {
    const matches = [...trimmed.matchAll(pattern)];
    matches.forEach(match => {
      const param = match[1] || match[0];
      totalParams++;
      
      // 分类
      let category = 'other';
      let suggestion = '';
      
      if (param.includes('callback') || param.includes('handler')) {
        category = 'callbacks';
        suggestion = 'Function 或具体的回调类型';
      } else if (param.includes('options') || param.includes('config') || param.includes('params')) {
        category = 'options';
        suggestion = 'Record<string, unknown> 或具体接口';
      } else if (param.includes('data') || param.includes('result')) {
        category = 'data';
        suggestion = 'unknown 或具体数据类型';
      } else if (param.includes('[]') || param.includes('Array')) {
        category = 'arrays';
        suggestion = 'unknown[] 或具体数组类型';
      } else if (param.includes(',')) {
        category = 'complex';
        suggestion = '需要具体分析多个参数';
      }
      
      paramAnalysis[category].push({
        file: path.relative(process.cwd(), file),
        line: lineNum,
        code: trimmed.substring(0, 80),
        param: param,
        suggestion: suggestion
      });
    });
  });
}

/**
 * 扫描文件
 */
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    if (line.includes(': any')) {
      analyzeParam(line, index + 1, filePath);
    }
  });
}

/**
 * 生成分析报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `FUNCTION-PARAMS-ANALYSIS-${timestamp.slice(0, 10)}.md`);
  
  let report = `# 函数参数Any类型分析报告

生成时间: ${new Date().toLocaleString()}

## 📊 统计概览

总计函数参数any: ${totalParams}处

### 按类型分布
- 回调函数: ${paramAnalysis.callbacks.length}处
- 配置对象: ${paramAnalysis.options.length}处
- 数据参数: ${paramAnalysis.data.length}处
- 数组参数: ${paramAnalysis.arrays.length}处
- 复杂参数: ${paramAnalysis.complex.length}处
- 其他: ${paramAnalysis.other.length}处

## 🎯 优化建议

### 优先级1：配置对象（${paramAnalysis.options.length}处）
最容易修复，可以定义接口或使用Record类型。

`;
  
  paramAnalysis.options.slice(0, 3).forEach((item, idx) => {
    report += `
${idx + 1}. **${path.basename(item.file)}** (行 ${item.line})
   \`${item.code}\`
   建议: ${item.suggestion}
`;
  });
  
  report += `\n### 优先级2：数据参数（${paramAnalysis.data.length}处）
可以使用unknown或定义具体类型。

`;
  
  paramAnalysis.data.slice(0, 3).forEach((item, idx) => {
    report += `
${idx + 1}. **${path.basename(item.file)}** (行 ${item.line})
   \`${item.code}\`
   建议: ${item.suggestion}
`;
  });
  
  report += `\n### 优先级3：回调函数（${paramAnalysis.callbacks.length}处）
需要定义具体的函数签名。

`;
  
  paramAnalysis.callbacks.slice(0, 3).forEach((item, idx) => {
    report += `
${idx + 1}. **${path.basename(item.file)}** (行 ${item.line})
   \`${item.code}\`
   建议: ${item.suggestion}
`;
  });
  
  report += `\n## 💡 修复策略

### 1. 配置对象类型
\`\`\`typescript
// 替换前
function init(options: any) { }

// 替换后
interface InitOptions {
  [key: string]: unknown;
}
function init(options: InitOptions) { }
\`\`\`

### 2. 数据参数类型
\`\`\`typescript
// 替换前
function processData(data: any) { }

// 替换后
function processData(data: unknown) { }
// 或定义具体类型
interface DataType { ... }
function processData(data: DataType) { }
\`\`\`

### 3. 回调函数类型
\`\`\`typescript
// 替换前
function onClick(handler: any) { }

// 替换后
function onClick(handler: (event: CustomEvent) => void) { }
\`\`\`

## ⚠️ 注意事项

1. 函数参数类型修改会影响所有调用点
2. 需要确保类型兼容性
3. 建议分批修复，充分测试
4. 优先修复内部函数，再修复公共API
`;
  
  // 添加详细列表
  report += `\n## 📋 详细列表

`;
  
  Object.entries(paramAnalysis).forEach(([category, items]) => {
    if (items.length > 0) {
      report += `### ${category} (${items.length}处)\n\n`;
      
      // 按文件分组
      const byFile = {};
      items.forEach(item => {
        if (!byFile[item.file]) {
          byFile[item.file] = [];
        }
        byFile[item.file].push(item);
      });
      
      Object.entries(byFile).slice(0, 3).forEach(([file, fileItems]) => {
        report += `**${file}**\n`;
        fileItems.slice(0, 5).forEach(item => {
          report += `- 行 ${item.line}: \`${item.code.substring(0, 60)}...\`\n`;
        });
        report += '\n';
      });
    }
  });
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🔍 分析函数参数中的any类型\n');

// 扫描主要文件
const targetFiles = [
  'miniprogram/pages/health/health.ts',
  'miniprogram/pages/health/modules/health-prevention-module.ts',
  'miniprogram/pages/index/index.ts',
  'miniprogram/pages/production/production.ts'
];

targetFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${file}`);
    return;
  }
  
  process.stdout.write(`\r扫描: ${file}`);
  scanFile(filePath);
});

console.log('\n\n✅ 分析完成！\n');
console.log('📊 统计信息:');
console.log(`   - 总计参数: ${totalParams}处`);
console.log(`   - 配置对象: ${paramAnalysis.options.length}处`);
console.log(`   - 数据参数: ${paramAnalysis.data.length}处`);
console.log(`   - 回调函数: ${paramAnalysis.callbacks.length}处`);

const reportPath = generateReport();
console.log(`\n📄 详细报告: ${reportPath}`);
console.log('\n💡 建议优先修复配置对象类型（最安全）');
