/**
 * 健康管理 - 疫苗接种模块
 * 负责疫苗接种相关的表单处理、数据验证和提交
 * 保持原有功能和UI完全不变
 */

import { getCurrentBeijingDate } from '../../../utils/util'
import { FormValidator, vaccineFormRules } from '../helpers/form-validator'
import { withErrorHandler } from '../helpers/error-handler'
import CloudApi from '../../../utils/cloud-api'

// 疫苗接种模块管理器
export class VaccineModuleManager {
  private pageInstance: any
  
  constructor(pageInstance: any) {
    this.pageInstance = pageInstance
  }
  
  /**
   * 初始化疫苗表单数据
   */
  initVaccineForm(task: any) {
    // 获取当前批次的存栏数量
    const currentBatchStockQuantity = (() => {
      const currentBatch = this.pageInstance.data.availableBatches?.find((b: any) => 
        b._id === this.pageInstance.data.currentBatchId || 
        b.batchNumber === this.pageInstance.data.currentBatchNumber
      )
      
      if (currentBatch) {
        return currentBatch.totalAnimals || currentBatch.currentQuantity || 0
      }
      
      // 如果找不到批次数据，尝试从健康统计获取
      const stats = this.pageInstance.data.healthStats || {}
      const totalAnimals = stats.totalAnimals || 0
      const deadCount = stats.deadCount || 0
      if (totalAnimals > deadCount) {
        return totalAnimals - deadCount
      }
      
      return 0
    })()
    
    const vaccineFormData = {
      veterinarianName: '',
      veterinarianContact: '',
      vaccineName: task.title || '',
      manufacturer: '',
      batchNumber: '',
      dosage: '0.5ml/只',
      routeIndex: 0,
      vaccinationCount: currentBatchStockQuantity || 0,
      location: '',
      vaccineCost: '',
      veterinaryCost: '',
      otherCost: '',
      totalCost: 0,
      totalCostFormatted: '¥0.00',
      notes: ''
    }
    
    this.pageInstance.setData({
      selectedTask: task,
      currentBatchStockQuantity: Number(currentBatchStockQuantity) || 0,
      vaccineFormData,
      vaccineFormErrors: {}
    })
  }
  
  /**
   * 处理疫苗表单输入
   */
  onVaccineFormInput(e: WechatMiniprogram.CustomEvent) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    // 处理数字输入
    let actualValue = value
    if (['vaccinationCount', 'vaccineCost', 'veterinaryCost', 'otherCost'].includes(field)) {
      const num = parseFloat(value)
      if (isNaN(num) || num < 0) {
        actualValue = 0
      } else {
        actualValue = num
      }
    }
    
    if (!field) return
    
    this.pageInstance.setData({
      [`vaccineFormData.${field}`]: actualValue
    })
    
