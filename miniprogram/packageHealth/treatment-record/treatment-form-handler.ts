/**
 * 治疗记录表单处理模块
 * 负责处理治疗记录相关的表单验证和提交
 */

/// <reference path="../../../typings/index.d.ts" />

import { TreatmentRecord, MedicationRecord } from './treatment-data-service'

/**
 * 治疗表单数据接口
 */
export interface TreatmentFormData {
  batchId: string
  animalIds: string[]
  symptoms: string
  diagnosis: string
  treatmentPlan: string
  veterinarianName: string
  veterinarianContact: string
  treatmentDate: string
  estimatedDuration?: number
  notes?: string
}

/**
 * 用药表单数据接口
 */
export interface MedicationFormData {
  medicineId: string
  medicineName: string
  dosage: string
  frequency: string
  duration: number
  quantity: number
  unit: string
  purpose?: string
  notes?: string
}

/**
 * 治疗表单处理类
 */
export class TreatmentFormHandler {
  /**
   * 验证治疗表单数据
   */
  static validateTreatmentForm(formData: Partial<TreatmentFormData>): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // 必填字段验证
    if (!formData.batchId) {
      errors.push('请选择批次')
    }

    if (!formData.animalIds || formData.animalIds.length === 0) {
      errors.push('请选择至少一只动物')
    }

    if (!formData.symptoms || formData.symptoms.trim().length === 0) {
      errors.push('请描述症状')
    }

    if (!formData.diagnosis || formData.diagnosis.trim().length === 0) {
      errors.push('请输入诊断结果')
    }

    if (!formData.treatmentPlan || formData.treatmentPlan.trim().length === 0) {
      errors.push('请输入治疗方案')
    }

    if (!formData.veterinarianName) {
      errors.push('请输入兽医姓名')
    }

    // 长度验证
    if (formData.symptoms && formData.symptoms.length > 500) {
      errors.push('症状描述不能超过500字')
    }

    if (formData.diagnosis && formData.diagnosis.length > 500) {
      errors.push('诊断结果不能超过500字')
    }

    if (formData.treatmentPlan && formData.treatmentPlan.length > 1000) {
      errors.push('治疗方案不能超过1000字')
    }

    // 联系方式验证
    if (formData.veterinarianContact) {
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(formData.veterinarianContact)) {
        errors.push('请输入正确的手机号码')
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    }
  }

  /**
   * 验证用药表单数据
   */
  static validateMedicationForm(formData: Partial<MedicationFormData>): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // 必填字段验证
    if (!formData.medicineId && !formData.medicineName) {
      errors.push('请选择或输入药品名称')
    }

    if (!formData.dosage) {
      errors.push('请输入用药剂量')
    }

    if (!formData.frequency) {
      errors.push('请输入用药频率')
    }

    if (!formData.quantity || formData.quantity <= 0) {
      errors.push('请输入正确的用药数量')
    }

    if (!formData.unit) {
      errors.push('请选择单位')
    }

    // 数值验证
    if (formData.duration && formData.duration <= 0) {
      errors.push('用药天数必须大于0')
    }

    if (formData.duration && formData.duration > 365) {
      errors.push('用药天数不能超过365天')
    }

    return {
      valid: errors.length === 0,
      errors: errors
    }
  }

  /**
   * 格式化治疗表单数据
   */
  static formatTreatmentFormData(formData: TreatmentFormData): Partial<TreatmentRecord> {
    return {
      batchId: formData.batchId,
      animalIds: formData.animalIds,
      symptoms: formData.symptoms.trim(),
      diagnosis: formData.diagnosis.trim(),
      treatmentPlan: formData.treatmentPlan.trim(),
      veterinarianName: formData.veterinarianName.trim(),
      veterinarianContact: formData.veterinarianContact?.trim() || '',
      treatmentDate: formData.treatmentDate || new Date().toISOString(),
      status: 'ongoing',
      notes: formData.notes?.trim() || '',
      medications: []
    }
  }

  /**
   * 格式化用药表单数据
   */
  static formatMedicationFormData(formData: MedicationFormData): MedicationRecord {
    return {
      medicineId: formData.medicineId || '',
      medicineName: formData.medicineName.trim(),
      dosage: formData.dosage.trim(),
      frequency: formData.frequency.trim(),
      duration: formData.duration,
      quantity: formData.quantity,
      unit: formData.unit,
      purpose: formData.purpose?.trim()
    }
  }

  /**
   * 生成默认表单数据
   */
  static getDefaultTreatmentForm(): TreatmentFormData {
    return {
      batchId: '',
      animalIds: [],
      symptoms: '',
      diagnosis: '',
      treatmentPlan: '',
      veterinarianName: '',
      veterinarianContact: '',
      treatmentDate: this.formatDate(new Date()),
      estimatedDuration: 7,
      notes: ''
    }
  }

  /**
   * 生成默认用药表单数据
   */
  static getDefaultMedicationForm(): MedicationFormData {
    return {
      medicineId: '',
      medicineName: '',
      dosage: '',
      frequency: '每日1次',
      duration: 7,
      quantity: 1,
      unit: '支',
      purpose: '',
      notes: ''
    }
  }

  /**
   * 获取用药频率选项
   */
  static getFrequencyOptions(): Array<{label: string; value: string}> {
    return [
      { label: '每日1次', value: '每日1次' },
      { label: '每日2次', value: '每日2次' },
      { label: '每日3次', value: '每日3次' },
      { label: '隔日1次', value: '隔日1次' },
      { label: '每周1次', value: '每周1次' },
      { label: '每周2次', value: '每周2次' },
      { label: '必要时', value: '必要时' }
    ]
  }

  /**
   * 获取药品单位选项
   */
  static getUnitOptions(): Array<{label: string; value: string}> {
    return [
      { label: '支', value: '支' },
      { label: '瓶', value: '瓶' },
      { label: '盒', value: '盒' },
      { label: '袋', value: '袋' },
      { label: '片', value: '片' },
      { label: '粒', value: '粒' },
      { label: '毫升', value: 'ml' },
      { label: '升', value: 'L' },
      { label: '克', value: 'g' },
      { label: '千克', value: 'kg' }
    ]
  }

  /**
   * 获取治疗状态选项
   */
  static getTreatmentStatusOptions(): Array<{
    label: string
    value: string
    color: string
    icon: string
  }> {
    return [
      {
        label: '治疗中',
        value: 'ongoing',
        color: '#F59E0B',
        icon: 'time-circle'
      },
      {
        label: '已治愈',
        value: 'cured',
        color: '#22C55E',
        icon: 'check-circle'
      },
      {
        label: '已死亡',
        value: 'death',
        color: '#EF4444',
        icon: 'close-circle'
      },
      {
        label: '已取消',
        value: 'cancelled',
        color: '#9CA3AF',
        icon: 'minus-circle'
      }
    ]
  }

  /**
   * 计算治疗天数
   */
  static calculateTreatmentDays(startDate: string | Date, endDate?: string | Date): number {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate
    const end = endDate 
      ? (typeof endDate === 'string' ? new Date(endDate) : endDate)
      : new Date()
    
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }

  /**
   * 格式化日期
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 验证手机号
   */
  static validatePhone(phone: string): boolean {
    const phoneRegex = /^1[3-9]\d{9}$/
    return phoneRegex.test(phone)
  }

  /**
   * 生成治疗记录编号
   */
  static generateTreatmentId(): string {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `TR${year}${month}${day}${random}`
  }
}
