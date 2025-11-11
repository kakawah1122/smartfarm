// disinfection-record.ts - 环境消毒记录页面
import { createPageWithNavbar } from '../../utils/navigation'
import CloudApi from '../../utils/cloud-api'
import type { DisinfectionFormData, PageOptions, BatchInfo } from '../types/prevention'
import { 
  DISINFECTION_METHOD_OPTIONS,
  WEATHER_OPTIONS,
  EFFECTIVENESS_OPTIONS,
  BATCHES_CACHE_DURATION,
  VALIDATE_DEBOUNCE_DELAY
} from '../constants/prevention-options'

interface PageData {
  formData: DisinfectionFormData
  methodOptions: typeof DISINFECTION_METHOD_OPTIONS
  weatherOptions: typeof WEATHER_OPTIONS
  effectivenessOptions: typeof EFFECTIVENESS_OPTIONS
  activeBatches: BatchInfo[]
  selectedMethodLabel: string
  selectedWeatherLabel: string
  selectedEffectivenessLabel: string
  selectedMethodIndex: number
  selectedWeatherIndex: number
  selectedEffectivenessIndex: number
  loading: boolean
  submitting: boolean
  showMethodPicker: boolean
  showWeatherPicker: boolean
  showEffectivenessPicker: boolean
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
      disinfectant: '',
      concentration: '',
      area: 0,
      method: 'spray',
      weather: 'sunny',
      temperature: 0,
      humidity: 0,
      executionDate: '',
      executionTime: '',
      operator: '',
      cost: 0,
      effectiveness: 'good',
      notes: '',
      nextSchedule: ''
    },
    
    // 使用常量配置
    methodOptions: DISINFECTION_METHOD_OPTIONS,
    weatherOptions: WEATHER_OPTIONS,
    effectivenessOptions: EFFECTIVENESS_OPTIONS,
    
    // 活跃批次列表
    activeBatches: [],
    batchesCacheTime: 0,
    
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
    
    if (options.locationId) {
      updateData['formData.locationId'] = options.locationId
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
    const { formData, methodOptions, weatherOptions, effectivenessOptions } = this.data
    
    const methodIndex = methodOptions.findIndex(item => item.value === formData.method)
    const weatherIndex = weatherOptions.findIndex(item => item.value === formData.weather)
    const effectivenessIndex = effectivenessOptions.findIndex(item => item.value === formData.effectiveness)
    
    const selectedMethod = methodOptions[methodIndex]
    const selectedWeather = weatherOptions[weatherIndex]
    const selectedEffectiveness = effectivenessOptions[effectivenessIndex]
    
    // ✅ 合并setData调用
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
      const result = await CloudApi.callFunction<{ batches: BatchInfo[] }>(
        'health-management',
        { action: 'get_active_batches' },
        { loading: true, loadingText: '加载批次列表...', showError: true }
      )
      
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
  onFormInput(e: WechatMiniprogram.InputEvent) {
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
  onNumberInput(e: WechatMiniprogram.InputEvent) {
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
        if (!selectedBatch) return
        
        // ✅ 合并setData调用
        this.setData({
          'formData.batchId': selectedBatch.batchNumber,
          'formData.locationId': selectedBatch.location || ''
        })
        this.validateField('batchId', selectedBatch.batchNumber)
      }
    })
  },

  // 消毒方式选择器
  showMethodSelector() {
    this.setData({ showMethodPicker: true })
  },

  onMethodPickerChange(e: WechatMiniprogram.PickerChangeEvent) {
    const index = e.detail.value as number
    const selectedMethod = this.data.methodOptions[index]
    
    if (!selectedMethod) return
    
    this.setData({
      'formData.method': selectedMethod.value as DisinfectionFormData['method'],
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

  onWeatherPickerChange(e: WechatMiniprogram.PickerChangeEvent) {
    const index = e.detail.value as number
    const selectedWeather = this.data.weatherOptions[index]
    
    if (!selectedWeather) return
    
    this.setData({
      'formData.weather': selectedWeather.value as DisinfectionFormData['weather'],
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

  onEffectivenessPickerChange(e: WechatMiniprogram.PickerChangeEvent) {
    const index = e.detail.value as number
    const selectedEffectiveness = this.data.effectivenessOptions[index]
    
    if (!selectedEffectiveness) return
    
    this.setData({
      'formData.effectiveness': selectedEffectiveness.value as DisinfectionFormData['effectiveness'],
      showEffectivenessPicker: false
    })
    
    this.updateDisplayLabels()
  },

  onEffectivenessPickerCancel() {
    this.setData({ showEffectivenessPicker: false })
  },

  // 日期时间选择器
  onDateChange(e: WechatMiniprogram.PickerChangeEvent) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value as string
    
    this.setData({
      [`formData.${field}`]: value
    })
    this.validateField(field, value)
  },

  onTimeChange(e: WechatMiniprogram.PickerChangeEvent) {
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
      case 'locationId':
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          errors[field] = '请选择消毒区域'
        } else {
          delete errors[field]
        }
        break
      case 'disinfectant':
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          errors[field] = '请输入消毒剂名称'
        } else {
          delete errors[field]
        }
        break
      case 'concentration':
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          errors[field] = '请输入消毒剂浓度'
        } else {
          delete errors[field]
        }
        break
      case 'area':
        if (!value || (typeof value === 'number' && value <= 0)) {
          errors[field] = '消毒面积必须大于0'
        } else {
          delete errors[field]
        }
        break
      case 'temperature':
        if (typeof value === 'number' && (value < -50 || value > 60)) {
          errors[field] = '请输入合理的温度值'
        } else {
          delete errors[field]
        }
        break
      case 'humidity':
        if (typeof value === 'number' && (value < 0 || value > 100)) {
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
      
      // ✅ 使用CloudApi统一封装
      const result = await CloudApi.callFunction<{ recordId: string }>(
        'health-management',
        {
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
        },
        {
          loading: true,
          loadingText: '保存中...',
          showSuccess: true,
          successText: '环境消毒记录保存成功'
        }
      )
      
      if (result.success) {
        // 如果消毒效果较差，提示风险评估
        if (formData.effectiveness === 'poor' && result.data?.recordId) {
          this.handlePoorEffectiveness(result.data.recordId)
        } else {
          // 返回上一页
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      }
    } catch (error) {
      // CloudApi已处理错误提示，这里不需要额外处理
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
          this.createHealthRiskAlert(preventionRecordId)
        } else {
          wx.navigateBack()
        }
      }
    })
  },

  // 创建健康风险预警
  async createHealthRiskAlert(preventionRecordId: string) {
    try {
      await CloudApi.callFunction(
        'health-management',
        {
          action: 'check_health_alerts',
          triggerType: 'disinfection_poor_effect',
          relatedRecordId: preventionRecordId,
          batchId: this.data.formData.batchId,
          locationId: this.data.formData.locationId
        },
        {
          loading: true,
          loadingText: '创建监控记录...',
          showSuccess: true,
          successText: '已创建健康监控记录'
        }
      )
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      // CloudApi已处理错误提示
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
