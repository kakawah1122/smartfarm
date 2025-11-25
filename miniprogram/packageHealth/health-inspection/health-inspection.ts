// health-inspection.ts - 健康巡检页面
import { createPageWithNavbar } from '../../utils/navigation'
import { HealthCloud } from '../../utils/cloud-functions'
import { safeCloudCall } from '../../utils/safe-cloud-call'
import type { BatchInfo } from '../types/prevention'
import type {
  AbnormalFinding,
  HealthInspectionData,
  InspectionCategory,
  InspectionItem,
  InspectionResult
} from '../types/inspection'
import {
  createDefaultAbnormalForm,
  createDefaultCategories,
  createDefaultFormData,
  createDefaultInspectionItems,
  createDefaultStats,
  INSPECTION_BATCHES_CACHE_DURATION
} from '../constants/inspection-defaults'

const getDefaultActiveCategory = (categories: InspectionCategory[]): string => categories[0]?.id || 'spirit'

const createInitialPageData = (): HealthInspectionData => {
  const inspectionCategories = createDefaultCategories()

  return {
    formData: createDefaultFormData(),
    inspectionItems: createDefaultInspectionItems(),
    inspectionCategories,
    abnormalFindings: [],
    activeBatches: [],
    activeCategory: getDefaultActiveCategory(inspectionCategories),
    calculatedStats: createDefaultStats(),
    formErrors: {},
    submitting: false,
    showAbnormalDialog: false,
    currentAbnormalItem: null,
    abnormalForm: createDefaultAbnormalForm(),
    loadingBatches: false,
    batchesCacheTime: null
  }
}

type FormFieldKey = keyof HealthInspectionData['formData']
type AbnormalFormField = keyof HealthInspectionData['abnormalForm']
type AbnormalSeverity = AbnormalFinding['severity']

interface ValueChangeDetail {
  value: string
}

interface DatasetEvent<T extends Record<string, unknown>, Detail = any> {
  detail: Detail
  currentTarget: {
    dataset: T
  }
}

interface HealthInspectionPageOptions {
  batchId?: string
  locationId?: string
}

type EffectivenessLevel = 'excellent' | 'good' | 'poor'

interface InspectionRecordPayload {
  inspector: string
  inspectionItems: string[]
  abnormalFindings: string[]
  totalInspected: number
  abnormalCount: number
  notes: string
  itemResults: Array<{
    itemId: string
    itemName: string
    result: InspectionResult
  }>
}

interface CreateInspectionRecordPayload {
  action: 'create_prevention_record'
  preventionType: 'inspection'
  batchId: string
  locationId: string
  inspectionRecord: InspectionRecordPayload
  executionDate: string
  executionTime: string
  operator: string
  effectiveness: EffectivenessLevel
}

interface CreateInspectionRecordResponse {
  recordId: string
}

const normalizeInspectionResult = (value: string | undefined): InspectionResult => {
  switch (value) {
    case 'normal':
    case 'abnormal':
    case 'not_checked':
      return value
    default:
      return 'not_checked'
  }
}

