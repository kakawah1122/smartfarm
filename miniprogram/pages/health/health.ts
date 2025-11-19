// health/health.ts - 健康管理页面（模块化优化版）
import CloudApi from '../../utils/cloud-api'
import { formatTime, getCurrentBeijingDate } from '../../utils/util'
import { logger } from '../../utils/logger'
import * as HealthStatsCalculator from './modules/health-stats-calculator'
import { createWatcherManager, startDataWatcher as startHealthDataWatcher, stopDataWatcher as stopHealthDataWatcher } from './modules/health-watchers'
import { clearAllHealthCache, clearBatchCache } from './modules/health-data-loader'
import { isVaccineTask, isMedicationTask, isNutritionTask, groupTasksByBatch, calculateCurrentAge } from '../../utils/health-utils'
import { processImageUrls } from '../../utils/image-utils'
import { normalizeDiagnosisRecord, normalizeDiagnosisRecords, type DiagnosisRecord } from '../../utils/diagnosis-data-utils'
import { safeCloudCall, safeBatchCall } from '../../utils/safe-cloud-call'
import { optimizeSetData, restoreSetData } from '../../utils/setdata-optimizer'

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

function sortDiagnosisByRecency(records: DiagnosisRecord[]): DiagnosisRecord[] {
  const getTimeValue = (item: DiagnosisRecord): number => {
    const rawTime = item.createTime || item.diagnosisDate || ''
    if (!rawTime) return 0

    let parsed: number
    if (rawTime.includes('T')) {
      parsed = Date.parse(rawTime)
    } else {
      // 兼容 iOS：将 "YYYY-MM-DD HH:mm" 转换为可解析格式
      parsed = Date.parse(rawTime.replace(/-/g, '/'))
    }

    return Number.isNaN(parsed) ? 0 : parsed
  }

  return [...records].sort((a, b) => getTimeValue(b) - getTimeValue(a))
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
  originalQuantity?: number  // ✅ 原始入栏数（用于计算存活率）
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
  
  // 加载状态标志
  isLoadingPrevention?: boolean
  
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
    preventionSubTab: 'today', // today|upcoming|history
    
    // 健康统计数据
    healthStats: {
      totalChecks: 0,
      healthyCount: 0,
      sickCount: 0,
      deadCount: 0,
      healthyRate: '-',
      mortalityRate: '-',
      abnormalCount: 0,
      treatingCount: 0,
      originalQuantity: 0  // ✅ 原始入栏数
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
    
    // 任务详情字段多行状态
    taskFieldMultiline: {
      title: false,
      type: false,
      time: false,
      duration: false,
      materials: false,
      batch: false,
      age: false,
      description: false,
      dosage: false,
      notes: false
    } as Record<string, boolean>,
    
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
    
    // 异常反应处理弹窗数据
    showAdverseReactionPopup: false,
    adverseReactionData: {
      count: 0,
      symptoms: '',
      severityIndex: 0,
      treatment: '',
      followUp: ''
    },
    severityOptions: [
      { label: '轻微', value: 'mild' },
      { label: '中等', value: 'moderate' },
      { label: '严重', value: 'severe' }
    ],
    
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
    currentBatchStockQuantity: 0, // 当前批次存栏数量
    
    // 加载状态标志
    isLoadingPrevention: false,
    
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
        rate: '-',
        trend: 'stable',
        byStage: []
      },
      costAnalysis: {
        preventionCost: 0,
        treatmentCost: 0,
        totalCost: 0,
        feedingCost: 0
      }
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
   * ✅ 修复治疗记录缺少 _openid 的问题
   * 一次性修复，为已有记录添加 _openid 字段
   */
  async fixTreatmentRecordsOpenId() {
    try {
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'fix_treatment_records_openid'
        }
      })
      
      if (result?.success && result?.fixedCount > 0) {
        // 修复后刷新数据
        this.invalidateAllBatchesCache()
      }
    } catch (error) {
      console.error('修复治疗记录失败:', error)
      // 静默处理，不影响页面加载
    }
  },

  /**
   * 页面加载
   */
  async onLoad(options: any) {
    // ✅ 启用setData批量优化器，减少渲染次数
    optimizeSetData(this, {
      delay: 16,    // 一帧的时间（16ms）
      maxWait: 100  // 最大等待100ms，保证响应性
    })
    
    // ✅ 修复已有数据的 _openid 问题（一次性修复）
    this.fixTreatmentRecordsOpenId()
    
    // ✅ 性能优化：延迟初始化，确保页面快速响应
    wx.nextTick(() => {
      this.initializePage(options)
    })
  },
  
  /**
   * ✅ 初始化页面
   */
  async initializePage(options: any) {
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
    
    // ✅ 性能优化：并行加载基础数据，提升加载速度
    try {
      // 显示加载状态
      this.setData({ loading: true })
      
      // 并行加载批次列表和健康数据
      await Promise.all([
        this.loadAvailableBatches(),
        this.loadHealthData(true) // 静默加载，避免重复loading
      ])
      
      // 加载当前标签的数据
      await this.loadTabData(this.data.activeTab)
      
    } catch (error: any) {
      console.error('[onLoad] 页面加载失败:', error)
      wx.showToast({
        title: '页面加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 页面显示时刷新数据并启动实时监听（✅ 优化：增加EventChannel监听）
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
    
    // ✅ 检查是否需要刷新（包括EventChannel事件和Storage标志）
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
    
    // ✅ 恢复原始的setData方法，避免内存泄漏
    restoreSetData(this)
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
          clearBatchCache('all')
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

  stopDataWatcher() {
    if (!this.dataWatchers) {
      return
    }

    stopHealthDataWatcher(this.dataWatchers)
    this.dataWatchers = null
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
        start: formatTime(start, 'date'),
        end: formatTime(end, 'date')
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
    // 如果healthStats.originalQuantity未设置，先加载健康数据
    if (tab === 'analysis' && !this.data.healthStats.originalQuantity) {
      await this.loadHealthData(true)  // 静默加载健康数据
      // 等待setData完成
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
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
      const snapshotResult = await safeCloudCall({
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

      if (!snapshotResult || !snapshotResult.success) {
        throw new Error('获取健康面板数据失败')
      }

      const rawData = snapshotResult.data || {}

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
        originalTotalQuantity: Number(rawData.originalTotalQuantity ?? 0) || 0,  // ✅ 保存原始入栏总数
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
      
      // ✅ 获取预防统计数据
      const preventionResult = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'getPreventionDashboard',
          batchIds: [],  // 空数组表示查询全部批次
          today: formatTime(new Date(), 'date')
        }
      })

      const preventionResponse = preventionResult as any
      let preventionStats = {
        totalPreventions: 0,
        vaccineCount: 0,
        vaccineCoverage: 0,
        medicationCount: 0,
        vaccineStats: {},
        disinfectionCount: 0,
        totalCost: 0
      }
      
      if (preventionResponse?.success && preventionResponse.data?.stats) {
        preventionStats = {
          totalPreventions: 0,
          vaccineCount: preventionResponse.data.stats.vaccineCount || 0,
          vaccineCoverage: preventionResponse.data.stats.vaccineCoverage || 0,
          medicationCount: preventionResponse.data.stats.medicationCount || 0,
          vaccineStats: {},
          disinfectionCount: 0,
          totalCost: preventionResponse.data.stats.preventionCost || 0
        }
      }

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

      const vaccinationRate = healthData.totalAnimals > 0
        ? ((preventionStats.vaccineCoverage / healthData.totalAnimals) * 100).toFixed(1)
        : 0

      // ✅ 获取原始入栏数（全部批次模式）
      const originalQuantity = healthData.originalTotalQuantity || 0
      
      this.setData({
        healthStats: {
          totalChecks: healthData.totalAnimals,
          healthyCount: healthData.actualHealthyCount,
          sickCount: healthData.sickCount,
          deadCount: healthData.deadCount,
          // ✅ 统一判断逻辑：基于原始入栏数
          healthyRate: originalQuantity > 0 ? (healthData.healthyRate + '%') : '-',
          mortalityRate: originalQuantity > 0 ? (healthData.mortalityRate + '%') : '-',
          abnormalCount: healthData.abnormalRecordCount,
          treatingCount: healthData.totalOngoingRecords,
          originalQuantity: originalQuantity  // ✅ 保存原始入栏数
        },
        preventionStats,
        'preventionData.stats': {
          vaccinationRate,
          vaccineCount: preventionStats.vaccineCount,
          medicationCount: preventionStats.medicationCount,
          vaccineCoverage: preventionStats.vaccineCoverage,
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
        'treatmentData.stats.recoveredCount': healthData.totalCured,  // ✅ 修复：添加治愈数
        'treatmentData.stats.deadCount': healthData.deadCount || healthData.totalDied || 0,  // ✅ 修复：添加死亡数
        'treatmentData.diagnosisHistory': normalizeDiagnosisRecords(healthData.latestDiagnosisRecords),
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
      const currentHealthyRateStr = this.data.healthStats.healthyRate
      const currentHealthyRate = currentHealthyRateStr === '-' ? 0 : parseFloat(currentHealthyRateStr)
      const newHealthyRate = parseFloat(healthData.healthyRate)
      
      if (Math.abs(currentHealthyRate - newHealthyRate) < 0.01) {
        // 健康率变化小于0.01%，跳过更新
        return
      }
      
      // ✅ 获取原始入栏数（全部批次模式）
      const originalQuantity = healthData.originalTotalQuantity || 0
      
      // 静默更新数据（不影响用户操作）
      this.setData({
        'healthStats.totalChecks': healthData.totalAnimals,
        'healthStats.healthyCount': healthData.actualHealthyCount,
        'healthStats.sickCount': healthData.sickCount,
        'healthStats.deadCount': healthData.deadCount,
        // ✅ 统一判断逻辑：基于原始入栏数
        'healthStats.healthyRate': originalQuantity > 0 ? (healthData.healthyRate + '%') : '-',
        'healthStats.mortalityRate': originalQuantity > 0 ? (healthData.mortalityRate + '%') : '-',
        'healthStats.abnormalCount': healthData.abnormalRecordCount,
        'healthStats.treatingCount': healthData.totalOngoingRecords,
        'healthStats.originalQuantity': originalQuantity,  // ✅ 保存原始入栏数
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
        'treatmentData.stats.recoveredCount': healthData.totalCured,  // ✅ 修复：添加治愈数
        'treatmentData.stats.deadCount': healthData.deadCount || healthData.totalDied || 0,  // ✅ 修复：添加死亡数
        'treatmentData.diagnosisHistory': sortDiagnosisByRecency(normalizeDiagnosisRecords(healthData.latestDiagnosisRecords || [])),
        'monitoringData.realTimeStatus.abnormalCount': healthData.abnormalRecordCount,
        'monitoringData.abnormalList': sortDiagnosisByRecency(normalizeDiagnosisRecords(healthData.abnormalRecords || []))
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
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'get_batch_complete_data',
          batchId: this.data.currentBatchId,
          includes: ['prevention', 'treatment', 'diagnosis', 'abnormal', 'pending_diagnosis'],
          diagnosisLimit: 10,
          preventionLimit: 20
        }
      })
      
      if (!result || !result.success) {
        throw new Error('获取批次数据失败')
      }
      
      const data = result.data
      
      // 处理健康统计
      const healthStats = data.healthStats || {}
      
      // 处理预防统计
      const preventionStats = data.preventionStats || {
        totalPreventions: 0,
        vaccineCount: 0,
        vaccineCoverage: 0,
        vaccineStats: {},
        disinfectionCount: 0,
        totalCost: 0,
        medicationCount: 0  // 新增：用药类型的记录数量
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
      
      // ✅ 处理诊断历史：使用公共工具函数标准化数据
      const diagnosisHistory = sortDiagnosisByRecency(normalizeDiagnosisRecords(data.diagnosisHistory || []))
      
      // 处理异常记录
      const abnormalRecords = data.abnormalRecords || []
      const abnormalCount = data.abnormalCount || 0
      
      // 待诊断数量
      const pendingDiagnosisCount = data.pendingDiagnosisCount || 0
      
      // ✅ 获取原始入栏数（单批次模式）
      // 单批次模式下，originalQuantity 可能来自批次数据或 healthStats
      const originalQuantity = (healthStats as any).originalQuantity || 
                                (data.batchInfo?.quantity) || 
                                healthStats.totalChecks || 0
      
      // ✅ 一次性更新所有数据（避免多次setData）
      // ✅ 使用数据路径形式更新对象属性，符合微信小程序最佳实践
      this.setData({
        // 健康统计 - 使用数据路径形式更新对象属性
        'healthStats.totalChecks': healthStats.totalChecks || 0,
        'healthStats.healthyCount': healthStats.healthyCount || 0,
        'healthStats.sickCount': healthStats.sickCount || 0,
        'healthStats.deadCount': healthStats.deadCount || 0,
        // ✅ 统一判断逻辑：基于原始入栏数
        'healthStats.healthyRate': originalQuantity > 0 ? ((healthStats.healthyRate || 0) + '%') : '-',
        'healthStats.mortalityRate': originalQuantity > 0 ? ((healthStats.mortalityRate || 0) + '%') : '-',
        'healthStats.abnormalCount': abnormalCount,
        'healthStats.treatingCount': treatmentStats.ongoingCount || 0,
        'healthStats.originalQuantity': originalQuantity,  // ✅ 保存原始入栏数
        
        // 预防数据 - 使用数据路径形式
        'preventionStats.totalPreventions': preventionStats.totalPreventions || 0,
        'preventionStats.vaccineCount': preventionStats.vaccineCount || 0,
        'preventionStats.vaccineCoverage': preventionStats.vaccineCoverage || 0,
        'preventionStats.disinfectionCount': preventionStats.disinfectionCount || 0,
        'preventionStats.totalCost': preventionStats.totalCost || 0,
        recentPreventionRecords: preventionRecords.slice(0, 10),
        'preventionData.stats.vaccinationRate': vaccinationRate.toFixed(1),
        'preventionData.stats.preventionCost': preventionStats.totalCost,
        'preventionData.stats.vaccineCount': preventionStats.vaccineCount || 0,
        'preventionData.stats.vaccineCoverage': preventionStats.vaccineCoverage || 0,
        'preventionData.stats.medicationCount': preventionStats.medicationCount || 0,
        'preventionData.recentRecords': preventionRecords.slice(0, 10),
        
        // 治疗数据 - 使用数据路径形式
        'treatmentData.stats.pendingDiagnosis': pendingDiagnosisCount,
        'treatmentData.stats.ongoingTreatment': treatmentStats.ongoingCount || 0,
        'treatmentData.stats.totalTreatmentCost': parseFloat((treatmentStats.totalCost || 0).toString()),
        'treatmentData.stats.cureRate': parseFloat((treatmentStats.cureRate || '0').toString()),
        'treatmentData.stats.ongoingAnimalsCount': treatmentStats.ongoingAnimalsCount || 0,
        'treatmentData.diagnosisHistory': diagnosisHistory,
        'treatmentStats.totalTreatments': treatmentStats.totalTreated || 0,
        'treatmentStats.totalCost': parseFloat((treatmentStats.totalCost || 0).toString()),
        'treatmentStats.recoveredCount': treatmentStats.totalCuredAnimals || 0,
        'treatmentStats.ongoingCount': treatmentStats.ongoingCount || 0,
        'treatmentStats.recoveryRate': (treatmentStats.cureRate || 0) + '%',
        
        // 监控数据 - 使用数据路径形式
        'monitoringData.realTimeStatus.abnormalCount': abnormalCount,
        'monitoringData.abnormalList': sortDiagnosisByRecency(normalizeDiagnosisRecords(abnormalRecords))
      })
      
    } catch (error: any) {
      logger.error('加载批次数据失败:', error)
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
        
        // ✅ 优化：使用数据路径形式更新对象属性，符合微信小程序最佳实践
        // 避免使用展开运算符替换整个对象，减少不必要的渲染
        this.setData({
          'healthStats.healthyRate': (healthStats.totalChecks > 0) ? (healthStats.healthyRate + '%') : '-',
          'healthStats.mortalityRate': (healthStats.totalChecks > 0) ? (healthStats.mortalityRate + '%') : '-',
          'healthStats.abnormalCount': healthStats.abnormalCount || 0,
          'healthStats.treatingCount': healthStats.treatingCount || 0,
          'healthStats.originalQuantity': healthStats.originalQuantity || 0,  // ✅ 确保原始入栏数也被更新
          recentPreventionRecords: recentPrevention || [],
          activeHealthAlerts: activeAlerts || [],
          'treatmentStats.recoveryRate': treatmentStats.recoveryRate + '%'
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
    
    // ✅ 性能优化：添加加载状态，避免重复请求
    if (this.isLoadingPrevention) {
      return
    }
    this.isLoadingPrevention = true
    
    try {
      // ✅ 使用循环实现重试，避免递归调用导致的作用域问题
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          // 调用新的预防管理仪表盘云函数
          const result = await safeCloudCall({
            name: 'health-management',
            data: {
              action: 'getPreventionDashboard',
              batchId: this.data.currentBatchId || 'all'
            }
          })

      const response = result as any

        // 🔍 详细错误日志
        if (!response.success) {
          lastError = response
          logger.error('[loadPreventionData] 云函数返回失败:', {
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
            vaccineCoverage: 0,
            medicationCount: 0
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
            totalCost: dashboardData.stats?.preventionCost || 0,
            medicationCount: dashboardData.stats?.medicationCount || 0
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
      logger.error('[loadPreventionData] 加载预防管理数据失败:', error)
        
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
    logger.error('[loadPreventionData] 最终失败', { errorCode, errorMsg })
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
    } finally {
      this.isLoadingPrevention = false
    }
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
          id: groupKey, // 添加唯一ID
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
    safeCloudCall({
      name: 'breeding-todo',
      data: {
        action: 'cleanOrphanTasks'
      }
    }).then((result: any) => {
      const response = result as any
      // 后台清理孤儿任务，不显示日志
      if (response.success && response.data && response.data.deletedCount > 0) {
        // 静默清理完成
      }
    }).catch((error: any) => {
      logger.error('清理孤儿任务失败:', error)
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
            recoveredCount: aggregatedData.totalCured || 0,  // ✅ 治愈数（统一数据源）
            deadCount: aggregatedData.deadCount || 0,  // ✅ 死亡数（统一数据源）
            totalTreatmentCost: aggregatedData.totalTreatmentCost || 0,
            cureRate: parseFloat((aggregatedData.cureRate || '0').toString()),
            ongoingAnimalsCount: aggregatedData.totalOngoing || 0
          },
          'treatmentStats.totalTreatments': aggregatedData.totalTreated || 0,
          'treatmentStats.totalCost': aggregatedData.totalTreatmentCost || 0,
          'treatmentStats.recoveredCount': aggregatedData.totalCured || 0,  // 保持向后兼容
          'treatmentStats.ongoingCount': aggregatedData.totalOngoingRecords || 0,
          'treatmentStats.recoveryRate': (aggregatedData.cureRate || 0) + '%',
          'treatmentData.diagnosisHistory': sortDiagnosisByRecency(normalizeDiagnosisRecords(aggregatedData.latestDiagnosisRecords || [])),
          'monitoringData.realTimeStatus.abnormalCount': aggregatedData.abnormalRecordCount || 0,
          'monitoringData.abnormalList': sortDiagnosisByRecency(normalizeDiagnosisRecords(aggregatedData.abnormalRecords || []))
        })

        return
      }

      // ✅ 优化：并行执行所有API调用，提升加载速度
      
      // 准备所有API调用参数
      const batchId = this.data.currentBatchId === 'all' ? undefined : this.data.currentBatchId
      
      // 1. ✅ 优化：使用专门的统计API获取待处理诊断数量（不获取记录详情）
      const pendingDiagnosisParams: any = {
        action: 'get_pending_diagnosis_count'  // ✅ 使用专门的统计API
      }
      if (batchId) {
        pendingDiagnosisParams.batchId = batchId
      }
      
      // 2. 计算治疗总成本和治愈率
      const costParams: any = {
        action: 'calculate_treatment_cost',
        dateRange: this.data.dateRange
      }
      if (batchId) {
        costParams.batchId = batchId
      }
      
      // 3. 获取异常记录（仅用于列表显示，不用于统计）
      const abnormalParams: any = {
        action: 'get_abnormal_records'
      }
      if (batchId) {
        abnormalParams.batchId = batchId
      }
      
      // 4. 获取历史诊断记录（近7天，用于诊断记录列表展示）
      // ✅ 诊断记录不受批次筛选影响，始终显示所有批次的记录
      const diagnosisParams: any = {
        action: 'get_diagnosis_history',
        page: 1,
        pageSize: 10  // 只取最近10条用于首页展示
        // 注意：不传递 batchId，显示所有批次的诊断记录
      }
      
      // ✅ 并行执行所有API调用（优化：减少总耗时）
      let pendingDiagnosisResult: any, costResult: any, abnormalResult: any, diagnosisResult: any
      let costData: any = {}
      
      if (aggregatedStats) {
        // 如果已有聚合数据，只并行执行必要的调用
        [pendingDiagnosisResult, abnormalResult, diagnosisResult] = await Promise.all([
          safeCloudCall({ name: 'ai-diagnosis', data: pendingDiagnosisParams }),
          safeCloudCall({ name: 'health-management', data: abnormalParams }),
          safeCloudCall({ name: 'ai-diagnosis', data: diagnosisParams })
        ])
        costData = {
          totalCost: aggregatedStats.totalCost,
          totalTreated: aggregatedStats.totalTreated,
          totalCuredAnimals: aggregatedStats.totalCured,
          ongoingCount: aggregatedStats.ongoingCount,
          ongoingAnimalsCount: aggregatedStats.ongoingAnimalsCount,
          cureRate: aggregatedStats.cureRate
        }
      } else {
        // ✅ 并行执行所有4个API调用（使用批量优化）
        [pendingDiagnosisResult, costResult, abnormalResult, diagnosisResult] = await safeBatchCall([
          { name: 'ai-diagnosis', data: pendingDiagnosisParams },
          { name: 'health-management', data: costParams },
          { name: 'health-management', data: abnormalParams },
          { name: 'ai-diagnosis', data: diagnosisParams }
        ])
        
        costData = costResult?.success
          ? costResult.data
          : {}
      }
      
      // ✅ 从统计API获取待处理数量（优化：直接获取数量，无需过滤）
      const pendingDiagnosisCount = pendingDiagnosisResult?.success
        ? (pendingDiagnosisResult.data?.pendingCount || 0)
        : 0
      
      // 处理异常记录数据
      const abnormalRecords = abnormalResult?.success 
        ? (abnormalResult.data || [])
        : []
      
      // ✅ 处理诊断历史记录：使用公共工具函数标准化数据
      const diagnosisHistory = diagnosisResult?.success 
        ? normalizeDiagnosisRecords(diagnosisResult.data?.records || [])
        : []
      
      // ✅ 统一更新治疗相关数据（优化：统一数据源到treatmentData.stats）
      const totalCost = parseFloat((costData.totalCost ?? 0).toString())
      const cureRate = parseFloat((costData.cureRate ?? '0').toString())
      
      // ✅ 从云函数返回的 costData 中获取死亡数（统一数据源）
      const deadCount = costData.deadCount || costData.totalDiedAnimals || 0
      
      this.setData({
        // ✅ 主要统计数据（treatmentData.stats）- 统一数据源
        'treatmentData.stats': {
          pendingDiagnosis: pendingDiagnosisCount,  // AI诊断待处理数量（没有治疗方案的诊断记录数）
          ongoingTreatment: costData.ongoingCount || 0,  // 治疗中记录数
          recoveredCount: costData.totalCuredAnimals || 0,  // ✅ 治愈数（统一到treatmentData.stats）
          deadCount: deadCount,  // ✅ 死亡数（统一到treatmentData.stats）
          totalTreatmentCost: totalCost,  // 总治疗成本
          cureRate: cureRate,  // 治愈率（0-100）
          ongoingAnimalsCount: costData.ongoingAnimalsCount || 0  // 治疗中动物数量
        },
        // 卡片显示统计数据（treatmentStats，保持向后兼容）
        'treatmentStats.totalTreatments': costData.totalTreated || 0,
        'treatmentStats.totalCost': totalCost,
        'treatmentStats.recoveredCount': costData.totalCuredAnimals || 0,  // 保持向后兼容
        'treatmentStats.ongoingCount': costData.ongoingCount || 0,
        'treatmentStats.recoveryRate': (costData.cureRate || 0) + '%',
        // 诊断历史记录（近7天）
        'treatmentData.diagnosisHistory': diagnosisHistory,
        // 异常记录数据（用于异常记录列表）
        'monitoringData.realTimeStatus.abnormalCount': abnormalRecords.length,
        'monitoringData.abnormalList': abnormalRecords
      })
      
  } catch (error: any) {
    wx.showToast({
      title: '治疗数据加载失败',
      icon: 'error'
    })
      // 出错时重置为默认值
      this.setData({
        'treatmentData.stats': {
          pendingDiagnosis: 0,
          ongoingTreatment: 0,
          recoveredCount: 0,  // ✅ 统一数据源
          deadCount: 0,  // ✅ 统一数据源
          totalTreatmentCost: 0,
          cureRate: 0,
          ongoingAnimalsCount: 0
        },
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
   * 诊断记录点击事件 - ✅ 使用公共工具函数处理
   */
  async onDiagnosisRecordTap(e: any) {
    // ✅ 防重复点击：500ms内只允许点击一次
    const now = Date.now()
    if (now - this.lastClickTime < 500) {
      return
    }
    this.lastClickTime = now
    
    const { record } = e.currentTarget.dataset
    
    // ✅ 使用公共工具函数标准化数据
    const normalizedRecord = normalizeDiagnosisRecord(record)
    
    // ✅ 使用公共工具函数处理图片URL（只处理 cloud:// 开头的URL）
    const processedImages = await processImageUrls(normalizedRecord.images || [], {
      onlyCloudFiles: true,
      showErrorToast: true
    })
    
    // ✅ 显示详情弹窗
    this.setData({
      showDiagnosisDetailPopup: true,
      selectedDiagnosisRecord: {
        ...normalizedRecord,
        images: processedImages
      }
    })
  },

  /**
   * 关闭诊断详情弹窗（✅优化：延迟清空数据，避免关闭动画时数据闪烁）
   */
  onCloseDiagnosisDetail() {
    this.setData({
      showDiagnosisDetailPopup: false
    })
    // ✅ 延迟清空数据，避免关闭动画时数据闪烁（符合项目开发规范）
    setTimeout(() => {
      this.setData({
        selectedDiagnosisRecord: null
      })
    }, 300)
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
    
    // ✅ 进入诊断历史页面，显示所有批次的诊断记录
    wx.navigateTo({
      url: `/packageAI/diagnosis-history/diagnosis-history`
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
   * 加载分析数据（✅优化：修复存活率计算逻辑，确保数据加载顺序）
   */
  async loadAnalysisData() {
    try {
      // ✅ 确保有健康统计数据
      if (!this.data.healthStats || this.data.healthStats.totalChecks === 0) {
        await this.loadHealthData()
      }
      
      // 检查是否有有效的入栏数据
      const totalAnimals = this.data.healthStats?.totalChecks || 0
      const hasData = totalAnimals > 0
      
      // ✅ 存活率计算逻辑（增强容错）
      let survivalRate: string | number = '-'
      let trend = 'stable'
      
      if (hasData) {
        // ✅ 获取原始入栏数，优先使用 originalQuantity，避免回退到 totalAnimals（当前存活数）
        let originalQuantity = this.data.healthStats.originalQuantity || 0
        const deadCount = this.data.healthStats.deadCount || 0
        
        // ✅ 容错：如果 originalQuantity 为 0，尝试从totalChecks + deadCount估算
        if (originalQuantity === 0) {
          // 如果有总数和死亡数，可以尝试计算
          if (totalAnimals > 0 || deadCount > 0) {
            originalQuantity = totalAnimals + deadCount
            logger.info('存活率计算：使用totalChecks + deadCount估算', {
              totalAnimals,
              deadCount,
              estimated: originalQuantity
            })
          }
        }
        
        if (originalQuantity > 0) {
          const survivalCount = originalQuantity - deadCount
          survivalRate = ((survivalCount / originalQuantity) * 100).toFixed(1)
          
          const mortalityRate = (deadCount / originalQuantity) * 100
          trend = mortalityRate < 1 ? 'improving' : mortalityRate < 3 ? 'stable' : 'declining'
        } else {
          survivalRate = '-'
          // ✅ 调试日志：记录为什么显示 "-"
          logger.info('存活率显示"-"，原因：无法计算originalQuantity', {
            healthStats: this.data.healthStats,
            totalAnimals,
            deadCount,
            hasData,
            currentBatchId: this.data.currentBatchId
          })
        }
      }
      
      // ✅ 优化：根据批次模式使用不同的 API 获取最新成本数据
      const batchId = this.data.currentBatchId || 'all'
      const isAllBatches = batchId === 'all'
      
      // 并行获取所有成本数据
      let preventionPromise: Promise<any>
      
      if (isAllBatches) {
        // 全部批次模式：使用 getPreventionDashboard
        preventionPromise = safeCloudCall({
          name: 'health-management',
          data: {
            action: 'getPreventionDashboard',
            batchId: 'all'
          }
        })
      } else {
        // 单批次模式：使用 get_batch_complete_data
        preventionPromise = safeCloudCall({
          name: 'health-management',
          data: {
            action: 'get_batch_complete_data',
            batchId: batchId,
            includes: ['prevention']
          }
        })
      }
      
      const [preventionResult, feedCostResult] = await Promise.all([
        preventionPromise,
        // 获取饲养成本
        safeCloudCall({
          name: 'finance-management',
          data: {
            action: 'get_cost_stats',
            dateRange: this.data.dateRange,
            batchId: batchId,
            batchNumber: (this.data.currentBatchNumber && this.data.currentBatchNumber !== '全部批次') ? this.data.currentBatchNumber : undefined
          }
        })
      ])
      
      // 提取预防成本（根据不同的响应结构）
      let preventionCost = 0
      if (isAllBatches) {
        // 全部批次模式的响应结构
        if (preventionResult?.success && preventionResult.data?.stats) {
          preventionCost = preventionResult.data.stats.preventionCost || 0
        }
      } else {
        // 单批次模式的响应结构
        if (preventionResult?.success && preventionResult.data?.preventionStats) {
          preventionCost = preventionResult.data.preventionStats.totalCost || 0
        }
      }
      
      // ✅ 修复：获取治疗成本（不依赖页面数据，直接从云函数获取）
      let treatmentCost = 0
      try {
        const treatmentCostResult = await safeCloudCall({
          name: 'health-management',
          data: {
            action: 'calculate_treatment_cost',
            dateRange: this.data.dateRange,
            batchId: batchId
          }
        })
        
        if (treatmentCostResult?.success) {
          treatmentCost = treatmentCostResult.data?.totalCost || 0
        }
      } catch (error) {
        console.error('获取治疗成本失败:', error)
        // 降级方案：从页面已有数据获取
        treatmentCost = this.data.treatmentData?.stats?.totalTreatmentCost || 0
      }
      
      // 提取饲养成本
      let feedingCost = 0
      if (feedCostResult?.success) {
        feedingCost = feedCostResult.data.feedCost || 0
      }
      
      // 计算总成本
      const totalCost = preventionCost + treatmentCost + feedingCost
      
      // 更新分析数据
      this.setData({
        'analysisData.survivalAnalysis': {
          rate: survivalRate,
          trend: trend,
          byStage: []
        },
        'analysisData.costAnalysis': {
          preventionCost: preventionCost,
          treatmentCost: treatmentCost,
          totalCost: totalCost,
          feedingCost: feedingCost
        }
      })
    } catch (error: any) {
      logger.error('加载分析数据失败:', error)
      // ✅ 错误时设置默认值，避免显示错误数据
      this.setData({
        'analysisData.survivalAnalysis': {
          rate: '-',
          trend: 'stable',
          byStage: []
        },
        'analysisData.costAnalysis': {
          preventionCost: 0,
          treatmentCost: 0,
          totalCost: 0,
          feedingCost: 0
        }
      })
    }
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
        // 📝 优化：统一使用 loadPreventionData 作为唯一数据源
        // ✅ 修复：空数组是正常状态（没有任务），不应该显示错误提示
        // loadPreventionData 内部已经处理了错误情况并显示提示
        if (!this.data.todayTasksByBatch || this.data.todayTasksByBatch.length === 0) {
          await this.loadPreventionData()
          // 不再检查 todayTasksByBatch 是否为空，因为：
          // 1. 如果加载成功但为空，这是正常状态（会显示"暂无进行中的任务"）
          // 2. 如果加载失败，loadPreventionData 内部已经显示了错误提示
        }
        break
      case 'upcoming':
        this.loadUpcomingTasks()
        break
      case 'history':
        this.loadHistoryTasks()
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
      const batchResult = await safeCloudCall({
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
      const result = await safeCloudCall({
        name: 'breeding-todo',
        data: {
          action: 'getTodos',
          batchId: this.data.currentBatchId,
          dayAge: dayAge  // 只查询当日日龄的任务
        }
      })

      const response = result as any
      
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
      logger.error('加载单批次今日任务失败:', error)
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
      // 获取活跃批次（使用缓存优化）
      const batchResult = await safeCloudCall({
        name: 'production-entry',
        data: { action: 'getActiveBatches' },
        useCache: true  // 自动缓存10分钟
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
          const result = await safeCloudCall({
            name: 'breeding-todo',
            data: {
              action: 'getTodos',
              batchId: batch._id,
              dayAge: dayAge  // 只查询当日日龄的任务
            }
          })
          
          const response = result as any
          
          if (response.success && response.data && response.data.length > 0) {
            const tasks = Array.isArray(response.data) ? response.data : []
            
            const normalizedTasks = tasks.map((task: any) =>
              this.normalizeTask(task, {
                batchNumber: batch.batchNumber || batch._id,
                dayAge: task.dayAge || dayAge
              })
            )
            
            return {
              id: `${batch._id}_${dayAge}`, // 添加唯一ID
              batchId: batch._id,
              batchNumber: batch.batchNumber || batch._id,
              dayAge: dayAge,
              tasks: normalizedTasks
            }
          } else {
            return null
          }
        } catch (error) {
          logger.error(`批次 ${batch._id} 任务加载失败:`, error)
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
      logger.error('[loadAllBatchesTodayTasks] 加载所有批次今日任务失败:', error)
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
      // 获取批次信息以计算当前日龄（使用缓存优化）
      const batchResult = await safeCloudCall({
        name: 'production-entry',
        data: { action: 'getActiveBatches' },
        useCache: true  // 自动缓存10分钟
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
          id: `${this.data.currentBatchId}_${group.dayAge}`, // 添加唯一ID
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
      // 获取活跃批次（使用缓存优化）
      const batchResult = await safeCloudCall({
        name: 'production-entry',
        data: { action: 'getActiveBatches' },
        useCache: true  // 自动缓存10分钟
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
              id: `${batchId}_${taskDayAge}`, // 添加唯一ID
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
          const batchResult = await safeCloudCall({
            name: 'production-entry',
            data: { action: 'getActiveBatches' },
            useCache: true  // 自动缓存10分钟
          })
          if (batchResult?.success) {
            const activeBatches = batchResult.data || []
            validBatchIds = activeBatches.map((b: any) => b._id)
          }
        } catch (error) {
          logger.error('[历史任务] 获取批次列表失败:', error)
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
        type CompletedTaskItem = {
          _id: string
          id: string
          taskId: string
          title: string
          taskName: string
          type: string
          completedAt: string
          completedDate: string
          completedTimestamp: number
          completedBy: string
          batchNumber: string
          batchId: string
          dayAge: number
          completed: boolean
          description: string
          notes: string
        }

        const parseTimestamp = (value: unknown, fallback?: unknown): number => {
          const parseStringDate = (text: string): number => {
            if (!text) {
              return Number.NaN
            }

            const trimmed = text.trim()
            if (!trimmed) {
              return Number.NaN
            }

            const isoLike = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
            const parsedIso = Date.parse(isoLike)
            if (!Number.isNaN(parsedIso)) {
              return parsedIso
            }

            const parsedSlash = Date.parse(trimmed.replace(/-/g, '/'))
            if (!Number.isNaN(parsedSlash)) {
              return parsedSlash
            }

            return Number.NaN
          }

          const convertToTimestamp = (input: unknown): number => {
            if (input == null) {
              return Number.NaN
            }

            if (typeof input === 'number') {
              return Number.isFinite(input) ? input : Number.NaN
            }

            if (input instanceof Date) {
              return input.getTime()
            }

            if (typeof input === 'string') {
              return parseStringDate(input)
            }

            if (typeof input === 'object') {
              const candidate = input as Record<string, unknown>

              if (typeof candidate.getTime === 'function') {
                const timeValue = (candidate.getTime as () => unknown)()
                if (typeof timeValue === 'number') {
                  return timeValue
                }
              }

              if (typeof candidate.milliseconds === 'number') {
                return candidate.milliseconds
              }

              if (typeof candidate.seconds === 'number') {
                return candidate.seconds * 1000
              }

              if (typeof candidate.timestamp === 'number') {
                return candidate.timestamp
              }

              if (typeof candidate.time === 'number') {
                return candidate.time
              }

              if (typeof candidate.$date === 'number') {
                return candidate.$date
              }

              if (typeof candidate.$numberLong === 'string') {
                const parsedLong = Number(candidate.$numberLong)
                return Number.isNaN(parsedLong) ? Number.NaN : parsedLong
              }
            }

            return Number.NaN
          }

          const primary = convertToTimestamp(value)
          if (!Number.isNaN(primary)) {
            return primary
          }

          const fallbackTimestamp = convertToTimestamp(fallback)
          if (!Number.isNaN(fallbackTimestamp)) {
            return fallbackTimestamp
          }

          return 0
        }

        const completedTasks: CompletedTaskItem[] = result.data.map((task: any): CompletedTaskItem => {
          const completedAt = task.completedAt || ''
          const completedTimestamp = parseTimestamp(completedAt, task.createdAt || task.createTime)
          const completedDate = completedTimestamp > 0 ? formatTime(new Date(completedTimestamp), 'datetime') : ''

          return {
            _id: task._id,
            id: task._id,
            taskId: task.taskId || task._id,
            title: task.title || task.taskName,
            taskName: task.title || task.taskName,
            type: task.type || task.taskType,
            completedAt,
            completedDate,
            completedTimestamp,
            completedBy: task.completedBy || '用户',
            batchNumber: task.batchNumber || task.batchId,
            batchId: task.batchId,
            dayAge: task.dayAge || 0,
            completed: true,
            description: task.description || '',
            notes: task.notes || task.completionNotes || ''
          }
        })

        // ✅ 按完成时间重新排序（在内存中排序）
        completedTasks.sort((a: CompletedTaskItem, b: CompletedTaskItem) => b.completedTimestamp - a.completedTimestamp)

        // 按批次分组
        const historyTasksByBatch = this.groupHistoryTasksByBatch(completedTasks)
        this.setData({ historyTasksByBatch })
      } else {
        this.setData({ historyTasksByBatch: [] })
      }

    } catch (error) {
      logger.error('加载历史任务失败:', error)
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
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'getPreventionTimeline',
          batchId: batchId
        }
      })
      
      const response = result as any
      if (response.success && response.data) {
        this.setData({
          timelineData: response.data
        })
      } else {
        throw new Error(response.message || '加载失败')
      }
    } catch (error: any) {
      logger.error('加载预防时间线失败:', error)
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
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'getBatchPreventionComparison'
        }
      })
      
      const response = result as any
      if (response.success && response.data) {
        this.setData({
          comparisonData: response.data
        })
      } else {
        throw new Error(response.message || '加载失败')
      }
    } catch (error: any) {
      logger.error('加载批次对比数据失败:', error)
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
        start: formatTime(start, 'date'),
        end: formatTime(end, 'date')
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
   * 关闭详情弹窗（✅优化：延迟清空数据，避免关闭动画时数据闪烁）
   */
  onCloseDetail() {
    this.setData({
      showDetailPopup: false
    })
    // ✅ 延迟清空数据，避免关闭动画时数据闪烁（符合项目开发规范）
    setTimeout(() => {
      this.setData({
        selectedRecord: null
      })
    }, 300)
  },

  /**
   * 详情弹窗显示状态变化（✅优化：延迟清空数据，避免关闭动画时数据闪烁）
   */
  onHealthDetailPopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showDetailPopup: false
      })
      // ✅ 延迟清空数据，避免关闭动画时数据闪烁（符合项目开发规范）
      setTimeout(() => {
        this.setData({
          selectedRecord: null
        })
      }, 300)
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
      const result = await safeCloudCall({
        name: 'production-entry',
        data: {
          action: 'getActiveBatches'
        },
        useCache: true  // 自动缓存10分钟
      })

      if (result && result.success) {
        const batches = result.data || []
        
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
  async selectAllBatches() {
    // ✅ 显示加载提示
    wx.showLoading({
      title: '切换批次中...',
      mask: true
    })
    
    try {
      this.setData({
        currentBatchId: 'all',
        currentBatchNumber: '全部批次',
        showBatchDropdown: false
      })
      
      // 保存选择
      try { wx.setStorageSync('currentBatchId', 'all') } catch (_) {}
      
      // ✅ 全面刷新数据
      await this.refreshAllDataForBatchChange()
      
    } catch (error) {
      console.error('切换批次失败:', error)
      wx.showToast({
        title: '切换失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },

  /**
   * 从下拉菜单选择批次（在详情视图下切换批次）
   */
  async selectBatchFromDropdown(e: any) {
    const index = e.currentTarget.dataset.index
    const batches = this.data.availableBatches
    
    if (index >= 0 && index < batches.length) {
      const selectedBatch = batches[index]
      
      // ✅ 显示加载提示
      wx.showLoading({
        title: '切换批次中...',
        mask: true
      })
      
      try {
        // 更新UI状态
        this.setData({
          currentBatchId: selectedBatch._id,
          currentBatchNumber: selectedBatch.batchNumber,
          showBatchDropdown: false
        })
        
        // 保存选择
        try { wx.setStorageSync('currentBatchId', selectedBatch._id) } catch (_) {}
        
        // ✅ 全面刷新数据
        await this.refreshAllDataForBatchChange()
        
      } catch (error) {
        console.error('切换批次失败:', error)
        wx.showToast({
          title: '切换失败',
          icon: 'error'
        })
      } finally {
        wx.hideLoading()
      }
    }
  },
  
  /**
   * ✅ 批次切换时全面刷新数据
   * 确保所有卡片和tab的数据都正确更新
   */
  async refreshAllDataForBatchChange() {
    try {
      // 1. 清除缓存
      this.invalidateAllBatchesCache()
      
      // 2. 加载基础健康数据 - 这会设置healthStats.originalQuantity
      await this.loadHealthData(true)  // silent模式
      
      // 3. 确保数据加载完成后再加载分析数据
      // 使用setTimeout确保setData已完成
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 4. 根据当前激活的tab加载对应数据
      switch (this.data.activeTab) {
        case 'overview':
          await this.loadHealthOverview()
          break
        case 'prevention':
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
      
    } catch (error) {
      console.error('刷新批次数据失败:', error)
      throw error
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
   * 点击防疫用药卡片，跳转到用药记录列表页面
   */
  onMedicationCountTap() {
    // ✅ 防重复点击
    const now = Date.now()
    if (now - this.lastClickTime < 500) return
    this.lastClickTime = now
    
    wx.navigateTo({
      url: '/packageHealth/medication-records-list/medication-records-list',
      events: {
        medicationRecordsUpdated: () => {
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
   * 查看任务详情（✅ 优化：立即显示弹窗，异步加载用户信息）
   */
  async viewTaskDetail(e: any) {
    // ✅ 防抖：避免重复点击
    const now = Date.now()
    if (now - this.lastClickTime < 300) return
    this.lastClickTime = now
    
    const task = e.currentTarget.dataset.task
    if (!task) return
    
    // ✅ 判断任务是否为即将到来的任务（来自 upcoming 标签）
    const isUpcomingTask = this.data.preventionSubTab === 'upcoming'
    
    // ✅ 立即构建基础任务数据并显示弹窗（不等待异步操作）
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
      completedDate: task.completedDate || '',
      completedBy: task.completedBy || '加载中...'  // ✅ 先显示加载中
    }

    // ✅ 关键优化：立即显示弹窗，提供即时反馈
    this.setData({
      selectedTask: enhancedTask,
      showTaskDetailPopup: true
    })
    
    // ✅ 异步加载用户信息（不阻塞弹窗显示）
    this.loadCompletedByUserName(task.completedBy)
  },

  /**
   * ✅ 新增：异步加载任务完成人员信息（不阻塞UI）
   */
  async loadCompletedByUserName(completedBy: string) {
    if (!completedBy) {
      // 没有完成人员信息，更新为空
      this.setData({
        'selectedTask.completedBy': ''
      })
      return
    }
    
    // 判断是否是 OpenID 格式（通常以 'o' 开头，长度约 28 个字符）
    const isOpenId = /^o[a-zA-Z0-9]{27}$/.test(completedBy)
    if (!isOpenId) {
      // 不是OpenID，直接使用原值
      this.setData({
        'selectedTask.completedBy': completedBy
      })
      return
    }
    
    try {
      // 先尝试从本地缓存查找
      const cachedUsers = wx.getStorageSync('cached_users') || {}
      if (cachedUsers[completedBy]?.nickName) {
        this.setData({
          'selectedTask.completedBy': cachedUsers[completedBy].nickName
        })
        return
      }
      
      // 缓存中没有，通过云函数查询用户信息
      const result = await safeCloudCall({
        name: 'user-management',
        data: {
          action: 'get_user_by_openid',
          openid: completedBy
        }
      })
      
      if (result?.success && result?.data?.nickName) {
        const userName = result.data.nickName
        
        // 更新弹窗中的用户名
        this.setData({
          'selectedTask.completedBy': userName
        })
        
        // 缓存用户信息以便下次使用
        try {
          cachedUsers[completedBy] = {
            nickName: userName,
            timestamp: Date.now()
          }
          wx.setStorageSync('cached_users', cachedUsers)
        } catch (cacheError) {
          // 缓存失败不影响主流程
        }
      } else {
        this.setData({
          'selectedTask.completedBy': '用户'
        })
      }
    } catch (error) {
      // 查询失败，显示默认值
      this.setData({
        'selectedTask.completedBy': '用户'
      })
    }
  },

  /**
   * 关闭任务详情弹窗（✅优化：延迟清空数据，避免关闭动画时数据闪烁）
   */
  closeTaskDetailPopup() {
    this.setData({
      showTaskDetailPopup: false
    })
    // ✅ 延迟清空数据，避免关闭动画时数据闪烁（符合项目开发规范）
    setTimeout(() => {
      this.setData({
        selectedTask: null
      })
    }, 300)
  },

  /**
   * 任务详情弹窗显示状态变化（✅优化：延迟清空数据，避免关闭动画时数据闪烁）
   */
  onTaskDetailPopupChange(e: any) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showTaskDetailPopup: false
      })
      // ✅ 延迟清空数据，避免关闭动画时数据闪烁（符合项目开发规范）
      setTimeout(() => {
        this.setData({
          selectedTask: null
        })
      }, 300)
    } else {
      // 弹窗显示时，检测文本换行并应用对齐样式
      setTimeout(() => {
        this.checkTextAlignment()
      }, 100)
    }
  },

  /**
   * 检测文本是否换行，自动应用对齐样式
   */
  checkTextAlignment() {
    const query = wx.createSelectorQuery().in(this)
    const fieldMap = {
      'info-value-title': 'title',
      'info-value-type': 'type',
      'info-value-time': 'time',
      'info-value-duration': 'duration',
      'info-value-materials': 'materials',
      'info-value-batch': 'batch',
      'info-value-age': 'age',
      'info-value-description': 'description',
      'info-value-dosage': 'dosage',
      'info-value-notes': 'notes'
    }

    const ids = Object.keys(fieldMap)
    
    ids.forEach(id => {
      query.select(`#${id}`).boundingClientRect()
    })

    query.exec((res) => {
      if (!res) return

      const updates: Record<string, boolean> = {}
      
      res.forEach((rect: any, index: number) => {
        if (!rect) return

        const id = ids[index]
        const field = fieldMap[id as keyof typeof fieldMap]
        
        // 通过对比高度判断是否换行
        // 单行高度约为 42rpx (28rpx * 1.5行高)，换行后高度会明显增大
        const singleLineHeight = 42 // rpx
        const isMultiline = rect.height > singleLineHeight

        updates[`taskFieldMultiline.${field}`] = isMultiline
      })

      // 批量更新状态
      this.setData(updates)
    })
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
      const result = await safeCloudCall({
        name: 'breeding-todo',
        data: {
          action: 'completeTask',
          taskId: task._id,
          batchId: task.batchId,
          notes: ''
        }
      })
      
      const response = result as any
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
        const batchResult = await safeCloudCall({
          name: 'production-entry',
          data: { action: 'getActiveBatches' },
          useCache: true  // 自动缓存10分钟
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
        logger.error('获取批次存栏数失败:', error)
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
      vaccinationCount: currentBatchStockQuantity,  // 默认填充存栏数量
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
      currentBatchStockQuantity: Number(currentBatchStockQuantity) || 0,  // ✅ 设置存栏数量，确保为数字
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
   * 疫苗表单输入处理（适配组件事件）
   */
  onVaccineFormInput(e: any) {
    const { field, value } = e.detail || e.currentTarget?.dataset || {}
    const actualValue = value || e.detail?.value || ''
    
    if (!field) return
    
    this.setData({
      [`vaccineFormData.${field}`]: actualValue
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
   * 数值输入处理（费用相关，适配组件事件）
   */
  onVaccineNumberInput(e: any) {
    const { field, value } = e.detail || e.currentTarget?.dataset || {}
    const actualValue = value || e.detail?.value || ''
    
    if (!field) return
    
    // 如果是接种数量，需要验证不超过存栏数量
    if (field === 'vaccinationCount') {
      const vaccinationCount = parseInt(actualValue) || 0
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
        [`vaccineFormData.${field}`]: actualValue
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
  async submitVaccineForm(e?: any) {
    // 适配组件事件：如果是从组件传递的事件，使用事件中的formData
    const formDataFromEvent = e?.detail?.formData
    const vaccineFormData = formDataFromEvent || this.data.vaccineFormData
    
    if (!this.validateVaccineForm()) {
      return
    }

    const { selectedTask, vaccineRouteOptions } = this.data

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

    // 构建预防数据（符合云函数期望的格式）
    const preventionData = {
      preventionType: 'vaccine',
      preventionDate: getCurrentBeijingDate(), // ✅ 使用北京时间
      vaccineInfo: {
        name: vaccineFormData.vaccineName,
        manufacturer: vaccineFormData.manufacturer,
        batchNumber: vaccineFormData.batchNumber,
        dosage: vaccineFormData.dosage,
        route: vaccineRouteOptions[vaccineFormData.routeIndex],
        count: vaccineFormData.vaccinationCount,
        location: vaccineFormData.location
      },
      veterinarianInfo: {
        name: vaccineFormData.veterinarianName,
        contact: vaccineFormData.veterinarianContact
      },
      costInfo: {
        vaccineCost: parseFloat(vaccineFormData.vaccineCost || '0'),
        veterinaryCost: parseFloat(vaccineFormData.veterinaryCost || '0'),
        otherCost: parseFloat(vaccineFormData.otherCost || '0'),
        totalCost: vaccineFormData.totalCost,
        // ✅ 重要：标记疫苗接种费用需要同步到财务系统
        // 疫苗接种是养殖场的重要成本项，应当记入财务管理
        shouldSyncToFinance: true
      },
      notes: vaccineFormData.notes
    }

    try {
      wx.showLoading({ title: '提交中...' })

      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'completePreventionTask',
          taskId: selectedTask._id,
          batchId: batchId,
          preventionData
        }
      })

      if (result && result.success) {
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
        throw new Error(result?.message || '提交失败')
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
        const batchResult = await safeCloudCall({
          name: 'production-entry',
          data: { action: 'getActiveBatches' },
          useCache: true  // 自动缓存10分钟
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
        logger.error('获取批次存栏数失败:', error)
      }
    }
    
    // 初始化表单数据
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      selectedTask: task,
      currentBatchStockQuantity: Number(currentBatchStockQuantity) || 0,  // ✅ 设置存栏数量，确保为数字
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
      const result = await safeCloudCall({
        name: 'production-material',
        data: {
          action: 'list_materials',
          category: '药品'
        }
      })
      
      if (result && result.success) {
        const materials = result.data.materials || []
        const availableMedicines = materials
          .filter((material: any) => (material.currentStock || 0) > 0)
          .map((material: any) => ({
            id: material._id,
            name: material.name,
            unit: material.unit || '件',
            stock: material.currentStock || 0,
            unitPrice: material.unitPrice || 0,
            category: material.category,
            description: material.description || ''
          }))
        
        this.setData({
          availableMedicines: Array.isArray(availableMedicines) ? availableMedicines : []
        })
      }
    } catch (error: any) {
      logger.error('加载药品库存失败:', error)
    }
  },

  /**
   * 选择药品（适配组件事件）
   */
  onMedicineSelect(e: any) {
    const index = e.detail?.index ?? e.detail?.value ?? 0
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
   * 用药表单输入处理（适配组件事件）
   */
  onMedicationFormInput(e: any) {
    const { field, value } = e.detail || e.currentTarget?.dataset || {}
    const actualValue = value || e.detail?.value || ''
    
    if (!field) return
    
    this.setData({
      [`medicationFormData.${field}`]: actualValue
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
   * 用药数量输入处理（适配组件事件）
   */
  onMedicationQuantityInput(e: any) {
    const { value } = e.detail || {}
    const quantity = parseInt(value?.toString() || '0') || 0
    
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
   * 用药鹅只数量输入处理（适配组件事件）
   */
  onMedicationAnimalCountInput(e: any) {
    const { value } = e.detail || {}
    const animalCount = parseInt(value?.toString() || '0') || 0
    
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
        useDate: getCurrentBeijingDate(),
        createTime: new Date().toISOString()
      }

      const result = await safeCloudCall({
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

      if (result && result.success) {
        // 计算成本：数量 × 单价
        const unitPrice = this.data.selectedMedicine?.unitPrice || 0
        const quantity = Number(medicationRecord.quantity) || 0
        const totalCost = unitPrice * quantity
        
        // ✅ 创建健康预防记录
        await safeCloudCall({
          name: 'health-management',
          data: {
            action: 'complete_prevention_task',
            taskId: selectedTask._id,
            batchId: batchId,
            preventionData: {
              preventionType: 'medication',
              preventionDate: medicationRecord.useDate,
              medicationInfo: {
                name: medicationRecord.materialName,
                dosage: medicationRecord.dosage || '',
                method: '口服/拌料/饮水',
                duration: 1,
                animalCount: medicationFormData.animalCount
              },
              costInfo: {
                totalCost: totalCost,
                unitPrice: unitPrice,
                quantity: quantity,
                unit: medicationRecord.unit,
                shouldSyncToFinance: false,
                source: 'use'
              },
              notes: medicationRecord.notes,
              effectiveness: 'pending'
            }
          }
        })
        
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
        throw new Error(result?.message || '提交失败')
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
      await safeCloudCall({
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
      logger.error('完成任务失败:', error)
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
      const result = await safeCloudCall({
        name: 'production-material',
        data: {
          action: 'list_materials',
          category: '营养品'
        }
      })

      if (result && result.success) {
        const materials = result.data?.materials || []
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
      logger.error('加载营养品库存失败:', error)
    }
  },

  /**
   * 选择营养品（适配组件事件）
   */
  onNutritionSelect(e: any) {
    const index = e.detail?.index ?? e.detail?.value ?? 0
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
   * 营养表单输入处理（适配组件事件）
   */
  onNutritionFormInput(e: any) {
    const { field, value } = e.detail || e.currentTarget?.dataset || {}
    const actualValue = value || e.detail?.value || ''
    
    if (!field) return
    
    this.setData({
      [`nutritionFormData.${field}`]: actualValue
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
   * 营养数量输入处理（适配组件事件）
   */
  onNutritionQuantityInput(e: any) {
    const { value } = e.detail || {}
    const quantity = parseInt(value?.toString() || '0') || 0
    
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
   * 提交营养表单（适配组件事件）
   */
  async submitNutritionForm(e?: any) {
    // 适配组件事件：如果是从组件传递的事件，使用事件中的formData
    const formDataFromEvent = e?.detail?.formData
    const nutritionFormData = formDataFromEvent || this.data.nutritionFormData
    
    if (!this.validateNutritionForm()) {
      return
    }

    const selectedTask = this.data.selectedTask
    
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
        recordDate: getCurrentBeijingDate()
      }

      const result = await safeCloudCall({
        name: 'production-material',
        data: {
          action: 'create_record',
          recordData: recordData
        }
      })

      if (result && result.success) {
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
        throw new Error(result?.message || '提交失败')
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
      await safeCloudCall({
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
      logger.error('完成任务失败:', error)
    }
  },

  /**
   * 关闭异常反应处理弹窗（符合规范3.4：延迟清空数据）
   */
  closeAdverseReactionPopup() {
    this.setData({
      showAdverseReactionPopup: false
    })
    // ⚠️ 重要：延迟清空数据，避免弹窗关闭动画时数据闪烁
    setTimeout(() => {
      this.setData({
        adverseReactionData: {
          count: 0,
          symptoms: '',
          severityIndex: 0,
          treatment: '',
          followUp: ''
        }
      })
    }, 300)
  },

  /**
   * 异常反应输入处理（适配组件事件）
   */
  onAdverseReactionInput(e: any) {
    const { field, value } = e.detail || e.currentTarget?.dataset || {}
    const actualValue = value || e.detail?.value || ''
    
    if (!field) return
    
    this.setData({
      [`adverseReactionData.${field}`]: actualValue
    })
  },

  /**
   * 症状等级选择处理（适配组件事件）
   */
  onSeverityChange(e: any) {
    const index = e.detail?.index ?? e.detail?.value ?? 0
    this.setData({
      'adverseReactionData.severityIndex': index
    })
  },

  /**
   * 提交异常反应记录（适配组件事件）
   */
  async submitAdverseReactionRecord(e?: any) {
    // 适配组件事件：如果是从组件传递的事件，使用事件中的reactionData
    const reactionDataFromEvent = e?.detail?.reactionData
    const reactionData = reactionDataFromEvent || this.data.adverseReactionData
    
    if (!reactionData.count || reactionData.count <= 0) {
      wx.showToast({
        title: '请输入异常数量',
        icon: 'error'
      })
      return
    }
    
    if (!reactionData.symptoms || reactionData.symptoms.trim() === '') {
      wx.showToast({
        title: '请输入异常症状',
        icon: 'error'
      })
      return
    }

    const { selectedTask } = this.data
    
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

      // 构建异常反应记录数据
      const recordData = {
        taskId: selectedTask._id,
        batchId: batchId,
        count: reactionData.count,
        symptoms: reactionData.symptoms,
        severity: this.data.severityOptions[reactionData.severityIndex]?.value || 'mild',
        treatment: reactionData.treatment || '',
        followUp: reactionData.followUp || '',
        recordedAt: new Date().toISOString(),
        recordedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
      }

      // 调用云函数记录异常反应
      const result = await safeCloudCall({
        name: 'health-management',
        data: {
          action: 'recordAdverseReaction',
          recordData: recordData
        }
      })

      if (result && result.success) {
        wx.hideLoading()
        wx.showToast({
          title: '异常反应已记录',
          icon: 'success'
        })

        this.closeAdverseReactionPopup()
        // 📝 优化：统一使用 loadPreventionData 刷新任务列表
        if (this.data.preventionSubTab === 'today') {
          this.loadPreventionData()
        }
      } else {
        throw new Error(result?.message || '提交失败')
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
   * 阻止触摸移动事件冒泡
   */
  preventTouchMove() {
    return false
  }
})
