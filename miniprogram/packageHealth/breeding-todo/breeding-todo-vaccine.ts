// breeding-todo-vaccine.ts - 疫苗表单处理模块
import CloudApi from '../../utils/cloud-api'
import { logger } from '../../utils/logger'
import type { Task, VaccineFormData, BatchInfo, CloudResult } from './breeding-todo-types'

// 疫苗接种方式选项
export const vaccineRouteOptions = ['皮下注射', '肌肉注射', '滴鼻', '点眼', '饮水', '喷雾']

/**
 * 获取批次存栏数量
 */
export async function getBatchStockQuantity(batchId: string): Promise<number> {
  if (!batchId) return 0
  
  try {
    const batchResult = await wx.cloud.callFunction({
      name: 'production-entry',
      data: { action: 'getActiveBatches' }
    }) as { result?: CloudResult<BatchInfo[]> }
    
    if (batchResult.result?.success) {
      const activeBatches = (batchResult.result.data as BatchInfo[]) || []
      const currentBatch = activeBatches.find((b: BatchInfo) => b._id === batchId) as BatchInfo & {
        currentStock?: number
        currentQuantity?: number
        currentCount?: number
      } | undefined
      
      if (currentBatch) {
        return currentBatch.currentStock || 
               currentBatch.currentQuantity || 
               currentBatch.currentCount || 
               0
      }
    }
  } catch (error) {
    logger.error('获取批次存栏数失败:', error)
  }
  
  return 0
}

/**
 * 创建初始疫苗表单数据
 */
export function createInitialVaccineFormData(
  task: Task, 
  stockQuantity: number = 0
): VaccineFormData {
  return {
    veterinarianName: '',
    veterinarianContact: '',
    vaccineName: task.title || '',
    manufacturer: '',
    batchNumber: '',
    dosage: '0.5ml/只',
    routeIndex: 0,
    vaccinationCount: stockQuantity,
    location: '',
    vaccineCost: '',
    veterinaryCost: '',
    otherCost: '',
    totalCost: 0,
    totalCostFormatted: '¥0.00',
    notes: task.description || ''
  }
}

/**
 * 计算总费用
 */
export function calculateTotalCost(formData: VaccineFormData): {
  totalCost: number
  totalCostFormatted: string
} {
  const vaccineCost = parseFloat(formData.vaccineCost?.toString() || '0') || 0
  const veterinaryCost = parseFloat(formData.veterinaryCost?.toString() || '0') || 0
  const otherCost = parseFloat(formData.otherCost?.toString() || '0') || 0
  const totalCost = vaccineCost + veterinaryCost + otherCost
  
  return {
    totalCost,
    totalCostFormatted: `¥${totalCost.toFixed(2)}`
  }
}

/**
 * 验证疫苗表单
 */
export function validateVaccineForm(formData: VaccineFormData): {
  isValid: boolean
  errors: Record<string, string>
  errorList: string[]
} {
  const errors: Record<string, string> = {}

  // 必填字段验证
  const requiredFields = [
    { field: 'veterinarianName', message: '请填写兽医姓名' },
    { field: 'vaccineName', message: '请填写疫苗名称' },
    { field: 'vaccinationCount', message: '请填写接种数量' }
  ]

  requiredFields.forEach(({ field, message }) => {
    const value = formData[field as keyof VaccineFormData]
    if (!value || value === '' || value === 0) {
      errors[field] = message
    }
  })

  // 数值验证
  if (formData.vaccinationCount <= 0) {
    errors.vaccinationCount = '接种数量必须大于0'
  }

  // 联系方式验证（如果填写了）
  if (formData.veterinarianContact && 
      !/^1[3-9]\d{9}$/.test(formData.veterinarianContact)) {
    errors.veterinarianContact = '请填写正确的手机号码'
  }

  const errorList = Object.values(errors)
  
  return {
    isValid: errorList.length === 0,
    errors,
    errorList
  }
}

/**
 * 构建疫苗记录数据
 */
export function buildVaccineRecord(
  formData: VaccineFormData,
  routeOptions: string[] = vaccineRouteOptions
): {
  vaccine: { name: string; manufacturer: string; batchNumber: string; dosage: string }
  veterinarian: { name: string; contact: string }
  vaccination: { route: string; count: number; location: string }
  cost: { vaccine: number; veterinary: number; other: number; total: number }
  notes: string
} {
  return {
    vaccine: {
      name: formData.vaccineName,
      manufacturer: formData.manufacturer,
      batchNumber: formData.batchNumber,
      dosage: formData.dosage
    },
    veterinarian: {
      name: formData.veterinarianName,
      contact: formData.veterinarianContact
    },
    vaccination: {
      route: routeOptions[formData.routeIndex] || routeOptions[0],
      count: formData.vaccinationCount,
      location: formData.location
    },
    cost: {
      vaccine: parseFloat(formData.vaccineCost || '0'),
      veterinary: parseFloat(formData.veterinaryCost || '0'),
      other: parseFloat(formData.otherCost || '0'),
      total: formData.totalCost
    },
    notes: formData.notes
  }
}

/**
 * 提交疫苗表单
 */
export async function submitVaccineForm(
  taskId: string,
  batchId: string,
  formData: VaccineFormData,
  routeOptions: string[] = vaccineRouteOptions
): Promise<CloudResult & { data?: { hasAdverseReactions?: boolean; preventionRecordId?: string } }> {
  const vaccineRecord = buildVaccineRecord(formData, routeOptions)
  
  const result = await CloudApi.completeVaccineTask({
    taskId,
    batchId,
    vaccineRecord
  }) as CloudResult & { data?: { hasAdverseReactions?: boolean; preventionRecordId?: string } }

  return result
}
