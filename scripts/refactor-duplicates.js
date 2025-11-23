#!/usr/bin/env node

/**
 * 重构重复代码
 * 将重复的函数提取到公共模块
 */

const fs = require('fs');
const path = require('path');

// 需要重构的主要重复函数
const duplicatesToRefactor = [
  {
    name: 'formatDate',
    description: '日期格式化函数',
    locations: [
      'miniprogram/utils/util.ts',
      'miniprogram/utils/date-util.ts',
      'miniprogram/pages/health/helpers/format-helper.ts'
    ],
    targetLocation: 'miniprogram/utils/common-utils.ts',
    targetExport: 'formatDate'
  },
  {
    name: 'showToast',
    description: '统一的提示函数',
    locations: [
      'miniprogram/utils/toast-util.ts',
      'miniprogram/pages/health/helpers/ui-helper.ts'
    ],
    targetLocation: 'miniprogram/utils/common-utils.ts',
    targetExport: 'showToast'
  },
  {
    name: 'handleError',
    description: '错误处理函数',
    locations: [
      'miniprogram/utils/error-handler.ts',
      'miniprogram/pages/health/helpers/error-helper.ts'
    ],
    targetLocation: 'miniprogram/utils/common-utils.ts',
    targetExport: 'handleError'
  }
];

/**
 * 创建公共工具模块
 */
function createCommonUtils() {
  const utilsPath = path.join(process.cwd(), 'miniprogram/utils/common-utils.ts');
  
  if (fs.existsSync(utilsPath)) {
    console.log('📄 公共工具模块已存在');
    return false;
  }
  
  const content = `/**
 * 公共工具函数模块
 * 用于存放项目中常用的工具函数
 */

/**
 * 格式化日期
 * @param date 日期对象或字符串
 * @param format 格式字符串，默认 YYYY-MM-DD
 */
export function formatDate(date: Date | string | number, format = 'YYYY-MM-DD'): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return '';
  }
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 显示提示信息
 * @param message 提示内容
 * @param type 提示类型
 */
export function showToast(message: string, type: 'success' | 'error' | 'loading' | 'none' = 'none') {
  wx.showToast({
    title: message,
    icon: type as any,
    duration: 2000
  });
}

/**
 * 统一的错误处理
 * @param error 错误对象
 * @param defaultMessage 默认错误信息
 */
export function handleError(error: any, defaultMessage = '操作失败'): string {
  console.error('Error:', error);
  
  let message = defaultMessage;
  
  if (error?.message) {
    message = error.message;
  } else if (error?.errMsg) {
    message = error.errMsg;
  } else if (typeof error === 'string') {
    message = error;
  }
  
  showToast(message, 'error');
  return message;
}

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param delay 延迟时间
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay) as any;
  };
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param limit 时间限制
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * 深拷贝对象
 * @param obj 要拷贝的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as any;
  }
  
  if (obj instanceof Object) {
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * 生成唯一ID
 * @param prefix 前缀
 */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? \`\${prefix}_\${timestamp}_\${random}\` : \`\${timestamp}_\${random}\`;
}

/**
 * 检查是否为空值
 * @param value 要检查的值
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined || value === '') {
    return true;
  }
  
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  
  return false;
}

/**
 * 安全获取对象属性值
 * @param obj 对象
 * @param path 属性路径，如 'a.b.c'
 * @param defaultValue 默认值
 */
export function get(obj: any, path: string, defaultValue?: any): any {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result !== undefined ? result : defaultValue;
}

/**
 * 格式化金额
 * @param amount 金额
 * @param prefix 前缀符号
 */
export function formatMoney(amount: number | string, prefix = '¥'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return \`\${prefix}0.00\`;
  }
  return \`\${prefix}\${num.toFixed(2)}\`;
}
`;
  
  fs.writeFileSync(utilsPath, content);
  console.log('✅ 创建公共工具模块成功');
  return true;
}

/**
 * 生成重构报告
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, '..', 'docs', `REFACTOR-DUPLICATES-${timestamp.slice(0, 10)}.md`);
  
  let report = `# 重复代码重构报告

生成时间: ${new Date().toLocaleString()}

## 📊 重构内容

### 创建的公共模块
- \`miniprogram/utils/common-utils.ts\` - 公共工具函数模块

### 包含的函数
1. **formatDate** - 日期格式化
2. **showToast** - 统一提示
3. **handleError** - 错误处理
4. **debounce** - 防抖函数
5. **throttle** - 节流函数
6. **deepClone** - 深拷贝
7. **generateId** - 生成唯一ID
8. **isEmpty** - 空值检查
9. **get** - 安全获取属性
10. **formatMoney** - 金额格式化

## 📝 使用方法

### 1. 导入工具函数
\`\`\`typescript
import { formatDate, showToast, handleError } from '../../utils/common-utils';
\`\`\`

### 2. 替换重复代码
将各处重复的函数调用改为使用公共模块。

### 示例：日期格式化
\`\`\`typescript
// 之前
function myFormatDate(date) {
  // 重复的格式化代码
}

// 之后
import { formatDate } from '../../utils/common-utils';
const formatted = formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss');
\`\`\`

## 💡 优势

1. **减少代码重复** - 统一的工具函数
2. **提高可维护性** - 修改只需要改一处
3. **提高代码质量** - 经过优化的实现
4. **便于测试** - 集中的单元测试

## 🔧 后续工作

1. 逐步替换项目中的重复实现
2. 添加更多常用工具函数
3. 为工具函数添加单元测试
4. 创建专门的文档

## ⚠️ 注意事项

1. 替换时要确保功能一致
2. 充分测试替换后的代码
3. 保留原有代码作为备份
4. 分批进行替换
`;
  
  fs.writeFileSync(reportPath, report);
  return reportPath;
}

// 主程序
console.log('🔧 开始重构重复代码\n');

// 创建公共工具模块
const created = createCommonUtils();

if (created) {
  console.log('\n📊 重构统计:');
  console.log('   - 创建公共模块: 1个');
  console.log('   - 提取函数: 10个');
  
  const reportPath = generateReport();
  console.log(`\n📄 报告已生成: ${reportPath}`);
  
  console.log('\n💡 下一步:');
  console.log('   1. 查找并替换重复的函数实现');
  console.log('   2. 更新import语句');
  console.log('   3. 测试功能是否正常');
  console.log('   4. 删除冗余代码');
} else {
  console.log('\n💡 公共模块已存在，可以开始使用了！');
}
