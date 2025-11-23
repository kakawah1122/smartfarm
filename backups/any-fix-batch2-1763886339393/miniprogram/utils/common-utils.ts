/**
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
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
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
    return `${prefix}0.00`;
  }
  return `${prefix}${num.toFixed(2)}`;
}
