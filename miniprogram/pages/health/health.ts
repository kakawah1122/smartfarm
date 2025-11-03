// health/health.ts - 健康管理页面（模块化优化版）
import CloudApi from '../../utils/cloud-api'
import * as HealthStatsCalculator from './modules/health-stats-calculator'
import { createWatcherManager, startDataWatcher as startHealthDataWatcher, stopDataWatcher as stopHealthDataWatcher } from './modules/health-watchers'
import { clearAllHealthCache, clearBatchCache } from './modules/health-data-loader'
import { isVaccineTask, isMedicationTask, isNutritionTask, groupTasksByBatch, calculateCurrentAge } from '../../utils/health-utils'

const ALL_BATCHES_CACHE_KEY = 'health_cache_all_batches_snapshot_v1'
const CACHE_DURATION = 5 * 60 * 1000

function getCachedAllBatchesData() {
  try {
    const cached = wx.getStorageSync(ALL_BATCHES_CACHE_KEY) as { timestamp: number; data: any }
    if (!cached) {
      return null
    }

    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      return null
    }

    return cached.data
  } catch (error) {
    return null
  }
}

function setCachedAllBatchesData(data: any) {
  try {
    wx.setStorageSync(ALL_BATCHES_CACHE_KEY, {
      timestamp: Date.now(),
      data
    })
  } catch (error) {
    // 缓存失败不影响主流程
  }
}

interface HealthStats {
  totalChecks: number
  healthyCount: number
  sickCount: number
  deadCount: number
  healthyRate: string
  mortalityRate: string
  abnormalCount: number
  treatingCount: number
}

interface PreventionStats {
  totalPreventions: number
  vaccineCount: number
  vaccineCoverage: number          // 接种覆盖数（基于第一针）
  vaccineStats: { [key: string]: number }  // 按疫苗名称分类的统计
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
  currentBatchNumber: string
  
  // 批次数据
  showBatchDropdown: boolean
  availableBatches: any[]
  
