#!/usr/bin/env node

/**
 * 修复组件中的any类型
 * 针对弹窗组件和其他常见组件的类型问题
 */

const fs = require('fs');
const path = require('path');

// 组件特定的替换规则
const COMPONENT_RULES = [
  // 组件属性
  {
    pattern: /properties:\s*{([^}]+)}/gs,
    process: (match, content) => {
      // 为属性添加类型
      let newContent = content;
      
      // value: { type: xxx } 格式的属性
      newContent = newContent.replace(
        /(\w+):\s*{\s*type:\s*(\w+)/g,
        (m, name, type) => {
          const tsType = getTypeScriptType(type);
          return `${name}: {\n      type: ${type} as PropType<${tsType}>`;
        }
      );
      
      return `properties: {${newContent}}`;
    },
    description: '组件属性类型'
  },
  
  // 组件方法中的事件参数
  {
    pattern: /methods:\s*{[^}]*\w+\s*\([^)]*e:\s*any[^)]*\)/gs,
    replacement: (match) => {
      // 根据方法名判断事件类型
      if (match.includes('onTap') || match.includes('onClick')) {
        return match.replace(/e:\s*any/, 'e: TapEvent');
      } else if (match.includes('onInput') || match.includes('onChange')) {
        return match.replace(/e:\s*any/, 'e: InputEvent');
      } else if (match.includes('onConfirm') || match.includes('onCancel')) {
        return match.replace(/e:\s*any/, 'e: TapEvent');
      }
      return match.replace(/e:\s*any/, 'e: CustomEvent');
    },
    description: '组件方法事件参数'
  },
  
  // 组件data中的any
  {
    pattern: /data:\s*{([^}]+)}/gs,
    process: (match, content) => {
      let newContent = content;
      
      // 替换常见的any类型
      newContent = newContent.replace(/:\s*null\s+as\s+any/g, ': null as unknown');
      newContent = newContent.replace(/:\s*\[\]\s+as\s+any\[\]/g, ': [] as unknown[]');
      newContent = newContent.replace(/:\s*{}\s+as\s+any/g, ': {} as Record<string, unknown>');
      
      return `data: {${newContent}}`;
    },
    description: '组件data类型'
  },
  
  // triggerEvent的detail参数
  {
    pattern: /this\.triggerEvent\(['"](\w+)['"],\s*({[^}]+})\)/g,
    replacement: (match, eventName, detail) => {
      // 为detail添加类型注释
      return `this.triggerEvent('${eventName}', ${detail} as ${getEventDetailType(eventName)})`;
    },
    description: 'triggerEvent参数类型'
  }
];

// 获取TypeScript类型
function getTypeScriptType(wxType) {
  const typeMap = {
    'String': 'string',
    'Number': 'number',
    'Boolean': 'boolean',
    'Array': 'unknown[]',
    'Object': 'Record<string, unknown>',
    'Function': '(...args: any[]) => void'
  };
  return typeMap[wxType] || 'unknown';
}

// 获取事件detail类型
function getEventDetailType(eventName) {
  const eventTypes = {
    'confirm': '{ value: unknown }',
    'cancel': '{ reason?: string }',
    'change': '{ value: unknown }',
    'input': '{ value: string }',
    'select': '{ selected: unknown }'
  };
  return eventTypes[eventName] || 'Record<string, unknown>';
}

// 处理单个组件文件
function processComponentFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📦 处理组件: ${fileName}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let replacements = 0;
  
  // 检查是否需要导入类型
  if (!content.includes('import type')) {
    const imports = `import type {
  InputEvent,
  TapEvent,
  ScrollEvent,
  CustomEvent,
  PropType
} from '../../../typings/core';\n\n`;
    
    // 根据文件路径深度调整导入路径
    const depth = filePath.split('/').filter(p => p && p !== '.').length - 2;
    const importPath = '../'.repeat(depth) + 'typings/core';
    const adjustedImports = imports.replace('../../../typings/core', importPath);
    
    content = adjustedImports + content;
    console.log('  ✅ 添加类型导入');
  }
  
  // 应用替换规则
  COMPONENT_RULES.forEach(rule => {
    if (rule.process) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      const matches = content.match(regex);
      if (matches) {
        matches.forEach(match => {
          const newMatch = rule.process(match, match);
          if (newMatch !== match) {
            content = content.replace(match, newMatch);
            replacements++;
          }
        });
        console.log(`  📝 ${rule.description}: ${matches.length}处`);
      }
    } else if (rule.replacement) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      const matches = content.match(regex);
      if (matches) {
        content = content.replace(regex, rule.replacement);
        replacements += matches.length;
        console.log(`  📝 ${rule.description}: ${matches.length}处`);
      }
    }
  });
  
  // 简单替换
  const simpleReplacements = [
    { from: /:\s*any\b/g, to: ': unknown', desc: 'any → unknown' },
    { from: /as\s+any\b/g, to: 'as unknown', desc: 'as any → as unknown' },
    { from: /:\s*any\[\]/g, to: ': unknown[]', desc: 'any[] → unknown[]' }
  ];
  
  simpleReplacements.forEach(rule => {
    const matches = content.match(rule.from);
    if (matches) {
      content = content.replace(rule.from, rule.to);
      replacements += matches.length;
      console.log(`  📝 ${rule.desc}: ${matches.length}处`);
    }
  });
  
  // 保存修改
  if (content !== originalContent) {
    // 创建备份
    fs.copyFileSync(filePath, filePath + '.backup');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ 完成: 替换了 ${replacements} 处类型`);
    return replacements;
  } else {
    console.log(`  ℹ️  无需修改`);
    return 0;
  }
}

// 扫描组件目录
function scanComponents() {
  const componentsDir = path.join(process.cwd(), 'miniprogram/components');
  const popupComponents = [
    'adverse-reaction-popup',
    'analysis-history-detail-popup',
    'bottom-popup',
    'cured-record-detail-popup',
    'death-record-detail-popup',
    'diagnosis-detail-popup',
    'entry-record-detail-popup',
    'exit-record-detail-popup',
    'finance-record-detail-popup',
    'goose-price-detail-popup'
  ];
  
  let totalReplacements = 0;
  const processedFiles = [];
  
  popupComponents.forEach(componentName => {
    const componentPath = path.join(componentsDir, componentName, `${componentName}.ts`);
    if (fs.existsSync(componentPath)) {
      const count = processComponentFile(componentPath);
      totalReplacements += count;
      if (count > 0) {
        processedFiles.push({ file: componentName, count });
      }
    } else {
      console.log(`⚠️  组件不存在: ${componentName}`);
    }
  });
  
  return { totalReplacements, processedFiles };
}

// 主函数
function main() {
  console.log('🔧 组件类型修复工具');
  console.log('='.repeat(60));
  
  // 处理组件
  const { totalReplacements, processedFiles } = scanComponents();
  
  // 生成报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 修复报告');
  console.log('='.repeat(60));
  
  if (processedFiles.length > 0) {
    console.log('\n成功处理的文件:');
    processedFiles.forEach(({ file, count }) => {
      console.log(`  ${file}: ${count}处`);
    });
  }
  
  console.log(`\n总计: 替换了 ${totalReplacements} 处类型问题`);
  
  console.log('\n💡 建议:');
  console.log('1. 检查备份文件，确保修改正确');
  console.log('2. 运行 npm run check:ts 验证类型');
  console.log('3. 逐步将unknown替换为具体类型');
  
  console.log('='.repeat(60));
}

// 执行
main();
