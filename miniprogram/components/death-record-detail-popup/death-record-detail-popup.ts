// components/death-record-detail-popup/death-record-detail-popup.ts
Component<{
  isClosing: boolean
}, {}, {
  onClose(): void
  onVisibleChange(e: any): void
}>({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    // 是否显示弹窗
    visible: {
      type: Boolean,
      value: false
    },
    // 记录数据
    record: {
      type: Object,
      value: null
    }
  },

  data: {
    isClosing: false  // 添加关闭状态标志
  },

  methods: {
    // 关闭弹窗
    onClose() {
      // 防止重复触发关闭
      if (this.data.isClosing) {
        return
      }
      
      this.setData({ isClosing: true })
      
      // 触发关闭事件
      this.triggerEvent('close')
      
      // 延迟重置状态，避免快速重复点击
      setTimeout(() => {
        this.setData({ isClosing: false })
      }, 500)
    },

    // 弹窗可见性变化
    onVisibleChange(e: any) {
      // 只在弹窗关闭时处理，防止重复触发
      if (!e.detail.visible && !this.data.isClosing) {
        this.onClose()
      }
    }
  }
})

