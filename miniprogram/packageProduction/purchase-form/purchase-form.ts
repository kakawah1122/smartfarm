// @ts-nocheck
// purchase-form.ts - 采购入库表单页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 表单数据接口
interface PurchaseFormData {
  batchId: string;          // 批次ID
  purchaseDate: string;     // 采购日期
  materialName: string;     // 物料名称
  category: string;         // 物料分类
  specification: string;    // 物料规格
  supplier: string;         // 供应商
  quantity: string;         // 采购数量
  unitPrice: string;        // 单价
  remarks: string;          // 备注
}

const pageConfig = {
  // ✅ 定时器管理
  _timerIds: [] as number[],
  
  _safeSetTimeout(callback: () => void, delay: number): number {
    const timerId = setTimeout(() => {
      const index = this._timerIds.indexOf(timerId as unknown as number)
      if (index > -1) {
        this._timerIds.splice(index, 1)
      }
      callback()
    }, delay) as unknown as number
    this._timerIds.push(timerId)
    return timerId
  },
  
  _clearAllTimers() {
    this._timerIds.forEach((id: number) => clearTimeout(id))
    this._timerIds = []
  },

  data: {
    // 表单数据
    formData: {
      batchId: '',
      purchaseDate: '',
      materialName: '',
      category: '',
      specification: '',
      supplier: '',
      quantity: '',
      unitPrice: '',
      remarks: ''
    } as PurchaseFormData,
    
    // 最大日期（今天）
    maxDate: '',
    
    // 分类选择器相关
    categoryLabels: ['饲料', '营养品', '药品', '设备', '耗材', '其他'],
    categoryIndex: -1, // -1表示未选择
    
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

  onUnload() {
    this._clearAllTimers()
  },

  // 初始化表单
  initializeForm() {
    const today = new Date()
    const dateString = this.formatDate(today)
    const batchId = this.generateBatchId(dateString)
    
    this.setData({
      'formData.purchaseDate': dateString,
      'formData.batchId': batchId,
      maxDate: dateString
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

  // 确认选择日期（原生 picker 直接返回格式化的日期字符串）
  onDateConfirm(e: any) {
    const dateString = e.detail.value  // 原生 picker 返回 "YYYY-MM-DD" 格式
    const batchId = this.generateBatchId(dateString)
    
    this.setData({
      'formData.purchaseDate': dateString,
      'formData.batchId': batchId
    })
  },

  // 分类选择变化
  onCategoryChange(e: any) {
    const index = e.detail.value
    const category = this.data.categoryLabels[index]
    this.setData({
      'formData.category': category,  // 存储中文值到数据库
      categoryIndex: index
    })
    // 已移除调试日志
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

  // 根据物料名称智能推断分类
  getMaterialCategory(materialName: string): string {
    const name = materialName.toLowerCase()
    
    // 饲料类 - 普通饲料
    if (name.includes('饲料') || name.includes('精料') || name.includes('玉米') || name.includes('豆粕') || name.includes('麸皮') || name.includes('鹅料')) {
      return '饲料'
    }
    
    // 营养品类 - 营养补充剂
    if (name.includes('营养') || name.includes('维生素') || name.includes('补充') || name.includes('补剂') || name.includes('钙') || name.includes('蛋白质') || name.includes('营养液') || name.includes('营养粉')) {
      return '营养品'
    }
    
    // 药品类
    if (name.includes('药') || name.includes('疫苗') || name.includes('消毒') || name.includes('抗生素') || name.includes('治疗') || name.includes('医用')) {
      return '药品'
    }
    
    // 设备类
    if (name.includes('设备') || name.includes('器械') || name.includes('工具') || name.includes('机械')) {
      return '设备'
    }
    
    // 耗材类
    if (name.includes('耗材') || name.includes('用具') || name.includes('容器') || name.includes('包装')) {
      return '耗材'
    }
    
    // 其他类（默认）
    return '其他'
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
    if (!formData.category.trim()) {
      errors.push('请选择物料分类')
    }
    if (!formData.supplier.trim()) {
      errors.push('请输入供应商')
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
        type: '采购',
        createTime: new Date().toISOString(),
        status: '已完成',
        category: this.data.formData.category || this.getMaterialCategory(this.data.formData.materialName) // 使用用户选择的分类或智能推断
      }

      // 调用云函数提交采购记录
      await this.submitToCloudFunction(submitData)

      // 提交成功
      wx.showToast({
        title: '提交成功',
        icon: 'success',
        duration: 1500
      })

      // 通知上一个页面需要刷新数据
      const pages = getCurrentPages()
      if (pages.length >= 2) {
        const prevPage = pages[pages.length - 2] as any
        // 如果上一页是生产管理页面，设置刷新标志
        if (prevPage && prevPage.route === 'pages/production/production') {
          prevPage.setData({
            needRefresh: true
          })
        }
      }

      // 延迟后自动返回上一页
      this._safeSetTimeout(() => {
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

  // 提交到云函数 - 使用新的采购入库接口
  async submitToCloudFunction(data: unknown): Promise<void> {
    
    try {
      // 使用新的采购入库接口，自动处理物料匹配和创建
      const app = getApp()
      const currentUserName = app.globalData?.userInfo?.nickname || app.globalData?.userInfo?.nickName || ''
      const result = await wx.cloud.callFunction({
        name: 'production-material',
        data: {
          action: 'purchase_inbound',
          materialData: {
            name: data.materialName,
            category: data.category,
            specification: data.specification || '',
            unit: '件',
            supplier: data.supplier || '',
            quantity: parseFloat(data.quantity),
            unitPrice: parseFloat(data.unitPrice),
            operator: currentUserName,
            recordDate: data.purchaseDate,
            notes: data.remarks || '',
            batchId: data.batchId
          }
        }
      })
      
      if (!result.result?.success) {
        const errorMsg = result.result?.error || result.result?.message || '未知错误'
        throw new Error(errorMsg)
      }
      
    } catch (error) {
      throw error
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
          const currentDate = this.data.formData.purchaseDate
          const currentBatchId = this.data.formData.batchId
          
          this.setData({
            formData: {
              batchId: currentBatchId,
              purchaseDate: currentDate,
              materialName: '',
              category: '',
              specification: '',
              supplier: '',
              quantity: '',
              unitPrice: '',
              remarks: ''
            },
            categoryIndex: -1,
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
      path: '/packageProduction/purchase-form/purchase-form',
      imageUrl: '' // 可以设置分享图片
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
