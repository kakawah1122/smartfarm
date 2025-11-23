/**
 * Health模块专用类型定义
 */

/**
 * 批次数据类型
 */
export interface Batch {
  _id: string
  batchId?: string
  batchNumber: string
  entryDate?: string
  currentStock?: number
  initialStock?: number
  totalDeathCount?: number
  exitCount?: number
  status?: string
  [key: string]: unknown
}

/**
 * 任务数据类型
 */
export interface Task {
  _id?: string
  id?: string
  taskId?: string
  title?: string
  taskName?: string
  name?: string
  displayTitle?: string
  content?: string
  description?: string
  type?: string
  taskType?: string
  dueDate?: string | Date
  scheduledDate?: string | Date
  completed?: boolean
  status?: string
  completedDate?: string | Date
  completedBy?: string
  batchId?: string
  batchNumber?: string
  importance?: number
  executionRecords?: ExecutionRecord[]
  [key: string]: unknown
}

/**
 * 执行记录类型
 */
export interface ExecutionRecord {
  executorName?: string
  executedAt?: string | Date
  notes?: string
  [key: string]: unknown
}

/**
 * 预防数据类型
 */
export interface PreventionData {
  todayTasks?: Task[]
  upcomingTasks?: Task[]
  historyTasks?: Task[]
  taskGroups?: TaskGroup[]
  upcomingTasksByBatch?: TaskBatchGroup[]
  historyTasksByBatch?: TaskBatchGroup[]
  completionRate?: number
  ongoingCount?: number
  todayCount?: number
  completedCount?: number
  upcomingCount?: number
}

/**
 * 任务分组类型
 */
export interface TaskGroup {
  batchId: string
  batchNumber: string
  tasks: Task[]
  isExpanded?: boolean
  [key: string]: unknown
}

/**
 * 按批次分组的任务
 */
export interface TaskBatchGroup {
  batchId: string
  batchNumber: string
  tasks: Task[]
  isExpanded?: boolean
  stockQuantity?: number
  dayAge?: number
  [key: string]: unknown
}

/**
 * 监测数据类型
 */
export interface MonitoringData {
  abnormalCount?: number
  deathCount?: number
  treatmentCount?: number
  recoveryCount?: number
  stats?: MonitoringStats
}

/**
 * 监测统计
 */
export interface MonitoringStats {
  totalAbnormal?: number
  totalDeath?: number
  totalTreatment?: number
  totalRecovery?: number
  [key: string]: unknown
}

/**
 * 治疗数据类型
 */
export interface TreatmentData {
  records?: TreatmentRecord[]
  stats?: TreatmentStats
  ongoingCount?: number
  completedCount?: number
  totalCount?: number
}

/**
 * 治疗记录
 */
export interface TreatmentRecord {
  _id: string
  batchId?: string
  batchNumber?: string
  status?: string
  treatmentType?: string
  startDate?: string | Date
  endDate?: string | Date
  cost?: number | string
  [key: string]: unknown
}

/**
 * 治疗统计
 */
export interface TreatmentStats {
  totalTreatmentCost?: number
  ongoingCount?: number
  completedCount?: number
  [key: string]: unknown
}

/**
 * 分析数据类型
 */
export interface AnalysisData {
  mortalityRate?: AnalysisSection
  treatmentRate?: AnalysisSection
  costAnalysis?: AnalysisSection
  preventionCompletion?: AnalysisSection
}

/**
 * 分析数据节
 */
export interface AnalysisSection {
  value?: number | string
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: number | string
  description?: string
  [key: string]: unknown
}

/**
 * 云函数响应类型
 */
export interface CloudResponse<T = unknown> {
  success?: boolean
  data?: T
  result?: {
    success?: boolean
    data?: T
    message?: string
    error?: string
  }
  message?: string
  error?: string
  errMsg?: string
}

/**
 * 基础响应类型
 */
export interface BaseResponse {
  result?: {
    success?: boolean
    data?: unknown
    message?: string
    error?: string
  }
  [key: string]: unknown
}

/**
 * 页面自定义方法
 */
export interface PageCustom {
  // 预防模块
  preventionModule?: unknown
  // 监测模块  
  monitoringModule?: unknown
  // 治疗模块
  treatmentModule?: unknown
  // 分析模块
  analysisModule?: unknown
  
  // 数据加载
  loadAllData: () => Promise<void>
  loadPreventionData: (options?: { silent?: boolean }) => Promise<void>
  loadMonitoringData: () => Promise<void>
  loadTreatmentData: () => Promise<void>
  loadAnalysisData: () => Promise<void>
  
  // 批次相关
  onBatchChange: (event: WechatMiniprogram.CustomEvent) => void
  onBatchFilterChange: (event: WechatMiniprogram.CustomEvent) => void
  refreshAllDataForBatchChange: () => Promise<void>
  
  // 任务相关
  normalizeTask: (task: Task, overrides?: Record<string, unknown>) => Task
  groupHistoryTasksByBatch: (tasks: Task[]) => TaskBatchGroup[]
  
  // 工具方法
  fixBatchDeathCount: () => void
  fixTreatmentStatus: () => void
  
  // 生命周期
  isLoadingData: boolean
  pendingAllBatchesPromise: Promise<unknown> | null
  dataWatchers: unknown | null
  loadDataDebounceTimer: unknown
  latestAllBatchesSnapshot: unknown
  latestAllBatchesFetchedAt: number
  batchAnalysisCache: unknown
  
  [key: string]: unknown
}

/**
 * 页面数据类型
 */
export interface PageData {
  // 选项卡
  activeTab: 'prevention' | 'monitoring' | 'treatment' | 'analysis'
  prevActiveTab: string
  
  // 批次相关
  currentBatchId: string
  currentBatchName: string
  allBatches: Batch[]
  batchFilter: string
  
  // 预防管理
  activePreventionTab: number
  preventionData: PreventionData
  selectedTask: Task | null
  showTaskDetailPopup: boolean
  taskGroups: TaskGroup[]
  upcomingTasksByBatch: TaskBatchGroup[]
  historyTasksByBatch: TaskBatchGroup[]
  
  // 监测管理
  monitoringData: MonitoringData
  
  // 治疗管理
  treatmentData: TreatmentData
  
  // 效果分析
  analysisData: AnalysisData
  
  // UI状态
  loading: boolean
  refreshing: boolean
  hasError: boolean
  errorMessage: string
  isPreloading: boolean
  isHistoryLoading: boolean
  isAnalyzing: boolean
}

/**
 * 批量更新数据
 */
export interface BatchUpdates extends Record<string, unknown> {
  'preventionData.todayTasks'?: Task[]
  'preventionData.upcomingTasks'?: Task[]
  'preventionData.historyTasks'?: Task[]
  'monitoringData.abnormalCount'?: number
  'monitoringData.deathCount'?: number
  'treatmentData.ongoingCount'?: number
  'analysisData.mortalityRate'?: AnalysisSection
  [key: string]: unknown
}
