/**
 * 健康管理页面错误处理工具
 * 减少重复的错误处理代码
 */

/**
 * 统一的错误处理包装器
 * @param fn 要执行的异步函数
 * @param options 配置选项
 */
export async function withErrorHandler<T>(
  fn: () => Promise<T>,
  options: {
    loadingText?: string
    successText?: string
    errorText?: string
    showLoading?: boolean
    showSuccess?: boolean
    showError?: boolean
  } = {}
): Promise<T | null> {
  const {
    loadingText = '处理中...',
    successText = '操作成功',
    errorText = '操作失败，请重试',
    showLoading = true,
    showSuccess = true,
    showError = true
  } = options
  
  try {
    if (showLoading) {
      wx.showLoading({ title: loadingText })
    }
    
    const result = await fn()
    
    if (showLoading) {
      wx.hideLoading()
    }
    
    if (showSuccess) {
      wx.showToast({
        title: successText,
        icon: 'success'
      })
    }
    
    return result
  } catch (error: any) {
    if (showLoading) {
      wx.hideLoading()
    }
    
    if (showError) {
      wx.showToast({
        title: error.message || errorText,
        icon: 'error'
      })
    }
    
    return null
  }
}

/**
 * 静默执行错误处理
 * @param fn 要执行的函数
 * @param defaultValue 出错时的默认返回值
 */
export async function silentExecute<T>(
  fn: () => Promise<T>,
  defaultValue: T
): Promise<T> {
  try {
    return await fn()
  } catch {
    return defaultValue
  }
}

/**
 * 带重试的执行
 * @param fn 要执行的函数
 * @param maxRetries 最大重试次数
 * @param delay 重试延迟（毫秒）
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: any
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

/**
 * 批量执行并忽略单个错误
 * @param tasks 任务数组
 */
export async function batchExecute<T>(
  tasks: Array<() => Promise<T>>
): Promise<Array<{ success: boolean; data?: T; error?: any }>> {
  return Promise.all(
    tasks.map(async task => {
      try {
        const data = await task()
        return { success: true, data }
      } catch (error) {
        return { success: false, error }
      }
    })
  )
}

export default {
  withErrorHandler,
  silentExecute,
  withRetry,
  batchExecute
}
