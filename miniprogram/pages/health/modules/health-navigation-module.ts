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
//   events?: any
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
  private static navigate(url: string, options?: any) {
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
  static navigateToTreatmentDetail(id: string, events?: any) {
    this.navigate(
      `/packageHealth/treatment-record/treatment-record?id=${id}&mode=view`,
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到治疗记录列表页
   */
  static navigateToTreatmentList(events?: any) {
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
   * 跳转到健康警报页面
   */
  static navigateToHealthAlert(alertId: string) {
    this.navigate(`/packageHealth/health-care/health-care?alertId=${alertId}`)
  }
  
  /**
   * 创建新的健康检查记录
   */
  static createHealthInspection(batchId: string) {
    this.navigate(`/packageHealth/health-inspection/health-inspection?batchId=${batchId}`)
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
   * 跳转到消毒记录页面
   */
  static navigateToDisinfectionRecord(batchId: string) {
    this.navigate(`/packageHealth/disinfection-record/disinfection-record?batchId=${batchId}`)
  }
  
  /**
   * 跳转到保健记录页面
   */
  static navigateToHealthCare(batchId: string) {
    this.navigate(`/packageHealth/health-care/health-care?batchId=${batchId}`)
  }
  
  /**
   * 跳转到治愈记录列表
   */
  static navigateToCuredList(events?: any) {
    this.navigate(
      '/packageHealth/cured-records-list/cured-records-list',
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到死亡记录列表
   */
  static navigateToDeathList(events?: any) {
    this.navigate(
      '/packageHealth/death-records-list/death-records-list',
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到异常记录列表
   */
  static navigateToAbnormalList(events?: any) {
    this.navigate(
      '/packageHealth/abnormal-records-list/abnormal-records-list',
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到疫苗记录列表
   */
  static navigateToVaccineList(events?: any) {
    this.navigate(
      '/packageHealth/vaccine-records-list/vaccine-records-list',
      events ? { events } : undefined
    )
  }
  
  /**
   * 跳转到用药记录列表
   */
  static navigateToMedicationList(events?: any) {
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
        
      case 'add_disinfection':
        this.navigateToDisinfectionRecord(batchId)
        return true
        
      case 'add_health':
        this.createHealthInspection(batchId)
        return true
        
      case 'add_healthcare':
        this.navigateToHealthCare(batchId)
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
      viewTreatmentRecord: (id: string, events?: any) => {
        this.navigateToTreatmentDetail(id, events)
      },
      
      viewTreatmentList: (events?: any) => {
        this.navigateToTreatmentList(events)
      },
      
      createTreatmentRecord: (batchId: string) => {
        this.createTreatmentRecord(batchId)
      },
      
      onTreatingClick: (events?: any) => {
        this.navigateToTreatmentList(events)
      },
      
      // 预防相关
      viewPreventionRecord: (recordId: string) => {
        this.navigateToPreventionRecord(recordId)
      },
      
      createPreventionRecord: (batchId: string) => {
        this.createPreventionRecord(batchId)
      },
      
      onVaccineCountClick: (events?: any) => {
        this.navigateToVaccineList(events)
      },
      
      onMedicationCountClick: (events?: any) => {
        this.navigateToMedicationList(events)
      },
      
      // 健康检查相关
      createHealthRecord: (batchId: string) => {
        this.createHealthInspection(batchId)
      },
      
      viewHealthAlert: (alertId: string) => {
        this.navigateToHealthAlert(alertId)
      },
      
      // 记录列表相关
      onCuredClick: (events?: any) => {
        this.navigateToCuredList(events)
      },
      
      onDeathClick: (events?: any) => {
        this.navigateToDeathList(events)
      },
      
      onAbnormalCountClick: (events?: any) => {
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
export function setupNavigationHandlers(pageInstance: any) {
  const handlers = HealthNavigationManager.createNavigationHandlers()
  
  // 为页面实例添加导航方法
  Object.keys(handlers).forEach(key => {
    if (!pageInstance[key]) {
      pageInstance[key] = handlers[key as keyof typeof handlers]
    }
  })
}