    // 清除对应字段的错误
    if (this.pageInstance.data.vaccineFormErrors[field]) {
      const newErrors = { ...this.pageInstance.data.vaccineFormErrors }
      delete newErrors[field]
      this.pageInstance.setData({
        vaccineFormErrors: newErrors,
        vaccineFormErrorList: Object.values(newErrors)
      })
    }
  }
  
  /**
   * 处理疫苗表单数字输入
   */
  onVaccineFormNumberInput(e: WechatMiniprogram.CustomEvent) {
    const { field } = e.currentTarget.dataset
    const { value } = e.detail
    
    const num = parseFloat(value)
    const actualValue = isNaN(num) || num < 0 ? 0 : num
    
    if (field === 'vaccinationCount') {
      const vaccinationCount = parseInt(actualValue.toString()) || 0
      this.pageInstance.setData({
        [`vaccineFormData.${field}`]: vaccinationCount
      })
      
      // 验证不超过存栏数量
      const { currentBatchStockQuantity } = this.pageInstance.data
      if (currentBatchStockQuantity > 0 && vaccinationCount > currentBatchStockQuantity) {
        const newErrors = { ...this.pageInstance.data.vaccineFormErrors }
        newErrors.vaccinationCount = `接种数量不能超过存栏数量${currentBatchStockQuantity}只`
        this.pageInstance.setData({
          vaccineFormErrors: newErrors,
          vaccineFormErrorList: Object.values(newErrors)
        })
      } else if (this.pageInstance.data.vaccineFormErrors.vaccinationCount) {
        // 清除错误
        const newErrors = { ...this.pageInstance.data.vaccineFormErrors }
        delete newErrors.vaccinationCount
        this.pageInstance.setData({
          vaccineFormErrors: newErrors,
          vaccineFormErrorList: Object.values(newErrors)
        })
      }
    } else {
      this.pageInstance.setData({
        [`vaccineFormData.${field}`]: actualValue
      }, () => {
        // 如果是费用相关字段，重新计算总费用
        if (['vaccineCost', 'veterinaryCost', 'otherCost'].includes(field)) {
          this.calculateTotalCost()
        }
      })
    }
  }
  
  /**
   * 处理路线选择变化
   */
  onVaccineRouteChange(e: WechatMiniprogram.CustomEvent) {
    const { value } = e.detail
    this.pageInstance.setData({
      'vaccineFormData.routeIndex': parseInt(value)
    })
  }
  
  /**
   * 计算总费用
   */
  calculateTotalCost() {
    const { vaccineFormData } = this.pageInstance.data
    const vaccineCost = parseFloat(vaccineFormData.vaccineCost?.toString() || '0') || 0
    const veterinaryCost = parseFloat(vaccineFormData.veterinaryCost?.toString() || '0') || 0
    const otherCost = parseFloat(vaccineFormData.otherCost?.toString() || '0') || 0
    const totalCost = vaccineCost + veterinaryCost + otherCost
    
    const totalCostFormatted = `¥${totalCost.toFixed(2)}`
    
    this.pageInstance.setData({
      vaccineFormData: {
        ...this.pageInstance.data.vaccineFormData,
        totalCost: totalCost,
        totalCostFormatted: totalCostFormatted
      }
    })
  }
  
  /**
   * 验证疫苗表单
   */
  validateVaccineForm(): boolean {
    const { vaccineFormData } = this.pageInstance.data
    const validation = FormValidator.validateForm(vaccineFormData, vaccineFormRules)
    
    // 更新错误对象和错误列表
    this.pageInstance.setData({ 
      vaccineFormErrors: validation.errors,
      vaccineFormErrorList: validation.errorList
    })
    
    if (!validation.isValid) {
      wx.showToast({
        title: validation.errorList[0] || '请完善表单信息',
        icon: 'none'
      })
    }
    
    return validation.isValid
  }
  
  /**
   * 提交疫苗表单
   */
  async submitVaccineForm(e?: any): Promise<boolean> {
    // 适配组件事件：如果是从组件传递的事件，使用事件中的formData
    const formDataFromEvent = e?.detail?.formData
    const vaccineFormData = formDataFromEvent || this.pageInstance.data.vaccineFormData
    
    if (!this.validateVaccineForm()) {
      return false
    }
    
    wx.showLoading({ title: '提交中...' })
    
    const { 
      selectedTask, 
      currentBatchId, 
      currentBatchNumber, 
      vaccineRouteOptions 
    } = this.pageInstance.data
    
    const actualBatchId = currentBatchId === 'all' || !currentBatchId 
      ? (selectedTask?.batchId || selectedTask?.batchNumber || '') 
      : currentBatchId
      
    const actualBatchNumber = currentBatchNumber === '全部批次' || !currentBatchNumber
      ? (selectedTask?.batchNumber || '')
      : currentBatchNumber
    
    const recordData = {
      batchId: actualBatchId,
      batchNumber: actualBatchNumber,
      preventionType: 'vaccine',
      preventionDate: getCurrentBeijingDate(),
      vaccineInfo: {
        name: vaccineFormData.vaccineName,
        manufacturer: vaccineFormData.manufacturer,
        batchNumber: vaccineFormData.batchNumber,
        dosage: vaccineFormData.dosage,
        route: vaccineRouteOptions[vaccineFormData.routeIndex],
        count: vaccineFormData.vaccinationCount,
        location: vaccineFormData.location
      },
      veterinarianInfo: {
        name: vaccineFormData.veterinarianName,
        contact: vaccineFormData.veterinarianContact
      },
      costInfo: {
        vaccineCost: parseFloat(vaccineFormData.vaccineCost || '0'),
        veterinaryCost: parseFloat(vaccineFormData.veterinaryCost || '0'),
        otherCost: parseFloat(vaccineFormData.otherCost || '0'),
        totalCost: vaccineFormData.totalCost,
        shouldSyncToFinance: true
      },
      notes: vaccineFormData.notes
    }
    
    const success = await withErrorHandler(
      async () => {
        const result = await CloudApi.callFunction(
          'health-prevention',
          {
            action: 'createRecord',
            data: recordData
          }
        ) as any
        
        if (result?.result?.success) {
          wx.showToast({
            title: '提交成功',
            icon: 'success'
          })
          
          // 完成任务
          if (selectedTask?.id || selectedTask?._id) {
            await this.completeTask(selectedTask.id || selectedTask._id)
          }
          
          // 关闭表单
          this.pageInstance.setData({ showVaccineFormPopup: false })
          
          // 刷新数据
          this.pageInstance.loadPreventionData()
          
          return true
        } else {
          throw new Error(result?.result?.error || '提交失败')
        }
      },
      {
        errorText: '提交疫苗记录失败',
        showError: true
      }
    )
    
    wx.hideLoading()
    return success
  }
  
  /**
   * 完成任务
   */
  private async completeTask(taskId: string) {
    try {
      await CloudApi.callFunction(
        'breeding-todo',
        {
          action: 'completeTask',
          taskId: taskId,
          batchId: this.pageInstance.data.currentBatchId
        }
      )
    } catch (error) {
      console.error('完成任务失败:', error)
    }
  }
  
  /**
   * 关闭疫苗表单
   */
  closeVaccineForm() {
    this.pageInstance.setData({
      showVaccineFormPopup: false,
      selectedTask: null
    })
  }
}

/**
 * 创建疫苗模块实例
 */
export function createVaccineModule(pageInstance: any) {
  return new VaccineModuleManager(pageInstance)
}
