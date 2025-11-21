#!/usr/bin/env node

/**
 * TypeScript规范检查脚本
 * 根据项目开发规范检查any类型使用、空值处理、类型定义
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
  anyType: { errors: [], warnings: [] },
  nullHandling: { errors: [], warnings: [] },
  typeDefinition: { errors: [], warnings: [] },
  errorHandling: { errors: [], warnings: [] },
  bestPractices: { errors: [], warnings: [] }
};

// 统计信息
const stats = {
  totalFiles: 0,
  totalLines: 0,
  anyCount: 0,
  asAnyCount: 0,
  nullCheckCount: 0,
  tryCatchCount: 0
};

/**
 * 检查any类型的使用
 */
function checkAnyType(filePath, content) {
  const lines = content.split('\n');
  
  // 匹配any类型声明
  const anyPatterns = [
    /:\s*any\b/g,              // : any
    /as\s+any\b/g,             // as any
    /<any>/g,                  // <any>
    /any\[\]/g,                // any[]
    /Array<any>/g,             // Array<any>
    /Promise<any>/g,           // Promise<any>
    /\bany\s*\|/g,             // any | 
    /\|\s*any\b/g              // | any
  ];
  
  lines.forEach((line, index) => {
    // 跳过注释
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }
    
    anyPatterns.forEach(pattern => {
      if (pattern.test(line)) {
        // 特殊情况：某些any是必要的
        const necessaryAnyContexts = [
          'wx.cloud.callFunction',
          'wx.request',
          'catch',
          'error',
          'Promise.all',
          'Promise.race'
        ];
        
        const isNecessary = necessaryAnyContexts.some(context => line.includes(context));
        
        if (isNecessary) {
          results.anyType.warnings.push({
            file: filePath,
            line: index + 1,
            content: line.trim().substring(0, 80),
            message: '使用了any类型，考虑是否可以使用更具体的类型'
          });
        } else {
          results.anyType.errors.push({
            file: filePath,
            line: index + 1,
            content: line.trim().substring(0, 80),
            message: '❌ 不建议使用any类型，应使用具体类型定义'
          });
        }
        
        // 统计
        if (line.includes('as any')) {
          stats.asAnyCount++;
        }
        stats.anyCount++;
      }
    });
  });
}

/**
 * 检查空值处理
 */
function checkNullHandling(filePath, content) {
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // 跳过注释
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }
    
    // 检查直接使用可能为空的值
    const dangerousPatterns = [
      /(\w+)\.length\b/g,                    // 未检查null就访问length
      /(\w+)\.\w+\.\w+/g,                    // 链式调用未检查null
      /(\w+)\[['"\w]+\]\[['"\w]+\]/g,        // 多层数组/对象访问
    ];
    
    // 检查是否有空值检查
    const hasNullCheck = 
      line.includes('if (') ||
      line.includes('&& ') ||
      line.includes('|| ') ||
      line.includes('?.') ||
      line.includes('!') ||
      line.includes('?') ||
      line.includes('= ') ||
      line.includes('null') ||
      line.includes('undefined');
    
    if (!hasNullCheck) {
      dangerousPatterns.forEach(pattern => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // 排除一些安全的情况
            const safeCases = [
              'this.',
              'console.',
              'wx.',
              'Math.',
              'Date.',
              'Array.',
              'Object.',
              'String.',
              'Number.'
            ];
            
            const isSafe = safeCases.some(safeCase => match.startsWith(safeCase));
            
            if (!isSafe) {
              results.nullHandling.warnings.push({
                file: filePath,
                line: index + 1,
                content: match,
                message: '可能存在空值访问风险，建议添加空值检查'
              });
            }
          });
        }
      });
    }
    
    // 检查可选链的使用
    if (line.includes('?.')) {
      stats.nullCheckCount++;
    }
  });
}

/**
 * 检查类型定义
 */
function checkTypeDefinition(filePath, content) {
  const lines = content.split('\n');
  
  // 检查函数参数是否有类型
  const functionPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?)\s*\(([^)]*)\)/g;
  
  lines.forEach((line, index) => {
    // 跳过注释
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }
    
    const matches = line.match(functionPattern);
    if (matches) {
      matches.forEach(match => {
        // 提取参数部分
        const paramsMatch = match.match(/\(([^)]*)\)/);
        if (paramsMatch && paramsMatch[1]) {
          const params = paramsMatch[1].split(',');
          
          params.forEach(param => {
            param = param.trim();
            if (param && !param.includes(':') && !param.includes('=')) {
              // 排除一些特殊情况
              if (!param.includes('...') && !param.includes('{') && !param.includes('[')) {
                results.typeDefinition.warnings.push({
                  file: filePath,
                  line: index + 1,
                  param: param,
                  message: `参数 "${param}" 缺少类型定义`
                });
              }
            }
          });
        }
      });
    }
    
    // 检查变量声明是否有类型
    const varPattern = /(?:const|let|var)\s+(\w+)\s*=/g;
    let varMatch;
    while ((varMatch = varPattern.exec(line)) !== null) {
      const varName = varMatch[1];
      
      // 检查是否有类型注释
      if (!line.includes(`:`) && !line.includes('as ')) {
        // 只对复杂类型给出警告
        if (line.includes('[') || line.includes('{') || line.includes('new ')) {
          results.typeDefinition.warnings.push({
            file: filePath,
            line: index + 1,
            variable: varName,
            message: `变量 "${varName}" 建议添加类型定义`
          });
        }
      }
    }
  });
}

