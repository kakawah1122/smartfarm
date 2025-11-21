#!/usr/bin/env node

/**
 * 修复组件properties类型错误
 * 恢复正确的小程序组件属性格式
 */

const fs = require('fs');
const path = require('path');

// 需要修复的组件列表
const COMPONENTS_TO_FIX = [
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

/**
 * 修复组件文件
 */
function fixComponentFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n📦 修复组件: ${fileName}`);
  
  // 检查备份文件是否存在
  const backupPath = filePath + '.backup';
  if (fs.existsSync(backupPath)) {
    // 从备份恢复
    const backupContent = fs.readFileSync(backupPath, 'utf8');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 只恢复properties部分，保留其他优化
    const propertiesMatch = backupContent.match(/properties:\s*{[^}]+}/s);
    if (propertiesMatch) {
      const currentPropertiesMatch = content.match(/properties:\s*{[^}]+}/s);
      if (currentPropertiesMatch) {
        content = content.replace(currentPropertiesMatch[0], propertiesMatch[0]);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('  ✅ 已从备份恢复properties定义');
        return true;
      }
    }
  }
  
  // 如果没有备份，尝试修复错误的格式
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // 修复错误的 PropType 格式
  content = content.replace(
    /type:\s*(\w+)\s+as\s+PropType<[^>]+>/g,
    'type: $1'
  );
  
  // 确保properties格式正确
  const propertiesPattern = /properties:\s*{([^}]+)}/s;
  const match = content.match(propertiesPattern);
  if (match) {
    let props = match[1];
    
    // 修复每个属性
    props = props.replace(/(\w+):\s*{([^}]+)}/g, (m, name, config) => {
      // 确保type字段格式正确
      let fixedConfig = config;
      
      // 移除TypeScript类型注释
      fixedConfig = fixedConfig.replace(/type:\s*(\w+)\s*as\s*[^,\n}]+/g, 'type: $1');
      fixedConfig = fixedConfig.replace(/PropType<[^>]+>/g, '');
      
      // 确保value字段格式正确
      if (fixedConfig.includes('value:')) {
        fixedConfig = fixedConfig.replace(/value:\s*([^,\n}]+)\s*as\s*[^,\n}]+/g, 'value: $1');
      }
      
      return `${name}: {${fixedConfig}}`;
    });
    
    content = content.replace(propertiesPattern, `properties: {${props}}`);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('  ✅ 修复了properties格式');
    return true;
  }
  
  console.log('  ℹ️  无需修复');
  return false;
}

/**
 * 安全地修复组件类型（保留优化但修复properties）
 */
function safelyFixComponent(componentPath) {
  const fileName = path.basename(componentPath);
  console.log(`\n🔧 安全修复: ${fileName}`);
  
  let content = fs.readFileSync(componentPath, 'utf8');
  const originalContent = content;
  
  // 保留类型导入
  if (!content.includes('import type')) {
    const depth = componentPath.split('/').filter(p => p && p !== '.').length - 2;
    const importPath = '../'.repeat(depth) + 'typings/core';
    const imports = `import type {
  InputEvent,
  TapEvent,
  CustomEvent
} from '${importPath}';\n\n`;
    content = imports + content;
  }
  
  // 修复properties（不添加TypeScript类型）
  const propertiesPattern = /properties:\s*{([^}]+)}/s;
  const match = content.match(propertiesPattern);
  if (match) {
    let props = match[1];
    
    // 清理错误的类型注释
    props = props.replace(/\s+as\s+PropType<[^>]+>/g, '');
    props = props.replace(/PropType<[^>]+>/g, '');
    
    // 确保格式正确
    props = props.replace(/type:\s*(\w+)[^,\n}]*/g, 'type: $1');
    
    content = content.replace(propertiesPattern, `properties: {${props}}`);
  }
  
  // 修复方法中的事件参数（保持优化）
  content = content.replace(
    /methods:\s*{([^}]*)}/s,
    (match, methods) => {
      let fixed = methods;
      
      // 修复事件参数类型
      fixed = fixed.replace(/\(e:\s*any\)/g, (m) => {
        if (fixed.includes('onTap') || fixed.includes('onClick')) {
          return '(e: TapEvent)';
        } else if (fixed.includes('onInput') || fixed.includes('onChange')) {
          return '(e: InputEvent)';
        } else {
          return '(e: CustomEvent)';
        }
      });
      
      // 替换简单的any
      fixed = fixed.replace(/:\s*any\b/g, ': unknown');
      fixed = fixed.replace(/as\s+any\b/g, 'as unknown');
      
      return `methods: {${fixed}}`;
    }
  );
  
  // 修复data中的any（保持优化）
  content = content.replace(
    /data:\s*{([^}]+)}/s,
    (match, data) => {
      let fixed = data;
      fixed = fixed.replace(/:\s*null\s+as\s+any/g, ': null as unknown');
      fixed = fixed.replace(/:\s*\[\]\s+as\s+any\[\]/g, ': [] as unknown[]');
      fixed = fixed.replace(/:\s*{}\s+as\s+any/g, ': {} as Record<string, unknown>');
      return `data: {${fixed}}`;
    }
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(componentPath, content, 'utf8');
    console.log('  ✅ 安全修复完成');
    return true;
  }
  
  console.log('  ℹ️  无需修复');
  return false;
}

/**
 * 主函数
 */
function main() {
  console.log('🚨 紧急修复组件属性类型错误');
  console.log('='.repeat(60));
  
  const componentsDir = path.join(process.cwd(), 'miniprogram/components');
  let fixedCount = 0;
  
  COMPONENTS_TO_FIX.forEach(componentName => {
    const componentPath = path.join(componentsDir, componentName, `${componentName}.ts`);
    if (fs.existsSync(componentPath)) {
      if (safelyFixComponent(componentPath)) {
        fixedCount++;
      }
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 修复完成');
  console.log(`  已修复 ${fixedCount} 个组件文件`);
  console.log('\n💡 提示:');
  console.log('  1. 重新编译小程序查看错误是否消失');
  console.log('  2. 如仍有问题，可从.backup文件恢复');
  console.log('='.repeat(60));
}

// 执行
main();
