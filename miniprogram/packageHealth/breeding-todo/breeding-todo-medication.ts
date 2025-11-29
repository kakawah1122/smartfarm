// breeding-todo-medication.ts - 用药表单处理模块
import { logger } from '../../utils/logger'
import type { Task, MedicationFormData, MaterialItem, CloudResult } from './breeding-todo-types'

// 药品选项类型
export interface MedicineOption {
  id: string
  name: string
  unit: string
  stock: number
  category?: string
  description?: string
}

/**
 * 加载可用的药品库存
 */
export async function loadAvailableMedicines(): Promise<MedicineOption[]> {
  try {
    const result = await wx.cloud.callFunction({
      name: 'production-material',
      data: {
        action: 'list_materials',
        category: '药品'
      }
    }) as { result?: CloudResult<{ materials?: MaterialItem[] }> }
    
    if (result.result && result.result.success) {
      const materials = (result.result.data as { materials?: MaterialItem[] })?.materials || []
      
      // 只显示有库存的药品
      const availableMedicines = materials
        .filter((material: MaterialItem) => (material.currentStock || 0) > 0)
        .map((material: MaterialItem): MedicineOption => ({
          id: material._id,
          name: material.name,
          unit: material.unit || '件',
          stock: material.currentStock || 0,
          category: material.category,
          description: material.description || ''
        }))
      
      return Array.isArray(availableMedicines) ? availableMedicines : []
    }
    return []
  } catch (error) {
    logger.error('获取药品库存失败:', error)
    return []
  }
}

/**
 * 创建初始用药表单数据
 */
export function createInitialMedicationFormData(): MedicationFormData & { 
  operator: string
  purpose: string
} {
  const userInfo = wx.getStorageSync('userInfo') as { nickName?: string; name?: string } | null
  return {
    medicineName: '',
    medicineId: '',
    dosage: '',
    quantity: 0,
    unit: '',
    notes: '',
    operator: userInfo?.nickName || userInfo?.name || '用户',
    purpose: ''
  }
}

/**
 * 验证用药表单
 */
export function validateMedicationForm(
  formData: MedicationFormData & { operator?: string; purpose?: string },
  selectedMedicine: MedicineOption | null
): {
  isValid: boolean
  errors: Record<string, string>
  errorList: string[]
} {
  const errors: Record<string, string> = {}

  // 必填字段验证
  if (!formData.medicineId || !selectedMedicine) {
    errors.medicineId = '请选择药品'
  }

  if (!formData.quantity || formData.quantity <= 0) {
    errors.quantity = '请输入正确的用药数量'
  } else if (selectedMedicine && formData.quantity > selectedMedicine.stock) {
    errors.quantity = `库存不足，当前库存${selectedMedicine.stock}${selectedMedicine.unit}`
  }

  const errorList = Object.values(errors)
  
  return {
    isValid: errorList.length === 0,
    errors,
    errorList
  }
}

/**
 * 构建用药记录数据
 */
export function buildMedicationRecord(
  task: Task,
  formData: MedicationFormData & { operator?: string; purpose?: string },
  batchId: string
): {
  taskId: string
  batchId: string
  materialId: string
  materialName: string
  quantity: number
  unit: string
  purpose: string
  dosage: string
  notes: string
  operator: string
  useDate: string
  createTime: string
} {
  const purpose = task.title || '用药任务'
  
  return {
    taskId: task._id,
    batchId: batchId,
    materialId: formData.medicineId,
    materialName: formData.medicineName,
    quantity: formData.quantity,
    unit: formData.unit,
    purpose: purpose,
    dosage: formData.dosage,
    notes: formData.notes,
    operator: formData.operator || '用户',
    useDate: new Date().toISOString().split('T')[0],
    createTime: new Date().toISOString()
  }
}

/**
 * 提交用药表单
 */
export async function submitMedicationForm(
  task: Task,
  formData: MedicationFormData & { operator?: string; purpose?: string },
  batchId: string
): Promise<CloudResult> {
  const medicationRecord = buildMedicationRecord(task, formData, batchId)
  const purpose = task.title || '用药任务'
  
  // 构建云函数调用参数
  const cloudFunctionData = {
    action: 'create_record',
    recordData: {
      materialId: medicationRecord.materialId,
      materialName: formData.medicineName,
      type: 'use',
      quantity: Number(medicationRecord.quantity),
      unit: medicationRecord.unit,
      targetLocation: purpose,
      operator: medicationRecord.operator || '用户',
      status: '已完成',
      notes: `用途：${purpose}${medicationRecord.dosage ? '，剂量：' + medicationRecord.dosage : ''}${medicationRecord.notes ? '，备注：' + medicationRecord.notes : ''}，批次：${task.batchNumber || task.batchId || ''}`,
      recordDate: medicationRecord.useDate,
      batchId: batchId,
      batchNumber: task.batchNumber || ''
    }
  }
  
  try {
    const result = await wx.cloud.callFunction({
      name: 'production-material',
      data: cloudFunctionData
    }) as { result?: CloudResult }

    return result.result || { success: false, message: '提交失败' }
  } catch (error) {
    logger.error('提交用药表单失败:', error)
    return { success: false, message: '网络异常' }
  }
}

/**
 * 标记用药任务为完成
 */
export async function completeMedicationTask(taskId: string, batchId: string): Promise<boolean> {
  try {
    const result = await wx.cloud.callFunction({
      name: 'lifecycle-management',
      data: {
        action: 'completeTask',
        taskId,
        batchId,
        completedAt: new Date().toISOString()
      }
    }) as { result?: CloudResult }

    return result.result?.success === true
  } catch (error) {
    logger.error('标记任务完成失败:', error)
    return false
  }
}
