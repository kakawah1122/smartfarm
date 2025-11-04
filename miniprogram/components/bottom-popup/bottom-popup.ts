// 底部弹窗组件
Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  
  /**
   * 组件的属性列表
   */
  properties: {
    // 弹窗可见性
    visible: {
      type: Boolean,
      value: false
    },
    
    // 弹窗标题
    title: {
      type: String,
      value: ''
    },
    
    // 是否显示关闭按钮
    showClose: {
      type: Boolean,
      value: true
    },
    
    // 点击遮罩是否关闭
    closeOnOverlayClick: {
      type: Boolean,
      value: true
    },
    
    // 是否显示遮罩
    showOverlay: {
      type: Boolean,
      value: true
    },
    
    // z-index
    zIndex: {
      type: Number,
      value: 12000
    },
    
    // 是否显示操作按钮
    showActions: {
      type: Boolean,
      value: false
    },
    
    // 取消按钮文字
    cancelText: {
      type: String,
      value: ''
    },
    
    // 确认按钮文字
    confirmText: {
      type: String,
      value: ''
    },
    
    // 确认按钮是否禁用
    confirmDisabled: {
      type: Boolean,
      value: false
    },
    
    // 确认按钮是否加载中
    confirmLoading: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 弹窗可见性变化
    onVisibleChange(e: any) {
      const { visible } = e.detail
      this.triggerEvent('visiblechange', { visible })
    },
    
    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
    },
    
    // 取消操作
    onCancel() {
      this.triggerEvent('cancel')
    },
    
    // 确认操作
    onConfirm() {
      this.triggerEvent('confirm')
    }
  }
})