/**
 * 检查错误处理
 */
function checkErrorHandling(filePath, content) {
  const lines = content.split('\n');
  let inTryCatch = false;
  let asyncFunctionCount = 0;
  let tryCatchCount = 0;
  
  lines.forEach((line, index) => {
    // 统计async函数
    if (line.includes('async ')) {
      asyncFunctionCount++;
    }
    
    // 统计try-catch
    if (line.includes('try {')) {
      inTryCatch = true;
      tryCatchCount++;
      stats.tryCatchCount++;
    }
    if (line.includes('} catch')) {
      inTryCatch = false;
    }
    
    // 检查catch块中是否正确处理错误
    if (line.includes('catch (')) {
      const catchPattern = /catch\s*\((\w+)(?:\s*:\s*(\w+))?\)/;
      const catchMatch = line.match(catchPattern);
      
      if (catchMatch) {
        const errorVar = catchMatch[1];
        const errorType = catchMatch[2];
        
        if (!errorType || errorType === 'any') {
          results.errorHandling.warnings.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            message: `错误变量 "${errorVar}" 建议使用具体的错误类型`
          });
        }
      }
    }
    
    // 检查Promise是否有错误处理
    if (line.includes('.then(') && !line.includes('.catch(')) {
      // 检查下一行是否有catch
      if (index < lines.length - 1) {
        const nextLine = lines[index + 1];
        if (!nextLine.includes('.catch(')) {
          results.errorHandling.warnings.push({
            file: filePath,
            line: index + 1,
            content: line.trim().substring(0, 50),
            message: 'Promise缺少错误处理（.catch）'
          });
        }
      }
    }
  });
  
  // 如果async函数过多但try-catch过少，给出警告
  if (asyncFunctionCount > 5 && tryCatchCount < asyncFunctionCount / 3) {
    results.errorHandling.warnings.push({
      file: filePath,
      message: `文件中有 ${asyncFunctionCount} 个async函数，但只有 ${tryCatchCount} 个try-catch块`
    });
  }
}

/**
 * 检查TypeScript最佳实践
 */
function checkBestPractices(filePath, content) {
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // 检查是否使用了var
    if (/\bvar\s+\w+\s*=/.test(line)) {
      results.bestPractices.errors.push({
        file: filePath,
        line: index + 1,
        content: line.trim(),
        message: '❌ 不应使用var，请使用const或let'
      });
    }
    
    // 检查是否使用了==而不是===
    if (line.includes('==') && !line.includes('===') && !line.includes('!==')) {
      if (!line.includes('null') && !line.includes('undefined')) {
        results.bestPractices.warnings.push({
          file: filePath,
          line: index + 1,
          content: line.trim().substring(0, 50),
          message: '建议使用 === 代替 =='
        });
      }
    }
    
    // 检查是否使用了!=而不是!==
    if (line.includes('!=') && !line.includes('!==')) {
      if (!line.includes('null') && !line.includes('undefined')) {
        results.bestPractices.warnings.push({
          file: filePath,
          line: index + 1,
          content: line.trim().substring(0, 50),
          message: '建议使用 !== 代替 !='
        });
      }
    }
    
    // 检查是否使用了@ts-ignore
    if (line.includes('@ts-ignore')) {
      results.bestPractices.warnings.push({
        file: filePath,
        line: index + 1,
        content: line.trim(),
        message: '使用了 @ts-ignore，建议修复类型问题而不是忽略'
      });
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
      
      // 只检查TypeScript文件
      if (ext === '.ts') {
        stats.totalFiles++;
        const content = fs.readFileSync(fullPath, 'utf8');
        stats.totalLines += content.split('\n').length;
        
        checkAnyType(fullPath, content);
        checkNullHandling(fullPath, content);
        checkTypeDefinition(fullPath, content);
        checkErrorHandling(fullPath, content);
        checkBestPractices(fullPath, content);
      }
    }
  });
}

/**
 * 打印结果
 */
