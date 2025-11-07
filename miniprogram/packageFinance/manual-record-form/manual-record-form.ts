// manual-record-form.ts - 手动记账表单页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 表单数据接口
interface ManualRecordFormData {
  recordDate: string;        // 记录日期
  type: string;              // 类型值（costType 或 revenueType）
  typeLabel: string;         // 类型标签（显示用）
  amount: string;            // 金额
  description: string;       // 描述
  invoiceNumber: string;     // 发票号
  notes: string;             // 备注
}

interface UploadedFile {
  fileID: string;
  tempFilePath?: string;
}

const pageConfig = {
  data: {
    // 记账类型：expense（支出）或 income（收入）
    recordType: 'expense' as 'expense' | 'income',
    
    // 表单数据
    formData: {
      recordDate: '',
      type: '',
      typeLabel: '',
      amount: '',
      description: '',
      invoiceNumber: '',
      notes: ''
    } as ManualRecordFormData,
    
    // 最大日期（今天）
    maxDate: '',
    
    // 类型选项
    typeOptions: [] as {label: string, value: string}[],
    typeIndex: -1,
    
    // 上传的文件列表
    uploadedFiles: [] as UploadedFile[],
    uploading: false,
    
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
    
    this.setData({
      'formData.recordDate': dateString,
      maxDate: dateString,
      recordType: 'expense'
    })
    
    // 初始化类型选项
    this.updateTypeOptions()
  },

  // 格式化日期
  formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 更新类型选项（根据记账类型）
  updateTypeOptions() {
    const { recordType } = this.data
    
    if (recordType === 'expense') {
      // 支出类型选项
      this.setData({
        typeOptions: [
          { label: '饲料', value: 'feed' },
          { label: '医疗', value: 'health' },
          { label: '人工', value: 'labor' },
          { label: '设施', value: 'facility' },
          { label: '其他', value: 'other' }
        ]
      })
    } else {
      // 收入类型选项
      this.setData({
        typeOptions: [
          { label: '销售', value: 'sales' },
          { label: '补贴', value: 'subsidy' },
          { label: '其他', value: 'other' }
        ]
      })
    }
    
    // 重置类型选择
    this.setData({
      typeIndex: -1,
      'formData.type': '',
      'formData.typeLabel': ''
    })
  },

  // 记账类型变化
  onRecordTypeChange(e: any) {
    const recordType = e.detail.value as 'expense' | 'income'
    console.log('记账类型变化:', recordType)
    this.setData({ recordType })
    this.updateTypeOptions()
  },

  // 日期选择变化
  onDateChange(e: any) {
    const dateString = e.detail.value
    this.setData({
      'formData.recordDate': dateString
    })
  },

  // 类型选择变化
  onTypeChange(e: any) {
    const index = e.detail.value
    const option = this.data.typeOptions[index]
    
    if (option) {
      this.setData({
        typeIndex: index,
        'formData.type': option.value,
        'formData.typeLabel': option.label
      })
    }
  },

  // 字段变化
  onFieldChange(e: any) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    
    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 选择图片
  chooseImage() {
    const { uploadedFiles } = this.data
    const remainingCount = 5 - uploadedFiles.length
    
    if (remainingCount <= 0) {
      wx.showToast({
        title: '最多只能上传5张单据',
        icon: 'none'
      })
      return
    }

    wx.chooseMedia({
      count: remainingCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        this.setData({ uploading: true })
        wx.showLoading({ title: '上传中...' })

        try {
          const uploadPromises = res.tempFiles.map(async (file) => {
            // 压缩图片
            let finalPath = file.tempFilePath
            try {
              const compressResult = await wx.compressImage({
                src: file.tempFilePath,
                quality: 80,
                compressedWidth: 1920,
                compressedHeight: 1920
              })
              finalPath = compressResult.tempFilePath
            } catch (compressError) {
              // 压缩失败则使用原图
            }

            // 上传到云存储
            const timestamp = Date.now()
            const random = Math.floor(Math.random() * 10000)
            const ext = file.tempFilePath.split('.').pop() || 'jpg'
            const cloudPath = `finance-receipts/${timestamp}_${random}.${ext}`

            const uploadResult = await wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: finalPath
            })

            return {
              fileID: uploadResult.fileID,
              tempFilePath: file.tempFilePath
            }
          })

          const uploadedFiles = await Promise.all(uploadPromises)
          const allFiles = [...this.data.uploadedFiles, ...uploadedFiles]

          this.setData({
            uploadedFiles: allFiles
          })

          wx.hideLoading()
          wx.showToast({
            title: `已上传${uploadedFiles.length}张单据`,
            icon: 'success',
            duration: 1500
          })
        } catch (error: any) {
          wx.hideLoading()
          wx.showToast({
            title: error.message || '上传失败',
            icon: 'none'
          })
        } finally {
          this.setData({ uploading: false })
        }
      },
      fail: (error) => {
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },

  // 预览图片
  previewImage(e: any) {
    const { url } = e.currentTarget.dataset
    const { uploadedFiles } = this.data
    const urls = uploadedFiles.map(file => file.fileID)
    const currentIndex = urls.indexOf(url)

    wx.previewImage({
      urls: urls,
      current: urls[currentIndex] || url
    })
  },

  // 删除图片
  deleteImage(e: any) {
    const { index } = e.currentTarget.dataset
    const { uploadedFiles } = this.data

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张单据吗？',
      success: (res) => {
        if (res.confirm) {
          const newFiles = uploadedFiles.filter((_, i) => i !== index)
          this.setData({
            uploadedFiles: newFiles
          })
        }
      }
    })
  },

  // 验证表单
  validateForm(): { isValid: boolean; errors: string[] } {
    const { formData, recordType } = this.data
    const errors: string[] = []

    if (!formData.recordDate) {
      errors.push('请选择记录日期')
    }

    if (!formData.type) {
      errors.push(`请选择${recordType === 'expense' ? '支出' : '收入'}类型`)
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.push('请输入有效的金额（必须大于0）')
    }

    if (!formData.description || formData.description.trim() === '') {
      errors.push('请输入描述信息')
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
      const { formData, recordType, uploadedFiles } = this.data
      const amount = parseFloat(formData.amount)
      const receiptFileIDs = uploadedFiles.map(file => file.fileID)

      if (recordType === 'expense') {
        // 创建支出记录
        const result = await wx.cloud.callFunction({
          name: 'finance-management',
          data: {
            action: 'create_cost_record',
            costType: formData.type,
            amount: amount,
            description: formData.description.trim(),
            invoiceNumber: formData.invoiceNumber.trim() || '',
            notes: formData.notes.trim() || '',
            receiptFileIDs: receiptFileIDs
          }
        })

        if (result.result && result.result.success) {
          wx.showToast({
            title: '支出记录创建成功',
            icon: 'success',
            duration: 1500
          })

          setTimeout(() => {
            wx.navigateBack({
              delta: 1
            })
          }, 800)
        } else {
          throw new Error(result.result?.error || '创建失败')
        }
      } else {
        // 创建收入记录
        const result = await wx.cloud.callFunction({
          name: 'finance-management',
          data: {
            action: 'create_revenue_record',
            revenueType: formData.type,
            amount: amount,
            description: formData.description.trim(),
            invoiceNumber: formData.invoiceNumber.trim() || '',
            notes: formData.notes.trim() || '',
            receiptFileIDs: receiptFileIDs
          }
        })

        if (result.result && result.result.success) {
          wx.showToast({
            title: '收入记录创建成功',
            icon: 'success',
            duration: 1500
          })

          setTimeout(() => {
            wx.navigateBack({
              delta: 1
            })
          }, 800)
        } else {
          throw new Error(result.result?.error || '创建失败')
        }
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
      content: '确定要重置表单吗？所有已填写的内容将被清空。',
      success: (res) => {
        if (res.confirm) {
          const today = new Date()
          const dateString = this.formatDate(today)
          
          this.setData({
            'formData.recordDate': dateString,
            'formData.type': '',
            'formData.typeLabel': '',
            'formData.amount': '',
            'formData.description': '',
            'formData.invoiceNumber': '',
            'formData.notes': '',
            typeIndex: -1,
            uploadedFiles: []
          })
          
          wx.showToast({
            title: '已重置',
            icon: 'success',
            duration: 1000
          })
        }
      }
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    })
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
