// miniprogram/packageHealth/treatment-records-list/treatment-records-list.ts

interface TreatmentRecord {
  _id: string
  batchId: string
  abnormalRecordId?: string
  treatmentDate: string
  treatmentType: string  // 'medication'
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
        const treatments = result.result.data?.treatments || []
        
        // 批量获取批次号
        const enrichedRecords = await this.enrichRecordsWithBatchNumbers(treatments)
        
        this.setData({
          records: enrichedRecords,
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
   * 批量获取批次号
   */
  async enrichRecordsWithBatchNumbers(records: TreatmentRecord[]): Promise<any[]> {
    if (!records || records.length === 0) return []
    
    try {
      const db = wx.cloud.database()
      
      // 提取所有唯一的批次ID
      const batchIds = [...new Set(records.map(r => r.batchId).filter(Boolean))]
      
      if (batchIds.length === 0) return records
      
      // 批量查询批次信息
      const batchMap = new Map()
      
      // 每次查询最多20个（数据库限制）
      for (let i = 0; i < batchIds.length; i += 20) {
        const batch = batchIds.slice(i, i + 20)
        const batchResult = await db.collection('prod_batch_entries')
          .where({
            _id: db.command.in(batch)
          })
          .field({ _id: true, batchNumber: true })
          .get()
        
        batchResult.data.forEach((b: any) => {
          batchMap.set(b._id, b.batchNumber)
        })
      }
      
      // 为每条记录添加批次号
      return records.map(record => ({
        ...record,
        batchNumber: batchMap.get(record.batchId) || record.batchId
      }))
    } catch (error) {
      // 查询失败时返回原始数据
      return records
    }
  },

  /**
   * 点击记录卡片，跳转到详情页面（查看+跟进模式）
   */
  onRecordTap(e: any) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?treatmentId=${id}&mode=view`,
      // ✅ 使用EventChannel监听治疗进展更新
      events: {
        treatmentProgressUpdated: (data: any) => {
          // 收到治疗进展更新通知，立即刷新列表
          // 刷新列表数据
          this.loadTreatmentRecords()
          
          // ✅ 同时通知上一页（健康管理中心）刷新
          try {
            const eventChannel = this.getOpenerEventChannel()
            if (eventChannel) {
              eventChannel.emit('treatmentListUpdated', data)
              // 已通知健康管理中心刷新
            }
          } catch (error) {
            // 无法通知上一页，使用降级方案
            // 降级方案
            wx.setStorageSync('health_page_need_refresh', true)
          }
        }
      }
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
      'medication': '药物治疗'
    }
    return typeMap[type] || type
  }
})

