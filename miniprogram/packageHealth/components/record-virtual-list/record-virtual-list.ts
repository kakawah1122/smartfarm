/**
 * 记录虚拟列表组件
 * 用于优化异常记录、死亡记录等长列表的渲染性能
 */

Component({
  options: {
    styleIsolation: 'apply-shared' // 继承父页面样式
  },

  properties: {
    // 记录列表数据
    records: {
      type: Array,
      value: []
    },
    // 容器高度（rpx）
    height: {
      type: Number,
      value: 1000
    },
    // 每项高度（rpx）
    itemHeight: {
      type: Number,
      value: 260 // 根据实际卡片高度调整
    },
    // 缓冲区大小
    bufferSize: {
      type: Number,
      value: 3
    }
  },

  methods: {
    /**
     * 记录卡片点击事件
     */
    onRecordTap(e: WechatMiniprogram.CustomEvent) {
      const { id } = e.currentTarget.dataset
      this.triggerEvent('recordtap', { id })
    }
  }
})
