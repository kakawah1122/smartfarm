// health.ts - 健康管理页面

// 类型定义
type CustomEvent<T = Record<string, unknown>> = WechatMiniprogram.CustomEvent<T>;
type InputEvent = CustomEvent<{ value: string }>;

// 基础响应类型
interface BaseResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
  result?: { success: boolean; data?: T; message?: string; error?: string; deletedCount?: number; _id?: string }
}

// 错误类型
interface ErrorWithMessage {
  message?: string
  errMsg?: string
}

// 批次类型
interface BatchItem {
  _id: string
  batchId?: string
  batchNumber?: string
  displayName?: string
  dayAge?: number
  tab?: string
  activeTab?: string
  currentBatchId?: string
}

// 物料类型
interface MaterialItem {
  _id: string
  materialId?: string
  name?: string
  unit?: string
  currentStock?: number
  unitPrice?: number
  avgCost?: number
  price?: number
  category?: string
  description?: string
}

// 任务类型
interface TaskItem {
  _id?: string
  id?: string
  taskId?: string
  batchId?: string
  title?: string
  dayAge?: number
}

import CloudApi from '../../utils/cloud-api'
import { formatTime, getCurrentBeijingDate } from '../../utils/util'
import { logger } from '../../utils/logger'
import * as HealthStatsCalculator from './modules/health-stats-calculator'
import { createWatcherManager, startDataWatcher as startHealthDataWatcher, stopDataWatcher as stopHealthDataWatcher } from './modules/health-watchers'
import { CacheManager } from './modules/health-data-loader-v2'
import { isVaccineTask, isMedicationTask, isNutritionTask, calculateCurrentAge } from '../../utils/health-utils'
import { processImageUrls } from '../../utils/image-utils'
import { normalizeDiagnosisRecord, normalizeDiagnosisRecords, type DiagnosisRecord } from '../../utils/diagnosis-data-utils'
import { safeCloudCall } from '../../utils/safe-cloud-call'
import { HealthCloud } from '../../utils/cloud-functions'
import { createDataUpdater } from './helpers/data-updater'
import { HealthCloudHelper, normalizeHealthData } from './helpers/cloud-helper'
import { withErrorHandler } from './helpers/error-handler'
import { FormValidator, vaccineFormRules, medicationFormRules, nutritionFormRules } from './helpers/form-validator'
import { HealthNavigationManager } from './modules/health-navigation-module'
import { HealthEventManager, setupEventManagement } from './modules/health-event-module'
import { SetDataBatcher, createSetDataBatcher } from './helpers/setdata-batcher'
import { ListPaginator, createPaginator } from './helpers/list-pagination'
import { createVaccineModule, VaccineModuleManager } from './modules/health-vaccine-module'
import { createMonitoringModule, MonitoringModuleManager } from './modules/health-monitoring-module'
import { createPreventionModule, PreventionModuleManager } from './modules/health-prevention-module'
import { createSetDataWrapper, SetDataWrapper } from './helpers/setdata-wrapper'

const ALL_BATCHES_CACHE_KEY = 'health_cache_all_batches_snapshot_v1'
const CACHE_DURATION = 5 * 60 * 1000

/**
 * 格式化百分比：保留两位小数，但去除尾随的0
 * @param value 数值或字符串
 * @returns 格式化后的百分比字符串
 * @example
 * formatPercentage('0.10') // '0.1%'
 * formatPercentage('0.00') // '0%'
 * formatPercentage('1.00') // '1%'
 * formatPercentage('99.20') // '99.2%'
 */
function formatPercentage(value: string | number): string {
  const num = parseFloat(value.toString())
  if (isNaN(num)) return '0%'
  // 保留两位小数后转为字符串，然后去除尾随的0和小数点
  return num.toFixed(2).replace(/\.?0+$/, '') + '%'
}

