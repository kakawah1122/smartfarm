/**
 * 通用表单验证工具
 * 抽取公共验证逻辑，保持原有验证规则不变
 */

interface ValidationRule {
  required?: boolean
  min?: number
  max?: number
  pattern?: RegExp
  custom?: (value: any) => boolean | string
  message?: string
}

interface ValidationRules {
  [field: string]: ValidationRule | ValidationRule[]
}

/**
 * 通用表单验证器
 */
export class FormValidator {
  /**
   * 验证单个字段
   */
  static validateField(value: any, rules: ValidationRule | ValidationRule[]): string | null {
    const ruleArray = Array.isArray(rules) ? rules : [rules]
    
    for (const rule of ruleArray) {
      // 必填验证
      if (rule.required && (!value || value === '')) {
        return rule.message || '此字段为必填'
      }
      
      // 最小值验证
      if (rule.min !== undefined) {
        const numValue = Number(value)
        if (numValue < rule.min) {
          return rule.message || `值必须大于等于${rule.min}`
        }
      }
      
      // 最大值验证
      if (rule.max !== undefined) {
        const numValue = Number(value)
        if (numValue > rule.max) {
          return rule.message || `值必须小于等于${rule.max}`
        }
      }
      
      // 正则验证
      if (rule.pattern && value) {
        if (!rule.pattern.test(String(value))) {
          return rule.message || '格式不正确'
        }
      }
      
      // 自定义验证
      if (rule.custom) {
        const result = rule.custom(value)
        if (result !== true) {
          return typeof result === 'string' ? result : (rule.message || '验证失败')
        }
      }
    }
    
    return null
  }
  
  /**
   * 验证整个表单
   */
  static validateForm(formData: any, rules: ValidationRules): {
    isValid: boolean
    errors: Record<string, string>
    errorList: string[]
  } {
    const errors: Record<string, string> = {}
    
    for (const [field, fieldRules] of Object.entries(rules)) {
      const value = formData[field]
      const error = this.validateField(value, fieldRules)
      
      if (error) {
        errors[field] = error
      }
    }
    
    const errorList = Object.values(errors)
    
    return {
      isValid: errorList.length === 0,
      errors,
      errorList
    }
  }
}

/**
 * 疫苗表单验证规则
 */
export const vaccineFormRules: ValidationRules = {
  veterinarianName: {
    required: true,
    message: '请填写兽医姓名'
  },
  vaccineName: {
    required: true,
    message: '请填写疫苗名称'
  },
  vaccinationCount: [
    {
      required: true,
      message: '请填写接种数量'
    },
    {
      min: 1,
      message: '接种数量必须大于0'
    }
  ],
  veterinarianContact: {
    pattern: /^1[3-9]\d{9}$/,
    message: '请填写正确的手机号码'
  }
}

/**
 * 用药表单验证规则
 */
export const medicationFormRules: ValidationRules = {
  medicineId: {
    required: true,
    message: '请选择药品'
  },
  quantity: [
    {
      required: true,
      message: '请填写使用数量'
    },
    {
      min: 0.01,
      message: '使用数量必须大于0'
    }
  ],
  animalCount: [
    {
      required: true,
      message: '请填写用药动物数量'
    },
    {
      min: 1,
      message: '用药动物数量必须大于0'
    }
  ],
  operator: {
    required: true,
    message: '请填写操作人员'
  }
}

/**
 * 营养表单验证规则
 */
export const nutritionFormRules: ValidationRules = {
  nutritionId: {
    required: true,
    message: '请选择营养品'
  },
  quantity: [
    {
      required: true,
      message: '请填写使用数量'
    },
    {
      min: 0.01,
      message: '使用数量必须大于0'
    }
  ],
  operator: {
    required: true,
    message: '请填写操作人员'
  }
}
