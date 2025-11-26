// miniprogram/packageHealth/medication-records-list/medication-records-list.ts
import { createPageWithNavbar } from '../../utils/navigation'
import { logger } from '../../utils/logger'
import { HealthCloud } from '../../utils/cloud-functions'

interface MedicationRecord {
  _id: string
  batchId: string
  batchNumber?: string
  preventionType: string
  preventionDate: string
  medicationInfo?: {
    name?: string
    dosage?: string
    method?: string
    duration?: number
  }
  costInfo?: {
    totalCost?: number
  }
  effectiveness?: string
  notes?: string
  operator?: string
  operatorName?: string
  createdAt?: unknown
  // 格式化字段
  formattedTotalCost?: string
  preventionTypeName?: string
}

// 预防类型映射
const PREVENTION_TYPE_MAP: { [key: string]: string } = {
  'medication': '防疫用药'
}

type MedicationListRecord = MedicationRecord & {
  batchNumber: string
  formattedTotalCost: string
  preventionTypeName: string
  effectiveness: string
}

interface StatsSummary {
  totalCount: number
  totalCost: number
}

interface BatchGroup {
  batchNumber: string
  batchId: string
  records: MedicationListRecord[]
}

interface EffectivenessOption {
  value: string
  label: string
}

interface EvaluationFormData {
  effectivenessIndex: number
  note: string
}

interface RecordTapDataset {
  id?: string
}

type MedicationPageData = {
  loading: boolean
  records: MedicationListRecord[]
  recordsByBatch: BatchGroup[]
  stats: StatsSummary
  showDetailDialog: boolean
  selectedRecord: MedicationListRecord | null
  showEvaluationDialog: boolean
  effectivenessOptions: EffectivenessOption[]
  evaluationFormData: EvaluationFormData
}

type MedicationPageCustom = {
  loadMedicationRecords: () => Promise<void>
  onRecordTap: (event: WechatMiniprogram.TouchEvent<RecordTapDataset>) => void
  closeDetailDialog: () => void
  preventTouchMove: () => boolean
  goBack: () => void
  showEvaluationForm: () => void
  closeEvaluationForm: () => void
  onEffectivenessChange: (event: WechatMiniprogram.PickerChange) => void
  onEvaluationNoteInput: (event: WechatMiniprogram.Input) => void
  submitEvaluation: () => Promise<void>
}

type MedicationPageInstance = WechatMiniprogram.Page.Instance<MedicationPageData, MedicationPageCustom>

const initialStats: StatsSummary = {
  totalCount: 0,
  totalCost: 0
}

const initialEffectivenessOptions: EffectivenessOption[] = [
  { value: 'excellent', label: '优秀' },
  { value: 'good', label: '良好' },
  { value: 'fair', label: '一般' },
  { value: 'poor', label: '较差' }
]

const initialFormData: EvaluationFormData = {
  effectivenessIndex: 1,
  note: ''
}

const initialMedicationPageData: MedicationPageData = {
  loading: true,
  records: [],
  recordsByBatch: [],
  stats: initialStats,
  showDetailDialog: false,
  selectedRecord: null,
  showEvaluationDialog: false,
  effectivenessOptions: initialEffectivenessOptions,
  evaluationFormData: initialFormData
}

const formatCost = (value: number | string | undefined): string => {
  if (value === undefined || value === null || value === '') {
    return '0.00'
  }

  const numeric = typeof value === 'number' ? value : parseFloat(value)
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
    return '0.00'
  }

  return numeric.toFixed(2)
}

