// exit-form.ts - 出栏记录表单页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 表单数据接口
interface ExitFormData {
  batchId: string;          // 批次ID
  exitDate: string;         // 出栏日期
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
      customer: '',
      quantity: '',
      avgWeight: '',
      unitPrice: '',
      remarks: ''
    } as ExitFormData,
    
    // 最大日期（今天）
    maxDate: '',
    
    // 批次选择器相关
    showBatchPicker: false,
    availableBatches: [] as unknown[],  // 可选择的入栏批次
    batchOptions: [] as string[],   // 批次选择器选项（显示用）
    batchActionItems: [] as unknown[], // ActionSheet组件数据格式
    
    // 计算结果
    totalWeight: '0.00',      // 总重量
    totalRevenue: '0.00',     // 总收入
    
    // 提交状态
    submitting: false,
    
    // 验证错误
    validationErrors: [] as string[],

    // AI盘点相关数据
    fromAI: false,            // 是否来自AI盘点
    aiData: {                 // AI盘点数据
      count: 0,
      confidence: 0,
      imageUrl: '',
      abnormalCount: 0,
      suggestions: [] as string[]
    },
    showAIInfo: false,        // 是否显示AI信息卡片

    // 选择批次后的可用数量上限（用于前端输入约束）
    selectedBatchAvailable: 0
  },

  onLoad(options: unknown) {
    // 初始化表单
    this.initializeForm()
    
    // 处理来自AI盘点的参数
    if (options && options.fromAI) {
      this.handleAIParams(options)
    }
    
    // 加载可选择的批次
    this.loadAvailableBatches()
  },

  // 处理来自AI盘点的参数
  handleAIParams(options: unknown) {
    try {
      const aiData = {
        count: parseInt(options.aiCount) || 0,
        confidence: parseInt(options.confidence) || 0,
        imageUrl: options.imageUrl || '',
        abnormalCount: parseInt(options.abnormalCount) || 0,
        suggestions: options.suggestions ? JSON.parse(decodeURIComponent(options.suggestions)) : []
      }
      
      this.setData({
        fromAI: true,
        aiData: aiData,
        showAIInfo: true,
        'formData.quantity': aiData.count.toString()
      })
      
      // 如果有异常提醒，添加到备注中
      if (aiData.abnormalCount > 0) {
        const abnormalNote = `AI检测提醒：发现${aiData.abnormalCount}只疑似异常个体，请人工核查。`
        this.setData({
          'formData.remarks': abnormalNote
        })
      }
      
      // 显示AI盘点信息
      wx.showToast({
        title: `AI识别到${aiData.count}只，置信度${aiData.confidence}%`,
        icon: 'none',
        duration: 3000
      })
      
    } catch (error) {
      // 已移除调试日志
      wx.showToast({
        title: '处理AI数据失败',
        icon: 'none'
      })
    }
  },

  // 初始化表单
  initializeForm() {
    const today = new Date()
    const dateString = this.formatDate(today)
    
    this.setData({
      'formData.exitDate': dateString,
      maxDate: dateString
    })
  },

  // 加载可选择的入栏批次
  async loadAvailableBatches() {
    try {
      // 从云函数获取已入栏且有剩余可出栏数量的批次（真实剩余量）
      const batches = await this.getEntryBatches()
      
      const batchOptions = batches.map((batch: unknown) => 
        `${batch.batchId} (${batch.breed} - 可出栏: ${batch.availableQuantity}羽)`
      )
      
      // ActionSheet组件需要的数据格式
      const batchActionItems = batches.map((batch: unknown, index: number) => ({
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

  // 从云函数获取真实剩余量的入栏批次数据
  async getEntryBatches(): Promise<any[]> {
    try {
      // 调用出栏云函数，获取按批次聚合后的真实可用数量
      const result = await wx.cloud.callFunction({
        name: 'production-exit',
        data: {
          action: 'available_batches'
        }
      })
      
      if (result.result && result.result.success) {
        const availableBatches = result.result.data || []
        
        // 转换为页面使用的数据结构
        const batches = availableBatches.map((item: unknown) => ({
          batchId: item.batchNumber,
          batchNumber: item.batchNumber,
          breed: item.breed || '未知品种',
          entryDate: item.entryDate || '未知日期',
          quantity: String(item.totalQuantity || 0),
          supplier: '未知供应商',
          availableQuantity: String(item.availableQuantity || 0)
        }))
        
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
          content: '出栏管理云函数尚未部署，无法获取批次数据。',
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

  // 确认选择日期（原生 picker 直接返回格式化的日期字符串）
  onDateConfirm(e: CustomEvent) {
    const dateString = e.detail.value  // 原生 picker 返回 "YYYY-MM-DD" 格式
    
    this.setData({
      'formData.exitDate': dateString
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
        selectedBatchAvailable: Number(selectedBatch.availableQuantity) || 0
      })
    }
  },

  // 表单字段变化
  onFieldChange(e: CustomEvent) {
    const { value } = e.detail
    const { field } = e.currentTarget.dataset
    
    // 针对数量字段，进行不超过可用数量的前端约束（不弹窗，直接限制）
    if (field === 'quantity') {
      const max = Number(this.data.selectedBatchAvailable) || 0
      let next = value
      const num = parseInt(value)
      if (!isNaN(num) && max > 0 && num > max) {
        next = String(max)
      }
      this.setData({
        [`formData.${field}`]: next
      })
    } else {
      this.setData({
        [`formData.${field}`]: value
      })
    }

    // 当输入平均重量时，自动计算总重量
    if (field === 'avgWeight') {
      this.calculateTotalWeightFromAvg()
    }
    // 当输入数量时，根据现有数据计算
    else if (field === 'quantity') {
      if (this.data.formData.avgWeight) {
        this.calculateTotalWeightFromAvg()
      } else if (this.data.totalWeight && this.data.totalWeight !== '0.00') {
        this.calculateAvgWeightFromTotal()
      }
    }
    
    // 重新计算总收入
    if (field === 'quantity' || field === 'avgWeight' || field === 'unitPrice') {
      this.calculateRevenue()
    }
  },

  // 总重量输入变化
  onTotalWeightChange(e: CustomEvent) {
    const { value } = e.detail
    this.setData({
      totalWeight: value
    })
    
    // 根据总重量自动计算平均重量
    this.calculateAvgWeightFromTotal()
    // 重新计算总收入
    this.calculateRevenue()
  },

  // 根据平均重量计算总重量
  calculateTotalWeightFromAvg() {
    const { quantity, avgWeight } = this.data.formData
    const quantityNum = parseFloat(quantity) || 0
    const avgWeightNum = parseFloat(avgWeight) || 0
    
    if (quantityNum > 0 && avgWeightNum > 0) {
      const totalWeight = (quantityNum * avgWeightNum).toFixed(2)
      this.setData({
        totalWeight
      })
    }
  },

  // 根据总重量计算平均重量
  calculateAvgWeightFromTotal() {
    const { quantity } = this.data.formData
    const totalWeight = this.data.totalWeight
    const quantityNum = parseFloat(quantity) || 0
    const totalWeightNum = parseFloat(totalWeight) || 0
    
    if (quantityNum > 0 && totalWeightNum > 0) {
      const avgWeight = (totalWeightNum / quantityNum).toFixed(2)
      this.setData({
        'formData.avgWeight': avgWeight
      })
    }
  },

  // 计算总收入
  calculateRevenue() {
    const { unitPrice } = this.data.formData
    const totalWeight = this.data.totalWeight
    const totalWeightNum = parseFloat(totalWeight) || 0
    const priceNum = parseFloat(unitPrice) || 0
    
    // 总收入 = 总重量 × 单价
    const totalRevenue = (totalWeightNum * priceNum).toFixed(2)
    
    this.setData({
      totalRevenue
    })
  },

  // 获取提交时使用的批次号
  getBatchNumberForSubmission(displayBatchId: string): string {
    // 从可用批次列表中查找对应的批次号
    const batch = this.data.availableBatches.find((b: unknown) => b.batchId === displayBatchId)
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
    if (!formData.customer.trim()) {
      errors.push('请输入客户信息')
    }
    if (!formData.quantity.trim()) {
      errors.push('请输入出栏数量')
    }
    if (!formData.unitPrice.trim()) {
      errors.push('请输入单价')
    }

    // 验证平均重量和总重量至少要填一个
    const avgWeightNum = parseFloat(formData.avgWeight) || 0
    const totalWeightNum = parseFloat(this.data.totalWeight) || 0
    if (avgWeightNum <= 0 && totalWeightNum <= 0) {
      errors.push('请输入平均重量或总重量')
    }

    // 验证数值字段
    if (formData.quantity && (isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0)) {
      errors.push('出栏数量必须为正数')
    }
    if (formData.avgWeight && (isNaN(Number(formData.avgWeight)) || Number(formData.avgWeight) <= 0)) {
      errors.push('平均重量必须为正数')
    }
    if (this.data.totalWeight && (isNaN(Number(this.data.totalWeight)) || Number(this.data.totalWeight) <= 0)) {
      errors.push('总重量必须为正数')
    }
    if (formData.unitPrice && (isNaN(Number(formData.unitPrice)) || Number(formData.unitPrice) <= 0)) {
      errors.push('单价必须为正数')
    }

    // 额外校验：若选择了批次，出栏数量不得超过可用数量（静默限制已做，此处兜底）
    const max = Number(this.data.selectedBatchAvailable) || 0
    if (max > 0 && Number(formData.quantity) > max) {
      errors.push(`出栏数量不得超过${max}羽`)
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
            customer: submitData.customer,
            quantity: submitData.quantity,
            avgWeight: submitData.avgWeight || '',
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

      // 提交成功，快速返回上一页
      wx.showToast({
        title: '提交成功',
        icon: 'success',
        duration: 1500
      })

      // 延迟后自动返回上一页
      setTimeout(() => {
        wx.navigateBack({
          delta: 1
        })
      }, 500)

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
      path: '/packageProduction/exit-form/exit-form',
      imageUrl: '' // 可以设置分享图片
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
