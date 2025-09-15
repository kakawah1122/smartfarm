// disinfection-record.ts - 环境消毒记录页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 表单数据
    formData: {
      batchId: '',
      locationId: '',
      disinfectant: '',
      concentration: '',
      area: 0,
      method: 'spray', // spray|fumigation|washing|wiping
      weather: 'sunny', // sunny|cloudy|rainy|windy
      temperature: 0,
      humidity: 0,
      executionDate: '',
      executionTime: '',
      operator: '',
      cost: 0,
      effectiveness: 'good', // excellent|good|fair|poor
      notes: '',
      nextSchedule: ''
    },
    
    // 选择器数据
    methodOptions: [
      { label: '喷雾消毒', value: 'spray' },
      { label: '熏蒸消毒', value: 'fumigation' },
      { label: '冲洗消毒', value: 'washing' },
      { label: '擦拭消毒', value: 'wiping' }
    ],
    
    weatherOptions: [
      { label: '晴天', value: 'sunny' },
      { label: '阴天', value: 'cloudy' },
      { label: '雨天', value: 'rainy' },
      { label: '风天', value: 'windy' }
    ],
    
    effectivenessOptions: [
      { label: '优秀', value: 'excellent' },
      { label: '良好', value: 'good' },
      { label: '一般', value: 'fair' },
      { label: '较差', value: 'poor' }
    ],
    
    // 活跃批次列表
    activeBatches: [] as any[],
    
    // 显示文本
    selectedMethodLabel: '喷雾消毒',
    selectedWeatherLabel: '晴天', 
    selectedEffectivenessLabel: '良好',
    
    // 选择器索引
    selectedMethodIndex: 0,
    selectedWeatherIndex: 0,
    selectedEffectivenessIndex: 1,
    
    // 页面状态
    loading: false,
    submitting: false,
    showMethodPicker: false,
    showWeatherPicker: false,
    showEffectivenessPicker: false,
    
    // 表单验证
    formErrors: {} as Record<string, string>,
    
    // 来源类型
    sourceType: 'normal',
    sourceId: ''
  },

  onLoad(options: any) {
    const { sourceType, sourceId, batchId, locationId } = options || {}
    
    this.setData({
      sourceType: sourceType || 'normal',
      sourceId: sourceId || ''
    })
    
    if (batchId) {
      this.setData({
        'formData.batchId': batchId
      })
    }
    
    if (locationId) {
      this.setData({
        'formData.locationId': locationId
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
    const { formData, methodOptions, weatherOptions, effectivenessOptions } = this.data
    
    const methodIndex = methodOptions.findIndex(item => item.value === formData.method)
    const weatherIndex = weatherOptions.findIndex(item => item.value === formData.weather)
    const effectivenessIndex = effectivenessOptions.findIndex(item => item.value === formData.effectiveness)
    
    const selectedMethod = methodOptions[methodIndex]
    const selectedWeather = weatherOptions[weatherIndex]
    const selectedEffectiveness = effectivenessOptions[effectivenessIndex]
    
    this.setData({
      selectedMethodLabel: selectedMethod?.label || '请选择',
      selectedWeatherLabel: selectedWeather?.label || '请选择', 
      selectedEffectivenessLabel: selectedEffectiveness?.label || '请选择',
      selectedMethodIndex: Math.max(0, methodIndex),
      selectedWeatherIndex: Math.max(0, weatherIndex),
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

  // 消毒方式选择器
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
    this.validateField('method', selectedMethod.value)
  },

  onMethodPickerCancel() {
    this.setData({ showMethodPicker: false })
  },

  // 天气条件选择器
  showWeatherSelector() {
    this.setData({ showWeatherPicker: true })
  },

  onWeatherPickerChange(e: any) {
    const index = e.detail.value
    const selectedWeather = this.data.weatherOptions[index]
    
    this.setData({
      'formData.weather': selectedWeather.value,
      showWeatherPicker: false
    })
    
    this.updateDisplayLabels()
  },

  onWeatherPickerCancel() {
    this.setData({ showWeatherPicker: false })
  },

  // 消毒效果选择器
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
      case 'locationId':
        if (!value) {
          errors[field] = '请选择消毒区域'
        } else {
          delete errors[field]
        }
        break
      case 'disinfectant':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入消毒剂名称'
        } else {
          delete errors[field]
        }
        break
      case 'concentration':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入消毒剂浓度'
        } else {
          delete errors[field]
        }
        break
      case 'area':
        if (!value || value <= 0) {
          errors[field] = '消毒面积必须大于0'
        } else {
          delete errors[field]
        }
        break
      case 'temperature':
        if (value < -50 || value > 60) {
          errors[field] = '请输入合理的温度值'
        } else {
          delete errors[field]
        }
        break
      case 'humidity':
        if (value < 0 || value > 100) {
          errors[field] = '湿度值应在0-100之间'
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
    if (!formData.locationId) errors.locationId = '请选择消毒区域'
    if (!formData.disinfectant) errors.disinfectant = '请输入消毒剂名称'
    if (!formData.concentration) errors.concentration = '请输入消毒剂浓度'
    if (!formData.area || formData.area <= 0) errors.area = '消毒面积必须大于0'
    if (!formData.executionDate) errors.executionDate = '请选择执行日期'
    if (!formData.operator) errors.operator = '请输入操作员'
    
    // 数值范围验证
    if (formData.temperature < -50 || formData.temperature > 60) {
      errors.temperature = '请输入合理的温度值'
    }
    if (formData.humidity < 0 || formData.humidity > 100) {
      errors.humidity = '湿度值应在0-100之间'
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
      
      // 构建消毒记录数据
      const disinfectionRecord = {
        disinfectant: formData.disinfectant,
        concentration: formData.concentration,
        area: formData.area,
        method: formData.method,
        weather: formData.weather,
        temperature: formData.temperature,
        humidity: formData.humidity
      }
      
      // 调用云函数创建预防记录
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_prevention_record',
          preventionType: 'disinfection',
          batchId: formData.batchId,
          locationId: formData.locationId,
          disinfectionRecord,
          executionDate: formData.executionDate,
          executionTime: formData.executionTime,
          operator: formData.operator,
          cost: formData.cost,
          effectiveness: formData.effectiveness,
          notes: formData.notes,
          nextScheduled: formData.nextSchedule ? {
            date: formData.nextSchedule,
            type: 'disinfection',
            notes: '定期环境消毒'
          } : null,
          sourceType: this.data.sourceType,
          sourceId: this.data.sourceId
        }
      })
      
      if (result.result && result.result.success) {
        wx.showToast({
          title: '环境消毒记录保存成功',
          icon: 'success'
        })
        
        // 如果消毒效果较差，提示风险评估
        if (formData.effectiveness === 'poor') {
          this.handlePoorEffectiveness(result.result.data.recordId)
        } else {
          // 返回上一页
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
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

  // 处理消毒效果不佳
  handlePoorEffectiveness(preventionRecordId: string) {
    wx.showModal({
      title: '消毒效果评估',
      content: '消毒效果评价为"较差"，可能存在环境健康风险，是否创建健康监控记录？',
      confirmText: '创建监控',
      cancelText: '暂不处理',
      success: (res) => {
        if (res.confirm) {
          // 跳转到健康记录页面或创建预警
          this.createHealthRiskAlert(preventionRecordId)
        } else {
          // 返回上一页
          wx.navigateBack()
        }
      }
    })
  },

  // 创建健康风险预警
  async createHealthRiskAlert(preventionRecordId: string) {
    try {
      await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'check_health_alerts',
          triggerType: 'disinfection_poor_effect',
          relatedRecordId: preventionRecordId,
          batchId: this.data.formData.batchId,
          locationId: this.data.formData.locationId
        }
      })
      
      wx.showToast({
        title: '已创建健康监控记录',
        icon: 'success'
      })
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      // 已移除调试日志
      wx.navigateBack()
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
              disinfectant: '',
              concentration: '',
              area: 0,
              method: 'spray',
              weather: 'sunny',
              temperature: 0,
              humidity: 0,
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
