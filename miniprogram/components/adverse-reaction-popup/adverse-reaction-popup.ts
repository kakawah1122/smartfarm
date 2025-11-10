// components/adverse-reaction-popup/adverse-reaction-popup.ts
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
    // 异常反应数据
    reactionData: {
      type: Object,
      value: {
        count: 0,
        symptoms: '',
        severityIndex: 0,
        treatment: '',
        followUp: ''
      }
    },
    // 症状等级选项
    severityOptions: {
      type: Array,
      value: [
        { label: '轻微', value: 'mild' },
        { label: '中等', value: 'moderate' },
        { label: '严重', value: 'severe' }
      ]
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

    // 症状等级选择
    onSeverityChange(e: any) {
      const index = e.detail.value
      this.triggerEvent('severitychange', {
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
        reactionData: this.properties.reactionData
      })
    }
  }
})

