// 鹅价记录详情弹窗组件
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
    // 日期
    date: {
      type: String,
      value: ''
    },
    // 记录数据
    records: {
      type: Array,
      value: []
    }
  },

  methods: {
    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
    },

    // 弹窗可见性变化
    onVisibleChange(e: any) {
      if (!e.detail.visible) {
        this.onClose()
      }
    }
  }
})

