#!/usr/bin/env node

/**
 * 分析混合内联样式
 * 找出可以提取的静态部分
 */

const fs = require('fs');
const path = require('path');

// 混合样式列表（从报告中提取的前20个）
const mixedStyles = [
  { file: 'miniprogram/components/form-item/form-item.wxml', line: 5, style: 'width: {{labelWidth}}' },
  { file: 'miniprogram/components/form-item/form-item.wxml', line: 11, style: 'text-align: {{contentAlign}}' },
  { file: 'miniprogram/components/lazy-load/lazy-load.wxml', line: 2, style: 'min-height: {{minHeight}}' },
  { file: 'miniprogram/components/loading-animation/loading-animation.wxml', line: 53, style: 'width: {{progress}}%' },
  { file: 'miniprogram/components/navigation-bar/navigation-bar.wxml', line: 2, style: 'padding-top: {{statusBarHeight}}px' },
  { file: 'miniprogram/packageUser/role-migration/role-migration.wxml', line: 2, style: 'background-color: {{getRoleColor(role)}}20; color: {{getRoleColor(role)}}' },
  { file: 'miniprogram/packageUser/notification-settings/notification-settings.wxml', line: 1, style: 'padding-top: {{totalNavHeight}}rpx' },
  { file: 'miniprogram/packageAI/weather-detail/weather-detail.wxml', line: 1, style: 'left: {{airData.progress}}%;' },
  { file: 'miniprogram/packageHealth/treatment-records/treatment-records.wxml', line: 1, style: 'padding-bottom: {{showTabBar ? 120 : 0}}rpx' },
];

// 分析结果
const analysisResults = {
  purelyDynamic: [],     // 完全动态，无法优化
  extractable: [],       // 可提取静态部分
  conditional: []        // 条件样式，可改为class切换
};

/**
 * 分析样式字符串
 */
function analyzeStyleString(styleStr) {
  const parts = styleStr.split(';').filter(p => p.trim());
  const result = {
    static: [],
    dynamic: [],
    conditional: []
  };
  
  parts.forEach(part => {
    part = part.trim();
    if (!part) return;
    
    // 分析每个样式属性
    if (part.includes('{{')) {
      // 检查是否是条件样式
      if (part.includes('?') && part.includes(':')) {
        result.conditional.push(part);
      } else {
        // 检查是否混合了静态和动态部分
        const [prop, value] = part.split(':').map(s => s.trim());
        if (value && !prop.includes('{{')) {
          // 属性名是静态的，值是动态的
          result.dynamic.push({ prop, value, canExtractProp: true });
        } else {
          result.dynamic.push({ prop: part, canExtractProp: false });
        }
      }
    } else {
      // 纯静态样式
      result.static.push(part);
    }
  });
  
  return result;
}

/**
 * 生成优化建议
 */
function generateSuggestion(analysis, fullStyle) {
  const suggestions = [];
  
  if (analysis.static.length > 0) {
    suggestions.push({
      type: 'extract_static',
      description: '可提取静态部分到CSS类',
      staticStyles: analysis.static,
      suggestedClass: generateClassName(analysis.static)
    });
  }
  
  if (analysis.conditional.length > 0) {
    suggestions.push({
      type: 'use_class_binding',
      description: '建议使用条件class绑定替代',
      example: `class="{{condition ? 'active-class' : 'normal-class'}}"`
    });
  }
  
  if (analysis.dynamic.length > 0) {
    const extractableProps = analysis.dynamic.filter(d => d.canExtractProp);
    if (extractableProps.length > 0) {
      suggestions.push({
        type: 'partial_optimization',
        description: '部分属性可以优化',
        props: extractableProps.map(p => p.prop)
      });
    }
  }
  
  if (suggestions.length === 0) {
    suggestions.push({
      type: 'keep_as_is',
      description: '完全动态，建议保留'
    });
  }
  
  return suggestions;
}

/**
 * 生成建议的类名
 */
