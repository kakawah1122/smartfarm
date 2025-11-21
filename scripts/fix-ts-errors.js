#!/usr/bin/env node

/**
 * 修复当前TypeScript类型错误
 */

const fs = require('fs');
const path = require('path');

// 修复vaccine-records-list.ts
function fixVaccineRecordsList() {
  const filePath = path.join(process.cwd(), 'miniprogram/packageHealth/vaccine-records-list/vaccine-records-list.ts');
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 修复所有reduce函数的参数类型
  content = content.replace(/\.reduce\(\(sum, r\)/g, '.reduce((sum: number, r: any)');
  
  // 修复错误类型
  content = content.replace(/logger\.error\('([^']+)', error\)/g, "logger.error('$1', error as Error)");
  
  // 修复page参数类型
  content = content.replace(/loadMore\(page = /g, 'loadMore(page: number = ');
  content = content.replace(/loadPreviousPage\(page = /g, 'loadPreviousPage(page: number = ');
  
  // 修复CustomEvent
  content = content.replace(/onDateChange\(e: CustomEvent\)/g, 'onDateChange(e: WechatMiniprogram.CustomEvent)');
  content = content.replace(/onSearchChange\(e: CustomEvent\)/g, 'onSearchChange(e: WechatMiniprogram.CustomEvent)');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 修复了vaccine-records-list.ts');
}

// 修复health.ts的类型问题
function fixHealthTs() {
  const filePath = path.join(process.cwd(), 'miniprogram/pages/health/health.ts');
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 修复null as BaseResponse的问题
  content = content.replace(/null as BaseResponse/g, 'null as unknown as BaseResponse');
  
  // 修复CustomEvent
  content = content.replace(/\(e: CustomEvent\)/g, '(e: WechatMiniprogram.CustomEvent)');
  
  // 修复options和initData类型
  content = content.replace(/onLoad\(options\)/, 'onLoad(options: Record<string, string | undefined>)');
  content = content.replace(/const initData = /, 'const initData: any = ');
  
  // 修复result.result问题
  content = content.replace(/result\.result/g, '(result as any).result');
  
  // 修复扩展运算符问题
  content = content.replace(/\.\.\.result(?!\.)/, '...(result as any)');
  
  // 修复error类型
  content = content.replace(/catch \(error\)/g, 'catch (error: any)');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 修复了health.ts');
}

// 添加类型声明文件
function createTypeDeclarations() {
  const content = `// 微信小程序事件类型扩展
declare namespace WechatMiniprogram {
  interface CustomEvent<T = any> {
    currentTarget: {
      dataset: Record<string, any>
    }
    detail: T
    target: {
      dataset: Record<string, any>
    }
  }
  
  interface TapEvent extends CustomEvent {}
  interface InputEvent extends CustomEvent<{
    value: string
    cursor?: number
    keyCode?: number
  }> {}
  interface ScrollEvent extends CustomEvent<{
    scrollTop: number
    scrollLeft: number
  }> {}
}

// 全局logger
declare const logger: {
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
  debug: (...args: any[]) => void
}

// 导出空对象以使文件成为模块
export {}
`;
  
  const filePath = path.join(process.cwd(), 'miniprogram/types/global.d.ts');
  
  // 确保目录存在
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 创建了全局类型声明文件');
}

// 主函数
function main() {
  console.log('🔧 开始修复TypeScript错误...\n');
  
  try {
    // 创建类型声明
    createTypeDeclarations();
    
    // 修复具体文件
    fixVaccineRecordsList();
    fixHealthTs();
    
    console.log('\n✅ TypeScript错误修复完成！');
    console.log('📝 请重新编译项目查看效果');
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    process.exit(1);
  }
}

// 执行
main();
