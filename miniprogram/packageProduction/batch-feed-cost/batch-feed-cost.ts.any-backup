// batch-feed-cost.ts - 批次饲养成本统计页面
import { createPageWithNavbar } from '../../utils/navigation'

interface BatchFeedCostData {
  // 批次信息
  batchInfo: {
    batchId: string
    batchNumber: string
    breed: string
    entryDate: string
    currentStock: number
    initialQuantity: number
    dayAge: number
  } | null
  
  // 成本概览
  costSummary: {
    totalFeedCost: number
    totalFeedQuantity: number
    avgCostPerBird: number
    feedingCount: number
    avgCostPerFeeding: number
  }
  
  // 按饲料类型统计
  costByMaterial: Array<{
    materialName: string
    materialId: string
    totalQuantity: number
    totalCost: number
    percentage: number
    usageCount: number
    unit: string
  }>
  
  // 投喂记录列表
  feedRecords: any[]
}

const pageConfig = {
  data: {
    // 批次选择
    selectedBatchId: '',
    selectedBatchNumber: '请选择批次',
    availableBatches: [] as any[],
    showBatchDropdown: false,
    
    // 成本数据
    batchInfo: null,
    costSummary: {
      totalFeedCost: 0,
      totalFeedQuantity: 0,
      avgCostPerBird: 0,
      feedingCount: 0,
      avgCostPerFeeding: 0
    },
    costByMaterial: [],
    feedRecords: [],
    
    // 页面状态
    loading: false,
    hasData: false
  } as any,

  onLoad(options: any) {
    // 从参数获取批次ID
    const batchId = options?.batchId || ''
    if (batchId) {
      this.setData({
        selectedBatchId: batchId
      })
    }
    
    // 加载可选批次
    this.loadAvailableBatches()
  },

  // 加载可选批次
  async loadAvailableBatches() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'getActiveBatches'
        }
      })
      
      if (result.result && result.result.success) {
        const batches = result.result.data.batches || []
        this.setData({
          availableBatches: batches
        })
        
        // 如果已有选择的批次ID，加载数据
        if (this.data.selectedBatchId) {
          const batch = batches.find((b: any) => b._id === this.data.selectedBatchId)
          if (batch) {
            this.setData({
              selectedBatchNumber: batch.batchNumber
            })
          }
          await this.loadBatchFeedCost()
        } else if (batches.length > 0) {
          // 默认选择第一个批次
          this.setData({
            selectedBatchId: batches[0]._id,
            selectedBatchNumber: batches[0].batchNumber
          })
          await this.loadBatchFeedCost()
        }
      }
    } catch (error) {
      wx.showToast({
        title: '加载批次失败',
        icon: 'none'
      })
    }
  },

  // 显示批次选择器
  showBatchPicker() {
    if (this.data.availableBatches.length === 0) {
      wx.showToast({
        title: '暂无活跃批次',
        icon: 'none'
      })
      return
    }
    
    const batchOptions = this.data.availableBatches.map((batch: any) => 
      `${batch.batchNumber} (${batch.breed})`
    )
    
    wx.showActionSheet({
      itemList: batchOptions,
      success: (res) => {
        this.onBatchSelected(res.tapIndex)
      }
    })
  },

  // 选择批次
  async onBatchSelected(index: number) {
    const selectedBatch = this.data.availableBatches[index]
    
    if (selectedBatch) {
      this.setData({
        selectedBatchId: selectedBatch._id,
        selectedBatchNumber: selectedBatch.batchNumber
      })
      
      // 加载批次成本数据
      await this.loadBatchFeedCost()
    }
  },

  // 加载批次饲养成本数据
  async loadBatchFeedCost() {
    const { selectedBatchId } = this.data
    
    if (!selectedBatchId) {
      return
    }
    
    this.setData({ loading: true })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'get_batch_feed_cost',
          batchId: selectedBatchId
        }
      })
      
      if (result.result && result.result.success) {
        const data = result.result.data
        
        this.setData({
          batchInfo: data.batchInfo,
          costSummary: data.costSummary,
          costByMaterial: data.costByMaterial,
          feedRecords: data.feedRecords,
          hasData: data.feedRecords.length > 0
        })
      } else {
        throw new Error(result.result?.error || '加载失败')
      }
    } catch (error: any) {
      wx.showToast({
        title: error.message || '加载数据失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 刷新数据
  onRefresh() {
    this.loadBatchFeedCost()
  },

  // 查看饲料详情
  viewMaterialDetail(e: any) {
    const { material } = e.currentTarget.dataset
    
    const detailText = `饲料名称：${material.materialName}\n` +
      `使用次数：${material.usageCount}次\n` +
      `总用量：${material.totalQuantity}${material.unit}\n` +
      `总成本：¥${material.totalCost.toFixed(2)}\n` +
      `占比：${material.percentage}%`
    
    wx.showModal({
      title: '饲料使用详情',
      content: detailText,
      showCancel: false
    })
  },

  // 查看投喂记录详情
  viewRecordDetail(e: any) {
    const { record } = e.currentTarget.dataset
    
    const detailText = `投喂日期：${record.recordDate}\n` +
      `饲料：${record.materialName}\n` +
      `数量：${record.quantity}${record.unit}\n` +
      `单价：¥${record.unitPrice}\n` +
      `总成本：¥${record.totalCost.toFixed(2)}\n` +
      `当时存栏：${record.stockAtTime}只\n` +
      `单只成本：¥${record.costPerBird}\n` +
      `日龄：${record.dayAge}天\n` +
      `操作员：${record.operator}` +
      (record.notes ? `\n备注：${record.notes}` : '')
    
    wx.showModal({
      title: '投喂记录详情',
      content: detailText,
      showCancel: false
    })
  },

  // 添加投喂记录
  addFeedRecord() {
    wx.navigateTo({
      url: `/packageProduction/feed-usage-form/feed-usage-form?batchId=${this.data.selectedBatchId}`
    })
  },

  // 导出数据（预留）
  exportData() {
    wx.showToast({
      title: '导出功能开发中',
      icon: 'none'
    })
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: `${this.data.selectedBatchNumber} 饲养成本`,
      path: `/packageProduction/batch-feed-cost/batch-feed-cost?batchId=${this.data.selectedBatchId}`
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))

