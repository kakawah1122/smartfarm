// miniprogram/packageHealth/death-records-list/death-records-list.ts

import { createPageWithNavbar } from '../../utils/navigation'
import CloudApi from '../../utils/cloud-api'
import { formatDateTime } from '../../utils/health-utils'
import { logger } from '../../utils/logger'
import type { DeathRecord } from '../types/death-record'

interface DeathStats {
  totalDeath: number
  totalLoss: number
  avgLossPerAnimal: number
}

interface RecordTapDataset {
  id?: string
}

type GoBackEvent = WechatMiniprogram.BaseEvent & {
  stopPropagation?: () => void
}

interface DerivedDeathRecord extends DeathRecord {
  deathCount: number
  formattedTotalLoss: string
  formattedCostPerAnimal: string
  formattedTreatmentCost: string
  displayDeathCause: string
  displayFindings: string
}

type DeathListPageData = {
  loading: boolean
  records: DerivedDeathRecord[]
  stats: DeathStats
  showDetailPopup: boolean
  selectedRecord: DerivedDeathRecord | null
  pendingRecordId: string
  useVirtualList: boolean // 是否使用虚拟列表
  virtualListHeight: number // 虚拟列表容器高度（rpx）
}

type DeathListPageCustom = {
  loadDeathRecords: () => Promise<void>
  onRecordTap: (event: WechatMiniprogram.TouchEvent<RecordTapDataset>) => void
  onVirtualRecordTap: (event: WechatMiniprogram.CustomEvent<{ id: string }>) => void
  closeDetailPopup: () => void
  goBack: (event?: GoBackEvent) => void
  calculateVirtualListHeight: () => void
}

type DeathListPageInstance = WechatMiniprogram.Page.Instance<DeathListPageData, DeathListPageCustom>

const initialStats: DeathStats = {
  totalDeath: 0,
  totalLoss: 0,
  avgLossPerAnimal: 0
}

const initialData: DeathListPageData = {
  loading: true,
  records: [],
  stats: initialStats,
  showDetailPopup: false,
  selectedRecord: null,
  pendingRecordId: '',
  useVirtualList: false, // 暂时禁用虚拟列表，回退到原版本
  virtualListHeight: 1000 // 默认高度
}

const formatNumber = (value: number): string => value.toFixed(2)

