#!/usr/bin/env node

/**
 * 清理未使用的TDesign组件引用
 * 功能：
 * 1. 检测页面JSON中引入但WXML中未使用的组件
 * 2. 自动从页面JSON中移除未使用的组件
 * 3. 生成清理报告
 */

const fs = require('fs');
const path = require('path');

// 配置
const MINIPROGRAM_PATH = path.join(__dirname, '../miniprogram');
const TDESIGN_PREFIX = 'tdesign-miniprogram/';
const DRY_RUN = process.argv.includes('--dry-run');

// 已经全局引入的组件（不需要在页面中重复引入）
const GLOBAL_COMPONENTS = [
  't-button',
  't-icon',
  't-loading',
  't-input',
  't-toast',
  't-popup',
  't-search',
  't-tag',
  't-image',
  't-empty',
  't-dialog',
  't-textarea',
  't-tabs',
  't-tab-panel',
  't-cell',
  't-cell-group'
];

// 统计
let totalCleaned = 0;
let totalFiles = 0;
const cleanedComponents = {};

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
function isComponentUsed(wxmlPath, componentName) {
  if (!fs.existsSync(wxmlPath)) {
    return false;
  }
  
  const wxmlContent = fs.readFileSync(wxmlPath, 'utf8');
  // 移除注释
  const cleanContent = wxmlContent.replace(/<!--[\s\S]*?-->/g, '');
  
  // 检查组件使用的各种形式
  return cleanContent.includes(`<${componentName}`) || 
         cleanContent.includes(`<${componentName}/>`);
}

// 清理页面的组件引用
function cleanPageComponents(jsonPath) {
  if (!jsonPath.endsWith('.json')) return;
  if (jsonPath.includes('app.json')) return;
  
  try {
    const content = fs.readFileSync(jsonPath, 'utf8');
    const json = JSON.parse(content);
    
    if (!json.usingComponents) {
      return;
    }
    
    const wxmlPath = jsonPath.replace('.json', '.wxml');
    const pagePath = jsonPath.replace(MINIPROGRAM_PATH, '').replace(/\\/g, '/');
    
    const originalComponents = Object.keys(json.usingComponents);
    const componentsToKeep = {};
    const componentsToRemove = [];
    
    originalComponents.forEach(name => {
      const componentPath = json.usingComponents[name];
      
      // 检查是否是TDesign组件
      if (componentPath.includes(TDESIGN_PREFIX)) {
        // 检查是否已经全局引入
        if (GLOBAL_COMPONENTS.includes(name)) {
          componentsToRemove.push(name);
          console.log(`  🔄 ${name} 已全局引入，移除重复引用`);
        }
        // 检查是否在WXML中使用
        else if (!isComponentUsed(wxmlPath, name)) {
          componentsToRemove.push(name);
          console.log(`  ❌ ${name} 未在WXML中使用，移除引用`);
        } else {
          componentsToKeep[name] = componentPath;
        }
      } else {
        // 保留非TDesign组件
        componentsToKeep[name] = componentPath;
      }
    });
    
    // 如果有需要移除的组件
    if (componentsToRemove.length > 0) {
      totalFiles++;
      totalCleaned += componentsToRemove.length;
      
      componentsToRemove.forEach(comp => {
        cleanedComponents[comp] = (cleanedComponents[comp] || 0) + 1;
      });
      
      console.log(`\n📄 ${pagePath}`);
      console.log(`  移除 ${componentsToRemove.length} 个未使用的组件`);
      
      if (!DRY_RUN) {
        // 更新JSON文件
        if (Object.keys(componentsToKeep).length === 0) {
          // 如果没有剩余组件，删除usingComponents字段
          delete json.usingComponents;
        } else {
          json.usingComponents = componentsToKeep;
        }
        
        // 格式化并写入文件
        const newContent = JSON.stringify(json, null, 2);
        fs.writeFileSync(jsonPath, newContent);
        console.log(`  ✅ 已更新文件`);
      } else {
        console.log(`  ⚠️ 模拟运行，未实际修改文件`);
      }
    }
  } catch (error) {
    console.error(`❌ 处理文件失败 ${jsonPath}:`, error.message);
  }
}

// 主函数
function main() {
  console.log('🧹 开始清理未使用的TDesign组件引用...\n');
  
  if (DRY_RUN) {
    console.log('⚠️ 模拟运行模式，不会实际修改文件\n');
  }
  
  console.log('📋 全局已引入的组件：');
  GLOBAL_COMPONENTS.forEach(comp => {
    console.log(`  - ${comp}`);
  });
  console.log('');
  
  // 遍历所有页面配置
  walkDir(MINIPROGRAM_PATH, cleanPageComponents);
  
  // 生成报告
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 清理报告\n');
  
  if (totalCleaned > 0) {
    console.log(`✨ 共清理了 ${totalFiles} 个文件中的 ${totalCleaned} 个未使用的组件引用\n`);
    
    console.log('📈 清理组件统计：');
    const sortedComponents = Object.keys(cleanedComponents)
      .sort((a, b) => cleanedComponents[b] - cleanedComponents[a]);
    
    sortedComponents.forEach(comp => {
      console.log(`  - ${comp}: 清理了 ${cleanedComponents[comp]} 次`);
    });
    
    if (!DRY_RUN) {
      console.log('\n✅ 清理完成！');
      console.log('\n📌 下一步建议：');
      console.log('1. 在微信开发者工具中执行"构建npm"');
      console.log('2. 清理 miniprogram_npm 目录');
      console.log('3. 重新编译项目');
    } else {
      console.log('\n📌 这是模拟运行，实际运行请去掉 --dry-run 参数');
    }
  } else {
    console.log('✨ 没有发现需要清理的组件引用，项目已经很干净了！');
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

// 执行
main();
