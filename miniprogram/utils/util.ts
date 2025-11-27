import { logger } from './logger'

/**
 * 格式化时间为北京时间
 * @param date 日期对象或日期字符串
 * @param format 格式类型：'datetime' | 'date' | 'time'
 * @returns 格式化后的时间字符串
 */
export const formatTime = (date: Date | string, format: 'datetime' | 'date' | 'time' = 'datetime') => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) {
    return ''
  }
  
  try {
    // ✅ 使用 toLocaleString 确保北京时间显示
    const beijingTimeStr = dateObj.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    
    // 转换为标准格式
    const standardFormat = beijingTimeStr.replace(/\//g, '-')
    
    if (format === 'date') {
      return standardFormat.split(' ')[0]
    } else if (format === 'time') {
      return standardFormat.split(' ')[1]
    } else {
      return standardFormat
    }
  } catch (error) {
    logger.error('时间格式化错误:', error)
    // 降级处理
    const year = dateObj.getFullYear()
    const month = dateObj.getMonth() + 1
    const day = dateObj.getDate()
    const hour = dateObj.getHours()
    const minute = dateObj.getMinutes()
    const second = dateObj.getSeconds()
    
    if (format === 'date') {
      return [year, month, day].map(formatNumber).join('-')
    } else if (format === 'time') {
      return [hour, minute, second].map(formatNumber).join(':')
    } else {
      return (
        [year, month, day].map(formatNumber).join('-') +
        ' ' +
        [hour, minute, second].map(formatNumber).join(':')
      )
    }
  }
}

/**
 * 获取当前北京时间的日期字符串（YYYY-MM-DD）
 */
export const getCurrentBeijingDate = (): string => {
  const now = new Date()
  try {
    const beijingDate = now.toLocaleDateString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    return beijingDate.replace(/\//g, '-')
  } catch (error) {
    logger.error('获取北京时间日期失败:', error)
    // 降级处理
    return formatTime(now, 'date')
  }
}

/**
 * 获取当前北京时间的完整时间字符串（YYYY-MM-DD HH:mm:ss）
 */
export const getCurrentBeijingDateTime = (): string => {
  return formatTime(new Date(), 'datetime')
}

const formatNumber = (n: number) => {
  const s = n.toString()
  return s[1] ? s : '0' + s
}
