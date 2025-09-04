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
  operator: string;         // 操作员
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
      operator: '',
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
      // 这里应该调用云函数或API获取已入栏的批次
      // 模拟获取已入栏批次数据
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
      
      console.log('可选择的入栏批次:', batches)
      console.log('批次ActionSheet数据:', batchActionItems)
      console.log('批次数据设置完成，batchActionItems长度:', batchActionItems.length)
    } catch (error) {
      console.error('加载入栏批次失败:', error)
      wx.showToast({
        title: '加载批次数据失败',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 模拟获取入栏批次数据
  async getEntryBatches(): Promise<any[]> {
    return new Promise((resolve) => {
      // 模拟API调用
      setTimeout(() => {
        const mockBatches = [
          {
            batchId: 'QY-20241201',
            breed: '扬州鹅',
            entryDate: '2024-12-01',
            quantity: '500',
            supplier: '江苏畜禽养殖场',
            availableQuantity: '480'  // 可出栏数量
          },
          {
            batchId: 'QY-20241128',
            breed: '皖西白鹅',
            entryDate: '2024-11-28',
            quantity: '300',
            supplier: '安徽白鹅繁育中心',
            availableQuantity: '285'
          },
          {
            batchId: 'QY-20241125',
            breed: '四川白鹅',
            entryDate: '2024-11-25',
            quantity: '200',
            supplier: '四川鹅苗供应站',
            availableQuantity: '195'
          }
        ]
        console.log('模拟批次数据加载完成:', mockBatches)
        resolve(mockBatches)
      }, 100)
    })
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

    console.log('选择日期:', dateString)
  },

  // 显示批次选择器
  showBatchPicker() {
    console.log('点击显示批次选择器')
    console.log('当前batchOptions:', this.data.batchOptions)
    console.log('当前batchOptions长度:', this.data.batchOptions.length)
    
    if (this.data.batchOptions.length === 0) {
      console.log('没有可选择的批次数据')
      wx.showToast({
        title: '暂无可选择的入栏批次',
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    console.log('准备显示原生批次ActionSheet')
    wx.showActionSheet({
      itemList: this.data.batchOptions,
      success: (res) => {
        console.log('选择了批次，索引:', res.tapIndex)
        this.onBatchSelected(res.tapIndex)
      },
      fail: (res) => {
        console.log('取消选择批次')
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
      
      console.log('选择批次:', selectedBatch)
      
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

    console.log(`字段 ${field} 更新为:`, value)
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
    if (!formData.operator.trim()) {
      errors.push('请输入操作员姓名')
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

      console.log('提交出栏记录数据:', submitData)

      // 这里应该调用云函数或API提交数据
      // 模拟API调用
      await this.submitToDatabase(submitData)

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
      console.error('提交出栏记录失败:', error)
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

  // 模拟数据库提交
  async submitToDatabase(data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      // 模拟网络请求延迟
      setTimeout(() => {
        // 模拟90%成功率
        if (Math.random() > 0.1) {
          resolve()
        } else {
          reject(new Error('网络错误'))
        }
      }, 1500)
    })
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
              operator: '',
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
