// 底部弹窗组件
Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: ''
    },
    showClose: {
      type: Boolean,
      value: true
    },
    closeOnOverlayClick: {
      type: Boolean,
      value: true
    },
    showOverlay: {
      type: Boolean,
      value: true
    },
    zIndex: {
      type: Number,
      value: 12000
    },
    showActions: {
      type: Boolean,
      value: false
    },
    cancelText: {
      type: String,
      value: ''
    },
    confirmText: {
      type: String,
      value: ''
    },
    confirmDisabled: {
      type: Boolean,
      value: false
    },
    confirmLoading: {
      type: Boolean,
      value: false
    }
  },

  data: {},

  observers: {
    visible(visible: boolean) {
      if (visible) {
        wx.hideTabBar({ animation: false })
      } else {
        wx.showTabBar({ animation: false })
      }
    }
  },

  methods: {
    onVisibleChange(e: any) {
      const { visible } = e.detail
      this.triggerEvent('visiblechange', { visible })
    },
    
    onClose() {
      this.triggerEvent('close')
    },
    
    onCancel() {
      this.triggerEvent('cancel')
    },
    
    onConfirm() {
      this.triggerEvent('confirm')
    }
  }
})
