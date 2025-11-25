import { safeCloudCall } from './safe-cloud-call'
// smartCloudCall 已弃用，改为在 callFunction 内部自动路由

// 统一的云函数API调用封装
// 支持TypeScript类型检查和错误处理

// health-management 已废弃，需要路由到新云函数的 action 列表
// ⚠️ 这是唯一的映射表，所有 health-management 调用都通过此表路由
const HEALTH_MANAGEMENT_ROUTE_MAP: Record<string, string> = {
  // 治疗模块 → health-treatment
  'get_cured_records_list': 'health-treatment',
  'create_treatment_record': 'health-treatment',
  'update_treatment_record': 'health-treatment',
  'list_treatment_records': 'health-treatment',
  'get_treatment_record_detail': 'health-treatment',
  'submit_treatment_plan': 'health-treatment',
  'update_treatment_progress': 'health-treatment',
  'complete_treatment_as_cured': 'health-treatment',
  'complete_treatment_as_died': 'health-treatment',
  'get_ongoing_treatments': 'health-treatment',
  'add_treatment_note': 'health-treatment',
  'add_treatment_medication': 'health-treatment',
  'calculate_treatment_cost': 'health-treatment',
  'record_treatment_death': 'health-treatment',
  'get_treatment_statistics': 'health-treatment',
  'get_treatment_history': 'health-treatment',
  'get_treatment_detail': 'health-treatment',
  'create_treatment_from_diagnosis': 'health-treatment',
  'create_treatment_from_abnormal': 'health-treatment',
  'create_treatment_from_vaccine': 'health-treatment',
  
  // 死亡记录模块 → health-death
  'get_death_records_list': 'health-death',
  'create_death_record': 'health-death',
  'createDeathRecord': 'health-death',
  'list_death_records': 'health-death',
  'listDeathRecords': 'health-death',
  'get_death_stats': 'health-death',
  'getDeathStats': 'health-death',
  'get_death_record_detail': 'health-death',
  'create_death_record_with_finance': 'health-death',
  'correct_death_diagnosis': 'health-death',
  'create_death_from_vaccine': 'health-death',
  
  // 异常记录模块 → health-abnormal
  'get_abnormal_records': 'health-abnormal',
  'create_abnormal_record': 'health-abnormal',
  'list_abnormal_records': 'health-abnormal',
  'get_abnormal_record_detail': 'health-abnormal',
  'correct_abnormal_diagnosis': 'health-abnormal',
  'update_abnormal_status': 'health-abnormal',
  'get_abnormal_stats': 'health-abnormal',
  'delete_abnormal_records': 'health-abnormal',
  
  // 健康记录模块 → health-records
  'create_health_record': 'health-records',
  'list_health_records': 'health-records',
  'update_health_record': 'health-records',
  'delete_health_record': 'health-records',
  'get_health_record_detail': 'health-records',
  'get_health_records_by_status': 'health-records',
  'get_batch_health_summary': 'health-records',
  'calculate_health_rate': 'health-records',
  
  // 预防保健模块 → health-prevention
  'create_prevention_record': 'health-prevention',
  'list_prevention_records': 'health-prevention',
  'get_prevention_dashboard': 'health-prevention',
  'getPreventionDashboard': 'health-prevention',
  'complete_prevention_task': 'health-prevention',
  'completePreventionTask': 'health-prevention',
  'get_today_prevention_tasks': 'health-prevention',
  'getTodayPreventionTasks': 'health-prevention',
  'get_prevention_tasks_by_batch': 'health-prevention',
  'getPreventionTasksByBatch': 'health-prevention',
  'get_batch_prevention_comparison': 'health-prevention',
  'getBatchPreventionComparison': 'health-prevention',
  'update_prevention_effectiveness': 'health-prevention',
  'updatePreventionEffectiveness': 'health-prevention',
  
  // 健康概览模块 → health-overview
  'get_health_overview': 'health-overview',
  'get_dashboard_snapshot': 'health-overview',
  'get_all_batches_health_summary': 'health-overview',
  'get_all_batches_health_data': 'health-overview',
  'get_homepage_health_overview': 'health-overview',
  'get_health_statistics': 'health-overview',
  'getHealthStatistics': 'health-overview',
  'get_health_statistics_optimized': 'health-overview',
  'getHealthStatisticsOptimized': 'health-overview',
  'get_health_dashboard_complete': 'health-overview',
  'get_batch_complete_data': 'health-overview',
  'get_batch_prompt_data': 'health-overview',
  'calculate_batch_cost': 'health-overview',
  'calculateBatchCost': 'health-overview',
  
  // 成本计算模块 → health-cost
  'calculate_cost_stats': 'health-cost',
  'get_batch_cost_analysis': 'health-cost',
  'get_prevention_cost': 'health-cost',
  'get_cost_analysis': 'health-cost',
  'export_cost_report': 'health-cost',
  
  // AI诊断模块 → ai-diagnosis
  'create_ai_diagnosis': 'ai-diagnosis',
  'ai_diagnosis': 'ai-diagnosis',
  'get_diagnosis_history': 'ai-diagnosis',
  'get_diagnosis_result': 'ai-diagnosis',
  'update_diagnosis_review': 'ai-diagnosis',
  'adopt_diagnosis': 'ai-diagnosis',
  'feedback_diagnosis': 'ai-diagnosis',
  'update_diagnosis_status': 'ai-diagnosis',
  'get_diagnosis_stats': 'ai-diagnosis',
  'get_pending_diagnosis_count': 'ai-diagnosis'
}

