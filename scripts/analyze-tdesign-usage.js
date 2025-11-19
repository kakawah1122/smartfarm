#!/usr/bin/env node

/**
 * 分析TDesign组件使用情况脚本
 * 功能：
 * 1. 统计每个TDesign组件的使用次数
 * 2. 分析哪些组件适合全局引入
 * 3. 识别未使用的组件
 * 4. 生成优化建议
 */

const fs = require('fs');
const path = require('path');

// 配置
const MINIPROGRAM_PATH = path.join(__dirname, '../miniprogram');
const TDESIGN_PREFIX = 'tdesign-miniprogram/';
const MIN_USAGE_FOR_GLOBAL = 5; // 使用次数超过5次的组件建议全局引入

// TDesign组件映射表
const TDESIGN_COMPONENTS = {
  't-button': 'button',
  't-icon': 'icon',
  't-loading': 'loading',
  't-input': 'input',
  't-toast': 'toast',
  't-cell': 'cell',
  't-cell-group': 'cell-group',
  't-dialog': 'dialog',
  't-empty': 'empty',
  't-notice-bar': 'notice-bar',
  't-textarea': 'textarea',
  't-grid': 'grid',
  't-grid-item': 'grid-item',
  't-tab-panel': 'tab-panel',
  't-tabs': 'tabs',
  't-picker': 'picker',
  't-picker-item': 'picker-item',
  't-col': 'col',
  't-row': 'row',
  't-divider': 'divider',
  't-popup': 'popup',
  't-radio': 'radio',
  't-radio-group': 'radio-group',
  't-checkbox': 'checkbox',
  't-checkbox-group': 'checkbox-group',
  't-image': 'image',
  't-tag': 'tag',
  't-badge': 'badge',
  't-search': 'search',
  't-swipe-cell': 'swipe-cell',
  't-dropdown-menu': 'dropdown-menu',
  't-dropdown-item': 'dropdown-item',
  't-switch': 'switch',
  't-rate': 'rate',
  't-stepper': 'stepper',
  't-upload': 'upload',
  't-calendar': 'calendar',
  't-date-time-picker': 'date-time-picker'
};

// 统计结果
const componentUsage = {};
const pageComponentMap = {};
const globalComponents = {};

// 读取app.json中的全局组件
function readGlobalComponents() {
  const appJsonPath = path.join(MINIPROGRAM_PATH, 'app.json');
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    if (appJson.usingComponents) {
      Object.keys(appJson.usingComponents).forEach(name => {
        const componentPath = appJson.usingComponents[name];
        if (componentPath.includes(TDESIGN_PREFIX)) {
          globalComponents[name] = componentPath;
          if (!componentUsage[name]) {
            componentUsage[name] = { count: 0, pages: [], isGlobal: true };
          }
          componentUsage[name].isGlobal = true;
        }
      });
    }
    console.log(`✅ 读取全局组件配置：找到 ${Object.keys(globalComponents).length} 个TDesign组件`);
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
      // 跳过node_modules和miniprogram_npm
      if (file === 'node_modules' || file === 'miniprogram_npm') {
        return;
      }
      walkDir(filePath, callback);
    } else if (stat.isFile()) {
      callback(filePath);
    }
  });
}

// 分析页面的JSON配置文件
function analyzePageJson(filePath) {
  if (!filePath.endsWith('.json')) return;
  if (filePath.includes('app.json')) return;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    
    if (json.usingComponents) {
      const pagePath = filePath.replace(MINIPROGRAM_PATH, '').replace(/\\/g, '/');
      pageComponentMap[pagePath] = [];
      
      Object.keys(json.usingComponents).forEach(name => {
        const componentPath = json.usingComponents[name];
        
        // 检查是否是TDesign组件
        if (componentPath.includes(TDESIGN_PREFIX)) {
          if (!componentUsage[name]) {
            componentUsage[name] = { count: 0, pages: [], isGlobal: false };
          }
          componentUsage[name].count++;
          componentUsage[name].pages.push(pagePath);
          pageComponentMap[pagePath].push(name);
        }
      });
    }
  } catch (error) {
    // 忽略解析错误
  }
}

// 检查组件是否在WXML中实际使用
function checkWxmlUsage(pagePath, componentName) {
  const wxmlPath = pagePath.replace('.json', '.wxml');
  const fullWxmlPath = path.join(MINIPROGRAM_PATH, wxmlPath);
  
  if (fs.existsSync(fullWxmlPath)) {
    const wxmlContent = fs.readFileSync(fullWxmlPath, 'utf8');
    // 移除注释
    const cleanContent = wxmlContent.replace(/<!--[\s\S]*?-->/g, '');
    return cleanContent.includes(`<${componentName}`) || cleanContent.includes(`<${componentName}/>`);
  }
  return false;
}

