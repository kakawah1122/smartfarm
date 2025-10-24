// health-care.ts - 保健管理页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 表单数据
    formData: {
      batchId: '',
      locationId: '',
      careType: 'nutrition', // nutrition|environment|immunity|growth
      supplement: '',
      dosage: '',
      method: 'feed', // feed|water|spray|environment
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
    
    // 保健类型选项
    careTypeOptions: [
      { label: '营养补充', value: 'nutrition', icon: 'food', desc: '维生素、矿物质等营养补充' },
      { label: '环境改善', value: 'environment', icon: 'home', desc: '温度、湿度、通风等环境优化' },
      { label: '免疫增强', value: 'immunity', icon: 'secured', desc: '提高免疫力的保健措施' },
      { label: '生长促进', value: 'growth', icon: 'arrow-up', desc: '促进生长发育的保健方案' }
    ],
    
    // 给药方式选项
    methodOptions: [
      { label: '饲料添加', value: 'feed' },
      { label: '饮水添加', value: 'water' },
      { label: '喷雾给药', value: 'spray' },
      { label: '环境调节', value: 'environment' }
    ],
    
    effectivenessOptions: [
      { label: '优秀', value: 'excellent' },
      { label: '良好', value: 'good' },
      { label: '一般', value: 'fair' },
      { label: '较差', value: 'poor' }
    ],
    
    // 常用保健品库
    commonSupplements: {
      nutrition: [
        { name: '维生素C', dosage: '2g/100只', purpose: '增强免疫力' },
        { name: '维生素E', dosage: '1g/100只', purpose: '抗氧化' },
        { name: '复合维生素', dosage: '5g/100只', purpose: '全面营养补充' },
        { name: '电解质', dosage: '10g/100只', purpose: '维持电解质平衡' }
      ],
      environment: [
        { name: '益生菌', dosage: '按说明使用', purpose: '改善肠道环境' },
        { name: '除臭剂', dosage: '适量喷洒', purpose: '改善空气质量' },
        { name: '消毒液', dosage: '1:200稀释', purpose: '环境净化' }
      ],
      immunity: [
        { name: '免疫增强剂', dosage: '3g/100只', purpose: '提高免疫力' },
        { name: '中草药添加剂', dosage: '按配方使用', purpose: '天然免疫调节' },
        { name: '蜂胶', dosage: '0.5g/只', purpose: '抗菌免疫' }
      ],
      growth: [
        { name: '氨基酸', dosage: '5g/100只', purpose: '促进蛋白质合成' },
        { name: '钙磷补充剂', dosage: '3g/100只', purpose: '骨骼发育' },
        { name: '生长因子', dosage: '按说明使用', purpose: '促进生长' }
      ]
    },
    
    // 活跃批次列表
    activeBatches: [] as any[],
    
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
    formErrors: {} as Record<string, string>,
    
    // 来源类型
    sourceType: 'normal',
    sourceId: ''
  },

  onLoad(options: any) {
    const { sourceType, sourceId, batchId, careType } = options || {}
    
    this.setData({
      sourceType: sourceType || 'normal',
      sourceId: sourceId || ''
    })
    
    if (batchId) {
      this.setData({
        'formData.batchId': batchId
      })
    }
    
    if (careType) {
      this.setData({
        'formData.careType': careType
      })
    }
    
    this.initializeForm()
  },

  async onShow() {
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
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: { action: 'get_active_batches' }
      })
      
      if (result.result && result.result.success) {
        this.setData({
          activeBatches: result.result.data.batches || []
        })
      }
    } catch (error) {
      // 已移除调试日志
    }
  },

  // 表单输入处理
  onFormInput(e: any) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`formData.${field}`]: value
    })
    
    this.validateField(field, value)
  },

  // 数字输入处理
  onNumberInput(e: any) {
    const { field } = e.currentTarget.dataset
    const value = parseFloat(e.detail.value) || 0
    
    this.setData({
      [`formData.${field}`]: value
    })
    
    this.validateField(field, value)
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
        this.setData({
          'formData.batchId': selectedBatch.batchNumber,
          'formData.locationId': selectedBatch.location
        })
        this.validateField('batchId', selectedBatch.batchNumber)
      }
    })
  },

  // 保健类型选择器
  showCareTypeSelector() {
    this.setData({ showCareTypePicker: true })
  },

  onCareTypePickerChange(e: any) {
    const index = e.detail.value
    const selectedType = this.data.careTypeOptions[index]
    
    this.setData({
      'formData.careType': selectedType.value,
      showCareTypePicker: false,
      // 清空相关字段
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

  onMethodPickerChange(e: any) {
    const index = e.detail.value
    const selectedMethod = this.data.methodOptions[index]
    
    this.setData({
      'formData.method': selectedMethod.value,
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

  onEffectivenessPickerChange(e: any) {
    const index = e.detail.value
    const selectedEffectiveness = this.data.effectivenessOptions[index]
    
    this.setData({
      'formData.effectiveness': selectedEffectiveness.value,
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
    const supplements = this.data.commonSupplements[careType as keyof typeof this.data.commonSupplements] || []
    
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
  onDateChange(e: any) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
    this.validateField(field, e.detail.value)
  },

  onTimeChange(e: any) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
    this.validateField(field, e.detail.value)
  },

  // 字段验证
  validateField(field: string, value: any) {
    const errors = { ...this.data.formErrors }
    
    switch (field) {
      case 'batchId':
        if (!value) {
          errors[field] = '请选择目标批次'
        } else {
          delete errors[field]
        }
        break
      case 'supplement':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入保健品名称'
        } else {
          delete errors[field]
        }
        break
      case 'dosage':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入用法用量'
        } else {
          delete errors[field]
        }
        break
      case 'purpose':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入保健目的'
        } else {
          delete errors[field]
        }
        break
      case 'targetCount':
        if (!value || value <= 0) {
          errors[field] = '目标数量必须大于0'
        } else {
          delete errors[field]
        }
        break
      case 'actualCount':
        if (value > this.data.formData.targetCount) {
          errors[field] = '实际数量不能超过目标数量'
        } else {
          delete errors[field]
        }
        break
      case 'duration':
        if (value <= 0) {
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
      
      // 调用云函数创建预防记录
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_prevention_record',
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
        }
      })
      
      if (result.result && result.result.success) {
        wx.showToast({
          title: '保健管理记录保存成功',
          icon: 'success'
        })
        
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        throw new Error(result.result?.message || '保存失败')
      }
    } catch (error: any) {
      // 已移除调试日志
      wx.showToast({
        title: error.message || '保存失败，请重试',
        icon: 'none'
      })
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
