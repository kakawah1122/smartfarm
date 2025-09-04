// purchase-form.ts - 采购入库表单页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 表单数据接口
interface PurchaseFormData {
  batchId: string;          // 批次ID
  purchaseDate: string;     // 采购日期
  materialName: string;     // 物料名称
  specification: string;    // 物料规格
  supplier: string;         // 供应商
  quantity: string;         // 采购数量
  unit: string;             // 计量单位
  unitPrice: string;        // 单价
  operator: string;         // 操作员
  remarks: string;          // 备注
}

const pageConfig = {
  data: {
    // 表单数据
    formData: {
      batchId: '',
      purchaseDate: '',
      materialName: '',
      specification: '',
      supplier: '',
      quantity: '',
      unit: '',
      unitPrice: '',
      operator: '',
      remarks: ''
    } as PurchaseFormData,
    
    // 日期选择器相关
    showDate: false,
    dateValue: '',
    
    // 计算总金额
    totalAmount: '0.00',
    
    // 提交状态
    submitting: false,
    
    // 验证错误
    validationErrors: [] as string[]
  },

  onLoad() {
    // 初始化表单
    this.initializeForm()
  },

  // 初始化表单
  initializeForm() {
    const today = new Date()
    const dateString = this.formatDate(today)
    const batchId = this.generateBatchId(dateString)
    
    this.setData({
      'formData.purchaseDate': dateString,
      'formData.batchId': batchId,
      dateValue: today.getTime()
    })
  },

  // 生成批次ID (CG-日期格式，CG表示采购)
  generateBatchId(dateString: string): string {
    const formattedDate = dateString.replace(/-/g, '')
    return `CG-${formattedDate}`
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
    const batchId = this.generateBatchId(dateString)
    
    this.setData({
      'formData.purchaseDate': dateString,
      'formData.batchId': batchId,
      dateValue: value,
      showDate: false
    })

    console.log('选择日期:', dateString, '生成批次ID:', batchId)
  },

  // 表单字段变化
  onFieldChange(e: any) {
    const { value } = e.detail
    const { field } = e.currentTarget.dataset
    
    this.setData({
      [`formData.${field}`]: value
    })

    // 如果是数量、单价或单位变化，重新计算总金额
    if (field === 'quantity' || field === 'unitPrice') {
      this.calculateTotalAmount()
    }

    console.log(`字段 ${field} 更新为:`, value)
  },

  // 计算总金额
  calculateTotalAmount() {
    const { quantity, unitPrice } = this.data.formData
    const quantityNum = parseFloat(quantity) || 0
    const priceNum = parseFloat(unitPrice) || 0
    const total = (quantityNum * priceNum).toFixed(2)
    
    this.setData({
      totalAmount: total
    })
  },

  // 表单验证
  validateForm(): { isValid: boolean; errors: string[] } {
    const { formData } = this.data
    const errors: string[] = []

    // 检查必填字段
    if (!formData.purchaseDate) {
      errors.push('请选择采购日期')
    }
    if (!formData.materialName.trim()) {
      errors.push('请输入物料名称')
    }
    if (!formData.supplier.trim()) {
      errors.push('请输入供应商')
    }
    if (!formData.quantity.trim()) {
      errors.push('请输入采购数量')
    }
    if (!formData.unit.trim()) {
      errors.push('请输入计量单位')
    }
    if (!formData.unitPrice.trim()) {
      errors.push('请输入单价')
    }
    if (!formData.operator.trim()) {
      errors.push('请输入操作员姓名')
    }

    // 验证数值字段
    if (formData.quantity && (isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0)) {
      errors.push('采购数量必须为正数')
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
        totalAmount: this.data.totalAmount,
        type: '采购',
        createTime: new Date().toISOString(),
        status: '已完成'
      }

      console.log('提交采购入库数据:', submitData)

      // 这里应该调用云函数或API提交数据
      // 模拟API调用
      await this.submitToDatabase(submitData)

      // 提交成功
      wx.showToast({
        title: '采购入库记录提交成功',
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
      console.error('提交采购入库记录失败:', error)
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
          const currentDate = this.data.formData.purchaseDate
          const currentBatchId = this.data.formData.batchId
          
          this.setData({
            formData: {
              batchId: currentBatchId,
              purchaseDate: currentDate,
              materialName: '',
              specification: '',
              supplier: '',
              quantity: '',
              unit: '',
              unitPrice: '',
              operator: '',
              remarks: ''
            },
            totalAmount: '0.00'
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
      title: '采购入库表单',
      path: '/pages/purchase-form/purchase-form',
      imageUrl: '' // 可以设置分享图片
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
