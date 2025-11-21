#!/usr/bin/env node

/**
 * 优化页面文件中的any类型
 * 安全地替换页面中的any类型，避免影响功能
 */

const fs = require('fs');
const path = require('path');

// 统计信息
const stats = {
  totalFiles: 0,
  processedFiles: 0,
  totalReplacements: 0,
  fileReplacements: {}
};

// 页面文件特定的替换规则
const PAGE_RULES = [
  // 事件处理函数
  {
    pattern: /(\w+)\s*\(\s*e:\s*any\s*\)/g,
    replacement: (match, methodName, offset, string) => {
      // 确保methodName是字符串
      const method = String(methodName);
      
      // 根据方法名判断事件类型
      const eventTypeMap = {
        'onTap': 'TapEvent',
        'onClick': 'TapEvent',
        'onInput': 'InputEvent',
        'onChange': 'InputEvent',
        'onSubmit': 'CustomEvent',
        'onConfirm': 'CustomEvent',
        'onCancel': 'CustomEvent',
        'onScroll': 'ScrollEvent',
        'onPicker': 'PickerEvent',
        'onSwitch': 'CustomEvent',
        'handleTap': 'TapEvent',
        'handleInput': 'InputEvent',
        'handleChange': 'InputEvent',
        'switchTab': 'TapEvent'
      };
      
      // 查找匹配的事件类型
      for (const [prefix, eventType] of Object.entries(eventTypeMap)) {
        if (method.includes(prefix) || method.startsWith(prefix)) {
          return `${method}(e: ${eventType})`;
        }
      }
      
      // 默认使用CustomEvent
      return `${method}(e: CustomEvent)`;
    },
    description: '事件处理函数参数'
  },
  
  // 云函数响应
  {
    pattern: /safeCloudCall<any>/g,
    replacement: 'safeCloudCall<BaseResponse>',
    description: '云函数调用'
  },
  {
    pattern: /CloudApi\.callFunction<any>/g,
    replacement: 'CloudApi.callFunction<BaseResponse>',
    description: 'CloudAPI调用'
  },
  
  // Promise类型
  {
    pattern: /:\s*Promise<any>/g,
    replacement: ': Promise<BaseResponse>',
    description: 'Promise响应'
  },
  
  // 数组类型
  {
    pattern: /:\s*any\[\]\s*(?=[,;}\n])/g,
    replacement: (match, offset, string) => {
      // 根据上下文判断具体类型
      const context = string.substring(Math.max(0, offset - 100), offset);
      
      if (context.includes('batch') || context.includes('Batch')) {
        return ': Batch[]';
      } else if (context.includes('task') || context.includes('Task')) {
        return ': BaseResponse[]';
      } else if (context.includes('record') || context.includes('Record')) {
        return ': HealthRecord[]';
      } else {
        return ': unknown[]';
      }
    },
    description: '数组类型'
  },
  
  // as any 类型断言
  {
    pattern: /as\s+any\b/g,
    replacement: (match, offset, string) => {
      const context = string.substring(Math.max(0, offset - 50), offset);
      
      if (context.includes('result')) {
        return 'as BaseResponse';
      } else if (context.includes('data')) {
        return 'as unknown';
      } else {
        return 'as unknown';
      }
    },
    description: '类型断言'
  },
  
  // 简单any替换
  {
    pattern: /:\s*any\b(?![>\[\]])/g,
    replacement: ': unknown',
    description: '简单any类型',
    skipPatterns: ['Promise', 'Array', '=>', 'function']
  }
];

/**
 * 检查是否应该跳过某个替换
 */
function shouldSkip(content, offset, skipPatterns) {
  if (!skipPatterns) return false;
  
  const context = content.substring(Math.max(0, offset - 50), Math.min(content.length, offset + 50));
  return skipPatterns.some(pattern => context.includes(pattern));
}

/**
 * 处理单个页面文件
 */
function processPageFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 处理页面: ${fileName}`);
  
  // 跳过某些特殊文件
  if (fileName.includes('.backup') || fileName.includes('example')) {
    console.log('  ⏭️  跳过特殊文件');
    return 0;
  }
  
  stats.totalFiles++;
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let replacements = 0;
  
  // 检查是否已导入类型定义
  if (!content.includes("from '../typings/core'") && 
      !content.includes("from '../../typings/core'") &&
      !content.includes("from '../../../typings/core'")) {
    
    // 计算正确的导入路径
    const depth = filePath.split('/').filter(p => p && p !== '.').length;
    const importPath = '../'.repeat(Math.max(1, depth - 2)) + 'typings/core';
    
    // 检查是否已有其他导入，如果有则在其后添加
    if (content.includes('import ')) {
      const firstImportIndex = content.indexOf('import ');
      const lineEndIndex = content.indexOf('\n', firstImportIndex);
      
      const typeImport = `\nimport type { 
  BaseResponse, 
  Batch, 
  HealthRecord,
  InputEvent, 
  TapEvent, 
  CustomEvent,
  ScrollEvent,
  PickerEvent 
} from '${importPath}';`;
      
      content = content.substring(0, lineEndIndex) + typeImport + content.substring(lineEndIndex);
      console.log('  ✅ 添加类型导入');
    }
  }
  
  // 应用替换规则
  PAGE_RULES.forEach(rule => {
    if (typeof rule.replacement === 'function') {
      // 使用函数替换
      let lastIndex = 0;
      let match;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      
      while ((match = regex.exec(content)) !== null) {
        if (!shouldSkip(content, match.index, rule.skipPatterns)) {
          const replacement = rule.replacement(match[0], match.index, content);
          if (replacement !== match[0]) {
            replacements++;
          }
        }
      }
      
      // 执行实际替换
      content = content.replace(rule.pattern, rule.replacement);
      
    } else {
      // 简单字符串替换
      const matches = content.match(rule.pattern);
      if (matches) {
        // 过滤需要跳过的
        let validMatches = 0;
        if (rule.skipPatterns) {
          const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
          let match;
          while ((match = regex.exec(content)) !== null) {
            if (!shouldSkip(content, match.index, rule.skipPatterns)) {
              validMatches++;
            }
          }
        } else {
          validMatches = matches.length;
        }
        
        if (validMatches > 0) {
          content = content.replace(rule.pattern, rule.replacement);
          replacements += validMatches;
          console.log(`  📝 ${rule.description}: ${validMatches}处`);
        }
      }
    }
  });
  
  // 保存修改
  if (content !== originalContent) {
    // 创建备份
    const backupPath = filePath + '.type-backup';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
    }
    
    // 保存修改
    fs.writeFileSync(filePath, content, 'utf8');
    
    stats.processedFiles++;
    stats.totalReplacements += replacements;
    stats.fileReplacements[fileName] = replacements;
    
    console.log(`  ✅ 完成: 替换了 ${replacements} 处`);
    return replacements;
  } else {
    console.log(`  ℹ️  无需修改`);
    return 0;
  }
}

/**
 * 扫描并处理页面文件
 */
function processPages() {
  const pagesDir = path.join(process.cwd(), 'miniprogram/pages');
  
  // 优先处理的页面
  const priorityPages = [
    'health/health.ts',
    'production/production.ts',
    'finance/finance.ts',
    'index/index.ts',
    'profile/profile.ts'
  ];
  
  // 处理优先页面
  console.log('🎯 处理优先页面...');
  priorityPages.forEach(pagePath => {
    const fullPath = path.join(pagesDir, pagePath);
    if (fs.existsSync(fullPath)) {
      processPageFile(fullPath);
    }
  });
  
  // 处理health目录下的其他文件
  console.log('\n📁 处理health目录...');
  const healthDir = path.join(pagesDir, 'health');
  if (fs.existsSync(healthDir)) {
    // helpers目录
    const helpersDir = path.join(healthDir, 'helpers');
    if (fs.existsSync(helpersDir)) {
      fs.readdirSync(helpersDir).forEach(file => {
        if (file.endsWith('.ts') && !file.includes('backup')) {
          processPageFile(path.join(helpersDir, file));
        }
      });
    }
    
    // modules目录
    const modulesDir = path.join(healthDir, 'modules');
    if (fs.existsSync(modulesDir)) {
      fs.readdirSync(modulesDir).forEach(file => {
        if (file.endsWith('.ts') && !file.includes('backup')) {
          processPageFile(path.join(modulesDir, file));
        }
      });
    }
  }
}

/**
 * 生成报告
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 优化报告');
  console.log('='.repeat(60));
  
  console.log(`\n统计信息:`);
  console.log(`  扫描文件: ${stats.totalFiles}`);
  console.log(`  处理文件: ${stats.processedFiles}`);
  console.log(`  替换总数: ${stats.totalReplacements}`);
  
  if (Object.keys(stats.fileReplacements).length > 0) {
    console.log(`\n详细结果:`);
    Object.entries(stats.fileReplacements)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([file, count]) => {
        console.log(`  ${file}: ${count}处`);
      });
  }
  
  console.log(`\n💡 建议:`);
  console.log('1. 检查编译是否通过');
  console.log('2. 运行 npm run check:ts 查看剩余问题');
  console.log('3. 逐步将unknown替换为具体类型');
  console.log('4. 测试主要功能是否正常');
  
  console.log('\n⚠️  注意:');
  console.log('- 已创建.type-backup备份文件');
  console.log('- 部分any需要人工确认具体类型');
  console.log('- 建议逐步测试各功能模块');
}

/**
 * 主函数
 */
function main() {
  console.log('🔧 页面文件类型优化工具');
  console.log('='.repeat(60));
  
  // 检查类型定义文件
  const coreTypesPath = path.join(process.cwd(), 'typings/core.d.ts');
  if (!fs.existsSync(coreTypesPath)) {
    console.error('❌ 类型定义文件不存在: typings/core.d.ts');
    process.exit(1);
  }
  
  // 处理页面文件
  processPages();
  
  // 生成报告
  generateReport();
  
  console.log('='.repeat(60));
}

// 执行
main();
