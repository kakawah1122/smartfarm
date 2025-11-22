/**
 * 任务虚拟列表组件
 * 使用虚拟滚动优化长列表性能
 */

Component({
  properties: {
    // 任务列表
    tasks: {
      type: Array,
      value: []
    },
    // 容器高度
    height: {
      type: Number,
      value: 600
    },
    // 每项高度
    itemHeight: {
      type: Number,
      value: 180
    },
    // 缓冲区大小
    bufferSize: {
      type: Number,
      value: 5
    },
    // 是否隐藏操作按钮
    hideActions: {
      type: Boolean,
      value: false
    },
    // 是否启用下拉刷新
    enablePullRefresh: {
      type: Boolean,
      value: false
    },
    // 是否启用上拉加载
    enableLoadMore: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    /**
     * 任务点击事件
     */
    onTaskTap(e: WechatMiniprogram.CustomEvent) {
      const task = e.currentTarget.dataset.task
      this.triggerEvent('tasktap', { task })
    },

    /**
     * 完成任务
     */
    onCompleteTask(e: WechatMiniprogram.CustomEvent) {
      const task = e.currentTarget.dataset.task
      this.triggerEvent('complete', { task })
    },

    /**
     * 查看详情
     */
    onViewDetail(e: WechatMiniprogram.CustomEvent) {
      const task = e.currentTarget.dataset.task
      this.triggerEvent('viewdetail', { task })
    },

    /**
     * 下拉刷新
     */
    onPullRefresh() {
      this.triggerEvent('refresh')
    },

    /**
     * 上拉加载
     */
    onLoadMore() {
      this.triggerEvent('loadmore')
    }
  }
})
