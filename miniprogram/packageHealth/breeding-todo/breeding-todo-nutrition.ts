// breeding-todo-nutrition.ts - 营养表单处理模块
import { logger } from '../../utils/logger'
import type { Task, NutritionFormData, MaterialItem, CloudResult } from './breeding-todo-types'

// 营养品选项类型
export interface NutritionOption {
  id: string
  name: string
  unit: string
  stock: number
  category?: string
  description?: string
}

/**
 * 加载可用的营养品库存
 */
export async function loadAvailableNutrition(): Promise<NutritionOption[]> {
  try {
    const result = await wx.cloud.callFunction({
      name: 'production-material',
      data: {
        action: 'list_materials',
        category: '营养品'
      }
    }) as { result?: CloudResult<{ materials?: MaterialItem[] }> }
    
    if (result.result && result.result.success) {
      const materials = (result.result.data as { materials?: MaterialItem[] })?.materials || []
      
      // 只显示有库存的营养品
      const availableNutrition = materials
        .filter((material: MaterialItem) => (material.currentStock || 0) > 0)
        .map((material: MaterialItem): NutritionOption => ({
          id: material._id,
          name: material.name,
          unit: material.unit || '件',
          stock: material.currentStock || 0,
          category: material.category,
          description: material.description || ''
        }))
      
      return Array.isArray(availableNutrition) ? availableNutrition : []
    }
    return []
  } catch (error) {
    logger.error('获取营养品库存失败:', error)
    return []
  }
}

/**
 * 创建初始营养表单数据
 */
export function createInitialNutritionFormData(): NutritionFormData & { 
  operator: string
} {
  const userInfo = wx.getStorageSync('userInfo') as { nickName?: string; name?: string } | null
  return {
    nutritionName: '',
    nutritionId: '',
    dosage: '',
    quantity: 0,
    unit: '',
    notes: '',
    operator: userInfo?.nickName || userInfo?.name || '用户'
  }
}

/**
 * 验证营养表单
 */
export function validateNutritionForm(
  formData: NutritionFormData & { operator?: string },
  selectedNutrition: NutritionOption | null
): {
  isValid: boolean
  errors: Record<string, string>
  errorList: string[]
} {
  const errors: Record<string, string> = {}

  // 必填字段验证
  if (!formData.nutritionId || !selectedNutrition) {
    errors.nutritionId = '请选择营养品'
  }

  if (!formData.quantity || formData.quantity <= 0) {
    errors.quantity = '请输入正确的使用数量'
  } else if (selectedNutrition && formData.quantity > selectedNutrition.stock) {
    errors.quantity = `库存不足，当前库存${selectedNutrition.stock}${selectedNutrition.unit}`
  }

  const errorList = Object.values(errors)
  
  return {
    isValid: errorList.length === 0,
    errors,
    errorList
  }
}

/**
 * 构建营养记录数据
 */
export function buildNutritionRecord(
  task: Task,
  formData: NutritionFormData & { operator?: string },
  batchId: string
): {
  materialId: string
  type: string
  quantity: number
  targetLocation: string
  operator: string
  status: string
  notes: string
  recordDate: string
} {
  return {
    materialId: formData.nutritionId,
    type: 'use',
    quantity: Number(formData.quantity),
    targetLocation: task.title || '营养任务',
    operator: formData.operator || '用户',
    status: '已完成',
    notes: `任务：${task.title}，批次：${batchId}${formData.dosage ? '，剂量：' + formData.dosage : ''}${formData.notes ? '，备注：' + formData.notes : ''}`,
    recordDate: new Date().toISOString().split('T')[0]
  }
}

/**
 * 提交营养表单
 */
export async function submitNutritionForm(
  task: Task,
  formData: NutritionFormData & { operator?: string },
  batchId: string
): Promise<CloudResult> {
  const recordData = buildNutritionRecord(task, formData, batchId)
  
  try {
    const result = await wx.cloud.callFunction({
      name: 'production-material',
      data: {
        action: 'create_record',
        recordData: recordData
      }
    }) as { result?: CloudResult }

    return result.result || { success: false, message: '提交失败' }
  } catch (error) {
    logger.error('提交营养表单失败:', error)
    return { success: false, message: '网络异常' }
  }
}

/**
 * 标记营养任务为完成
 */
export async function completeNutritionTask(taskId: string, batchId: string): Promise<boolean> {
  try {
    const userInfo = wx.getStorageSync('userInfo') as { nickName?: string } | null
    
    const result = await wx.cloud.callFunction({
      name: 'breeding-todo',
      data: {
        action: 'complete_task',
        taskId: taskId,
        batchId: batchId,
        completedAt: new Date().toISOString(),
        completedBy: userInfo?.nickName || '用户'
      }
    }) as { result?: CloudResult }

    return result.result?.success === true
  } catch (error) {
    logger.error('标记营养任务完成失败:', error)
    return false
  }
}
