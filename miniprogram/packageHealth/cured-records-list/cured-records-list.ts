// miniprogram/packageHealth/cured-records-list/cured-records-list.ts
// 治愈记录列表页面

interface CuredRecord {
  _id: string
  batchId: string
  batchNumber: string
  diagnosis: {
    confirmed?: string
    preliminary?: string
  }
  treatmentType: string
  treatmentDate: string
  outcome: {
    totalTreated: number
    curedCount: number
    deathCount: number
    status: string
    curedCost?: number
    curedMedicationCost?: number
  }
  cost: {
    total: number
    medication: number
  }
  medications: any[]
  treatmentPlan: {
    primary?: string
  }
  completedAt?: string
}

Page({
  data: {
    records: [] as CuredRecord[],
    loading: true,
    
    // 统计数据
    stats: {
      totalCured: 0,
      totalCost: 0,
      totalMedicationCost: 0,
      avgCostPerAnimal: 0
    }
  },

  onLoad() {
    this.loadCuredRecords()
  },

  onShow() {
    this.loadCuredRecords()
  },

  onPullDownRefresh() {
    this.loadCuredRecords().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载治愈记录
  async loadCuredRecords() {
    try {
      this.setData({ loading: true })

      const db = wx.cloud.database()
      const _ = db.command

      // 查询已治愈的治疗记录
      const result = await db.collection('health_treatment_records')
        .where({
          'outcome.status': _.in(['cured', 'completed']),
          'outcome.curedCount': _.gt(0),
          isDeleted: _.neq(true)
        })
        .orderBy('completedAt', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get()

      console.log('查询到的治愈记录数:', result.data.length)

      // 计算统计数据
      let totalCured = 0
      let totalCost = 0
      let totalMedicationCost = 0

      // ✅ 预处理数据，格式化成本字段
      const records = (result.data as CuredRecord[]).map(record => {
        totalCured += record.outcome.curedCount || 0
        totalCost += record.outcome.curedCost || 0
        totalMedicationCost += record.outcome.curedMedicationCost || 0

        return {
          ...record,
          // 添加格式化后的成本字段
          formattedCuredCost: (record.outcome.curedCost || 0).toFixed(2),
          formattedMedicationCost: (record.outcome.curedMedicationCost || 0).toFixed(2),
          formattedCostPerAnimal: record.outcome.curedCount > 0 
            ? ((record.outcome.curedCost || 0) / record.outcome.curedCount).toFixed(2)
            : '0.00'
        }
      })

      const avgCostPerAnimal = totalCured > 0 ? (totalCost / totalCured) : 0

      this.setData({
        records,
        stats: {
          totalCured,
          totalCost: parseFloat(totalCost.toFixed(2)),
          totalMedicationCost: parseFloat(totalMedicationCost.toFixed(2)),
          avgCostPerAnimal: parseFloat(avgCostPerAnimal.toFixed(2))
        },
        loading: false
      })

    } catch (error: any) {
      console.error('❌ 加载治愈记录失败:', error)
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  // 点击记录查看详情
  onRecordTap(e: any) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/packageHealth/treatment-record/treatment-record?id=${id}&viewMode=true`
    })
  },

  // 返回
  goBack() {
    wx.navigateBack({
      delta: 1
    })
  }
})

