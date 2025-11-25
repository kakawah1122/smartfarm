// health-care.ts - 保健管理页面
import { createPageWithNavbar } from '../../utils/navigation'
import { HealthCloud } from '../../utils/cloud-functions'
import { safeCloudCall } from '../../utils/safe-cloud-call'
import type { HealthCareFormData, PageOptions, BatchInfo } from '../types/prevention'

// 类型别名
type InputEvent = WechatMiniprogram.Input
type PickerChangeEvent = WechatMiniprogram.PickerChange
import { 
  CARE_TYPE_OPTIONS, 
  METHOD_OPTIONS, 
  EFFECTIVENESS_OPTIONS,
  COMMON_SUPPLEMENTS,
  BATCHES_CACHE_DURATION,
  VALIDATE_DEBOUNCE_DELAY
} from '../constants/prevention-options'

interface PageData {
  formData: HealthCareFormData
  careTypeOptions: typeof CARE_TYPE_OPTIONS
  methodOptions: typeof METHOD_OPTIONS
  effectivenessOptions: typeof EFFECTIVENESS_OPTIONS
  commonSupplements: typeof COMMON_SUPPLEMENTS
  activeBatches: BatchInfo[]
  selectedCareTypeLabel: string
  selectedMethodLabel: string
  selectedEffectivenessLabel: string
  selectedCareTypeIndex: number
  selectedMethodIndex: number
  selectedEffectivenessIndex: number
  loading: boolean
  submitting: boolean
  showCareTypePicker: boolean
  showMethodPicker: boolean
  showEffectivenessPicker: boolean
  showSupplementPicker: boolean
  formErrors: Record<string, string>
  sourceType: string
  sourceId: string
  batchesCacheTime: number
}