// 主函数
function main() {
  console.log('🔍 开始分析TDesign组件使用情况...\n');
  
  // 1. 读取全局组件
  readGlobalComponents();
  
  // 2. 遍历所有页面配置
  console.log('\n📊 分析页面组件使用...');
  walkDir(MINIPROGRAM_PATH, analyzePageJson);
  
  // 3. 验证实际使用情况
  console.log('\n🔎 验证组件实际使用情况...');
  Object.keys(pageComponentMap).forEach(pagePath => {
    const components = pageComponentMap[pagePath];
    components.forEach(componentName => {
      const isUsed = checkWxmlUsage(pagePath, componentName);
      if (!isUsed) {
        componentUsage[componentName].unusedPages = componentUsage[componentName].unusedPages || [];
        componentUsage[componentName].unusedPages.push(pagePath);
      }
    });
  });
  
  // 4. 生成报告
  console.log('\n📈 TDesign组件使用报告\n');
  console.log('========================================');
  
  // 全局组件
  console.log('\n✅ 已全局引入的组件：');
  Object.keys(globalComponents).forEach(name => {
    console.log(`  - ${name}: ${globalComponents[name]}`);
  });
  
  // 高频使用但未全局引入的组件
  console.log('\n⚠️ 建议全局引入的组件（使用次数 >= ${MIN_USAGE_FOR_GLOBAL}）：');
  const suggestGlobal = [];
  Object.keys(componentUsage).forEach(name => {
    const usage = componentUsage[name];
    if (!usage.isGlobal && usage.count >= MIN_USAGE_FOR_GLOBAL) {
      suggestGlobal.push(name);
      const componentPath = TDESIGN_COMPONENTS[name];
      console.log(`  - ${name}: 使用${usage.count}次`);
      console.log(`    "${name}": "${TDESIGN_PREFIX}${componentPath}/${componentPath}",`);
    }
  });
  
  // 使用频率统计
  console.log('\n📊 组件使用频率排行：');
  const sortedComponents = Object.keys(componentUsage)
    .sort((a, b) => componentUsage[b].count - componentUsage[a].count)
    .slice(0, 10);
  
  sortedComponents.forEach((name, index) => {
    const usage = componentUsage[name];
    const globalTag = usage.isGlobal ? ' [全局]' : '';
    console.log(`  ${index + 1}. ${name}${globalTag}: ${usage.count}次`);
  });
  
  // 未使用的组件引入
  console.log('\n❌ 引入但未使用的组件：');
  let hasUnused = false;
  Object.keys(componentUsage).forEach(name => {
    const usage = componentUsage[name];
    if (usage.unusedPages && usage.unusedPages.length > 0) {
      hasUnused = true;
      console.log(`  - ${name}: 在以下页面引入但未使用`);
      usage.unusedPages.forEach(page => {
        console.log(`    • ${page}`);
      });
    }
  });
  
  if (!hasUnused) {
    console.log('  无');
  }
  
  // 生成优化后的app.json配置
  if (suggestGlobal.length > 0) {
    console.log('\n🔧 建议的app.json全局组件配置：');
    console.log('```json');
    console.log('"usingComponents": {');
    
    // 保留现有的全局组件
    Object.keys(globalComponents).forEach(name => {
      console.log(`  "${name}": "${globalComponents[name]}",`);
    });
    
    // 添加建议的组件
    suggestGlobal.forEach((name, index) => {
      const componentPath = TDESIGN_COMPONENTS[name];
      const isLast = index === suggestGlobal.length - 1;
      console.log(`  "${name}": "${TDESIGN_PREFIX}${componentPath}/${componentPath}"${isLast ? '' : ','}`);
    });
    
    console.log('}');
    console.log('```');
  }
  
  // 统计信息
  console.log('\n📊 统计信息：');
  console.log(`  - 总共分析了 ${Object.keys(pageComponentMap).length} 个页面`);
  console.log(`  - 使用了 ${Object.keys(componentUsage).length} 个不同的TDesign组件`);
  console.log(`  - 全局引入了 ${Object.keys(globalComponents).length} 个组件`);
  console.log(`  - 建议全局引入 ${suggestGlobal.length} 个组件`);
  
  console.log('\n✨ 分析完成！\n');
}

// 执行
main();
