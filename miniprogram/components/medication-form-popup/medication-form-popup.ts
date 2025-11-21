// components/medication-form-popup/medication-form-popup.ts
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
        medicineId: '',
        medicineName: '',
        quantity: 0,
        unit: '',
        dosage: '',
        animalCount: 0,
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
    // 可用药品列表
    availableMedicines: {
      type: Array,
      value: []
    },
    // 选中的药品
    selectedMedicine: {
      type: Object,
      value: null
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

    // 数量输入处理
    onQuantityInput(e: CustomEvent) {
      const { value } = e.detail
      const quantity = parseInt(value) || 0
      
      this.triggerEvent('quantityinput', {
        value: quantity
      })
    },

    // 鹅只数量输入处理
    onAnimalCountInput(e: CustomEvent) {
      const { value } = e.detail
      const animalCount = parseInt(value) || 0
      
      this.triggerEvent('animalcountinput', {
        value: animalCount
      })
    },

    // 选择药品
    onMedicineSelect(e: CustomEvent) {
      const index = e.detail.value
      this.triggerEvent('medicineselect', {
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

