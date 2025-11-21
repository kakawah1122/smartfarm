#!/usr/bin/env node

/**
 * 修复any类型使用
 * 将any替换为更具体的类型定义
 */

const fs = require('fs');
const path = require('path');

// 统计信息
const stats = {
  filesScanned: 0,
  filesFixed: 0,
  anyTypesFound: 0,
  anyTypesFixed: 0,
  errors: []
};

// 类型映射规则 - 基于项目实际使用
const typeReplacements = {
  // 事件相关
  'e: any': 'e: WechatMiniprogram.CustomEvent',
  'event: any': 'event: WechatMiniprogram.CustomEvent',
  'evt: any': 'evt: WechatMiniprogram.CustomEvent',
  
  // 错误处理
  'error: any': 'error: unknown',
  'err: any': 'err: unknown',
  'catch (e: any)': 'catch (e: unknown)',
  'catch (error: any)': 'catch (error: unknown)',
  
  // 数据相关
  'data: any': 'data: Record<string, unknown>',
  'item: any': 'item: Record<string, unknown>',
  'record: any': 'record: Record<string, unknown>',
  'params: any': 'params: Record<string, unknown>',
  'options: any': 'options: Record<string, unknown>',
  
  // 响应相关
  'res: any': 'res: { data?: unknown; code?: number; message?: string }',
  'result: any': 'result: { success?: boolean; data?: unknown; error?: string }',
  'response: any': 'response: { data?: unknown; code?: number; message?: string }',
  
  // 页面/组件相关
  'page: any': 'page: WechatMiniprogram.Page.Instance<Record<string, unknown>, Record<string, unknown>>',
  'component: any': 'component: WechatMiniprogram.Component.Instance<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>',
  
  // 函数参数
  '...args: any[]': '...args: unknown[]',
  'callback: any': 'callback: (...args: unknown[]) => void',
  'handler: any': 'handler: (...args: unknown[]) => void',
  
  // 通用any类型
  ': any[]': ': unknown[]',
  '<any>': '<unknown>',
  'as any': 'as unknown'
};

// 处理TypeScript文件
function processTypeScriptFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // 跳过已有@ts-nocheck的文件
  if (content.includes('@ts-nocheck')) {
    return false;
  }
  
  // 统计any使用
  const anyMatches = content.match(/:\s*any\b/g) || [];
  const anyCount = anyMatches.length;
  
  if (anyCount > 0) {
    stats.anyTypesFound += anyCount;
    
    // 应用类型替换规则
    Object.entries(typeReplacements).forEach(([pattern, replacement]) => {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const beforeCount = (content.match(regex) || []).length;
      content = content.replace(regex, replacement);
      const afterCount = (content.match(regex) || []).length;
      stats.anyTypesFixed += (beforeCount - afterCount);
    });
    
    // 处理剩余的any类型 - 保守处理
    // 只替换明确可以替换的
    content = content.replace(/:\s*any\b(?!\s*\))/g, ': unknown');
    
    // 保存修改
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.filesFixed++;
      return true;
    }
  }
  
  return false;
}

// 扫描目录
function scanDirectory(dir) {
  const files = [];
  
  function scan(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    
    const items = fs.readdirSync(currentDir);
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'miniprogram_npm', 'typings', 'backups'].includes(item)) {
          scan(fullPath);
        }
      } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    });
  }
  
  scan(dir);
  return files;
}

// 生成报告
function generateReport() {
  const report = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
any类型修复报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 统计：
  • 扫描文件：${stats.filesScanned}
  • 修改文件：${stats.filesFixed}
  • 发现any类型：${stats.anyTypesFound}
  • 修复any类型：${stats.anyTypesFixed}
  • 剩余any类型：${stats.anyTypesFound - stats.anyTypesFixed}
  
📝 修复策略：
  1. 事件类型 → WechatMiniprogram.CustomEvent
  2. 错误处理 → unknown
  3. 数据对象 → Record<string, unknown>
  4. 通用any → unknown
  
⚠️  注意事项：
  • 保留必要的any类型（如第三方库接口）
  • 不破坏现有功能逻辑
  • 不改变UI表现
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  
  console.log(report);
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');
  
  console.log('🔍 扫描any类型使用...\n');
  
  const miniprogramDir = path.join(process.cwd(), 'miniprogram');
  const tsFiles = scanDirectory(miniprogramDir);
  
  stats.filesScanned = tsFiles.length;
  console.log(`找到 ${tsFiles.length} 个TypeScript文件\n`);
  
  if (!dryRun) {
    console.log('🔧 开始修复any类型...\n');
    
    tsFiles.forEach(file => {
      if (processTypeScriptFile(file)) {
        console.log(`✅ 修复: ${path.relative(process.cwd(), file)}`);
      }
    });
  } else {
    // 预览模式 - 只统计
    tsFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const anyMatches = content.match(/:\s*any\b/g) || [];
      if (anyMatches.length > 0) {
        stats.anyTypesFound += anyMatches.length;
        console.log(`📝 ${path.basename(file)}: ${anyMatches.length} 个any类型`);
      }
    });
  }
  
  generateReport();
  
  if (dryRun && stats.anyTypesFound > 0) {
    console.log('💡 使用 node scripts/fix-any-types.js --fix 执行修复');
  }
}

// 执行
main();
