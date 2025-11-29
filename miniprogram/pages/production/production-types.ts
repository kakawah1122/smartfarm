// production-types.ts - 生产管理类型定义

// 通用类型
export type AnyObject = Record<string, unknown>
export type CustomEvent<T = Record<string, unknown>> = WechatMiniprogram.CustomEvent<T>

// 错误类型
export interface WxError {
  errMsg?: string
  message?: string
}

// AI盘点结果类型
export interface AICountResult {
  totalCount: number
  confidence: number
  imageUrl?: string
  detectionMethod?: string
  featureBreakdown?: Record<string, unknown>
  individualAnalysis?: unknown[]
  regions?: unknown[]
  abnormalDetection?: unknown
  suggestions?: string[]
  reasoning?: string
  sceneAnalysis?: {
    description?: string
    recommendations?: string[]
  }
  sceneFeatures?: unknown
  message?: string
}

// 入栏统计
export interface EntryStats {
  total: string | number
  stockQuantity: string | number
  batches: string | number
}

// 出栏统计
export interface ExitStats {
  total: string | number
  batches: string | number
  avgWeight: string | number
}

// 物料统计
export interface MaterialStats {
  feed: string | number
  medicineStatus: string
  feedDetails?: {
    todayUsage: number
    weekUsage: number
    monthUsage: number
    unit: string
  }
  medicineDetails?: {
    lowStockCount: number
    expiringSoonCount: number
  }
}

// 批次记录
export interface BatchRecord {
  _id: string
  batchNumber: string
  entryDate: string
  quantity: number
  currentStock?: number
  status?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

// 出栏记录
export interface ExitRecord {
  _id: string
  batchId: string
  batchNumber?: string
  exitDate: string
  quantity: number
  weight?: number
  avgWeight?: number
  reason?: string
  notes?: string
  createdAt?: string
}

// 物料记录
export interface MaterialRecord {
  _id: string
  materialId: string
  materialName?: string
  type: 'in' | 'out' | 'use'
  quantity: number
  unit: string
  recordDate: string
  operator?: string
  notes?: string
  createdAt?: string
}

// 物料项
export interface MaterialItem {
  _id: string
  name: string
  category: string
  unit: string
  currentStock: number
  specification?: string
  unitPrice?: number
  avgCost?: number
  status?: string
}

// AI盘点状态
export interface AICountState {
  active: boolean
  loading: boolean
  imageUrl: string
  result: AICountResult | null
  error: string | null
  history: AICountResult[]
  rounds: AICountResult[]
  currentRound: number
  cumulativeTotal: number
}

// 分页状态
export interface PaginationState {
  page: number
  hasMore: boolean
  loading: boolean
}

// 分页集合
export interface PaginationCollection {
  entry: PaginationState
  exit: PaginationState
  material: PaginationState
}

// Tab加载状态
export interface TabLoadStatus {
  entry: boolean
  exit: boolean
  material: boolean
}

// 云函数返回类型
export interface CloudResult<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// 页面数据类型
export interface ProductionPageData {
  activeTab: 'entry' | 'exit' | 'material'
  entryStats: EntryStats
  exitStats: ExitStats
  materialStats: MaterialStats
  aiCount: AICountState
  pagination: PaginationCollection
  isFirstLoad: boolean
  tabLoadStatus: TabLoadStatus
  entryList: BatchRecord[]
  exitList: ExitRecord[]
  materialList: MaterialRecord[]
  loading: boolean
  refreshing: boolean
}

// Tab选项
export const TAB_OPTIONS = [
  { key: 'entry', label: '入栏管理' },
  { key: 'exit', label: '出栏管理' },
  { key: 'material', label: '物料管理' }
]
