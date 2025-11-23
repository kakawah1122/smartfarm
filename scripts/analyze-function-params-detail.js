#!/usr/bin/env node

/**
 * 详细分析函数参数中的any类型
 * 按参数名分类，便于批量修复
 */

const fs = require('fs');
const path = require('path');

// 存储分析结果
const paramsByName = {};
const paramsByFile = {};
let totalParams = 0;

/**
 * 分析TypeScript文件
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.relative(process.cwd(), filePath);
  
  // 匹配函数参数中的any
  // 模式1: (param: any)
  const paramPattern1 = /\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*any\s*[\),]/g;
  // 模式2: (param: any, ...)
  const paramPattern2 = /,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*any\s*[\),]/g;
  // 模式3: 函数参数定义
  const funcParamPattern = /function[^(]*\([^)]*?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*any[^)]*?\)/g;
  // 模式4: 箭头函数参数
  const arrowParamPattern = /\(([^)]*?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*any[^)]*?)\)\s*=>/g;
  
  const patterns = [paramPattern1, paramPattern2, funcParamPattern, arrowParamPattern];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const paramName = match[1] || match[2];
      if (paramName) {
        // 按参数名分类
        if (!paramsByName[paramName]) {
          paramsByName[paramName] = [];
        }
        paramsByName[paramName].push({
          file: fileName,
          line: content.substring(0, match.index).split('\n').length
        });
        
        // 按文件分类
        if (!paramsByFile[fileName]) {
          paramsByFile[fileName] = [];
        }
        paramsByFile[fileName].push({
          name: paramName,
          line: content.substring(0, match.index).split('\n').length
        });
        
        totalParams++;
      }
    }
  });
}

/**
 * 扫描目录
 */
function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过node_modules和备份目录
      if (!file.includes('node_modules') && !file.includes('backup') && !file.includes('.git')) {
        scanDirectory(filePath);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      analyzeFile(filePath);
    }
  });
}

/**
 * 生成推荐的类型映射
 */
function getRecommendedType(paramName) {
  const lowerName = paramName.toLowerCase();
  
  // 基于参数名的类型推断
  if (lowerName.includes('event') || lowerName === 'e') {
    return 'WechatMiniprogram.CustomEvent';
  }
  if (lowerName.includes('error') || lowerName === 'err') {
    return 'unknown';
  }
  if (lowerName.includes('data') || lowerName.includes('result')) {
    return 'unknown';
  }
  if (lowerName.includes('options') || lowerName.includes('config')) {
    return 'Record<string, unknown>';
  }
  if (lowerName.includes('callback') || lowerName === 'cb') {
    return '(...args: unknown[]) => unknown';
  }
  if (lowerName.includes('context') || lowerName === 'ctx') {
    return 'unknown';
  }
  if (lowerName.includes('params') || lowerName === 'args') {
    return 'unknown[]';
  }
  if (lowerName.includes('value') || lowerName === 'val') {
    return 'unknown';
  }
  if (lowerName.includes('item') || lowerName.includes('element')) {
    return 'unknown';
  }
  if (lowerName.includes('index') || lowerName === 'i' || lowerName === 'idx') {
    return 'number';
  }
  
  return 'unknown';
}

/**
 * 主程序
 */
function main() {
  console.log('🔍 分析函数参数中的any类型\n');
  
  const targetDir = path.join(process.cwd(), 'miniprogram');
  
  if (fs.existsSync(targetDir)) {
    console.log('扫描中...\n');
    scanDirectory(targetDir);
  }
  
  console.log(`📊 分析完成！\n`);
  console.log(`总计: ${totalParams} 个函数参数使用any\n`);
  
  // 按参数名排序（按出现次数）
  const sortedParams = Object.entries(paramsByName)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20); // 只显示前20个
  
  console.log('🎯 高频参数名（Top 20）:\n');
  console.log('参数名'.padEnd(20) + '出现次数'.padEnd(10) + '建议类型');
  console.log('-'.repeat(60));
  
  sortedParams.forEach(([name, locations]) => {
    const recommendedType = getRecommendedType(name);
    console.log(
      name.padEnd(20) + 
      locations.length.toString().padEnd(10) + 
      recommendedType
    );
  });
  
  // 生成修复脚本建议
  console.log('\n💡 修复策略建议:');
  console.log('1. 优先处理高频参数名（可批量替换）');
  console.log('2. event/e 参数 → WechatMiniprogram.CustomEvent');
  console.log('3. error/err 参数 → unknown');
  console.log('4. data/result 参数 → unknown');
  console.log('5. options/config 参数 → Record<string, unknown>');
  
  // 生成详细报告
  const report = {
    totalParams,
    paramsByName: Object.fromEntries(
      Object.entries(paramsByName).map(([name, locs]) => [
        name,
        {
          count: locs.length,
          recommendedType: getRecommendedType(name),
          locations: locs.slice(0, 5) // 只保存前5个位置
        }
      ])
    ),
    filesSummary: Object.entries(paramsByFile)
      .map(([file, params]) => ({
        file,
        count: params.length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // 只保存前10个文件
  };
  
  const reportPath = path.join(__dirname, '..', 'docs', `FUNCTION-PARAMS-ANALYSIS-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 详细报告已保存: ${path.relative(process.cwd(), reportPath)}`);
}

// 运行主程序
main();
