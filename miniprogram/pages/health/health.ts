// health/health.ts - 健康管理页面（优化版）
import CloudApi from '../../utils/cloud-api'

interface HealthStats {
  totalChecks: number
  healthyCount: number
  sickCount: number
  deadCount: number
  healthyRate: string
  mortalityRate: string
}

interface PreventionStats {
  totalPreventions: number
  vaccineCount: number
  disinfectionCount: number
  totalCost: number
}

interface TreatmentStats {
  totalTreatments: number
  totalCost: number
  recoveredCount: number
  ongoingCount: number
  recoveryRate: string
}

interface PreventionRecord {
  _id: string
  batchId: string
  preventionType: string
  preventionDate: string
  vaccineInfo?: any
  veterinarianInfo?: any
  costInfo?: any
  effectiveness: string
  notes: string
}

interface HealthAlert {
  _id: string
  batchId: string
  alertType: string
  severity: string
  title: string
  description: string
  status: string
  createdAt: string
}

interface PageData {
  // 选项卡状态
  activeTab: string
  
  // 健康数据
  healthStats: HealthStats
  preventionStats: PreventionStats
  treatmentStats: TreatmentStats
  
  // 记录数据
  recentPreventionRecords: PreventionRecord[]
  activeHealthAlerts: HealthAlert[]
  
  // 页面状态
  loading: boolean
  refreshing: boolean
  currentBatchId: string
  
  // 弹窗相关
  showDetailPopup: boolean
  selectedRecord: any
  
  // 各Tab页面数据
  healthOverview: any
  preventionData: any
  monitoringData: any
  treatmentData: any
  analysisData: any
  activeAlerts: any[]
  
  // 时间范围
  dateRange: {
    start: string
    end: string
  }
}