const medicationPageConfig: WechatMiniprogram.Page.Options<MedicationPageData, MedicationPageCustom> = {
  data: initialMedicationPageData,

  onLoad() {
    void this.loadMedicationRecords()
  },

  onShow() {
    void this.loadMedicationRecords()
  },

  onPullDownRefresh() {
    void this.loadMedicationRecords().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadMedicationRecords() {
    const page = this as MedicationPageInstance
    page.setData({ loading: true })

    try {
      wx.showLoading({
        title: '加载用药记录...',
        mask: true
      })
      
      // ✅ 同时从两个数据源获取用药记录
      const [preventionResponse, materialResponse] = await Promise.all([
        // 1. 预防记录中的用药
        HealthCloud.prevention.list({
          page: 1,
          pageSize: 100
        }),
        // 2. 物料领用中的药品（待办任务完成的用药）
        wx.cloud.callFunction({
          name: 'production-material',
          data: {
            action: 'list_records',
            type: 'use',
            category: '药品',
            pageSize: 100
          }
        })
      ]) as [any, any]
      
      wx.hideLoading()

      // 处理预防记录中的用药
      let medicationRecords: any[] = []
      if (preventionResponse?.success) {
        const preventionRecords = preventionResponse?.data?.list || preventionResponse?.data?.records || []
        medicationRecords = preventionRecords.filter((record: any) => record.preventionType === 'medication')
      }
      
      // 处理物料领用中的药品记录
      let materialMedicationRecords: any[] = []
      if (materialResponse?.result?.success) {
        const resultData = materialResponse?.result?.data
        // 兼容多种返回格式
        const materialRecords = Array.isArray(resultData) 
          ? resultData 
          : (resultData?.list || resultData?.records || [])
        
        // 确保是数组后再过滤
        if (Array.isArray(materialRecords)) {
          // 转换物料记录格式为用药记录格式
          materialMedicationRecords = materialRecords
            .filter((record: any) => record.type === 'use')
            .map((record: any) => {
              // 计算成本：单价 × 数量
              const unitPrice = record.unitPrice || record.price || 0
              const quantity = record.quantity || 0
              const totalCost = record.totalCost || (unitPrice * quantity)
              
              return {
                _id: record._id,
                batchId: record.batchId || '',
                batchNumber: record.notes?.match(/批次：([^，]+)/)?.[1] || '',
                preventionType: 'medication',
                preventionDate: record.recordDate || record.createdAt?.split('T')[0] || '',
                medicationInfo: {
                  name: record.materialName || record.name || '药品',
                  dosage: record.notes?.match(/剂量：([^，]+)/)?.[1] || '',
                  method: record.targetLocation || '',
                  quantity: quantity
                },
                costInfo: {
                  totalCost: totalCost,
                  unitPrice: unitPrice,
                  quantity: quantity
                },
                effectiveness: '',
                notes: record.notes || '',
                operator: record.operator || '',
                operatorName: record.operator || '',
                createdAt: record.createdAt,
                source: 'material'  // 标记来源
              }
            })
        }
      }
      
      // 合并两个数据源的记录
      const allMedicationRecords = [...medicationRecords, ...materialMedicationRecords]
      
      // ✅ 按日期倒序排序（最新的在前）
      allMedicationRecords.sort((a, b) => {
        const dateA = new Date(a.preventionDate || a.createdAt || 0).getTime()
        const dateB = new Date(b.preventionDate || b.createdAt || 0).getTime()
        return dateB - dateA
      })
      
      const enrichedRecords = await enrichRecordsWithBatchNumbers(allMedicationRecords)
      const { formattedRecords, totalCost } = await buildMedicationRecords(enrichedRecords)

      page.setData({
        records: formattedRecords,
        recordsByBatch: groupMedicationRecordsByBatch(formattedRecords),
        stats: {
          totalCount: formattedRecords.length,
          totalCost: parseFloat(totalCost.toFixed(2))
        },
        loading: false
      })
    } catch (error) {
      wx.hideLoading()
      logger.error('加载用药记录失败:', error)
      wx.showToast({
        title: (error as Error).message || '加载失败',
        icon: 'none'
      })
      page.setData({ loading: false })
    }
  },

  onRecordTap(event) {
    const page = this as MedicationPageInstance
    const { id } = event.currentTarget.dataset as RecordTapDataset

    if (!id) {
      return
    }

    const record = page.data.records.find(item => item._id === id)

    if (record) {
      page.setData({
        selectedRecord: record,
        showDetailDialog: true
      })
    }
  },

  closeDetailDialog() {
    const page = this as MedicationPageInstance
    page.setData({ showDetailDialog: false })
  },

  preventTouchMove() {
    return false
  },

  goBack() {
    wx.navigateBack({
      delta: 1
    })
  },

  showEvaluationForm() {
    const page = this as MedicationPageInstance
    page.setData({
      showEvaluationDialog: true,
      evaluationFormData: {
        effectivenessIndex: 1,
        note: ''
      }
    })
  },

  closeEvaluationForm() {
    const page = this as MedicationPageInstance
    page.setData({ showEvaluationDialog: false })
  },

  onEffectivenessChange(event) {
    const page = this as MedicationPageInstance
    const value = Number(event.detail.value)
    page.setData({
      'evaluationFormData.effectivenessIndex': Number.isNaN(value) ? 0 : value
    })
  },

  onEvaluationNoteInput(event) {
    const page = this as MedicationPageInstance
    page.setData({
      'evaluationFormData.note': event.detail.value
    })
  },

  async submitEvaluation() {
    const page = this as MedicationPageInstance
    const { selectedRecord, evaluationFormData, effectivenessOptions } = page.data

    if (!selectedRecord) {
      wx.showToast({
        title: '记录信息丢失',
        icon: 'none'
      })
      return
    }

    const option = effectivenessOptions[evaluationFormData.effectivenessIndex]

    if (!option) {
      wx.showToast({
        title: '请选择评估结果',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '提交中...',
      mask: true
    })
    
    try {
      const response = await HealthCloud.prevention.updateEffectiveness({
        recordId: selectedRecord._id,
        effectiveness: option.value,
        effectivenessNote: evaluationFormData.note,
        evaluationDate: new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      }) as any
      
      wx.hideLoading()
      
      if (!response?.success) {
        throw new Error(response?.error || '提交失败')
      }
      
      wx.showToast({
        title: '评估提交成功',
        icon: 'success'
      })
      
      page.closeEvaluationForm()
      page.closeDetailDialog()
      await page.loadMedicationRecords()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: (error as Error).message || '提交失败',
        icon: 'none'
      })
    }
  }
}

