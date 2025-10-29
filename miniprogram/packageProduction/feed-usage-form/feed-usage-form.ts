// feed-usage-form.ts - 饲料投喂记录表单页面
import { createPageWithNavbar } from '../../utils/navigation'

// 表单数据接口
interface FeedUsageFormData {
  recordDate: string        // 投喂日期
  batchId: string          // 批次ID
  batchNumber: string      // 批次号（显示用）
  materialId: string       // 饲料ID
  materialName: string     // 饲料名称（显示用）
  quantity: string         // 投喂数量
  unit: string            // 单位
  notes: string           // 备注
}

const pageConfig = {
  data: {
    // 表单数据
    formData: {
      recordDate: '',
      batchId: '',
      batchNumber: '',
      materialId: '',
      materialName: '',
      quantity: '',
      unit: '',
      notes: ''
    } as FeedUsageFormData,
    
    // 日期选择器相关
    showDate: false,
    dateValue: '',
    
    // 批次选择相关
    availableBatches: [] as any[],
    showBatchPicker: false,
    
    // 饲料选择相关
    availableFeeds: [] as any[],
    showFeedPicker: false,
    
    // 存栏信息
    currentStock: 0,
    stockInfo: null as any,
    
    // 成本预估
    unitPrice: 0,
    estimatedCost: '0.00',
    costPerBird: '0.00',
    
    // 提交状态
    submitting: false,
    loading: false
  },

  onLoad() {
    // 初始化表单
    this.initializeForm()
    // 加载可选批次
    this.loadAvailableBatches()
    // 加载饲料列表
    this.loadAvailableFeeds()
  },

  // 初始化表单
  initializeForm() {
    const today = new Date()
    const dateString = this.formatDate(today)
    
    this.setData({
      'formData.recordDate': dateString,
      dateValue: today.getTime()
    })
  },

  // 格式化日期
  formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 加载可选批次（活跃批次）
  async loadAvailableBatches() {
    try {
      wx.showLoading({ title: '加载批次...' })
      
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'getActiveBatches'
        }
      })
      
      if (result.result && result.result.success) {
        const batches = result.result.data || []
        this.setData({
          availableBatches: batches
        })
      } else {
        console.error('加载批次失败:', result.result)
        wx.showToast({
          title: result.result?.message || '加载批次失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载批次异常:', error)
      wx.showToast({
        title: '加载批次失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载饲料列表
  async loadAvailableFeeds() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'list_materials',
          category: '饲料',
          isActive: true
        }
      })
      
      if (result.result && result.result.success) {
        const feeds = result.result.data.materials || []
        this.setData({
          availableFeeds: feeds
        })
      }
    } catch (error) {
      wx.showToast({
        title: '加载饲料失败',
        icon: 'none'
      })
    }
  },

  // 显示日期选择器
  showDatePicker() {
    this.setData({
      showDate: true
    })
  },

  // 隐藏日期选择器
  hideDatePicker() {
    this.setData({
      showDate: false
    })
  },

  // 日期选择变化
  onDateChange(e: any) {
    const { value } = e.detail
    this.setData({
      dateValue: value
    })
  },

  // 确认选择日期
  onDateConfirm(e: any) {
    const { value } = e.detail
    const date = new Date(value)
    const dateString = this.formatDate(date)
    
    this.setData({
      'formData.recordDate': dateString,
      dateValue: value,
      showDate: false
    })
    
    // 如果已选择批次，重新计算存栏数
    if (this.data.formData.batchId) {
      this.updateStockInfo()
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
    
    const batchOptions = this.data.availableBatches.map(batch => 
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
        'formData.batchId': selectedBatch._id,
        'formData.batchNumber': selectedBatch.batchNumber
      })
      
      // 获取当前存栏数
      await this.updateStockInfo()
    }
  },

  // 更新存栏信息
  async updateStockInfo() {
    const { batchId, recordDate } = this.data.formData
    
    if (!batchId || !recordDate) {
      return
    }
    
    try {
      wx.showLoading({ title: '计算存栏...' })
      
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'get_current_stock_count',
          batchId: batchId,
          recordDate: recordDate
        }
      })
      
      if (result.result && result.result.success) {
        const stockInfo = result.result.data
        this.setData({
          currentStock: stockInfo.currentStock,
          stockInfo: stockInfo
        })
        
        // 重新计算成本
        this.calculateCost()
      }
    } catch (error) {
      wx.showToast({
        title: '获取存栏数失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 显示饲料选择器
  showFeedPicker() {
    if (this.data.availableFeeds.length === 0) {
      wx.showToast({
        title: '暂无饲料库存',
        icon: 'none'
      })
      return
    }
    
    const feedOptions = this.data.availableFeeds.map(feed => 
      `${feed.name} (库存: ${feed.currentStock}${feed.unit})`
    )
    
    wx.showActionSheet({
      itemList: feedOptions,
      success: (res) => {
        this.onFeedSelected(res.tapIndex)
      }
    })
  },

  // 选择饲料
  onFeedSelected(index: number) {
    const selectedFeed = this.data.availableFeeds[index]
    
    if (selectedFeed) {
      this.setData({
        'formData.materialId': selectedFeed._id,
        'formData.materialName': selectedFeed.name,
        'formData.unit': selectedFeed.unit,
        unitPrice: selectedFeed.unitPrice || 0
      })
      
      // 重新计算成本
      this.calculateCost()
    }
  },

  // 表单字段变化
  onFieldChange(e: any) {
    const { value } = e.detail
    const { field } = e.currentTarget.dataset
    
    this.setData({
      [`formData.${field}`]: value
    })
    
    // 如果是数量变化，重新计算成本
    if (field === 'quantity') {
      this.calculateCost()
    }
  },

  // 计算成本
  calculateCost() {
    const { quantity } = this.data.formData
    const { unitPrice, currentStock } = this.data
    
    const quantityNum = parseFloat(quantity) || 0
    const totalCost = quantityNum * unitPrice
    const costPerBird = currentStock > 0 ? totalCost / currentStock : 0
    
    this.setData({
      estimatedCost: totalCost.toFixed(2),
      costPerBird: costPerBird.toFixed(4)
    })
  },

  // 表单验证
  validateForm(): { isValid: boolean; errors: string[] } {
    const { formData } = this.data
    const errors: string[] = []

    // 检查必填字段
    if (!formData.recordDate) {
      errors.push('请选择投喂日期')
    }
    if (!formData.batchId) {
      errors.push('请选择批次')
    }
    if (!formData.materialId) {
      errors.push('请选择饲料')
    }
    if (!formData.quantity.trim()) {
      errors.push('请输入投喂数量')
    }

    // 验证数值字段
    if (formData.quantity && (isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0)) {
      errors.push('投喂数量必须为正数')
    }
    
    // 检查存栏数
    if (this.data.currentStock <= 0) {
      errors.push('当前批次存栏数为0，无法记录投喂')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  },

  // 提交表单
  async onSubmit() {
    // 验证表单
    const validation = this.validateForm()
    if (!validation.isValid) {
      wx.showToast({
        title: validation.errors[0],
        icon: 'none',
        duration: 2000
      })
      return
    }

    // 设置提交状态
    this.setData({
      submitting: true
    })

    try {
      // 准备提交数据
      const app = getApp()
      const currentUserName = app.globalData?.userInfo?.nickname || app.globalData?.userInfo?.nickName || '未知'
      
      const feedData = {
        batchId: this.data.formData.batchId,
        materialId: this.data.formData.materialId,
        quantity: parseFloat(this.data.formData.quantity),
        unitPrice: this.data.unitPrice,
        recordDate: this.data.formData.recordDate,
        notes: this.data.formData.notes,
        operator: currentUserName,
        recordType: 'manual'
      }

      // 调用云函数提交数据
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'record_feed_usage',
          feedData: feedData
        }
      })

      if (result.result && result.result.success) {
        // 提交成功
        wx.showToast({
          title: '饲料投喂记录成功',
          icon: 'success',
          duration: 2000
        })

        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack({
            delta: 1
          })
        }, 2000)
      } else {
        throw new Error(result.result?.error || '提交失败')
      }

    } catch (error: any) {
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({
        submitting: false
      })
    }
  },

  // 重置表单
  onReset() {
    wx.showModal({
      title: '确认重置',
      content: '确定要重置表单吗？所有已填写的数据将被清空。',
      success: (res) => {
        if (res.confirm) {
          // 重置表单数据（保留日期）
          const currentDate = this.data.formData.recordDate
          
          this.setData({
            formData: {
              recordDate: currentDate,
              batchId: '',
              batchNumber: '',
              materialId: '',
              materialName: '',
              quantity: '',
              unit: '',
              notes: ''
            },
            currentStock: 0,
            stockInfo: null,
            unitPrice: 0,
            estimatedCost: '0.00',
            costPerBird: '0.00'
          })

          wx.showToast({
            title: '表单已重置',
            icon: 'success',
            duration: 1500
          })
        }
      }
    })
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '饲料投喂记录',
      path: '/packageProduction/feed-usage-form/feed-usage-form'
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))