function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📘 TypeScript规范检查结果');
  console.log('='.repeat(60));
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  // any类型使用
  if (results.anyType.errors.length > 0 || results.anyType.warnings.length > 0) {
    console.log('\n🚫 Any类型使用:');
    
    if (results.anyType.errors.length > 0) {
      console.log(`  ❌ 错误 (${results.anyType.errors.length}):`);
      results.anyType.errors.slice(0, 5).forEach(error => {
        const filePath = path.relative(process.cwd(), error.file);
        console.log(`    - ${filePath}:${error.line}`);
        console.log(`      ${error.content}`);
      });
      if (results.anyType.errors.length > 5) {
        console.log(`    ... 还有 ${results.anyType.errors.length - 5} 个错误`);
      }
      totalErrors += results.anyType.errors.length;
    }
    
    if (results.anyType.warnings.length > 0) {
      console.log(`  ⚠️  警告 (${results.anyType.warnings.length}):`);
      console.log(`    发现 ${results.anyType.warnings.length} 处可能必要的any类型使用`);
      totalWarnings += results.anyType.warnings.length;
    }
  }
  
  // 空值处理
  if (results.nullHandling.warnings.length > 0) {
    console.log('\n⚠️  空值处理:');
    console.log(`  ⚠️  警告 (${results.nullHandling.warnings.length}):`);
    const samples = results.nullHandling.warnings.slice(0, 5);
    samples.forEach(warning => {
      const filePath = path.relative(process.cwd(), warning.file);
      console.log(`    - ${filePath}:${warning.line}`);
      console.log(`      ${warning.message}: ${warning.content}`);
    });
    if (results.nullHandling.warnings.length > 5) {
      console.log(`    ... 还有 ${results.nullHandling.warnings.length - 5} 个警告`);
    }
    totalWarnings += results.nullHandling.warnings.length;
  }
  
  // 类型定义
  if (results.typeDefinition.warnings.length > 0) {
    console.log('\n📝 类型定义:');
    console.log(`  ⚠️  警告 (${results.typeDefinition.warnings.length}):`);
    console.log(`    发现 ${results.typeDefinition.warnings.length} 处缺少类型定义`);
    totalWarnings += results.typeDefinition.warnings.length;
  }
  
  // 错误处理
  if (results.errorHandling.warnings.length > 0) {
    console.log('\n🔧 错误处理:');
    console.log(`  ⚠️  警告 (${results.errorHandling.warnings.length}):`);
    const samples = results.errorHandling.warnings.slice(0, 3);
    samples.forEach(warning => {
      if (warning.file) {
        const filePath = path.relative(process.cwd(), warning.file);
        console.log(`    - ${filePath}${warning.line ? ':' + warning.line : ''}`);
      }
      console.log(`      ${warning.message}`);
    });
    if (results.errorHandling.warnings.length > 3) {
      console.log(`    ... 还有 ${results.errorHandling.warnings.length - 3} 个警告`);
    }
    totalWarnings += results.errorHandling.warnings.length;
  }
  
  // 最佳实践
  if (results.bestPractices.errors.length > 0 || results.bestPractices.warnings.length > 0) {
    console.log('\n💡 最佳实践:');
    
    if (results.bestPractices.errors.length > 0) {
      console.log(`  ❌ 错误 (${results.bestPractices.errors.length}):`);
      results.bestPractices.errors.slice(0, 3).forEach(error => {
        const filePath = path.relative(process.cwd(), error.file);
        console.log(`    - ${filePath}:${error.line}`);
        console.log(`      ${error.message}`);
      });
      if (results.bestPractices.errors.length > 3) {
        console.log(`    ... 还有 ${results.bestPractices.errors.length - 3} 个错误`);
      }
      totalErrors += results.bestPractices.errors.length;
    }
    
    if (results.bestPractices.warnings.length > 0) {
      console.log(`  ⚠️  警告 (${results.bestPractices.warnings.length}):`);
      console.log(`    发现 ${results.bestPractices.warnings.length} 处可改进的代码`);
      totalWarnings += results.bestPractices.warnings.length;
    }
  }
  
  // 打印统计信息
  console.log('\n' + '-'.repeat(60));
  console.log('📊 统计信息:');
  console.log(`  检查文件数: ${stats.totalFiles}`);
  console.log(`  总代码行数: ${stats.totalLines}`);
  console.log(`  any使用次数: ${stats.anyCount} (其中 as any: ${stats.asAnyCount})`);
  console.log(`  可选链使用: ${stats.nullCheckCount}`);
  console.log(`  try-catch块: ${stats.tryCatchCount}`);
  
  console.log('\n📊 总结:');
  console.log(`  错误总数: ${totalErrors}`);
  console.log(`  警告总数: ${totalWarnings}`);
  
  if (totalErrors === 0 && totalWarnings < 50) {
    console.log('\n✅ TypeScript代码质量良好！');
  } else if (totalErrors === 0) {
    console.log('\n⚠️  TypeScript代码基本符合规范，但有改进空间。');
  } else {
    console.log('\n❌ 发现TypeScript规范问题，请根据错误信息进行修正。');
    console.log('\n建议：');
    console.log('  1. 避免使用any类型，使用具体的类型定义');
    console.log('  2. 对可能为空的值进行检查或使用可选链');
    console.log('  3. 为函数参数和返回值添加类型定义');
    console.log('  4. 使用const/let代替var，使用===代替==');
  }
  
  console.log('='.repeat(60) + '\n');
  
  return totalErrors === 0;
}

/**
 * 主函数
 */
function main() {
  console.log('📘 开始检查TypeScript规范...\n');
  
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
  
  process.exit(success ? 0 : 1);
}

// 执行主函数
main();
