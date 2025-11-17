/**
 * 健康管理模块类型定义
 * @module types/health
 */

/**
 * 疫苗接种费用信息
 */
export interface VaccineCostInfo {
  /** 疫苗费用 */
  vaccineCost: number
  /** 兽医费用 */
  veterinaryCost: number
  /** 其他费用 */
  otherCost: number
  /** 总费用 */
  totalCost: number
  /** 
   * 是否同步到财务系统
   * @default true - 疫苗接种费用默认应同步到财务
   */
  shouldSyncToFinance?: boolean
  /** 
   * 费用来源
   * - 'purchase': 采购
   * - 'use': 使用库存
   * - 'manual': 手动录入
   */
  source?: 'purchase' | 'use' | 'manual'
}

/**
 * 预防任务数据
 */
export interface PreventionData {
  /** 预防类型 */
  preventionType: 'vaccine' | 'disinfection' | 'medicine'
  /** 预防日期 */
  preventionDate: string
  /** 疫苗信息 */
  vaccineInfo?: {
    name: string
    manufacturer?: string
    batchNumber?: string
    dosage?: string
    route?: any
    count: number
    location?: string
  }
  /** 兽医信息 */
  veterinarianInfo?: {
    name: string
    contact?: string
  }
  /** 费用信息 */
  costInfo: VaccineCostInfo
  /** 备注 */
  notes?: string
}

/**
 * 疫苗表单数据
 */
export interface VaccineFormData {
  veterinarianName: string
  veterinarianContact: string
  vaccineName: string
  manufacturer: string
  batchNumber: string
  dosage: string
  routeIndex: number
  vaccinationCount: number
  location?: string
  vaccineCost: string
  veterinaryCost: string
  otherCost: string
  totalCost: number
  totalCostFormatted: string
  notes: string
}
