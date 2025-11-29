// treatment-record-form.ts - 治疗记录表单处理模块
import type { 
  TreatmentFormData, 
  TreatmentPlan, 
  Medication, 
  MaterialItem
} from './treatment-record-types'

/**
 * 验证单个表单字段
 */
export function validateField(
  field: string, 
  value: unknown, 
  currentErrors: Record<string, string>
): Record<string, string> {
  const errors = { ...currentErrors }
  
  switch (field) {
    case 'batchId':
      if (!value) {
        errors[field] = '请选择治疗批次'
      } else {
        delete errors[field]
      }
      break
    case 'diagnosis':
      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        errors[field] = '请输入诊断结果'
      } else {
        delete errors[field]
      }
      break
    case 'treatmentDate':
      if (!value) {
        errors[field] = '请选择治疗日期'
      } else {
        delete errors[field]
      }
      break
  }
  
  return errors
}

/**
 * 验证整个表单
 */
export function validateForm(formData: TreatmentFormData): {
  isValid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}
  
  // 必填字段验证
  if (!formData.batchId) errors.batchId = '请选择治疗批次'
  if (!formData.diagnosis) errors.diagnosis = '请输入诊断结果'
  if (!formData.treatmentDate) errors.treatmentDate = '请选择治疗日期'
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * 验证用药列表
 */
export function validateMedications(
  medications: Array<{
    materialId: string
    materialName: string
    quantity?: string | number
    currentStock: number
    unit: string
  }>
): {
  isValid: boolean
  errorMessage?: string
  validatedMedications: Medication[]
} {
  const validatedMedications: Medication[] = []
  
  for (const med of medications) {
    // 验证数量
    const quantity = parseFloat(String(med.quantity || 0))
    if (!med.quantity || quantity <= 0) {
      return {
        isValid: false,
        errorMessage: `请输入${med.materialName}的数量`,
        validatedMedications: []
      }
    }
    
    // 验证库存
    if (quantity > med.currentStock) {
      return {
        isValid: false,
        errorMessage: `${med.materialName}库存不足，当前库存：${med.currentStock}${med.unit}`,
        validatedMedications: []
      }
    }
    
    // 添加到验证后的列表
    validatedMedications.push({
      medicationId: med.materialId,
      materialId: med.materialId,
      name: med.materialName,
      dosage: '',
      route: '',
      frequency: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      status: 'ongoing',
      quantity: quantity,
      unit: med.unit || '件'
    })
  }
  
  return {
    isValid: true,
    validatedMedications
  }
}

/**
 * 创建初始表单数据
 */
export function createInitialFormData(): TreatmentFormData {
  const today = new Date().toISOString().split('T')[0]
  
  return {
    treatmentNumber: '',
    batchId: '',
    batchNumber: '',
    animalIds: [],
    treatmentDate: today,
    treatmentType: 'medication',
    diagnosis: '',
    diagnosisConfidence: 0,
    affectedCount: 0,
    notes: ''
  }
}

/**
 * 创建初始治疗方案
 */
export function createInitialTreatmentPlan(): TreatmentPlan {
  return {
    primary: '',
    followUpSchedule: []
  }
}

/**
 * 创建初始用药数据
 */
export function createInitialMedication(
  material: MaterialItem & { categoryLabel?: string },
  treatmentDate: string
): {
  materialId: string
  materialName: string
  category: string
  specification: string
  currentStock: number
  unit: string
  quantity: string
  dosage: string
  startDate: string
} {
  return {
    materialId: material._id,
    materialName: material.name,
    category: material.category || '',
    specification: material.specification || '',
    currentStock: material.currentStock || 0,
    unit: material.unit || '件',
    quantity: '',
    dosage: '',
    startDate: treatmentDate
  }
}

/**
 * 构建治疗记录提交数据
 */
export function buildTreatmentRecordData(
  formData: TreatmentFormData,
  treatmentPlan: TreatmentPlan,
  medications: Medication[],
  options: {
    sourceType?: string
    diagnosisId?: string
    abnormalRecordId?: string
    isDiagnosisCorrected?: boolean
    treatmentPlanSource?: string
  } = {}
): Record<string, unknown> {
  return {
    batchId: formData.batchId,
    batchNumber: formData.batchNumber,
    treatmentDate: formData.treatmentDate,
    treatmentType: formData.treatmentType,
    diagnosis: {
      preliminary: formData.diagnosis,
      confirmed: formData.diagnosis,
      confidence: formData.diagnosisConfidence,
      isCorrected: options.isDiagnosisCorrected || false
    },
    affectedCount: formData.affectedCount,
    treatmentPlan: {
      primary: treatmentPlan.primary,
      followUpSchedule: treatmentPlan.followUpSchedule,
      source: options.treatmentPlanSource || ''
    },
    medications: medications,
    notes: formData.notes,
    sourceType: options.sourceType || 'normal',
    diagnosisId: options.diagnosisId || '',
    abnormalRecordId: options.abnormalRecordId || '',
    status: 'ongoing',
    createdAt: new Date().toISOString()
  }
}

/**
 * 处理表单输入
 */
export function handleFormInput(
  field: string, 
  value: unknown
): { path: string; value: unknown } {
  return {
    path: `formData.${field}`,
    value: value
  }
}

/**
 * 处理数字输入
 */
export function handleNumberInput(value: string): number {
  return parseFloat(value) || 0
}

/**
 * 处理治疗方案输入
 */
export function handleTreatmentPlanInput(
  field: string, 
  value: unknown
): { path: string; value: unknown } {
  return {
    path: `treatmentPlan.${field}`,
    value: value
  }
}
