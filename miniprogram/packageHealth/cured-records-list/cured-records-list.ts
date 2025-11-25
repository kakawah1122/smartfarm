// miniprogram/packageHealth/cured-records-list/cured-records-list.ts
// 治愈记录列表页面

import { createPageWithNavbar } from '../../utils/navigation'
import { HealthCloud } from '../../utils/cloud-functions'
import { logger } from '../../utils/logger'
import type { CuredRecord as BaseCuredRecord } from '../types/treatment'
import { formatCuredRecords } from '../utils/data-utils'

interface RecordStats {
  totalCured: number
  totalCost: number
  totalMedicationCost: number
  avgCostPerAnimal: number
}

interface RecordTapDataset {
  id: string
}

type DerivedCuredRecord = BaseCuredRecord & {
  formattedCuredCost: string
  formattedMedicationCost: string
  formattedCostPerAnimal: string
}

type PageData = {
  records: DerivedCuredRecord[]
  loading: boolean
  stats: RecordStats
  showDetailPopup: boolean
  selectedRecord: DerivedCuredRecord | null
}

type PageCustom = {
  loadCuredRecords: () => Promise<void>
  loadRecordsFromClient: () => Promise<void>
  enrichRecordsWithBatchNumbers: (records: BaseCuredRecord[]) => Promise<BaseCuredRecord[]>
  onRecordTap: (event: WechatMiniprogram.CustomEvent<RecordTapDataset>) => void
  closeDetailPopup: () => void
  goBack: (
    event?: WechatMiniprogram.BaseEvent & {
      stopPropagation?: () => void
    }
  ) => void
}

type PageInstance = WechatMiniprogram.Page.Instance<PageData, PageCustom>

const initialStats: RecordStats = {
  totalCured: 0,
  totalCost: 0,
  totalMedicationCost: 0,
  avgCostPerAnimal: 0
}

const pageConfig: WechatMiniprogram.Page.Options<PageData, PageCustom> = {
  data: {
    records: [],
    loading: true,
    stats: initialStats,
    showDetailPopup: false,
    selectedRecord: null
  },

  onLoad() {
    void this.loadCuredRecords()
  },

  onShow() {
    void this.loadCuredRecords()
  },

  onPullDownRefresh() {
    void this.loadCuredRecords().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadCuredRecords() {
    const page = this as PageInstance

    try {
      page.setData({ loading: true })

      wx.showLoading({ title: '加载治愈记录...' })
      
      const response = await HealthCloud.treatment.getCuredList({}) as { success: boolean; data?: { records: BaseCuredRecord[] }; error?: string }
      
      wx.hideLoading()

      if (!response.success) {
        throw new Error(response.error || '查询失败')
      }

      const curedRecords = [...(response.data?.records ?? [])]

      curedRecords.sort((a, b) => {
        const timeA = a.completedAt || a.createdAt || new Date(0)
        const timeB = b.completedAt || b.createdAt || new Date(0)
        return new Date(timeB).getTime() - new Date(timeA).getTime()
      })

      const { derivedRecords, stats } = formatCuredRecords(curedRecords)

      page.setData({
        records: derivedRecords,
        stats,
        loading: false
      })
    } catch (error) {
      logger.error('云函数查询失败，尝试降级到客户端查询:', error)

      try {
        await this.loadRecordsFromClient()
      } catch (clientError) {
        logger.error('客户端查询也失败:', clientError)
        wx.showToast({
          title: (clientError as Error).message || '加载失败',
          icon: 'none'
        })
        page.setData({ loading: false })
      }
    }
  },

  async loadRecordsFromClient() {
    const page = this as PageInstance
    const db = wx.cloud.database()
    const _ = db.command

    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const result = await db
      .collection('health_treatment_records')
      .where({
        createdAt: _.gte(oneYearAgo)
      })
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get()

    const allRecords = result.data as BaseCuredRecord[]
    const curedRecords = allRecords.filter(record => {
      if (record.isDeleted === true) return false
      return (record.outcome?.curedCount || 0) > 0
    })

    curedRecords.sort((a, b) => {
      const timeA = a.completedAt || a.createdAt || new Date(0)
      const timeB = b.completedAt || b.createdAt || new Date(0)
      return new Date(timeB).getTime() - new Date(timeA).getTime()
    })

    const enrichedRecords = await this.enrichRecordsWithBatchNumbers(curedRecords)
    const { derivedRecords, stats } = formatCuredRecords(enrichedRecords)

    page.setData({
      records: derivedRecords,
      stats,
      loading: false
    })
  },

  async enrichRecordsWithBatchNumbers(records: BaseCuredRecord[]): Promise<BaseCuredRecord[]> {
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
  },

  onRecordTap(event) {
    const page = this as PageInstance
    const { id } = event.currentTarget.dataset as RecordTapDataset
    const record = page.data.records.find(item => item._id === id)

    if (record) {
      page.setData({
        selectedRecord: record,
        showDetailPopup: true
      })
    }
  },

  closeDetailPopup() {
    const page = this as PageInstance
    page.setData({
      showDetailPopup: false
    })

    setTimeout(() => {
      page.setData({
        selectedRecord: null
      })
    }, 300)
  },

  goBack(event) {
    event?.stopPropagation?.()

    const pages = getCurrentPages()

    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1,
        fail: err => {
          logger.error('返回失败:', err)
          wx.redirectTo({
            url: '/pages/health/health',
            fail: () => {
              wx.switchTab({
                url: '/pages/index/index'
              })
            }
          })
        }
      })
    } else {
      wx.redirectTo({
        url: '/pages/health/health',
        fail: () => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      })
    }
  }
}

Page(createPageWithNavbar(pageConfig))
