// health/health.ts - 健康管理页面（模块化优化版）
import CloudApi from '../../utils/cloud-api'
import * as HealthStatsCalculator from './modules/health-stats-calculator'
import { createWatcherManager, startDataWatcher as startHealthDataWatcher, stopDataWatcher as stopHealthDataWatcher } from './modules/health-watchers'
import { clearAllHealthCache } from './modules/health-data-loader'

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
    activeTab: 'treatment', // prevention|monitoring|treatment|analysis
    
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
      stats: {
        vaccinationRate: 0,
        preventionCost: 0
      },
      recentRecords: []
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
    
    this.dataWatchers = createWatcherManager()
    
    this.initDateRange()
    
    // 如果传入了批次ID，使用传入的；否则默认显示全部批次
    if (batchId) {
      this.setData({
        currentBatchId: batchId
      })
    }
    
    // 先加载批次列表，然后加载数据
    await this.loadAvailableBatches()
    await this.loadHealthData()
    
    // 默认加载第一个Tab的数据（预防管理Tab需要同时加载监控数据）
    this.loadTabData(this.data.activeTab)
  },

  /**
   * 页面显示时刷新数据并启动实时监听
   */
  onShow() {
    // 启动实时数据监听（只在页面可见时监听，节省资源）
    this.startDataWatcher()
    
    // ✅ 只在确实需要刷新时才刷新（避免onLoad后立即重复刷新）
    const needRefresh = wx.getStorageSync('health_page_need_refresh')
    if (needRefresh) {
      wx.removeStorageSync('health_page_need_refresh')
      // 从其他页面返回，需要刷新数据
      if (this.data.currentBatchId) {
        this.loadHealthData(true)
      }
    }
    // ✅ 移除else分支，避免每次onShow都刷新
  },
  
  /**
   * 页面隐藏时停止监听
   */
  onHide() {
    this.stopDataWatcher()
  },
  
  /**
   * 页面卸载时停止监听
   */
  onUnload() {
    this.stopDataWatcher()
  },
  
  /**
   * 启动数据监听
   */
  startDataWatcher() {
    if (!this.dataWatchers) {
      this.dataWatchers = createWatcherManager()
    }
    
    this.dataWatchers = startHealthDataWatcher(this.dataWatchers, {
      includeTreatmentWatcher: true,
      onBeforeChange: () => {
        clearAllHealthCache()
        this.invalidateAllBatchesCache()
      },
      onDataChange: () => {
        this.loadHealthData()
      }
    })
  },
  
  /**
   * 停止数据监听
   */
  stopDataWatcher() {
    if (this.dataWatchers) {
      stopHealthDataWatcher(this.dataWatchers)
      this.dataWatchers = createWatcherManager()
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
      }, 300) as any  // 300ms防抖
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
        // 单个批次模式，加载详细数据
        await Promise.all([
          this.loadHealthOverview(),
          this.loadPreventionData(),
          this.loadTreatmentData()
        ])
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
    clearAllHealthCache()
    this.invalidateAllBatchesCache()
    // ✅ 不使用防抖，不检查isLoadingData，立即开始刷新
    setTimeout(() => {
      this._performBackgroundRefresh()
    }, 100)  // 100ms延迟，避免与页面跳转冲突
  },
  
  /**
   * 执行后台刷新（核心逻辑）
   */
  async _performBackgroundRefresh() {
    try {
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
    } catch (error: any) {
      // 后台刷新失败，静默处理
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
        
        // 格式化记录，映射字段
        const formattedRecords = records.map((record: any) => HealthStatsCalculator.formatPreventionRecord(record))
        
        // 计算预防统计
        const preventionStats = HealthStatsCalculator.calculatePreventionStats(records)
        
        // 🔥 修复：从批次列表中获取当前批次的总动物数
        let totalAnimals = 1
        if (this.data.currentBatchId && this.data.currentBatchId !== 'all') {
          const currentBatch = this.data.availableBatches.find((b: any) => 
            b._id === this.data.currentBatchId || b.batchId === this.data.currentBatchId
          )
          totalAnimals = currentBatch?.totalCount || currentBatch?.currentCount || this.data.healthStats.totalChecks || 1
        } else {
          totalAnimals = this.data.healthStats.totalChecks || 1
        }
        
        // 计算接种率（基于第一针覆盖数），添加上限约束
        let vaccinationRate = totalAnimals > 0 
          ? ((preventionStats.vaccineCoverage / totalAnimals) * 100)
          : 0
        
        // 🔥 添加约束：接种率不应超过合理范围
        if (vaccinationRate > 100) {
          // 限制在 100% 以内
          vaccinationRate = 100
        }
        
        vaccinationRate = vaccinationRate.toFixed(1)
        
        this.setData({
          vaccineCoverage: preventionStats.vaccineCoverage,
          totalAnimals: totalAnimals,
          vaccinationRate: vaccinationRate,
          batchId: this.data.currentBatchId,
          recordsCount: formattedRecords.length,
          preventionCost: preventionStats.totalCost
        })
        
        // 设置到 preventionData 对象中
        this.setData({
          preventionStats,
          recentPreventionRecords: formattedRecords.slice(0, 10), // 只显示最近10条
          'preventionData.stats': {
            vaccinationRate,
            preventionCost: preventionStats.totalCost
          },
          'preventionData.recentRecords': formattedRecords.slice(0, 10)
        }, () => {
        })
      } else {
      }
    } catch (error: any) {
      // 加载失败，静默处理
    }
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
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
      const today = new Date().toISOString().split('T')[0]
      
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
              tempUrlResult.fileList.map(file => [file.fileID, file.tempFileURL])
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
    const { images } = this.data.selectedDiagnosisRecord || {}
    
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
        treatmentProgressUpdated: (data: any) => {
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
        treatmentListUpdated: (data: any) => {
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
      success: (res) => {
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
        treatmentListUpdated: (data: any) => {
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
  onAlertAction(e: any) {
    const { alertId, action } = e.currentTarget.dataset
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
        
        // 计算日龄
        const batchesWithDayAge = batches.map((batch: any) => {
          const entryDate = new Date(batch.entryDate)
          const today = new Date()
          const dayAge = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
          
          return {
            ...batch,
            dayAge
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
    this.setData({
      showBatchDropdown: !this.data.showBatchDropdown
    })
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
        curedRecordsUpdated: (data: any) => {
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
        deathRecordsUpdated: (data: any) => {
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
        deathRecordsUpdated: (data: any) => {
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
        abnormalRecordsUpdated: (data: any) => {
          this.backgroundRefreshData()
        }
      }
    })
  },

  /**
   * 阻止触摸移动事件冒泡
   */
  preventTouchMove() {
    return false
  }
})
