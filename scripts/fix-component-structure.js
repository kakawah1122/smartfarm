#!/usr/bin/env node

/**
 * 修复组件结构问题
 * 解决properties重复定义和类型导入路径问题
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
function fixComponent(componentPath) {
  const fileName = path.basename(componentPath);
  console.log(`\n🔧 修复: ${fileName}`);
  
  let content = fs.readFileSync(componentPath, 'utf8');
  const originalContent = content;
  
  // 1. 修复错误的导入路径
  content = content.replace(
    /from\s+['"][\./]+typings\/core['"]/g,
    "from '../../../typings/core'"
  );
  
  // 2. 移除不需要的PropType导入
  content = content.replace(/,?\s*PropType/g, '');
  
  // 3. 修复properties重复定义问题
  content = content.replace(
    /properties:\s*{properties:\s*{([^}]+)}/s,
    'properties: {$1'
  );
  
  // 4. 确保properties格式正确（不使用TypeScript类型断言）
  const propertiesPattern = /properties:\s*{([^}]+)}/s;
  const match = content.match(propertiesPattern);
  if (match) {
    let props = match[1];
    
    // 清理错误的类型注释
    props = props.replace(/\s+as\s+[^,\n}]+/g, '');
    props = props.replace(/:\s*{\s*type:\s*(\w+)[^}]*}/g, (m, type) => {
      // 标准化属性定义
      if (type === 'Boolean') {
        return ': {\n      type: Boolean,\n      value: false\n    }';
      } else if (type === 'String') {
        return ': {\n      type: String,\n      value: \'\'\n    }';
      } else if (type === 'Number') {
        return ': {\n      type: Number,\n      value: 0\n    }';
      } else if (type === 'Array') {
        return ': {\n      type: Array,\n      value: []\n    }';
      } else if (type === 'Object') {
        return ': {\n      type: Object,\n      value: null\n    }';
      } else {
        return m; // 保持原样
      }
    });
    
    content = content.replace(propertiesPattern, `properties: {${props}}`);
  }
  
  // 5. 修复methods中的事件参数类型
  content = content.replace(/\(e:\s*any\)/g, '(e: CustomEvent)');
  
  // 6. 修复data中的any类型
  content = content.replace(/:\s*any\b(?![>\]])/g, ': unknown');
  content = content.replace(/as\s+any\b/g, 'as unknown');
  content = content.replace(/:\s*any\[\]/g, ': unknown[]');
  
  if (content !== originalContent) {
    fs.writeFileSync(componentPath, content, 'utf8');
    console.log('  ✅ 修复完成');
    return true;
  } else {
    console.log('  ℹ️  无需修复');
    return false;
  }
}

/**
 * 从备份恢复并重新优化
 */
function restoreAndOptimize(componentPath) {
  const backupPath = componentPath + '.backup';
  
  if (fs.existsSync(backupPath)) {
    console.log(`  📁 从备份恢复: ${path.basename(backupPath)}`);
    
    // 读取备份
    let content = fs.readFileSync(backupPath, 'utf8');
    
    // 添加类型导入（如果没有）
    if (!content.includes('import type')) {
      const imports = `import type {
  InputEvent,
  TapEvent,
  CustomEvent
} from '../../../typings/core';\n\n`;
      content = imports + content;
    }
    
    // 优化事件参数类型
    content = content.replace(
      /(\w+)\s*\(\s*e:\s*any\s*\)/g,
      (match, methodName) => {
        if (methodName.includes('Tap') || methodName.includes('Click')) {
          return `${methodName}(e: TapEvent)`;
        } else if (methodName.includes('Input') || methodName.includes('Change')) {
          return `${methodName}(e: InputEvent)`;
        } else {
          return `${methodName}(e: CustomEvent)`;
        }
      }
    );
    
    // 替换简单的any（但不改变properties结构）
    content = content.replace(
      /:\s*any\b(?![\s\S]*properties:)/g,
      ': unknown'
    );
    
    // 保存优化后的内容
    fs.writeFileSync(componentPath, content, 'utf8');
    console.log('  ✅ 恢复并优化完成');
    return true;
  }
  
  return false;
}

/**
 * 主函数
 */
function main() {
  console.log('🚨 修复组件结构问题');
  console.log('='.repeat(60));
  
  const componentsDir = path.join(process.cwd(), 'miniprogram/components');
  let fixedCount = 0;
  let restoredCount = 0;
  
  COMPONENTS_TO_FIX.forEach(componentName => {
    const componentPath = path.join(componentsDir, componentName, `${componentName}.ts`);
    
    if (fs.existsSync(componentPath)) {
      // 先尝试从备份恢复
      if (restoreAndOptimize(componentPath)) {
        restoredCount++;
      } else {
        // 如果没有备份，则修复现有文件
        if (fixComponent(componentPath)) {
          fixedCount++;
        }
      }
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 处理完成');
  console.log(`  从备份恢复: ${restoredCount} 个文件`);
  console.log(`  直接修复: ${fixedCount} 个文件`);
  console.log('\n💡 建议:');
  console.log('  1. 重新编译小程序');
  console.log('  2. 检查控制台是否还有错误');
  console.log('  3. 如有问题，可手动调整');
  console.log('='.repeat(60));
}

// 执行
main();
