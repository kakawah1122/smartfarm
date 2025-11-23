#!/usr/bin/env node

/**
 * 虚拟渲染批量应用脚本
 * 安全地将虚拟渲染功能应用到其他列表页面
 * 
 * 特点：
 * 1. 不修改原有逻辑
 * 2. 可以随时回退
 * 3. 默认关闭状态
 * 4. 保留所有UI样式
 */

const fs = require('fs');
const path = require('path');

// 目标页面配置
const TARGET_PAGES = [
  {
    name: '财务记录列表',
    path: 'miniprogram/packageFinance/finance-record-list',
    itemHeight: 160,
    status: '已完成'
  },
  {
    name: '生产记录列表',
    path: 'miniprogram/pages/production/production',
    itemHeight: 180,
    status: '待实施'
  },
  {
    name: 'AI诊断历史',
    path: 'miniprogram/packageAI/ai-diagnosis-history',
    itemHeight: 200,
    status: '待实施'
  },
  {
    name: '健康记录列表',
    path: 'miniprogram/packageHealth/health-records',
    itemHeight: 170,
    status: '待实施'
  }
];

// 检查页面是否已应用虚拟渲染
function checkVirtualRenderStatus(pagePath) {
  const tsPath = path.join(process.cwd(), pagePath + '/index.ts');
  const altTsPath = path.join(process.cwd(), pagePath + '.ts');
  
  const filePath = fs.existsSync(tsPath) ? tsPath : altTsPath;
  
  if (!fs.existsSync(filePath)) {
    return { exists: false, hasVirtual: false };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const hasVirtual = content.includes('VirtualRenderHelper');
  
  return { exists: true, hasVirtual };
}

// 生成应用代码片段
function generateVirtualRenderCode(itemHeight) {
  return `
// ========== 虚拟渲染增强（默认关闭） ==========
import { VirtualRenderHelper, throttle } from '../../utils/virtual-render-helper'

// 在data中添加：
/*
  virtualRenderEnabled: false,
  virtualDisplayRecords: [],
  virtualTopHeight: 0,
  virtualBottomHeight: 0
*/

// 在页面顶部添加：
// let virtualHelper: VirtualRenderHelper | null = null

// 添加以下方法：
/*
  // 初始化虚拟渲染
  initVirtualRender() {
    if (!this.data.virtualRenderEnabled) return
    
    virtualHelper = new VirtualRenderHelper({
      itemHeight: ${itemHeight},
      containerHeight: 600,
      bufferSize: 5,
      enableVirtual: false
    })
  },
  
  // 更新虚拟显示
  updateVirtualDisplay() {
    if (!virtualHelper || !this.data.virtualRenderEnabled) return
    
    const state = virtualHelper.getVirtualState()
    this.setData({
      virtualDisplayRecords: state.visibleData,
      virtualTopHeight: state.topPlaceholder,
      virtualBottomHeight: state.bottomPlaceholder,
      displayRecords: state.visibleData
    })
  },
  
  // 滚动处理
  onScroll: throttle(function(e) {
    if (!virtualHelper || !this.data.virtualRenderEnabled) return
    
    virtualHelper.updateScrollTop(e.detail.scrollTop)
    this.updateVirtualDisplay()
  }, 16),
  
  // 切换开关
  toggleVirtualRender() {
    const newState = !this.data.virtualRenderEnabled
    this.setData({ virtualRenderEnabled: newState })
    
    if (newState && !virtualHelper) {
      this.initVirtualRender()
    }
    
    if (virtualHelper) {
      virtualHelper.toggle(newState)
    }
    
    this.filterRecords() // 或其他刷新方法
  }
*/
// ========== 虚拟渲染增强结束 ==========
`;
}

// 生成WXML修改指南
function generateWxmlGuide() {
  return `
<!-- WXML修改指南 -->
<!-- 1. 在scroll-view上添加： bindscroll="{{virtualRenderEnabled ? 'onScroll' : ''}}" -->

<!-- 2. 在列表容器内添加顶部占位： -->
<view 
  wx:if="{{virtualRenderEnabled && virtualTopHeight > 0}}" 
  style="height: {{virtualTopHeight}}px;"
></view>

<!-- 3. 保持原有列表结构不变 -->

<!-- 4. 在列表容器内添加底部占位： -->
<view 
  wx:if="{{virtualRenderEnabled && virtualBottomHeight > 0}}" 
  style="height: {{virtualBottomHeight}}px;"
></view>
`;
}

// 主函数
function main() {
  console.log('========================================');
  console.log('虚拟渲染批量应用脚本');
  console.log('========================================\n');
  
  console.log('检查目标页面状态：\n');
  
  TARGET_PAGES.forEach(page => {
    const status = checkVirtualRenderStatus(page.path);
    
    console.log(`📄 ${page.name}`);
    console.log(`   路径: ${page.path}`);
    console.log(`   状态: ${page.status}`);
    
    if (status.exists) {
      console.log(`   文件: ✅ 存在`);
      console.log(`   虚拟渲染: ${status.hasVirtual ? '✅ 已应用' : '❌ 未应用'}`);
    } else {
      console.log(`   文件: ❌ 不存在`);
    }
    
    console.log('');
  });
  
  console.log('----------------------------------------');
  console.log('应用指南：\n');
  console.log('1. 首先确保 virtual-render-helper.ts 已创建');
  console.log('2. 选择要应用的页面');
  console.log('3. 按照以下代码片段修改：\n');
  
  // 生成示例代码
  const examplePage = TARGET_PAGES[1]; // 生产记录列表
  console.log(`示例：${examplePage.name}`);
  console.log(generateVirtualRenderCode(examplePage.itemHeight));
  
  console.log('\nWXML修改：');
  console.log(generateWxmlGuide());
  
  console.log('\n========================================');
  console.log('⚠️  重要提醒：');
  console.log('1. 虚拟渲染默认关闭，不影响现有功能');
  console.log('2. 充分测试后再开启');
  console.log('3. 保持原有代码逻辑不变');
  console.log('4. 确保可以随时回退');
  console.log('========================================\n');
}

// 运行
main();