function generateClassName(staticStyles) {
  // 基于样式内容生成有意义的类名
  const props = staticStyles.map(s => {
    const [prop] = s.split(':');
    return prop.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  });
  
  return props.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/**
 * 分析所有混合样式
 */
function analyzeAll() {
  console.log('🔍 分析混合内联样式...\n');
  
  mixedStyles.forEach((item, index) => {
    const analysis = analyzeStyleString(item.style);
    const suggestions = generateSuggestion(analysis, item.style);
    
    console.log(`${index + 1}. ${path.basename(item.file)} (行 ${item.line})`);
    console.log(`   原始样式: ${item.style}`);
    
    const hasStaticParts = analysis.static.length > 0;
    const hasConditional = analysis.conditional.length > 0;
    
    if (hasStaticParts) {
      console.log(`   ✅ 可提取静态部分: ${analysis.static.join('; ')}`);
      analysisResults.extractable.push({ ...item, analysis, suggestions });
    } else if (hasConditional) {
      console.log(`   ⚠️  条件样式，建议改用class绑定`);
      analysisResults.conditional.push({ ...item, analysis, suggestions });
    } else {
      console.log(`   ❌ 完全动态，保持原样`);
      analysisResults.purelyDynamic.push({ ...item, analysis, suggestions });
    }
    
    console.log('');
  });
  
  // 生成报告
  generateReport();
}

/**
 * 生成分析报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `MIXED-STYLES-ANALYSIS-${timestamp.slice(0, 10)}.md`);
  
  let report = `# 混合内联样式分析报告

生成时间: ${new Date().toLocaleString()}

## 📊 分析统计

- 分析样式数: ${mixedStyles.length}
- 可提取静态部分: ${analysisResults.extractable.length}
- 条件样式: ${analysisResults.conditional.length}
- 完全动态: ${analysisResults.purelyDynamic.length}

## 🎯 优化机会

### 1. 可提取静态部分（${analysisResults.extractable.length}个）

这些样式包含静态部分，可以提取到CSS类中：

`;
  
  analysisResults.extractable.forEach((item, index) => {
    report += `\n#### ${index + 1}. ${path.basename(item.file)}\n`;
    report += `- 原始样式: \`${item.style}\`\n`;
    report += `- 静态部分: \`${item.analysis.static.join('; ')}\`\n`;
    report += `- 建议类名: \`.${item.suggestions[0].suggestedClass}\`\n`;
  });
  
  report += `\n### 2. 条件样式（${analysisResults.conditional.length}个）

这些使用条件表达式的样式，建议改用条件class绑定：

`;
  
  analysisResults.conditional.forEach((item, index) => {
    report += `\n#### ${index + 1}. ${path.basename(item.file)}\n`;
    report += `- 原始样式: \`${item.style}\`\n`;
    report += `- 建议: 使用条件class绑定\n`;
  });
  
  report += `\n### 3. 完全动态（${analysisResults.purelyDynamic.length}个）

这些样式完全动态，建议保留：

`;
  
  analysisResults.purelyDynamic.forEach((item, index) => {
    report += `- ${path.basename(item.file)}: \`${item.style}\`\n`;
  });
  
  report += `\n## 💡 优化建议

### 优先级1：提取静态部分
对于包含静态部分的混合样式，可以：
1. 将静态部分提取到CSS类
2. 只保留动态部分在style属性中
3. 同时使用class和style

### 优先级2：改用class绑定
对于条件样式，建议：
1. 定义不同状态的CSS类
2. 使用条件表达式切换class
3. 避免在style中使用三元运算符

### 示例：
\`\`\`html
<!-- 优化前 -->
<view style="padding: 20rpx; background-color: {{color}}; margin: {{show ? '10rpx' : '0'}}">

<!-- 优化后 -->
<view class="item-container {{show ? 'with-margin' : ''}}" style="background-color: {{color}}">
\`\`\`

## 📋 行动计划

1. 优先处理可提取静态部分的样式
2. 创建对应的CSS类
3. 修改模板文件
4. 测试功能正常性
`;
  
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 报告已生成: ${reportPath}`);
}

// 执行分析
analyzeAll();

console.log('\n📊 分析完成！');
console.log(`   - 可优化: ${analysisResults.extractable.length + analysisResults.conditional.length} 个`);
console.log(`   - 需保留: ${analysisResults.purelyDynamic.length} 个`);
console.log('\n💡 建议优先处理可提取静态部分的样式');
