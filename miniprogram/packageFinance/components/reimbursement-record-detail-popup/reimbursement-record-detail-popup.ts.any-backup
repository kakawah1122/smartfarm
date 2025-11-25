// components/reimbursement-record-detail-popup/reimbursement-record-detail-popup.ts
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
      this.triggerEvent('close')
    },

    // 弹窗可见性变化
    onVisibleChange(e: any) {
      if (!e.detail.visible) {
        this.onClose()
      }
    },

    // 预览图片
    previewImage(e: any) {
      const { url } = e.currentTarget.dataset
      const vouchers = this.properties.record?.reimbursement?.vouchers || []
      
      // 提取所有图片的 fileId
      const urls = vouchers.map((v: any) => v.fileId)
      
      wx.previewImage({
        current: url,
        urls: urls
      })
    }
  }
})

