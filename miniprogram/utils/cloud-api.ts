// 统一的云函数API调用封装
// 支持TypeScript类型检查和错误处理

interface CloudApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

interface CloudApiOptions {
  loading?: boolean
  loadingText?: string
  showError?: boolean
  showSuccess?: boolean
  successText?: string
}

class CloudApi {
  /**
   * 通用的云函数调用方法
   */
  static async callFunction<T = any>(
    name: string, 
    data: any, 
    options: CloudApiOptions = {}
  ): Promise<CloudApiResponse<T>> {
    const {
      loading = false,
      loadingText = '处理中...',
      showError = true,
      showSuccess = false,
      successText = '操作成功'
    } = options

    if (loading) {
      wx.showLoading({ title: loadingText })
    }

    try {
      const result = await wx.cloud.callFunction({
        name,
        data
      }) as any

      if (loading) {
        wx.hideLoading()
      }

      if (result.result.success) {
        if (showSuccess) {
          wx.showToast({
            title: successText,
            icon: 'success'
          })
        }
        return result.result
      } else {
        if (showError) {
          wx.showToast({
            title: result.result.error || '操作失败',
            icon: 'error'
          })
        }
        return result.result
      }

    } catch (error: any) {
      if (loading) {
        wx.hideLoading()
      }

      if (showError) {
        wx.showToast({
          title: error.message || '网络错误',
          icon: 'error'
        })
      }

      return {
        success: false,
        error: error.message || '网络错误'
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
    vaccineRecord: any
  }): Promise<CloudApiResponse> {
    return this.callFunction(
      'breeding-todo',
      {
        action: 'completeVaccineTask',
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
  static async getTodos(batchId: string, dayAge: number): Promise<CloudApiResponse> {
    return this.callFunction(
      'breeding-todo',
      {
        action: 'getTodos',
        batchId,
        dayAge
      },
      {
        loading: false,
        showError: true
      }
    )
  }

  /**
   * 获取一周任务
   */
  static async getWeeklyTodos(batchId: string, currentDayAge: number): Promise<CloudApiResponse> {
    return this.callFunction(
      'breeding-todo',
      {
        action: 'getWeeklyTodos',
        batchId,
        currentDayAge
      },
      {
        loading: true,
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
        action: 'completeTask',
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

  // ============ 健康管理 API ============

  /**
   * 创建预防记录
   */
  static async createPreventionRecord(data: {
    batchId: string
    preventionType: string
    vaccineInfo?: any
    veterinarianInfo?: any
    costInfo?: any
    notes?: string
  }): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management',
      {
        action: 'create_prevention_record',
        ...data
      },
      {
        loading: true,
        loadingText: '创建预防记录...',
        showError: true,
        showSuccess: true,
        successText: '预防记录创建成功'
      }
    )
  }

  /**
   * 查询预防记录列表
   */
  static async listPreventionRecords(params: {
    page?: number
    pageSize?: number
    preventionType?: string
    batchId?: string
    dateRange?: any
  }): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management',
      {
        action: 'list_prevention_records',
        ...params
      },
      {
        loading: false,
        showError: true
      }
    )
  }

  /**
   * 创建健康记录
   */
  static async createHealthRecord(data: {
    batchId: string
    recordType?: string
    totalCount?: number
    healthyCount?: number
    sickCount?: number
    deadCount?: number
    symptoms?: string[]
    diagnosis?: string
    treatment?: string
    notes?: string
  }): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management',
      {
        action: 'create_health_record',
        ...data
      },
      {
        loading: true,
        loadingText: '创建健康记录...',
        showError: true,
        showSuccess: true,
        successText: '健康记录创建成功'
      }
    )
  }

  /**
   * 创建治疗记录
   */
  static async createTreatmentRecord(data: {
    batchId: string
    healthRecordId?: string
    treatmentType?: string
    diagnosis?: string
    medications?: any[]
    treatmentPlan?: string
    veterinarian?: string
    affectedCount?: number
    treatmentCost?: number
    notes?: string
  }): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management',
      {
        action: 'create_treatment_record',
        ...data
      },
      {
        loading: true,
        loadingText: '创建治疗记录...',
        showError: true,
        showSuccess: true,
        successText: '治疗记录创建成功'
      }
    )
  }

  /**
   * 创建AI诊断记录
   */
  static async createAiDiagnosisRecord(data: {
    batchId: string
    healthRecordId?: string
    symptoms?: string[]
    images?: string[]
    aiDiagnosis?: any
    humanVerification?: any
  }): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management',
      {
        action: 'create_ai_diagnosis',
        ...data
      },
      {
        loading: true,
        loadingText: 'AI诊断分析中...',
        showError: true,
        showSuccess: true,
        successText: 'AI诊断完成'
      }
    )
  }

  /**
   * 获取健康概览
   */
  static async getHealthOverview(batchId: string, dateRange?: any): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management',
      {
        action: 'get_health_overview',
        batchId,
        dateRange
      },
      {
        loading: true,
        loadingText: '加载健康数据...',
        showError: true
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
    costBreakdown?: any
    relatedRecords?: any[]
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
    dateRange?: any
  }): Promise<CloudApiResponse> {
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
    dateRange: any
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
  static async updateUserInfo(data: any): Promise<CloudApiResponse> {
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
    data: any
  }>): Promise<CloudApiResponse[]> {
    const promises = calls.map(call => 
      this.callFunction(call.name, call.data, { showError: false })
    )

    try {
      const results = await Promise.all(promises)
      return results
    } catch (error: any) {
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

// 类型定义导出
export type {
  CloudApiResponse,
  CloudApiOptions
}
