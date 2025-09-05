// exit-form.ts - 出栏记录表单页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 表单数据接口
interface ExitFormData {
  batchId: string;          // 批次ID
  exitDate: string;         // 出栏日期
  type: string;             // 鹅的类型
  customer: string;         // 客户信息
  quantity: string;         // 出栏数量
  avgWeight: string;        // 平均重量
  unitPrice: string;        // 单价（按重量）
  remarks: string;          // 备注
}

const pageConfig = {
  data: {
    // 表单数据
    formData: {
      batchId: '',
      exitDate: '',
      type: '',
      customer: '',
      quantity: '',
      avgWeight: '',
      unitPrice: '',
      remarks: ''
    } as ExitFormData,
    
    // 日期选择器相关
    showDate: false,
    dateValue: '',
    
    // 批次选择器相关
    showBatchPicker: false,
    availableBatches: [] as any[],  // 可选择的入栏批次
    batchOptions: [] as string[],   // 批次选择器选项（显示用）
    batchActionItems: [] as any[], // ActionSheet组件数据格式
    
    // 计算结果
    totalWeight: '0.00',      // 总重量
    totalRevenue: '0.00',     // 总收入
    
    // 提交状态
    submitting: false,
    
    // 验证错误
    validationErrors: [] as string[]
  },

  onLoad() {
    // 初始化表单
    this.initializeForm()
    // 加载可选择的批次
    this.loadAvailableBatches()
  },

  // 初始化表单
  initializeForm() {
    const today = new Date()
    const dateString = this.formatDate(today)
    
    this.setData({
      'formData.exitDate': dateString,
      dateValue: today.getTime()
    })
  },

  // 加载可选择的入栏批次
  async loadAvailableBatches() {
    try {
      // 从云函数获取已入栏的批次数据
      const batches = await this.getEntryBatches()
      
      const batchOptions = batches.map((batch: any) => 
        `${batch.batchId} (${batch.breed} - ${batch.quantity}羽)`
      )
      
      // ActionSheet组件需要的数据格式
      const batchActionItems = batches.map((batch: any, index: number) => ({
        label: `${batch.batchId} (${batch.breed} - 可出栏: ${batch.availableQuantity}羽)`,
        value: index,
        disabled: batch.availableQuantity <= 0
      }))
      
      this.setData({
        availableBatches: batches,
        batchOptions: batchOptions,
        batchActionItems: batchActionItems
      })
    } catch (error) {
      wx.showToast({
        title: '加载批次数据失败',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 从云函数获取真实的入栏批次数据
  async getEntryBatches(): Promise<any[]> {
    try {
      // 调用入栏云函数获取所有入栏记录
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'list',
          page: 1,
          pageSize: 50 // 获取更多记录以供选择
        }
      })
      
      if (result.result && result.result.success) {
        const entryRecords = result.result.data.records || []
        
        // 转换为批次选择格式，并计算可出栏数量
        const batches = entryRecords.map((record: any, index: number) => {
          // 这里应该根据实际出栏记录计算剩余可出栏数量
          // 暂时假设可出栏数量 = 入栏数量 - 10（模拟已出栏的数量）
          const entryQuantity = parseInt(record.quantity) || 0
          const assumedExitedQuantity = Math.min(10, Math.floor(entryQuantity * 0.1)) // 假设已出栏10%
          const availableQuantity = entryQuantity - assumedExitedQuantity
          
          // 优先使用 batchNumber，如果没有则根据品种和日期生成一个友好的标识
          let displayBatchId = record.batchNumber  // 修复：使用 batchNumber 字段
          if (!displayBatchId) {
            const entryDate = record.entryDate || record.createTime?.split('T')[0] || ''
            const breed = record.breed || '未知品种'
            if (entryDate) {
              // 生成格式：品种-日期格式（如：狮头鹅-20250904）
              const dateStr = entryDate.replace(/-/g, '')
              displayBatchId = `${breed}-${dateStr}`
            } else {
              // 如果连日期都没有，使用品种+序号
              displayBatchId = `${breed}-${index + 1}`
            }
          }
          
          return {
            batchId: displayBatchId,  // 前端显示用的ID保持不变
            batchNumber: record.batchNumber || displayBatchId,  // 添加原始批次号字段
            originalId: record._id, // 保留原始ID用于后续操作
            breed: record.breed || '未知品种',
            entryDate: record.entryDate || record.createTime?.split('T')[0] || '未知日期',
            quantity: record.quantity || '0',
            supplier: record.supplier || '未知供应商',
            availableQuantity: availableQuantity.toString() // 可出栏数量
          }
        })
        
        return batches
        
      } else {
        // 如果云函数调用失败，返回空数组
        return []
      }
      
    } catch (error) {
      
      // 如果是云函数不存在的错误，给出友好提示
      if (error.errMsg && error.errMsg.includes('function not found')) {
        wx.showModal({
          title: '系统提示',
          content: '入栏管理云函数尚未部署，无法获取批次数据。请先添加入栏记录。',
          showCancel: false
        })
      }
      
      // 出错时返回空数组
      return []
    }
  },

  // 格式化日期
  formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
      'formData.exitDate': dateString,
      dateValue: value,
      showDate: false
    })
  },

  // 显示批次选择器
  showBatchPicker() {
    if (this.data.batchOptions.length === 0) {
      wx.showToast({
        title: '暂无可选择的入栏批次',
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    wx.showActionSheet({
      itemList: this.data.batchOptions,
      success: (res) => {
        this.onBatchSelected(res.tapIndex)
      }
    })
  },

  // 隐藏批次选择器
  hideBatchPicker() {
    this.setData({
      showBatchPicker: false
    })
  },

  // 选择批次
  onBatchSelected(selectedIndex: number) {
    const selectedBatch = this.data.availableBatches[selectedIndex]
    
    if (selectedBatch) {
      this.setData({
        'formData.batchId': selectedBatch.batchId,
        'formData.type': selectedBatch.breed, // 自动填充鹅的类型
      })
      
      // 提示可出栏数量
      wx.showToast({
        title: `可出栏数量: ${selectedBatch.availableQuantity}羽`,
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 表单字段变化
  onFieldChange(e: any) {
    const { value } = e.detail
    const { field } = e.currentTarget.dataset
    
    this.setData({
      [`formData.${field}`]: value
    })

    // 如果是数量、重量或单价变化，重新计算总重量和总收入
    if (field === 'quantity' || field === 'avgWeight' || field === 'unitPrice') {
      this.calculateTotals()
    }
  },

  // 计算总重量和总收入
  calculateTotals() {
    const { quantity, avgWeight, unitPrice } = this.data.formData
    const quantityNum = parseFloat(quantity) || 0
    const weightNum = parseFloat(avgWeight) || 0
    const priceNum = parseFloat(unitPrice) || 0
    
    // 总重量 = 数量 × 平均重量
    const totalWeight = (quantityNum * weightNum).toFixed(2)
    
    // 总收入 = 总重量 × 单价
    const totalRevenue = (parseFloat(totalWeight) * priceNum).toFixed(2)
    
    this.setData({
      totalWeight,
      totalRevenue
    })
  },

  // 获取提交时使用的批次号
  getBatchNumberForSubmission(displayBatchId: string): string {
    // 从可用批次列表中查找对应的批次号
    const batch = this.data.availableBatches.find((b: any) => b.batchId === displayBatchId)
    if (batch && batch.batchNumber) {
      return batch.batchNumber
    }
    
    // 如果没有找到，直接使用显示ID（向后兼容）
    return displayBatchId
  },

  // 表单验证
  validateForm(): { isValid: boolean; errors: string[] } {
    const { formData } = this.data
    const errors: string[] = []

    // 检查必填字段
    if (!formData.batchId) {
      errors.push('请选择出栏批次')
    }
    if (!formData.exitDate) {
      errors.push('请选择出栏日期')
    }
    if (!formData.type.trim()) {
      errors.push('请输入鹅的类型')
    }
    if (!formData.customer.trim()) {
      errors.push('请输入客户信息')
    }
    if (!formData.quantity.trim()) {
      errors.push('请输入出栏数量')
    }
    if (!formData.avgWeight.trim()) {
      errors.push('请输入平均重量')
    }
    if (!formData.unitPrice.trim()) {
      errors.push('请输入单价')
    }

    // 验证数值字段
    if (formData.quantity && (isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0)) {
      errors.push('出栏数量必须为正数')
    }
    if (formData.avgWeight && (isNaN(Number(formData.avgWeight)) || Number(formData.avgWeight) <= 0)) {
      errors.push('平均重量必须为正数')
    }
    if (formData.unitPrice && (isNaN(Number(formData.unitPrice)) || Number(formData.unitPrice) <= 0)) {
      errors.push('单价必须为正数')
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
      const submitData = {
        ...this.data.formData,
        totalWeight: this.data.totalWeight,
        totalRevenue: this.data.totalRevenue,
        createTime: new Date().toISOString(),
        status: '已交付'
      }

      // 调用出栏云函数提交数据
      const result = await wx.cloud.callFunction({
        name: 'production-exit',
        data: {
          action: 'create',
          recordData: {
            batchNumber: this.getBatchNumberForSubmission(submitData.batchId), // 修复：获取正确的批次号
            exitDate: submitData.exitDate,
            type: submitData.type,
            customer: submitData.customer,
            quantity: submitData.quantity,
            avgWeight: submitData.avgWeight,
            unitPrice: submitData.unitPrice,
            notes: submitData.remarks,
            totalWeight: submitData.totalWeight,
            totalRevenue: submitData.totalRevenue,
            status: submitData.status
          }
        }
      })

      if (!result.result.success) {
        throw new Error(result.result.message || '提交失败')
      }

      // 提交成功
      wx.showToast({
        title: '出栏记录提交成功',
        icon: 'success',
        duration: 2000
      })

      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack({
          delta: 1
        })
      }, 2000)

    } catch (error) {
      wx.showToast({
        title: '提交失败，请重试',
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
          // 重置表单数据（保留日期和批次ID）
          const currentDate = this.data.formData.exitDate
          const currentBatchId = this.data.formData.batchId
          
          this.setData({
            formData: {
              batchId: currentBatchId,
              exitDate: currentDate,
              type: '',
              customer: '',
              quantity: '',
              avgWeight: '',
              unitPrice: '',
              remarks: ''
            },
            totalWeight: '0.00',
            totalRevenue: '0.00'
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
      title: '出栏记录表单',
      path: '/pages/exit-form/exit-form',
      imageUrl: '' // 可以设置分享图片
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
