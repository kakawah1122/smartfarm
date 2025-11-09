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
  // 格式化字段
  formattedTotalLoss?: string
  formattedCostPerAnimal?: string
  formattedTreatmentCost?: string
}

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
    selectedRecord: null as DeathRecord | null
  },

  onLoad() {
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
          
          return {
            ...record,
            deathCount: deathCount,
            formattedTotalLoss: loss.toFixed(2),
            formattedCostPerAnimal: costPerAnimal.toFixed(2),
            formattedTreatmentCost: treatmentCost.toFixed(2)
          }
        })
        
        const avgLossPerAnimal = totalDeath > 0 ? (totalLoss / totalDeath) : 0
        
        this.setData({
          records,
          stats: {
            totalDeath,
            totalLoss: parseFloat(totalLoss.toFixed(2)),
            avgLossPerAnimal: parseFloat(avgLossPerAnimal.toFixed(2))
          },
          loading: false
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
   * 返回
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    })
  }
})

