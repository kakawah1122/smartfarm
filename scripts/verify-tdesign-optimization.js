#!/usr/bin/env node

/**
 * 验证TDesign组件优化效果
 * 功能：
 * 1. 检查当前TDesign组件使用情况
 * 2. 统计全局组件使用率
 * 3. 检查是否还有未优化的组件
 * 4. 生成优化效果报告
 */

const fs = require('fs');
const path = require('path');

// 配置
const MINIPROGRAM_PATH = path.join(__dirname, '../miniprogram');
const TDESIGN_PREFIX = 'tdesign-miniprogram/';

// 统计数据
const stats = {
  globalComponents: {},
  localComponents: {},
  totalPages: 0,
  pagesUsingGlobal: new Set(),
  pagesUsingLocal: new Set(),
  componentUsageCount: {},
  duplicateImports: [],
  unusedImports: []
};

// 读取全局组件配置
function readGlobalComponents() {
  const appJsonPath = path.join(MINIPROGRAM_PATH, 'app.json');
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    if (appJson.usingComponents) {
      Object.keys(appJson.usingComponents).forEach(name => {
        const componentPath = appJson.usingComponents[name];
        if (componentPath.includes(TDESIGN_PREFIX)) {
          stats.globalComponents[name] = componentPath;
          stats.componentUsageCount[name] = 0;
        }
      });
    }
  } catch (error) {
    console.error('❌ 读取app.json失败:', error.message);
  }
}

// 递归遍历目录
function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file === 'node_modules' || file === 'miniprogram_npm') {
        return;
      }
      walkDir(filePath, callback);
    } else if (stat.isFile()) {
      callback(filePath);
    }
  });
}

// 检查组件是否在WXML中使用
function checkComponentUsageInWxml(wxmlPath, componentName) {
  if (!fs.existsSync(wxmlPath)) {
    return false;
  }
  
  const wxmlContent = fs.readFileSync(wxmlPath, 'utf8');
  const cleanContent = wxmlContent.replace(/<!--[\s\S]*?-->/g, '');
  
  // 统计使用次数
  const regex = new RegExp(`<${componentName}[\\s/>]`, 'g');
  const matches = cleanContent.match(regex);
  return matches ? matches.length : 0;
}

// 分析页面配置
function analyzePageJson(jsonPath) {
  if (!jsonPath.endsWith('.json')) return;
  if (jsonPath.includes('app.json')) return;
  
  try {
    const content = fs.readFileSync(jsonPath, 'utf8');
    const json = JSON.parse(content);
    const wxmlPath = jsonPath.replace('.json', '.wxml');
    const pagePath = jsonPath.replace(MINIPROGRAM_PATH, '').replace(/\\/g, '/');
    
    stats.totalPages++;
    
    // 检查全局组件使用
    let usesGlobalComponents = false;
    Object.keys(stats.globalComponents).forEach(componentName => {
      const usageCount = checkComponentUsageInWxml(wxmlPath, componentName);
      if (usageCount > 0) {
        stats.componentUsageCount[componentName] += usageCount;
        usesGlobalComponents = true;
      }
    });
    
    if (usesGlobalComponents) {
      stats.pagesUsingGlobal.add(pagePath);
    }
    
    // 检查局部组件
    if (json.usingComponents) {
      let hasLocalTDesign = false;
      
      Object.keys(json.usingComponents).forEach(name => {
        const componentPath = json.usingComponents[name];
        
        if (componentPath.includes(TDESIGN_PREFIX)) {
          hasLocalTDesign = true;
          
          // 检查是否重复引入全局组件
          if (stats.globalComponents[name]) {
            stats.duplicateImports.push({
              page: pagePath,
              component: name
            });
          } else {
            // 记录局部组件
            if (!stats.localComponents[name]) {
              stats.localComponents[name] = [];
            }
            stats.localComponents[name].push(pagePath);
            
            // 检查是否未使用
            const usageCount = checkComponentUsageInWxml(wxmlPath, name);
            if (usageCount === 0) {
              stats.unusedImports.push({
                page: pagePath,
                component: name
              });
            } else {
              if (!stats.componentUsageCount[name]) {
                stats.componentUsageCount[name] = 0;
              }
              stats.componentUsageCount[name] += usageCount;
            }
          }
        }
      });
      
      if (hasLocalTDesign) {
        stats.pagesUsingLocal.add(pagePath);
      }
    }
  } catch (error) {
    // 忽略解析错误
  }
}

// 计算优化建议
function calculateOptimizationSuggestions() {
  const suggestions = [];
  
  // 检查应该全局引入的组件
  Object.keys(stats.localComponents).forEach(name => {
    const pageCount = stats.localComponents[name].length;
    if (pageCount >= 3) {
      suggestions.push({
        type: 'global',
        component: name,
        pageCount,
        pages: stats.localComponents[name]
      });
    }
  });
  
  return suggestions;
}

