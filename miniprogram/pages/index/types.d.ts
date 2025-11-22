/**
 * Index页面专用类型定义
 */

/**
 * 天气数据类型
 */
export interface WeatherData {
  location?: string | {
    province?: string
    city?: string
    district?: string
  }
  locationInfo?: string | {
    province?: string
    city?: string
    district?: string
  }
  temp?: number | string
  temperature?: number | string
  description?: string
  icon?: string
  humidity?: number
  windSpeed?: number
  updateTime?: string
  weather?: {
    temperature?: number
    humidity?: number
    description?: string
    icon?: string
  }
  current?: {
    temperature?: number
    humidity?: number
    description?: string
    icon?: string
  }
  condition?: {
    text?: string
    icon?: string
  }
  [key: string]: any
}

/**
 * 任务类型
 */
export interface TaskData {
  _id: string
  taskId?: string
  type: 'vaccine' | 'medication' | 'medicine' | 'nutrition' | 'disinfection' | 'health_check'
  taskName: string
  batchId?: string
  batchNumber?: string
  completed?: boolean
  status?: string
  dueDate?: string
  description?: string
  [key: string]: any
}

/**
 * 价格品种数据
 */
export interface PriceBreed {
  breed?: string
  key?: string
  label?: string
  min?: number | null
  max?: number | null
  range?: string
  priceRange?: string
}

/**
 * 鹅价数据
 */
export interface GoosePriceData {
  gosling?: PriceBreed[]
  adult?: PriceBreed[]
  goslingBreeds?: PriceBreed[]
  meatBreeds?: Array<{
    key: string
    min: number | null
    max: number | null
    range?: string
  }>
  [key: string]: any
}

/**
 * 疫苗表单数据
 */
export interface VaccineFormData {
  veterinarianName: string
  veterinarianContact: string
  vaccineName: string
  vaccineSupplier?: string
  manufacturer?: string
  batchNumber?: string
  dosage?: string
  administrationMethod?: string
  actualQuantity?: number
  nextVaccinationDate?: string
  precautions?: string
  adverseReactions?: string
  routeIndex?: number
  vaccinationCount?: number
  location?: string
  vaccineCost?: string
  veterinaryCost?: string
  otherCost?: string
  totalCost?: number
  totalCostFormatted?: string
  notes?: string
}

/**
 * 药品材料数据
 */
export interface MaterialData {
  _id: string
  name: string
  unit: string
  currentStock: number
  description?: string
}

/**
 * 位置错误类型
 */
export interface LocationError {
  errMsg?: string
  errno?: number
  code?: string
}

/**
 * 云函数响应类型
 */
export interface CloudResponse<T = any> {
  success?: boolean
  data?: T
  result?: T
  message?: string
  error?: string
  errMsg?: string
}

/**
 * 批次缓存数据
 */
export interface BatchCache {
  _id?: string
  id?: string
  batchNumber?: string
  batchId?: string
  [key: string]: any
}

/**
 * 天气缓存数据
 */
export interface WeatherCache {
  data: WeatherData
  timestamp: number
  location?: string
}

/**
 * 文章数据
 */
export interface ArticleData {
  _id: string
  title: string
  summary?: string
  coverImage?: string
  category?: string
  tags?: string[]
  viewCount?: number
  publishTime?: string
}

/**
 * 自定义事件类型
 */
export type CustomEvent<T = any> = WechatMiniprogram.CustomEvent<{
  value?: T
  visible?: boolean
  [key: string]: any
}>

/**
 * 云函数响应类型别名
 */
export type CloudFunctionResponse<T = any> = CloudResponse<T>

/**
 * 天气API响应类型
 */
export interface WeatherApiResponse extends WeatherData {}

/**
 * 天气当前信息
 */
export type WeatherCurrentInfo = {
  temperature?: number
  humidity?: number
  description?: string
  icon?: string
  feelsLike?: number
  windDirection?: string
  windScale?: string
  updateTime?: string | Date
}

/**
 * 天气状况信息
 */
export type WeatherConditionInfo = {
  text?: string
  emoji?: string
  icon?: string
}
