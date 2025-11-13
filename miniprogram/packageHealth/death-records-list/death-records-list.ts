// miniprogram/packageHealth/death-records-list/death-records-list.ts

interface DeathRecord {
  _id: string
  batchId: string
  batchNumber: string
  treatmentId?: string
  deathDate: string
  deathCount: number
  totalDeathCount?: number
  deathCause: string
  deathCategory?: string
  financialLoss?: {
    totalLoss: number
    costPerAnimal: number
    treatmentCost: number
  }
  financeLoss?: number  // 兼容旧字段
  aiDiagnosisId?: string
  autopsyImages?: string[]
  isCorrected?: boolean
  correctedCause?: string
  correctedBy?: string
  correctedAt?: string
  operatorName?: string
  description?: string
  createdAt?: any
  symptomsText?: string
  autopsyFindings?: any
  correctedByName?: string
  // 格式化字段
  formattedTotalLoss?: string
  formattedCostPerAnimal?: string
  formattedTreatmentCost?: string
  displayDeathCause?: string
  displayFindings?: string
}

import { createPageWithNavbar } from '../../utils/navigation'
import { formatDateTime } from '../../utils/health-utils'
import { logger } from '../../utils/logger'

Page({
  data: {
    loading: true,
    records: [] as DeathRecord[],
    
    // 统计数据
    stats: {
      totalDeath: 0,
      totalLoss: 0,
      avgLossPerAnimal: 0
    },
    
    // 详情弹窗
    showDetailPopup: false,
    selectedRecord: null as DeathRecord | null,

    // 指定加载后自动展开的记录
    pendingRecordId: ''
  },

  onLoad(options?: Record<string, any>) {
    if (options && typeof options.recordId === 'string' && options.recordId.trim()) {
      this.setData({
        pendingRecordId: options.recordId
      })
    }
    this.loadDeathRecords()
  },

  onShow() {
    this.loadDeathRecords()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadDeathRecords().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载死亡记录列表
   */
  async loadDeathRecords() {
    this.setData({ loading: true })

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_death_records_list'
        }
      })

      if (result.result && result.result.success) {
        const deathRecords = result.result.data || []
        
        // 计算统计数据
        let totalDeath = 0
        let totalLoss = 0
        
        // 预处理数据，格式化成本字段
        const records = deathRecords.map((record: DeathRecord) => {
          const deathCount = record.deathCount || record.totalDeathCount || 0
          totalDeath += deathCount
          
          // 处理财务损失（兼容新旧字段）
          let loss = 0
          let treatmentCost = 0
          if (record.financialLoss && typeof record.financialLoss === 'object') {
            // ✅ 转换为数字（可能是字符串）
            const totalLoss = record.financialLoss.totalLoss
            loss = typeof totalLoss === 'string' ? parseFloat(totalLoss) || 0 : (totalLoss || 0)
            
            const tCost = record.financialLoss.treatmentCost
            treatmentCost = typeof tCost === 'string' ? parseFloat(tCost) || 0 : (tCost || 0)
          } else if (typeof record.financeLoss === 'number') {
            loss = record.financeLoss
          } else if (typeof record.financeLoss === 'string') {
            // ✅ 兼容字符串类型的 financeLoss
            loss = parseFloat(record.financeLoss) || 0
          }
          totalLoss += loss
          
          const costPerAnimal = deathCount > 0 ? (loss / deathCount) : 0

          const displayDeathCause = (record.isCorrected && record.correctedCause)
            ? record.correctedCause
            : (record.deathCause || '未知死因')

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

          return {
            ...record,
            deathCount: deathCount,
            formattedTotalLoss: loss.toFixed(2),
            formattedCostPerAnimal: costPerAnimal.toFixed(2),
            formattedTreatmentCost: treatmentCost.toFixed(2),
            displayDeathCause,
            displayFindings
          }
        })
        
        const avgLossPerAnimal = totalDeath > 0 ? (totalLoss / totalDeath) : 0
        
        const pendingRecordId = this.data.pendingRecordId || ''
        let selectedRecord = this.data.selectedRecord
        let showDetailPopup = this.data.showDetailPopup

        if (pendingRecordId) {
          const targetRecord = records.find((record: DeathRecord) => record._id === pendingRecordId)
          if (targetRecord) {
            selectedRecord = targetRecord
            showDetailPopup = true
          }
        }

        this.setData({
          records,
          stats: {
            totalDeath,
            totalLoss: parseFloat(totalLoss.toFixed(2)),
            avgLossPerAnimal: parseFloat(avgLossPerAnimal.toFixed(2))
          },
          loading: false,
          selectedRecord,
          showDetailPopup,
          pendingRecordId: ''
        })
      } else {
        throw new Error(result.result?.error || '加载失败')
      }
    } catch (error: any) {
      // 加载失败，已显示错误提示
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  /**
   * 点击记录卡片，显示详情弹窗
   */
  onRecordTap(e: any) {
    const { id } = e.currentTarget.dataset
    const record = this.data.records.find(r => r._id === id)
    if (record) {
      this.setData({
        selectedRecord: record,
        showDetailPopup: true
      })
    }
  },

  /**
   * 关闭详情弹窗
   */
  closeDetailPopup() {
    this.setData({
      showDetailPopup: false
    })
    // ⚠️ 重要：延迟清空数据，避免弹窗关闭动画时数据闪烁
    setTimeout(() => {
      this.setData({
        selectedRecord: null
      })
    }, 300)
  },

  /**
   * 返回上一页
   */
  goBack(e?: any) {
    // 阻止事件冒泡，避免 navigation-bar 执行默认返回
    if (e) {
      e.stopPropagation && e.stopPropagation()
    }
    
    const pages = getCurrentPages()
    
    if (pages.length > 1) {
      // 有上一页，正常返回
      wx.navigateBack({
        delta: 1,
        fail: (err) => {
          logger.error('返回失败:', err)
          // 返回失败，跳转到健康管理页面
          wx.redirectTo({
            url: '/pages/health/health',
            fail: () => {
              // 如果跳转失败，尝试切换到首页
              wx.switchTab({
                url: '/pages/index/index'
              })
            }
          })
        }
      })
    } else {
      // 没有上一页，直接跳转到健康管理页面
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
})

