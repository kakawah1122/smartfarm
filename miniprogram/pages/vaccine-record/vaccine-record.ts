// vaccine-record.ts - 疫苗接种记录页面
import { createPageWithNavbar } from '../../utils/navigation'

const pageConfig: WechatMiniprogram.Page.Options<any, any> = {
  data: {
    // 表单数据
    formData: {
      batchId: '',
      locationId: '',
      vaccineName: '',
      manufacturer: '',
      batchNumber: '',
      expiryDate: '',
      dosage: '',
      route: 'muscle', // muscle|subcutaneous|oral|nasal
      targetCount: 0,
      actualCount: 0,
      operator: '',
      executionDate: '',
      executionTime: '',
      cost: 0,
      notes: '',
      adverseReactions: 0, // 不良反应数量
      nextSchedule: '' // 下次接种时间
    },
    
    // 选择器数据
    routeOptions: [
      { label: '肌肉注射', value: 'muscle' },
      { label: '皮下注射', value: 'subcutaneous' },
      { label: '口服', value: 'oral' },
      { label: '滴鼻', value: 'nasal' }
    ],
    
    // 活跃批次列表
    activeBatches: [] as any[],
    
    // 显示文本和索引
    selectedRouteLabel: '皮下注射',
    selectedRouteIndex: 0,
    
    // 页面状态
    loading: false,
    submitting: false,
    showBatchPicker: false,
    showRoutePicker: false,
    
    // 表单验证
    formErrors: {} as Record<string, string>,
    
    // 来源类型（normal|from_prevention_plan）
    sourceType: 'normal',
    sourceId: ''
  },

  onLoad(options: any) {
    const { sourceType, sourceId, batchId } = options || {}
    
    this.setData({
      sourceType: sourceType || 'normal',
      sourceId: sourceId || ''
    })
    
    if (batchId) {
      this.setData({
        'formData.batchId': batchId
      })
    }
    
    this.initializeForm()
  },

  // 更新显示标签
  updateDisplayLabels() {
    const { formData, routeOptions } = this.data
    const routeIndex = routeOptions.findIndex(item => item.value === formData.route)
    const selectedRoute = routeOptions[routeIndex]
    
    this.setData({
      selectedRouteLabel: selectedRoute?.label || '请选择',
      selectedRouteIndex: Math.max(0, routeIndex)
    })
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
      console.error('加载活跃批次失败:', error)
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

  // 显示给药途径选择器
  showRouteSelector() {
    this.setData({ showRoutePicker: true })
  },

  onRoutePickerChange(e: any) {
    const index = e.detail.value
    const selectedRoute = this.data.routeOptions[index]
    
    this.setData({
      'formData.route': selectedRoute.value,
      showRoutePicker: false
    })
    
    this.updateDisplayLabels()
    this.validateField('route', selectedRoute.value)
  },

  onRoutePickerCancel() {
    this.setData({ showRoutePicker: false })
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
          errors[field] = '请选择批次'
        } else {
          delete errors[field]
        }
        break
      case 'vaccineName':
        if (!value || value.trim().length === 0) {
          errors[field] = '请输入疫苗名称'
        } else {
          delete errors[field]
        }
        break
      case 'targetCount':
        if (!value || value <= 0) {
          errors[field] = '目标接种数量必须大于0'
        } else {
          delete errors[field]
        }
        break
      case 'actualCount':
        if (value > this.data.formData.targetCount) {
          errors[field] = '实际接种数量不能超过目标数量'
        } else {
          delete errors[field]
        }
        break
      case 'adverseReactions':
        if (value > this.data.formData.actualCount) {
          errors[field] = '不良反应数量不能超过实际接种数量'
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
    if (!formData.batchId) errors.batchId = '请选择批次'
    if (!formData.vaccineName) errors.vaccineName = '请输入疫苗名称'
    if (!formData.targetCount || formData.targetCount <= 0) errors.targetCount = '目标接种数量必须大于0'
    if (!formData.executionDate) errors.executionDate = '请选择执行日期'
    if (!formData.operator) errors.operator = '请输入操作员'
    
    // 逻辑验证
    if (formData.actualCount > formData.targetCount) {
      errors.actualCount = '实际接种数量不能超过目标数量'
    }
    
    if (formData.adverseReactions > formData.actualCount) {
      errors.adverseReactions = '不良反应数量不能超过实际接种数量'
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
      
      // 构建疫苗记录数据
      const vaccineRecord = {
        vaccineName: formData.vaccineName,
        manufacturer: formData.manufacturer,
        batchNumber: formData.batchNumber,
        expiryDate: formData.expiryDate,
        dosage: formData.dosage,
        route: formData.route,
        targetCount: formData.targetCount,
        actualCount: formData.actualCount,
        adverseReactions: formData.adverseReactions,
        nextSchedule: formData.nextSchedule
      }
      
      // 调用云函数创建预防记录
      const result = await wx.cloud.callFunction({
        name: 'health-management',
        data: {
          action: 'create_prevention_record',
          preventionType: 'vaccine',
          batchId: formData.batchId,
          locationId: formData.locationId,
          vaccineRecord,
          executionDate: formData.executionDate,
          executionTime: formData.executionTime,
          operator: formData.operator,
          cost: formData.cost,
          notes: formData.notes,
          sourceType: this.data.sourceType,
          sourceId: this.data.sourceId
        }
      })
      
      if (result.result && result.result.success) {
        wx.showToast({
          title: '疫苗接种记录保存成功',
          icon: 'success'
        })
        
        // 如果有不良反应，提示是否进行AI诊断
        if (formData.adverseReactions > 0) {
          this.handleAdverseReaction(result.result.data.recordId)
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
      console.error('提交疫苗接种记录失败:', error)
      wx.showToast({
        title: error.message || '保存失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 处理不良反应
  handleAdverseReaction(preventionRecordId: string) {
    wx.showModal({
      title: '检测到不良反应',
      content: `发现${this.data.formData.adverseReactions}只不良反应，是否立即进行AI诊断？`,
      confirmText: '立即诊断',
      cancelText: '稍后处理',
      success: (res) => {
        if (res.confirm) {
          // 跳转到AI诊断页面
          wx.navigateTo({
            url: `/pages/ai-diagnosis/ai-diagnosis?sourceType=vaccine_adverse&sourceRecordId=${preventionRecordId}&symptoms=疫苗接种不良反应&affectedCount=${this.data.formData.adverseReactions}`
          })
        } else {
          // 返回上一页
          wx.navigateBack()
        }
      }
    })
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
              vaccineName: '',
              manufacturer: '',
              batchNumber: '',
              expiryDate: '',
              dosage: '',
              route: 'muscle',
              targetCount: 0,
              actualCount: 0,
              cost: 0,
              notes: '',
              adverseReactions: 0,
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
