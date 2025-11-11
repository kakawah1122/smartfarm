/**
 * 预防管理模块类型定义
 */

// 批次信息
export interface BatchInfo {
  batchNumber: string
  location?: string
  displayName: string
  _id?: string
}

// 页面选项接口
export interface PageOptions {
  sourceType?: string
  sourceId?: string
  batchId?: string
  locationId?: string
  careType?: string
}

// 保健管理表单数据
export interface HealthCareFormData {
  batchId: string
  locationId: string
  careType: 'nutrition' | 'environment' | 'immunity' | 'growth'
  supplement: string
  dosage: string
  method: 'feed' | 'water' | 'spray' | 'environment'
  duration: number
  purpose: string
  targetCount: number
  actualCount: number
  executionDate: string
  executionTime: string
  operator: string
  cost: number
  effectiveness: 'excellent' | 'good' | 'fair' | 'poor'
  notes: string
  nextSchedule: string
}

// 消毒记录表单数据
export interface DisinfectionFormData {
  batchId: string
  locationId: string
  disinfectant: string
  concentration: string
  area: number
  method: 'spray' | 'fumigation' | 'washing' | 'wiping'
  weather: 'sunny' | 'cloudy' | 'rainy' | 'windy'
  temperature: number
  humidity: number
  executionDate: string
  executionTime: string
  operator: string
  cost: number
  effectiveness: 'excellent' | 'good' | 'fair' | 'poor'
  notes: string
  nextSchedule: string
}

// 疫苗记录表单数据
export interface VaccineFormData {
  batchId: string
  locationId: string
  vaccineName: string
  manufacturer: string
  batchNumber: string
  expiryDate: string
  dosage: string
  route: 'muscle' | 'subcutaneous' | 'oral' | 'nasal'
  targetCount: number
  actualCount: number
  operator: string
  executionDate: string
  executionTime: string
  cost: number
  notes: string
  adverseReactions: number
  nextSchedule: string
}

// 选项项接口
export interface OptionItem {
  label: string
  value: string
  icon?: string
  desc?: string
}

// 常用保健品项
export interface SupplementItem {
  name: string
  dosage: string
  purpose: string
}

// 常用保健品库
export interface CommonSupplements {
  nutrition: SupplementItem[]
  environment: SupplementItem[]
  immunity: SupplementItem[]
  growth: SupplementItem[]
}

