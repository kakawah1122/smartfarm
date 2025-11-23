// vaccine-record.ts - 疫苗接种记录页面
import { createPageWithNavbar } from '../../utils/navigation'
// 类型定义 - 用于替换any类型
type CustomEvent<T = any> = WechatMiniprogram.CustomEvent<T>;
type BaseEvent = WechatMiniprogram.BaseEvent;
interface ErrorWithMessage {
  message: string;
  [key: string]: any;
}

import CloudApi from '../../utils/cloud-api'
import type { VaccineFormData, PageOptions, BatchInfo } from '../types/prevention'
import { 
  ROUTE_OPTIONS,
  BATCHES_CACHE_DURATION,
  VALIDATE_DEBOUNCE_DELAY
} from '../constants/prevention-options'

interface PageData {
  formData: VaccineFormData
  routeOptions: typeof ROUTE_OPTIONS
  activeBatches: BatchInfo[]
  selectedRouteLabel: string
  selectedRouteIndex: number
  loading: boolean
  submitting: boolean
  showBatchPicker: boolean
  showRoutePicker: boolean
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
      vaccineName: '',
      manufacturer: '',
      batchNumber: '',
      expiryDate: '',
      dosage: '',
      route: 'muscle',
      targetCount: 0,
      actualCount: 0,
      operator: '',
      executionDate: '',
      executionTime: '',
      cost: 0,
      notes: '',
      adverseReactions: 0,
      nextSchedule: ''
    },
    
    // 使用常量配置
    routeOptions: ROUTE_OPTIONS,
    
    // 活跃批次列表
    activeBatches: [],
    batchesCacheTime: 0,
    
    // 显示文本和索引
    selectedRouteLabel: '肌肉注射',
    selectedRouteIndex: 0,
    
    // 页面状态
    loading: false,
    submitting: false,
    showBatchPicker: false,
    showRoutePicker: false,
    
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
    
    this.setData(updateData)
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

  // 显示给药途径选择器
  showRouteSelector() {
    this.setData({ showRoutePicker: true })
  },

  onRoutePickerChange(e: WechatMiniprogram.PickerChangeEvent) {
    const index = e.detail.value as number
    const selectedRoute = this.data.routeOptions[index]
    
    if (!selectedRoute) return
    
    this.setData({
      'formData.route': selectedRoute.value as VaccineFormData['route'],
      showRoutePicker: false
    })
    
    this.updateDisplayLabels()
    this.validateField('route', selectedRoute.value)
  },

  onRoutePickerCancel() {
    this.setData({ showRoutePicker: false })
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
      case 'batchId':
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          errors[field] = '请选择批次'
        } else {
          delete errors[field]
        }
        break
      case 'vaccineName':
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          errors[field] = '请输入疫苗名称'
        } else {
          delete errors[field]
        }
        break
      case 'targetCount':
        if (!value || (typeof value === 'number' && value <= 0)) {
          errors[field] = '目标接种数量必须大于0'
        } else {
          delete errors[field]
        }
        break
      case 'actualCount':
        if (typeof value === 'number' && value > this.data.formData.targetCount) {
          errors[field] = '实际接种数量不能超过目标数量'
        } else {
          delete errors[field]
        }
        break
      case 'adverseReactions':
        if (typeof value === 'number' && value > this.data.formData.actualCount) {
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
      
      // ✅ 使用CloudApi统一封装
      const result = await CloudApi.callFunction<{ recordId: string }>(
        'health-management',
        {
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
        },
        {
          loading: true,
          loadingText: '保存中...',
          showSuccess: true,
          successText: '疫苗接种记录保存成功'
        }
      )
      
      if (result.success) {
        // 如果有不良反应，提示是否进行AI诊断
        if (formData.adverseReactions > 0 && result.data?.recordId) {
          this.handleAdverseReaction(result.data.recordId)
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
            url: `/packageAI/ai-diagnosis/ai-diagnosis?sourceType=vaccine_adverse&sourceRecordId=${preventionRecordId}&symptoms=疫苗接种不良反应&affectedCount=${this.data.formData.adverseReactions}`
          })
        } else {
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