Page<PageData>({
  data: {
    // 选项卡
    activeTab: 'overview', // overview|prevention|monitoring|treatment|analysis
    
    // 健康统计数据
    healthStats: {
      totalChecks: 0,
      healthyCount: 0,
      sickCount: 0,
      deadCount: 0,
      healthyRate: '0%',
      mortalityRate: '0%'
    },
    
    // 预防统计数据
    preventionStats: {
      totalPreventions: 0,
      vaccineCount: 0,
      disinfectionCount: 0,
      totalCost: 0
    },
    
    // 治疗统计数据
    treatmentStats: {
      totalTreatments: 0,
      totalCost: 0,
      recoveredCount: 0,
      ongoingCount: 0,
      recoveryRate: '0%'
    },
    
    // 记录数据
    recentPreventionRecords: [],
    activeHealthAlerts: [],
    
    // 页面状态
    loading: false,
    refreshing: false,
    currentBatchId: '',
    
    // 弹窗相关
    showDetailPopup: false,
    selectedRecord: null,
    
    // 各Tab页面数据
    healthOverview: {
      survivalRate: 0,
      abnormalCount: 0,
      preventionScore: 0
    },
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
    monitoringData: {
      realTimeStatus: {
        healthyCount: 0,
        abnormalCount: 0,
        isolatedCount: 0
      },
      abnormalList: [],
      diseaseDistribution: []
    },
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
    activeAlerts: [],
    
    // 默认显示最近30天的数据
    dateRange: {
      start: '',
      end: ''
    }
  },

  /**
   * 页面加载
   */
  onLoad(options: any) {
    console.log('健康管理页面加载:', options)
    
    this.setData({
      currentBatchId: options.batchId || this.getCurrentBatchId()
    })

    this.initDateRange()
    this.loadHealthData()
  },

  /**
   * 页面显示时刷新数据
   */
  onShow() {
    if (this.data.currentBatchId) {
      this.loadHealthData()
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadHealthData().finally(() => {
      this.setData({ refreshing: false })
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 初始化时间范围（最近30天）
   */
  initDateRange() {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)

    this.setData({
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      }
    })
  },

  /**
   * 获取当前批次ID（从缓存或全局状态）
   */
  getCurrentBatchId(): string {
    // 从本地存储或全局状态获取当前批次ID
    return wx.getStorageSync('currentBatchId') || ''
  },

  /**
   * 切换选项卡
   */
  switchTab(e: any) {
    const { tab } = e.currentTarget.dataset
    console.log('切换选项卡:', tab)
    
    this.setData({ activeTab: tab })
    
    // 根据选项卡加载对应数据
    this.loadTabData(tab)
  },

  /**
   * Tab组件变化事件处理
   */
  onTabChange(e: any) {
    const { value } = e.detail
    console.log('Tab切换到:', value)
    
    this.setData({ activeTab: value })
    
    // 根据选项卡加载对应数据
    this.loadTabData(value)
  },

  /**
   * 加载选项卡数据
   */
  async loadTabData(tab: string) {
    switch (tab) {
      case 'overview':
        await this.loadHealthOverview()
        break
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

  /**
   * 加载健康数据（主入口）
   */
  async loadHealthData() {
    if (!this.data.currentBatchId) {
      wx.showToast({
        title: '请先选择批次',
        icon: 'error'
      })
      return
    }

    this.setData({ loading: true })

    try {
      // 并行加载所有数据
      await Promise.all([
        this.loadHealthOverview(),
        this.loadPreventionData(),
        this.loadTreatmentData()
      ])
    } catch (error: any) {
      console.error('加载健康数据失败:', error)
      wx.showToast({
        title: '加载数据失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 加载健康概览数据
   */
  async loadHealthOverview() {
    try {
      const result = await CloudApi.getHealthOverview(
        this.data.currentBatchId,
        this.data.dateRange
      )

      if (result.success && result.data) {
        const { healthStats, recentPrevention, activeAlerts, treatmentStats } = result.data
        
        this.setData({
          healthStats: {
            ...healthStats,
            healthyRate: healthStats.healthyRate + '%',
            mortalityRate: healthStats.mortalityRate + '%'
          },
          recentPreventionRecords: recentPrevention || [],
          activeHealthAlerts: activeAlerts || [],
          treatmentStats: {
            ...treatmentStats,
            recoveryRate: treatmentStats.recoveryRate + '%'
          }
        })
      }
    } catch (error: any) {
      console.error('加载健康概览失败:', error)
    }
  },

  /**
   * 加载预防管理数据
   */
  async loadPreventionData() {
    try {
      const result = await CloudApi.listPreventionRecords({
        batchId: this.data.currentBatchId,
        pageSize: 20,
        dateRange: this.data.dateRange
      })

      if (result.success && result.data) {
        const records = result.data.records || []
        
        // 计算预防统计
        const preventionStats = this.calculatePreventionStats(records)
        
        this.setData({
          preventionStats,
          recentPreventionRecords: records.slice(0, 10) // 只显示最近10条
        })
      }
    } catch (error: any) {
      console.error('加载预防数据失败:', error)
    }
  },

  /**
   * 加载监控数据
   */
  async loadMonitoringData() {
    // 实现健康监控数据加载
    console.log('加载监控数据')
    // TODO: 实现具体的监控数据加载逻辑
  },

  /**
   * 加载治疗数据
   */
  async loadTreatmentData() {
    // 治疗数据在 loadHealthOverview 中已经加载
    console.log('治疗数据已在概览中加载')
  },

  /**
   * 加载分析数据
   */
  async loadAnalysisData() {
    // 实现健康分析数据加载
    console.log('加载分析数据')
    // TODO: 实现具体的分析数据加载逻辑
  },

  /**
   * 计算预防统计数据
   */
  calculatePreventionStats(records: PreventionRecord[]): PreventionStats {
    const totalPreventions = records.length
    const vaccineCount = records.filter(r => r.preventionType === 'vaccine').length
    const disinfectionCount = records.filter(r => r.preventionType === 'disinfection').length
    const totalCost = records.reduce((sum, r) => sum + (r.costInfo?.totalCost || 0), 0)

    return {
      totalPreventions,
      vaccineCount,
      disinfectionCount,
      totalCost
    }
  },

  /**
   * 查看预防记录详情
   */
  viewPreventionRecord(e: any) {
    const { recordId } = e.currentTarget.dataset
    console.log('查看预防记录:', recordId)
    
    wx.navigateTo({
      url: `/pages/vaccine-record/vaccine-record?id=${recordId}`
    })
  },

  /**
   * 查看健康警报详情
   */
  viewHealthAlert(e: any) {
    const { alertId } = e.currentTarget.dataset
    console.log('查看健康警报:', alertId)
    
    wx.navigateTo({
      url: `/pages/health-care/health-care?alertId=${alertId}`
    })
  },

  /**
   * 创建新的健康记录
   */
  createHealthRecord() {
    wx.navigateTo({
      url: `/pages/health-inspection/health-inspection?batchId=${this.data.currentBatchId}`
    })
  },

  /**
   * 创建新的预防记录
   */
  createPreventionRecord() {
    wx.navigateTo({
      url: `/pages/vaccine-record/vaccine-record?batchId=${this.data.currentBatchId}&mode=create`
    })
  },

  /**
   * 创建新的治疗记录
   */
  createTreatmentRecord() {
    wx.navigateTo({
      url: `/pages/treatment-record/treatment-record?batchId=${this.data.currentBatchId}&mode=create`
    })
  },

  /**
   * AI健康诊断
   */
  openAiDiagnosis() {
    wx.navigateTo({
      url: `/pages/ai-diagnosis/ai-diagnosis?batchId=${this.data.currentBatchId}`
    })
  },

  /**
   * 更改时间范围
   */
  changeDateRange() {
    wx.showActionSheet({
      itemList: ['最近7天', '最近30天', '最近90天', '自定义时间'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.setDateRange(7)
            break
          case 1:
            this.setDateRange(30)
            break
          case 2:
            this.setDateRange(90)
            break
          case 3:
            this.showCustomDatePicker()
            break
        }
      }
    })
  },

  /**
   * 设置时间范围
   */
  setDateRange(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)

    this.setData({
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      }
    })

    this.loadHealthData()
  },

  /**
   * 显示自定义时间选择器
   */
  showCustomDatePicker() {
    // 实现自定义时间选择器
    console.log('显示自定义时间选择器')
    // TODO: 实现自定义时间范围选择逻辑
  },

  /**
   * 获取预防类型显示文本
   */
  getPreventionTypeText(type: string): string {
    const typeMap: { [key: string]: string } = {
      'vaccine': '疫苗接种',
      'disinfection': '消毒防疫',
      'nutrition': '营养补充',
      'inspection': '健康检查'
    }
    return typeMap[type] || type
  },

  /**
   * 获取严重程度颜色
   */
  getSeverityColor(severity: string): string {
    const colorMap: { [key: string]: string } = {
      'low': '#52c41a',
      'medium': '#faad14',
      'high': '#ff4d4f',
      'critical': '#a8071a'
    }
    return colorMap[severity] || '#d9d9d9'
  },

  /**
   * 获取健康状态图标
   */
  getHealthStatusIcon(healthyRate: string): string {
    const rate = parseFloat(healthyRate)
    if (rate >= 95) return '🟢'
    if (rate >= 90) return '🟡'
    if (rate >= 80) return '🟠'
    return '🔴'
  },

  /**
   * 格式化数字显示
   */
  formatNumber(num: number): string {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  },

  /**
   * 格式化金额显示
   */
  formatAmount(amount: number): string {
    return '¥' + amount.toFixed(2)
  },

  /**
   * 返回按钮点击事件
   */
  goBack() {
    wx.navigateBack()
  },

  /**
   * 菜单点击事件
   */
  onMenuTap() {
    wx.showActionSheet({
      itemList: ['导出报告', '数据统计', '设置提醒'],
      success: (res) => {
        console.log('菜单选择:', res.tapIndex)
        // TODO: 实现菜单功能
      }
    })
  },

  /**
   * 预警操作事件
   */
  onAlertAction(e: any) {
    const { alertId, action } = e.currentTarget.dataset
    console.log('预警操作:', { alertId, action })
    // TODO: 实现预警处理逻辑
  },

  /**
   * 预防管理操作事件
   */
  onPreventionAction(e: any) {
    const { action } = e.currentTarget.dataset
    console.log('预防操作:', action)
    
    switch (action) {
      case 'add_vaccine':
        this.createPreventionRecord()
        break
      case 'add_disinfection':
        wx.navigateTo({
          url: `/pages/disinfection-record/disinfection-record?batchId=${this.data.currentBatchId}`
        })
        break
      case 'health_inspection':
        this.createHealthRecord()
        break
      case 'add_healthcare':
        wx.navigateTo({
          url: `/pages/health-care/health-care?batchId=${this.data.currentBatchId}`
        })
        break
    }
  },

  /**
   * 监控操作事件
   */
  onMonitoringAction(e: any) {
    const { action } = e.currentTarget.dataset
    console.log('监控操作:', action)
    
    switch (action) {
      case 'batch_check':
        this.createHealthRecord()
        break
      case 'isolation_manage':
        wx.navigateTo({
          url: `/pages/health-care/health-care?mode=isolation&batchId=${this.data.currentBatchId}`
        })
        break
      case 'view_abnormal':
        const data = e.currentTarget.dataset.data
        this.showDetailPopup(data)
        break
    }
  },

  /**
   * 治疗操作事件
   */
  onTreatmentAction(e: any) {
    const { action } = e.currentTarget.dataset
    console.log('治疗操作:', action)
    
    switch (action) {
      case 'start_diagnosis':
        this.openAiDiagnosis()
        break
      case 'add_treatment':
        this.createTreatmentRecord()
        break
      case 'recovery_manage':
        wx.navigateTo({
          url: `/pages/recovery-management/recovery-management?batchId=${this.data.currentBatchId}`
        })
        break
      case 'view_treatment':
        const data = e.currentTarget.dataset.data
        this.showDetailPopup(data)
        break
    }
  },

  /**
   * 分析操作事件
   */
  onAnalysisAction(e: any) {
    const { action } = e.currentTarget.dataset
    console.log('分析操作:', action)
    
    switch (action) {
      case 'export_report':
        this.exportHealthReport()
        break
    }
  },

  /**
   * 关闭详情弹窗
   */
  onCloseDetail() {
    this.setData({
      showDetailPopup: false,
      selectedRecord: null
    })
  },

  /**
   * 详情弹窗显示状态变化
   */
  onHealthDetailPopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showDetailPopup: false,
        selectedRecord: null
      })
    }
  },

  /**
   * 显示详情弹窗
   */
  showDetailPopup(data: any) {
    this.setData({
      showDetailPopup: true,
      selectedRecord: data
    })
  },

  /**
   * 导出健康报告
   */
  exportHealthReport() {
    wx.showLoading({ title: '生成报告中...' })
    
    // TODO: 实现报告导出逻辑
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '报告已生成',
        icon: 'success'
      })
    }, 2000)
  },

  /**
   * 分享页面
   */
  onShareAppMessage() {
    return {
      title: '养殖管理 - 健康监控',
      path: '/pages/health/health',
      imageUrl: '/assets/share-health.png'
    }
  }
})
