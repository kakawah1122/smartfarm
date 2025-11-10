// components/nutrition-form-popup/nutrition-form-popup.ts
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
        nutritionId: '',
        nutritionName: '',
        quantity: 0,
        unit: '',
        dosage: '',
        notes: '',
        operator: ''
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
    // 可用营养品列表
    availableNutrition: {
      type: Array,
      value: []
    },
    // 选中的营养品
    selectedNutrition: {
      type: Object,
      value: null
    }
  },

  methods: {
    // 输入处理
    onInput(e: any) {
      const { field } = e.currentTarget.dataset
      const { value } = e.detail
      
      this.triggerEvent('input', {
        field,
        value
      })
    },

    // 数量输入处理
    onQuantityInput(e: any) {
      const { value } = e.detail
      const quantity = parseInt(value) || 0
      
      this.triggerEvent('quantityinput', {
        value: quantity
      })
    },

    // 选择营养品
    onNutritionSelect(e: any) {
      const index = e.detail.value
      this.triggerEvent('nutritionselect', {
        index
      })
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

