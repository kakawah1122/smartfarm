// entry-form.ts - 入栏记录表单页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 表单数据接口
interface EntryFormData {
  batchId: string;          // 批次ID
  entryDate: string;        // 入栏日期
  breed: string;            // 鹅苗品种
  supplier: string;         // 供应商
  quantity: string;         // 采购数量
  unitPrice: string;        // 单价
  remarks: string;          // 备注
}

const pageConfig = {
  data: {
    // 表单数据
    formData: {
      batchId: '',
      entryDate: '',
      breed: '',
      supplier: '',
      quantity: '',
      unitPrice: '',
      remarks: ''
    } as EntryFormData,
    
    // 日期选择器相关
    showDate: false,
    dateValue: '',
    
    // 计算总金额
    totalAmount: '0.00',
    
    // 提交状态
    submitting: false,
    
    // 提交状态
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
      'formData.entryDate': dateString,
      'formData.batchId': batchId,
      dateValue: today.getTime()
    })
  },

  // 生成批次ID (QY-日期格式)
  generateBatchId(dateString: string): string {
    const formattedDate = dateString.replace(/-/g, '')
    return `QY-${formattedDate}`
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
      'formData.entryDate': dateString,
      'formData.batchId': batchId,
      dateValue: value,
      showDate: false
    })
  },

  // 表单字段变化
  onFieldChange(e: any) {
    const { value } = e.detail
    const { field } = e.currentTarget.dataset
    
    this.setData({
      [`formData.${field}`]: value
    })

    // 如果是数量或单价变化，重新计算总金额
    if (field === 'quantity' || field === 'unitPrice') {
      this.calculateTotalAmount()
    }
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
    if (!formData.entryDate) {
      errors.push('请选择入栏日期')
    }
    if (!formData.breed.trim()) {
      errors.push('请输入鹅苗品种')
    }
    if (!formData.supplier.trim()) {
      errors.push('请输入供应商名称')
    }
    if (!formData.quantity.trim()) {
      errors.push('请输入采购数量')
    }
    if (!formData.unitPrice.trim()) {
      errors.push('请输入单价')
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
        createTime: new Date().toISOString(),
        status: '已完成'
      }

      // 调用云函数保存数据
      const result = await wx.cloud.callFunction({
        name: 'production-entry',
        data: {
          action: 'create',
          recordData: {
            batchId: submitData.batchId,  // 添加批次ID字段
            breed: submitData.breed,
            supplier: submitData.supplier,
            quantity: submitData.quantity,
            unitPrice: submitData.unitPrice,
            entryDate: submitData.entryDate,
            notes: submitData.remarks,
            status: submitData.status,
            totalAmount: submitData.totalAmount  // 添加总金额字段
          }
        }
      })

      if (!result.result.success) {
        throw new Error(result.result.message || '提交失败')
      }

      // 提交成功
      wx.showToast({
        title: '入栏记录提交成功',
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
          const currentDate = this.data.formData.entryDate
          const currentBatchId = this.data.formData.batchId
          
          this.setData({
            formData: {
              batchId: currentBatchId,
              entryDate: currentDate,
              breed: '',
              supplier: '',
              quantity: '',
              unitPrice: '',
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
      title: '入栏记录表单',
      path: '/pages/entry-form/entry-form',
      imageUrl: '' // 可以设置分享图片
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))