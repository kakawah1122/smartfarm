import type {
  InputEvent,
  TapEvent,
  ScrollEvent,
  CustomEvent,
  PropType
} from '../../../../../../../../typings/core';

// components/diagnosis-detail-popup/diagnosis-detail-popup.ts
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
    onVisibleChange(e: unknown) {
      if (!e.detail.visible) {
        this.onClose()
      }
    },

    // 预览图片
    onPreviewImage(e: unknown) {
      const { url } = e.currentTarget.dataset
      const images = this.properties.record?.images || []
      
      if (images.length > 0) {
        wx.previewImage({
          current: url,
          urls: images
        })
      }
    }
  }
})

