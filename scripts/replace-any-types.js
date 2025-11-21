#!/usr/bin/env node

/**
 * 批量替换any类型工具
 * 使用core.d.ts中定义的类型替换any
 */

const fs = require('fs');
const path = require('path');

// 替换规则配置
const REPLACE_RULES = [
  // 事件类型替换
  {
    pattern: /\(e:\s*any\)/g,
    replacement: (match, context) => {
      if (context.includes('onInput') || context.includes('onChange')) {
        return '(e: InputEvent)';
      } else if (context.includes('onTap') || context.includes('onClick')) {
        return '(e: TapEvent)';
      } else if (context.includes('Picker') || context.includes('onPicker')) {
        return '(e: PickerEvent)';
      } else if (context.includes('onScroll')) {
        return '(e: ScrollEvent)';
      }
      return match; // 保持原样
    },
    description: '事件参数类型'
  },
  
  // 响应类型替换
  {
    pattern: /:\s*Promise<any>/g,
    replacement: ': Promise<BaseResponse>',
    description: 'Promise响应类型'
  },
  {
    pattern: /as\s+any\b/g,
    replacement: (match, context) => {
      if (context.includes('wx.cloud.callFunction')) {
        return 'as CloudFunctionResponse';
      } else if (context.includes('result')) {
        return 'as BaseResponse';
      }
      return match; // 暂时保留需要人工判断的
    },
    description: '类型断言'
  },
  
  // 数组类型替换
  {
    pattern: /:\s*any\[\]/g,
    replacement: (match, context) => {
      if (context.includes('batch') || context.includes('Batch')) {
        return ': Batch[]';
      } else if (context.includes('record') || context.includes('Record')) {
        return ': HealthRecord[]';
      } else if (context.includes('finance') || context.includes('Finance')) {
        return ': FinanceRecord[]';
      }
      return ': unknown[]'; // 默认改为unknown[]
    },
    description: '数组类型'
  },
  
  // 简单any替换为unknown
  {
    pattern: /:\s*any\b(?!\[\])/g,
    replacement: ': unknown',
    description: '简单any类型',
    skipIf: ['Promise', 'Array', 'function', '=>'] // 如果包含这些关键词则跳过
  }
];

// 需要处理的文件
const TARGET_FILES = [
  'miniprogram/app.ts',
  'miniprogram/pages/health/health.ts',
  'miniprogram/pages/production/production.ts',
  'miniprogram/pages/finance/finance.ts'
];

// 统计信息
let totalReplacements = 0;
const replacementDetails = {};

/**
 * 获取文件上下文（用于智能判断）
 */
function getContext(content, index, range = 50) {
  const start = Math.max(0, index - range);
  const end = Math.min(content.length, index + range);
  return content.substring(start, end);
}

/**
 * 处理单个文件
 */
function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return;
  }
  
  console.log(`\n📄 处理文件: ${filePath}`);
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  let fileReplacements = 0;
  
  // 检查是否已导入类型定义
  if (!content.includes("from '../typings/core'") && 
      !content.includes("from '../../typings/core'") &&
      !content.includes("from './typings/core'")) {
    // 添加导入语句
    const importStatement = getImportPath(filePath);
    content = importStatement + '\n' + content;
    console.log('  ✅ 添加类型导入');
  }
  
  // 应用替换规则
  REPLACE_RULES.forEach(rule => {
    const matches = content.match(rule.pattern);
    if (matches && matches.length > 0) {
      if (typeof rule.replacement === 'function') {
        // 智能替换
        let newContent = content;
        let offset = 0;
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          const context = getContext(content, match.index);
          
          // 检查是否应该跳过
          if (rule.skipIf && rule.skipIf.some(keyword => context.includes(keyword))) {
            continue;
          }
          
          const replacement = rule.replacement(match[0], context);
          if (replacement !== match[0]) {
            newContent = newContent.replace(match[0], replacement);
            fileReplacements++;
            totalReplacements++;
          }
        }
        content = newContent;
      } else {
        // 简单替换
        if (!rule.skipIf || !rule.skipIf.some(keyword => content.includes(keyword))) {
          const count = matches.length;
          content = content.replace(rule.pattern, rule.replacement);
          fileReplacements += count;
          totalReplacements += count;
          console.log(`  📝 ${rule.description}: 替换了 ${count} 处`);
        }
      }
    }
  });
  
  // 保存修改
  if (content !== originalContent) {
    // 创建备份
    const backupPath = fullPath + '.backup';
    fs.copyFileSync(fullPath, backupPath);
    
    // 保存修改后的文件
    fs.writeFileSync(fullPath, content, 'utf8');
    
    console.log(`  ✅ 完成: 替换了 ${fileReplacements} 处any类型`);
    console.log(`  📁 备份: ${path.basename(backupPath)}`);
    
    replacementDetails[filePath] = fileReplacements;
  } else {
    console.log(`  ℹ️  没有需要替换的any类型`);
  }
}