const pageConfig: WechatMiniprogram.Page.Options<PageData, PageOptions> = {
  data: {
    // 表单数据
    formData: {
      batchId: '',
      locationId: '',
      careType: 'nutrition',
      supplement: '',
      dosage: '',
      method: 'feed',
      duration: 0,
      purpose: '',
      targetCount: 0,
      actualCount: 0,
      executionDate: '',
      executionTime: '',
      operator: '',
      cost: 0,
      effectiveness: 'good',
      notes: '',
      nextSchedule: ''
    },
    
    // 使用常量配置
    careTypeOptions: CARE_TYPE_OPTIONS,
    methodOptions: METHOD_OPTIONS,
    effectivenessOptions: EFFECTIVENESS_OPTIONS,
    commonSupplements: COMMON_SUPPLEMENTS,
    
    // 活跃批次列表
    activeBatches: [],
    batchesCacheTime: 0,
    
    // 显示文本和索引
    selectedCareTypeLabel: '营养补充',
    selectedMethodLabel: '饲料添加',
    selectedEffectivenessLabel: '良好',
    selectedCareTypeIndex: 0,
    selectedMethodIndex: 0,
    selectedEffectivenessIndex: 1,
    
    // 页面状态
    loading: false,
    submitting: false,
    showCareTypePicker: false,
    showMethodPicker: false,
    showEffectivenessPicker: false,
    showSupplementPicker: false,
    
    // 表单验证
    formErrors: {},
    
    // 来源类型
    sourceType: 'normal',
    sourceId: ''
  },

  // 表单验证防抖定时器
  validateTimer: null as number | null,

  onLoad(options: PageOptions) {
    // ✅ 合并setData调用
    const updateData: Record<string, any> = {
      sourceType: options.sourceType || 'normal',
      sourceId: options.sourceId || ''
    }
    
    if (options.batchId) {
      updateData['formData.batchId'] = options.batchId
    }
    
    if (options.careType) {
      updateData['formData.careType'] = options.careType as HealthCareFormData['careType']
    }
    
    this.setData(updateData)
    this.initializeForm()
  },

  async onShow() {
    // ✅ 实现数据缓存机制
    const now = Date.now()
    if (this.data.batchesCacheTime && 
        now - this.data.batchesCacheTime < BATCHES_CACHE_DURATION) {
      return
    }
    await this.loadActiveBatches()
  },

  // 初始化表单
  initializeForm() {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const timeNow = now.toTimeString().split(' ')[0].substring(0, 5)
    
    this.setData({
      'formData.executionDate': today,
      'formData.executionTime': timeNow,
      'formData.operator': '当前操作员'
    })
    
    this.updateDisplayLabels()
  },

  // 更新显示标签
  updateDisplayLabels() {
    const { formData, careTypeOptions, methodOptions, effectivenessOptions } = this.data
    
    const careTypeIndex = careTypeOptions.findIndex(item => item.value === formData.careType)
    const methodIndex = methodOptions.findIndex(item => item.value === formData.method)
    const effectivenessIndex = effectivenessOptions.findIndex(item => item.value === formData.effectiveness)
    
    const selectedCareType = careTypeOptions[careTypeIndex]
    const selectedMethod = methodOptions[methodIndex]
    const selectedEffectiveness = effectivenessOptions[effectivenessIndex]
    
    // ✅ 合并setData调用
    this.setData({
      selectedCareTypeLabel: selectedCareType?.label || '请选择',
      selectedMethodLabel: selectedMethod?.label || '请选择',
      selectedEffectivenessLabel: selectedEffectiveness?.label || '请选择',
      selectedCareTypeIndex: Math.max(0, careTypeIndex),
      selectedMethodIndex: Math.max(0, methodIndex),
      selectedEffectivenessIndex: Math.max(0, effectivenessIndex)
    })
  },

  // 加载活跃批次
  async loadActiveBatches() {
    try {
      wx.showLoading({ title: '加载批次列表...' })
      
      const result = await safeCloudCall<{ success: boolean; data?: { batches: BatchInfo[] } }>({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })
      
      wx.hideLoading()
      
      if (result.success) {
        this.setData({
          activeBatches: result.data?.batches || [],
          batchesCacheTime: Date.now()
        })
      }
    } catch (error) {
      wx.showToast({
        title: '加载批次列表失败',
        icon: 'none'
      })
    }
  },

  // 表单输入处理（添加防抖）
  onFormInput(e: InputEvent) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`formData.${field}`]: value
    })
    
    // ✅ 防抖验证
    if (this.validateTimer) {
      clearTimeout(this.validateTimer)
    }
    this.validateTimer = setTimeout(() => {
      this.validateField(field, value)
    }, VALIDATE_DEBOUNCE_DELAY)
  },

  // 数字输入处理（添加防抖）
  onNumberInput(e: InputEvent) {
    const { field } = e.currentTarget.dataset
    const value = parseFloat(e.detail.value) || 0
    
    this.setData({
      [`formData.${field}`]: value
    })
    
    // ✅ 防抖验证
    if (this.validateTimer) {
      clearTimeout(this.validateTimer)
    }
    this.validateTimer = setTimeout(() => {
      this.validateField(field, value)
    }, VALIDATE_DEBOUNCE_DELAY)
  },

  // 显示批次选择器
  showBatchSelector() {
    if (this.data.activeBatches.length === 0) {
      wx.showToast({
        title: '暂无可用批次',
        icon: 'none'
      })
      return
    }
    
    const itemList = this.data.activeBatches.map(batch => batch.displayName)
    
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedBatch = this.data.activeBatches[res.tapIndex]
        // ✅ 合并setData调用
        this.setData({
          'formData.batchId': selectedBatch.batchNumber,
          'formData.locationId': selectedBatch.location || ''
        })
        this.validateField('batchId', selectedBatch.batchNumber)
      }
    })
  },

  // 保健类型选择器
  showCareTypeSelector() {
    this.setData({ showCareTypePicker: true })
  },

  onCareTypePickerChange(e: PickerChangeEvent) {
    const index = Number(e.detail.value)
    const selectedType = this.data.careTypeOptions[index]
    
    if (!selectedType) return
    
    // ✅ 合并setData调用
    this.setData({
      'formData.careType': selectedType.value as HealthCareFormData['careType'],
      showCareTypePicker: false,
      'formData.supplement': '',
      'formData.dosage': '',
      'formData.purpose': ''
    })
    
    this.updateDisplayLabels()
    this.validateField('careType', selectedType.value)
  },

  onCareTypePickerCancel() {
    this.setData({ showCareTypePicker: false })
  },

  // 给药方式选择器
  showMethodSelector() {
    this.setData({ showMethodPicker: true })
  },

  onMethodPickerChange(e: PickerChangeEvent) {
    const index = Number(e.detail.value)
    const selectedMethod = this.data.methodOptions[index]
    
    if (!selectedMethod) return
    
    this.setData({
      'formData.method': selectedMethod.value as HealthCareFormData['method'],
      showMethodPicker: false
    })
    
    this.updateDisplayLabels()
  },

  onMethodPickerCancel() {
    this.setData({ showMethodPicker: false })
  },

  // 效果评估选择器
  showEffectivenessSelector() {
    this.setData({ showEffectivenessPicker: true })
  },

  onEffectivenessPickerChange(e: PickerChangeEvent) {
    const index = Number(e.detail.value)
    const selectedEffectiveness = this.data.effectivenessOptions[index]
    
    if (!selectedEffectiveness) return
    
    this.setData({
      'formData.effectiveness': selectedEffectiveness.value as HealthCareFormData['effectiveness'],
      showEffectivenessPicker: false
    })
    
    this.updateDisplayLabels()
  },

  onEffectivenessPickerCancel() {
    this.setData({ showEffectivenessPicker: false })
  },

  // 常用保健品选择器
  showSupplementSelector() {
    const { careType } = this.data.formData
    const supplements = this.data.commonSupplements[careType] || []
    
    if (supplements.length === 0) {
      wx.showToast({
        title: '暂无推荐保健品',
        icon: 'none'
      })
      return
    }
    
    const itemList = supplements.map(item => `${item.name} - ${item.purpose}`)
    
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedSupplement = supplements[res.tapIndex]
        if (!selectedSupplement) return
        
        // ✅ 合并setData调用
        this.setData({
          'formData.supplement': selectedSupplement.name,
          'formData.dosage': selectedSupplement.dosage,
          'formData.purpose': selectedSupplement.purpose
        })
        
        this.validateField('supplement', selectedSupplement.name)
      }
    })
  },

  // 日期时间选择器
  onDateChange(e: PickerChangeEvent) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value as string
    
    this.setData({
      [`formData.${field}`]: value
    })
    this.validateField(field, value)
  },

  onTimeChange(e: PickerChangeEvent) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value as string
    
    this.setData({
      [`formData.${field}`]: value
    })
    this.validateField(field, value)
  },

  // 字段验证
  validateField(field: string, value: unknown) {
    const errors = { ...this.data.formErrors }
    
    switch (field) {
      case 'batchId':
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          errors[field] = '请选择目标批次'
        } else {
          delete errors[field]
        }
        break
      case 'supplement':
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          errors[field] = '请输入保健品名称'
        } else {
          delete errors[field]
        }
        break
      case 'dosage':
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          errors[field] = '请输入用法用量'
        } else {
          delete errors[field]
        }
        break
      case 'purpose':
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          errors[field] = '请输入保健目的'
        } else {
          delete errors[field]
        }
        break
      case 'targetCount':
        if (!value || (typeof value === 'number' && value <= 0)) {
          errors[field] = '目标数量必须大于0'
        } else {
          delete errors[field]
        }
        break
      case 'actualCount':
        if (typeof value === 'number' && value > this.data.formData.targetCount) {
          errors[field] = '实际数量不能超过目标数量'
        } else {
          delete errors[field]
        }
        break
      case 'duration':
        if (!value || (typeof value === 'number' && value <= 0)) {
          errors[field] = '使用天数必须大于0'
        } else {
          delete errors[field]
        }
        break
    }
    
    this.setData({ formErrors: errors })
  },

  // 表单验证
  validateForm(): boolean {
    const { formData } = this.data
    const errors: Record<string, string> = {}
    
    // 必填字段验证
    if (!formData.batchId) errors.batchId = '请选择目标批次'
    if (!formData.supplement) errors.supplement = '请输入保健品名称'
    if (!formData.dosage) errors.dosage = '请输入用法用量'
    if (!formData.purpose) errors.purpose = '请输入保健目的'
    if (!formData.targetCount || formData.targetCount <= 0) errors.targetCount = '目标数量必须大于0'
    if (!formData.duration || formData.duration <= 0) errors.duration = '使用天数必须大于0'
    if (!formData.executionDate) errors.executionDate = '请选择执行日期'
    if (!formData.operator) errors.operator = '请输入操作员'
    
    // 逻辑验证
    if (formData.actualCount > formData.targetCount) {
      errors.actualCount = '实际数量不能超过目标数量'
    }
    
    this.setData({ formErrors: errors })
    return Object.keys(errors).length === 0
  },

  // 提交表单
  async submitForm() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请检查表单信息',
        icon: 'none'
      })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      const { formData } = this.data
      
      // 构建营养保健记录数据
      const nutritionRecord = {
        supplement: formData.supplement,
        dosage: formData.dosage,
        method: formData.method,
        duration: formData.duration,
        purpose: formData.purpose,
        careType: formData.careType,
        targetCount: formData.targetCount,
        actualCount: formData.actualCount
      }
      
      wx.showLoading({ title: '保存中...' })
      
      const result = await HealthCloud.prevention.create({
        preventionType: 'nutrition',
        batchId: formData.batchId,
        locationId: formData.locationId,
        nutritionRecord,
        executionDate: formData.executionDate,
        executionTime: formData.executionTime,
        operator: formData.operator,
        cost: formData.cost,
        effectiveness: formData.effectiveness,
        notes: formData.notes,
        nextScheduled: formData.nextSchedule ? {
          date: formData.nextSchedule,
          type: 'nutrition',
          notes: `${formData.supplement}保健计划`
        } : null,
        sourceType: this.data.sourceType,
        sourceId: this.data.sourceId
      })
      
      wx.hideLoading()
      
      if (result.success) {
        wx.showToast({ title: '保健管理记录保存成功', icon: 'success' })
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (error) {
      // CloudApi已处理错误提示，这里不需要额外处理
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 重置表单
  resetForm() {
    wx.showModal({
      title: '确认重置',
      content: '是否清空所有已填写的信息？',
      success: (res) => {
        if (res.confirm) {
          this.initializeForm()
          this.setData({
            formData: {
              ...this.data.formData,
              batchId: '',
              locationId: '',
              careType: 'nutrition',
              supplement: '',
              dosage: '',
              method: 'feed',
              duration: 0,
              purpose: '',
              targetCount: 0,
              actualCount: 0,
              cost: 0,
              effectiveness: 'good',
              notes: '',
              nextSchedule: ''
            },
            formErrors: {}
          })
        }
      }
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  }
}

Page(createPageWithNavbar(pageConfig))
