/**
 * 健康管理表单处理模块
 * 负责处理各种健康管理相关的表单提交
 */

/// <reference path="../../../typings/index.d.ts" />

import { HealthCloud } from '../../utils/cloud-functions'

export interface VaccineFormData {
  vaccinationDate: string
  batchId: string
  vaccineType: string
  vaccineName: string
  manufacturer: string
  batchNumber: string
  dosage: string
  vaccinationCount: number
  vaccinationMethod: string
  operator: string
  notes: string
  vaccineCost: string
  veterinaryCost: string
  otherCost: string
  totalCost: number
}

export interface DisinfectionFormData {
  disinfectionDate: string
  batchId: string
  disinfectionArea: string
  disinfectant: string
  concentration: string
  method: string
  operator: string
  notes: string
}

/**
 * 表单处理器类
 */
export class HealthFormHandler {
  /**
   * 提交疫苗接种表单
   */
  static async submitVaccineForm(formData: VaccineFormData): Promise<unknown> {
    try {
      // 数据验证
      if (!formData.batchId) {
        throw new Error('请选择批次')
      }
      
      if (!formData.vaccineName) {
        throw new Error('请输入疫苗名称')
      }
      
      // 准备提交数据
      const submitData = {
        action: 'completePreventionTask',
        taskId: `vaccine_${Date.now()}`,
        batchId: formData.batchId,
        preventionData: {
          preventionType: 'vaccine',
          preventionDate: formData.vaccinationDate || new Date().toISOString(),
          vaccineInfo: {
            name: formData.vaccineName,
            type: formData.vaccineType,
            manufacturer: formData.manufacturer,
            batchNumber: formData.batchNumber,
            dosage: formData.dosage
          },
          vaccinationCount: formData.vaccinationCount || 0,
          vaccinationMethod: formData.vaccinationMethod,
          operator: formData.operator,
          notes: formData.notes
        },
        costInfo: {
          vaccineCost: parseFloat(formData.vaccineCost || '0'),
          veterinaryCost: parseFloat(formData.veterinaryCost || '0'),
          otherCost: parseFloat(formData.otherCost || '0'),
          totalCost: formData.totalCost,
          shouldSyncToFinance: true
        }
      }
      
      // 调用云函数
      const cloudResult = await HealthCloud.prevention.completeTask(submitData)
      
      if (cloudResult?.success) {
        return cloudResult
      }
      
      throw new Error(cloudResult?.error || '提交失败')
    } catch (error) {
      console.error('提交疫苗表单失败:', error)
      throw error
    }
  }
  
  /**
   * 提交消毒表单
   */
  static async submitDisinfectionForm(formData: DisinfectionFormData): Promise<unknown> {
    try {
      // 数据验证
      if (!formData.batchId) {
        throw new Error('请选择批次')
      }
      
      if (!formData.disinfectant) {
        throw new Error('请输入消毒剂名称')
      }
      
      // 准备提交数据
      const submitData = {
        action: 'completePreventionTask',
        taskId: `disinfection_${Date.now()}`,
        batchId: formData.batchId,
        preventionData: {
          preventionType: 'disinfection',
          preventionDate: formData.disinfectionDate || new Date().toISOString(),
          disinfectionInfo: {
            area: formData.disinfectionArea,
            disinfectant: formData.disinfectant,
            concentration: formData.concentration,
            method: formData.method
          },
          operator: formData.operator,
          notes: formData.notes
        }
      }
      
      // 调用云函数
      const cloudResult = await HealthCloud.prevention.completeTask(submitData)
      
      if (cloudResult?.success) {
        return cloudResult
      }
      
      throw new Error(cloudResult?.error || '提交失败')
    } catch (error) {
      console.error('提交消毒表单失败:', error)
      throw error
    }
  }
  
  /**
   * 验证表单数据
   */
  static validateFormData(formData: unknown, requiredFields: string[]): string[] {
    const errors: string[] = []
    
    requiredFields.forEach(field => {
      if (!formData[field]) {
        errors.push(`${field}不能为空`)
      }
    })
    
    return errors
  }
  
  /**
   * 格式化日期
   */
  static formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      date = new Date(date)
    }
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    return `${year}-${month}-${day}`
  }
  
  /**
   * 计算总费用
   */
  static calculateTotalCost(costs: { [key: string]: string | number }): number {
    let total = 0
    
    Object.values(costs).forEach(cost => {
      const value = typeof cost === 'string' ? parseFloat(cost) : cost
      if (!isNaN(value)) {
        total += value
      }
    })
    
    return total
  }
  
  /**
   * 重置表单数据
   */
  static resetFormData<T extends object>(defaultData: T): T {
    return { ...defaultData }
  }
}
