/**
 * 健康巡检页面 - 默认数据与工厂方法
 */

import type {
  AbnormalFormData,
  HealthInspectionFormData,
  InspectionCategory,
  InspectionItem,
  InspectionStats
} from '../types/inspection'

const BASE_FORM_DATA: HealthInspectionFormData = {
  batchId: '',
  locationId: '',
  inspector: '',
  inspectionDate: '',
  inspectionTime: '',
  totalInspected: 0,
  abnormalCount: 0,
  notes: ''
}

const BASE_STATS: InspectionStats = {
  abnormalDiscoveryRate: '0.0',
  normalCount: 0,
  completionRate: '0.0'
}

const BASE_ABNORMAL_FORM: AbnormalFormData = {
  description: '',
  affectedCount: 1,
  severity: 'mild'
}

const BASE_INSPECTION_CATEGORIES: ReadonlyArray<InspectionCategory> = [
  { id: 'spirit', name: '精神状态', icon: 'mood', color: '#0052d9' },
  { id: 'appetite', name: '食欲状况', icon: 'food', color: '#00a870' },
  { id: 'respiratory', name: '呼吸状态', icon: 'gesture-breath', color: '#ed7b2f' },
  { id: 'excretion', name: '排泄状况', icon: 'undertake-delivery', color: '#7356f1' },
  { id: 'appearance', name: '外观体态', icon: 'user-visible', color: '#f59a23' },
  { id: 'behavior', name: '行为表现', icon: 'gesture-wipe', color: '#e34d59' }
]

const BASE_INSPECTION_ITEMS: ReadonlyArray<InspectionItem> = [
  { id: 'spirit_active', name: '精神活跃', category: 'spirit', checked: true, result: 'not_checked' },
  { id: 'spirit_alert', name: '反应敏捷', category: 'spirit', checked: true, result: 'not_checked' },
  { id: 'spirit_group', name: '群体活动', category: 'spirit', checked: true, result: 'not_checked' },
  { id: 'appetite_eating', name: '正常采食', category: 'appetite', checked: true, result: 'not_checked' },
  { id: 'appetite_drinking', name: '正常饮水', category: 'appetite', checked: true, result: 'not_checked' },
  { id: 'appetite_compete', name: '争食表现', category: 'appetite', checked: true, result: 'not_checked' },
  { id: 'respiratory_normal', name: '呼吸平稳', category: 'respiratory', checked: true, result: 'not_checked' },
  { id: 'respiratory_no_cough', name: '无咳嗽', category: 'respiratory', checked: true, result: 'not_checked' },
  { id: 'respiratory_no_discharge', name: '无鼻涕', category: 'respiratory', checked: true, result: 'not_checked' },
  { id: 'excretion_normal', name: '粪便正常', category: 'excretion', checked: true, result: 'not_checked' },
  { id: 'excretion_color', name: '颜色正常', category: 'excretion', checked: true, result: 'not_checked' },
  { id: 'excretion_frequency', name: '频次正常', category: 'excretion', checked: true, result: 'not_checked' },
  { id: 'appearance_posture', name: '体态正常', category: 'appearance', checked: true, result: 'not_checked' },
  { id: 'appearance_feather', name: '羽毛整洁', category: 'appearance', checked: true, result: 'not_checked' },
  { id: 'appearance_eyes', name: '眼部清亮', category: 'appearance', checked: true, result: 'not_checked' },
  { id: 'behavior_walking', name: '行走正常', category: 'behavior', checked: true, result: 'not_checked' },
  { id: 'behavior_social', name: '群体互动', category: 'behavior', checked: true, result: 'not_checked' },
  { id: 'behavior_rest', name: '休息状态', category: 'behavior', checked: true, result: 'not_checked' }
]

const cloneCategory = (category: InspectionCategory): InspectionCategory => ({ ...category })
const cloneItem = (item: InspectionItem): InspectionItem => ({ ...item })

export const createDefaultFormData = (): HealthInspectionFormData => ({ ...BASE_FORM_DATA })

export const createDefaultStats = (): InspectionStats => ({ ...BASE_STATS })

export const createDefaultAbnormalForm = (): AbnormalFormData => ({ ...BASE_ABNORMAL_FORM })

export const createDefaultCategories = (): InspectionCategory[] => BASE_INSPECTION_CATEGORIES.map(cloneCategory)

export const createDefaultInspectionItems = (): InspectionItem[] => BASE_INSPECTION_ITEMS.map(cloneItem)

export const INSPECTION_CATEGORY_ORDER = BASE_INSPECTION_CATEGORIES.map(category => category.id)

export const INSPECTION_BATCHES_CACHE_DURATION = 5 * 60 * 1000
