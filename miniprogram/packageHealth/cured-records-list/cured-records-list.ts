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
  createdAt?: any
  isDeleted?: boolean
  operatorName?: string
  formattedCuredCost?: string
  formattedMedicationCost?: string
  formattedCostPerAnimal?: string
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
    },
    
    // 详情弹窗
    showDetailDialog: false,
    selectedRecord: null as CuredRecord | null
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

      // ✅ 优化查询：添加时间范围避免全量查询警告
      // 查询最近1年的治疗记录（超过1年的记录一般不需要展示）
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      const result = await db.collection('health_treatment_records')
        .where({
          createdAt: _.gte(oneYearAgo)  // 只查询最近1年的记录
        })
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get()

      // 查询到治疗记录

      // 调试：查看所有记录的outcome结构
      if (result.data.length > 0) {
        // 检查记录结构
      }

      // 2. 在前端过滤：排除已删除 + 筛选有治愈数的记录
      const allRecords = result.data as CuredRecord[]
      const curedRecords = allRecords.filter(record => {
        // 过滤已删除的记录
        if (record.isDeleted === true) {
          return false
        }
        
        // 筛选有治愈数的记录
        const hasCured = (record.outcome?.curedCount || 0) > 0
        return hasCured
      })

      // 过滤完成
      
      // 如果没有治愈记录，提示用户
      if (curedRecords.length === 0 && result.data.length > 0) {
        // 暂无治愈记录
      }

      // 3. 按完成时间排序（如果有的话），否则按创建时间
      curedRecords.sort((a, b) => {
        const timeA = a.completedAt || a.createdAt || new Date(0)
        const timeB = b.completedAt || b.createdAt || new Date(0)
        return new Date(timeB).getTime() - new Date(timeA).getTime()
      })

      // 4. 计算统计数据并格式化
      let totalCured = 0
      let totalCost = 0
      let totalMedicationCost = 0

      // ✅ 预处理数据，格式化成本字段
      const records = curedRecords.map(record => {
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
      // 加载失败，已显示错误提示
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
    const record = this.data.records.find(r => r._id === id)
    if (record) {
      this.setData({
        selectedRecord: record,
        showDetailDialog: true
      })
    }
  },

  // 关闭详情弹窗
  closeDetailDialog() {
    this.setData({
      showDetailDialog: false
    })
  },

  // 阻止遮罩层滚动穿透
  preventTouchMove() {
    return false
  },

  // 返回
  goBack() {
    wx.navigateBack({
      delta: 1
    })
  }
})