const pageConfig: WechatMiniprogram.Page.Options<HealthInspectionData, WechatMiniprogram.Page.CustomOption> = {
  data: createInitialPageData(),


  onLoad(options: HealthInspectionPageOptions = {}) {
    this.initializeForm()

    const updates: Record<string, unknown> = {}

    if (options.batchId) {
      updates['formData.batchId'] = options.batchId
    }

    if (options.locationId) {
      updates['formData.locationId'] = options.locationId
    }

    if (Object.keys(updates).length > 0) {
      this.setData(updates)
    }
  },

  async onShow() {
    const { batchesCacheTime, loadingBatches } = this.data

    if (loadingBatches) {
      return
    }

    if (batchesCacheTime && Date.now() - batchesCacheTime < INSPECTION_BATCHES_CACHE_DURATION) {
      return
    }

    await this.loadActiveBatches()
  },


  // 表单输入处理
  onFormInput(e: DatasetEvent<{ field: FormFieldKey }, ValueChangeDetail>) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail

    
    this.setData({
      [`formData.${field}`]: value
    })
    
    this.validateField(field, value)
  },

  // 数字输入处理
  onNumberInput(e: DatasetEvent<{ field: FormFieldKey }, ValueChangeDetail>) {
    const { field } = e.currentTarget.dataset
    const value = parseInt(e.detail.value) || 0

    
    this.setData({
      [`formData.${field}`]: value
    })
    
    // 如果是影响统计的字段，重新计算统计数据
    if (field === 'totalInspected' || field === 'abnormalCount') {
      this.calculateStats()
    }
    
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
    
    const itemList = this.data.activeBatches.map((batch: BatchInfo) => batch.displayName)
    
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const selectedBatch = this.data.activeBatches[res.tapIndex]
        this.setData({
          'formData.batchId': selectedBatch.batchNumber,
          'formData.locationId': selectedBatch.location || ''
        })
        this.validateField('batchId', selectedBatch.batchNumber)
        this.validateField('locationId', selectedBatch.location || '')
      }
    })
  },

  // 切换巡检类别
  onCategoryChange(e: DatasetEvent<{ category: string }>) {
    const { category } = e.currentTarget.dataset
    this.setData({ activeCategory: category })
  },

  // 切换巡检项目选择状态
  onItemToggle(e: DatasetEvent<{ itemId: string }>) {
    const { itemId } = e.currentTarget.dataset
    const items = this.data.inspectionItems.map((item: InspectionItem): InspectionItem => {
      if (item.id === itemId) {
        const checked = !item.checked
        const result: InspectionResult = checked ? 'not_checked' : item.result
        return { ...item, checked, result }
      }
      return item
    })
    
    this.setData({ inspectionItems: items })
  },

  // 设置巡检项目结果
  onItemResultChange(e: DatasetEvent<{ itemId: string; result: InspectionResult }>) {
    const { itemId, result: rawResult } = e.currentTarget.dataset
    const result = normalizeInspectionResult(rawResult)
    const items = this.data.inspectionItems.map((item: InspectionItem): InspectionItem => {
      if (item.id === itemId) {
        return { ...item, result }
      }
      return item
    })
    
    this.setData({ inspectionItems: items })
    
    // 如果标记为异常，显示异常记录对话框
    if (result === 'abnormal') {
      const abnormalItem = items.find((item: InspectionItem) => item.id === itemId)
      this.setData({
        currentAbnormalItem: abnormalItem,
        showAbnormalDialog: true,
        abnormalForm: createDefaultAbnormalForm()
      })
    }
  },

  // 异常记录对话框处理
  onAbnormalFormInput(e: DatasetEvent<{ field: AbnormalFormField }, ValueChangeDetail>) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    this.setData({
      [`abnormalForm.${field}`]: field === 'affectedCount' ? (parseInt(value) || 1) : value
    })
  },

  onAbnormalSeverityChange(e: DatasetEvent<{ severity: AbnormalSeverity }>) {
    const { severity } = e.currentTarget.dataset
    this.setData({
      'abnormalForm.severity': severity
    })
  },

  // 保存异常记录
  saveAbnormalFinding() {
    const { currentAbnormalItem, abnormalForm, abnormalFindings } = this.data
    
    if (!currentAbnormalItem) return
    
    if (!abnormalForm.description.trim()) {
      wx.showToast({
        title: '请描述异常情况',
        icon: 'none'
      })
      return
    }
    
    // 检查是否已存在该项目的异常记录
    const existingIndex = abnormalFindings.findIndex(finding => finding.itemId === currentAbnormalItem.id)
    
    const newFinding: AbnormalFinding = {
      id: `abnormal_${currentAbnormalItem.id}_${Date.now()}`,
      itemId: currentAbnormalItem.id,
      itemName: currentAbnormalItem.name,
      description: abnormalForm.description,
      affectedCount: abnormalForm.affectedCount,
      severity: abnormalForm.severity
    }
    
    let updatedFindings
    if (existingIndex >= 0) {
      // 更新现有记录
      updatedFindings = [...abnormalFindings]
      updatedFindings[existingIndex] = newFinding
    } else {
      // 添加新记录
      updatedFindings = [...abnormalFindings, newFinding]
    }
    
    this.setData(
      {
        abnormalFindings: updatedFindings,
        showAbnormalDialog: false,
        currentAbnormalItem: null
      },
      () => {
        // 重新计算异常总数
        this.updateAbnormalCount()
      }
    )
  },

  // 取消异常记录
  cancelAbnormalFinding() {
    // 将对应项目的结果重置为未检查
    const { currentAbnormalItem } = this.data
    if (currentAbnormalItem) {
      const updatedItems = this.data.inspectionItems.map((item: InspectionItem): InspectionItem => {
        if (item.id === currentAbnormalItem.id) {
          return { ...item, result: 'not_checked' }
        }
        return item
      })
      
      this.setData({ inspectionItems: updatedItems })
    }

    this.setData({
      showAbnormalDialog: false,
      currentAbnormalItem: null
    })
  },

  // 删除异常记录
  deleteAbnormalFinding(e: DatasetEvent<{ findingId: string }>) {
    const { findingId } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认删除',
      content: '是否删除这条异常记录？',
      success: (res) => {
        if (res.confirm) {
          const { abnormalFindings, inspectionItems } = this.data
          const targetFinding = abnormalFindings.find(f => f.id === findingId)
          const updatedFindings = abnormalFindings.filter(finding => finding.id !== findingId)
          const updatedItems = targetFinding
            ? inspectionItems.map((item: InspectionItem): InspectionItem => {
                if (item.id === targetFinding.itemId) {
                  return { ...item, result: 'not_checked' }
                }
                return item
              })
            : inspectionItems

          this.setData(
            {
              abnormalFindings: updatedFindings,
              inspectionItems: updatedItems
            },
            () => {
              this.updateAbnormalCount()
            }
          )
        }
      }
    })
  },

  // 更新异常个体总数
  updateAbnormalCount() {
    const totalAbnormal = this.data.abnormalFindings.reduce((sum, finding) => sum + finding.affectedCount, 0)
    this.setData(
      {
        'formData.abnormalCount': totalAbnormal
      },
      () => {
        this.calculateStats()
      }
    )
  },

  // 日期时间选择器
  onDateChange(e: DatasetEvent<{ field: FormFieldKey }, ValueChangeDetail>) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
    this.validateField(field, e.detail.value)
  },

  onTimeChange(e: DatasetEvent<{ field: FormFieldKey }, ValueChangeDetail>) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`formData.${field}`]: e.detail.value
    })
    this.validateField(field, e.detail.value)
  },

  // 字段验证
  validateField(field: string, value: unknown) {
    const errors = { ...this.data.formErrors }
    const strValue = String(value || '')
    const numValue = Number(value) || 0
    
    switch (field) {
      case 'batchId':
        if (!value) {
          errors[field] = '请选择巡检批次'
        } else {
          delete errors[field]
        }
        break
      case 'locationId':
        if (!strValue || strValue.trim().length === 0) {
          errors[field] = '请输入巡检位置'
        } else {
          delete errors[field]
        }
        break
      case 'inspector':
        if (!strValue || strValue.trim().length === 0) {
          errors[field] = '请输入检查员姓名'
        } else {
          delete errors[field]
        }
        break
      case 'totalInspected':
        if (!value || numValue <= 0) {
          errors[field] = '巡检数量必须大于0'
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
    if (!formData.batchId) errors.batchId = '请选择巡检批次'
    if (!formData.locationId) errors.locationId = '请输入巡检位置'
    if (!formData.inspector) errors.inspector = '请输入检查员姓名'
    if (!formData.totalInspected || formData.totalInspected <= 0) errors.totalInspected = '巡检数量必须大于0'
    if (!formData.inspectionDate) errors.inspectionDate = '请选择巡检日期'
    
    // 检查是否至少选择了一些巡检项目
    const checkedItems = this.data.inspectionItems.filter(item => item.checked)
    if (checkedItems.length === 0) {
      errors.inspectionItems = '请至少选择一个巡检项目'
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
      const { formData, inspectionItems, abnormalFindings } = this.data
      const selectedItems = inspectionItems.filter((item: InspectionItem) => item.checked)

      const inspectionRecord: InspectionRecordPayload = {
        inspector: formData.inspector,
        inspectionItems: selectedItems.map(item => item.name),
        abnormalFindings: abnormalFindings.map((finding: AbnormalFinding) => finding.description),
        totalInspected: formData.totalInspected,
        abnormalCount: formData.abnormalCount,
        notes: formData.notes,
        itemResults: selectedItems.map(item => ({
          itemId: item.id,
          itemName: item.name,
          result: item.result
        }))
      }

      const payload: CreateInspectionRecordPayload = {
        action: 'create_prevention_record',
        preventionType: 'inspection',
        batchId: formData.batchId,
        locationId: formData.locationId,
        inspectionRecord,
        executionDate: formData.inspectionDate,
        executionTime: formData.inspectionTime,
        operator: formData.inspector,
        effectiveness: this.deriveEffectiveness(abnormalFindings.length)
      }

      wx.showLoading({ title: '保存中...' })
      
      const response = await HealthCloud.prevention.create(payload) as { success: boolean; data?: CreateInspectionRecordResponse; error?: string }
      
      wx.hideLoading()

      if (response.success && response.data?.recordId) {
        wx.showToast({ title: '健康巡检记录保存成功', icon: 'success' })
        if (abnormalFindings.length > 0) {
          this.handleAbnormalFindings(response.data.recordId)
        } else {
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        }
      } else if (!response.success) {
        throw new Error(response.error || '保存失败')
      } else {
        throw new Error('保存结果异常，请稍后重试')
      }
    } catch (error) {
      wx.showToast({
        title: (error as Error).message || '保存失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 处理异常发现
  handleAbnormalFindings(preventionRecordId: string) {
    const { abnormalFindings } = this.data
    const totalAbnormal = abnormalFindings.reduce((sum, finding) => sum + finding.affectedCount, 0)
    
    wx.showModal({
      title: '发现健康异常',
      content: `巡检发现${abnormalFindings.length}项异常，涉及${totalAbnormal}只个体。是否立即进行AI诊断？`,
      confirmText: '立即诊断',
      cancelText: '稍后处理',
      success: (res) => {
        if (res.confirm) {
          // 跳转到AI诊断页面
          const symptoms = abnormalFindings.map(finding => `${finding.itemName}：${finding.description}`).join('；')
          wx.navigateTo({
            url: `/packageAI/ai-diagnosis/ai-diagnosis?sourceType=inspection&sourceRecordId=${preventionRecordId}&symptoms=${encodeURIComponent(symptoms)}&affectedCount=${totalAbnormal}`
          })
        } else {
          // 返回上一页
          wx.navigateBack()
        }
      }
    })
  },

  // 快速标记所有项目为正常
  markAllNormal() {
    wx.showModal({
      title: '快速标记',
      content: '是否将所有已选择的巡检项目标记为正常？',
      success: (res) => {
        if (res.confirm) {
          const items = this.data.inspectionItems.map((item: InspectionItem): InspectionItem => {
            if (item.checked) {
              return { ...item, result: 'normal' as InspectionResult }
            }
            return item
          })
          
          this.setData({ 
            inspectionItems: items,
            abnormalFindings: []
          }, () => {
            this.updateAbnormalCount()
          })
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
          const resetItems = createDefaultInspectionItems()
          this.setData({
            inspectionItems: resetItems
          }, () => {
            this.initializeForm()
          })
        }
      }
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  deriveEffectiveness(abnormalCount: number): EffectivenessLevel {
    if (abnormalCount === 0) {
      return 'excellent'
    }

    if (abnormalCount > 3) {
      return 'poor'
    }

    return 'good'
  },

  async loadActiveBatches() {
    if (this.data.loadingBatches) {
      return
    }

    this.setData({ loadingBatches: true })

    try {
      const response = await safeCloudCall<{ success: boolean; data?: { batches: BatchInfo[] }; error?: string }>({
        name: 'production-entry',
        data: { action: 'getActiveBatches' }
      })

      if (response.success && Array.isArray(response.data?.batches)) {
        this.setData({
          activeBatches: response.data.batches,
          batchesCacheTime: Date.now()
        })
      } else {
        wx.showToast({
          title: response.error || '批次加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      wx.showToast({
        title: (error as Error).message || '批次加载失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loadingBatches: false })
    }
  },

  initializeForm() {
    const activeCategory = getDefaultActiveCategory(
      this.data.inspectionCategories.length > 0 ? this.data.inspectionCategories : createDefaultCategories()
    )

    this.setData({
      formData: createDefaultFormData(),
      abnormalFindings: [],
      abnormalForm: createDefaultAbnormalForm(),
      calculatedStats: createDefaultStats(),
      formErrors: {},
      submitting: false,
      showAbnormalDialog: false,
      currentAbnormalItem: null,
      activeCategory
    }, () => {
      this.calculateStats()
    })
  },

  calculateStats() {
    const { inspectionItems, formData } = this.data
    const checkedItems = inspectionItems.filter(item => item.checked)
    const completedItems = checkedItems.filter(item => item.result !== 'not_checked')
    const totalInspected = formData.totalInspected
    const abnormalCount = formData.abnormalCount

    const abnormalDiscoveryRate = totalInspected > 0 ? ((abnormalCount / totalInspected) * 100).toFixed(1) : '0.0'
    const completionRate = checkedItems.length > 0 ? ((completedItems.length / checkedItems.length) * 100).toFixed(1) : '0.0'
    const normalCount = Math.max(totalInspected - abnormalCount, 0)

    this.setData({
      calculatedStats: {
        abnormalDiscoveryRate,
        normalCount,
        completionRate
      }
    })
  }
}

Page(createPageWithNavbar(pageConfig as Parameters<typeof createPageWithNavbar>[0]))
