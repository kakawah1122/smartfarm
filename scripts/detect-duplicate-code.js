#!/usr/bin/env node

/**
 * 检测重复代码
 * 找出相似或重复的代码片段
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 存储代码片段的哈希
const codeHashes = new Map();
const duplicates = [];
let totalFiles = 0;
let totalFunctions = 0;

/**
 * 计算字符串的哈希值
 */
function hashString(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * 规范化代码（移除空格、注释等）
 */
function normalizeCode(code) {
  return code
    .replace(/\/\/.*$/gm, '') // 移除单行注释
    .replace(/\/\*[\s\S]*?\*\//g, '') // 移除多行注释
    .replace(/\s+/g, ' ') // 压缩空白
    .replace(/^\s+|\s+$/g, '') // 去除首尾空白
    .toLowerCase(); // 转小写比较
}

/**
 * 提取函数代码块
 */
function extractFunctions(content, filePath) {
  const functions = [];
  
  // 匹配普通函数
  const funcRegex = /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*)}/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    functions.push({
      name: match[1],
      body: match[2],
      type: 'function',
      file: filePath
    });
  }
  
  // 匹配箭头函数
  const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*{([^{}]*(?:{[^{}]*}[^{}]*)*)}/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    functions.push({
      name: match[1],
      body: match[2],
      type: 'arrow',
      file: filePath
    });
  }
  
  // 匹配类方法
  const methodRegex = /(\w+)\s*\([^)]*\)\s*{([^{}]*(?:{[^{}]*}[^{}]*)*)}/g;
  while ((match = methodRegex.exec(content)) !== null) {
    if (!match[1].match(/^(if|for|while|switch|catch)$/)) {
      functions.push({
        name: match[1],
        body: match[2],
        type: 'method',
        file: filePath
      });
    }
  }
  
  return functions;
}

/**
 * 检查文件中的重复代码
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath);
  const functions = extractFunctions(content, relativePath);
  
  totalFiles++;
  totalFunctions += functions.length;
  
  functions.forEach(func => {
    // 规范化函数体
    const normalizedBody = normalizeCode(func.body);
    
    // 跳过太短的函数
    if (normalizedBody.length < 50) return;
    
    // 计算哈希
    const hash = hashString(normalizedBody);
    
    // 检查是否有重复
    if (codeHashes.has(hash)) {
      const existing = codeHashes.get(hash);
      duplicates.push({
        hash,
        functions: [existing, func],
        codeLength: normalizedBody.length
      });
    } else {
      codeHashes.set(hash, func);
    }
  });
}

/**
 * 计算相似度（简单版本）
 */
function calculateSimilarity(code1, code2) {
  const norm1 = normalizeCode(code1);
  const norm2 = normalizeCode(code2);
  
  if (norm1 === norm2) return 100;
  
  // 简单的相似度计算
  const len1 = norm1.length;
  const len2 = norm2.length;
  const maxLen = Math.max(len1, len2);
  const diff = Math.abs(len1 - len2);
  
  return Math.round((1 - diff / maxLen) * 100);
}

/**
 * 扫描目录
 */
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // 跳过特定目录
      if (file === 'node_modules' || 
          file === 'miniprogram_npm' || 
          file === '.git' ||
          file === 'scripts') {
        return;
      }
      scanDirectory(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      // 跳过.d.ts文件
      if (!file.endsWith('.d.ts')) {
        process.stdout.write(`\r扫描: ${fullPath.slice(-50).padEnd(50)}`);
        checkFile(fullPath);
      }
    }
  });
}

/**
 * 生成报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `DUPLICATE-CODE-REPORT-${timestamp.slice(0, 10)}.md`);
  
  let report = `# 重复代码检测报告

生成时间: ${new Date().toLocaleString()}

## 📊 扫描统计

- 扫描文件数: ${totalFiles}个
- 检测函数数: ${totalFunctions}个
- 发现重复组: ${duplicates.length}组

## 🔍 重复代码列表

`;
  
  // 按代码长度排序
  duplicates.sort((a, b) => b.codeLength - a.codeLength);
  
  duplicates.slice(0, 20).forEach((dup, index) => {
    report += `\n### ${index + 1}. 重复代码组 (${dup.codeLength}字符)\n\n`;
    
    dup.functions.forEach((func, i) => {
      report += `**位置${i + 1}**: \`${func.file}\`\n`;
      report += `- 函数名: \`${func.name}\`\n`;
      report += `- 类型: ${func.type}\n\n`;
    });
    
    // 显示部分代码
    const sample = dup.functions[0].body.substring(0, 200);
    report += `**代码片段**:\n\`\`\`javascript\n${sample}...\n\`\`\`\n`;
  });
  
  if (duplicates.length > 20) {
    report += `\n... 还有 ${duplicates.length - 20} 组重复代码未显示\n`;
  }
  
  report += `\n## 💡 优化建议

### 1. 提取公共函数
将重复的代码提取到公共模块中，其他地方引用。

### 2. 创建工具类
相似的功能可以创建工具类统一管理。

### 3. 使用继承或混入
对于类方法的重复，可以考虑使用继承或混入模式。

## ⚠️ 注意事项

1. 并非所有重复都需要消除
2. 有些重复是必要的（如模板代码）
3. 重构时要确保功能不变
4. 充分测试重构后的代码
`;
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🔍 检测重复代码\n');
console.log('扫描中...\n');

const projectRoot = path.join(process.cwd(), 'miniprogram');
scanDirectory(projectRoot);

console.log('\n\n✅ 扫描完成！\n');
console.log('📊 统计信息:');
console.log(`   - 扫描文件: ${totalFiles}个`);
console.log(`   - 检测函数: ${totalFunctions}个`);
console.log(`   - 重复代码组: ${duplicates.length}组`);

if (duplicates.length > 0) {
  const reportPath = generateReport();
  console.log(`\n📄 详细报告: ${reportPath}`);
  
  console.log('\n🔥 发现的主要重复:');
  duplicates.slice(0, 5).forEach((dup, index) => {
    console.log(`\n${index + 1}. ${dup.functions[0].name} 函数`);
    console.log(`   文件1: ${dup.functions[0].file}`);
    console.log(`   文件2: ${dup.functions[1].file}`);
    console.log(`   代码长度: ${dup.codeLength}字符`);
  });
  
  console.log('\n💡 建议优先处理代码长度较大的重复！');
} else {
  console.log('\n✅ 未发现明显的重复代码！');
}
