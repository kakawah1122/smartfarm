/**
 * 核心业务类型定义
 * 用于替代项目中的any类型
 */

// ==================== 基础类型 ====================

/**
 * 基础响应类型
 */
export interface BaseResponse<T = unknown> {
  success: boolean
  data: T
  error?: string
  errMsg?: string
  code?: number
}

/**
 * 分页数据
 */
export interface PageData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  hasMore?: boolean
}

/**
 * 云函数响应
 */
export interface CloudFunctionResponse<T = unknown> {
  result: T
  errMsg: string
  requestID?: string
}

// ==================== 业务实体 ====================

/**
 * 批次信息
 */
export interface Batch {
  _id: string
  batchNumber: string
  batchName?: string
  quantity: number
  currentQuantity: number
  status: 'active' | 'inactive' | 'completed'
  entryDate: string | Date
  exitDate?: string | Date
  breed?: string
  supplier?: string
  userId?: string
  _openid?: string
  createTime: string | Date
  updateTime?: string | Date
  isDeleted?: boolean
}

/**
 * 健康记录基础类型
 */
export interface HealthRecord {
  _id: string
  batchId: string
  batchNumber?: string
  type: 'prevention' | 'treatment' | 'diagnosis' | 'death'
  status?: 'pending' | 'ongoing' | 'completed' | 'cancelled'
  createTime: string | Date
  updateTime?: string | Date
  createdBy?: string
  _openid?: string
  isDeleted?: boolean
}

/**
 * 预防记录
 */
export interface PreventionRecord extends HealthRecord {
  type: 'prevention'
  preventionType: 'vaccine' | 'medication' | 'disinfection' | 'nutrition'
  taskName: string
  targetCount?: number
  actualCount?: number
  costInfo?: {
    totalCost: number
    unitCost?: number
  }
}

/**
 * 治疗记录
 */
export interface TreatmentRecord extends HealthRecord {
  type: 'treatment'
  treatmentType: 'medication' | 'isolation' | 'other'
  diagnosisId?: string
  symptoms?: string[]
  medication?: string[]
  affectedCount?: number
  curedCount?: number
  deathCount?: number
  costInfo?: {
    totalCost: number
    medicationCost?: number
    laborCost?: number
  }
}

/**
 * 诊断记录
 */
export interface DiagnosisRecord extends HealthRecord {
  type: 'diagnosis'
  diagnosisType: 'ai' | 'manual' | 'expert'
  symptoms: string[]
  diseases: string[]
  confidence?: number
  affectedCount: number
  severity: 'mild' | 'moderate' | 'severe'
  suggestions?: string[]
  images?: string[]
}

/**
 * 死亡记录
 */
export interface DeathRecord extends HealthRecord {
  type: 'death'
  deathCount: number
  deathDate: string | Date
  causeOfDeath?: string
  treatmentId?: string
  costBreakdown?: {
    seedlingCost: number
    breedingCost: number
    preventionCost: number
    treatmentCost: number
    totalLoss: number
  }
}

// ==================== 财务相关 ====================

/**
 * 财务记录
 */
export interface FinanceRecord {
  _id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  date: string | Date
  description?: string
  batchId?: string
  relatedId?: string
  createdBy?: string
  _openid?: string
  createTime: string | Date
  isDeleted?: boolean
}

/**
 * 成本分析
 */
export interface CostAnalysis {
  batchId: string
  seedlingCost: number
  feedCost: number
  medicationCost: number
  laborCost: number
  otherCost: number
  totalCost: number
  unitCost: number
  profitMargin?: number
}

// ==================== 用户相关 ====================

/**
 * 用户信息
 */
export interface UserInfo {
  _id?: string
  openid: string
  nickName?: string
  avatarUrl?: string
  phone?: string
  role?: 'admin' | 'user' | 'guest'
  createTime?: string | Date
  lastLoginTime?: string | Date
}

/**
 * 用户设置
 */
export interface UserSettings {
  userId: string
  notifications: {
    enabled: boolean
    types: string[]
  }
  language: 'zh-CN' | 'en-US'
  theme: 'light' | 'dark' | 'auto'
}

// ==================== 事件类型 ====================

/**
 * 微信小程序自定义事件类型别名
 * 全局可用，无需在每个文件中重复定义
 */
declare type CustomEvent<T = any> = WechatMiniprogram.CustomEvent<T>

/**
 * 小程序输入事件
 */
export interface InputEvent {
  type: string
  timeStamp: number
  target: {
    id: string
    dataset: Record<string, any>
  }
  currentTarget: {
    id: string
    dataset: Record<string, any>
  }
  detail: {
    value: string | number | boolean
    cursor?: number
    keyCode?: number
  }
}

/**
 * 小程序选择事件
 */
export interface PickerEvent {
  type: string
  detail: {
    value: string | number | string[] | number[]
    column?: number
    index?: number
  }
  currentTarget: {
    dataset: Record<string, any>
  }
}

/**
 * 小程序点击事件
 */
export interface TapEvent {
  type: string
  detail: {
    x: number
    y: number
  }
  currentTarget: {
    id: string
    dataset: Record<string, any>
  }
  target: {
    id: string
    dataset: Record<string, any>
  }
}

/**
 * 小程序滚动事件
 */
export interface ScrollEvent {
  type: string
  detail: {
    scrollLeft: number
    scrollTop: number
    scrollHeight: number
    scrollWidth: number
    deltaX?: number
    deltaY?: number
  }
}

// ==================== 组件Props ====================

/**
 * 弹窗组件属性
 */
export interface PopupProps {
  visible: boolean
  title?: string
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  onConfirm?: () => void
  onCancel?: () => void
}

/**
 * 列表组件属性
 */
export interface ListProps<T = unknown> {
  data: T[]
  loading?: boolean
  hasMore?: boolean
  emptyText?: string
  onLoadMore?: () => void
  onItemClick?: (item: T, index: number) => void
}

/**
 * 表单组件属性
 */
export interface FormProps<T = Record<string, any>> {
  initialValues?: T
  rules?: Record<string, any[]>
  onSubmit?: (values: T) => void | Promise<void>
  onCancel?: () => void
  loading?: boolean
}
