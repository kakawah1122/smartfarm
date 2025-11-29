// treatment-record-data.ts - 治疗记录数据服务
import { logger } from '../../utils/logger'
import { safeCloudCall } from '../../utils/safe-cloud-call'
import { HealthCloud } from '../../utils/cloud-functions'
import type { 
  BatchInfo, 
  MaterialItem, 
  TreatmentRecordDetail,
  AIDiagnosisResult,
  CloudResult 
} from './treatment-record-types'

/**
 * 云函数调用封装 - 兼容 wx.cloud.callFunction 返回格式
 */
export async function callCloudFunction(config: { 
  name: string
  data: Record<string, unknown>
  timeout?: number 
}): Promise<{ result?: CloudResult }> {
  const result = await safeCloudCall(config) as CloudResult
  return { result }
}

/**
 * 加载活跃批次列表
 */
export async function loadActiveBatches(): Promise<BatchInfo[]> {
  try {
    const result = await wx.cloud.callFunction({ 
      name: 'production-entry', 
      data: { action: 'getActiveBatches' } 
    }) as { result?: CloudResult<{ batches?: BatchInfo[] }> }
    
    if (result.result && result.result.success) {
      const data = result.result.data as { batches?: BatchInfo[] }
      return data?.batches || []
    }
    return []
  } catch (error) {
    logger.error('加载活跃批次失败:', error)
    return []
  }
}

/**
 * 根据批次ID查找批次号
 */
export async function loadBatchNumberById(
  batchId: string, 
  activeBatches: BatchInfo[]
): Promise<string | null> {
  // 先从已加载的批次列表中查找
  const batch = activeBatches.find((b: BatchInfo) => b._id === batchId)
  if (batch && batch.batchNumber) {
    return batch.batchNumber
  }
  
  // 如果没找到，从数据库查询
  try {
    const db = wx.cloud.database()
    const batchResult = await db.collection('prod_batch_entries')
      .doc(batchId)
      .field({ batchNumber: true })
      .get() as { data?: { batchNumber?: string } }
    
    if (batchResult.data && batchResult.data.batchNumber) {
      return batchResult.data.batchNumber
    }
  } catch (error) {
    logger.error('加载批次号失败:', error)
  }
  
  return null
}

/**
 * 加载可用的药品和营养品
 */
export async function loadAvailableMaterials(): Promise<{
  materials: MaterialItem[]
  filteredMaterials: MaterialItem[]
}> {
  try {
    // 并行获取药品和营养品
    const [medicineResult, nutritionResult] = await Promise.all([
      callCloudFunction({
        name: 'production-material',
        data: { 
          action: 'list_materials',
          category: '药品',
          isActive: true,
          pageSize: 100
        }
      }),
      callCloudFunction({
        name: 'production-material',
        data: { 
          action: 'list_materials',
          category: '营养品',
          isActive: true,
          pageSize: 100
        }
      })
    ])
    
    const materials: (MaterialItem & { categoryLabel?: string })[] = []
    
    if (medicineResult.result && medicineResult.result.success) {
      const data = medicineResult.result.data as { materials?: MaterialItem[] }
      const medicines = data?.materials || []
      materials.push(...medicines.map((m: MaterialItem) => ({
        ...m,
        categoryLabel: '药品'
      })))
    }
    
    if (nutritionResult.result && nutritionResult.result.success) {
      const data = nutritionResult.result.data as { materials?: MaterialItem[] }
      const nutrition = data?.materials || []
      materials.push(...nutrition.map((m: MaterialItem) => ({
        ...m,
        categoryLabel: '营养品'
      })))
    }
    
    // 药物治疗：显示药品 + 营养品
    const filteredMaterials = materials.filter((m) => 
      m.category === '药品' || m.category === '营养品'
    )
    
    return { materials, filteredMaterials }
  } catch (error) {
    logger.error('加载可用物料失败:', error)
    return { materials: [], filteredMaterials: [] }
  }
}

/**
 * 加载治疗记录详情
 */
export async function loadTreatmentRecord(
  treatmentId: string
): Promise<TreatmentRecordDetail | null> {
  try {
    const result = await HealthCloud.treatment.getDetail({ 
      treatmentId: treatmentId 
    }) as CloudResult<TreatmentRecordDetail>
    
    if (result && result.success && result.data) {
      return result.data
    }
    return null
  } catch (error) {
    logger.error('加载治疗记录失败:', error)
    return null
  }
}

/**
 * 加载AI诊断结果
 */
export async function loadAIDiagnosisResult(
  diagnosisId: string
): Promise<AIDiagnosisResult | null> {
  try {
    const result = await callCloudFunction({
      name: 'ai-diagnosis',
      data: {
        action: 'get_diagnosis_result',
        diagnosisId: diagnosisId
      }
    })
    
    if (result.result && result.result.success) {
      return result.result.data as AIDiagnosisResult
    }
    return null
  } catch (error) {
    logger.error('加载AI诊断结果失败:', error)
    return null
  }
}

/**
 * 加载异常记录详情
 */
export async function loadAbnormalRecordDetail(
  abnormalRecordId: string
): Promise<{
  diagnosis: string
  affectedCount: number
  isCorrected: boolean
  treatmentRecommendation?: unknown
} | null> {
  try {
    const result = await HealthCloud.abnormal.getDetail({ 
      recordId: abnormalRecordId 
    }) as CloudResult<{
      diagnosis?: string
      correctedDiagnosis?: string
      isCorrected?: boolean
      affectedCount?: number
      treatmentRecommendation?: unknown
    }>
    
    if (result && result.success && result.data) {
      const record = result.data
      
      // 优先使用修正后的诊断
      const finalDiagnosis = record.isCorrected && record.correctedDiagnosis 
        ? record.correctedDiagnosis 
        : record.diagnosis || ''
      
      return {
        diagnosis: finalDiagnosis,
        affectedCount: record.affectedCount || 1,
        isCorrected: record.isCorrected || false,
        treatmentRecommendation: record.treatmentRecommendation
      }
    }
    return null
  } catch (error) {
    logger.error('加载异常记录详情失败:', error)
    return null
  }
}

/**
 * 计算用药结束日期
 */
export function calculateEndDate(startDate: string, duration: number): string {
  const start = new Date(startDate)
  const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000)
  return end.toISOString().split('T')[0]
}

/**
 * 获取今天的日期字符串
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * 设置健康页面刷新标记
 */
export function setHealthPageRefreshFlag(): void {
  wx.setStorageSync('health_page_need_refresh', true)
}