const pageConfig: WechatMiniprogram.Page.Options<DeathListPageData, DeathListPageCustom> = {
  data: initialData,

  onLoad(options?: Record<string, any>) {
    const page = this as DeathListPageInstance

    page.calculateVirtualListHeight()

    if (options && typeof options.recordId === 'string' && options.recordId.trim()) {
      page.setData({ pendingRecordId: options.recordId })
    }

    void page.loadDeathRecords()
  },

  onShow() {
    void this.loadDeathRecords()
  },

  onPullDownRefresh() {
    void this.loadDeathRecords().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadDeathRecords() {
    const page = this as DeathListPageInstance
    page.setData({ loading: true })

    try {
      const response = await CloudApi.callFunction<DeathRecord[]>(
        'health-management',
        {
          action: 'get_death_records_list'
        },
        {
          loading: true,
          loadingText: '加载死亡记录...',
          showError: false
        }
      )

      if (!response.success) {
        throw new Error(response.error || '加载失败')
      }

      const deathRecords = response.data || []

      let totalDeath = 0
      let totalLoss = 0

      const records: DerivedDeathRecord[] = deathRecords.map(record => {
        const deathCount = record.deathCount || record.totalDeathCount || 0
        totalDeath += deathCount

        let loss = 0
        let treatmentCost = 0

        if (record.financialLoss && typeof record.financialLoss === 'object') {
          const totalLossRaw = record.financialLoss.totalLoss
          loss = typeof totalLossRaw === 'string' ? parseFloat(totalLossRaw) || 0 : totalLossRaw || 0

          const treatmentCostRaw = record.financialLoss.treatmentCost
          treatmentCost =
            typeof treatmentCostRaw === 'string' ? parseFloat(treatmentCostRaw) || 0 : treatmentCostRaw || 0
        } else if (typeof record.financeLoss === 'number') {
          loss = record.financeLoss
        } else if (typeof record.financeLoss === 'string') {
          loss = parseFloat(record.financeLoss) || 0
        }

        totalLoss += loss

        const costPerAnimal = deathCount > 0 ? loss / deathCount : 0

        const displayDeathCause = record.isCorrected && record.correctedCause
          ? record.correctedCause
          : record.deathCause || '未知死因'

        const meaningfulTexts: string[] = []

        const pushIfMeaningful = (text?: string) => {
          if (!text) {
            return
          }
          const trimmed = text.trim()
          if (!trimmed || trimmed === '无明显生前症状') {
            return
          }
          meaningfulTexts.push(trimmed)
        }

        if (record.autopsyFindings) {
          if (typeof record.autopsyFindings === 'string') {
            pushIfMeaningful(record.autopsyFindings)
          } else if (typeof record.autopsyFindings === 'object') {
            const abnormalities = record.autopsyFindings.abnormalities
            if (Array.isArray(abnormalities) && abnormalities.length > 0) {
              pushIfMeaningful(abnormalities.join('、'))
            }
            pushIfMeaningful(record.autopsyFindings.description)
          }
        }

        pushIfMeaningful(record.description)
        pushIfMeaningful(record.symptomsText)

        const displayFindings = meaningfulTexts
          .filter((value, index, self) => self.indexOf(value) === index)
          .join('；')

        // 处理成本分解数据（直接使用云函数计算好的数据）
        let costBreakdown = null
        const financialLossAny = record.financialLoss as any
        if (financialLossAny?.costBreakdown) {
          const breakdown = financialLossAny.costBreakdown
          
          // ✅ 优先使用云函数计算好的每只成本
          if (breakdown.entryUnitCost && breakdown.breedingCost !== undefined) {
            costBreakdown = {
              entryUnitCost: breakdown.entryUnitCost,
              breedingCost: breakdown.breedingCost,
              preventionCost: breakdown.preventionCost || '0.00',
              treatmentCost: breakdown.treatmentCost || '0.00'
            }
          } else {
            // ⚠️ 向后兼容：旧数据需要前端计算
            const unitCostNum = parseFloat(String(record.unitCost || 40))
            const batchInitialQuantity = parseFloat(breakdown.entryCostTotal || breakdown.entryCost || 0) > 0 
              ? Math.round(parseFloat(breakdown.entryCostTotal || breakdown.entryCost) / unitCostNum)
              : deathCount
            const currentCount = batchInitialQuantity - (record.totalDeathCount || 0) || deathCount

            const entryUnitCost = parseFloat(breakdown.entryCostTotal || breakdown.entryCost || 0) / batchInitialQuantity
            const breedingCost = parseFloat(breakdown.materialCostTotal || breakdown.materialCost || 0) / currentCount
            const preventionCost = parseFloat(breakdown.preventionCostTotal || breakdown.preventionCost || 0) / currentCount
            const treatmentCostPerAnimal = parseFloat(breakdown.treatmentCostTotal || breakdown.treatmentCost || 0) / currentCount

            costBreakdown = {
              entryUnitCost: formatNumber(entryUnitCost),
              breedingCost: formatNumber(breedingCost),
              preventionCost: formatNumber(preventionCost),
              treatmentCost: formatNumber(treatmentCostPerAnimal)
            }
          }
        }

        return {
          ...record,
          deathCount,
          formattedTotalLoss: formatNumber(loss),
          formattedCostPerAnimal: formatNumber(costPerAnimal),
          formattedTreatmentCost: formatNumber(treatmentCost),
          displayDeathCause,
          displayFindings,
          correctedAt: record.correctedAt ? formatDateTime(record.correctedAt) : record.correctedAt,
          costBreakdown: costBreakdown
        }
      })

      const avgLossPerAnimal = totalDeath > 0 ? totalLoss / totalDeath : 0

      const { pendingRecordId, selectedRecord, showDetailPopup } = page.data

      let nextSelectedRecord = selectedRecord
      let nextShowDetailPopup = showDetailPopup

      if (pendingRecordId) {
        const targetRecord = records.find(record => record._id === pendingRecordId)
        if (targetRecord) {
          nextSelectedRecord = targetRecord
          nextShowDetailPopup = true
        }
      }

      page.setData({
        records,
        stats: {
          totalDeath,
          totalLoss: parseFloat(totalLoss.toFixed(2)),
          avgLossPerAnimal: parseFloat(avgLossPerAnimal.toFixed(2))
        },
        loading: false,
        selectedRecord: nextSelectedRecord,
        showDetailPopup: nextShowDetailPopup,
        pendingRecordId: ''
      })
    } catch (error) {
      wx.showToast({
        title: (error as Error).message || '加载失败',
        icon: 'none'
      })
      page.setData({ loading: false })
    }
  },

  onRecordTap(event) {
    const page = this as DeathListPageInstance
    const { id } = event.currentTarget.dataset as RecordTapDataset

    if (!id) {
      return
    }

    const record = page.data.records.find(item => item._id === id)

    if (record) {
      page.setData({
        selectedRecord: record,
        showDetailPopup: true
      })
    }
  },

  closeDetailPopup() {
    const page = this as DeathListPageInstance
    page.setData({ showDetailPopup: false })

    setTimeout(() => {
      page.setData({ selectedRecord: null })
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
  },

  /**
   * 虚拟列表记录点击事件
   */
  onVirtualRecordTap(event) {
    const page = this as DeathListPageInstance
    const { id } = event.detail
    
    if (!id) {
      return
    }

    const record = page.data.records.find(r => r._id === id)
    if (record) {
      page.setData({
        selectedRecord: record,
        showDetailPopup: true
      })
    }
  },

  /**
   * 计算虚拟列表容器高度
   */
  calculateVirtualListHeight() {
    const page = this as DeathListPageInstance
    
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync()
    const windowHeight = systemInfo.windowHeight
    const navbarHeight = systemInfo.statusBarHeight ? systemInfo.statusBarHeight + 44 : 88
    
    // 减去统计卡片高度（约200rpx）和安全区域
    const statsHeight = 100 // px
    const availableHeight = (windowHeight - navbarHeight - statsHeight) * 2
    
    page.setData({
      virtualListHeight: availableHeight
    })
  }
}

Page(createPageWithNavbar(pageConfig))
