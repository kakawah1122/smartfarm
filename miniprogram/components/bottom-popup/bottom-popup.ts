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
      this.triggerEvent('close')
      // 关闭时恢复 tabbar
      wx.showTabBar({ animation: false })
    },
    
    onCancel() {
      this.triggerEvent('cancel')
      // 取消时恢复 tabbar
      wx.showTabBar({ animation: false })
    },
    
    onConfirm() {
      this.triggerEvent('confirm')
    }
  }
})
