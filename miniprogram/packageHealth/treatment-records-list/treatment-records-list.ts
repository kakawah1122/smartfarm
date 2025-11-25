// miniprogram/packageHealth/treatment-records-list/treatment-records-list.ts
import { safeCloudCall } from '../../utils/safe-cloud-call'

/**
 * 云函数调用封装 - 兼容 wx.cloud.callFunction 返回格式
 * 自动路由 health-management 到新云函数
 */
async function callCloudFunction(config: { name: string; data: Record<string, unknown>; timeout?: number }) {
  const result = await safeCloudCall(config)
  return { result }
}

interface TreatmentRecord {
  _id: string
  batchId: string
  batchNumber?: string
  abnormalRecordId?: string
  treatmentDate: string
  treatmentType: string
  diagnosis: {
    preliminary: string
    confirmed: string
    confidence: number
    diagnosisMethod: string
  }
  treatmentPlan: {
    primary: string
    followUpSchedule: unknown[]
  }
  medications: unknown[]
  outcome: {
    status: string
    curedCount: number
    improvedCount: number
    deathCount: number
    totalTreated: number
  }
  cost: {
    medication: number
    veterinary: number
    supportive: number
    total: number
  }
  notes: string
  isDraft: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

interface TreatmentsResponse {
  success: boolean
  data?: {
    treatments: TreatmentRecord[]
  }
  error?: string
}

interface RecordTapDataset {
  id?: string
}

type TreatmentsPageData = {
  loading: boolean
  records: TreatmentRecord[]
}

type TreatmentsPageCustom = {
  dedupeRecordsById: (records: unknown[]) => unknown[]
  loadTreatmentRecords: () => Promise<void>
  enrichRecordsWithBatchNumbers: (records: TreatmentRecord[]) => Promise<TreatmentRecord[]>
  onRecordTap: (event: WechatMiniprogram.TouchEvent<RecordTapDataset>) => void
  getStatusText: (status: string) => string
  getTreatmentTypeText: (type: string) => string
}

type TreatmentsPageInstance = WechatMiniprogram.Page.Instance<TreatmentsPageData, TreatmentsPageCustom>

interface TreatmentListUpdatedData {
  treatmentId: string
}

import { markHomepageNeedSync } from '../utils/global-sync'

const initialData: TreatmentsPageData = {
  loading: true,
  records: []
}

const dedupeRecordsById = (records: unknown[]): unknown[] => {
  if (!Array.isArray(records)) {
    return []
  }

  const seen = new Set<string>()
  const unique: unknown[] = []

  for (const record of records) {
    const id = (record as { _id?: string })?._id
    if (id && !seen.has(id)) {
      seen.add(id)
      unique.push(record)
    }
  }

  return unique
}

const pageConfig: WechatMiniprogram.Page.Options<TreatmentsPageData, TreatmentsPageCustom> = {
  data: initialData,
  dedupeRecordsById,

  onLoad() {
    void this.loadTreatmentRecords()
  },

  onShow() {
    void this.loadTreatmentRecords()
  },

  onPullDownRefresh() {
    void this.loadTreatmentRecords().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadTreatmentRecords() {
    const page = this as TreatmentsPageInstance
    page.setData({ loading: true })

    try {
      const result = await callCloudFunction({
        name: 'health-management',
        data: {
          action: 'get_ongoing_treatments',
          batchId: null
        }
      })

      const cloudResult = result.result as TreatmentsResponse | undefined

      if (!cloudResult || !cloudResult.success) {
        throw new Error(cloudResult?.error || '加载失败')
      }

      const treatments = cloudResult.data?.treatments || []
      const enrichedRecords = await page.enrichRecordsWithBatchNumbers(treatments)
      const uniqueRecords = page.dedupeRecordsById(enrichedRecords) as TreatmentRecord[]

      page.setData({
        records: uniqueRecords,
        loading: false
      })
    } catch (error) {
      wx.showToast({
        title: (error as Error).message || '加载失败',
        icon: 'none'
      })
      page.setData({ loading: false })
    }
  },

  async enrichRecordsWithBatchNumbers(records: TreatmentRecord[]): Promise<TreatmentRecord[]> {
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
        batchNumber: batchMap.get(record.batchId) || record.batchId
      }))
    } catch (error) {
      return records
    }
  },

  onRecordTap(event) {
    const page = this as TreatmentsPageInstance
    const { id } = event.currentTarget.dataset as RecordTapDataset

    if (!id) {
      return
    }

    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?treatmentId=${id}&mode=view`,
      events: {
        treatmentProgressUpdated: (data: TreatmentListUpdatedData) => {
          void page.loadTreatmentRecords()

          try {
            const eventChannel = page.getOpenerEventChannel?.()
            eventChannel?.emit('treatmentListUpdated', data)
          } catch (error) {
            wx.setStorageSync('health_page_need_refresh', true)
            markHomepageNeedSync()
          }
        }
      }
    })
  },

  getStatusText(status: string) {
    const statusMap: Record<string, string> = {
      ongoing: '治疗中',
      cured: '已治愈',
      died: '已死亡',
      pending: '待开始'
    }
    return statusMap[status] || status
  },

  getTreatmentTypeText(type: string) {
    const typeMap: Record<string, string> = {
      medication: '药物治疗'
    }
    return typeMap[type] || type
  }
}

Page(pageConfig)
