#!/usr/bin/env node
/**
 * 检查所有使用 createPageWithNavbar 的页面是否正确绑定了 bind:back 事件
 */

const fs = require('fs');
const path = require('path');

const miniprogramPath = path.join(__dirname, '../miniprogram');

// 使用 createPageWithNavbar 的页面列表
const pagesWithNavbar = [
  'packageAI/ai-diagnosis/ai-diagnosis',
  'packageAI/diagnosis-history/diagnosis-history',
  'packageFinance/cost-analysis/cost-analysis',
  'packageFinance/finance-record-list/finance-record-list',
  'packageFinance/finance/finance',
  'packageFinance/manual-record-form/manual-record-form',
  'packageFinance/reimbursement-list/reimbursement-list',
  'packageHealth/abnormal-record-detail/abnormal-record-detail',
  'packageHealth/abnormal-records-list/abnormal-records-list',
  'packageHealth/cured-records-list/cured-records-list',
  'packageHealth/death-record-detail/death-record-detail',
  'packageHealth/death-record/death-record',
  'packageHealth/death-records-list/death-records-list',
  'packageHealth/disinfection-record/disinfection-record',
  'packageHealth/health-care/health-care',
  'packageHealth/health-inspection/health-inspection',
  'packageHealth/medication-records-list/medication-records-list',
  'packageHealth/survival-analysis/survival-analysis',
  'packageHealth/treatment-record/treatment-record',
  'packageHealth/vaccine-record/vaccine-record',
  'packageProduction/batch-feed-cost/batch-feed-cost',
  'packageProduction/entry-form/entry-form',
  'packageProduction/entry-records-list/entry-records-list',
  'packageProduction/exit-form/exit-form',
  'packageProduction/exit-records-list/exit-records-list',
  'packageProduction/feed-usage-form/feed-usage-form',
  'packageProduction/inventory-detail/inventory-detail',
  'packageProduction/material-records-list/material-records-list',
  'packageProduction/material-use-form/material-use-form',
  'packageProduction/purchase-form/purchase-form',
  'packageUser/employee-permission/employee-permission',
  'packageUser/invite-management/invite-management',
  'packageUser/knowledge-management/knowledge-management',
  'packageUser/user-approval/user-approval',
  'packageUser/user-management/user-management',
  'pages/about/about',
  'pages/help/help',
  'pages/knowledge/article-detail/article-detail',
  'pages/knowledge/knowledge',
  'pages/notification-settings/notification-settings',
  'pages/privacy-settings/privacy-settings',
  'pages/production/production',
  'pages/profile/profile'
];

console.log('开始检查 navigation-bar 组件的 bind:back 事件绑定...\n');

const issues = [];
let checkedCount = 0;
let missingBindingCount = 0;
let noNavBarCount = 0;

pagesWithNavbar.forEach(pagePath => {
  const wxmlPath = path.join(miniprogramPath, `${pagePath}.wxml`);
  
  if (!fs.existsSync(wxmlPath)) {
    issues.push({
      type: 'missing_file',
      page: pagePath,
      message: 'WXML 文件不存在'
    });
    return;
  }
  
  const content = fs.readFileSync(wxmlPath, 'utf-8');
  checkedCount++;
  
  // 检查是否使用了 navigation-bar 组件
  const hasNavBar = content.includes('<navigation-bar');
  
  if (!hasNavBar) {
    noNavBarCount++;
    issues.push({
      type: 'no_navbar',
      page: pagePath,
      message: '未使用 navigation-bar 组件（可能使用了系统导航栏）'
    });
    return;
  }
  
  // 检查是否显示返回按钮
  const showBackFalse = content.match(/show-?back\s*=\s*"?\{\{false\}\}"?/i);
  
  if (showBackFalse) {
    // 不显示返回按钮，不需要 bind:back
    return;
  }
  
  // 检查是否有 bind:back 绑定
  const hasBindBack = content.includes('bind:back');
  
  if (!hasBindBack) {
    missingBindingCount++;
    issues.push({
      type: 'missing_binding',
      page: pagePath,
      message: '❌ 缺少 bind:back 事件绑定'
    });
  }
});

// 输出结果
console.log(`总共检查: ${checkedCount} 个页面`);
console.log(`未使用 navigation-bar: ${noNavBarCount} 个页面`);
console.log(`缺少 bind:back 绑定: ${missingBindingCount} 个页面\n`);

if (issues.length > 0) {
  console.log('发现的问题：\n');
  
  // 分组显示
  const missingBindings = issues.filter(i => i.type === 'missing_binding');
  const noNavBars = issues.filter(i => i.type === 'no_navbar');
  const missingFiles = issues.filter(i => i.type === 'missing_file');
  
  if (missingBindings.length > 0) {
    console.log('【需要修复】缺少 bind:back 绑定的页面：');
    missingBindings.forEach(issue => {
      console.log(`  - ${issue.page}`);
    });
    console.log('');
  }
  
  if (noNavBars.length > 0) {
    console.log('【信息】未使用 navigation-bar 组件的页面：');
    noNavBars.forEach(issue => {
      console.log(`  - ${issue.page}`);
    });
    console.log('');
  }
  
  if (missingFiles.length > 0) {
    console.log('【警告】缺少 WXML 文件的页面：');
    missingFiles.forEach(issue => {
      console.log(`  - ${issue.page}`);
    });
    console.log('');
  }
  
  process.exit(missingBindings.length > 0 ? 1 : 0);
} else {
  console.log('✅ 所有页面的 bind:back 绑定都正确！');
  process.exit(0);
}