// 主函数
function main() {
  console.log('🔍 验证TDesign组件优化效果...\n');
  
  // 读取配置
  readGlobalComponents();
  
  // 分析所有页面
  walkDir(MINIPROGRAM_PATH, analyzePageJson);
  
  // 生成报告
  console.log('=' .repeat(60));
  console.log('\n📊 TDesign组件优化效果报告\n');
  console.log('=' .repeat(60));
  
  // 全局组件统计
  console.log('\n✅ 全局组件配置（app.json）：');
  const globalList = Object.keys(stats.globalComponents);
  console.log(`  共配置了 ${globalList.length} 个全局TDesign组件`);
  globalList.forEach(name => {
    const usage = stats.componentUsageCount[name] || 0;
    console.log(`  • ${name}: 使用 ${usage} 次`);
  });
  
  // 使用率统计
  console.log('\n📈 组件使用率：');
  const globalUsageRate = (stats.pagesUsingGlobal.size / stats.totalPages * 100).toFixed(1);
  console.log(`  • ${stats.pagesUsingGlobal.size}/${stats.totalPages} 个页面使用了全局TDesign组件 (${globalUsageRate}%)`);
  
  if (stats.pagesUsingLocal.size > 0) {
    const localUsageRate = (stats.pagesUsingLocal.size / stats.totalPages * 100).toFixed(1);
    console.log(`  • ${stats.pagesUsingLocal.size}/${stats.totalPages} 个页面使用了局部TDesign组件 (${localUsageRate}%)`);
  }
  
  // 优化检查
  console.log('\n🔍 优化检查：');
  
  if (stats.duplicateImports.length > 0) {
    console.log('\n⚠️ 发现重复引入（已全局但仍局部引入）：');
    stats.duplicateImports.forEach(item => {
      console.log(`  • ${item.page}: ${item.component}`);
    });
  } else {
    console.log('  ✅ 没有发现重复引入的组件');
  }
  
  if (stats.unusedImports.length > 0) {
    console.log('\n⚠️ 发现未使用的引入：');
    stats.unusedImports.forEach(item => {
      console.log(`  • ${item.page}: ${item.component}`);
    });
  } else {
    console.log('  ✅ 没有发现未使用的组件引入');
  }
  
  // 优化建议
  const suggestions = calculateOptimizationSuggestions();
  if (suggestions.length > 0) {
    console.log('\n💡 优化建议：');
    suggestions.forEach(suggestion => {
      if (suggestion.type === 'global') {
        console.log(`\n  建议将 ${suggestion.component} 添加到全局配置`);
        console.log(`  该组件在 ${suggestion.pageCount} 个页面中使用：`);
        suggestion.pages.slice(0, 3).forEach(page => {
          console.log(`    • ${page}`);
        });
        if (suggestion.pageCount > 3) {
          console.log(`    ... 还有 ${suggestion.pageCount - 3} 个页面`);
        }
      }
    });
  } else {
    console.log('\n✅ 优化建议：当前配置已经很好了！');
  }
  
  // 组件使用排行榜
  console.log('\n🏆 TDesign组件使用TOP10：');
  const sortedComponents = Object.entries(stats.componentUsageCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  sortedComponents.forEach(([name, count], index) => {
    const isGlobal = stats.globalComponents[name] ? ' [全局]' : ' [局部]';
    console.log(`  ${index + 1}. ${name}${isGlobal}: ${count} 次`);
  });
  
  // 总结
  console.log('\n' + '=' .repeat(60));
  console.log('\n📋 优化总结：');
  console.log(`  • 分析了 ${stats.totalPages} 个页面`);
  console.log(`  • 全局配置了 ${globalList.length} 个TDesign组件`);
  console.log(`  • 发现 ${stats.duplicateImports.length} 个重复引入`);
  console.log(`  • 发现 ${stats.unusedImports.length} 个未使用引入`);
  console.log(`  • ${suggestions.length} 个优化建议`);
  
  // 优化效果评分
  let score = 100;
  score -= stats.duplicateImports.length * 2;
  score -= stats.unusedImports.length * 3;
  score -= suggestions.length * 5;
  score = Math.max(0, Math.min(100, score));
  
  console.log('\n🎯 优化效果评分：' + score + '/100');
  
  if (score >= 90) {
    console.log('   优秀！组件配置已经很完善了！');
  } else if (score >= 70) {
    console.log('   良好！还有一些小优化空间。');
  } else if (score >= 50) {
    console.log('   中等，建议按照优化建议进行改进。');
  } else {
    console.log('   需要改进，请按照优化建议进行调整。');
  }
  
  console.log('\n' + '=' .repeat(60) + '\n');
}

// 执行
main();