  // 弹窗相关
  showDetailPopup: boolean
  selectedRecord: any
  showDiagnosisDetailPopup: boolean
  selectedDiagnosisRecord: any
  
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

Page<PageData, any>({
  data: {
    // 选项卡
    activeTab: 'prevention', // prevention|monitoring|treatment|analysis
    
    // 预防管理子标签（与breeding-todo保持一致）
    preventionSubTab: 'today', // today|upcoming|history|stats
    
    // 健康统计数据
    healthStats: {
      totalChecks: 0,
      healthyCount: 0,
      sickCount: 0,
      deadCount: 0,
      healthyRate: '0%',
      mortalityRate: '0%',
      abnormalCount: 0,
      treatingCount: 0
    },
    
    // 预防统计数据
    preventionStats: {
      totalPreventions: 0,
      vaccineCount: 0,
      vaccineCoverage: 0,
      vaccineStats: {},
      disinfectionCount: 0,
      totalCost: 0
    },
    
    // 各批次预防统计列表（全部批次模式使用）
    batchPreventionList: [],
    
    // 即将到来的任务（从breeding-todo迁移）
    upcomingTasks: [] as any[],
    
    // 历史任务（从breeding-todo迁移）
    historyTasks: [] as any[],
    
    // 按批次分组的今日待办任务（从breeding-todo迁移）
    todayTasksByBatch: [] as any[],
    
    // 任务详情弹窗（从breeding-todo迁移）
    selectedTask: null as any,
    showTaskDetailPopup: false,
    
    // 疫苗表单数据（从breeding-todo迁移）
    showVaccineFormPopup: false,
    vaccineFormData: {
      veterinarianName: '',
      veterinarianContact: '',
      vaccineName: '',
      manufacturer: '',
      batchNumber: '',
      dosage: '',
      routeIndex: 0,
      vaccinationCount: 0,
      location: '',
      vaccineCost: '',
      veterinaryCost: '',
      otherCost: '',
      totalCost: 0,
      totalCostFormatted: '¥0.00',
      notes: ''
    },
    vaccineFormErrors: {} as { [key: string]: string },
    vaccineFormErrorList: [] as string[],
    vaccineRouteOptions: ['肌肉注射', '皮下注射', '滴鼻/滴眼', '饮水免疫', '喷雾免疫'],
    
    // 用药管理表单数据（从breeding-todo迁移）
    showMedicationFormPopup: false,
    availableMedicines: [] as any[],
    selectedMedicine: null as any,
    medicationFormData: {
      medicineId: '',
      medicineName: '',
      quantity: 0,
      unit: '',
      dosage: '',
      animalCount: 0,
      notes: '',
      operator: ''
    },
    medicationFormErrors: {} as { [key: string]: string },
    medicationFormErrorList: [] as string[],

    // 营养管理表单数据（从breeding-todo迁移）
    showNutritionFormPopup: false,
    availableNutrition: [] as any[],
    selectedNutrition: null as any,
    nutritionFormData: {
      nutritionId: '',
      nutritionName: '',
      quantity: 0,
      unit: '',
      dosage: '',
      notes: '',
      operator: ''
    },
    nutritionFormErrors: {} as { [key: string]: string },
    nutritionFormErrorList: [] as string[],
    
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
    currentBatchId: 'all', // 默认显示全部批次
    currentBatchNumber: '全部批次',
    
    // 批次数据
    showBatchDropdown: false,
    availableBatches: [],
    dropdownTop: 0,  // 下拉菜单的top位置（px）
    
    // 弹窗相关
    showDetailPopup: false,
    selectedRecord: null,
    showDiagnosisDetailPopup: false,
    selectedDiagnosisRecord: null,
    
    // 各Tab页面数据
    healthOverview: {
      survivalRate: 0,
      abnormalCount: 0,
      preventionScore: 0
    },
    preventionData: {
      todayTasks: [],
      upcomingTasks: [],
      stats: {
        vaccinationRate: 0,
        vaccineCount: 0,
        preventionCost: 0,
        vaccineCoverage: 0
      },
      recentRecords: [],
      taskCompletion: {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0
      }
    },
    
    // 时间线数据
    timelineData: {
      batch: null,
      timeline: [],
      progress: {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        percentage: 0
      }
    },
    
    // 批次对比数据
    comparisonData: {
      batches: [],
      comparison: []
    },
    monitoringData: {
      realTimeStatus: {
        healthyCount: 0,
        abnormalCount: 0
      },
      abnormalList: [],
      diseaseDistribution: []
    },
    treatmentData: {
      stats: {
        pendingDiagnosis: 0,
        ongoingTreatment: 0,
        totalTreatmentCost: 0,
        cureRate: 0,
        ongoingAnimalsCount: 0
      },
      treatmentHistory: [] as any[],
      diagnosisHistory: [] as any[]
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
  
  // Page 实例属性（不在 data 中）
  dataWatchers: null as ReturnType<typeof createWatcherManager> | null,
  loadDataDebounceTimer: null as any,  // ✅ 防抖定时器
  isLoadingData: false,  // ✅ 数据加载标志，防止重复加载
  lastClickTime: 0,  // ✅ 上次点击时间，防止重复点击
  pendingAllBatchesPromise: null as Promise<any> | null,
  latestAllBatchesSnapshot: null as any,
  latestAllBatchesFetchedAt: 0,

  invalidateAllBatchesCache() {
    this.pendingAllBatchesPromise = null
    this.latestAllBatchesSnapshot = null
    this.latestAllBatchesFetchedAt = 0
  },

  /**
   * 页面加载
   */
  async onLoad(options: any) {
    const batchId = options.batchId
    const tab = options.tab
    
    this.dataWatchers = createWatcherManager()
    
    this.initDateRange()
    
    // 处理从首页跳转过来的情况
    if (tab === 'prevention') {
      this.setData({
        activeTab: 'prevention'
      })
    }
    
    // 如果传入了批次ID，使用传入的；否则默认显示全部批次
    if (batchId) {
      this.setData({
        currentBatchId: batchId
      })
    }
    
    // ✅ 后台清理孤儿任务（不阻塞页面加载）
    this.cleanOrphanTasksInBackground()
    
    // 先加载批次列表，然后加载数据
    await this.loadAvailableBatches()
    await this.loadHealthData()
    
    // 默认加载第一个Tab的数据（预防管理Tab需要同时加载监控数据）
    await this.loadTabData(this.data.activeTab)
    
    // ✅ 如果是预防管理标签页，确保加载今日任务
    // 📝 优化：统一使用 loadPreventionData，不再回退到 loadTodayTasks
    if (this.data.activeTab === 'prevention' && this.data.preventionSubTab === 'today') {
      if (!this.data.todayTasksByBatch || this.data.todayTasksByBatch.length === 0) {
        await this.loadPreventionData()
      }
    }
  },

  /**
   * 页面显示时刷新数据并启动实时监听（✅ 优化：增加延迟保护）
   */
  onShow() {
    // ✅ 延迟启动监听器，避免快速切换页面时的竞态条件
    // 使用 wx.nextTick 确保页面完全渲染后再启动
    wx.nextTick(() => {
      // 再延迟一点，确保页面稳定
      setTimeout(() => {
        // 启动实时数据监听（只在页面可见时监听，节省资源）
        this.startDataWatcher()
      }, 100)
    })
    
    // ✅ 只在确实需要刷新时才刷新（避免onLoad后立即重复刷新）
    const needRefresh = wx.getStorageSync('health_page_need_refresh')
    if (needRefresh) {
      wx.removeStorageSync('health_page_need_refresh')
      // ✅ 使用后台刷新，完全不阻塞UI（异步执行）
      this.backgroundRefreshData()
    }
    // ✅ 移除else分支，避免每次onShow都刷新
  },
  
  /**
   * 页面隐藏时停止监听（✅ 优化：立即停止）
   */
  onHide() {
    // ✅ 立即停止监听器，不延迟
    this.stopDataWatcher()
  },
  
  /**
   * 页面卸载时停止监听（✅ 优化：立即停止）
   */
  onUnload() {
    // ✅ 立即停止监听器，不延迟
    this.stopDataWatcher()
  },
  
  /**
   * 启动数据监听（✅ 优化：智能缓存清除 + 静默刷新）
   */
  startDataWatcher() {
    if (!this.dataWatchers) {
      this.dataWatchers = createWatcherManager()
    }
    
    this.dataWatchers = startHealthDataWatcher(this.dataWatchers, {
      includeTreatmentWatcher: true,
      onBeforeChange: () => {
        // ✅ 优化：只清除当前批次的缓存，而不是全部缓存
        if (this.data.currentBatchId === 'all') {
          this.invalidateAllBatchesCache()
        } else {
          clearBatchCache(this.data.currentBatchId)
        }
      },
      onDataChange: () => {
        // ✅ 优化：使用静默刷新，不阻塞UI
        this.loadHealthData(true, true)
      }
    })
  },
  
  /**
   * 停止数据监听
   */
  stopDataWatcher() {
    if (this.dataWatchers) {
      stopHealthDataWatcher(this.dataWatchers)
      // 保持 WatcherManager 实例，只是将其标记为非活跃状态
      // 不需要重新创建，startDataWatcher 会处理状态重置
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    // ✅ 清除缓存，强制重新加载
    clearAllHealthCache()
    this.invalidateAllBatchesCache()
    
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
    // 已移除调试日志
    this.setData({ activeTab: tab })
    
    // 根据选项卡加载对应数据
    this.loadTabData(tab)
  },

  /**
   * Tab组件变化事件处理
   */
  onTabChange(e: any) {
    const { value } = e.detail
    // 已移除调试日志
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
        // 合并了健康监控，需要同时加载预防和监控数据
        await Promise.all([
          this.loadPreventionData(),
          this.loadMonitoringData()
        ])
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
   * 加载健康数据（主入口 - 带防抖和防重复机制）
   * @param silent 静默刷新（不显示loading，避免阻塞UI交互）
   * @param debounce 是否使用防抖（默认true）
   */
  async loadHealthData(silent: boolean = false, debounce: boolean = true) {
    // ✅ 防抖机制：避免短时间内多次触发
    if (debounce) {
      if (this.loadDataDebounceTimer) {
        clearTimeout(this.loadDataDebounceTimer)
      }
      
      this.loadDataDebounceTimer = setTimeout(() => {
        this.loadHealthData(silent, false)  // 递归调用，但关闭防抖
      }, 100) as any  // ✅ 优化：100ms防抖，用户感知更快
      return
    }
    
    // ✅ 防重复加载：如果正在加载中，直接返回
    if (this.isLoadingData) {
      return
    }
    
    this.isLoadingData = true
    
    // ✅ 如果是静默刷新，不设置loading状态，避免阻塞UI
    if (!silent) {
      this.setData({ loading: true })
    }

    try {
      // 如果是全部批次模式，加载汇总数据
      if (this.data.currentBatchId === 'all') {
        await this.loadAllBatchesData()
      } else {
        // ✅ 优化：单个批次模式，使用批量API一次性获取所有数据
        await this.loadSingleBatchDataOptimized()
      }
    } catch (error: any) {
      // 已移除调试日志
      if (!silent) {
        wx.showToast({
          title: '加载数据失败',
          icon: 'error'
        })
      }
    } finally {
      if (!silent) {
        this.setData({ loading: false })
      }
      this.isLoadingData = false  // ✅ 重置加载标志
    }
  },

  /**
   * 核心辅助方法：获取所有批次的健康数据（✅优化：批量API + 并行查询）
   * @private
   */
  async _fetchAllBatchesHealthData(options: boolean | { useCache?: boolean; forceRefresh?: boolean } = { useCache: true, forceRefresh: false }) {
    const normalizedOptions = typeof options === 'boolean'
      ? { useCache: options }
      : (options || {})
    const useCache = normalizedOptions.useCache !== undefined ? normalizedOptions.useCache : true
    const forceRefresh = normalizedOptions.forceRefresh ?? false

    const now = Date.now()

    if (!forceRefresh && this.pendingAllBatchesPromise) {
      return this.pendingAllBatchesPromise
    }

    if (!forceRefresh && useCache) {
      const isMemoryValid = this.latestAllBatchesSnapshot && (now - this.latestAllBatchesFetchedAt) < CACHE_DURATION
      if (isMemoryValid) {
        return this.latestAllBatchesSnapshot
      }

      const cached = getCachedAllBatchesData()
      if (cached) {
        this.latestAllBatchesSnapshot = cached
        this.latestAllBatchesFetchedAt = now
        return cached
      }
    }

    const fetchPromise = (async () => {
      const snapshotResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_dashboard_snapshot',
          batchId: 'all',
          includeDiagnosis: true,
          diagnosisLimit: 10,
        includeAbnormalRecords: true,
        abnormalLimit: 50
        }
      })

      if (!snapshotResult.result || !snapshotResult.result.success) {
        throw new Error('获取健康面板数据失败')
      }

      const rawData = snapshotResult.result.data || {}

      const normalized = {
        batches: rawData.batches || [],
        totalBatches: rawData.totalBatches ?? ((rawData.batches || []).length),
        totalAnimals: Number(rawData.totalAnimals ?? 0) || 0,
        deadCount: Number(rawData.deadCount ?? 0) || 0,
        sickCount: Number(rawData.sickCount ?? 0) || 0,
        actualHealthyCount: Number(rawData.actualHealthyCount ?? 0) || 0,
        healthyRate: rawData.healthyRate || '0',
        mortalityRate: rawData.mortalityRate || '0',
        abnormalCount: Number(rawData.abnormalCount ?? 0) || 0,
        abnormalRecordCount: Number(rawData.abnormalRecordCount ?? 0) || 0,
        abnormalRecords: rawData.abnormalRecords || [],
        totalOngoing: Number(rawData.totalOngoing ?? 0) || 0,
        totalOngoingRecords: Number(rawData.totalOngoingRecords ?? 0) || 0,
        totalTreatmentCost: Number(rawData.totalTreatmentCost ?? 0) || 0,
        totalTreated: Number(rawData.totalTreated ?? 0) || 0,
        totalCured: Number(rawData.totalCured ?? 0) || 0,
      totalDiedAnimals: Number(rawData.totalDiedAnimals ?? 0) || 0,
      totalDied: Number(rawData.totalDied ?? rawData.totalDiedAnimals ?? 0) || 0,
        cureRate: rawData.cureRate || '0',
        pendingDiagnosis: Number(rawData.pendingDiagnosis ?? 0) || 0,
        latestDiagnosisRecords: rawData.latestDiagnosisRecords || [],
        fetchedAt: Date.now()
      }

      setCachedAllBatchesData(normalized)
      this.latestAllBatchesSnapshot = normalized
      this.latestAllBatchesFetchedAt = normalized.fetchedAt

      return normalized
    })()

    if (!forceRefresh) {
      this.pendingAllBatchesPromise = fetchPromise
    }

    try {
      return await fetchPromise
    } finally {
      if (!forceRefresh) {
        this.pendingAllBatchesPromise = null
      }
    }
  },

  /**
   * 加载所有批次的汇总数据（✅优化：使用公共方法 + 批量API）
   */
  async loadAllBatchesData() {
    try {
      const healthData = await this._fetchAllBatchesHealthData()

      const batchesWithPrevention = healthData.batches.map((batch: any) => ({
        ...batch,
        preventionStats: {
          totalPreventions: 0,
          vaccineCount: 0,
          vaccineCoverage: 0,
          vaccineStats: {},
          disinfectionCount: 0,
          totalCost: 0
        },
        vaccinationRate: '0',
        recentRecords: []
      }))

      const preventionStats = {
        totalPreventions: 0,
        vaccineCount: 0,
        vaccineCoverage: 0,
        vaccineStats: {},
        disinfectionCount: 0,
        totalCost: 0
      }

      const vaccinationRate = healthData.totalAnimals > 0
        ? ((preventionStats.vaccineCoverage / healthData.totalAnimals) * 100).toFixed(1)
        : 0

      this.setData({
        healthStats: {
          totalChecks: healthData.totalAnimals,
          healthyCount: healthData.actualHealthyCount,
          sickCount: healthData.sickCount,
          deadCount: healthData.deadCount,
          healthyRate: healthData.healthyRate + '%',
          mortalityRate: healthData.mortalityRate + '%',
          abnormalCount: healthData.abnormalRecordCount,
          treatingCount: healthData.totalOngoingRecords
        },
        preventionStats,
        'preventionData.stats': {
          vaccinationRate,
          preventionCost: preventionStats.totalCost
        },
        'preventionData.recentRecords': [],
        recentPreventionRecords: [],
        batchPreventionList: batchesWithPrevention,
        activeHealthAlerts: [],
        'treatmentStats.totalTreatments': healthData.totalTreated,
        'treatmentStats.totalCost': healthData.totalTreatmentCost,
        'treatmentStats.recoveredCount': healthData.totalCured,
        'treatmentStats.ongoingCount': healthData.totalOngoingRecords,
        'treatmentStats.recoveryRate': healthData.cureRate + '%',
        'treatmentData.stats.pendingDiagnosis': healthData.pendingDiagnosis,
        'treatmentData.stats.ongoingTreatment': healthData.totalOngoing,
        'treatmentData.stats.totalTreatmentCost': healthData.totalTreatmentCost,
        'treatmentData.stats.cureRate': parseFloat(healthData.cureRate),
        'treatmentData.stats.ongoingAnimalsCount': healthData.totalOngoing,
        'treatmentData.diagnosisHistory': healthData.latestDiagnosisRecords,
        'monitoringData.realTimeStatus.abnormalCount': healthData.abnormalRecordCount,
        'monitoringData.abnormalList': healthData.abnormalRecords || []
      })
    } catch (error: any) {
      wx.showToast({
        title: '批次数据加载失败',
        icon: 'error'
      })
    }
  },
  
  /**
   * 完全后台刷新数据（不使用加载锁，不阻塞任何操作）
   */
  backgroundRefreshData() {
    // ✅ 先清理缓存
    clearAllHealthCache()
    this.invalidateAllBatchesCache()
    
    // ✅ 使用 wx.nextTick 确保在下一个渲染周期执行，完全不阻塞当前交互
    wx.nextTick(() => {
      // 再延迟一点，确保页面完全渲染完成，用户可以立即交互
      setTimeout(() => {
        this._performBackgroundRefresh()
      }, 50)
    })
  },
  
  /**
   * 执行后台刷新（核心逻辑）
   */
  async _performBackgroundRefresh() {
    try {
      // ✅ 显示顶部加载提示，不阻塞UI
      wx.showNavigationBarLoading()
      
      if (this.data.currentBatchId === 'all') {
        // 全部批次模式：快速刷新关键数据
        await this._backgroundRefreshAllBatches()
      } else {
        // 单个批次模式：并行加载
        await Promise.all([
          this.loadHealthOverview(),
          this.loadPreventionData(),
          this.loadTreatmentData()
        ])
      }
      
      // ✅ 隐藏加载提示
      wx.hideNavigationBarLoading()
    } catch (error: any) {
      // 后台刷新失败，静默处理
      wx.hideNavigationBarLoading()
    }
  },
  
  /**
   * 后台刷新所有批次（✅优化：使用公共方法 + 差异对比）
   */
  async _backgroundRefreshAllBatches() {
    try {
      // ✅ 使用公共方法获取最新数据（自动使用批量API）
      const healthData = await this._fetchAllBatchesHealthData({ useCache: false, forceRefresh: true })
      
      // ✅ 差异对比：只在数据有显著变化时更新（避免不必要的重绘）
      const currentHealthyRate = parseFloat(this.data.healthStats.healthyRate)
      const newHealthyRate = parseFloat(healthData.healthyRate)
      
      if (Math.abs(currentHealthyRate - newHealthyRate) < 0.01) {
        // 健康率变化小于0.01%，跳过更新
        return
      }
      
      // 静默更新数据（不影响用户操作）
      this.setData({
        'healthStats.totalChecks': healthData.totalAnimals,
        'healthStats.healthyCount': healthData.actualHealthyCount,
        'healthStats.sickCount': healthData.sickCount,
        'healthStats.deadCount': healthData.deadCount,
        'healthStats.healthyRate': healthData.healthyRate + '%',
        'healthStats.mortalityRate': healthData.mortalityRate + '%',
        'healthStats.abnormalCount': healthData.abnormalRecordCount,
        'healthStats.treatingCount': healthData.totalOngoingRecords,
        'treatmentStats.totalTreatments': healthData.totalTreated,
        'treatmentStats.totalCost': healthData.totalTreatmentCost,
        'treatmentStats.recoveredCount': healthData.totalCured,
        'treatmentStats.ongoingCount': healthData.totalOngoingRecords,
        'treatmentStats.recoveryRate': healthData.cureRate + '%',
        'treatmentData.stats.pendingDiagnosis': healthData.pendingDiagnosis || 0,
        'treatmentData.stats.ongoingTreatment': healthData.totalOngoing,
        'treatmentData.stats.totalTreatmentCost': healthData.totalTreatmentCost,
        'treatmentData.stats.cureRate': parseFloat(healthData.cureRate || '0'),
        'treatmentData.stats.ongoingAnimalsCount': healthData.totalOngoing,
        'treatmentData.diagnosisHistory': healthData.latestDiagnosisRecords || [],
        'monitoringData.realTimeStatus.abnormalCount': healthData.abnormalRecordCount,
        'monitoringData.abnormalList': healthData.abnormalRecords || []
      })
    } catch (error: any) {
      // 后台刷新失败时静默处理
    }
  },
  /**
   * ✅ 优化：加载单个批次数据（使用批量API）
   * 从原来的6次云函数调用减少到1次
   */
  async loadSingleBatchDataOptimized() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_batch_complete_data',
          batchId: this.data.currentBatchId,
          includes: ['prevention', 'treatment', 'diagnosis', 'abnormal', 'pending_diagnosis'],
          diagnosisLimit: 10,
          preventionLimit: 20
        }
      })
      
      if (!result.result || !result.result.success) {
        throw new Error('获取批次数据失败')
      }
      
      const data = result.result.data
      
      // 处理健康统计
      const healthStats = data.healthStats || {}
      
      // 处理预防统计
      const preventionStats = data.preventionStats || {
        totalPreventions: 0,
        vaccineCount: 0,
        vaccineCoverage: 0,
        vaccineStats: {},
        disinfectionCount: 0,
        totalCost: 0
      }
      
      // 计算疫苗接种率
      const totalAnimals = healthStats.totalChecks || 1
      let vaccinationRate = totalAnimals > 0 
        ? ((preventionStats.vaccineCoverage / totalAnimals) * 100)
        : 0
      
      if (vaccinationRate > 100) {
        vaccinationRate = 100
      }
      
      // 处理治疗统计
      const treatmentStats = data.treatmentStats || {
        ongoingCount: 0,
        ongoingAnimalsCount: 0,
        totalCost: 0,
        totalTreated: 0,
        totalCuredAnimals: 0,
        cureRate: '0'
      }
      
      // 处理预防记录
      const preventionRecords = (data.preventionRecords || []).map((record: any) => 
        HealthStatsCalculator.formatPreventionRecord(record)
      )
      