function getCachedAllBatchesData() {
  try {
    const cached = wx.getStorageSync(ALL_BATCHES_CACHE_KEY) as { timestamp: number; data: unknown }
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

function setCachedAllBatchesData(data: unknown) {
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
  originalQuantity?: number  // 原始入栏数（用于计算存活率）
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
  vaccineInfo?: unknown
  veterinarianInfo?: unknown
  costInfo?: unknown
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
  availableBatches: Batch[]
  
  // 弹窗相关
  showDetailPopup: boolean
  selectedRecord: unknown
  showDiagnosisDetailPopup: boolean
  selectedDiagnosisRecord: unknown
  
  // 各Tab页面数据
  healthOverview: unknown
  preventionData: unknown
  monitoringData: unknown
  treatmentData: unknown
  analysisData: unknown
  activeAlerts: unknown[]
  
  // 时间范围
  dateRange: {
    start: string
    end: string
  }
}

Page<PageData, any>({
  // 私有属性，用于防止重复点击
  _lastTaskClickTime: 0,
  
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
      originalQuantity: 0  // 原始入栏数
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
    upcomingTasks: [] as BaseResponse[],
    
    // 历史任务（从breeding-todo迁移）
    historyTasks: [] as BaseResponse[],
    
    // 按批次分组的今日待办任务（从breeding-todo迁移）
    todayTasksByBatch: [] as BaseResponse[],
    
    // 任务详情弹窗（从breeding-todo迁移）
    selectedTask: null as unknown as BaseResponse,
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
    availableMedicines: [] as BaseResponse[],
    selectedMedicine: null as unknown as BaseResponse,
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
    availableNutrition: [] as unknown[],
    selectedNutrition: null as unknown,
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
    dropdownRight: 12,  // 下拉菜单的right位置（px）
    
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
      treatmentHistory: [] as unknown[],
      diagnosisHistory: [] as unknown[]
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
  loadDataDebounceTimer: null as unknown,  // 防抖定时器
  _timerIds: [] as number[],  // ✅ 性能优化：跟踪所有定时器ID，便于统一清理
  isLoadingData: false,  // 数据加载标志，防止重复加载
  pendingAllBatchesPromise: null as Promise<unknown> | null,
  latestAllBatchesSnapshot: null as unknown,
  latestAllBatchesFetchedAt: 0,
  batchAnalysisCache: null as unknown,
  setDataBatcher: null as SetDataBatcher | null,
  navigationManager: null as HealthNavigationManager | null,
  eventManager: null as HealthEventManager | null,
  diagnosisHistoryPaginator: null as ListPaginator<unknown> | null,
  abnormalListPaginator: null as ListPaginator<unknown> | null,
  debouncedLoadHealthData: null as unknown,
  vaccineModule: null as VaccineModuleManager | null,
  monitoringModule: null as MonitoringModuleManager | null,
  preventionModule: null as PreventionModuleManager | null,
  setDataWrapper: null as SetDataWrapper | null,
  invalidateAllBatchesCache() {
    this.pendingAllBatchesPromise = null
    this.latestAllBatchesSnapshot = null
    this.latestAllBatchesFetchedAt = 0
    // 清除所有相关缓存
    CacheManager.clearAllHealthCache()
  },
  
  /**
   * ✅ 性能优化：安全设置定时器（自动跟踪ID）
   */
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      // 执行回调后从数组中移除
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  /**
   * ✅ 性能优化：清理所有定时器
   */
  _clearAllTimers() {
    this._timerIds.forEach(id => clearTimeout(id))
    this._timerIds = []
  },
  
  /**
   * 修复治疗记录缺少 _openid 的问题
   * 一次性修复，为已有记录添加 _openid 字段
   */
  async fixTreatmentRecordsOpenId() {
    try {
      const result = await HealthCloud.treatment.fixOpenid({})
      
      if (result && (result as BaseResponse).result?.success) {
        // 修复成功，静默处理
      }
    } catch (error) {
      logger.error('修复治疗记录失败:', error)
      // 静默处理，不影响页面加载
    }
  },

  /**
   * 修复批次死亡数据不一致问题
   * 确保死亡记录集合和批次集合的数据同步
   */
  async fixBatchDeathCount() {
    try {
      const result = await HealthCloud.death.fixBatchCount({})
      
      if (result && (result as BaseResponse).result?.success) {
        // 修复成功，静默处理
      }
    } catch (error) {
      logger.error('修复批次死亡数据失败:', error)
      // 静默处理，不影响页面加载
    }
  },


  /**
   * 页面加载
   */
  async onLoad(options: unknown) {
    // 🎯 初始化事件管理（新增模块化功能）
    setupEventManagement(this)
    
    // 🎯 初始化功能模块
    this.vaccineModule = createVaccineModule(this)
    this.monitoringModule = createMonitoringModule(this)
    this.preventionModule = createPreventionModule(this)
    
    // ✅ 性能优化：初始化setData包装器
    this.setDataWrapper = createSetDataWrapper(this)
    
    // ✅ 优化：立即初始化页面，不等待数据修复
    wx.nextTick(() => {
      this.initializePage(options)
    })
    
    // ⚠️ 数据修复方法已禁用（需要管理员权限，仅在控制台手动执行）
    // 如需执行修复，请在云开发控制台调用对应云函数
    // setTimeout(() => {
    //   this.fixTreatmentRecordsOpenId()
    //   this.fixBatchDeathCount()
    // }, 1000)
  },
  
  /**
   * 初始化页面（优化：合并setData）
   */
  async initializePage(options: { batchId?: string; tab?: string }) {
    const batchId = options.batchId
    const tab = options.tab
    
    this.dataWatchers = createWatcherManager()
    
    // ✅ 性能优化：初始化setData批量更新器
    this.setDataBatcher = createSetDataBatcher(this, 16) // 16ms = 一帧时间
    
    // ✅ 性能优化：初始化列表分页器
    this.diagnosisHistoryPaginator = createPaginator({
      initialPageSize: 10,  // 初始加载10条
      pageSize: 10,         // 每次加载10条
      maxItems: 100         // 最多保留100条，避免内存问题
    })
    
    this.abnormalListPaginator = createPaginator({
      initialPageSize: 10,  // 初始加载10条
      pageSize: 10,         // 每次加载10条
      maxItems: 50          // 异常列表最多50条
    })
    
    this.initDateRange()
    
    // 合并初始化的setData调用
    const initData: Record<string, unknown> = { loading: true }
    
    // 处理从首页跳转过来的情况
    if (tab === 'prevention') {
      initData.activeTab = 'prevention'
    }
    
    // 如果传入了批次ID，使用传入的；否则默认显示全部批次
    if (batchId) {
      initData.currentBatchId = batchId
    }
    
    // 一次性更新初始数据
    this.setData(initData)
    
    // 后台清理孤儿任务（不阻塞页面加载）
    this.cleanOrphanTasksInBackground()
    
    // 性能优化：并行加载基础数据，提升加载速度
    try {
      // 并行加载批次列表和健康数据
      await Promise.all([
        this.loadAvailableBatches(),
        this.loadHealthData(true), // 静默加载，避免重复loading
        this.loadGlobalTreatmentAndPreventionStats() // ✅ 加载全局诊疗和预防统计（不受批次筛选影响）
      ])
      
      // 加载当前标签的数据
      await this.loadTabData(this.data.activeTab)
      
    } catch (error: unknown) {
      logger.error('[onLoad] 页面加载失败:', error)
      wx.showToast({
        title: '页面加载失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 页面显示时刷新数据并启动实时监听（优化：增加EventChannel监听）
   */
  onShow() {
    // 延迟启动监听器，避免快速切换页面时的竞态条件
    // 使用 wx.nextTick 确保页面完全渲染后再启动
    wx.nextTick(() => {
      // 再延迟一点，确保页面稳定
      this._safeSetTimeout(() => {
        // 启动实时数据监听（只在页面可见时监听，节省资源）
        this.startDataWatcher()
      }, 100)
    })
    
    // 检查是否需要刷新（包括EventChannel事件和Storage标志）
    const needRefresh = wx.getStorageSync('health_page_need_refresh')
    if (needRefresh) {
      wx.removeStorageSync('health_page_need_refresh')
      // 使用后台刷新，完全不阻塞UI（异步执行）
      this.backgroundRefreshData()
    }
    // 移除else分支，避免每次onShow都刷新
  },
  
  /**
   * 页面隐藏时停止监听（优化：立即停止）
   */
  onHide() {
    // 立即停止监听器，不延迟
    this.stopDataWatcher()
  },
  
  /**
   * 加载更多诊断历史（用于滚动加载）
   */
  loadMoreDiagnosisHistory() {
    if (!this.diagnosisHistoryPaginator) {
      return
    }
    
    const nextPage = this.diagnosisHistoryPaginator.getNextPage()
    if (nextPage && nextPage.items.length > 0) {
      // 追加新数据到现有列表
      const currentList = this.data.treatmentData.diagnosisHistory || []
      this.setData({
        'treatmentData.diagnosisHistory': currentList.concat(nextPage.items)
      })
    }
  },
  
  /**
   * 加载更多异常列表（用于滚动加载）
   */
  loadMoreAbnormalList() {
    if (!this.abnormalListPaginator) {
      return
    }
    
    const nextPage = this.abnormalListPaginator.getNextPage()
    if (nextPage && nextPage.items.length > 0) {
      // 追加新数据到现有列表
      const currentList = this.data.monitoringData.abnormalList || []
      this.setData({
        'monitoringData.abnormalList': currentList.concat(nextPage.items)
      })
    }
  },
  
  /**
   * 页面卸载时停止监听（优化：立即停止）
   */
  onUnload() {
    // 立即停止监听器，不延迟
    this.stopDataWatcher()
    
    // ✅ 性能优化：清理所有定时器
    this._clearAllTimers()
    
    // ✅ 性能优化：清理setData批量更新器
    if (this.setDataBatcher) {
      this.setDataBatcher.destroy()
      this.setDataBatcher = null
    }
    
    // ✅ 性能优化：清理setData包装器
    if (this.setDataWrapper) {
      this.setDataWrapper.destroy()
      this.setDataWrapper = null
    }
    
    // ✅ 性能优化：清理列表分页器
    if (this.diagnosisHistoryPaginator) {
      this.diagnosisHistoryPaginator.reset()
      this.diagnosisHistoryPaginator = null
    }
    if (this.abnormalListPaginator) {
      this.abnormalListPaginator.reset()
      this.abnormalListPaginator = null
    }
  },
  
  /**
   * 启动数据监听（优化：智能缓存清除 + 静默刷新）
   */
  startDataWatcher() {
    if (!this.dataWatchers) {
      this.dataWatchers = createWatcherManager()
    }
    
    this.dataWatchers = startHealthDataWatcher(this.dataWatchers, {
      includeTreatmentWatcher: true,
      onBeforeChange: () => {
        // 优化：只清除当前批次的缓存，而不是全部缓存
        if (this.data.currentBatchId === 'all') {
          this.invalidateAllBatchesCache()
          CacheManager.clearBatchCache('all')
        } else {
          CacheManager.clearBatchCache(this.data.currentBatchId)
        }
      },
      onDataChange: () => {
        // 优化：使用静默刷新，不阻塞UI
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
   * ✅ 优化：减少setData调用
   */
  onPullDownRefresh() {
    // 清理所有缓存
    CacheManager.clearAllHealthCache()
    this.invalidateAllBatchesCache()
    
    // 设置刷新状态
    this.setData({ refreshing: true })
    
    this.loadHealthData().finally(() => {
      // 一次性更新状态
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
   * ✅ 优化：减少重复渲染
   */
  switchTab(e: InputEvent) {
    const { tab } = e.currentTarget.dataset
    // 如果选项卡未变化，避免重复渲染
    if (tab === this.data.activeTab) {
      return
    }
    
    this.setData({ activeTab: tab })
    
    // 根据选项卡加载对应数据
    this.loadTabData(tab)
  },

  /**
   * Tab组件变化事件处理
   * ✅ 优化：减少重复渲染
   */
  onTabChange(e: WechatMiniprogram.CustomEvent) {
    const { value } = e.detail
    // 如果选项卡未变化，避免重复渲染
    if (value === this.data.activeTab) {
      return
    }
    
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
      await this.loadHealthData(true, false)  // 静默加载，禁用防抖确保数据立即加载
    }
    
    switch (tab) {
      case 'overview':
        await this.loadHealthOverview()
        break
      case 'prevention':
        // 加载监控数据
        await this.loadMonitoringData()
        
        // 根据子标签加载对应的任务数据
        const subTab = this.data.preventionSubTab
        
        if (subTab === 'today') {
          // 加载今日任务
          await this.loadPreventionData()
        } else if (subTab === 'upcoming') {
          await this.loadUpcomingTasks()
        } else if (subTab === 'history') {
          await this.loadHistoryTasks()
        }
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
   * 加载健康数据（主入口 - 使用模块化防抖）
   * @param silent 静默刷新（不显示loading，避免阻塞UI交互）
   * @param debounce 是否使用防抖（默认true）
   */
  async loadHealthData(silent: boolean = false, debounce: boolean = true) {
    if (debounce) {
      // 使用事件管理器的防抖（延迟初始化）
      if (!this.debouncedLoadHealthData) {
        this.debouncedLoadHealthData = HealthEventManager.debounce(
          this._executeLoadHealthData.bind(this),
          300
        )
      }
      this.debouncedLoadHealthData(silent)
    } else {
      await this._executeLoadHealthData(silent)
    }
  },
  
  /**
   * 实际执行健康数据加载（内部方法）
   * 优化：合并setData调用
   */
  async _executeLoadHealthData(silent: boolean = false) {
    // 防重复加载：如果正在加载中，直接返回
    if (this.isLoadingData) {
      return
    }
    
    this.isLoadingData = true  // 设置加载标志
    
    // 优化：使用批量更新器
    const updates: unknown = {}
    
    // 如果是静默刷新，不设置loading状态，避免阻塞UI
    if (!silent) {
      updates.loading = true
      this.setData(updates)
    }

    try {
      // ✅ 修复：根据当前批次ID选择不同的加载方法
      const currentBatchId = this.data.currentBatchId || 'all'
      
      if (currentBatchId === 'all') {
        // 全部批次模式：加载汇总数据
        await this.loadAllBatchesData()
      } else {
        // 单批次模式：加载该批次的详细数据
        await this.loadSingleBatchDataOptimized()
      }
      
      // 如果当前选中的是其他tab，也加载对应数据
      const { activeTab } = this.data
      if (activeTab && activeTab !== 'overview') {
        await this.loadTabData(activeTab)
      }
    } catch (error: unknown) {
      logger.error('[loadHealthData] 加载失败:', error)
    } finally {
      if (!silent) {
        // 优化：单次setData完成loading状态更新
        this.setData({ loading: false })
      }
      this.isLoadingData = false  // 重置加载标志
    }
  },

  /**
   * 核心辅助方法：获取健康数据（✅修复：支持单批次和全部批次）
   * @private
   */
  async _fetchAllBatchesHealthData(options: boolean | { useCache?: boolean; forceRefresh?: boolean; batchId?: string } = { useCache: true, forceRefresh: false }) {
    const normalizedOptions = typeof options === 'boolean'
      ? { useCache: options }
      : (options || {})
    const useCache = normalizedOptions.useCache !== undefined ? normalizedOptions.useCache : true
    const forceRefresh = normalizedOptions.forceRefresh ?? false
    // 使用传入的batchId，如果没有则使用当前选择的批次
    const batchId = normalizedOptions.batchId || this.data.currentBatchId || 'all'

    const now = Date.now()

    // 只在获取全部批次数据时使用缓存
    if (batchId === 'all') {
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
    }

    const fetchPromise = (async () => {
      // 使用辅助工具简化云函数调用
      const rawData = await HealthCloudHelper.getDashboardSnapshot(batchId, {
        includeDiagnosis: true,
        includeAbnormalRecords: true,
        diagnosisLimit: 10,
        abnormalLimit: 50
      })

      // 使用统一的数据标准化函数
      const normalized = normalizeHealthData(rawData)

      // 只缓存全部批次的数据
      if (batchId === 'all') {
        setCachedAllBatchesData(normalized)
        this.latestAllBatchesSnapshot = normalized
        this.latestAllBatchesFetchedAt = normalized.fetchedAt
      }

      return normalized
    })()

    // 只在全部批次模式下管理promise缓存
    if (batchId === 'all' && !forceRefresh) {
      this.pendingAllBatchesPromise = fetchPromise
    }

    try {
      return await fetchPromise
    } finally {
      if (batchId === 'all' && !forceRefresh) {
        this.pendingAllBatchesPromise = null
      }
    }
  },

  /**
   * 加载所有批次的汇总数据（恢复原有实现，确保数据正确）
   */
  async loadAllBatchesData() {
    try {
      // ✅ 性能优化：并行执行所有云函数调用，减少等待时间
      const [healthData, preventionResult, medicationResult] = await Promise.all([
        // 获取健康数据
        this._fetchAllBatchesHealthData({ batchId: 'all' }),
        
        // 获取预防统计数据
        safeCloudCall({
          name: 'health-prevention',
          data: {
            action: 'get_prevention_dashboard',
            batchId: 'all',
            today: formatTime(new Date(), 'date')
          }
        }),
        
        // 获取用药统计（移至并行执行）
        safeCloudCall({
          name: 'health-prevention',
          data: {
            action: 'list_prevention_records',
            batchId: 'all',
            preventionType: 'medicine',  // 修复：使用正确的类型值
            page: 1,
            pageSize: 1  // 只需要统计数量
          }
        }).catch(error => {
          logger.error('获取用药统计失败:', error)
          return null  // 失败时返回null，不影响其他数据
        })
      ])

      // 处理预防统计数据
      const preventionResponse = preventionResult as BaseResponse<{ totalCount?: number; vaccineCount?: number; medicationCount?: number; disinfectionCount?: number; preventionCost?: number }>
      let preventionStats = {
        totalPreventions: 0,
        vaccineCount: 0,
        vaccineCoverage: 0,
        medicationCount: 0,
        vaccineStats: {},
        disinfectionCount: 0,
        totalCost: 0
      }
      
      // 修复：云函数直接返回数据，不包含stats对象
      if (preventionResponse?.success && preventionResponse.data) {
        const data = preventionResponse.data
        preventionStats = {
          totalPreventions: data.totalCount || 0,
          vaccineCount: data.vaccineCount || 0,
          vaccineCoverage: data.vaccineCount || 0,  // 使用疫苗数作为覆盖数
          medicationCount: data.medicationCount || 0,  // 直接从Dashboard获取
          vaccineStats: {},
          disinfectionCount: data.disinfectionCount || 0,
          totalCost: data.preventionCost || 0
        }
      }
      
      // 备用：如果Dashboard没有返回medicationCount，从单独查询获取
      const medResult = medicationResult as BaseResponse<{ total?: number }>
      if (preventionStats.medicationCount === 0 && medResult?.success && medResult.data) {
        preventionStats.medicationCount = medResult.data.total || 0
      }

      const batchesWithPrevention = healthData.batches.map((batch: Record<string, unknown>) => ({
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

      // 获取原始入栏数（全部批次模式）
      const originalQuantity = healthData.originalTotalQuantity || 0
      
      // 使用数据更新器简化setData调用
      const updater = createDataUpdater()
      
      // ✅ 使用 totalDiedAnimals（来自死亡记录表）作为死亡数，更准确
      const actualDeadCount = healthData.totalDiedAnimals || healthData.deadCount || 0
      
      // ✅ 统一计算存活率（与死亡率数据源一致，避免不同步）
      let survivalRate: string | number = '-'
      let survivalTrend = 'stable'
      if (originalQuantity > 0) {
        const survivalCount = originalQuantity - actualDeadCount
        survivalRate = ((survivalCount / originalQuantity) * 100).toFixed(1)
        const mortalityPercent = (actualDeadCount / originalQuantity) * 100
        survivalTrend = mortalityPercent < 1 ? 'improving' : mortalityPercent < 3 ? 'stable' : 'declining'
      }
      
      updater
        .setHealthStats({
          totalChecks: healthData.totalAnimals,
          healthyCount: healthData.actualHealthyCount,
          sickCount: healthData.sickCount,
          deadCount: actualDeadCount,
          healthyRate: originalQuantity > 0 ? formatPercentage(healthData.healthyRate) : '-',
          mortalityRate: originalQuantity > 0 ? formatPercentage(healthData.mortalityRate) : '-',
          originalQuantity: originalQuantity
        })
        .set('healthStats.abnormalCount', healthData.abnormalRecordCount)
        .set('healthStats.treatingCount', healthData.totalOngoingRecords)
        .set('preventionStats', preventionStats)
        .set('preventionData.stats', {
          vaccinationRate,
          vaccineCount: preventionStats.vaccineCount,
          medicationCount: preventionStats.medicationCount,
          vaccineCoverage: preventionStats.vaccineCoverage,
          preventionCost: preventionStats.totalCost
        })
        .set('preventionData.recentRecords', [])
        .set('recentPreventionRecords', [])
        .set('batchPreventionList', batchesWithPrevention)
        .set('activeHealthAlerts', [])
        .setTreatmentStats({
          pendingDiagnosis: healthData.pendingDiagnosis,
          ongoingTreatment: healthData.totalOngoing,
          totalTreatmentCost: healthData.totalTreatmentCost,
          cureRate: parseFloat(healthData.cureRate),
          ongoingAnimalsCount: healthData.totalOngoing,
          recoveredCount: healthData.totalCured,
          deadCount: healthData.totalDiedAnimals || 0  // ✅ 使用治疗记录中的死亡数
        })
        .set('treatmentStats.totalTreatments', healthData.totalTreated)
        .set('treatmentStats.totalCost', healthData.totalTreatmentCost)
        .set('treatmentStats.recoveredCount', healthData.totalCured)
        .set('treatmentStats.ongoingCount', healthData.totalOngoingRecords)
        .set('treatmentStats.recoveryRate', healthData.cureRate + '%')
        .set('monitoringData.realTimeStatus.abnormalCount', healthData.abnormalRecordCount)
      
      // ✅ 性能优化：使用分页加载诊断历史
      if (this.diagnosisHistoryPaginator && healthData.latestDiagnosisRecords) {
        const normalizedRecords = normalizeDiagnosisRecords(healthData.latestDiagnosisRecords)
        this.diagnosisHistoryPaginator.setItems(normalizedRecords)
        const initialPage = this.diagnosisHistoryPaginator.getInitialPage()
        updater.set('treatmentData.diagnosisHistory', initialPage.items)
      } else {
        updater.set('treatmentData.diagnosisHistory', normalizeDiagnosisRecords(healthData.latestDiagnosisRecords))
      }
      
      // ✅ 性能优化：使用分页加载异常列表
      if (this.abnormalListPaginator && healthData.abnormalRecords) {
        this.abnormalListPaginator.setItems(healthData.abnormalRecords)
        const initialPage = this.abnormalListPaginator.getInitialPage()
        updater.set('monitoringData.abnormalList', initialPage.items)
      } else {
        updater.set('monitoringData.abnormalList', healthData.abnormalRecords || [])
      }
      
      // ✅ 统一更新存活率，避免与 loadAnalysisData 数据不同步
      updater.set('analysisData.survivalAnalysis', {
        rate: survivalRate,
        trend: survivalTrend,
        byStage: []
      })
      
      this.setData(updater.build())
    } catch (error: unknown) {
      wx.showToast({
        title: '批次数据加载失败',
        icon: 'error'
      })
    }
  },
  
  /**
   * ✅ 加载全局诊疗管理和预防统计数据（不受批次筛选影响）
   * 诊疗管理卡片（待处理、治疗中、治愈数、死亡数）和预防统计（防疫用药、疫苗追踪）
   * 始终显示全部批次的汇总数据
   */
  async loadGlobalTreatmentAndPreventionStats() {
    try {
      // 始终使用全部批次模式获取数据
      const healthData = await this._fetchAllBatchesHealthData({ batchId: 'all' })
      
      if (!healthData) return
      
      // 获取预防统计
      const preventionResult = await HealthCloud.prevention.getDashboard({ batchId: 'all' })
      const preventionStats = preventionResult?.success ? preventionResult.data : {
        vaccineCount: 0,
        medicationCount: 0,
        vaccineCoverage: 0,
        totalCost: 0
      }
      
      // 计算接种率
      const vaccinationRate = healthData.totalAnimals > 0
        ? ((preventionStats.vaccineCoverage / healthData.totalAnimals) * 100).toFixed(1)
        : 0
      
      // 更新诊疗管理卡片和预防统计（全局数据，不受批次筛选影响）
      this.setData({
        // 诊疗管理卡片
        'treatmentData.stats.pendingDiagnosis': healthData.pendingDiagnosis || 0,
        'treatmentData.stats.ongoingTreatment': healthData.totalOngoing || 0,
        'treatmentData.stats.recoveredCount': healthData.totalCured || 0,
        'treatmentData.stats.deadCount': healthData.totalDiedAnimals || healthData.deadCount || 0,
        'treatmentData.stats.totalTreatmentCost': healthData.totalTreatmentCost || 0,
        'treatmentData.stats.cureRate': parseFloat((healthData.cureRate || '0').toString()),
        'treatmentData.stats.ongoingAnimalsCount': healthData.totalOngoing || 0,
        // 预防统计
        'preventionData.stats.vaccineCount': preventionStats.vaccineCount || 0,
        'preventionData.stats.medicationCount': preventionStats.medicationCount || 0,
        'preventionData.stats.vaccineCoverage': preventionStats.vaccineCoverage || 0,
        'preventionData.stats.vaccinationRate': vaccinationRate
      })
    } catch (error) {
      logger.error('[loadGlobalTreatmentAndPreventionStats] 加载全局数据失败:', error)
    }
  },
  
  /**
   * 完全后台刷新数据（不使用加载锁，不阻塞任何操作）
   */
  backgroundRefreshData() {
    // 先清理缓存
    CacheManager.clearAllHealthCache()
    this.invalidateAllBatchesCache()
    
    // 使用 wx.nextTick 确保在下一个渲染周期执行，完全不阻塞当前交互
    wx.nextTick(() => {
      // 再延迟一点，确保页面完全渲染完成，用户可以立即交互
      this._safeSetTimeout(() => {
        this._performBackgroundRefresh()
      }, 50)
    })
  },
  
  /**
   * 执行后台刷新（核心逻辑）
   */
  async _performBackgroundRefresh() {
    try {
      // 显示顶部加载提示，不阻塞UI
      wx.showNavigationBarLoading()
      
      if (this.data.currentBatchId === 'all') {
        // 全部批次模式：快速刷新关键数据
        await this._backgroundRefreshAllBatches()
      } else {
        // ✅ 单批次模式：调用 loadSingleBatchDataOptimized 确保数据正确更新
        // 不使用旧版 loadHealthOverview()，避免数据冲突
        await this.loadSingleBatchDataOptimized()
      }
      
      // 隐藏加载提示
      wx.hideNavigationBarLoading()
    } catch (error: unknown) {
      // 后台刷新失败，静默处理
      wx.hideNavigationBarLoading()
    }
  },
  
  /**
   * 后台刷新所有批次（✅优化：使用公共方法 + 差异对比）
   */
  async _backgroundRefreshAllBatches() {
    try {
      // 使用公共方法获取最新数据，传递当前批次ID
      const healthData = await this._fetchAllBatchesHealthData({ 
        useCache: false, 
        forceRefresh: true,
        batchId: this.data.currentBatchId || 'all'  // 使用当前批次ID
      })
      
      // 获取原始入栏数（全部批次模式）
      // ✅ 移除差异对比逻辑，确保治疗数据变化时也能更新卡片
      const originalQuantity = healthData.originalTotalQuantity || 0
      
      // ✅ 使用 totalDiedAnimals（来自死亡记录表）作为死亡数
      const actualDeadCount = healthData.totalDiedAnimals || healthData.deadCount || 0
      
      // ✅ 性能优化：使用批量更新器合并多个setData
      const updateData = {
        // 健康统计
        'healthStats.totalChecks': healthData.totalAnimals,
        'healthStats.healthyCount': healthData.actualHealthyCount,
        'healthStats.sickCount': healthData.sickCount,
        'healthStats.deadCount': actualDeadCount,
        'healthStats.originalQuantity': originalQuantity,
        'healthStats.healthyRate': originalQuantity > 0 ? formatPercentage(healthData.healthyRate) : '-',
        'healthStats.mortalityRate': originalQuantity > 0 ? formatPercentage(healthData.mortalityRate) : '-',
        // ✅ 修复：同时更新诊疗管理卡片数据
        'treatmentData.stats.pendingDiagnosis': healthData.pendingDiagnosis || 0,
        'treatmentData.stats.ongoingTreatment': healthData.totalOngoing || 0,
        'treatmentData.stats.recoveredCount': healthData.totalCured || 0,
        'treatmentData.stats.deadCount': actualDeadCount,
        'treatmentData.stats.totalTreatmentCost': healthData.totalTreatmentCost || 0,
        'treatmentData.stats.cureRate': parseFloat((healthData.cureRate || '0').toString()),
        'treatmentData.stats.ongoingAnimalsCount': healthData.totalOngoing || 0
      }
      
      if (this.setDataBatcher) {
        this.setDataBatcher.addBatch(updateData)
      } else {
        // 降级方案：如果批量更新器未初始化，使用原有方式
        this.setData(updateData)
      }
    } catch (error: unknown) {
      // 后台刷新失败时静默处理
    }
  },
  /**
   * 优化：加载单个批次数据（使用批量API）
   * 从原来的6次云函数调用减少到1次
   */
  async loadSingleBatchDataOptimized() {
    try {
      const result = await HealthCloud.overview.getBatchCompleteData({ batchId: this.data.currentBatchId,
          includes: ['prevention', 'treatment', 'diagnosis', 'abnormal', 'pending_diagnosis'],
          diagnosisLimit: 10,
          preventionLimit: 20 })
      
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
      const preventionRecords = (data.preventionRecords || []).map((record: unknown) => 
        HealthStatsCalculator.formatPreventionRecord(record)
      )
      
      // 处理诊断历史：使用公共工具函数标准化数据
      const diagnosisHistory = sortDiagnosisByRecency(normalizeDiagnosisRecords(data.diagnosisHistory || []))
      
      // 处理异常记录
      const abnormalRecords = data.abnormalRecords || []
      const abnormalCount = data.abnormalCount || 0
      
      // 待诊断数量
      const pendingDiagnosisCount = data.pendingDiagnosisCount || 0
      
      // 获取原始入栏数（单批次模式）
      // ✅ 修复：优先使用云函数计算好的值，多级容错
      let originalQuantity = Number(healthStats.originalQuantity) || 0
      
      // 容错1：如果云函数没有返回 originalQuantity，尝试从 batchInfo 获取
      if (originalQuantity === 0 && data.batchInfo?.quantity) {
        originalQuantity = Number(data.batchInfo.quantity) || 0
      }
      
      // 容错2：如果还是没有，使用 totalChecks（当前存栏）
      if (originalQuantity === 0 && healthStats.totalChecks) {
        originalQuantity = Number(healthStats.totalChecks) || 0
      }
      
      // 容错3：如果还是没有，使用 totalAnimals
      if (originalQuantity === 0 && healthStats.totalAnimals) {
        originalQuantity = Number(healthStats.totalAnimals) || 0
      }
      
      // 使用数据更新器简化setData调用
      const updater = createDataUpdater()
      
      // ✅ 修复：直接使用云函数计算好的健康率和死亡率（如果有值）
      let healthyRateDisplay = '-'
      let mortalityRateDisplay = '-'
      
      // 优先使用云函数返回的已计算值
      if (healthStats.healthyRate && healthStats.healthyRate !== '0.00') {
        healthyRateDisplay = formatPercentage(healthStats.healthyRate)
      } else if (originalQuantity > 0) {
        // 本地计算健康率
        const totalChecks = Number(healthStats.totalChecks) || Number(healthStats.totalAnimals) || 0
        const abnormalCount = Number(healthStats.abnormalCount) || 0
        const healthyCount = totalChecks - abnormalCount
        healthyRateDisplay = totalChecks > 0 ? formatPercentage((healthyCount / totalChecks) * 100) : '-'
      }
      
      // 获取死亡数用于计算
      const deadCount = Number(healthStats.deadCount) || 0
      
      if (healthStats.mortalityRate && healthStats.mortalityRate !== '0.00') {
        mortalityRateDisplay = formatPercentage(healthStats.mortalityRate)
      } else if (originalQuantity > 0) {
        // 本地计算死亡率
        mortalityRateDisplay = formatPercentage((deadCount / originalQuantity) * 100)
      }
      
      // ✅ 统一计算存活率（与死亡率数据源一致，避免不同步）
      let survivalRate: string | number = '-'
      let survivalTrend = 'stable'
      if (originalQuantity > 0) {
        const survivalCount = originalQuantity - deadCount
        survivalRate = ((survivalCount / originalQuantity) * 100).toFixed(1)
        const mortalityPercent = (deadCount / originalQuantity) * 100
        survivalTrend = mortalityPercent < 1 ? 'improving' : mortalityPercent < 3 ? 'stable' : 'declining'
      }
      
      updater
        .setHealthStats({
          totalChecks: Number(healthStats.totalChecks) || Number(healthStats.totalAnimals) || 0,
          healthyCount: Number(healthStats.healthyCount) || 0,
          sickCount: Number(healthStats.sickCount) || 0,
          deadCount: Number(healthStats.deadCount) || 0,
          healthyRate: healthyRateDisplay,
          mortalityRate: mortalityRateDisplay,
          originalQuantity: originalQuantity
        })
        .set('healthStats.abnormalCount', abnormalCount)
        .set('healthStats.treatingCount', treatmentStats.ongoingCount || 0)
        // ✅ 简化：诊疗管理卡片和预防统计不受批次筛选影响，由 loadGlobalTreatmentAndPreventionStats() 统一加载
        // 这里只更新诊断历史和异常列表（与当前批次相关的数据）
        .set('treatmentData.diagnosisHistory', diagnosisHistory)
        .set('monitoringData.realTimeStatus.abnormalCount', abnormalCount)
        .set('monitoringData.abnormalList', sortDiagnosisByRecency(normalizeDiagnosisRecords(abnormalRecords)))
        .set('recentPreventionRecords', preventionRecords.slice(0, 10))
        .set('preventionData.recentRecords', preventionRecords.slice(0, 10))
        // ✅ 统一更新存活率（与当前批次相关）
        .set('analysisData.survivalAnalysis', {
          rate: survivalRate,
          trend: survivalTrend,
          byStage: []
        })
      
      this.setData(updater.build())
      
    } catch (error: unknown) {
      logger.error('加载批次数据失败:', error)
      wx.showToast({
        title: '加载数据失败',
        icon: 'error'
      })
    }
  },
  
  /**
   * 加载健康概览数据（旧版，仅加载辅助数据）
   * ✅ 重构：不再更新 healthStats.*，这些数据由 loadSingleBatchDataOptimized/loadAllBatchesData 统一管理
   * 避免多个方法同时更新同一数据导致覆盖
   */
  async loadHealthOverview() {
    try {
      const result = await CloudApi.getHealthOverview(
        this.data.currentBatchId,
        this.data.dateRange
      )

      if (result.success && result.data) {
        const { recentPrevention, activeAlerts } = result.data
        
        // ✅ 只更新辅助数据（预警、最近预防记录），不更新 healthStats
        // healthStats 由 loadSingleBatchDataOptimized/loadAllBatchesData 统一管理
        this.setData({
          recentPreventionRecords: recentPrevention || [],
          activeHealthAlerts: activeAlerts || []
        })
      }
    } catch (error: unknown) {
      // 静默处理错误
    }
  },

  /**
   * 加载预防管理数据（委托给预防模块）
   */
  async loadPreventionData() {
    if (this.preventionModule) {
      await this.preventionModule.loadPreventionData()
    }
  },

  /**
   * 加载今日待办任务（委托给预防模块）
   */
  async loadTodayTasks() {
    if (this.preventionModule) {
      await this.preventionModule.loadTodayTasks()
    }
  },

  /**
   * 分组历史任务（委托给预防模块）
   */
  groupHistoryTasksByBatch(tasks: Task[] = []) {
    if (this.preventionModule) {
      return this.preventionModule.groupHistoryTasksByBatch(tasks)
    }
    return []
  },

  /**
   * 在后台清理孤儿任务（不阻塞UI）
   */
  cleanOrphanTasksInBackground() {
    safeCloudCall({
      name: 'breeding-todo',
      data: {
        action: 'clean_orphan_tasks'
      }
    }).then((result: unknown) => {
      const response = result as BaseResponse
      // 后台清理孤儿任务，不显示日志
      if (response.success && response.data && response.data.deletedCount > 0) {
        // 静默清理完成
      }
    }).catch((error: unknown) => {
      logger.error('清理孤儿任务失败:', error)
    })
  },

  /**
   * 加载监控数据（委托给监控模块）
   */
  async loadMonitoringData() {
    if (this.monitoringModule) {
      await this.monitoringModule.loadMonitoringData()
    }
  },

  /**
   * 加载治疗数据
   */
  // 添加治疗数据加载标志，防止重复加载
  isLoadingTreatmentData: false,
  
  /**
   * 加载治疗数据
   * ✅ 简化：诊疗管理卡片始终显示全部批次数据，不受批次筛选影响
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
    forceRefresh?: boolean
  } = {}) {
    const aggregatedStats = options.aggregated
    const forceRefresh = options.forceRefresh || false
    
    // 防止重复加载
    if (this.isLoadingTreatmentData && !forceRefresh) {
      return
    }
    
    this.isLoadingTreatmentData = true
    
    try {
      // ✅ 简化：始终使用全部批次数据，不受当前批次筛选影响
      const aggregatedData = aggregatedStats || await this._fetchAllBatchesHealthData({ 
        batchId: 'all',  // 始终使用全部批次
        forceRefresh: forceRefresh
      })

      // ✅ 简化：诊疗管理卡片数据由 loadGlobalTreatmentAndPreventionStats() 统一管理
      // 这里只更新诊断历史和异常列表
      this.setData({
        'treatmentData.diagnosisHistory': sortDiagnosisByRecency(normalizeDiagnosisRecords(aggregatedData.latestDiagnosisRecords || [])),
        'monitoringData.realTimeStatus.abnormalCount': aggregatedData.abnormalRecordCount || 0,
        'monitoringData.abnormalList': sortDiagnosisByRecency(normalizeDiagnosisRecords(aggregatedData.abnormalRecords || []))
      })

    } catch (error: unknown) {
      logger.error('[治疗数据] 加载失败:', error)
      wx.showToast({
        title: '治疗数据加载失败',
        icon: 'error'
      })
    } finally {
      this.isLoadingTreatmentData = false
    }
  },

  /**
   * 诊断记录点击事件 - 使用公共工具函数处理
   */
  async onDiagnosisRecordTap(e: WechatMiniprogram.CustomEvent) {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    const { record } = e.currentTarget.dataset
    
    // 使用公共工具函数标准化数据
    const normalizedRecord = normalizeDiagnosisRecord(record)
    
    // 使用公共工具函数处理图片URL（只处理 cloud:// 开头的URL）
    const processedImages = await processImageUrls(normalizedRecord.images || [], {
      onlyCloudFiles: true,
      showErrorToast: true
    })
    
    // 显示详情弹窗
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
    // 延迟清空数据，避免关闭动画时数据闪烁（符合项目开发规范）
    this._safeSetTimeout(() => {
      this.setData({
        selectedDiagnosisRecord: null
      })
    }, 300)
  },

  /**
   * 预览图片
   */
  onPreviewDiagnosisImage(e: WechatMiniprogram.CustomEvent) {
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
   * 查看全部诊断记录（使用模块化导航）
   */
  onViewAllDiagnosis() {
    // 使用事件管理器的防重复点击
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    // 使用导航管理器
    HealthNavigationManager.navigateToDiagnosisHistory()
  },

  /**
   * 点击治疗记录，跳转到详情页
   */
  onTreatmentRecordTap(e: WechatMiniprogram.CustomEvent) {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    const { id } = e.currentTarget.dataset
    HealthNavigationManager.navigateToTreatmentDetail(id, {
      treatmentProgressUpdated: () => {
        this.backgroundRefreshData()
      }
    })
  },

  /**
   * 查看全部治疗记录
   */
  onViewAllTreatments() {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    HealthNavigationManager.navigateToTreatmentList({
      treatmentListUpdated: () => {
        this.backgroundRefreshData()
      }
    })
  },

  /**
   * 加载分析数据（只负责成本数据，存活率已在 loadSingleBatchDataOptimized/loadAllBatchesData 中更新）
   */
  async loadAnalysisData() {
    try {
      // 获取成本数据
      const batchId = this.data.currentBatchId || 'all'
      const isAllBatches = batchId === 'all'
      
      // 并行获取所有成本数据
      let preventionPromise: Promise<BaseResponse>
      
      if (isAllBatches) {
        preventionPromise = HealthCloud.prevention.getDashboard({ batchId: batchId }) as Promise<BaseResponse>
      } else {
        preventionPromise = HealthCloud.overview.getBatchCompleteData({ 
          batchId: batchId,
          includes: ['prevention'] 
        }) as Promise<BaseResponse>
      }
      
      // 获取饲养成本的参数
      const feedCostParams: Record<string, unknown> = {
        action: 'get_cost_stats',
        dateRange: this.data.dateRange
      }
      
      // 根据批次模式设置不同的参数
      if (isAllBatches) {
        feedCostParams.batchId = 'all'
      } else {
        feedCostParams.batchId = batchId
        // 单批次模式需要批次编号
        if (this.data.currentBatchNumber && this.data.currentBatchNumber !== '全部批次') {
          feedCostParams.batchNumber = this.data.currentBatchNumber
        }
      }
      
      const [preventionResult, feedCostResult] = await Promise.all([
        preventionPromise,
        // 获取饲养成本
        safeCloudCall({
          name: 'finance-management',
          data: feedCostParams
        })
      ])
      
      // 提取预防成本（确保是数字类型）
      let preventionCost = 0
      const prevResult = preventionResult as BaseResponse<{ preventionCost?: number; stats?: { preventionCost?: number }; preventionStats?: { totalCost?: number } }>
      
      if (isAllBatches) {
        // 全部批次模式：从 data.preventionCost 读取
        if (prevResult?.success && prevResult.data) {
          const costValue = prevResult.data.preventionCost || prevResult.data.stats?.preventionCost || 0
          preventionCost = typeof costValue === 'string' ? parseFloat(costValue) || 0 : Number(costValue) || 0
        }
      } else {
        if (prevResult?.success && prevResult.data?.preventionStats) {
          const costValue = prevResult.data.preventionStats.totalCost
          preventionCost = typeof costValue === 'string' ? parseFloat(costValue) || 0 : Number(costValue) || 0
        }
      }
      
      // 获取治疗成本（确保是数字类型，处理字符串"0.00"）
      let treatmentCost = 0
      try {
        const treatmentCostResult = await HealthCloud.cost.calculateTreatment({
          dateRange: this.data.dateRange,
          batchId: batchId
        })
        
        if (treatmentCostResult?.success) {
          const costValue = treatmentCostResult.data?.totalCost
          // 处理字符串类型的成本（如"0.00"）
          treatmentCost = typeof costValue === 'string' ? parseFloat(costValue) || 0 : Number(costValue) || 0
        }
      } catch (error) {
        // 从已有数据中获取
        treatmentCost = Number(this.data.treatmentData?.stats?.totalTreatmentCost) || 0
      }
      
      // 提取饲养成本（确保是数字类型）
      let feedingCost = 0
      if (feedCostResult?.success) {
        // 优先从feedCost字段获取，确保转换为数字
        const feedData = feedCostResult.data
        // 处理可能的字符串数字
        const feedCostValue = feedData?.feedCost || feedData?.feedingCost || feedData?.totalFeedCost || feedData?.materialCost || 0
        feedingCost = typeof feedCostValue === 'string' ? parseFloat(feedCostValue) || 0 : Number(feedCostValue) || 0
      }
      
      // 确保所有成本都是有效数字
      preventionCost = isNaN(preventionCost) ? 0 : preventionCost
      treatmentCost = isNaN(treatmentCost) ? 0 : treatmentCost
      feedingCost = isNaN(feedingCost) ? 0 : feedingCost
      
      // 计算总成本（已确保都是数字类型）
      const totalCost = parseFloat((preventionCost + treatmentCost + feedingCost).toFixed(2))
      
      // 只更新成本数据（存活率已在 loadSingleBatchDataOptimized/loadAllBatchesData 中更新）
      this.setData({
        'analysisData.costAnalysis': {
          preventionCost: Number(preventionCost.toFixed(2)),
          treatmentCost: Number(treatmentCost.toFixed(2)),
          totalCost: totalCost,
          feedingCost: Number(feedingCost.toFixed(2))
        }
      })
    } catch (error: unknown) {
      logger.error('加载分析数据失败:', error)
      // 错误时设置默认值，避免显示错误数据
      this.setData({
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
  viewPreventionRecord(e: WechatMiniprogram.CustomEvent) {
    const { recordId } = e.currentTarget.dataset
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    HealthNavigationManager.navigateToPreventionRecord(recordId)
  },

  /**
   * 查看健康警报详情
   */
  viewHealthAlert(e: WechatMiniprogram.CustomEvent) {
    const { alertId } = e.currentTarget.dataset
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    // TODO: navigateToHealthAlert 方法未定义，需要添加到 HealthNavigationManager
    // HealthNavigationManager.navigateToHealthAlert(alertId)
    wx.navigateTo({ url: `/packageHealth/health-alert/health-alert?alertId=${alertId}` })
  },

  /**
   * 创建新的健康记录（使用模块化导航）
   */
  createHealthRecord() {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    // TODO: createHealthInspection 方法未定义，需要添加到 HealthNavigationManager
    // HealthNavigationManager.createHealthInspection(this.data.currentBatchId)
    wx.navigateTo({ url: `/packageHealth/health-inspection/health-inspection?batchId=${this.data.currentBatchId}` })
  },

  /**
   * 创建新的预防记录（使用模块化导航）
   */
  createPreventionRecord() {
    // 使用事件管理器的防重复点击
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    // 使用导航管理器
    HealthNavigationManager.createPreventionRecord(this.data.currentBatchId)
  },

  /**
   * 完成待办任务
   */
  onCompleteTask(e: WechatMiniprogram.CustomEvent) {
    const task = e.currentTarget.dataset.task
    if (!task) return
    
    // 根据任务类型处理
    switch (task.taskType) {
      case 'vaccine':
        // 疫苗任务：跳转到疫苗记录页面
        const vaccineParams = `taskId=${task.taskId}&batchId=${task.batchId}&dayAge=${task.dayAge}&taskName=${encodeURIComponent(task.taskName || '')}&fromTask=true`
        wx.navigateTo({
          url: `/packageHealth/vaccine-record/vaccine-record?${vaccineParams}`
        })
        break
        
      case 'medication':
        // 用药任务：打开用药表单（需要选择具体药品和数量）
        this.openMedicationForm(task)
        break
        
      default:
        wx.showToast({
          title: '未知任务类型',
          icon: 'none'
        })
        return
    }
  },

  /**
   * 切换预防管理子标签页（复制自breeding-todo）
   */
  async onPreventionSubTabChange(e: WechatMiniprogram.CustomEvent) {
    const { value } = e.detail
    
    this.setData({
      preventionSubTab: value
    })
    
    // 根据子标签加载对应数据
    switch (value) {
      case 'today':
        await this.loadPreventionData()
        break
      case 'upcoming':
        await this.loadUpcomingTasks()
        break
      case 'history':
        await this.loadHistoryTasks()
        break
    }
  },

  /**
   * 标准化任务数据格式（委托给预防模块）
   */
  normalizeTask(task: Record<string, unknown> = {}, overrides: Record<string, any> = {}) {
    if (this.preventionModule) {
      return this.preventionModule.normalizeTask(task, overrides)
    }
    return task
  },

  /**
   * 加载即将到来的任务（委托给预防模块）
   */
  async loadUpcomingTasks() {
    if (this.preventionModule) {
      await this.preventionModule.loadUpcomingTasks()
    }
  },

  /**
   * 加载历史任务（委托给预防模块）
   */
  async loadHistoryTasks() {
    if (this.preventionModule) {
      await this.preventionModule.loadHistoryTasks()
    }
  },

  /**
   * 查看预防记录详情
   */
  onViewRecord(e: WechatMiniprogram.CustomEvent) {
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
   * 创建新的治疗记录（使用模块化导航）
   */
  createTreatmentRecord() {
    // 使用事件管理器的防重复点击
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    // 使用导航管理器
    HealthNavigationManager.createTreatmentRecord(this.data.currentBatchId)
  },

  /**
   * AI健康诊断（使用模块化导航）
   */
  openAiDiagnosis() {
    // 使用事件管理器的防重复点击
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    // 使用导航管理器
    HealthNavigationManager.navigateToAiDiagnosis(this.data.currentBatchId)
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
   * 待诊断卡片点击 - 跳转到AI诊断页面（使用模块化导航）
   */
  onPendingDiagnosisClick() {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    HealthNavigationManager.navigateToAiDiagnosis()
  },

  /**
   * 治疗中卡片点击 - 跳转到治疗记录列表（使用模块化导航）
   */
  onOngoingTreatmentClick() {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    HealthNavigationManager.navigateToTreatmentList({
      treatmentListUpdated: () => {
        this.backgroundRefreshData()
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
  onAlertAction(_e: unknown) {
    // 预警操作事件处理
    // 已移除调试日志
  },

  /**
   * 预防管理操作事件
   */
  onPreventionAction(e: WechatMiniprogram.CustomEvent) {
    const { action } = e.currentTarget.dataset
    switch (action) {
      case 'add_vaccine':
        this.createPreventionRecord()
        break
      case 'health_inspection':
        this.createHealthRecord()
        break
    }
  },

  /**
   * 监控操作事件
   */
  onMonitoringAction(e: WechatMiniprogram.CustomEvent) {
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
  onTreatmentAction(e: WechatMiniprogram.CustomEvent) {
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
    // 延迟清空数据，避免关闭动画时数据闪烁（符合项目开发规范）
    this._safeSetTimeout(() => {
      this.setData({
        selectedRecord: null
      })
    }, 300)
  },

  /**
   * 详情弹窗显示状态变化（✅优化：延迟清空数据，避免关闭动画时数据闪烁）
   */
  onHealthDetailPopupChange(e: WechatMiniprogram.CustomEvent) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showDetailPopup: false
      })
      // 延迟清空数据，避免关闭动画时数据闪烁（符合项目开发规范）
      this._safeSetTimeout(() => {
        this.setData({
          selectedRecord: null
        })
      }, 300)
    }
  },

  /**
   * 显示详情弹窗
   */
  showDetailPopup(data: unknown) {
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
      const result = await CloudApi.callFunction(
        'production-entry',
        { action: 'getActiveBatches' },
        { showError: false, useCache: false }
      )

      if (result && result.success && result.data) {
        // 修复数据读取路径
        const batches = Array.isArray(result.data) ? result.data : (result.data.batches || [])
        
        // 使用云函数返回的dayAge
        const batchesWithDayAge = batches.map((batch: Record<string, unknown>) => {
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
          const currentBatch = batchesWithDayAge.find((b: unknown) => b._id === this.data.currentBatchId)
          if (currentBatch) {
            this.setData({
              currentBatchNumber: currentBatch.batchNumber
            })
          }
        }
      }
    } catch (error: unknown) {
      // 加载批次列表失败，静默处理
    }
  },

  /**
   * 切换下拉菜单显示状态
   */
  toggleBatchDropdown() {
    const willShow = !this.data.showBatchDropdown
    
    if (willShow) {
      const query = wx.createSelectorQuery().in(this)
      query.select('#batch-filter-btn').boundingClientRect()
      query.selectViewport().scrollOffset()
      
      query.exec((res) => {
        if (res && res[0] && res[1]) {
          const rect = res[0]
          const windowInfo = wx.getWindowInfo()
          
          const dropdownTop = rect.top + rect.height + 8
          const dropdownRight = windowInfo.windowWidth - rect.right
          
          this.setData({
            dropdownTop: dropdownTop,
            dropdownRight: dropdownRight,
            showBatchDropdown: true
          })
        } else {
          this.setData({
            dropdownTop: 120,
            dropdownRight: 12,
            showBatchDropdown: true
          })
        }
      })
    } else {
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
    // 显示加载提示
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
      
      // 全面刷新数据
      await this.refreshAllDataForBatchChange()
      
    } catch (error) {
      logger.error('切换批次失败:', error)
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
  async selectBatchFromDropdown(e: WechatMiniprogram.CustomEvent) {
    const index = parseInt(e.currentTarget.dataset.index)
    const batches = this.data.availableBatches
    
    // 显示加载提示
    wx.showLoading({
      title: '切换批次中...',
      mask: true
    })
    
    try {
      let newBatchId = ''
      let newBatchNumber = ''
      
      // 处理全部批次选项 (index = -1)
      if (index === -1) {
        newBatchId = 'all'
        newBatchNumber = '全部批次'
      } else if (index >= 0 && index < batches.length) {
        // 处理具体批次
        const selectedBatch = batches[index]
        newBatchId = selectedBatch._id
        newBatchNumber = selectedBatch.batchNumber
      } else {
        logger.warn('[批次选择] 无效的批次索引:', index)
        wx.hideLoading()
        return
      }
      
      // 一次性设置：批次信息 + 关闭下拉框
      // ✅ 简化：不再清空诊疗管理卡片数据，因为它们不受批次筛选影响
      this.setData({
        currentBatchId: newBatchId,
        currentBatchNumber: newBatchNumber,
        showBatchDropdown: false
      })
      
      // 保存选择
      try { wx.setStorageSync('currentBatchId', newBatchId) } catch (_) {}
      
      // 全面刷新数据
      await this.refreshAllDataForBatchChange()
    } catch (error) {
      logger.error('[批次选择] 切换失败:', error)
      wx.showToast({
        title: '切换失败',
        icon: 'error'
      })
    } finally {
      wx.hideLoading()
    }
  },
  
  /**
   * 批次切换时全面刷新数据
   * ✅ 简化：loadHealthData 已经会根据 activeTab 加载对应数据，无需重复调用
   */
  async refreshAllDataForBatchChange() {
    try {
      // 1. 停止数据监听器，防止死循环
      this.stopDataWatcher()
      
      // 2. 清除缓存
      this.invalidateAllBatchesCache()
      CacheManager.clearAllHealthCache()
      
      // 3. 加载健康数据 - loadHealthData 内部会根据 activeTab 加载对应 Tab 数据
      // 禁用防抖，确保数据立即加载完成
      await this.loadHealthData(true, false)
      
      // 4. 如果在 overview Tab，额外加载辅助数据（预警等）
      if (this.data.activeTab === 'overview') {
        await this.loadHealthOverview()
      }
      
      // 5. 数据加载完成后，重新启动监听器
      wx.nextTick(() => {
        this.startDataWatcher()
      })
      
    } catch (error) {
      logger.error('刷新批次数据失败:', error)
      // 即使出错也要重新启动监听器
      wx.nextTick(() => {
        this.startDataWatcher()
      })
      throw error
    }
  },

  /**
   * 跳转到治愈记录列表（使用模块化导航）
   */
  navigateToCuredRecords() {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    HealthNavigationManager.navigateToCuredList({
      curedRecordsUpdated: () => {
        this.backgroundRefreshData()
      }
    })
  },

  /**
   * 跳转到死亡记录列表（使用模块化导航）
   */
  navigateToDeathRecords() {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    HealthNavigationManager.navigateToDeathList({
      deathRecordsUpdated: () => {
        this.backgroundRefreshData()
      }
    })
  },

  /**
   * 点击死亡数卡片，跳转到死亡记录列表（使用模块化导航）
   */
  onDeathCountTap() {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    HealthNavigationManager.navigateToDeathList({
      deathRecordsUpdated: () => {
        this.backgroundRefreshData()
      }
    })
  },

  /**
   * 点击异常数量，跳转到异常记录列表（使用模块化导航）
   */
  onAbnormalCountTap() {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    HealthNavigationManager.navigateToAbnormalList({
      abnormalRecordsUpdated: () => {
        this.backgroundRefreshData()
      }
    })
  },

  /**
   * 点击疫苗数量，跳转到疫苗记录列表（使用模块化导航）
   */
  onVaccineCountTap() {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    HealthNavigationManager.navigateToVaccineList({
      vaccineRecordsUpdated: () => {
        this.backgroundRefreshData()
      }
    })
  },

  /**
   * 点击用药数量，跳转到用药记录列表（使用模块化导航）
   */
  onMedicationCountTap() {
    if (typeof this.checkDoubleClick === 'function' && this.checkDoubleClick()) return
    
    HealthNavigationManager.navigateToMedicationList({
      medicationRecordsUpdated: () => {
        this.backgroundRefreshData()
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
   * 查看任务详情（优化：立即显示弹窗，异步加载用户信息）
   */
  async viewTaskDetail(e: WechatMiniprogram.CustomEvent) {
    // 内联防重复点击逻辑，不依赖可能未初始化的方法
    const now = Date.now()
    if (this._lastTaskClickTime && now - this._lastTaskClickTime < 300) {
      return
    }
    this._lastTaskClickTime = now
    
    const task = e.currentTarget.dataset.task
    if (!task) return
    
    // 判断任务是否为即将到来的任务（来自 upcoming 标签）
    const isUpcomingTask = this.data.preventionSubTab === 'upcoming'
    
    // 立即构建基础任务数据并显示弹窗（不等待异步操作）
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
      
      // 标记是否为即将到来的任务（禁止操作）
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
      completedBy: task.completedBy || '加载中...'  // 先显示加载中
    }

    // 关键优化：立即显示弹窗，提供即时反馈
    this.setData({
      selectedTask: enhancedTask,
      showTaskDetailPopup: true
    })
    
    // 异步加载用户信息（不阻塞弹窗显示）
    this.loadCompletedByUserName(task.completedBy)
  },

  /**
   * 新增：异步加载任务完成人员信息（不阻塞UI）
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
    // 延迟清空数据，避免关闭动画时数据闪烁（符合项目开发规范）
    this._safeSetTimeout(() => {
      this.setData({
        selectedTask: null
      })
    }, 300)
  },

  /**
   * 任务详情弹窗显示状态变化（✅优化：延迟清空数据，避免关闭动画时数据闪烁）
   */
  onTaskDetailPopupChange(e: WechatMiniprogram.CustomEvent) {
    const { visible } = e.detail
    if (!visible) {
      this.setData({
        showTaskDetailPopup: false
      })
      // 延迟清空数据，避免关闭动画时数据闪烁（符合项目开发规范）
      this._safeSetTimeout(() => {
        this.setData({
          selectedTask: null
        })
      }, 300)
    } else {
      // 弹窗显示时，检测文本换行并应用对齐样式
      this._safeSetTimeout(() => {
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
      
      res.forEach((rect: unknown, index: number) => {
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
    // 内联防重复点击逻辑
    const now = Date.now()
    if (this._lastTaskClickTime && now - this._lastTaskClickTime < 300) {
      return
    }
    this._lastTaskClickTime = now
    
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
  async completeNormalTask(task: TaskItem) {
    try {
      // 🔧 修复：使用兼容的字段获取方式，优先使用_id（数据库文档ID）
      const taskId = task._id || task.taskId || task.id
      const batchId = task.batchId || this.data.currentBatchId
      
      if (!taskId) {
        logger.error('任务ID缺失:', task)
        wx.showToast({
          title: '任务ID缺失',
          icon: 'error'
        })
        return
      }
      
      if (!batchId) {
        logger.error('批次ID缺失:', task)
        wx.showToast({
          title: '批次ID缺失',
          icon: 'error'
        })
        return
      }
      
      logger.info('开始完成任务:', { 
        taskId, 
        batchId, 
        taskFields: {
          _id: task._id,
          id: task.id,
          taskId: task.taskId,
          title: task.title
        }
      })
      
      const result = await safeCloudCall({
        name: 'breeding-todo',
        data: {
          action: 'complete_task',
          taskId: taskId,
          batchId: batchId,
          notes: ''
        }
      })
      
      const response = result as BaseResponse
      
      // 🔧 修复：完善错误处理
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
      } else {
        // 🔧 新增：显示云函数返回的错误信息
        logger.error('完成任务失败:', response)
        wx.showToast({
          title: response.error || response.message || '操作失败',
          icon: 'error',
          duration: 3000
        })
      }
    } catch (error: unknown) {
      logger.error('完成任务异常:', error)
      wx.showToast({
        title: (error as Error).message || '操作失败',
        icon: 'error',
        duration: 3000
      })
    }
  },

  /**
   * 打开疫苗表单（委托给疫苗模块）
   */
  async openVaccineForm(task: unknown) {
    if (this.vaccineModule) {
      this.vaccineModule.initVaccineForm(task)
      this.setData({
        showVaccineFormPopup: true,
        showTaskDetailPopup: false
      })
    }
  },


  /**
   * 通用关闭表单方法
   */
  closeFormPopup(formType: 'vaccine' | 'medication' | 'nutrition') {
    const updateData: Record<string, unknown> = {}
    
    switch (formType) {
      case 'vaccine':
        updateData.showVaccineFormPopup = false
        break
      case 'medication':
        updateData.showMedicationFormPopup = false
        updateData.selectedMedicine = null
        updateData.medicationFormErrors = {}
        updateData.medicationFormErrorList = []
        break
      case 'nutrition':
        updateData.showNutritionFormPopup = false
        updateData.selectedNutrition = null
        updateData.nutritionFormErrors = {}
        updateData.nutritionFormErrorList = []
        break
    }
    
    this.setData(updateData)
  },
  
  /**
   * 关闭疫苗表单（兼容旧代码）
   */
  closeVaccineFormPopup() {
    this.closeFormPopup('vaccine')
  },

  /**
   * 处理疫苗表单输入（委托给疫苗模块）
   */
  onVaccineFormInput(e: WechatMiniprogram.CustomEvent) {
    if (this.vaccineModule) {
      this.vaccineModule.onVaccineFormInput(e)
    }
  },


  /**
   * 数值输入处理（费用相关，适配组件事件）
   */
  onVaccineNumberInput(e: WechatMiniprogram.CustomEvent) {
    const { field, value } = e.detail || e.currentTarget?.dataset || {}
    const actualValue = value || e.detail?.value || ''
    
    if (!field) return
    
    // 如果是接种数量，需要验证不超过存栏数量
    if (field === 'vaccinationCount') {
      const vaccinationCount = parseInt(actualValue) || 0
      // 先获取完整的表单数据，修改后整体设置
      const updatedFormData = { ...this.data.vaccineFormData, [field]: vaccinationCount }
      this.setData({
        vaccineFormData: updatedFormData
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
      // 先获取完整的表单数据，修改后整体设置
      const updatedFormData = { ...this.data.vaccineFormData, [field]: actualValue }
      this.setData({
        vaccineFormData: updatedFormData
      }, () => {
        // 如果是费用相关字段，重新计算总费用
        if (['vaccineCost', 'veterinaryCost', 'otherCost'].includes(field)) {
          this._safeSetTimeout(() => {
            this.calculateTotalCost()
          }, 100)
        }
      })
    }
  },

  /**
   * 路径选择处理
   */
  onVaccineRouteChange(e: WechatMiniprogram.CustomEvent) {
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
   * 验证疫苗表单（使用通用验证器）
   */
  validateVaccineForm(): boolean {
    const { vaccineFormData } = this.data
    const validation = FormValidator.validateForm(vaccineFormData, vaccineFormRules)
    
    // 更新错误对象和错误列表
    this.setData({ 
      vaccineFormErrors: validation.errors,
      vaccineFormErrorList: validation.errorList
    })

    if (!validation.isValid) {
      wx.showToast({
        title: validation.errorList[0],
        icon: 'error'
      })
      return false
    }

    return true
  },

  /**
   * 提交疫苗表单
   */
  async submitVaccineForm(e?: unknown) {
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
      preventionDate: getCurrentBeijingDate(), // 使用北京时间
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
        // 重要：标记疫苗接种费用需要同步到财务系统
        // 疫苗接种是养殖场的重要成本项，应当记入财务管理
        shouldSyncToFinance: true
      },
      notes: vaccineFormData.notes
    }

    await withErrorHandler(
      async () => {
        const res = await safeCloudCall({
          name: 'health-prevention',  // 使用拆分后的云函数
          data: {
            action: 'complete_prevention_task',
            taskId: selectedTask._id,
            batchId: batchId,
            preventionData
          }
        }) as BaseResponse
        
        if (res && res.success) {
          this.closeVaccineFormPopup()
          // 📝 优化：统一使用 loadPreventionData 刷新任务列表
          if (this.data.preventionSubTab === 'today') {
            this.loadPreventionData()
          }
          return res
        } else {
          throw new Error(res?.message || '提交失败')
        }
      },
      {
        loadingText: '提交中...',
        successText: '疫苗接种记录已创建',
        errorText: '提交失败，请重试'
      }
    )
  },

  /**
   * 打开用药表单
   */
  async openMedicationForm(task: unknown) {
    // 先加载可用的药品库存
    await this.loadAvailableMedicines()
    
    // 获取当前批次的存栏数量
    let currentBatchStockQuantity = 0
    const batchId = task.batchId || this.data.currentBatchId
    if (batchId && batchId !== 'all') {
      try {
        const batchResult = await safeCloudCall({
          name: 'production-entry',
          data: { action: 'getActiveBatches' },
          useCache: true  // 自动缓存10分钟
        })
        
        if ((batchResult as unknown).result?.success) {
          const activeBatches = (batchResult as unknown).result.data || []
          const currentBatch = activeBatches.find((b: unknown) => b._id === batchId)
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
      currentBatchStockQuantity: Number(currentBatchStockQuantity) || 0,  // 设置存栏数量，确保为数字
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
      
      const res = result as BaseResponse<{ materials: MaterialItem[] }>
      if (res && res.success) {
        const materials = res.data?.materials || []
        
        
        const availableMedicines = materials
          .filter((material: MaterialItem) => (material.currentStock || 0) > 0)
          .map((material: MaterialItem) => {
            const medicine = {
              id: material._id,
              name: material.name,
              unit: material.unit || '件',
              stock: material.currentStock || 0,
              unitPrice: material.unitPrice || material.avgCost || material.price || 0,
              category: material.category,
              description: material.description || ''
            }
            return medicine
          })
        
        this.setData({
          availableMedicines: Array.isArray(availableMedicines) ? availableMedicines : []
        })
      }
    } catch (error: unknown) {
      logger.error('加载药品库存失败:', error)
    }
  },

  /**
   * 选择药品（适配组件事件）
   */
  onMedicineSelect(e: WechatMiniprogram.CustomEvent) {
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
  onMedicationFormInput(e: WechatMiniprogram.CustomEvent) {
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
  onMedicationQuantityInput(e: WechatMiniprogram.CustomEvent) {
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
  onMedicationAnimalCountInput(e: WechatMiniprogram.CustomEvent) {
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
   * 关闭用药表单（兼容旧代码）
   */
  closeMedicationFormPopup() {
    this.closeFormPopup('medication')
  },

  /**
   * 验证用药表单（使用通用验证器）
   */
  validateMedicationForm(): boolean {
    const { medicationFormData, selectedMedicine } = this.data
    
    // 先进行基本验证
    const formData = {
      ...medicationFormData,
      medicineId: selectedMedicine ? medicationFormData.medicineId : ''
    }
    
    const validation = FormValidator.validateForm(formData, medicationFormRules)
    const errors = { ...validation.errors }
    
    // 添加库存验证（自定义验证）
    if (selectedMedicine && medicationFormData.quantity > selectedMedicine.stock) {
      errors.quantity = `超出库存量（库存：${selectedMedicine.stock}${selectedMedicine.unit}）`
    }
    
    const errorList = Object.values(errors)
    
    // 更新错误对象和错误列表
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

      // 用途字段使用任务标题，不需要用户重复填写
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
        
        // 创建健康预防记录 - 使用新架构
        const preventionResult = await HealthCloud.prevention.completeTask({
          taskId: selectedTask._id,
          batchId: batchId,
          preventionData: {
            preventionType: 'medicine',  // 修复：使用正确的类型值
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
        })
        
        
        if (!preventionResult) {
          throw new Error('云函数调用失败：返回值为空，请检查云函数是否正确部署')
        }
        
        if (!preventionResult.success) {
          throw new Error(preventionResult?.message || preventionResult?.error || '创建预防记录失败')
        }
        
        await this.completeMedicationTask(selectedTask._id, batchId)
        
        // 关闭loading
        wx.hideLoading()
        
        // 显示成功提示
        wx.showToast({
          title: '用药记录已创建',
          icon: 'success'
        })

        // 关闭表单
        this.closeMedicationFormPopup()
        
        
        // 刷新数据（使用原来的完整刷新逻辑）
        try {
          // 1. 刷新批次列表（确保新批次能被加载）
          await this.loadAvailableBatches()
          
          // 2. 刷新基础健康数据（包括健康率、死亡率等）
          await this.loadHealthData(true, false)  // silent模式，禁用防抖确保数据立即加载
          
          // 3. 刷新当前标签的数据
          await this.loadTabData(this.data.activeTab)
          
        } catch (refreshError) {
          logger.error('[刷新] 数据刷新失败:', refreshError)
        }

      } else {
        throw new Error(result?.message || '提交失败')
      }

    } catch (error: unknown) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 通用的任务完成方法
   */
  async completeTask(taskId: string, batchId: string) {
    try {
      const result = await safeCloudCall({
        name: 'breeding-todo',
        data: {
          action: 'complete_task',
          taskId: taskId,
          batchId: batchId,
          completedAt: new Date().toISOString(),
          completedBy: wx.getStorageSync('userInfo')?.nickName || '用户'
        }
      })
      
      if (result?.success) {
        wx.showToast({
          title: '任务已完成',
          icon: 'success'
        })
        
        // 刷新任务列表，确保任务流转到已完成
        this._safeSetTimeout(() => {
          this.loadPreventionData()  // 刷新当前任务
          this.loadHistoryTasks()     // 刷新已完成任务
        }, 500)
      } else {
        throw new Error(result?.message || '完成任务失败')
      }
    } catch (error: unknown) {
      logger.error('完成任务失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
    }
  },
  
  /**
   * 完成用药管理任务（兼容旧代码）
   */
  async completeMedicationTask(taskId: string, batchId: string) {
    return this.completeTask(taskId, batchId)
  },

  /**
   * 打开营养表单
   */
  async openNutritionForm(task: unknown) {
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

      const res = result as BaseResponse<{ materials: MaterialItem[] }>
      if (res && res.success) {
        const materials = res.data?.materials || []
        const availableNutrition = materials
          .filter((material: MaterialItem) => (material.currentStock || 0) > 0)
          .map((material: MaterialItem) => ({
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
    } catch (error: unknown) {
      logger.error('加载营养品库存失败:', error)
    }
  },

  /**
   * 选择营养品（适配组件事件）
   */
  onNutritionSelect(e: WechatMiniprogram.CustomEvent) {
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
  onNutritionFormInput(e: WechatMiniprogram.CustomEvent) {
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
  onNutritionQuantityInput(e: WechatMiniprogram.CustomEvent) {
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
   * 关闭营养管理表单（兼容旧代码）
   */
  closeNutritionFormPopup() {
    this.closeFormPopup('nutrition')
  },

  /**
   * 验证营养表单（使用通用验证器）
   */
  validateNutritionForm(): boolean {
    const { nutritionFormData, selectedNutrition } = this.data
    
    // 先进行基本验证
    const formData = {
      ...nutritionFormData,
      nutritionId: selectedNutrition ? nutritionFormData.nutritionId : ''
    }
    
    const validation = FormValidator.validateForm(formData, nutritionFormRules)
    const errors = { ...validation.errors }
    
    // 添加库存验证（自定义验证）
    if (selectedNutrition && nutritionFormData.quantity > selectedNutrition.stock) {
      errors.quantity = `库存不足，当前库存${selectedNutrition.stock}${selectedNutrition.unit}`
    }
    
    const errorList = Object.values(errors)
    
    // 更新错误对象和错误列表
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
  async submitNutritionForm(e?: unknown) {
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

    } catch (error: unknown) {
      wx.hideLoading()
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error'
      })
    }
  },

  /**
   * 完成营养管理任务（兼容旧代码）
   */
  async completeNutritionTask(taskId: string, batchId: string) {
    return this.completeTask(taskId, batchId)
  },

  /**
   * 关闭异常反应处理弹窗（符合规范3.4：延迟清空数据）
   */
  closeAdverseReactionPopup() {
    this.setData({
      showAdverseReactionPopup: false
    })
    // ⚠️ 重要：延迟清空数据，避免弹窗关闭动画时数据闪烁
    this._safeSetTimeout(() => {
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
  onAdverseReactionInput(e: InputEvent) {
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
  onSeverityChange(e: WechatMiniprogram.CustomEvent) {
    const index = e.detail?.index ?? e.detail?.value ?? 0
    this.setData({
      'adverseReactionData.severityIndex': index
    })
  },

  /**
   * 提交异常反应记录（适配组件事件）
   */
  async submitAdverseReactionRecord(e?: unknown) {
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
        name: 'health-abnormal',  // 使用拆分后的云函数
        data: {
          action: 'create_abnormal_record',  // 使用新的action名称
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
    } catch (error: unknown) {
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
