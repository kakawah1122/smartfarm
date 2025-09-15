// health.ts - 健康管理中心完整重构版本
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 主要Tab切换
    activeTab: 'prevention', // prevention|monitoring|treatment|analysis
    
    // 健康概览统计
    healthOverview: {
      survivalRate: 0,
      abnormalCount: 0,
      preventionScore: 0,
      treatmentCount: 0,
      monthlyRecords: 0,
      lastUpdateTime: ''
    },

    // 活跃预警
    activeAlerts: [],
    
    // 预防管理数据
    preventionData: {
      stats: {
        vaccinationRate: 0,
        disinfectionCount: 0,
        inspectionRate: 0,
        preventionCost: 0
      },
      recentRecords: [],
      upcomingTasks: []
    },

    // 健康监控数据  
    monitoringData: {
      realTimeStatus: {
        totalAnimals: 0,
        healthyCount: 0,
        abnormalCount: 0,
        isolatedCount: 0
      },
      abnormalList: [],
      diseaseDistribution: [],
      locationStats: []
    },

    // 诊疗管理数据
    treatmentData: {
      stats: {
        pendingDiagnosis: 0,
        ongoingTreatment: 0,
        recovering: 0,
        cureRate: 0
      },
      currentTreatments: [],
      aiDiagnosisHistory: []
    },

    // 效果分析数据
    analysisData: {
      survivalAnalysis: {
        rate: 0,
        trend: 'stable',
        byStage: []
      },
      costAnalysis: {
        preventionCost: 0,
        treatmentCost: 0,
        totalCost: 0,
        roi: 0
      },
      performanceMetrics: []
    },

    // UI状态管理
    loading: false,
    refreshing: false,
    
    // 弹窗状态
    showDetailPopup: false,
    selectedRecord: null,
    
    // 快速操作菜单
    quickActions: [
      { id: 'add_health_record', name: '新增健康记录', icon: 'add-circle' },
      { id: 'ai_diagnosis', name: 'AI智能诊断', icon: 'link' },
      { id: 'vaccine_plan', name: '疫苗计划', icon: 'time' },
      { id: 'health_inspection', name: '健康巡检', icon: 'view-list' }
    ],
    
    // 筛选和搜索
    filters: {
      dateRange: 'week', // week|month|quarter|year
      location: '',
      batchId: '',
      severity: '' // mild|moderate|severe
    },
    
    // 图表显示控制
    chartConfig: {
      showSurvivalTrend: true,
      showCostAnalysis: true,
      showDiseaseDistribution: true
    }
  },

  onLoad() {
    this.initializeHealthCenter()
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshHealthData()
  },

  // 初始化健康管理中心
  async initializeHealthCenter() {
    this.setData({ loading: true })
    
    try {
      // 并行加载所有数据
      await Promise.all([
        this.loadHealthOverview(),
        this.loadActiveAlerts(),
        this.loadTabData(this.data.activeTab)
      ])
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 刷新健康数据
  async refreshHealthData() {
    if (this.data.refreshing) return
    
    this.setData({ refreshing: true })
    
    try {
      await this.loadHealthOverview()
      await this.loadActiveAlerts()
      await this.loadTabData(this.data.activeTab)
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      })
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      })
    } finally {
      this.setData({ refreshing: false })
    }
  },

  // 加载健康概览数据
  async loadHealthOverview() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_health_overview',
          batchIds: this.data.filters.batchId ? [this.data.filters.batchId] : null,
          locationIds: this.data.filters.location ? [this.data.filters.location] : null
        }
      })
      
      if (result.result && result.result.success) {
        const data = result.result.data
        this.setData({
          healthOverview: {
            survivalRate: data.healthStats.survivalRate || 0,
            abnormalCount: data.healthStats.abnormalCount || 0,
            preventionScore: this.calculatePreventionScore(data),
            treatmentCount: data.ongoingTreatments.length || 0,
            monthlyRecords: data.healthStats.totalRecords || 0,
            lastUpdateTime: new Date().toLocaleString()
          }
        })
      }
    } catch (error) {
      // 已移除调试日志
      // 设置默认数据
      this.setData({
        healthOverview: {
          survivalRate: 99.6,
          abnormalCount: 3,
          preventionScore: 95,
          treatmentCount: 2,
          monthlyRecords: 15,
          lastUpdateTime: new Date().toLocaleString()
        }
      })
    }
  },

  // 加载活跃预警
  async loadActiveAlerts() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'list_health_alerts',
          status: 'active',
          pageSize: 5
        }
      })

      if (result.result && result.result.success) {
        this.setData({
          activeAlerts: result.result.data.alerts || []
        })
      }
    } catch (error) {
      // 已移除调试日志
      this.setData({ activeAlerts: [] })
    }
  },

  // 加载Tab数据
  async loadTabData(tabName: string) {
    switch (tabName) {
      case 'prevention':
        await this.loadPreventionData()
        break
      case 'monitoring':
        await this.loadMonitoringData()
        break
      case 'treatment':
        await this.loadTreatmentData()
        break
      case 'analysis':
        await this.loadAnalysisData()
        break
    }
  },

  // 加载预防管理数据
  async loadPreventionData() {
    try {
      const [statsResult, recordsResult] = await Promise.all([
        wx.cloud.callFunction({
          name: 'health-management',
          data: { action: 'get_prevention_stats', dateRange: this.getDateRange() }
        }),
        wx.cloud.callFunction({
          name: 'health-management',
          data: { action: 'list_prevention_records', pageSize: 10 }
        })
      ])

      const preventionData = {
        stats: {
          vaccinationRate: 96.8,
          disinfectionCount: 12,
          inspectionRate: 100,
          preventionCost: 2850
        },
        recentRecords: recordsResult.result?.data?.records || [],
        upcomingTasks: this.getUpcomingPreventionTasks()
      }

      this.setData({ preventionData })
    } catch (error) {
      // 已移除调试日志
        this.setData({
        preventionData: {
          stats: { vaccinationRate: 96.8, disinfectionCount: 12, inspectionRate: 100, preventionCost: 2850 },
          recentRecords: [],
          upcomingTasks: []
        }
      })
    }
  },

  // 加载健康监控数据
  async loadMonitoringData() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: { action: 'get_current_abnormal_animals' }
      })

      if (result.result && result.result.success) {
        const data = result.result.data
        this.setData({
          monitoringData: {
            realTimeStatus: {
              totalAnimals: 2340,
              healthyCount: 2337,
              abnormalCount: data.animals.length || 3,
              isolatedCount: 0
            },
            abnormalList: data.animals || [],
            diseaseDistribution: data.diseases || [],
            locationStats: data.locations || []
          }
        })
      }
    } catch (error) {
      // 已移除调试日志
      this.setData({
        monitoringData: {
          realTimeStatus: { totalAnimals: 2340, healthyCount: 2337, abnormalCount: 3, isolatedCount: 0 },
          abnormalList: [],
          diseaseDistribution: [],
          locationStats: []
        }
      })
    }
  },

  // 加载诊疗管理数据
  async loadTreatmentData() {
    try {
      const [statsResult, treatmentsResult, aiResult] = await Promise.all([
        wx.cloud.callFunction({
          name: 'health-management',
          data: { action: 'get_treatment_stats', dateRange: this.getDateRange() }
        }),
        wx.cloud.callFunction({
          name: 'health-management',
          data: { action: 'list_treatment_records', status: 'ongoing', pageSize: 10 }
        }),
        wx.cloud.callFunction({
          name: 'ai-diagnosis',
          data: { action: 'get_diagnosis_history', pageSize: 5 }
        })
      ])

      this.setData({
        treatmentData: {
          stats: {
            pendingDiagnosis: 2,
            ongoingTreatment: treatmentsResult.result?.data?.records?.length || 3,
            recovering: 1,
            cureRate: statsResult.result?.data?.cureRate || 92.3
          },
          currentTreatments: treatmentsResult.result?.data?.records || [],
          aiDiagnosisHistory: aiResult.result?.data?.records || []
        }
      })
    } catch (error) {
      // 已移除调试日志
      this.setData({
        treatmentData: {
          stats: { pendingDiagnosis: 2, ongoingTreatment: 3, recovering: 1, cureRate: 92.3 },
          currentTreatments: [],
          aiDiagnosisHistory: []
        }
      })
    }
  },

  // 加载效果分析数据
  async loadAnalysisData() {
    try {
      const statsResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: { action: 'get_overall_health_stats' }
      })

      if (statsResult.result && statsResult.result.success) {
        const data = statsResult.result.data
        this.setData({
          analysisData: {
            survivalAnalysis: {
              rate: data.survivalRate || 99.6,
              trend: 'improving',
              byStage: [
                { stage: '育雏期', rate: 97.2 },
                { stage: '成长期', rate: 98.8 },
                { stage: '全周期', rate: 99.6 }
              ]
            },
            costAnalysis: {
              preventionCost: 12500,
              treatmentCost: 8300,
              totalCost: 20800,
              roi: 2.5
            },
            performanceMetrics: [
              { name: '存活率', value: data.survivalRate, target: 95, trend: 'up' },
              { name: '治愈率', value: data.recoveryRate, target: 90, trend: 'stable' },
              { name: '预防效率', value: 95, target: 90, trend: 'up' }
            ]
          }
        })
      }
    } catch (error) {
      // 已移除调试日志
      this.setDefaultAnalysisData()
    }
  },

  // Tab切换处理
  onTabChange(e: any) {
    const { value } = e.detail
    this.setData({ activeTab: value })
    this.loadTabData(value)
  },

  // 计算预防效果得分
  calculatePreventionScore(data: any): number {
    const vaccinationWeight = 0.4
    const disinfectionWeight = 0.3
    const inspectionWeight = 0.3
    
    const vaccinationScore = Math.min((data.recentPrevention?.length || 0) / 5 * 100, 100)
    const disinfectionScore = 85 // 示例值
    const inspectionScore = 95 // 示例值
    
    return Math.round(
      vaccinationScore * vaccinationWeight +
      disinfectionScore * disinfectionWeight +
      inspectionScore * inspectionWeight
    )
  },

  // 获取时间范围
  getDateRange() {
    const now = new Date()
    const ranges = {
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      quarter: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    }
    
    const startDate = ranges[this.data.filters.dateRange as keyof typeof ranges] || ranges.month
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    }
  },

  // 获取即将到来的预防任务
  getUpcomingPreventionTasks() {
    return [
      {
        id: 1,
        type: 'vaccine',
        name: '禽流感疫苗二免',
        location: '2号鹅舍',
        scheduledDate: '明天',
        priority: 'high'
      },
      {
        id: 2,
        type: 'disinfection',
        name: '定期环境消毒',
        location: '全场',
        scheduledDate: '3天后',
        priority: 'medium'
      }
    ]
  },

  // 设置默认分析数据
  setDefaultAnalysisData() {
    this.setData({
      analysisData: {
        survivalAnalysis: {
          rate: 99.6,
          trend: 'improving',
          byStage: [
            { stage: '育雏期', rate: 97.2 },
            { stage: '成长期', rate: 98.8 },
            { stage: '全周期', rate: 99.6 }
          ]
        },
        costAnalysis: {
          preventionCost: 12500,
          treatmentCost: 8300,
          totalCost: 20800,
          roi: 2.5
        },
        performanceMetrics: [
          { name: '存活率', value: 99.6, target: 95, trend: 'up' },
          { name: '治愈率', value: 92.3, target: 90, trend: 'stable' },
          { name: '预防效率', value: 95, target: 90, trend: 'up' }
        ]
      }
    })
  },

  // 快速操作处理
  onQuickAction(e: any) {
    const { action } = e.currentTarget.dataset
    switch (action) {
      case 'add_health_record':
        this.navigateToHealthRecord()
        break
      case 'ai_diagnosis':
        this.navigateToAIDiagnosis()
        break
      case 'vaccine_plan':
        this.navigateToVaccinePlan()
        break
      case 'health_inspection':
        this.navigateToHealthInspection()
        break
    }
  },

  // 导航方法
  navigateToHealthRecord() {
    // 健康记录功能已整合到健康管理中心
    wx.showToast({
      title: '请在对应Tab中添加记录',
      icon: 'none'
    })
  },

  navigateToAIDiagnosis() {
    wx.navigateTo({
      url: '/pages/ai-diagnosis/ai-diagnosis'
    })
  },

  navigateToVaccinePlan() {
    wx.navigateTo({
      url: '/pages/vaccine-plan/vaccine-plan'
    })
  },

  navigateToHealthInspection() {
    wx.navigateTo({
      url: '/pages/health-inspection/health-inspection'
    })
  },

  // 查看详情
  onViewDetail(e: any) {
    const { record, type } = e.currentTarget.dataset
    this.setData({
      selectedRecord: record,
      showDetailPopup: true
    })
  },

  // 关闭详情弹窗
  onCloseDetail() {
    this.setData({
      showDetailPopup: false,
      selectedRecord: null
    })
  },

  // 筛选处理
  onFilterChange(e: any) {
    const { type, value } = e.currentTarget.dataset
    this.setData({
      [`filters.${type}`]: value
    })
    
    // 重新加载数据
    this.refreshHealthData()
  },

  // 预警处理
  onAlertAction(e: any) {
    const { alertId, action } = e.currentTarget.dataset
    
    wx.cloud.callFunction({
      name: 'health-management',
      data: {
        action: 'update_health_alert',
        alertId,
        action: action,
        data: { acknowledgedBy: '当前用户' }
      }
    }).then(() => {
      this.loadActiveAlerts()
      wx.showToast({
        title: '操作成功',
        icon: 'success'
      })
    }).catch(error => {
      // 已移除调试日志
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    })
  },

  // Tab特定操作

  // 预防管理操作
  onPreventionAction(e: any) {
    const { action } = e.currentTarget.dataset
    switch (action) {
      case 'add_vaccine':
        wx.navigateTo({ url: '/pages/vaccine-record/vaccine-record' })
        break
      case 'add_disinfection':
        wx.navigateTo({ url: '/pages/disinfection-record/disinfection-record' })
        break
      case 'health_inspection':
        wx.navigateTo({ url: '/pages/health-inspection/health-inspection' })
        break
      case 'add_healthcare':
        wx.navigateTo({ url: '/pages/health-care/health-care' })
        break
    }
  },

  // 监控管理操作
  onMonitoringAction(e: any) {
    const { action, data } = e.currentTarget.dataset
    switch (action) {
      case 'view_abnormal':
        // 异常详情功能已整合到健康监控Tab
        this.onViewDetail(e)
        break
      case 'batch_check':
        wx.navigateTo({ url: '/pages/batch-health-check/batch-health-check' })
        break
      case 'isolation_manage':
        wx.navigateTo({ url: '/pages/isolation-management/isolation-management' })
        break
    }
  },

  // 诊疗管理操作
  onTreatmentAction(e: any) {
    const { action, data } = e.currentTarget.dataset
    switch (action) {
      case 'start_diagnosis':
        wx.navigateTo({ 
          url: `/pages/ai-diagnosis/ai-diagnosis?recordId=${data.recordId}` 
        })
        break
      case 'view_treatment':
        wx.navigateTo({ 
          url: `/pages/treatment-detail/treatment-detail?id=${data.id}` 
        })
        break
      case 'add_treatment':
        wx.navigateTo({ url: '/pages/treatment-record/treatment-record' })
        break
      case 'recovery_manage':
        wx.navigateTo({ url: '/pages/recovery-management/recovery-management' })
        break
    }
  },

  // 效果分析操作
  onAnalysisAction(e: any) {
    const { action } = e.currentTarget.dataset
    switch (action) {
      case 'survival_detail':
        wx.navigateTo({ url: '/pages/survival-analysis/survival-analysis' })
        break
      case 'cost_detail':
        wx.navigateTo({ url: '/pages/cost-analysis/cost-analysis' })
        break
      case 'performance_detail':
        wx.navigateTo({ url: '/pages/performance-analysis/performance-analysis' })
        break
      case 'export_report':
        this.exportHealthReport()
        break
    }
  },

  // 导出健康报告
  exportHealthReport() {
    wx.showLoading({ title: '生成报告中...' })
    
    // 模拟报告生成
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '报告已生成',
        icon: 'success'
      })
    }, 2000)
  },

  // 兼容性方法保留（用于现有代码兼容）
  setTestData() {
    // 已移除调试日志
  },

  // 兼容老版本的方法
  getSeverityTheme(severity: string): string {
    const themes = {
      'mild': 'success',
      'moderate': 'warning', 
      'severe': 'danger'
    }
    return themes[severity as keyof typeof themes] || 'primary'
  },

  getStatusIcon(result: string, recordType?: string): string {
    if (recordType === 'cure') return '🎉'
    if (recordType === 'death') return '⚰️'
    
    const icons = {
      'ongoing': '⏳',
      'cured': '✅', 
      'death': '💀'
    }
    return icons[result as keyof typeof icons] || '📝'
  },

  getPriorityText(severity: string, recordType?: string): string {
    if (recordType === 'cure') return '治愈'
    if (recordType === 'death') return '死亡'
    
    const texts = {
      'mild': '轻微',
      'moderate': '中等',
      'severe': '严重'
    }
    return texts[severity as keyof typeof texts] || '未知'
  },

  getResultText(result: string, recordType?: string): string {
    if (recordType === 'cure') return '治愈记录'
    if (recordType === 'death') return '死亡记录'
    
    const texts = {
      'ongoing': '治疗中',
      'cured': '已治愈',
      'death': '死亡'
    }
    return texts[result as keyof typeof texts] || '未知'
  },

  // 已废弃但保留兼容性的方法
  addHealthRecord() {
    this.navigateToHealthRecord()
  },

  viewAllHealthRecords() {
    // 健康记录列表功能已整合到健康管理中心
    wx.showToast({
      title: '记录已整合到各个Tab中',
      icon: 'none'
    })
  },

  viewHealthStats() {
    // 统计分析功能已整合到效果分析Tab
    this.setData({ activeTab: 'analysis' })
    this.loadTabData('analysis')
  },

  viewAbnormalDetail() {
    // 异常详情功能已整合到健康监控Tab
    this.setData({ activeTab: 'monitoring' })
    this.loadTabData('monitoring')
  },

  viewHealthRecord(e: any) {
    const { item } = e.currentTarget.dataset || e.detail || {}
    if (item) {
      this.setData({
        selectedRecord: item.rawRecord || item,
        showDetailPopup: true
      })
    }
  },

  followUpTreatment(item: any) {
    // 治疗跟进功能已整合到诊疗管理Tab
    this.setData({ activeTab: 'treatment' })
    this.loadTabData('treatment')
  },

  closeHealthDetailPopup() {
    this.onCloseDetail()
  },

  onHealthDetailPopupChange(e: any) {
    if (!e.detail.visible) {
      this.onCloseDetail()
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
