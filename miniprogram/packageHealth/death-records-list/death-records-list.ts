// miniprogram/packageHealth/death-records-list/death-records-list.ts

import { createPageWithNavbar } from '../../utils/navigation'
import { HealthCloud } from '../../utils/cloud-functions'
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

const pageConfig: WechatMiniprogram.Page.Options<DeathListPageData, DeathListPageCustom> & {
  _timerIds: number[]
  _safeSetTimeout: (callback: () => void, delay: number) => number
  _clearAllTimers: () => void
} = {
  // ✅ 定时器管理
  _timerIds: [] as number[],
  
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  _clearAllTimers() {
    this._timerIds.forEach((id: number) => clearTimeout(id))
    this._timerIds = []
  },
  
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

  onUnload() {
    this._clearAllTimers()
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
      const response = await HealthCloud.death.list({})

      if (!response.success) {
        throw new Error(response.error || '加载失败')
      }

      const deathRecords = (response.data?.records || response.data || []) as DeathRecord[]

      let totalDeath = 0
      let totalLoss = 0

      const records: DerivedDeathRecord[] = deathRecords.map(record => {
        const deathCount = record.deathCount || record.totalDeathCount || 0
        totalDeath += deathCount

        let loss = 0
        let costPerAnimal = 0
        let treatmentCostTotal = 0
        let costBreakdownFromBatch = null

        // ✅ 优先使用记录根级别的 costBreakdown（数据库已有的）
        const recordCostBreakdown = record.costBreakdown
        
        if (recordCostBreakdown && recordCostBreakdown.entryUnitCost) {
          // 使用数据库中已存储的成本分解
          const entryUnitCost = parseFloat(recordCostBreakdown.entryUnitCost || '0') || 0
          const breedingCost = parseFloat(recordCostBreakdown.breedingCost || '0') || 0
          const preventionCost = parseFloat(recordCostBreakdown.preventionCost || '0') || 0
          const treatmentCost = parseFloat(recordCostBreakdown.treatmentCost || '0') || 0
          
          costPerAnimal = entryUnitCost + breedingCost + preventionCost + treatmentCost
          loss = costPerAnimal * deathCount
          treatmentCostTotal = treatmentCost * deathCount
          
          costBreakdownFromBatch = {
            entryUnitCost: entryUnitCost.toFixed(2),
            breedingCost: breedingCost.toFixed(2),
            preventionCost: preventionCost.toFixed(2),
            treatmentCost: treatmentCost.toFixed(2)
          }
        } else {
          // 降级：使用 financialLoss 中的数据
          const financialLossObj = record.financialLoss as { 
            totalLoss?: number | string
            unitCost?: number | string
            treatmentCost?: number | string
          } | null
          
          if (financialLossObj && typeof financialLossObj === 'object') {
            const totalLossRaw = financialLossObj.totalLoss
            loss = typeof totalLossRaw === 'string' ? parseFloat(totalLossRaw) || 0 : (totalLossRaw as number) || 0
            costPerAnimal = deathCount > 0 ? loss / deathCount : 0

            const treatmentCostRaw = financialLossObj.treatmentCost
            treatmentCostTotal =
              typeof treatmentCostRaw === 'string' ? parseFloat(treatmentCostRaw) || 0 : (treatmentCostRaw as number) || 0
          } else if (typeof record.financeLoss === 'number') {
            loss = record.financeLoss
            costPerAnimal = deathCount > 0 ? loss / deathCount : 0
          } else if (typeof record.financeLoss === 'string') {
            loss = parseFloat(record.financeLoss) || 0
            costPerAnimal = deathCount > 0 ? loss / deathCount : 0
          }
        }

        totalLoss += loss

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

        // ✅ 优先使用实时计算的成本分解（costBreakdownFromBatch），这样不依赖数据库存储
        return {
          ...record,
          deathCount,
          formattedTotalLoss: formatNumber(loss),
          formattedCostPerAnimal: formatNumber(costPerAnimal),
          formattedTreatmentCost: formatNumber(treatmentCostTotal),
          displayDeathCause,
          displayFindings,
          correctedAt: record.correctedAt ? formatDateTime(record.correctedAt) : record.correctedAt,
          costBreakdown: costBreakdownFromBatch  // 使用实时计算的成本分解
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

    this._safeSetTimeout(() => {
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
    
    // 获取窗口信息（使用新API替代废弃的getSystemInfoSync）
    const windowInfo = wx.getWindowInfo()
    const windowHeight = windowInfo.windowHeight
    const navbarHeight = windowInfo.statusBarHeight ? windowInfo.statusBarHeight + 44 : 88
    
    // 减去统计卡片高度（约200rpx）和安全区域
    const statsHeight = 100 // px
    const availableHeight = (windowHeight - navbarHeight - statsHeight) * 2
    
    page.setData({
      virtualListHeight: availableHeight
    })
  }
}

Page(createPageWithNavbar(pageConfig as any))
