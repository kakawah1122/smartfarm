// components/material-record-detail-popup/material-record-detail-popup.ts
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
    // 记录数据
    record: {
      type: Object,
      value: null
    }
  },

  methods: {
    // 关闭弹窗
    onClose() {
      console.log('material-record-detail-popup: onClose triggered')
      this.setData({
        visible: false
      })
      // 确保事件被触发
      setTimeout(() => {
        this.triggerEvent('close')
      }, 100)
    },

    // 弹窗可见性变化
    onVisibleChange(e: any) {
      console.log('material-record-detail-popup: onVisibleChange', e.detail)
      if (!e.detail?.visible) {
        this.triggerEvent('close')
      }
    },
    
    // 点击确认按钮
    onConfirm() {
      console.log('material-record-detail-popup: onConfirm triggered')
      this.onClose()
    },
    
    // 防止触摸穿透
    preventTouchMove() {
      return false
    }
  }
})