// 导出路由映射表供其他模块使用
export { HEALTH_MANAGEMENT_ROUTE_MAP }

/**
 * 获取 action 对应的目标云函数名
 * @param action 操作类型
 * @returns 目标云函数名，如果未找到则返回 null
 */
export function getTargetCloudFunction(action: string): string | null {
  return HEALTH_MANAGEMENT_ROUTE_MAP[action] || null
}

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
   * ⚠️ 自动路由：当调用 health-management 时，会自动转发到对应的新云函数
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
      // ⚠️ 自动路由：health-management 已废弃，自动转发到新云函数
      let actualName = name
      let actualData = data as Record<string, unknown>
      
      if (name === 'health-management' && actualData && typeof actualData === 'object') {
        const action = actualData.action as string
        const targetFunction = HEALTH_MANAGEMENT_ROUTE_MAP[action]
        
        if (targetFunction) {
          // 路由到新云函数
          actualName = targetFunction
          console.log(`[CloudApi] 自动路由: health-management/${action} → ${targetFunction}`)
        } else {
          console.warn(`[CloudApi] 未找到 action "${action}" 的路由映射，将调用原 health-management（可能失败）`)
        }
      }
      
      const derivedUseCache = typeof useCache === 'boolean' ? useCache : (loading === false ? false : undefined)
      const result = await safeCloudCall({
        name: actualName,
        data: actualData,
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
  static async getTodos(batchId: string, dayAge: number, options?: { showError?: boolean }): Promise<CloudApiResponse> {
    return this.callFunction(
      'breeding-todo',
      {
        action: 'getTodos',
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
        action: 'getWeeklyTodos',
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

  /**
   * 修复批次任务
   */
  static async fixBatchTasks(batchId: string): Promise<CloudApiResponse> {
    return this.callFunction(
      'breeding-todo',
      {
        action: 'fixBatchTasks',
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

  // ============ 健康管理 API ============

  /**
   * 创建预防记录
   */
  static async createPreventionRecord(data: {
    batchId: string
    preventionType: string
    vaccineInfo?: unknown
    veterinarianInfo?: unknown
    costInfo?: unknown
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
    dateRange?: unknown}): Promise<CloudApiResponse> {
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
    medications?: unknown[]
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
    aiDiagnosis?: unknown
    humanVerification?: unknown}): Promise<CloudApiResponse> {
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
   * 获取健康概览（使用新的独立云函数）
   */
  static async getHealthOverview(batchId: string, dateRange?: unknown, options?: CloudApiOptions): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-overview',  // 使用拆分后的独立云函数
      {
        action: 'get_health_overview',
        batchId,
        dateRange
      },
      {
        loading: false, // 由调用方控制 loading 状态
        showError: true,
        ...options
      }
    )
  }

  /**
   * 获取所有批次健康汇总
   */
  static async getAllBatchesHealthSummary(): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management',
      {
        action: 'get_all_batches_health_summary'
      },
      {
        loading: true,
        loadingText: '加载批次健康数据...',
        showError: true
      }
    )
  }

  /**
   * 获取首页健康概览
   */
  static async getHomepageHealthOverview(): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management',
      {
        action: 'get_homepage_health_overview'
      },
      {
        loading: false,
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

  // ============ 死亡记录 API ============

  /**
   * 创建死亡记录
   */
  static async createDeathRecord(data: Record<string, unknown>): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management', 
      { action: 'createDeathRecord', ...data },
      { 
        loading: true,
        loadingText: '提交死亡记录...',
        showSuccess: true,
        successText: '记录提交成功'
      }
    )
  }

  /**
   * 查询死亡记录列表
   */
  static async listDeathRecords(params: Record<string, unknown>): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management',
      { action: 'listDeathRecords', ...params },
      { loading: true, loadingText: '加载记录...' }
    )
  }

  /**
   * 获取死亡统计
   */
  static async getDeathStats(batchId: string): Promise<CloudApiResponse> {
    return this.callFunction(
      'health-management',
      { action: 'getDeathStats', batchId },
      { loading: true, loadingText: '加载统计数据...' }
    )
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
