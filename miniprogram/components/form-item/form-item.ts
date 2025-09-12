// form-item.ts - 通用表单项组件
Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    // 标签文本
    label: {
      type: String,
      value: ''
    },
    // 是否必填
    required: {
      type: Boolean,
      value: false
    },
    // 错误信息
    error: {
      type: String,
      value: ''
    },
    // 是否显示边框
    border: {
      type: Boolean,
      value: true
    },
    // 标签宽度
    labelWidth: {
      type: String,
      value: '200rpx'
    },
    // 内容对齐方式
    contentAlign: {
      type: String,
      value: 'left' // left|center|right
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    },
    // 自定义样式类
    customClass: {
      type: String,
      value: ''
    }
  },

  data: {
    focused: false
  },

  methods: {
    onFocus() {
      this.setData({ focused: true })
      this.triggerEvent('focus')
    },

    onBlur() {
      this.setData({ focused: false })
      this.triggerEvent('blur')
    },

    onTap() {
      if (!this.data.disabled) {
        this.triggerEvent('tap')
      }
    }
  }
})
