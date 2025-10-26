// miniprogram/packageHealth/death-records-list/death-records-list.ts

interface DeathRecord {
  _id: string
  batchId: string
  batchNumber: string
  deathDate: string
  deathCount: number
  deathCause: string
  financeLoss: number
  aiDiagnosisId: string
  autopsyImages?: string[]
  isCorrected: boolean
  correctedCause?: string
  correctedBy?: string
  correctedAt?: string
}

Page({
  data: {
    loading: true,
    records: [] as DeathRecord[]
  },

  onLoad() {
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
        this.setData({
          records: result.result.data || [],
          loading: false
        })
      } else {
        throw new Error(result.result?.error || '加载失败')
      }
    } catch (error: any) {
      console.error('加载死亡记录失败:', error)
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  /**
   * 点击记录卡片，跳转到详情页
   */
  onRecordTap(e: any) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/packageHealth/death-record-detail/death-record-detail?id=${id}`
    })
  }
})

