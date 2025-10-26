// miniprogram/packageHealth/abnormal-records-list/abnormal-records-list.ts

interface AbnormalRecord {
  _id: string
  batchId: string
  batchNumber: string
  checkDate: string
  affectedCount: number
  symptoms: string
  diagnosis: string
  diagnosisConfidence: number
  diagnosisDetails?: {
    disease: string
    confidence: number
    reasoning?: string
    pathogen?: string
    transmission?: string
    symptoms?: string[]
  }
  severity: string
  urgency: string
  status: string  // 'abnormal' | 'treating' | 'isolated'
  aiRecommendation: any
  images: string[]
  diagnosisId: string
  createdAt: string
  // 修正相关字段
  isCorrected?: boolean
  correctedDiagnosis?: string
  correctionReason?: string
  aiAccuracyRating?: number
  correctedBy?: string
  correctedByName?: string
  correctedAt?: string
}

Page({
  data: {
    loading: true,
    records: [] as AbnormalRecord[]
  },

  onLoad() {
    this.loadAbnormalRecords()
  },

  /**
   * 页面显示时刷新数据
   */
  onShow() {
    this.loadAbnormalRecords()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadAbnormalRecords().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载异常记录列表
   */
  async loadAbnormalRecords() {
    this.setData({ loading: true })

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_abnormal_records',  // 使用get_abnormal_records而不是list_abnormal_records
          batchId: null  // null表示获取所有批次
        }
      })

      if (result.result && result.result.success) {
        console.log('异常记录数据:', result.result.data)
        this.setData({
          records: result.result.data || [],
          loading: false
        })
      } else {
        throw new Error(result.result?.error || '加载失败')
      }
    } catch (error: any) {
      console.error('加载异常记录失败:', error)
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  /**
   * 点击记录卡片，跳转到详情页面
   */
  onRecordTap(e: any) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/packageHealth/abnormal-record-detail/abnormal-record-detail?id=${id}`
    })
  }
})