/**
 * 获取正确的导入路径
 */
function getImportPath(filePath) {
  const depth = filePath.split('/').length - 1;
  const relativePath = '../'.repeat(depth) + 'typings/core';
  
  return `import type { 
  BaseResponse, 
  CloudFunctionResponse,
  Batch, 
  HealthRecord, 
  FinanceRecord,
  InputEvent, 
  TapEvent, 
  PickerEvent, 
  ScrollEvent 
} from '${relativePath}';`;
}

/**
 * 生成替换报告
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 替换报告');
  console.log('='.repeat(60));
  
  console.log('\n详细结果:');
  Object.entries(replacementDetails).forEach(([file, count]) => {
    console.log(`  ${file}: ${count} 处`);
  });
  
  console.log(`\n总计替换: ${totalReplacements} 处any类型`);
  
  console.log('\n💡 后续建议:');
  console.log('1. 检查自动替换的结果，确保类型正确');
  console.log('2. 运行 npm run check:ts 验证类型问题');
  console.log('3. 逐步替换剩余的unknown类型为具体类型');
  console.log('4. 考虑启用TypeScript严格模式');
  
  console.log('\n⚠️  注意:');
  console.log('- 部分any类型需要人工判断具体类型');
  console.log('- 已创建.backup文件，可随时恢复');
  console.log('- 建议提交前进行充分测试');
}

/**
 * 主函数
 */
function main() {
  console.log('🔧 批量替换any类型工具');
  console.log('='.repeat(60));
  
  // 检查类型定义文件是否存在
  const coreTypesPath = path.join(process.cwd(), 'typings/core.d.ts');
  if (!fs.existsSync(coreTypesPath)) {
    console.error('❌ 类型定义文件不存在: typings/core.d.ts');
    console.log('请先创建类型定义文件');
    process.exit(1);
  }
  
  // 处理目标文件
  TARGET_FILES.forEach(processFile);
  
  // 查找更多包含any的文件
  console.log('\n🔍 扫描其他文件...');
  scanForAnyTypes();
  
  // 生成报告
  generateReport();
}

/**
 * 扫描更多包含any的文件
 */
function scanForAnyTypes() {
  const scanDirs = ['miniprogram/components', 'miniprogram/utils'];
  let foundFiles = [];
  
  scanDirs.forEach(dir => {
    const fullDir = path.join(process.cwd(), dir);
    if (fs.existsSync(fullDir)) {
      scanDirectory(fullDir, foundFiles);
    }
  });
  
  if (foundFiles.length > 0) {
    console.log(`\n发现 ${foundFiles.length} 个其他文件包含any类型:`);
    foundFiles.slice(0, 10).forEach(file => {
      console.log(`  - ${path.relative(process.cwd(), file)}`);
    });
    if (foundFiles.length > 10) {
      console.log(`  ... 还有 ${foundFiles.length - 10} 个文件`);
    }
  }
}

/**
 * 递归扫描目录
 */
function scanDirectory(dirPath, foundFiles) {
  const items = fs.readdirSync(dirPath);
  
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!['node_modules', '.git', 'miniprogram_npm'].includes(item)) {
        scanDirectory(fullPath, foundFiles);
      }
    } else if (item.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(': any') || content.includes('as any')) {
        foundFiles.push(fullPath);
      }
    }
  });
}

// 执行
main();