      // 处理诊断历史
      const diagnosisHistory = data.diagnosisHistory || []
      
      // 处理异常记录
      const abnormalRecords = data.abnormalRecords || []
      const abnormalCount = data.abnormalCount || 0
      
      // 待诊断数量
      const pendingDiagnosisCount = data.pendingDiagnosisCount || 0
      
      // ✅ 一次性更新所有数据（避免多次setData）
      this.setData({
        // 健康统计
        healthStats: {
          totalChecks: healthStats.totalChecks || 0,
          healthyCount: healthStats.healthyCount || 0,
          sickCount: healthStats.sickCount || 0,
          deadCount: healthStats.deadCount || 0,
          healthyRate: (healthStats.healthyRate || 0) + '%',
          mortalityRate: (healthStats.mortalityRate || 0) + '%',
          abnormalCount: abnormalCount,
          treatingCount: treatmentStats.ongoingCount || 0
        },
        
        // 预防数据
        preventionStats,
        recentPreventionRecords: preventionRecords.slice(0, 10),
        'preventionData.stats': {
          vaccinationRate: vaccinationRate.toFixed(1),
          preventionCost: preventionStats.totalCost
        },
        'preventionData.recentRecords': preventionRecords.slice(0, 10),
        
        // 治疗数据
        'treatmentData.stats': {
          pendingDiagnosis: pendingDiagnosisCount,
          ongoingTreatment: treatmentStats.ongoingCount || 0,
          totalTreatmentCost: parseFloat((treatmentStats.totalCost || 0).toString()),
          cureRate: parseFloat((treatmentStats.cureRate || '0').toString()),
          ongoingAnimalsCount: treatmentStats.ongoingAnimalsCount || 0
        },
        'treatmentData.diagnosisHistory': diagnosisHistory,
        'treatmentStats.totalTreatments': treatmentStats.totalTreated || 0,
        'treatmentStats.totalCost': parseFloat((treatmentStats.totalCost || 0).toString()),
        'treatmentStats.recoveredCount': treatmentStats.totalCuredAnimals || 0,
        'treatmentStats.ongoingCount': treatmentStats.ongoingCount || 0,
        'treatmentStats.recoveryRate': (treatmentStats.cureRate || 0) + '%',
        
        // 监控数据
        'monitoringData.realTimeStatus.abnormalCount': abnormalCount,
        'monitoringData.abnormalList': abnormalRecords
      })
      
    } catch (error: any) {
      console.error('加载批次数据失败:', error)
      wx.showToast({
        title: '加载数据失败',
        icon: 'error'
      })
    }
  },
  
  /**
   * 加载健康概览数据（旧版，保留用于兼容性）
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
            mortalityRate: healthStats.mortalityRate + '%',
            abnormalCount: healthStats.abnormalCount || 0,
            treatingCount: healthStats.treatingCount || 0
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
      // 已移除调试日志
    }
  },

  /**
   * 加载预防管理数据（使用新的仪表盘API）
   * 📝 优化：统一数据源，添加重试机制（使用循环而非递归）
   */
  async loadPreventionData() {
    const MAX_RETRIES = 2
    let lastError: any = null
    
    // ✅ 使用循环实现重试，避免递归调用导致的作用域问题
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 调用新的预防管理仪表盘云函数
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'getPreventionDashboard',
          batchId: this.data.currentBatchId || 'all'
        }
      })

      const response = result.result as any

        // 🔍 详细错误日志
        if (!response.success) {
          lastError = response
          console.error('[loadPreventionData] 云函数返回失败:', {
            errorCode: response?.errorCode,
            message: response?.message,
            error: response?.error
          })
          
          // ✅ 重试机制：非权限错误时自动重试（最多2次）
          if (attempt < MAX_RETRIES && response?.errorCode !== 'PERMISSION_DENIED') {
            const delay = (attempt + 1) * 1000 // 递增延迟：1s, 2s
            await new Promise(resolve => setTimeout(resolve, delay))
            continue // 继续下一次循环
          } else {
            // 达到最大重试次数或权限错误，跳出循环
            break
          }
        }
        
        // ✅ 成功获取数据，处理并返回
      if (response.success && response.data) {
        const dashboardData = response.data
        const todayTasks = dashboardData.todayTasks || []
        const todayTasksByBatch = groupTasksByBatch(todayTasks)
        
        // 更新页面数据（合并两次setData为一次）
        this.setData({
          'preventionData.todayTasks': todayTasks,
          'preventionData.upcomingTasks': dashboardData.upcomingTasks || [],
          'preventionData.stats': dashboardData.stats || {
            vaccinationRate: 0,
            vaccineCount: 0,
            preventionCost: 0,
            vaccineCoverage: 0
          },
          'preventionData.recentRecords': dashboardData.recentRecords || [],
          'preventionData.taskCompletion': dashboardData.taskCompletion || {
            total: 0,
            completed: 0,
            pending: 0,
            overdue: 0
          },
          todayTasksByBatch,
          preventionStats: {
            vaccineCount: dashboardData.stats?.vaccineCount || 0,
            vaccineCoverage: dashboardData.stats?.vaccineCoverage || 0,
            totalCost: dashboardData.stats?.preventionCost || 0
          }
        })
      
      // 后台清理孤儿任务
      if (this.data.preventionSubTab === 'today') {
        this.cleanOrphanTasksInBackground()
      }
          
          // ✅ 成功处理，退出循环
          return
        }
        
        // 如果执行到这里，说明响应失败或没有数据
        // 会继续循环进行重试，或者跳出循环设置默认值
        
    } catch (error: any) {
        // 捕获网络错误或其他异常
        lastError = error
      console.error('[loadPreventionData] 加载预防管理数据失败:', error)
        
        // 如果不是最后一次尝试，继续重试
        if (attempt < MAX_RETRIES) {
          const delay = (attempt + 1) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
    }
    
    // ✅ 所有重试都失败，设置默认值并显示详细错误
    // 显示详细错误信息
    const errorMsg = lastError?.message || lastError?.error || '未知错误'
    const errorCode = lastError?.errorCode || 'UNKNOWN'
    wx.showToast({
      title: `加载失败: ${errorCode}`,
      icon: 'none',
      duration: 3000
    })
    
    // 如果是权限错误，给出明确提示
    if (errorCode === 'PERMISSION_DENIED') {
      setTimeout(() => {
        wx.showModal({
          title: '权限不足',
          content: '您没有查看健康管理数据的权限，请联系管理员',
          showCancel: false
        })
      }, 500)
    }
    
      this.setData({
        'preventionData.todayTasks': [],
        'preventionData.upcomingTasks': [],
      'preventionData.stats': {
        vaccinationRate: 0,
        vaccineCount: 0,
        preventionCost: 0,
        vaccineCoverage: 0
      },
      'preventionData.recentRecords': [],
      'preventionData.taskCompletion': {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0
      },
      todayTasksByBatch: [],
      preventionStats: {
        vaccineCount: 0,
        vaccineCoverage: 0,
        totalCost: 0
      }
      })
  },

  /**
   * 加载今日待办任务（统一入口）
   */
  async loadTodayTasks() {
    if (this.data.currentBatchId === 'all') {
      await this.loadAllBatchesTodayTasks()
    } else {
      await this.loadSingleBatchTodayTasks()
    }
  },

  /**
   * 分组历史任务（按批次和日龄组合分组）
   */
  groupHistoryTasksByBatch(tasks: any[] = []) {
    const batchMap: Record<string, any> = {}
    
    tasks.forEach((task: any) => {
      const batchKey = task.batchNumber || task.batchId || 'unknown'
      const taskDayAge = task.dayAge || 0
      // 使用批次号和日龄组合作为唯一键
      const groupKey = `${batchKey}_${taskDayAge}`
      
      if (!batchMap[groupKey]) {
        batchMap[groupKey] = {
          batchId: task.batchId || batchKey,
          batchNumber: task.batchNumber || batchKey,
          dayAge: taskDayAge,
          tasks: []
        }
      }
      
      batchMap[groupKey].tasks.push(task)
    })
    
    return Object.values(batchMap).sort((a, b) => {
      // 先按批次号排序
      const batchCompare = (a.batchNumber || '').localeCompare(b.batchNumber || '')
      if (batchCompare !== 0) return batchCompare
      // 再按日龄倒序排序
      return b.dayAge - a.dayAge
    })
  },

  /**
   * 在后台清理孤儿任务（不阻塞UI）
   */
  cleanOrphanTasksInBackground() {
    wx.cloud.callFunction({
      name: 'breeding-todo',
      data: {
        action: 'cleanOrphanTasks'
      }
    }).then((result: any) => {
      const response = result.result as any
      // 后台清理孤儿任务，不显示日志
      if (response.success && response.data && response.data.deletedCount > 0) {
        // 静默清理完成
      }
    }).catch((error: any) => {
      console.error('清理孤儿任务失败:', error)
    })
  },

  /**
   * 加载监控数据（实时健康状态已整合到顶部）
   */
  async loadMonitoringData() {
    try {
      // 如果没有实时状态数据，使用健康统计数据填充
      const currentData = this.data.monitoringData?.realTimeStatus || {}
      
      // 如果当前批次不是全部批次，且监控数据为空，使用健康统计数据填充
      if (this.data.currentBatchId !== 'all' && 
          (!currentData.healthyCount && !currentData.abnormalCount)) {
        this.setData({
          'monitoringData.realTimeStatus': {
            healthyCount: this.data.healthStats.healthyCount || 0,
            abnormalCount: this.data.healthStats.abnormalCount || 0
          },
          'monitoringData.abnormalList': [],
          'monitoringData.diseaseDistribution': []
        })
      }
    } catch (error: any) {
      // 加载失败，静默处理
    }
  },

  /**
   * 加载治疗数据
   */
  async loadTreatmentData(options: {
    aggregated?: {
      totalCost: number
      totalTreated: number
      totalCured: number
      ongoingCount: number
      ongoingAnimalsCount: number
      cureRate: string
    }
  } = {}) {
    const aggregatedStats = options.aggregated
    try {
      if (this.data.currentBatchId === 'all') {
        const aggregatedData = aggregatedStats || await this._fetchAllBatchesHealthData()

        this.setData({
          'treatmentData.stats': {
            pendingDiagnosis: aggregatedData.pendingDiagnosis || 0,
            ongoingTreatment: aggregatedData.totalOngoing || 0,
            totalTreatmentCost: aggregatedData.totalTreatmentCost || 0,
            cureRate: parseFloat((aggregatedData.cureRate || '0').toString()),
            ongoingAnimalsCount: aggregatedData.totalOngoing || 0
          },
          'treatmentStats.totalTreatments': aggregatedData.totalTreated || 0,
          'treatmentStats.totalCost': aggregatedData.totalTreatmentCost || 0,
          'treatmentStats.recoveredCount': aggregatedData.totalCured || 0,
          'treatmentStats.ongoingCount': aggregatedData.totalOngoingRecords || 0,
          'treatmentStats.recoveryRate': (aggregatedData.cureRate || 0) + '%',
          'treatmentData.diagnosisHistory': aggregatedData.latestDiagnosisRecords || [],
          'monitoringData.realTimeStatus.abnormalCount': aggregatedData.abnormalRecordCount || 0,
          'monitoringData.abnormalList': aggregatedData.abnormalRecords || []
        })

        return
      }

      // ✅ 启用云函数调用，获取真实治疗统计数据
      
      // 1. 统计待处理的AI诊断记录（还没有创建治疗方案的）
      const pendingDiagnosisResult = await wx.cloud.callFunction({
        name: 'ai-diagnosis',
        data: {
          action: 'get_diagnosis_history',
          batchId: this.data.currentBatchId === 'all' ? undefined : this.data.currentBatchId,
          page: 1,
          pageSize: 1000  // 获取所有记录用于统计
        }
      })
      
      // ✅ 统计没有治疗方案的诊断记录数量
      const allDiagnosis = pendingDiagnosisResult.result?.success 
        ? (pendingDiagnosisResult.result.data?.records || [])
        : []
      const pendingDiagnosisCount = allDiagnosis.filter((d: any) => !d.hasTreatment).length
      
      // 2. 计算治疗总成本和治愈率
      let costData: any = null
      if (!aggregatedStats) {
        const costResult = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: 'calculate_treatment_cost',
            batchId: this.data.currentBatchId,
            dateRange: this.data.dateRange
          }
        })
        costData = costResult.result?.success
          ? costResult.result.data
          : {}
      } else {
        costData = {
          totalCost: aggregatedStats.totalCost,
          totalTreated: aggregatedStats.totalTreated,
          totalCuredAnimals: aggregatedStats.totalCured,
          ongoingCount: aggregatedStats.ongoingCount,
          ongoingAnimalsCount: aggregatedStats.ongoingAnimalsCount,
          cureRate: aggregatedStats.cureRate
        }
      }
      
      // 3. 获取异常记录（仅用于列表显示，不用于统计）
      const abnormalResult = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_abnormal_records',
          batchId: this.data.currentBatchId
        }
      })
      
      // 处理异常记录数据
      const abnormalRecords = abnormalResult.result?.success 
        ? (abnormalResult.result.data || [])
        : []
      
      // 处理成本和统计数据
      // 3. 获取历史诊断记录（✅ 始终限制为近7天）
      
      // ✅ 修复：使用 ai-diagnosis 云函数，与 diagnosis-history 页面保持一致
      // 🔍 临时测试：先不使用日期筛选，看看能否查询到记录
      const diagnosisResult = await wx.cloud.callFunction({
        name: 'ai-diagnosis',  // ✅ 改为 ai-diagnosis
        data: {
          action: 'get_diagnosis_history',
          batchId: this.data.currentBatchId === 'all' ? undefined : this.data.currentBatchId,  // ✅ undefined 而不是 'all'
          // 🔍 暂时注释掉日期筛选
          // dateRange: {
          //   start: sevenDaysAgoStr,
          //   end: today + 'T23:59:59'
          // },
          page: 1,
          pageSize: 10  // ✅ 只取最近10条
        }
      })
      
      // ✅ 直接使用返回的数据，并过滤图片数组中的 null 值
      const diagnosisHistory = diagnosisResult.result?.success 
        ? (diagnosisResult.result.data?.records || []).map((record: any) => ({
            ...record,
            // ✅ 过滤掉图片数组中的 null 值
            images: (record.images || []).filter((img: any) => img && typeof img === 'string')
          }))
        : []
      
      // 更新治疗数据和异常数据
      this.setData({
        'treatmentData.stats': {
          pendingDiagnosis: pendingDiagnosisCount,  // ✅ 使用AI诊断记录统计
          ongoingTreatment: costData.ongoingCount || 0,
          totalTreatmentCost: parseFloat((costData.totalCost ?? 0).toString()),
          cureRate: parseFloat((costData.cureRate ?? '0').toString()),  // ✅ 显示真实治愈率
          ongoingAnimalsCount: costData.ongoingAnimalsCount || 0  // ✅ 存储治疗中动物数量
        },
        // ✅ 同时更新卡片显示的治疗统计数据
        'treatmentStats.totalTreatments': costData.totalTreated || 0,
        'treatmentStats.totalCost': parseFloat((costData.totalCost ?? 0).toString()),
        'treatmentStats.recoveredCount': costData.totalCuredAnimals || 0,  // ✅ 关键修复
        'treatmentStats.ongoingCount': costData.ongoingCount || 0,
        'treatmentStats.recoveryRate': (costData.cureRate || 0) + '%',
        'treatmentData.diagnosisHistory': diagnosisHistory,
        // ✅ 更新待处理记录数（传统异常记录）
        'monitoringData.realTimeStatus.abnormalCount': abnormalRecords.length,
        'monitoringData.abnormalList': abnormalRecords
      })
      
  } catch (error: any) {
    wx.showToast({
      title: '治疗数据加载失败',
      icon: 'error'
    })
    // 出错时设置默认值
      this.setData({
        'treatmentData.stats': {
          pendingDiagnosis: 0,
          ongoingTreatment: 0,
          totalTreatmentCost: 0,
          cureRate: 0,
          ongoingAnimalsCount: 0
        },
        // ✅ 同时重置卡片显示数据
        'treatmentStats.totalTreatments': 0,
        'treatmentStats.totalCost': 0,
        'treatmentStats.recoveredCount': 0,
        'treatmentStats.ongoingCount': 0,
        'treatmentStats.recoveryRate': '0%',
        'treatmentData.diagnosisHistory': [],
        'monitoringData.realTimeStatus.abnormalCount': 0,
        'monitoringData.abnormalList': []
      })
    }
  },

  /**
   * 诊断记录点击事件 - ✅ 直接在当前页面弹窗查看详情
   */
  async onDiagnosisRecordTap(e: any) {
    // ✅ 防重复点击：500ms内只允许点击一次
    const now = Date.now()
    if (now - this.lastClickTime < 500) {
      return
    }
    this.lastClickTime = now
    
    const { record } = e.currentTarget.dataset
    
    // ✅ 处理图片URL - 转换为临时URL（与 diagnosis-history 逻辑一致）
    let processedImages = record.images || []
    
    if (processedImages.length > 0) {
      try {
        const cloudFileIds = processedImages.filter((url: string) => 
          url && typeof url === 'string' && url.startsWith('cloud://')
        )
        
        if (cloudFileIds.length > 0) {
          const tempUrlResult = await wx.cloud.getTempFileURL({
            fileList: cloudFileIds
          })
          
          if (tempUrlResult.fileList) {
            const tempUrlMap = new Map(
              tempUrlResult.fileList.map((file: any) => [file.fileID, file.tempFileURL])
            )
            
            processedImages = processedImages.map((url: string) => 
              tempUrlMap.get(url) || url
            ).filter((url: string) => url && typeof url === 'string')
          }
        }
      } catch (error) {
        wx.showToast({
          title: '图片加载失败',
          icon: 'error'
        })
      }
    }
    
    // ✅ 显示详情弹窗，数据结构与 diagnosis-history 完全一致
    this.setData({
      showDiagnosisDetailPopup: true,
      selectedDiagnosisRecord: {
        ...record,
        images: processedImages
      }
    })
  },

  /**
   * 关闭诊断详情弹窗
   */
  onCloseDiagnosisDetail() {
    this.setData({
      showDiagnosisDetailPopup: false,
      selectedDiagnosisRecord: null
    })
  },

  /**
   * 预览图片
   */
  onPreviewDiagnosisImage(e: any) {
    const { url } = e.currentTarget.dataset
    const selectedRecord = this.data.selectedDiagnosisRecord
    const images = selectedRecord?.images
    
    if (images && images.length > 0) {
      wx.previewImage({
        current: url,
        urls: images
      })
    }
  },

  /**
   * 查看全部诊断记录
   */
  onViewAllDiagnosis() {
    // ✅ 防重复点击
    const now = Date.now()
    if (now - this.lastClickTime < 500) return
    this.lastClickTime = now
    
    wx.navigateTo({
      url: `/packageAI/diagnosis-history/diagnosis-history?batchId=${this.data.currentBatchId}`
    })
  },

  /**
   * 点击治疗记录，跳转到详情页
   */
  onTreatmentRecordTap(e: any) {
    // ✅ 防重复点击：500ms内只允许点击一次
    const now = Date.now()
    if (now - this.lastClickTime < 500) {
      return
    }
    this.lastClickTime = now
    
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?id=${id}&mode=view`,
      // ✅ 使用EventChannel监听治疗进展更新
      events: {
        // 监听治疗进展更新事件（治愈、死亡等）
        treatmentProgressUpdated: () => {
          // ✅ 完全后台刷新，不阻塞任何操作
          this.backgroundRefreshData()
        }
      }
    })
  },

  /**
   * 查看全部治疗记录
   */
  onViewAllTreatments() {
    // ✅ 防重复点击
    const now = Date.now()
    if (now - this.lastClickTime < 500) return
    this.lastClickTime = now
    
    wx.navigateTo({
      url: '/packageHealth/treatment-records-list/treatment-records-list',
      // ✅ 使用EventChannel监听列表页的更新
      events: {
        treatmentListUpdated: () => {
          this.backgroundRefreshData()
        }
      }
    })
  },

  /**
   * 加载分析数据
   */
  async loadAnalysisData() {
    // 实现健康分析数据加载
    // 已移除调试日志
  },

  /**
   * 查看预防记录详情
   */
  viewPreventionRecord(e: any) {
    const { recordId } = e.currentTarget.dataset
    // 已移除调试日志
    wx.navigateTo({
      url: `/packageHealth/vaccine-record/vaccine-record?id=${recordId}`
    })
  },

  /**
   * 查看健康警报详情
   */
  viewHealthAlert(e: any) {
    const { alertId } = e.currentTarget.dataset
    // 已移除调试日志
    wx.navigateTo({
      url: `/packageHealth/health-care/health-care?alertId=${alertId}`
    })
  },

  /**
   * 创建新的健康记录
   */
  createHealthRecord() {
    wx.navigateTo({
      url: `/packageHealth/health-inspection/health-inspection?batchId=${this.data.currentBatchId}`
    })
  },

  /**
   * 创建新的预防记录
   */
  createPreventionRecord() {
    wx.navigateTo({
      url: `/packageHealth/vaccine-record/vaccine-record?batchId=${this.data.currentBatchId}&mode=create`
    })
  },

  /**
   * 完成待办任务
   */
  onCompleteTask(e: any) {
    const task = e.currentTarget.dataset.task
    if (!task) return
    
    // 根据任务类型跳转到不同的记录页面
    let url = ''
    const params = `taskId=${task.taskId}&batchId=${task.batchId}&dayAge=${task.dayAge}&taskName=${encodeURIComponent(task.taskName || '')}&fromTask=true`
    
    switch (task.taskType) {
      case 'vaccine':
        url = `/packageHealth/vaccine-record/vaccine-record?${params}`
        break
      case 'medication':
        // 暂时跳转到疫苗记录页面，后续可以添加独立的用药页面
        url = `/packageHealth/vaccine-record/vaccine-record?${params}`
        break
      case 'disinfection':
        url = `/packageHealth/disinfection-record/disinfection-record?${params}`
        break
      default:
        wx.showToast({
          title: '未知任务类型',
          icon: 'none'
        })
        return
    }
    
    wx.navigateTo({
      url
    })
  },

  /**
   * 切换预防管理子标签页（复制自breeding-todo）
   */
  async onPreventionSubTabChange(e: any) {
    const { value } = e.detail
    this.setData({
      preventionSubTab: value
    })
    
    // 根据子标签加载对应数据（与breeding-todo保持一致）
    switch (value) {
      case 'today':
        // ✅ 确保今日任务已加载
        // 📝 优化：统一使用 loadPreventionData 作为唯一数据源，移除回退逻辑
        if (!this.data.todayTasksByBatch || this.data.todayTasksByBatch.length === 0) {
          await this.loadPreventionData()
          // 如果加载失败，显示错误提示（不再回退到 loadTodayTasks）
          if (!this.data.todayTasksByBatch || this.data.todayTasksByBatch.length === 0) {
            wx.showToast({
              title: '数据加载失败，请下拉刷新',
              icon: 'none',
              duration: 2000
            })
          }
        }
        break
      case 'upcoming':
        this.loadUpcomingTasks()
        break
      case 'history':
        this.loadHistoryTasks()
        break
      case 'stats':
        // 统计数据已经在loadPreventionData中加载
        break
    }
  },

  /**
   * 标准化任务对象，兼容旧字段
   */
  normalizeTask(task: any = {}, overrides: Record<string, any> = {}) {
    const normalizedId = task._id || task.taskId || task.id || ''
    const normalizedTitle = task.title || task.taskName || task.name || task.displayTitle || task.content || '未命名任务'
    const normalizedDescription = task.description || task.content || ''
    const normalizedType = task.type || task.taskType || ''

    return {
      ...task,
      _id: normalizedId,
      taskId: task.taskId || normalizedId,
      title: normalizedTitle,
      taskName: task.taskName || normalizedTitle,
      description: normalizedDescription,
      content: task.content || normalizedDescription,
      type: normalizedType,
      taskType: task.taskType || normalizedType,
      ...overrides
    }
  },

  /**
   * 加载单批次今日待办任务
   */
  async loadSingleBatchTodayTasks() {
    if (!this.data.currentBatchId || this.data.currentBatchId === 'all') {
      this.setData({ 
        'preventionData.todayTasks': [],
        todayTasksByBatch: []
      })
      return
    }

    try {
      // 获取批次信息以获取云函数计算的日龄
      const batchResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'getBatchDetail',
          batchId: this.data.currentBatchId
        }
      })

      const batch = batchResult.result?.data
      if (!batch) {
        throw new Error('批次不存在')
      }

      // 使用云函数返回的日龄，如果没有则本地计算
      const dayAge = batch.dayAge || calculateCurrentAge(batch.entryDate)

      // 调用 breeding-todo 云函数获取任务（只查询当日日龄的任务）
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'getTodos',
          batchId: this.data.currentBatchId,
          dayAge: dayAge  // 只查询当日日龄的任务
        }
      })

      const response = result.result as any
      
      if (response.success && response.data && response.data.length > 0) {
        const tasks = Array.isArray(response.data) ? response.data : []
        
        const normalizedTasks = tasks.map((task: any) => this.normalizeTask(task, {
          batchNumber: batch.batchNumber || this.data.currentBatchId,
          dayAge: task.dayAge || dayAge
        }))
        
        this.setData({
          todayTasksByBatch: [{
            batchId: this.data.currentBatchId,
            batchNumber: batch.batchNumber || this.data.currentBatchId,
            dayAge: dayAge,
            tasks: normalizedTasks
          }],
          'preventionData.todayTasks': normalizedTasks
        })
      } else {
        // 当日没有任务，显示空列表
        this.setData({
          todayTasksByBatch: [],
          'preventionData.todayTasks': []
        })
      }
    } catch (error: any) {
      console.error('加载单批次今日任务失败:', error)
      this.setData({
        todayTasksByBatch: [],
        'preventionData.todayTasks': []
      })
    }
  },

  /**
   * 加载所有批次今日待办任务
   */
  async loadAllBatchesTodayTasks() {
    try {
      // 获取活跃批次
      const batchResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })

      const activeBatches = batchResult.result?.data || []
      
      if (activeBatches.length === 0) {
        this.setData({
          todayTasksByBatch: [],
          'preventionData.todayTasks': []
        })
        return
      }

      // 为每个活跃批次获取今日任务
      const batchTasksPromises = activeBatches.map(async (batch: any) => {
        try {
          // 使用云函数返回的日龄
          const dayAge = batch.dayAge
          
          // 只查询当日日龄的任务
          const result = await wx.cloud.callFunction({
            name: 'breeding-todo',
            data: {
              action: 'getTodos',
              batchId: batch._id,
              dayAge: dayAge  // 只查询当日日龄的任务
            }
          })
          
          const response = result.result as any
          
          if (response.success && response.data && response.data.length > 0) {
            const tasks = Array.isArray(response.data) ? response.data : []
            
            const normalizedTasks = tasks.map((task: any) =>
              this.normalizeTask(task, {
                batchNumber: batch.batchNumber || batch._id,
                dayAge: task.dayAge || dayAge
              })
            )
            
            return {
              batchId: batch._id,
              batchNumber: batch.batchNumber || batch._id,
              dayAge: dayAge,
              tasks: normalizedTasks
            }
          } else {
            return null
          }
        } catch (error) {
          console.error(`批次 ${batch._id} 任务加载失败:`, error)
          return null
        }
      })

      const batchTasksResults = await Promise.all(batchTasksPromises)
      
      // 过滤掉空结果（当日没有任务的批次）
      const validBatchTasks = batchTasksResults.filter((item: any) => item !== null && item.tasks.length > 0)
      
      // 收集所有任务
      let allTasks: any[] = []
      validBatchTasks.forEach((batchData: any) => {
        allTasks = allTasks.concat(batchData.tasks)
      })

      this.setData({
        todayTasksByBatch: validBatchTasks,
        'preventionData.todayTasks': allTasks
      })
    } catch (error: any) {
      console.error('[loadAllBatchesTodayTasks] 加载所有批次今日任务失败:', error)
      this.setData({
        todayTasksByBatch: [],
        'preventionData.todayTasks': []
      })
    }
  },

  /**
   * 加载即将到来的任务（从breeding-todo迁移）
   */
  async loadUpcomingTasks() {
    try {
      this.setData({ loading: true })
      
      if (this.data.currentBatchId === 'all') {
        await this.loadAllUpcomingTasks()
      } else {
        await this.loadSingleBatchUpcomingTasks()
      }
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 加载单批次即将到来的任务
   */
  async loadSingleBatchUpcomingTasks() {
    if (!this.data.currentBatchId || this.data.currentBatchId === 'all') {
      this.setData({ upcomingTasks: [] })
      return
    }

    try {
      // 获取批次信息以计算当前日龄
      const batchResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })

      const activeBatches = batchResult.result?.data || []
      const currentBatch = activeBatches.find((b: any) => b._id === this.data.currentBatchId)
      
      if (!currentBatch) {
        this.setData({ upcomingTasks: [] })
        return
      }

      const currentDayAge = calculateCurrentAge(currentBatch.entryDate)
      const nextDayAge = currentDayAge + 1
      
      const result = await CloudApi.getWeeklyTodos(this.data.currentBatchId, nextDayAge)
      
      if (result.success && result.data) {
        // 将按日龄分组的数据转换为数组格式，过滤掉当前日龄及之前的任务
        const upcomingTasksArray = Object.keys(result.data)
          .map(dayAge => parseInt(dayAge))
          .filter(dayAge => dayAge > currentDayAge)
          .map(dayAge => ({
            dayAge: dayAge,
            tasks: (result.data[dayAge.toString()] || []).map((task: any) =>
              this.normalizeTask(task, {
              isVaccineTask: isVaccineTask(task),
                batchNumber: currentBatch.batchNumber || this.data.currentBatchId,
                dayAge
              })
            )
          }))
          .sort((a, b) => a.dayAge - b.dayAge)

        // 转换为批次分组格式
        const upcomingTasksByBatch = upcomingTasksArray.map(group => ({
          batchId: this.data.currentBatchId,
          batchNumber: currentBatch.batchNumber || this.data.currentBatchId,
          dayAge: group.dayAge,
          tasks: group.tasks
        }))
        
        this.setData({ upcomingTasksByBatch })
      } else {
        this.setData({ upcomingTasksByBatch: [] })
      }
    } catch (error) {
      this.setData({ upcomingTasksByBatch: [] })
    }
  },

  /**
   * 加载所有批次的即将到来任务
   */
  async loadAllUpcomingTasks() {
    try {
      // 获取活跃批次
      const batchResult = await wx.cloud.callFunction({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })

      const activeBatches = batchResult.result?.data || []
      
      if (activeBatches.length === 0) {
        this.setData({ upcomingTasksByBatch: [] })
        return
      }

      // 为每个活跃批次加载未来一周的任务
      const upcomingTasksPromises = activeBatches.map(async (batch: any): Promise<any[]> => {
        try {
          const currentDayAge = calculateCurrentAge(batch.entryDate)
          const result = await CloudApi.getWeeklyTodos(batch._id, currentDayAge + 1)
          
          if (result.success && result.data) {
            return Object.keys(result.data)
              .map(taskDayAge => parseInt(taskDayAge))
              .filter(dayAge => dayAge > currentDayAge)
              .map(dayAge => ({
                dayAge: dayAge,
                tasks: (result.data[dayAge.toString()] || []).map((task: any) =>
                  this.normalizeTask(task, {
                    batchNumber: batch.batchNumber || batch._id,
                    isVaccineTask: isVaccineTask(task),
                    // 使用任务本身的dayAge字段，如果没有则使用分组日龄
                    dayAge: task.dayAge || dayAge
                  })
                )
              }))
          }
          return []
        } catch (error) {
          return []
        }
      })

      const upcomingTasksResults = await Promise.all(upcomingTasksPromises)
      
      // 合并所有批次的任务并按日龄分组
      const mergedTasks: {[key: number]: any[]} = {}
      
      upcomingTasksResults.forEach((batchTasks: any[]) => {
        batchTasks.forEach((dayGroup: any) => {
          const dayAge = dayGroup.dayAge
          if (!mergedTasks[dayAge]) {
            mergedTasks[dayAge] = []
          }
          mergedTasks[dayAge] = mergedTasks[dayAge].concat(dayGroup.tasks)
        })
      })

      // 转换为数组格式并排序
      const sortedUpcomingTasks = Object.keys(mergedTasks).map(dayAge => ({
        dayAge: parseInt(dayAge),
        tasks: mergedTasks[parseInt(dayAge)]
      })).sort((a, b) => a.dayAge - b.dayAge)

      // 转换为批次分组格式，按批次和日龄分组
      const upcomingTasksByBatch: any[] = []
      
      sortedUpcomingTasks.forEach(dayGroup => {
        dayGroup.tasks.forEach((task: any) => {
          const batchId = task.batchId || task.batchNumber
          // 使用任务本身的dayAge字段，如果没有则使用分组日龄
          const taskDayAge = task.dayAge || dayGroup.dayAge
          
          // 按批次和日龄组合查找分组
          let batchGroup = upcomingTasksByBatch.find(g => 
            g.batchId === batchId && g.dayAge === taskDayAge
          )
          
          if (!batchGroup) {
            batchGroup = {
              batchId: batchId,
              batchNumber: task.batchNumber || batchId,
              dayAge: taskDayAge,
              tasks: []
            }
            upcomingTasksByBatch.push(batchGroup)
          }
          
          batchGroup.tasks.push(task)
        })
      })
      
      // 按批次号和日龄排序
      upcomingTasksByBatch.sort((a, b) => {
        if (a.batchNumber !== b.batchNumber) {
          return (a.batchNumber || '').localeCompare(b.batchNumber || '')
        }
        return a.dayAge - b.dayAge
      })
      
      this.setData({ upcomingTasksByBatch })

    } catch (error) {
      this.setData({ upcomingTasksByBatch: [] })
    }
  },

  /**
   * 加载历史任务（从breeding-todo迁移）- ✅ 修复：直接查询数据库获取所有已完成任务
   */
  async loadHistoryTasks() {
    try {
      this.setData({ loading: true })
      
      const db = wx.cloud.database()
      const _ = db.command
      
      // ✅ 先获取存在的批次列表，避免显示孤儿任务
      let validBatchIds: string[] = []
      if (this.data.currentBatchId === 'all') {
        try {
          const batchResult = await wx.cloud.callFunction({
            name: 'production-entry',
            data: { action: 'getActiveBatches' }
          })
          if (batchResult.result?.success) {
            validBatchIds = (batchResult.result.data || []).map((b: any) => b._id)
          }
        } catch (error) {
          console.error('[历史任务] 获取批次列表失败:', error)
        }
      } else {
        validBatchIds = [this.data.currentBatchId]
      }
      
      // 如果没有有效批次，直接返回
      if (validBatchIds.length === 0) {
        this.setData({ historyTasksByBatch: [] })
        return
      }
      
      // ✅ 修复：构建正确的查询条件（不限制 category，或使用中文值）
      const whereCondition: any = {
        completed: true,
        // ✅ 查询所有健康相关的任务类别
        category: _.in(['健康管理', '营养管理', '疫苗接种', '用药管理']),
        // ✅ 只查询存在的批次的任务
        batchId: _.in(validBatchIds)
      }
      
      const result = await db.collection('task_batch_schedules')
        .where(whereCondition)
        .orderBy('dayAge', 'desc')  // ✅ 使用索引中的字段排序
        .limit(100)  // 限制返回100条
        .get()
      
      if (result.data && result.data.length > 0) {
        const completedTasks = result.data.map((task: any) => ({
          _id: task._id,
          id: task._id,
          taskId: task.taskId || task._id,
          title: task.title || task.taskName,
          taskName: task.title || task.taskName,
          type: task.type || task.taskType,
          completedDate: task.completedAt ? new Date(task.completedAt).toLocaleString('zh-CN') : '',
          completedBy: task.completedBy || '用户',
          batchNumber: task.batchNumber || task.batchId,
          batchId: task.batchId,
          dayAge: task.dayAge || 0,
          completed: true,
          description: task.description || '',
          notes: task.notes || task.completionNotes || ''
        }))
        
        // ✅ 按完成时间重新排序（在内存中排序）
        completedTasks.sort((a, b) => {
          const dateA = a.completedDate ? new Date(a.completedDate).getTime() : 0
          const dateB = b.completedDate ? new Date(b.completedDate).getTime() : 0
          return dateB - dateA  // 倒序：最新的在前
        })
        
        // 按批次分组
        const historyTasksByBatch = this.groupHistoryTasksByBatch(completedTasks)
        this.setData({ historyTasksByBatch })
      } else {
        this.setData({ historyTasksByBatch: [] })
      }

    } catch (error) {
      console.error('加载历史任务失败:', error)
      this.setData({ historyTasksByBatch: [] })
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },


  /**
   * 加载预防时间线
   */
  async loadPreventionTimeline() {
    const batchId = this.data.currentBatchId
    
    if (!batchId || batchId === 'all') {
      wx.showToast({
        title: '请选择具体批次查看时间线',
        icon: 'none'
      })
      return
    }
    
    wx.showLoading({ title: '加载中...' })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'getPreventionTimeline',
          batchId: batchId
        }
      })
      
      const response = result.result as any
      if (response.success && response.data) {
        this.setData({
          timelineData: response.data
        })
      } else {
        throw new Error(response.message || '加载失败')
      }
    } catch (error: any) {
      console.error('加载预防时间线失败:', error)
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 加载批次对比数据
   */
  async loadBatchComparison() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'getBatchPreventionComparison'
        }
      })
      
      const response = result.result as any
      if (response.success && response.data) {
        this.setData({
          comparisonData: response.data
        })
      } else {
        throw new Error(response.message || '加载失败')
      }
    } catch (error: any) {
      console.error('加载批次对比数据失败:', error)
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 查看预防记录详情
   */
  onViewRecord(e: any) {
    const record = e.currentTarget.dataset.record
    if (!record) return
    
    // 显示记录详情弹窗
    wx.showModal({
      title: '预防记录详情',
      content: `
类型：${record.preventionType === 'vaccine' ? '疫苗接种' : record.preventionType === 'disinfection' ? '消毒' : '用药'}
日期：${record.preventionDate}
批次：${record.batchNumber}
成本：¥${record.cost}
操作人：${record.operator}
${record.taskId ? '\n来源：待办任务' : ''}
      `.trim(),
      showCancel: false
    })
  },

  /**
   * 创建新的治疗记录
   */
  createTreatmentRecord() {
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?batchId=${this.data.currentBatchId}&mode=create`
    })
  },

  /**
   * AI健康诊断
   */
  openAiDiagnosis() {
    wx.navigateTo({
      url: `/packageAI/ai-diagnosis/ai-diagnosis?batchId=${this.data.currentBatchId}`
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
    // 已移除调试日志
  },

  /**
   * 菜单点击事件
   */
  onMenuTap() {
    wx.showActionSheet({
      itemList: ['导出报告', '数据统计', '设置提醒'],
      success: () => {
        // 已移除调试日志
      }
    })
  },

  /**
   * 待诊断卡片点击 - 跳转到AI诊断页面
   */
  onPendingDiagnosisClick() {
    wx.navigateTo({
      url: '/packageAI/ai-diagnosis/ai-diagnosis'
    })
  },

  /**
   * 治疗中卡片点击 - 跳转到治疗记录列表
   */
  onOngoingTreatmentClick() {
    // ✅ 防重复点击
    const now = Date.now()
    if (now - this.lastClickTime < 500) return
    this.lastClickTime = now
    
    wx.navigateTo({
      url: '/packageHealth/treatment-records-list/treatment-records-list',
      // ✅ 使用EventChannel监听列表页的更新
      events: {
        treatmentListUpdated: () => {
          this.backgroundRefreshData()
        }
      }
    })
  },

  /**
   * 治疗成本卡片点击 - 显示成本详情
   */
  onTreatmentCostClick() {
    wx.showModal({
      title: '治疗成本详情',
      content: `当前批次治疗总成本：¥${this.data.treatmentData.stats.totalTreatmentCost || 0}\n\n包含所有进行中治疗的用药和操作成本。`,
      showCancel: false
    })
  },

  /**
   * 预警操作事件
   */
  onAlertAction(_e: any) {
    // 预警操作事件处理
    // 已移除调试日志
  },

  /**
   * 预防管理操作事件
   */
  onPreventionAction(e: any) {
    const { action } = e.currentTarget.dataset
    // 已移除调试日志
    switch (action) {
      case 'add_vaccine':
        this.createPreventionRecord()
        break
      case 'add_disinfection':
        wx.navigateTo({
          url: `/packageHealth/disinfection-record/disinfection-record?batchId=${this.data.currentBatchId}`
        })
        break
      case 'health_inspection':
        this.createHealthRecord()
        break
      case 'add_healthcare':
        wx.navigateTo({
          url: `/packageHealth/health-care/health-care?batchId=${this.data.currentBatchId}`
        })
        break
    }
  },

  /**
   * 监控操作事件
   */
  onMonitoringAction(e: any) {
    const { action } = e.currentTarget.dataset
    // 已移除调试日志
    switch (action) {
      case 'batch_check':
        this.createHealthRecord()
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
    // 已移除调试日志
    switch (action) {
      case 'start_diagnosis':
        this.openAiDiagnosis()
        break
      case 'add_treatment':
        this.createTreatmentRecord()
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
    // 已移除调试日志
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
  },

  // ========== 批次筛选相关方法 ==========

  /**
   * 加载可用批次列表
   */
  async loadAvailableBatches() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'getActiveBatches'
        }
      })

      if (result.result && result.result.success) {
        const batches = result.result.data || []
        
        // 使用云函数返回的dayAge
        const batchesWithDayAge = batches.map((batch: any) => {
          return {
            ...batch,
            dayAge: batch.dayAge
          }
        })
        
        this.setData({
          availableBatches: batchesWithDayAge
        })
        
        // 设置当前批次号
        if (this.data.currentBatchId === 'all') {
          // 保持全部批次模式
          this.setData({
            currentBatchNumber: '全部批次'
          })
        } else if (this.data.currentBatchId) {
          // 查找当前批次
          const currentBatch = batchesWithDayAge.find((b: any) => b._id === this.data.currentBatchId)
          if (currentBatch) {
            this.setData({
              currentBatchNumber: currentBatch.batchNumber
            })
          }
        }
      }
    } catch (error: any) {
      // 加载批次列表失败，静默处理
    }
  },

  /**
   * 切换下拉菜单显示状态
   */
  toggleBatchDropdown() {
    const willShow = !this.data.showBatchDropdown
    
    if (willShow) {
      // 打开下拉菜单时，动态计算位置
      const query = wx.createSelectorQuery()
      query.select('.batch-filter-section').boundingClientRect()
      query.exec((res) => {
        if (res && res[0]) {
          const rect = res[0]
          // 下拉菜单显示在筛选区域下方，加一点间距
          const dropdownTop = rect.bottom + 8
          
          this.setData({
            dropdownTop: dropdownTop,
            showBatchDropdown: true
          })
        } else {
          // 如果查询失败，使用默认位置
          this.setData({
            showBatchDropdown: true
          })
        }
      })
    } else {
      // 关闭下拉菜单
      this.setData({
        showBatchDropdown: false
      })
    }
  },

  /**
   * 关闭下拉菜单
   */
  closeBatchDropdown() {
    this.setData({
      showBatchDropdown: false
    })
  },

  /**
   * 选择全部批次
   */
  selectAllBatches() {
    this.setData({
      currentBatchId: 'all',
      currentBatchNumber: '全部批次',
      showBatchDropdown: false
    })

    // 重新加载健康数据
    this.loadHealthData()
  },

  /**
   * 从下拉菜单选择批次（在详情视图下切换批次）
   */
  selectBatchFromDropdown(e: any) {
    const index = e.currentTarget.dataset.index
    const batches = this.data.availableBatches
    
    if (index >= 0 && index < batches.length) {
      const selectedBatch = batches[index]
      
      this.setData({
        currentBatchId: selectedBatch._id,
        currentBatchNumber: selectedBatch.batchNumber,
        showBatchDropdown: false
      })

      // 重新加载健康数据
      this.loadHealthData()
    }
  },

  /**
   * 点击治愈率卡片，跳转到治愈记录列表
   */
  navigateToCuredRecords() {
    // ✅ 防重复点击
    const now = Date.now()
    if (now - this.lastClickTime < 500) return
    this.lastClickTime = now
    
    wx.navigateTo({
      url: '/packageHealth/cured-records-list/cured-records-list',
      // ✅ 使用EventChannel监听治愈记录更新
      events: {
        curedRecordsUpdated: () => {
          this.backgroundRefreshData()
        }
      }
    })
  },

  /**
   * 点击死亡率卡片，跳转到死亡记录列表
   */
  navigateToDeathRecords() {
    // ✅ 防重复点击
    const now = Date.now()
    if (now - this.lastClickTime < 500) return
    this.lastClickTime = now
    
    wx.navigateTo({
      url: '/packageHealth/death-records-list/death-records-list',
      // ✅ 使用EventChannel监听死亡记录更新
      events: {
        deathRecordsUpdated: () => {
          this.backgroundRefreshData()
        }
      }
    })
  },

  /**
   * 点击死亡数卡片，跳转到死亡记录列表
   */
  onDeathCountTap() {
    // ✅ 防重复点击
    const now = Date.now()
    if (now - this.lastClickTime < 500) return
    this.lastClickTime = now
    
    wx.navigateTo({
      url: '/packageHealth/death-records-list/death-records-list',
      // ✅ 使用EventChannel监听死亡记录更新
      events: {
        deathRecordsUpdated: () => {
          this.backgroundRefreshData()
        }
      }
    })
  },

  /**
   * 异常数量卡片点击 - 跳转到异常记录列表
   */
  onAbnormalCountTap() {
    // ✅ 防重复点击
    const now = Date.now()
    if (now - this.lastClickTime < 500) return
    this.lastClickTime = now
    
    wx.navigateTo({
      url: '/packageHealth/abnormal-records-list/abnormal-records-list',
      events: {
        abnormalRecordsUpdated: () => {
          this.backgroundRefreshData()
        }
      }
    })
  },

  /**
   * 疫苗追踪卡片点击 - 跳转到疫苗记录列表
   */
  onVaccineCountTap() {
    // ✅ 防重复点击
    const now = Date.now()
    if (now - this.lastClickTime < 500) return
    this.lastClickTime = now
    
    wx.navigateTo({
      url: '/packageHealth/vaccine-records-list/vaccine-records-list',
      events: {
        vaccineRecordsUpdated: () => {
          this.backgroundRefreshData()
        }
      }
    })
  },

  /**
   * 获取任务类型名称（从breeding-todo迁移）
   */
  getTypeName(type: string): string {
    const TYPE_NAMES: { [key: string]: string } = {
      vaccine: '疫苗',
      medication: '用药',
      nutrition: '营养',
      disinfection: '消毒',
      inspection: '巡检',
      cleaning: '清洁',
      feeding: '喂养',
      care: '护理',
      other: '其他'
    }
    return TYPE_NAMES[type] || '其他'
  },

  /**
   * 计算指定日龄对应的日期（从breeding-todo迁移）
   */
  calculateDate(dayAge: number): string {
    const today = new Date()
    const targetDate = new Date(today.getTime() + (dayAge - 1) * 24 * 60 * 60 * 1000)
    return targetDate.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    })
  },

  /**
   * 查看任务详情（从breeding-todo完整迁移）
   */
  viewTaskDetail(e: any) {
    const task = e.currentTarget.dataset.task
    if (!task) return
    
    // ✅ 判断任务是否为即将到来的任务（来自 upcoming 标签）
    const isUpcomingTask = this.data.preventionSubTab === 'upcoming'
    
    // 构建增强的任务数据
    const enhancedTask = {
      ...task,
      
      // 确保ID字段存在
      id: task._id || task.taskId || task.id || '',
      
      title: task.title || task.taskName || task.content || '未命名任务',
      typeName: this.getTypeName(task.type || ''),
      statusText: task.completed ? '已完成' : (isUpcomingTask ? '即将到来' : '待完成'),
      
      // 标记任务类型
      isVaccineTask: isVaccineTask(task),
      isMedicationTask: isMedicationTask(task),
      isNutritionTask: isNutritionTask(task),
      
      // ✅ 标记是否为即将到来的任务（禁止操作）
      isUpcoming: isUpcomingTask,
      
      // 确保其他字段存在
      description: task.description || '',
      notes: task.notes || '',
      estimatedTime: task.estimatedTime || task.estimatedDuration || '',
      duration: task.duration || '',
      dayInSeries: task.dayInSeries || '',
      dosage: task.dosage || '',
      materials: Array.isArray(task.materials) ? task.materials : [],
      batchNumber: task.batchNumber || task.batchId || '',
      dayAge: task.dayAge || '',
      
      // 确保completed状态正确
      completed: task.completed || false,
      completedDate: task.completedDate || ''
    }

    this.setData({
      selectedTask: enhancedTask,
      showTaskDetailPopup: true
    })
  },

  /**
   * 关闭任务详情弹窗
   */
  closeTaskDetailPopup() {
    this.setData({
      showTaskDetailPopup: false,
      selectedTask: null
    })
  },

  /**
   * 任务详情弹窗显示状态变化
   */
  onTaskDetailPopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showTaskDetailPopup: false,
        selectedTask: null
      })
    }
  },

  /**
   * 任务操作确认
   */
  onTaskConfirm() {
    const task = this.data.selectedTask
    if (!task) return

    if (task.isVaccineTask) {
      this.openVaccineForm(task)
    } else if (task.isMedicationTask) {
      this.openMedicationForm(task)
    } else if (task.isNutritionTask) {
      this.openNutritionForm(task)
    } else {
      this.completeNormalTask(task)
    }
  },

  /**
   * 完成普通任务
   */
  async completeNormalTask(task: any) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'completeTask',
          taskId: task._id,
          batchId: task.batchId,
          notes: ''
        }
      })
      
      const response = result.result as any
      if (response.success) {
        this.closeTaskDetailPopup()
        // 📝 优化：统一使用 loadPreventionData 刷新任务列表
        if (this.data.preventionSubTab === 'today') {
          this.loadPreventionData()
        }
        wx.showToast({
          title: '任务完成',
          icon: 'success'
        })
      }
    } catch (error: any) {
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
    }
  },

  /**
   * 打开疫苗表单
   */
  async openVaccineForm(task: any) {
    // ✅ 获取当前批次的存栏数量
    await this.initVaccineFormData(task)
    this.setData({
      showVaccineFormPopup: true,
      showTaskDetailPopup: false
    })
  },

  /**
   * 初始化疫苗表单数据
   */
  async initVaccineFormData(task: any) {
    // ✅ 获取当前批次的存栏数量
    let currentBatchStockQuantity = 0
    const batchId = task.batchId || this.data.currentBatchId
    if (batchId && batchId !== 'all') {
      try {
        const batchResult = await wx.cloud.callFunction({
          name: 'production-entry',
          data: { action: 'getActiveBatches' }
        })
        
        if (batchResult.result?.success) {
          const activeBatches = batchResult.result.data || []
          const currentBatch = activeBatches.find((b: any) => b._id === batchId)
          if (currentBatch) {
            currentBatchStockQuantity = currentBatch.currentStock || 
                                       currentBatch.currentQuantity || 
                                       currentBatch.currentCount || 
                                       0
          }
        }
      } catch (error) {
        console.error('获取批次存栏数失败:', error)
      }
    }
    
    const vaccineFormData = {
      veterinarianName: '',
      veterinarianContact: '',
      vaccineName: task.title || '',
      manufacturer: '',
      batchNumber: '',
      dosage: '0.5ml/只',
      routeIndex: 0,
      vaccinationCount: 0,
      location: '',
      vaccineCost: '',
      veterinaryCost: '',
      otherCost: '',
      totalCost: 0,
      totalCostFormatted: '¥0.00',
      notes: task.description || ''
    }

    this.setData({
      selectedTask: task,
      currentBatchStockQuantity,  // ✅ 设置存栏数量
      vaccineFormData,
      vaccineFormErrors: {}
    })
  },

  /**
   * 关闭疫苗表单
   */
  closeVaccineFormPopup() {
    this.setData({
      showVaccineFormPopup: false
    })
  },

  /**
   * 疫苗表单输入处理
   */
  onVaccineFormInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`vaccineFormData.${field}`]: value
    })

    // 清除对应字段的错误
    if (this.data.vaccineFormErrors[field]) {
      const newErrors = { ...this.data.vaccineFormErrors }
      delete newErrors[field]
      this.setData({
        vaccineFormErrors: newErrors,
        vaccineFormErrorList: Object.values(newErrors)
      })
    }
  },

  /**
   * 数值输入处理（费用相关）
   */
  onVaccineNumberInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    // 如果是接种数量，需要验证不超过存栏数量
    if (field === 'vaccinationCount') {
      const vaccinationCount = parseInt(value) || 0
      this.setData({
        [`vaccineFormData.${field}`]: vaccinationCount
      })

      // 验证不超过存栏数量
      const { currentBatchStockQuantity } = this.data
      if (currentBatchStockQuantity > 0 && vaccinationCount > currentBatchStockQuantity) {
        const newErrors = { ...this.data.vaccineFormErrors }
        newErrors.vaccinationCount = `接种数量不能超过存栏数量${currentBatchStockQuantity}只`
        this.setData({
          vaccineFormErrors: newErrors,
          vaccineFormErrorList: Object.values(newErrors)
        })
      } else if (this.data.vaccineFormErrors.vaccinationCount) {
        // 清除错误
        const newErrors = { ...this.data.vaccineFormErrors }
        delete newErrors.vaccinationCount
        this.setData({
          vaccineFormErrors: newErrors,
          vaccineFormErrorList: Object.values(newErrors)
        })
      }
    } else {
      this.setData({
        [`vaccineFormData.${field}`]: value
      }, () => {
        // 如果是费用相关字段，重新计算总费用
        if (['vaccineCost', 'veterinaryCost', 'otherCost'].includes(field)) {
          setTimeout(() => {
            this.calculateTotalCost()
          }, 100)
        }
      })
    }
  },

  /**
   * 路径选择处理
   */
  onVaccineRouteChange(e: any) {
    const { value } = e.detail
    this.setData({
      'vaccineFormData.routeIndex': parseInt(value)
    })
  },

  /**
   * 计算总费用
   */
  calculateTotalCost() {
    const { vaccineFormData } = this.data
    const vaccineCost = parseFloat(vaccineFormData.vaccineCost?.toString() || '0') || 0
    const veterinaryCost = parseFloat(vaccineFormData.veterinaryCost?.toString() || '0') || 0
    const otherCost = parseFloat(vaccineFormData.otherCost?.toString() || '0') || 0
    const totalCost = vaccineCost + veterinaryCost + otherCost
    
    const totalCostFormatted = `¥${totalCost.toFixed(2)}`
    
    this.setData({
      vaccineFormData: {
        ...this.data.vaccineFormData,
        totalCost: totalCost,
        totalCostFormatted: totalCostFormatted
      }
    })
  },

  /**
   * 验证疫苗表单
   */
  validateVaccineForm(): boolean {
    const { vaccineFormData } = this.data
    const errors: { [key: string]: string } = {}

    // 必填字段验证
    if (!vaccineFormData.veterinarianName || vaccineFormData.veterinarianName === '') {
      errors.veterinarianName = '请填写兽医姓名'
    }
    if (!vaccineFormData.vaccineName || vaccineFormData.vaccineName === '') {
      errors.vaccineName = '请填写疫苗名称'
    }
    if (!vaccineFormData.vaccinationCount || vaccineFormData.vaccinationCount <= 0) {
      errors.vaccinationCount = '请填写接种数量'
    }

    // 数值验证
    if (vaccineFormData.vaccinationCount <= 0) {
      errors.vaccinationCount = '接种数量必须大于0'
    }

    // 联系方式验证（如果填写了）
    if (vaccineFormData.veterinarianContact && 
        !/^1[3-9]\d{9}$/.test(vaccineFormData.veterinarianContact)) {
      errors.veterinarianContact = '请填写正确的手机号码'
    }

    // 更新错误对象和错误列表
    const errorList = Object.values(errors)
    this.setData({ 
      vaccineFormErrors: errors,
      vaccineFormErrorList: errorList
    })

    if (errorList.length > 0) {
      wx.showToast({
        title: errorList[0],
        icon: 'error'
      })
      return false
    }

    return true
  },

  /**
   * 提交疫苗表单
   */
  async submitVaccineForm() {
    if (!this.validateVaccineForm()) {
      return
    }

    const { selectedTask, vaccineFormData, vaccineRouteOptions } = this.data

    if (!selectedTask) {
      wx.showToast({
        title: '任务信息丢失',
        icon: 'error'
      })
      return
    }

    const batchId = selectedTask.batchId || selectedTask.batchNumber || this.data.selectedBatchId
    
    if (!batchId) {
      wx.showToast({
        title: '批次信息缺失',
        icon: 'error'
      })
      return
    }

    // 构建疫苗记录数据
    const vaccineRecord = {
      vaccine: {
        name: vaccineFormData.vaccineName,
        manufacturer: vaccineFormData.manufacturer,
        batchNumber: vaccineFormData.batchNumber,
        dosage: vaccineFormData.dosage
      },
      veterinarian: {
        name: vaccineFormData.veterinarianName,
        contact: vaccineFormData.veterinarianContact
      },
      vaccination: {
        route: vaccineRouteOptions[vaccineFormData.routeIndex],
        count: vaccineFormData.vaccinationCount,
        location: vaccineFormData.location
      },
      cost: {
        vaccine: parseFloat(vaccineFormData.vaccineCost || '0'),
        veterinary: parseFloat(vaccineFormData.veterinaryCost || '0'),
        other: parseFloat(vaccineFormData.otherCost || '0'),
        total: vaccineFormData.totalCost
      },
      notes: vaccineFormData.notes
    }

    try {
      wx.showLoading({ title: '提交中...' })

      const result = await wx.cloud.callFunction({
        name: 'health-prevention',
        data: {
          action: 'completeVaccineTask',
          taskId: selectedTask._id,
          batchId: batchId,
          vaccineRecord
        }
      })

      if (result.result && result.result.success) {
        wx.hideLoading()
        wx.showToast({
          title: '疫苗接种记录已创建',
          icon: 'success'
        })

        this.closeVaccineFormPopup()
        // 📝 优化：统一使用 loadPreventionData 刷新任务列表
        if (this.data.preventionSubTab === 'today') {
          this.loadPreventionData()
        }
      } else {
        throw new Error(result.result?.message || '提交失败')
      }
    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 打开用药表单
   */
  async openMedicationForm(task: any) {
    // 先加载可用的药品库存
    await this.loadAvailableMedicines()
    
    // ✅ 获取当前批次的存栏数量
    let currentBatchStockQuantity = 0
    const batchId = task.batchId || this.data.currentBatchId
    if (batchId && batchId !== 'all') {
      try {
        const batchResult = await wx.cloud.callFunction({
          name: 'production-entry',
          data: { action: 'getActiveBatches' }
        })
        
        if (batchResult.result?.success) {
          const activeBatches = batchResult.result.data || []
          const currentBatch = activeBatches.find((b: any) => b._id === batchId)
          if (currentBatch) {
            currentBatchStockQuantity = currentBatch.currentStock || 
                                       currentBatch.currentQuantity || 
                                       currentBatch.currentCount || 
                                       0
          }
        }
      } catch (error) {
        console.error('获取批次存栏数失败:', error)
      }
    }
    
    // 初始化表单数据
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      selectedTask: task,
      currentBatchStockQuantity,  // ✅ 设置存栏数量
      medicationFormData: {
        medicineId: '',
        medicineName: '',
        quantity: 0,
        unit: '',
        dosage: '',
        animalCount: 0,
        notes: '',
        operator: userInfo?.nickName || userInfo?.name || '用户'
      },
      selectedMedicine: null,
      medicationFormErrors: {},
      medicationFormErrorList: [],
      showMedicationFormPopup: true,
      showTaskDetailPopup: false
    })
  },

  /**
   * 加载可用的药品库存
   */
  async loadAvailableMedicines() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_materials',
          category: '药品'
        }
      })
      
      if (result.result && result.result.success) {
        const materials = result.result.data.materials || []
        const availableMedicines = materials
          .filter((material: any) => (material.currentStock || 0) > 0)
          .map((material: any) => ({
            id: material._id,
            name: material.name,
            unit: material.unit || '件',
            stock: material.currentStock || 0,
            category: material.category,
            description: material.description || ''
          }))
        
        this.setData({
          availableMedicines: Array.isArray(availableMedicines) ? availableMedicines : []
        })
      }
    } catch (error: any) {
      console.error('加载药品库存失败:', error)
    }
  },

  /**
   * 选择药品
   */
  onMedicineSelect(e: any) {
    const index = e.detail.value
    const selectedMedicine = this.data.availableMedicines[index]
    
    if (selectedMedicine) {
      this.setData({
        selectedMedicine: selectedMedicine,
        'medicationFormData.medicineId': selectedMedicine.id,
        'medicationFormData.medicineName': selectedMedicine.name,
        'medicationFormData.unit': selectedMedicine.unit
      })
      
      // 清除相关错误
      if (this.data.medicationFormErrors.medicineId) {
        const newErrors = { ...this.data.medicationFormErrors }
        delete newErrors.medicineId
        this.setData({
          medicationFormErrors: newErrors,
          medicationFormErrorList: Object.values(newErrors)
        })
      }
    }
  },

  /**
   * 用药表单输入处理
   */
  onMedicationFormInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`medicationFormData.${field}`]: value
    })

    // 清除对应字段的错误
    if (this.data.medicationFormErrors[field]) {
      const newErrors = { ...this.data.medicationFormErrors }
      delete newErrors[field]
      this.setData({
        medicationFormErrors: newErrors,
        medicationFormErrorList: Object.values(newErrors)
      })
    }
  },

  /**
   * 用药数量输入处理
   */
  onMedicationQuantityInput(e: any) {
    const { value } = e.detail
    const quantity = parseInt(value) || 0
    
    this.setData({
      'medicationFormData.quantity': quantity
    })

    // 清除错误
    if (this.data.medicationFormErrors.quantity) {
      const newErrors = { ...this.data.medicationFormErrors }
      delete newErrors.quantity
      this.setData({
        medicationFormErrors: newErrors,
        medicationFormErrorList: Object.values(newErrors)
      })
    }
  },

  /**
   * 用药鹅只数量输入处理
   */
  onMedicationAnimalCountInput(e: any) {
    const { value } = e.detail
    const animalCount = parseInt(value) || 0
    
    this.setData({
      'medicationFormData.animalCount': animalCount
    })

    // 验证不超过存栏数量
    const { currentBatchStockQuantity } = this.data
    if (currentBatchStockQuantity > 0 && animalCount > currentBatchStockQuantity) {
      const newErrors = { ...this.data.medicationFormErrors }
      newErrors.animalCount = `鹅只数量不能超过存栏数量${currentBatchStockQuantity}只`
      this.setData({
        medicationFormErrors: newErrors,
        medicationFormErrorList: Object.values(newErrors)
      })
    } else if (this.data.medicationFormErrors.animalCount) {
      // 清除错误
      const newErrors = { ...this.data.medicationFormErrors }
      delete newErrors.animalCount
      this.setData({
        medicationFormErrors: newErrors,
        medicationFormErrorList: Object.values(newErrors)
      })
    }
  },

  /**
   * 关闭用药表单
   */
  closeMedicationFormPopup() {
    this.setData({
      showMedicationFormPopup: false,
      selectedMedicine: null,
      medicationFormData: {
        medicineId: '',
        medicineName: '',
        quantity: 0,
        unit: '',
        dosage: '',
        animalCount: 0,
        notes: '',
        operator: ''
      },
      medicationFormErrors: {},
      medicationFormErrorList: []
    })
  },

  /**
   * 验证用药表单
   */
  validateMedicationForm(): boolean {
    const { medicationFormData, selectedMedicine } = this.data
    const errors: { [key: string]: string } = {}

    if (!medicationFormData.medicineId || !selectedMedicine) {
      errors.medicineId = '请选择药品'
    }

    if (!medicationFormData.quantity || medicationFormData.quantity <= 0) {
      errors.quantity = '请输入正确的用药数量'
    }

    if (selectedMedicine && medicationFormData.quantity > selectedMedicine.stock) {
      errors.quantity = `超出库存量（库存：${selectedMedicine.stock}${selectedMedicine.unit}）`
    }

    if (!medicationFormData.animalCount || medicationFormData.animalCount <= 0) {
      errors.animalCount = '请输入鹅只数量'
    }

    // ✅ 用药用途不需要用户填写，任务本身已经明确定义

    const errorList = Object.values(errors)
    this.setData({ 
      medicationFormErrors: errors,
      medicationFormErrorList: errorList
    })

    if (errorList.length > 0) {
      wx.showToast({
        title: errorList[0],
        icon: 'error'
      })
      return false
    }

    return true
  },

  /**
   * 提交用药表单
   */
  async submitMedicationForm() {
    if (!this.validateMedicationForm()) {
      return
    }

    const { selectedTask, medicationFormData } = this.data

    if (!selectedTask) {
      wx.showToast({
        title: '任务信息丢失',
        icon: 'error'
      })
      return
    }

    const batchId = selectedTask.batchId || selectedTask.batchNumber || this.data.selectedBatchId

    try {
      wx.showLoading({ title: '提交中...' })

      // ✅ 用途字段使用任务标题，不需要用户重复填写
      const purpose = selectedTask.title || '用药任务'

      const medicationRecord = {
        taskId: selectedTask._id,
        batchId: batchId,
        materialId: medicationFormData.medicineId,
        materialName: medicationFormData.medicineName,
        quantity: medicationFormData.quantity,
        unit: medicationFormData.unit,
        purpose: purpose,
        dosage: medicationFormData.dosage,
        notes: medicationFormData.notes,
        operator: medicationFormData.operator,
        useDate: new Date().toISOString().split('T')[0],
        createTime: new Date().toISOString()
      }

      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'create_record',
          recordData: {
            materialId: medicationRecord.materialId,
            type: 'use',
            quantity: Number(medicationRecord.quantity),
            targetLocation: purpose,
            operator: medicationRecord.operator || '用户',
            status: '已完成',
            notes: `用途：${purpose}，鹅只数量：${medicationFormData.animalCount}只${medicationRecord.dosage ? '，剂量：' + medicationRecord.dosage : ''}${medicationRecord.notes ? '，备注：' + medicationRecord.notes : ''}，批次：${selectedTask.batchNumber || selectedTask.batchId || ''}`,
            recordDate: medicationRecord.useDate
          }
        }
      })

      if (result.result && result.result.success) {
        await this.completeMedicationTask(selectedTask._id, batchId)
        
        wx.hideLoading()
        wx.showToast({
          title: '用药记录已创建',
          icon: 'success'
        })

        this.closeMedicationFormPopup()
        // 📝 优化：统一使用 loadPreventionData 刷新任务列表
        if (this.data.preventionSubTab === 'today') {
          this.loadPreventionData()
        }

      } else {
        throw new Error(result.result?.message || '提交失败')
      }

    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 完成用药管理任务
   */
  async completeMedicationTask(taskId: string, batchId: string) {
    try {
      await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'completeTask',
          taskId: taskId,
          batchId: batchId,
          completedAt: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      })
    } catch (error: any) {
      console.error('完成任务失败:', error)
    }
  },

  /**
   * 打开营养表单
   */
  async openNutritionForm(task: any) {
    // 先加载可用的营养品库存
    await this.loadAvailableNutrition()
    
    // 初始化表单数据
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      selectedTask: task,
      nutritionFormData: {
        nutritionId: '',
        nutritionName: '',
        quantity: 0,
        unit: '',
        dosage: '',
        notes: '',
        operator: userInfo?.nickName || userInfo?.name || '用户'
      },
      selectedNutrition: null,
      nutritionFormErrors: {},
      nutritionFormErrorList: [],
      showNutritionFormPopup: true,
      showTaskDetailPopup: false
    })
  },

  /**
   * 加载可用的营养品库存
   */
  async loadAvailableNutrition() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_materials',
          category: '营养品'
        }
      })

      if (result.result && result.result.success) {
        const materials = result.result.data?.materials || []
        const availableNutrition = materials
          .filter((material: any) => (material.currentStock || 0) > 0)
          .map((material: any) => ({
            id: material._id,
            name: material.name,
            unit: material.unit || '件',
            stock: material.currentStock || 0,
            category: material.category,
            description: material.description || ''
          }))

        this.setData({
          availableNutrition: availableNutrition
        })
      }
    } catch (error: any) {
      console.error('加载营养品库存失败:', error)
    }
  },

  /**
   * 选择营养品
   */
  onNutritionSelect(e: any) {
    const index = e.detail.value
    const selectedNutrition = this.data.availableNutrition[index]
    
    if (selectedNutrition) {
      this.setData({
        selectedNutrition: selectedNutrition,
        'nutritionFormData.nutritionId': selectedNutrition.id,
        'nutritionFormData.nutritionName': selectedNutrition.name,
        'nutritionFormData.unit': selectedNutrition.unit
      })
      
      // 清除相关错误
      if (this.data.nutritionFormErrors.nutritionId) {
        const newErrors = { ...this.data.nutritionFormErrors }
        delete newErrors.nutritionId
        this.setData({
          nutritionFormErrors: newErrors,
          nutritionFormErrorList: Object.values(newErrors)
        })
      }
    }
  },

  /**
   * 营养表单输入处理
   */
  onNutritionFormInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`nutritionFormData.${field}`]: value
    })

    // 清除对应字段的错误
    if (this.data.nutritionFormErrors[field]) {
      const newErrors = { ...this.data.nutritionFormErrors }
      delete newErrors[field]
      this.setData({
        nutritionFormErrors: newErrors,
        nutritionFormErrorList: Object.values(newErrors)
      })
    }
  },

  /**
   * 营养数量输入处理
   */
  onNutritionQuantityInput(e: any) {
    const { value } = e.detail
    const quantity = parseInt(value) || 0
    
    this.setData({
      'nutritionFormData.quantity': quantity
    })

    // 验证库存
    const { selectedNutrition } = this.data
    if (selectedNutrition && quantity > selectedNutrition.stock) {
      const newErrors = { ...this.data.nutritionFormErrors }
      newErrors.quantity = `库存不足，当前库存${selectedNutrition.stock}${selectedNutrition.unit}`
      this.setData({
        nutritionFormErrors: newErrors,
        nutritionFormErrorList: Object.values(newErrors)
      })
    } else if (this.data.nutritionFormErrors.quantity) {
      const newErrors = { ...this.data.nutritionFormErrors }
      delete newErrors.quantity
      this.setData({
        nutritionFormErrors: newErrors,
        nutritionFormErrorList: Object.values(newErrors)
      })
    }
  },

  /**
   * 关闭营养管理表单
   */
  closeNutritionFormPopup() {
    this.setData({
      showNutritionFormPopup: false,
      selectedNutrition: null,
      nutritionFormData: {
        nutritionId: '',
        nutritionName: '',
        quantity: 0,
        unit: '',
        dosage: '',
        notes: '',
        operator: ''
      },
      nutritionFormErrors: {},
      nutritionFormErrorList: []
    })
  },

  /**
   * 验证营养表单
   */
  validateNutritionForm(): boolean {
    const { nutritionFormData, selectedNutrition } = this.data
    const errors: { [key: string]: string } = {}

    // 必填字段验证
    if (!nutritionFormData.nutritionId || !selectedNutrition) {
      errors.nutritionId = '请选择营养品'
    }

    if (!nutritionFormData.quantity || nutritionFormData.quantity <= 0) {
      errors.quantity = '请输入正确的使用数量'
    } else if (selectedNutrition && nutritionFormData.quantity > selectedNutrition.stock) {
      errors.quantity = `库存不足，当前库存${selectedNutrition.stock}${selectedNutrition.unit}`
    }

    // 更新错误对象和错误列表
    const errorList = Object.values(errors)
    this.setData({ 
      nutritionFormErrors: errors,
      nutritionFormErrorList: errorList
    })

    if (errorList.length > 0) {
      wx.showToast({
        title: errorList[0],
        icon: 'error'
      })
      return false
    }

    return true
  },

  /**
   * 提交营养表单
   */
  async submitNutritionForm() {
    if (!this.validateNutritionForm()) {
      return
    }

    const selectedTask = this.data.selectedTask
    const { nutritionFormData } = this.data
    
    if (!selectedTask) {
      wx.showToast({
        title: '任务信息丢失',
        icon: 'error'
      })
      return
    }

    const batchId = selectedTask.batchId || selectedTask.batchNumber || this.data.selectedBatchId
    
    if (!batchId) {
      wx.showToast({
        title: '批次信息缺失',
        icon: 'error'
      })
      return
    }

    try {
      wx.showLoading({ title: '提交中...' })

      // 构建营养记录数据
      const recordData = {
        materialId: nutritionFormData.nutritionId,
        type: 'use',
        quantity: Number(nutritionFormData.quantity),
        targetLocation: selectedTask.title,
        operator: nutritionFormData.operator || '用户',
        status: '已完成',
        notes: `任务：${selectedTask.title}，批次：${batchId}${nutritionFormData.dosage ? '，剂量：' + nutritionFormData.dosage : ''}${nutritionFormData.notes ? '，备注：' + nutritionFormData.notes : ''}`,
        recordDate: new Date().toISOString().split('T')[0]
      }

      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'create_record',
          recordData: recordData
        }
      })

      if (result.result && result.result.success) {
        await this.completeNutritionTask(selectedTask._id, batchId)
        
        wx.hideLoading()
        wx.showToast({
          title: '营养使用记录已提交',
          icon: 'success'
        })

        this.closeNutritionFormPopup()
        // 📝 优化：统一使用 loadPreventionData 刷新任务列表
        if (this.data.preventionSubTab === 'today') {
          this.loadPreventionData()
        }

      } else {
        throw new Error(result.result?.message || '提交失败')
      }

    } catch (error: any) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 完成营养管理任务
   */
  async completeNutritionTask(taskId: string, batchId: string) {
    try {
      await wx.cloud.callFunction({
        name: 'breeding-todo',
        data: {
          action: 'completeTask',
          taskId: taskId,
          batchId: batchId,
          completedAt: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      })
    } catch (error: any) {
      console.error('完成任务失败:', error)
    }
  },

  /**
   * 阻止触摸移动事件冒泡
   */
  preventTouchMove() {
    return false
  }
})
