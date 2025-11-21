// components/vaccine-form-popup/vaccine-form-popup.ts
Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    // 是否显示弹窗
    visible: {
      type: Boolean,
      value: false
    },
    // 表单数据
    formData: {
      type: Object,
      value: {
        veterinarianName: '',
        veterinarianContact: '',
        vaccineName: '',
        manufacturer: '',
        batchNumber: '',
        dosage: '',
        vaccinationCount: 0,
        vaccineCost: '',
        veterinaryCost: '',
        otherCost: '',
        notes: ''
      }
    },
    // 表单错误
    formErrors: {
      type: Object,
      value: {}
    },
    // 错误列表
    errorList: {
      type: Array,
      value: []
    },
    // 存栏数量
    stockQuantity: {
      type: Number,
      value: 0,
      observer: function(newVal: unknown) {
        // 确保值始终为数字，避免类型不匹配警告
        // 如果传入的不是数字，转换为数字
        if (newVal != null && typeof newVal !== 'number') {
          const numVal = Number(newVal)
          if (!isNaN(numVal) && this.properties.stockQuantity !== numVal) {
            this.setData({
              stockQuantity: numVal
            })
          } else if (isNaN(numVal)) {
            this.setData({
              stockQuantity: 0
            })
          }
        }
      }
    }
  },

  data: {
    totalCostFormatted: '¥0.00'
  },

  observers: {
    'formData.vaccineCost, formData.veterinaryCost, formData.otherCost': function(
      vaccineCost: string,
      veterinaryCost: string,
      otherCost: string
    ) {
      this.calculateTotalCost()
    }
  },

  methods: {
    // 输入处理
    onInput(e: CustomEvent) {
      const { field } = e.currentTarget.dataset
      const { value } = e.detail
      
      this.triggerEvent('input', {
        field,
        value
      })
    },

    // 数值输入处理
    onNumberInput(e: CustomEvent) {
      const { field } = e.currentTarget.dataset
      const { value } = e.detail
      
      this.triggerEvent('numberinput', {
        field,
        value
      })
    },

    // 计算总费用
    calculateTotalCost() {
      const { formData } = this.properties
      const vaccineCost = parseFloat(formData.vaccineCost?.toString() || '0') || 0
      const veterinaryCost = parseFloat(formData.veterinaryCost?.toString() || '0') || 0
      const otherCost = parseFloat(formData.otherCost?.toString() || '0') || 0
      const totalCost = vaccineCost + veterinaryCost + otherCost
      
      const totalCostFormatted = `¥${totalCost.toFixed(2)}`
      this.setData({ totalCostFormatted })
    },

    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
    },

    // 提交表单
    onSubmit() {
      this.triggerEvent('submit', {
        formData: this.properties.formData
      })
    }
  }
})

