import { safeCloudCall } from './safe-cloud-call'

/**
 * 统一的云函数API调用封装
 * 
 * 使用说明：
 * - 健康管理模块：请使用 HealthCloud（cloud-functions.ts）
 * - 其他模块：使用 CloudApi.callFunction
 */

export interface CloudApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  errorDetail?: string
}

interface CloudApiOptions {
  loading?: boolean
  loadingText?: string
  showError?: boolean
  showSuccess?: boolean
  successText?: string
  useCache?: boolean
  cacheTime?: number
  timeout?: number
}

class CloudApi {
  /**
   * 通用的云函数调用方法
   */
  static async callFunction<T = any>(
    name: string, 
    data: unknown, 
    options: CloudApiOptions = {}
  ): Promise<CloudApiResponse<T>> {
    const {
      loading = false,
      loadingText = '处理中...',
      showError = true,
      showSuccess = false,
      successText = '操作成功',
      useCache,
      cacheTime,
      timeout
    } = options

    if (loading) {
      wx.showLoading({ title: loadingText })
    }

    try {
      const derivedUseCache = typeof useCache === 'boolean' ? useCache : (loading === false ? false : undefined)
      const result = await safeCloudCall({
        name,
        data: data as Record<string, unknown>,
        useCache: derivedUseCache,
        cacheTime,
        timeout
      }) as CloudApiResponse<T>

      if (loading) {
        wx.hideLoading()
      }

      if (result?.success) {
        if (showSuccess) {
          wx.showToast({
            title: successText,
            icon: 'success'
          })
        }
        return result
      } else {
        if (showError) {
          wx.showToast({
            title: result?.error || '操作失败',
            icon: 'error'
          })
        }
        return result || { success: false, error: '操作失败' }
      }

    } catch (error: unknown) {
      if (loading) {
        wx.hideLoading()
      }

      const errorMessage = error instanceof Error ? error.message : '网络错误'
      
      if (showError) {
        wx.showToast({
          title: errorMessage,
          icon: 'error'
        })
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  // ============ 任务管理 API ============

  /**
   * 完成疫苗接种任务
   */
  static async completeVaccineTask(data: {
    taskId: string
    batchId: string
    vaccineRecord: unknown}): Promise<CloudApiResponse> {
    return this.callFunction(
      'breeding-todo',
      {
        action: 'complete_vaccine_task',
        ...data
      },
      {
        loading: true,
        loadingText: '提交疫苗接种记录...',
        showError: true,
        showSuccess: true,
        successText: '疫苗接种记录提交成功'
      }
    )
  }

  /**
   * 获取任务列表
   */
  static async getTodos(batchId: string, dayAge: number, options?: { showError?: boolean }): Promise<CloudApiResponse> {
    return this.callFunction(
      'breeding-todo',
      {
        action: 'get_todos',
        batchId,
        dayAge
      },
      {
        loading: false,
        showError: options?.showError !== false // 默认显示错误，除非明确设置为false
      }
    )
  }

  /**
   * 获取一周任务（优化版：移除重复加载提示）
   */
  static async getWeeklyTodos(batchId: string, currentDayAge: number, options?: { showLoading?: boolean }): Promise<CloudApiResponse> {
    return this.callFunction(
      'breeding-todo',
      {
        action: 'get_weekly_todos',
        batchId,
        currentDayAge
      },
      {
        loading: options?.showLoading ?? false, // 默认不显示加载提示，由调用方统一控制
        loadingText: '加载任务列表...',
        showError: true
      }
    )
  }

  /**
   * 完成普通任务
   */
  static async completeTask(taskId: string, batchId: string, notes?: string): Promise<CloudApiResponse> {
    return this.callFunction(
      'breeding-todo',
      {
        action: 'complete_task',
        taskId,
        batchId,
        notes
      },
      {
        loading: true,
        loadingText: '完成任务...',
        showError: true,
        showSuccess: true,
        successText: '任务完成成功'
      }
    )
  }

  /**
   * 修复批次任务
   */
  static async fixBatchTasks(batchId: string): Promise<CloudApiResponse> {
    return this.callFunction(
      'breeding-todo',
      {
        action: 'fix_batch_tasks',
        batchId
      },
      {
        loading: true,
        loadingText: '修复任务中...',
        showError: true,
        showSuccess: true,
        successText: '任务修复完成'
      }
    )
  }

  // ============ 财务管理 API ============

  /**
   * 创建成本记录
   */
  static async createCostRecord(data: {
    costType: string
    subCategory?: string
    title: string
    description?: string
    amount: number
    batchId?: string
    costBreakdown?: unknown
    relatedRecords?: unknown[]
    costDate: string
  }): Promise<CloudApiResponse> {
    return this.callFunction(
      'finance-management',
      {
        action: 'create_cost_record',
        ...data
      },
      {
        loading: true,
        loadingText: '创建成本记录...',
        showError: true,
        showSuccess: true,
        successText: '成本记录创建成功'
      }
    )
  }

  /**
   * 查询成本记录
   */
  static async listCostRecords(params: {
    page?: number
    pageSize?: number
    costType?: string
    batchId?: string
    dateRange?: unknown}): Promise<CloudApiResponse> {
    return this.callFunction(
      'finance-management',
      {
        action: 'list_cost_records',
        ...params
      },
      {
        loading: false,
        showError: true
      }
    )
  }

  /**
   * 生成财务报表
   */
  static async generateFinanceReport(params: {
    reportType: string
    dateRange: WechatMiniprogram.CustomEvent
    includeCharts?: boolean
  }): Promise<CloudApiResponse> {
    return this.callFunction(
      'finance-management',
      {
        action: 'generate_report',
        ...params
      },
      {
        loading: true,
        loadingText: '生成财务报表...',
        showError: true,
        showSuccess: true,
        successText: '财务报表生成成功'
      }
    )
  }

  // ============ 用户管理 API ============

  /**
   * 获取用户信息
   */
  static async getUserInfo(): Promise<CloudApiResponse> {
    return this.callFunction(
      'user-management',
      {
        action: 'get_user_info'
      },
      {
        loading: false,
        showError: true
      }
    )
  }

  /**
   * 更新用户信息
   */
  static async updateUserInfo(data: Record<string, unknown>): Promise<CloudApiResponse> {
    return this.callFunction(
      'user-management',
      {
        action: 'update_user_info',
        ...data
      },
      {
        loading: true,
        loadingText: '更新用户信息...',
        showError: true,
        showSuccess: true,
        successText: '用户信息更新成功'
      }
    )
  }

  // ============ 通用工具方法 ============

  /**
   * 批量调用云函数
   */
  static async batchCall(calls: Array<{
    name: string
    data: unknown}>): Promise<CloudApiResponse[]> {
    const promises = calls.map(call => 
      this.callFunction(call.name, call.data, { showError: false })
    )

    try {
      const results = await Promise.all(promises)
      return results
    } catch (error: unknown) {
      wx.showToast({
        title: '批量操作失败',
        icon: 'error'
      })
      return []
    }
  }

  /**
   * 获取错误信息的友好提示
   */
  static getErrorMessage(error: string): string {
    const errorMap: { [key: string]: string } = {
      'permission denied': '权限不足',
      'network error': '网络连接失败',
      'timeout': '请求超时',
      'invalid parameter': '参数错误',
      'record not found': '记录不存在',
      'duplicate record': '记录已存在'
    }

    for (const [key, message] of Object.entries(errorMap)) {
      if (error.toLowerCase().includes(key)) {
        return message
      }
    }

    return error || '操作失败'
  }
}

export default CloudApi
