// components/death-record-detail-popup/death-record-detail-popup.ts

type VisibleChangeEvent = WechatMiniprogram.CustomEvent<{ visible: boolean }>

Component<{
  isClosing: boolean
  _timerIds: number[]
}, {}, {
  onClose(): void
  onVisibleChange(e: VisibleChangeEvent): void
  _safeSetTimeout(callback: () => void, delay: number): number
  _clearAllTimers(): void
}>({
  options: {
    styleIsolation: 'apply-shared'
  },

  // ✅ 组件卸载时清理定时器
  lifetimes: {
    detached() {
      this._clearAllTimers()
    }
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
    isClosing: false,  // 添加关闭状态标志
    _timerIds: [] as number[]
  },

  methods: {
    // ✅ 安全设置定时器
    _safeSetTimeout(callback: () => void, delay: number): number {
      const timerId = setTimeout(() => {
        const index = this.data._timerIds.indexOf(timerId as unknown as number)
        if (index > -1) {
          const newTimerIds = [...this.data._timerIds]
          newTimerIds.splice(index, 1)
          this.setData({ _timerIds: newTimerIds })
        }
        callback()
      }, delay) as unknown as number
      this.setData({ _timerIds: [...this.data._timerIds, timerId] })
      return timerId
    },
    
    // ✅ 清理所有定时器
    _clearAllTimers() {
      this.data._timerIds.forEach((id: number) => clearTimeout(id))
      this.setData({ _timerIds: [] })
    },

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
      this._safeSetTimeout(() => {
        this.setData({ isClosing: false })
      }, 500)
    },

    // 弹窗可见性变化
    onVisibleChange(e: VisibleChangeEvent) {
      // 只在弹窗关闭时处理，防止重复触发
      if (!e.detail.visible && !this.data.isClosing) {
        this.onClose()
      }
    }
  }
})

