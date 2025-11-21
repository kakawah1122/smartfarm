import type {
  InputEvent,
  TapEvent,
  ScrollEvent,
  CustomEvent,
  PropType
} from '../../../../../../../../typings/core';

// components/adverse-reaction-popup/adverse-reaction-popup.ts
Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {properties: {
    // 是否显示弹窗
    visible: {
      type: Boolean as PropType<boolean>,
      value: false
    }},
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
    onInput(e: InputEvent) {
      const { field } = e.currentTarget.dataset
      const { value } = e.detail
      
      this.triggerEvent('input', {
        field,
        value
      } as { value: string })
    },

    // 症状等级选择
    onSeverityChange(e: unknown) {
      const index = e.detail.value
      this.triggerEvent('severitychange', {
        index
      } as Record<string, unknown>)
    },

    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
    },

    // 提交表单
    onSubmit() {
      this.triggerEvent('submit', {
        reactionData: this.properties.reactionData
      } as Record<string, unknown>)
    }
  }
})

