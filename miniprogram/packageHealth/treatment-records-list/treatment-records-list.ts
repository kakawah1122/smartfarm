// miniprogram/packageHealth/treatment-records-list/treatment-records-list.ts

interface TreatmentRecord {
  _id: string
  batchId: string
  abnormalRecordId?: string
  treatmentDate: string
  treatmentType: string  // 'medication' | 'isolation'
  diagnosis: {
    preliminary: string
    confirmed: string
    confidence: number
    diagnosisMethod: string
  }
  treatmentPlan: {
    primary: string
    followUpSchedule: any[]
  }
  medications: any[]
  outcome: {
    status: string  // 'ongoing' | 'cured' | 'died' | 'pending'
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

Page({
  data: {
    loading: true,
    records: [] as TreatmentRecord[]
  },

  onLoad() {
    this.loadTreatmentRecords()
  },

  /**
   * 页面显示时刷新数据
   */
  onShow() {
    this.loadTreatmentRecords()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadTreatmentRecords().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载治疗记录列表（进行中的）
   */
  async loadTreatmentRecords() {
    this.setData({ loading: true })

    try {
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_ongoing_treatments',
          batchId: null  // null表示获取所有批次
        }
      })

      if (result.result && result.result.success) {
        console.log('治疗记录数据:', result.result.data)
        this.setData({
          records: result.result.data?.treatments || [],
          loading: false
        })
      } else {
        throw new Error(result.result?.error || '加载失败')
      }
    } catch (error: any) {
      console.error('加载治疗记录失败:', error)
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  /**
   * 点击记录卡片，跳转到详情页面（查看+跟进模式）
   */
  onRecordTap(e: any) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?treatmentId=${id}&mode=view`
    })
  },

  /**
   * 获取状态文本
   */
  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'ongoing': '治疗中',
      'cured': '已治愈',
      'died': '已死亡',
      'pending': '待开始'
    }
    return statusMap[status] || status
  },

  /**
   * 获取治疗类型文本
   */
  getTreatmentTypeText(type: string): string {
    const typeMap: Record<string, string> = {
      'medication': '药物治疗',
      'isolation': '隔离观察'
    }
    return typeMap[type] || type
  }
})