async function resolveBatchNumber(record: MedicationRecord): Promise<string> {
  if (!record.batchId) {
    return record.batchNumber || '未知批次'
  }

  if (record.batchNumber) {
    return record.batchNumber
  }

  try {
    const db = wx.cloud.database()
    const batchResult = await db
      .collection('prod_batch_entries')
      .doc(record.batchId)
      .field({ batchNumber: true })
      .get()

    if (batchResult.data?.batchNumber) {
      return batchResult.data.batchNumber
    }
  } catch (error) {
    logger.warn('获取批次号失败, 使用批次ID:', error)
  }

  return record.batchId
}

async function buildMedicationRecords(records: MedicationRecord[]): Promise<{
  formattedRecords: MedicationListRecord[]
  totalCost: number
}> {
  let totalCost = 0

  const formattedRecords = await Promise.all(
    records.map(async record => {
      // 兼容多种数据结构：costInfo.totalCost 或 totalCost
      const costRaw = record.costInfo?.totalCost || (record as any).totalCost
      const numericCost = typeof costRaw === 'number' ? costRaw : parseFloat(String(costRaw ?? 0)) || 0
      totalCost += numericCost

      const batchNumber = await resolveBatchNumber(record)

      return {
        ...record,
        batchNumber,
        formattedTotalCost: formatCost(costRaw),
        preventionTypeName: PREVENTION_TYPE_MAP[record.preventionType] || record.preventionType,
        effectiveness: record.effectiveness || 'pending'
      }
    })
  )

  return { formattedRecords, totalCost }
}

function groupMedicationRecordsByBatch(records: MedicationListRecord[]): BatchGroup[] {
  const batchMap = new Map<string, MedicationListRecord[]>()

  records.forEach(record => {
    const batchKey = record.batchNumber || record.batchId || '未知批次'
    if (!batchMap.has(batchKey)) {
      batchMap.set(batchKey, [])
    }
    batchMap.get(batchKey)!.push(record)
  })

  return Array.from(batchMap.entries())
    .map(([batchNumber, groupRecords]) => {
      // 组内按日期倒序排列
      const sortedRecords = [...groupRecords].sort((a, b) => {
        const dateA = new Date(a.preventionDate || (a.createdAt as string) || 0).getTime()
        const dateB = new Date(b.preventionDate || (b.createdAt as string) || 0).getTime()
        return dateB - dateA
      })
      return {
        batchNumber,
        batchId: sortedRecords[0]?.batchId || batchNumber,
        records: sortedRecords
      }
    })
    // ✅ 批次组按最新记录日期倒序排列（而不是按批次号字母排序）
    .sort((a, b) => {
      const dateA = new Date(a.records[0]?.preventionDate || (a.records[0]?.createdAt as string) || 0).getTime()
      const dateB = new Date(b.records[0]?.preventionDate || (b.records[0]?.createdAt as string) || 0).getTime()
      return dateB - dateA
    })
}

async function enrichRecordsWithBatchNumbers(records: MedicationRecord[]): Promise<MedicationRecord[]> {
  if (!records || records.length === 0) {
    return []
  }

  try {
    const db = wx.cloud.database()
    const batchIds = [...new Set(records.map(record => record.batchId).filter(Boolean))]

    if (batchIds.length === 0) {
      return records
    }

    const batchMap = new Map<string, string>()

    for (let i = 0; i < batchIds.length; i += 20) {
      const batchSlice = batchIds.slice(i, i + 20)
      const batchResult = await db
        .collection('prod_batch_entries')
        .where({
          _id: db.command.in(batchSlice)
        })
        .field({ _id: true, batchNumber: true })
        .get()

      batchResult.data.forEach((batch: { _id: string; batchNumber: string }) => {
        batchMap.set(batch._id, batch.batchNumber)
      })
    }

    return records.map(record => ({
      ...record,
      batchNumber: batchMap.get(record.batchId) || record.batchId,
      operatorName: record.operatorName || '当前用户'
    }))
  } catch (error) {
    logger.error('获取批次号失败:', error)
    return records.map(record => ({
      ...record,
      operatorName: record.operatorName || '当前用户'
    }))
  }
}

Page(createPageWithNavbar(medicationPageConfig as any))
