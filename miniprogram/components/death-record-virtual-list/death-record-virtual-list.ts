/**
 * 死亡记录虚拟列表组件
 * 专门用于优化死亡记录列表的渲染性能
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
      value: 300 // 死亡记录卡片稍高
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
