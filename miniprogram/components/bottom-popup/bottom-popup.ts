// 底部弹窗组件
Component<{
  isProcessing: boolean
}, {}, {
  onVisibleChange(e: any): void
  onClose(): void
  onCancel(): void
  onConfirm(): void
}>({
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

  data: {
    isProcessing: false  // 添加处理状态，避免重复触发
  },

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
      
      // 防止重复处理
      if (this.data.isProcessing) {
        return
      }
      
      // 根据弹窗可见性控制 tabbar 显示
      if (visible) {
        wx.hideTabBar({ animation: false })
      } else {
        wx.showTabBar({ animation: false })
        // 当弹窗关闭时（点击遮罩层），触发 close 事件通知父组件
        this.triggerEvent('close')
      }
      this.triggerEvent('visiblechange', { visible })
    },
    
    onClose() {
      // 防止重复触发
      if (this.data.isProcessing) {
        return
      }
      
      this.setData({ isProcessing: true })
      
      this.triggerEvent('close')
      // 关闭时恢复 tabbar
      wx.showTabBar({ animation: false })
      
      // 延迟重置状态
      setTimeout(() => {
        this.setData({ isProcessing: false })
      }, 300)
    },
    
    onCancel() {
      // 防止重复触发
      if (this.data.isProcessing) {
        return
      }
      
      this.triggerEvent('cancel')
      // 取消时恢复 tabbar
      wx.showTabBar({ animation: false })
    },
    
    onConfirm() {
      // 防止重复触发
      if (this.data.isProcessing) {
        return
      }
      
      this.triggerEvent('confirm')
    }
  }
})
