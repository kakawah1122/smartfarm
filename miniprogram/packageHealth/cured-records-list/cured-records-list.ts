// miniprogram/packageHealth/cured-records-list/cured-records-list.ts
// 治愈记录列表页面

import { logger } from '../../utils/logger'

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
    showDetailPopup: false,
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

      // 通过云函数查询治愈记录（云函数会返回包含用户昵称和批次号的完整数据）
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'get_cured_records_list'
        }
      })

      if (!result.result || !result.result.success) {
        const errorMsg = result.result?.error || result.errMsg || '查询失败'
        logger.error('云函数调用失败:', errorMsg)
        throw new Error(errorMsg)
      }

      // 获取治疗记录（已包含 operatorName 和 batchNumber）
      const curedRecords = result.result.data.records as CuredRecord[]

      // 按完成时间排序（如果有的话），否则按创建时间
      curedRecords.sort((a, b) => {
        const timeA = a.completedAt || a.createdAt || new Date(0)
        const timeB = b.completedAt || b.createdAt || new Date(0)
        return new Date(timeB).getTime() - new Date(timeA).getTime()
      })

      // 计算统计数据并格式化
      let totalCured = 0
      let totalCost = 0
      let totalMedicationCost = 0

      // 预处理数据，格式化成本字段
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
        records: records,
        stats: {
          totalCured,
          totalCost: parseFloat(totalCost.toFixed(2)),
          totalMedicationCost: parseFloat(totalMedicationCost.toFixed(2)),
          avgCostPerAnimal: parseFloat(avgCostPerAnimal.toFixed(2))
        },
        loading: false
      })

    } catch (error: any) {
      logger.error('云函数查询失败，尝试降级到客户端查询:', error)
      
      // 降级：使用客户端直接查询
      try {
        await this.loadRecordsFromClient()
      } catch (clientError: any) {
        logger.error('客户端查询也失败:', clientError)
        wx.showToast({
          title: clientError.message || '加载失败',
          icon: 'none'
        })
        this.setData({ loading: false })
      }
    }
  },

  // 降级方案：客户端直接查询
  async loadRecordsFromClient() {
    const db = wx.cloud.database()
    const _ = db.command

    // 查询最近1年的治疗记录
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const result = await db.collection('health_treatment_records')
      .where({
        createdAt: _.gte(oneYearAgo)
      })
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get()

    // 过滤有治愈数的记录
    const allRecords = result.data as CuredRecord[]
    const curedRecords = allRecords.filter(record => {
      if (record.isDeleted === true) return false
      return (record.outcome?.curedCount || 0) > 0
    })

    // 按时间排序
    curedRecords.sort((a, b) => {
      const timeA = a.completedAt || a.createdAt || new Date(0)
      const timeB = b.completedAt || b.createdAt || new Date(0)
      return new Date(timeB).getTime() - new Date(timeA).getTime()
    })

    // 计算统计数据
    let totalCured = 0
    let totalCost = 0
    let totalMedicationCost = 0

    const records = curedRecords.map(record => {
      totalCured += record.outcome.curedCount || 0
      totalCost += record.outcome.curedCost || 0
      totalMedicationCost += record.outcome.curedMedicationCost || 0

      return {
        ...record,
        formattedCuredCost: (record.outcome.curedCost || 0).toFixed(2),
        formattedMedicationCost: (record.outcome.curedMedicationCost || 0).toFixed(2),
        formattedCostPerAnimal: record.outcome.curedCount > 0 
          ? ((record.outcome.curedCost || 0) / record.outcome.curedCount).toFixed(2)
          : '0.00'
      }
    })

    // 批量获取批次号
    const enrichedRecords = await this.enrichRecordsWithBatchNumbers(records)

    const avgCostPerAnimal = totalCured > 0 ? (totalCost / totalCured) : 0

    this.setData({
      records: enrichedRecords,
      stats: {
        totalCured,
        totalCost: parseFloat(totalCost.toFixed(2)),
        totalMedicationCost: parseFloat(totalMedicationCost.toFixed(2)),
        avgCostPerAnimal: parseFloat(avgCostPerAnimal.toFixed(2))
      },
      loading: false
    })
  },

  // 批量获取批次号
  async enrichRecordsWithBatchNumbers(records: any[]): Promise<any[]> {
    if (!records || records.length === 0) return []
    
    try {
      const db = wx.cloud.database()
      const batchIds = [...new Set(records.map(r => r.batchId).filter(Boolean))]
      
      if (batchIds.length === 0) return records
      
      const batchMap = new Map()
      
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
      
      return records.map(record => ({
        ...record,
        batchNumber: batchMap.get(record.batchId) || record.batchId,
        operatorName: '当前用户'  // 客户端查询时使用占位符
      }))
    } catch (error) {
      logger.error('获取批次号失败:', error)
      return records.map(record => ({
        ...record,
        operatorName: '当前用户'
      }))
    }
  },

  // 点击记录查看详情
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

  // 关闭详情弹窗
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

  // 返回上一页
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
