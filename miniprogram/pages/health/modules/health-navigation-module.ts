/**
 * 健康管理页面导航模块
 * 负责处理所有页面跳转逻辑
 * 保持原有功能不变，只是提取和模块化
 */

/// <reference path="../../../../typings/index.d.ts" />

// 导航选项接口（保留用于未来扩展）
// interface NavigationOptions {
//   batchId?: string
//   recordId?: string
//   mode?: 'view' | 'create' | 'edit'
//   alertId?: string
//   events?: unknown
// }

/**
 * 页面导航管理器
 */
export class HealthNavigationManager {
  // 防止重复点击的时间间隔（供外部参考）
  static readonly CLICK_INTERVAL = 500
  
  /**
   * 通用导航方法
   */
  private static navigate(url: string, options?: unknown) {
    wx.navigateTo({
      url,
      ...options
    })
  }
  
  /**
   * 跳转到诊断历史页面
   */
  static navigateToDiagnosisHistory() {
    this.navigate('/packageAI/diagnosis-history/diagnosis-history')
  }
  
  /**
   * 跳转到治疗记录详情页
   */
  static navigateToTreatmentDetail(id: string, events?: unknown) {
    this.navigate(
      `/packageHealth/treatment-record/treatment-record?id=${id}&mode=view`,
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到治疗记录列表页
   */
  static navigateToTreatmentList(events?: unknown) {
    this.navigate(
      '/packageHealth/treatment-records-list/treatment-records-list',
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到预防记录详情页
   */
  static navigateToPreventionRecord(recordId: string) {
    this.navigate(`/packageHealth/vaccine-record/vaccine-record?id=${recordId}`)
  }
  
  /**
   * 创建新的预防记录
   */
  static createPreventionRecord(batchId: string) {
    this.navigate(`/packageHealth/vaccine-record/vaccine-record?batchId=${batchId}&mode=create`)
  }
  
  /**
   * 创建新的治疗记录
   */
  static createTreatmentRecord(batchId: string) {
    this.navigate(`/packageHealth/treatment-record/treatment-record?batchId=${batchId}&mode=create`)
  }
  
  /**
   * 跳转到AI诊断页面
   */
  static navigateToAiDiagnosis(batchId?: string) {
    const url = batchId 
      ? `/packageAI/ai-diagnosis/ai-diagnosis?batchId=${batchId}`
      : '/packageAI/ai-diagnosis/ai-diagnosis'
    this.navigate(url)
  }
  
  /**
   * 跳转到治愈记录列表
   */
  static navigateToCuredList(events?: unknown) {
    this.navigate(
      '/packageHealth/cured-records-list/cured-records-list',
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到死亡记录列表
   */
  static navigateToDeathList(events?: unknown) {
    this.navigate(
      '/packageHealth/death-records-list/death-records-list',
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到异常记录列表
   */
  static navigateToAbnormalList(events?: unknown) {
    this.navigate(
      '/packageHealth/abnormal-records-list/abnormal-records-list',
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到疫苗记录列表
   */
  static navigateToVaccineList(events?: unknown) {
    this.navigate(
      '/packageHealth/vaccine-records-list/vaccine-records-list',
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到用药记录列表
   */
  static navigateToMedicationList(events?: unknown) {
    this.navigate(
      '/packageHealth/medication-records-list/medication-records-list',
      events ? { events } : undefined
    )
  }
  
  /**
   * 根据操作类型进行导航
   */
  static navigateByAction(action: string, batchId: string): boolean {
    switch (action) {
      case 'ai_diagnosis':
        this.navigateToAiDiagnosis(batchId)
        return true
        
      case 'add_treatment':
        this.createTreatmentRecord(batchId)
        return true
        
      case 'add_prevention':
      case 'add_vaccine':
        this.createPreventionRecord(batchId)
        return true
        
      default:
        return false
    }
  }
  
  /**
   * 批量创建导航函数
   * 用于在 Page 对象中快速绑定导航方法
   */
  static createNavigationHandlers() {
    return {
      // 诊断相关
      viewDiagnosisHistory: () => {
        this.navigateToDiagnosisHistory()
      },
      
      onPendingDiagnosisClick: () => {
        this.navigateToAiDiagnosis()
      },
      
      openAiDiagnosis: (batchId: string) => {
        this.navigateToAiDiagnosis(batchId)
      },
      
      // 治疗相关
      viewTreatmentRecord: (id: string, events?: unknown) => {
        this.navigateToTreatmentDetail(id, events)
      },
      
      viewTreatmentList: (events?: unknown) => {
        this.navigateToTreatmentList(events)
      },
      
      createTreatmentRecord: (batchId: string) => {
        this.createTreatmentRecord(batchId)
      },
      
      onTreatingClick: (events?: unknown) => {
        this.navigateToTreatmentList(events)
      },
      
      // 预防相关
      viewPreventionRecord: (recordId: string) => {
        this.navigateToPreventionRecord(recordId)
      },
      
      createPreventionRecord: (batchId: string) => {
        this.createPreventionRecord(batchId)
      },
      
      onVaccineCountClick: (events?: unknown) => {
        this.navigateToVaccineList(events)
      },
      
      onMedicationCountClick: (events?: unknown) => {
        this.navigateToMedicationList(events)
      },
      
      // 记录列表相关
      onCuredClick: (events?: unknown) => {
        this.navigateToCuredList(events)
      },
      
      onDeathClick: (events?: unknown) => {
        this.navigateToDeathList(events)
      },
      
      onAbnormalCountClick: (events?: unknown) => {
        this.navigateToAbnormalList(events)
      },
      
      // 快捷操作
      handleQuickAction: (action: string, batchId: string) => {
        return this.navigateByAction(action, batchId)
      }
    }
  }
}

/**
 * 导出便捷方法
 */
export function setupNavigationHandlers(pageInstance: unknown) {
  const handlers = HealthNavigationManager.createNavigationHandlers()
  
  // 为页面实例添加导航方法
  Object.keys(handlers).forEach(key => {
    if (!pageInstance[key]) {
      pageInstance[key] = handlers[key as keyof typeof handlers]
    }
  })
}
